import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, WriteInput, type WriteOutput, type WriteTarget } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { parsePage } from '../kb/page.ts';
import { declaredFrontmatter, readString, spliceAfterFence } from '../kb/frontmatter.ts';
import { detectConflict } from '../write/conflict.ts';
import { applyEdit, type BodyEdit, type EditResult } from '../write/edit.ts';
import { insertEvent, newLedger } from '../write/ledger.ts';
import { extract } from '../ingest/extract.ts';
import { provenanceLines, recordDocument, storeDocument } from '../ingest/store.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { ledgerSlug } from '../reserved.ts';
import type { Extraction } from '../ingest/extract.ts';

/**
 * Create, append, patch or replace a page — and the only thing that
 * actually happens on disk is that Markdown changes. There is no fact store to
 * insert into: facts appear afterwards because the indexer re-derives them from
 * the sentences that are now there.
 *
 * The order is deliberate. Gate before conflict before write before journal before
 * index, so a write that is going to be refused is refused before anything is
 * touched, and a write that lands is recorded before the indexer can be told
 * about it.
 */
export async function write(ctx: AknoContext, rawInput: unknown): Promise<WriteOutput> {
  const input = WriteInput.parse(rawInput);
  const actor = ctx.actor;

  // An event with no slug is a real case, not a degenerate one: plenty of things
  // happen that will never have a page. It goes straight to the ledger.
  if (!input.slug && !input.propose_slug && input.event) {
    return writeEventOnly(ctx, input.event, input.dry_run ?? false);
  }

  const slug = normalizeSlug(input.slug ?? input.propose_slug!);
  if (
    refusesLedgerProse({
      slug,
      ledger: ledgerSlug(ctx.config),
      actor,
      edit: input.content !== undefined ? 'content' : input.append !== undefined ? 'append' : null,
    })
  ) {
    throw new AknoError(
      'invalid',
      `'${slug}' is the event ledger: it takes events, not prose. Record the event with ` +
        '`write({ event: { date, summary }, slug })` — the line is placed under its year for you — ' +
        'and put what is true on the page the event is about.',
    );
  }

  const existing = ctx.store.db.prepare('SELECT id, rel_path FROM pages WHERE slug = ?').get(slug) as
    { id: string; rel_path: string } | undefined;

  // ── Gate ────────────────────────────────────────────────────────────────
  if (!existing) {
    const decision = ctx.gate.check(slug, actor);
    if (!decision.allowed) {
      return {
        status: 'ok',
        outcome: 'requires_folder',
        requires_folder: decision.requiresFolder,
        note:
          `'${decision.requiresFolder.folder}' has not been declared. Call \`folder\` with a ` +
          'description of what belongs there — nobody is asked and nothing waits on approval — ' +
          'then repeat this write. Or write into one of the folders that already exists.',
      };
    }
  }

  const relPath = existing?.rel_path ?? `${slug}.md`;
  const absPath = path.join(ctx.config.aknoPath, relPath);
  const before = existing ? await fsp.readFile(absPath, 'utf8') : null;

  const edit = resolveEdit(input, before !== null);
  const edited: EditResult =
    before === null
      ? { content: composeNewPage(input, slug, edit), firstChangedLine: null }
      : applyEdit(before, edit);

  if (edited.content === before) {
    return { status: 'ok', outcome: 'noop', note: 'the page already reads exactly that way' };
  }

  // ── Conflict ────────────────────────────────────────────────────────────
  if (existing && before !== null) {
    const parsed = parsePage(relPath, before);
    const conflict = detectConflict({
      store: ctx.store,
      pageId: existing.id,
      slug,
      body: parsed.body,
      bodyStartLine: parsed.bodyLine,
      incoming: incomingText(input, edit),
      ...(input.resolve_conflict ? { resolveToken: input.resolve_conflict } : {}),
    });
    if (conflict) {
      return {
        status: 'ok',
        outcome: 'conflict',
        conflict,
        note:
          'an existing line claims something different. Ask the user which is current, then repeat the ' +
          'write with `resolve_conflict` set to the token above.',
      };
    }
  }

  if (input.dry_run) {
    return {
      status: 'ok',
      outcome: 'ok',
      wrote: [
        {
          slug,
          action: existing ? actionFor(edit) : 'created',
          ...(edited.firstChangedLine ? { line: edited.firstChangedLine } : {}),
        },
      ],
      note: 'dry run — nothing was written',
    };
  }

  // ── Write ───────────────────────────────────────────────────────────────
  const files: ChangeFile[] = [];
  const wrote: WriteTarget[] = [];

  const result = await writeFileAtomic(ctx.config.aknoPath, relPath, edited.content);
  files.push(fileEntry(result));
  wrote.push({
    slug,
    action: existing ? actionFor(edit) : 'created',
    ...(edited.firstChangedLine ? { line: edited.firstChangedLine } : {}),
  });

  // The same storage rules, reached through `write` rather than `ingest`: content-addressed
  // off the page basename, extracted on arrival, embedded in the page. The difference is
  // only who chose the destination — here the caller did, so nothing is routed or named.
  const attached: PendingAttachment[] = [];
  if (input.documents?.length) {
    for (const document of input.documents) {
      const source = path.resolve(document.path);
      if (!(await fsp.stat(source).catch(() => null))) {
        throw new AknoError('not_found', `no file to attach at ${source}`);
      }

      const stored = await storeDocument({ ctx, source, pageSlug: slug, move: false });
      files.push(stored.file);

      const extraction = await extract({
        absPath: source,
        maxOcrPages: ctx.config.ingest.maxOcrPages,
        maxBytes: ctx.config.ingest.maxFileBytes,
        ...(ctx.models.vision.available ? { vision: ctx.models.vision } : {}),
      });

      attached.push({
        relPath: stored.relPath,
        extraction,
        ...(document.label ? { label: document.label } : {}),
      });
      wrote.push({ slug, action: 'attached' });
    }

    // The page has to reference what is now beside it, or the attachment is orphaned from
    // a reader's point of view even though the index knows about it.
    const embedded = await appendEmbeds(ctx, relPath, attached, files[0]!);
    if (embedded) files[0] = embedded;
  }

  // The ledger line and the page land in one change, so the promise holds:
  // there is no way to get a ledger line whose detail page was never written.
  if (input.event) {
    const ledger = await appendToLedger(ctx, { ...input.event, slug });
    // No file when the day already has this event: the page part of this change still stands, and
    // the caller is still told which ledger line the event is on — the existing one.
    if (ledger.file) files.push(ledger.file);
    wrote.push({ slug: ledgerSlug(ctx.config), line: ledger.line, action: 'event' });
  }

  const changeId = ctx.journal.record({
    actor,
    op: 'write',
    summary: `${existing ? actionFor(edit) : 'created'} ${slug}${input.event ? ' + event' : ''}`,
    files,
  });

  // ── Index ───────────────────────────────────────────────────────────────
  // The indexer follows exactly as it would for a hand edit: line
  // hashes moved, so old facts retire and new ones are derived from the new lines.
  //
  // It must run *before* anything records the new hash in `files`. Recording first
  // makes the stat fast path conclude the file is unchanged and skip it — the page
  // lands on disk and never reaches the index, which is the worst of both worlds.
  // The indexer records the file itself as part of indexing it.
  //
  // Structure now, meaning now — the page is searchable by its own text, its links resolve, its
  // documents exist. What is deferred is only the *reading* of it: summary, keywords, the claims a
  // deriver finds in the sentences. Awaiting that put a cold local model, a minute to load, inside
  // every write, and the tool calling it gave up at sixty seconds while the write itself had
  // already landed.
  const paths = files.map((file) => file.relPath);
  const report = await ctx.indexer.run({ only: paths, modelPaths: [] });
  ctx.derive.schedule(paths);

  // After indexing: the `documents` rows exist now, so the extraction can be recorded
  // against them. The row keeps the *whole* text — the body carries a capped excerpt, and
  // `read({document})` should not be limited by what fits comfortably in a page.
  const documents = attached.map((entry) => {
    const id = recordDocument({
      ctx,
      relPath: entry.relPath,
      extraction: entry.extraction,
      ...(entry.label ? { label: entry.label } : {}),
    });
    return { id: id ?? '', rel_path: entry.relPath, text_from: entry.extraction.via };
  });

  // A frontmatter rewrite is reported, never silent. The caller may not have realised the block
  // it echoed back was a declaration, and dropping `temporal` or `management` changes how the
  // page behaves for months without changing a word anybody reads.
  const note = edited.frontmatter
    ? `the frontmatter you sent replaced the page's` +
      (edited.frontmatter.dropped.length > 0
        ? `, dropping ${edited.frontmatter.dropped.map((key) => `\`${key}\``).join(', ')} — ` +
          `write again with those keys if that was not deliberate, or \`undo\` the change`
        : '')
    : null;

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    wrote,
    facts: { retired: 0, added: report.factsDerived },
    ...(documents.length > 0 ? { documents } : {}),
    ...(note ? { note } : {}),
  };
}

/**
 * Adds `![[file]]` embeds for attachments the page does not already reference, and records
 * each one's provenance beside it.
 *
 * The document's *text* is not written here. It is indexed against the document, where the
 * file's hash can invalidate it and a hit can name the page within the file that produced
 * it. Pasting it into the body as well made the same words arrive twice
 * against one recall budget, and put a copy in the user's Markdown that no file change
 * could ever correct.
 *
 * Appended rather than spliced: a page's structure belongs to whoever wrote it, and
 * guessing where an embed "should" go would rewrite their layout.
 */
async function appendEmbeds(
  ctx: AknoContext,
  relPath: string,
  attached: PendingAttachment[],
  pageEntry: ChangeFile,
): Promise<ChangeFile | null> {
  const current = await fsp.readFile(path.join(ctx.config.aknoPath, relPath), 'utf8');

  const additions: string[] = [];
  for (const entry of attached) {
    const name = path.basename(entry.relPath);
    if (current.includes(name)) continue;
    const provenance = provenanceLines(entry.extraction);
    // Blank line between the embed and its provenance: a list crammed against an image
    // reads as part of the image's caption.
    additions.push(provenance.length > 0 ? `![[${name}]]\n\n${provenance.join('\n')}` : `![[${name}]]`);
  }
  if (additions.length === 0) return null;

  const next = `${current.replace(/\s+$/, '')}\n\n${additions.join('\n\n')}\n`;
  const written = await writeFileAtomic(ctx.config.aknoPath, relPath, next);
  // The page entry was recorded before the embeds existed; replace its `after` so undo
  // restores the version that was actually on disk when the change completed.
  return { ...pageEntry, after: written.after };
}

/** An attachment stored on disk but not yet recorded — the row does not exist until the
 *  indexer has seen the file. */
interface PendingAttachment {
  relPath: string;
  extraction: Extraction;
  label?: string;
}

/**
 * **The ledger takes events. It does not take prose.**
 *
 * `append` and `content` write at the *end of the body*, and the end of the ledger's body is
 * below the last year heading — outside every `- **YYYY-MM-DD** |` line the event parser
 * matches. A claim put there is not merely in the wrong place: it is in a file that will never
 * read it back, and it is a second copy of something whose home is the page it belongs to.
 *
 * This is not a hypothetical. `remember` routes claims by recall, the ledger is a plain `full`
 * page, and a ledger that already mentions a subject scores highest *for that subject* — so a
 * claim about an ongoing complaint landed under the event list of the very page recording it.
 * Routing now skips reserved paths, and this is the layer under it: a guard in the prompt or in
 * the caller is a guard that the next caller does not have.
 *
 * `patch` and `replace` are allowed through. Both are line-targeted and cannot append at the
 * bottom, so a line that went in wrong stays correctable — which the ledger's own append-only
 * rule needs, since a wrong line is corrected rather than removed.
 *
 * `akno` is exempt: the `repair` tier rewrites link targets, and a ledger line whose page was
 * renamed is exactly the kind of thing it exists to fix.
 */
export function refusesLedgerProse(input: {
  slug: string;
  ledger: string;
  actor: 'user' | 'agent' | 'akno';
  /** Which edit was asked for. `null` when the write carries only an event. */
  edit: BodyEdit['kind'] | null;
}): boolean {
  if (input.actor === 'akno') return false;
  if (input.slug !== input.ledger) return false;
  return input.edit === 'append' || input.edit === 'content';
}

// ─── Event-only write ───────────────────────────────────────────────────────

async function writeEventOnly(
  ctx: AknoContext,
  event: { date: string; summary: string },
  dryRun: boolean,
): Promise<WriteOutput> {
  if (dryRun) {
    return {
      status: 'ok',
      outcome: 'ok',
      wrote: [{ slug: ledgerSlug(ctx.config), action: 'event' }],
      note: 'dry run — nothing was written',
    };
  }

  const ledger = await appendToLedger(ctx, event);

  // The day already has this event. Journalling anyway would put a change in `undo --list` that
  // reverses nothing, and tell the caller something was kept when the ledger is exactly as it was.
  if (!ledger.file) {
    return {
      status: 'ok',
      outcome: 'noop',
      note: 'the ledger already records this event for that date',
      wrote: [{ slug: ledgerSlug(ctx.config), line: ledger.line, action: 'event' }],
    };
  }

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'write',
    summary: `event ${event.date}: ${event.summary.slice(0, 60)}`,
    files: [ledger.file],
  });

  await ctx.indexer.run({ only: [ledger.file.relPath], modelPaths: [] });
  // The ledger's events are parsed structurally, above — this is for the summary and any claims in
  // the prose around them, which nobody is waiting on.
  ctx.derive.schedule([ledger.file.relPath]);

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    // Addressable as `timeline:47`, so it obeys the same provenance rule as
    // everything else — the ledger is a page like any other.
    wrote: [{ slug: ledgerSlug(ctx.config), line: ledger.line, action: 'event' }],
  };
}

export async function appendToLedger(
  ctx: AknoContext,
  event: { date: string; summary: string; slug?: string },
): Promise<{ file: ChangeFile | null; line: number }> {
  const relPath = ctx.config.paths.timeline;
  const absPath = path.join(ctx.config.aknoPath, relPath);

  let current: string;
  try {
    current = await fsp.readFile(absPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    current = newLedger(event.date.slice(0, 4));
  }

  const inserted = insertEvent(current, event);
  // Nothing to write: the day already has this event, in these words or in others. Rewriting the
  // file with its own bytes would journal a change that added nothing — `undo --list` would offer
  // to reverse an event that was never appended, and the caller would be told it had been kept.
  if (inserted.content === current) return { file: null, line: inserted.line };

  const result = await writeFileAtomic(ctx.config.aknoPath, relPath, inserted.content);
  return { file: fileEntry(result), line: inserted.line };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveEdit(input: ReturnType<typeof WriteInput.parse>, exists: boolean): BodyEdit {
  if (input.content !== undefined) return { kind: 'content', content: input.content };
  if (input.append !== undefined) {
    return { kind: 'append', text: input.append, ...(input.section ? { section: input.section } : {}) };
  }
  if (input.patch !== undefined) return { kind: 'patch', patch: input.patch };
  if (input.replace !== undefined) {
    return { kind: 'replace', find: input.replace.find, with: input.replace.with };
  }
  if (!exists) {
    throw new AknoError('invalid', 'a new page needs `content`; there is nothing to append to or patch');
  }
  throw new AknoError('invalid', 'write needs one of: content, append, patch, replace');
}

function actionFor(edit: BodyEdit): WriteTarget['action'] {
  switch (edit.kind) {
    case 'content':
      return 'replaced';
    case 'append':
      return 'appended';
    case 'patch':
      return 'patched';
    case 'replace':
      return 'replaced';
  }
}

/** Only the text being introduced is worth checking for conflicts. */
function incomingText(input: ReturnType<typeof WriteInput.parse>, edit: BodyEdit): string {
  switch (edit.kind) {
    case 'content':
      // A declaration is not a claim. `role: knowledge` is not the page asserting anything
      // about the world, and scanning it for conflicts finds pairs that mean nothing.
      return declaredFrontmatter(edit.content)?.body ?? edit.content;
    case 'append':
      return edit.text;
    case 'replace':
      return edit.with;
    case 'patch':
      // Only the added lines: a context line is not a new claim.
      return input
        .patch!.split('\n')
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.slice(1))
        .join('\n');
  }
}

/**
 * A new page gets frontmatter only for what the caller actually said. Akno
 * inventing a `type` or a `tags` list would be putting words in the user's
 * knowledge base that nobody chose.
 *
 * Composed directly rather than seeded-then-edited: `content` means "this is the
 * body", so running it through the body editor discarded the `# Title` heading the
 * seed had just added, and left the frontmatter fence flush against the first line.
 *
 * A caller who wrote their own frontmatter keeps it verbatim — the same courtesy the body
 * already extends to a caller who wrote their own `# Heading`, and the same rule `applyEdit`
 * follows for a page that already exists. `title`, `type` and `tags` then fill in only the
 * keys the block left out, because an argument and a block that both say `title` are one
 * intent stated twice and the block is the more specific statement of it.
 */
function composeNewPage(input: ReturnType<typeof WriteInput.parse>, slug: string, edit: BodyEdit): string {
  const supplied = edit.kind === 'content' ? edit.content : edit.kind === 'append' ? edit.text : '';
  const declared = edit.kind === 'content' ? declaredFrontmatter(supplied) : null;

  const title = readString(declared?.data ?? {}, 'title') ?? input.title ?? titleFromSlug(slug);
  const body = (declared?.body ?? supplied).trim();
  // A caller who wrote their own heading keeps it; one who did not gets the title
  // as an H1, because a page whose body starts mid-sentence reads as a fragment.
  const heading = /^#{1,6}\s/.test(body) ? '' : `# ${title}\n\n`;
  const links = input.links?.length
    ? `\n\n${input.links.map((link) => `Related: [[${link}]]`).join('\n')}`
    : '';

  if (declared) {
    const missing = [
      declared.data.title === undefined ? `title: ${title}` : null,
      input.type && declared.data.type === undefined ? `type: ${input.type}` : null,
      input.tags?.length && declared.data.tags === undefined ? `tags: [${input.tags.join(', ')}]` : null,
    ].filter((line): line is string => line !== null);
    return `${spliceAfterFence(declared.head, missing)}\n${heading}${body}${links}\n`;
  }

  const front = [`title: ${title}`];
  if (input.type) front.push(`type: ${input.type}`);
  if (input.tags?.length) front.push(`tags: [${input.tags.join(', ')}]`);

  return `---\n${front.join('\n')}\n---\n\n${heading}${body}${links}\n`;
}

export function titleFromSlug(slug: string): string {
  const base = slug.split('/').pop() ?? slug;
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeSlug(raw: string): string {
  const slug = raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\/+/g, '/');

  // A caller must not be able to name a file outside the folder the user pointed
  // Akno at, whatever it sends. An absolute path is **rejected, not stripped**:
  // quietly reading `/etc/passwd` as `etc/passwd` writes somewhere the caller did
  // not ask for and then cannot find.
  const safe =
    slug.length > 0 &&
    slug.length <= 512 &&
    !slug.startsWith('/') &&
    !slug.startsWith('~') &&
    !/^[a-zA-Z]:/.test(slug) &&
    !slug.includes('\0') &&
    slug.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');

  if (!safe) throw new AknoError('invalid', `not a usable slug: ${raw}`);
  return slug;
}
