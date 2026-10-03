import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AnswerReason, DegradedReason } from '@tenphi/akno-protocol';
import { LONGITUDINAL_CORPUS, LONGITUDINAL_GATES, LONGITUDINAL_VERSION } from './longitudinal-corpus.ts';

export const longitudinalFingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stages = ['memory', 'timeline', 'recall', 'context', 'answer'] as const;
const IssueCode = z.enum([
  'unsupported_promotion',
  'qualification_loss',
  'false_corroboration',
  'stale_use',
  'duplicate',
  'wrong_identity',
  'source_mutation',
  'missing_context',
  'representation',
  'retrieval',
  'model_interpretation',
  'lifecycle',
  'unknown',
]);
const StageReview = z.strictObject({
  covered: z.array(z.string()),
  errors: z.array(IssueCode),
  // A natural error can persist into a seeded checkpoint. Origin belongs to the
  // reviewed error, rather than to the operation that happened at this checkpoint.
  seededErrors: z.array(IssueCode).default([]),
  abstention: z.enum(['none', 'justified', 'unjustified', 'unavailable', 'not_measured']),
});
const Review = z.strictObject({
  version: z.literal('longitudinal-review-v1'),
  packetFingerprint: z.string(),
  reviewer: z.strictObject({
    kind: z.enum(['human', 'agent']),
    id: z.string().min(1),
    sourceBased: z.literal(true),
    independent: z.boolean(),
  }),
  checkpoints: z.array(
    z.strictObject({
      key: z.string(),
      stages: z.strictObject({
        memory: StageReview,
        timeline: StageReview,
        recall: StageReview,
        context: StageReview,
        answer: StageReview,
      }),
    }),
  ),
});

const Operation = z.object({
  stage: z.enum([
    'drain-and-reopen',
    'index-ready',
    'index-setup',
    'index-source',
    'replay-reordered',
    'provided-seeded-contamination',
    'restart',
    'rebuild',
    'dream:1',
    'dream:2',
    'dream:3',
    'read',
    'timeline',
    'recall',
    'context',
    'answer',
    'retain:notice',
    'retain:speculation',
    'retain:copy',
    'retain:assistant-summary',
    'retain:alternative',
    'retain:distinct',
    'retain:update',
    'retain:seed',
    'retract:alternative',
    'retract:copy',
    'retract:assistant-summary',
    'retract:seed',
  ]),
  latencyMs: z.number().nonnegative(),
  failed: z.boolean(),
  calls: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  inputTokens: z.number().nonnegative().nullable(),
  outputTokens: z.number().nonnegative().nullable(),
  totalTokens: z.number().nonnegative().nullable(),
  callsWithoutUsage: z.number().int().nonnegative(),
  backgroundCalls: z.number().int().nonnegative(),
  modelLatencyMs: z.number().nonnegative(),
});
const Checkpoint = z.object({
  key: z.string(),
  episode: z.string(),
  arm: z.enum(['extract-only', 'maintained']),
  run: z.number().int().positive(),
  step: z.string(),
  memory: z.array(
    z.object({ text: z.string(), memory: z.unknown().optional(), observation: z.unknown().optional() }),
  ),
  timeline: z.object({
    results: z.array(z.unknown()),
    status: z.enum(['ok', 'empty', 'degraded', 'unavailable']),
    degraded: z.array(DegradedReason).optional(),
  }),
  recall: z.object({
    results: z.array(z.unknown()),
    status: z.enum(['ok', 'empty', 'degraded', 'unavailable']),
    degraded: z.array(DegradedReason).optional(),
  }),
  context: z.object({
    results: z.array(z.unknown()),
    status: z.enum(['ok', 'empty', 'degraded', 'unavailable']),
    pinned: z.array(z.unknown()),
    timeline: z.array(z.unknown()),
    degraded: z.array(DegradedReason).optional(),
  }),
  answer: z
    .object({
      answer: z.string().min(1).nullable(),
      outcome: z.enum(['complete', 'partial', 'not_found', 'not_answered', 'unavailable']),
      status: z.enum(['ok', 'empty', 'degraded', 'unavailable']),
      reason_code: AnswerReason.optional(),
      degraded: z.array(DegradedReason).optional(),
    })
    .nullable(),
  operations: z.array(Operation),
  inventory: z.object({
    memories: z.number().int().nonnegative(),
    activeSupports: z.number().int().nonnegative(),
    proofGroups: z.number().int().nonnegative(),
    observations: z.number().int().nonnegative(),
    validSupportHashes: z.boolean(),
    sourceBytesUnchanged: z.boolean(),
    replayStable: z.boolean().nullable(),
    cachedMaintenanceCalls: z.number().int().nonnegative().nullable(),
  }),
  maintenance: z.array(
    z.object({
      phases: z.array(
        z.object({
          phase: z.enum(['conflicts', 'observe', 'reflect', 'curate', 'adopt', 'repair', 'housekeeping']),
          ran: z.boolean(),
        }),
      ),
      observations: z.number().int().nonnegative(),
      curated: z.number().int().nonnegative(),
      applied: z.number().int().nonnegative(),
      held: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      durationMs: z.number().nonnegative(),
    }),
  ),
});
const RuntimeContract = z.strictObject({
  runtime: z.literal('built-core-socket-built-client'),
  policies: z.literal('timeline_history_observe_reflect_auto_other_off'),
  indexFacts: z.literal(false),
  indexSummaries: z.literal(false),
  expansion: z.literal(false),
  reranker: z.literal(false),
  maintenanceCyclesPerCheckpoint: z.literal(3),
  maxSourcePagesPerCycle: z.literal(3),
  maxTimelineItemsPerCycle: z.literal(6),
  retrievalBudget: z.literal(6000),
  answerOutputTokens: z.literal(2400),
  sourceLanguage: z.literal('en'),
  knowledgeLanguage: z.literal('en'),
  measurement: z.literal('socket-scoped-drained-index-v2'),
  seeds: z.null(),
  cost: z.null(),
  modelSubstitution: z.null(),
  sourceClock: z.literal('explicit_mentioned_at'),
  worldClock: z.literal('timeline_as_of_only'),
  prompts: z.strictObject({
    extraction: z.string(),
    verifier: z.string(),
    answer: z.string(),
    answerVerifier: z.string(),
  }),
  models: z.strictObject(
    Object.fromEntries(
      ['derive', 'answer', 'embedding'].map((role) => [
        role,
        z.strictObject({
          id: z.string().nullable(),
          providerFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          enabled: z.boolean(),
          timeoutMs: z.number().nonnegative(),
          maxOutputTokens: z.number().nonnegative().optional(),
          reasoningEffort: z.string().nullable().optional(),
          dimensions: z.number().nullable().optional(),
          maxRetries: z.number().nonnegative().optional(),
        }),
      ]),
    ) as unknown as Record<'derive' | 'answer' | 'embedding', z.ZodType>,
  ),
  artifacts: z.record(
    z.enum([
      'core/dist/write/retain.js',
      'core/dist/maintenance/timeline-sources.js',
      'core/dist/maintenance/timeline-assertions.js',
      'core/dist/open.js',
      'cli/dist/serve/socket.js',
      'client/dist/index.js',
    ]),
    z.string().regex(/^[a-f0-9]{64}$/),
  ),
});
const Packet = z.object({
  version: z.literal('longitudinal-packet-v2'),
  corpusFingerprint: z.string(),
  inputReviewFingerprint: z.string(),
  split: z.enum(['development', 'held-out']),
  runs: z.number().int().min(1).max(5),
  contract: RuntimeContract,
  checkpoints: z.array(Checkpoint),
});

export function longitudinalInputReview() {
  return {
    version: 'longitudinal-input-review-v1',
    corpusFingerprint: longitudinalFingerprint(LONGITUDINAL_CORPUS),
    reviewer: {
      kind: 'agent',
      id: 'Codex',
      independent: false,
      sourceBased: true,
      reviewedWithoutOutputs: true,
    },
    gates: LONGITUDINAL_GATES,
    measurement: 'socket-scoped-drained-index-v2',
    limitations: [
      'corpus_author_review_is_not_independent',
      'timeline_slice_not_full_issue_66',
      'no_model_substitution',
      'no_observation_reflection_positive_control',
      'one_episode_per_track_per_split',
    ],
  };
}

/** A report cannot acquire a pass from runtime verifier agreement or an incomplete review. */
export function adjudicateLongitudinal(rawPacket: unknown, rawReview: unknown) {
  const packet = Packet.parse(rawPacket);
  const review = Review.parse(rawReview);
  if (
    packet.corpusFingerprint !== longitudinalFingerprint(LONGITUDINAL_CORPUS) ||
    packet.inputReviewFingerprint !== longitudinalFingerprint(longitudinalInputReview())
  )
    throw new Error('stale input contract');
  if (review.packetFingerprint !== longitudinalFingerprint(rawPacket)) throw new Error('stale output review');
  const expectedEpisodes = LONGITUDINAL_CORPUS.filter((episode) => episode.split === packet.split);
  const keys = expectedEpisodes.flatMap((episode) =>
    ['extract-only', 'maintained'].flatMap((arm) =>
      Array.from({ length: packet.runs }, (_, run) =>
        episode.steps.map((step) => `${episode.id}/${arm}/${run + 1}/${step.id}`),
      ).flat(),
    ),
  );
  exact(
    packet.checkpoints.map((checkpoint) => checkpoint.key),
    keys,
  );
  exact(
    review.checkpoints.map((checkpoint) => checkpoint.key),
    keys,
  );
  const rows = packet.checkpoints.map((checkpoint) => {
    const episode = expectedEpisodes.find((entry) => entry.id === checkpoint.episode);
    const step = episode?.steps.find((entry) => entry.id === checkpoint.step);
    if (!step || checkpoint.key !== `${episode!.id}/${checkpoint.arm}/${checkpoint.run}/${step.id}`)
      throw new Error('altered checkpoint dimensions');
    const judged = review.checkpoints.find((entry) => entry.key === checkpoint.key)!;
    const required = step.expected
      .filter((proposition) => proposition.required)
      .map((proposition) => proposition.id);
    const stageRows = stages.map((stage) => {
      const judgment = judged.stages[stage];
      for (const code of judgment.seededErrors)
        if (
          judgment.seededErrors.filter((value) => value === code).length >
          judgment.errors.filter((value) => value === code).length
        )
          throw new Error('seed origin without reviewed error');
      const measured = stage !== 'answer' || step.answer;
      const stageRequired =
        stage === 'timeline'
          ? required.filter((id) => id !== 'warranty-corrected')
          : stage === 'answer'
            ? required.filter((id) => id !== 'distinct-appointment')
            : required;
      if (stage === 'answer' && measured && checkpoint.answer === null)
        throw new Error('missing measured answer outcome');
      if (
        !measured &&
        (judgment.covered.length || judgment.errors.length || judgment.abstention !== 'not_measured')
      )
        throw new Error('unmeasured answer graded');
      if (measured && judgment.abstention === 'not_measured') throw new Error('measured stage omitted');
      if (
        new Set(judgment.covered).size !== judgment.covered.length ||
        judgment.covered.some((id) => !step.expected.some((proposition) => proposition.id === id))
      )
        throw new Error('invalid reviewed coverage');
      const evidencePresent =
        stage === 'memory'
          ? checkpoint.memory.length > 0
          : stage === 'answer'
            ? checkpoint.answer?.answer != null
            : checkpoint[stage].results.length > 0;
      if (judgment.covered.length && judgment.abstention !== 'none')
        throw new Error('covered evidence cannot be an abstention');
      if (judgment.covered.length && !evidencePresent) throw new Error('coverage without output');
      if (stage === 'answer' && checkpoint.answer?.answer == null && judgment.errors.length)
        throw new Error('absent answer cannot promote an error');
      const available =
        stage === 'memory' ||
        (stage === 'answer'
          ? checkpoint.answer?.status !== 'unavailable' &&
            ![
              'evidence_unavailable',
              'generation_unavailable',
              'generation_failed',
              'verification_unavailable',
            ].includes(checkpoint.answer?.reason_code ?? '')
          : checkpoint[stage].status !== 'unavailable');
      if (!available && judgment.covered.length) throw new Error('unavailable stage cannot supply coverage');
      if (!available && judgment.abstention !== 'unavailable')
        throw new Error('availability collapsed into abstention');
      return {
        stage,
        measured,
        requiredIds: measured ? stageRequired : [],
        coveredIds: judgment.covered,
        required: measured ? stageRequired.length : 0,
        covered: measured ? judgment.covered.filter((id) => stageRequired.includes(id)).length : 0,
        errors: judgment.errors,
        seededErrors: judgment.seededErrors,
        abstention: judgment.abstention,
      };
    });
    return {
      key: checkpoint.key,
      episode: checkpoint.episode,
      arm: checkpoint.arm,
      run: checkpoint.run,
      step: checkpoint.step,
      seeded: step.action === 'seed',
      stages: stageRows,
      inventory: checkpoint.inventory,
      operations: checkpoint.operations,
      maintenance: checkpoint.maintenance,
      availability: Object.fromEntries(
        ['timeline', 'recall', 'context'].map((stage) => {
          const result = checkpoint[stage as 'timeline' | 'recall' | 'context'];
          return [stage, { status: result.status, degraded: result.degraded ?? [] }];
        }),
      ),
      answer: checkpoint.answer
        ? {
            outcome: checkpoint.answer.outcome,
            status: checkpoint.answer.status,
            reason: checkpoint.answer.reason_code ?? null,
            degraded: checkpoint.answer.degraded ?? [],
          }
        : null,
      focusedContext: checkpoint.context.pinned.length === 0 && checkpoint.context.timeline.length === 0,
    };
  });
  const groups = ['extract-only', 'maintained'].map((arm) => {
    const selected = rows.filter((row) => row.arm === arm);
    const coverage = Object.fromEntries(
      stages.map((stage) => {
        const judgments = selected.flatMap((row) =>
          row.stages.filter((value) => value.stage === stage && value.measured),
        );
        const denominator = judgments.reduce((sum, value) => sum + value.required, 0);
        const numerator = judgments.reduce((sum, value) => sum + value.covered, 0);
        return [
          stage,
          {
            numerator,
            denominator,
            fraction: denominator ? numerator / denominator : null,
            unjustifiedAbstentions: judgments.filter((value) => value.abstention === 'unjustified').length,
          },
        ];
      }),
    ) as Record<
      (typeof stages)[number],
      { numerator: number; denominator: number; fraction: number | null; unjustifiedAbstentions: number }
    >;
    const semanticErrors = selected
      .flatMap((row) => row.stages.flatMap((stage) => stage.errors))
      .filter((code) =>
        [
          'unsupported_promotion',
          'qualification_loss',
          'false_corroboration',
          'stale_use',
          'wrong_identity',
        ].includes(code),
      ).length;
    const seededErrors = selected
      .flatMap((row) => row.stages.flatMap((stage) => stage.seededErrors))
      .filter((code) =>
        [
          'unsupported_promotion',
          'qualification_loss',
          'false_corroboration',
          'stale_use',
          'wrong_identity',
        ].includes(code),
      ).length;
    const sourceMutations = selected.filter((row) => !row.inventory.sourceBytesUnchanged).length;
    const replayFailures = selected.filter((row) => row.inventory.replayStable === false).length;
    const gates = {
      zeroAcceptedSemanticErrors: semanticErrors === 0,
      zeroReviewedSourceMutations: selected.every((row) =>
        row.stages.every((stage) => !stage.errors.includes('source_mutation')),
      ),
      operationsAvailable: selected.every((row) => row.operations.every((operation) => !operation.failed)),
      sourceIntegrity: sourceMutations === 0 && selected.every((row) => row.inventory.validSupportHashes),
      replayStable: replayFailures === 0,
      usefulMemory: (coverage.memory.fraction ?? 0) >= LONGITUDINAL_GATES.usefulMemoryCoverage,
      usefulRecall: (coverage.recall.fraction ?? 0) >= LONGITUDINAL_GATES.usefulRecallCoverage,
      usefulContext: (coverage.context.fraction ?? 0) >= LONGITUDINAL_GATES.usefulContextCoverage,
      usefulAnswer: (coverage.answer.fraction ?? 0) >= LONGITUDINAL_GATES.usefulAnswerCoverage,
      focusedContext: selected.every((row) => row.focusedContext),
    };
    return {
      arm,
      checkpoints: selected.length,
      perRunCoverage: [...new Set(selected.map((row) => row.run))].map((run) => ({
        run,
        stages: Object.fromEntries(
          stages.map((stage) => {
            const measured = selected
              .filter((row) => row.run === run)
              .flatMap((row) => row.stages.filter((value) => value.stage === stage && value.measured));
            const denominator = measured.reduce((sum, value) => sum + value.required, 0);
            return [
              stage,
              denominator ? measured.reduce((sum, value) => sum + value.covered, 0) / denominator : null,
            ];
          }),
        ),
      })),
      coverage,
      semanticErrors,
      naturalErrors: semanticErrors - seededErrors,
      seededErrors,
      sourceMutations,
      replayFailures,
      gates,
      passed: Object.values(gates).every(Boolean),
    };
  });
  return {
    version: 'longitudinal-report-v2',
    corpusVersion: LONGITUDINAL_VERSION,
    corpusFingerprint: packet.corpusFingerprint,
    inputReviewFingerprint: packet.inputReviewFingerprint,
    packetFingerprint: review.packetFingerprint,
    split: packet.split,
    runs: packet.runs,
    contract: {
      ...packet.contract,
      sourceClockScope: 'retention_only_folder_uses_absolute_dates',
      observationReflectionPositiveControl: false,
      indexReadiness: 'drain_reopen_normal_index_before_probes',
      modelAccounting: 'server_scoped_logical_calls_with_background_receipts_after_drain',
    },
    reviewer: review.reviewer,
    gates: LONGITUDINAL_GATES,
    limitations: longitudinalInputReview().limitations,
    groups,
    checkpoints: rows,
  };
}

function exact(actual: string[], expected: string[]) {
  if (
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    actual.some((key) => !expected.includes(key))
  )
    throw new Error('missing, duplicate or unexpected coordinates');
}
