import { TimelineInput, type TimelineOutput } from '@akno/protocol';
import type { AknoContext } from '../context.js';

/**
 * §10. When things happened. Reading is always filtered — a ledger spans years.
 *
 * Dated lines are indexed from **any** page, not just the ledger, so "when did we
 * sign the lease" finds a date written on the lease page, and someone typing
 * events into their own daily notes in Obsidian gets them for free.
 */
export async function timeline(ctx: AknoContext, rawInput: unknown): Promise<TimelineOutput> {
  const input = TimelineInput.parse(rawInput);

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

  const order = input.order === 'oldest' ? 'ASC' : 'DESC';
  const limit = input.limit ?? 100;

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  const total = (
    ctx.store.db.prepare(`SELECT count(*) AS c FROM events e${where}`).get(...params) as { c: number }
  ).c;

  const rows = ctx.store.db
    .prepare(
      `SELECT e.id, e.date, e.summary, e.target_slug, e.source_slug, e.line
         FROM events e${where}
        ORDER BY e.date ${order}, e.line ${order}
        LIMIT ?`,
    )
    .all(...params, limit) as {
    id: string;
    date: string;
    summary: string;
    target_slug: string | null;
    source_slug: string;
    line: number | null;
  }[];

  return {
    status: rows.length === 0 ? 'empty' : 'ok',
    events: rows.map((row) => ({
      id: row.id,
      date: row.date,
      summary: row.summary,
      slug: row.target_slug,
      source: row.source_slug,
      line: row.line,
    })),
    total,
    range: { since: input.since ?? null, until: input.until ?? null },
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
