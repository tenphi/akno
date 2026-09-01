import { z } from 'zod';
import {
  ClockRelation,
  DatePrefix,
  DocumentAvailability,
  DocumentTextSource,
  IanaTimezone,
  ResultEnvelope,
  TemporalPrecision,
  TemporalRecurrence,
  TemporalRelation,
  TemporalStatus,
} from '../common.ts';

export const TimelineSourceKind = z.enum(['event', 'state', 'plan', 'deadline', 'document_evidence']);
export type TimelineSourceKind = z.infer<typeof TimelineSourceKind>;

export const TimelineDisposition = z.enum([
  'active',
  'proposed',
  'accepted',
  'rejected',
  'resolved',
  'cancelled',
  'completed',
  'superseded',
]);
export type TimelineDisposition = z.infer<typeof TimelineDisposition>;

const TimelineSourceFilter = z.enum([
  'all',
  'both',
  'event',
  'state',
  'plan',
  'deadline',
  'document',
  'document_evidence',
]);

/** Reading remains bounded even when a recurring series has no end. */
export const TimelineInput = z
  .object({
    since: DatePrefix.optional(),
    until: DatePrefix.optional(),
    match: z.string().optional(),
    /** A page slug, retained subject id, or orphan document id/path. */
    subject: z.string().optional(),
    /** `both` is retained as a compatibility alias for the new `all` default. */
    source: TimelineSourceFilter.optional(),
    scope: z.enum(['past', 'today', 'future', 'all']).optional(),
    clock_relation: ClockRelation.optional(),
    temporal_status: TemporalStatus.optional(),
    disposition: TimelineDisposition.optional(),
    view: z.enum(['history', 'actionable']).optional(),
    /** Absolute query clock; processing time is used only when the caller omits it. */
    as_of: z.string().datetime({ offset: true }).optional(),
    timezone: IanaTimezone.optional(),
    limit: z.number().int().positive().max(2000).optional(),
    order: z.enum(['newest', 'oldest', 'nearest']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.since && value.until && padLow(value.since) > padHigh(value.until)) {
      ctx.addIssue({ code: 'custom', path: ['until'], message: 'timeline range is reversed' });
    }
  });
export type TimelineInput = z.infer<typeof TimelineInput>;

const TimelineFields = {
  start: z.string().nullable(),
  until: z.string().nullable(),
  precision: TemporalPrecision,
  clock_relation: ClockRelation,
  timezone: IanaTimezone.nullable(),
  mentioned_at: z.string().datetime({ offset: true }).nullable(),
};

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

export const TimelineEvent = Event.extend({
  type: z.literal('event'),
  origin: z.literal('authored'),
  source_kind: z.literal('event'),
  ...TimelineFields,
  relation: z.literal('occurred'),
  temporal_status: z.literal('actual'),
  disposition: z.literal('active'),
  actionable: z.literal(false),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const TimelineMemory = z
  .object({
    type: z.literal('memory'),
    origin: z.literal('retained'),
    source_kind: z.enum(['event', 'state', 'plan', 'deadline']),
    id: z.string(),
    memory_id: z.string(),
    summary: z.string(),
    slug: z.string(),
    line: z.number().int().positive(),
    kind: z.enum(['claim', 'decision', 'preference', 'plan', 'event', 'question']),
    subject: z.string(),
    evidence: z.array(z.string()),
    ...TimelineFields,
    relation: TemporalRelation,
    temporal_status: TemporalStatus,
    disposition: TimelineDisposition,
    actionable: z.boolean(),
    recurrence: TemporalRecurrence.optional(),
    occurrence: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    const expected = { occurred: 'event', valid: 'state', scheduled: 'plan', due: 'deadline' }[
      value.relation
    ];
    if (value.source_kind !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['source_kind'],
        message: `source kind must be ${expected} for ${value.relation}`,
      });
    }
    if ((value.recurrence === undefined) !== (value.occurrence === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['occurrence'],
        message: 'recurring results require both recurrence and occurrence identity',
      });
    }
  });
export type TimelineMemory = z.infer<typeof TimelineMemory>;

/**
 * A date evidenced by an unfiled document. It is deliberately not an `Event`:
 * a date in source material or filesystem metadata is not an authored claim
 * about what happened.
 */
export const DocumentTimelineEvidence = z.object({
  type: z.literal('document_evidence'),
  origin: z.literal('document'),
  source_kind: z.literal('document_evidence'),
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
  ...TimelineFields,
  relation: z.literal('evidenced'),
  temporal_status: z.literal('evidence'),
  disposition: z.null(),
  actionable: z.literal(false),
});
export type DocumentTimelineEvidence = z.infer<typeof DocumentTimelineEvidence>;

export const TimelineResult = z.discriminatedUnion('type', [
  TimelineEvent,
  TimelineMemory,
  DocumentTimelineEvidence,
]);
export type TimelineResult = z.infer<typeof TimelineResult>;

export function isTimelineEvent(result: TimelineResult): result is TimelineEvent {
  return result.type === 'event';
}

export function isTimelineMemory(result: TimelineResult): result is TimelineMemory {
  return result.type === 'memory';
}

export function isDocumentTimelineEvidence(result: TimelineResult): result is DocumentTimelineEvidence {
  return result.type === 'document_evidence';
}

const groupCount = <T extends z.ZodType>(value: T) =>
  z.object({ value, count: z.number().int().nonnegative() });

export const TimelineOutput = ResultEnvelope.extend({
  /** Authoritative mixed authored-event, retained-memory, and document-evidence results. */
  results: z.array(TimelineResult),
  total: z.number().int().nonnegative(),
  /** True when a recurrence safety bound prevented an authoritative total. */
  truncated: z.boolean().optional(),
  /** The window actually read, after prefix bounds were normalized. */
  range: z.object({ since: z.string().nullable(), until: z.string().nullable() }),
  clock: z.object({
    as_of: z.string().datetime({ offset: true }),
    timezone: IanaTimezone,
    local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  groups: z.object({
    clock_relation: z.array(groupCount(ClockRelation)),
    source_kind: z.array(groupCount(TimelineSourceKind)),
    temporal_status: z.array(groupCount(z.union([TemporalStatus, z.literal('evidence')]))),
    disposition: z.array(groupCount(z.union([TimelineDisposition, z.literal('none')]))),
  }),
});
export type TimelineOutput = z.infer<typeof TimelineOutput>;

function padLow(prefix: string): string {
  if (prefix.length === 4) return `${prefix}-01-01`;
  if (prefix.length === 7) return `${prefix}-01`;
  return prefix;
}

function padHigh(prefix: string): string {
  if (prefix.length === 4) return `${prefix}-12-31`;
  if (prefix.length === 7) return `${prefix}-31`;
  return prefix;
}
