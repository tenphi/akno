import { UndoInput, type UndoOutput } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { pruneManagedSourceArchivesFromIndex } from '../maintenance/managed-item-sources.ts';
import { realignMaintenanceIdentityAfterUndo } from '../maintenance/plans.ts';
import { reconcileRetainManagedSources } from '../write/retain-supports.ts';

/**
 * **Remember which change to revert** is normally asked of the model. Here
 * the journal does it: `undo` takes an id that outlives the session, the process,
 * and a full rebuild of every other table.
 */
export async function undo(ctx: AknoContext, rawInput: unknown): Promise<UndoOutput> {
  const input = UndoInput.parse(rawInput);
  const reversed = await ctx.journal.undo(input.change_id);
  realignMaintenanceIdentityAfterUndo(ctx, input.change_id);
  const forgottenRetainItems = ctx.store.db
    .prepare('SELECT DISTINCT memory_id FROM retain_supports WHERE forgotten_by = ?')
    .all(input.change_id) as { memory_id: string }[];
  ctx.store.db
    .prepare('UPDATE retain_supports SET forgotten_by = NULL WHERE forgotten_by = ?')
    .run(input.change_id);
  // A replay receipt is authority to skip the write. Once that write is undone, keeping its
  // receipt would make the identical retry claim success while leaving the memory absent.
  const affectedRetainItems = ctx.store.db
    .prepare(
      `SELECT DISTINCT rs.memory_id
       FROM retain_supports rs JOIN retain_receipts rr
         ON rr.receipt_fingerprint = rs.receipt_fingerprint
       WHERE (rr.change_id = ? AND rr.mode <> 'migration') OR rs.retracted_by IN (
         SELECT receipt_fingerprint FROM retain_receipts WHERE change_id = ? AND mode <> 'migration'
       )`,
    )
    .all(input.change_id, input.change_id) as { memory_id: string }[];
  ctx.store.db.prepare('DELETE FROM retain_receipts WHERE change_id = ?').run(input.change_id);
  reconcileRetainManagedSources(
    ctx,
    [...affectedRetainItems, ...forgottenRetainItems].map((row) => row.memory_id),
  );

  // Deliberately does **not** touch `files`, in either direction.
  //
  // For a file the undo removed, deleting its `files` row would hide the deletion
  // from the reconciler: `known` is built from `files`, so a path that is not there
  // can never appear in the vanished set, and the `pages` row survives pointing at
  // a file that no longer exists. For a file the undo restored, a pre-recorded hash
  // makes the stat fast path skip it.
  //
  // A full structural pass, because an undo can remove a page that existed and only
  // a whole-tree walk can conclude a file is gone. Model work stays scoped to what
  // the undo actually touched — reversing one line must not re-derive the whole
  // knowledge base.
  await ctx.indexer.runForeground({ modelPaths: [] });
  await pruneManagedSourceArchivesFromIndex(ctx);
  // Same reasoning as `write`: the files are back, which is what undo promised. Re-reading them for
  // summaries and facts is work nobody is waiting on, and awaiting it put a cold deriver inside an
  // undo — which then timed out, on an undo that had already succeeded.
  ctx.derive.schedule(reversed.restored);

  return {
    status: 'ok',
    reversed: reversed.summary,
    ...(reversed.restored.length > 0 ? { restored: reversed.restored } : {}),
    ...(reversed.removed.length > 0 ? { removed: reversed.removed } : {}),
  };
}
