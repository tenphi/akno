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
}

export interface ManagedItemPlanResult {
  drafts: ManagedItemDraft[];
  report: ManagedItemReport;
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
  const remove = new Set<number>();
  const replacements = new Map<number, string>();
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
    if (marker.namespace === 'engram') {
      findings.push({ code: 'legacy_marker', line, outcome: 'planned' });
      repairs.push({ code: 'legacy_marker', line });
      replacements.set(
        marker.markerIndex,
        lines[marker.markerIndex]!.replace(/(<!--\s*)engram:item/i, '$1akno:item'),
      );
    } else {
      findings.push({ code: 'valid', line, outcome: 'valid' });
    }
  }

  const after =
    prefix +
    lines.flatMap((line, index) => (remove.has(index) ? [] : [replacements.get(index) ?? line])).join('\n');
  return { after, inspectedMarkers, findings, repairs };
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

export async function planManagedItems(ctx: AknoContext): Promise<ManagedItemPlanResult> {
  const report = emptyReport();
  const drafts: ManagedItemDraft[] = [];
  const pages = ctx.store.db
    .prepare('SELECT slug, rel_path, role, remember_management FROM pages ORDER BY rel_path')
    .all() as { slug: string; rel_path: string; role: string; remember_management: string }[];

  for (const row of pages) {
    if (isReserved(row.slug, ctx.config)) continue;
    const absolute = safeIndexedPath(ctx.config.aknoPath, row.rel_path);
    if (!absolute) continue;
    const before = await fsp.readFile(absolute, 'utf8').catch(() => null);
    if (before === null) {
      if (row.role === 'knowledge' && row.remember_management === 'integrate') {
        report.eligiblePages += 1;
        addFinding(report, { code: 'source_unavailable', line: 0, outcome: 'held' });
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
    if (inspection.after === before || inspection.repairs.length === 0) {
      for (const finding of inspection.findings) addFinding(report, finding);
      continue;
    }

    const inputHash = managedInputHash(before, inspection.after, inspection.repairs);
    if (handledManagedInput(ctx, inputHash)) {
      report.suppressedPages += 1;
      for (const finding of inspection.findings) {
        addFinding(report, finding, finding.outcome === 'planned' ? 'suppressed' : finding.outcome);
      }
      continue;
    }
    for (const finding of inspection.findings) addFinding(report, finding);
    drafts.push({
      slug: page.slug,
      relPath: row.rel_path,
      inputHash,
      before,
      after: inspection.after,
      repairs: inspection.repairs,
    });
  }
  report.plannedPages = drafts.length;
  return { drafts, report };
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
  };
}

function addFinding(
  report: ManagedItemReport,
  finding: ManagedItemFinding,
  outcome: keyof ManagedItemReport['outcomes'] = finding.outcome,
): void {
  report.findings[finding.code] += 1;
  report.outcomes[outcome] += 1;
}
