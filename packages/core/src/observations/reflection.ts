import fs from 'node:fs';
import path from 'node:path';
import type { Line, ProseQualification } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';
import { parseFrontmatter } from '../kb/frontmatter.ts';
import { structuralOwnedMarkerIndexes, renderObservationMarker } from './marker.ts';
import { markerFromProjection, qualifyObservationLines } from './projection.ts';

export interface ReflectionSupport {
  observationId: string;
  markerHash: string;
  payloadHash: string;
}
export interface ReflectionMarker {
  id: string;
  payloadHash: string;
  scopeAssessment: string;
  evidence: ReflectionSupport[];
}
const HASH = /^[a-f0-9]{64}$/;
const ID = /^refl_[a-f0-9]{24}$/;
const OBSERVATION = /^obs_[A-Za-z0-9_-]{8,72}$/;
const CONCLUSION = /^- \d{4}-\d{2}-\d{2} — .+?(?:\s+\[\[[^\]]+\]\])+\s*$/;

export function reflectionId(evidence: ReflectionSupport[], payload: string): string {
  return `refl_${sha256(JSON.stringify({ evidence, payload })).slice(0, 24)}`;
}
export function renderReflectionMarker(marker: ReflectionMarker): string {
  if (!validMarker(marker)) throw new Error('invalid reflection lineage');
  return `<!-- akno:reflection ${marker.id} v=1 level=3 payload=${marker.payloadHash} scope=${marker.scopeAssessment} evidence=${marker.evidence.map((e) => `${e.observationId}@${e.markerHash}@${e.payloadHash}`).join(',')} -->`;
}
export function parseReflectionMarker(line: string): ReflectionMarker | null {
  const match =
    /^\s*<!-- akno:reflection (refl_[a-f0-9]{24}) v=1 level=3 payload=([a-f0-9]{64}) scope=([a-f0-9]{64}) evidence=(\S+) -->\s*$/.exec(
      line,
    );
  if (!match) return null;
  const evidence = match[4]!.split(',').map((value) => {
    const [observationId, markerHash, payloadHash, extra] = value.split('@');
    return {
      observationId: observationId ?? '',
      markerHash: markerHash ?? '',
      payloadHash: extra !== undefined ? '' : (payloadHash ?? ''),
    };
  });
  const marker = { id: match[1]!, payloadHash: match[2]!, scopeAssessment: match[3]!, evidence };
  return validMarker(marker) ? marker : null;
}
function validMarker(marker: ReflectionMarker): boolean {
  return (
    ID.test(marker.id) &&
    HASH.test(marker.payloadHash) &&
    HASH.test(marker.scopeAssessment) &&
    marker.evidence.length >= 3 &&
    marker.evidence.length <= 40 &&
    new Set(marker.evidence.map((e) => e.observationId)).size === marker.evidence.length &&
    marker.evidence.every(
      (e) => OBSERVATION.test(e.observationId) && HASH.test(e.markerHash) && HASH.test(e.payloadHash),
    )
  );
}

export function legacyReflectionLineIndexes(allLines: string[]): Set<number> {
  const frontmatter = parseFrontmatter(allLines.join('\n')).data;
  if (
    frontmatter.derived !== true ||
    frontmatter.title !== 'Principles' ||
    !allLines.some(
      (line) =>
        line.replace(/\r$/, '') ===
        'Patterns Akno inferred from pages listed as evidence. Not authored claims.',
    )
  )
    return new Set();
  return new Set(
    [
      ...structuralOwnedMarkerIndexes(
        allLines.map((line) => (CONCLUSION.test(line) ? '<!-- akno:reflection -->' : line)),
        'reflection',
        true,
      ),
    ].filter((index) => CONCLUSION.test(allLines[index]!)),
  );
}

/** Exact support is owned by each conclusion, never by the aggregate page evidence list. */
export function reflectionQualifications(
  store: Store,
  pageId: string,
  allLines: string[],
  aknoPath: string,
): Map<number, ProseQualification> {
  const result = new Map<number, ProseQualification>();
  const markers = structuralOwnedMarkerIndexes(allLines, 'reflection', true);
  const legacy = legacyReflectionLineIndexes(allLines);
  if (!markers.size && !legacy.size) return result;
  const frontmatter = parseFrontmatter(allLines.join('\n')).data;
  const page = store.db.prepare('SELECT role FROM pages WHERE id = ?').get(pageId) as
    { role: string } | undefined;
  const isDerived = page?.role === 'inference' && frontmatter.derived === true;
  const sourceHash = sha256(allLines.join('\n'));
  const identities = [...markers].flatMap((index) => {
    const marker = parseReflectionMarker(allLines[index]!);
    return marker ? [marker.id] : [];
  });
  const supportCache = new Map<string, ReflectionSupport | null>();
  const qualify = (
    index: number,
    markerIndex: number | null,
    reason: ProseQualification['reason'],
    eligible: boolean,
  ) => {
    result.set(index + 1, {
      status: 'qualified',
      view: eligible ? 'factual' : 'history',
      reason,
      answer_eligible: eligible,
      source_hash: sourceHash,
      frame: [
        ...(markerIndex === null ? [] : [{ n: markerIndex + 1, text: allLines[markerIndex]! }]),
        { n: index + 1, text: allLines[index]! },
      ],
    });
  };
  for (const index of markers) {
    let payloadIndex = index + 1;
    while (
      payloadIndex < allLines.length &&
      (!allLines[payloadIndex]!.trim() || /^\s*<!--/.test(allLines[payloadIndex]!))
    )
      payloadIndex++;
    if (payloadIndex >= allLines.length) continue;
    const marker = parseReflectionMarker(allLines[index]!);
    const valid =
      isDerived &&
      marker !== null &&
      payloadIndex === index + 1 &&
      CONCLUSION.test(allLines[payloadIndex]!) &&
      sha256(allLines[payloadIndex]!.trim()) === marker.payloadHash &&
      marker.id === reflectionId(marker.evidence, allLines[payloadIndex]!.trim()) &&
      identities.filter((id) => id === marker.id).length === 1;
    const issue = !valid
      ? 'reflection_lineage_missing'
      : supportIssue(store, marker!, aknoPath, supportCache);
    qualify(payloadIndex, index, issue ?? 'reflection_supported', issue === null);
  }
  // Older generated dated conclusions have no exact lineage. Keep them inspectable rather than
  // guessing support from a page link or adopting whatever happens to be on that page today.
  for (const index of legacy)
    if (!result.has(index + 1)) qualify(index, null, 'reflection_lineage_missing', false);
  return result;
}
function supportIssue(
  store: Store,
  marker: ReflectionMarker,
  aknoPath: string,
  cache: Map<string, ReflectionSupport | null>,
): ProseQualification['reason'] | null {
  for (const support of marker.evidence) {
    if (!cache.has(support.observationId))
      cache.set(support.observationId, currentReflectionSupport(store, support.observationId, aknoPath));
    const current = cache.get(support.observationId);
    if (!current || current.markerHash !== support.markerHash || current.payloadHash !== support.payloadHash)
      return 'reflection_support_stale';
  }
  return null;
}
export function currentReflectionSupport(
  store: Store,
  observationId: string,
  aknoPath: string,
): ReflectionSupport | null {
  const row = store.db
    .prepare(
      `SELECT oe.source_page, oe.marker_line, oe.payload_line, oe.payload_hash, oe.eligible, p.rel_path
      FROM observation_entries oe JOIN pages p ON p.id=oe.source_page WHERE oe.id=?`,
    )
    .get(observationId) as
    | {
        source_page: string;
        marker_line: number;
        payload_line: number;
        payload_hash: string;
        eligible: number;
        rel_path: string;
      }
    | undefined;
  const current = markerFromProjection(store, observationId);
  if (!row || !row.eligible || !current) return null;
  let lines: string[];
  try {
    lines = fs.readFileSync(path.join(aknoPath, row.rel_path), 'utf8').split('\n');
  } catch {
    return null;
  }
  const qualified = qualifyObservationLines<Line>(
    store,
    row.source_page,
    [{ n: row.payload_line, text: lines[row.payload_line - 1] ?? '' }],
    lines,
  )[0];
  // A watcher/index pass may not yet have seen a source edit. Exact leaf bytes must still
  // match before an unchanged reflection can count as current prose.
  const leaves = store.db
    .prepare(
      `SELECT f.line_start,p.rel_path,e.source_line_hash
    FROM observation_evidence e JOIN facts f ON f.id=e.fact_id JOIN pages p ON p.id=f.page_id
    WHERE e.observation_id=?`,
    )
    .all(observationId) as { line_start: number; rel_path: string; source_line_hash: string }[];
  try {
    if (
      !leaves.length ||
      leaves.some((leaf) => {
        const text = fs.readFileSync(path.join(aknoPath, leaf.rel_path), 'utf8').split('\n')[
          leaf.line_start - 1
        ];
        return text === undefined || sha256(text.trim()) !== leaf.source_line_hash;
      })
    )
      return null;
  } catch {
    return null;
  }
  return qualified?.observation?.status === 'eligible'
    ? { observationId, markerHash: sha256(renderObservationMarker(current)), payloadHash: row.payload_hash }
    : null;
}
export function qualifyReflectionLines<T extends Line>(
  store: Store,
  pageId: string,
  lines: T[],
  allLines: string[],
  aknoPath: string,
): T[] {
  const qualifications = reflectionQualifications(store, pageId, allLines, aknoPath);
  return lines.map((line) => {
    const prose = qualifications.get(line.n);
    return prose
      ? { ...line, prose, ...(prose.answer_eligible ? {} : { fact: undefined, confidence: undefined }) }
      : line;
  });
}
/** Refresh even unchanged pages after the L2 graph has qualified changed leaves. */
export function refreshReflectionProse(store: Store, aknoPath: string): void {
  const pages = store.db
    .prepare(
      "SELECT id,rel_path FROM pages WHERE role='inference' OR json_extract(frontmatter,'$.derived')=1",
    )
    .all() as {
    id: string;
    rel_path: string;
  }[];
  const insert = store.db.prepare(
    'INSERT OR REPLACE INTO prose_entries(source_page,line,view,eligible,source_hash) VALUES(?,?,?,?,?)',
  );
  for (const page of pages) {
    let lines: string[];
    try {
      lines = fs.readFileSync(path.join(aknoPath, page.rel_path), 'utf8').split('\n');
    } catch {
      continue;
    }
    const qualifications = reflectionQualifications(store, page.id, lines, aknoPath);
    for (const [n, q] of qualifications) {
      insert.run(page.id, n, q.view, 1, q.source_hash);
      // Derived conclusions never become level-one source facts, including rows left by
      // an older deriver during a structural-only projection upgrade.
      store.db.prepare('DELETE FROM facts WHERE page_id=? AND line_start=?').run(page.id, n);
    }
    if (qualifications.size) store.db.prepare('UPDATE pages SET summary=NULL WHERE id=?').run(page.id);
  }
}
