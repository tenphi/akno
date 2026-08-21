import { z } from 'zod';
import { DatePrefix, DocumentAvailability, DocumentTextSource, ResultEnvelope } from '../common.ts';

/** Reading is always filtered — a ledger spans years. */
export const TimelineInput = z.object({
  since: DatePrefix.optional(),
  until: DatePrefix.optional(),
  match: z.string().optional(),
  /** A page slug, or an orphan document id/path. */
  subject: z.string().optional(),
  /** Restrict results to authored events, orphan document evidence, or both. */
  source: z.enum(['event', 'document', 'both']).optional(),
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

export const TimelineEvent = Event.extend({ type: z.literal('event') });
export type TimelineEvent = z.infer<typeof TimelineEvent>;

/**
 * A date evidenced by an unfiled document. It is deliberately not an `Event`:
 * a date in source material or filesystem metadata is not an authored claim
 * about what happened.
 */
export const DocumentTimelineEvidence = z.object({
  type: z.literal('document_evidence'),
  id: z.string(),
  date: z.string(),
  date_basis: z.enum(['extracted', 'file_created', 'file_modified']),
  document_id: z.string(),
  path: z.string(),
  label: z.string(),
  mime: z.string().nullable(),
  matched_page: z.number().int().positive().optional(),
  /** Required for an extracted date; absent when the date is filesystem metadata. */
  quote: z.string().optional(),
  text_source: DocumentTextSource.optional(),
  availability: DocumentAvailability,
  suggested_actions: z
    .array(
      z.object({
        op: z.literal('adopt'),
        args: z.object({ documentId: z.string() }),
      }),
    )
    .optional(),
});
export type DocumentTimelineEvidence = z.infer<typeof DocumentTimelineEvidence>;

export const TimelineResult = z.discriminatedUnion('type', [TimelineEvent, DocumentTimelineEvidence]);
export type TimelineResult = z.infer<typeof TimelineResult>;

export function isTimelineEvent(result: TimelineResult): result is TimelineEvent {
  return result.type === 'event';
}

export function isDocumentTimelineEvidence(result: TimelineResult): result is DocumentTimelineEvidence {
  return result.type === 'document_evidence';
}

export const TimelineOutput = ResultEnvelope.extend({
  /** Authoritative mixed authored-event and document-evidence results. */
  results: z.array(TimelineResult),
  /** @deprecated Authored-event compatibility view; use `results`. */
  events: z.array(Event),
  total: z.number().int().nonnegative(),
  /** The window actually read, after defaults were applied. */
  range: z.object({ since: z.string().nullable(), until: z.string().nullable() }),
});
export type TimelineOutput = z.infer<typeof TimelineOutput>;
