import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { DegradedReason, RecallOutput, RecallResult } from '@tenphi/akno-protocol';
import type { ConfigDoc, AknoConfig, ReasoningEffort, ResolvedModelRole } from '../config/schema.ts';
import { open, type Akno } from '../open.ts';
import { LLM_RERANK_PROMPT_VERSION, LLM_RERANK_SCHEMA_VERSION } from '../recall/llm-rerank.ts';
import {
  RERANK_CANDIDATE_POOL_MULTIPLIER,
  RERANK_CANDIDATE_SELECTION_VERSION,
  selectRerankCandidates,
} from '../recall/search.ts';
import { RANKING_CATEGORIES, RANKING_CORPUS, rankingCorpusCases } from './ranking-corpus.ts';
import { rankingCorpusFingerprint } from './ranking-review.ts';
import type {
  RankingBenchSplit,
  RankingCandidateCount,
  RankingCategory,
  RankingExcerptChars,
} from './ranking.ts';

export const RANKING_END_TO_END_SCHEMA_VERSION = 'ranking-end-to-end-v4';

export type RankingEndToEndSystem = 'fusion' | 'llm';

export interface RankingEndToEndOptions {
  split?: RankingBenchSplit;
  system?: RankingEndToEndSystem;
  candidateCount?: RankingCandidateCount;
  excerptChars?: RankingExcerptChars;
  concurrency?: number;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  provider?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  onProgress?: (progress: RankingEndToEndProgress) => void;
}

export interface RankingEndToEndProgress {
  phase: 'index' | 'candidate_generation' | 'ranked_recall';
  done: number;
  total: number;
}

export interface RankingEndToEndCategoryReport {
  category: RankingCategory;
  queries: number;
  directAnswerRecall: number;
  mrrAt10: number;
  successAt1: number;
  successAt3: number;
}

export interface RankingEndToEndStageReport {
  directAnswerRecall: number;
  mrrAt10: number;
  successAt1: number;
  successAt3: number;
  byCategory: RankingEndToEndCategoryReport[];
  degradedQueries: number;
  unavailableQueries: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
}

export interface RankingEndToEndQueryReport {
  queryId: string;
  category: RankingCategory;
  directAnswerIds: string[];
  fusionOrder: string[];
  fusionRank: number | null;
  candidateOrder: string[];
  candidateRank: number | null;
  candidateStatus: RecallOutput['status'];
  candidateDegraded: DegradedReason[];
  candidateLatencyMs: number;
  rankedOrder: string[];
  rankedRank: number | null;
  rankedStatus: RecallOutput['status'];
  degraded: DegradedReason[];
  rerankFallback: boolean;
  rankedLatencyMs: number;
}

export interface RankingEndToEndReport {
  kind: 'ranking_end_to_end';
  schemaVersion: string;
  createdAt: string;
  development: true;
  releaseEligible: false;
  passed: boolean;
  split: RankingBenchSplit;
  corpus: {
    queries: number;
    sources: number;
    categories: number;
    version: string;
    fingerprint: string;
  };
  system: RankingEndToEndSystem;
  retrievalPoolCount: number;
  candidateSelectionVersion: string;
  candidateCount: RankingCandidateCount;
  excerptChars: RankingExcerptChars;
  concurrency: number;
  embedding: {
    provider: string | null;
    model: string | null;
    dimensions: number;
    available: boolean;
    totalChunks: number;
    embeddedChunks: number;
  };
  reranker: {
    provider: string | null;
    model: string | null;
    reasoningEffort: ReasoningEffort | null;
    promptVersion: string | null;
    schemaVersion: string | null;
    available: boolean;
  };
  fusionPool: RankingEndToEndStageReport;
  candidateGeneration: RankingEndToEndStageReport;
  rankedRecall: RankingEndToEndStageReport;
  rerankFallbackRate: number;
  queries: RankingEndToEndQueryReport[];
}

interface QueryRun {
  output: RecallOutput;
  fusionOrder: string[];
  order: string[];
  latencyMs: number;
}

const BENCHMARK_ROOT = '_akno-ranking-benchmark';

/**
 * Index and recall the invented ranking corpus through the production pipeline.
 * The temporary knowledge base is deleted after the report; only stable ids and
 * metrics leave this function.
 */
export async function runRankingEndToEnd(
  config: AknoConfig,
  options: RankingEndToEndOptions = {},
): Promise<RankingEndToEndReport> {
  const split = options.split ?? 'development';
  const system = options.system ?? 'llm';
  const candidateCount = options.candidateCount ?? 20;
  const retrievalPoolCount = candidateCount * RERANK_CANDIDATE_POOL_MULTIPLIER;
  const excerptChars = options.excerptChars ?? 800;
  const concurrency = normalizeConcurrency(options.concurrency ?? 4);
  const embeddingProvider = options.embeddingProvider ?? config.models.embedding.provider?.name ?? 'local';
  const embeddingModel = options.embeddingModel ?? config.models.embedding.id;
  const embeddingDimensions = normalizeDimensions(
    options.embeddingDimensions ?? config.models.embedding.dimensions ?? 1024,
  );
  const provider = options.provider ?? config.models.reranker.provider?.name ?? 'openai';
  const model =
    options.model ??
    (config.models.reranker.rerankerMode === 'llm' ? config.models.reranker.id : null) ??
    'gpt-5.6-luna';
  const reasoningEffort = options.reasoningEffort ?? 'none';
  const cases = rankingCorpusCases(split);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ranking-e2e-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ranking-e2e-state-'));
  const identities = writeCorpus(root);
  const env = benchmarkEnvironment(config);
  let baseline: Akno | null = null;
  let ranked: Akno | null = null;

  try {
    baseline = await open({
      aknoPath: root,
      stateDir,
      env,
      overrides: benchmarkOverrides(config, {
        embedding: {
          provider: embeddingProvider,
          model: embeddingModel,
          dimensions: embeddingDimensions,
        },
        reranker: null,
        candidateCount,
        excerptChars,
      }),
    });
    options.onProgress?.({ phase: 'index', done: 0, total: 1 });
    await baseline.index({});
    options.onProgress?.({ phase: 'index', done: 1, total: 1 });
    const embeddingRole = roleReceipt(baseline.config.models.embedding);
    const indexHealth = await baseline.doctor();
    const embedding = {
      ...embeddingRole,
      dimensions: embeddingDimensions,
      available:
        embeddingRole.available &&
        indexHealth.counts.chunks > 0 &&
        indexHealth.counts.chunksEmbedded === indexHealth.counts.chunks,
      totalChunks: indexHealth.counts.chunks,
      embeddedChunks: indexHealth.counts.chunksEmbedded,
    };

    // A ranking benchmark without vectors is a lexical benchmark wearing the selected
    // embedding model's name. Stop before issuing one doomed embedding call per query and
    // record the prerequisite failure explicitly instead of publishing misleading scores.
    if (!embedding.available) {
      const degraded: DegradedReason[] = [
        embeddingRole.available ? 'embedding_failed' : 'no_embedding_model',
        ...(indexHealth.counts.chunksEmbedded < indexHealth.counts.chunks
          ? (['partial_index'] as const)
          : []),
        ...(indexHealth.counts.chunksEmbedded === 0 && indexHealth.counts.chunks > 0
          ? (['no_vector_index'] as const)
          : []),
      ];
      const queryReports = cases.map((benchCase): RankingEndToEndQueryReport => {
        const directAnswerIds = directAnswersFor(benchCase.judgments);
        return {
          queryId: benchCase.id,
          category: benchCase.category,
          directAnswerIds,
          fusionOrder: [],
          fusionRank: null,
          candidateOrder: [],
          candidateRank: null,
          candidateStatus: 'unavailable',
          candidateDegraded: degraded,
          candidateLatencyMs: 0,
          rankedOrder: [],
          rankedRank: null,
          rankedStatus: 'unavailable',
          degraded,
          rerankFallback: false,
          rankedLatencyMs: 0,
        };
      });
      options.onProgress?.({ phase: 'candidate_generation', done: 0, total: cases.length });
      options.onProgress?.({ phase: 'ranked_recall', done: 0, total: cases.length });
      return buildReport({
        cases,
        split,
        system,
        candidateCount,
        excerptChars,
        concurrency,
        embedding,
        reranker: unavailableRerankerReceipt(system, provider, model, reasoningEffort),
        queryReports,
      });
    }

    options.onProgress?.({ phase: 'candidate_generation', done: 0, total: cases.length });
    const candidateRuns = await mapCases(
      cases,
      concurrency,
      async (benchCase) => {
        const started = performance.now();
        const output = await baseline!.recall({
          query: benchCase.query,
          mode: 'lookup',
          depth: 'summary',
          expand: false,
          limit: system === 'llm' ? retrievalPoolCount : candidateCount,
          budget: 100_000,
        });
        const selected =
          system === 'llm'
            ? selectRerankCandidates(output.results, candidateCount)
            : output.results.slice(0, candidateCount);
        return {
          output,
          fusionOrder: resultIds(output.results, identities),
          order: resultIds(selected, identities),
          latencyMs: performance.now() - started,
        };
      },
      (done) => options.onProgress?.({ phase: 'candidate_generation', done, total: cases.length }),
    );
    await baseline.close();
    baseline = null;

    let rerankerReceipt: RankingEndToEndReport['reranker'];
    let rankedRuns: QueryRun[];
    if (system === 'llm') {
      ranked = await open({
        aknoPath: root,
        stateDir,
        env,
        writable: false,
        overrides: benchmarkOverrides(config, {
          embedding: {
            provider: embeddingProvider,
            model: embeddingModel,
            dimensions: embeddingDimensions,
          },
          reranker: { provider, model, reasoningEffort },
          candidateCount,
          excerptChars,
        }),
      });
      rerankerReceipt = {
        ...roleReceipt(ranked.config.models.reranker),
        reasoningEffort,
        promptVersion: LLM_RERANK_PROMPT_VERSION,
        schemaVersion: LLM_RERANK_SCHEMA_VERSION,
      };
      options.onProgress?.({ phase: 'ranked_recall', done: 0, total: cases.length });
      rankedRuns = await mapModelCases(
        cases,
        concurrency,
        async (benchCase) => {
          const started = performance.now();
          const output = await ranked!.recall({
            query: benchCase.query,
            mode: 'lookup',
            depth: 'summary',
            expand: false,
            limit: candidateCount,
            budget: 100_000,
          });
          return {
            output,
            fusionOrder: [],
            order: resultIds(output.results, identities),
            latencyMs: performance.now() - started,
          };
        },
        (done) => options.onProgress?.({ phase: 'ranked_recall', done, total: cases.length }),
      );
    } else {
      rerankerReceipt = {
        provider: null,
        model: null,
        reasoningEffort: null,
        promptVersion: null,
        schemaVersion: null,
        available: false,
      };
      rankedRuns = candidateRuns;
      options.onProgress?.({ phase: 'ranked_recall', done: cases.length, total: cases.length });
    }

    const queryReports = cases.map((benchCase, index): RankingEndToEndQueryReport => {
      const directAnswerIds = directAnswersFor(benchCase.judgments);
      const candidate = candidateRuns[index]!;
      const final = rankedRuns[index]!;
      return {
        queryId: benchCase.id,
        category: benchCase.category,
        directAnswerIds,
        fusionOrder: candidate.fusionOrder,
        fusionRank: bestRankOf(candidate.fusionOrder, directAnswerIds),
        candidateOrder: candidate.order,
        candidateRank: bestRankOf(candidate.order, directAnswerIds),
        candidateStatus: candidate.output.status,
        candidateDegraded: candidate.output.degraded ?? [],
        candidateLatencyMs: candidate.latencyMs,
        rankedOrder: final.order,
        rankedRank: bestRankOf(final.order, directAnswerIds),
        rankedStatus: final.output.status,
        degraded: final.output.degraded ?? [],
        rerankFallback: final.output.degraded?.includes('rerank_failed') ?? false,
        rankedLatencyMs: final.latencyMs,
      };
    });
    return buildReport({
      cases,
      split,
      system,
      candidateCount,
      excerptChars,
      concurrency,
      embedding,
      reranker: rerankerReceipt,
      queryReports,
    });
  } finally {
    if (baseline) await baseline.close().catch(() => undefined);
    if (ranked) await ranked.close().catch(() => undefined);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
}

function buildReport(options: {
  cases: ReturnType<typeof rankingCorpusCases>;
  split: RankingBenchSplit;
  system: RankingEndToEndSystem;
  candidateCount: RankingCandidateCount;
  excerptChars: RankingExcerptChars;
  concurrency: number;
  embedding: RankingEndToEndReport['embedding'];
  reranker: RankingEndToEndReport['reranker'];
  queryReports: RankingEndToEndQueryReport[];
}): RankingEndToEndReport {
  const fusionPool = aggregateStage(options.queryReports, 'fusion');
  const candidateGeneration = aggregateStage(options.queryReports, 'candidate');
  const rankedRecall = aggregateStage(options.queryReports, 'ranked');
  const rerankFallbackRate = ratio(
    options.queryReports.filter((query) => query.rerankFallback).length,
    options.cases.length,
  );
  const modelReady = options.system === 'fusion' || options.reranker.available;
  return {
    kind: 'ranking_end_to_end',
    schemaVersion: RANKING_END_TO_END_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    development: true,
    releaseEligible: false,
    passed:
      options.embedding.available &&
      modelReady &&
      candidateGeneration.directAnswerRecall === 1 &&
      rankedRecall.directAnswerRecall === 1 &&
      candidateGeneration.degradedQueries === 0 &&
      rankedRecall.degradedQueries === 0 &&
      rerankFallbackRate === 0,
    split: options.split,
    corpus: {
      queries: options.cases.length,
      sources: Object.keys(RANKING_CORPUS.candidates).length,
      categories: new Set(options.cases.map((benchCase) => benchCase.category)).size,
      version: RANKING_CORPUS.version,
      fingerprint: rankingCorpusFingerprint(),
    },
    system: options.system,
    retrievalPoolCount:
      options.system === 'llm'
        ? options.candidateCount * RERANK_CANDIDATE_POOL_MULTIPLIER
        : options.candidateCount,
    candidateSelectionVersion: RERANK_CANDIDATE_SELECTION_VERSION,
    candidateCount: options.candidateCount,
    excerptChars: options.excerptChars,
    concurrency: options.concurrency,
    embedding: options.embedding,
    reranker: options.reranker,
    fusionPool,
    candidateGeneration,
    rankedRecall,
    rerankFallbackRate,
    queries: options.queryReports,
  };
}

function unavailableRerankerReceipt(
  system: RankingEndToEndSystem,
  provider: string,
  model: string,
  reasoningEffort: ReasoningEffort,
): RankingEndToEndReport['reranker'] {
  if (system === 'fusion') {
    return {
      provider: null,
      model: null,
      reasoningEffort: null,
      promptVersion: null,
      schemaVersion: null,
      available: false,
    };
  }
  return {
    provider,
    model,
    reasoningEffort,
    promptVersion: LLM_RERANK_PROMPT_VERSION,
    schemaVersion: LLM_RERANK_SCHEMA_VERSION,
    available: false,
  };
}

function benchmarkOverrides(
  config: AknoConfig,
  options: {
    embedding: { provider: string; model: string | null; dimensions: number };
    reranker: { provider: string; model: string; reasoningEffort: ReasoningEffort } | null;
    candidateCount: RankingCandidateCount;
    excerptChars: RankingExcerptChars;
  },
): ConfigDoc {
  return {
    providers: benchmarkProviders(config),
    create_reserved_paths: false,
    write_ids: false,
    ignore: ['.git', '.obsidian', '.akno', 'node_modules'],
    page_extensions: ['.md', '.markdown'],
    folders: {
      [`${BENCHMARK_ROOT}/**`]: { role: 'knowledge', remember: 'deny', rank: 1 },
    },
    index: { summaries: false, facts: false, ann_threshold_chunks: 20_000 },
    recall: {
      expansion: false,
      candidates_per_arm: Math.max(60, options.candidateCount),
      rank: { knowledge: 1, source: 1, inference: 1 },
    },
    models: {
      embedding: {
        provider: options.embedding.provider,
        id: options.embedding.model,
        enabled: options.embedding.model !== null,
        dimensions: options.embedding.dimensions,
        batch: config.models.embedding.batch,
        timeout_ms: config.models.embedding.timeoutMs,
      },
      reranker: options.reranker
        ? {
            provider: options.reranker.provider,
            id: options.reranker.model,
            enabled: true,
            mode: 'llm',
            exclude_irrelevant: true,
            top_k: options.candidateCount,
            max_chars: options.excerptChars,
            max_output_tokens: Math.max(256, Math.min(2048, options.candidateCount * 32 + 128)),
            reasoning_effort: options.reranker.reasoningEffort,
            timeout_ms: Math.max(60_000, config.models.reranker.timeoutMs),
          }
        : { id: null, enabled: false },
      derive: { id: null, enabled: false },
      expansion: { id: null, enabled: false },
      vision: { id: null, enabled: false },
    },
  };
}

function benchmarkProviders(config: AknoConfig): NonNullable<ConfigDoc['providers']> {
  return Object.fromEntries(
    sortedProviders(config).map(([name, provider], index) => [
      name,
      {
        base_url: provider.baseUrl,
        api_key: provider.apiKey ? { env: benchmarkProviderSecret(index) } : null,
        headers: provider.headers,
        max_retries: provider.maxRetries,
      },
    ]),
  );
}

function benchmarkEnvironment(config: AknoConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  sortedProviders(config).forEach(([, provider], index) => {
    if (provider.apiKey) env[benchmarkProviderSecret(index)] = provider.apiKey;
  });
  return env;
}

function sortedProviders(config: AknoConfig): [string, AknoConfig['providers'][string]][] {
  return Object.entries(config.providers).sort(([left], [right]) => left.localeCompare(right));
}

function benchmarkProviderSecret(index: number): string {
  return `AKNO_RANKING_BENCH_PROVIDER_${index}_KEY`;
}

function writeCorpus(root: string): Map<string, string> {
  const identities = new Map<string, string>();
  for (const candidate of Object.values(RANKING_CORPUS.candidates)) {
    const relPath =
      candidate.sourceKind === 'page'
        ? `${BENCHMARK_ROOT}/pages/${candidate.id}.md`
        : `${BENCHMARK_ROOT}/documents/${candidate.id}.txt`;
    const target = path.join(root, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      candidate.sourceKind === 'page' ? `# Invented evidence\n\n${candidate.text}\n` : `${candidate.text}\n`,
      'utf8',
    );
    identities.set(candidate.sourceKind === 'page' ? relPath.replace(/\.md$/i, '') : relPath, candidate.id);
  }
  return identities;
}

function resultIds(results: RecallResult[], identities: Map<string, string>): string[] {
  return results.flatMap((candidate) => {
    const identity = candidate.type === 'page' ? candidate.slug : candidate.path;
    const id = identities.get(identity);
    return id ? [id] : [];
  });
}

async function mapModelCases<T, R>(
  values: T[],
  concurrency: number,
  run: (value: T) => Promise<R>,
  progress: (done: number) => void,
): Promise<R[]> {
  if (values.length === 0) return [];
  const first = await run(values[0]!);
  progress(1);
  const rest = await mapCases(values.slice(1), concurrency, run, (done) => progress(done + 1));
  return [first, ...rest];
}

async function mapCases<T, R>(
  values: T[],
  concurrency: number,
  run: (value: T) => Promise<R>,
  progress: (done: number) => void,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await run(values[index]!);
      progress(++done);
    }
  });
  await Promise.all(workers);
  return results;
}

function aggregateStage(
  queries: RankingEndToEndQueryReport[],
  stage: 'fusion' | 'candidate' | 'ranked',
): RankingEndToEndStageReport {
  const rank = (query: RankingEndToEndQueryReport): number | null =>
    stage === 'fusion' ? query.fusionRank : stage === 'candidate' ? query.candidateRank : query.rankedRank;
  const metrics = metricsFor(queries.map(rank));
  const latencies = queries.map((query) =>
    stage === 'ranked' ? query.rankedLatencyMs : query.candidateLatencyMs,
  );
  return {
    ...metrics,
    byCategory: RANKING_CATEGORIES.flatMap((category) => {
      const selected = queries.filter((query) => query.category === category);
      if (selected.length === 0) return [];
      return [{ category, queries: selected.length, ...metricsFor(selected.map(rank)) }];
    }),
    degradedQueries: queries.filter((query) =>
      stage === 'ranked' ? query.degraded.length > 0 : query.candidateDegraded.length > 0,
    ).length,
    unavailableQueries: queries.filter((query) =>
      stage === 'ranked' ? query.rankedStatus === 'unavailable' : query.candidateStatus === 'unavailable',
    ).length,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    maxLatencyMs: latencies.length === 0 ? 0 : Math.max(...latencies),
  };
}

function metricsFor(
  ranks: (number | null)[],
): Omit<
  RankingEndToEndStageReport,
  'byCategory' | 'degradedQueries' | 'unavailableQueries' | 'p50LatencyMs' | 'p95LatencyMs' | 'maxLatencyMs'
> {
  return {
    directAnswerRecall: ratio(ranks.filter((rank) => rank !== null).length, ranks.length),
    mrrAt10: mean(ranks.map((rank) => (rank !== null && rank <= 10 ? 1 / rank : 0))),
    successAt1: ratio(ranks.filter((rank) => rank === 1).length, ranks.length),
    successAt3: ratio(ranks.filter((rank) => rank !== null && rank <= 3).length, ranks.length),
  };
}

function directAnswersFor(judgments: Record<string, number>): string[] {
  const direct = Object.entries(judgments)
    .flatMap(([id, grade]) => (grade === 3 ? [id] : []))
    .sort();
  if (direct.length === 0) throw new Error('ranking case has no direct answer');
  return direct;
}

function bestRankOf(order: string[], ids: string[]): number | null {
  const ranks = ids.flatMap((id) => {
    const index = order.indexOf(id);
    return index < 0 ? [] : [index + 1];
  });
  return ranks.length === 0 ? null : Math.min(...ranks);
}

function roleReceipt(role: ResolvedModelRole): {
  provider: string | null;
  model: string | null;
  available: boolean;
} {
  return { provider: role.provider?.name ?? null, model: role.id, available: role.enabled };
}

function normalizeConcurrency(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(16, Math.floor(value))) : 4;
}

function normalizeDimensions(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(65_536, Math.floor(value))) : 1024;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? 0;
}
