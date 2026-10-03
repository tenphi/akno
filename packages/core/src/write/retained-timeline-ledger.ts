import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { timelineCatalog, owningTimeline, selectTimelines } from '../timeline/boundaries.ts';
import { sha256 } from '../store/ids.ts';
import {
  managedMemoryPayloadBody,
  managedMemoryPayloadIssue,
  managedMemoryStatusLabels,
  parseManagedMemoryMarker,
  type ManagedMemoryMarker,
} from './managed-memory.ts';

const BEGIN = '<!-- akno:retained-timeline:start -->';
const END = '<!-- akno:retained-timeline:end -->';
// Older entries have no date attribute and hash only their visible text. New entries
// keep the exact sort boundary in the marker so a readable clock cannot reorder them.
const ITEM =
  /^(.*) <!-- akno:timeline-item id=([A-Za-z0-9_-]{4,80}) (?:date=([^\s]+) )?hash=([a-f0-9]{12}) -->$/;
const LEGACY_DATE = /^- (?:until )?(\d{4}(?:-\d{2})?(?:-\d{2})?(?:T[^ ]+)?)\b(?: to \S+)? ·/;
const READABLE_DATE = /^- \*\*(?:[Uu]ntil )?\d{4}(?:-\d{2})?(?:-\d{2})?[^*]*\*\* \|/;
const SORT_DATE = /^\d{4}(?:-\d{2})?(?:-\d{2})?(?:T[^\s]+)?$/;

export interface RetainedPageEdit {
  slug: string;
  before: string | null;
  after: string | null;
}

export interface RetainedLedgerStage {
  slug: string;
  relPath: string;
  before: string | null;
  after: string;
}

interface Entry {
  id: string;
  date: string;
  line: string;
}

/** Stage readable references beside standalone events in the same journal as canonical edits. */
export async function retainedLedgerStages(
  ctx: AknoContext,
  edits: readonly RetainedPageEdit[],
  options: { reconcileAll?: boolean; timeline?: string } = {},
): Promise<RetainedLedgerStage[]> {
  const affected = new Set<string>();
  const desired = new Map<string, { slug: string; entry: Entry }>();
  for (const edit of edits) {
    for (const item of managedEntries(edit.before, edit.slug)) affected.add(item.entry.id);
    for (const item of managedEntries(edit.after, edit.slug)) {
      affected.add(item.entry.id);
      if (desired.has(item.entry.id))
        throw new AknoError('conflict', `managed memory ${item.entry.id} occurs on multiple edited pages`);
      desired.set(item.entry.id, item);
    }
  }
  if (affected.size === 0 && !options.reconcileAll) return [];

  const catalog = timelineCatalog(ctx.config, ctx.store);
  const selected = options.timeline
    ? selectTimelines(catalog, options.timeline)
    : options.reconcileAll
      ? catalog
      : catalog.filter((descriptor) =>
          edits.some((edit) => owningTimeline(catalog, edit.slug).slug === descriptor.slug),
        );
  const ledgers = new Map<
    string,
    { descriptor: (typeof catalog)[number]; before: string | null; entries: Map<string, Entry> }
  >();
  for (const descriptor of selected) {
    const before = await fsp
      .readFile(path.join(ctx.config.aknoPath, descriptor.path), 'utf8')
      .catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && descriptor.status === 'virtual')
          return null;
        throw new AknoError('unavailable', `timeline ${descriptor.slug} cannot be read`);
      });
    const entries = parseSection(before, descriptor.slug);
    ledgers.set(descriptor.slug, { descriptor, before, entries });
  }
  if (options.reconcileAll)
    for (const ledger of ledgers.values()) for (const id of ledger.entries.keys()) affected.add(id);
  if (affected.size === 0) return [];

  for (const ledger of ledgers.values()) {
    for (const id of affected) {
      if (!ledger.entries.has(id)) continue;
      if (!ledger.descriptor.writable)
        throw new AknoError('conflict', `timeline ${ledger.descriptor.slug} is unavailable or read-only`);
      ledger.entries.delete(id);
    }
  }
  const residentIds = new Map<string, string>();
  for (const ledger of ledgers.values()) {
    for (const id of ledger.entries.keys()) {
      const previous = residentIds.get(id);
      if (previous)
        throw new AknoError(
          'conflict',
          `managed memory ${id} occurs in both ${previous} and ${ledger.descriptor.slug}`,
        );
      residentIds.set(id, ledger.descriptor.slug);
    }
  }
  for (const item of desired.values()) {
    const descriptor = owningTimeline(catalog, item.slug);
    if (!ledgers.has(descriptor.slug)) continue;
    if (!descriptor.writable)
      throw new AknoError('conflict', `timeline ${descriptor.slug} is unavailable or read-only`);
    ledgers.get(descriptor.slug)!.entries.set(item.entry.id, item.entry);
  }

  for (const ledger of ledgers.values()) {
    for (const [id, entry] of ledger.entries) {
      const match = ITEM.exec(entry.line);
      if (!match?.[3]) continue;
      const base = match[1]!.replace(
        /\[(same event|explicit update of|corrects|disagrees with|fulfills|answers|caused by)\]\(#akno-([A-Za-z0-9_-]+)\)(?: \(assertion unavailable\))?/gu,
        (_reference, label: string, target: string) =>
          `[${label}](#akno-${target})${ledger.entries.has(target) ? '' : ' (assertion unavailable)'}`,
      );
      if (base !== match[1])
        ledger.entries.set(id, {
          ...entry,
          line: `${base} <!-- akno:timeline-item id=${id} date=${entry.date} hash=${sha256(`${base}\0${entry.date}`).slice(0, 12)} -->`,
        });
    }
  }

  const staged: RetainedLedgerStage[] = [];
  for (const ledger of ledgers.values()) {
    const after = renderSection(ledger.before, ledger.entries);
    if (after === null || after === ledger.before) continue;
    staged.push({
      slug: ledger.descriptor.slug,
      relPath: ledger.descriptor.path,
      before: ledger.before,
      after,
    });
  }
  return staged;
}

function managedEntries(content: string | null, slug: string): { slug: string; entry: Entry }[] {
  if (!content) return [];
  const lines = content.split('\n');
  const entries: { slug: string; entry: Entry }[] = [];
  for (let index = 0; index < lines.length - 1; index++) {
    const marker = parseManagedMemoryMarker(lines[index]!);
    if (!marker?.time || marker.time.precision === 'unknown') continue;
    const date = marker.time.start ?? marker.time.until;
    if (!date) continue;
    const rawPayload = lines[index + 1]!.trim();
    if (
      !rawPayload ||
      /^(?:<!--|#{1,6}\s)/.test(rawPayload) ||
      managedMemoryPayloadIssue(marker, rawPayload) !== null
    )
      continue;
    const body = managedMemoryPayloadBody(marker, rawPayload);
    if (!body?.trim()) continue;
    entries.push({ slug, entry: renderEntry(marker, body, slug, date) });
  }
  return entries;
}

function renderEntry(marker: ManagedMemoryMarker, body: string, slug: string, date: string): Entry {
  const time = marker.time!;
  const sourceLabel = managedMemoryStatusLabels(marker).find((label) => label.startsWith('Reported by '));
  const reporter = sourceLabel?.slice('Reported by '.length);
  // The candidate text keeps its outer source for standalone safety. In this derived
  // ledger the qualifier carries that source, so remove only an exact opening relay.
  const readableBody = reporter ? stripOpeningReport(body, reporter) : body;
  const qualifications = [
    ...(time.relation === 'due'
      ? [`${time.status === 'actual' ? '' : `${time.status} `}deadline`]
      : [
          ...(time.status === 'actual' ? [] : [time.status]),
          ...(time.relation === 'occurred' || time.relation === time.status ? [] : [time.relation]),
        ]),
    ...(marker.kind === 'plan'
      ? [marker.disposition === 'proposed' ? 'proposal' : 'plan']
      : marker.kind === 'event'
        ? []
        : [marker.kind]),
    ...(marker.commitment !== 'asserted' ? [marker.commitment] : []),
    ...(marker.kind === 'plan' && marker.disposition === 'proposed'
      ? []
      : marker.disposition !== 'active'
        ? [marker.disposition]
        : []),
    ...(reporter ? [`reported by ${reporter}`] : []),
  ];
  const label = time.start
    ? `${readableBoundary(date)}${time.until && time.until !== date ? ` – ${readableBoundary(time.until)}` : ''}`
    : `Until ${readableBoundary(date)}`;
  const clean = readableBody.replace(/\s+/g, ' ').replaceAll('<!--', '&lt;!--');
  const qualifier = [...new Set(qualifications)].join(' · ');
  const annotation = qualifier ? `*${qualifier[0]!.toUpperCase()}${qualifier.slice(1)}* — ` : '';
  const references = marker.links.flatMap((link) => {
    if (!link.target.startsWith('memory:')) return [];
    const relationLabel = {
      same_event: 'same event',
      supersedes: 'explicit update of',
      corrects: 'corrects',
      contradicts: 'disagrees with',
      fulfills: 'fulfills',
      answers: 'answers',
      caused_by: 'caused by',
    }[link.type];
    return [`[${relationLabel}](#akno-${link.target.slice('memory:'.length)})`];
  });
  const related = references.length ? ` · ${references.join(' · ')}` : '';
  const base = `- **${label}** | ${annotation}${clean} [[${slug}]]${related} <a id="akno-${marker.id}"></a>`;
  return {
    id: marker.id,
    date,
    line: `${base} <!-- akno:timeline-item id=${marker.id} date=${date} hash=${sha256(`${base}\0${date}`).slice(0, 12)} -->`,
  };
}

function stripOpeningReport(body: string, reporter: string): string {
  const escaped = reporter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opening = new RegExp(
    `^(?:${escaped}(?:[’']s (?:digest|report))? (?:reports|reported|says|said|states|stated)(?: that)? |According to ${escaped}, |Reported by ${escaped}: )`,
    'iu',
  );
  const stripped = body.replace(opening, '');
  return stripped.trim() ? stripped : body;
}

function readableBoundary(value: string): string {
  const instant = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!instant) return value;
  const [, day, minute, second, fraction, offset] = instant;
  const clock = `${minute}${second && (second !== '00' || fraction) ? `:${second}${fraction ?? ''}` : ''}`;
  return `${day}, ${clock} ${offset === 'Z' ? 'UTC' : `UTC${offset}`}`;
}

/** Historical transfers must not edit a ledger whose generated references have lost their identity. */
export function retainedTimelineLedgerValid(content: string): boolean {
  try {
    parseSection(content, '');
    return true;
  } catch {
    return false;
  }
}

function parseSection(content: string | null, slug: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  if (content === null) return entries;
  const lines = content.split('\n');
  const begin = lines.indexOf(BEGIN);
  const end = lines.indexOf(END);
  if (
    (begin === -1) !== (end === -1) ||
    (begin !== -1 && (end <= begin || lines.lastIndexOf(BEGIN) !== begin || lines.lastIndexOf(END) !== end))
  )
    throw new AknoError('conflict', `timeline ${slug} has an invalid managed section`);
  const candidates = begin === -1 ? lines : lines.slice(begin + 1, end);
  if (
    begin !== -1 &&
    lines.some((line, index) => (index < begin || index > end) && line.includes('akno:timeline-item'))
  )
    throw new AknoError('conflict', `timeline ${slug} mixes managed section and inline entries`);
  for (const line of candidates) {
    if (!line.trim()) continue;
    if (begin === -1 && !line.includes('akno:timeline-item')) continue;
    const match = ITEM.exec(line);
    const sortDate = match?.[3];
    const hashInput = match && (sortDate ? `${match[1]}\0${sortDate}` : match[1]);
    if (!match || !hashInput || sha256(hashInput).slice(0, 12) !== match[4])
      throw new AknoError('conflict', `timeline ${slug} has a modified managed entry`);
    const id = match[2]!;
    if (entries.has(id)) throw new AknoError('conflict', `timeline ${slug} repeats managed memory ${id}`);
    let date = LEGACY_DATE.exec(match[1]!)?.[1] ?? null;
    if (sortDate) date = READABLE_DATE.test(match[1]!) && SORT_DATE.test(sortDate) ? sortDate : null;
    if (!date) throw new AknoError('conflict', `timeline ${slug} has an invalid managed date`);
    entries.set(id, { id, date, line });
  }
  return entries;
}

function renderSection(content: string | null, entries: Map<string, Entry>): string | null {
  if (content === null && entries.size === 0) return null;
  const ordered = [...entries.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  const base = content?.trim().length ? content : '# Timeline\n';
  const lines = base.split('\n');
  const begin = lines.indexOf(BEGIN);
  if (begin !== -1) {
    const end = lines.indexOf(END);
    let removeFrom = begin;
    // The old section title was generated by Akno. Remove it only when it is
    // immediately adjacent; any intervening prose belongs to the person.
    let preceding = begin - 1;
    while (preceding >= 0 && !lines[preceding]!.trim()) preceding--;
    if (lines[preceding] === '## Retained memories' && lines.slice(end + 1).every((line) => !line.trim()))
      removeFrom = preceding;
    lines.splice(removeFrom, end - removeFrom + 1);
  }
  // parseSection validated every owned row before this call. No standalone
  // event is removed or regenerated; an edit to a managed row fails closed.
  for (let index = lines.length - 1; index >= 0; index--)
    if (ITEM.test(lines[index]!)) lines.splice(index, 1);
  for (const entry of ordered) insertManagedLine(lines, entry);
  const trailing = content?.match(/\n*$/)?.[0] ?? '\n';
  return `${lines.join('\n').replace(/\n*$/, '')}${trailing}`;
}

const DATED_LINE = /^\s*[-*]\s+\*\*(?:[Uu]ntil )?(\d{4}(?:-\d{2})?(?:-\d{2})?)(?:\*\*|\b)/;
const YEAR_HEADING = /^## (\d{4})\s*$/;

function insertManagedLine(lines: string[], entry: Entry): void {
  const year = entry.date.slice(0, 4);
  const headings = lines.flatMap((line, index) => {
    const match = YEAR_HEADING.exec(line);
    return match ? [{ index, year: match[1]! }] : [];
  });
  const target = headings.find((heading) => heading.year === year);
  if (!target) {
    const older = headings.find((heading) => heading.year < year);
    const at = older?.index ?? lines.length;
    const block = [
      ...(at > 0 && lines[at - 1]!.trim() ? [''] : []),
      `## ${year}`,
      entry.line,
      ...(at < lines.length ? [''] : []),
    ];
    lines.splice(at, 0, ...block);
    return;
  }
  let end = lines.findIndex((line, index) => index > target.index && /^##\s+/.test(line));
  if (end === -1) end = lines.length;
  while (end > target.index + 1 && !lines[end - 1]!.trim()) end--;
  let at = target.index + 1;
  while (at < end && !lines[at]!.trim()) at++;
  const day = entry.date.slice(0, 10);
  for (let index = at; index < end; index++) {
    const existing = DATED_LINE.exec(lines[index]!)?.[1];
    if (existing && existing < day) {
      at = index;
      break;
    }
    at = index + 1;
  }
  lines.splice(at, 0, entry.line);
}

/**
 * Explicit migration may reorder a simple dated ledger. Ordinary retain/write
 * paths only insert their own lines; this is the one place older standalone
 * events can move, with their exact text captured in the undo journal.
 */
export function normalizeTimelineLedger(content: string): string {
  const lines = content.replace(/\n$/, '').split('\n');
  const first = lines.findIndex((line) => YEAR_HEADING.test(line) || DATED_LINE.test(line));
  if (first === -1) return content;
  const records: { line: string; date: string; managed: boolean; index: number }[] = [];
  for (let index = first; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.trim() || YEAR_HEADING.test(line)) continue;
    const date = DATED_LINE.exec(line)?.[1];
    if (!date) return content; // prose or another section is not ours to rearrange
    records.push({ line, date, managed: ITEM.test(line), index });
  }
  if (records.length === 0) return content;
  const headings = lines.slice(first).flatMap((line) => YEAR_HEADING.exec(line)?.[1] ?? []);
  if (
    new Set(headings).size !== headings.length ||
    headings.some((year) => !records.some((record) => record.date.startsWith(year)))
  )
    return content; // preserve intentionally empty or repeated year sections
  records.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      Number(a.managed) - Number(b.managed) ||
      (a.managed && b.managed
        ? (ITEM.exec(b.line)?.[3] ?? '').localeCompare(ITEM.exec(a.line)?.[3] ?? '')
        : 0) ||
      a.index - b.index,
  );
  const grouped: string[] = [];
  let year = '';
  for (const record of records) {
    const nextYear = record.date.slice(0, 4);
    if (nextYear !== year) {
      if (year) grouped.push('');
      grouped.push(`## ${nextYear}`);
      year = nextYear;
    }
    grouped.push(record.line);
  }
  return `${lines.slice(0, first).join('\n').replace(/\n*$/, '')}\n\n${grouped.join('\n')}\n`;
}
