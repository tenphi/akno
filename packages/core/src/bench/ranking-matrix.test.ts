import { describe, expect, it } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import { LLM_RERANK_PROMPT_VERSION, LLM_RERANK_SCHEMA_VERSION } from '../recall/llm-rerank.ts';
import type { RankingEndToEndReport } from './ranking-end-to-end.ts';
import type { RankingLatencyReport } from './ranking-latency.ts';
import {
  completeRankingReview,
  createRankingReviewPacket,
  rankingCorpusFingerprint,
  type RankingReviewEvidence,
} from './ranking-review.ts';
import {
  attachRankingEndToEndEvidence,
  attachRankingLatencyEvidence,
  attachRankingReviewEvidence,
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

    const unreviewed = { ...persisted, reviewEvidence: null };
    expect(evaluateRankingRelease(unreviewed).blockers).toContain('independent_review');

    const staleContract = {
      ...persisted,
      variants: persisted.variants.map((entry) => ({ ...entry, promptVersion: 'invented-stale-prompt' })),
    };
    expect(evaluateRankingRelease(staleContract).blockers).toContain('runtime_contract');

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

    const unboundDimensions = {
      ...persisted,
      endToEndEvidence: { ...persisted.endToEndEvidence!, embeddingDimensions: null },
    };
    expect(evaluateRankingRelease(unboundDimensions).blockers).toContain('end_to_end_configuration');

    const staleLatencyContract = {
      ...persisted,
      latencyEvidence: { ...persisted.latencyEvidence!, schemaVersion: 'invented-stale-latency' },
    };
    expect(refreshRankingMatrixReport(staleLatencyContract).releaseGate.blockers).toContain(
      'latency_configuration',
    );
  });

  it('can exercise the matrix without network when every model is unavailable', async () => {
    const report = await runRankingMatrix({ providers: {}, models: {} } as AknoConfig, {
      runs: 1,
      includeNative: false,
    });

    expect(report.schemaVersion).toBe('ranking-matrix-v7');
    expect(report.variants).toHaveLength(5);
    expect(report.corpus).toMatchObject({ queries: 60, sources: 120 });
    expect(report.selection).toBeNull();
    expect(report.releaseEligible).toBe(false);
  });

  it('can repeat one development variant without running the full tuning matrix', async () => {
    const report = await runRankingMatrix({ providers: {}, models: {} } as AknoConfig, {
      runs: 2,
      includeNative: false,
      variants: ['llm-none-c10'],
    });

    expect(report.variants.map((entry) => entry.id)).toEqual(['llm-none-c10']);
    expect(report.variants[0]!.runs).toHaveLength(2);
    expect(report.variants[0]!.execution).toMatchObject({ requests: 120, endpointRequests: 0 });
    expect(report.targetedVariants).toEqual(['llm-none-c10']);
    expect(report.selection).toBeNull();
    await expect(
      runRankingMatrix({ providers: {}, models: {} } as AknoConfig, {
        split: 'test',
        variants: ['llm-none-c10'],
      }),
    ).rejects.toThrow('development-only');
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
    expect(
      attachRankingEndToEndEvidence(matrix, {
        ...endToEnd,
        schemaVersion: 'ranking-end-to-end-v1',
      }).endToEndEvidence,
    ).not.toBeNull();
    expect(
      attachRankingEndToEndEvidence(matrix, {
        ...endToEnd,
        schemaVersion: 'ranking-end-to-end-v2',
      }).endToEndEvidence,
    ).not.toBeNull();
    expect(() =>
      attachRankingEndToEndEvidence(matrix, {
        ...endToEnd,
        schemaVersion: 'ranking-end-to-end-unknown',
      }),
    ).toThrow('unsupported end-to-end artifact schema');
    expect(() => attachRankingEndToEndEvidence(matrix, { ...endToEnd, candidateCount: 10 })).toThrow(
      'does not match',
    );
    expect(() =>
      attachRankingEndToEndEvidence(matrix, {
        ...endToEnd,
        corpus: { ...endToEnd.corpus, fingerprint: 'a'.repeat(64) },
      }),
    ).toThrow('matrix corpus');
  });

  it('attaches warm latency evidence only for the selected configuration', () => {
    const matrix = { ...passingReport(), latencyEvidence: null };
    const latency = passingLatencyReport();

    const attached = attachRankingLatencyEvidence(matrix, latency);

    expect(attached.latencyEvidence).toMatchObject({
      candidateCount: 20,
      interactive: { concurrency: 1, warm: { p95LatencyMs: 2222 } },
      loaded: { concurrency: 4 },
    });
    expect(attached.releaseGate.blockers).toEqual(['persisted_artifact']);
    expect(() => attachRankingLatencyEvidence(matrix, { ...latency, candidateCount: 10 })).toThrow(
      'does not match',
    );
    expect(() =>
      attachRankingLatencyEvidence(matrix, {
        ...latency,
        corpus: { ...latency.corpus, fingerprint: 'a'.repeat(64) },
      }),
    ).toThrow('does not match');
  });

  it('attaches only an independently completed review for the exact corpus', () => {
    const matrix = { ...passingReport(), reviewEvidence: null };
    const evidence = passingReviewEvidence();

    const attached = attachRankingReviewEvidence(matrix, evidence);

    expect(attached.reviewEvidence).toEqual(evidence);
    expect(attached.releaseGate.blockers).toEqual(['persisted_artifact']);
    expect(() =>
      attachRankingReviewEvidence(matrix, {
        ...evidence,
        corpusFingerprint: 'a'.repeat(64),
      }),
    ).toThrow('does not match');
  });
});

function passingReport(): RankingMatrixReport {
  const none = variant('llm-none-c20', 'none', 0.8);
  const low = variant('llm-low-c20', 'low', 0.805);
  return {
    kind: 'ranking_matrix',
    schemaVersion: 'ranking-matrix-v7',
    createdAt: '2027-01-02T03:04:05.000Z',
    split: 'test',
    corpus: {
      queries: 20,
      sources: 120,
      judgments: 400,
      categories: 8,
      version: 'invented-ranking-v4',
      fingerprint: rankingCorpusFingerprint(),
    },
    requestedRuns: 5,
    concurrency: 4,
    targetedVariants: null,
    variants: [none, low],
    selection: {
      variantId: none.id,
      candidateCount: 20,
      reasoningEffort: 'none',
      rationale: 'Invented passing fixture.',
    },
    reviewEvidence: passingReviewEvidence(),
    endToEndEvidence: {
      split: 'test',
      corpusVersion: 'invented-ranking-v4',
      corpusFingerprint: rankingCorpusFingerprint(),
      candidateCount: 20,
      directAnswerCandidateRecall: 1,
      directAnswerRankedRecall: 1,
      candidateDegradedQueries: 0,
      rankedDegradedQueries: 0,
      rerankFallbackRate: 0,
      embeddingProvider: 'invented-provider',
      embeddingModel: 'invented-embedding-model',
      embeddingDimensions: 8,
      embeddingAvailable: true,
      totalChunks: 120,
      embeddedChunks: 120,
      rerankerProvider: 'invented-provider',
      rerankerModel: 'invented-model',
      rerankerAvailable: true,
      reasoningEffort: 'none',
      promptVersion: LLM_RERANK_PROMPT_VERSION,
      schemaVersion: LLM_RERANK_SCHEMA_VERSION,
    },
    latencyEvidence: passingLatencyReport(),
    artifactPersisted: false,
    releaseEligible: false,
    releaseGate: { passed: false, checks: [], blockers: [] },
  };
}

function passingLatencyReport(): RankingLatencyReport {
  const metrics = {
    samples: 19,
    validResponseRate: 1,
    fallbackCount: 0,
    p50LatencyMs: 1111,
    p95LatencyMs: 2222,
    maxLatencyMs: 2222,
    endpointRequests: 19,
    extraEndpointRequests: 0,
    tokenUsage: null,
  };
  return {
    kind: 'ranking_latency',
    schemaVersion: 'ranking-latency-v1',
    createdAt: '2027-01-02T03:04:05.000Z',
    development: true,
    releaseEligible: false,
    split: 'test',
    corpus: {
      queries: 20,
      sources: 120,
      judgments: 400,
      categories: 8,
      version: 'invented-ranking-v4',
      fingerprint: rankingCorpusFingerprint(),
    },
    provider: 'invented-provider',
    model: 'invented-model',
    reasoningEffort: 'none',
    promptVersion: LLM_RERANK_PROMPT_VERSION,
    schemaVersionContract: LLM_RERANK_SCHEMA_VERSION,
    candidateCount: 20,
    excerptChars: 800,
    thresholds: { interactiveP95LatencyMs: 4000 },
    interactive: {
      concurrency: 1,
      cold: { ...metrics, samples: 1, endpointRequests: 3, extraEndpointRequests: 2 },
      warm: metrics,
    },
    loaded: {
      concurrency: 4,
      cold: { ...metrics, samples: 1, endpointRequests: 3, extraEndpointRequests: 2 },
      warm: metrics,
    },
    checks: [],
    blockers: [],
    passed: true,
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
    promptVersion: LLM_RERANK_PROMPT_VERSION,
    schemaVersion: LLM_RERANK_SCHEMA_VERSION,
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
    execution: {
      requests: 100,
      endpointRequests: 100,
      extraEndpointRequests: 0,
      tokenUsage: null,
    },
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
    schemaVersion: 'ranking-end-to-end-v3',
    createdAt: '2027-01-02T03:04:05.000Z',
    development: true,
    releaseEligible: false,
    passed: true,
    split: 'test',
    corpus: {
      queries: 20,
      sources: 120,
      categories: 8,
      version: 'invented-ranking-v4',
      fingerprint: rankingCorpusFingerprint(),
    },
    system: 'llm',
    candidateCount: 20,
    excerptChars: 800,
    concurrency: 4,
    embedding: {
      provider: 'invented-provider',
      model: 'invented-embedding-model',
      dimensions: 8,
      available: true,
      totalChunks: 120,
      embeddedChunks: 120,
    },
    reranker: {
      provider: 'invented-provider',
      model: 'invented-model',
      reasoningEffort: 'none',
      promptVersion: LLM_RERANK_PROMPT_VERSION,
      schemaVersion: LLM_RERANK_SCHEMA_VERSION,
      available: true,
    },
    candidateGeneration: stage,
    rankedRecall: stage,
    rerankFallbackRate: 0,
    queries: [],
  };
}

function passingReviewEvidence(): RankingReviewEvidence {
  const packet = createRankingReviewPacket(new Date('2027-01-02T03:04:05.000Z'));
  packet.sources = packet.sources.map((source) => ({ ...source, review: 'pass' }));
  packet.cases = packet.cases.map((benchCase) => ({ ...benchCase, review: 'pass' }));
  packet.review = {
    verdict: 'approved',
    reviewerKind: 'human',
    reviewedAt: '2027-01-03T04:05:06.000Z',
    independence: {
      didNotAuthorCorpus: true,
      didNotTuneRuntimeContract: true,
      reviewedWithoutBenchmarkOutputs: true,
    },
    checks: {
      inventedContent: true,
      sourceClarity: true,
      queryIntentAlignment: true,
      poolAndJudgmentAccuracy: true,
      splitIsolation: true,
    },
    issues: [],
  };
  return completeRankingReview(packet);
}
