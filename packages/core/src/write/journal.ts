import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import { newPrefixedId } from '../store/ids.ts';
import { restoreFile, type WriteResult } from './atomic.ts';

/**
 * **The journal is the only irreplaceable table.** Everything else is
 * derived from the Markdown and rebuilt by `akno index`; this holds the previous
 * bytes, and there is nowhere else to get them.
 *
 * It records content, not pointers — so `undo` still works after
 * `rm akno.db && akno index` has thrown away every fact id the change might
 * otherwise have referenced — which is why a fact id is never stored here.
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
        `INSERT INTO change_files(change_id, ord, rel_path, action, before, after, snapshot, moved_to)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      input.files.forEach((file, index) => {
        insert.run(
          changeId,
          index,
          file.relPath,
          file.action,
          file.before,
          file.after,
          file.snapshot ?? null,
          file.movedTo ?? null,
        );
      });
    });

    return changeId;
  }

  /**
   * Reverses a change: every file back to its previous bytes, in reverse order.
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
      .all(changeId) as {
      rel_path: string;
      action: FileAction;
      before: string | null;
      after: string | null;
      snapshot: string | null;
      moved_to: string | null;
    }[];

    const restored: string[] = [];
    const removed: string[] = [];
    const reversedMoves: { from: string; to: string }[] = [];
    for (const file of files) {
      if (file.moved_to) {
        // The change was a rename, so its reversal is the rename back. Nothing was created
        // and nothing was destroyed, which is why this case cannot go through `restoreFile`.
        const from = path.join(this.#aknoPath, file.moved_to);
        const target = path.join(this.#aknoPath, file.rel_path);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        let reversed = true;
        await fsp.rename(from, target).catch(async (err: NodeJS.ErrnoException) => {
          // Already gone is not a reason to abandon the rest of the reversal — the file was
          // moved again, or removed, since. Everything else still goes back.
          if (err.code !== 'ENOENT') throw err;
          reversed = false;
        });
        if (reversed) reversedMoves.push({ from: file.moved_to, to: file.rel_path });
        restored.push(file.rel_path);
        continue;
      }
      if (file.snapshot) {
        // A binary: the bytes are in trash, not in the journal.
        const source = path.join(this.#trashDir, file.snapshot);
        const target = path.join(this.#aknoPath, file.rel_path);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.copyFile(source, target);
      } else {
        await restoreFile(this.#aknoPath, file.rel_path, file.before);
      }
      // No prior content and no snapshot means the change created this file, so putting it
      // back is deleting it. Two opposite outcomes reported under one word is one of them
      // being reported wrongly.
      if (!file.snapshot && file.before === null) removed.push(file.rel_path);
      else restored.push(file.rel_path);
    }

    // A document row carries retained extraction and provenance that a structural re-index cannot
    // always reproduce without another model call. Follow successful attachment renames back before
    // the scanner runs, just as the forward move follows them, rather than deleting and recreating
    // the row from its content-derived id.
    if (reversedMoves.length > 0) {
      this.#store.transaction(() => {
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
      });
    }

    this.#store.db
      .prepare("UPDATE changes SET status = 'undone', undone_at = ? WHERE id = ?")
      .run(new Date().toISOString(), changeId);

    return { restored, removed, summary: change.summary };
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
