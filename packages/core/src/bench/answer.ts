import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { AnswerOutput, DegradedReason } from '@tenphi/akno-protocol';
import type { ConfigDoc, AknoConfig, ReasoningEffort } from '../config/schema.ts';
import { open, type Akno } from '../open.ts';
import { sha256 } from '../store/ids.ts';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../ops/answer.ts';
import { runMixedRetrievalBench } from './mixed-retrieval.ts';
import {
  ANSWER_BENCH_CORPUS,
  ANSWER_BENCH_HELD_OUT_CORPUS,
  ANSWER_BENCH_HELD_OUT_FINGERPRINT,
  ANSWER_BENCH_ROOT,
  answerBenchCorpus,
  type AnswerBenchCase,
  type AnswerBenchCategory,
  type AnswerBenchCorpus,
  type AnswerBenchSplit,
} from './answer-corpus.ts';

export const ANSWER_BENCH_SCHEMA_VERSION = 'answer-benchmark-v3';
const REQUIRED_STABILITY_RUNS = 5;
const MAX_P95_LATENCY_MS = 10_000;

export interface AnswerBenchOptions {
  split?: AnswerBenchSplit;
  runs?: number;
  concurrency?: number;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  provider?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  onProgress?: (progress: { run: number; runs: number; done: number; total: number }) => void;
}

export interface AnswerBenchCaseReport {
  id: string;
  category: AnswerBenchCategory;
  executed: boolean;
  status: AnswerOutput['status'] | null;
  outcome: AnswerOutput['outcome'] | null;
  degraded: DegradedReason[];
  outcomeCorrect: boolean;
  answerPresenceCorrect: boolean;
  requiredFacts: number;
  supportedFacts: number;
  forbiddenTextDetected: boolean;
  citedSources: string[];
  requiredCitations: number;
  supportedCitations: number;
  citationPrecisionCorrect: boolean;
  citationRecallCorrect: boolean;
  relatedSources: string[];
  retrievalRecallCorrect: boolean;
  latencyMs: number;
  evidenceTokens: number;
  answerTokens: number;
  modelCalls: number;
  usageReportedCalls: number;
  providerInputTokens: number;
  providerOutputTokens: number;
  providerTotalTokens: number;
  passed: boolean;
  error: string | null;
}

export interface AnswerBenchReport {
  kind: 'invented_answer_benchmark';
  schemaVersion: string;
  createdAt: string;
  development: boolean;
  artifactPersisted: boolean;
  releaseEligible: boolean;
  passed: boolean;
  split: AnswerBenchSplit;
  corpus: {
    version: string;
    fingerprint: string;
    cases: number;
    sources: number;
    categories: number;
    frozen: boolean;
    independentlyReviewed: boolean;
  };
  thresholds: {
    executionRate: number;
    outcomeAccuracy: number;
    expectedFactAccuracy: number;
    citationPrecision: number;
    citationRecall: number;
    retrievalRecall: number;
    abstentionAccuracy: number;
    privacyLeakRate: number;
    degradedRate: number;
    verificationFailureRate: number;
    stableCaseRate: number;
    minimumRunPassRate: number;
    p95LatencyMs: number;
  };
  embedding: {
    provider: string | null;
    model: string | null;
    available: boolean;
    totalChunks: number;
    embeddedChunks: number;
  };
  answerModel: {
    provider: string | null;
    model: string | null;
    reasoningEffort: ReasoningEffort | null;
    available: boolean;
    generationPromptVersion: string;
    verifierPromptVersion: string;
  };
  execution: {
    concurrency: number;
    operations: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    maxLatencyMs: number;
    evidenceTokens: number;
    answerTokens: number;
    modelCalls: number;
    usageReportedCalls: number;
    providerInputTokens: number;
    providerOutputTokens: number;
    providerTotalTokens: number;
  };
  metrics: {
    executionRate: number;
    outcomeAccuracy: number;
    expectedFactAccuracy: number;
    citationPrecision: number;
    citationRecall: number;
    retrievalRecall: number;
    abstentionAccuracy: number;
    privacyLeakRate: number;
    degradedRate: number;
    verificationFailureRate: number;
    mixedRetrievalPassed: boolean;
  };
  stability: {
    requestedRuns: number;
    completedRuns: number;
    stableCaseRate: number | null;
    minimumRunPassRate: number;
    flakyCaseIds: string[];
  };
  runs: AnswerBenchRunSummary[];
  cases: AnswerBenchCaseReport[];
  blockers: string[];
  releaseBlockers: string[];
}

export interface AnswerBenchRunSummary {
  run: number;
  passed: boolean;
  casesPassed: number;
  casesTotal: number;
  p95LatencyMs: number;
  modelCalls: number;
  providerTotalTokens: number;
}

interface CorpusIdentities {
  sourceByLocator: Map<string, string>;
}

/**
 * Runs the production answer path against only the tracked invented corpus. The temporary
 * knowledge base and derived index are removed before returning, and the report contains no
 * questions, evidence, generated prose, paths, slugs, or provider errors.
 */
export async function runAnswerBench(
  config: AknoConfig,
  options: AnswerBenchOptions = {},
): Promise<AnswerBenchReport> {
  validateAnswerCorpora();
  const split = options.split ?? 'development';
  const corpus = answerBenchCorpus(split);
  const requestedRuns = normalizeRuns(options.runs ?? (split === 'test' ? REQUIRED_STABILITY_RUNS : 1));
  const concurrency = normalizeConcurrency(options.concurrency ?? 2);
  const embeddingProvider = options.embeddingProvider ?? config.models.embedding.provider?.name ?? 'openai';
  const embeddingModel = options.embeddingModel ?? config.models.embedding.id;
  const embeddingDimensions = normalizeDimensions(
    options.embeddingDimensions ?? config.models.embedding.dimensions ?? 1_536,
  );
  const answerProvider =
    options.provider ??
    config.models.answer.provider?.name ??
    config.models.derive.provider?.name ??
    'openai';
  const answerModel = options.model ?? config.models.answer.id ?? config.models.derive.id;
  const reasoningEffort =
    options.reasoningEffort ?? config.models.answer.reasoningEffort ?? config.models.derive.reasoningEffort;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-answer-bench-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-answer-bench-state-'));
  const identities = writeCorpus(root, corpus);
  const env = benchmarkEnvironment(config);
  let memory: Akno | null = null;

  try {
    memory = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      env,
      overrides: benchmarkOverrides(config, {
        embeddingProvider,
        embeddingModel,
        embeddingDimensions,
        answerProvider,
        answerModel,
        reasoningEffort,
      }),
    });
    await memory.index({});
    const health = await memory.doctor({ probeModels: false });
    const embedding = {
      provider: memory.config.models.embedding.provider?.name ?? null,
      model: memory.config.models.embedding.id,
      available:
        roleAvailable(memory.config.models.embedding) &&
        health.counts.chunks > 0 &&
        health.counts.chunksEmbedded === health.counts.chunks,
      totalChunks: health.counts.chunks,
      embeddedChunks: health.counts.chunksEmbedded,
    };
    const answerReceipt = {
      provider: memory.config.models.answer.provider?.name ?? null,
      model: memory.config.models.answer.id,
      reasoningEffort: memory.config.models.answer.reasoningEffort ?? null,
      available: roleAvailable(memory.config.models.answer),
      generationPromptVersion: ANSWER_PROMPT_VERSION,
      verifierPromptVersion: ANSWER_VERIFIER_PROMPT_VERSION,
    };
    const prerequisite = !embedding.available
      ? 'embedding_unavailable'
      : !answerReceipt.available
        ? 'answer_model_unavailable'
        : null;
    const caseRuns: AnswerBenchCaseReport[][] = [];
    for (let run = 1; run <= requestedRuns; run++) {
      if (prerequisite) {
        caseRuns.push(corpus.cases.map((benchCase) => skippedCase(benchCase, prerequisite)));
        options.onProgress?.({
          run,
          runs: requestedRuns,
          done: corpus.cases.length,
          total: corpus.cases.length,
        });
      } else {
        caseRuns.push(
          await runCases(
            memory,
            identities,
            corpus.cases,
            concurrency,
            run,
            requestedRuns,
            options.onProgress,
          ),
        );
      }
    }
    const mixedRetrieval = await runMixedRetrievalBench({ iterations: 3 });
    return buildReport({
      corpus,
      requestedRuns,
      concurrency,
      embedding,
      answerModel: answerReceipt,
      caseRuns,
      mixedRetrievalPassed: mixedRetrieval.passed,
    });
  } finally {
    if (memory) await memory.close().catch(() => undefined);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
}

function buildReport(options: {
  corpus: AnswerBenchCorpus;
  requestedRuns: number;
  concurrency: number;
  embedding: AnswerBenchReport['embedding'];
  answerModel: AnswerBenchReport['answerModel'];
  caseRuns: AnswerBenchCaseReport[][];
  mixedRetrievalPassed: boolean;
}): AnswerBenchReport {
  const cases = options.caseRuns.flat();
  const representativeCases = options.caseRuns[0] ?? [];
  const expectations = new Map<string, AnswerBenchCase['expectation']>(
    options.corpus.cases.map((benchCase) => [benchCase.id, benchCase.expectation]),
  );
  const requiredFacts = sum(cases.map((benchCase) => benchCase.requiredFacts));
  const cited = cases.flatMap((benchCase) => benchCase.citedSources);
  const requiredCitations = sum(cases.map((benchCase) => benchCase.requiredCitations));
  const requiredRelated = options.caseRuns.flatMap(() =>
    options.corpus.cases.flatMap((benchCase) => benchCase.expectation.requiredRelated),
  );
  const abstentions = cases.filter((benchCase) =>
    ['unsupported', 'ambiguous', 'empty'].includes(benchCase.category),
  );
  const latencies = cases.filter((benchCase) => benchCase.executed).map((benchCase) => benchCase.latencyMs);
  const stability = stabilityFor(options.caseRuns, options.corpus.cases, options.requestedRuns);
  const thresholds = answerThresholds();
  const metrics = {
    executionRate: ratio(cases.filter((benchCase) => benchCase.executed).length, cases.length),
    outcomeAccuracy: ratio(cases.filter((benchCase) => benchCase.outcomeCorrect).length, cases.length),
    expectedFactAccuracy: ratio(sum(cases.map((benchCase) => benchCase.supportedFacts)), requiredFacts),
    citationPrecision: ratio(
      cases.reduce(
        (total, benchCase) =>
          total +
          benchCase.citedSources.filter((source) =>
            expectations.get(benchCase.id)!.allowedCitations.includes(source),
          ).length,
        0,
      ),
      cited.length,
    ),
    citationRecall: ratio(sum(cases.map((benchCase) => benchCase.supportedCitations)), requiredCitations),
    retrievalRecall: ratio(
      cases.reduce(
        (total, benchCase) =>
          total +
          expectations
            .get(benchCase.id)!
            .requiredRelated.filter((source) => benchCase.relatedSources.includes(source)).length,
        0,
      ),
      requiredRelated.length,
    ),
    abstentionAccuracy: ratio(
      abstentions.filter(
        (benchCase) =>
          benchCase.outcomeCorrect && benchCase.answerPresenceCorrect && benchCase.citedSources.length === 0,
      ).length,
      abstentions.length,
    ),
    privacyLeakRate: ratio(cases.filter((benchCase) => benchCase.forbiddenTextDetected).length, cases.length),
    degradedRate: ratio(cases.filter((benchCase) => benchCase.degraded.length > 0).length, cases.length),
    verificationFailureRate: ratio(
      cases.filter((benchCase) => benchCase.degraded.includes('answer_verification_failed')).length,
      cases.length,
    ),
    mixedRetrievalPassed: options.mixedRetrievalPassed,
  };
  const blockers: string[] = [];
  if (!options.embedding.available) blockers.push('embedding_available');
  if (!options.answerModel.available) blockers.push('answer_model_available');
  if (metrics.executionRate < thresholds.executionRate) blockers.push('execution_rate');
  if (metrics.outcomeAccuracy < thresholds.outcomeAccuracy) blockers.push('outcome_accuracy');
  if (metrics.expectedFactAccuracy < thresholds.expectedFactAccuracy) blockers.push('expected_fact_accuracy');
  if (metrics.citationPrecision < thresholds.citationPrecision) blockers.push('citation_precision');
  if (metrics.citationRecall < thresholds.citationRecall) blockers.push('citation_recall');
  if (metrics.retrievalRecall < thresholds.retrievalRecall) blockers.push('retrieval_recall');
  if (metrics.abstentionAccuracy < thresholds.abstentionAccuracy) blockers.push('abstention_accuracy');
  if (metrics.privacyLeakRate > thresholds.privacyLeakRate) blockers.push('privacy_leak_rate');
  if (metrics.degradedRate > thresholds.degradedRate) blockers.push('degraded_rate');
  if (metrics.verificationFailureRate > thresholds.verificationFailureRate)
    blockers.push('verification_failure_rate');
  if (!metrics.mixedRetrievalPassed) blockers.push('mixed_retrieval_regression');
  if (stability.stableCaseRate !== null && stability.stableCaseRate < thresholds.stableCaseRate)
    blockers.push('case_stability');
  if (stability.minimumRunPassRate < thresholds.minimumRunPassRate) blockers.push('minimum_run_pass_rate');
  const p95LatencyMs = percentile(latencies, 0.95);
  if (p95LatencyMs > thresholds.p95LatencyMs) blockers.push('p95_latency');

  return refreshAnswerRelease({
    kind: 'invented_answer_benchmark',
    schemaVersion: ANSWER_BENCH_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    development: options.corpus.split === 'development',
    artifactPersisted: false,
    releaseEligible: false,
    passed: blockers.length === 0,
    split: options.corpus.split,
    corpus: {
      version: options.corpus.version,
      fingerprint: corpusFingerprint(options.corpus),
      cases: options.corpus.cases.length,
      sources: options.corpus.sources.length,
      categories: new Set(options.corpus.cases.map((benchCase) => benchCase.category)).size,
      frozen: options.corpus.frozen,
      independentlyReviewed: options.corpus.independentlyReviewed,
    },
    thresholds,
    embedding: options.embedding,
    answerModel: options.answerModel,
    execution: {
      concurrency: options.concurrency,
      operations: cases.filter((benchCase) => benchCase.executed).length,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs,
      maxLatencyMs: latencies.length === 0 ? 0 : Math.max(...latencies),
      evidenceTokens: sum(cases.map((benchCase) => benchCase.evidenceTokens)),
      answerTokens: sum(cases.map((benchCase) => benchCase.answerTokens)),
      modelCalls: sum(cases.map((benchCase) => benchCase.modelCalls)),
      usageReportedCalls: sum(cases.map((benchCase) => benchCase.usageReportedCalls)),
      providerInputTokens: sum(cases.map((benchCase) => benchCase.providerInputTokens)),
      providerOutputTokens: sum(cases.map((benchCase) => benchCase.providerOutputTokens)),
      providerTotalTokens: sum(cases.map((benchCase) => benchCase.providerTotalTokens)),
    },
    metrics,
    stability,
    runs: options.caseRuns.map((casesInRun, index) => summarizeRun(index + 1, casesInRun)),
    cases: representativeCases,
    blockers,
    releaseBlockers: [],
  });
}

/** Marks the exact report that is about to be stored; an output flag cannot be inferred after the fact. */
export function markAnswerBenchPersisted(report: AnswerBenchReport): AnswerBenchReport {
  return refreshAnswerRelease({ ...report, artifactPersisted: true });
}

function refreshAnswerRelease(report: AnswerBenchReport): AnswerBenchReport {
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

function answerThresholds(): AnswerBenchReport['thresholds'] {
  return {
    executionRate: 1,
    outcomeAccuracy: 1,
    expectedFactAccuracy: 1,
    citationPrecision: 1,
    citationRecall: 1,
    retrievalRecall: 1,
    abstentionAccuracy: 1,
    privacyLeakRate: 0,
    degradedRate: 0,
    verificationFailureRate: 0,
    stableCaseRate: 1,
    minimumRunPassRate: 1,
    p95LatencyMs: MAX_P95_LATENCY_MS,
  };
}

function stabilityFor(
  caseRuns: AnswerBenchCaseReport[][],
  corpusCases: AnswerBenchCase[],
  requestedRuns: number,
): AnswerBenchReport['stability'] {
  const completedRuns = caseRuns.filter((cases) => cases.every((benchCase) => benchCase.executed)).length;
  const passRates = caseRuns.map((cases) =>
    ratio(cases.filter((benchCase) => benchCase.passed).length, cases.length),
  );
  if (caseRuns.length < 2) {
    return {
      requestedRuns,
      completedRuns,
      stableCaseRate: null,
      minimumRunPassRate: passRates.length > 0 ? Math.min(...passRates) : 0,
      flakyCaseIds: [],
    };
  }
  const flakyCaseIds = corpusCases.flatMap((benchCase) => {
    const reports = caseRuns.map((run) => run.find((entry) => entry.id === benchCase.id));
    if (reports.some((report) => report === undefined)) return [benchCase.id];
    const fingerprints = new Set(reports.map((report) => decisionFingerprint(report!)));
    return fingerprints.size === 1 ? [] : [benchCase.id];
  });
  return {
    requestedRuns,
    completedRuns,
    stableCaseRate: ratio(corpusCases.length - flakyCaseIds.length, corpusCases.length),
    minimumRunPassRate: passRates.length > 0 ? Math.min(...passRates) : 0,
    flakyCaseIds,
  };
}

function decisionFingerprint(report: AnswerBenchCaseReport): string {
  return JSON.stringify({
    executed: report.executed,
    status: report.status,
    outcome: report.outcome,
    degraded: [...report.degraded].sort(),
    answerPresent: report.answerPresenceCorrect,
    supportedFacts: report.supportedFacts,
    forbiddenTextDetected: report.forbiddenTextDetected,
    citedSources: [...report.citedSources].sort(),
    relatedSources: [...report.relatedSources].sort(),
    passed: report.passed,
    error: report.error,
  });
}

function summarizeRun(run: number, cases: AnswerBenchCaseReport[]): AnswerBenchRunSummary {
  const latencies = cases.filter((benchCase) => benchCase.executed).map((benchCase) => benchCase.latencyMs);
  const casesPassed = cases.filter((benchCase) => benchCase.passed).length;
  return {
    run,
    passed: casesPassed === cases.length,
    casesPassed,
    casesTotal: cases.length,
    p95LatencyMs: percentile(latencies, 0.95),
    modelCalls: sum(cases.map((benchCase) => benchCase.modelCalls)),
    providerTotalTokens: sum(cases.map((benchCase) => benchCase.providerTotalTokens)),
  };
}

async function runCases(
  memory: Akno,
  identities: CorpusIdentities,
  cases: AnswerBenchCase[],
  concurrency: number,
  run: number,
  runs: number,
  onProgress?: AnswerBenchOptions['onProgress'],
): Promise<AnswerBenchCaseReport[]> {
  if (cases.length === 0) return [];
  const first = await runCase(memory, identities, cases[0]!);
  onProgress?.({ run, runs, done: 1, total: cases.length });
  const rest = await mapConcurrent(
    cases.slice(1),
    concurrency,
    async (benchCase) => {
      const result = await runCase(memory, identities, benchCase);
      return result;
    },
    (done) => onProgress?.({ run, runs, done: done + 1, total: cases.length }),
  );
  return [first, ...rest];
}

async function runCase(
  memory: Akno,
  identities: CorpusIdentities,
  benchCase: AnswerBenchCase,
): Promise<AnswerBenchCaseReport> {
  const started = performance.now();
  try {
    const output = await memory.answer({
      question: benchCase.question,
      limit: 8,
      retrieval_budget: 2_400,
      expand: false,
      graph: benchCase.graph ?? false,
      rerank: false,
      ...(benchCase.filter ? { filter: benchCase.filter } : {}),
    });
    return gradeCase(benchCase, output, identities, performance.now() - started);
  } catch {
    return skippedCase(benchCase, 'operation_failed', performance.now() - started);
  }
}

function gradeCase(
  benchCase: AnswerBenchCase,
  output: AnswerOutput,
  identities: CorpusIdentities,
  latencyMs: number,
): AnswerBenchCaseReport {
  const answer = normalize(output.answer ?? '');
  const optionalAbstention = benchCase.expectation.answer === 'optional' && output.answer === null;
  const requiredFacts = optionalAbstention ? 0 : benchCase.expectation.requiredFacts.length;
  const requiredCitations = optionalAbstention ? [] : benchCase.expectation.requiredCitations;
  const supportedFacts = benchCase.expectation.requiredFacts.filter((alternatives) =>
    alternatives.some((alternative) => answer.includes(normalize(alternative))),
  ).length;
  const forbiddenTextDetected = benchCase.expectation.forbiddenText.some((value) =>
    answer.includes(normalize(value)),
  );
  const citedSources = dedupe(
    output.citations.flatMap((citation) => {
      const locator = citation.type === 'page' ? citation.slug : citation.document_id;
      return identities.sourceByLocator.get(locator) ?? [];
    }),
  );
  const relatedSources = dedupe([
    ...output.related_page_slugs.flatMap((locator) => identities.sourceByLocator.get(locator) ?? []),
    ...output.related_documents.flatMap((document) => identities.sourceByLocator.get(document.id) ?? []),
  ]);
  const outcomeCorrect = benchCase.expectation.outcomes.includes(output.outcome);
  const answerPresenceCorrect =
    benchCase.expectation.answer === 'optional' ||
    (benchCase.expectation.answer === 'required' ? output.answer !== null : output.answer === null);
  const citationPrecisionCorrect = citedSources.every((source) =>
    benchCase.expectation.allowedCitations.includes(source),
  );
  const citationRecallCorrect = requiredCitations.every((source) => citedSources.includes(source));
  const supportedCitations = requiredCitations.filter((source) => citedSources.includes(source)).length;
  const retrievalRecallCorrect = benchCase.expectation.requiredRelated.every((source) =>
    relatedSources.includes(source),
  );
  const passed =
    output.status !== 'degraded' &&
    output.status !== 'unavailable' &&
    outcomeCorrect &&
    answerPresenceCorrect &&
    supportedFacts === requiredFacts &&
    !forbiddenTextDetected &&
    citationPrecisionCorrect &&
    citationRecallCorrect &&
    retrievalRecallCorrect;
  const receipts = [output.model_usage.generation, output.model_usage.verification].filter(
    (receipt) => receipt !== null,
  );
  return {
    id: benchCase.id,
    category: benchCase.category,
    executed: true,
    status: output.status,
    outcome: output.outcome,
    degraded: output.degraded ?? [],
    outcomeCorrect,
    answerPresenceCorrect,
    requiredFacts,
    supportedFacts,
    forbiddenTextDetected,
    citedSources,
    requiredCitations: requiredCitations.length,
    supportedCitations,
    citationPrecisionCorrect,
    citationRecallCorrect,
    relatedSources,
    retrievalRecallCorrect,
    latencyMs,
    evidenceTokens: output.budget_used.evidence_tokens,
    answerTokens: output.budget_used.answer_tokens,
    modelCalls: receipts.length,
    usageReportedCalls: receipts.filter(
      (receipt) =>
        receipt.input_tokens !== null || receipt.output_tokens !== null || receipt.total_tokens !== null,
    ).length,
    providerInputTokens: sum(receipts.map((receipt) => receipt.input_tokens ?? 0)),
    providerOutputTokens: sum(receipts.map((receipt) => receipt.output_tokens ?? 0)),
    providerTotalTokens: sum(receipts.map((receipt) => receipt.total_tokens ?? 0)),
    passed,
    error: null,
  };
}

function skippedCase(benchCase: AnswerBenchCase, error: string, latencyMs = 0): AnswerBenchCaseReport {
  return {
    id: benchCase.id,
    category: benchCase.category,
    executed: false,
    status: null,
    outcome: null,
    degraded: [],
    outcomeCorrect: false,
    answerPresenceCorrect: false,
    requiredFacts: benchCase.expectation.requiredFacts.length,
    supportedFacts: 0,
    forbiddenTextDetected: false,
    citedSources: [],
    requiredCitations: benchCase.expectation.requiredCitations.length,
    supportedCitations: 0,
    citationPrecisionCorrect: false,
    citationRecallCorrect: false,
    relatedSources: [],
    retrievalRecallCorrect: false,
    latencyMs,
    evidenceTokens: 0,
    answerTokens: 0,
    modelCalls: 0,
    usageReportedCalls: 0,
    providerInputTokens: 0,
    providerOutputTokens: 0,
    providerTotalTokens: 0,
    passed: false,
    error,
  };
}

function benchmarkOverrides(
  config: AknoConfig,
  options: {
    embeddingProvider: string;
    embeddingModel: string | null;
    embeddingDimensions: number;
    answerProvider: string;
    answerModel: string | null;
    reasoningEffort: ReasoningEffort | undefined;
  },
): ConfigDoc {
  return {
    providers: benchmarkProviders(config),
    create_reserved_paths: false,
    write_ids: false,
    ignore: ['.git', '.obsidian', '.akno', 'node_modules'],
    page_extensions: ['.md', '.markdown'],
    folders: {
      [`${ANSWER_BENCH_ROOT}/**`]: { role: 'knowledge', remember: 'deny', rank: 1 },
    },
    index: { summaries: false, facts: false, ann_threshold_chunks: 20_000 },
    recall: {
      expansion: false,
      candidates_per_arm: 40,
      rank: { knowledge: 1, source: 1, inference: 1 },
    },
    models: {
      embedding: {
        provider: options.embeddingProvider,
        id: options.embeddingModel,
        enabled: options.embeddingModel !== null,
        dimensions: options.embeddingDimensions,
        batch: config.models.embedding.batch,
        timeout_ms: config.models.embedding.timeoutMs,
      },
      reranker: { id: null, enabled: false },
      derive: { id: null, enabled: false },
      expansion: { id: null, enabled: false },
      answer: {
        provider: options.answerProvider,
        id: options.answerModel,
        enabled: options.answerModel !== null,
        max_output_tokens: 1_024,
        ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
        timeout_ms: Math.max(60_000, config.models.answer.timeoutMs),
      },
      vision: { id: null, enabled: false },
    },
  };
}

function writeCorpus(root: string, corpus: AnswerBenchCorpus): CorpusIdentities {
  const sourceByLocator = new Map<string, string>();
  for (const source of corpus.sources) {
    const relPath = `${ANSWER_BENCH_ROOT}/${source.path}`;
    const target = path.join(root, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source.content, 'utf8');
    const locator = source.path.endsWith('.md')
      ? relPath.replace(/\.md$/u, '')
      : `doc_${sha256(source.content).slice(0, 12)}`;
    sourceByLocator.set(locator, source.id);
  }
  return { sourceByLocator };
}

function validateAnswerCorpora(): void {
  validateAnswerCorpus(ANSWER_BENCH_CORPUS);
  validateAnswerCorpus(ANSWER_BENCH_HELD_OUT_CORPUS);
  assertDisjoint(
    ANSWER_BENCH_CORPUS.sources.map((source) => source.id),
    ANSWER_BENCH_HELD_OUT_CORPUS.sources.map((source) => source.id),
    'source id',
  );
  assertDisjoint(
    ANSWER_BENCH_CORPUS.sources.map((source) => source.path),
    ANSWER_BENCH_HELD_OUT_CORPUS.sources.map((source) => source.path),
    'source path',
  );
  assertDisjoint(
    ANSWER_BENCH_CORPUS.sources.map((source) => sha256(source.content)),
    ANSWER_BENCH_HELD_OUT_CORPUS.sources.map((source) => sha256(source.content)),
    'source content',
  );
  assertDisjoint(
    ANSWER_BENCH_CORPUS.cases.map((benchCase) => benchCase.id),
    ANSWER_BENCH_HELD_OUT_CORPUS.cases.map((benchCase) => benchCase.id),
    'case id',
  );
  assertDisjoint(
    ANSWER_BENCH_CORPUS.cases.map((benchCase) => normalize(benchCase.question)),
    ANSWER_BENCH_HELD_OUT_CORPUS.cases.map((benchCase) => normalize(benchCase.question)),
    'question',
  );
  const heldOutFingerprint = corpusFingerprint(ANSWER_BENCH_HELD_OUT_CORPUS);
  if (heldOutFingerprint !== ANSWER_BENCH_HELD_OUT_FINGERPRINT) {
    throw new Error(
      `frozen answer held-out corpus changed without a versioned fingerprint: ${heldOutFingerprint}`,
    );
  }
}

function corpusFingerprint(corpus: AnswerBenchCorpus): string {
  return sha256(JSON.stringify({ version: corpus.version, sources: corpus.sources, cases: corpus.cases }));
}

function validateAnswerCorpus(corpus: AnswerBenchCorpus): void {
  const sourceIds = new Set<string>();
  const paths = new Set<string>();
  for (const source of corpus.sources) {
    if (sourceIds.has(source.id)) throw new Error(`duplicate answer benchmark source id: ${source.id}`);
    if (paths.has(source.path)) throw new Error(`duplicate answer benchmark path: ${source.path}`);
    sourceIds.add(source.id);
    paths.add(source.path);
  }
  const caseIds = new Set<string>();
  for (const benchCase of corpus.cases) {
    if (caseIds.has(benchCase.id)) throw new Error(`duplicate answer benchmark case id: ${benchCase.id}`);
    caseIds.add(benchCase.id);
    for (const source of [
      ...benchCase.expectation.requiredCitations,
      ...benchCase.expectation.allowedCitations,
      ...benchCase.expectation.requiredRelated,
    ]) {
      if (!sourceIds.has(source)) throw new Error(`unknown answer benchmark source id: ${source}`);
    }
  }
}

function assertDisjoint(left: string[], right: string[], label: string): void {
  const leftSet = new Set(left);
  const overlap = right.find((value) => leftSet.has(value));
  if (overlap) throw new Error(`answer benchmark splits share ${label}: ${overlap}`);
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
  return `AKNO_ANSWER_BENCH_PROVIDER_${index}_KEY`;
}

function roleAvailable(role: AknoConfig['models']['answer']): boolean {
  return role.enabled && role.provider !== null && role.id !== null;
}

async function mapConcurrent<T, R>(
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

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeConcurrency(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(8, Math.floor(value))) : 2;
}

function normalizeRuns(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 1;
}

function normalizeDimensions(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(65_536, Math.floor(value))) : 1_536;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
