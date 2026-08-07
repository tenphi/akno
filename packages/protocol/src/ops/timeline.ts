import { z } from 'zod';
import { DatePrefix, ResultEnvelope } from '../common.ts';

/** Reading is always filtered — a ledger spans years. */
export const TimelineInput = z.object({
  since: DatePrefix.optional(),
  until: DatePrefix.optional(),
  match: z.string().optional(),
  /** A slug. Matches events linking to it, and events derived from its own body. */
  subject: z.string().optional(),
  limit: z.number().int().positive().max(2000).optional(),
  order: z.enum(['newest', 'oldest']).optional(),
});
export type TimelineInput = z.infer<typeof TimelineInput>;

export const Event = z.object({
  id: z.string(),
  date: z.string(),
  summary: z.string(),
  /** The page this event links to, when it has one. Plenty of events never will. */
  slug: z.string().nullable(),
  /** Where the line lives — `timeline` for the ledger, otherwise the page it was
   *  written on. Dated lines are indexed from any page, so someone typing events
   *  into their own daily notes gets them for free. */
  source: z.string(),
  line: z.number().int().positive().nullable(),
});
export type Event = z.infer<typeof Event>;

export const TimelineOutput = ResultEnvelope.extend({
  events: z.array(Event),
  total: z.number().int().nonnegative(),
  /** The window actually read, after defaults were applied. */
  range: z.object({ since: z.string().nullable(), until: z.string().nullable() }),
});
export type TimelineOutput = z.infer<typeof TimelineOutput>;
