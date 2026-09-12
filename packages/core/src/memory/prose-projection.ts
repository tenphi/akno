import type { MemoryView } from '@tenphi/akno-protocol';
import type { ParsedPage } from '../kb/page.ts';
import { hasNonfactualProse, proseQualifications } from '../kb/prose.ts';
import type { Store } from '../store/db.ts';

export function replaceProseEntries(store: Store, pageId: string, page: ParsedPage): void {
  store.db.prepare('DELETE FROM prose_entries WHERE source_page = ?').run(pageId);
  const insert = store.db.prepare(
    'INSERT INTO prose_entries(source_page, line, view, eligible, source_hash) VALUES (?, ?, ?, ?, ?)',
  );
  const lines = page.content.split('\n');
  for (const [n, q] of proseQualifications(lines)) {
    if (q.reason === 'heading' || q.reason === 'comment' || /^\s*(?:`{3,}|~{3,})/.test(lines[n - 1]!))
      continue;
    insert.run(pageId, n, q.view, q.status === 'qualified' ? 1 : 0, q.source_hash);
  }
  if (hasNonfactualProse(page.content))
    store.db.prepare('UPDATE pages SET summary = NULL WHERE id = ?').run(pageId);
  store.db
    .prepare(
      `DELETE FROM events WHERE source_page = ? AND EXISTS (
    SELECT 1 FROM prose_entries p WHERE p.source_page = events.source_page
      AND p.line = events.line AND (p.view != 'factual' OR p.eligible = 0))`,
    )
    .run(pageId);
  // Existing facts can survive a structural pass while model derivation is deferred.
  // Drop only disqualified derived facts now so they cannot feed inference in that interval.
  store.db
    .prepare(
      `DELETE FROM facts WHERE page_id = ? AND EXISTS (
    SELECT 1 FROM prose_entries p WHERE p.source_page = facts.page_id
      AND p.line = facts.line_start AND (p.view != 'factual' OR p.eligible = 0))`,
    )
    .run(pageId);
}

export function proseChunkViews(store: Store, view: MemoryView): Map<number, boolean> {
  const rows = store.db
    .prepare(
      `SELECT c.id, max(CASE WHEN p.eligible = 1 AND (p.view = 'factual' OR p.view = ? OR ? = 'all') THEN 1 ELSE 0 END) AS eligible
    FROM chunks c JOIN prose_entries p ON p.source_page = c.page_id AND p.line BETWEEN c.line_start AND c.line_end
    WHERE c.document_id IS NULL GROUP BY c.id`,
    )
    .all(view, view) as { id: number; eligible: number }[];
  return new Map(rows.map((row) => [row.id, row.eligible === 1]));
}
