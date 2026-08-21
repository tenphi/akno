import { z } from 'zod';
import type { AknoContext } from '../context.ts';
import { parseJsonLoose } from '../models/client.ts';
import type { CrossPageConflict } from './conflicts.ts';

/**
 * Similarity-only candidates for explaining why a broken link was declined.
 *
 * These candidates never authorize a write. Plan-backed link repair requires an exact alias,
 * canonical identity, or recorded move; resemblance is useful diagnostic context, not identity.
 */
export function candidatesFor(target: string, slugs: string[]): string[] {
  const wanted = tokens(target);
  if (wanted.length === 0) return [];

  // A one-word link — `[[Boiler]]` — is matched only against a page whose own last segment is that
  // word. Coverage would let it match anything containing it, and one word is not an
  // identification: `[[passport]]` on its own could be anybody's.
  if (wanted.length === 1) {
    const only = wanted[0]!;
    return slugs.filter((slug) => tokens(slug.split('/').pop() ?? slug).join('') === only);
  }

  return slugs.filter((slug) => {
    const has = new Set(tokens(slug));
    const covered = wanted.filter((token) => has.has(token)).length;
    return covered / wanted.length >= 0.75;
  });
}

/**
 * The words of a slug, path included.
 *
 * The path matters, which is the whole trick. `personal/residence-permit-ada-marlow` and
 * `ada-marlow/residence-permit` are one page reorganised: every word survives the move, only its
 * position changed. Compare last segments alone and the two look unrelated; compare whole slugs and
 * they are four words out of five.
 *
 * It is also what keeps the dangerous case out. `bo-winters/spare-travel-passport`
 * against a page called `ada-marlow/passport` shares one word in five — a different person's
 * document, which an earlier version repointed with full confidence because `passport` was a
 * substring. Found on a dry run, before it touched anything.
 */
function tokens(slug: string): string[] {
  return slug
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

const REWRITE_STALE = `A personal knowledge base holds two claims about the same thing, and one of them is no longer
current. You are given the sentence that is out of date, the claim that replaced it, and the exact effective
date established by that current claim.

Rewrite the out-of-date sentence so it reads as history rather than as a current fact. Reply with JSON only:

{"line": "the rewritten sentence"}

Rules:
- Keep every number, name and date exactly as it appears. You are changing the tense, not the value.
- State explicitly that the old claim applied before the supplied effective date. Copy that date exactly.
- Do not add any other number or date.
- Keep the sentence's own formatting: if it starts with "- " or "**Rent:**", keep that.
- One line. Never add a second sentence, and never add anything that was not already known.
- If the sentence cannot be rewritten without changing what it says, reply {"line": null}.`;

export const REWRITE_SCHEMA = z.object({ line: z.string().nullable() });

/**
 * Turn a superseded claim into a past-tense one.
 *
 * The sentence is what makes a fact: the deriver reads the file, so a fact marked stale only in the
 * database is live again the next time its page is indexed. Rewriting the line is therefore the only
 * durable way to say "this was true once" — and it is also the least destructive, because the claim
 * and its value are still on the page for anyone reading it.
 */
async function rewriteAsHistory(
  ctx: AknoContext,
  stale: string,
  current: string,
  boundary?: string,
): Promise<string | null> {
  if (!ctx.models.derive.available) return null;
  const result = await ctx.models.derive.chat(
    [
      { role: 'system', content: REWRITE_STALE },
      {
        role: 'user',
        content:
          `Out of date:\n${stale}\n\nReplaced by:\n${current}` +
          (boundary ? `\n\nEffective date:\n${boundary}` : ''),
      },
    ],
    { schema: REWRITE_SCHEMA, maxTokens: 300 },
  );
  if (!result.ok || !result.value) return null;

  const parsed = parseJsonLoose<{ line?: unknown }>(result.value);
  const line = typeof parsed?.line === 'string' ? parsed.line.trim() : '';
  if (!line || line.includes('\n')) return null;
  return line;
}

/**
 * Whether a rewrite kept the numbers it was told to keep.
 *
 * The guard that matters. Changing the tense of a claim is a tidy-up; changing its value is the
 * model quietly deciding what is true about somebody's rent, and no verdict is worth that. Every
 * number in the original must survive into the rewrite.
 */
export function preservesValues(before: string, after: string): boolean {
  return missingNumericValues(before, after).length === 0;
}

/**
 * A history rewrite may change grammar, but it may not silently rename a subject, place, product,
 * or other authored content. Common glue words are excluded so adding "Previously" and changing
 * "is" to "was" remains possible; every meaningful alphanumeric token must survive.
 */
function missingAuthoredTokens(before: string, after: string): string[] {
  const ignored = new Set([
    'and',
    'are',
    'been',
    'for',
    'from',
    'has',
    'have',
    'into',
    'is',
    'its',
    'of',
    'on',
    'the',
    'to',
    'was',
    'were',
    'with',
  ]);
  const authoredTokens = (value: string): string[] =>
    value
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 3 && !ignored.has(token)) ?? [];
  const present = new Set(authoredTokens(after));
  return [...new Set(authoredTokens(before).filter((token) => !present.has(token)))];
}

export function preservesAuthoredTokens(before: string, after: string): boolean {
  return missingAuthoredTokens(before, after).length === 0;
}

/** The exact tokens behind `preservesValues`, for guardrail diagnostics and audit logs. */
export function missingNumericValues(before: string, after: string): string[] {
  const afterValues = new Set(numericValues(after).map((value) => value.canonical));
  const missing = numericValues(before).filter((value) => !afterValues.has(value.canonical));
  return [...new Set(missing.map((value) => value.raw))];
}

interface NumericValue {
  raw: string;
  canonical: string;
}

/**
 * Values, not punctuation that happens to follow them.
 *
 * The old digit-and-punctuation regex included the comma in `1902,` and the full stop in `25.`. A model
 * moving that value to the middle of a sentence was therefore treated like one deleting it.
 * Composite dates, times and ranges are captured first so harmless separator and leading-zero
 * changes compare semantically rather than as typography.
 */
function numericValues(text: string): NumericValue[] {
  const pattern =
    /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}:\d{2}|\d+(?:[.,]\d+)*(?:\s*[\u2013\u2014-]\s*\d+(?:[.,]\d+)*)?/g;
  return [...text.matchAll(pattern)].map((match) => ({
    raw: match[0],
    canonical: canonicalNumericValue(match[0]),
  }));
}

function canonicalNumericValue(raw: string): string {
  const compact = raw.replace(/\s+/g, '').replace(/[\u2013\u2014]/g, '-');
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(compact)) {
    const [year, month, day] = compact.split(/[-/]/);
    return `${year}-${Number(month)}-${Number(day)}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(compact)) {
    const [hour, minute] = compact.split(':');
    return `${Number(hour)}:${minute}`;
  }
  const range = /^(.*?)-(.*)$/.exec(compact);
  if (range) return `${canonicalNumber(range[1]!)}-${canonicalNumber(range[2]!)}`;
  return canonicalNumber(compact);
}

function canonicalNumber(value: string): string {
  // A comma followed by groups of exactly three digits is a thousands separator. A decimal
  // comma remains significant, as does a decimal point.
  return /^\d{1,3}(?:,\d{3})+$/.test(value) ? value.replaceAll(',', '') : value;
}

/** Conflicts worth acting on: judged real, with a claim the model named as current. */
export function actionable(conflicts: CrossPageConflict[]): CrossPageConflict[] {
  return conflicts.filter(
    (conflict) => conflict.verdict === 'superseded' && conflict.likelyCurrent && conflict.claims.length >= 2,
  );
}

export { rewriteAsHistory as rewriteAsHistoryForTesting };
