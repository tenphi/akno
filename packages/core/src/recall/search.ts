import { randomBytes } from 'node:crypto';
import type { DegradedReason } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import type { ModelClient } from '../models/client.ts';
import { rerankWithLlm, type LlmRerankCandidate } from './llm-rerank.ts';

export interface ChunkHit {
  chunkId: number;
  pageId: string | null;
  /** Native evidence identity. Present for both owned and orphan document chunks. */
  documentId?: string | null;
  score: number;
  /** Which arms found it. Used by fusion to merge duplicates across arms. */
  from: ('vector' | 'lexical')[];
  /**
   * An absolute 0..1 relevance, when an arm produced one: cosine from the vector arm,
   * replaced by the cross-encoder's judgement when reranking runs. Undefined after a
   * lexical-only search, because bm25 has no absolute interpretation.
   */
  relevance?: number;
}

export interface SearchOptions {
  /** Queries for the lexical arm. */
  queries: string[];
  /** Texts for the vector arm — in question mode, hypothetical answers. */
  vectorTexts: string[];
  candidatesPerArm: number;
  /** Restrict both arms to these native chunk identities. Used by recall filters. */
  chunkIds?: Set<number>;
  /** Above this many vectors, restrict the vector arm to lexical candidates. */
  prefilterAbove?: number;
}

export interface SearchResult {
  hits: ChunkHit[];
  degraded: DegradedReason[];
  /** Human-readable detail for logs and `doctor`, never for control flow. */
  notes: string[];
}

/**
 * Pipeline: query expansion → vector + FTS5 hybrid → rerank → group hits by
 * page → build cards → fill budget. This module is the middle: two arms, fused.
 *
 * FTS5 does not care about size — it is sub-millisecond at 2,000 chunks and at
 * 100,000. The vector arm is brute force by decision, which is exact and
 * fast enough an order of magnitude past the knowledge base this is built for.
 */
export async function hybridSearch(
  store: Store,
  embedding: ModelClient,
  options: SearchOptions,
): Promise<SearchResult> {
  const degraded: DegradedReason[] = [];
  const notes: string[] = [];

  const lexical = lexicalSearch(store, options.queries, options.candidatesPerArm, options.chunkIds);

  let vector: ChunkHit[] = [];
  if (embedding.available) {
    const embedded = await embedding.embed(options.vectorTexts);
    if (embedded.ok && embedded.value) {
      // Candidate pre-filtering. Scoring only the lexical candidate
      // set instead of every vector raises the ceiling several-fold for free —
      // but it cannot help a purely semantic query with no lexical overlap, so it
      // is a fallback for a knowledge base past the brute-force threshold, not
      // the default. Below the threshold, an exact scan of everything is both
      // faster than it needs to be and strictly more accurate.
      const lexicalPrefilter =
        options.prefilterAbove !== undefined && store.vectors.count() > options.prefilterAbove
          ? new Set(lexical.map((hit) => hit.chunkId))
          : undefined;
      const prefilter = intersect(options.chunkIds, lexicalPrefilter);
      if (lexicalPrefilter)
        notes.push(`vector scan pre-filtered to ${prefilter?.size ?? 0} lexical candidates`);
      vector = vectorSearch(store, embedded.value, options.candidatesPerArm, prefilter);
    } else {
      degraded.push(embedding.degradedReason(embedded));
      if (embedded.error) notes.push(embedded.error);
    }
  } else {
    degraded.push(embedding.degradedReason({}));
    if (embedding.unavailableReason) notes.push(embedding.unavailableReason);
  }

  return { hits: fuse([lexical, vector]), degraded, notes };
}

/**
 * FTS5 with bm25 ranking. Every query in the expansion runs separately and the
 * results fuse, rather than being OR-ed into one giant MATCH — a single query
 * with eight alternatives ranks a chunk matching one weak term above a chunk
 * matching the original phrase.
 */
function lexicalSearch(store: Store, queries: string[], limit: number, chunkIds?: Set<number>): ChunkHit[] {
  const perQuery: ChunkHit[][] = [];

  for (const query of queries) {
    const match = toMatchExpression(query);
    if (!match) continue;
    try {
      const rows = store.db
        .prepare(
          `SELECT c.id AS chunk_id, c.page_id, c.document_id,
                  bm25(chunks_fts, 1.0, 2.0) AS rank
             FROM chunks_fts
             JOIN chunks c ON c.id = chunks_fts.rowid
            WHERE chunks_fts MATCH ?
              ${chunkIds ? 'AND c.id IN (SELECT value FROM json_each(?))' : ''}
            ORDER BY rank
            LIMIT ?`,
        )
        .all(match, ...(chunkIds ? [JSON.stringify([...chunkIds])] : []), limit) as {
        chunk_id: number;
        page_id: string | null;
        document_id: string | null;
        rank: number;
      }[];

      perQuery.push(
        rows
          // bm25 returns negative numbers, more negative being better.
          .map((row) => ({
            chunkId: row.chunk_id,
            pageId: row.page_id,
            documentId: row.document_id,
            score: -row.rank,
            from: ['lexical' as const],
          })),
      );
    } catch {
      // A MATCH expression FTS5 rejects is a bad query, not a broken index.
      continue;
    }
  }

  return fuse(perQuery);
}

function vectorSearch(
  store: Store,
  vectors: Float32Array[],
  limit: number,
  prefilter?: Set<number>,
): ChunkHit[] {
  const perVector: ChunkHit[][] = [];
  const identityOf = store.db.prepare('SELECT page_id, document_id FROM chunks WHERE id = ?');

  for (const vector of vectors) {
    if (vector.length !== store.vectors.dimensions) continue;
    const hits = store.vectors.search(vector, limit, prefilter);
    const mapped: ChunkHit[] = [];
    for (const hit of hits) {
      const row = identityOf.get(hit.chunkId) as
        { page_id: string | null; document_id: string | null } | undefined;
      if (!row) continue;
      mapped.push({
        chunkId: hit.chunkId,
        pageId: row.page_id,
        documentId: row.document_id,
        score: hit.score,
        from: ['vector'],
        // Cosine is already an absolute similarity, so it survives fusion as the
        // answer to "is this actually a good match?" — which the fused rank is not.
        relevance: Math.max(0, Math.min(1, hit.score)),
      });
    }
    perVector.push(mapped);
  }

  return fuse(perVector);
}

/** Undefined means unrestricted; when both restrictions exist, both must hold. */
function intersect(left?: Set<number>, right?: Set<number>): Set<number> | undefined {
  if (!left) return right;
  if (!right) return left;
  const out = new Set<number>();
  for (const value of left) if (right.has(value)) out.add(value);
  return out;
}

/**
 * Reciprocal rank fusion. Chosen over score normalization because bm25 and
 * cosine are not on comparable scales and never will be — RRF only needs the
 * ordering within each arm, which is the one thing both arms are reliable about.
 */
const RRF_K = 60;

function fuse(lists: ChunkHit[][]): ChunkHit[] {
  const populated = lists.filter((list) => list.length > 0);
  // One list needs no fusion, and passing it through keeps its own scores rather
  // than flattening them all onto the reciprocal-rank scale.
  if (populated.length <= 1) return populated[0] ?? [];

  const merged = new Map<number, ChunkHit>();
  for (const list of populated) {
    const sorted = [...list].sort((a, b) => b.score - a.score);
    for (let rank = 0; rank < sorted.length; rank++) {
      const hit = sorted[rank]!;
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = merged.get(hit.chunkId);
      if (existing) {
        existing.score += contribution;
        for (const arm of hit.from) if (!existing.from.includes(arm)) existing.from.push(arm);
        if (hit.relevance !== undefined) {
          existing.relevance = Math.max(existing.relevance ?? 0, hit.relevance);
        }
      } else {
        merged.set(hit.chunkId, { ...hit, score: contribution, from: [...hit.from] });
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score);
}

/**
 * FTS5's MATCH syntax will happily reject a natural-language query — a bare `?`,
 * an unbalanced quote, a stray `NEAR`. Quoting every token and OR-ing them makes
 * any user input a legal expression, which matters because a thrown syntax error
 * here would read to the caller as "nothing matched".
 */
export function toMatchExpression(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^[-']+|[-']+$/g, ''))
    .filter((token) => token.length > 1);

  if (tokens.length === 0) return null;
  // A quoted phrase for the whole query, plus each token, so an exact phrase
  // outranks a bag of words without excluding partial matches.
  const quoted = tokens.map((token) => `"${token.replace(/"/g, '')}"`);
  const phrase = tokens.length > 1 ? `"${tokens.join(' ')}" OR ` : '';
  return `${phrase}${quoted.join(' OR ')}`;
}

/**
 * Without a reranker, hybrid score ordering stands. With one, the top
 * candidates are re-scored against the original query. A native cross-encoder
 * sees each query/passage pair; LLM mode applies one guarded listwise prompt.
 *
 * Two measured facts about cost, since they are counter-intuitive: the reranker is
 * by far the most expensive stage in the pipeline (≈1s against ≈33ms for embedding
 * and ≈4ms for the lexical arm on a local bge-reranker-v2-m3), and its cost is per
 * *candidate*, not per character. So `topK` is the only real latency dial, and
 * turning it down trades away which pages come back — see `config/default.jsonc`.
 *
 * The output is on **one scale with the un-reranked tail**, which is not a detail.
 * A cross-encoder emits logits (bge-reranker spans roughly -12 to +8) while fusion
 * emits reciprocal ranks around 0.01-0.2. Returning both in one array means any
 * later `Math.max` over a page's chunks prefers a mediocre fused hit to a
 * confidently-judged one, and the reranker silently stops mattering.
 */
export async function rerankHits(
  store: Store,
  reranker: ModelClient,
  query: string,
  hits: ChunkHit[],
  topK: number,
  maxChars = 800,
  /**
   * Where this model puts the relevant/irrelevant boundary on its own logit scale. Subtracted
   * before the sigmoid so that boundary lands on 0.5, which is what every threshold downstream
   * already assumes. 0 leaves a model already centred there untouched.
   */
  scoreOffset = 0,
): Promise<{ hits: ChunkHit[]; degraded: DegradedReason | null; note: string | null }> {
  if (!reranker.available || hits.length <= 1) {
    return reranker.available
      ? { hits, degraded: null, note: null }
      : { hits, degraded: reranker.degradedReason({}), note: reranker.unavailableReason };
  }

  const candidates = hits.slice(0, topK);
  // One prepared statement for the whole batch rather than one per candidate.
  const select = store.db.prepare('SELECT heading_path, text FROM chunks WHERE id = ?');
  const texts = candidates.map((hit) => {
    const row = select.get(hit.chunkId) as { heading_path: string; text: string } | undefined;
    if (!row) return '';
    const full = row.heading_path ? `${row.heading_path}\n${row.text}` : row.text;
    // Bounds the request payload. Measured as *free* rather than fast: truncating
    // from the 4,000-char chunk cap to 800 changed neither latency (1036 → 1028 ms)
    // nor a single result across 8 queries, because this reranker's cost is per
    // candidate, not per character. `topK` is the latency dial, and lowering that
    // does change which pages come back. Kept anyway — a cross-encoder's relevance
    // signal is front-loaded, and an unbounded payload is worth not having.
    return full.length > maxChars ? full.slice(0, maxChars) : full;
  });

  if (reranker.rerankerMode === 'llm') {
    const ids = new Set<string>();
    const llmCandidates: LlmRerankCandidate[] = candidates.map((hit, index) => {
      let id: string;
      do id = `c_${randomBytes(9).toString('base64url')}`;
      while (ids.has(id));
      ids.add(id);
      return {
        id,
        text: texts[index] ?? '',
        sourceKind: hit.pageId ? 'page' : 'document',
        matchedBy: hit.from,
      };
    });
    const result = await rerankWithLlm(reranker, query, llmCandidates);
    if (!result.ok || !result.value) {
      return { hits, degraded: reranker.degradedReason(result), note: result.error ?? null };
    }

    // The listwise model supplies the order. Scores encode only that order; the separately
    // returned relevance label is the absolute signal consumers may threshold.
    const reordered = result.value.map((entry, rank) => {
      const hit = candidates[entry.index]!;
      return {
        ...hit,
        score: (candidates.length - rank) / candidates.length,
        relevance: entry.relevance / 3,
      };
    });
    return withRescaledTail(hits, reordered);
  }

  const result = await reranker.rerank(query, texts, candidates.length);
  if (!result.ok || !result.value) {
    return { hits, degraded: reranker.degradedReason(result), note: result.error ?? null };
  }
  if (result.value.length === 0) {
    // An endpoint that answers 200 with no results has not reranked anything.
    // Reporting that is the difference between "coarser ordering" and a silent
    // regression nobody notices for months.
    return { hits, degraded: 'rerank_failed', note: 'rerank returned no results' };
  }

  const reordered: ChunkHit[] = [];
  for (const entry of result.value) {
    const hit = candidates[entry.index];
    // A logit through a sigmoid is a relevance in (0, 1) — comparable across
    // queries, and readable as a score rather than as a model internal.
    // The cross-encoder saw the query and the passage together, so its judgement
    // replaces cosine as the absolute signal rather than merging with it.
    //
    // `scoreOffset` is what makes "comparable" true across *models* as well as queries. Two
    // cross-encoders that rank a set identically can sit on entirely different scales: measured
    // here, an irrelevant pair scores ~−11 on bge-reranker-v2-m3 and ~−0.3 on
    // gte-reranker-modernbert-base, so the same 0.5 cutoff admits 0.8% of irrelevant pairs on
    // one and 42.5% on the other. Recentring here keeps every threshold downstream honest.
    const relevance = sigmoid(entry.score - scoreOffset);
    if (hit) reordered.push({ ...hit, score: relevance, relevance });
  }
  reordered.sort((a, b) => b.score - a.score);

  return withRescaledTail(hits, reordered);
}

function withRescaledTail(
  hits: ChunkHit[],
  reordered: ChunkHit[],
): { hits: ChunkHit[]; degraded: null; note: null } {
  const seen = new Set(reordered.map((hit) => hit.chunkId));
  const tail = hits.filter((hit) => !seen.has(hit.chunkId));

  // The reranker judged the top K; the tail was never looked at, so it cannot
  // outrank a judged hit. Compress it into the band below the weakest judged one,
  // preserving its fused order.
  const floor = reordered.at(-1)?.score ?? 0;
  const rescaledTail = tail.map((hit, index) => ({
    ...hit,
    score: (floor * (tail.length - index)) / (tail.length + 1),
  }));

  return { hits: [...reordered, ...rescaledTail], degraded: null, note: null };
}

function sigmoid(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Puts fused scores on a readable 0..1 scale when no reranker ran. Reciprocal
 * rank fusion produces values around 0.016 whose absolute magnitude means
 * nothing, and a card reporting `score: 0.016` reads as "barely a match" when it
 * is in fact the best hit in the knowledge base.
 *
 * The result is **relative within one result set** — it says how this hit compares
 * to the best hit here, not how relevant it is in the abstract. That is the only
 * honest reading of a fused rank, and it is what the field is documented as.
 */
export function normalizeScores(hits: ChunkHit[]): ChunkHit[] {
  if (hits.length === 0) return hits;
  const best = Math.max(...hits.map((hit) => hit.score));
  if (!Number.isFinite(best) || best <= 0) return hits;
  return hits.map((hit) => ({ ...hit, score: hit.score / best }));
}
