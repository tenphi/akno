import fs from 'node:fs';
import path from 'node:path';
import { annotateLines, LINE_FACT_COLUMNS, type LineFact } from '../kb/line-facts.ts';
import type {
  Card,
  Depth,
  DocumentCard,
  Line,
  PageRole,
  RecallMode,
  RecallResult,
  SupersededClaim,
} from '@tenphi/akno-protocol';
import type { AknoConfig } from '../config/schema.ts';
import type { Store } from '../store/db.ts';
import { isObservation } from '../kb/page.ts';
import { effectiveRule } from '../rules/compile.ts';
import { cleanSlug } from '../ingest/name.ts';
import { documentAvailability } from '../ingest/availability.ts';
import type { ChunkHit } from './search.ts';

export interface AssembleOptions {
  hits: ChunkHit[];
  mode: RecallMode;
  depth: Depth;
  limit: number;
  budget: number;
  /** Body lines per card: lookup gets deep windows, question gets tight ones. */
  lineWindow: number;
  /** Concepts the query asked about. Terms are matched against what came back. */
  concepts: string[];
  /** `include: ['source'], depth: 'full'` lifts the source quote cap. */
  include: PageRole[] | null;
}

export interface Assembled {
  results: RecallResult[];
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
  role: PageRole;
  summary: string | null;
  keywords: string | null;
  body_line: number;
  updated_at: string | null;
}

type FactRow = LineFact & { claim: string };

/**
 * Recall returns page or document cards — never chunks. A chunk boundary is an
 * indexing artifact and means nothing to a reader.
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
    const byPage = new Map<string, { score: number; hits: ChunkHit[]; relevance?: number }>();
    const byDocument = new Map<string, { score: number; hits: ChunkHit[]; relevance?: number }>();
    for (const hit of options.hits) {
      const group = hit.pageId ? byPage : hit.documentId ? byDocument : null;
      const id = hit.pageId ?? hit.documentId;
      if (!group || !id) continue;
      const entry = group.get(id);
      if (entry) {
        entry.hits.push(hit);
        entry.score = Math.max(entry.score, hit.score);
        if (hit.relevance !== undefined) entry.relevance = Math.max(entry.relevance ?? 0, hit.relevance);
      } else {
        group.set(id, {
          score: hit.score,
          hits: [hit],
          ...(hit.relevance !== undefined ? { relevance: hit.relevance } : {}),
        });
      }
    }

    const rankedPages = [...byPage.entries()]
      .map(([pageId, entry]) => ({ pageId, ...entry }))
      .map((entry) => {
        const page = this.pageRow(entry.pageId);
        return page
          ? {
              kind: 'page' as const,
              ranked: entry.score * this.rankFactor(page),
              result: this.pageResult(
                page,
                entry.hits,
                entry.score * this.rankFactor(page),
                entry.relevance,
                options,
              ),
            }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .filter((entry) => !options.include || options.include.includes(entry.result.role));

    // Orphan parts are grouped again by their durable group key. The search identity remains
    // the matching document id; assembly is where scanner-split files become one reader object.
    const orphanGroups = new Map<string, { score: number; hits: ChunkHit[]; relevance?: number }>();
    for (const [documentId, entry] of byDocument) {
      const row = this.documentRow(documentId);
      if (!row || row.page_id !== null) continue;
      const key = row.group_key ?? row.rel_path;
      const group = orphanGroups.get(key);
      if (group) {
        group.hits.push(...entry.hits);
        group.score = Math.max(group.score, entry.score);
        if (entry.relevance !== undefined) group.relevance = Math.max(group.relevance ?? 0, entry.relevance);
      } else {
        orphanGroups.set(key, { ...entry, hits: [...entry.hits] });
      }
    }

    const rankedDocuments = options.include
      ? []
      : [...orphanGroups.entries()].map(([groupKey, entry]) => {
          const ranked = entry.score * this.#config.recall.rank.source;
          return {
            kind: 'document' as const,
            ranked,
            result: this.buildDocumentCard(groupKey, entry.hits, ranked, entry.relevance, options),
          };
        });

    const ranked = mixedOrder(
      [...rankedPages, ...rankedDocuments].sort((a, b) => b.ranked - a.ranked),
      options.limit,
    );

    // One budget, one assembly — whole cards first. A half-card whose lines
    // were trimmed to fit is exactly the "disconnected fragment" the layer exists
    // to stop producing.
    const results: RecallResult[] = [];
    let budgetUsed = 0;
    let dropped = 0;

    for (const entry of ranked) {
      if (results.length >= options.limit) {
        dropped++;
        continue;
      }
      const cost = estimateTokens(entry.result);
      if (budgetUsed + cost > options.budget && results.length > 0) {
        dropped++;
        continue;
      }
      results.push(entry.result);
      budgetUsed += cost;
    }

    const cards = results.filter((result) => result.type === 'page').map(({ type: _type, ...card }) => card);

    return {
      results,
      cards,
      budgetUsed,
      coverage: options.mode === 'question' ? computeCoverage(options.concepts, results) : null,
      droppedCards: dropped,
    };
  }

  private pageResult(
    page: PageRow,
    hits: ChunkHit[],
    score: number,
    relevance: number | undefined,
    options: AssembleOptions,
  ): Extract<RecallResult, { type: 'page' }> {
    const card = this.buildCard(page, hits, score, options);
    if (relevance !== undefined) card.relevance = round(relevance);
    return { type: 'page', ...card };
  }

  /**
   * Ranking policy lives in the layer: knowledge pages outrank source pages,
   * which outrank derived inferences. A folder rule can set `rank` to
   * adjust it. Role applies at **assembly**, not at search — source pages
   * compete for relevance on equal terms, then come back capped.
   */
  private rankFactor(page: PageRow): number {
    const rule = effectiveRule(page.slug, this.#config.rules);
    if (typeof rule.rank === 'number') return rule.rank;
    if (isObservation(page.slug, this.#config.paths.observations) || page.role === 'inference') {
      return this.#config.recall.rank.inference;
    }
    return page.role === 'source' ? this.#config.recall.rank.source : this.#config.recall.rank.knowledge;
  }

  private pageRow(pageId: string): PageRow | null {
    const row = this.#store.db
      .prepare(
        `SELECT id, slug, rel_path, title, type, tags, role, summary, keywords, body_line, updated_at
           FROM pages WHERE id = ?`,
      )
      .get(pageId) as PageRow | undefined;
    return row ?? null;
  }

  private documentRow(documentId: string): DocumentRow | null {
    const row = this.#store.db
      .prepare(
        `SELECT id, page_id, rel_path, mime, label, page_count, group_key, part, summary,
                extract_via, confidence, ocr, text, availability, missing_since
           FROM documents WHERE id = ?`,
      )
      .get(documentId) as DocumentRow | undefined;
    return row ?? null;
  }

  private buildDocumentCard(
    groupKey: string,
    hits: ChunkHit[],
    score: number,
    relevance: number | undefined,
    options: AssembleOptions,
  ): DocumentCard {
    const rows = this.#store.db
      .prepare(
        `SELECT id, page_id, rel_path, mime, label, page_count, group_key, part, summary,
                extract_via, confidence, ocr, text, availability, missing_since
           FROM documents
          WHERE group_key = ? AND renders IS NULL AND page_id IS NULL
          ORDER BY part`,
      )
      .all(groupKey) as DocumentRow[];
    const first = rows[0]!;
    const bestHit = [...hits].sort((a, b) => b.score - a.score)[0]!;
    const bestPart = rows.find((row) => row.id === bestHit.documentId) ?? first;
    const meta = this.chunkMeta([bestHit.chunkId]).get(bestHit.chunkId);
    const via = extractionVia(bestPart);
    const availability = documentAvailability(this.#store.db, rows);

    return {
      type: 'document',
      id: first.id,
      path: first.rel_path,
      label: first.label ?? path.basename(first.rel_path),
      mime: first.mime,
      ...(bestPart.summary ? { summary: bestPart.summary } : {}),
      ...(options.depth !== 'summary' && meta
        ? { quote: quoteWindow(meta.text, this.#config.recall.sourceQuoteLines) }
        : {}),
      ...(meta?.doc_page !== null && meta?.doc_page !== undefined ? { matched_page: meta.doc_page } : {}),
      ...(rows.length > 1
        ? {
            parts: rows.map((row) => ({
              id: row.id,
              path: row.rel_path,
              pages: row.page_count,
            })),
          }
        : {}),
      source: {
        kind:
          via === 'vision'
            ? 'model_description'
            : via === 'ocr'
              ? 'ocr_text'
              : via === 'none'
                ? 'none'
                : 'original_text',
        via,
        confidence: bestPart.confidence,
      },
      availability,
      ownership: { status: 'orphan' },
      ...(availability.status === 'available' && this.canSuggestAdoption(first.rel_path)
        ? { suggested_actions: [{ op: 'adopt' as const, args: { documentId: first.id } }] }
        : {}),
      score: round(score),
      ...(relevance !== undefined ? { relevance: round(relevance) } : {}),
    };
  }

  private canSuggestAdoption(relPath: string): boolean {
    const adoption = this.#config.maintenance.adopt;
    if (!adoption.enabled || !adoption.mode) return false;
    const portable = relPath.replaceAll('\\', '/');
    const adoptionStem = cleanSlug(path.posix.basename(portable));
    if (!adoptionStem) return false;
    const directory = path.posix.dirname(portable);
    const slug = directory === '.' ? adoptionStem : `${directory}/${adoptionStem}`;
    const rule = effectiveRule(slug, this.#config.rules);
    return rule.ingest !== 'file' && rule.ingest !== 'ignore';
  }

  private buildCard(page: PageRow, hits: ChunkHit[], score: number, options: AssembleOptions): Card {
    const meta = this.chunkMeta(hits.map((hit) => hit.chunkId));

    // A hit inside an attachment is not a line of the Markdown page. Keeping the two apart
    // is what stops `readLines` from citing line 14 of a page because page 14 of a PDF
    // matched. Cite or stay quiet: a citation pointing at the wrong line is worse
    // than no citation.
    const bodyHits = hits.filter((hit) => !meta.get(hit.chunkId)?.document_id);
    const documentHits = hits.filter((hit) => meta.get(hit.chunkId)?.document_id);

    const chunk = meta.get((bodyHits[0] ?? hits[0]!).chunkId);
    const isSource = page.role === 'source' || chunk?.kind === 'source';
    const wantsFullSource = options.depth === 'full' && options.include?.includes('source');

    // Ten matching emails cost ten summaries, not ten threads.
    const maxLines =
      options.depth === 'summary'
        ? 0
        : isSource && !wantsFullSource
          ? this.#config.recall.sourceQuoteLines
          : options.depth === 'full'
            ? Number.POSITIVE_INFINITY
            : options.lineWindow;

    const lines =
      maxLines === 0 || bodyHits.length === 0 ? [] : this.readLines(page, bodyHits, maxLines, options.depth);
    const facts = this.factsFor(page.id);

    const card: Card = {
      slug: page.slug,
      title: page.title,
      role: page.role,
      summary: page.summary,
      score: round(score),
      lines: annotateLines(lines, facts),
    };

    if (chunk?.heading_path) card.breadcrumb = chunk.heading_path;
    if (page.updated_at) card.updated = page.updated_at.slice(0, 10);

    const superseded = supersededFor(facts);
    if (superseded.length > 0) card.superseded = superseded;

    const links = this.linksFor(page.id);
    if (links.length > 0) card.links = links;

    const documents = this.documentsFor(page.id, documentHits, meta, options);
    if (documents.length > 0) card.documents = documents;

    if (isSource && !wantsFullSource && lines.length >= maxLines) card.truncated = true;

    return card;
  }

  /**
   * Reads the matching lines from the file rather than from the chunk text, so a
   * line's number is the number it actually has on disk. A citation that points
   * at the wrong line is worse than no citation: cite or stay quiet.
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
        // Blank lines, bare headings, markers and image embeds cost budget and carry
        // nothing a reader can cite; the breadcrumb already says where they are.
        if (trimmed.length === 0) continue;
        if (/^#{1,6}\s/.test(trimmed) || /^<!--/.test(trimmed)) continue;
        if (/^!\[\[[^\]]+\]\]$/.test(trimmed) || /^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) continue;
        seen.add(n);
        out.push({ n, text });
      }
      if (out.length >= maxLines) break;
    }
    return out;
  }

  private factsFor(pageId: string): FactRow[] {
    return this.#store.db
      .prepare(`SELECT ${LINE_FACT_COLUMNS} FROM facts WHERE page_id = ?`)
      .all(pageId) as FactRow[];
  }

  private linksFor(pageId: string): string[] {
    const rows = this.#store.db
      .prepare(
        "SELECT DISTINCT to_slug FROM links WHERE from_page = ? AND broken = 0 AND kind != 'embed' LIMIT 12",
      )
      .all(pageId) as { to_slug: string }[];
    return rows.map((row) => row.to_slug);
  }

  /**
   * The page's attachments, with the matching text quoted from any that matched.
   *
   * The card points at the page, the document, **and the page number within it**. That
   * is the whole reason document text is chunked per page — a quote from page 9 of a
   * contract attributed to nothing is a citation a reader cannot check.
   *
   * A document that matched is always included, even past the display cap: dropping the one
   * that produced the hit would leave a card quoting evidence it does not list.
   */
  private documentsFor(
    pageId: string,
    documentHits: ChunkHit[],
    meta: Map<number, ChunkMeta>,
    options: AssembleOptions,
  ): NonNullable<Card['documents']> {
    // Best hit per document, in rank order — `documentHits` arrives best first. Keeping the
    // order matters once a document has parts: when two pages of one contract both match,
    // the card must quote the stronger one, not whichever file happens to be part one.
    const matched = new Map<string, ChunkMeta>();
    const rank: string[] = [];
    for (const hit of documentHits) {
      const row = meta.get(hit.chunkId);
      if (!row?.document_id || matched.has(row.document_id)) continue;
      matched.set(row.document_id, row);
      rank.push(row.document_id);
    }

    const rows = this.#store.db
      .prepare(
        `SELECT id, rel_path, mime, label, page_count, group_key, part, summary,
                text, availability, missing_since
           FROM documents
          WHERE page_id = ? AND renders IS NULL ORDER BY group_key, part`,
      )
      .all(pageId) as DocumentRow[];
    for (const [id] of matched) {
      if (rows.some((row) => row.id === id)) continue;
      // A document that matched is always included, even when it hangs off another page:
      // a card quoting evidence it does not list is a card a reader cannot follow.
      const row = this.#store.db
        .prepare(
          `SELECT id, rel_path, mime, label, page_count, group_key, part, summary,
                  text, availability, missing_since
             FROM documents WHERE id = ?`,
        )
        .get(id) as DocumentRow | undefined;
      if (row) rows.unshift(row);
    }

    // Parts of one document are one document. Collapsed onto part one, with the pages
    // summed, so a card says "the passport, 14 pages" rather than listing three files whose
    // page numbers each restart at 1.
    const groups = new Map<string, DocumentRow[]>();
    for (const row of rows) {
      const key = row.group_key ?? row.rel_path;
      const existing = groups.get(key);
      if (existing) existing.push(row);
      else groups.set(key, [row]);
    }

    const out: NonNullable<Card['documents']> = [];
    for (const parts of groups.values()) {
      const ordered = [...parts].sort((a, b) => a.part - b.part);
      const first = ordered[0]!;
      // The group's best-ranked matching part, not its first part.
      const bestId = rank.find((id) => ordered.some((part) => part.id === id));
      const hit = bestId === undefined ? undefined : matched.get(bestId);
      const pages = ordered.reduce<number | null>(
        (sum, part) => (part.page_count === null ? sum : (sum ?? 0) + part.page_count),
        null,
      );
      const availability = documentAvailability(this.#store.db, ordered);

      out.push({
        id: first.id,
        rel_path: first.rel_path,
        ...(first.mime ? { mime: first.mime } : {}),
        ...(first.label ? { label: first.label } : {}),
        ...(pages !== null ? { pages } : {}),
        ...(ordered.length > 1 ? { parts: ordered.length } : {}),
        // Only for the document that matched: a summary per attachment on every card would
        // spend the budget describing files nobody asked about.
        ...(hit && first.summary ? { summary: first.summary } : {}),
        // Already group-relative: the indexer stores each part's page numbers with the
        // pages before it added on.
        ...(hit?.doc_page !== null && hit?.doc_page !== undefined ? { matched_page: hit.doc_page } : {}),
        // Not quoted at `depth: "summary"`, which asks for cards without evidence windows.
        ...(hit && options.depth !== 'summary'
          ? { quote: quoteWindow(hit.text, this.#config.recall.sourceQuoteLines) }
          : {}),
        availability,
      });
    }
    return out;
  }

  /** One query for every hit chunk's metadata, rather than one per hit inside two loops. */
  private chunkMeta(chunkIds: number[]): Map<number, ChunkMeta> {
    if (chunkIds.length === 0) return new Map();
    const rows = this.#store.db
      .prepare(
        `SELECT id, heading_path, line_start, line_end, kind, document_id, doc_page, text
           FROM chunks WHERE id IN (${chunkIds.map(() => '?').join(',')})`,
      )
      .all(...chunkIds) as ChunkMeta[];
    return new Map(rows.map((row) => [row.id, row]));
  }
}

/**
 * Facts are never returned to the agent on their own. They arrive attached to
 * the page card they belong to, so a claim is always seen in its context — here,
 * as the confidence on the line the fact was derived from.
 */
function supersededFor(facts: FactRow[]): SupersededClaim[] {
  return facts
    .filter((fact) => fact.valid_to !== null)
    .slice(0, 6)
    .map((fact) => ({ claim: fact.claim, valid_to: fact.valid_to! }));
}

/**
 * Deterministic — did the key terms of the expanded query actually appear in
 * what was returned — **not** a model judging whether the answer is there. Cheap,
 * honest, and it closes the most common hallucination path there is: a page ranks
 * first because it matches half the question, the agent reads it, and confidently
 * invents the other half.
 */
export function computeCoverage(
  concepts: string[],
  results: Array<Card | RecallResult>,
): Record<string, boolean> {
  const haystack = results
    .map((result) => {
      if ('type' in result && result.type === 'document') {
        return [result.label, result.path, result.summary ?? '', result.quote ?? ''].join(' ');
      }
      return [
        result.title,
        result.summary ?? '',
        result.breadcrumb ?? '',
        ...result.lines.map((line) => line.text),
      ].join(' ');
    })
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
export function estimateTokens(card: Card | RecallResult): number {
  if ('type' in card && card.type === 'document') {
    const text = [
      card.path,
      card.label,
      card.summary ?? '',
      card.quote ?? '',
      ...(card.parts ?? []).map((part) => part.path),
    ].join(' ');
    return Math.ceil(text.length / 4) + 24;
  }
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

interface ChunkMeta {
  id: number;
  heading_path: string;
  line_start: number;
  line_end: number;
  kind: string;
  document_id: string | null;
  doc_page: number | null;
  text: string;
}

interface DocumentRow {
  id: string;
  page_id?: string | null;
  rel_path: string;
  mime: string | null;
  label: string | null;
  page_count: number | null;
  group_key: string | null;
  part: number;
  summary: string | null;
  extract_via?: string | null;
  confidence?: number | null;
  ocr?: number;
  text: string | null;
  availability: 'available' | 'missing';
  missing_since: string | null;
}

function extractionVia(row: DocumentRow): 'plain' | 'textutil' | 'text-layer' | 'ocr' | 'vision' | 'none' {
  if (
    row.extract_via === 'plain' ||
    row.extract_via === 'textutil' ||
    row.extract_via === 'text-layer' ||
    row.extract_via === 'ocr' ||
    row.extract_via === 'vision' ||
    row.extract_via === 'none'
  ) {
    return row.extract_via;
  }
  return row.ocr === 1 ? 'ocr' : row.text === null ? 'none' : 'plain';
}

interface RankedResult {
  kind: 'page' | 'document';
  ranked: number;
  result: RecallResult;
}

/**
 * A mixed result should not turn into "all pages" merely because a document ranked one place
 * below the limit (or vice versa). Absolute candidates must clear the calibrated 0.5 boundary;
 * a lexical-only match has no absolute scale, so matching FTS is its relevance floor.
 */
function mixedOrder(ranked: RankedResult[], limit: number): RankedResult[] {
  if (limit < 2) return ranked;
  const eligible = ranked.filter(
    (entry) => entry.result.relevance === undefined || entry.result.relevance >= 0.5,
  );
  const firstPage = eligible.find((entry) => entry.kind === 'page');
  const firstDocument = eligible.find((entry) => entry.kind === 'document');
  if (!firstPage || !firstDocument) return ranked;

  const head = ranked.slice(0, limit);
  if (head.some((entry) => entry.kind === 'page') && head.some((entry) => entry.kind === 'document')) {
    return ranked;
  }

  const missing = head[0]?.kind === 'page' ? firstDocument : firstPage;
  const kept = head.slice(0, limit - 1);
  return [...kept, missing, ...ranked.filter((entry) => !kept.includes(entry) && entry !== missing)];
}

/**
 * A source region comes back as **a capped quote window**, and a document is
 * source by nature. Capped in lines rather than characters so the same knob that
 * governs a fenced region governs this, and so a quote never ends mid-word.
 */
function quoteWindow(text: string, maxLines: number): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const kept = lines.slice(0, Math.max(1, maxLines));
  return kept.join('\n') + (lines.length > kept.length ? '\n…' : '');
}
