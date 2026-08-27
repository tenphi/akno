import {
  TimelineInput,
  type TimelineEvent,
  type TimelineOutput,
  type TimelineResult,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { documentTimelineEvidence } from '../timeline/documents.ts';

/**
 * When things happened. Reading is always filtered — a ledger spans years.
 *
 * Dated lines are indexed from **any** page, not just the ledger, so "when did we
 * sign the lease" finds a date written on the lease page, and someone typing
 * events into their own daily notes in Obsidian gets them for free.
 */
export async function timeline(ctx: AknoContext, rawInput: unknown): Promise<TimelineOutput> {
  const input = TimelineInput.parse(rawInput);
  const source = input.source ?? 'both';
  const includeEvents = source === 'event' || source === 'both';
  const includeDocuments = source === 'document' || source === 'both';

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (input.since) {
    clauses.push('e.date >= ?');
    params.push(padLow(input.since));
  }
  if (input.until) {
    clauses.push('e.date <= ?');
    params.push(padHigh(input.until));
  }
  if (input.subject) {
    // Both senses of "about this page": events that link to it, and events
    // written on it.
    clauses.push('(e.target_slug = ? OR e.source_slug = ?)');
    params.push(input.subject, input.subject);
  }
  if (input.match) {
    clauses.push('e.summary LIKE ?');
    params.push(`%${input.match}%`);
  }

  const limit = input.limit ?? 100;

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  const eventResults: TimelineEvent[] = includeEvents
    ? (
        ctx.store.db
          .prepare(
            `SELECT e.id, e.date, e.summary, e.target_slug, e.source_slug, e.line
             FROM events e${where}`,
          )
          .all(...params) as {
          id: string;
          date: string;
          summary: string;
          target_slug: string | null;
          source_slug: string;
          line: number | null;
        }[]
      ).map((row) => ({
        type: 'event',
        id: row.id,
        date: row.date,
        summary: row.summary,
        slug: row.target_slug,
        source: row.source_slug,
        line: row.line,
      }))
    : [];

  const documentResults = includeDocuments
    ? documentTimelineEvidence(ctx, {
        ...(input.since ? { since: padLow(input.since) } : {}),
        ...(input.until ? { until: padHigh(input.until) } : {}),
        ...(input.match ? { match: input.match } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
      })
    : [];
  const allResults: TimelineResult[] = [...eventResults, ...documentResults];
  allResults.sort(resultOrder(input.order ?? 'newest'));
  const results = allResults.slice(0, limit);

  const documentStates = results
    .filter((result) => result.type === 'document_evidence')
    .map((result) => result.availability);
  const hasMissingDocument = documentStates.some((state) => state.status !== 'available');
  const unavailableOnly =
    results.length > 0 &&
    results.every(
      (result) => result.type === 'document_evidence' && result.availability.status === 'unavailable',
    );
  const status =
    results.length === 0 ? 'empty' : unavailableOnly ? 'unavailable' : hasMissingDocument ? 'degraded' : 'ok';

  return {
    status,
    ...(status === 'degraded' ? { degraded: ['document_source_missing'] } : {}),
    ...(hasMissingDocument
      ? {
          note:
            status === 'unavailable'
              ? 'matching document date metadata remains, but neither the originals nor readable copies are available'
              : 'some document timeline evidence is retained from an indexed copy because its original is missing',
        }
      : {}),
    results,
    total: allResults.length,
    range: { since: input.since ?? null, until: input.until ?? null },
  };
}

function resultOrder(order: 'newest' | 'oldest'): (a: TimelineResult, b: TimelineResult) => number {
  const direction = order === 'oldest' ? 1 : -1;
  return (a, b) => {
    const byDate = a.date.localeCompare(b.date) * direction;
    if (byDate !== 0) return byDate;
    if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
    return a.id.localeCompare(b.id);
  };
}

/** `2026` → `2026-01-01`, `2026-06` → `2026-06-01`. */
function padLow(prefix: string): string {
  if (prefix.length === 4) return `${prefix}-01-01`;
  if (prefix.length === 7) return `${prefix}-01`;
  return prefix;
}

/** `2026` → `2026-12-31`, `2026-06` → `2026-06-31` (string compare, so 31 is safe). */
function padHigh(prefix: string): string {
  if (prefix.length === 4) return `${prefix}-12-31`;
  if (prefix.length === 7) return `${prefix}-31`;
  return prefix;
}
