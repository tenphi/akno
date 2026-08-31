import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import { newPrefixedId, sha256 } from '../store/ids.ts';
import { restoreFile, type WriteResult } from './atomic.ts';

/**
 * The journal is durable state: it holds previous bytes, and there is nowhere else
 * to get them. `akno index --rebuild` deliberately preserves it while refreshing
 * reproducible projections, which is why a fact id is never stored here.
 *
 * The unit is a **change**, not a file. One `write` can touch a page, the event
 * ledger and an attachment; `undo` reverses all of them or none, because a page
 * whose ledger line survived it is a knowledge base that now lies.
 */

export type FileAction = 'created' | 'modified' | 'deleted' | 'moved';

export interface ChangeFile {
  relPath: string;
  action: FileAction;
  before: string | null;
  after: string | null;
  /** Set instead of `before` for a binary held in trash. */
  snapshot?: string;
  /**
   * Where a `moved` file went, when its bytes are nowhere else.
   *
   * A page carries its old text in `before`, so undo recreates it and deletes the copy at the
   * new path. An attachment has no text to carry, and reversing it that way deleted the file
   * and restored nothing. With this, the reversal is the rename it should always have been.
   */
  movedTo?: string;
}

export interface ChangeSummary {
  id: string;
  at: string;
  actor: string;
  op: string;
  summary: string;
  status: 'applied' | 'undone';
  files: { relPath: string; action: FileAction }[];
}

interface ChangeFileRow {
  rel_path: string;
  action: FileAction;
  before: string | null;
  after: string | null;
  snapshot: string | null;
  moved_to: string | null;
  before_hash: string | null;
  after_hash: string | null;
}

interface UndoConflict {
  path: string;
  reason:
    | 'move_source_occupied'
    | 'move_destination_missing'
    | 'move_destination_not_file'
    | 'move_destination_unverifiable'
    | 'move_destination_modified'
    | 'expected_absent'
    | 'expected_file_missing'
    | 'expected_regular_file'
    | 'file_modified'
    | 'recovery_snapshot_missing'
    | 'recovery_snapshot_unverifiable'
    | 'recovery_snapshot_modified';
}

interface AppliedReversal {
  file: ChangeFileRow;
  /** A created binary has no text in `after`; keep its exact bytes for rollback. */
  postBytes: Buffer | null;
}

export class Journal {
  readonly #store: Store;
  readonly #aknoPath: string;
  readonly #trashDir: string;

  constructor(store: Store, aknoPath: string, trashDir: string) {
    this.#store = store;
    this.#aknoPath = aknoPath;
    this.#trashDir = trashDir;
  }

  /**
   * Records a change that has already been applied to disk. Deliberately after
   * the fact: a journal entry for a write that then failed is a lie in the one
   * table that has to be trustworthy, and the failure mode of recording late (a
   * crash between write and journal leaves an un-undoable change) is both rarer
   * and far less confusing than the reverse.
   */
  record(input: { actor: string; op: string; summary: string; files: ChangeFile[] }): string {
    const changeId = newPrefixedId('chg');
    const now = new Date().toISOString();

    this.#store.transaction(() => {
      this.#store.db
        .prepare('INSERT INTO changes(id, at, actor, op, summary, status) VALUES(?, ?, ?, ?, ?, ?)')
        .run(changeId, now, input.actor, input.op, input.summary, 'applied');

      const insert = this.#store.db.prepare(
        `INSERT INTO change_files(
           change_id, ord, rel_path, action, before, after, snapshot, moved_to,
           before_hash, after_hash
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      input.files.forEach((file, index) => {
        const beforeHash =
          file.before !== null
            ? sha256(file.before)
            : file.snapshot
              ? hashFileIfPresent(path.join(this.#trashDir, file.snapshot))
              : null;
        const afterHash =
          file.after !== null
            ? sha256(file.after)
            : file.movedTo
              ? hashFileIfPresent(path.join(this.#aknoPath, file.movedTo))
              : file.action === 'created'
                ? hashFileIfPresent(path.join(this.#aknoPath, file.relPath))
                : null;
        insert.run(
          changeId,
          index,
          file.relPath,
          file.action,
          file.before,
          file.after,
          file.snapshot ?? null,
          file.movedTo ?? null,
          beforeHash,
          afterHash,
        );
      });
    });

    return changeId;
  }

  /**
   * Reverses a change only when every file still has the exact post-change state.
   *
   * Reverse order matters for a move — the change created the destination and
   * deleted the source, so undoing destination-first leaves the source free to be
   * recreated. Forward order would try to recreate the source while the
   * destination still holds it.
   */
  async undo(changeId: string): Promise<{ restored: string[]; removed: string[]; summary: string }> {
    const change = this.#store.db.prepare('SELECT * FROM changes WHERE id = ?').get(changeId) as
      { id: string; op: string; summary: string; status: string } | undefined;
    if (!change) throw new AknoError('not_found', `no change with id ${changeId}`);
    if (change.status === 'undone') {
      throw new AknoError('invalid', `${changeId} has already been undone`);
    }

    const files = this.#store.db
      .prepare('SELECT * FROM change_files WHERE change_id = ? ORDER BY ord DESC')
      .all(changeId) as ChangeFileRow[];

    const conflicts = await this.#undoConflicts(files);
    if (conflicts.length > 0) {
      throw new AknoError(
        'conflict',
        `cannot undo ${changeId}: ${conflicts.length} file${conflicts.length === 1 ? '' : 's'} no longer match the applied change`,
        {
          reason: 'stale_undo',
          conflicts,
          recovery:
            'Review the current files, restore the expected post-change state, then retry undo; no files were changed.',
        },
      );
    }

    const restored: string[] = [];
    const removed: string[] = [];
    const reversedMoves: { from: string; to: string }[] = [];
    const applied: AppliedReversal[] = [];
    try {
      for (const file of files) {
        const postBytes = await this.#rollbackBytes(file);
        await this.#reverseFile(file);
        applied.push({ file, postBytes });
        if (file.moved_to) reversedMoves.push({ from: file.moved_to, to: file.rel_path });
        if (!file.moved_to && !file.snapshot && file.before === null) removed.push(file.rel_path);
        else restored.push(file.rel_path);
      }

      this.#store.transaction(() => {
        // A document row carries retained extraction and provenance that a structural re-index cannot
        // always reproduce without another model call. Follow successful attachment renames back before
        // the scanner runs, just as the forward move follows them, rather than deleting and recreating
        // the row from its content-derived id.
        if (reversedMoves.length > 0) {
          const moveDocument = this.#store.db.prepare(
            'UPDATE OR IGNORE documents SET rel_path = ? WHERE rel_path = ?',
          );
          const moveRenders = this.#store.db.prepare('UPDATE documents SET renders = ? WHERE renders = ?');
          const moveGroup = this.#store.db.prepare('UPDATE documents SET group_key = ? WHERE group_key = ?');
          for (const move of reversedMoves) moveDocument.run(move.to, move.from);
          for (const move of reversedMoves) {
            moveRenders.run(move.to, move.from);
            moveGroup.run(move.to, move.from);
          }
        }
        this.#store.db
          .prepare("UPDATE changes SET status = 'undone', undone_at = ? WHERE id = ?")
          .run(new Date().toISOString(), changeId);
      });
    } catch (error) {
      await this.#restorePostChangeState(applied);
      throw error;
    }

    return { restored, removed, summary: change.summary };
  }

  async #undoConflicts(files: ChangeFileRow[]): Promise<UndoConflict[]> {
    const conflicts: UndoConflict[] = [];
    for (const file of files) {
      if (file.moved_to) {
        const sourceState = await fileState(path.join(this.#aknoPath, file.rel_path));
        if (sourceState.kind !== 'missing') {
          conflicts.push({ path: file.rel_path, reason: 'move_source_occupied' });
        }
        const destinationState = await fileState(path.join(this.#aknoPath, file.moved_to));
        if (destinationState.kind === 'missing') {
          conflicts.push({ path: file.moved_to, reason: 'move_destination_missing' });
        } else if (destinationState.kind !== 'file') {
          conflicts.push({ path: file.moved_to, reason: 'move_destination_not_file' });
        } else if (!file.after_hash) {
          conflicts.push({ path: file.moved_to, reason: 'move_destination_unverifiable' });
        } else if (destinationState.hash !== file.after_hash) {
          conflicts.push({ path: file.moved_to, reason: 'move_destination_modified' });
        }
      } else {
        const current = await fileState(path.join(this.#aknoPath, file.rel_path));
        const expectedHash = file.after_hash ?? (file.after === null ? null : sha256(file.after));
        if (expectedHash === null && current.kind !== 'missing') {
          conflicts.push({ path: file.rel_path, reason: 'expected_absent' });
        } else if (expectedHash !== null && current.kind === 'missing') {
          conflicts.push({ path: file.rel_path, reason: 'expected_file_missing' });
        } else if (expectedHash !== null && current.kind !== 'file') {
          conflicts.push({ path: file.rel_path, reason: 'expected_regular_file' });
        } else if (expectedHash !== null && current.kind === 'file' && current.hash !== expectedHash) {
          conflicts.push({ path: file.rel_path, reason: 'file_modified' });
        }
      }

      if (file.snapshot) {
        const snapshot = await fileState(path.join(this.#trashDir, file.snapshot));
        const expected = file.before_hash;
        if (snapshot.kind !== 'file') {
          conflicts.push({ path: file.rel_path, reason: 'recovery_snapshot_missing' });
        } else if (!expected) {
          // Rows created before snapshot hashes existed cannot prove that the private copy
          // still holds the bytes Akno removed. Restoring unknown bytes would make an old
          // journal entry more authoritative than the user's current knowledge base.
          conflicts.push({ path: file.rel_path, reason: 'recovery_snapshot_unverifiable' });
        } else if (snapshot.hash !== expected) {
          conflicts.push({ path: file.rel_path, reason: 'recovery_snapshot_modified' });
        }
      }
    }
    return conflicts;
  }

  async #reverseFile(file: ChangeFileRow): Promise<void> {
    if (file.moved_to) {
      const from = path.join(this.#aknoPath, file.moved_to);
      const target = path.join(this.#aknoPath, file.rel_path);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.rename(from, target);
      return;
    }
    if (file.snapshot) {
      const source = path.join(this.#trashDir, file.snapshot);
      const target = path.join(this.#aknoPath, file.rel_path);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await copyFileAtomic(source, target);
      return;
    }
    await restoreFile(this.#aknoPath, file.rel_path, file.before);
  }

  async #rollbackBytes(file: ChangeFileRow): Promise<Buffer | null> {
    if (file.moved_to || file.snapshot || file.after !== null || !file.after_hash) return null;
    return fsp.readFile(path.join(this.#aknoPath, file.rel_path));
  }

  /** Roll back a partially applied reversal to the state that passed preflight. */
  async #restorePostChangeState(applied: AppliedReversal[]): Promise<void> {
    let rollbackError: unknown = null;
    for (const reversal of [...applied].reverse()) {
      const { file, postBytes } = reversal;
      try {
        if (file.moved_to) {
          const source = path.join(this.#aknoPath, file.rel_path);
          const destination = path.join(this.#aknoPath, file.moved_to);
          await fsp.mkdir(path.dirname(destination), { recursive: true });
          await fsp.rename(source, destination);
        } else if (postBytes) {
          const destination = path.join(this.#aknoPath, file.rel_path);
          await fsp.mkdir(path.dirname(destination), { recursive: true });
          await writeBytesAtomic(destination, postBytes);
        } else {
          await restoreFile(this.#aknoPath, file.rel_path, file.after);
        }
      } catch (error) {
        rollbackError ??= error;
      }
    }
    if (rollbackError) {
      throw new AknoError('internal', 'undo failed and its filesystem rollback was incomplete', {
        reason: 'undo_rollback_failed',
      });
    }
  }

  list(limit = 20): ChangeSummary[] {
    // By rowid, not by `at`: two changes in the same millisecond have identical
    // timestamps, and "the most recent change" then depends on SQLite's scan order.
    // `undo --list` showing them out of order is how you undo the wrong one.
    const rows = this.#store.db.prepare('SELECT * FROM changes ORDER BY rowid DESC LIMIT ?').all(limit) as {
      id: string;
      at: string;
      actor: string;
      op: string;
      summary: string;
      status: 'applied' | 'undone';
    }[];

    const filesFor = this.#store.db.prepare(
      'SELECT rel_path, action FROM change_files WHERE change_id = ? ORDER BY ord',
    );
    return rows.map((row) => ({
      ...row,
      files: (filesFor.all(row.id) as { rel_path: string; action: FileAction }[]).map((file) => ({
        relPath: file.rel_path,
        action: file.action,
      })),
    }));
  }

  /**
   * Moves a file into `trash/<change>/` and returns the snapshot path:
   * `forget({slug})` moves a whole page to trash and stays undoable for the
   * retention window — deleting outright would make "reversible" a lie.
   */
  async trash(relPath: string, changeToken: string): Promise<string> {
    const snapshot = path.join(changeToken, relPath);
    const target = path.join(this.#trashDir, snapshot);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.rename(path.join(this.#aknoPath, relPath), target).catch(async (err) => {
      // A rename across devices fails; trash may sit on a different volume.
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
      await fsp.copyFile(path.join(this.#aknoPath, relPath), target);
      await fsp.rm(path.join(this.#aknoPath, relPath));
    });
    return snapshot;
  }

  /**
   * Drops trashed files past the retention window. Called from the maintenance
   * path, never from a write — a delete that also expires somebody else's older
   * delete is a surprise nobody asked for.
   */
  async expireTrash(retentionDays: number): Promise<number> {
    if (retentionDays <= 0) return 0;
    const cutoff = Date.now() - retentionDays * 86_400_000;
    let removed = 0;
    let entries: string[];
    try {
      entries = await fsp.readdir(this.#trashDir);
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const abs = path.join(this.#trashDir, entry);
      const stat = await fsp.stat(abs).catch(() => null);
      if (!stat || stat.mtimeMs > cutoff) continue;
      await fsp.rm(abs, { recursive: true, force: true });
      removed++;
    }
    return removed;
  }
}

/** Convenience: turn an atomic write result into the journal's shape. */
export function fileEntry(result: WriteResult): ChangeFile {
  return {
    relPath: result.relPath,
    action: result.created ? 'created' : 'modified',
    before: result.before,
    after: result.after,
  };
}

function hashFileIfPresent(absPath: string): string | null {
  try {
    return sha256(fs.readFileSync(absPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function fileState(
  absPath: string,
): Promise<{ kind: 'missing' } | { kind: 'other' } | { kind: 'file'; hash: string }> {
  const stat = await fsp.lstat(absPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return { kind: 'missing' };
  if (!stat.isFile()) return { kind: 'other' };
  return { kind: 'file', hash: sha256(await fsp.readFile(absPath)) };
}

async function copyFileAtomic(source: string, destination: string): Promise<void> {
  await replaceAtomically(destination, (temporary) => fsp.copyFile(source, temporary));
}

async function writeBytesAtomic(destination: string, bytes: Buffer): Promise<void> {
  await replaceAtomically(destination, (temporary) => fsp.writeFile(temporary, bytes));
}

/** Keep a failed binary restore out of the user-visible path, just like page writes. */
async function replaceAtomically(
  destination: string,
  populate: (temporary: string) => Promise<void>,
): Promise<void> {
  const temporary = `${destination}.akno.tmp`;
  try {
    await populate(temporary);
    const handle = await fsp.open(temporary, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsp.rename(temporary, destination);
  } catch (error) {
    await fsp.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
