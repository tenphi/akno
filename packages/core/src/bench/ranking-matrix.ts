import type { AknoConfig, ReasoningEffort } from '../config/schema.ts';
import { rankingCorpusCases } from './ranking-corpus.ts';
import type { RankingEndToEndReport } from './ranking-end-to-end.ts';
import {
  runRankingBench,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingCandidateCount,
  type RankingCategoryReport,
  type RankingExcerptChars,
  type RankingQualityMetrics,
  type RankingQualificationMetrics,
} from './ranking.ts';

export const RANKING_MATRIX_SCHEMA_VERSION = 'ranking-matrix-v2';

export interface RankingMatrixOptions {
  split?: RankingBenchSplit;
  provider?: string;
  model?: string;
  runs?: number;
  concurrency?: number;
  excerptChars?: RankingExcerptChars;
  includeNative?: boolean;
  onProgress?: (progress: RankingMatrixProgress) => void;
}

export interface RankingMatrixProgress {
  variant: string;
  run: number;
  runs: number;
}

export interface RankingMatrixRun {
  quality: RankingQualityMetrics;
  validResponseRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  topThree: Record<string, string[]>;
  fallbackQueries: string[];
}

export interface RankingMatrixVariant {
  id: string;
  system: 'fusion' | 'native' | 'llm';
  provider: string | null;
  model: string | null;
  reasoningEffort: ReasoningEffort | null;
  promptVersion: string | null;
  schemaVersion: string | null;
  candidateCount: RankingCandidateCount;
  excerptChars: RankingExcerptChars;
  runCount: number;
  /** True when at least one valid response produced finite measurements; release safety is separate. */
  comparisonEligible: boolean;
  quality: RankingQualityMetrics;
  fusionBaseline: RankingQualityMetrics;
  ndcgDeltaFromFusion: number;
  byCategory: RankingCategoryReport[];
  qualification: RankingQualificationMetrics | null;
  validResponseRate: number;
  fallbackPreserved: boolean;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  medianTop3Overlap: number | null;
  runs: RankingMatrixRun[];
}

export interface RankingMatrixSelection {
  variantId: string;
  candidateCount: RankingCandidateCount;
  reasoningEffort: ReasoningEffort;
  rationale: string;
}

export interface RankingEndToEndEvidence {
  split: RankingBenchSplit;
  corpusVersion: string;
  candidateCount: RankingCandidateCount;
  directAnswerCandidateRecall: number;
  directAnswerRankedRecall: number;
  candidateDegradedQueries: number;
  rankedDegradedQueries: number;
  rerankFallbackRate: number;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingAvailable: boolean;
  totalChunks: number;
  embeddedChunks: number;
  rerankerProvider: string | null;
  rerankerModel: string | null;
  rerankerAvailable: boolean;
  reasoningEffort: ReasoningEffort;
  promptVersion: string;
  schemaVersion: string;
}

export interface RankingReleaseCheck {
  id:
    | 'held_out_split'
    | 'independent_review'
    | 'persisted_artifact'
    | 'end_to_end_configuration'
    | 'end_to_end_candidate_recall'
    | 'end_to_end_ranked_recall'
    | 'end_to_end_integrity'
    | 'five_runs'
    | 'ndcg_gain'
    | 'category_regression'
    | 'exact_entity_mrr'
    | 'valid_responses'
    | 'fallback_preserved'
    | 'instruction_safety'
    | 'top3_stability'
    | 'latency'
    | 'cheapest_equivalent_effort';
  passed: boolean;
  actual: string | number | boolean | null;
  target: string;
}

export interface RankingReleaseGate {
  passed: boolean;
  checks: RankingReleaseCheck[];
  blockers: string[];
}

export interface RankingMatrixReport {
  kind: 'ranking_matrix';
  schemaVersion: string;
  createdAt: string;
  split: RankingBenchSplit;
  corpus: RankingBenchReport['corpus'];
  requestedRuns: number;
  concurrency: number;
  variants: RankingMatrixVariant[];
  selection: RankingMatrixSelection | null;
  endToEndEvidence: RankingEndToEndEvidence | null;
  artifactPersisted: boolean;
  releaseEligible: boolean;
  releaseGate: RankingReleaseGate;
}

interface MatrixDescriptor {
  id: string;
  system: RankingMatrixVariant['system'];
  candidateCount: RankingCandidateCount;
  reasoningEffort: ReasoningEffort | null;
  repeated: boolean;
}

export async function runRankingMatrix(
  config: AknoConfig,
  options: RankingMatrixOptions = {},
): Promise<RankingMatrixReport> {
  const split = options.split ?? 'development';
  const requestedRuns = normalizeRuns(options.runs ?? 5);
  const concurrency = normalizeConcurrency(options.concurrency ?? 4);
  const excerptChars = options.excerptChars ?? 800;
  const configuredNative =
    config.models?.reranker?.enabled === true && config.models.reranker.rerankerMode === 'endpoint';
  const includeNative = options.includeNative ?? configuredNative;
  const descriptors: MatrixDescriptor[] = [
    { id: 'fusion-c20', system: 'fusion', candidateCount: 20, reasoningEffort: null, repeated: false },
    ...(!includeNative
      ? []
      : [
          {
            id: 'native-c20',
            system: 'native' as const,
            candidateCount: 20 as const,
            reasoningEffort: null,
            repeated: false,
          },
        ]),
    { id: 'llm-none-c10', system: 'llm', candidateCount: 10, reasoningEffort: 'none', repeated: true },
    { id: 'llm-none-c20', system: 'llm', candidateCount: 20, reasoningEffort: 'none', repeated: true },
    { id: 'llm-none-c40', system: 'llm', candidateCount: 40, reasoningEffort: 'none', repeated: true },
    { id: 'llm-low-c20', system: 'llm', candidateCount: 20, reasoningEffort: 'low', repeated: true },
  ];

  const variants: RankingMatrixVariant[] = [];
  let corpus: RankingBenchReport['corpus'] | null = null;
  for (const descriptor of descriptors) {
    const count = descriptor.repeated ? requestedRuns : 1;
    const reports: RankingBenchReport[] = [];
    for (let run = 1; run <= count; run++) {
      options.onProgress?.({ variant: descriptor.id, run, runs: count });
      reports.push(
        await runRankingBench(config, {
          system: descriptor.system,
          split,
          candidateCount: descriptor.candidateCount,
          excerptChars,
          concurrency,
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.model ? { model: options.model } : {}),
          ...(descriptor.reasoningEffort ? { reasoningEffort: descriptor.reasoningEffort } : {}),
        }),
      );
    }
    corpus ??= reports[0]!.corpus;
    variants.push(summarizeVariant(descriptor, reports));
  }

  const draft: RankingMatrixReport = {
    kind: 'ranking_matrix',
    schemaVersion: RANKING_MATRIX_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    split,
    corpus: corpus!,
    requestedRuns,
    concurrency,
    variants,
    selection: null,
    endToEndEvidence: null,
    artifactPersisted: false,
    releaseEligible: false,
    releaseGate: { passed: false, checks: [], blockers: [] },
  };
  return refreshRankingMatrixReport(draft);
}

export function markRankingMatrixPersisted(report: RankingMatrixReport): RankingMatrixReport {
  return refreshRankingMatrixReport({
    ...report,
    artifactPersisted: true,
    releaseEligible: false,
    releaseGate: { passed: false, checks: [], blockers: [] },
  });
}

export function attachRankingEndToEndEvidence(
  matrix: RankingMatrixReport,
  report: RankingEndToEndReport,
): RankingMatrixReport {
  if (report.system !== 'llm') throw new Error('end-to-end release evidence must exercise the LLM reranker');
  if (report.schemaVersion !== 'ranking-end-to-end-v1') {
    throw new Error('unsupported end-to-end artifact schema');
  }
  if (matrix.split !== report.split) throw new Error('matrix and end-to-end splits do not match');
  const selected = matrix.selection
    ? (matrix.variants.find((variant) => variant.id === matrix.selection!.variantId) ?? null)
    : null;
  if (!selected) throw new Error('matrix has no selected ranking configuration');
  if (
    selected.candidateCount !== report.candidateCount ||
    selected.reasoningEffort !== report.reranker.reasoningEffort ||
    selected.provider !== report.reranker.provider ||
    selected.model !== report.reranker.model ||
    selected.promptVersion !== report.reranker.promptVersion ||
    selected.schemaVersion !== report.reranker.schemaVersion
  ) {
    throw new Error('end-to-end run does not match the selected ranking configuration');
  }
  return refreshRankingMatrixReport({
    ...matrix,
    endToEndEvidence: {
      split: report.split,
      corpusVersion: report.corpus.version,
      candidateCount: report.candidateCount,
      directAnswerCandidateRecall: report.candidateGeneration.directAnswerRecall,
      directAnswerRankedRecall: report.rankedRecall.directAnswerRecall,
      candidateDegradedQueries: report.candidateGeneration.degradedQueries,
      rankedDegradedQueries: report.rankedRecall.degradedQueries,
      rerankFallbackRate: report.rerankFallbackRate,
      embeddingProvider: report.embedding.provider,
      embeddingModel: report.embedding.model,
      embeddingAvailable: report.embedding.available,
      totalChunks: report.embedding.totalChunks,
      embeddedChunks: report.embedding.embeddedChunks,
      rerankerProvider: report.reranker.provider,
      rerankerModel: report.reranker.model,
      rerankerAvailable: report.reranker.available,
      reasoningEffort: report.reranker.reasoningEffort!,
      promptVersion: report.reranker.promptVersion!,
      schemaVersion: report.reranker.schemaVersion!,
    },
  });
}

/** Re-derive every decision field from stored measurements after a gate implementation changes. */
export function refreshRankingMatrixReport(report: RankingMatrixReport): RankingMatrixReport {
  const variants = report.variants.map((variant) => ({
    ...variant,
    comparisonEligible: hasComparableMeasurements(variant),
  }));
  const refreshed: RankingMatrixReport = {
    ...report,
    schemaVersion: RANKING_MATRIX_SCHEMA_VERSION,
    variants,
    selection: selectConfiguration(variants),
    endToEndEvidence: report.endToEndEvidence ?? null,
    releaseEligible: false,
    releaseGate: { passed: false, checks: [], blockers: [] },
  };
  refreshed.releaseGate = evaluateRankingRelease(refreshed);
  refreshed.releaseEligible = refreshed.releaseGate.passed;
  return refreshed;
}

export function evaluateRankingRelease(report: RankingMatrixReport): RankingReleaseGate {
  const selected = report.selection
    ? (report.variants.find((variant) => variant.id === report.selection!.variantId) ?? null)
    : null;
  const exact = selected?.byCategory.find((entry) => entry.category === 'exact_entity') ?? null;
  const minimumCategoryDelta = selected
    ? Math.min(...selected.byCategory.map((entry) => entry.ndcgDeltaFromFusion))
    : null;
  const checks: RankingReleaseCheck[] = [
    check('held_out_split', report.split === 'test', report.split, 'test'),
    check(
      'independent_review',
      report.corpus.independentlyReviewed,
      report.corpus.independentlyReviewed,
      'true',
    ),
    check('persisted_artifact', report.artifactPersisted, report.artifactPersisted, 'true'),
    check(
      'end_to_end_configuration',
      endToEndConfigurationMatches(report, selected),
      report.endToEndEvidence !== null,
      'same split, corpus, and selected configuration with a fully embedded index and both models available',
    ),
    check(
      'end_to_end_candidate_recall',
      report.endToEndEvidence?.candidateCount === report.selection?.candidateCount &&
        report.endToEndEvidence?.directAnswerCandidateRecall === 1,
      report.endToEndEvidence?.directAnswerCandidateRecall ?? null,
      '1.0 at the selected candidate count',
    ),
    check(
      'end_to_end_ranked_recall',
      report.endToEndEvidence?.candidateCount === report.selection?.candidateCount &&
        report.endToEndEvidence?.directAnswerRankedRecall === 1,
      report.endToEndEvidence?.directAnswerRankedRecall ?? null,
      '1.0 after reranking and assembly',
    ),
    check(
      'end_to_end_integrity',
      report.endToEndEvidence?.candidateDegradedQueries === 0 &&
        report.endToEndEvidence?.rankedDegradedQueries === 0 &&
        report.endToEndEvidence?.rerankFallbackRate === 0,
      report.endToEndEvidence
        ? report.endToEndEvidence.candidateDegradedQueries + report.endToEndEvidence.rankedDegradedQueries
        : null,
      'zero degraded queries and zero rerank fallbacks',
    ),
    check('five_runs', (selected?.runCount ?? 0) >= 5, selected?.runCount ?? 0, 'at least 5'),
    check(
      'ndcg_gain',
      (selected?.ndcgDeltaFromFusion ?? -Infinity) >= 0.05,
      selected?.ndcgDeltaFromFusion ?? null,
      'at least +0.05',
    ),
    check(
      'category_regression',
      (minimumCategoryDelta ?? -Infinity) >= -0.03,
      minimumCategoryDelta,
      'no category below -0.03',
    ),
    check(
      'exact_entity_mrr',
      exact !== null && exact.quality.mrrAt10 - exact.fusionBaseline.mrrAt10 >= -0.01,
      exact ? exact.quality.mrrAt10 - exact.fusionBaseline.mrrAt10 : null,
      'at least -0.01',
    ),
    check(
      'valid_responses',
      (selected?.validResponseRate ?? 0) >= 0.995,
      selected?.validResponseRate ?? null,
      'at least 0.995',
    ),
    check(
      'fallback_preserved',
      selected?.fallbackPreserved === true,
      selected?.fallbackPreserved ?? null,
      'true',
    ),
    check(
      'instruction_safety',
      selected?.qualification?.instructionNegativeRejection === 1,
      selected?.qualification?.instructionNegativeRejection ?? null,
      '1.0',
    ),
    check(
      'top3_stability',
      (selected?.medianTop3Overlap ?? 0) >= 0.9,
      selected?.medianTop3Overlap ?? null,
      'at least 0.90',
    ),
    check(
      'latency',
      (selected?.p95LatencyMs ?? Infinity) <= 2500,
      selected?.p95LatencyMs ?? null,
      'at most 2500ms',
    ),
    check(
      'cheapest_equivalent_effort',
      selectionUsesCheapestEquivalent(report),
      report.selection?.reasoningEffort ?? null,
      'none unless low improves nDCG by more than 0.01',
    ),
  ];
  const blockers = checks.filter((entry) => !entry.passed).map((entry) => entry.id);
  return { passed: blockers.length === 0, checks, blockers };
}

export function medianTop3Overlap(rankings: string[][]): number | null {
  if (rankings.length < 2) return null;
  const overlaps: number[] = [];
  for (let left = 0; left < rankings.length - 1; left++) {
    for (let right = left + 1; right < rankings.length; right++) {
      const leftSet = new Set(rankings[left]!.slice(0, 3));
      const intersection = rankings[right]!.slice(0, 3).filter((id) => leftSet.has(id)).length;
      overlaps.push(intersection / 3);
    }
  }
  return median(overlaps);
}

function summarizeVariant(descriptor: MatrixDescriptor, reports: RankingBenchReport[]): RankingMatrixVariant {
  const queryLatencies = reports.flatMap((report) => report.queries.map((query) => query.latencyMs));
  return {
    id: descriptor.id,
    system: descriptor.system,
    provider: reports[0]!.provider,
    model: reports[0]!.model,
    reasoningEffort: descriptor.reasoningEffort,
    promptVersion: reports[0]!.promptVersion,
    schemaVersion: reports[0]!.schemaVersion,
    candidateCount: descriptor.candidateCount,
    excerptChars: reports[0]!.execution.excerptChars,
    runCount: reports.length,
    comparisonEligible: reports.some((report) => report.validResponseRate > 0),
    quality: meanQuality(reports.map((report) => report.quality)),
    fusionBaseline: meanQuality(reports.map((report) => report.fusionBaseline)),
    ndcgDeltaFromFusion: mean(reports.map((report) => report.ndcgDeltaFromFusion)),
    byCategory: meanCategories(reports),
    qualification: meanQualification(reports.map((report) => report.qualification)),
    validResponseRate: mean(reports.map((report) => report.validResponseRate)),
    fallbackPreserved: reports.every((report) => fallbacksPreserveFusion(report)),
    p50LatencyMs: percentile(queryLatencies, 0.5),
    p95LatencyMs: percentile(queryLatencies, 0.95),
    maxLatencyMs: queryLatencies.length === 0 ? 0 : Math.max(...queryLatencies),
    medianTop3Overlap: stabilityFor(reports),
    runs: reports.map((report) => ({
      quality: report.quality,
      validResponseRate: report.validResponseRate,
      p50LatencyMs: report.p50LatencyMs,
      p95LatencyMs: report.p95LatencyMs,
      maxLatencyMs: report.maxLatencyMs,
      topThree: Object.fromEntries(report.queries.map((query) => [query.queryId, query.order.slice(0, 3)])),
      fallbackQueries: report.fallbackQueries,
    })),
  };
}

function selectConfiguration(variants: RankingMatrixVariant[]): RankingMatrixSelection | null {
  const none20 = variants.find((variant) => variant.id === 'llm-none-c20');
  const low20 = variants.find((variant) => variant.id === 'llm-low-c20');
  if (!none20?.comparisonEligible || !low20?.comparisonEligible) return null;
  const effort: ReasoningEffort = none20.quality.ndcgAt10 >= low20.quality.ndcgAt10 - 0.01 ? 'none' : 'low';
  if (effort === 'low') {
    return {
      variantId: low20.id,
      candidateCount: 20,
      reasoningEffort: 'low',
      rationale: 'Low reasoning improved nDCG by more than 0.01 at 20 candidates.',
    };
  }
  const candidates = variants.filter(
    (variant) => variant.system === 'llm' && variant.reasoningEffort === 'none',
  );
  const best = Math.max(...candidates.map((variant) => variant.quality.ndcgAt10));
  const selected = candidates
    .filter((variant) => variant.comparisonEligible && variant.quality.ndcgAt10 >= best - 0.01)
    .sort((a, b) => a.candidateCount - b.candidateCount)[0];
  if (!selected) return null;
  return {
    variantId: selected.id,
    candidateCount: selected.candidateCount,
    reasoningEffort: 'none',
    rationale: 'Reasoning none is within 0.01 nDCG of low; the smallest equivalent candidate pool wins.',
  };
}

function hasComparableMeasurements(variant: RankingMatrixVariant): boolean {
  return (
    variant.validResponseRate > 0 &&
    Number.isFinite(variant.quality.ndcgAt10) &&
    Number.isFinite(variant.ndcgDeltaFromFusion)
  );
}

function selectionUsesCheapestEquivalent(report: RankingMatrixReport): boolean {
  const expected = selectConfiguration(report.variants);
  return expected !== null && report.selection?.variantId === expected.variantId;
}

function endToEndConfigurationMatches(
  report: RankingMatrixReport,
  selected: RankingMatrixVariant | null,
): boolean {
  const evidence = report.endToEndEvidence;
  return Boolean(
    evidence &&
    selected &&
    evidence.split === report.split &&
    evidence.corpusVersion === report.corpus.version &&
    evidence.candidateCount === selected.candidateCount &&
    evidence.embeddingAvailable &&
    evidence.totalChunks > 0 &&
    evidence.embeddedChunks === evidence.totalChunks &&
    evidence.embeddingProvider === selected.provider &&
    evidence.embeddingModel !== null &&
    evidence.rerankerAvailable &&
    evidence.rerankerProvider === selected.provider &&
    evidence.rerankerModel === selected.model &&
    evidence.reasoningEffort === selected.reasoningEffort &&
    evidence.promptVersion === selected.promptVersion &&
    evidence.schemaVersion === selected.schemaVersion,
  );
}

function stabilityFor(reports: RankingBenchReport[]): number | null {
  if (reports.length < 2) return null;
  const overlaps = reports[0]!.queries.flatMap((query) => {
    const rankings = reports.map(
      (report) => report.queries.find((candidate) => candidate.queryId === query.queryId)!.order,
    );
    const overlap = medianTop3Overlap(rankings);
    return overlap === null ? [] : [overlap];
  });
  return median(overlaps);
}

function fallbacksPreserveFusion(report: RankingBenchReport): boolean {
  const cases = new Map(rankingCorpusCases(report.split).map((benchCase) => [benchCase.id, benchCase]));
  return report.queries.every((query) => {
    if (!query.fallback) return true;
    const expected = cases.get(query.queryId)?.pool.slice(0, report.execution.candidateCount) ?? [];
    return query.order.length === expected.length && query.order.every((id, index) => id === expected[index]);
  });
}

function meanCategories(reports: RankingBenchReport[]): RankingCategoryReport[] {
  return reports[0]!.byCategory.map((category) => {
    const entries = reports.map((report) =>
      report.byCategory.find((candidate) => candidate.category === category.category)!,
    );
    const quality = meanQuality(entries.map((entry) => entry.quality));
    const fusionBaseline = meanQuality(entries.map((entry) => entry.fusionBaseline));
    return {
      category: category.category,
      queries: category.queries,
      quality,
      fusionBaseline,
      ndcgDeltaFromFusion: quality.ndcgAt10 - fusionBaseline.ndcgAt10,
    };
  });
}

function meanQuality(values: RankingQualityMetrics[]): RankingQualityMetrics {
  return {
    ndcgAt10: mean(values.map((value) => value.ndcgAt10)),
    mrrAt10: mean(values.map((value) => value.mrrAt10)),
    successAt1: mean(values.map((value) => value.successAt1)),
    successAt3: mean(values.map((value) => value.successAt3)),
    precisionAt5: mean(values.map((value) => value.precisionAt5)),
    gradeZeroAboveGradeThree: mean(values.map((value) => value.gradeZeroAboveGradeThree)),
  };
}

function meanQualification(
  values: (RankingQualificationMetrics | null)[],
): RankingQualificationMetrics | null {
  const present = values.filter((value): value is RankingQualificationMetrics => value !== null);
  if (present.length === 0) return null;
  return {
    answerRetention: mean(present.map((value) => value.answerRetention)),
    supportRetention: mean(present.map((value) => value.supportRetention)),
    marginalRetention: mean(present.map((value) => value.marginalRetention)),
    irrelevantRejection: mean(present.map((value) => value.irrelevantRejection)),
    retainedPrecision: mean(present.map((value) => value.retainedPrecision)),
    instructionNegativeRejection: mean(present.map((value) => value.instructionNegativeRejection)),
  };
}

function check(
  id: RankingReleaseCheck['id'],
  passed: boolean,
  actual: RankingReleaseCheck['actual'],
  target: string,
): RankingReleaseCheck {
  return { id, passed, actual, target };
}

function normalizeRuns(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 5;
}

function normalizeConcurrency(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(16, Math.floor(value))) : 4;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}
