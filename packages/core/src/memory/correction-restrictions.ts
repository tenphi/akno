import type { Store } from '../store/db.ts';

export type CorrectionRestriction = 'pending_correction' | 'superseded_revision';

/**
 * A proof group is caller-declared correlation, not independent confirmation. Until an explicit
 * withdrawal is resolved, none of its copies can silently restore the earlier current meaning.
 * After admission, older copies stay historical; unchanged facts supported by the replacement
 * remain usable. These bindings contain no replacement evidence and survive an index rebuild.
 */
export function correctionMemoryRestrictions(store: Store): Map<string, CorrectionRestriction> {
  const superseded = store.db
    .prepare(
      `
    SELECT DISTINCT old.memory_id
      FROM retain_superseded_supports history
      JOIN retain_supports old ON old.receipt_fingerprint = history.support_receipt
       AND old.candidate_id = history.candidate_id
     WHERE old.retracted_by IS NULL AND old.forgotten_by IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM retain_supports replacement
          WHERE replacement.receipt_fingerprint = history.resolved_by
            AND replacement.memory_id = old.memory_id
            AND replacement.retracted_by IS NULL AND replacement.forgotten_by IS NULL
       )`,
    )
    .all() as { memory_id: string }[];
  const pending = store.db
    .prepare(
      `
    SELECT DISTINCT copy.memory_id
      FROM retain_pending_corrections pending
      JOIN retain_supports target ON target.receipt_fingerprint = pending.target_receipt
       AND target.candidate_id = pending.target_candidate
      JOIN retain_supports copy ON copy.proof_group = target.proof_group
     WHERE pending.resolved_by IS NULL
       AND target.retracted_by IS NULL AND target.forgotten_by IS NULL
       AND copy.retracted_by IS NULL AND copy.forgotten_by IS NULL`,
    )
    .all() as { memory_id: string }[];
  return new Map([
    ...superseded.map((row) => [row.memory_id, 'superseded_revision'] as const),
    ...pending.map((row) => [row.memory_id, 'pending_correction'] as const),
  ]);
}
