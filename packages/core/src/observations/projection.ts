import type { Line, ObservationEvidence, ObservationQualification } from '@tenphi/akno-protocol';
import { sha256 } from '../store/ids.ts';
import type { Store } from '../store/db.ts';
import type { ParsedPage } from '../kb/page.ts';
import {
  observationMarkerIssue,
  observationPayloadIssue,
  parseObservationMarker,
  renderObservationMarker,
  structuralObservationMarkerIndexes,
  type ObservationEvidenceLocator,
  type ObservationMarker,
} from './marker.ts';

export const OBSERVATION_PROJECTION_VERSION = 'observation-v1';

export interface ObservationProjectionReport {
  indexed: number;
  issues: number;
}

/** Parse only owned blocks here. Evidence becomes eligible after the fact graph is rebuilt. */
export function replaceObservationEntries(
  store: Store,
  pageId: string,
  page: ParsedPage,
): ObservationProjectionReport {
  store.db.prepare('DELETE FROM observation_projection_issues WHERE source_page = ?').run(pageId);
  store.db.prepare('DELETE FROM observation_entries WHERE source_page = ?').run(pageId);
  const ids = new Set<string>();
  let indexed = 0;
  let issues = 0;
  const issue = store.db.prepare(
    `INSERT OR REPLACE INTO observation_projection_issues(
       source_page, marker_line, observation_id, reason
     ) VALUES(?, ?, ?, ?)`,
  );
  const entry = store.db.prepare(
    `INSERT INTO observation_entries(
       id, source_page, source_slug, marker_line, payload_line, subject_entity, disposition,
       payload, payload_hash, proof_count, eligible, issue
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending evidence qualification')`,
  );
  const evidence = store.db.prepare(
    `INSERT INTO observation_evidence(
       observation_id, ordinal, fact_id, source_line_hash, proof_groups
     ) VALUES(?, ?, ?, ?, ?)`,
  );

  const markerIndexes = structuralObservationMarkerIndexes(page.lines);
  for (let index = 0; index < page.lines.length; index++) {
    const raw = page.lines[index]!;
    if (!markerIndexes.has(index)) continue;
    const markerLine = page.bodyLine + index;
    // Below the source fence the same bytes are quoted source material, not an owned L2 block.
    if (page.sourceFenceLine !== null && markerLine >= page.sourceFenceLine) continue;
    const marker = parseObservationMarker(raw);
    const markerIdentity = rawObservationId(raw);
    const reason = marker ? observationMarkerIssue(marker) : 'invalid observation marker';
    const payload = page.lines[index + 1]?.trim() ?? '';
    if (reason || !marker) {
      issue.run(pageId, markerLine, marker?.id ?? markerIdentity, reason ?? 'invalid observation marker');
      issues++;
      continue;
    }
    if (!payload) {
      issue.run(pageId, markerLine, marker.id, 'missing adjacent observation payload');
      issues++;
      continue;
    }
    if (ids.has(marker.id)) {
      issue.run(pageId, markerLine, marker.id, 'duplicate observation id on page');
      issues++;
      continue;
    }
    ids.add(marker.id);
    try {
      entry.run(
        marker.id,
        pageId,
        page.slug,
        markerLine,
        markerLine + 1,
        marker.subject,
        marker.disposition,
        payload,
        hashPayload(payload),
        marker.proofCount,
      );
      marker.evidence.forEach((locator, ordinal) => {
        evidence.run(
          marker.id,
          ordinal,
          locator.factId,
          locator.sourceLineHash,
          JSON.stringify(locator.proofGroups),
        );
      });
      indexed++;
    } catch {
      issue.run(pageId, markerLine, marker.id, 'duplicate observation id');
      issues++;
    }
  }
  return { indexed, issues };
}

/**
 * Recompute authority and lineage from current facts. Query paths trust only this result,
 * so a retracted source stops supporting an observation in the same index pass even when
 * policy prevents rewriting the visible block.
 */
export function qualifyObservationEntries(store: Store, minEvidence = 2): ObservationProjectionReport {
  const rows = store.db.prepare('SELECT * FROM observation_entries ORDER BY id').all() as ObservationRow[];
  const update = store.db.prepare('UPDATE observation_entries SET eligible = ?, issue = ? WHERE id = ?');
  // `observation_entries.id` is the stable lookup key, so SQLite necessarily rejects the
  // second copy. Count valid entries together with rejected marker identities: otherwise the
  // first copy would look unique merely because it won insertion order, and an unknown-version
  // copy could silently reuse the same stable identity.
  const duplicateIds = new Set(
    (
      store.db
        .prepare(
          `SELECT observation_id AS id
             FROM (
               SELECT id AS observation_id FROM observation_entries
               UNION ALL
               SELECT observation_id FROM observation_projection_issues
                WHERE observation_id IS NOT NULL
             )
            GROUP BY observation_id HAVING count(*) > 1`,
        )
        .all() as { id: string }[]
    ).map((row) => row.id),
  );
  let eligible = 0;
  let issues = 0;
  for (const row of rows) {
    const evidence = observationEvidenceRows(store, row.id);
    const issue = duplicateIds.has(row.id)
      ? 'duplicate observation id'
      : qualificationIssue(store, row, evidence, Math.max(2, minEvidence));
    update.run(issue ? 0 : 1, issue, row.id);
    if (issue) issues++;
    else eligible++;
  }
  return { indexed: eligible, issues };
}

export function qualifyObservationLines<T extends Line>(
  store: Store,
  pageId: string,
  lines: T[],
  allLines?: string[],
): T[] {
  if (lines.length === 0) return lines;
  const rows = store.db
    .prepare(
      `SELECT id, marker_line, payload_line, subject_entity, disposition, payload_hash,
              proof_count, eligible, issue
         FROM observation_entries WHERE source_page = ?`,
    )
    .all(pageId) as Pick<
    ObservationRow,
    | 'id'
    | 'marker_line'
    | 'payload_line'
    | 'subject_entity'
    | 'disposition'
    | 'payload_hash'
    | 'proof_count'
    | 'eligible'
    | 'issue'
  >[];
  const byLine = new Map(rows.map((row) => [row.payload_line, row]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const projectionIssues = store.db
    .prepare('SELECT marker_line, reason FROM observation_projection_issues WHERE source_page = ?')
    .all(pageId) as { marker_line: number; reason: string }[];
  const issuesByPayload = new Map<number, string>();
  for (const row of projectionIssues) {
    // A malformed/unknown marker fails closed over the next readable line even if an editor
    // inserted whitespace between them. Otherwise that visible derived prose could be answered
    // as ordinary authored text while the deriver correctly refuses to import it as a fact.
    const payloadLine = allLines
      ? nextReadableLine(allLines, row.marker_line)
      : lines.find(
          (line) => line.n > row.marker_line && line.text.trim().length > 0 && !/^\s*<!--/.test(line.text),
        )?.n;
    if (payloadLine) issuesByPayload.set(payloadLine, row.reason);
  }
  const currentIssuesByPayload = new Map<number, string>();
  if (allLines) {
    for (const markerIndex of structuralObservationMarkerIndexes(allLines, true, true)) {
      const markerLine = markerIndex + 1;
      const payloadLine = markerLine + 1;
      const marker = parseObservationMarker(allLines[markerIndex]!);
      const projected = marker ? byId.get(marker.id) : undefined;
      const projectedMarker = marker ? markerFromProjection(store, marker.id) : null;
      const payload = allLines[markerIndex + 1]?.trim() ?? '';
      const markerMatches =
        marker !== null &&
        projected !== undefined &&
        projectedMarker !== null &&
        projected.marker_line === markerLine &&
        projected.payload_line === payloadLine &&
        renderObservationMarker(marker) === renderObservationMarker(projectedMarker) &&
        hashPayload(payload) === projected.payload_hash;
      if (!markerMatches) {
        currentIssuesByPayload.set(payloadLine, 'observation marker is not current in the projection');
      }
    }
  }
  return lines.map((line) => {
    const row = byLine.get(line.n);
    if (!row) {
      const reason = currentIssuesByPayload.get(line.n) ?? issuesByPayload.get(line.n);
      return reason
        ? {
            ...line,
            observation: {
              status: 'ineligible' as const,
              id: `invalid:${pageId}:${line.n - 1}`,
              level: 2 as const,
              disposition: 'active' as const,
              reason,
            },
          }
        : line;
    }
    const runtimeIssue = allLines ? currentLineIssue(store, row, line.text, allLines) : null;
    const qualification: ObservationQualification =
      row.eligible && !runtimeIssue
        ? {
            status: 'eligible',
            id: row.id,
            level: 2,
            subject: row.subject_entity,
            disposition: row.disposition,
            proof_count: row.proof_count,
            evidence: observationEvidenceDetails(store, row.id),
          }
        : {
            status: 'ineligible',
            id: row.id,
            level: 2,
            disposition: row.disposition,
            reason: runtimeIssue ?? row.issue ?? 'unqualified observation',
          };
    return { ...line, observation: qualification };
  });
}

function currentLineIssue(
  store: Store,
  row: Pick<
    ObservationRow,
    'id' | 'marker_line' | 'payload_hash' | 'subject_entity' | 'disposition' | 'proof_count'
  >,
  payload: string,
  allLines: string[],
): string | null {
  if (hashPayload(payload.trim()) !== row.payload_hash) return 'observation payload changed since indexing';
  const current = parseObservationMarker(allLines[row.marker_line - 1] ?? '');
  const projected = markerFromProjection(store, row.id);
  if (!current || !projected || renderObservationMarker(current) !== renderObservationMarker(projected)) {
    return 'observation marker changed since indexing';
  }
  return null;
}

function nextReadableLine(allLines: string[], markerLine: number): number | null {
  for (let line = markerLine + 1; line <= allLines.length; line++) {
    const text = allLines[line - 1]?.trim() ?? '';
    if (text && !/^<!--/.test(text)) return line;
  }
  return null;
}

interface ObservationRow {
  id: string;
  source_page: string;
  source_slug: string;
  marker_line: number;
  payload_line: number;
  subject_entity: string;
  disposition: 'active' | 'weakened' | 'retracted' | 'superseded';
  payload: string;
  payload_hash: string;
  proof_count: number;
  eligible: number;
  issue: string | null;
}

interface EvidenceRow extends ObservationEvidenceLocator {
  ordinal: number;
}

function qualificationIssue(
  store: Store,
  row: ObservationRow,
  evidence: EvidenceRow[],
  minEvidence: number,
): string | null {
  if (row.disposition !== 'active') return `observation is ${row.disposition}`;
  const target = store.db
    .prepare('SELECT role, about, observe_management FROM pages WHERE id = ?')
    .get(row.source_page) as { role: string; about: string; observe_management: string } | undefined;
  if (!target || target.role !== 'knowledge') return 'target is not a knowledge page';
  if (target.observe_management !== 'integrate') return 'observe integration is not authorized';
  const entity = store.db
    .prepare('SELECT canonical_page FROM graph_entities WHERE id = ?')
    .get(row.subject_entity) as { canonical_page: string } | undefined;
  if (!entity) return 'subject entity is unresolved';
  const about = JSON.parse(target.about) as string[];
  if (entity.canonical_page !== row.source_page) {
    const canonical = store.db.prepare('SELECT slug FROM pages WHERE id = ?').get(entity.canonical_page) as
      { slug: string } | undefined;
    if (!canonical || !about.includes(canonical.slug))
      return 'target does not declare the observation subject';
  }
  if (evidence.length < 2) return 'insufficient evidence locators';

  const actualProofs = new Set<string>();
  const slugs: string[] = [];
  for (const locator of evidence) {
    const fact = store.db
      .prepare(
        `SELECT f.source_line_hash, f.item_id, f.valid_to, p.id AS page_id, p.slug,
                p.role, p.body_hash, p.derived_hash, g.subject_entity, g.eligibility, g.traversable
           FROM facts f JOIN pages p ON p.id = f.page_id
           LEFT JOIN graph_fact_status g ON g.fact_id = f.id
          WHERE f.id = ?`,
      )
      .get(locator.factId) as FactEvidenceRow | undefined;
    if (!fact || fact.valid_to !== null) return `evidence fact ${locator.factId} is stale`;
    if (fact.source_line_hash !== locator.sourceLineHash) return `evidence fact ${locator.factId} changed`;
    if (fact.role !== 'knowledge' || fact.body_hash !== fact.derived_hash)
      return 'evidence derivation is stale';
    if (
      fact.subject_entity !== row.subject_entity ||
      fact.eligibility !== 'eligible' ||
      fact.traversable !== 1
    ) {
      return `evidence fact ${locator.factId} is ineligible`;
    }
    const currentProofs = proofGroupsForFact(store, locator.factId, fact.page_id, fact.item_id);
    if (!sameSet(currentProofs, new Set(locator.proofGroups))) return 'proof groups changed';
    currentProofs.forEach((proof) => actualProofs.add(proof));
    slugs.push(fact.slug);
  }
  if (actualProofs.size !== row.proof_count) return 'proof-count mismatch';
  if (actualProofs.size < minEvidence) return 'insufficient independent proof';
  return observationPayloadIssue(row.payload, slugs);
}

interface FactEvidenceRow {
  source_line_hash: string;
  item_id: string | null;
  valid_to: string | null;
  page_id: string;
  slug: string;
  role: string;
  body_hash: string;
  derived_hash: string | null;
  subject_entity: string | null;
  eligibility: string | null;
  traversable: number | null;
}

export function proofGroupsForFact(
  store: Store,
  factId: string,
  pageId?: string,
  itemId?: string | null,
): Set<string> {
  let resolvedPage = pageId;
  let resolvedItem = itemId;
  if (resolvedPage === undefined) {
    const fact = store.db.prepare('SELECT page_id, item_id FROM facts WHERE id = ?').get(factId) as
      { page_id: string; item_id: string | null } | undefined;
    if (!fact) return new Set();
    resolvedPage = fact.page_id;
    resolvedItem = fact.item_id;
  }
  if (!resolvedItem) return new Set([`page:${resolvedPage}`]);
  const rows = store.db
    .prepare(
      `SELECT DISTINCT proof_group FROM retain_supports
        WHERE memory_id = ? AND retracted_by IS NULL AND forgotten_by IS NULL`,
    )
    .all(resolvedItem) as { proof_group: string }[];
  return new Set(rows.map((row) => row.proof_group));
}

/** Current independently owned support that still matches an observation's exact subject and line. */
export function liveObservationProofGroups(store: Store, marker: ObservationMarker): Set<string> {
  const proofs = new Set<string>();
  for (const locator of marker.evidence) {
    const fact = store.db
      .prepare(
        `SELECT f.source_line_hash, f.valid_to, f.item_id, p.id AS page_id, p.role,
                p.body_hash, p.derived_hash, g.subject_entity, g.eligibility, g.traversable
           FROM facts f JOIN pages p ON p.id = f.page_id
           LEFT JOIN graph_fact_status g ON g.fact_id = f.id
          WHERE f.id = ?`,
      )
      .get(locator.factId) as
      | {
          source_line_hash: string;
          valid_to: string | null;
          item_id: string | null;
          page_id: string;
          role: string;
          body_hash: string;
          derived_hash: string | null;
          subject_entity: string | null;
          eligibility: string | null;
          traversable: number | null;
        }
      | undefined;
    if (
      !fact ||
      fact.valid_to !== null ||
      fact.source_line_hash !== locator.sourceLineHash ||
      fact.role !== 'knowledge' ||
      fact.body_hash !== fact.derived_hash ||
      fact.subject_entity !== marker.subject ||
      fact.eligibility !== 'eligible' ||
      fact.traversable !== 1
    ) {
      continue;
    }
    proofGroupsForFact(store, locator.factId, fact.page_id, fact.item_id).forEach((proof) =>
      proofs.add(proof),
    );
  }
  return proofs;
}

function observationEvidenceRows(store: Store, id: string): EvidenceRow[] {
  return (
    store.db
      .prepare(
        `SELECT ordinal, fact_id, source_line_hash, proof_groups
           FROM observation_evidence WHERE observation_id = ? ORDER BY ordinal`,
      )
      .all(id) as { ordinal: number; fact_id: string; source_line_hash: string; proof_groups: string }[]
  ).map((row) => ({
    ordinal: row.ordinal,
    factId: row.fact_id,
    sourceLineHash: row.source_line_hash,
    proofGroups: JSON.parse(row.proof_groups) as string[],
  }));
}

function observationEvidenceDetails(store: Store, id: string): ObservationEvidence[] {
  const rows = store.db
    .prepare(
      `SELECT oe.fact_id AS fact, oe.source_line_hash AS line_hash, oe.proof_groups,
              p.slug, f.line_start AS line
         FROM observation_evidence oe JOIN facts f ON f.id = oe.fact_id
         JOIN pages p ON p.id = f.page_id
        WHERE oe.observation_id = ? ORDER BY oe.ordinal`,
    )
    .all(id) as { fact: string; line_hash: string; proof_groups: string; slug: string; line: number }[];
  return rows.map((row) => ({
    fact: row.fact,
    slug: row.slug,
    line: row.line,
    line_hash: row.line_hash,
    proof_groups: JSON.parse(row.proof_groups) as string[],
  }));
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((entry) => right.has(entry));
}

function hashPayload(value: string): string {
  return sha256(value);
}

function rawObservationId(line: string): string | null {
  return /^\s*<!--\s*akno:observation\s+(obs_[A-Za-z0-9_-]{8,72})(?:\s|-->)/i.exec(line)?.[1] ?? null;
}

export function markerFromProjection(store: Store, id: string): ObservationMarker | null {
  const row = store.db.prepare('SELECT * FROM observation_entries WHERE id = ?').get(id) as
    ObservationRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject_entity,
    disposition: row.disposition,
    evidence: observationEvidenceRows(store, id),
    proofCount: row.proof_count,
  };
}
