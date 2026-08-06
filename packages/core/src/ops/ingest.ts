import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, IngestInput, type IngestOutput } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { effectiveRule } from '../rules/compile.ts';
import { extract } from '../ingest/extract.ts';
import { nameDocument, nameIsUseless } from '../ingest/name.ts';
import { hashFile } from '../kb/scan.ts';
import { newPrefixedId } from '../store/ids.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import type { ChangeFile } from '../write/journal.ts';
import { recall } from './recall.ts';
import { normalizeSlug } from './write.ts';

/**
 * §11. Pull a document into memory: **extract, OCR, name, summarize, and route.**
 *
 * `ingest` is the op that earns the most from living in the layer. §17's list of
 * things usually asked of a model includes "run text extraction and OCR on
 * documents", "give `IMG_4821.HEIC` a name that means something", and "decide where a
 * dropped file belongs" — three prompt instructions replaced by one call that happens
 * every time.
 *
 * Order matters and follows §11: extract first, because everything else depends on
 * having the text; then name from the content; then route; then gate. A file whose
 * text cannot be read is never given a confident name, and one whose destination is
 * unclear is left where it is rather than filed confidently into the wrong place.
 */
export async function ingest(ctx: AknoContext, rawInput: unknown): Promise<IngestOutput> {
  const input = IngestInput.parse(rawInput);
  if (input.url) {
    throw new AknoError('not_implemented', 'ingesting a URL is not implemented; pass a local path');
  }

  const source = path.resolve(input.path!);
  const stat = await fsp.stat(source).catch(() => null);
  if (!stat) throw new AknoError('not_found', `no file at ${source}`);
  if (stat.isDirectory()) {
    throw new AknoError('invalid', 'pass a file; ingesting a whole folder is not implemented');
  }

  const extension = path.extname(source).toLowerCase();
  if (ctx.config.ingest.blockedExtensions.includes(extension.replace(/^\./, ''))) {
    throw new AknoError('invalid', `${extension} files are not ingested (ingest.blocked_extensions)`);
  }

  // ── Dedupe ──────────────────────────────────────────────────────────────
  // §11: re-ingesting a document is a no-op that returns where it already lives.
  const sha = await hashFile(source);
  const existing = ctx.store.db
    .prepare(
      'SELECT d.id, d.rel_path, p.slug FROM documents d LEFT JOIN pages p ON p.id = d.page_id WHERE d.sha256 = ?',
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
    absPath: source,
    maxOcrPages: ctx.config.ingest.maxOcrPages,
    maxBytes: ctx.config.ingest.maxFileBytes,
    ...(ctx.models.vision.available ? { vision: ctx.models.vision } : {}),
  });

  // ── Name ────────────────────────────────────────────────────────────────
  const folders = existingFolders(ctx);
  const named =
    extraction.text.length > 0
      ? await nameDocument({
          text: extraction.text,
          originalName: path.basename(source),
          folders,
          chat: ctx.models.chat,
        })
      : null;

  const keepsOriginalName = !nameIsUseless(path.basename(source));
  const confident = named !== null && named.confidence >= ctx.config.ingest.nameConfidence;

  // §11's second guard. A photo of a garden or a corrupt scan keeps its name, gets no
  // page, and is flagged rather than given a confident wrong one. Skipping is a
  // *result*, not a failure — the caller is told exactly which guard fired.
  if (!confident) {
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
  const destination = await route(ctx, input, named, extraction.text);
  if (destination.kind === 'unrouted') {
    // §11: an unrouted file sits visibly where you dropped it, rather than being
    // filed confidently into the wrong place, where you would never look for it. An
    // inbox with three things in it is a to-do list; a misfiled document is a lost one.
    return {
      status: 'ok',
      outcome: 'requires_approval',
      summary: named.summary,
      ...(extraction.pageCount !== null ? { page_count: extraction.pageCount } : {}),
      ocr: extraction.ocr,
      text_from: extraction.via,
      approval: proposeDestination(ctx, named, destination.nearest, source),
      note: `nothing scored above ${ctx.config.routeThreshold} — the file stays where it is`,
    };
  }

  const folder = destination.folder;
  const pageSlug = normalizeSlug(folder ? `${folder}/${named.slug}` : named.slug);

  // A new folder is gated exactly as a `write` into it would be (§5).
  const gated = ctx.gate.check(pageSlug, ctx.actor, { path: source, folder });
  if (!gated.allowed) {
    return {
      status: 'ok',
      outcome: 'requires_approval',
      summary: named.summary,
      ocr: extraction.ocr,
      text_from: extraction.via,
      approval: gated.approval,
      note: 'the destination folder does not exist yet — the file stays where it is',
    };
  }

  // ── Store ───────────────────────────────────────────────────────────────
  // §11: stored files are content-addressed as `<page-basename>-<sha8>.<ext>`. That
  // is worth more than it looks — files are unique by construction, several can sit
  // on one page without ambiguity, and `label` goes back to being a description
  // rather than a disambiguator.
  const finalSlug = await uniqueSlug(ctx, pageSlug);
  const attachmentRel = `${finalSlug}-${sha.slice(0, 8)}${extension}`;
  const pageRel = `${finalSlug}.md`;

  const bytes = await fsp.readFile(source);
  await fsp.mkdir(path.dirname(path.join(ctx.config.aknoPath, attachmentRel)), { recursive: true });
  await fsp.writeFile(path.join(ctx.config.aknoPath, attachmentRel), bytes);

  const rule = effectiveRule(finalSlug, ctx.config.rules);
  const page = composePage({
    named,
    extraction,
    attachment: path.basename(attachmentRel),
    // §5's fence: a short human writeup, then the document itself. Everything below
    // is indexed for search, never mined, never returned whole.
    fence: rule.class !== 'reference',
  });
  const written = await writeFileAtomic(ctx.config.aknoPath, pageRel, page);

  const files: ChangeFile[] = [
    { relPath: attachmentRel, action: 'created', before: null, after: null },
    { relPath: pageRel, action: 'created', before: null, after: written.after },
  ];

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'ingest',
    summary: `ingested ${path.basename(source)} as ${finalSlug}`,
    files,
  });

  await ctx.indexer.run({ only: files.map((file) => file.relPath) });

  const documentId =
    (
      ctx.store.db.prepare('SELECT id FROM documents WHERE rel_path = ?').get(attachmentRel) as
        { id: string } | undefined
    )?.id ?? `doc_${sha.slice(0, 12)}`;

  // The extracted text belongs in the index, not only in the page body: §11 promises
  // a stored PDF is searchable by its own content, and the body carries a capped
  // excerpt so a 40-page contract does not become a 40-page Markdown file.
  ctx.store.db
    .prepare(
      'UPDATE documents SET text = ?, summary = ?, page_count = ?, ocr = ?, label = ? WHERE rel_path = ?',
    )
    .run(
      extraction.text,
      named.summary,
      extraction.pageCount,
      extraction.ocr ? 1 : 0,
      named.title,
      attachmentRel,
    );

  const related = destination.related.filter((slug) => slug !== finalSlug).slice(0, 4);

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    document: documentId,
    slug: finalSlug,
    rel_path: attachmentRel,
    summary: named.summary,
    ...(extraction.pageCount !== null ? { page_count: extraction.pageCount } : {}),
    ocr: extraction.ocr,
    text_from: extraction.via,
    ...(keepsOriginalName ? {} : { renamed_from: path.basename(source) }),
    ...(related.length > 0 ? { related } : {}),
    ...(extraction.note ? { note: extraction.note } : {}),
  };
}

// ─── Routing ────────────────────────────────────────────────────────────────

type Destination =
  | { kind: 'folder'; folder: string | null; related: string[] }
  | { kind: 'unrouted'; nearest: string[]; related: string[] };

/**
 * §11. **Routing is a folder decision, not a page-level one** — Akno picks *where a
 * document belongs*, not what it is called relative to its neighbours. It never
 * invents a new folder to route into; a document with no home clears no threshold and
 * stays put.
 */
/**
 * §8 step 2 / §11. Routing thresholds **`relevance`, never `score`.**
 *
 * `score` orders one result set: the best hit is 1.0 whether it is a perfect match or
 * the least bad of a bad batch. Thresholding it meant every document found a home and
 * §11's "a document with no home stays put" could never fire — routing looked like it
 * worked and was in fact unconditional.
 *
 * `relevance` is absolute when a cross-encoder or the embedding arm supplied one. With
 * neither — a lexical-only search — there is no number to compare, so routing refuses
 * and asks. §19 says the failure this guards against, a fact quietly landing on a
 * plausible wrong page, is invisible until someone reads it back months later; a
 * guess is worse than a question.
 */
async function route(
  ctx: AknoContext,
  input: ReturnType<typeof IngestInput.parse>,
  named: { summary: string; type: string | null; suggestedFolder: string | null },
  text: string,
): Promise<Destination> {
  // An explicit destination is the caller's decision, not a guess to second-guess.
  // Still worth one recall, for the `related` list.
  const result = await recall(ctx, {
    query: `${named.type ?? 'document'}. ${named.summary} ${text.slice(0, 400)}`,
    mode: 'lookup',
    limit: 8,
    depth: 'summary',
    // The query *is* the document's own summary. Asking a model to rewrite it costs a
    // round trip and cannot improve on the thing being matched.
    expand: false,
  });
  const related = result.cards.map((card) => card.slug);

  if (input.folder) {
    return { kind: 'folder', folder: input.folder.replace(/\/+$/, ''), related };
  }

  const scored = new Map<string, number>();
  for (const card of result.cards) {
    if (!card.slug.includes('/')) continue;
    if (card.relevance === undefined) continue;
    const folder = card.slug.slice(0, card.slug.lastIndexOf('/'));
    // Best relevance wins per folder rather than a sum: three weak pages in one folder
    // should not outvote one strong page elsewhere.
    scored.set(folder, Math.max(scored.get(folder) ?? 0, card.relevance));
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  const nearest =
    ranked.length > 0
      ? ranked.slice(0, 5).map(([folder]) => folder)
      : [...new Set(result.cards.map((card) => card.slug.split('/')[0]!))].slice(0, 5);

  if (best && best[1] >= ctx.config.routeThreshold) {
    return { kind: 'folder', folder: best[0], related };
  }

  // The model's suggestion is a fallback, and only for a folder that exists — it was
  // given the list precisely so it could not invent one.
  if (named.suggestedFolder) return { kind: 'folder', folder: named.suggestedFolder, related };

  return { kind: 'unrouted', nearest, related };
}

function proposeDestination(
  ctx: AknoContext,
  named: { title: string; slug: string; summary: string },
  nearest: string[],
  source: string,
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
      JSON.stringify({ path: source }),
      JSON.stringify(nearest),
    );
  return {
    proposal_id: id,
    reason: `"${named.title}" — ${named.summary}`,
    nearest,
  };
}

// ─── Page composition ───────────────────────────────────────────────────────

/**
 * §5. Most document pages are a short human writeup followed by the document itself.
 * Above the fence: normal, mined, quotable in full. Below: indexed for search, never
 * mined, never returned whole.
 */
function composePage(options: {
  named: { title: string; summary: string; type: string | null };
  extraction: {
    text: string;
    pageCount: number | null;
    ocr: boolean;
    confidence: number | null;
    via: string;
  };
  attachment: string;
  fence: boolean;
}): string {
  const { named, extraction } = options;
  const front = [`title: ${titleCase(named.title)}`];
  if (named.type) front.push(`type: ${named.type}`);

  const facts: string[] = [];
  if (extraction.pageCount !== null) facts.push(`- Pages: ${extraction.pageCount}`);
  // §2's cite-or-stay-quiet, applied to provenance. A reader deciding whether to trust
  // a number below should know whether it was typed, read off a scan, or *described by
  // a model that looked at a picture* — the last is not the document's own text at all,
  // and presenting the three the same way is a false claim about where words came from.
  if (extraction.via === 'ocr') {
    const confidence =
      extraction.confidence !== null ? ` (confidence ${extraction.confidence.toFixed(2)})` : '';
    facts.push(`- Text below: recognised by OCR${confidence}`);
  } else if (extraction.via === 'vision') {
    facts.push("- Text below: a model's description of the image, not text found in it");
  }

  // Capped: the full text lives in the index, which is what search reads. A 40-page
  // contract pasted into Markdown makes the page unreadable and the repo enormous.
  const excerpt = extraction.text.slice(0, 20_000);
  const truncated = extraction.text.length > excerpt.length;

  return (
    `---\n${front.join('\n')}\n---\n\n` +
    `# ${titleCase(named.title)}\n\n` +
    `${named.summary}\n\n` +
    `![[${options.attachment}]]\n` +
    (facts.length > 0 ? `\n${facts.join('\n')}\n` : '') +
    (options.fence ? `\n<!-- reference -->\n` : '') +
    `\n${excerpt}\n` +
    (truncated ? `\n[…truncated. The full text is in the index and is searchable.]\n` : '')
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Only the first letter. A model asked for a title often answers in lowercase, and
 * `# car rental invoice` reads as sloppy beside pages a person wrote — but
 * title-casing every word would mangle `Zephyr QX-100` and proper nouns the model got
 * right.
 */
function titleCase(title: string): string {
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function existingFolders(ctx: AknoContext): string[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT DISTINCT substr(slug, 1, length(slug) - length(replace(slug, '/', '')) ) AS x, slug
         FROM pages WHERE instr(slug, '/') > 0`,
    )
    .all() as { slug: string }[];
  const folders = new Set<string>();
  for (const row of rows) folders.add(row.slug.slice(0, row.slug.lastIndexOf('/')));
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
