import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, MoveInput, type MoveOutput } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { ATTACHMENT_NAME } from '../kb/page.ts';
import { recordOwnWrite, writeFileAtomic } from '../write/atomic.ts';
import type { ChangeFile } from '../write/journal.ts';
import { normalizeSlug } from './write.ts';

/**
 * Relocate a page with its documents, rewriting embeds and **reporting**
 * inbound links.
 *
 * The asymmetry between rewriting and reporting is deliberate:
 *
 * - The moved page's own links to its attachments are rewritten, because the move
 *   renamed those files and leaving them would break the page Akno just moved.
 * - Links *into* the page from elsewhere are reported, never rewritten. Editing
 *   half a dozen other people's pages as a side effect of moving one is a much
 *   bigger action than the caller asked for, and inbound links are already treated
 *   that now point nowhere as something to report.
 *
 * Identity survives regardless: the page keeps its `id`, so facts, events and
 * journal history stay attached.
 */
export async function move(ctx: AknoContext, rawInput: unknown): Promise<MoveOutput> {
  const input = MoveInput.parse(rawInput);
  const from = normalizeSlug(input.from);
  const to = normalizeSlug(input.to);

  if (from === to) return { status: 'ok', outcome: 'ok', note: 'source and destination are the same' };

  const page = ctx.store.db.prepare('SELECT id, rel_path FROM pages WHERE slug = ?').get(from) as
    { id: string; rel_path: string } | undefined;
  if (!page) throw new AknoError('not_found', `no page at ${from}`);

  if (ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(to)) {
    throw new AknoError('invalid', `${to} already exists — move it or pick another slug`);
  }

  // The destination folder is gated exactly like a new page's would be: moving a
  // page into `medical/` creates `medical/` just as surely as writing one there.
  const decision = ctx.gate.check(to, ctx.actor, input);
  if (!decision.allowed) {
    return {
      status: 'ok',
      outcome: 'requires_approval',
      approval: decision.approval,
      note: 'the destination folder does not exist yet',
    };
  }

  const files: ChangeFile[] = [];
  const moved: string[] = [];
  const toRelPath = `${to}.md`;

  // ── Attachments first ───────────────────────────────────────────────────
  // Content-addressed names are derived from the page basename, so a move
  // renames them too. Doing these before the page means a crash leaves the page
  // still pointing at files that exist.
  const documents = ctx.store.db
    .prepare('SELECT id, rel_path FROM documents WHERE page_id = ?')
    .all(page.id) as { id: string; rel_path: string }[];

  const rewrites: [string, string][] = [];
  for (const document of documents) {
    const next = movedAttachmentPath(document.rel_path, from, to);
    if (next === document.rel_path) continue;
    await fsp.mkdir(path.dirname(path.join(ctx.config.aknoPath, next)), { recursive: true });
    await fsp.rename(
      path.join(ctx.config.aknoPath, document.rel_path),
      path.join(ctx.config.aknoPath, next),
    );
    files.push({ relPath: document.rel_path, action: 'moved', before: null, after: null });
    files.push({ relPath: next, action: 'created', before: null, after: null });
    moved.push(next);
    rewrites.push([path.basename(document.rel_path), path.basename(next)]);
  }

  // ── The page ────────────────────────────────────────────────────────────
  const original = await fsp.readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8');
  let content = original;
  for (const [oldName, newName] of rewrites) {
    content = content.split(oldName).join(newName);
  }

  await fsp.mkdir(path.dirname(path.join(ctx.config.aknoPath, toRelPath)), { recursive: true });
  const written = await writeFileAtomic(ctx.config.aknoPath, toRelPath, content);
  await fsp.rm(path.join(ctx.config.aknoPath, page.rel_path), { force: true });

  files.push({ relPath: page.rel_path, action: 'moved', before: original, after: null });
  files.push({ relPath: toRelPath, action: 'created', before: null, after: written.after });
  moved.push(toRelPath);

  // ── Inbound links ───────────────────────────────────────────────────────
  const inbound = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.slug FROM links l JOIN pages p ON p.id = l.from_page
        WHERE l.to_slug = ? AND p.id != ?`,
    )
    .all(from, page.id) as { slug: string }[];

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'move',
    summary: `${from} -> ${to}${documents.length > 0 ? ` with ${documents.length} attachment(s)` : ''}`,
    files,
  });

  ctx.store.transaction(() => {
    // Follow the id rather than retiring it — the same rule the watcher uses for a
    // hand rename.
    ctx.store.db.prepare('UPDATE pages SET slug = ?, rel_path = ? WHERE id = ?').run(to, toRelPath, page.id);
    ctx.store.db.prepare('DELETE FROM files WHERE rel_path = ?').run(page.rel_path);
    for (const document of documents) {
      const next = movedAttachmentPath(document.rel_path, from, to);
      ctx.store.db.prepare('UPDATE documents SET rel_path = ? WHERE id = ?').run(next, document.id);
      ctx.store.db.prepare('DELETE FROM files WHERE rel_path = ?').run(document.rel_path);
    }
    recordOwnWrite(ctx.store, ctx.config.aknoPath, toRelPath, content, page.id);
  });

  // The page kept its id and its body, so nothing needs re-deriving — only the
  // structural walk to notice the paths moved.
  await ctx.indexer.run({ modelPaths: [] });

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    moved,
    ...(inbound.length > 0
      ? {
          broken_inbound: inbound.map((row) => row.slug),
          note:
            `${inbound.length} page(s) still link to '${from}'. They are reported rather than rewritten — ` +
            'editing them is a bigger change than the one you asked for.',
        }
      : {}),
  };
}

/**
 * `documents/passport-ada-3f8c1a2b.jpg` moving with `documents/passport-ada`
 * becomes `archive/id/passport-ada-3f8c1a2b.jpg` — the hash is content-addressing
 * and must not change, since the bytes did not.
 */
function movedAttachmentPath(relPath: string, from: string, to: string): string {
  const base = path.posix.basename(relPath.replace(/\\/g, '/'));
  const fromBase = from.split('/').pop()!;
  const toBase = to.split('/').pop()!;
  const toDir = to.includes('/') ? to.slice(0, to.lastIndexOf('/')) : '';

  const addressed = ATTACHMENT_NAME.exec(base);
  const nextBase =
    addressed && addressed[1] === fromBase
      ? `${toBase}-${addressed[2]}.${addressed[3]}`
      : base.startsWith(`${fromBase}.`)
        ? `${toBase}${base.slice(fromBase.length)}`
        : base;

  return toDir ? `${toDir}/${nextBase}` : nextBase;
}
