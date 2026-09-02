import type { AknoContext } from '../context.ts';

interface ActiveSupportArchive {
  memory_id: string;
  source_ref: string;
  origin: 'user' | 'assistant' | 'unknown';
  evidence: string;
  evidence_hash: string;
  input_hash: string;
}

/** Keep the legacy dream verifier's one-source archive aligned with live multi-source support. */
export function reconcileRetainManagedSources(ctx: AknoContext, memoryIds: Iterable<string>): void {
  const ids = [...new Set(memoryIds)];
  if (ids.length === 0 || ctx.store.readOnly) return;
  const active = ctx.store.db.prepare(
    `SELECT rs.memory_id, rs.source_ref, rs.origin, rs.evidence, rs.evidence_hash, rs.input_hash
     FROM retain_supports rs JOIN retain_receipts rr
       ON rr.receipt_fingerprint = rs.receipt_fingerprint
     WHERE rs.memory_id = ? AND rs.retracted_by IS NULL AND rs.forgotten_by IS NULL
     ORDER BY rr.created_at LIMIT 1`,
  );
  const upsert = ctx.store.db.prepare(
    `INSERT INTO managed_item_sources(
       item_id, source_ref, origin, evidence, evidence_hash, input_hash, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       source_ref = excluded.source_ref,
       origin = excluded.origin,
       evidence = excluded.evidence,
       evidence_hash = excluded.evidence_hash,
       input_hash = excluded.input_hash`,
  );
  const remove = ctx.store.db.prepare('DELETE FROM managed_item_sources WHERE item_id = ?');
  const now = new Date().toISOString();
  ctx.store.transaction(() => {
    for (const memoryId of ids) {
      const row = active.get(memoryId) as ActiveSupportArchive | undefined;
      if (!row) {
        remove.run(memoryId);
        continue;
      }
      upsert.run(
        row.memory_id,
        row.source_ref,
        row.origin,
        row.evidence,
        row.evidence_hash,
        row.input_hash,
        now,
      );
    }
    // Cached verdicts may quote the source that just stopped being current.
    ctx.store.db.prepare('DELETE FROM managed_item_source_verdicts').run();
  });
}

/** A user forget is stronger than source replay: keep the receipt, but retire its live support. */
export function forgetRetainSupports(ctx: AknoContext, memoryIds: Iterable<string>, changeId: string): void {
  const ids = [...new Set(memoryIds)];
  if (ids.length === 0 || ctx.store.readOnly) return;
  const retire = ctx.store.db.prepare(
    `UPDATE retain_supports SET forgotten_by = ?
     WHERE memory_id = ? AND retracted_by IS NULL AND forgotten_by IS NULL`,
  );
  ctx.store.transaction(() => {
    for (const memoryId of ids) retire.run(changeId, memoryId);
  });
  reconcileRetainManagedSources(ctx, ids);
  pruneRetainEvidence(ctx, { apply: true });
}

export interface RetainEvidencePruneResult {
  applied: boolean;
  graceDays: number;
  cutoff: string;
  supports: number;
  privateBytes: number;
}

/**
 * Remove exact private quotes only after their support is inactive, its grace has elapsed, and
 * no nonterminal maintenance work still names the managed item. Replay identity, hashes, source
 * bindings, and compact candidate receipts remain durable.
 */
export function pruneRetainEvidence(
  ctx: AknoContext,
  options: { apply?: boolean; now?: Date } = {},
): RetainEvidencePruneResult {
  const now = options.now ?? new Date();
  const graceDays = ctx.config.maintenance.retain.evidenceGraceDays;
  const cutoff = new Date(now.getTime() - graceDays * 86_400_000).toISOString();
  const dependencies = `NOT EXISTS (
    SELECT 1
      FROM maintenance_items item
      JOIN maintenance_plans plan ON plan.id = item.plan_id
     WHERE plan.status NOT IN ('completed', 'failed', 'superseded')
       AND (
         instr(item.operations, support.memory_id) > 0 OR
         instr(item.evidence, support.memory_id) > 0 OR
         EXISTS (
           SELECT 1 FROM maintenance_item_revisions revision
            WHERE revision.item_id = item.id
              AND instr(revision.operations, support.memory_id) > 0
         )
       )
  )`;
  const eligible = `
    FROM retain_supports support
    JOIN retain_receipts receipt
      ON receipt.receipt_fingerprint = support.receipt_fingerprint
    LEFT JOIN retain_receipts retraction
      ON retraction.receipt_fingerprint = support.retracted_by
    LEFT JOIN changes forgotten
      ON forgotten.id = support.forgotten_by
   WHERE support.evidence_pruned_at IS NULL
     AND length(support.evidence) > 0
     AND (support.retracted_by IS NOT NULL OR support.forgotten_by IS NOT NULL)
     AND coalesce(retraction.created_at, forgotten.at, receipt.created_at) <= ?
     AND ${dependencies}`;
  const row = ctx.store.db
    .prepare(
      `SELECT count(*) AS supports,
              coalesce(sum(length(CAST(support.evidence AS BLOB))), 0) AS private_bytes
       ${eligible}`,
    )
    .get(cutoff) as { supports: number; private_bytes: number };
  const result: RetainEvidencePruneResult = {
    applied: options.apply === true,
    graceDays,
    cutoff,
    supports: row.supports,
    privateBytes: row.private_bytes,
  };
  if (!options.apply || row.supports === 0 || ctx.store.readOnly) return result;

  ctx.store.transaction(() => {
    ctx.store.db
      .prepare(
        `UPDATE retain_supports AS support
            SET evidence = '', evidence_pruned_at = ?
          WHERE (support.receipt_fingerprint, support.candidate_id) IN (
            SELECT support.receipt_fingerprint, support.candidate_id ${eligible}
          )`,
      )
      .run(now.toISOString(), cutoff);
    ctx.store.db.prepare('DELETE FROM managed_item_source_verdicts').run();
  });
  ctx.store.db.pragma('wal_checkpoint(TRUNCATE)');
  return result;
}
