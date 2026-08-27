import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { ContextOutput, DegradedReason, RecallResult } from '@tenphi/akno-protocol';
import type { ConfigDoc, AknoConfig, ReasoningEffort } from '../config/schema.ts';
import {
  AUTO_RECALL_NATIVE_QUALIFICATION_THRESHOLD,
  AUTO_RECALL_POLICY_VERSION,
  AUTO_RECALL_SEMANTIC_THRESHOLD,
} from '../ops/context.ts';
import { open, type Akno } from '../open.ts';
import { sha256 } from '../store/ids.ts';
import {
  AUTO_RECALL_BENCH_ROOT,
  AUTO_RECALL_DEVELOPMENT_CORPUS,
  AUTO_RECALL_HELD_OUT_CORPUS,
  AUTO_RECALL_HELD_OUT_FINGERPRINT,
  autoRecallBenchCorpus,
  autoRecallCorpusFingerprint,
  type AutoRecallBenchCase,
  type AutoRecallBenchCategory,
  type AutoRecallBenchCorpus,
  type AutoRecallBenchSplit,
} from './auto-recall-corpus.ts';

export const AUTO_RECALL_BENCH_SCHEMA_VERSION = 'auto-recall-benchmark-v1';
const REQUIRED_STABILITY_RUNS = 5;
const MAX_P95_LATENCY_MS = 10_000;
const MAX_QUALIFICATION_RATE = 0.75;

export interface AutoRecallBenchOptions {
  split?: AutoRecallBenchSplit;
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

export interface AutoRecallBenchCaseReport {
  id: string;
  category: AutoRecallBenchCategory;
  executed: boolean;
  status: ContextOutput['status'] | null;
  degraded: DegradedReason[];
  expectedActivation: boolean;
  activated: boolean;
  activationCorrect: boolean;
  activationBasis: NonNullable<ContextOutput['activation']>['basis'] | null;
  qualificationExpected: AutoRecallBenchCase['expectation']['qualification'];
  qualificationRun: boolean;
  qualificationCorrect: boolean;
  selectedSources: string[];
  selectedRelevance: number[];
  selectedCount: number;
  requiredSources: number;
  recalledSources: number;
  relevantSelected: number;
  irrelevantSelected: number;
  locatorsValid: boolean;
  exactEvidenceOnly: boolean;
  ambientContextAbsent: boolean;
  conversationProtected: boolean;
  budget: number;
  budgetUsed: number;
  budgetCompliant: boolean;
  latencyMs: number;
  qualificationLatencyMs: number;
  modelCalls: number;
  usageReportedCalls: number;
  providerInputTokens: number;
  providerOutputTokens: number;
  providerTotalTokens: number;
  passed: boolean;
  error: string | null;
}

export interface AutoRecallBenchRunSummary {
  run: number;
  passed: boolean;
  casesPassed: number;
  casesTotal: number;
  qualificationRate: number;
  p95LatencyMs: number;
  modelCalls: number;
  providerTotalTokens: number;
}

export interface AutoRecallBenchReport {
  kind: 'invented_auto_recall_benchmark';
  schemaVersion: string;
  policyVersion: string;
  createdAt: string;
  development: boolean;
  artifactPersisted: boolean;
  releaseEligible: boolean;
  passed: boolean;
  split: AutoRecallBenchSplit;
  corpus: {
    version: string;
    fingerprint: string;
    cases: number;
    sources: number;
    categories: number;
    frozen: boolean;
    independentlyReviewed: boolean;
  };
  policy: {
    semanticThreshold: number;
    nativeQualificationThreshold: number;
    defaultBudget: number;
    candidateLimit: number;
    maximumResults: number;
  };
  thresholds: {
    executionRate: number;
    activationPrecision: number;
    activationRecall: number;
    activationAccuracy: number;
    sourcePrecision: number;
    sourceRecall: number;
    irrelevantInjectionRate: number;
    qualificationAccuracy: number;
    locatorAccuracy: number;
    evidenceIsolation: number;
    budgetCompliance: number;
    degradedRate: number;
    stableCaseRate: number;
    minimumRunPassRate: number;
    maximumQualificationRate: number;
    p95LatencyMs: number;
  };
  embedding: {
    provider: string | null;
    model: string | null;
    available: boolean;
    totalChunks: number;
    embeddedChunks: number;
  };
  qualifier: {
    provider: string | null;
    model: string | null;
    mode: 'endpoint' | 'llm' | null;
    reasoningEffort: ReasoningEffort | null;
    available: boolean;
  };
  execution: {
    concurrency: number;
    operations: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    maxLatencyMs: number;
    qualificationCalls: number;
    qualificationRate: number;
    qualificationLatencyMs: number;
    usageReportedCalls: number;
    providerInputTokens: number;
    providerOutputTokens: number;
    providerTotalTokens: number;
  };
  metrics: {
    executionRate: number;
    activationPrecision: number;
    activationRecall: number;
    activationAccuracy: number;
    sourcePrecision: number;
    sourceRecall: number;
    irrelevantInjectionRate: number;
    qualificationAccuracy: number;
    locatorAccuracy: number;
    evidenceIsolation: number;
    budgetCompliance: number;
    degradedRate: number;
  };
  stability: {
    requestedRuns: number;
    completedRuns: number;
    stableCaseRate: number | null;
    minimumRunPassRate: number;
    flakyCaseIds: string[];
  };
  runs: AutoRecallBenchRunSummary[];
  cases: AutoRecallBenchCaseReport[];
  blockers: string[];
  releaseBlockers: string[];
}

interface CorpusIdentities {
  sourceByLocator: Map<string, string>;
  sourceContent: Map<string, string>;
}

/** Runs the production auto-recall context profile against only a temporary invented knowledge base. */
export async function runAutoRecallBench(
  config: AknoConfig,
  options: AutoRecallBenchOptions = {},
): Promise<AutoRecallBenchReport> {
  validateAutoRecallCorpora();
  const split = options.split ?? 'development';
  const corpus = autoRecallBenchCorpus(split);
  const requestedRuns = normalizeRuns(options.runs ?? (split === 'test' ? REQUIRED_STABILITY_RUNS : 1));
  const concurrency = normalizeConcurrency(options.concurrency ?? 2);
  const embeddingProvider = options.embeddingProvider ?? config.models.embedding.provider?.name ?? 'openai';
  const embeddingModel = options.embeddingModel ?? config.models.embedding.id;
  const embeddingDimensions = normalizeDimensions(
    options.embeddingDimensions ?? config.models.embedding.dimensions ?? 1_536,
  );
  const qualifierProvider = options.provider ?? config.models.reranker.provider?.name ?? 'openai';
  const qualifierModel = options.model ?? config.models.reranker.id;
  const reasoningEffort = options.reasoningEffort ?? config.models.reranker.reasoningEffort;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-auto-recall-bench-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-auto-recall-bench-state-'));
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
        qualifierProvider,
        qualifierModel,
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
    const qualifier = {
      provider: memory.config.models.reranker.provider?.name ?? null,
      model: memory.config.models.reranker.id,
      mode: memory.config.models.reranker.rerankerMode ?? null,
      reasoningEffort: memory.config.models.reranker.reasoningEffort ?? null,
      available: roleAvailable(memory.config.models.reranker),
    };
    const prerequisite = !embedding.available
      ? 'embedding_unavailable'
      : !qualifier.available
        ? 'qualifier_unavailable'
        : null;
    const caseRuns: AutoRecallBenchCaseReport[][] = [];
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
    return buildReport({ corpus, requestedRuns, concurrency, embedding, qualifier, caseRuns });
  } finally {
    if (memory) await memory.close().catch(() => undefined);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
}

export function markAutoRecallBenchPersisted(report: AutoRecallBenchReport): AutoRecallBenchReport {
  return refreshRelease({ ...report, artifactPersisted: true });
}

function buildReport(options: {
  corpus: AutoRecallBenchCorpus;
  requestedRuns: number;
  concurrency: number;
  embedding: AutoRecallBenchReport['embedding'];
  qualifier: AutoRecallBenchReport['qualifier'];
  caseRuns: AutoRecallBenchCaseReport[][];
}): AutoRecallBenchReport {
  const cases = options.caseRuns.flat();
  const representativeCases = options.caseRuns[0] ?? [];
  const executed = cases.filter((benchCase) => benchCase.executed);
  const positive = cases.filter((benchCase) => benchCase.expectedActivation);
  const negative = cases.filter((benchCase) => !benchCase.expectedActivation);
  const activated = cases.filter((benchCase) => benchCase.activated);
  const latencies = executed.map((benchCase) => benchCase.latencyMs);
  const requiredSources = sum(cases.map((benchCase) => benchCase.requiredSources));
  const selectedSources = sum(cases.map((benchCase) => benchCase.selectedCount));
  const qualificationCalls = sum(cases.map((benchCase) => benchCase.modelCalls));
  const stability = stabilityFor(options.caseRuns, options.corpus.cases, options.requestedRuns);
  const thresholds = autoRecallThresholds();
  const metrics = {
    executionRate: ratio(executed.length, cases.length),
    activationPrecision: ratio(
      activated.filter((benchCase) => benchCase.expectedActivation).length,
      activated.length,
    ),
    activationRecall: ratio(positive.filter((benchCase) => benchCase.activated).length, positive.length),
    activationAccuracy: ratio(cases.filter((benchCase) => benchCase.activationCorrect).length, cases.length),
    sourcePrecision: ratio(sum(cases.map((benchCase) => benchCase.relevantSelected)), selectedSources),
    sourceRecall: ratio(sum(cases.map((benchCase) => benchCase.recalledSources)), requiredSources),
    irrelevantInjectionRate: ratio(
      negative.filter((benchCase) => benchCase.activated || benchCase.irrelevantSelected > 0).length,
      negative.length,
    ),
    qualificationAccuracy: ratio(
      cases.filter((benchCase) => benchCase.qualificationCorrect).length,
      cases.length,
    ),
    locatorAccuracy: ratio(cases.filter((benchCase) => benchCase.locatorsValid).length, cases.length),
    evidenceIsolation: ratio(
      cases.filter(
        (benchCase) =>
          benchCase.exactEvidenceOnly && benchCase.ambientContextAbsent && benchCase.conversationProtected,
      ).length,
      cases.length,
    ),
    budgetCompliance: ratio(cases.filter((benchCase) => benchCase.budgetCompliant).length, cases.length),
    degradedRate: ratio(cases.filter((benchCase) => benchCase.degraded.length > 0).length, cases.length),
  };
  const qualificationRate = ratio(qualificationCalls, executed.length);
  const p95LatencyMs = percentile(latencies, 0.95);
  const blockers: string[] = [];
  if (!options.embedding.available) blockers.push('embedding_available');
  if (!options.qualifier.available) blockers.push('qualifier_available');
  if (metrics.executionRate < thresholds.executionRate) blockers.push('execution_rate');
  if (metrics.activationPrecision < thresholds.activationPrecision) blockers.push('activation_precision');
  if (metrics.activationRecall < thresholds.activationRecall) blockers.push('activation_recall');
  if (metrics.activationAccuracy < thresholds.activationAccuracy) blockers.push('activation_accuracy');
  if (metrics.sourcePrecision < thresholds.sourcePrecision) blockers.push('source_precision');
  if (metrics.sourceRecall < thresholds.sourceRecall) blockers.push('source_recall');
  if (metrics.irrelevantInjectionRate > thresholds.irrelevantInjectionRate)
    blockers.push('irrelevant_injection_rate');
  if (metrics.qualificationAccuracy < thresholds.qualificationAccuracy)
    blockers.push('qualification_accuracy');
  if (metrics.locatorAccuracy < thresholds.locatorAccuracy) blockers.push('locator_accuracy');
  if (metrics.evidenceIsolation < thresholds.evidenceIsolation) blockers.push('evidence_isolation');
  if (metrics.budgetCompliance < thresholds.budgetCompliance) blockers.push('budget_compliance');
  if (metrics.degradedRate > thresholds.degradedRate) blockers.push('degraded_rate');
  if (qualificationRate > thresholds.maximumQualificationRate) blockers.push('qualification_rate');
  if (stability.stableCaseRate !== null && stability.stableCaseRate < thresholds.stableCaseRate)
    blockers.push('case_stability');
  if (stability.minimumRunPassRate < thresholds.minimumRunPassRate) blockers.push('minimum_run_pass_rate');
  if (p95LatencyMs > thresholds.p95LatencyMs) blockers.push('p95_latency');

  return refreshRelease({
    kind: 'invented_auto_recall_benchmark',
    schemaVersion: AUTO_RECALL_BENCH_SCHEMA_VERSION,
    policyVersion: AUTO_RECALL_POLICY_VERSION,
    createdAt: new Date().toISOString(),
    development: options.corpus.split === 'development',
    artifactPersisted: false,
    releaseEligible: false,
    passed: blockers.length === 0,
    split: options.corpus.split,
    corpus: {
      version: options.corpus.version,
      fingerprint: autoRecallCorpusFingerprint(options.corpus),
      cases: options.corpus.cases.length,
      sources: options.corpus.sources.length,
      categories: new Set(options.corpus.cases.map((benchCase) => benchCase.category)).size,
      frozen: options.corpus.frozen,
      independentlyReviewed: options.corpus.independentlyReviewed,
    },
    policy: {
      semanticThreshold: AUTO_RECALL_SEMANTIC_THRESHOLD,
      nativeQualificationThreshold: AUTO_RECALL_NATIVE_QUALIFICATION_THRESHOLD,
      defaultBudget: 1200,
      candidateLimit: 8,
      maximumResults: 3,
    },
    thresholds,
    embedding: options.embedding,
    qualifier: options.qualifier,
    execution: {
      concurrency: options.concurrency,
      operations: executed.length,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs,
      maxLatencyMs: latencies.length === 0 ? 0 : Math.max(...latencies),
      qualificationCalls,
      qualificationRate,
      qualificationLatencyMs: sum(cases.map((benchCase) => benchCase.qualificationLatencyMs)),
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

function refreshRelease(report: AutoRecallBenchReport): AutoRecallBenchReport {
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

function autoRecallThresholds(): AutoRecallBenchReport['thresholds'] {
  return {
    executionRate: 1,
    activationPrecision: 1,
    activationRecall: 1,
    activationAccuracy: 1,
    sourcePrecision: 1,
    sourceRecall: 1,
    irrelevantInjectionRate: 0,
    qualificationAccuracy: 1,
    locatorAccuracy: 1,
    evidenceIsolation: 1,
    budgetCompliance: 1,
    degradedRate: 0,
    stableCaseRate: 1,
    minimumRunPassRate: 1,
    maximumQualificationRate: MAX_QUALIFICATION_RATE,
    p95LatencyMs: MAX_P95_LATENCY_MS,
  };
}

async function runCases(
  memory: Akno,
  identities: CorpusIdentities,
  cases: AutoRecallBenchCase[],
  concurrency: number,
  run: number,
  runs: number,
  onProgress?: AutoRecallBenchOptions['onProgress'],
): Promise<AutoRecallBenchCaseReport[]> {
  return mapConcurrent(
    cases,
    concurrency,
    (benchCase) => runCase(memory, identities, benchCase),
    (done) => onProgress?.({ run, runs, done, total: cases.length }),
  );
}

async function runCase(
  memory: Akno,
  identities: CorpusIdentities,
  benchCase: AutoRecallBenchCase,
): Promise<AutoRecallBenchCaseReport> {
  const started = performance.now();
  try {
    const output = await memory.context({
      profile: 'auto_recall',
      query: benchCase.prompt,
      budget: benchCase.budget ?? 1200,
      ...(benchCase.conversationContext ? { conversation_context: benchCase.conversationContext } : {}),
      ...(benchCase.filter ? { filter: benchCase.filter } : {}),
    });
    return gradeCase(benchCase, output, identities, performance.now() - started);
  } catch {
    return skippedCase(benchCase, 'operation_failed', performance.now() - started);
  }
}

function gradeCase(
  benchCase: AutoRecallBenchCase,
  output: ContextOutput,
  identities: CorpusIdentities,
  latencyMs: number,
): AutoRecallBenchCaseReport {
  const selectedSources = dedupe(
    output.results.flatMap((result) => identities.sourceByLocator.get(locatorFor(result)) ?? []),
  );
  const required = benchCase.expectation.requiredSources;
  const allowed = benchCase.expectation.allowedSources;
  const recalledSources = required.filter((source) => selectedSources.includes(source)).length;
  const relevantSelected = selectedSources.filter((source) => allowed.includes(source)).length;
  const irrelevantSelected = selectedSources.filter((source) => !allowed.includes(source)).length;
  const activated = output.activation?.activated === true;
  const qualificationRun = output.activation?.qualification_run === true;
  const qualificationCorrect =
    benchCase.expectation.qualification === 'either' ||
    (benchCase.expectation.qualification === 'required' ? qualificationRun : !qualificationRun);
  const locatorsValid = output.results.every((result) => locatorIsExact(result, identities));
  const exactEvidenceOnly = output.results.every(evidenceIsExactOnly);
  const ambientContextAbsent =
    output.pinned.length === 0 && output.timeline.length === 0 && output.structure === undefined;
  const conversationProtected = output.searched.length === 1 && output.searched[0] === benchCase.prompt;
  const budget = benchCase.budget ?? 1200;
  const budgetCompliant = output.budget_used <= budget;
  const activationCorrect =
    activated === benchCase.expectation.activated &&
    recalledSources === required.length &&
    irrelevantSelected === 0;
  const qualification = output.qualification;
  const modelCalls = qualificationRun ? 1 : 0;
  const usageReported =
    qualification !== undefined &&
    (qualification.input_tokens != null ||
      qualification.output_tokens != null ||
      qualification.total_tokens != null);
  const passed =
    output.status !== 'degraded' &&
    output.status !== 'unavailable' &&
    activationCorrect &&
    qualificationCorrect &&
    locatorsValid &&
    exactEvidenceOnly &&
    ambientContextAbsent &&
    conversationProtected &&
    budgetCompliant;
  return {
    id: benchCase.id,
    category: benchCase.category,
    executed: true,
    status: output.status,
    degraded: output.degraded ?? [],
    expectedActivation: benchCase.expectation.activated,
    activated,
    activationCorrect,
    activationBasis: output.activation?.basis ?? null,
    qualificationExpected: benchCase.expectation.qualification,
    qualificationRun,
    qualificationCorrect,
    selectedSources,
    selectedRelevance: output.results.map((result) => result.relevance ?? 0),
    selectedCount: output.results.length,
    requiredSources: required.length,
    recalledSources,
    relevantSelected,
    irrelevantSelected,
    locatorsValid,
    exactEvidenceOnly,
    ambientContextAbsent,
    conversationProtected,
    budget,
    budgetUsed: output.budget_used,
    budgetCompliant,
    latencyMs,
    qualificationLatencyMs: qualification?.latency_ms ?? 0,
    modelCalls,
    usageReportedCalls: usageReported ? 1 : 0,
    providerInputTokens: qualification?.input_tokens ?? 0,
    providerOutputTokens: qualification?.output_tokens ?? 0,
    providerTotalTokens: qualification?.total_tokens ?? 0,
    passed,
    error: null,
  };
}

function skippedCase(
  benchCase: AutoRecallBenchCase,
  error: string,
  latencyMs = 0,
): AutoRecallBenchCaseReport {
  return {
    id: benchCase.id,
    category: benchCase.category,
    executed: false,
    status: null,
    degraded: [],
    expectedActivation: benchCase.expectation.activated,
    activated: false,
    activationCorrect: false,
    activationBasis: null,
    qualificationExpected: benchCase.expectation.qualification,
    qualificationRun: false,
    qualificationCorrect: false,
    selectedSources: [],
    selectedRelevance: [],
    selectedCount: 0,
    requiredSources: benchCase.expectation.requiredSources.length,
    recalledSources: 0,
    relevantSelected: 0,
    irrelevantSelected: 0,
    locatorsValid: false,
    exactEvidenceOnly: false,
    ambientContextAbsent: false,
    conversationProtected: false,
    budget: benchCase.budget ?? 1200,
    budgetUsed: 0,
    budgetCompliant: false,
    latencyMs,
    qualificationLatencyMs: 0,
    modelCalls: 0,
    usageReportedCalls: 0,
    providerInputTokens: 0,
    providerOutputTokens: 0,
    providerTotalTokens: 0,
    passed: false,
    error,
  };
}

function locatorFor(result: RecallResult): string {
  return result.type === 'page' ? result.slug : result.id;
}

function locatorIsExact(result: RecallResult, identities: CorpusIdentities): boolean {
  const source = identities.sourceContent.get(locatorFor(result));
  if (source === undefined) return false;
  if (result.type === 'document') return Boolean(result.quote && source.includes(result.quote));
  const lines = source.split('\n');
  return (
    result.lines.length > 0 && result.lines.every((line) => line.n > 0 && lines[line.n - 1] === line.text)
  );
}

function evidenceIsExactOnly(result: RecallResult): boolean {
  if (result.type === 'document')
    return result.summary === undefined && result.suggested_actions === undefined;
  return (
    result.summary === null &&
    result.links === undefined &&
    result.superseded === undefined &&
    result.graph_paths === undefined &&
    (result.documents ?? []).every((document) => document.summary === undefined)
  );
}

function summarizeRun(run: number, cases: AutoRecallBenchCaseReport[]): AutoRecallBenchRunSummary {
  const executed = cases.filter((benchCase) => benchCase.executed);
  const casesPassed = cases.filter((benchCase) => benchCase.passed).length;
  return {
    run,
    passed: casesPassed === cases.length,
    casesPassed,
    casesTotal: cases.length,
    qualificationRate: ratio(sum(cases.map((benchCase) => benchCase.modelCalls)), executed.length),
    p95LatencyMs: percentile(
      executed.map((benchCase) => benchCase.latencyMs),
      0.95,
    ),
    modelCalls: sum(cases.map((benchCase) => benchCase.modelCalls)),
    providerTotalTokens: sum(cases.map((benchCase) => benchCase.providerTotalTokens)),
  };
}

function stabilityFor(
  caseRuns: AutoRecallBenchCaseReport[][],
  corpusCases: AutoRecallBenchCase[],
  requestedRuns: number,
): AutoRecallBenchReport['stability'] {
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

function decisionFingerprint(report: AutoRecallBenchCaseReport): string {
  return JSON.stringify({
    executed: report.executed,
    status: report.status,
    degraded: [...report.degraded].sort(),
    activated: report.activated,
    basis: report.activationBasis,
    qualificationRun: report.qualificationRun,
    selectedSources: [...report.selectedSources].sort(),
    passed: report.passed,
    error: report.error,
  });
}

function benchmarkOverrides(
  config: AknoConfig,
  options: {
    embeddingProvider: string;
    embeddingModel: string | null;
    embeddingDimensions: number;
    qualifierProvider: string;
    qualifierModel: string | null;
    reasoningEffort: ReasoningEffort | undefined;
  },
): ConfigDoc {
  return {
    providers: benchmarkProviders(config),
    create_reserved_paths: false,
    write_ids: false,
    ignore: ['.git', '.obsidian', '.akno', 'node_modules'],
    page_extensions: ['.md', '.markdown'],
    folders: { [`${AUTO_RECALL_BENCH_ROOT}/**`]: { role: 'knowledge', remember: 'deny', rank: 1 } },
    index: { summaries: false, facts: false, ann_threshold_chunks: 20_000 },
    recall: {
      expansion: false,
      graph: false,
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
      reranker: {
        provider: options.qualifierProvider,
        id: options.qualifierModel,
        enabled: options.qualifierModel !== null,
        mode: config.models.reranker.rerankerMode,
        exclude_irrelevant: true,
        top_k: 8,
        max_chars: config.models.reranker.maxChars ?? 800,
        max_output_tokens: config.models.reranker.maxOutputTokens,
        score_offset: config.models.reranker.scoreOffset,
        ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
        timeout_ms: Math.max(60_000, config.models.reranker.timeoutMs),
      },
      derive: { id: null, enabled: false },
      expansion: { id: null, enabled: false },
      answer: { id: null, enabled: false },
      vision: { id: null, enabled: false },
    },
  };
}

function writeCorpus(root: string, corpus: AutoRecallBenchCorpus): CorpusIdentities {
  const sourceByLocator = new Map<string, string>();
  const sourceContent = new Map<string, string>();
  for (const source of corpus.sources) {
    const relPath = `${AUTO_RECALL_BENCH_ROOT}/${source.path}`;
    const target = path.join(root, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source.content, 'utf8');
    const locator = source.path.endsWith('.md')
      ? relPath.replace(/\.md$/u, '')
      : `doc_${sha256(source.content).slice(0, 12)}`;
    sourceByLocator.set(locator, source.id);
    sourceContent.set(locator, source.content);
  }
  return { sourceByLocator, sourceContent };
}

export function validateAutoRecallCorpora(): void {
  validateCorpus(AUTO_RECALL_DEVELOPMENT_CORPUS);
  validateCorpus(AUTO_RECALL_HELD_OUT_CORPUS);
  assertDisjoint(
    AUTO_RECALL_DEVELOPMENT_CORPUS.sources.map((source) => source.id),
    AUTO_RECALL_HELD_OUT_CORPUS.sources.map((source) => source.id),
    'source id',
  );
  assertDisjoint(
    AUTO_RECALL_DEVELOPMENT_CORPUS.sources.map((source) => source.path),
    AUTO_RECALL_HELD_OUT_CORPUS.sources.map((source) => source.path),
    'source path',
  );
  assertDisjoint(
    AUTO_RECALL_DEVELOPMENT_CORPUS.sources.map((source) => sha256(source.content)),
    AUTO_RECALL_HELD_OUT_CORPUS.sources.map((source) => sha256(source.content)),
    'source content',
  );
  assertDisjoint(
    AUTO_RECALL_DEVELOPMENT_CORPUS.cases.map((benchCase) => benchCase.id),
    AUTO_RECALL_HELD_OUT_CORPUS.cases.map((benchCase) => benchCase.id),
    'case id',
  );
  assertDisjoint(
    AUTO_RECALL_DEVELOPMENT_CORPUS.cases.map(caseInputFingerprint),
    AUTO_RECALL_HELD_OUT_CORPUS.cases.map(caseInputFingerprint),
    'prompt and conversation input',
  );
  const fingerprint = autoRecallCorpusFingerprint(AUTO_RECALL_HELD_OUT_CORPUS);
  if (fingerprint !== AUTO_RECALL_HELD_OUT_FINGERPRINT) {
    throw new Error(`frozen auto-recall corpus changed without a versioned fingerprint: ${fingerprint}`);
  }
}

function validateCorpus(corpus: AutoRecallBenchCorpus): void {
  const sourceIds = new Set<string>();
  const paths = new Set<string>();
  for (const source of corpus.sources) {
    if (sourceIds.has(source.id)) throw new Error(`duplicate auto-recall benchmark source id: ${source.id}`);
    if (paths.has(source.path)) throw new Error(`duplicate auto-recall benchmark path: ${source.path}`);
    sourceIds.add(source.id);
    paths.add(source.path);
  }
  const caseIds = new Set<string>();
  for (const benchCase of corpus.cases) {
    if (caseIds.has(benchCase.id))
      throw new Error(`duplicate auto-recall benchmark case id: ${benchCase.id}`);
    caseIds.add(benchCase.id);
    for (const source of [
      ...benchCase.expectation.requiredSources,
      ...benchCase.expectation.allowedSources,
    ]) {
      if (!sourceIds.has(source)) throw new Error(`unknown auto-recall benchmark source id: ${source}`);
    }
    if (
      benchCase.expectation.requiredSources.some(
        (source) => !benchCase.expectation.allowedSources.includes(source),
      )
    ) {
      throw new Error(`auto-recall benchmark case ${benchCase.id} requires a source it does not allow`);
    }
  }
}

function assertDisjoint(left: string[], right: string[], label: string): void {
  const leftSet = new Set(left);
  const overlap = right.find((value) => leftSet.has(value));
  if (overlap) throw new Error(`auto-recall benchmark splits share ${label}: ${overlap}`);
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
  return `AKNO_AUTO_RECALL_BENCH_PROVIDER_${index}_KEY`;
}

function roleAvailable(role: AknoConfig['models']['embedding']): boolean {
  return role.enabled && role.provider !== null && role.id !== null;
}

function normalizeRuns(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('auto-recall runs must be 1..10');
  return value;
}

function normalizeConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 8)
    throw new Error('auto-recall concurrency must be 1..8');
  return value;
}

function normalizeDimensions(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 65_536) {
    throw new Error('auto-recall embedding dimensions must be 1..65536');
  }
  return value;
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
  onDone?: (done: number) => void,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = next++;
      const value = values[index];
      if (value === undefined) return;
      results[index] = await worker(value);
      done++;
      onDone?.(done);
    }
  });
  await Promise.all(runners);
  return results;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]!;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function caseInputFingerprint(benchCase: AutoRecallBenchCase): string {
  return sha256(
    JSON.stringify({
      prompt: normalize(benchCase.prompt),
      conversationContext: benchCase.conversationContext ?? [],
    }),
  );
}
