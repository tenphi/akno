import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, ForgetInput, type ForgetOutput } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { newPrefixedId, sha256 } from '../store/ids.ts';

/**
 * **This is the honest version of forgetting.**
 *
 * Retracting a fact removes *the sentence that produced it*. Expiring a database
 * row while the sentence stays in the file means the assistant "forgets" and then
 * reads it again tomorrow — which is worse than not forgetting, because now the
 * two disagree.
 *
 * All three forms are journalled and stay `undo`-able for the retention window.
 */
export async function forget(ctx: AknoContext, rawInput: unknown): Promise<ForgetOutput> {
  const input = ForgetInput.parse(rawInput);
  if (input.fact) return forgetFact(ctx, input.fact);
  if (input.slug) return forgetPage(ctx, input.slug);
  return forgetDocument(ctx, input.document!);
}

// ─── A fact ─────────────────────────────────────────────────────────────────

async function forgetFact(ctx: AknoContext, factId: string): Promise<ForgetOutput> {
  const fact = ctx.store.db
    .prepare(
      `SELECT f.id, f.claim, f.line_start, f.source_line_hash, p.slug, p.rel_path
         FROM facts f JOIN pages p ON p.id = f.page_id WHERE f.id = ?`,
    )
    .get(factId) as
    | { claim: string; line_start: number; source_line_hash: string; slug: string; rel_path: string }
    | undefined;

  if (!fact) {
    throw new AknoError('not_found', `no fact with id ${factId}`, {
      hint: 'fact ids change when a page is re-derived from scratch — recall or read the page again and take the id from the line',
    });
  }

  const absPath = path.join(ctx.config.aknoPath, fact.rel_path);
  const content = await fsp.readFile(absPath, 'utf8');
  const lines = content.split('\n');
  const target = lines[fact.line_start - 1];

  if (target === undefined) {
    throw new AknoError('invalid', `${fact.slug} no longer has a line ${fact.line_start}`);
  }
  // The hash is what makes this safe: if the line has been edited since the fact
  // was derived, removing "line 11" would delete whatever now occupies line 11.
  // The no-drift guarantee cuts both ways — it also protects a delete.
  if (sha256Line(target) !== fact.source_line_hash) {
    throw new AknoError(
      'conflict',
      `${fact.slug}:${fact.line_start} has changed since that fact was derived — re-read the page`,
      { line: target.slice(0, 160) },
    );
  }

  lines.splice(fact.line_start - 1, 1);
  const result = await writeFileAtomic(ctx.config.aknoPath, fact.rel_path, lines.join('\n'));

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'forget',
    summary: `removed ${fact.slug}:${fact.line_start}`,
    files: [fileEntry(result)],
  });

  // The indexer re-derives, and the fact is gone because its source is gone. It
  // records the file itself, so nothing may pre-record the hash — that would make
  // the stat fast path skip the very page whose facts have to be re-derived.
  await ctx.indexer.run({ only: [fact.rel_path], modelPaths: [] });
  // The sentence is gone from the file, which is what was asked. Re-deriving what the page says now
  // is the deriver's business, not the caller's.
  ctx.derive.schedule([fact.rel_path]);

  return {
    status: 'ok',
    change_id: changeId,
    removed_from: `${fact.slug}:${fact.line_start}`,
    removed: target,
  };
}

// ─── A page ─────────────────────────────────────────────────────────────────

async function forgetPage(ctx: AknoContext, rawSlug: string): Promise<ForgetOutput> {
  const slug = rawSlug.replace(/\.(md|markdown)$/i, '');
  const page = ctx.store.db.prepare('SELECT id, rel_path FROM pages WHERE slug = ?').get(slug) as
    { id: string; rel_path: string } | undefined;
  if (!page) throw new AknoError('not_found', `no page at ${slug}`);

  const token = newPrefixedId('trash');
  const files: ChangeFile[] = [];

  // The index can outlive the file — a hand delete between sweeps, or an undo that
  // removed it. A raw ENOENT here reads as a bug; saying what happened does not.
  let content: string;
  try {
    content = await fsp.readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    await ctx.indexer.run({ modelPaths: [] });
    throw new AknoError(
      'not_found',
      `${slug} is in the index but its file is gone — the index has now been reconciled`,
    );
  }
  await ctx.journal.trash(page.rel_path, token);
  files.push({ relPath: page.rel_path, action: 'deleted', before: content, after: null });

  // A page's attachments go with it. Leaving a PDF behind whose page is gone
  // produces an orphan that `doctor` reports and nobody can explain.
  const documents = ctx.store.db.prepare('SELECT rel_path FROM documents WHERE page_id = ?').all(page.id) as {
    rel_path: string;
  }[];
  for (const document of documents) {
    const snapshot = await ctx.journal.trash(document.rel_path, token);
    files.push({ relPath: document.rel_path, action: 'deleted', before: null, after: null, snapshot });
  }

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'forget',
    summary: `trashed ${slug}${documents.length > 0 ? ` and ${documents.length} attachment(s)` : ''}`,
    files,
  });

  // Deliberately does not delete the `files` rows. `known` is built from `files`,
  // so a path that is not there can never appear in the reconciler's vanished set —
  // the page row would survive, pointing at a file that is gone, and `read` would
  // report "indexed but could not be read" forever.
  //
  // Full walk to notice the files are gone; no model work, since nothing new exists
  // to summarize or mine.
  await ctx.indexer.run({ modelPaths: [] });

  return {
    status: 'ok',
    change_id: changeId,
    trashed: path.join(ctx.config.trashDir, token, page.rel_path),
    removed_from: slug,
  };
}

// ─── A document ─────────────────────────────────────────────────────────────

async function forgetDocument(ctx: AknoContext, documentId: string): Promise<ForgetOutput> {
  const document = ctx.store.db.prepare('SELECT id, rel_path FROM documents WHERE id = ?').get(documentId) as
    { id: string; rel_path: string } | undefined;
  if (!document) throw new AknoError('not_found', `no document with id ${documentId}`);

  const token = newPrefixedId('trash');
  const snapshot = await ctx.journal.trash(document.rel_path, token);
  const files: ChangeFile[] = [
    { relPath: document.rel_path, action: 'deleted', before: null, after: null, snapshot },
  ];

  // The text file beside a document is that document in another format. Leaving it behind
  // would leave the whole of a forgotten contract sitting in the folder, still readable and
  // still returned by a search of the files themselves.
  const renditions = ctx.store.db
    .prepare('SELECT rel_path FROM documents WHERE renders = ?')
    .all(document.rel_path) as { rel_path: string }[];
  for (const rendition of renditions) {
    const held = await ctx.journal.trash(rendition.rel_path, token);
    files.push({ relPath: rendition.rel_path, action: 'deleted', before: null, after: null, snapshot: held });
  }

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'forget',
    summary: `trashed document ${document.rel_path}`,
    files,
  });

  // Same reasoning as above: the reconciler removes both rows once it sees the file
  // is gone, and pre-deleting the `files` row would stop it ever noticing.
  await ctx.indexer.run({ modelPaths: [] });

  return {
    status: 'ok',
    change_id: changeId,
    trashed: path.join(ctx.config.trashDir, snapshot),
    removed_from: document.rel_path,
  };
}

function sha256Line(text: string): string {
  // Matches how the deriver hashed it: the trimmed line, since that is what the
  // model was shown.
  return sha256(text.trim());
}
