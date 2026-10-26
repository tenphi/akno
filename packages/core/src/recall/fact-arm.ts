import { createHash } from 'node:crypto';
import type { RecallMatchArm } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import type { ModelClient } from '../models/client.ts';
import { toMatchExpression, type ChunkHit } from './search.ts';

/** Same constant as chunk fusion: only the order inside each list is trusted. */
const RRF_K = 60;

export interface FactHit {
  factId: string;
  pageId: string;
  line: number;
  /** Every page chunk whose line range holds the fact's source line. */
  chunkIds: number[];
  /** Reciprocal-rank score across the fact-level arms. Orders this list and nothing else. */
  score: number;
}

export interface FactSearchOptions {
  queries: string[];
  /** Query vectors already computed for the chunk vector arm. Empty disables the vector half. */
  vectors: Float32Array[];
  limit: number;
  /** Restrict to facts on these eligible chunks, exactly as the chunk arms are restricted. */
  chunkIds?: Set<number>;
}

export interface FactSearchResult {
  /** FTS5 over claim and triple, fused across the expanded queries. */
  lexical: FactHit[];
  /** Cosine over claim vectors, fused across the query vectors. */
  vector: FactHit[];
}

/**
 * Search live derived facts directly, keeping the lexical and vector halves apart so each can
 * join its own chunk arm. A fact is one restated sentence, so a hit here already names the line
 * that answers: chunk search finds a section and the card then shows that section's first
 * lines, which in a long section is not the line that matched.
 */
export function searchFacts(store: Store, options: FactSearchOptions): FactSearchResult {
  if (options.chunkIds && options.chunkIds.size === 0) return { lexical: [], vector: [] };
  const lexical = options.queries.map((query) => lexicalFacts(store, query, options.limit));
  const vector = options.vectors.length > 0 ? vectorFacts(store, options.vectors, options.limit) : [];
  return {
    lexical: locateFacts(store, fuseIds(lexical), options),
    vector: locateFacts(store, fuseIds(vector), options),
  };
}

/** One ranking of facts across both halves, for the fact list. */
export function fuseFactHits(lists: FactHit[][]): FactHit[] {
  const byId = new Map<string, FactHit>();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = byId.get(hit.factId);
      if (existing) existing.score += contribution;
      else byId.set(hit.factId, { ...hit, score: contribution });
    });
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function fuseIds(lists: string[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((factId, rank) => {
      scores.set(factId, (scores.get(factId) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return scores;
}

function locateFacts(store: Store, scores: Map<string, number>, options: FactSearchOptions): FactHit[] {
  if (scores.size === 0) return [];

  const locate = store.db.prepare(
    `SELECT f.page_id, f.line_start, c.id AS chunk_id
       FROM facts f
       JOIN chunks c ON c.page_id = f.page_id AND c.document_id IS NULL
                    AND f.line_start BETWEEN c.line_start AND c.line_end
      WHERE f.id = ? AND f.valid_to IS NULL`,
  );
  const hits: FactHit[] = [];
  for (const [factId, score] of [...scores.entries()].sort((a, b) => b[1] - a[1])) {
    const rows = locate.all(factId) as { page_id: string; line_start: number; chunk_id: number }[];
    const chunkIds = rows
      .map((row) => row.chunk_id)
      .filter((chunkId) => !options.chunkIds || options.chunkIds.has(chunkId));
    // A fact on no eligible chunk is outside this view or filter, however well it matched.
    if (chunkIds.length === 0) continue;
    hits.push({ factId, pageId: rows[0]!.page_id, line: rows[0]!.line_start, chunkIds, score });
    if (hits.length >= options.limit) break;
  }
  return hits;
}

function lexicalFacts(store: Store, query: string, limit: number): string[] {
  const match = toMatchExpression(query);
  if (!match) return [];
  try {
    const rows = store.db
      .prepare(
        `SELECT ff.fact_id
           FROM facts_fts ff
           JOIN facts f ON f.id = ff.fact_id
          WHERE facts_fts MATCH ? AND f.valid_to IS NULL
          ORDER BY bm25(facts_fts)
          LIMIT ?`,
      )
      .all(match, limit) as { fact_id: string }[];
    return rows.map((row) => row.fact_id);
  } catch {
    // A MATCH expression FTS5 rejects is a bad query, not a broken index.
    return [];
  }
}

/**
 * Brute-force cosine in JS. Exact, and cheap at personal-knowledge-base scale: a few thousand
 * claims. Past that this belongs in a `vec0` table like the chunk vectors.
 */
function vectorFacts(store: Store, vectors: Float32Array[], limit: number): string[][] {
  const rows = store.db
    .prepare(
      `SELECT v.fact_id, v.embedding, v.norm
         FROM fact_vectors v JOIN facts f ON f.id = v.fact_id
        WHERE f.valid_to IS NULL`,
    )
    .all() as { fact_id: string; embedding: Buffer; norm: number }[];
  if (rows.length === 0) return [];
  const decoded = rows.map((row) => ({
    factId: row.fact_id,
    vector: decodeVector(row.embedding),
    norm: row.norm,
  }));

  return vectors.map((query) => {
    let queryNorm = 0;
    for (const value of query) queryNorm += value * value;
    queryNorm = Math.sqrt(queryNorm) || 1;
    const scored: { factId: string; score: number }[] = [];
    for (const row of decoded) {
      if (row.vector.length !== query.length) continue;
      let dot = 0;
      for (let i = 0; i < query.length; i++) dot += query[i]! * row.vector[i]!;
      scored.push({ factId: row.factId, score: dot / (queryNorm * row.norm) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((entry) => entry.factId);
  });
}

/**
 * Mark, on each returned chunk, the lines whose facts matched the query, best first, so its card
 * shows them rather than the top of the section. Order and membership are left alone.
 */
export function targetFactLines(hits: ChunkHit[], facts: FactHit[]): ChunkHit[] {
  const lines = new Map<number, number[]>();
  for (const fact of facts) {
    for (const chunkId of fact.chunkIds) {
      const existing = lines.get(chunkId) ?? [];
      if (!existing.includes(fact.line)) existing.push(fact.line);
      lines.set(chunkId, existing);
    }
  }
  return hits.map((hit) => {
    const matched = lines.get(hit.chunkId);
    if (!matched) return hit;
    return { ...hit, lines: [...new Set([...matched, ...(hit.lines ?? [])])] };
  });
}

/**
 * Facts as a second representation of the chunks they sit in, merged into one chunk arm.
 *
 * Each chunk ranks by the better of its own text's rank and its best fact's rank in the same arm.
 * Taking the better rank rather than adding a vote matters: as a separate fused arm, facts gave
 * every fact-bearing chunk an extra vote, and documents and source pages — which never have
 * facts — sank below pages that merely had them. Here a chunk with no facts keeps its place.
 */
export function withFactRepresentation(chunks: ChunkHit[], facts: ChunkHit[]): ChunkHit[] {
  if (facts.length === 0) return chunks;
  const entries = new Map<number, { hit: ChunkHit; textRank: number; factRank: number }>();
  [...chunks]
    .sort((a, b) => b.score - a.score)
    .forEach((hit, rank) =>
      entries.set(hit.chunkId, { hit: { ...hit, from: [...hit.from] }, textRank: rank, factRank: Infinity }),
    );
  facts.forEach((hit, rank) => {
    const entry = entries.get(hit.chunkId);
    if (entry) {
      entry.factRank = Math.min(entry.factRank, rank);
      entry.hit.lines = [...new Set([...(entry.hit.lines ?? []), ...(hit.lines ?? [])])];
    } else {
      entries.set(hit.chunkId, { hit: { ...hit, from: [...hit.from] }, textRank: Infinity, factRank: rank });
    }
  });
  const ordered = [...entries.values()].sort((a, b) => {
    const best = Math.min(a.textRank, a.factRank) - Math.min(b.textRank, b.factRank);
    if (best !== 0) return best;
    // Equal best ranks: the chunk the other representation also ranked well goes first,
    // then text before facts, so a tie never demotes evidence that has no facts.
    const other = Math.max(a.textRank, a.factRank) - Math.max(b.textRank, b.factRank);
    if (other !== 0 && Number.isFinite(other)) return other;
    return a.textRank - b.textRank;
  });
  // Scores only carry the order into fusion, which reads nothing but rank.
  return ordered.map((entry, index) => ({ ...entry.hit, score: ordered.length - index }));
}

/**
 * Fact hits as a chunk ranking. Each chunk carries the lines its facts came from, so the card
 * built from it can show those lines rather than the top of the section. No `relevance` is set:
 * claim cosine is not on the scale auto-recall thresholds expect. `arm` names the search that
 * found the facts: cards keep the existing arm vocabulary, which older clients validate.
 */
export function factChunkHits(store: Store, facts: FactHit[], arm: RecallMatchArm): ChunkHit[] {
  const identity = store.db.prepare('SELECT page_id, document_id FROM chunks WHERE id = ?');
  const byChunk = new Map<number, ChunkHit>();
  for (const fact of facts) {
    for (const chunkId of fact.chunkIds) {
      const existing = byChunk.get(chunkId);
      if (existing) {
        if (!existing.lines!.includes(fact.line)) existing.lines!.push(fact.line);
        continue;
      }
      const row = identity.get(chunkId) as { page_id: string | null; document_id: string | null } | undefined;
      if (!row) continue;
      byChunk.set(chunkId, {
        chunkId,
        pageId: row.page_id,
        documentId: row.document_id,
        score: fact.score,
        from: [arm],
        lines: [fact.line],
      });
    }
  }
  return [...byChunk.values()];
}

export interface FactEmbedReport {
  embedded: number;
  warning: string | null;
}

/**
 * Embed every live fact without a vector for its current claim. Fact ids are stable while the
 * source line and claim stay the same, so an unchanged page costs nothing here; a re-derived
 * claim changes its hash and is embedded again.
 */
export async function embedPendingFacts(
  store: Store,
  embedding: ModelClient,
  options: { batch: number; force: boolean },
): Promise<FactEmbedReport> {
  if (!embedding.available) return { embedded: 0, warning: null };
  const rows = store.db
    .prepare(
      `SELECT f.id, f.claim, v.claim_hash
         FROM facts f LEFT JOIN fact_vectors v ON v.fact_id = f.id
        WHERE f.valid_to IS NULL
        ORDER BY f.id`,
    )
    .all() as { id: string; claim: string; claim_hash: string | null }[];
  const pending = rows.filter((row) => options.force || row.claim_hash !== claimHash(row.claim));
  if (pending.length === 0) return { embedded: 0, warning: null };

  const upsert = store.db.prepare(
    `INSERT INTO fact_vectors(fact_id, claim_hash, embedding, norm) VALUES (?, ?, ?, ?)
       ON CONFLICT(fact_id) DO UPDATE SET
         claim_hash = excluded.claim_hash, embedding = excluded.embedding, norm = excluded.norm`,
  );
  let embedded = 0;
  for (let i = 0; i < pending.length; i += options.batch) {
    const batch = pending.slice(i, i + options.batch);
    const result = await embedding.embed(batch.map((row) => row.claim));
    if (!result.ok || !result.value) {
      // Same contract as chunk embedding: what is missing is picked up by the next pass.
      return {
        embedded,
        warning: `fact embedding stopped after ${embedded} facts: ${result.error ?? 'unknown error'}`,
      };
    }
    store.transaction(() => {
      batch.forEach((row, index) => {
        const vector = result.value![index];
        if (!vector) return;
        let sumSquares = 0;
        for (const value of vector) sumSquares += value * value;
        upsert.run(row.id, claimHash(row.claim), encodeVector(vector), Math.sqrt(sumSquares) || 1);
      });
    });
    embedded += batch.length;
  }
  return { embedded, warning: null };
}

function claimHash(claim: string): string {
  return createHash('sha256').update(claim).digest('hex').slice(0, 16);
}

function encodeVector(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

function decodeVector(buffer: Buffer): Float32Array {
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}
