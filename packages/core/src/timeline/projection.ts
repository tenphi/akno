import type { PageRole } from '@tenphi/akno-protocol';
import type { ParsedPage } from '../kb/page.ts';
import { AKNO_ITEM, aknoItemId } from '../kb/page.ts';
import type { Store } from '../store/db.ts';
import {
  managedMemoryAnswerEligible,
  managedMemoryFactEligible,
  managedMemoryPayloadIssue,
  parseManagedMemoryMarker,
} from '../write/managed-memory.ts';

export const TEMPORAL_PROJECTION_VERSION = 'temporal-v1';

export interface TemporalProjectionReport {
  indexed: number;
  issues: number;
}

/** Replace only the page-owned, rebuildable temporal projection. Markdown remains authoritative. */
export function replaceTemporalEntries(
  store: Store,
  pageId: string,
  page: ParsedPage,
  role: PageRole,
): TemporalProjectionReport {
  store.db.prepare('DELETE FROM temporal_entries WHERE source_page = ?').run(pageId);
  store.db.prepare('DELETE FROM temporal_projection_issues WHERE source_page = ?').run(pageId);
  if (role !== 'knowledge') return { indexed: 0, issues: 0 };

  const insert = store.db.prepare(
    `INSERT INTO temporal_entries(
       entry_key, memory_id, source_page, source_slug, line, summary, kind, subject,
       relation, temporal_status, disposition, precision, start, until, timezone,
       mentioned_at, recurrence, evidence, answer_eligible
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertIssue = store.db.prepare(
    `INSERT OR REPLACE INTO temporal_projection_issues(source_page, line, reason)
     VALUES(?, ?, ?)`,
  );
  const deleteUnsafeFact = store.db.prepare('DELETE FROM facts WHERE page_id = ? AND item_id = ?');
  const seen = new Set<string>();
  let indexed = 0;
  let issues = 0;

  for (let index = 0; index < page.lines.length; index++) {
    const raw = page.lines[index]!;
    const absoluteLine = page.bodyLine + index;
    if (page.sourceFenceLine !== null && absoluteLine >= page.sourceFenceLine) break;
    const markerId = aknoItemId(raw);
    if (!markerId) {
      if (AKNO_ITEM.test(raw) && looksTemporal(raw)) {
        insertIssue.run(pageId, absoluteLine, 'invalid_temporal_marker');
        issues++;
      }
      continue;
    }
    const marker = parseManagedMemoryMarker(raw);
    if (!marker) {
      deleteUnsafeFact.run(pageId, markerId);
      if (looksTemporal(raw)) {
        insertIssue.run(pageId, absoluteLine, 'invalid_temporal_marker');
        issues++;
      }
      continue;
    }
    if (!managedMemoryFactEligible(marker)) {
      // Older derivation rules could turn a scheduled item or clock-scoped state
      // into an unscoped graph fact. The marker is authoritative, so an index
      // upgrade removes that unsafe derived row without rewriting Markdown or
      // waiting for another model call.
      deleteUnsafeFact.run(pageId, marker.id);
    }
    if (!marker.time) continue;
    const payload = page.lines[index + 1];
    const payloadLine = absoluteLine + 1;
    if (
      payload === undefined ||
      payload.trim().length === 0 ||
      /^\s*(?:<!--|#{1,6}\s)/.test(payload) ||
      (page.sourceFenceLine !== null && payloadLine >= page.sourceFenceLine) ||
      managedMemoryPayloadIssue(marker, payload.trim()) !== null
    ) {
      insertIssue.run(pageId, absoluteLine, 'missing_temporal_payload');
      issues++;
      continue;
    }
    if (seen.has(marker.id)) {
      insertIssue.run(pageId, absoluteLine, 'invalid_temporal_marker');
      issues++;
      continue;
    }
    seen.add(marker.id);
    insert.run(
      `${pageId}:${marker.id}`,
      marker.id,
      pageId,
      page.slug,
      payloadLine,
      payload.trim().replace(/^[-*]\s+/, ''),
      marker.kind,
      marker.subject,
      marker.time.relation,
      marker.time.status,
      marker.disposition,
      marker.time.precision,
      marker.time.start ?? null,
      marker.time.until ?? null,
      marker.time.timezone ?? null,
      marker.time.mentioned_at ?? null,
      marker.time.recurrence ? JSON.stringify(marker.time.recurrence) : null,
      JSON.stringify(marker.evidence),
      managedMemoryAnswerEligible(marker) ? 1 : 0,
    );
    indexed++;
  }

  return { indexed, issues };
}

function looksTemporal(line: string): boolean {
  return /\b(?:relation|temporal|precision|start|until|timezone|mentioned|recurrence)=/.test(line);
}
