import { z } from 'zod';

/** A ledger slug (or Markdown path); `*` explicitly combines every timeline. */
export const TimelineSelector = z.string().min(1).max(1024);

export const TimelineMembership = z.object({
  timeline: z.string(),
  timeline_basis: z.enum(['source_page', 'ledger', 'document_path']),
});

export const TimelineDescriptor = z.object({
  slug: z.string(),
  path: z.string(),
  folder: z.string(),
  default: z.boolean(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['ready', 'virtual', 'invalid', 'quarantined', 'unavailable']),
  writable: z.boolean(),
  note: z.string().optional(),
});
export type TimelineDescriptor = z.infer<typeof TimelineDescriptor>;

/** Suggestions only: links nominate a destination but never establish ownership. */
export const TimelineMigrationEntry = z.object({
  source: z.string(),
  line: z.number().int().positive(),
  date: z.string(),
  summary: z.string(),
  timeline: z.string(),
  suggested_timeline: z.string().nullable(),
  reason: z.enum(['cross_timeline_link', 'unresolved_target', 'unlinked_event']),
});
