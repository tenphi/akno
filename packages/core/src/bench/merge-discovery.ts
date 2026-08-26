import type { AknoConfig, ReasoningEffort, ResolvedModelRole } from '../config/schema.ts';
import {
  judgeSemanticMergeCandidate,
  SEMANTIC_MERGE_PROMPT_VERSION,
  type SemanticMergeVerdict,
} from '../maintenance/merge-classifier.ts';
import { ModelClient } from '../models/client.ts';
import { sha256 } from '../store/ids.ts';

export const MERGE_DISCOVERY_BENCH_VERSION = 1;

export type MergeDiscoveryCategory =
  'duplicate' | 'near_purpose' | 'related_scope' | 'template' | 'entity_collision';

export interface MergeDiscoveryBenchOptions {
  embeddingProvider?: string;
  embeddingModel?: string;
  provider?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
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

export interface MergeDiscoveryBenchReport {
  kind: 'invented_merge_discovery_development';
  schemaVersion: number;
  split: 'development';
  corpus: {
    fingerprint: string;
    pages: number;
    cases: number;
    independentlyReviewed: false;
  };
  embedding: { provider: string; model: string };
  embeddingLatencyMs: number;
  embeddingOnly: MergeDiscoveryEvaluation;
  classifier: MergeDiscoveryClassifierReport | null;
  passed: boolean;
  blockers: string[];
  error: 'embedding_unavailable' | 'embedding_failed' | 'classifier_unavailable' | null;
}

interface BenchPage {
  id: string;
  text: string;
}

interface BenchCase {
  id: string;
  category: MergeDiscoveryCategory;
  expected: MergeDiscoveryCaseScore['expected'];
  left: string;
  right: string;
}

const PAGES: BenchPage[] = [
  page(
    'ada-profile',
    'Ada Marlow',
    'Durable profile for Ada Marlow. Ada lives at Blackwater Bay and maintains a Zephyr QX-100 field kit.',
  ),
  page(
    'ada-notes',
    'Notes about Ada Marlow',
    'Additional durable facts about Ada Marlow. Ada works with Vulpine Mutual and keeps a brass compass.',
  ),
  page(
    'ada-project',
    'Ada Marlow — Zephyr rollout',
    'Scoped project log for Ada Marlow: rollout milestones, assigned tasks, open decisions, and completion dates.',
  ),
  page(
    'ada-morrow',
    'Ada Morrow',
    'Durable profile for Ada Morrow. Ada lives inland and maintains a Copperfin RX-200 field kit.',
  ),
  page(
    'bo-profile',
    'Bo Winters',
    'Durable profile for Bo Winters. Bo lives at Blackwater Bay and maintains a Zephyr QX-100 field kit.',
  ),
  page(
    'zephyr-profile',
    'Zephyr QX-100',
    'Canonical product overview for the Zephyr QX-100, including its durable identity, manufacturer, and specifications.',
  ),
  page(
    'zephyr-notes',
    'Zephyr QX-100 notes',
    'Additional durable product facts about the Zephyr QX-100, including materials, dimensions, and maintenance characteristics.',
  ),
  page(
    'zephyr-warranty',
    'Zephyr QX-100 warranty procedure',
    'Scoped warranty procedure for the Zephyr QX-100: claim steps, required evidence, deadlines, and escalation contacts.',
  ),
  page(
    'zephyr-qx200',
    'Zephyr QX-200',
    'Canonical product overview for the Zephyr QX-200, including its durable identity, manufacturer, and specifications.',
  ),
  page(
    'vulpine-profile',
    'Vulpine Mutual',
    'Canonical organization profile for Vulpine Mutual, its identity, services, and durable contact information.',
  ),
  page(
    'vulpine-notes',
    'Notes about Vulpine Mutual',
    'Additional durable facts about Vulpine Mutual, its service regions, departments, and public contact channels.',
  ),
  page(
    'vulpine-claims',
    'Vulpine Mutual claims procedure',
    'Scoped claims workflow for Vulpine Mutual: filing steps, evidence requirements, review stages, and appeals.',
  ),
  page(
    'bay-profile',
    'Blackwater Bay',
    'Canonical place profile for Blackwater Bay, including location, enduring characteristics, and access information.',
  ),
  page(
    'bay-notes',
    'Blackwater Bay field notes',
    'Additional enduring facts about Blackwater Bay, including terrain, access points, and seasonal conditions.',
  ),
  page(
    'bay-visit',
    'Blackwater Bay visit plan',
    'Dated visit plan for Blackwater Bay with train times, assigned seats, lodging, and a temporary itinerary.',
  ),
  page(
    'daily-one',
    'Daily note 2040-01-01',
    'Daily template with tasks, meetings, weather, meals, and a short end-of-day reflection.',
  ),
  page(
    'daily-two',
    'Daily note 2040-01-02',
    'Daily template with tasks, meetings, weather, meals, and a short end-of-day reflection.',
  ),
];

const CASES: BenchCase[] = [
  benchCase('person-near-purpose', 'near_purpose', 'candidate', 'ada-profile', 'ada-notes'),
  benchCase('product-near-purpose', 'near_purpose', 'candidate', 'zephyr-profile', 'zephyr-notes'),
  benchCase('organization-near-purpose', 'duplicate', 'candidate', 'vulpine-profile', 'vulpine-notes'),
  benchCase('place-near-purpose', 'near_purpose', 'candidate', 'bay-profile', 'bay-notes'),
  benchCase('person-project-scope', 'related_scope', 'keep_separate', 'ada-profile', 'ada-project'),
  benchCase('product-warranty-scope', 'related_scope', 'keep_separate', 'zephyr-profile', 'zephyr-warranty'),
  benchCase(
    'organization-claims-scope',
    'related_scope',
    'keep_separate',
    'vulpine-profile',
    'vulpine-claims',
  ),
  benchCase('place-visit-scope', 'related_scope', 'keep_separate', 'bay-profile', 'bay-visit'),
  benchCase('person-template', 'template', 'keep_separate', 'ada-profile', 'bo-profile'),
  benchCase('daily-template', 'template', 'keep_separate', 'daily-one', 'daily-two'),
  benchCase('person-name-collision', 'entity_collision', 'keep_separate', 'ada-profile', 'ada-morrow'),
  benchCase('product-model-collision', 'entity_collision', 'keep_separate', 'zephyr-profile', 'zephyr-qx200'),
];

const DEVELOPMENT_PREFILTER_THRESHOLD = 0.68;

/** Sends only the tracked invented corpus to the selected embedding endpoint. */
export async function runMergeDiscoveryBench(
  config: AknoConfig,
  options: MergeDiscoveryBenchOptions = {},
): Promise<MergeDiscoveryBenchReport> {
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
  const embedded = await new ModelClient(role).embed(PAGES.map((entry) => entry.text));
  if (!embedded.ok || !embedded.value) {
    return failedReport(
      providerName,
      modelId,
      embedded.latencyMs,
      provider ? 'embedding_failed' : 'embedding_unavailable',
    );
  }
  const vectors = new Map(PAGES.map((entry, index) => [entry.id, embedded.value![index]!]));
  const scores = CASES.map((entry) => ({
    ...entry,
    score: cosine(vectors.get(entry.left)!, vectors.get(entry.right)!),
  }));
  const embeddingOnly = selectThreshold(scores);
  const classifierRole = classifierModel(config, options);
  if (!classifierRole.client.available) {
    return {
      kind: 'invented_merge_discovery_development',
      schemaVersion: MERGE_DISCOVERY_BENCH_VERSION,
      split: 'development',
      corpus: corpusSummary(),
      embedding: { provider: providerName, model: modelId },
      embeddingLatencyMs: embedded.latencyMs,
      embeddingOnly,
      classifier: null,
      passed: false,
      blockers: ['classifier_unavailable'],
      error: 'classifier_unavailable',
    };
  }
  const classifier = await classifyCases(classifierRole, scores);
  return {
    kind: 'invented_merge_discovery_development',
    schemaVersion: MERGE_DISCOVERY_BENCH_VERSION,
    split: 'development',
    corpus: corpusSummary(),
    embedding: { provider: providerName, model: modelId },
    embeddingLatencyMs: embedded.latencyMs,
    embeddingOnly,
    classifier,
    passed: classifier.passed,
    blockers: classifier.blockers,
    error: null,
  };
}

export function evaluateMergeDiscoveryScores(
  scores: ReadonlyArray<Omit<BenchCase, 'left' | 'right'> & { score: number }>,
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

function selectThreshold(
  scores: ReadonlyArray<Omit<BenchCase, 'left' | 'right'> & { score: number }>,
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

function failedReport(
  provider: string,
  model: string,
  latencyMs: number,
  error: NonNullable<MergeDiscoveryBenchReport['error']>,
): MergeDiscoveryBenchReport {
  const scores = CASES.map(({ left: _left, right: _right, ...entry }) => ({ ...entry, score: 0 }));
  const embeddingOnly = evaluateMergeDiscoveryScores(scores, 1.000001);
  return {
    kind: 'invented_merge_discovery_development',
    schemaVersion: MERGE_DISCOVERY_BENCH_VERSION,
    split: 'development',
    corpus: corpusSummary(),
    embedding: { provider, model },
    embeddingLatencyMs: latencyMs,
    embeddingOnly,
    classifier: null,
    error,
    passed: false,
    blockers: [error, ...embeddingOnly.blockers],
  };
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
  scores: ReadonlyArray<BenchCase & { score: number }>,
): Promise<MergeDiscoveryClassifierReport> {
  const pageById = new Map(PAGES.map((entry) => [entry.id, entry]));
  const reports: MergeDiscoveryClassifierCase[] = [];
  for (const bench of scores) {
    if (bench.score < DEVELOPMENT_PREFILTER_THRESHOLD) {
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
    provider: model.provider,
    model: model.model,
    reasoningEffort: model.reasoningEffort,
    promptVersion: SEMANTIC_MERGE_PROMPT_VERSION,
    prefilterThreshold: DEVELOPMENT_PREFILTER_THRESHOLD,
    calls: reports.filter((entry) => entry.prefiltered).length,
    metrics,
    cases: reports,
    passed: blockers.length === 0,
    blockers,
  };
}

function semanticPage(entry: BenchPage, slug: string): { slug: string; title: string; content: string } {
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

function corpusSummary(): MergeDiscoveryBenchReport['corpus'] {
  return {
    fingerprint: sha256(
      JSON.stringify({ version: MERGE_DISCOVERY_BENCH_VERSION, pages: PAGES, cases: CASES }),
    ),
    pages: PAGES.length,
    cases: CASES.length,
    independentlyReviewed: false,
  };
}

function page(id: string, title: string, summary: string): BenchPage {
  return { id, text: `# ${title}\n\n${summary}` };
}

function benchCase(
  id: string,
  category: MergeDiscoveryCategory,
  expected: MergeDiscoveryCaseScore['expected'],
  left: string,
  right: string,
): BenchCase {
  return { id, category, expected, left, right };
}

function rejectionRate(cases: MergeDiscoveryCaseScore[], category: MergeDiscoveryCategory): number {
  const selected = cases.filter((entry) => entry.category === category);
  return ratio(selected.filter((entry) => !entry.selected).length, selected.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
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
