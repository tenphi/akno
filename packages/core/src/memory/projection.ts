import type { MemoryView, PageRole } from '@tenphi/akno-protocol';
import type { ParsedPage } from '../kb/page.ts';
import { AKNO_ITEM, aknoItemId } from '../kb/page.ts';
import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';
import {
  managedMemoryAnswerEligible,
  managedMemoryPayloadIssue,
  parseManagedMemoryMarker,
} from '../write/managed-memory.ts';
import { memoryEligibleForView } from './intent.ts';

export const MANAGED_MEMORY_PROJECTION_VERSION = 'managed-memory-v1';

export interface ManagedMemoryProjectionReport {
  indexed: number;
  relations: number;
  issues: number;
}

export interface ManagedMemoryProjectionState {
  eligibleChunkIds: Set<number>;
  contextualChunkIds: Set<number>;
  degraded: boolean;
}

interface ProjectedMemoryRow {
  entry_key: string;
  memory_id: string;
  source_page: string;
  marker_line: number;
  payload_line: number;
  kind: 'claim' | 'decision' | 'preference' | 'plan' | 'event' | 'question';
  commitment: 'asserted' | 'tentative' | 'hypothetical' | 'counterfactual' | 'none';
  disposition:
    'active' | 'proposed' | 'accepted' | 'rejected' | 'resolved' | 'cancelled' | 'completed' | 'superseded';
  basis: 'self_attested' | 'source_report' | 'cited_evidence' | 'system_record';
  answer_eligible: number;
  temporal_status: 'actual' | 'scheduled' | 'planned' | 'tentative' | null;
  temporal_relation: 'occurred' | 'valid' | 'scheduled' | 'due' | null;
}

/** Replace one page's rebuildable semantic projection. Markdown remains the only memory source. */
export function replaceManagedMemoryEntries(
  store: Store,
  pageId: string,
  page: ParsedPage,
  role: PageRole,
): ManagedMemoryProjectionReport {
  store.db.prepare('DELETE FROM managed_memory_projection_issues WHERE source_page = ?').run(pageId);
  store.db.prepare('DELETE FROM managed_memory_entries WHERE source_page = ?').run(pageId);
  if (role !== 'knowledge') return { indexed: 0, relations: 0, issues: 0 };

  const insertEntry = store.db.prepare(
    `INSERT INTO managed_memory_entries(
       entry_key, memory_id, source_page, source_slug, marker_line, payload_line, payload,
       marker_hash, payload_hash, kind, subject, source_role, source_speaker, reporters, commitment,
       disposition, polarity, basis, evidence, answer_eligible, temporal_status, temporal_relation
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRelation = store.db.prepare(
    `INSERT INTO managed_memory_relations(
       entry_key, ordinal, relation, target_kind, target_id, support
     ) VALUES(?, ?, ?, ?, ?, ?)`,
  );
  const insertIssue = store.db.prepare(
    `INSERT OR REPLACE INTO managed_memory_projection_issues(
       source_page, marker_line, memory_id, reason
     ) VALUES(?, ?, ?, ?)`,
  );
  const memoryIdCounts = new Map<string, number>();
  for (let index = 0; index < page.lines.length; index++) {
    const raw = page.lines[index]!;
    if (!AKNO_ITEM.test(raw)) continue;
    const markerLine = page.bodyLine + index;
    if (page.sourceFenceLine !== null && markerLine >= page.sourceFenceLine) continue;
    const rawId = aknoItemId(raw);
    if (rawId) memoryIdCounts.set(rawId, (memoryIdCounts.get(rawId) ?? 0) + 1);
  }
  let indexed = 0;
  let relations = 0;
  let issues = 0;

  for (let index = 0; index < page.lines.length; index++) {
    const raw = page.lines[index]!;
    if (!AKNO_ITEM.test(raw)) continue;
    const markerLine = page.bodyLine + index;
    if (page.sourceFenceLine !== null && markerLine >= page.sourceFenceLine) continue;
    const rawId = aknoItemId(raw);
    if (rawId && (memoryIdCounts.get(rawId) ?? 0) > 1) {
      insertIssue.run(pageId, markerLine, rawId, 'duplicate managed-memory id on page');
      issues++;
      continue;
    }
    const marker = parseManagedMemoryMarker(raw);
    if (!marker) {
      insertIssue.run(pageId, markerLine, rawId, 'invalid managed-memory marker');
      issues++;
      continue;
    }
    const payload = page.lines[index + 1]?.trim() ?? '';
    if (
      !payload ||
      /^\s*(?:<!--|#{1,6}\s)/.test(payload) ||
      managedMemoryPayloadIssue(marker, payload) !== null ||
      (page.sourceFenceLine !== null && markerLine + 1 >= page.sourceFenceLine)
    ) {
      insertIssue.run(pageId, markerLine, marker.id, 'missing or invalid managed-memory payload');
      issues++;
      continue;
    }
    const entryKey = `${pageId}:${marker.id}`;
    insertEntry.run(
      entryKey,
      marker.id,
      pageId,
      page.slug,
      markerLine,
      markerLine + 1,
      payload,
      sha256(raw.trim()),
      sha256(payload),
      marker.kind,
      marker.subject,
      marker.sourceRole,
      marker.speaker ?? null,
      JSON.stringify(marker.reporters),
      marker.commitment,
      marker.disposition,
      marker.polarity,
      marker.basis,
      JSON.stringify(marker.evidence),
      managedMemoryAnswerEligible(marker) ? 1 : 0,
      marker.time?.status ?? null,
      marker.time?.relation ?? null,
    );
    marker.links.forEach((link, ordinal) => {
      const [targetKind, targetId] = link.target.split(':', 2) as ['memory' | 'fact', string];
      insertRelation.run(entryKey, ordinal, link.type, targetKind, targetId, link.support);
      relations++;
    });
    indexed++;
  }

  return { indexed, relations, issues };
}

/**
 * Partition chunks before search. Managed blocks are isolated by the chunker; ordinary authored
 * chunks and documents stay eligible in every view. A malformed or duplicate item is contextual
 * only, which keeps factual absence inconclusive without allowing unknown semantics into answers.
 */
export function managedMemoryProjectionForView(store: Store, view: MemoryView): ManagedMemoryProjectionState {
  const rows = store.db
    .prepare(
      `SELECT m.entry_key, m.memory_id, m.source_page, m.marker_line, m.payload_line, m.kind,
              m.commitment, m.disposition, m.basis, m.answer_eligible, m.temporal_status,
              m.temporal_relation, c.id AS chunk_id
         FROM managed_memory_entries m
         LEFT JOIN chunks c
           ON c.page_id = m.source_page AND c.document_id IS NULL
          AND m.payload_line BETWEEN c.line_start AND c.line_end`,
    )
    .all() as (ProjectedMemoryRow & { chunk_id: number | null })[];
  const duplicateIds = new Set(
    (
      store.db
        .prepare(
          `SELECT memory_id FROM managed_memory_entries
            GROUP BY memory_id HAVING count(*) > 1`,
        )
        .all() as { memory_id: string }[]
    ).map((row) => row.memory_id),
  );
  const issueChunks = new Set(
    (
      store.db
        .prepare(
          `SELECT DISTINCT c.id
             FROM managed_memory_projection_issues i
             JOIN chunks c
               ON c.page_id = i.source_page AND c.document_id IS NULL
              AND i.marker_line BETWEEN c.line_start AND c.line_end`,
        )
        .all() as { id: number }[]
    ).map((row) => row.id),
  );
  const issueCount = (
    store.db.prepare('SELECT count(*) AS count FROM managed_memory_projection_issues').get() as {
      count: number;
    }
  ).count;
  const allChunks = (store.db.prepare('SELECT id FROM chunks').all() as { id: number }[]).map(
    (row) => row.id,
  );
  const memoryChunks = new Map<number, ProjectedMemoryRow[]>();
  for (const row of rows) {
    if (row.chunk_id === null) continue;
    const bucket = memoryChunks.get(row.chunk_id);
    if (bucket) bucket.push(row);
    else memoryChunks.set(row.chunk_id, [row]);
  }

  const eligibleChunkIds = new Set<number>();
  const contextualChunkIds = new Set<number>();
  for (const chunkId of allChunks) {
    if (issueChunks.has(chunkId)) {
      contextualChunkIds.add(chunkId);
      continue;
    }
    const memories = memoryChunks.get(chunkId);
    if (!memories) {
      eligibleChunkIds.add(chunkId);
      continue;
    }
    const eligible = memories.some(
      (memory) =>
        !duplicateIds.has(memory.memory_id) &&
        memoryEligibleForView(
          {
            kind: memory.kind,
            commitment: memory.commitment,
            disposition: memory.disposition,
            basis: memory.basis,
            answerEligible: memory.answer_eligible === 1,
            temporalStatus: memory.temporal_status,
            temporalRelation: memory.temporal_relation,
          },
          view,
        ),
    );
    if (eligible) eligibleChunkIds.add(chunkId);
    else contextualChunkIds.add(chunkId);
  }

  return {
    eligibleChunkIds,
    contextualChunkIds,
    degraded:
      store.meta('managed_memory_projection_version') !== MANAGED_MEMORY_PROJECTION_VERSION ||
      issueCount > 0 ||
      duplicateIds.size > 0 ||
      rows.some((row) => row.chunk_id === null),
  };
}
