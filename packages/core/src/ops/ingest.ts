import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, IngestInput, type IngestOutput } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { effectiveRule } from '../rules/compile.ts';
import { extract, type Extraction } from '../ingest/extract.ts';
import { cleanupFetch, fetchDocument } from '../ingest/fetch.ts';
import { nameDocument, nameIsUseless, type NamedDocument } from '../ingest/name.ts';
import { provenanceLines, recordDocument, storeDocument } from '../ingest/store.ts';
import { hashFile } from '../kb/scan.ts';
import { serializeYamlString } from '../kb/frontmatter.ts';
import { physicalFolders } from '../kb/folders.ts';
import { newPrefixedId } from '../store/ids.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { matchesConflictPath } from '../index/page-quarantine.ts';
import type { ChangeFile } from '../write/journal.ts';
import { recall } from './recall.ts';
import { normalizeSlug } from './write.ts';

/**
 * Pull documents into memory — **a file, a folder, a URL** — and for each:
 * extract, OCR, name, summarize, and route.
 *
 * `ingest` is the op that earns the most from living in the layer. "Run text extraction and
 * OCR on documents", "give `IMG_4821.HEIC` a name that means something" and "decide where a
 * dropped file belongs" are three things usually asked of a model in a prompt, replaced here
 * by one call that happens every time.
 *
 * The order matters: extract first, because everything else depends on having the text;
 * then name from the content; then route; then gate. A file whose text cannot be read is
 * never given a confident name, and one whose destination is unclear is left where it is
 * rather than filed confidently into the wrong place.
 */
export async function ingest(ctx: AknoContext, rawInput: unknown): Promise<IngestOutput> {
  const input = IngestInput.parse(rawInput);

  if (input.url) return ingestUrl(ctx, input);

  const source = path.resolve(input.path!);
  const stat = await fsp.stat(source).catch(() => null);
  if (!stat) throw new AknoError('not_found', `no file at ${source}`);

  if (stat.isDirectory()) return ingestFolder(ctx, input, source);
  return ingestFile(ctx, input, {
    source,
    originalName: path.basename(source),
    move: input.route ?? false,
  });
}

// ─── A URL ──────────────────────────────────────────────────────────────────

async function ingestUrl(
  ctx: AknoContext,
  input: ReturnType<typeof IngestInput.parse>,
): Promise<IngestOutput> {
  const fetched = await fetchDocument({
    url: input.url!,
    maxBytes: ctx.config.ingest.maxFileBytes,
    trustedOrigins: ctx.config.ingest.trustedUrlOrigins,
  });
  try {
    return await ingestFile(ctx, input, {
      source: fetched.path,
      originalName: fetched.originalName,
      // The temp copy is ours; moving it saves a copy and leaves nothing behind.
      move: true,
      // Worth recording: months later, "where did this come from" is the question a
      // downloaded document cannot otherwise answer.
      sourceUrl: fetched.finalUrl,
    });
  } finally {
    await cleanupFetch(fetched);
  }
}

// ─── A folder ───────────────────────────────────────────────────────────────

/**
 * One level deep, deliberately. A recursive walk of a folder someone pointed at by
 * mistake is a thousand model calls and a knowledge base full of pages nobody asked for;
 * a flat pass over a downloads folder is the case that actually comes up.
 *
 * Every file gets its own verdict. Three filing themselves and two needing a decision is
 * not one outcome, and collapsing it would lose the two.
 */
async function ingestFolder(
  ctx: AknoContext,
  input: ReturnType<typeof IngestInput.parse>,
  folder: string,
): Promise<IngestOutput> {
  const limit = input.limit ?? 50;
  const entries = (await fsp.readdir(folder, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    return { status: 'empty', outcome: 'skipped', note: `${folder} holds no files` };
  }

  const batch: NonNullable<IngestOutput['batch']> = [];
  let landed = 0;

  for (const name of entries.slice(0, limit)) {
    try {
      const result = await ingestFile(ctx, input, {
        source: path.join(folder, name),
        originalName: name,
        move: input.route ?? false,
      });
      batch.push({
        source: name,
        outcome: result.outcome,
        ...(result.slug ? { slug: result.slug } : {}),
        ...(result.note ? { note: result.note } : {}),
      });
      if (result.outcome === 'ok') landed++;
    } catch (err) {
      // One unreadable file must not abandon the rest of the folder.
      batch.push({
        source: name,
        outcome: 'error',
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const notLookedAt = entries.length - Math.min(entries.length, limit);
  return {
    status: 'ok',
    outcome: landed > 0 ? 'ok' : 'skipped',
    batch,
    // Default to visible. A silent cap reads as "that was all of them".
    note:
      notLookedAt > 0
        ? `${landed} of ${Math.min(entries.length, limit)} filed; ${notLookedAt} more were not looked at (--limit)`
        : `${landed} of ${entries.length} filed`,
  };
}

// ─── One file ───────────────────────────────────────────────────────────────

export interface FileSource {
  source: string;
  originalName: string;
  /**
   * **The inbox is the only place Akno moves files.** A file dropped straight
   * into `documents/` was put there on purpose; Akno will name it, page it and index
   * it, but never relocate it. An external file handed to `ingest` is copied, so the
   * caller still has what they passed.
   */
  move: boolean;
  sourceUrl?: string;
}

export async function ingestFile(
  ctx: AknoContext,
  input: ReturnType<typeof IngestInput.parse>,
  file: FileSource,
): Promise<IngestOutput> {
  const extension = path.extname(file.originalName).toLowerCase();
  if (ctx.config.ingest.blockedExtensions.includes(extension.replace(/^\./, ''))) {
    throw new AknoError('invalid', `${extension} files are not ingested (ingest.blocked_extensions)`);
  }

  // ── Dedupe ──────────────────────────────────────────────────────────────
  // Re-ingesting a document is a no-op that returns where it already lives.
  const sha = await hashFile(file.source);
  const existing = ctx.store.db
    .prepare(
      `SELECT d.id, d.rel_path, p.slug FROM documents d
         LEFT JOIN pages p ON p.id = d.page_id WHERE d.sha256 = ?`,
    )
    .get(sha) as { id: string; rel_path: string; slug: string | null } | undefined;
  if (existing) {
    return {
      status: 'ok',
      outcome: 'duplicate',
      document: existing.id,
      rel_path: existing.rel_path,
      ...(existing.slug ? { slug: existing.slug } : {}),
      note: 'the same bytes are already stored — nothing was added',
    };
  }

  // ── Extract ─────────────────────────────────────────────────────────────
  const extraction = await extract({
    absPath: file.source,
    maxOcrPages: ctx.config.ingest.maxOcrPages,
    maxBytes: ctx.config.ingest.maxFileBytes,
    ...(ctx.models.vision.available ? { vision: ctx.models.vision } : {}),
  });

  // ── Name ────────────────────────────────────────────────────────────────
  const named =
    extraction.text.length > 0
      ? await nameDocument({
          text: extraction.text,
          originalName: file.originalName,
          folders: existingFolders(ctx),
          derive: ctx.models.derive,
        })
      : null;

  const confident = named !== null && named.confidence >= ctx.config.ingest.nameConfidence;
  if (!confident) {
    // The second guard. A photo of a garden or a corrupt scan keeps its name, gets no
    // page, and is flagged rather than given a confident wrong one. Skipping is a
    // *result*, not a failure — the caller is told exactly which guard fired.
    return {
      status: extraction.text.length === 0 ? 'degraded' : 'ok',
      outcome: 'skipped',
      ...(extraction.pageCount !== null ? { page_count: extraction.pageCount } : {}),
      ocr: extraction.ocr,
      text_from: extraction.via,
      note:
        extraction.text.length === 0
          ? `nothing could be extracted: ${extraction.note ?? 'no text found'}. The file was left where it is.`
          : named?.error
            ? `could not name it: ${named.error}. The file was left where it is.`
            : `naming confidence ${named?.confidence ?? 0} is below ${ctx.config.ingest.nameConfidence}. ` +
              'The file was left where it is rather than given a confident wrong name.',
    };
  }

  // ── Route ───────────────────────────────────────────────────────────────
  const destination = await route(ctx, input, named);
  if (destination.kind === 'unrouted') {
    // An unrouted file sits visibly where you dropped it, rather than being filed
    // confidently into the wrong place, where you would never look for it. An inbox with
    // three things in it is a to-do list; a misfiled document is a lost one.
    return {
      status: 'ok',
      outcome: 'requires_approval',
      summary: named.summary,
      ...(extraction.pageCount !== null ? { page_count: extraction.pageCount } : {}),
      ocr: extraction.ocr,
      text_from: extraction.via,
      approval: proposeDestination(ctx, named, destination.nearest, file),
      note: `nothing scored above ${ctx.config.routeThreshold} — the file stays where it is`,
    };
  }

  const folder = destination.folder;
  const pageSlug = normalizeSlug(folder ? `${folder}/${named.slug}` : named.slug);

  // **Ingestion behaviour is a rule, not a heuristic**, because the right answer
  // genuinely differs by folder — a research paper you want mined, a contract you do not.
  // Declaring it once per folder is cheaper and more predictable than classifying every
  // arrival with a model.
  const rule = effectiveRule(pageSlug, ctx.config.rules);
  if (rule.ingest === 'ignore') {
    return {
      status: 'ok',
      outcome: 'skipped',
      note: `the rule for '${folder ?? '.'}' says ingest: ignore — the file was left where it is`,
    };
  }

  // A new folder is checked exactly as a `write` into it would be.
  const gated = ctx.gate.check(pageSlug, ctx.actor);
  if (!gated.allowed) {
    return {
      status: 'ok',
      outcome: 'requires_folder',
      summary: named.summary,
      ocr: extraction.ocr,
      text_from: extraction.via,
      requires_folder: gated.requiresFolder,
      note:
        `'${gated.requiresFolder.folder}' has not been declared — the file stays where it is. ` +
        'Call `folder` with a description of what belongs there, then ingest it again.',
    };
  }

  // ── Store ───────────────────────────────────────────────────────────────
  const finalSlug = await uniqueSlug(ctx, pageSlug);
  // `ingest: "file"` indexes the bytes and their text with no page at all — for a folder
  // of media where a stub page per file would be noise, not memory.
  const wantsPage = rule.ingest !== 'file';
  if (wantsPage && matchesConflictPath(`${finalSlug}.md`, ctx.config.index.conflictPathPatterns)) {
    throw new AknoError('conflict', 'the generated page matches a configured Markdown conflict path', {
      reason: 'source_conflict',
    });
  }
  const stored = await storeDocument({
    ctx,
    source: file.source,
    pageSlug: finalSlug,
    move: file.move,
  });
  const files: ChangeFile[] = [stored.file];

  let pageRel: string | null = null;

  if (wantsPage) {
    pageRel = `${finalSlug}.md`;
    const page = composePage({
      named,
      extraction,
      attachment: path.basename(stored.relPath),
      ...(file.sourceUrl ? { sourceUrl: file.sourceUrl } : {}),
      ...(input.label ? { label: input.label } : {}),
    });
    const written = await writeFileAtomic(ctx.config.aknoPath, pageRel, page);
    files.push({ relPath: pageRel, action: 'created', before: null, after: written.after });
  }

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'ingest',
    summary: `ingested ${file.originalName} as ${finalSlug}`,
    files,
  });

  await ctx.indexer.runForeground({ only: files.map((entry) => entry.relPath) });

  const documentId = recordDocument({
    ctx,
    relPath: stored.relPath,
    extraction,
    summary: named.summary,
    label: input.label ?? named.title,
  });

  const related = destination.related.filter((slug) => slug !== finalSlug).slice(0, 4);

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    ...(documentId ? { document: documentId } : {}),
    ...(pageRel ? { slug: finalSlug } : {}),
    rel_path: stored.relPath,
    summary: named.summary,
    ...(extraction.pageCount !== null ? { page_count: extraction.pageCount } : {}),
    ocr: extraction.ocr,
    text_from: extraction.via,
    ...(nameIsUseless(file.originalName) ? { renamed_from: file.originalName } : {}),
    ...(related.length > 0 ? { related } : {}),
    ...(extraction.note ? { note: extraction.note } : {}),
  };
}

// ─── Routing ────────────────────────────────────────────────────────────────

type Destination =
  | { kind: 'folder'; folder: string | null; related: string[] }
  | { kind: 'unrouted'; nearest: string[]; related: string[] };

/**
 * **Routing is a folder decision, not a page-level one** — Akno picks *where a
 * document belongs*, not what it is called relative to its neighbours. It never invents a
 * new folder to route into; a document with no home clears no threshold and stays put.
 *
 * Thresholds `relevance`, never `score`. `score` orders one result set: the best hit is
 * 1.0 whether it is a perfect match or the least bad of a bad batch. Thresholding it
 * meant every document found a home and "a document with no home stays put" could never
 * fire — routing looked like it worked and was in fact unconditional.
 */
async function route(
  ctx: AknoContext,
  input: ReturnType<typeof IngestInput.parse>,
  named: NamedDocument,
): Promise<Destination> {
  const result = await recall(ctx, {
    // Title, type and summary — and deliberately *not* the document's raw text.
    //
    // Measured on a real 223-page knowledge base: adding 400 characters of extracted text
    // collapsed the spread across candidate folders from 0.49 to 0.014, with everything
    // sitting at 0.98–0.99. A query that long resembles everything a little, so nothing
    // can fail `route_threshold` and the winner is decided by noise — a water bill was
    // filed under `travel/2026` while the folder holding its own previous statement did
    // not make the top eight. The threshold was not too low; the query made it unusable.
    query: routingQuery(named),
    mode: 'lookup',
    limit: 8,
    depth: 'summary',
    // The query *is* the document's own summary. Asking a model to rewrite it costs a
    // round trip and cannot improve on the thing being matched.
    expand: false,
  });
  const pages = result.results.filter((entry) => entry.type === 'page');
  const related = pages.map((page) => page.slug);

  // An explicit destination is the caller's decision, not a guess to second-guess.
  if (input.folder) {
    return { kind: 'folder', folder: input.folder.replace(/\/+$/, ''), related };
  }

  const scored = new Map<string, number>();
  for (const card of pages) {
    if (!card.slug.includes('/')) continue;
    if (card.relevance === undefined) continue;
    const folder = card.slug.slice(0, card.slug.lastIndexOf('/'));
    // Best relevance wins per folder rather than a sum: three weak pages in one folder
    // should not outvote one strong page elsewhere.
    scored.set(folder, Math.max(scored.get(folder) ?? 0, card.relevance));
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]);
  const nearest =
    ranked.length > 0
      ? ranked.slice(0, 5).map(([folder]) => folder)
      : [...new Set(pages.map((card) => card.slug.split('/')[0]!))].slice(0, 5);

  // Folders the *evidence* supports. Everything below is chosen from this set and never
  // from outside it, which is the whole content of the threshold.
  const clears = ranked.filter(([, relevance]) => relevance >= ctx.config.routeThreshold);

  if (clears.length > 0) {
    // The model's suggestion is a tie-breaker among folders that already cleared, not a
    // candidate of its own. Two independent signals agreeing is worth more than the
    // ranking's own margin, which between neighbours is often a rounding error.
    const seconded = clears.find(([folder]) => folder === named.suggestedFolder);
    return { kind: 'folder', folder: (seconded ?? clears[0]!)[0], related };
  }

  // Nothing cleared. The suggestion does **not** get to overrule that.
  //
  // It used to: below the threshold, routing fell through to whatever folder the
  // model had named. On a real knowledge base that filed a water bill into an employment
  // folder — `receipts/` was the top-scoring folder at 0.383 against a threshold of 0.5,
  // the refusal was correct, and the fallback then overrode it with a signal weaker than
  // the one that had just been rejected. There are exactly two outcomes here, and
  // "somewhere plausible" is not one of them: a misfiled document is a lost one.
  return { kind: 'unrouted', nearest, related };
}

/**
 * What routing asks about: what the document *is*, not what it says.
 *
 * Exported so the shape is pinned by a test. It is a one-line function guarding a
 * measured cliff — see `route` above — and one well-meant "include a bit of the text for
 * context" edit puts every folder back at 0.99.
 */
export function routingQuery(named: Pick<NamedDocument, 'title' | 'type' | 'summary'>): string {
  return [named.title, named.type, named.summary].filter(Boolean).join('. ');
}

function proposeDestination(
  ctx: AknoContext,
  named: NamedDocument,
  nearest: string[],
  file: FileSource,
): { proposal_id: string; reason: string; nearest: string[] } {
  const id = newPrefixedId('prop');
  ctx.store.db
    .prepare(
      `INSERT INTO proposals(id, at, kind, reason, subject, payload, nearest, status)
       VALUES(?, ?, 'ingest', ?, ?, ?, ?, 'pending')`,
    )
    .run(
      id,
      new Date().toISOString(),
      `where does "${named.title}" go?`,
      named.slug,
      // Enough to replay on approval. A fetched temp file is gone by then, which is why
      // a URL ingest records the URL instead of the path.
      JSON.stringify(file.sourceUrl ? { url: file.sourceUrl } : { path: file.source }),
      JSON.stringify(nearest),
    );
  return { proposal_id: id, reason: `"${named.title}" — ${named.summary}`, nearest };
}

// ─── Page composition ───────────────────────────────────────────────────────

/**
 * A short writeup and a pointer to the file — **not** the file's text.
 *
 * The extracted text used to be pasted in below a `<!-- reference -->` fence, and it was a
 * copy: document text is invalidated by the *file* hash, which a page body cannot honour,
 * and indexing the same words twice made every match inside a document arrive as two hits
 * against one budget. The text is indexed against the document instead, where a hit can
 * name the page within the PDF that produced it. What the reader gets here is what a
 * person would have written: what it is, and where the thing itself lives.
 */
function composePage(options: {
  named: NamedDocument;
  extraction: Extraction;
  attachment: string;
  sourceUrl?: string;
  label?: string;
}): string {
  const { named, extraction } = options;
  const front = [`title: ${serializeYamlString(titleCase(named.title), 'title')}`];
  if (named.type) front.push(`type: ${serializeYamlString(named.type, 'type')}`);
  // Frontmatter, not prose: a URL is machine-readable provenance, and every key Akno does
  // not own is preserved untouched, so adding one of its own here is safe.
  if (options.sourceUrl) {
    front.push(`source_url: ${serializeYamlString(options.sourceUrl, 'source_url')}`);
  }

  const facts = provenanceLines(extraction);
  if (options.label) facts.push(`- Label: ${options.label}`);

  return (
    `---\n${front.join('\n')}\n---\n\n` +
    `# ${titleCase(named.title)}\n\n` +
    `${named.summary}\n\n` +
    `![[${options.attachment}]]\n` +
    (facts.length > 0 ? `\n${facts.join('\n')}\n` : '')
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Only the first letter. A model asked for a title often answers in lowercase, and
 * `# car rental invoice` reads as sloppy beside pages a person wrote — but title-casing
 * every word would mangle `Zephyr QX-100` and proper nouns the model got right.
 */
function titleCase(title: string): string {
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function existingFolders(ctx: AknoContext): string[] {
  const rows = ctx.store.db.prepare("SELECT slug FROM pages WHERE instr(slug, '/') > 0").all() as {
    slug: string;
  }[];
  const folders = new Set<string>();
  for (const row of rows) folders.add(row.slug.slice(0, row.slug.lastIndexOf('/')));
  for (const folder of physicalFolders(ctx.config)) folders.add(folder);
  for (const rule of ctx.config.rules) {
    const folder = rule.glob.replace(/\/\*+$/, '');
    if (
      folder &&
      !folder.includes('*') &&
      effectiveRule(`${folder}/x`, ctx.config.rules).role !== 'ignored'
    ) {
      folders.add(folder);
    }
  }
  return [...folders].sort();
}

/** Content addressing makes attachments unique; page slugs still have to be. */
async function uniqueSlug(ctx: AknoContext, slug: string): Promise<string> {
  const taken = ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?');
  if (!taken.get(slug)) return slug;
  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${slug}-${suffix}`;
    if (!taken.get(candidate)) return candidate;
  }
  throw new AknoError('invalid', `could not find a free slug near ${slug}`);
}
