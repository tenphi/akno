import { z } from 'zod';
import { Card, RecallMode, RecallResult, ResultEnvelope } from '../common.ts';
import { Event, TimelineResult } from './timeline.ts';

/**
 * One budget, one assembly. `context` composes the whole pre-turn bundle —
 * pinned pages, recent timeline, structure tree, and this turn's recall —
 * against a single budget. Separate injections with separate budgets overrun
 * together. Normally called by the host, not by the agent.
 */
export const ContextInput = z.object({
  query: z.string().optional(),
  budget: z.number().int().positive(),
  /** Slugs always included, before anything else competes for room. */
  pinned: z.array(z.string()).optional(),
  /** Days of ledger to include. 0 omits the section. */
  timeline_days: z.number().int().nonnegative().optional(),
  /** Include a folder outline so the agent knows what exists. */
  structure: z.boolean().optional(),
  mode: RecallMode.optional(),
});
export type ContextInput = z.infer<typeof ContextInput>;

export const ContextOutput = ResultEnvelope.extend({
  pinned: z.array(Card),
  /** Authoritative mixed results for this turn's recall. */
  results: z.array(RecallResult),
  /** @deprecated Page-only compatibility view; use `results`. */
  cards: z.array(Card),
  /** Recent authored events and typed orphan-document date evidence. */
  timeline: z.array(TimelineResult),
  /** @deprecated Authored-event compatibility view; use `timeline`. */
  events: z.array(Event),
  structure: z.string().optional(),
  searched: z.array(z.string()),
  coverage: z.record(z.string(), z.boolean()).optional(),
  budget_used: z.number().int().nonnegative(),
  /** What was dropped to fit, and how much of it. A silent trim reads as
   *  "that's everything" when it wasn't — default to visible. */
  dropped: z
    .object({
      cards: z.number().int().nonnegative(),
      events: z.number().int().nonnegative(),
      timeline: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type ContextOutput = z.infer<typeof ContextOutput>;
