import type { RecallEvidence, RecallFact, RecallFactMatch, RecallResult } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import type { FactHit } from './fact-arm.ts';
import type { ChunkHit } from './search.ts';

const RRF_K = 60;
/** Facts a chunk contributes without matching the query themselves: context, not the answer. */
const UNMATCHED_FACTS_PER_CHUNK = 3;
const EVIDENCE_LINES_PER_RESULT = 3;
const EVIDENCE_RESULTS = 6;
const EVIDENCE_QUOTE_CHARS = 400;

export interface FactListOptions {
  /** The fact arm's own ranking. */
  factHits: FactHit[];
  /** Final chunk order after fusion and any reranking. */
  hits: ChunkHit[];
  /**
   * True when a reranker qualified the chunk list. A fact on a chunk it rejected or never
   * judged is then dropped, so the fact list cannot bring back what qualification removed.
   */
  qualified: boolean;
  /** Assembled cards, already filtered for view, role and qualification. Source of evidence lines. */
  results: RecallResult[];
  limit: number;
  budget: number;
}

export interface FactList {
  facts: RecallFact[];
  evidence: RecallEvidence[];
  text: string;
  budgetUsed: number;
}

interface FactRow {
  id: string;
  claim: string;
  subject: string | null;
  attribute: string | null;
  value: string | null;
  line_start: number;
  item_id: string | null;
  slug: string;
  title: string;
}

/**
 * Rank live facts by two lists fused by rank: the fact arm, and the final chunk order with every
 * fact in a chunk sharing that chunk's rank. A fact both arms agree on rises; a fact that only
 * sits in a good chunk still appears, capped per chunk so one long section cannot fill the list.
 */
export function buildFactList(store: Store, options: FactListOptions): FactList {
  const finalChunks = new Map(options.hits.map((hit, rank) => [hit.chunkId, { hit, rank }]));
  const scores = new Map<string, { score: number; from: Set<RecallFactMatch> }>();
  const credit = (factId: string, rank: number, arms: RecallFactMatch[]): void => {
    const entry = scores.get(factId) ?? { score: 0, from: new Set<RecallFactMatch>() };
    entry.score += 1 / (RRF_K + rank + 1);
    for (const arm of arms) entry.from.add(arm);
    scores.set(factId, entry);
  };

  const armRank = new Map<string, number>();
  options.factHits.forEach((fact) => {
    if (options.qualified && !fact.chunkIds.some((chunkId) => finalChunks.has(chunkId))) return;
    armRank.set(fact.factId, armRank.size);
    credit(fact.factId, armRank.get(fact.factId)!, ['fact']);
  });

  const chunkFacts = store.db.prepare(
    `SELECT f.id FROM chunks c
       JOIN facts f ON f.page_id = c.page_id AND f.valid_to IS NULL
                   AND f.line_start BETWEEN c.line_start AND c.line_end
      WHERE c.id = ? AND c.document_id IS NULL
      ORDER BY f.line_start`,
  );
  const creditedViaChunk = new Set<string>();
  for (const [, { hit, rank }] of finalChunks) {
    const ids = (chunkFacts.all(hit.chunkId) as { id: string }[]).map((row) => row.id);
    const matched = ids.filter((id) => armRank.has(id));
    const unmatched = ids.filter((id) => !armRank.has(id)).slice(0, UNMATCHED_FACTS_PER_CHUNK);
    for (const id of [...matched, ...unmatched]) {
      if (creditedViaChunk.has(id)) continue;
      creditedViaChunk.add(id);
      credit(id, rank, hit.from);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const readFact = store.db.prepare(
    `SELECT f.id, f.claim, f.subject, f.attribute, f.value, f.line_start, f.item_id, p.slug, p.title
       FROM facts f JOIN pages p ON p.id = f.page_id
      WHERE f.id = ? AND f.valid_to IS NULL`,
  );
  const readMemory = store.db.prepare(
    `SELECT kind, commitment, disposition, basis, answer_eligible
       FROM managed_memory_entries WHERE memory_id = ? LIMIT 1`,
  );

  const facts: RecallFact[] = [];
  const titles = new Map<string, string>();
  let used = 0;
  for (const [factId, entry] of ranked) {
    if (facts.length >= options.limit) break;
    const row = readFact.get(factId) as FactRow | undefined;
    if (!row) continue;
    const fact: RecallFact = {
      id: row.id,
      claim: row.claim,
      slug: row.slug,
      line: row.line_start,
      ...(row.subject ? { subject: row.subject } : {}),
      ...(row.attribute ? { attribute: row.attribute } : {}),
      ...(row.value ? { value: row.value } : {}),
      matched_by: [...entry.from],
    };
    if (row.item_id) {
      const memory = readMemory.get(row.item_id) as
        | { kind: string; commitment: string; disposition: string; basis: string; answer_eligible: number }
        | undefined;
      // A plain current assertion needs no label; anything else must keep its status visible.
      if (memory && (!memory.answer_eligible || memory.commitment !== 'asserted')) {
        fact.memory = {
          kind: memory.kind,
          commitment: memory.commitment,
          disposition: memory.disposition,
          basis: memory.basis,
          answer_eligible: memory.answer_eligible === 1,
        };
      }
    }
    const cost =
      tokens(factLine(fact)) + (titles.has(row.slug) ? 0 : tokens(groupHeader(row.slug, row.title)));
    if (used + cost > options.budget && facts.length > 0) break;
    used += cost;
    titles.set(row.slug, row.title);
    facts.push(fact);
  }

  const covered = new Set(facts.map((fact) => `${fact.slug}:${fact.line}`));
  const evidence: RecallEvidence[] = [];
  for (const result of options.results) {
    if (evidence.length >= EVIDENCE_RESULTS) break;
    let item: RecallEvidence | null = null;
    if (result.type === 'page') {
      const lines = result.lines
        .filter((line) => !covered.has(`${result.slug}:${line.n}`))
        .slice(0, EVIDENCE_LINES_PER_RESULT)
        .map((line) => ({ n: line.n, text: line.text.trim() }));
      if (lines.length > 0) item = { ref: result.slug, type: 'page', lines };
    } else if (result.quote?.trim()) {
      item = {
        ref: result.path,
        type: 'document',
        quote: clip(result.quote.trim(), EVIDENCE_QUOTE_CHARS),
        ...(result.matched_page ? { page: result.matched_page } : {}),
      };
    }
    if (!item) continue;
    const cost = tokens(evidenceText(item));
    if (used + cost > options.budget) break;
    used += cost;
    evidence.push(item);
  }

  return { facts, evidence, text: render(facts, titles, evidence), budgetUsed: used };
}

/**
 * Grouped by page so a slug is written once, in the order its best fact ranked. The claim is the
 * restatement; `L<n>` is where the authoritative sentence lives.
 */
function render(facts: RecallFact[], titles: Map<string, string>, evidence: RecallEvidence[]): string {
  const out: string[] = [];
  if (facts.length > 0) {
    out.push('Facts (claim · source line; read slug:line for exact wording):');
    const groups = new Map<string, RecallFact[]>();
    for (const fact of facts) groups.set(fact.slug, [...(groups.get(fact.slug) ?? []), fact]);
    for (const [slug, group] of groups) {
      out.push(groupHeader(slug, titles.get(slug) ?? slug));
      for (const fact of group) out.push(factLine(fact));
    }
  }
  if (evidence.length > 0) {
    out.push('Other evidence (cited lines with no derived fact):');
    for (const item of evidence) out.push(evidenceText(item));
  }
  return out.join('\n');
}

function groupHeader(slug: string, title: string): string {
  return title && title !== slug ? `${slug} — ${title}` : slug;
}

function factLine(fact: RecallFact): string {
  const status = fact.memory
    ? ` [${[fact.memory.kind, fact.memory.commitment, fact.memory.disposition, fact.memory.basis].join(', ')}]`
    : '';
  return `  L${fact.line}${status} ${fact.claim}`;
}

function evidenceText(item: RecallEvidence): string {
  if (item.type === 'document') return `${item.ref}${item.page ? ` p${item.page}` : ''}: ${item.quote ?? ''}`;
  return [item.ref, ...(item.lines ?? []).map((line) => `  L${line.n} ${line.text}`)].join('\n');
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** The same rough estimate the card assembler uses: about four characters per token. */
function tokens(text: string): number {
  return Math.ceil(text.length / 4) + 1;
}
