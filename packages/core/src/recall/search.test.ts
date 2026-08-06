import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import type { Store } from '../store/db.ts';
import { normalizeScores, rerankHits, toMatchExpression, type ChunkHit } from './search.ts';

describe('toMatchExpression', () => {
  it('turns a natural-language query into a legal FTS5 expression', () => {
    const expression = toMatchExpression('when does the car insurance renew?');
    expect(expression).toContain('"car"');
    expect(expression).not.toContain('?');
    expect(expression).toContain(' OR ');
  });

  it('quotes the whole phrase as well as each token', () => {
    expect(toMatchExpression('car insurance')).toBe('"car insurance" OR "car" OR "insurance"');
  });

  it('survives punctuation that FTS5 would reject', () => {
    for (const query of ['NEAR', 'a"b', '(unbalanced', 'x AND OR NOT', '- -- ---']) {
      const expression = toMatchExpression(query);
      // Whatever comes out must be something FTS5 will actually accept.
      if (expression === null) continue;
      const db = new Database(':memory:');
      db.exec("CREATE VIRTUAL TABLE t USING fts5(text, tokenize='porter unicode61')");
      db.prepare('INSERT INTO t(text) VALUES (?)').run('some indexed prose');
      expect(() => db.prepare('SELECT rowid FROM t WHERE t MATCH ?').all(expression)).not.toThrow();
      db.close();
    }
  });

  it('returns null when there is nothing searchable left', () => {
    expect(toMatchExpression('?!')).toBeNull();
    expect(toMatchExpression('a')).toBeNull();
  });
});

describe('normalizeScores', () => {
  it('puts fused ranks on a readable scale, best hit at 1', () => {
    const normalized = normalizeScores([
      { chunkId: 1, pageId: 'a', score: 0.032, from: ['lexical'] },
      { chunkId: 2, pageId: 'b', score: 0.016, from: ['vector'] },
    ]);
    expect(normalized[0]!.score).toBe(1);
    expect(normalized[1]!.score).toBe(0.5);
  });

  it('preserves order', () => {
    const hits: ChunkHit[] = [
      { chunkId: 1, pageId: 'a', score: 0.2, from: ['lexical'] },
      { chunkId: 2, pageId: 'b', score: 0.1, from: ['lexical'] },
      { chunkId: 3, pageId: 'c', score: 0.05, from: ['lexical'] },
    ];
    expect(normalizeScores(hits).map((hit) => hit.chunkId)).toEqual([1, 2, 3]);
  });

  it('leaves a degenerate set alone rather than dividing by zero', () => {
    expect(normalizeScores([])).toEqual([]);
    const zeroed: ChunkHit[] = [{ chunkId: 1, pageId: 'a', score: 0, from: ['lexical'] }];
    expect(normalizeScores(zeroed)).toEqual(zeroed);
  });
});

/**
 * The regression this guards: a cross-encoder emits logits spanning roughly -12
 * to +8, while fusion emits reciprocal ranks around 0.016. Returning both in one
 * array let a later `Math.max` over a page's chunks prefer a mediocre *fused* hit
 * to a confidently *judged* one — so the reranker ran, cost its latency, and
 * changed nothing.
 */
describe('rerankHits', () => {
  function fakeStore(chunks: { id: number; text: string }[]): Store {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE chunks (id INTEGER PRIMARY KEY, heading_path TEXT, text TEXT)');
    const insert = db.prepare('INSERT INTO chunks(id, heading_path, text) VALUES (?, ?, ?)');
    for (const chunk of chunks) insert.run(chunk.id, '', chunk.text);
    return { db } as unknown as Store;
  }

  /** Only what `rerankHits` touches. Typed through ModelClient so a change to the
   *  real surface breaks these stubs rather than letting them drift. */
  function stubReranker(overrides: Partial<ModelClient> = {}): ModelClient {
    return {
      available: true,
      requested: true,
      unavailableReason: null,
      modelId: 'fake',
      role: 'reranker',
      degradedReason: () => 'rerank_failed',
      ...overrides,
    } as unknown as ModelClient;
  }

  function fakeReranker(scores: number[]): ModelClient {
    return stubReranker({
      rerank: async () => ({
        ok: true,
        value: scores.map((score, index) => ({ index, score })),
        latencyMs: 1,
      }),
    } as unknown as Partial<ModelClient>);
  }

  const hits: ChunkHit[] = Array.from({ length: 5 }, (_, i) => ({
    chunkId: i + 1,
    pageId: `page-${i + 1}`,
    score: 0.02 - i * 0.001,
    from: ['lexical' as const],
  }));
  const store = fakeStore(hits.map((hit) => ({ id: hit.chunkId, text: `chunk ${hit.chunkId}` })));

  it('maps logits onto a 0..1 relevance scale', async () => {
    const result = await rerankHits(store, fakeReranker([4.2, -11]), 'q', hits.slice(0, 2), 2);
    expect(result.degraded).toBeNull();
    expect(result.hits[0]!.score).toBeGreaterThan(0.9);
    expect(result.hits[1]!.score).toBeLessThan(0.1);
  });

  it('keeps a judged hit above every un-judged one, whatever its logit', async () => {
    // Only the first two are reranked, and both score badly. They must still
    // outrank the tail: the reranker looked at them and the tail it never saw.
    const result = await rerankHits(store, fakeReranker([-8, -9]), 'q', hits, 2);
    const judged = result.hits.slice(0, 2);
    const tail = result.hits.slice(2);
    expect(judged.map((hit) => hit.chunkId)).toEqual([1, 2]);
    for (const tailHit of tail) {
      expect(tailHit.score).toBeLessThanOrEqual(Math.min(...judged.map((hit) => hit.score)));
    }
  });

  it('leaves the whole result set monotonically ordered', async () => {
    const result = await rerankHits(store, fakeReranker([1, -2, 3]), 'q', hits, 3);
    const scores = result.hits.map((hit) => hit.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('reports a rerank that returned nothing instead of silently not reranking', async () => {
    const empty = stubReranker({
      rerank: async () => ({ ok: true, value: [], latencyMs: 1 }),
    } as unknown as Partial<ModelClient>);
    const result = await rerankHits(store, empty, 'q', hits, 3);
    expect(result.degraded).toBe('rerank_failed');
    expect(result.note).toBe('rerank returned no results');
  });

  it('degrades rather than throwing when the endpoint fails', async () => {
    const broken = stubReranker({
      rerank: async () => ({
        ok: false,
        value: null,
        reason: 'timeout',
        error: 'reranker timed out',
        latencyMs: 1,
      }),
    } as unknown as Partial<ModelClient>);
    const result = await rerankHits(store, broken, 'q', hits, 3);
    // The reason is a value the caller branches on; the message is for a human.
    expect(result.degraded).toBe('rerank_failed');
    expect(result.note).toBe('reranker timed out');
    expect(result.hits).toEqual(hits);
  });

  it('names an unconfigured reranker differently from a broken one', async () => {
    const absent = stubReranker({
      available: false,
      unavailableReason: 'no model id configured for reranker',
      degradedReason: () => 'no_reranker',
    } as unknown as Partial<ModelClient>);
    const result = await rerankHits(store, absent, 'q', hits, 3);
    expect(result.degraded).toBe('no_reranker');
  });
});
