import type {
  ClockRelation,
  RetainedTime,
  TimelineDisposition,
  TimelineSourceKind,
} from '@tenphi/akno-protocol';

export interface TimelineClock {
  asOf: Date;
  asOfIso: string;
  timezone: string;
  localDate: string;
}

export interface TimelineRange {
  since: string | null;
  until: string | null;
}

export function resolveTimelineClock(asOf?: string, timezone?: string): TimelineClock {
  const now = asOf ? new Date(asOf) : new Date();
  const zone = timezone ?? systemTimezone();
  return {
    asOf: now,
    asOfIso: now.toISOString(),
    timezone: zone,
    localDate: dateInTimezone(now, zone),
  };
}

export function classifyRetainedTime(
  time: RetainedTime,
  disposition: TimelineDisposition | null,
  clock: TimelineClock,
): ClockRelation {
  if (time.precision === 'unknown' || (!time.start && !time.until)) return 'undated';
  const timezone = time.timezone ?? clock.timezone;
  if (time.precision === 'instant') return classifyInstant(time, disposition, clock, timezone);

  const current = localKey(clock.asOf, timezone, time.precision);
  const start = time.start ?? (time.relation === 'valid' ? null : (time.until ?? null));
  const until = time.until ?? (time.relation === 'valid' ? null : (time.start ?? null));
  if (isOverdue(time, disposition) && until !== null && until < current) return 'overdue';
  if (start !== null && start > current) return 'future';
  if (until !== null && until < current) return 'past';
  if (time.precision === 'month' || time.precision === 'year') return 'current_period';
  if (start === until) return 'today';
  return 'ongoing';
}

export function temporalSourceKind(time: RetainedTime): Exclude<TimelineSourceKind, 'document_evidence'> {
  if (time.relation === 'occurred') return 'event';
  if (time.relation === 'valid') return 'state';
  if (time.relation === 'due') return 'deadline';
  return 'plan';
}

export function temporalActionable(time: RetainedTime, disposition: TimelineDisposition | null): boolean {
  if (time.status === 'tentative') return false;
  if (disposition !== 'active' && disposition !== 'accepted') return false;
  return time.relation === 'scheduled' || time.relation === 'due';
}

export function temporalCurrentEligible(
  time: RetainedTime,
  disposition: TimelineDisposition | null,
  clock: TimelineClock,
): boolean {
  if (time.status !== 'actual') return false;
  if (disposition !== null && !['active', 'accepted', 'completed', 'resolved'].includes(disposition)) {
    return false;
  }
  const relation = classifyRetainedTime(time, disposition, clock);
  if (time.relation === 'valid') {
    if (disposition !== null && disposition !== 'active' && disposition !== 'accepted') return false;
    return relation === 'today' || relation === 'current_period' || relation === 'ongoing';
  }
  // A completed occurrence may answer a question about what happened today, but it
  // does not remain current once the reader's local calendar moves on.
  return time.relation === 'occurred' && (relation === 'today' || relation === 'ongoing');
}

export function normalizeTimelineRange(since?: string, until?: string): TimelineRange {
  return { since: since ? padLow(since) : null, until: until ? padHigh(until) : null };
}

export function temporalOverlapsRange(
  time: RetainedTime,
  range: TimelineRange,
  fallbackTimezone = 'UTC',
): boolean {
  if (time.precision === 'unknown' || (!time.start && !time.until)) {
    return range.since === null && range.until === null;
  }
  const bounds = temporalDateBounds(time, fallbackTimezone);
  if (range.since && bounds.until && bounds.until < range.since) return false;
  if (range.until && bounds.start && bounds.start > range.until) return false;
  return true;
}

export function temporalSortValue(time: RetainedTime, fallbackTimezone = 'UTC'): number {
  const value = time.start ?? time.until;
  if (!value || time.precision === 'unknown') return Number.NEGATIVE_INFINITY;
  if (time.precision === 'instant') return Date.parse(value);
  return boundaryMillis(value, time.precision, false, time.timezone ?? fallbackTimezone);
}

export function temporalDistanceFromClock(time: RetainedTime, clock: TimelineClock): number {
  if (time.precision === 'unknown' || (!time.start && !time.until)) return Number.POSITIVE_INFINITY;
  const timezone = time.timezone ?? clock.timezone;
  const pointStart = time.start ?? (time.relation === 'valid' ? null : (time.until ?? null));
  const pointUntil = time.until ?? (time.relation === 'valid' ? null : (time.start ?? null));
  const start = pointStart
    ? boundaryMillis(pointStart, time.precision, false, timezone)
    : Number.NEGATIVE_INFINITY;
  const until = pointUntil
    ? boundaryMillis(pointUntil, time.precision, true, timezone)
    : Number.POSITIVE_INFINITY;
  const now = clock.asOf.getTime();
  if (now >= start && now <= until) return 0;
  return Math.min(Math.abs(now - start), Math.abs(now - until));
}

export function temporalDateBounds(
  time: RetainedTime,
  fallbackTimezone = 'UTC',
): { start: string | null; until: string | null } {
  const pointStart = time.start ?? (time.relation === 'valid' ? null : (time.until ?? null));
  const pointUntil = time.until ?? (time.relation === 'valid' ? null : (time.start ?? null));
  return {
    start: pointStart
      ? lowerBoundaryDate(pointStart, time.precision, time.timezone ?? fallbackTimezone)
      : null,
    until: pointUntil
      ? upperBoundaryDate(pointUntil, time.precision, time.timezone ?? fallbackTimezone)
      : null,
  };
}

function classifyInstant(
  time: RetainedTime,
  disposition: TimelineDisposition | null,
  clock: TimelineClock,
  timezone: string,
): ClockRelation {
  const pointStart = time.start ?? (time.relation === 'valid' ? null : (time.until ?? null));
  const pointUntil = time.until ?? (time.relation === 'valid' ? null : (time.start ?? null));
  const start = pointStart ? Date.parse(pointStart) : Number.NEGATIVE_INFINITY;
  const until = pointUntil ? Date.parse(pointUntil) : Number.POSITIVE_INFINITY;
  const now = clock.asOf.getTime();
  if (isOverdue(time, disposition) && until < now) return 'overdue';
  const point = start === until;
  if (
    point &&
    pointStart &&
    dateInTimezone(new Date(pointStart), timezone) === dateInTimezone(clock.asOf, timezone)
  ) {
    return 'today';
  }
  if (start > now) return 'future';
  if (until < now) return 'past';
  return point ? 'future' : 'ongoing';
}

function isOverdue(time: RetainedTime, disposition: TimelineDisposition | null): boolean {
  return time.relation === 'due' && (disposition === 'active' || disposition === 'accepted');
}

function localKey(value: Date, timezone: string, precision: RetainedTime['precision']): string {
  const date = dateInTimezone(value, timezone);
  if (precision === 'year') return date.slice(0, 4);
  if (precision === 'month') return date.slice(0, 7);
  return date;
}

function lowerBoundaryDate(value: string, precision: RetainedTime['precision'], timezone = 'UTC'): string {
  if (precision === 'instant') return dateInTimezone(new Date(value), timezone);
  if (precision === 'year') return `${value}-01-01`;
  if (precision === 'month') return `${value}-01`;
  return value.slice(0, 10);
}

function upperBoundaryDate(value: string, precision: RetainedTime['precision'], timezone = 'UTC'): string {
  if (precision === 'instant') return dateInTimezone(new Date(value), timezone);
  if (precision === 'year') return `${value}-12-31`;
  if (precision === 'month') {
    const [year, month] = value.split('-').map(Number);
    const day = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    return `${value}-${String(day).padStart(2, '0')}`;
  }
  return value.slice(0, 10);
}

function boundaryMillis(
  value: string,
  precision: RetainedTime['precision'],
  end: boolean,
  timezone: string,
): number {
  if (precision === 'instant') return Date.parse(value);
  const date = end ? upperBoundaryDate(value, precision) : lowerBoundaryDate(value, precision);
  return zonedDateBoundary(date, timezone, end);
}

function zonedDateBoundary(date: string, timezone: string, end: boolean): number {
  const [year, month, day] = date.split('-').map(Number);
  const target = {
    year: year!,
    month: month!,
    day: day!,
    hour: end ? 23 : 0,
    minute: end ? 59 : 0,
    second: end ? 59 : 0,
    millisecond: end ? 999 : 0,
  };
  let guess = localStamp(target);
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = dateTimeInTimezone(new Date(guess), timezone);
    if (!actual) return guess;
    const delta = localStamp(target) - localStamp(actual);
    if (delta === 0) return guess;
    guess += delta;
  }
  return guess;
}

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function dateTimeInTimezone(value: Date, timezone: string): DateTimeParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((entry) => entry.type === type)?.value ?? Number.NaN);
    const result = {
      year: part('year'),
      month: part('month'),
      day: part('day'),
      hour: part('hour'),
      minute: part('minute'),
      second: part('second'),
      millisecond: value.getUTCMilliseconds(),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

function localStamp(value: DateTimeParts): number {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.millisecond,
  );
}

function padLow(prefix: string): string {
  if (prefix.length === 4) return `${prefix}-01-01`;
  if (prefix.length === 7) return `${prefix}-01`;
  return prefix;
}

function padHigh(prefix: string): string {
  if (prefix.length === 4) return `${prefix}-12-31`;
  if (prefix.length === 7) {
    const [year, month] = prefix.split('-').map(Number);
    const day = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    return `${prefix}-${String(day).padStart(2, '0')}`;
  }
  return prefix;
}

function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function dateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
