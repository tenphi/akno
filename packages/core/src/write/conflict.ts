import { createHash } from 'node:crypto';
import type { ConflictReport } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';

/**
 * **Cheap inline, thorough offline.**
 *
 * On every write: compare only against facts on the target page, flag only when
 * two claims share a subject and attribute but differ in value, and bias toward
 * numbers, dates, names and identifiers — where conflicts are real and detectable.
 * Free prose rarely conflicts meaningfully, and a detector that thinks it does
 * will block half of all writes.
 *
 * **When uncertain, write — do not block.** A false block costs a turn; a false
 * pass costs a duplicate, and the maintenance cycle finds duplicates later.
 *
 * Deliberately no model call: correctness that requires one per write belongs in the
 * background, not in the turn.
 */

/** `- **Premium:** €33/month`, `Premium: €33/month`, `| Premium | €33 |`. */
const KEY_VALUE = /^\s*(?:[-*+]\s*)?(?:\*\*|__)?([A-Za-z][\w\s'/-]{1,40}?)(?:\*\*|__)?\s*:\s*(.+?)\s*$/;
const TABLE_ROW = /^\s*\|\s*(?:\*\*)?([A-Za-z][\w\s'/-]{1,40}?)(?:\*\*)?\s*\|\s*(.+?)\s*\|/;

/**
 * A value worth fighting over. A conflict between two prose sentences is usually
 * two ways of saying the same thing; a conflict between two numbers is a fact
 * that changed.
 */
const HARD_VALUE =
  /\d|\b(yes|no|true|false|none|active|inactive|expired|cancelled|monthly|weekly|annual|annually)\b/i;

interface ClaimCandidate {
  /** Normalized attribute, e.g. `premium`. The join key. */
  attribute: string;
  value: string;
  line: number;
  text: string;
}

/**
 * Pulls `attribute: value` shapes out of text about to be written. Structural
 * only — this is what makes the check affordable on every write.
 */
function extractCandidates(text: string, startLine = 1): ClaimCandidate[] {
  const out: ClaimCandidate[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim().length === 0 || /^\s*#{1,6}\s/.test(raw)) continue;

    const match = TABLE_ROW.exec(raw) ?? KEY_VALUE.exec(raw);
    if (!match) continue;

    const attribute = normalizeAttribute(match[1]!);
    const value = match[2]!.trim();
    if (attribute.length === 0 || value.length === 0) continue;
    // A URL or a wikilink is not an attribute assignment, whatever the colon says.
    if (/^\/\/|^https?:|^\[\[/.test(value)) continue;
    if (!HARD_VALUE.test(value)) continue;

    out.push({ attribute, value, line: startLine + i, text: raw.trim() });
  }
  return out;
}

function normalizeAttribute(raw: string): string {
  return raw.toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Two values differ *meaningfully* when their comparable cores differ. Reached
 * only for values that already contain a number or a decisive word, so this is
 * about "€33 vs €33/month" (same) against "€33 vs €47" (different).
 *
 * Exported for the thorough pass, which joins facts across the whole knowledge base and
 * has to decide "differ" exactly the way the inline check does. Two answers to that question
 * would mean the cycle reporting conflicts a write would have allowed, or missing ones it
 * would have blocked.
 */
export function valuesConflict(existing: string, incoming: string): boolean {
  const left = comparableCore(existing);
  const right = comparableCore(incoming);
  if (left === right) return false;

  const leftNumbers = numbersIn(existing);
  const rightNumbers = numbersIn(incoming);
  // Both carry numbers: the numbers decide. This is the case to bias toward, and the only
  // one where "differ" is unambiguous.
  if (leftNumbers.length > 0 && rightNumbers.length > 0) {
    return leftNumbers.join(',') !== rightNumbers.join(',');
  }
  // Only one side has a number, or neither does. When uncertain, write.
  return false;
}

function comparableCore(value: string): string {
  return value.toLowerCase().replace(/[*_`]/g, '').replace(/[\s,]/g, '').replace(/\.$/, '');
}

function numbersIn(value: string): string[] {
  // Thousands separators removed first, so `1,450` reads as one number.
  return [...value.replace(/(\d),(\d{3})\b/g, '$1$2').matchAll(/\d+(?:[.]\d+)?/g)].map((m) => m[0]!);
}

export interface ConflictOptions {
  store: Store;
  pageId: string;
  slug: string;
  /** The page as it stands. Compared against, line for line. */
  body: string;
  /** Line number the body starts at, so a report addresses the real line. */
  bodyStartLine: number;
  /** The text being written. */
  incoming: string;
  /** Echo of a token the caller already resolved with the user. */
  resolveToken?: string;
}

/**
 * Returns the first genuine conflict, or null. First rather than all: a caller has
 * to take this to the user, and one clear question beats a list.
 *
 * Both sides go through the **same extractor**, which is the whole trick. The first
 * implementation compared a structurally-extracted attribute from the incoming text
 * against the `attribute` a model had assigned to an existing fact — and those are
 * different vocabularies. Appending `- Nights: 5` over an existing `- Nights: 3`
 * produced no conflict at all, because the model had labelled the existing line's
 * attribute `total` while the extractor read the new one as `nights`. Two names for
 * the same thing never join.
 *
 * Comparing the page's own lines against the incoming lines also means conflict
 * detection **works with no chat model at all**, which is what makes it cheap.
 */
export function detectConflict(options: ConflictOptions): ConflictReport | null {
  const incoming = extractCandidates(options.incoming, 1);
  if (incoming.length === 0) return null;

  const existing = extractCandidates(options.body, options.bodyStartLine);
  if (existing.length === 0) return null;

  // A low-confidence fact is never used for conflict detection, where a shaky
  // claim would fight a solid one. Lines the deriver was unsure about are excluded
  // by line number — the one thing the facts table is genuinely authoritative on.
  const shaky = new Set(
    (
      options.store.db
        .prepare('SELECT line_start FROM facts WHERE page_id = ? AND valid_to IS NULL AND confidence < 0.5')
        .all(options.pageId) as { line_start: number }[]
    ).map((row) => row.line_start),
  );

  for (const candidate of incoming) {
    for (const current of existing) {
      if (shaky.has(current.line)) continue;
      if (current.attribute !== candidate.attribute) continue;
      if (!valuesConflict(current.value, candidate.value)) continue;

      const token = conflictToken(options.slug, current.line, candidate.value);
      if (options.resolveToken === token) continue; // The caller already asked.

      return {
        slug: options.slug,
        line: current.line,
        existing: current.text,
        incoming: candidate.text,
        subject: candidate.attribute,
        token,
      };
    }
  }
  return null;
}

/**
 * Ties an override to the exact conflict it resolves. A plain boolean flag would
 * let a caller wave through a *different* conflict discovered on the next attempt
 * — which is the same as not checking.
 */
function conflictToken(slug: string, line: number, incoming: string): string {
  return createHash('sha256').update(`${slug}:${line}:${incoming}`).digest('hex').slice(0, 12);
}
