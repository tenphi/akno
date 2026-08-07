import type { DegradedReason, RecallMode } from '@akno/protocol';
import { parseJsonLoose, type ModelClient } from '../models/client.ts';

/**
 * Looking something up and answering a question are not the same retrieval
 * problem, and they want different expansion. But they must not be different
 * **ops** — every extra op is another chance for an agent to pick the wrong one,
 * and an agent is not reliably able to tell which situation it is in.
 */

const QUESTION_WORDS = [
  'who',
  'what',
  'when',
  'where',
  'why',
  'how',
  'which',
  'whose',
  'whom',
  'is',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'will',
  'have',
  'has',
  'am',
];

const EXPLORE_MARKERS = [
  'anything about',
  'everything about',
  'all about',
  'what do we know',
  'what do you know',
  'tell me about',
  'overview of',
  'summarize',
  'summarise',
  'remind me about',
];

/**
 * Detection is cheap and deterministic — question words, a trailing `?`,
 * imperative phrasing — and it is only a default. Passing `mode` explicitly
 * always wins, and getting it wrong costs relevance, never correctness.
 */
export function inferMode(query: string): RecallMode {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return 'lookup';

  if (EXPLORE_MARKERS.some((marker) => normalized.startsWith(marker) || normalized.includes(marker))) {
    return 'explore';
  }

  const words = normalized.replace(/[?!.]+$/, '').split(/\s+/);
  const first = words[0] ?? '';
  const endsWithQuestionMark = normalized.endsWith('?');

  if (endsWithQuestionMark) return inferBreadth(normalized);
  if (QUESTION_WORDS.includes(first) && words.length >= 3) return 'question';
  // "do we have a lease" reads as a question without a question mark.
  if (/^(do|does|did|is|are|was|were|can|should|will)\s+(i|we|you|they|he|she|it|the)\b/.test(normalized)) {
    return 'question';
  }
  return 'lookup';
}

function inferBreadth(normalized: string): RecallMode {
  return EXPLORE_MARKERS.some((marker) => normalized.includes(marker)) ? 'explore' : 'question';
}

export interface Expansion {
  /** Every query issued, reported verbatim in `searched` so absence is provable. */
  queries: string[];
  /**
   * Sentences embedded *in place of* the query for the vector arm. In question
   * mode these are hypothetical answers; they are never shown to anyone and
   * never stored.
   */
  vectorTexts: string[];
  /** Concepts `coverage` is computed against, in question mode. */
  concepts: string[];
  degraded: DegradedReason | null;
  /** Human-readable detail, for logs and `doctor`. */
  note: string | null;
}

/**
 * **A question does not embed near its answer.** "when does the car
 * insurance renew?" is lexically and semantically closer to other questions than
 * to the line `Renews: 2026-11-04`. So Akno generates a hypothetical answer
 * sentence and embeds *that* alongside the question. The synthetic sentence
 * exists only to put the query vector in the right neighbourhood.
 */
export async function expandQuery(
  query: string,
  mode: RecallMode,
  chat: ModelClient,
  enabled: boolean,
  timeoutMs: number,
): Promise<Expansion> {
  const base: Expansion = {
    queries: [query],
    vectorTexts: [query],
    concepts: extractConcepts(query),
    degraded: null,
    note: null,
  };

  if (!enabled) return base;
  if (!chat.available) {
    return { ...base, degraded: chat.degradedReason({}), note: chat.unavailableReason };
  }

  const instruction =
    mode === 'question' ? QUESTION_PROMPT : mode === 'explore' ? EXPLORE_PROMPT : LOOKUP_PROMPT;

  const result = await chat.chat(
    [
      { role: 'system', content: instruction },
      { role: 'user', content: query },
    ],
    // Its own deadline, not the chat role's: a busy or cold endpoint must cost a
    // weaker search, never a hung one.
    { json: true, maxTokens: 400, timeoutMs },
  );

  if (!result.ok || !result.value) {
    return { ...base, degraded: chat.degradedReason(result), note: result.error ?? null };
  }

  const parsed = parseJsonLoose<{
    queries?: unknown;
    answers?: unknown;
    concepts?: unknown;
  }>(result.value);
  if (!parsed) {
    return { ...base, degraded: 'expansion_failed', note: 'query expansion returned unparseable JSON' };
  }

  const queries = dedupe([query, ...stringList(parsed.queries, 6)]);
  const answers = stringList(parsed.answers, 4);
  const concepts = stringList(parsed.concepts, 6);

  return {
    queries,
    // The hypothetical answers go to the vector arm; the query text stays too, so
    // a bad hypothetical cannot make recall worse than no expansion at all.
    vectorTexts: dedupe([query, ...answers]),
    concepts: concepts.length > 0 ? concepts.map((c) => c.toLowerCase()) : base.concepts,
    degraded: null,
    note: null,
  };
}

const LOOKUP_PROMPT = `Expand a keyword search over a personal knowledge base. Reply with JSON only:
{ "queries": ["2-4 alternative phrasings: synonyms, singular/plural, common aliases and abbreviations"],
  "concepts": ["the 1-3 distinct things being asked about, lowercase"] }
Keep every query short and keyword-like. Do not turn them into sentences.`;

const QUESTION_PROMPT = `A user asked a question of their personal knowledge base. Reply with JSON only:
{ "queries": ["2-4 keyword searches that would find the answer"],
  "answers": ["1-3 short declarative sentences that a page containing the answer would plausibly contain. Invent concrete placeholder values — they are only used to steer a vector search and are never shown to anyone."],
  "concepts": ["each distinct thing the question asks about, lowercase. A two-part question has two concepts."] }
For "when does the car insurance renew?" a good answer sentence is "The car insurance policy renews on 4 November 2026."`;

const EXPLORE_PROMPT = `A user wants a broad overview from their personal knowledge base. Reply with JSON only:
{ "queries": ["3-5 varied searches covering different facets of the subject"],
  "concepts": ["the subject, lowercase"] }`;

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length > 1 && trimmed.length <= 300) out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase().trim();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'should',
  'so',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'about',
  'any',
  'much',
  'many',
  'does',
]);

/**
 * Fallback concept extraction when there is no chat model: content words, with a
 * simple bigram pass so "car insurance" survives as one concept rather than two.
 * Crude, but the coverage guarantee should not depend on a model being present.
 */
export function extractConcepts(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  if (words.length === 0) return [];
  if (words.length <= 2) return [words.join(' ')];

  const concepts: string[] = [];
  for (let i = 0; i < words.length - 1; i += 2) {
    concepts.push(words.slice(i, i + 2).join(' '));
  }
  if (words.length % 2 === 1) concepts.push(words.at(-1)!);
  return concepts.slice(0, 5);
}

/**
 * Multi-part questions are split and searched separately, then merged.
 * A conjunction between two clauses that each carry a content word is the signal.
 */
export function splitMultiPart(query: string): string[] {
  const parts = query
    .split(/\s+(?:and|&)\s+|;\s*/i)
    .map((part) => part.trim().replace(/^(?:also|then)\s+/i, ''))
    .filter((part) => part.length > 0);
  if (parts.length < 2) return [query];
  // A split that leaves a fragment with no content word is not a real split.
  if (parts.some((part) => extractConcepts(part).length === 0)) return [query];
  return parts.slice(0, 3);
}
