import { parseFrontmatter } from '../kb/frontmatter.ts';

export interface TemporalMetadata {
  kind: 'event';
  start?: string;
  until: string;
  timezone?: string;
}

export interface TemporalClock {
  now: string;
  timezone: string;
  localDate: string;
}

export interface TemporalInferenceInput {
  slug: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface TemporalDeclaration {
  metadata: TemporalMetadata | null;
  disabled: boolean;
  invalid: boolean;
}

const MONTHS = new Map([
  ['january', 1],
  ['february', 2],
  ['march', 3],
  ['april', 4],
  ['may', 5],
  ['june', 6],
  ['july', 7],
  ['august', 8],
  ['september', 9],
  ['october', 10],
  ['november', 11],
  ['december', 12],
  ['jan', 1],
  ['feb', 2],
  ['mar', 3],
  ['apr', 4],
  ['jun', 6],
  ['jul', 7],
  ['aug', 8],
  ['sep', 9],
  ['sept', 9],
  ['oct', 10],
  ['nov', 11],
  ['dec', 12],
] as const);
const MONTH_PATTERN =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
const EVENT_LANGUAGE =
  /\b(?:event|trip|travel|vacation|visit|concert|conference|appointment|stay|itinerary)\b/i;

export function temporalClock(now = new Date(), timezone = systemTimezone()): TemporalClock {
  return {
    now: now.toISOString(),
    timezone,
    localDate: dateInTimezone(now, timezone),
  };
}

export function readTemporalDeclaration(frontmatter: Record<string, unknown>): TemporalDeclaration {
  const akno = objectValue(frontmatter.akno);
  if (!akno || !Object.hasOwn(akno, 'temporal')) {
    return { metadata: null, disabled: false, invalid: false };
  }
  if (akno.temporal === false) return { metadata: null, disabled: true, invalid: false };
  const metadata = cleanTemporal(akno.temporal);
  return { metadata, disabled: false, invalid: metadata === null };
}

/**
 * Infers only boundaries whose complete date is already present in structured metadata, a
 * date-range slug, or nearby event language. It never turns the latest historical date on an
 * evergreen subject page into that page's expiry date.
 */
export function inferTemporalMetadata(input: TemporalInferenceInput): TemporalMetadata | null {
  const declaration = readTemporalDeclaration(input.frontmatter);
  if (declaration.metadata || declaration.disabled || declaration.invalid) return declaration.metadata;

  const timezone = readTimezone(input.frontmatter);
  const dates = typeof input.frontmatter.dates === 'string' ? input.frontmatter.dates : '';
  const structured = isoRange(dates);
  if (structured) return withTimezone(structured, timezone);

  const slugRange = rangeFromSlug(input.slug);
  if (slugRange) return withTimezone(slugRange, timezone);

  const text = `${input.title}\n${input.body.slice(0, 12_000)}`;
  const proseRange = rangeNearEventLanguage(text);
  return proseRange ? withTimezone(proseRange, timezone) : null;
}

/** Date candidates are passed to the model, which may select one but may not invent another. */
export function temporalBoundaryCandidates(input: TemporalInferenceInput): string[] {
  const out = new Set<string>();
  const add = (metadata: TemporalMetadata | null): void => {
    if (!metadata) return;
    if (metadata.start) out.add(datePart(metadata.start));
    out.add(datePart(metadata.until));
  };
  add(isoRange(typeof input.frontmatter.dates === 'string' ? input.frontmatter.dates : ''));
  add(rangeFromSlug(input.slug));
  add(rangeNearEventLanguage(`${input.title}\n${input.body.slice(0, 12_000)}`));
  for (const match of `${input.title}\n${input.body.slice(0, 12_000)}`.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    if (validDate(match[0])) out.add(match[0]);
  }
  return [...out].sort();
}

export function cleanTemporalProposal(
  value: unknown,
  candidates: string[],
): { metadata: TemporalMetadata | null; issue: string | null } {
  if (value === undefined || value === null || value === false) return { metadata: null, issue: null };
  const metadata = cleanTemporal(value);
  if (!metadata) return { metadata: null, issue: 'the proposed temporal boundary is malformed' };
  const allowed = new Set(candidates);
  if (!allowed.has(datePart(metadata.until))) {
    return { metadata: null, issue: `the proposed event end is not supplied by the page: ${metadata.until}` };
  }
  if (metadata.start && !allowed.has(datePart(metadata.start))) {
    return {
      metadata: null,
      issue: `the proposed event start is not supplied by the page: ${metadata.start}`,
    };
  }
  return { metadata, issue: null };
}

export function temporalState(metadata: TemporalMetadata, clock: TemporalClock): 'active' | 'past' {
  if (isDate(metadata.until)) {
    const local = dateInTimezone(new Date(clock.now), metadata.timezone ?? clock.timezone);
    return local > metadata.until ? 'past' : 'active';
  }
  return Date.parse(clock.now) > Date.parse(metadata.until) ? 'past' : 'active';
}

export function temporalPrompt(metadata: TemporalMetadata | null, clock: TemporalClock): string {
  const lines = [`Current time: ${clock.now}`, `System timezone: ${clock.timezone}`];
  if (metadata) {
    lines.push(`Temporal page: event`, ...(metadata.start ? [`Starts: ${metadata.start}`] : []));
    lines.push(`Ends: ${metadata.until}`, `Temporal state: ${temporalState(metadata, clock)}`);
    if (metadata.timezone) lines.push(`Event timezone: ${metadata.timezone}`);
  }
  return lines.join('\n');
}

/**
 * Adds only Akno's own temporal key without parsing and re-emitting the rest of the YAML.
 * An unusual inline `akno: {...}` declaration is left for a human rather than duplicated.
 */
export function withTemporalMetadata(content: string, metadata: TemporalMetadata): string | null {
  const fm = parseFrontmatter(content);
  const declaration = readTemporalDeclaration(fm.data);
  if (declaration.metadata || declaration.disabled || declaration.invalid) return content;

  const block = temporalYaml(metadata);
  if (!fm.present) return `---\nakno:\n${block}---\n\n${content}`;

  const head = content.slice(0, fm.bodyOffset);
  const akno = /^akno:[ \t]*\r?$/m.exec(head);
  if (akno?.index !== undefined) {
    const newline = head.indexOf('\n', akno.index);
    if (newline < 0) return null;
    return `${head.slice(0, newline + 1)}${block}${head.slice(newline + 1)}${content.slice(fm.bodyOffset)}`;
  }
  if (objectValue(fm.data.akno)) return null;

  const close = head.lastIndexOf('---');
  if (close <= 0) return null;
  return `${head.slice(0, close)}akno:\n${block}${head.slice(close)}${content.slice(fm.bodyOffset)}`;
}

function temporalYaml(metadata: TemporalMetadata): string {
  return (
    `  temporal:\n` +
    `    kind: event\n` +
    (metadata.start ? `    start: ${JSON.stringify(metadata.start)}\n` : '') +
    `    until: ${JSON.stringify(metadata.until)}\n` +
    (metadata.timezone ? `    timezone: ${JSON.stringify(metadata.timezone)}\n` : '')
  );
}

function cleanTemporal(value: unknown): TemporalMetadata | null {
  const record = objectValue(value);
  if (!record || record.kind !== 'event' || typeof record.until !== 'string') return null;
  const until = cleanBoundary(record.until);
  const start = typeof record.start === 'string' ? cleanBoundary(record.start) : null;
  if (!until || (typeof record.start === 'string' && !start)) return null;
  if (start && Date.parse(boundaryInstant(start, false)) > Date.parse(boundaryInstant(until, true)))
    return null;
  const timezone =
    typeof record.timezone === 'string' && validTimezone(record.timezone) ? record.timezone : null;
  return {
    kind: 'event',
    ...(start ? { start } : {}),
    until,
    ...(timezone ? { timezone } : {}),
  };
}

function cleanBoundary(value: string): string | null {
  if (isDate(value)) return validDate(value) ? value : null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function isoRange(text: string): TemporalMetadata | null {
  const match = /(\d{4}-\d{2}-\d{2})\s*(?:to|through|[-–‑—])\s*(\d{4}-\d{2}-\d{2})/i.exec(text);
  if (!match || !validDate(match[1]!) || !validDate(match[2]!)) return null;
  return orderedRange(match[1]!, match[2]!);
}

function rangeFromSlug(slug: string): TemporalMetadata | null {
  const basename = slug.split('/').at(-1) ?? slug;
  const match = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(?:-|$)/.exec(basename);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const first = Number(match[3]);
  const last = Number(match[4]);
  const start = ymd(year, month, first);
  const endDate = new Date(Date.UTC(year, month - 1 + (last < first ? 1 : 0), last));
  const until = endDate.toISOString().slice(0, 10);
  return start && validDate(until) ? orderedRange(start, until) : null;
}

function rangeNearEventLanguage(text: string): TemporalMetadata | null {
  const sameMonth = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\s*[-–‑—]\\s*(\\d{1,2})(?:,)?\\s+(\\d{4})\\b`,
    'i',
  );
  const crossMonth = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\s*[-–‑—]\\s*(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,)?\\s+(\\d{4})\\b`,
    'i',
  );
  for (const pattern of [crossMonth, sameMonth]) {
    const match = pattern.exec(text);
    if (!match || match.index === undefined) continue;
    const nearby = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    if (!EVENT_LANGUAGE.test(nearby)) continue;
    if (pattern === crossMonth) {
      const year = Number(match[5]);
      const start = ymd(year, monthNumber(match[1]!), Number(match[2]));
      const until = ymd(year, monthNumber(match[3]!), Number(match[4]));
      if (start && until) return orderedRange(start, until);
    } else {
      const year = Number(match[4]);
      const month = monthNumber(match[1]!);
      const start = ymd(year, month, Number(match[2]));
      const until = ymd(year, month, Number(match[3]));
      if (start && until) return orderedRange(start, until);
    }
  }
  return null;
}

function orderedRange(start: string, until: string): TemporalMetadata | null {
  return Date.parse(`${start}T00:00:00Z`) <= Date.parse(`${until}T23:59:59Z`)
    ? { kind: 'event', start, until }
    : null;
}

function withTimezone(metadata: TemporalMetadata, timezone: string | null): TemporalMetadata {
  return timezone ? { ...metadata, timezone } : metadata;
}

function readTimezone(frontmatter: Record<string, unknown>): string | null {
  const value = frontmatter.timezone;
  return typeof value === 'string' && validTimezone(value) ? value : null;
}

function monthNumber(value: string): number {
  return MONTHS.get(value.toLowerCase() as never) ?? 0;
}

function ymd(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return validDate(value) ? value : null;
}

function validDate(value: string): boolean {
  if (!isDate(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function boundaryInstant(value: string, endOfDay: boolean): string {
  return isDate(value) ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z` : value;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
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
