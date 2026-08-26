import type { AknoConfig, ReasoningEffort, ResolvedModelRole } from '../config/schema.ts';
import {
  judgeSemanticMergeCandidate,
  SEMANTIC_MERGE_PROMPT_VERSION,
  type SemanticMergeVerdict,
} from '../maintenance/merge-classifier.ts';
import { ModelClient } from '../models/client.ts';
import {
  MERGE_DISCOVERY_CORPUS_VERSION,
  mergeDiscoveryCorpus,
  mergeDiscoveryCorpusFingerprint,
  validateMergeDiscoveryCorpora,
  type MergeDiscoveryBenchCase,
  type MergeDiscoveryBenchPage,
  type MergeDiscoveryCategory,
  type MergeDiscoveryCorpus,
  type MergeDiscoverySplit,
} from './merge-discovery-corpus.ts';
import {
  MERGE_DISCOVERY_REVIEW_EVIDENCE_VERSION,
  type MergeDiscoveryReviewEvidence,
} from './merge-discovery-review.ts';

export const MERGE_DISCOVERY_BENCH_VERSION = 'merge-discovery-benchmark-v2';
const REQUIRED_STABILITY_RUNS = 5;
const PREFILTER_THRESHOLD = 0.68;

export type { MergeDiscoveryCategory, MergeDiscoverySplit } from './merge-discovery-corpus.ts';

export interface MergeDiscoveryBenchOptions {
  split?: MergeDiscoverySplit;
  runs?: number;
  review?: MergeDiscoveryReviewEvidence;
  embeddingProvider?: string;
  embeddingModel?: string;
  provider?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  onProgress?: (progress: { run: number; runs: number }) => void;
}

export interface MergeDiscoveryCaseScore {
  id: string;
  category: MergeDiscoveryCategory;
  expected: 'candidate' | 'keep_separate';
  score: number;
  selected: boolean;
  passed: boolean;
}

export interface MergeDiscoveryEvaluation {
  threshold: number;
  metrics: {
    candidateRecall: number;
    candidatePrecision: number;
    falsePositiveRate: number;
    relatedScopeRejection: number;
    templateRejection: number;
    entityCollisionRejection: number;
    scoreMargin: number;
  };
  cases: MergeDiscoveryCaseScore[];
  passed: boolean;
  blockers: string[];
}

export interface MergeDiscoveryClassifierCase {
  id: string;
  category: MergeDiscoveryCategory;
  expected: 'candidate' | 'keep_separate';
  score: number;
  prefiltered: boolean;
  outcome: SemanticMergeVerdict['outcome'] | null;
  valid: boolean;
  passed: boolean;
  latencyMs: number;
}

export interface MergeDiscoveryClassifierReport {
  run: number;
  provider: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  promptVersion: string;
  prefilterThreshold: number;
  calls: number;
  metrics: {
    validResponseRate: number;
    candidateRecall: number;
    candidatePrecision: number;
    falsePositiveRate: number;
    relatedScopeRejection: number;
    templateRejection: number;
    entityCollisionRejection: number;
  };
  cases: MergeDiscoveryClassifierCase[];
  passed: boolean;
  blockers: string[];
}

export interface MergeDiscoveryStability {
  requestedRuns: number;
  completedRuns: number;
  passingRuns: number;
  stableCaseRate: number | null;
  flakyCaseIds: string[];
}

export interface MergeDiscoveryBenchReport {
  kind: 'invented_merge_discovery_benchmark';
  schemaVersion: string;
  createdAt: string;
  development: boolean;
  artifactPersisted: boolean;
  releaseEligible: boolean;
  split: MergeDiscoverySplit;
  corpus: {
    version: string;
    fingerprint: string;
    pages: number;
    cases: number;
    frozen: boolean;
    independentlyReviewed: boolean;
    reviewReceiptFingerprint: string | null;
  };
  embedding: { provider: string; model: string };
  embeddingLatencyMs: number;
  embeddingOnly: MergeDiscoveryEvaluation;
  classifier: MergeDiscoveryClassifierReport | null;
  runs: MergeDiscoveryClassifierReport[];
  stability: MergeDiscoveryStability;
  passed: boolean;
  blockers: string[];
  releaseBlockers: string[];
  error: 'embedding_unavailable' | 'embedding_failed' | 'classifier_unavailable' | null;
}

/** Sends only the tracked invented corpus to the selected embedding and classifier endpoints. */
export async function runMergeDiscoveryBench(
  config: AknoConfig,
  options: MergeDiscoveryBenchOptions = {},
): Promise<MergeDiscoveryBenchReport> {
  validateMergeDiscoveryCorpora();
  const split = options.split ?? 'development';
  const corpus = mergeDiscoveryCorpus(split);
  const review = validateReview(split, mergeDiscoveryCorpusFingerprint(corpus), options.review);
  const requestedRuns = normalizeRuns(options.runs ?? (split === 'test' ? REQUIRED_STABILITY_RUNS : 1));
  const providerName = options.embeddingProvider ?? config.models.embedding.provider?.name ?? 'openai';
  const modelId = options.embeddingModel ?? config.models.embedding.id ?? 'text-embedding-3-small';
  const provider = config.providers[providerName] ?? null;
  const role: ResolvedModelRole = {
    ...config.models.embedding,
    role: 'embedding',
    provider,
    id: modelId,
    enabled: provider !== null,
    requested: true,
    unavailableReason: provider ? null : `provider "${providerName}" is not configured`,
  };
  const embedded = await new ModelClient(role).embed(corpus.pages.map((entry) => entry.text));
  if (!embedded.ok || !embedded.value) {
    return failedReport({
      corpus,
      review,
      requestedRuns,
      provider: providerName,
      model: modelId,
      latencyMs: embedded.latencyMs,
      error: provider ? 'embedding_failed' : 'embedding_unavailable',
    });
  }
  const vectors = new Map(corpus.pages.map((entry, index) => [entry.id, embedded.value![index]!]));
  const scores = corpus.cases.map((entry) => ({
    ...entry,
    score: cosine(vectors.get(entry.left)!, vectors.get(entry.right)!),
  }));
  const embeddingOnly = selectThreshold(scores);
  const classifierRole = classifierModel(config, options);
  if (!classifierRole.client.available) {
    return finishReport({
      corpus,
      review,
      requestedRuns,
      embedding: { provider: providerName, model: modelId },
      embeddingLatencyMs: embedded.latencyMs,
      embeddingOnly,
      runs: [],
      error: 'classifier_unavailable',
      prerequisiteBlockers: ['classifier_unavailable'],
    });
  }
  const runs: MergeDiscoveryClassifierReport[] = [];
  for (let run = 1; run <= requestedRuns; run++) {
    runs.push(await classifyCases(classifierRole, corpus, scores, run));
    options.onProgress?.({ run, runs: requestedRuns });
  }
  return finishReport({
    corpus,
    review,
    requestedRuns,
    embedding: { provider: providerName, model: modelId },
    embeddingLatencyMs: embedded.latencyMs,
    embeddingOnly,
    runs,
    error: null,
    prerequisiteBlockers: [],
  });
}

/** Marks the exact report that is about to be persisted. */
export function markMergeDiscoveryBenchPersisted(
  report: MergeDiscoveryBenchReport,
): MergeDiscoveryBenchReport {
  return refreshRelease({ ...report, artifactPersisted: true });
}

export function evaluateMergeDiscoveryScores(
  scores: ReadonlyArray<Omit<MergeDiscoveryBenchCase, 'left' | 'right'> & { score: number }>,
  threshold: number,
): MergeDiscoveryEvaluation {
  const cases = scores.map((entry): MergeDiscoveryCaseScore => {
    const selected = entry.score >= threshold;
    return {
      id: entry.id,
      category: entry.category,
      expected: entry.expected,
      score: entry.score,
      selected,
      passed: selected === (entry.expected === 'candidate'),
    };
  });
  const positives = cases.filter((entry) => entry.expected === 'candidate');
  const negatives = cases.filter((entry) => entry.expected === 'keep_separate');
  const selected = cases.filter((entry) => entry.selected);
  const falsePositives = negatives.filter((entry) => entry.selected);
  const positiveScores = positives.map((entry) => entry.score);
  const negativeScores = negatives.map((entry) => entry.score);
  const metrics = {
    candidateRecall: ratio(positives.filter((entry) => entry.selected).length, positives.length),
    candidatePrecision: ratio(
      selected.filter((entry) => entry.expected === 'candidate').length,
      selected.length,
    ),
    falsePositiveRate: ratio(falsePositives.length, negatives.length),
    relatedScopeRejection: rejectionRate(cases, 'related_scope'),
    templateRejection: rejectionRate(cases, 'template'),
    entityCollisionRejection: rejectionRate(cases, 'entity_collision'),
    scoreMargin: Math.min(...positiveScores) - Math.max(...negativeScores),
  };
  const blockers: string[] = [];
  if (metrics.candidatePrecision < 1) blockers.push('candidate_precision');
  if (metrics.candidateRecall < 0.75) blockers.push('candidate_recall');
  if (metrics.falsePositiveRate > 0) blockers.push('false_positive_rate');
  if (metrics.relatedScopeRejection < 1) blockers.push('related_scope_rejection');
  if (metrics.templateRejection < 1) blockers.push('template_rejection');
  if (metrics.entityCollisionRejection < 1) blockers.push('entity_collision_rejection');
  if (metrics.scoreMargin <= 0) blockers.push('score_margin');
  return { threshold, metrics, cases, passed: blockers.length === 0, blockers };
}

export function evaluateMergeDiscoveryStability(
  runs: MergeDiscoveryClassifierReport[],
  cases: readonly MergeDiscoveryBenchCase[],
  requestedRuns: number,
): MergeDiscoveryStability {
  const completedRuns = runs.filter((run) => run.cases.length === cases.length).length;
  const flakyCaseIds =
    runs.length < 2
      ? []
      : cases.flatMap((benchCase) => {
          const reports = runs.map((run) => run.cases.find((entry) => entry.id === benchCase.id));
          if (reports.some((report) => report === undefined)) return [benchCase.id];
          const decisions = new Set(reports.map((report) => classifierDecision(report!)));
          return decisions.size === 1 ? [] : [benchCase.id];
        });
  return {
    requestedRuns,
    completedRuns,
    passingRuns: runs.filter((run) => run.passed).length,
    stableCaseRate: runs.length < 2 ? null : ratio(cases.length - flakyCaseIds.length, cases.length),
    flakyCaseIds,
  };
}

function finishReport(options: {
  corpus: MergeDiscoveryCorpus;
  review: MergeDiscoveryReviewEvidence | null;
  requestedRuns: number;
  embedding: { provider: string; model: string };
  embeddingLatencyMs: number;
  embeddingOnly: MergeDiscoveryEvaluation;
  runs: MergeDiscoveryClassifierReport[];
  error: MergeDiscoveryBenchReport['error'];
  prerequisiteBlockers: string[];
}): MergeDiscoveryBenchReport {
  const stability = evaluateMergeDiscoveryStability(
    options.runs,
    options.corpus.cases,
    options.requestedRuns,
  );
  const blockers = dedupe([...options.prerequisiteBlockers, ...options.runs.flatMap((run) => run.blockers)]);
  if (stability.completedRuns !== options.requestedRuns) blockers.push('incomplete_runs');
  if (stability.passingRuns !== options.requestedRuns) blockers.push('run_quality');
  if (stability.stableCaseRate !== null && stability.stableCaseRate < 1) blockers.push('case_stability');
  return refreshRelease({
    kind: 'invented_merge_discovery_benchmark',
    schemaVersion: MERGE_DISCOVERY_BENCH_VERSION,
    createdAt: new Date().toISOString(),
    development: options.corpus.split === 'development',
    artifactPersisted: false,
    releaseEligible: false,
    split: options.corpus.split,
    corpus: corpusSummary(options.corpus, options.review),
    embedding: options.embedding,
    embeddingLatencyMs: options.embeddingLatencyMs,
    embeddingOnly: options.embeddingOnly,
    classifier: options.runs[0] ?? null,
    runs: options.runs,
    stability,
    passed: blockers.length === 0,
    blockers: dedupe(blockers),
    releaseBlockers: [],
    error: options.error,
  });
}

function refreshRelease(report: MergeDiscoveryBenchReport): MergeDiscoveryBenchReport {
  const releaseBlockers = [...report.blockers];
  if (report.split !== 'test') releaseBlockers.push('held_out_split');
  if (!report.corpus.independentlyReviewed) releaseBlockers.push('independent_review');
  if (report.stability.requestedRuns < REQUIRED_STABILITY_RUNS) releaseBlockers.push('five_runs');
  if (!report.artifactPersisted) releaseBlockers.push('persisted_artifact');
  return {
    ...report,
    releaseEligible: releaseBlockers.length === 0,
    releaseBlockers: dedupe(releaseBlockers),
  };
}

function selectThreshold(
  scores: ReadonlyArray<Omit<MergeDiscoveryBenchCase, 'left' | 'right'> & { score: number }>,
): MergeDiscoveryEvaluation {
  const values = [...new Set(scores.map((entry) => entry.score))].sort((left, right) => left - right);
  const thresholds = [
    0,
    ...values.slice(0, -1).map((value, index) => (value + values[index + 1]!) / 2),
    1.000001,
  ];
  const evaluated = thresholds.map((threshold) => evaluateMergeDiscoveryScores(scores, threshold));
  return evaluated.sort(
    (left, right) =>
      Number(right.passed) - Number(left.passed) ||
      right.metrics.candidatePrecision - left.metrics.candidatePrecision ||
      right.metrics.candidateRecall - left.metrics.candidateRecall ||
      left.metrics.falsePositiveRate - right.metrics.falsePositiveRate ||
      left.threshold - right.threshold,
  )[0]!;
}

function failedReport(options: {
  corpus: MergeDiscoveryCorpus;
  review: MergeDiscoveryReviewEvidence | null;
  requestedRuns: number;
  provider: string;
  model: string;
  latencyMs: number;
  error: NonNullable<MergeDiscoveryBenchReport['error']>;
}): MergeDiscoveryBenchReport {
  const scores = options.corpus.cases.map(({ left: _left, right: _right, ...entry }) => ({
    ...entry,
    score: 0,
  }));
  return finishReport({
    corpus: options.corpus,
    review: options.review,
    requestedRuns: options.requestedRuns,
    embedding: { provider: options.provider, model: options.model },
    embeddingLatencyMs: options.latencyMs,
    embeddingOnly: evaluateMergeDiscoveryScores(scores, 1.000001),
    runs: [],
    error: options.error,
    prerequisiteBlockers: [options.error],
  });
}

function classifierModel(
  config: AknoConfig,
  options: MergeDiscoveryBenchOptions,
): {
  client: ModelClient;
  provider: string;
  model: string;
  reasoningEffort: ReasoningEffort;
} {
  const configured = config.maintenance.model ?? config.models.derive;
  const providerName = options.provider ?? configured.provider?.name ?? 'openai';
  const provider = config.providers[providerName] ?? null;
  const role: ResolvedModelRole = {
    ...configured,
    role: 'maintenance',
    provider,
    id: options.model ?? configured.id ?? 'gpt-5.6-luna',
    enabled: provider !== null,
    requested: true,
    maxOutputTokens: 400,
    reasoningEffort: options.reasoningEffort ?? configured.reasoningEffort ?? 'none',
    unavailableReason: provider ? null : `provider "${providerName}" is not configured`,
  };
  return {
    client: new ModelClient(role),
    provider: providerName,
    model: role.id ?? 'unknown',
    reasoningEffort: role.reasoningEffort ?? 'none',
  };
}

async function classifyCases(
  model: ReturnType<typeof classifierModel>,
  corpus: MergeDiscoveryCorpus,
  scores: ReadonlyArray<MergeDiscoveryBenchCase & { score: number }>,
  run: number,
): Promise<MergeDiscoveryClassifierReport> {
  const pageById = new Map(corpus.pages.map((entry) => [entry.id, entry]));
  const reports: MergeDiscoveryClassifierCase[] = [];
  for (const bench of scores) {
    if (bench.score < PREFILTER_THRESHOLD) {
      reports.push({
        id: bench.id,
        category: bench.category,
        expected: bench.expected,
        score: bench.score,
        prefiltered: false,
        outcome: null,
        valid: true,
        passed: bench.expected === 'keep_separate',
        latencyMs: 0,
      });
      continue;
    }
    const left = pageById.get(bench.left)!;
    const right = pageById.get(bench.right)!;
    const result = await judgeSemanticMergeCandidate(
      model.client,
      semanticPage(left, bench.left),
      semanticPage(right, bench.right),
    );
    const outcome = result.value?.outcome ?? null;
    reports.push({
      id: bench.id,
      category: bench.category,
      expected: bench.expected,
      score: bench.score,
      prefiltered: true,
      outcome,
      valid: result.ok && outcome !== null,
      passed:
        result.ok && outcome !== null && (outcome === 'same_subject') === (bench.expected === 'candidate'),
      latencyMs: result.latencyMs,
    });
  }
  const positives = reports.filter((entry) => entry.expected === 'candidate');
  const negatives = reports.filter((entry) => entry.expected === 'keep_separate');
  const selected = reports.filter((entry) => entry.outcome === 'same_subject');
  const called = reports.filter((entry) => entry.prefiltered);
  const metrics = {
    validResponseRate: ratio(called.filter((entry) => entry.valid).length, called.length),
    candidateRecall: ratio(
      selected.filter((entry) => entry.expected === 'candidate').length,
      positives.length,
    ),
    candidatePrecision: ratio(
      selected.filter((entry) => entry.expected === 'candidate').length,
      selected.length,
    ),
    falsePositiveRate: ratio(
      selected.filter((entry) => entry.expected === 'keep_separate').length,
      negatives.length,
    ),
    relatedScopeRejection: classifierRejectionRate(reports, 'related_scope'),
    templateRejection: classifierRejectionRate(reports, 'template'),
    entityCollisionRejection: classifierRejectionRate(reports, 'entity_collision'),
  };
  const blockers: string[] = [];
  if (metrics.validResponseRate < 1) blockers.push('valid_response_rate');
  if (metrics.candidateRecall < 0.75) blockers.push('candidate_recall');
  if (metrics.candidatePrecision < 1) blockers.push('candidate_precision');
  if (metrics.falsePositiveRate > 0) blockers.push('false_positive_rate');
  if (metrics.relatedScopeRejection < 1) blockers.push('related_scope_rejection');
  if (metrics.templateRejection < 1) blockers.push('template_rejection');
  if (metrics.entityCollisionRejection < 1) blockers.push('entity_collision_rejection');
  return {
    run,
    provider: model.provider,
    model: model.model,
    reasoningEffort: model.reasoningEffort,
    promptVersion: SEMANTIC_MERGE_PROMPT_VERSION,
    prefilterThreshold: PREFILTER_THRESHOLD,
    calls: reports.filter((entry) => entry.prefiltered).length,
    metrics,
    cases: reports,
    passed: blockers.length === 0,
    blockers,
  };
}

function validateReview(
  split: MergeDiscoverySplit,
  fingerprint: string,
  review: MergeDiscoveryReviewEvidence | undefined,
): MergeDiscoveryReviewEvidence | null {
  if (split === 'development') return null;
  if (!review) throw new Error('held-out merge discovery requires an approved review packet');
  if (
    review.kind !== 'merge_discovery_review_evidence' ||
    review.schemaVersion !== MERGE_DISCOVERY_REVIEW_EVIDENCE_VERSION ||
    review.corpusVersion !== MERGE_DISCOVERY_CORPUS_VERSION ||
    review.corpusFingerprint !== fingerprint ||
    review.sourceReviews !== mergeDiscoveryCorpus('test').pages.length ||
    review.caseReviews !== mergeDiscoveryCorpus('test').cases.length ||
    !['human', 'model'].includes(review.reviewerKind) ||
    Number.isNaN(Date.parse(review.reviewedAt)) ||
    !/^[a-f0-9]{64}$/.test(review.packetFingerprint) ||
    !/^[a-f0-9]{64}$/.test(review.receiptFingerprint) ||
    review.independenceConfirmed !== true ||
    review.checksConfirmed !== true
  ) {
    throw new Error('merge discovery review evidence does not match the frozen held-out corpus');
  }
  return review;
}

function normalizeRuns(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('merge discovery runs must be an integer from 1 to 10');
  }
  return value;
}

function semanticPage(
  entry: MergeDiscoveryBenchPage,
  slug: string,
): { slug: string; title: string; content: string } {
  const title = /^# (.+)$/m.exec(entry.text)?.[1] ?? slug;
  return { slug, title, content: entry.text };
}

function classifierRejectionRate(
  cases: MergeDiscoveryClassifierCase[],
  category: MergeDiscoveryCategory,
): number {
  const selected = cases.filter((entry) => entry.category === category);
  return ratio(selected.filter((entry) => entry.outcome !== 'same_subject').length, selected.length);
}

function classifierDecision(report: MergeDiscoveryClassifierCase): string {
  if (!report.valid) return 'invalid';
  return report.prefiltered ? (report.outcome ?? 'invalid') : 'keep_separate';
}

function corpusSummary(
  corpus: MergeDiscoveryCorpus,
  review: MergeDiscoveryReviewEvidence | null,
): MergeDiscoveryBenchReport['corpus'] {
  return {
    version: MERGE_DISCOVERY_CORPUS_VERSION,
    fingerprint: mergeDiscoveryCorpusFingerprint(corpus),
    pages: corpus.pages.length,
    cases: corpus.cases.length,
    frozen: corpus.frozen,
    independentlyReviewed: review !== null,
    reviewReceiptFingerprint: review?.receiptFingerprint ?? null,
  };
}

function rejectionRate(cases: MergeDiscoveryCaseScore[], category: MergeDiscoveryCategory): number {
  const selected = cases.filter((entry) => entry.category === category);
  return ratio(selected.filter((entry) => !entry.selected).length, selected.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function cosine(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! * left[index]!;
    rightNorm += right[index]! * right[index]!;
  }
  return leftNorm === 0 || rightNorm === 0 ? 0 : dot / Math.sqrt(leftNorm * rightNorm);
}
