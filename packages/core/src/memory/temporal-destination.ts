import type { RetainedTime } from '@tenphi/akno-protocol';

const MONTHS = new Map(
  [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].map((month, index) => [month, String(index + 1).padStart(2, '0')]),
);

export interface RetainedTemporalBoundary {
  start: string;
  until?: string;
}

/** Use typed time first, then one unambiguous year-bearing date already visible in the sentence. */
export function retainedTemporalBoundary(
  time: Pick<RetainedTime, 'start' | 'until'> | undefined,
  text: string,
): RetainedTemporalBoundary | undefined {
  if (time?.start || time?.until) {
    return {
      start: time.start ?? time.until!,
      ...(time.start && time.until ? { until: time.until } : {}),
    };
  }

  const months = new Set<string>();
  const days = new Set<string>();
  const add = (year: string, month: string, day?: string): void => {
    if (!validYearMonth(year, month)) return;
    if (day && !validCalendarDay(year, month, day)) return;
    const period = `${year}-${month}`;
    months.add(period);
    if (day) days.add(`${period}-${day.padStart(2, '0')}`);
  };

  for (const match of text.matchAll(/\b(20\d{2})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?\b/g)) {
    add(match[1]!, match[2]!, match[3]);
  }
  for (const match of text.matchAll(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*)?(20\d{2})\b/gi,
  )) {
    add(match[3]!, MONTHS.get(match[1]!.toLowerCase())!, match[2]);
  }
  for (const match of text.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*(20\d{2})\b/gi,
  )) {
    add(match[3]!, MONTHS.get(match[2]!.toLowerCase())!, match[1]);
  }

  if (months.size !== 1) return undefined;
  return { start: days.size === 1 ? [...days][0]! : [...months][0]! };
}

export function pageAcceptsTemporalBoundary(
  slug: string,
  boundary: RetainedTemporalBoundary | undefined,
): boolean {
  if (!boundary) return true;
  const scoped = pageTemporalBoundary(slug);
  return scoped
    ? [boundary.start, boundary.until]
        .filter((value): value is string => Boolean(value))
        .every((value) => value.slice(0, scoped.length) === scoped)
    : true;
}

/** The exact calendar scope encoded by a period bucket basename, when it has one. */
export function pageTemporalBoundary(slug: string): string | undefined {
  const basename = slug.slice(slug.lastIndexOf('/') + 1);
  const day =
    /^(\d{4}-\d{2}-\d{2})(?:$|[-_](?:activity|journal|log|notes?|records?|review|summary|timeline))$/i.exec(
      basename,
    )?.[1];
  return day ?? /^(\d{4}-\d{2})$/.exec(basename)?.[1];
}

function validYearMonth(year: string, month: string): boolean {
  return /^20\d{2}$/.test(year) && /^(?:0[1-9]|1[0-2])$/.test(month);
}

function validCalendarDay(year: string, month: string, day: string): boolean {
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    value.getUTCFullYear() === Number(year) &&
    value.getUTCMonth() === Number(month) - 1 &&
    value.getUTCDate() === Number(day)
  );
}
