import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from '../store/ids.ts';
import type { Store } from '../store/db.ts';

/**
 * Every byte Akno writes into the knowledge base goes through here.
 *
 * Two properties, both of which matter more than they look:
 *
 * **Atomic.** Write a sibling temp file, fsync it, rename over the target. A
 * rename within one APFS directory is atomic, so a reader — the watcher, an
 * editor, a sync client, `recall` reading lines off disk — never sees a half-
 * written page. Writing in place would let a crash or a concurrent read catch a
 * truncated file, and the truncated version is what gets indexed and cited.
 *
 * **Self-aware.** The resulting hash, size and mtime are recorded in `files`
 * immediately, so the watcher recognises Akno's own write and does not schedule
 * a re-index of a page it already has. That promise about the `id`
 * write; it has to hold for every write or the watcher chases its own tail.
 */

export interface WriteResult {
  relPath: string;
  absPath: string;
  /** Bytes before the write. Null when the file did not exist. */
  before: string | null;
  after: string;
  created: boolean;
}

/** The temp suffix the watcher already ignores, so a write never wakes it twice. */
const TEMP_SUFFIX = '.akno.tmp';

export async function writeFileAtomic(
  aknoPath: string,
  relPath: string,
  content: string,
): Promise<WriteResult> {
  const absPath = path.join(aknoPath, relPath);
  await fsp.mkdir(path.dirname(absPath), { recursive: true });

  let before: string | null = null;
  try {
    before = await fsp.readFile(absPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const tempPath = `${absPath}${TEMP_SUFFIX}`;
  const handle = await fsp.open(tempPath, 'w', 0o644);
  try {
    await handle.writeFile(content, 'utf8');
    // Without the fsync the rename can land before the data does, and a crash in
    // that window leaves a correctly-named empty file — the worst outcome, because
    // it looks like a page the user emptied on purpose.
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsp.rename(tempPath, absPath);

  return { relPath, absPath, before, after: content, created: before === null };
}

/**
 * Records Akno's own write in `files` so the next sweep sees nothing changed.
 * Called after the write and inside the same transaction as the journal entry.
 */
export function recordOwnWrite(
  store: Store,
  aknoPath: string,
  relPath: string,
  content: string,
  pageId: string | null,
): void {
  // `bigint: true` to match the scanner exactly. A float mtime loses precision
  // above ~2^53 ns, and a value that differs from what the scanner would read is
  // worse than none — it defeats the stat fast path on every single sweep.
  const stat = fs.statSync(path.join(aknoPath, relPath), { bigint: true, throwIfNoEntry: false });
  store.db
    .prepare(
      `INSERT INTO files(rel_path, size, mtime_ns, sha256, kind, page_id, indexed_at)
       VALUES(?, ?, ?, ?, 'page', ?, ?)
       ON CONFLICT(rel_path) DO UPDATE SET
         size = excluded.size, mtime_ns = excluded.mtime_ns, sha256 = excluded.sha256,
         page_id = excluded.page_id, indexed_at = excluded.indexed_at`,
    )
    .run(
      relPath,
      Buffer.byteLength(content, 'utf8'),
      stat ? String(stat.mtimeNs) : '0',
      sha256(content),
      pageId,
      new Date().toISOString(),
    );
}

/** Restores a file to exact prior bytes, or removes it if there were none. */
export async function restoreFile(aknoPath: string, relPath: string, before: string | null): Promise<void> {
  if (before === null) {
    await fsp.rm(path.join(aknoPath, relPath), { force: true });
    return;
  }
  await writeFileAtomic(aknoPath, relPath, before);
}
