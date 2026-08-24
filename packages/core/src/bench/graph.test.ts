import { describe, expect, it } from 'vitest';
import { runGraphBench } from './graph.ts';

describe('graph release benchmark', () => {
  it('passes the frozen invented graph corpus without models or user data', async () => {
    const report = await runGraphBench({ iterations: 3 });

    expect(report.cases.filter((bench) => !bench.passed)).toEqual([]);
    expect(report).toMatchObject({
      kind: 'invented_graph_release_gate',
      schemaVersion: 1,
      split: 'test',
      passed: true,
      blockers: [],
      corpus: {
        pages: 62,
        documents: 2,
        cases: 25,
        iterations: 3,
        independentlyReviewed: false,
      },
      metrics: {
        expectedOutcomeAccuracy: 1,
        identityAccuracy: 1,
        ambiguousAbstention: 1,
        provenanceAccuracy: 1,
        pathRecall: 1,
        graphOnlyFalsePositiveRate: 0,
        maintenanceRecall: 1,
        mixedRetrievalPassed: true,
      },
    });
    expect(report.cases.every((bench) => bench.passed)).toBe(true);
  });
});
