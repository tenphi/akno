import {
  timelineCatalog,
  owningTimeline,
  selectTimelines,
  timelineReadable,
  timelinePlacement,
} from '../timeline/boundaries.ts';
import { eventId } from '../store/ids.ts';
import {
  RetainedTime,
  TimelineInput,
  type DegradedReason,
  type TimelineInput as TimelineInputType,
  type TimelineDisposition,
  type TimelineEvent,
  type TimelineMemory,
  type TimelineOutput,
  type TimelineResult,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { documentTimelineEvidence } from '../timeline/documents.ts';
import {
  classifyRetainedTime,
  normalizeTimelineRange,
  resolveTimelineClock,
  temporalActionable,
  temporalDistanceFromClock,
  temporalOverlapsRange,
  temporalSortValue,
  temporalSourceKind,
  type TimelineClock,
  type TimelineRange,
} from '../timeline/clock.ts';
import { expandRetainedRecurrence } from '../timeline/recurrence.ts';
import { TEMPORAL_PROJECTION_VERSION } from '../timeline/projection.ts';
import { quarantineDetails } from '../index/page-quarantine.ts';

interface TemporalEntryRow {
  memory_id: string;
  source_slug: string;
  line: number;
  summary: string;
  kind: TimelineMemory['kind'];
  subject: string;
  relation: TimelineMemory['relation'];
  temporal_status: TimelineMemory['temporal_status'];
  disposition: TimelineDisposition;
  precision: TimelineMemory['precision'];
  start: string | null;
  until: string | null;
  timezone: string | null;
  mentioned_at: string | null;
  recurrence: string | null;
  evidence: string;
}

/**
 * One read-time clock over authored events, retained world time, and document date evidence.
 * Processing timestamps never enter this result, and clock classifications are never persisted.
 */
export async function timeline(ctx: AknoContext, rawInput: unknown): Promise<TimelineOutput> {
  const input = TimelineInput.parse(rawInput);
  const clock = resolveTimelineClock(input.as_of, input.timezone);
  const range = normalizeTimelineRange(input.since, input.until);
  const limit = input.limit ?? 100;
  const degraded = new Set<DegradedReason>();
  const catalog = timelineCatalog(ctx.config, ctx.store);
  const selected = selectTimelines(catalog, input.timeline);
  const selectedSlugs = new Set(selected.map((entry) => entry.slug));
  const accepts = (source: string) => {
    const owner = owningTimeline(catalog, source);
    return selectedSlugs.has(owner.slug) && timelineReadable(owner);
  };
  const boundaryUnavailable = selected.some((entry) => !timelineReadable(entry));
  if (boundaryUnavailable) degraded.add('timeline_boundary_unavailable');
  const sourceConflict =
    selected.some((entry) => entry.status === 'quarantined') ||
    quarantineDetails(ctx.store).some((entry) =>
      selectedSlugs.has(owningTimeline(catalog, entry.relPath).slug),
    );
  if (sourceConflict) degraded.add('source_conflict');
  let recurrenceLimited = false;
  let temporalIssueCount = 0;

  const includeAuthored =
    input.source === undefined ||
    input.source === 'all' ||
    input.source === 'both' ||
    input.source === 'event';
  const includeDocuments =
    input.source === undefined ||
    input.source === 'all' ||
    input.source === 'both' ||
    input.source === 'document' ||
    input.source === 'document_evidence';
  const authored = includeAuthored ? authoredEvents(ctx, clock, accepts) : [];
  const needsTemporalProjection = input.source !== 'document' && input.source !== 'document_evidence';
  const projectionAvailable =
    tableExists(ctx, 'temporal_entries') && tableExists(ctx, 'temporal_projection_issues');
  const projectionCurrent =
    projectionAvailable && ctx.store.meta('temporal_projection_version') === TEMPORAL_PROJECTION_VERSION;
  let retained: TimelineMemory[] = [];
  if (needsTemporalProjection && (!projectionAvailable || !projectionCurrent)) {
    degraded.add('partial_temporal_index');
  }
  if (needsTemporalProjection && projectionAvailable) {
    temporalIssueCount = (
      ctx.store.db
        .prepare(
          'SELECT page.slug FROM temporal_projection_issues issue JOIN pages page ON page.id = issue.source_page',
        )
        .all() as { slug: string }[]
    ).filter((entry) => accepts(entry.slug)).length;
    if (temporalIssueCount > 0) degraded.add('partial_temporal_index');
    const expanded = retainedMemories(ctx, clock, range, limit, accepts);
    retained = expanded.results;
    recurrenceLimited = expanded.limited;
    if (expanded.invalid > 0) {
      temporalIssueCount += expanded.invalid;
      degraded.add('partial_temporal_index');
    }
    if (recurrenceLimited) degraded.add('timeline_range_limited');
  }

  const documents = includeDocuments
    ? documentTimelineEvidence(ctx, {
        ...(range.since ? { since: range.since } : {}),
        ...(range.until ? { until: range.until } : {}),
        ...(input.match ? { match: input.match } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
        clock,
        accepts,
      })
    : [];

  const seenEvents = new Set<string>();
  const matching = [...authored, ...retained, ...documents]
    .map((entry) => ({
      ...entry,
      ...timelinePlacement(
        catalog,
        entry.type === 'event' ? entry.source : entry.type === 'memory' ? entry.slug : entry.path,
        entry.type === 'document_evidence'
          ? 'document_path'
          : entry.type === 'event' && catalog.some((item) => item.slug === entry.source)
            ? 'ledger'
            : 'source_page',
      ),
    }))
    .filter((entry) => temporalOverlapsRange(timeFor(entry), range, clock.timezone))
    .filter((entry) => matchesSource(entry, input.source))
    .filter((entry) => matchesSubject(entry, input.subject))
    .filter((entry) => matchesText(entry, input.match))
    .filter((entry) => matchesScope(entry, input.scope))
    .filter((entry) => !input.clock_relation || entry.clock_relation === input.clock_relation)
    .filter(
      (entry) =>
        !input.temporal_status ||
        (entry.temporal_status !== 'evidence' && entry.temporal_status === input.temporal_status),
    )
    .filter((entry) => !input.disposition || entry.disposition === input.disposition)
    .filter((entry) => input.view !== 'actionable' || entry.actionable)
    .sort(
      (left, right) =>
        Number(right.timeline_basis === 'ledger') - Number(left.timeline_basis === 'ledger') ||
        left.id.localeCompare(right.id),
    )
    .filter((entry) => {
      if (entry.type !== 'event') return true;
      const key = `${entry.timeline}:${eventId(entry.date, entry.slug, entry.summary)}`;
      if (seenEvents.has(key)) return false;
      seenEvents.add(key);
      return true;
    });

  matching.sort(resultOrder(input.order ?? 'newest', clock));
  const results = matching.slice(0, limit);
  const documentStates = results
    .filter((result) => result.type === 'document_evidence')
    .map((result) => result.availability);
  const hasMissingDocument = documentStates.some((state) => state.status !== 'available');
  if (hasMissingDocument) degraded.add('document_source_missing');
  const unavailableDocumentsOnly =
    results.length > 0 &&
    results.every(
      (result) => result.type === 'document_evidence' && result.availability.status === 'unavailable',
    );
  const temporalOnlyRequested =
    input.source === 'state' || input.source === 'plan' || input.source === 'deadline';
  const status = selected.every((entry) => !timelineReadable(entry))
    ? 'unavailable'
    : temporalOnlyRequested && !projectionAvailable
      ? 'unavailable'
      : unavailableDocumentsOnly
        ? 'unavailable'
        : degraded.size > 0
          ? 'degraded'
          : results.length === 0
            ? 'empty'
            : 'ok';

  const migration = input.migration_preview
    ? matching.flatMap((entry) => {
        if (entry.type !== 'event' || !entry.line || !catalog.some((item) => item.slug === entry.source))
          return [];
        const target = entry.slug
          ? ctx.store.db.prepare('SELECT slug FROM pages WHERE slug = ?').get(entry.slug)
          : null;
        const suggestion = target && entry.slug ? owningTimeline(catalog, entry.slug).slug : null;
        if (suggestion === entry.timeline) return [];
        return [
          {
            source: entry.source,
            line: entry.line,
            date: entry.date,
            summary: entry.summary,
            timeline: entry.timeline,
            suggested_timeline: suggestion,
            reason: suggestion
              ? ('cross_timeline_link' as const)
              : entry.slug
                ? ('unresolved_target' as const)
                : ('unlinked_event' as const),
          },
        ];
      })
    : undefined;

  return {
    status,
    ...(degraded.size > 0 ? { degraded: [...degraded] } : {}),
    ...(status !== 'ok' && status !== 'empty'
      ? {
          note:
            (boundaryUnavailable
              ? 'a selected timeline boundary is unavailable; inspect list({kind: "timelines"}); '
              : '') +
            timelineNote({
              projectionAvailable,
              projectionCurrent,
              temporalIssueCount,
              recurrenceLimited,
              hasMissingDocument,
              unavailableDocumentsOnly,
              sourceConflict,
            }),
        }
      : {}),
    results,
    selected_timelines: selected.map((entry) => entry.slug),
    timelines: selected,
    ...(migration ? { migration: migration.slice(0, limit), migration_total: migration.length } : {}),
    total: matching.length,
    ...(recurrenceLimited ? { truncated: true } : {}),
    range,
    clock: { as_of: clock.asOfIso, timezone: clock.timezone, local_date: clock.localDate },
    groups: {
      clock_relation: groupCounts(matching.map((entry) => entry.clock_relation)),
      source_kind: groupCounts(matching.map((entry) => entry.source_kind)),
      temporal_status: groupCounts(matching.map((entry) => entry.temporal_status)),
      disposition: groupCounts(matching.map((entry) => entry.disposition ?? 'none')),
    },
  };
}

function authoredEvents(
  ctx: AknoContext,
  clock: TimelineClock,
  accepts: (source: string) => boolean,
): TimelineEvent[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT e.id, e.date, e.summary, e.target_slug, e.source_slug, e.line
         FROM events e`,
    )
    .all() as {
    id: string;
    date: string;
    summary: string;
    target_slug: string | null;
    source_slug: string;
    line: number | null;
  }[];
  return rows
    .filter((row) => accepts(row.source_slug))
    .map((row) => {
      const time = {
        start: row.date,
        until: row.date,
        precision: 'day' as const,
        relation: 'occurred' as const,
        status: 'actual' as const,
      };
      return {
        type: 'event',
        origin: 'authored',
        source_kind: 'event',
        id: row.id,
        date: row.date,
        summary: row.summary,
        slug: row.target_slug,
        source: row.source_slug,
        line: row.line,
        start: row.date,
        until: row.date,
        precision: 'day',
        relation: 'occurred',
        temporal_status: 'actual',
        disposition: 'active',
        clock_relation: classifyRetainedTime(time, 'active', clock),
        timezone: null,
        mentioned_at: null,
        actionable: false,
      };
    });
}

function retainedMemories(
  ctx: AknoContext,
  clock: TimelineClock,
  range: TimelineRange,
  maxOccurrences: number,
  accepts: (source: string) => boolean,
): { results: TimelineMemory[]; limited: boolean; invalid: number } {
  const allRows = ctx.store.db
    .prepare(
      `SELECT memory_id, source_slug, line, summary, kind, subject, relation,
              temporal_status, disposition, precision, start, until, timezone,
              mentioned_at, recurrence, evidence
         FROM temporal_entries`,
    )
    .all() as TemporalEntryRow[];
  const rows = allRows.filter((row) => accepts(row.source_slug));
  const results: TimelineMemory[] = [];
  let limited = false;
  let invalid = 0;
  let expandedOccurrences = 0;
  const duplicateIds = new Set(
    [...countValues(allRows.map((row) => row.memory_id)).entries()]
      .filter(([, occurrences]) => occurrences > 1)
      .map(([memoryId]) => memoryId),
  );
  for (const row of rows) {
    if (duplicateIds.has(row.memory_id)) {
      invalid++;
      continue;
    }
    const parsed = RetainedTime.safeParse({
      ...(row.start ? { start: row.start } : {}),
      ...(row.until ? { until: row.until } : {}),
      precision: row.precision,
      relation: row.relation,
      status: row.temporal_status,
      ...(row.timezone ? { timezone: row.timezone } : {}),
      ...(row.mentioned_at ? { mentioned_at: row.mentioned_at } : {}),
      ...(parseJson(row.recurrence) ? { recurrence: parseJson(row.recurrence) } : {}),
    });
    const evidence = parseStringArray(row.evidence);
    if (!parsed.success || evidence === null) {
      invalid++;
      continue;
    }
    const recurringInRange =
      parsed.data.recurrence !== undefined && range.since !== null && range.until !== null;
    const remainingOccurrences = maxOccurrences - expandedOccurrences;
    if (recurringInRange && remainingOccurrences <= 0) {
      if (temporalOverlapsRange(parsed.data, range, clock.timezone)) {
        results.push(memoryResult(row, parsed.data, evidence, clock, 0));
      }
      limited = true;
      continue;
    }
    // One extra slot lets the stored anchor remain visible without consuming the
    // expansion budget. Every generated occurrence across the whole query shares
    // the caller's result limit; the bound is not multiplied by the number of series.
    const expansion = expandRetainedRecurrence(parsed.data, range, remainingOccurrences + 1);
    limited ||= expansion.limited;
    for (const occurrence of expansion.occurrences) {
      if (occurrence.index > 0) {
        if (expandedOccurrences >= maxOccurrences) {
          limited = true;
          continue;
        }
        expandedOccurrences++;
      }
      results.push(memoryResult(row, occurrence.time, evidence, clock, occurrence.index));
    }
  }
  return { results, limited, invalid };
}

function memoryResult(
  row: TemporalEntryRow,
  time: TimelineMemoryTime,
  evidence: string[],
  clock: TimelineClock,
  occurrence: number,
): TimelineMemory {
  return {
    type: 'memory',
    origin: 'retained',
    source_kind: temporalSourceKind(time),
    id: occurrence === 0 ? row.memory_id : `${row.memory_id}:${occurrence}`,
    memory_id: row.memory_id,
    summary: row.summary,
    slug: row.source_slug,
    line: row.line,
    kind: row.kind,
    subject: row.subject,
    evidence,
    start: time.start ?? null,
    until: time.until ?? null,
    precision: time.precision,
    relation: time.relation,
    temporal_status: time.status,
    disposition: row.disposition,
    clock_relation: classifyRetainedTime(time, row.disposition, clock),
    timezone: time.timezone ?? null,
    mentioned_at: time.mentioned_at ?? null,
    actionable: temporalActionable(time, row.disposition),
    ...(time.recurrence ? { recurrence: time.recurrence, occurrence } : {}),
  };
}

type TimelineMemoryTime = Parameters<typeof classifyRetainedTime>[0];

function timeFor(result: TimelineResult) {
  return {
    ...(result.start ? { start: result.start } : {}),
    ...(result.until ? { until: result.until } : {}),
    precision: result.precision,
    relation: result.relation === 'evidenced' ? ('occurred' as const) : result.relation,
    status: result.temporal_status === 'evidence' ? ('actual' as const) : result.temporal_status,
    ...(result.timezone ? { timezone: result.timezone } : {}),
    ...(result.mentioned_at ? { mentioned_at: result.mentioned_at } : {}),
    ...('recurrence' in result && result.recurrence ? { recurrence: result.recurrence } : {}),
  };
}

function matchesSource(result: TimelineResult, source: TimelineInputType['source']): boolean {
  if (!source || source === 'all' || source === 'both') return true;
  if (source === 'document' || source === 'document_evidence')
    return result.source_kind === 'document_evidence';
  return result.source_kind === source;
}

function matchesSubject(result: TimelineResult, subject?: string): boolean {
  if (!subject) return true;
  if (result.type === 'memory') {
    return result.subject === subject || result.slug === subject || result.memory_id === subject;
  }
  if (result.type === 'event') return result.slug === subject || result.source === subject;
  const normalized = subject.replaceAll('\\', '/');
  return (
    result.document_id === normalized || result.path === normalized || result.path.endsWith(`/${normalized}`)
  );
}

function matchesText(result: TimelineResult, match?: string): boolean {
  if (!match) return true;
  const wanted = match.toLowerCase();
  if (result.type === 'memory') return `${result.summary} ${result.slug}`.toLowerCase().includes(wanted);
  if (result.type === 'event') return `${result.summary} ${result.source}`.toLowerCase().includes(wanted);
  return `${result.label} ${result.path} ${result.quote ?? ''}`.toLowerCase().includes(wanted);
}

function matchesScope(result: TimelineResult, scope?: 'past' | 'today' | 'future' | 'all'): boolean {
  if (!scope || scope === 'all') return true;
  if (scope === 'past') return result.clock_relation === 'past';
  if (scope === 'today') {
    return ['today', 'current_period', 'ongoing'].includes(result.clock_relation);
  }
  return result.clock_relation === 'future' || result.clock_relation === 'overdue';
}

function resultOrder(order: 'newest' | 'oldest' | 'nearest', clock: TimelineClock) {
  return (left: TimelineResult, right: TimelineResult): number => {
    if (left.clock_relation === 'undated' && right.clock_relation !== 'undated') return 1;
    if (right.clock_relation === 'undated' && left.clock_relation !== 'undated') return -1;
    const leftTime = timeFor(left);
    const rightTime = timeFor(right);
    const byTime =
      order === 'nearest'
        ? temporalDistanceFromClock(leftTime, clock) - temporalDistanceFromClock(rightTime, clock)
        : (temporalSortValue(leftTime, clock.timezone) - temporalSortValue(rightTime, clock.timezone)) *
          (order === 'oldest' ? 1 : -1);
    if (byTime !== 0) return byTime;
    if (left.type !== right.type) return left.type.localeCompare(right.type);
    return left.id.localeCompare(right.id);
  };
}

function groupCounts<T extends string>(values: T[]): { value: T; count: number }[] {
  const counts = countValues(values);
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, countValue]) => ({ value, count: countValue }));
}

function countValues<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseStringArray(value: string): string[] | null {
  const parsed = parseJson(value);
  return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : null;
}

function tableExists(ctx: AknoContext, name: string): boolean {
  const row = ctx.store.db
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { present: number } | undefined;
  return row?.present === 1;
}

function timelineNote(options: {
  projectionAvailable: boolean;
  projectionCurrent: boolean;
  temporalIssueCount: number;
  recurrenceLimited: boolean;
  hasMissingDocument: boolean;
  unavailableDocumentsOnly: boolean;
  sourceConflict: boolean;
}): string {
  const notes: string[] = [];
  if (!options.projectionAvailable)
    notes.push('the retained temporal index is unavailable; run `akno index`');
  else if (!options.projectionCurrent)
    notes.push('retained temporal memory needs a full index pass after upgrade');
  if (options.temporalIssueCount > 0) {
    notes.push(
      `${options.temporalIssueCount} retained temporal item${options.temporalIssueCount === 1 ? '' : 's'} could not be projected safely`,
    );
  }
  if (options.recurrenceLimited) notes.push('recurrence expansion reached a configured safety bound');
  if (options.sourceConflict) {
    notes.push('some Markdown timeline sources are quarantined until their file conflicts are repaired');
  }
  if (options.unavailableDocumentsOnly) {
    notes.push(
      'matching document date metadata remains, but neither originals nor readable copies are available',
    );
  } else if (options.hasMissingDocument) {
    notes.push(
      'some document timeline evidence is retained from an indexed copy because its original is missing',
    );
  }
  return notes.join('; ');
}
