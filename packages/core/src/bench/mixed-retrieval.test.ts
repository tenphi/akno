import { describe, expect, it } from 'vitest';
import { runMixedRetrievalBench } from './mixed-retrieval.ts';

describe('mixed retrieval benchmark', () => {
  it('asserts orphan recall, deduplication, page preservation, degradation, and budget latency', async () => {
    const report = await runMixedRetrievalBench({ iterations: 3, latencyBudgetMs: 1000 });

    expect(report.passed).toBe(true);
    expect(report.corpus).toEqual({
      pages: 4,
      ownedDocuments: 1,
      orphanDocuments: 7,
      queries: 6,
      orphanK: 3,
      pageK: 2,
    });

    const results = Object.fromEntries(report.results.map((result) => [result.name, result]));
    expect(results['orphan recall@3']).toMatchObject({ value: 1, passed: true });
    expect(results['duplicate document result rate']).toMatchObject({ value: 0, passed: true });
    expect(results['page recall@2, page-only baseline']).toMatchObject({ value: 1, passed: true });
    expect(results['page recall change after mixed assembly']).toMatchObject({ value: 0, passed: true });
    expect(results['lexical recall with model degradation']).toMatchObject({ value: 1, passed: true });
    expect(results['mixed assembly + budget fit, p50']).toMatchObject({ passed: true });
  });
});
