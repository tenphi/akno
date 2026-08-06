import fs from 'node:fs';
import path from 'node:path';
import type { Card, Depth, Line, PageClass, RecallMode, SupersededClaim } from '@akno/protocol';
import type { AknoConfig } from '../config/schema.ts';
import type { Store } from '../store/db.ts';
import { isObservation } from '../kb/page.ts';
import { effectiveRule } from '../rules/compile.ts';
import type { ChunkHit } from './search.ts';

export interface AssembleOptions {
  hits: ChunkHit[];
  mode: RecallMode;
  depth: Depth;
  limit: number;
  budget: number;
  /** Body lines per card. §9 gives lookup deep windows and question tight ones. */
  lineWindow: number;
  /** Concepts the query asked about. Terms are matched against what came back. */
  concepts: string[];
  /** `include: ['reference'], depth: 'full'` lifts the reference quote cap (§5). */
  include: PageClass[] | null;
}

export interface Assembled {
  cards: Card[];
  budgetUsed: number;
  coverage: Record<string, boolean> | null;
  droppedCards: number;
}

interface PageRow {
  id: string;
  slug: string;
  rel_path: string;
  title: string;
  type: string | null;
  tags: string;
  class: PageClass;
  summary: string | null;
  keywords: string | null;
  body_line: number;
  updated_at: string | null;
}

interface FactRow {
  claim: string;
  line_start: number;
  confidence: number;
  valid_to: string | null;
}

/**
 * §9. Recall returns page cards — not chunks. A chunk boundary is an indexing
 * artifact and means nothing to a reader.
 */
export class Assembler {
  readonly #config: AknoConfig;
  readonly #store: Store;

  constructor(config: AknoConfig, store: Store) {
    this.#config = config;
    this.#store = store;
  }

  assemble(options: AssembleOptions): Assembled {
    // Group by page, keeping each page's best-scoring chunk as its representative.
    const byPage = new Map<string, { score: number; hits: ChunkHit[] }>();
    for (const hit of options.hits) {
      const entry = byPage.get(hit.pageId);
      if (entry) {
        entry.hits.push(hit);
        entry.score = Math.max(entry.score, hit.score);
      } else {
        byPage.set(hit.pageId, { score: hit.score, hits: [hit] });
      }
    }

    const ranked = [...byPage.entries()]
      .map(([pageId, entry]) => ({ pageId, ...entry }))
      .map((entry) => {
        const page = this.pageRow(entry.pageId);
        return page ? { ...entry, page, ranked: entry.score * this.rankFactor(page) } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .filter((entry) => !options.include || options.include.includes(entry.page.class))
      .sort((a, b) => b.ranked - a.ranked);

    // §9: one budget, one assembly — whole cards first. A half-card whose lines
    // were trimmed to fit is exactly the "disconnected fragment" the layer exists
    // to stop producing.
    const cards: Card[] = [];
    let budgetUsed = 0;
    let dropped = 0;

    for (const entry of ranked) {
      if (cards.length >= options.limit) {
        dropped++;
        continue;
      }
      const card = this.buildCard(entry.page, entry.hits, entry.ranked, options);
      const cost = estimateTokens(card);
      if (budgetUsed + cost > options.budget && cards.length > 0) {
        dropped++;
        continue;
      }
      cards.push(card);
      budgetUsed += cost;
    }

    return {
      cards,
      budgetUsed,
      coverage: options.mode === 'question' ? computeCoverage(options.concepts, cards) : null,
      droppedCards: dropped,
    };
  }

  /**
   * §9. Ranking policy lives in the layer: `full` pages outrank narrative
   * history, which outranks derived observations. A folder rule can set `rank` to
   * adjust it. Class applies at **assembly**, not at search — `reference` pages
   * compete for relevance on equal terms, then come back capped.
   */
  private rankFactor(page: PageRow): number {
    const rule = effectiveRule(page.slug, this.#config.rules);
    if (typeof rule.rank === 'number') return rule.rank;
    if (isObservation(page.slug, this.#config.paths.observations)) {
      return this.#config.recall.rank.observation;
    }
    return page.class === 'reference' ? this.#config.recall.rank.reference : this.#config.recall.rank.full;
  }

  private pageRow(pageId: string): PageRow | null {
    const row = this.#store.db
      .prepare(
        `SELECT id, slug, rel_path, title, type, tags, class, summary, keywords, body_line, updated_at
           FROM pages WHERE id = ?`,
      )
      .get(pageId) as PageRow | undefined;
    return row ?? null;
  }

  private buildCard(page: PageRow, hits: ChunkHit[], score: number, options: AssembleOptions): Card {
    const best = hits[0]!;
    const chunk = this.#store.db
      .prepare('SELECT heading_path, line_start, line_end, kind FROM chunks WHERE id = ?')
      .get(best.chunkId) as
      { heading_path: string; line_start: number; line_end: number; kind: string } | undefined;

    const isReference = page.class === 'reference' || chunk?.kind === 'reference';
    const wantsFullReference = options.depth === 'full' && options.include?.includes('reference');

    // §5. Ten matching emails cost ten summaries, not ten threads.
    const maxLines =
      options.depth === 'summary'
        ? 0
        : isReference && !wantsFullReference
          ? this.#config.recall.referenceQuoteLines
          : options.depth === 'full'
            ? Number.POSITIVE_INFINITY
            : options.lineWindow;

    const lines = maxLines === 0 ? [] : this.readLines(page, hits, maxLines, options.depth);
    const facts = this.factsFor(page.id);

    const card: Card = {
      slug: page.slug,
      title: page.title,
      class: page.class,
      summary: page.summary,
      score: round(score),
      lines: lines.map((line) => attachConfidence(line, facts)),
    };

    if (chunk?.heading_path) card.breadcrumb = chunk.heading_path;
    if (page.updated_at) card.updated = page.updated_at.slice(0, 10);

    const superseded = supersededFor(facts);
    if (superseded.length > 0) card.superseded = superseded;

    const links = this.linksFor(page.id);
    if (links.length > 0) card.links = links;

    const documents = this.documentsFor(page.id);
    if (documents.length > 0) card.documents = documents;

    if (isReference && !wantsFullReference && lines.length >= maxLines) card.truncated = true;

    return card;
  }

  /**
   * Reads the matching lines from the file rather than from the chunk text, so a
   * line's number is the number it actually has on disk. A citation that points
   * at the wrong line is worse than no citation — §2: cite or stay quiet.
   */
  private readLines(page: PageRow, hits: ChunkHit[], maxLines: number, depth: Depth): Line[] {
    let content: string;
    try {
      content = fs.readFileSync(path.join(this.#config.aknoPath, page.rel_path), 'utf8');
    } catch {
      return [];
    }
    const allLines = content.split('\n');

    if (depth === 'full' && maxLines === Number.POSITIVE_INFINITY) {
      return allLines
        .map((text, index) => ({ n: index + 1, text }))
        .filter((line) => line.text.trim().length > 0);
    }

    // Collect the line ranges of the matching chunks, best first.
    const ranges: { start: number; end: number }[] = [];
    for (const hit of hits.slice(0, 4)) {
      const row = this.#store.db
        .prepare('SELECT line_start, line_end FROM chunks WHERE id = ?')
        .get(hit.chunkId) as { line_start: number; line_end: number } | undefined;
      if (row) ranges.push({ start: row.line_start, end: row.line_end });
    }

    const out: Line[] = [];
    const seen = new Set<number>();
    for (const range of ranges) {
      for (let n = range.start; n <= range.end && out.length < maxLines; n++) {
        if (seen.has(n)) continue;
        const text = allLines[n - 1];
        if (text === undefined) continue;
        const trimmed = text.trim();
        // Blank lines and bare headings cost budget and carry nothing a reader
        // needs; the breadcrumb already says where they are.
        if (trimmed.length === 0 || /^#{1,6}\s/.test(trimmed) || /^<!--/.test(trimmed)) continue;
        seen.add(n);
        out.push({ n, text });
      }
      if (out.length >= maxLines) break;
    }
    return out;
  }

  private factsFor(pageId: string): FactRow[] {
    return this.#store.db
      .prepare('SELECT claim, line_start, confidence, valid_to FROM facts WHERE page_id = ?')
      .all(pageId) as FactRow[];
  }

  private linksFor(pageId: string): string[] {
    const rows = this.#store.db
      .prepare('SELECT DISTINCT to_slug FROM links WHERE from_page = ? AND broken = 0 LIMIT 12')
      .all(pageId) as { to_slug: string }[];
    return rows.map((row) => row.to_slug);
  }

  private documentsFor(pageId: string): NonNullable<Card['documents']> {
    const rows = this.#store.db
      .prepare('SELECT id, rel_path, mime, label, page_count FROM documents WHERE page_id = ? LIMIT 8')
      .all(pageId) as {
      id: string;
      rel_path: string;
      mime: string | null;
      label: string | null;
      page_count: number | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      rel_path: row.rel_path,
      ...(row.mime ? { mime: row.mime } : {}),
      ...(row.label ? { label: row.label } : {}),
      ...(row.page_count !== null ? { pages: row.page_count } : {}),
    }));
  }
}

/**
 * §7. Facts are never returned to the agent on their own. They arrive attached to
 * the page card they belong to, so a claim is always seen in its context — here,
 * as the confidence on the line the fact was derived from.
 */
function attachConfidence(line: Line, facts: FactRow[]): Line {
  const live = facts.filter((fact) => fact.line_start === line.n && fact.valid_to === null);
  if (live.length === 0) return line;
  const best = live.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  return { ...line, confidence: best.confidence };
}

function supersededFor(facts: FactRow[]): SupersededClaim[] {
  return facts
    .filter((fact) => fact.valid_to !== null)
    .slice(0, 6)
    .map((fact) => ({ claim: fact.claim, valid_to: fact.valid_to! }));
}

/**
 * §9. Deterministic — did the key terms of the expanded query actually appear in
 * what was returned — **not** a model judging whether the answer is there. Cheap,
 * honest, and it closes the most common hallucination path there is: a page ranks
 * first because it matches half the question, the agent reads it, and confidently
 * invents the other half.
 */
export function computeCoverage(concepts: string[], cards: Card[]): Record<string, boolean> {
  const haystack = cards
    .map((card) =>
      [card.title, card.summary ?? '', card.breadcrumb ?? '', ...card.lines.map((l) => l.text)].join(' '),
    )
    .join(' ')
    .toLowerCase();

  const coverage: Record<string, boolean> = {};
  for (const concept of concepts) {
    const terms = concept
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2);
    if (terms.length === 0) continue;
    // Every content word of the concept must appear somewhere in what came back.
    // Partial credit would defeat the purpose: "found the policy but not the
    // renewal date" is the answer that matters.
    coverage[concept] = terms.every((term) => haystack.includes(stem(term)));
  }
  return coverage;
}

/** Just enough stemming to survive plurals. A real stemmer is FTS5's job. */
function stem(term: string): string {
  if (term.length > 4 && term.endsWith('ies')) return term.slice(0, -3);
  if (term.length > 3 && term.endsWith('es')) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1);
  return term;
}

/**
 * Four characters per token. Crude, but the budget's job is to stop an overrun,
 * and a tokenizer per model would make the number precise about the wrong thing —
 * the caller's budget is a ceiling, not an accounting target.
 */
export function estimateTokens(card: Card): number {
  const text = [
    card.slug,
    card.title,
    card.summary ?? '',
    card.breadcrumb ?? '',
    ...card.lines.map((line) => line.text),
    ...(card.superseded ?? []).map((entry) => entry.claim),
    ...(card.links ?? []),
  ].join(' ');
  // +24 for the card's own structural overhead: keys, scores, line numbers.
  return Math.ceil(text.length / 4) + 24;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
