import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { parseFrontmatter } from '../kb/frontmatter.ts';
import { parsePage, resolvePagePolicy } from '../kb/page.ts';
import { isReserved } from '../reserved.ts';
import { effectiveRule } from '../rules/compile.ts';
import { sha256 } from '../store/ids.ts';

export const MANAGED_ITEM_FINDING_CODES = [
  'empty_marker',
  'malformed_marker',
  'legacy_marker',
  'duplicate_item',
  'misplaced_item',
  'source_unavailable',
  'item_conflict',
  'valid',
] as const;

export type ManagedItemFindingCode = (typeof MANAGED_ITEM_FINDING_CODES)[number];

export interface ManagedItemFinding {
  code: ManagedItemFindingCode;
  line: number;
  outcome: 'planned' | 'held' | 'valid';
}

export interface ManagedItemDraft {
  slug: string;
  relPath: string;
  inputHash: string;
  before: string;
  after: string;
  repairs: { code: ManagedItemFindingCode; line: number }[];
}

export interface ManagedItemReport {
  eligiblePages: number;
  inspectedMarkers: number;
  plannedPages: number;
  suppressedPages: number;
  findings: Record<ManagedItemFindingCode, number>;
  outcomes: { planned: number; held: number; valid: number; suppressed: number };
  /** Private live-run references; safe JSON and durable run receipts intentionally omit these. */
  details: ManagedItemFindingReference[];
}

export interface ManagedItemFindingReference {
  slug: string;
  code: ManagedItemFindingCode;
  line: number;
  outcome: ManagedItemFinding['outcome'] | 'suppressed';
}

export interface ManagedItemPlanResult {
  drafts: ManagedItemDraft[];
  report: ManagedItemReport;
}

export interface ManagedItemPlanOptions {
  /** `slug\0line` keys from the ordinary typed conflict pipeline. */
  conflictClaims?: ReadonlySet<string>;
}

interface StrictMarker {
  namespace: 'akno' | 'engram';
  id: string;
  source: string;
  origin: 'user' | 'assistant' | 'unknown';
}

interface ParsedMarker extends StrictMarker {
  markerIndex: number;
  payloadIndex: number | null;
  payload: string | null;
}

export interface ManagedItemInspection {
  after: string;
  inspectedMarkers: number;
  findings: ManagedItemFinding[];
  repairs: { code: ManagedItemFindingCode; line: number }[];
  /** Exact private bindings used only for deterministic index and conflict checks. */
  bindings: ManagedItemBinding[];
}

interface ManagedItemBinding {
  id: string;
  namespace: StrictMarker['namespace'];
  markerLine: number;
  payloadLine: number;
  payload: string;
}

const STRICT_MARKER =
  /^\s*<!--\s*(akno|engram):item\s+([A-Za-z0-9_-]{4,80})\s+source=([^\s]+)\s+origin=(user|assistant|unknown)\s*-->\s*$/i;
const MARKER_LIKE = /<!--\s*(?:akno|engram):item\b/i;
const HEADING = /^\s{0,3}#{1,6}(?:\s+|$)/;
const HTML_COMMENT = /^\s*<!--/;

/**
 * Inspect only the bytes Akno explicitly owns. One strict marker owns the next nonblank body line;
 * another marker, a heading, a comment boundary, or EOF ends the item before any authored prose is claimed.
 */
export function inspectManagedItems(content: string): ManagedItemInspection {
  const frontmatter = parseFrontmatter(content);
  const prefix = content.slice(0, frontmatter.bodyOffset);
  const lines = content.slice(frontmatter.bodyOffset).split('\n');
  const parsed: ParsedMarker[] = [];
  const findings: ManagedItemFinding[] = [];
  const repairs: { code: ManagedItemFindingCode; line: number }[] = [];
  const bindings: ManagedItemBinding[] = [];
  const remove = new Set<number>();
  const replacements = new Map<number, string>();
  const placementIssues = managedPlacementIssues(lines);
  let inspectedMarkers = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!MARKER_LIKE.test(line)) continue;
    inspectedMarkers += 1;
    const marker = strictMarker(line);
    if (!marker) {
      findings.push({
        code: 'malformed_marker',
        line: frontmatter.bodyLine + index,
        outcome: 'held',
      });
      continue;
    }
    const payloadIndex = managedPayloadIndex(lines, index);
    parsed.push({
      ...marker,
      markerIndex: index,
      payloadIndex,
      payload: payloadIndex === null ? null : lines[payloadIndex]!,
    });
  }

  const byId = new Map<string, ParsedMarker>();
  const byContent = new Map<string, ParsedMarker>();
  for (const marker of parsed) {
    const line = frontmatter.bodyLine + marker.markerIndex;
    if (marker.payloadIndex === null || marker.payload === null) {
      findings.push({ code: 'empty_marker', line, outcome: 'planned' });
      repairs.push({ code: 'empty_marker', line });
      remove.add(marker.markerIndex);
      continue;
    }

    const key = `${marker.source}\0${marker.origin}\0${marker.payload}`;
    const matchingId = byId.get(marker.id);
    if (matchingId && managedContentKey(matchingId) !== key) {
      findings.push({ code: 'item_conflict', line, outcome: 'held' });
      bindings.push(managedBinding(marker, frontmatter.bodyLine));
      continue;
    }
    const matchingContent = byContent.get(key);
    if (matchingContent) {
      findings.push({ code: 'duplicate_item', line, outcome: 'planned' });
      repairs.push({ code: 'duplicate_item', line });
      for (let owned = marker.markerIndex; owned <= marker.payloadIndex; owned++) remove.add(owned);
      continue;
    }

    byId.set(marker.id, marker);
    byContent.set(key, marker);
    bindings.push(managedBinding(marker, frontmatter.bodyLine));
    const misplaced = placementIssues.has(marker.markerIndex);
    if (misplaced) findings.push({ code: 'misplaced_item', line, outcome: 'held' });
    if (marker.namespace === 'engram') {
      findings.push({ code: 'legacy_marker', line, outcome: 'planned' });
      repairs.push({ code: 'legacy_marker', line });
      replacements.set(
        marker.markerIndex,
        lines[marker.markerIndex]!.replace(/(<!--\s*)engram:item/i, '$1akno:item'),
      );
    } else if (!misplaced) {
      findings.push({ code: 'valid', line, outcome: 'valid' });
    }
  }

  const after =
    prefix +
    lines.flatMap((line, index) => (remove.has(index) ? [] : [replacements.get(index) ?? line])).join('\n');
  return { after, inspectedMarkers, findings, repairs, bindings };
}

/** The sealed replacement must be exactly the repair this version's deterministic inspector derives. */
export function managedItemRepairIssue(before: string, after: string): string | null {
  const inspection = inspectManagedItems(before);
  if (inspection.repairs.length === 0 || inspection.after === before) {
    return 'the managed-item input contains no deterministic repair';
  }
  if (inspection.after !== after) {
    return 'the managed-item output is broader than its deterministic owned-fragment repair';
  }
  return null;
}

export async function planManagedItems(
  ctx: AknoContext,
  options: ManagedItemPlanOptions = {},
): Promise<ManagedItemPlanResult> {
  const report = emptyReport();
  const drafts: ManagedItemDraft[] = [];
  const pages = ctx.store.db
    .prepare(
      `SELECT id, slug, rel_path, role, remember_management, body_hash, derived_hash
         FROM pages ORDER BY rel_path`,
    )
    .all() as ManagedPageRow[];
  const eligible: EligibleManagedPage[] = [];

  for (const row of pages) {
    if (isReserved(row.slug, ctx.config)) continue;
    const absolute = safeIndexedPath(ctx.config.aknoPath, row.rel_path);
    if (!absolute) continue;
    const before = await fsp.readFile(absolute, 'utf8').catch(() => null);
    if (before === null) {
      if (row.role === 'knowledge' && row.remember_management === 'integrate') {
        report.eligiblePages += 1;
        addFinding(report, { code: 'source_unavailable', line: 0, outcome: 'held' }, 'held', row.slug);
      }
      continue;
    }
    let page: ReturnType<typeof parsePage>;
    try {
      page = parsePage(row.rel_path, before);
    } catch {
      continue;
    }
    const policy = resolvePagePolicy(
      page,
      effectiveRule(page.slug, ctx.config.rules),
      ctx.config.paths.observations,
    );
    if (policy.role !== 'knowledge' || policy.remember !== 'integrate') continue;
    report.eligiblePages += 1;
    const inspection = inspectManagedItems(before);
    report.inspectedMarkers += inspection.inspectedMarkers;
    eligible.push({ row, before, page, inspection });
  }

  const crossPageCollisions = crossPageItemCollisions(eligible);
  const facts = currentManagedFacts(ctx);
  for (const candidate of eligible) {
    const inspection = withBindingFindings(ctx, candidate, facts, crossPageCollisions, options);
    if (inspection.after === candidate.before || inspection.repairs.length === 0) {
      for (const finding of inspection.findings) {
        addFinding(report, finding, finding.outcome, candidate.page.slug);
      }
      continue;
    }

    const inputHash = managedInputHash(candidate.before, inspection.after, inspection.repairs);
    if (handledManagedInput(ctx, inputHash)) {
      report.suppressedPages += 1;
      for (const finding of inspection.findings) {
        addFinding(
          report,
          finding,
          finding.outcome === 'planned' ? 'suppressed' : finding.outcome,
          candidate.page.slug,
        );
      }
      continue;
    }
    for (const finding of inspection.findings) {
      addFinding(report, finding, finding.outcome, candidate.page.slug);
    }
    drafts.push({
      slug: candidate.page.slug,
      relPath: candidate.row.rel_path,
      inputHash,
      before: candidate.before,
      after: inspection.after,
      repairs: inspection.repairs,
    });
  }
  report.plannedPages = drafts.length;
  return { drafts, report };
}

interface ManagedPageRow {
  id: string;
  slug: string;
  rel_path: string;
  role: string;
  remember_management: string;
  body_hash: string;
  derived_hash: string | null;
}

interface EligibleManagedPage {
  row: ManagedPageRow;
  before: string;
  page: ReturnType<typeof parsePage>;
  inspection: ManagedItemInspection;
}

interface ManagedFactRow {
  item_id: string;
  page_id: string;
  line_start: number;
  source_line_hash: string;
}

function currentManagedFacts(ctx: AknoContext): Map<string, ManagedFactRow> {
  const rows = ctx.store.db
    .prepare(
      `SELECT item_id, page_id, line_start, source_line_hash
         FROM facts WHERE item_id IS NOT NULL AND valid_to IS NULL`,
    )
    .all() as ManagedFactRow[];
  return new Map(rows.map((row) => [row.item_id, row]));
}

function crossPageItemCollisions(pages: EligibleManagedPage[]): Set<string> {
  const occurrences = new Map<string, { relPath: string; markerLine: number }[]>();
  for (const page of pages) {
    for (const binding of page.inspection.bindings) {
      const current = occurrences.get(binding.id) ?? [];
      current.push({ relPath: page.row.rel_path, markerLine: binding.markerLine });
      occurrences.set(binding.id, current);
    }
  }
  const collisions = new Set<string>();
  for (const entries of occurrences.values()) {
    if (new Set(entries.map((entry) => entry.relPath)).size < 2) continue;
    for (const entry of entries) collisions.add(`${entry.relPath}\0${entry.markerLine}`);
  }
  return collisions;
}

function withBindingFindings(
  ctx: AknoContext,
  candidate: EligibleManagedPage,
  facts: Map<string, ManagedFactRow>,
  collisions: ReadonlySet<string>,
  options: ManagedItemPlanOptions,
): ManagedItemInspection {
  const extra = new Map<number, Extract<ManagedItemFindingCode, 'item_conflict' | 'source_unavailable'>>();
  for (const binding of candidate.inspection.bindings) {
    const collisionKey = `${candidate.row.rel_path}\0${binding.markerLine}`;
    const conflictKey = `${candidate.page.slug}\0${binding.payloadLine}`;
    if (collisions.has(collisionKey) || options.conflictClaims?.has(conflictKey)) {
      extra.set(binding.markerLine, 'item_conflict');
      continue;
    }
    // The legacy namespace is intentionally normalized first. Its fact binding becomes checkable
    // after apply re-indexes and derives the canonical marker.
    if (binding.namespace === 'engram') continue;
    if (!ctx.config.index.facts || candidate.row.derived_hash !== candidate.row.body_hash) {
      extra.set(binding.markerLine, 'source_unavailable');
      continue;
    }
    const fact = facts.get(binding.id);
    if (!fact) {
      extra.set(binding.markerLine, 'source_unavailable');
      continue;
    }
    if (
      fact.page_id !== candidate.row.id ||
      fact.line_start !== binding.payloadLine ||
      fact.source_line_hash !== sha256(binding.payload.trim())
    ) {
      extra.set(binding.markerLine, 'item_conflict');
    }
  }

  if (extra.size === 0) return candidate.inspection;
  const findings = candidate.inspection.findings.filter(
    (finding) => finding.code !== 'valid' || !extra.has(finding.line),
  );
  for (const [line, code] of extra) {
    if (!findings.some((finding) => finding.line === line && finding.code === code)) {
      findings.push({ code, line, outcome: 'held' });
    }
  }
  return { ...candidate.inspection, findings };
}

function strictMarker(line: string): StrictMarker | null {
  const match = STRICT_MARKER.exec(line);
  if (!match) return null;
  let source: string;
  try {
    source = decodeURIComponent(match[3]!);
  } catch {
    return null;
  }
  if (!source || source.includes('\0')) return null;
  return {
    namespace: match[1]!.toLowerCase() as StrictMarker['namespace'],
    id: match[2]!,
    source,
    origin: match[4]!.toLowerCase() as StrictMarker['origin'],
  };
}

function managedPayloadIndex(lines: string[], markerIndex: number): number | null {
  for (let index = markerIndex + 1; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.trim()) continue;
    if (MARKER_LIKE.test(line) || HEADING.test(line) || HTML_COMMENT.test(line)) return null;
    return index;
  }
  return null;
}

function managedContentKey(marker: ParsedMarker): string | null {
  return marker.payload === null ? null : `${marker.source}\0${marker.origin}\0${marker.payload}`;
}

function managedBinding(marker: ParsedMarker, bodyLine: number): ManagedItemBinding {
  return {
    id: marker.id,
    namespace: marker.namespace,
    markerLine: bodyLine + marker.markerIndex,
    payloadLine: bodyLine + marker.payloadIndex!,
    payload: marker.payload!,
  };
}

/** A model may judge semantic fit later; these are only the structurally provable placement failures. */
function managedPlacementIssues(lines: string[]): Set<number> {
  const headingAt = new Map<number, string | null>();
  const headingCounts = new Map<string, number>();
  let current: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const heading = /^\s{0,3}(#{1,2})(?:\s+(.+?)\s*|\s*)$/.exec(lines[index]!);
    if (heading?.[1] === '#') current = null;
    if (heading?.[1] === '##') {
      current = heading[2]?.trim() ?? '';
      const key = current.normalize('NFKC').toLowerCase();
      headingCounts.set(key, (headingCounts.get(key) ?? 0) + 1);
    }
    headingAt.set(index, current);
  }
  const issues = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    if (!MARKER_LIKE.test(lines[index]!)) continue;
    const heading = headingAt.get(index) ?? null;
    const key = heading?.normalize('NFKC').toLowerCase() ?? '';
    if (!heading || key === 'unsorted' || (headingCounts.get(key) ?? 0) !== 1) issues.add(index);
  }
  return issues;
}

function managedInputHash(
  before: string,
  after: string,
  repairs: { code: ManagedItemFindingCode; line: number }[],
): string {
  return sha256(
    JSON.stringify({ kind: 'managed_item', before: sha256(before), after: sha256(after), repairs }),
  );
}

function handledManagedInput(ctx: AknoContext, inputHash: string): boolean {
  try {
    return Boolean(
      ctx.store.db
        .prepare(
          "SELECT 1 FROM maintenance_items WHERE kind = 'managed_item' AND input_hash = ? AND status = 'rejected' LIMIT 1",
        )
        .get(inputHash),
    );
  } catch {
    return false;
  }
}

function safeIndexedPath(root: string, relPath: string): string | null {
  const absolute = path.resolve(root, relPath);
  const relative = path.relative(path.resolve(root), absolute);
  return !relative ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
    ? absolute
    : null;
}

function emptyReport(): ManagedItemReport {
  return {
    eligiblePages: 0,
    inspectedMarkers: 0,
    plannedPages: 0,
    suppressedPages: 0,
    findings: Object.fromEntries(MANAGED_ITEM_FINDING_CODES.map((code) => [code, 0])) as Record<
      ManagedItemFindingCode,
      number
    >,
    outcomes: { planned: 0, held: 0, valid: 0, suppressed: 0 },
    details: [],
  };
}

function addFinding(
  report: ManagedItemReport,
  finding: ManagedItemFinding,
  outcome: keyof ManagedItemReport['outcomes'] = finding.outcome,
  slug?: string,
): void {
  report.findings[finding.code] += 1;
  report.outcomes[outcome] += 1;
  if (slug) report.details.push({ slug, line: finding.line, code: finding.code, outcome });
}
