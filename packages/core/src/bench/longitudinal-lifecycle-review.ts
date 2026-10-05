import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  LIFECYCLE_CORPUS,
  LIFECYCLE_CORPUS_VERSION,
  LIFECYCLE_GATES,
  type LifecycleEpisode,
} from './longitudinal-lifecycle-corpus.ts';
import { INFERENCE_CORPUS, INFERENCE_CORPUS_VERSION } from './longitudinal-inference-corpus.ts';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stages = ['memory', 'recall', 'context', 'answer'] as const;
const positive = new Set([
  'bounded-patterns',
  'dependent-principle',
  'unselected-proposal',
  'rejected-proposal',
  'single-booking-payment',
  'updated-departure',
  'known-member',
  'new-member',
  'past-schedules',
]);
const stageReview = z
  .object({
    covered: z.array(z.string()),
    errors: z.array(
      z
        .object({
          id: z.string().regex(/^[a-z0-9_-]{1,80}$/),
          code: z.enum([
            'unsupported_promotion',
            'qualification_loss',
            'false_corroboration',
            'stale_use',
            'wrong_identity',
            'duplicate',
          ]),
          origin: z.enum(['natural', 'seeded']),
        })
        .strict(),
    ),
    outcome: z.enum(['produced', 'justified_abstention', 'false_hold', 'unavailable', 'not_measured']),
    triage: z.array(
      z.enum([
        'missing_context',
        'representation_identity',
        'retrieval',
        'model_interpretation',
        'lifecycle',
        'unknown',
      ]),
    ),
  })
  .strict();
const reviewSchema = z
  .object({
    version: z.literal('lifecycle-review-v1'),
    packetFingerprint: z.string(),
    reviewer: z.object({ id: z.string(), sourceBased: z.literal(true), independent: z.boolean() }).strict(),
    checkpoints: z.array(
      z
        .object({
          key: z.string(),
          stages: z
            .object({ memory: stageReview, recall: stageReview, context: stageReview, answer: stageReview })
            .strict(),
          recovery: z.array(
            z
              .object({
                errorId: z.string(),
                event: z.enum(['detected', 'recovered', 'unresolved']),
                cycles: z.number().int().nonnegative().nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
const metricSchema = z
  .object({
    stage: z.enum([
      'answer',
      'context',
      'drain-and-reopen',
      'dream:1',
      'dream:2',
      'dream:3',
      'index-inputs',
      'index-ready',
      'index-setup',
      'read',
      'rebuild',
      'recall',
      'restart',
      'retain:booking',
      'retain:copy',
      'retain:correction',
      'retain:decision',
      'retain:replay',
      'retain:scope',
      'retract:booking',
      'retract:copy',
      'retract:correction',
    ]),
    latencyMs: z.number().nonnegative(),
    failed: z.boolean(),
    calls: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative(),
    callsWithoutUsage: z.number().int().nonnegative(),
    backgroundCalls: z.number().int().nonnegative(),
    inputTokens: z.number().nonnegative().nullable(),
    outputTokens: z.number().nonnegative().nullable(),
    totalTokens: z.number().nonnegative().nullable(),
    modelLatencyMs: z.number().nonnegative(),
    endpointRequests: z.number().int().nonnegative().nullable(),
    scriptedIndexCalls: z.number().int().nonnegative().default(0),
  })
  .strict();
const modelSchema = z
  .object({
    id: z.string().nullable(),
    providerFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    enabled: z.boolean(),
    timeoutMs: z.number(),
    maxOutputTokens: z.number().nullable(),
    reasoningEffort: z.string().nullable(),
    dimensions: z.number().nullable(),
    maxRetries: z.number().nullable(),
  })
  .strict();
// Only typed receipts are public. Private prose accidentally occupying a code field must fail closed.
const phaseReceiptSchema = z.object({
  phase: z.enum(['observe', 'reflect', 'curate', 'adopt', 'conflicts', 'repair', 'housekeeping']),
  ran: z.boolean(),
});
const itemReceiptSchema = z.object({
  kind: z.enum(['observe', 'reflect', 'synthesis']),
  status: z.enum([
    'proposed',
    'approved',
    'rejected',
    'blocked',
    'stale',
    'applying',
    'applied',
    'verification_pending',
    'verification_failed',
  ]),
  statusCode: z
    .enum([
      'budget_exhausted',
      'dependency_conflict',
      'dependency_unmet',
      'inverse_transformation',
      'snapshot_drift',
      'source_revision_unsupported',
    ])
    .nullable(),
});
const controlReceiptSchema = z.object({
  status: z.enum(['not_admitted', 'seeded_valid_lineage']),
  seeded: z.number().int().nonnegative(),
});
const contractSchema = z
  .object({
    runtime: z.literal('built-core-socket-built-client'),
    measurement: z.literal('socket-scoped-drained-index-v2'),
    modelSubstitution: z.literal(
      'derive_only_couples_fact_extraction_retention_verification_observe_scope_reflect_curator',
    ),
    retrievalBudget: z.literal(6000),
    answerOutputTokens: z.literal(2400),
    cycles: z.literal(3),
    maxItems: z.literal(12),
    maxFiles: z.literal(12),
    maxBytes: z.literal(65536),
    maxHighRiskItems: z.union([z.literal(0), z.literal(12)]),
    facts: z.literal('inference_only'),
    summaries: z.literal(false),
    expansion: z.literal(false),
    reranker: z.literal(false),
    clock: z.literal('fixture_process_Date_fixed_source_clock_explicit_when_available'),
    seed: z.null(),
    cost: z.null(),
    indexMode: z.enum(['live', 'scripted_positive_control', 'scripted_source_leaves']).default('live'),
    inferenceNamespace: z.union([z.literal('observations'), z.null()]).default(null),
    models: z.object({ derive: modelSchema, answer: modelSchema, embedding: modelSchema }).strict(),
    artifacts: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).refine((value) => {
      const names = [
        'core/dist/write/retain.js',
        'core/dist/maintenance/dream.js',
        'core/dist/maintenance/observe.js',
        'core/dist/maintenance/observation-scope.js',
        'core/dist/maintenance/curate.js',
        'core/dist/maintenance/overview.js',
        'core/dist/observations/projection.js',
        'core/dist/ops/answer.js',
        'core/dist/open.js',
        'cli/dist/serve/socket.js',
        'client/dist/index.js',
      ];
      const decidingNames = [
        ...names,
        'core/dist/write/deciding-support.js',
        'core/dist/memory/correction-restrictions.js',
      ];
      const temporalNames = [...decidingNames, 'core/dist/models/predicate-time-audit.js'];
      const roleNames = [...temporalNames, 'core/dist/models/source-role-audit.js'];
      return [names, decidingNames, temporalNames, roleNames].some(
        (inventory) =>
          Object.keys(value).length === inventory.length && inventory.every((name) => name in value),
      );
    }, 'Require exactly the recorded compiled artifacts.'),
  })
  .strict();

interface Checkpoint {
  key: string;
  episode: string;
  arm: string;
  run: number;
  step: string;
  seeded: boolean;
  pages: { slug: string; lines?: unknown[] }[];
  recall: { status: string; results?: unknown[] } | null;
  context: { status: string; results?: unknown[]; pinned?: unknown[]; timeline?: unknown[] } | null;
  answer: { status: string; answer: string | null; reason_code?: string } | null;
  before: { observations: { id: string; eligible: number }[]; supports: unknown[] };
  after: {
    observations: { id: string; eligible: number }[];
    facts: { slug: string; eligibility: string | null; traversable: number | null }[];
    supports: unknown[];
    sourceBytesUnchanged: boolean;
  };
  operations: unknown[];
  maintenance: {
    phases: { phase: string; ran: boolean }[];
    maintenancePlans: { items: { kind: string; status: string; statusCode: string | null }[] }[];
    observations: unknown[];
    rejected: unknown[];
    modelDegradation?: unknown[];
  }[];
  control: { status: string; seeded: number } | null;
}
interface Packet {
  version: string;
  corpusFingerprint: string;
  inputReviewFingerprint: string;
  split: string;
  runs: number;
  contract: unknown;
  checkpoints: Checkpoint[];
}

/** Source-authored judgments, never a regex or another model's agreement as truth. */
export function adjudicateLifecycle(packet: Packet, judgments: unknown) {
  const review = reviewSchema.parse(judgments);
  const corpus =
    packet.version === 'longitudinal-discourse-v1'
      ? LIFECYCLE_CORPUS.filter((episode) => episode.track === 'discourse')
      : packet.version === 'longitudinal-overview-authorized-v1'
        ? LIFECYCLE_CORPUS.filter((episode) => episode.track === 'overview')
        : packet.version !== LIFECYCLE_CORPUS_VERSION
          ? INFERENCE_CORPUS
          : LIFECYCLE_CORPUS;
  if (
    ![
      LIFECYCLE_CORPUS_VERSION,
      INFERENCE_CORPUS_VERSION,
      'longitudinal-inference-control-v1',
      'longitudinal-inference-authorized-v1',
      'longitudinal-inference-leaf-control-v1',
      'longitudinal-overview-authorized-v1',
      'longitudinal-discourse-v1',
    ].includes(packet.version) ||
    packet.corpusFingerprint !== hash(corpus) ||
    review.packetFingerprint !== hash(packet)
  )
    throw new Error('Stale corpus or packet fingerprint.');
  const frozenInputReview = {
    version: packet.version,
    corpusFingerprint: hash(corpus),
    reviewer: { id: 'Codex', sourceBased: true, independent: false, beforeOutputs: true },
    limitations: [
      'author_review_not_independent',
      'coupled_derive_role_substitution',
      'two_repeats_descriptive_only',
      'seeded_valid_L2_control_is_not_natural_generation',
      'unsupported_hypothesis_scenario_features_not_implemented',
    ],
    gates: LIFECYCLE_GATES,
  };
  if (packet.inputReviewFingerprint !== hash(frozenInputReview))
    throw new Error('Stale input-review fingerprint.');
  if (
    !['development', 'held-out'].includes(packet.split) ||
    !Number.isInteger(packet.runs) ||
    packet.runs < 1 ||
    packet.runs > 5
  )
    throw new Error('Invalid split/repeats.');
  const contract = contractSchema.parse(packet.contract);
  if (
    ['longitudinal-inference-control-v1', 'longitudinal-inference-authorized-v1'].includes(packet.version) !==
      (contract.indexMode === 'scripted_positive_control') ||
    (packet.version === 'longitudinal-inference-leaf-control-v1') !==
      (contract.indexMode === 'scripted_source_leaves') ||
    ['longitudinal-inference-authorized-v1', 'longitudinal-inference-leaf-control-v1'].includes(
      packet.version,
    ) !==
      (contract.inferenceNamespace === 'observations') ||
    (packet.version === 'longitudinal-overview-authorized-v1') !== (contract.maxHighRiskItems === 12)
  )
    throw new Error('Scripted index controls cannot be relabeled as natural extraction.');
  const episodes = corpus.filter((episode) => episode.split === packet.split);
  const expected = new Map<
    string,
    { episode: LifecycleEpisode; step: LifecycleEpisode['steps'][number]; arm: string; run: number }
  >(
    episodes.flatMap((episode) =>
      Array.from({ length: packet.runs }, (_, index) =>
        ['extract-only', 'maintained'].flatMap((arm) =>
          episode.steps.map(
            (step) =>
              [
                `${episode.id}/${arm}/${index + 1}/${step.id}`,
                { episode, step, arm, run: index + 1 },
              ] as const,
          ),
        ),
      ).flat(),
    ),
  );
  if (
    packet.checkpoints.length !== expected.size ||
    review.checkpoints.length !== expected.size ||
    new Set(packet.checkpoints.map((row) => row.key)).size !== expected.size ||
    new Set(review.checkpoints.map((row) => row.key)).size !== expected.size
  )
    throw new Error('Require every unique checkpoint.');
  const reviews = new Map(review.checkpoints.map((row) => [row.key, row]));
  if (packet.checkpoints.some((row, index) => row.key !== [...expected.keys()][index]))
    throw new Error('Checkpoint order must match the source trajectory.');
  const seenErrors = new Set<string>();
  const errorKinds = new Map<string, string>();
  const rows = packet.checkpoints.map((checkpoint) => {
    const coordinate = expected.get(checkpoint.key),
      judged = reviews.get(checkpoint.key);
    if (
      !coordinate ||
      !judged ||
      checkpoint.episode !== coordinate.episode.id ||
      checkpoint.step !== coordinate.step.id ||
      checkpoint.arm !== coordinate.arm ||
      checkpoint.run !== coordinate.run ||
      checkpoint.seeded !== coordinate.step.seeded
    )
      throw new Error('Unexpected coordinate.');
    const ids = new Set(coordinate.step.expected.map((e) => e.id));
    const required = coordinate.step.expected.filter((e) => positive.has(e.id)).map((e) => e.id);
    const stageRows = stages.map((stage) => {
      const judgment = judged.stages[stage];
      if (
        new Set(judgment.covered).size !== judgment.covered.length ||
        judgment.covered.some((id) => !ids.has(id))
      )
        throw new Error('Unknown/duplicate coverage.');
      const omitted = stage === 'answer' && !coordinate.step.answer;
      const output =
        stage === 'memory'
          ? checkpoint.pages.some((page) => page.lines?.length)
          : stage === 'answer'
            ? Boolean(checkpoint.answer?.answer)
            : Boolean(checkpoint[stage]?.results?.length);
      const unavailable =
        stage !== 'memory' &&
        (!checkpoint[stage] ||
          checkpoint[stage]?.status === 'unavailable' ||
          (stage === 'answer' &&
            [
              'verification_unavailable',
              'generation_unavailable',
              'generation_failed',
              'evidence_unavailable',
            ].includes(checkpoint.answer?.reason_code ?? '')));
      if (
        omitted
          ? judgment.outcome !== 'not_measured' || judgment.covered.length || judgment.errors.length
          : judgment.outcome === 'not_measured'
      )
        throw new Error('Invalid skipped stage.');
      if (
        unavailable &&
        !omitted &&
        (judgment.outcome !== 'unavailable' || judgment.covered.length || judgment.errors.length)
      )
        throw new Error('Availability cannot become semantic coverage.');
      if (!unavailable && judgment.outcome === 'unavailable')
        throw new Error('Available operations cannot be relabeled unavailable.');
      if (!output && judgment.covered.some((id) => positive.has(id)))
        throw new Error('Positive coverage needs output.');
      if (stage === 'answer' && !output && judgment.errors.length)
        throw new Error('A withheld answer cannot promote an error.');
      const errors = judgment.errors.map((error) => {
        const identity = `${checkpoint.episode}/${checkpoint.arm}/${checkpoint.run}/${error.id}`;
        const kind = `${error.code}/${error.origin}`;
        if (errorKinds.has(identity) && errorKinds.get(identity) !== kind)
          throw new Error('An error trajectory cannot change code or origin.');
        errorKinds.set(identity, kind);
        const event = seenErrors.has(identity) ? 'propagated' : 'first_observed';
        seenErrors.add(identity);
        return { ...error, event };
      });
      return {
        stage,
        ...judgment,
        errors,
        useful: {
          covered: judgment.covered.filter((id) => required.includes(id)).length,
          required: omitted ? 0 : required.length,
        },
      };
    });
    const operations = checkpoint.operations.map((metric) => metricSchema.parse(metric));
    if (contract.indexMode === 'live' && operations.some((metric) => metric.scriptedIndexCalls > 0))
      throw new Error('Scripted calls cannot be relabeled as live indexing.');
    for (const event of judged.recovery) {
      const identity = `${checkpoint.episode}/${checkpoint.arm}/${checkpoint.run}/${event.errorId}`;
      if (!seenErrors.has(identity)) throw new Error('Recovery requires an observed error trajectory.');
      if (
        event.event === 'recovered' &&
        stageRows.some((stage) => stage.errors.some((error) => error.id === event.errorId))
      )
        throw new Error('An error still used at this checkpoint cannot be recovered.');
    }
    const eligible = checkpoint.after.observations.filter((row) => row.eligible === 1);
    const replay = coordinate.step.id.startsWith('unchanged');
    return {
      key: checkpoint.key,
      episode: checkpoint.episode,
      track: coordinate.episode.track,
      arm: checkpoint.arm,
      run: checkpoint.run,
      step: checkpoint.step,
      seeded: checkpoint.seeded,
      stages: stageRows,
      recovery: judged.recovery,
      operations,
      sourceBytesUnchanged: checkpoint.after.sourceBytesUnchanged,
      eligibleObservations: eligible.length,
      eligibleSeededObservations: eligible.filter((row) => row.id.startsWith('obs_seeded_')).length,
      reflectedPagePresent: checkpoint.pages.some((page) => page.slug === 'observations/principles'),
      reflectedFacts: {
        indexed: checkpoint.after.facts.filter((fact) => fact.slug === 'observations/principles').length,
        eligible: checkpoint.after.facts.filter(
          (fact) => fact.slug === 'observations/principles' && fact.eligibility === 'eligible',
        ).length,
        traversable: checkpoint.after.facts.filter(
          (fact) => fact.slug === 'observations/principles' && fact.traversable === 1,
        ).length,
      },
      replayInventoryGrowth: replay
        ? Math.max(0, checkpoint.after.supports.length - checkpoint.before.supports.length) +
          Math.max(0, checkpoint.after.observations.length - checkpoint.before.observations.length)
        : null,
      focusedContext: !checkpoint.context?.pinned?.length && !checkpoint.context?.timeline?.length,
      control: checkpoint.control ? controlReceiptSchema.parse(checkpoint.control) : null,
      maintenance: checkpoint.maintenance.map((cycle) => ({
        phases: cycle.phases.map((phase) => phaseReceiptSchema.parse(phase)),
        observations: cycle.observations.length,
        rejected: cycle.rejected.length,
        applied: cycle.maintenancePlans
          .flatMap((plan) => plan.items)
          .filter((item) => item.status === 'applied').length,
        held: cycle.maintenancePlans.flatMap((plan) => plan.items).filter((item) => item.status === 'held')
          .length,
        itemOutcomes: cycle.maintenancePlans
          .flatMap((plan) => plan.items)
          .map((item) => itemReceiptSchema.parse(item)),
      })),
    };
  });
  const groups = ['extract-only', 'maintained'].map((arm) => {
    const checkpoints = rows.filter((row) => row.arm === arm);
    const coverage = Object.fromEntries(
      stages.map((stage) => {
        const measurements = checkpoints.flatMap((row) =>
          row.stages.filter((entry) => entry.stage === stage),
        );
        const covered = measurements.reduce((sum, row) => sum + row.useful.covered, 0),
          required = measurements.reduce((sum, row) => sum + row.useful.required, 0);
        return [stage, { covered, required, fraction: required ? covered / required : null }];
      }),
    );
    const semantic = checkpoints.flatMap((row) =>
      row.stages.flatMap((stage) => stage.errors.filter((error) => error.code !== 'duplicate')),
    );
    const gate = {
      zeroSemanticErrors: semantic.length === 0,
      sourceIntegrity: checkpoints.every((row) => row.sourceBytesUnchanged),
      replayStable: checkpoints
        .filter((row) => row.step.startsWith('unchanged'))
        .every((row) =>
          row.stages.every((stage) => !stage.errors.some((error) => error.code === 'duplicate')),
        ),
      usefulCoverage: Object.values(coverage).every(
        (value) => value.fraction !== null && value.fraction >= LIFECYCLE_GATES.usefulCoverage,
      ),
      focusedContext: checkpoints.every((row) => row.focusedContext),
      operationsAvailable: checkpoints.every(
        (row) =>
          row.operations.every((operation) => !operation.failed) &&
          row.stages.every((stage) => stage.outcome !== 'unavailable'),
      ),
    };
    return {
      arm,
      coverage,
      semanticIncidences: {
        natural: semantic.filter((error) => error.origin === 'natural').length,
        seeded: semantic.filter((error) => error.origin === 'seeded').length,
      },
      falseHolds: checkpoints.flatMap((row) => row.stages).filter((stage) => stage.outcome === 'false_hold')
        .length,
      unavailable: checkpoints.flatMap((row) => row.stages).filter((stage) => stage.outcome === 'unavailable')
        .length,
      gates: gate,
      passed: Object.values(gate).every(Boolean),
    };
  });
  return {
    version: 'lifecycle-report-v1',
    corpusFingerprint: packet.corpusFingerprint,
    inputReviewFingerprint: packet.inputReviewFingerprint,
    packetFingerprint: hash(packet),
    split: packet.split,
    runs: packet.runs,
    reviewer: review.reviewer,
    contract,
    gates: LIFECYCLE_GATES,
    groups,
    checkpoints: rows,
  };
}
