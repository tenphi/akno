import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, WriteInput, type WriteOutput, type WriteTarget } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { parsePage } from '../kb/page.ts';
import { detectConflict } from '../write/conflict.ts';
import { applyEdit, type BodyEdit } from '../write/edit.ts';
import { insertEvent, newLedger } from '../write/ledger.ts';
import { extract } from '../ingest/extract.ts';
import { provenanceLines, recordDocument, storeDocument } from '../ingest/store.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import type { Extraction } from '../ingest/extract.ts';

/**
 * §8, §10. Create, append, patch or replace a page — and the only thing that
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
  // happen that will never have a page (§10). It goes straight to the ledger.
  if (!input.slug && !input.propose_slug && input.event) {
    return writeEventOnly(ctx, input.event, input.dry_run ?? false);
  }

  const slug = normalizeSlug(input.slug ?? input.propose_slug!);
  const existing = ctx.store.db.prepare('SELECT id, rel_path, class FROM pages WHERE slug = ?').get(slug) as
    { id: string; rel_path: string; class: string } | undefined;

  // ── Gate ────────────────────────────────────────────────────────────────
  if (!existing) {
    const decision = ctx.gate.check(slug, actor, input);
    if (!decision.allowed) {
      return {
        status: 'ok',
        outcome: 'requires_approval',
        approval: decision.approval,
        note: decision.declinedBefore
          ? 'this folder was declined before — do not ask the user again, write somewhere that exists'
          : 'ask the user, then apply with `akno approve <proposal_id>`',
      };
    }
  }

  const relPath = existing?.rel_path ?? `${slug}.md`;
  const absPath = path.join(ctx.config.aknoPath, relPath);
  const before = existing ? await fsp.readFile(absPath, 'utf8') : null;

  const edit = resolveEdit(input, before !== null);
  const edited =
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

  // §11's storage rules, reached through `write` rather than `ingest`: content-addressed
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

  // The ledger line and the page land in one change, so §10's promise holds:
  // there is no way to get a ledger line whose detail page was never written.
  if (input.event) {
    const ledger = await appendToLedger(ctx, { ...input.event, slug });
    files.push(ledger.file);
    wrote.push({ slug: ledgerSlug(ctx), line: ledger.line, action: 'event' });
  }

  const changeId = ctx.journal.record({
    actor,
    op: 'write',
    summary: `${existing ? actionFor(edit) : 'created'} ${slug}${input.event ? ' + event' : ''}`,
    files,
  });

  // ── Index ───────────────────────────────────────────────────────────────
  // The indexer follows exactly as it would for a hand edit (§8 step 6): line
  // hashes moved, so old facts retire and new ones are derived from the new lines.
  //
  // It must run *before* anything records the new hash in `files`. Recording first
  // makes the stat fast path conclude the file is unchanged and skip it — the page
  // lands on disk and never reaches the index, which is the worst of both worlds.
  // The indexer records the file itself as part of indexing it.
  const report = await ctx.indexer.run({ only: files.map((file) => file.relPath) });

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

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    wrote,
    facts: { retired: 0, added: report.factsDerived },
    ...(documents.length > 0 ? { documents } : {}),
  };
}

/**
 * Adds `![[file]]` embeds for attachments the page does not already reference, and records
 * each one's provenance beside it.
 *
 * The document's *text* is not written here. It is indexed against the document, where §6
 * can invalidate it on the file's hash and a hit can name the page within the file that
 * produced it (§11). Pasting it into the body as well made the same words arrive twice
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
      wrote: [{ slug: ledgerSlug(ctx), action: 'event' }],
      note: 'dry run — nothing was written',
    };
  }

  const ledger = await appendToLedger(ctx, event);
  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'write',
    summary: `event ${event.date}: ${event.summary.slice(0, 60)}`,
    files: [ledger.file],
  });

  await ctx.indexer.run({ only: [ledger.file.relPath] });

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    // Addressable as `timeline:47`, so it obeys the same provenance rule as
    // everything else — the ledger is a page like any other (§10).
    wrote: [{ slug: ledgerSlug(ctx), line: ledger.line, action: 'event' }],
  };
}

async function appendToLedger(
  ctx: AknoContext,
  event: { date: string; summary: string; slug?: string },
): Promise<{ file: ChangeFile; line: number }> {
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
  const result = await writeFileAtomic(ctx.config.aknoPath, relPath, inserted.content);
  return { file: fileEntry(result), line: inserted.line };
}

function ledgerSlug(ctx: AknoContext): string {
  return ctx.config.paths.timeline.replace(/\.(md|markdown)$/i, '');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveEdit(input: ReturnType<typeof WriteInput.parse>, exists: boolean): BodyEdit {
  if (input.content !== undefined) return { kind: 'content', content: input.content };
  if (input.append !== undefined) return { kind: 'append', text: input.append };
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
      return edit.content;
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
 */
function composeNewPage(input: ReturnType<typeof WriteInput.parse>, slug: string, edit: BodyEdit): string {
  const title = input.title ?? titleFromSlug(slug);
  const front = [`title: ${title}`];
  if (input.type) front.push(`type: ${input.type}`);
  if (input.tags?.length) front.push(`tags: [${input.tags.join(', ')}]`);

  const body = edit.kind === 'content' ? edit.content.trim() : edit.kind === 'append' ? edit.text.trim() : '';
  // A caller who wrote their own heading keeps it; one who did not gets the title
  // as an H1, because a page whose body starts mid-sentence reads as a fragment.
  const heading = /^#{1,6}\s/.test(body) ? '' : `# ${title}\n\n`;
  const links = input.links?.length
    ? `\n\n${input.links.map((link) => `Related: [[${link}]]`).join('\n')}`
    : '';

  return `---\n${front.join('\n')}\n---\n\n${heading}${body}${links}\n`;
}

function titleFromSlug(slug: string): string {
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
