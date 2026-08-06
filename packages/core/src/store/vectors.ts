import type { Database } from 'better-sqlite3';
import { VECTOR_FALLBACK_DDL, vectorTableDdl } from './migrations.ts';

interface VectorHit {
  chunkId: number;
  /** Cosine similarity in 0..1, already converted from distance. */
  score: number;
}

/**
 * §6. **Ship brute force, no ANN index.** Below ~20,000 chunks an approximate
 * index is strictly worse — it costs build time, recall accuracy and a second
 * structure to keep in sync, to save single-digit milliseconds nobody will
 * notice. `vec0` without an ANN index *is* exact brute force with SIMD, which is
 * precisely what we want, so the decision costs nothing to implement.
 */
export interface VectorIndex {
  readonly kind: 'vec0' | 'fallback';
  readonly dimensions: number;
  upsert(chunkId: number, embedding: Float32Array): void;
  remove(chunkId: number): void;
  removeForPage(pageId: string): void;
  /** `restrictTo` is the candidate pre-filter from §6 step 1: score only the
   *  FTS candidate set instead of every vector. Empty/undefined scans all. */
  search(query: Float32Array, k: number, restrictTo?: Set<number>): VectorHit[];
  count(): number;
  clear(): void;
}

function encodeVector(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

function decodeVector(buffer: Buffer): Float32Array {
  // Copy rather than alias: better-sqlite3 buffers are not guaranteed to outlive
  // the statement, and a dangling view is a very confusing bug.
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

/**
 * `vec0` rejects a bound JS number for an INTEGER PRIMARY KEY — better-sqlite3
 * sends it as a double. BigInt is required, which is easy to forget and produces
 * an error message that does not point at the cause.
 */
function key(chunkId: number): bigint {
  return BigInt(chunkId);
}

class Vec0Index implements VectorIndex {
  readonly kind = 'vec0' as const;
  readonly #db: Database;
  readonly dimensions: number;

  constructor(db: Database, dimensions: number) {
    this.#db = db;
    this.dimensions = dimensions;
  }

  upsert(chunkId: number, embedding: Float32Array): void {
    this.#db.prepare('DELETE FROM vec_chunks WHERE chunk_id = ?').run(key(chunkId));
    this.#db
      .prepare('INSERT INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)')
      .run(key(chunkId), encodeVector(embedding));
  }

  remove(chunkId: number): void {
    this.#db.prepare('DELETE FROM vec_chunks WHERE chunk_id = ?').run(key(chunkId));
  }

  removeForPage(pageId: string): void {
    const ids = this.#db.prepare('SELECT id FROM chunks WHERE page_id = ?').all(pageId) as { id: number }[];
    const stmt = this.#db.prepare('DELETE FROM vec_chunks WHERE chunk_id = ?');
    for (const { id } of ids) stmt.run(key(id));
  }

  search(query: Float32Array, k: number, restrictTo?: Set<number>): VectorHit[] {
    if (restrictTo && restrictTo.size === 0) return [];
    const blob = encodeVector(query);

    // vec0's KNN clause does not compose with an arbitrary WHERE, so a
    // pre-filtered search scores the candidate set directly instead.
    if (restrictTo) {
      const placeholders = [...restrictTo].map(() => '?').join(',');
      const rows = this.#db
        .prepare(
          `SELECT chunk_id, vec_distance_cosine(embedding, ?) AS distance
             FROM vec_chunks WHERE chunk_id IN (${placeholders})
            ORDER BY distance LIMIT ?`,
        )
        .all(blob, ...[...restrictTo].map(key), k) as { chunk_id: number; distance: number }[];
      return rows.map((r) => ({ chunkId: Number(r.chunk_id), score: 1 - r.distance }));
    }

    const rows = this.#db
      .prepare(
        `SELECT chunk_id, distance FROM vec_chunks
          WHERE embedding MATCH ? AND k = ? ORDER BY distance`,
      )
      .all(blob, k) as { chunk_id: number; distance: number }[];
    return rows.map((r) => ({ chunkId: Number(r.chunk_id), score: 1 - r.distance }));
  }

  count(): number {
    const row = this.#db.prepare('SELECT count(*) AS c FROM vec_chunks').get() as { c: number };
    return row.c;
  }

  clear(): void {
    this.#db.exec('DELETE FROM vec_chunks');
  }
}

/** Pure-SQLite fallback with cosine in JS, for a platform sqlite-vec cannot load. */
class FallbackIndex implements VectorIndex {
  readonly kind = 'fallback' as const;
  readonly #db: Database;
  readonly dimensions: number;

  constructor(db: Database, dimensions: number) {
    this.#db = db;
    this.dimensions = dimensions;
    this.#db.exec(VECTOR_FALLBACK_DDL);
  }

  upsert(chunkId: number, embedding: Float32Array): void {
    let sumSquares = 0;
    for (const value of embedding) sumSquares += value * value;
    this.#db
      .prepare(
        `INSERT INTO vec_fallback(chunk_id, embedding, norm) VALUES (?, ?, ?)
           ON CONFLICT(chunk_id) DO UPDATE SET embedding = excluded.embedding, norm = excluded.norm`,
      )
      .run(chunkId, encodeVector(embedding), Math.sqrt(sumSquares) || 1);
  }

  remove(chunkId: number): void {
    this.#db.prepare('DELETE FROM vec_fallback WHERE chunk_id = ?').run(chunkId);
  }

  removeForPage(pageId: string): void {
    this.#db
      .prepare('DELETE FROM vec_fallback WHERE chunk_id IN (SELECT id FROM chunks WHERE page_id = ?)')
      .run(pageId);
  }

  search(query: Float32Array, k: number, restrictTo?: Set<number>): VectorHit[] {
    if (restrictTo && restrictTo.size === 0) return [];
    let queryNorm = 0;
    for (const value of query) queryNorm += value * value;
    queryNorm = Math.sqrt(queryNorm) || 1;

    const rows = this.#db.prepare('SELECT chunk_id, embedding, norm FROM vec_fallback').all() as {
      chunk_id: number;
      embedding: Buffer;
      norm: number;
    }[];

    const hits: VectorHit[] = [];
    for (const row of rows) {
      if (restrictTo && !restrictTo.has(row.chunk_id)) continue;
      const vector = decodeVector(row.embedding);
      if (vector.length !== query.length) continue;
      let dot = 0;
      for (let i = 0; i < query.length; i++) dot += query[i]! * vector[i]!;
      hits.push({ chunkId: row.chunk_id, score: dot / (queryNorm * row.norm) });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, k);
  }

  count(): number {
    const row = this.#db.prepare('SELECT count(*) AS c FROM vec_fallback').get() as { c: number };
    return row.c;
  }

  clear(): void {
    this.#db.exec('DELETE FROM vec_fallback');
  }
}

export function openVectorIndex(db: Database, dimensions: number, vecLoaded: boolean): VectorIndex {
  if (!vecLoaded) return new FallbackIndex(db, dimensions);
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'vec_chunks'")
    .get();
  if (!exists) db.exec(vectorTableDdl(dimensions));
  return new Vec0Index(db, dimensions);
}

/**
 * Dimensions are recorded so a model swap triggers a re-index instead of
 * silently corrupting the index (§14). Returns true when the caller must
 * re-embed everything.
 */
export function reconcileDimensions(db: Database, dimensions: number, vecLoaded: boolean): boolean {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'embedding_dimensions'").get() as
    { value: string } | undefined;
  const recorded = row ? Number(row.value) : null;

  if (recorded === dimensions) return false;

  if (recorded !== null) {
    if (vecLoaded) db.exec('DROP TABLE IF EXISTS vec_chunks');
    db.exec('DROP TABLE IF EXISTS vec_fallback');
    db.exec('UPDATE chunks SET embedded = 0');
  }
  db.prepare(
    "INSERT INTO meta(key, value) VALUES('embedding_dimensions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(dimensions));
  return recorded !== null;
}
