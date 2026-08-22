import { describe, expect, it } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import type { RankingEndToEndReport } from './ranking-end-to-end.ts';
import {
  attachRankingEndToEndEvidence,
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

    const partialIndex = {
      ...persisted,
      endToEndEvidence: { ...persisted.endToEndEvidence!, embeddedChunks: 119 },
    };
    expect(evaluateRankingRelease(partialIndex).blockers).toContain('end_to_end_configuration');
  });

  it('can exercise the matrix without network when every model is unavailable', async () => {
    const report = await runRankingMatrix({ providers: {}, models: {} } as AknoConfig, {
      runs: 1,
      includeNative: false,
    });

    expect(report.schemaVersion).toBe('ranking-matrix-v2');
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

  it('attaches only end-to-end evidence for the selected configuration', () => {
    const matrix = { ...passingReport(), endToEndEvidence: null };
    const endToEnd = passingEndToEndReport();

    const attached = attachRankingEndToEndEvidence(matrix, endToEnd);

    expect(attached.endToEndEvidence).toMatchObject({
      candidateCount: 20,
      directAnswerCandidateRecall: 1,
      directAnswerRankedRecall: 1,
      candidateDegradedQueries: 0,
      rankedDegradedQueries: 0,
      rerankFallbackRate: 0,
    });
    expect(attached.releaseGate.blockers).toEqual(['persisted_artifact']);
    expect(() => attachRankingEndToEndEvidence(matrix, { ...endToEnd, candidateCount: 10 })).toThrow(
      'does not match',
    );
  });
});

function passingReport(): RankingMatrixReport {
  const none = variant('llm-none-c20', 'none', 0.8);
  const low = variant('llm-low-c20', 'low', 0.805);
  return {
    kind: 'ranking_matrix',
    schemaVersion: 'ranking-matrix-v2',
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
    endToEndEvidence: {
      split: 'test',
      corpusVersion: 'invented-ranking-v2',
      candidateCount: 20,
      directAnswerCandidateRecall: 1,
      directAnswerRankedRecall: 1,
      candidateDegradedQueries: 0,
      rankedDegradedQueries: 0,
      rerankFallbackRate: 0,
      embeddingProvider: 'invented-provider',
      embeddingModel: 'invented-embedding-model',
      embeddingAvailable: true,
      totalChunks: 120,
      embeddedChunks: 120,
      rerankerProvider: 'invented-provider',
      rerankerModel: 'invented-model',
      rerankerAvailable: true,
      reasoningEffort: 'none',
      promptVersion: 'invented-prompt-v1',
      schemaVersion: 'invented-schema-v1',
    },
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

function passingEndToEndReport(): RankingEndToEndReport {
  const stage = {
    directAnswerRecall: 1,
    mrrAt10: 1,
    successAt1: 1,
    successAt3: 1,
    byCategory: [],
    degradedQueries: 0,
    unavailableQueries: 0,
    p50LatencyMs: 1111,
    p95LatencyMs: 2222,
    maxLatencyMs: 2222,
  };
  return {
    kind: 'ranking_end_to_end',
    schemaVersion: 'ranking-end-to-end-v1',
    createdAt: '2027-01-02T03:04:05.000Z',
    development: true,
    releaseEligible: false,
    passed: true,
    split: 'test',
    corpus: {
      queries: 20,
      sources: 120,
      categories: 8,
      version: 'invented-ranking-v2',
      independentlyReviewed: true,
    },
    system: 'llm',
    candidateCount: 20,
    excerptChars: 800,
    concurrency: 4,
    embedding: {
      provider: 'invented-provider',
      model: 'invented-embedding-model',
      available: true,
      totalChunks: 120,
      embeddedChunks: 120,
    },
    reranker: {
      provider: 'invented-provider',
      model: 'invented-model',
      reasoningEffort: 'none',
      promptVersion: 'invented-prompt-v1',
      schemaVersion: 'invented-schema-v1',
      available: true,
    },
    candidateGeneration: stage,
    rankedRecall: stage,
    rerankFallbackRate: 0,
    queries: [],
  };
}
