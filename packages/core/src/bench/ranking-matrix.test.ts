import { describe, expect, it } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import {
  evaluateRankingRelease,
  markRankingMatrixPersisted,
  medianTop3Overlap,
  refreshRankingMatrixReport,
  runRankingMatrix,
  type RankingMatrixReport,
  type RankingMatrixVariant,
} from './ranking-matrix.ts';

describe('ranking benchmark matrix', () => {
  it('uses the median pairwise top-three overlap', () => {
    expect(
      medianTop3Overlap([
        ['answer', 'support', 'marginal'],
        ['answer', 'support', 'other'],
        ['answer', 'support', 'marginal'],
      ]),
    ).toBeCloseTo(2 / 3);
    expect(medianTop3Overlap([['answer', 'support', 'marginal']])).toBeNull();
  });

  it('keeps the mechanical release gate closed until every condition is evidenced', () => {
    const report = passingReport();
    expect(evaluateRankingRelease(report).passed).toBe(false);
    expect(evaluateRankingRelease(report).blockers).toEqual(['persisted_artifact']);

    const persisted = markRankingMatrixPersisted(report);
    expect(persisted.releaseEligible).toBe(true);
    expect(persisted.releaseGate.checks.every((check) => check.passed)).toBe(true);

    const unreviewed = {
      ...persisted,
      corpus: { ...persisted.corpus, independentlyReviewed: false },
    };
    expect(evaluateRankingRelease(unreviewed).blockers).toContain('independent_review');

    const expensiveSelection = {
      ...persisted,
      selection: {
        variantId: 'llm-low-c20',
        candidateCount: 20 as const,
        reasoningEffort: 'low' as const,
        rationale: 'Invented non-minimal fixture.',
      },
    };
    expect(evaluateRankingRelease(expensiveSelection).blockers).toContain('cheapest_equivalent_effort');
  });

  it('can exercise the matrix without network when every model is unavailable', async () => {
    const report = await runRankingMatrix({ providers: {}, models: {} } as AknoConfig, {
      runs: 1,
      includeNative: false,
    });

    expect(report.schemaVersion).toBe('ranking-matrix-v1');
    expect(report.variants).toHaveLength(5);
    expect(report.corpus).toMatchObject({ queries: 60, sources: 120 });
    expect(report.selection).toBeNull();
    expect(report.releaseEligible).toBe(false);
  });

  it('re-derives comparison eligibility and selection from persisted measurements', () => {
    const report = passingReport();
    report.variants = report.variants.map((entry) => ({
      ...entry,
      comparisonEligible: false,
    }));
    report.selection = null;

    const refreshed = refreshRankingMatrixReport(report);

    expect(refreshed.variants.every((entry) => entry.comparisonEligible)).toBe(true);
    expect(refreshed.selection).toMatchObject({
      variantId: 'llm-none-c20',
      reasoningEffort: 'none',
    });
  });
});

function passingReport(): RankingMatrixReport {
  const none = variant('llm-none-c20', 'none', 0.8);
  const low = variant('llm-low-c20', 'low', 0.805);
  return {
    kind: 'ranking_matrix',
    schemaVersion: 'ranking-matrix-v1',
    createdAt: '2027-01-02T03:04:05.000Z',
    split: 'test',
    corpus: {
      queries: 20,
      sources: 120,
      judgments: 400,
      categories: 8,
      version: 'invented-ranking-v2',
      independentlyReviewed: true,
    },
    requestedRuns: 5,
    concurrency: 4,
    variants: [none, low],
    selection: {
      variantId: none.id,
      candidateCount: 20,
      reasoningEffort: 'none',
      rationale: 'Invented passing fixture.',
    },
    endToEndEvidence: { candidateCount: 20, directAnswerRecall: 1 },
    artifactPersisted: false,
    releaseEligible: false,
    releaseGate: { passed: false, checks: [], blockers: [] },
  };
}

function variant(id: string, reasoningEffort: 'none' | 'low', ndcgAt10: number): RankingMatrixVariant {
  const quality = {
    ndcgAt10,
    mrrAt10: 0.9,
    successAt1: 0.9,
    successAt3: 1,
    precisionAt5: 0.4,
    gradeZeroAboveGradeThree: 0,
  };
  const fusionBaseline = { ...quality, ndcgAt10: 0.6, mrrAt10: 0.8 };
  return {
    id,
    system: 'llm',
    provider: 'invented-provider',
    model: 'invented-model',
    reasoningEffort,
    promptVersion: 'invented-prompt-v1',
    schemaVersion: 'invented-schema-v1',
    candidateCount: 20,
    excerptChars: 800,
    runCount: 5,
    comparisonEligible: true,
    quality,
    fusionBaseline,
    ndcgDeltaFromFusion: ndcgAt10 - fusionBaseline.ndcgAt10,
    byCategory: [
      {
        category: 'exact_entity',
        queries: 3,
        quality,
        fusionBaseline,
        ndcgDeltaFromFusion: ndcgAt10 - fusionBaseline.ndcgAt10,
      },
    ],
    qualification: {
      answerRetention: 1,
      supportRetention: 1,
      marginalRetention: 1,
      irrelevantRejection: 0.8,
      retainedPrecision: 0.5,
      instructionNegativeRejection: 1,
    },
    validResponseRate: 1,
    fallbackPreserved: true,
    p50LatencyMs: 1111,
    p95LatencyMs: 2222,
    maxLatencyMs: 2222,
    medianTop3Overlap: 1,
    runs: [],
  };
}
