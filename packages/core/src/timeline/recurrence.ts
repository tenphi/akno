import type { RetainedTime, TemporalRecurrence } from '@tenphi/akno-protocol';
import { temporalDateBounds, temporalOverlapsRange, type TimelineRange } from './clock.ts';

interface RetainedOccurrence {
  time: RetainedTime;
  index: number;
}

export interface RecurrenceExpansion {
  occurrences: RetainedOccurrence[];
  limited: boolean;
}

const MAX_ITERATIONS = 50_000;

/** Expand only for a closed query range; an unbounded timeline returns the anchored occurrence. */
export function expandRetainedRecurrence(
  time: RetainedTime,
  range: TimelineRange,
  maxOccurrences: number,
): RecurrenceExpansion {
  if (!time.recurrence || !time.start || (range.since === null && range.until === null)) {
    return {
      occurrences: temporalOverlapsRange(time, range) ? [{ time, index: 0 }] : [],
      limited: false,
    };
  }
  if (range.since === null || range.until === null) {
    return {
      occurrences: temporalOverlapsRange(time, range) ? [{ time, index: 0 }] : [],
      limited: true,
    };
  }
  if (!supportedPrecision(time.precision, time.recurrence.frequency)) {
    return {
      occurrences: temporalOverlapsRange(time, range) ? [{ time, index: 0 }] : [],
      limited: true,
    };
  }
  // An offset identifies one instant, not the civil-time rules needed to advance a
  // recurring series across daylight-saving changes. Keep the anchor visible but do
  // not invent later occurrences without an explicit IANA timezone.
  if (time.precision === 'instant' && !time.timezone) {
    return {
      occurrences: temporalOverlapsRange(time, range) ? [{ time, index: 0 }] : [],
      limited: true,
    };
  }

  const occurrences: RetainedOccurrence[] = [];
  let emitted = 0;
  let limited = false;
  let endedByBoundary = false;
  for (const shifted of recurrenceCandidates(time)) {
    if (shifted === null) continue;
    if (afterSeriesEnd(shifted.start!, time)) {
      endedByBoundary = true;
      break;
    }
    if (range.until && startsAfterRange(shifted, range.until)) {
      endedByBoundary = true;
      break;
    }
    if (temporalOverlapsRange(shifted, range)) {
      occurrences.push({ time: shifted, index: emitted });
      if (occurrences.length >= maxOccurrences) {
        limited = true;
        break;
      }
    }
    emitted++;
    if (emitted >= MAX_ITERATIONS) {
      limited = true;
      break;
    }
  }
  if (!endedByBoundary && !limited) limited = true;
  return { occurrences, limited };
}

function* recurrenceCandidates(time: RetainedTime): Generator<RetainedTime | null> {
  const recurrence = time.recurrence!;
  const interval = recurrence.interval ?? 1;
  if (recurrence.frequency === 'weekly' && recurrence.weekdays && recurrence.weekdays.length > 0) {
    const wanted = new Set(recurrence.weekdays.map(weekdayNumber));
    for (let day = 0; day < MAX_ITERATIONS; day++) {
      if (Math.floor(day / 7) % interval !== 0) continue;
      const shifted = shiftTime(time, { days: day });
      if (!shifted?.start || !wanted.has(weekdayOf(shifted.start, time.precision, time.timezone))) continue;
      yield shifted;
    }
    return;
  }

  for (let index = 0; index < MAX_ITERATIONS; index++) {
    const amount = index * interval;
    if (recurrence.frequency === 'daily') yield shiftTime(time, { days: amount });
    else if (recurrence.frequency === 'weekly') yield shiftTime(time, { days: amount * 7 });
    else if (recurrence.frequency === 'monthly') yield shiftTime(time, { months: amount });
    else yield shiftTime(time, { years: amount });
  }
}

function shiftTime(
  time: RetainedTime,
  delta: { days?: number; months?: number; years?: number },
): RetainedTime | null {
  const start = shiftBoundary(time.start!, time.precision, time.timezone, delta);
  if (!start) return null;
  const until = time.until ? shiftBoundary(time.until, time.precision, time.timezone, delta) : undefined;
  if (time.until && !until) return null;
  if (until) return { ...time, start, until };
  const { until: _until, ...withoutUntil } = time;
  return { ...withoutUntil, start };
}

function shiftBoundary(
  value: string,
  precision: RetainedTime['precision'],
  timezone: string | undefined,
  delta: { days?: number; months?: number; years?: number },
): string | null {
  if (precision === 'year') return String(Number(value) + (delta.years ?? 0)).padStart(4, '0');
  if (precision === 'month') {
    const [year, month] = value.split('-').map(Number);
    const shifted = new Date(Date.UTC(year!, month! - 1 + (delta.months ?? 0) + 12 * (delta.years ?? 0), 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const local =
    precision === 'instant' ? (timezone ? zonedParts(new Date(value), timezone) : null) : dateParts(value);
  if (!local) return null;
  const shifted = shiftLocal(local, delta);
  if (!shifted) return null;
  if (precision === 'day') return formatDate(shifted);
  return timezone ? zonedLocalToIso(shifted, timezone) : null;
}

function shiftLocal(
  value: LocalDateTime,
  delta: { days?: number; months?: number; years?: number },
): LocalDateTime | null {
  const expectedDay = value.day;
  const shiftedMonth = new Date(
    Date.UTC(
      value.year + (delta.years ?? 0),
      value.month - 1 + (delta.months ?? 0),
      expectedDay,
      value.hour,
      value.minute,
      value.second,
      value.millisecond,
    ),
  );
  // A monthly/yearly recurrence on an absent calendar day is skipped, never shifted into
  // the following month where it would claim a different local-calendar intention.
  const expectedMonth = (((value.month - 1 + (delta.months ?? 0)) % 12) + 12) % 12;
  if (
    (delta.months || delta.years) &&
    (shiftedMonth.getUTCDate() !== expectedDay || shiftedMonth.getUTCMonth() !== expectedMonth)
  ) {
    return null;
  }
  shiftedMonth.setUTCDate(shiftedMonth.getUTCDate() + (delta.days ?? 0));
  return utcParts(shiftedMonth);
}

function afterSeriesEnd(start: string, original: RetainedTime): boolean {
  const until = original.recurrence?.until;
  if (!until) return false;
  if (original.precision === 'instant') return Date.parse(start) > Date.parse(until);
  return start > until;
}

function startsAfterRange(time: RetainedTime, until: string): boolean {
  const start = temporalDateBounds(time).start;
  return start !== null && start > until;
}

function supportedPrecision(
  precision: RetainedTime['precision'],
  frequency: TemporalRecurrence['frequency'],
): boolean {
  if (precision === 'unknown') return false;
  if (precision === 'year') return frequency === 'yearly';
  if (precision === 'month') return frequency === 'monthly' || frequency === 'yearly';
  return true;
}

function weekdayOf(value: string, precision: RetainedTime['precision'], timezone?: string): number {
  if (precision === 'instant') {
    const parts = timezone ? zonedParts(new Date(value), timezone) : null;
    return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() : -1;
  }
  return new Date(`${value}T00:00:00Z`).getUTCDay();
}

function weekdayNumber(value: string): number {
  return { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 }[value] ?? -1;
}

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function dateParts(value: string): LocalDateTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  };
}

function zonedParts(value: Date, timezone: string): LocalDateTime | null {
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
    const out = {
      year: part('year'),
      month: part('month'),
      day: part('day'),
      hour: part('hour'),
      minute: part('minute'),
      second: part('second'),
      millisecond: value.getUTCMilliseconds(),
    };
    return Object.values(out).every(Number.isFinite) ? out : null;
  } catch {
    return null;
  }
}

function zonedLocalToIso(value: LocalDateTime, timezone: string): string | null {
  let guess = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.millisecond,
  );
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = zonedParts(new Date(guess), timezone);
    if (!actual) return null;
    const delta = localStamp(value) - localStamp(actual);
    if (delta === 0) break;
    guess += delta;
  }
  const checked = zonedParts(new Date(guess), timezone);
  return checked && localStamp(checked) === localStamp(value) ? new Date(guess).toISOString() : null;
}

function localStamp(value: LocalDateTime): number {
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

function utcParts(value: Date): LocalDateTime {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
    hour: value.getUTCHours(),
    minute: value.getUTCMinutes(),
    second: value.getUTCSeconds(),
    millisecond: value.getUTCMilliseconds(),
  };
}

function formatDate(value: LocalDateTime): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}
