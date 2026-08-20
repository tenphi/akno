import { UndoInput, type UndoOutput } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';

/**
 * **Remember which change to revert** is normally asked of the model. Here
 * the journal does it: `undo` takes an id that outlives the session, the process,
 * and a full rebuild of every other table.
 */
export async function undo(ctx: AknoContext, rawInput: unknown): Promise<UndoOutput> {
  const input = UndoInput.parse(rawInput);
  const reversed = await ctx.journal.undo(input.change_id);

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
  await ctx.indexer.run({ modelPaths: [] });
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
