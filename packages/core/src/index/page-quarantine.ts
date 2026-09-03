import type { Store } from '../store/db.ts';
import { matchesGlob } from '../rules/compile.ts';

export const PAGE_SOURCE_INTEGRITY_VERSION = 'page-source-integrity-v1';

const PAGE_CONFLICT_REASONS = [
  'inline_merge_conflict',
  'sync_conflict_path',
  'duplicate_page_id_same_bytes',
  'duplicate_page_id_different_bytes',
] as const;
export type PageConflictReason = (typeof PAGE_CONFLICT_REASONS)[number];

export interface PageSourceIntegrityRow {
  rel_path: string;
  sha256: string;
  declared_page_id: string | null;
  known_page_id: string | null;
  inline_conflict: number;
  identity_complete: number;
  indexable: number;
  quarantine_reasons: string;
  checked_at: string;
}

export interface PageQuarantineSummary {
  candidates: number;
  byReason: Record<PageConflictReason, number>;
}

export interface PageQuarantineDetail {
  relPath: string;
  reasons: PageConflictReason[];
  stablePageId?: string;
}

/** Paths and patterns compare the same way on macOS and Linux. */
export function normalizeConflictPath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .normalize('NFC')
    .toLowerCase();
}

export function matchesConflictPath(relPath: string, patterns: readonly string[]): boolean {
  const normalized = normalizeConflictPath(relPath);
  return patterns.some((pattern) => matchesGlob(normalized, normalizeConflictPath(pattern)));
}

/**
 * Detect a complete merge block outside a properly closed Markdown fence. An isolated marker is
 * prose; an unclosed fence is malformed Markdown, so its bytes receive the conservative treatment.
 */
export function hasInlineMergeConflict(content: string): boolean {
  const lines = content.split(/\r?\n/);
  const fenced = closedFenceLines(lines);
  let state: 'outside' | 'left' | 'right' = 'outside';

  for (let index = 0; index < lines.length; index++) {
    if (fenced.has(index)) continue;
    const line = lines[index]!;
    if (state === 'outside') {
      if (/^<{7}(?:\s.*)?$/.test(line)) state = 'left';
    } else if (state === 'left') {
      if (/^={7}\s*$/.test(line)) state = 'right';
      else if (/^>{7}(?:\s.*)?$/.test(line)) state = 'outside';
    } else if (/^>{7}(?:\s.*)?$/.test(line)) {
      return true;
    } else if (/^<{7}(?:\s.*)?$/.test(line)) {
      state = 'left';
    }
  }
  return false;
}

function closedFenceLines(lines: readonly string[]): Set<number> {
  const closed = new Set<number>();
  let opening: { start: number; marker: '`' | '~'; width: number } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!opening) {
      const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (!match) continue;
      const token = match[1]!;
      opening = { start: index, marker: token[0] as '`' | '~', width: token.length };
      continue;
    }
    const escaped = opening.marker === '`' ? '`' : '~';
    const close = new RegExp(`^ {0,3}${escaped}{${opening.width},}\\s*$`);
    if (!close.test(line)) continue;
    for (let fencedLine = opening.start; fencedLine <= index; fencedLine++) closed.add(fencedLine);
    opening = null;
  }
  return closed;
}

function parseQuarantineReasons(value: string): PageConflictReason[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return PAGE_CONFLICT_REASONS.filter((reason) => parsed.includes(reason));
  } catch {
    return [];
  }
}

export function quarantineReasonsForPath(store: Store, relPath: string): PageConflictReason[] {
  if (!pageSourceIntegrityAvailable(store)) return [];
  const row = store.db
    .prepare('SELECT quarantine_reasons FROM page_source_integrity WHERE rel_path = ?')
    .get(relPath) as { quarantine_reasons: string } | undefined;
  return row ? parseQuarantineReasons(row.quarantine_reasons) : [];
}

export function quarantineReasonsForSlug(
  store: Store,
  slug: string,
  pageExtensions: readonly string[],
): PageConflictReason[] {
  if (!pageSourceIntegrityAvailable(store)) return [];
  const candidates = new Set(pageExtensions.map((extension) => normalizeConflictPath(`${slug}${extension}`)));
  const rows = store.db
    .prepare(
      "SELECT rel_path, quarantine_reasons FROM page_source_integrity WHERE quarantine_reasons != '[]'",
    )
    .all() as Pick<PageSourceIntegrityRow, 'rel_path' | 'quarantine_reasons'>[];
  return distinctReasons(
    rows
      .filter((row) => candidates.has(normalizeConflictPath(row.rel_path)))
      .flatMap((row) => parseQuarantineReasons(row.quarantine_reasons)),
  );
}

export function quarantineReasonsForStablePageId(store: Store, pageId: string): PageConflictReason[] {
  if (!pageSourceIntegrityAvailable(store)) return [];
  const rows = store.db
    .prepare(
      `SELECT quarantine_reasons FROM page_source_integrity
        WHERE quarantine_reasons != '[]' AND (declared_page_id = ? OR known_page_id = ?)`,
    )
    .all(pageId, pageId) as Pick<PageSourceIntegrityRow, 'quarantine_reasons'>[];
  return distinctReasons(rows.flatMap((row) => parseQuarantineReasons(row.quarantine_reasons)));
}

export function quarantineSummary(store: Store): PageQuarantineSummary {
  if (!pageSourceIntegrityAvailable(store)) return emptyPageQuarantineSummary();
  const rows = store.db
    .prepare("SELECT quarantine_reasons FROM page_source_integrity WHERE quarantine_reasons != '[]'")
    .all() as { quarantine_reasons: string }[];
  const byReason = emptyPageQuarantineSummary().byReason;
  for (const row of rows) {
    for (const reason of parseQuarantineReasons(row.quarantine_reasons)) byReason[reason]++;
  }
  return { candidates: rows.length, byReason };
}

export function quarantineDetails(store: Store): PageQuarantineDetail[] {
  if (!pageSourceIntegrityAvailable(store)) return [];
  const rows = store.db
    .prepare(
      `SELECT rel_path, declared_page_id, known_page_id, quarantine_reasons
         FROM page_source_integrity
        WHERE quarantine_reasons != '[]'
        ORDER BY rel_path`,
    )
    .all() as Pick<
    PageSourceIntegrityRow,
    'rel_path' | 'declared_page_id' | 'known_page_id' | 'quarantine_reasons'
  >[];
  return rows.map((row) => ({
    relPath: row.rel_path,
    reasons: parseQuarantineReasons(row.quarantine_reasons),
    ...(row.declared_page_id || row.known_page_id
      ? { stablePageId: row.declared_page_id ?? row.known_page_id ?? undefined }
      : {}),
  }));
}

export function emptyPageQuarantineSummary(): PageQuarantineSummary {
  return {
    candidates: 0,
    byReason: Object.fromEntries(PAGE_CONFLICT_REASONS.map((reason) => [reason, 0])) as Record<
      PageConflictReason,
      number
    >,
  };
}

function distinctReasons(reasons: readonly PageConflictReason[]): PageConflictReason[] {
  const present = new Set(reasons);
  return PAGE_CONFLICT_REASONS.filter((reason) => present.has(reason));
}

function pageSourceIntegrityAvailable(store: Store): boolean {
  return Boolean(
    store.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'page_source_integrity'")
      .get(),
  );
}
