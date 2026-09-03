import { z } from 'zod';
import {
  Card,
  MemoryView,
  PageRole,
  RecallMode,
  RecallQualification,
  RecallResult,
  ResultEnvelope,
  SlugFilter,
} from '../common.ts';
import { TimelineResult } from './timeline.ts';

export const ContextProfile = z.enum(['default', 'auto_recall']);
export type ContextProfile = z.infer<typeof ContextProfile>;

export const ConversationTurn = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});
export type ConversationTurn = z.infer<typeof ConversationTurn>;

/**
 * One budget, one assembly. `context` composes the whole pre-turn bundle —
 * pinned pages, recent timeline, structure tree, and this turn's recall —
 * against a single budget. Separate injections with separate budgets overrun
 * together. Normally called by the host, not by the agent.
 */
export const ContextInput = z
  .object({
    query: z.string().min(1).optional(),
    /** `auto_recall` is a conservative evidence-only host injection, not an answer operation. */
    profile: ContextProfile.optional(),
    /** Bounded recent turns used only to resolve a local reference or omitted subject in `query`. */
    conversation_context: z.array(ConversationTurn).max(6).optional(),
    /** Defaults to 20,000 for the broad profile and 1,200 for auto-recall. */
    budget: z.number().int().positive().optional(),
    /** Slugs always included, before anything else competes for room. Ignored by auto-recall. */
    pinned: z.array(z.string()).optional(),
    /** Days of ledger to include. 0 omits the section. Ignored by auto-recall. */
    timeline_days: z.number().int().nonnegative().optional(),
    /** Include a folder outline so the agent knows what exists. Ignored by auto-recall. */
    structure: z.boolean().optional(),
    mode: RecallMode.optional(),
    /** Override retained-memory intent for query-backed context. */
    memory_view: MemoryView.optional(),
    include: z.array(PageRole).optional(),
    filter: SlugFilter.optional(),
  })
  .superRefine((input, check) => {
    if (input.profile === 'auto_recall' && !input.query) {
      check.addIssue({
        code: 'custom',
        path: ['query'],
        message: 'query is required for the auto_recall context profile',
      });
    }
    const conversationChars = (input.conversation_context ?? []).reduce(
      (total, turn) => total + turn.content.length,
      0,
    );
    if (conversationChars > 6000) {
      check.addIssue({
        code: 'custom',
        path: ['conversation_context'],
        message: 'recent conversation context must not exceed 6000 characters',
      });
    }
  });
export type ContextInput = z.infer<typeof ContextInput>;

export const AutoRecallActivation = z.object({
  activated: z.boolean(),
  basis: z.enum(['exact', 'semantic', 'qualified', 'none']),
  candidates: z.number().int().nonnegative(),
  selected: z.number().int().nonnegative(),
  qualification_run: z.boolean(),
  /** Whether bounded recent conversation was needed and could identify one candidate subject. */
  reference_resolution: z.enum(['not_needed', 'resolved', 'ambiguous', 'unresolved']).default('not_needed'),
});
export type AutoRecallActivation = z.infer<typeof AutoRecallActivation>;

export const ContextOutput = ResultEnvelope.extend({
  profile: ContextProfile.optional(),
  /** Content-free receipt for the precision-first auto-recall activation decision. */
  activation: AutoRecallActivation.optional(),
  pinned: z.array(Card),
  /** Mixed page/document results for this turn's recall. */
  results: z.array(RecallResult),
  /** Recent authored events and typed orphan-document date evidence. */
  timeline: z.array(TimelineResult),
  structure: z.string().optional(),
  searched: z.array(z.string()),
  /** Present when a query-backed recall path selected a retained-memory view. */
  memory_view: MemoryView.optional(),
  coverage: z.record(z.string(), z.boolean()).optional(),
  qualification: RecallQualification.optional(),
  budget_used: z.number().int().nonnegative(),
  /** What was dropped to fit, and how much of it. A silent trim reads as
   *  "that's everything" when it wasn't — default to visible. */
  dropped: z
    .object({
      pinned: z.number().int().nonnegative(),
      results: z.number().int().nonnegative(),
      timeline: z.number().int().nonnegative(),
    })
    .optional(),
});
export type ContextOutput = z.infer<typeof ContextOutput>;
