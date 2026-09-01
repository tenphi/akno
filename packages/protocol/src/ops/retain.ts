import { z } from 'zod';
import { DegradedReason, IanaTimezone, ResultEnvelope, RetainedTime } from '../common.ts';

const RetainRef = z.string().min(1).max(300);

export const RetainSourceRole = z.enum(['user', 'assistant', 'external', 'unknown']);
export type RetainSourceRole = z.infer<typeof RetainSourceRole>;

export const RetainSourceSpan = z.object({
  quote: z.string().min(1).max(1200),
  item_id: z.string().min(1).max(200).optional(),
});
export type RetainSourceSpan = z.infer<typeof RetainSourceSpan>;

export const RetainEvidenceRef = z.union([
  z.object({ fact_id: RetainRef }),
  z.object({ page_slug: RetainRef, line_hash: RetainRef }),
  z.object({ document_id: RetainRef, passage_id: RetainRef }),
  z.object({ journal_event_id: RetainRef }),
]);
export type RetainEvidenceRef = z.infer<typeof RetainEvidenceRef>;

export const RetainedRelation = z.object({
  type: z.enum(['corrects', 'supersedes', 'contradicts', 'fulfills', 'answers', 'caused_by']),
  target: z.union([
    z.object({ candidate_id: RetainRef }),
    z.object({ memory_id: RetainRef }),
    z.object({ fact_id: RetainRef }),
  ]),
  support: z.array(RetainSourceSpan).min(1).max(8),
});
export type RetainedRelation = z.infer<typeof RetainedRelation>;

export const ProvidedRetainCandidate = z
  .object({
    candidate_id: z.string().min(1).max(200),
    kind: z.enum(['claim', 'decision', 'preference', 'plan', 'event', 'question']),
    text: z.string().min(1).max(800),
    subject: z.string().min(1).max(200),
    subject_ref: z.object({ entity_id: RetainRef }).optional(),
    attribution: z.object({
      source_role: RetainSourceRole,
      source_speaker: z.string().min(1).max(200).optional(),
      chain: z
        .array(
          z.object({
            speaker: z.string().min(1).max(200),
            role: RetainSourceRole.optional(),
          }),
        )
        .max(3)
        .optional(),
    }),
    discourse: z.object({
      commitment: z.enum(['asserted', 'tentative', 'hypothetical', 'counterfactual', 'none']),
      disposition: z.enum([
        'active',
        'proposed',
        'accepted',
        'rejected',
        'resolved',
        'cancelled',
        'completed',
        'superseded',
      ]),
    }),
    epistemic: z.object({
      basis: z.enum(['self_attested', 'source_report', 'cited_evidence']),
      evidence: z.array(RetainEvidenceRef).max(8).optional(),
    }),
    polarity: z.enum(['affirmed', 'negated']).optional(),
    support: z.array(RetainSourceSpan).min(1).max(8),
    discourse_frame: z.array(RetainSourceSpan).min(1).max(16),
    relations: z.array(RetainedRelation).max(8).optional(),
    time: RetainedTime.optional(),
    /**
     * Required by `provided + exact`; optional as a bounded taxonomy suggestion for automatic
     * placement. Extraction never grants this suggestion write authority.
     */
    destination: z
      .object({ slug: z.string().min(1), section: z.string().min(1).max(100).optional() })
      .optional(),
  })
  .superRefine((candidate, ctx) => {
    const allowed: Record<typeof candidate.kind, readonly (typeof candidate.discourse.disposition)[]> = {
      claim: ['active', 'superseded'],
      preference: ['active', 'superseded'],
      decision: ['accepted', 'rejected', 'superseded'],
      plan: ['proposed', 'accepted', 'cancelled', 'completed', 'superseded'],
      event: ['active', 'cancelled', 'superseded'],
      question: ['active', 'resolved'],
    };
    if (!allowed[candidate.kind].includes(candidate.discourse.disposition)) {
      ctx.addIssue({
        code: 'custom',
        path: ['discourse', 'disposition'],
        message: `${candidate.discourse.disposition} is not valid for ${candidate.kind}`,
      });
    }
    if (candidate.kind === 'question' && candidate.discourse.commitment !== 'none') {
      ctx.addIssue({
        code: 'custom',
        path: ['discourse', 'commitment'],
        message: 'a question requires commitment none',
      });
    }
    if (candidate.epistemic.basis === 'cited_evidence' && !candidate.epistemic.evidence?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['epistemic', 'evidence'],
        message: 'cited_evidence requires at least one durable evidence reference',
      });
    }
    if (candidate.epistemic.basis === 'self_attested' && candidate.attribution.source_role !== 'user') {
      ctx.addIssue({
        code: 'custom',
        path: ['epistemic', 'basis'],
        message: 'self_attested is limited to the user source role',
      });
    }
  });
export type ProvidedRetainCandidate = z.infer<typeof ProvidedRetainCandidate>;

export const RetainSourceItem = z.object({
  item_id: z.string().min(1).max(200),
  text: z.string().min(1).max(100_000),
  role: z.enum(['user', 'assistant', 'external', 'system']).optional(),
  speaker: z.string().min(1).max(200).optional(),
  mentioned_at: z.string().datetime({ offset: true }).optional(),
});
export type RetainSourceItem = z.infer<typeof RetainSourceItem>;

const RetainSourceIdentity = {
  source_id: z.string().min(1).max(300),
  revision: z.string().min(1).max(200),
} as const;

export const RetainUpsertSource = z
  .object({
    ...RetainSourceIdentity,
    source_group: z.string().min(1).max(300).optional(),
    source_kind: z.enum(['conversation', 'email', 'article', 'document', 'note', 'other']).optional(),
    mentioned_at: z.string().datetime({ offset: true }).optional(),
    timezone: IanaTimezone.optional(),
    locator: z.string().min(1).max(1000).optional(),
    input: z.union([
      z.object({ text: z.string().min(1).max(500_000) }),
      z.object({ items: z.array(RetainSourceItem).min(1).max(500) }),
    ]),
    retention: z.union([
      z.object({
        mode: z.literal('provided'),
        placement: z.enum(['exact', 'automatic']),
        candidates: z.array(ProvidedRetainCandidate).min(1).max(50),
      }),
      z.object({
        mode: z.literal('extract'),
        /** Additive source-specific emphasis; it never replaces the fixed retention policy. */
        mission: z.string().max(2000).optional(),
      }),
    ]),
  })
  .superRefine((source, ctx) => {
    if (source.retention.mode === 'provided') {
      const candidateIds = source.retention.candidates.map((candidate) => candidate.candidate_id);
      if (new Set(candidateIds).size !== candidateIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['retention', 'candidates'],
          message: 'candidate ids must be unique within one source revision',
        });
      }
      if (
        source.retention.placement === 'exact' &&
        source.retention.candidates.some((candidate) => candidate.destination === undefined)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['retention', 'candidates'],
          message: 'provided exact candidates require a destination',
        });
      }
    }
    if ('items' in source.input) {
      const itemIds = source.input.items.map((item) => item.item_id);
      if (new Set(itemIds).size !== itemIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['input', 'items'],
          message: 'source item ids must be unique within one source revision',
        });
      }
    }
  });
export type RetainUpsertSource = z.infer<typeof RetainUpsertSource>;

export const RetainRetraction = z.object({
  ...RetainSourceIdentity,
  retention: z.object({
    mode: z.literal('retract'),
    target_revision: z.string().min(1).max(200),
    candidate_ids: z.array(z.string().min(1).max(200)).min(1).max(50).optional(),
    reason: z.enum(['source_corrected', 'source_deleted', 'user_request']),
  }),
});
export type RetainRetraction = z.infer<typeof RetainRetraction>;

export const RetainInput = z.object({
  sources: z
    .array(z.union([RetainUpsertSource, RetainRetraction]))
    .min(1)
    .max(20),
  dry_run: z.boolean().optional(),
});
export type RetainInput = z.infer<typeof RetainInput>;

export const RetainHoldReason = z.enum([
  'source_unavailable',
  'discourse_uncertain',
  'context_too_large',
  'time_unresolved',
  'noncanonical_without_context',
  'no_writable_destination',
  'routing_uncertain',
  'conflict',
  'support_limit',
  'placement_degraded',
  'apply_failed',
  'validation_failed',
]);
export type RetainHoldReason = z.infer<typeof RetainHoldReason>;

/** Content-free receipt for one automatic-retention model request. */
export const RetainModelCallReceipt = z.object({
  model: z.string(),
  latency_ms: z.number().nonnegative(),
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  total_tokens: z.number().int().nonnegative().nullable(),
});
export type RetainModelCallReceipt = z.infer<typeof RetainModelCallReceipt>;

export const RetainCandidateResult = z.object({
  candidate_id: z.string(),
  outcome: z.enum(['written', 'duplicate', 'support_added', 'retracted', 'held', 'not_found']),
  memory_id: z.string().optional(),
  slug: z.string().optional(),
  reason_code: RetainHoldReason.optional(),
  reason: z.string().optional(),
});
export type RetainCandidateResult = z.infer<typeof RetainCandidateResult>;

export const RetainSourceResult = z.object({
  source_id: z.string(),
  revision: z.string(),
  outcome: z.enum(['ok', 'replayed', 'noop', 'held', 'revision_conflict']),
  change_id: z.string().optional(),
  candidates: z.array(RetainCandidateResult),
  /** Source-level hold when no safe candidate boundary exists yet. */
  reason_code: RetainHoldReason.optional(),
  status: z.enum(['ok', 'empty', 'degraded', 'unavailable']).optional(),
  degraded: z.array(DegradedReason).optional(),
  model_usage: z
    .object({
      extraction: RetainModelCallReceipt.nullable(),
      verification: RetainModelCallReceipt.nullable(),
      placement: z.array(RetainModelCallReceipt),
    })
    .optional(),
  note: z.string().optional(),
});
export type RetainSourceResult = z.infer<typeof RetainSourceResult>;

export const RetainOutput = ResultEnvelope.extend({
  outcome: z.enum(['ok', 'partial', 'noop']),
  sources: z.array(RetainSourceResult),
});
export type RetainOutput = z.infer<typeof RetainOutput>;
