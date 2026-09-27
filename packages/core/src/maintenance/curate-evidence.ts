import fs from 'node:fs';
import path from 'node:path';
import type { Line } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { qualifyManagedMemoryLines } from '../kb/managed-lines.ts';
import { normalizeLinkTarget, parsePage } from '../kb/page.ts';
import { sha256 } from '../store/ids.ts';
import { quarantineReasonsForPath } from '../index/page-quarantine.ts';

type Exclusion =
  | 'unreadable'
  | 'stale_index'
  | 'derivation_pending'
  | 'qualified_prose'
  | 'unqualified_memory'
  | 'summary_withheld'
  | 'invalid_locator'
  | 'relationship_only'
  | 'fact_limit'
  | 'event_limit'
  | 'span_limit'
  | 'prompt_limit'
  | 'ineligible_fact'
  | 'ineligible_event'
  | 'source_conflict';

interface EvidencePageCoverage {
  slug: string;
  status: 'complete' | 'partial' | 'unavailable';
  selectedFacts: number;
  selectedEvents: number;
  exclusions: { reason: Exclusion; count: number }[];
}

export interface SynthesisEvidenceCoverage {
  scope: 'linked_and_about';
  status: 'complete' | 'partial';
  sourceLimitReached: boolean;
  unresolvedLinks: number;
  pages: EvidencePageCoverage[];
}

interface Subject {
  id: string;
  slug: string;
  title: string;
}
interface Fact {
  claim: string;
  subject: string | null;
  attribute: string | null;
  value: string | null;
  item_id: string | null;
  line_start: number;
  line_end: number;
  source_line_hash: string;
}
interface Event {
  date: string;
  summary: string;
  line: number;
}
interface SourceRow {
  id: string;
  slug: string;
  rel_path: string;
  summary: string | null;
  about: string;
  role: string;
  body_hash: string;
  content_hash: string;
  derived_hash: string | null;
  outbound: number;
  backlink: number;
}

export interface SynthesisEvidencePage extends SourceRow {
  relationship: 'about' | 'outbound' | 'backlink';
  facts: (Fact & { source_text: string })[];
  events: (Event & { source_text: string })[];
}

/** Completeness describes this bounded graph selection, never the whole knowledge base. */
export function selectSynthesisEvidence(
  ctx: Pick<AknoContext, 'config' | 'store'>,
  page: Subject,
): {
  pages: SynthesisEvidencePage[];
  coverage: SynthesisEvidenceCoverage;
} {
  const rows = ctx.store.db
    .prepare(
      `
    SELECT DISTINCT p.id, p.slug, p.rel_path, p.summary, p.about, p.role, p.body_hash, p.derived_hash,
      indexed_file.sha256 AS content_hash,
      EXISTS (SELECT 1 FROM links l WHERE l.from_page = ? AND l.to_page = p.id) AS outbound,
      EXISTS (SELECT 1 FROM links l WHERE l.from_page = p.id AND l.to_page = ?) AS backlink
    FROM pages p JOIN files indexed_file ON indexed_file.rel_path = p.rel_path
    WHERE p.id != ? AND p.role != 'ignored' AND (
      EXISTS (SELECT 1 FROM links l WHERE l.from_page = p.id AND l.to_page = ?)
      OR EXISTS (SELECT 1 FROM links l WHERE l.from_page = ? AND l.to_page = p.id)
      OR p.about LIKE ?
    ) ORDER BY p.slug COLLATE NOCASE LIMIT 31
  `,
    )
    .all(
      page.id,
      page.id,
      page.id,
      page.id,
      page.id,
      `%${JSON.stringify(page.slug).slice(1, -1)}%`,
    ) as SourceRow[];
  const unresolved = ctx.store.db
    .prepare(
      "SELECT count(*) AS count FROM links WHERE from_page = ? AND to_page IS NULL AND kind != 'embed'",
    )
    .get(page.id) as { count: number };
  const coverage: SynthesisEvidenceCoverage = {
    scope: 'linked_and_about',
    status: 'complete',
    sourceLimitReached: rows.length > 30,
    unresolvedLinks: unresolved.count,
    pages: [],
  };
  const facts = ctx.store.db.prepare(`
    SELECT claim, subject, attribute, value, item_id, line_start, line_end, source_line_hash
    FROM facts WHERE page_id = ? AND valid_to IS NULL ORDER BY line_start, id LIMIT 201
  `);
  const events = ctx.store.db.prepare(`
    SELECT date, summary, line FROM events WHERE source_page = ? AND target_slug = ?
    ORDER BY date DESC, line LIMIT 201
  `);
  const pages: SynthesisEvidencePage[] = [];
  let remaining = 36_000;
  for (const row of rows.slice(0, 30)) {
    const relationship = relationshipFor(row, page.slug);
    if (!relationship) continue; // The SQL LIKE is only a prefilter, never subject identity.
    const report: EvidencePageCoverage = {
      slug: row.slug,
      status: 'complete',
      selectedFacts: 0,
      selectedEvents: 0,
      exclusions: [],
    };
    coverage.pages.push(report);
    const exclude = (reason: Exclusion, count = 1) => {
      if (!count) return;
      const prior = report.exclusions.find((entry) => entry.reason === reason);
      if (prior) prior.count += count;
      else report.exclusions.push({ reason, count });
      if (report.status !== 'unavailable') report.status = 'partial';
    };
    const source = readSource(ctx, row);
    if (typeof source === 'string') {
      report.status = 'unavailable';
      exclude(source);
      continue;
    }
    const { parsed, qualified } = source;
    const qualifiedProse = qualified.filter(
      (line) =>
        line.prose &&
        !line.prose.answer_eligible &&
        line.prose.reason !== 'heading' &&
        line.prose.reason !== 'comment',
    ).length;
    const unqualifiedMemory = qualified.filter((line) => line.memory && !eligibleLine(line)).length;
    exclude('qualified_prose', qualifiedProse);
    exclude('unqualified_memory', unqualifiedMemory);
    const derivedCurrent = row.derived_hash === row.body_hash;
    if (!derivedCurrent && relationship !== 'outbound') exclude('derivation_pending');
    const selected: SynthesisEvidencePage = { ...row, relationship, summary: null, facts: [], events: [] };
    const summaryUnqualified =
      qualified.some(
        (line) => line.prose && !line.prose.answer_eligible && line.prose.reason !== 'heading',
      ) || parsed.lines.some((line) => /<!--\s*akno:(?:item|observation)\b/.test(line));
    if (relationship === 'about' && derivedCurrent && !summaryUnqualified && !unqualifiedMemory)
      selected.summary = row.summary;
    else if (row.summary && relationship === 'about') exclude('summary_withheld');

    const candidates = derivedCurrent && relationship !== 'outbound' ? (facts.all(row.id) as Fact[]) : [];
    if (candidates.length > 200) exclude('fact_limit');
    for (const fact of candidates.slice(0, 200)) {
      if (relationship === 'outbound' || (relationship === 'backlink' && !mentions(fact, page))) {
        exclude('relationship_only');
        continue;
      }
      const issue = factIssue(fact, source);
      if (issue) {
        exclude(issue);
        continue;
      }
      const line = qualified[fact.line_start - 1]!;
      if (line.text.length > 2_000) {
        exclude('span_limit');
        continue;
      }
      if (selected.facts.length >= 50) {
        exclude('fact_limit');
        continue;
      }
      selected.facts.push({ ...fact, source_text: line.text });
    }
    const eventCandidates = events.all(row.id, page.slug) as Event[];
    if (eventCandidates.length > 200) exclude('event_limit');
    for (const event of eventCandidates.slice(0, 200)) {
      const parsedEvent = parsed.events.find(
        (entry) =>
          entry.line === event.line &&
          entry.date === event.date &&
          entry.summary === event.summary &&
          entry.targetSlug === page.slug,
      );
      const line = qualified[event.line - 1];
      if (!parsedEvent || !line) {
        exclude('invalid_locator');
        continue;
      }
      if (!eligibleLine(line)) {
        exclude('ineligible_event');
        continue;
      }
      if (line.text.length > 2_000) {
        exclude('span_limit');
        continue;
      }
      if (selected.events.length >= 50) {
        exclude('event_limit');
        continue;
      }
      selected.events.push({ ...event, source_text: line.text });
    }
    // Trim complete entries before fingerprints/verifiers/plans see them. A substring cut could
    // silently turn omitted evidence into an apparently complete prompt or sever its citation.
    while (renderSynthesisEvidence([selected]).length > remaining) {
      if (selected.events.length) selected.events.pop();
      else if (selected.facts.length) selected.facts.pop();
      else if (selected.summary) selected.summary = null;
      else break;
      exclude('prompt_limit');
    }
    const rendered = renderSynthesisEvidence([selected]);
    if (rendered.length > remaining) {
      exclude('prompt_limit');
      continue;
    }
    remaining -= rendered.length + 2;
    report.selectedFacts = selected.facts.length;
    report.selectedEvents = selected.events.length;
    pages.push(selected);
  }
  if (
    coverage.sourceLimitReached ||
    coverage.unresolvedLinks ||
    coverage.pages.some((entry) => entry.status !== 'complete')
  )
    coverage.status = 'partial';
  return { pages, coverage };
}

function eligibleLine(line: Line | undefined): boolean {
  if (!line) return false;
  if (line.memory)
    return (
      line.memory.status === 'qualified' &&
      line.memory.answer_eligible &&
      line.memory.temporal?.time.relation !== 'valid'
    );
  return line.prose?.answer_eligible === true;
}

type SourceIdentity = Pick<SourceRow, 'id' | 'rel_path' | 'content_hash' | 'body_hash'>;
type ReadSource = { parsed: ReturnType<typeof parsePage>; qualified: Line[] };
function readSource(
  ctx: Pick<AknoContext, 'config' | 'store'>,
  row: SourceIdentity,
): ReadSource | 'source_conflict' | 'stale_index' | 'unreadable' {
  if (quarantineReasonsForPath(ctx.store, row.rel_path).length) return 'source_conflict';
  try {
    const content = fs.readFileSync(path.join(ctx.config.aknoPath, row.rel_path), 'utf8');
    if (sha256(content) !== row.content_hash) return 'stale_index';
    const parsed = parsePage(row.rel_path, content);
    if (parsed.bodyHash !== row.body_hash) return 'stale_index';
    const fileLines = content.split('\n');
    const qualified: Line[] = qualifyManagedMemoryLines(
      fileLines.map((text, i) => ({ n: i + 1, text })),
      fileLines,
      { store: ctx.store, pageId: row.id },
    );
    return { parsed, qualified };
  } catch {
    return 'unreadable';
  }
}

function factIssue(fact: Fact, source: ReadSource): 'invalid_locator' | 'ineligible_fact' | null {
  // Derivation binds one trimmed authored line. A hash on only the first line cannot certify
  // a wider span, and an owned payload must retain its exact item identity.
  const line = source.qualified[fact.line_start - 1];
  if (
    !Number.isInteger(fact.line_start) ||
    fact.line_start < source.parsed.bodyLine ||
    fact.line_end !== fact.line_start ||
    !line ||
    sha256(line.text.trim()) !== fact.source_line_hash ||
    fact.item_id !== (line.memory?.id ?? null)
  )
    return 'invalid_locator';
  return eligibleLine(line) ? null : 'ineligible_fact';
}

/** Source bytes can stay unchanged while a managed id becomes ambiguous elsewhere in the index. */
export function synthesisSpansCurrent(
  ctx: Pick<AknoContext, 'config' | 'store'>,
  row: SourceIdentity,
  spans: { line: number; text: string }[],
): boolean {
  const source = readSource(ctx, row);
  return (
    typeof source !== 'string' &&
    spans.every(
      (span) =>
        Number.isInteger(span.line) &&
        span.line >= source.parsed.bodyLine &&
        source.qualified[span.line - 1]?.text === span.text &&
        eligibleLine(source.qualified[span.line - 1]),
    )
  );
}

export interface SynthesisConflictCandidate extends Fact, SourceIdentity {
  slug: string;
  about: string;
  subject: string;
  attribute: string;
  value: string;
}

/** A disqualified fact must not re-enter the prompt through the conflict side channel. */
export function filterSynthesisConflicts(
  ctx: Pick<AknoContext, 'config' | 'store'>,
  pageId: string,
  rows: SynthesisConflictCandidate[],
): { slug: string; subject: string; attribute: string; value: string; claim: string }[] {
  const canonical = ctx.store.db.prepare('SELECT slug FROM pages WHERE id = ?').get(pageId) as {
    slug: string;
  };
  const sources = new Map<string, ReturnType<typeof readSource>>();
  const eligible = rows.filter((row) => {
    if (row.id !== pageId && !aboutMatches(row.about, canonical.slug)) return false;
    if (!sources.has(row.id)) sources.set(row.id, readSource(ctx, row));
    const source = sources.get(row.id)!;
    return typeof source !== 'string' && factIssue(row, source) === null;
  });
  return eligible
    .filter((row) =>
      eligible.some(
        (other) =>
          row.id !== other.id &&
          row.subject.toLowerCase() === other.subject.toLowerCase() &&
          row.attribute.toLowerCase() === other.attribute.toLowerCase() &&
          row.value !== other.value,
      ),
    )
    .map(({ slug, subject, attribute, value, claim }) => ({ slug, subject, attribute, value, claim }));
}

function aboutMatches(raw: string, slug: string): boolean {
  try {
    const about: unknown = JSON.parse(raw);
    return (
      Array.isArray(about) &&
      about.some((entry) => typeof entry === 'string' && normalizeLinkTarget(entry) === slug)
    );
  } catch {
    return false;
  }
}

function relationshipFor(row: SourceRow, slug: string): SynthesisEvidencePage['relationship'] | null {
  if (aboutMatches(row.about, slug)) return 'about';
  return row.outbound ? 'outbound' : row.backlink ? 'backlink' : null;
}

function mentions(fact: Fact, page: Subject): boolean {
  const key = (value: string) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const keys = [page.title, page.slug.split('/').at(-1)?.replaceAll('-', ' ') ?? '']
    .map(key)
    .filter((text) => text.length >= 4);
  const text = key([fact.subject, fact.attribute, fact.claim, fact.value].filter(Boolean).join(' '));
  return keys.some((part) => text.includes(part));
}

export function renderSynthesisEvidence(evidence: SynthesisEvidencePage[]): string {
  return evidence
    .map((row) =>
      [
        `[[${row.slug}]] (${row.relationship})${row.summary ? ` — ${row.summary}` : ''}`,
        ...row.facts.map((fact) => `- L${fact.line_start}: ${fact.claim}\n  Source: ${fact.source_text}`),
        ...row.events.map(
          (event) => `- L${event.line}: ${event.date}: ${event.summary}\n  Source: ${event.source_text}`,
        ),
      ].join('\n'),
    )
    .join('\n\n');
}
