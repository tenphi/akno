import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { timelineCatalog, owningTimeline } from '../timeline/boundaries.ts';
import { sha256 } from '../store/ids.ts';
import { parseManagedMemoryMarker, type ManagedMemoryMarker } from './managed-memory.ts';

const BEGIN = '<!-- akno:retained-timeline:start -->';
const END = '<!-- akno:retained-timeline:end -->';
const ITEM = /^(.*) <!-- akno:timeline-item id=([A-Za-z0-9_-]{4,80}) hash=([a-f0-9]{12}) -->$/;

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

/**
 * Stage the readable ledger projection in the same journal as its canonical page edits.
 * The managed section has its own syntax so the authored-event parser never counts a
 * reference as a second event. Indexing can always rebuild query projections without
 * rewriting these source files.
 */
export async function retainedLedgerStages(
  ctx: AknoContext,
  edits: readonly RetainedPageEdit[],
  options: { reconcileAll?: boolean } = {},
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
  const selected = options.reconcileAll
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
    if (!descriptor.writable)
      throw new AknoError('conflict', `timeline ${descriptor.slug} is unavailable or read-only`);
    ledgers.get(descriptor.slug)!.entries.set(item.entry.id, item.entry);
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
    if (!/^\s*[-*]\s+/.test(lines[index + 1]!)) continue;
    const payload = lines[index + 1]!.replace(/^\s*[-*]\s+/, '').trim();
    if (!payload || payload.startsWith('<!--')) continue;
    entries.push({ slug, entry: renderEntry(marker, payload, slug, date) });
  }
  return entries;
}

function renderEntry(marker: ManagedMemoryMarker, payload: string, slug: string, date: string): Entry {
  const time = marker.time!;
  const qualifications = [
    time.status,
    time.relation,
    marker.kind,
    ...(marker.commitment !== 'asserted' ? [marker.commitment] : []),
    ...(marker.basis === 'source_report' ? ['reported'] : []),
    ...(marker.disposition !== 'active' ? [marker.disposition] : []),
  ];
  const label = time.start
    ? `${date}${time.until && time.until !== date ? ` to ${time.until}` : ''}`
    : `until ${date}`;
  const clean = payload.replace(/\s+/g, ' ').replaceAll('<!--', '&lt;!--');
  const base = `- ${label} · ${qualifications.join(' / ')} · ${clean} [[${slug}]]`;
  return {
    id: marker.id,
    date,
    line: `${base} <!-- akno:timeline-item id=${marker.id} hash=${sha256(base).slice(0, 12)} -->`,
  };
}

function parseSection(content: string | null, slug: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  if (content === null) return entries;
  const lines = content.split('\n');
  const begin = lines.indexOf(BEGIN);
  const end = lines.indexOf(END);
  if (begin === -1 && end === -1) return entries;
  if (begin < 0 || end <= begin || lines.lastIndexOf(BEGIN) !== begin || lines.lastIndexOf(END) !== end)
    throw new AknoError('conflict', `timeline ${slug} has an invalid managed section`);
  for (const line of lines.slice(begin + 1, end)) {
    if (!line.trim()) continue;
    const match = ITEM.exec(line);
    if (!match || sha256(match[1]!).slice(0, 12) !== match[3])
      throw new AknoError('conflict', `timeline ${slug} has a modified managed entry`);
    const id = match[2]!;
    if (entries.has(id)) throw new AknoError('conflict', `timeline ${slug} repeats managed memory ${id}`);
    const date = /^- (?:until )?(\d{4}(?:-\d{2})?(?:-\d{2})?(?:T[^ ]+)?)\b(?: to \S+)? ·/.exec(
      match[1]!,
    )?.[1];
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
  if (begin === -1) {
    if (ordered.length === 0) return content;
    return `${base.replace(/\n*$/, '')}\n\n## Retained memories\n\n${BEGIN}\n${ordered.map((entry) => entry.line).join('\n')}\n${END}\n`;
  }
  const end = lines.indexOf(END);
  lines.splice(begin + 1, end - begin - 1, ...ordered.map((entry) => entry.line));
  return lines.join('\n');
}
