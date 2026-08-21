import path from 'node:path';
import type { DocumentTextSource, DocumentTimelineEvidence } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { canSuggestDocumentAdoption } from '../ingest/adoption-eligibility.ts';
import { documentAvailability } from '../ingest/availability.ts';
import { sha256 } from '../store/ids.ts';

export interface DocumentTimelineOptions {
  since?: string;
  until?: string;
  match?: string;
  subject?: string;
}

interface DocumentDateRow {
  id: string;
  rel_path: string;
  mime: string | null;
  label: string | null;
  text: string | null;
  page_count: number | null;
  group_key: string | null;
  part: number;
  ocr: number;
  extract_via: string | null;
  confidence: number | null;
  availability: 'available' | 'missing';
  missing_since: string | null;
  file_created_at: string | null;
  file_modified_at: string | null;
}

interface DocumentChunkRow {
  document_id: string;
  text: string;
  doc_page: number | null;
}

interface ExtractedDate {
  date: string;
  raw: string;
  start: number;
}

const MAX_EXTRACTED_DATES_PER_DOCUMENT = 32;

/**
 * Assemble dated orphan evidence without giving it event semantics. Extracted dates
 * win; filesystem metadata is a visibly labelled fallback when the document states no
 * date itself.
 */
export function documentTimelineEvidence(
  ctx: AknoContext,
  options: DocumentTimelineOptions,
): DocumentTimelineEvidence[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT id, rel_path, mime, label, text, page_count, group_key, part, ocr,
              extract_via, confidence, availability, missing_since,
              file_created_at, file_modified_at
         FROM documents
        WHERE page_id IS NULL AND renders IS NULL
        ORDER BY group_key, part`,
    )
    .all() as DocumentDateRow[];

  const groups = new Map<string, DocumentDateRow[]>();
  for (const row of rows) {
    const key = row.group_key ?? row.rel_path;
    const current = groups.get(key);
    if (current) current.push(row);
    else groups.set(key, [row]);
  }

  const out: DocumentTimelineEvidence[] = [];
  for (const [groupKey, parts] of groups) {
    const first = parts[0]!;
    if (!matchesSubject(parts, groupKey, options.subject)) continue;
    const availability = documentAvailability(ctx.store.db, parts);
    const chunks = chunksFor(ctx, parts);
    const dated = extractedEvidence(ctx, first, parts, chunks, availability, options);
    if (hasExtractedDocumentDate(parts, chunks)) {
      out.push(...dated.slice(0, MAX_EXTRACTED_DATES_PER_DOCUMENT));
      continue;
    }

    const metadata = metadataEvidence(ctx, first, parts, chunks, availability, options);
    if (metadata) out.push(metadata);
  }
  return out;
}

function extractedEvidence(
  ctx: AknoContext,
  first: DocumentDateRow,
  parts: DocumentDateRow[],
  chunks: DocumentChunkRow[],
  availability: DocumentTimelineEvidence['availability'],
  options: DocumentTimelineOptions,
): DocumentTimelineEvidence[] {
  const seen = new Set<string>();
  const out: DocumentTimelineEvidence[] = [];
  for (const chunk of chunks) {
    const part = parts.find((candidate) => candidate.id === chunk.document_id) ?? first;
    // A vision description is model-generated evidence about the source, not text
    // extracted from it. Dates in it must not acquire stronger provenance here.
    if (part.extract_via === 'vision') continue;
    for (const found of extractDocumentDates(chunk.text)) {
      if (seen.has(found.date) || !withinRange(found.date, options)) continue;
      const quote = quoteAround(chunk.text, found.start, ctx.config.recall.sourceQuoteLines);
      if (!matchesText(options.match, first, quote)) continue;
      seen.add(found.date);
      out.push({
        type: 'document_evidence',
        id: evidenceId(first.id, found.date, 'extracted', `${chunk.document_id}:${found.raw}`),
        date: found.date,
        date_basis: 'extracted',
        document_id: first.id,
        path: first.rel_path,
        label: first.label ?? path.basename(first.rel_path),
        mime: first.mime,
        ...(chunk.doc_page !== null ? { matched_page: chunk.doc_page } : {}),
        quote,
        text_source: textSource(part),
        availability,
        ...suggestedAction(ctx, first, parts, availability.status),
      });
    }
  }
  return out;
}

function hasExtractedDocumentDate(parts: DocumentDateRow[], chunks: DocumentChunkRow[]): boolean {
  return chunks.some((chunk) => {
    const part = parts.find((candidate) => candidate.id === chunk.document_id);
    return part?.extract_via !== 'vision' && extractDocumentDates(chunk.text).length > 0;
  });
}

function metadataEvidence(
  ctx: AknoContext,
  first: DocumentDateRow,
  parts: DocumentDateRow[],
  chunks: DocumentChunkRow[],
  availability: DocumentTimelineEvidence['availability'],
  options: DocumentTimelineOptions,
): DocumentTimelineEvidence | null {
  const created = parts
    .map((part) => part.file_created_at)
    .filter((value): value is string => value !== null)
    .sort()[0];
  const modified = parts
    .map((part) => part.file_modified_at)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);
  const createdDate = timestampDate(created);
  const modifiedDate = timestampDate(modified);
  const useCreated = createdDate !== null && (modifiedDate === null || createdDate === modifiedDate);
  const date = useCreated ? createdDate : (modifiedDate ?? createdDate);
  if (!date || !withinRange(date, options)) return null;

  const haystack = chunks.map((chunk) => chunk.text).join('\n');
  if (!matchesText(options.match, first, haystack)) return null;
  const basis = useCreated ? 'file_created' : 'file_modified';
  return {
    type: 'document_evidence',
    id: evidenceId(first.id, date, basis, first.rel_path),
    date,
    date_basis: basis,
    document_id: first.id,
    path: first.rel_path,
    label: first.label ?? path.basename(first.rel_path),
    mime: first.mime,
    availability,
    ...suggestedAction(ctx, first, parts, availability.status),
  };
}

function chunksFor(ctx: AknoContext, parts: DocumentDateRow[]): DocumentChunkRow[] {
  const ids = parts.map((part) => part.id);
  if (ids.length === 0) return [];
  return ctx.store.db
    .prepare(
      `SELECT c.document_id, c.text, c.doc_page
         FROM chunks c JOIN documents d ON d.id = c.document_id
        WHERE c.document_id IN (${ids.map(() => '?').join(',')}) AND c.text != ''
        ORDER BY d.part, c.ord`,
    )
    .all(...ids) as DocumentChunkRow[];
}

function suggestedAction(
  ctx: AknoContext,
  first: DocumentDateRow,
  parts: DocumentDateRow[],
  status: DocumentTimelineEvidence['availability']['status'],
): Pick<DocumentTimelineEvidence, 'suggested_actions'> | Record<string, never> {
  if (
    status !== 'available' ||
    !parts.some((part) => part.text !== null) ||
    !canSuggestDocumentAdoption(ctx.config, first.rel_path)
  ) {
    return {};
  }
  return { suggested_actions: [{ op: 'adopt', args: { documentId: first.id } }] };
}

function textSource(row: DocumentDateRow): DocumentTextSource {
  const via =
    row.extract_via === 'plain' ||
    row.extract_via === 'textutil' ||
    row.extract_via === 'text-layer' ||
    row.extract_via === 'ocr' ||
    row.extract_via === 'vision' ||
    row.extract_via === 'none'
      ? row.extract_via
      : row.ocr === 1
        ? 'ocr'
        : row.text === null
          ? 'none'
          : 'plain';
  return {
    kind:
      via === 'vision'
        ? 'model_description'
        : via === 'ocr'
          ? 'ocr_text'
          : via === 'none'
            ? 'none'
            : 'original_text',
    via,
    confidence: row.confidence,
  };
}

function matchesSubject(parts: DocumentDateRow[], groupKey: string, subject?: string): boolean {
  if (!subject) return true;
  const normalized = subject.replaceAll('\\', '/');
  return (
    normalized === groupKey ||
    parts.some(
      (part) =>
        part.id === normalized ||
        part.rel_path === normalized ||
        path.posix.basename(part.rel_path) === normalized,
    )
  );
}

function matchesText(match: string | undefined, first: DocumentDateRow, evidence: string): boolean {
  if (!match) return true;
  const wanted = match.toLowerCase();
  return [first.rel_path, first.label ?? '', evidence].some((value) => value.toLowerCase().includes(wanted));
}

function withinRange(date: string, options: Pick<DocumentTimelineOptions, 'since' | 'until'>): boolean {
  return (!options.since || date >= options.since) && (!options.until || date <= options.until);
}

function timestampDate(value: string | undefined): string | null {
  if (!value) return null;
  const candidate = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && validDate(candidate) ? candidate : null;
}

function evidenceId(documentId: string, date: string, basis: string, address: string): string {
  return `dev_${sha256(`${documentId}\0${date}\0${basis}\0${address}`).slice(0, 12)}`;
}

function quoteAround(text: string, offset: number, maxLines: number): string {
  const lines = text.split('\n');
  const line = text.slice(0, offset).split('\n').length - 1;
  const before = Math.floor((Math.max(1, maxLines) - 1) / 2);
  const from = Math.max(0, line - before);
  return lines
    .slice(from, from + Math.max(1, maxLines))
    .filter((value) => value.trim().length > 0)
    .join('\n');
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

/** Conservative, locale-independent dates suitable for evidence rather than inference. */
export function extractDocumentDates(text: string): ExtractedDate[] {
  const found: ExtractedDate[] = [];
  for (const match of text.matchAll(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g)) {
    const date = normalizedDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (date) found.push({ date, raw: match[0], start: match.index });
  }

  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+((?:19|20)\\d{2})\\b`, 'gi');
  for (const match of text.matchAll(dayFirst)) {
    const date = normalizedDate(Number(match[3]), MONTHS[match[2]!.toLowerCase()]!, Number(match[1]));
    if (date) found.push({ date, raw: match[0], start: match.index });
  }

  const monthFirst = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})\\b`,
    'gi',
  );
  for (const match of text.matchAll(monthFirst)) {
    const date = normalizedDate(Number(match[3]), MONTHS[match[1]!.toLowerCase()]!, Number(match[2]));
    if (date) found.push({ date, raw: match[0], start: match.index });
  }
  return found.sort((a, b) => a.start - b.start);
}

function normalizedDate(year: number, month: number, day: number): string | null {
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return validDate(date) ? date : null;
}

function validDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}
