import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import type { Store } from '../store/db.ts';
import { fuseHits, normalizeScores, rerankHits, toMatchExpression, type ChunkHit } from './search.ts';

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

describe('fuseHits', () => {
  it('combines lexical and graph candidates by rank rather than mixing native score scales', () => {
    const fused = fuseHits([
      [
        { chunkId: 1, pageId: 'page-a', score: 1000, from: ['lexical'] },
        { chunkId: 2, pageId: 'page-b', score: 500, from: ['lexical'] },
      ],
      [
        { chunkId: 3, pageId: 'page-c', score: 0.000_001, from: ['graph'] },
        { chunkId: 2, pageId: 'page-b', score: 0.000_000_1, from: ['graph'] },
      ],
    ]);

    expect(fused[0]).toMatchObject({ chunkId: 2, from: ['lexical', 'graph'] });
    expect(fused.find((hit) => hit.chunkId === 1)?.score).toBe(fused.find((hit) => hit.chunkId === 3)?.score);
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
  function fakeStore(chunks: { id: number; text: string; slug?: string }[]): Store {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE pages (id TEXT PRIMARY KEY, slug TEXT NOT NULL);
      CREATE TABLE chunks (
        id INTEGER PRIMARY KEY,
        page_id TEXT,
        document_id TEXT,
        ord INTEGER NOT NULL,
        heading_path TEXT,
        text TEXT,
        line_start INTEGER NOT NULL,
        line_end INTEGER NOT NULL
      );
    `);
    const insertPage = db.prepare('INSERT INTO pages(id, slug) VALUES (?, ?)');
    const insert = db.prepare(
      `INSERT INTO chunks(
         id, page_id, document_id, ord, heading_path, text, line_start, line_end
       ) VALUES (?, ?, NULL, 0, ?, ?, 1, 100)`,
    );
    for (const chunk of chunks) {
      const pageId = `page-${chunk.id}`;
      insertPage.run(pageId, chunk.slug ?? `pages/page-${chunk.id}`);
      insert.run(chunk.id, pageId, '', chunk.text);
    }
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

  function fakeLlmReranker(
    order: (candidateIds: string[]) => { candidate_id: string; relevance: 0 | 1 | 2 | 3 }[],
  ): ModelClient {
    return stubReranker({
      rerankerMode: 'llm',
      chat: async (messages) => {
        const payload = JSON.parse(messages.at(-1)!.content) as {
          candidates: { candidate_id: string }[];
        };
        const entries = order(payload.candidates.map((candidate) => candidate.candidate_id));
        return {
          ok: true,
          value: JSON.stringify({
            j: Object.fromEntries(
              entries.map((entry, index) => [entry.candidate_id, { g: entry.relevance, r: index + 1 }]),
            ),
          }),
          latencyMs: 1,
          usage: { inputTokens: 111, outputTokens: 22, totalTokens: 133 },
        };
      },
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

  /**
   * Two cross-encoders can rank a set identically and still disagree completely about where
   * "relevant" starts. Measured on the development knowledge base: an irrelevant pair sits near −11 on
   * bge-reranker-v2-m3 and near −0.3 on gte-reranker-modernbert-base, so an uncalibrated 0.5
   * cutoff admits 0.8% of irrelevant pairs on one model and 42.5% on the other.
   */
  it('recentres a model whose relevant boundary is not at logit zero', async () => {
    // For such a model 1.2 is a relevant score and −0.3 an irrelevant one — yet raw, the
    // irrelevant pair still sigmoids to within a whisker of the cutoff.
    const raw = await rerankHits(store, fakeReranker([1.2, -0.3]), 'q', hits.slice(0, 2), 2);
    expect(raw.hits[0]!.relevance!).toBeGreaterThan(0.5);
    expect(raw.hits[1]!.relevance!).toBeGreaterThan(0.4);

    const cal = await rerankHits(store, fakeReranker([1.2, -0.3]), 'q', hits.slice(0, 2), 2, 800, 0.5);
    expect(cal.hits[0]!.relevance!).toBeGreaterThan(0.5);
    expect(cal.hits[1]!.relevance!).toBeLessThan(0.5);
    // Ordering is a property of the model; calibration only moves the cutoff.
    expect(cal.hits.map((hit) => hit.chunkId)).toEqual(raw.hits.map((hit) => hit.chunkId));
  });

  it('leaves a model already centred at zero untouched', async () => {
    const withZero = await rerankHits(store, fakeReranker([4.2, -11]), 'q', hits.slice(0, 2), 2, 800, 0);
    const without = await rerankHits(store, fakeReranker([4.2, -11]), 'q', hits.slice(0, 2), 2);
    expect(withZero.hits.map((hit) => hit.relevance)).toEqual(without.hits.map((hit) => hit.relevance));
  });

  it('uses the LLM total order while keeping relevance labels as the absolute signal', async () => {
    const model = fakeLlmReranker(([first, second]) => [
      { candidate_id: second!, relevance: 3 },
      { candidate_id: first!, relevance: 1 },
    ]);
    const result = await rerankHits(store, model, 'Zephyr warranty', hits, 2);
    expect(result.degraded).toBeNull();
    expect(result.hits.map((hit) => hit.chunkId)).toEqual([2, 1, 3, 4, 5]);
    expect(result.hits[0]!.relevance).toBe(1);
    expect(result.hits[1]!.relevance).toBeCloseTo(1 / 3);
    expect(result.hits[2]!.score).toBeLessThan(result.hits[1]!.score);
    expect(result.qualification).toMatchObject({ applied: false, basis: 'disabled', rejected: 0 });
  });

  it('removes LLM grade-zero candidates and never fills from the unjudged tail', async () => {
    const model = fakeLlmReranker(([first, second, third]) => [
      { candidate_id: first!, relevance: 3 },
      { candidate_id: second!, relevance: 1 },
      { candidate_id: third!, relevance: 0 },
    ]);
    const result = await rerankHits(store, model, 'Zephyr warranty', hits, 3, 800, 0, true);
    expect(result.hits.map((hit) => hit.chunkId)).toEqual([1, 2]);
    expect(result.qualification).toMatchObject({
      model: 'llm',
      model_id: 'fake',
      latency_ms: 1,
      input_tokens: 111,
      output_tokens: 22,
      total_tokens: 133,
      applied: true,
      judged: 3,
      rejected: 1,
      unjudged: 2,
      basis: 'llm_grade',
      threshold: null,
    });
  });

  it('can disqualify the only candidate instead of skipping reranking', async () => {
    const model = fakeLlmReranker(([only]) => [{ candidate_id: only!, relevance: 0 }]);
    const result = await rerankHits(store, model, 'Unrecorded warranty', hits.slice(0, 1), 3, 800, 0, true);
    expect(result.hits).toEqual([]);
    expect(result.qualification).toMatchObject({ judged: 1, rejected: 1, applied: true });
  });

  it('subjects graph candidates to the same qualification gate', async () => {
    const graphHit: ChunkHit = {
      chunkId: 1,
      pageId: 'page-1',
      score: 0.9,
      from: ['graph'],
      graphPaths: [
        {
          seed: { id: 'node-a', kind: 'page', slug: 'people/ada-marlow' },
          target: { id: 'node-b', kind: 'page', slug: 'products/zephyr-qx-100' },
          nodes: [
            { id: 'node-a', kind: 'page', slug: 'people/ada-marlow' },
            { id: 'node-b', kind: 'page', slug: 'products/zephyr-qx-100' },
          ],
          relations: ['links_to'],
          hops: 1,
          confidence: 1,
          evidence: [{ kind: 'page_line', slug: 'people/ada-marlow', line_start: 7 }],
        },
      ],
    };
    const model = fakeLlmReranker(([only]) => [{ candidate_id: only!, relevance: 0 }]);
    const result = await rerankHits(store, model, 'Unrecorded mechanism', [graphHit], 3, 800, 0, true);
    expect(result.hits).toEqual([]);
    expect(result.qualification).toMatchObject({ judged: 1, rejected: 1, applied: true });
  });

  it('gives the qualifier bounded path evidence for a graph-only destination', async () => {
    const graphStore = fakeStore([
      {
        id: 1,
        slug: 'people/ada-marlow',
        text: 'The albatross conduit begins here and points onward.',
      },
      {
        id: 2,
        slug: 'products/zephyr-qx-100',
        text: 'Silver mechanism carries opaque marker glimmer.',
      },
    ]);
    const graphHit: ChunkHit = {
      chunkId: 2,
      pageId: 'page-2',
      score: 0.9,
      from: ['graph'],
      graphPaths: [
        {
          seed: { id: 'node-a', kind: 'page', slug: 'people/ada-marlow' },
          target: { id: 'node-b', kind: 'page', slug: 'products/zephyr-qx-100' },
          nodes: [
            { id: 'node-a', kind: 'page', slug: 'people/ada-marlow' },
            { id: 'node-b', kind: 'page', slug: 'products/zephyr-qx-100' },
          ],
          relations: ['links_to'],
          hops: 1,
          confidence: 1,
          evidence: [{ kind: 'page_line', slug: 'people/ada-marlow', line_start: 7 }],
        },
      ],
    };
    const model = stubReranker({
      rerankerMode: 'llm',
      chat: async (messages) => {
        const payload = JSON.parse(messages.at(-1)!.content) as {
          candidates: { candidate_id: string; excerpt: string }[];
        };
        expect(payload.candidates[0]!.excerpt).toContain('albatross conduit');
        return {
          ok: true,
          value: JSON.stringify({
            j: { [payload.candidates[0]!.candidate_id]: { g: 3, r: 1 } },
          }),
          latencyMs: 1,
        };
      },
    } as unknown as Partial<ModelClient>);

    const result = await rerankHits(
      graphStore,
      model,
      'Where does the albatross conduit lead?',
      [graphHit],
      3,
      800,
      0,
      true,
    );
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ chunkId: 2, relevance: 1, from: ['graph'] });
  });

  it('uses a manual native boundary to reject candidates and omit the unjudged tail', async () => {
    const result = await rerankHits(store, fakeReranker([2, -2]), 'q', hits, 2, 800, 0, true);
    expect(result.hits.map((hit) => hit.chunkId)).toEqual([1]);
    expect(result.qualification).toMatchObject({
      model: 'native',
      applied: true,
      basis: 'native_manual',
      threshold: 0,
      rejected: 1,
      unjudged: 3,
    });
  });

  it('preserves exact fusion order when the LLM returns an incomplete judgment map', async () => {
    const model = fakeLlmReranker(([first]) => [
      { candidate_id: first!, relevance: 3 },
      { candidate_id: first!, relevance: 2 },
    ]);
    const result = await rerankHits(store, model, 'Zephyr warranty', hits, 2);
    expect(result.hits).toEqual(hits);
    expect(result.degraded).toBe('rerank_failed');
    expect(result.note).toContain('incomplete or invalid judgment map');
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
    expect(result.note).toBe('rerank returned an incomplete or invalid candidate permutation');
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
