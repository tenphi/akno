import fs from 'node:fs';
import path from 'node:path';
import type { AnswerContextItem } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';
import { parseManagedMemoryMarker } from '../write/managed-memory.ts';

interface Projection {
  rel_path: string;
  marker_hash: string;
  payload_hash: string;
}

/**
 * An archived frame constrains the meaning of an extracted record; it cannot supply additional
 * answerable facts. Keep this optional context outside public evidence and its citation identity.
 */
export function retentionSourceFrames(
  db: Store['db'],
  aknoPath: string,
  evidence: readonly AnswerContextItem[],
): ReadonlyMap<string, string> {
  const frames = new Map<string, string>();
  // Preserve complete frames in retrieval order; truncation can remove a governing qualification.
  let remainingCharacters = 4_800;
  const projection = db.prepare(`
    SELECT p.rel_path, m.marker_hash, m.payload_hash
      FROM managed_memory_entries m JOIN pages p ON p.id = m.source_page
     WHERE m.memory_id = ? AND m.source_slug = ? AND m.payload_line = ?
       AND (SELECT count(*) FROM managed_memory_entries WHERE memory_id = m.memory_id) = 1`);
  const support = db.prepare(`
    SELECT s.evidence, s.evidence_hash
      FROM retain_supports s JOIN retain_receipts r ON r.receipt_fingerprint = s.receipt_fingerprint
     WHERE s.memory_id = ? AND s.receipt_fingerprint = ? AND s.candidate_fingerprint = ?
       AND s.proof_group = ? AND s.selection = 'extracted' AND r.mode = 'extract_automatic'
       AND s.input_hash = r.source_hash
       AND s.retracted_by IS NULL AND s.forgotten_by IS NULL AND s.evidence_pruned_at IS NULL`);
  for (const item of evidence) {
    if (item.type !== 'page' || item.lines.length !== 1) continue;
    const line = item.lines[0]!;
    if (line.memory?.status !== 'qualified') continue;
    const row = projection.get(line.memory.id, item.slug, line.n) as Projection | undefined;
    if (!row) continue;
    try {
      const root = fs.realpathSync(aknoPath);
      const target = fs.realpathSync(path.resolve(root, row.rel_path));
      if (!target.startsWith(`${root}${path.sep}`)) continue;
      const lines = fs.readFileSync(target, 'utf8').split('\n');
      const markerText = lines[line.n - 2]?.trim();
      const payload = lines[line.n - 1];
      if (
        !markerText ||
        payload !== line.text ||
        sha256(markerText) !== row.marker_hash ||
        sha256(payload.trim()) !== row.payload_hash
      )
        continue;
      const marker = parseManagedMemoryMarker(markerText);
      // Multiple sources may carry different context. Do not choose one as a silent tie-breaker.
      if (marker?.id !== line.memory.id || marker.supports.length !== 1) continue;
      const binding = marker.supports[0]!;
      if (binding.selection !== 'extracted') continue;
      // The support slug records its original placement and legitimately survives a page move.
      const matches = support.all(marker.id, binding.receipt, binding.candidate, binding.proofGroup) as {
        evidence: string;
        evidence_hash: string;
      }[];
      const frame = matches.length === 1 ? matches[0] : undefined;
      if (
        frame &&
        frame.evidence.trim().length > 0 &&
        frame.evidence.length <= 1_200 &&
        frame.evidence.length <= remainingCharacters &&
        sha256(frame.evidence) === frame.evidence_hash
      ) {
        frames.set(item.evidence_id, frame.evidence);
        remainingCharacters -= frame.evidence.length;
      }
    } catch {
      // Source archives are optional. A missing/moved file keeps the existing payload-only path.
    }
  }
  return frames;
}
