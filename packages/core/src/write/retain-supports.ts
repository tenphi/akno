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
}
