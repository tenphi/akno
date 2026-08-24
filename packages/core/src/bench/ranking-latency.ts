import type { AknoConfig, ReasoningEffort } from '../config/schema.ts';
import {
  runRankingBench,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingCandidateCount,
  type RankingExcerptChars,
  type RankingTokenUsage,
} from './ranking.ts';

export const RANKING_LATENCY_SCHEMA_VERSION = 'ranking-latency-v1';
export const RANKING_INTERACTIVE_P95_TARGET_MS = 4_000;

export interface RankingLatencyOptions {
  split?: RankingBenchSplit;
  candidateCount: RankingCandidateCount;
  excerptChars: RankingExcerptChars;
  loadConcurrency?: number;
  provider: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  onProgress?: (progress: RankingLatencyProgress) => void;
}

export interface RankingLatencyProgress {
  profile: 'interactive' | 'loaded';
  concurrency: number;
}

export interface RankingLatencyMetrics {
  samples: number;
  validResponseRate: number;
  fallbackCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  endpointRequests: number;
  extraEndpointRequests: number;
  tokenUsage: RankingTokenUsage | null;
}

export interface RankingLatencyProfile {
  concurrency: number;
  /** The first serialized call on a fresh client, including dialect negotiation. */
  cold: RankingLatencyMetrics;
  /** Every later call after the client has learned the endpoint dialect. */
  warm: RankingLatencyMetrics;
}

export interface RankingLatencyCheck {
  id:
    'interactive_cold' | 'interactive_integrity' | 'interactive_latency' | 'loaded_cold' | 'loaded_integrity';
  passed: boolean;
  actual: number | boolean;
  target: string;
}

export interface RankingLatencyReport {
  kind: 'ranking_latency';
  schemaVersion: string;
  createdAt: string;
  development: true;
  releaseEligible: false;
  split: RankingBenchSplit;
  corpus: RankingBenchReport['corpus'];
  provider: string | null;
  model: string | null;
  reasoningEffort: ReasoningEffort | null;
  promptVersion: string | null;
  schemaVersionContract: string | null;
  candidateCount: RankingCandidateCount;
  excerptChars: RankingExcerptChars;
  thresholds: {
    interactiveP95LatencyMs: number;
  };
  interactive: RankingLatencyProfile;
  loaded: RankingLatencyProfile;
  checks: RankingLatencyCheck[];
  blockers: RankingLatencyCheck['id'][];
  passed: boolean;
}

export async function runRankingLatencyBench(
  config: AknoConfig,
  options: RankingLatencyOptions,
): Promise<RankingLatencyReport> {
  const split = options.split ?? 'development';
  const loadConcurrency = normalizeLoadConcurrency(options.loadConcurrency ?? 4);
  const common = {
    system: 'llm' as const,
    split,
    candidateCount: options.candidateCount,
    excerptChars: options.excerptChars,
    provider: options.provider,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
  };

  options.onProgress?.({ profile: 'interactive', concurrency: 1 });
  const interactiveRun = await runRankingBench(config, { ...common, concurrency: 1 });
  options.onProgress?.({ profile: 'loaded', concurrency: loadConcurrency });
  const loadedRun = await runRankingBench(config, { ...common, concurrency: loadConcurrency });
  const interactive = profile(interactiveRun);
  const loaded = profile(loadedRun);
  return refreshRankingLatencyReport({
    kind: 'ranking_latency',
    schemaVersion: RANKING_LATENCY_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    development: true,
    releaseEligible: false,
    split,
    corpus: interactiveRun.corpus,
    provider: interactiveRun.provider,
    model: interactiveRun.model,
    reasoningEffort: interactiveRun.reasoningEffort,
    promptVersion: interactiveRun.promptVersion,
    schemaVersionContract: interactiveRun.schemaVersion,
    candidateCount: options.candidateCount,
    excerptChars: options.excerptChars,
    thresholds: {
      interactiveP95LatencyMs: RANKING_INTERACTIVE_P95_TARGET_MS,
    },
    interactive,
    loaded,
    checks: [],
    blockers: [],
    passed: false,
  });
}

/** Re-derive thresholds and verdicts without rerunning provider calls. */
export function refreshRankingLatencyReport(report: RankingLatencyReport): RankingLatencyReport {
  if (report.schemaVersion !== RANKING_LATENCY_SCHEMA_VERSION) {
    throw new Error('unsupported ranking latency artifact schema');
  }
  const checks = evaluateRankingLatency(
    report.interactive,
    report.loaded,
    report.thresholds.interactiveP95LatencyMs,
  );
  const blockers = checks.filter((entry) => !entry.passed).map((entry) => entry.id);
  return {
    ...report,
    checks,
    blockers,
    passed: blockers.length === 0,
  };
}

export function evaluateRankingLatency(
  interactive: RankingLatencyProfile,
  loaded: RankingLatencyProfile,
  interactiveP95TargetMs = RANKING_INTERACTIVE_P95_TARGET_MS,
): RankingLatencyCheck[] {
  return [
    check(
      'interactive_cold',
      interactive.cold.validResponseRate === 1 && interactive.cold.endpointRequests >= 1,
      interactive.cold.validResponseRate === 1 && interactive.cold.endpointRequests >= 1,
      'successful fresh-client call with a physical endpoint receipt',
    ),
    check(
      'interactive_integrity',
      interactive.warm.validResponseRate === 1 &&
        interactive.warm.endpointRequests === interactive.warm.samples,
      interactive.warm.validResponseRate === 1 &&
        interactive.warm.endpointRequests === interactive.warm.samples,
      'all warm responses valid with one endpoint request each',
    ),
    check(
      'interactive_latency',
      interactive.warm.p95LatencyMs <= interactiveP95TargetMs,
      interactive.warm.p95LatencyMs,
      `at most ${interactiveP95TargetMs}ms warm single-flight p95`,
    ),
    check(
      'loaded_cold',
      loaded.cold.validResponseRate === 1 && loaded.cold.endpointRequests >= 1,
      loaded.cold.validResponseRate === 1 && loaded.cold.endpointRequests >= 1,
      'successful fresh-client call with a physical endpoint receipt',
    ),
    check(
      'loaded_integrity',
      loaded.warm.validResponseRate === 1 && loaded.warm.endpointRequests === loaded.warm.samples,
      loaded.warm.validResponseRate === 1 && loaded.warm.endpointRequests === loaded.warm.samples,
      'all warm responses valid with one endpoint request each',
    ),
  ];
}

function profile(report: RankingBenchReport): RankingLatencyProfile {
  // `runRankingBench` deliberately serializes the first LLM case before starting its workers. That
  // call is therefore the fresh-process compatibility receipt; every later query uses the learned
  // dialect and measures the profile named by `execution.concurrency`.
  return {
    concurrency: report.execution.concurrency,
    cold: metrics(report.queries.slice(0, 1)),
    warm: metrics(report.queries.slice(1)),
  };
}

function metrics(queries: RankingBenchReport['queries']): RankingLatencyMetrics {
  const samples = queries.length;
  const fallbackCount = queries.filter((query) => query.fallback !== null).length;
  const latencies = queries.map((query) => query.latencyMs).filter((latency) => latency > 0);
  const endpointRequests = queries.reduce((sum, query) => sum + query.endpointRequests, 0);
  return {
    samples,
    validResponseRate: samples === 0 ? 0 : (samples - fallbackCount) / samples,
    fallbackCount,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    maxLatencyMs: latencies.length === 0 ? 0 : Math.max(...latencies),
    endpointRequests,
    extraEndpointRequests: Math.max(0, endpointRequests - samples),
    tokenUsage: aggregateTokenUsage(queries),
  };
}

function aggregateTokenUsage(queries: RankingBenchReport['queries']): RankingTokenUsage | null {
  const usages = queries.flatMap((query) => (query.usage ? [query.usage] : []));
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
  return values.every((value) => value === null || value === undefined)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function check(
  id: RankingLatencyCheck['id'],
  passed: boolean,
  actual: RankingLatencyCheck['actual'],
  target: string,
): RankingLatencyCheck {
  return { id, passed, actual, target };
}

function normalizeLoadConcurrency(value: number): number {
  return Number.isFinite(value) ? Math.max(2, Math.min(16, Math.floor(value))) : 4;
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[index]!;
}
