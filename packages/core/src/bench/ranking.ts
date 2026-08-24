import type { AknoConfig, ReasoningEffort, ResolvedModelRole } from '../config/schema.ts';
import { ModelClient, type ModelUsage } from '../models/client.ts';
import {
  allocateLlmRerankIds,
  LLM_RERANK_PROMPT_VERSION,
  LLM_RERANK_SCHEMA_VERSION,
  rerankWithLlm,
  type LlmRerankCandidate,
} from '../recall/llm-rerank.ts';
import { nativeRerankerCalibration } from '../recall/reranker-calibration.ts';
import type { Store } from '../store/db.ts';
import {
  RANKING_CATEGORIES,
  RANKING_CORPUS,
  rankingCorpusCases,
  type RankingBenchSplit,
  type RankingCase,
  type RankingCategory,
  type RelevanceGrade,
} from './ranking-corpus.ts';
import { rankingCorpusFingerprint } from './ranking-review.ts';

export type { RankingBenchSplit, RankingCategory } from './ranking-corpus.ts';
export type RankingBenchSystem = 'fusion' | 'native' | 'llm';
export type RankingCandidateCount = 10 | 20 | 40;
export type RankingExcerptChars = 400 | 800 | 1600;

export interface RankingBenchOptions {
  system: RankingBenchSystem;
  split?: RankingBenchSplit;
  candidateCount?: RankingCandidateCount;
  excerptChars?: RankingExcerptChars;
  concurrency?: number;
  provider?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface RankingQualityMetrics {
  ndcgAt10: number;
  mrrAt10: number;
  successAt1: number;
  successAt3: number;
  precisionAt5: number;
  gradeZeroAboveGradeThree: number;
}

export interface RankingQualificationMetrics {
  answerRetention: number;
  supportRetention: number;
  marginalRetention: number;
  irrelevantRejection: number;
  retainedPrecision: number;
  instructionNegativeRejection: number;
}

export interface RankingCategoryReport {
  category: RankingCategory;
  queries: number;
  quality: RankingQualityMetrics;
  fusionBaseline: RankingQualityMetrics;
  ndcgDeltaFromFusion: number;
}

export interface RankingTokenUsage {
  reportedQueries: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningOutputTokens: number | null;
}

export interface RankingQueryReport {
  queryId: string;
  category: RankingCategory;
  order: string[];
  rejected: string[] | null;
  latencyMs: number;
  endpointRequests: number;
  usage: ModelUsage | null;
  fallback: string | null;
}

export interface RankingBenchReport {
  passed: boolean;
  development: true;
  releaseEligible: false;
  system: RankingBenchSystem;
  split: RankingBenchSplit;
  provider: string | null;
  model: string | null;
  reasoningEffort: ReasoningEffort | null;
  promptVersion: string | null;
  schemaVersion: string | null;
  corpus: {
    queries: number;
    sources: number;
    judgments: number;
    categories: number;
    version: string;
    fingerprint: string;
  };
  quality: RankingQualityMetrics;
  fusionBaseline: RankingQualityMetrics;
  ndcgDeltaFromFusion: number;
  byCategory: RankingCategoryReport[];
  queries: RankingQueryReport[];
  qualification: RankingQualificationMetrics | null;
  validResponseRate: number;
  fallbackQueries: string[];
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  execution: {
    requests: number;
    concurrency: number;
    candidateCount: RankingCandidateCount;
    excerptChars: RankingExcerptChars;
    maxExcerptChars: number;
    endpointRequests: number;
    extraEndpointRequests: number;
    tokenUsage: RankingTokenUsage | null;
  };
  calibration: {
    basis: 'auto' | 'none';
    threshold: number | null;
    lowestAnswerScore: number | null;
    lowestSupportScore: number | null;
    highestIrrelevantScore: number | null;
    error: string | null;
  };
  failures: { queryId: string; error: string }[];
}

interface QueryOutcome {
  order: number[];
  rejected: Set<number> | null;
  scores: number[] | null;
  latencyMs: number;
  endpointRequests: number;
  usage: ModelUsage | null;
  error: string | null;
}

const MINIMUM_CATEGORY_COUNTS: Record<RankingCategory, number> = {
  exact_entity: 12,
  paraphrased_attribute: 16,
  direct_answer: 12,
  temporal: 12,
  negation: 8,
  ambiguous_identity: 8,
  provenance: 8,
  instruction_bearing: 4,
};

export async function runRankingBench(
  config: AknoConfig,
  options: RankingBenchOptions,
): Promise<RankingBenchReport> {
  validateRankingCorpus();
  const split = options.split ?? 'development';
  const candidateCount = options.candidateCount ?? 20;
  const excerptChars = options.excerptChars ?? 800;
  const concurrency = normalizeConcurrency(options.concurrency ?? 1);
  const cases = rankingCorpusCases(split).map((benchCase) => selectPool(benchCase, candidateCount));
  const baselineOutcomes: QueryOutcome[] = cases.map((benchCase) => ({
    order: benchCase.pool.map((_, index) => index),
    rejected: null,
    scores: null,
    latencyMs: 0,
    endpointRequests: 0,
    usage: null,
    error: null,
  }));
  const fusionBaseline = aggregateQuality(cases, baselineOutcomes);

  let provider: string | null = null;
  let model: string | null = null;
  let reasoningEffort: ReasoningEffort | null = null;
  let calibration: RankingBenchReport['calibration'] = {
    basis: 'none',
    threshold: null,
    lowestAnswerScore: null,
    lowestSupportScore: null,
    highestIrrelevantScore: null,
    error: null,
  };
  let outcomes = baselineOutcomes;

  if (options.system === 'llm') {
    provider = options.provider ?? 'openai';
    model = options.model ?? 'gpt-5.6-luna';
    reasoningEffort = options.reasoningEffort ?? 'none';
    const client = liveClient(config, provider, model, reasoningEffort, candidateCount);
    outcomes = await mapModelCases(cases, concurrency, (benchCase) =>
      runLlmCase(client, benchCase, excerptChars),
    );
  } else if (options.system === 'native') {
    const role = nativeRole(config, options);
    provider = role.provider?.name ?? options.provider ?? null;
    model = role.id;
    const client = new ModelClient(role);
    const memoryMeta = new Map<string, string>();
    const memoryStore = {
      readOnly: false,
      meta: (key: string) => memoryMeta.get(key) ?? null,
      setMeta: (key: string, value: string) => memoryMeta.set(key, value),
    } as unknown as Store;
    const calibrated = await nativeRerankerCalibration(memoryStore, client);
    calibration =
      calibrated.ok && calibrated.value
        ? {
            basis: 'auto',
            threshold: calibrated.value.scoreOffset,
            lowestAnswerScore: null,
            lowestSupportScore: null,
            highestIrrelevantScore: null,
            error: null,
          }
        : {
            basis: 'auto',
            threshold: null,
            lowestAnswerScore: null,
            lowestSupportScore: null,
            highestIrrelevantScore: null,
            error: calibrated.error ?? 'calibration failed',
          };
    outcomes = await mapConcurrent(cases, concurrency, (benchCase) =>
      runNativeCase(client, benchCase, calibration.threshold, excerptChars),
    );
    const observed = nativeScoreDiagnostics(cases, outcomes);
    calibration.lowestAnswerScore = observed?.lowestAnswerScore ?? null;
    calibration.lowestSupportScore = observed?.lowestSupportScore ?? null;
    calibration.highestIrrelevantScore = observed?.highestIrrelevantScore ?? null;
  }

  const quality = aggregateQuality(cases, outcomes);
  const qualification = aggregateQualification(cases, outcomes);
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.error ? [{ queryId: cases[index]!.id, error: outcome.error }] : [],
  );
  const latencies = outcomes.map((outcome) => outcome.latencyMs).filter((latency) => latency > 0);
  const validResponseRate = (cases.length - failures.length) / cases.length;
  const endpointRequests = outcomes.reduce((sum, outcome) => sum + outcome.endpointRequests, 0);
  const logicalRequests = options.system === 'fusion' ? 0 : cases.length;
  const passed =
    options.system === 'fusion' ||
    (validResponseRate === 1 &&
      quality.ndcgAt10 >= fusionBaseline.ndcgAt10 &&
      (qualification?.answerRetention ?? 0) === 1 &&
      (qualification?.instructionNegativeRejection ?? 0) === 1);

  return {
    passed,
    development: true,
    releaseEligible: false,
    system: options.system,
    split,
    provider,
    model,
    reasoningEffort,
    promptVersion: options.system === 'llm' ? LLM_RERANK_PROMPT_VERSION : null,
    schemaVersion: options.system === 'llm' ? LLM_RERANK_SCHEMA_VERSION : null,
    corpus: {
      queries: cases.length,
      sources: Object.keys(RANKING_CORPUS.candidates).length,
      judgments: cases.reduce((sum, benchCase) => sum + benchCase.pool.length, 0),
      categories: new Set(cases.map((benchCase) => benchCase.category)).size,
      version: RANKING_CORPUS.version,
      fingerprint: rankingCorpusFingerprint(),
    },
    quality,
    fusionBaseline,
    ndcgDeltaFromFusion: quality.ndcgAt10 - fusionBaseline.ndcgAt10,
    byCategory: categoryReports(cases, outcomes, baselineOutcomes),
    queries: cases.map((benchCase, index) => queryReport(benchCase, outcomes[index]!)),
    qualification,
    validResponseRate,
    fallbackQueries: failures.map((failure) => failure.queryId),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    maxLatencyMs: latencies.length === 0 ? 0 : Math.max(...latencies),
    execution: {
      requests: logicalRequests,
      concurrency,
      candidateCount,
      excerptChars,
      maxExcerptChars: Math.max(
        ...cases.flatMap((benchCase) =>
          benchCase.pool.map((id) => Math.min(excerptChars, RANKING_CORPUS.candidates[id]!.text.length)),
        ),
      ),
      endpointRequests,
      extraEndpointRequests: Math.max(0, endpointRequests - logicalRequests),
      tokenUsage: aggregateTokenUsage(outcomes),
    },
    calibration,
    failures,
  };
}

export function validateRankingCorpus(): void {
  const sourceEntries = Object.entries(RANKING_CORPUS.candidates);
  if (sourceEntries.length < 120) throw new Error('ranking corpus needs at least 120 sources');
  if (RANKING_CORPUS.cases.length < 80) throw new Error('ranking corpus needs at least 80 queries');
  for (const [id, candidate] of sourceEntries) {
    if (candidate.id !== id) throw new Error(`${id}: candidate key and id differ`);
    if (!candidate.text.trim()) throw new Error(`${id}: candidate text is empty`);
    if (candidate.text.length > 1600) throw new Error(`${id}: candidate exceeds the largest excerpt limit`);
  }

  const caseIds = new Set<string>();
  const categoryCounts = new Map<RankingCategory, number>();
  const splitCategories = new Map<Exclude<RankingBenchSplit, 'all'>, Set<RankingCategory>>([
    ['development', new Set()],
    ['test', new Set()],
  ]);
  const splitCandidateIds = new Map<Exclude<RankingBenchSplit, 'all'>, Set<string>>([
    ['development', new Set()],
    ['test', new Set()],
  ]);
  for (const benchCase of RANKING_CORPUS.cases) {
    if (caseIds.has(benchCase.id)) throw new Error(`${benchCase.id}: duplicate query id`);
    caseIds.add(benchCase.id);
    categoryCounts.set(benchCase.category, (categoryCounts.get(benchCase.category) ?? 0) + 1);
    splitCategories.get(benchCase.split)!.add(benchCase.category);
    for (const id of benchCase.pool) splitCandidateIds.get(benchCase.split)!.add(id);
    if (!benchCase.intent.trim()) throw new Error(`${benchCase.id}: intent is empty`);
    if (benchCase.pool.length !== 40) throw new Error(`${benchCase.id}: matrix pool must have 40 candidates`);
    if (new Set(benchCase.pool).size !== benchCase.pool.length)
      throw new Error(`${benchCase.id}: duplicate candidate`);
    const judgedIds = Object.keys(benchCase.judgments);
    if (judgedIds.length !== benchCase.pool.length || judgedIds.some((id) => !benchCase.pool.includes(id)))
      throw new Error(`${benchCase.id}: judgments must match the frozen pool`);
    const grades = benchCase.pool.map((id) => {
      if (!RANKING_CORPUS.candidates[id]) throw new Error(`${benchCase.id}: unknown candidate ${id}`);
      const grade = benchCase.judgments[id];
      if (grade !== 0 && grade !== 1 && grade !== 2 && grade !== 3)
        throw new Error(`${benchCase.id}: invalid grade for ${id}`);
      return grade;
    });
    if (!grades.includes(3)) throw new Error(`${benchCase.id}: no direct answer`);
    if (![1, 2, 3].every((grade) => grades.slice(0, 10).includes(grade as RelevanceGrade)))
      throw new Error(`${benchCase.id}: smallest matrix pool must contain every relevant grade`);
    if (grades.filter((grade) => grade === 0).length < 3)
      throw new Error(`${benchCase.id}: too few hard negatives`);
    if (
      !benchCase.pool.some(
        (id) => RANKING_CORPUS.candidates[id]!.instructionBearing && benchCase.judgments[id] === 0,
      )
    )
      throw new Error(`${benchCase.id}: no instruction-bearing negative`);
  }

  for (const category of RANKING_CATEGORIES) {
    if ((categoryCounts.get(category) ?? 0) < MINIMUM_CATEGORY_COUNTS[category])
      throw new Error(`${category}: below required query share`);
    if (!splitCategories.get('development')!.has(category) || !splitCategories.get('test')!.has(category))
      throw new Error(`${category}: missing from a corpus split`);
  }
  if (rankingCorpusCases('development').length !== 60 || rankingCorpusCases('test').length !== 20)
    throw new Error('ranking corpus must keep a stratified 60/20 query split');
  const heldOutLeak = [...splitCandidateIds.get('test')!].find(
    (id) =>
      !id.startsWith('distractor-') &&
      !id.startsWith('instruction-') &&
      splitCandidateIds.get('development')!.has(id),
  );
  if (heldOutLeak) throw new Error(`${heldOutLeak}: fact source crosses the development/test boundary`);
}

function selectPool(benchCase: RankingCase, candidateCount: RankingCandidateCount): RankingCase {
  const pool = benchCase.pool.slice(0, candidateCount);
  return {
    ...benchCase,
    pool,
    judgments: Object.fromEntries(pool.map((id) => [id, benchCase.judgments[id]!])),
  };
}

function queryReport(benchCase: RankingCase, outcome: QueryOutcome): RankingQueryReport {
  return {
    queryId: benchCase.id,
    category: benchCase.category,
    order: outcome.order.map((index) => benchCase.pool[index]!),
    rejected:
      outcome.rejected === null ? null : [...outcome.rejected].map((index) => benchCase.pool[index]!).sort(),
    latencyMs: outcome.latencyMs,
    endpointRequests: outcome.endpointRequests,
    usage: outcome.usage,
    fallback: outcome.error,
  };
}

async function mapModelCases(
  cases: RankingCase[],
  concurrency: number,
  run: (benchCase: RankingCase) => Promise<QueryOutcome>,
): Promise<QueryOutcome[]> {
  if (cases.length === 0) return [];
  // Let the client negotiate its structured-output dialect once before parallel requests share its cache.
  const first = await run(cases[0]!);
  const rest = await mapConcurrent(cases.slice(1), concurrency, run);
  return [first, ...rest];
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  run: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await run(values[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeConcurrency(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(16, Math.floor(value))) : 1;
}

function liveClient(
  config: AknoConfig,
  providerName: string,
  modelId: string,
  reasoningEffort: ReasoningEffort,
  candidateCount: RankingCandidateCount,
): ModelClient {
  const provider = config.providers[providerName] ?? null;
  return new ModelClient({
    role: 'reranker',
    provider,
    id: modelId,
    enabled: provider !== null,
    requested: true,
    timeoutMs: 60_000,
    rerankerMode: 'llm',
    maxOutputTokens: Math.max(256, Math.min(2048, candidateCount * 32 + 128)),
    reasoningEffort,
    unavailableReason: provider ? null : `provider "${providerName}" is not configured`,
  });
}

function nativeRole(config: AknoConfig, options: RankingBenchOptions): ResolvedModelRole {
  if (!options.provider && !options.model) return { ...config.models.reranker, rerankerMode: 'endpoint' };
  const providerName = options.provider ?? config.models.reranker.provider?.name ?? 'local';
  const modelId = options.model ?? config.models.reranker.id;
  const provider = config.providers[providerName] ?? null;
  return {
    role: 'reranker',
    provider,
    id: modelId,
    enabled: provider !== null && modelId !== null,
    requested: true,
    timeoutMs: 60_000,
    rerankerMode: 'endpoint',
    unavailableReason: provider
      ? modelId
        ? null
        : 'no native reranker model id'
      : `provider "${providerName}" is not configured`,
  };
}

async function runLlmCase(
  model: ModelClient,
  benchCase: RankingCase,
  excerptChars: RankingExcerptChars,
): Promise<QueryOutcome> {
  const opaqueIds = allocateLlmRerankIds(benchCase.pool.length);
  const candidates: LlmRerankCandidate[] = benchCase.pool.map((id, index) => {
    const candidate = RANKING_CORPUS.candidates[id]!;
    return {
      id: opaqueIds[index]!,
      text: candidate.text.slice(0, excerptChars),
      sourceKind: candidate.sourceKind,
      matchedBy: ['lexical'],
    };
  });
  const result = await rerankWithLlm(model, benchCase.query, candidates);
  if (!result.ok || !result.value)
    return fallback(
      result.latencyMs,
      result.error ?? 'LLM rank failed',
      benchCase,
      result.endpointRequests ?? 0,
      result.usage ?? null,
    );
  return {
    order: result.value.map((entry) => entry.index),
    rejected: new Set(result.value.filter((entry) => entry.relevance === 0).map((entry) => entry.index)),
    scores: null,
    latencyMs: result.latencyMs,
    endpointRequests: result.endpointRequests ?? 0,
    usage: result.usage ?? null,
    error: null,
  };
}

async function runNativeCase(
  model: ModelClient,
  benchCase: RankingCase,
  threshold: number | null,
  excerptChars: RankingExcerptChars,
): Promise<QueryOutcome> {
  const result = await model.rerank(
    benchCase.query,
    benchCase.pool.map((id) => RANKING_CORPUS.candidates[id]!.text.slice(0, excerptChars)),
    benchCase.pool.length,
  );
  if (!result.ok || !result.value)
    return fallback(
      result.latencyMs,
      result.error ?? 'native rank failed',
      benchCase,
      result.endpointRequests ?? 0,
    );
  const entries = completeEntries(result.value, benchCase.pool.length);
  if (!entries)
    return fallback(
      result.latencyMs,
      'native rank returned an invalid permutation',
      benchCase,
      result.endpointRequests ?? 0,
    );
  entries.sort((a, b) => b.score - a.score);
  return {
    order: entries.map((entry) => entry.index),
    rejected:
      threshold === null
        ? null
        : new Set(entries.filter((entry) => entry.score < threshold).map((entry) => entry.index)),
    scores: entries
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.score),
    latencyMs: result.latencyMs,
    endpointRequests: result.endpointRequests ?? 0,
    usage: null,
    error: null,
  };
}

function fallback(
  latencyMs: number,
  error: string,
  benchCase: RankingCase,
  endpointRequests = 0,
  usage: ModelUsage | null = null,
): QueryOutcome {
  return {
    order: benchCase.pool.map((_, index) => index),
    rejected: null,
    scores: null,
    latencyMs,
    endpointRequests,
    usage,
    error,
  };
}

function aggregateTokenUsage(outcomes: QueryOutcome[]): RankingTokenUsage | null {
  const usages = outcomes.flatMap((outcome) => (outcome.usage ? [outcome.usage] : []));
  if (usages.length === 0) return null;
  return {
    reportedQueries: usages.length,
    inputTokens: sumReported(usages.map((usage) => usage.inputTokens)),
    outputTokens: sumReported(usages.map((usage) => usage.outputTokens)),
    totalTokens: sumReported(usages.map((usage) => usage.totalTokens)),
    cachedInputTokens: sumReported(usages.map((usage) => usage.cachedInputTokens)),
    reasoningOutputTokens: sumReported(usages.map((usage) => usage.reasoningOutputTokens)),
  };
}

function sumReported(values: Array<number | null | undefined>): number | null {
  const reported = values.filter((value): value is number => typeof value === 'number');
  return reported.length === 0 ? null : reported.reduce((sum, value) => sum + value, 0);
}

function nativeScoreDiagnostics(
  cases: RankingCase[],
  outcomes: QueryOutcome[],
): {
  lowestAnswerScore: number;
  lowestSupportScore: number;
  highestIrrelevantScore: number;
} | null {
  const answers: number[] = [];
  const support: number[] = [];
  const irrelevant: number[] = [];
  outcomes.forEach((outcome, caseIndex) => {
    if (!outcome.scores) return;
    outcome.scores.forEach((score, candidateIndex) => {
      const benchCase = cases[caseIndex]!;
      const grade = benchCase.judgments[benchCase.pool[candidateIndex]!] ?? 0;
      if (grade === 3) answers.push(score);
      else if (grade === 2) support.push(score);
      else if (grade === 0) irrelevant.push(score);
    });
  });
  if (answers.length === 0 || support.length === 0 || irrelevant.length === 0) return null;
  return {
    lowestAnswerScore: Math.min(...answers),
    lowestSupportScore: Math.min(...support),
    highestIrrelevantScore: Math.max(...irrelevant),
  };
}

function aggregateQuality(cases: RankingCase[], outcomes: QueryOutcome[]): RankingQualityMetrics {
  const totals = outcomes.map((outcome, index) => qualityFor(caseGrades(cases[index]!), outcome.order));
  return meanQuality(totals);
}

function meanQuality(totals: RankingQualityMetrics[]): RankingQualityMetrics {
  return {
    ndcgAt10: mean(totals.map((metric) => metric.ndcgAt10)),
    mrrAt10: mean(totals.map((metric) => metric.mrrAt10)),
    successAt1: mean(totals.map((metric) => metric.successAt1)),
    successAt3: mean(totals.map((metric) => metric.successAt3)),
    precisionAt5: mean(totals.map((metric) => metric.precisionAt5)),
    gradeZeroAboveGradeThree: mean(totals.map((metric) => metric.gradeZeroAboveGradeThree)),
  };
}

function categoryReports(
  cases: RankingCase[],
  outcomes: QueryOutcome[],
  baselineOutcomes: QueryOutcome[],
): RankingCategoryReport[] {
  return RANKING_CATEGORIES.flatMap((category) => {
    const indexes = cases.flatMap((benchCase, index) => (benchCase.category === category ? [index] : []));
    if (indexes.length === 0) return [];
    const selectedCases = indexes.map((index) => cases[index]!);
    const quality = aggregateQuality(
      selectedCases,
      indexes.map((index) => outcomes[index]!),
    );
    const fusionBaseline = aggregateQuality(
      selectedCases,
      indexes.map((index) => baselineOutcomes[index]!),
    );
    return [
      {
        category,
        queries: indexes.length,
        quality,
        fusionBaseline,
        ndcgDeltaFromFusion: quality.ndcgAt10 - fusionBaseline.ndcgAt10,
      },
    ];
  });
}

export function qualityFor(benchCase: { grades: RelevanceGrade[] }, order: number[]): RankingQualityMetrics {
  const orderedGrades = order.map((index) => benchCase.grades[index] ?? 0);
  const ideal = [...benchCase.grades].sort((a, b) => b - a);
  const reciprocalRank = orderedGrades.slice(0, 10).findIndex((grade) => grade === 3);
  const firstThree = orderedGrades.slice(0, 3);
  const topFive = orderedGrades.slice(0, 5);
  const firstDirect = orderedGrades.indexOf(3);
  const inversions =
    firstDirect < 0 ? 0 : orderedGrades.slice(0, firstDirect).filter((grade) => grade === 0).length;
  return {
    ndcgAt10: dcg(orderedGrades.slice(0, 10)) / Math.max(dcg(ideal.slice(0, 10)), Number.EPSILON),
    mrrAt10: reciprocalRank < 0 ? 0 : 1 / (reciprocalRank + 1),
    successAt1: orderedGrades[0] === 3 ? 1 : 0,
    successAt3: firstThree.includes(3) ? 1 : 0,
    precisionAt5: topFive.filter((grade) => grade >= 2).length / Math.min(5, topFive.length),
    gradeZeroAboveGradeThree: inversions,
  };
}

function aggregateQualification(
  cases: RankingCase[],
  outcomes: QueryOutcome[],
): RankingQualificationMetrics | null {
  if (outcomes.every((outcome) => outcome.rejected === null)) return null;
  const judgments = outcomes.flatMap((outcome, caseIndex) => {
    const benchCase = cases[caseIndex]!;
    return benchCase.pool.map((id, index) => ({
      grade: benchCase.judgments[id]!,
      rejected: outcome.rejected?.has(index) ?? false,
      instructionBearing: RANKING_CORPUS.candidates[id]!.instructionBearing ?? false,
    }));
  });
  return qualificationFor(judgments);
}

export function qualificationFor(
  judgments: {
    grade: RelevanceGrade;
    rejected: boolean;
    instructionBearing?: boolean;
  }[],
): RankingQualificationMetrics {
  let answers = 0;
  let answersRetained = 0;
  let support = 0;
  let supportRetained = 0;
  let marginal = 0;
  let marginalRetained = 0;
  let irrelevant = 0;
  let irrelevantRejected = 0;
  let retained = 0;
  let retainedRelevant = 0;
  let instructionNegatives = 0;
  let instructionRejected = 0;
  for (const judgment of judgments) {
    const { grade, rejected } = judgment;
    if (grade === 3) {
      answers++;
      if (!rejected) answersRetained++;
    } else if (grade === 2) {
      support++;
      if (!rejected) supportRetained++;
    } else if (grade === 1) {
      marginal++;
      if (!rejected) marginalRetained++;
    } else {
      irrelevant++;
      if (rejected) irrelevantRejected++;
    }
    if (!rejected) {
      retained++;
      if (grade >= 2) retainedRelevant++;
    }
    if (judgment.instructionBearing && grade === 0) {
      instructionNegatives++;
      if (rejected) instructionRejected++;
    }
  }
  return {
    answerRetention: ratio(answersRetained, answers),
    supportRetention: ratio(supportRetained, support),
    marginalRetention: ratio(marginalRetained, marginal),
    irrelevantRejection: ratio(irrelevantRejected, irrelevant),
    retainedPrecision: ratio(retainedRelevant, retained),
    instructionNegativeRejection: ratio(instructionRejected, instructionNegatives),
  };
}

function caseGrades(benchCase: RankingCase): { grades: RelevanceGrade[] } {
  return { grades: benchCase.pool.map((id) => benchCase.judgments[id]!) };
}

function completeEntries(
  entries: { index: number; score: number }[],
  count: number,
): { index: number; score: number }[] | null {
  if (entries.length !== count) return null;
  const seen = new Set<number>();
  for (const entry of entries) {
    if (
      !Number.isInteger(entry.index) ||
      entry.index < 0 ||
      entry.index >= count ||
      !Number.isFinite(entry.score) ||
      seen.has(entry.index)
    )
      return null;
    seen.add(entry.index);
  }
  return entries;
}

function dcg(grades: number[]): number {
  return grades.reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? 0;
}
