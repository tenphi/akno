import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  LIFECYCLE_CORPUS,
  LIFECYCLE_CORPUS_VERSION,
  LIFECYCLE_GATES,
  type LifecycleEpisode,
} from './longitudinal-lifecycle-corpus.ts';

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
    stage: z.string().regex(/^[a-z0-9:-]+$/),
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
    maxHighRiskItems: z.literal(0),
    facts: z.literal('inference_only'),
    summaries: z.literal(false),
    expansion: z.literal(false),
    reranker: z.literal(false),
    clock: z.literal('fixture_process_Date_fixed_source_clock_explicit_when_available'),
    seed: z.null(),
    cost: z.null(),
    models: z.object({ derive: modelSchema, answer: modelSchema, embedding: modelSchema }).strict(),
    artifacts: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  })
  .strict();

interface Checkpoint {
  key: string;
  episode: string;
  arm: string;
  run: number;
  step: string;
  seeded: boolean;
  pages: { lines?: unknown[] }[];
  recall: { status: string; results?: unknown[] } | null;
  context: { status: string; results?: unknown[]; pinned?: unknown[]; timeline?: unknown[] } | null;
  answer: { status: string; answer: string | null; reason_code?: string } | null;
  before: { observations: { id: string; eligible: number }[]; supports: unknown[] };
  after: {
    observations: { id: string; eligible: number }[];
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
  if (
    packet.version !== LIFECYCLE_CORPUS_VERSION ||
    packet.corpusFingerprint !== hash(LIFECYCLE_CORPUS) ||
    review.packetFingerprint !== hash(packet)
  )
    throw new Error('Stale corpus or packet fingerprint.');
  if (
    !['development', 'held-out'].includes(packet.split) ||
    !Number.isInteger(packet.runs) ||
    packet.runs < 1 ||
    packet.runs > 5
  )
    throw new Error('Invalid split/repeats.');
  const contract = contractSchema.parse(packet.contract);
  const episodes = LIFECYCLE_CORPUS.filter((episode) => episode.split === packet.split);
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
  const seenErrors = new Set<string>();
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
      if (!output && judgment.covered.some((id) => positive.has(id)))
        throw new Error('Positive coverage needs output.');
      if (stage === 'answer' && !output && judgment.errors.length)
        throw new Error('A withheld answer cannot promote an error.');
      const errors = judgment.errors.map((error) => {
        const identity = `${checkpoint.episode}/${checkpoint.arm}/${checkpoint.run}/${stage}/${error.id}`;
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
      replayInventoryGrowth: replay
        ? Math.max(0, checkpoint.after.supports.length - checkpoint.before.supports.length) +
          Math.max(0, checkpoint.after.observations.length - checkpoint.before.observations.length)
        : null,
      focusedContext: !checkpoint.context?.pinned?.length && !checkpoint.context?.timeline?.length,
      control: checkpoint.control
        ? { status: checkpoint.control.status, seeded: checkpoint.control.seeded }
        : null,
      maintenance: checkpoint.maintenance.map((cycle) => ({
        phases: cycle.phases.map((phase) => ({ phase: phase.phase, ran: phase.ran })),
        observations: cycle.observations.length,
        rejected: cycle.rejected.length,
        applied: cycle.maintenancePlans
          .flatMap((plan) => plan.items)
          .filter((item) => item.status === 'applied').length,
        held: cycle.maintenancePlans.flatMap((plan) => plan.items).filter((item) => item.status === 'held')
          .length,
        itemOutcomes: cycle.maintenancePlans
          .flatMap((plan) => plan.items)
          .map((item) => ({ kind: item.kind, status: item.status, statusCode: item.statusCode })),
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
      operationsAvailable: checkpoints.every((row) => row.operations.every((operation) => !operation.failed)),
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
