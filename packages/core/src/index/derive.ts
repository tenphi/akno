import { parseJsonLoose, type ModelClient } from '../models/client.ts';
import { sha256 } from '../store/ids.ts';
import type { ParsedPage } from '../kb/page.ts';

/**
 * Deriving structure from text already in the knowledge base — facts,
 * summaries, keywords — is a pure function of the Markdown. Akno does it
 * alone; it never needs an extraction cycle from the agent.
 */

export interface DerivedFact {
  claim: string;
  subject: string | null;
  attribute: string | null;
  value: string | null;
  line: number;
  sourceLineHash: string;
  confidence: number;
}

export interface DerivedPage {
  summary: string | null;
  keywords: string[];
  facts: DerivedFact[];
  /** Set when the model was unavailable or returned nothing usable. */
  error: string | null;
  /** Set when some of the derivation succeeded and some did not. Reported, not thrown. */
  partial?: string;
}

const SYSTEM = `You extract structure from a personal knowledge base page. Reply with JSON only.

{
  "summary": "one or two sentences, under 200 characters, stating what this page is about and its most load-bearing values",
  "keywords": ["up to 8 short lowercase terms someone might search for, including synonyms and aliases not literally in the text"],
  "facts": [
    { "line": 11, "claim": "restate the line as one self-contained sentence", "subject": "what the claim is about", "attribute": "which property of it", "value": "the value" }
  ]
}

Rules for facts:
- Only durable claims: values, dates, names, identifiers, decisions, preferences, stable relationships.
- Skip headings, questions, to-dos, speculation, and anything that reads as an aside.
- "line" MUST be a line number from the numbered input. Never invent one.
- The claim must be understandable with no other context: resolve pronouns, name the subject.
- subject/attribute/value may be null when the line does not decompose cleanly.
- Prefer fewer, better facts. An empty list is a correct answer for a page of prose.`;

const SUMMARY_ONLY = `Summarize a personal knowledge base page. Reply with JSON only.

{ "summary": "one or two sentences, under 200 characters, stating what this page is about and its most load-bearing values",
  "keywords": ["up to 8 short lowercase terms someone might search for"] }`;

/**
 * One call per page returning summary, keywords and facts together — the model
 * is reading the page once either way, so three calls would be three times the
 * cost for the same tokens read (the same argument that makes naming a file nearly free).
 */
export async function derivePage(
  page: ParsedPage,
  chat: ModelClient,
  options: { summaries: boolean; facts: boolean },
): Promise<DerivedPage> {
  const empty: DerivedPage = { summary: null, keywords: [], facts: [], error: null };
  if (!options.summaries && !options.facts) return empty;
  if (!chat.available) return { ...empty, error: chat.unavailableReason ?? 'chat model unavailable' };

  // Only text above the reference fence is mined. Below it is somebody else's
  // words, and a fact extractor asserting things from a contract or an email is
  // the failure page classes exist to prevent.
  const mineable = mineableLines(page);
  if (mineable.length === 0) return empty;

  const numbered = mineable.map(({ line, text }) => `${line}: ${text}`).join('\n');
  const result = await chat.chat(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Page: ${page.slug}\nTitle: ${page.title}\n\n${numbered}` },
    ],
    { json: true, maxTokens: 2400 },
  );

  if (!result.ok || !result.value) return { ...empty, error: result.error ?? 'derivation failed' };

  const parsed = parseJsonLoose<{
    summary?: unknown;
    keywords?: unknown;
    facts?: unknown;
  }>(result.value);

  if (!parsed) {
    // A long page can defeat a small model's JSON even with the repair pass. A
    // summary is the more valuable half — it is what recall shows on every card —
    // so ask for that alone rather than losing the page entirely.
    const retry = await chat.chat(
      [
        { role: 'system', content: SUMMARY_ONLY },
        { role: 'user', content: `Page: ${page.slug}\nTitle: ${page.title}\n\n${numbered}` },
      ],
      { json: true, maxTokens: 400 },
    );
    const retried =
      retry.ok && retry.value ? parseJsonLoose<{ summary?: unknown; keywords?: unknown }>(retry.value) : null;
    if (!retried) return { ...empty, error: 'derivation returned unparseable JSON' };
    return {
      summary: options.summaries ? cleanSummary(retried.summary) : null,
      keywords: options.summaries ? cleanKeywords(retried.keywords) : [],
      facts: [],
      error: null,
      partial: 'facts were not derived — the page is too long for the chat model to answer in JSON',
    };
  }

  const byLine = new Map(mineable.map((entry) => [entry.line, entry.text]));

  return {
    summary: options.summaries ? cleanSummary(parsed.summary) : null,
    keywords: options.summaries ? cleanKeywords(parsed.keywords) : [],
    facts: options.facts ? cleanFacts(parsed.facts, byLine) : [],
    error: null,
  };
}

/**
 * The hash of every non-blank line of the page body, trimmed exactly as the deriver sees a
 * line before hashing it.
 *
 * This is what tells "the sentence that made this claim is gone" apart from "this
 * derivation did not repeat it" — the first is a supersession, the second is not, and the
 * difference between retiring a fact and deleting it hangs on exactly that. Answered
 * from the page rather than from the incoming facts, because a derivation that returns
 * nothing at all says nothing about whether the page still says what it said.
 */
export function bodyLineHashes(page: ParsedPage): Set<string> {
  const out = new Set<string>();
  for (const raw of page.lines) {
    const text = raw.trim();
    if (text.length > 0) out.add(sha256(text));
  }
  return out;
}

/** Lines eligible for fact mining: above the fence, non-blank, not a heading. */
function mineableLines(page: ParsedPage): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const fence = page.referenceFenceLine;
  for (let i = 0; i < page.lines.length; i++) {
    const line = page.bodyLine + i;
    if (fence !== null && line >= fence) break;
    const text = page.lines[i]!.trim();
    if (text.length === 0) continue;
    out.push({ line, text });
  }
  return out;
}

function cleanSummary(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return null;
  return trimmed.length > 400 ? `${trimmed.slice(0, 397)}...` : trimmed;
}

function cleanKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const keyword = entry.trim().toLowerCase();
    if (keyword.length > 1 && keyword.length <= 60) seen.add(keyword);
    if (seen.size >= 12) break;
  }
  return [...seen];
}

/**
 * A hallucinated line number is the one failure mode that would break the no-hidden-storage
 * guarantee — a fact whose source line does not say what the
 * fact says can never be re-derived or invalidated correctly. So every fact is
 * dropped unless its line exists in what the model was actually shown.
 */
function cleanFacts(value: unknown, byLine: Map<number, string>): DerivedFact[] {
  if (!Array.isArray(value)) return [];
  const out: DerivedFact[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const line = Number(record.line);
    const sourceText = byLine.get(line);
    if (!Number.isInteger(line) || sourceText === undefined) continue;

    const claim = typeof record.claim === 'string' ? record.claim.trim().replace(/\s+/g, ' ') : '';
    if (claim.length < 3 || claim.length > 500) continue;

    const key = `${line}|${claim.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      claim,
      subject: optionalString(record.subject),
      attribute: optionalString(record.attribute),
      value: optionalString(record.value),
      line,
      sourceLineHash: sha256(sourceText),
      confidence: scoreConfidence(sourceText, claim, record),
    });
    if (out.length >= 60) break;
  }
  return out;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
}

/** Verb-ish tokens that make a fragment read as a statement. Not linguistics —
 *  just enough to tell "Rent is 1111 EUR" from "3 March 1911". */
const VERBS =
  /\b(is|are|was|were|has|have|had|will|can|prefers|lives|costs|expires|renews|includes|owns|uses|works|covers|holds|requires|means|pays|runs|starts|ends|contains|supports|allows)\b/i;

/** A date with nothing attached: "3 March 1911", "5 May 1990", "2026-11-04". */
const BARE_DATE =
  /^(\d{1,2}\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{0,4}$|^\d{4}-\d{2}-\d{2}$/i;

const HEDGES = [
  'probably',
  'maybe',
  'might',
  'could be',
  'i think',
  'not sure',
  'unclear',
  'tbd',
  'todo',
  'approximately',
  'roughly',
  'around',
  'unconfirmed',
  'allegedly',
  'seems',
  'apparently',
  'possibly',
];

/**
 * Confidence answers one narrow question: how sure is the deriver that
 * this line states a well-formed, *durable* claim? Not whether the claim is
 * true.
 *
 * How confidence should be produced is genuinely open, and it is worth noting
 * that a model self-reporting certainty is famously badly calibrated. So this is
 * built from cheap structural signals instead — hedge words, a resolvable
 * subject, whether the line is a complete statement, whether it carries a value
 * worth pinning. Deterministic, explainable, and free.
 */
export function scoreConfidence(
  sourceText: string,
  claim: string,
  record: Record<string, unknown> = {},
): number {
  let score = 0.62;
  const lower = sourceText.toLowerCase();
  const claimWords = claim.trim().split(/\s+/).filter(Boolean);

  // A hedge is the author saying they are not sure. Believe them.
  if (HEDGES.some((hedge) => lower.includes(hedge))) score -= 0.28;
  // A question is not a claim.
  if (sourceText.trimEnd().endsWith('?')) score -= 0.3;
  // An unchecked task is an intention, not a fact.
  if (/^\s*[-*]\s*\[ \]/.test(sourceText)) score -= 0.25;

  // A structured `- **Key:** value` line is the strongest signal a knowledge
  // base gives that someone meant to record a value.
  if (/^\s*[-*]\s*\*?\*?[A-Z][^:]{1,40}:?\*?\*?\s*[:|]\s*\S/.test(sourceText)) score += 0.14;
  // A number, date, currency or identifier — where conflicts are real and
  // detectable, and where a wrong value actually costs something.
  if (/\d/.test(sourceText)) score += 0.08;
  if (
    /\d{4}-\d{2}-\d{2}|[€$£]\s?\d|\b\d+(?:[.,]\d+)?\s?(?:%|eur|usd|gbp|kg|km|months?|years?)\b/i.test(
      sourceText,
    )
  ) {
    score += 0.07;
  }

  // A decomposed claim means the deriver could name what the value belongs to.
  if (typeof record.subject === 'string' && record.subject.trim().length > 0) score += 0.06;
  if (typeof record.attribute === 'string' && record.attribute.trim().length > 0) score += 0.04;

  // A claim far longer than its source is the deriver adding, not restating.
  if (claim.length > sourceText.length * 2.5 + 40) score -= 0.12;
  // A very short source line rarely stands on its own.
  if (sourceText.trim().length < 12) score -= 0.15;

  // The question is whether the line states a **well-formed** durable claim, and a claim
  // that is not a sentence cannot be one however well-formed its source is. This
  // matters more than it looks: a markdown table row (`| UTILITIES | 2 | ... |`)
  // and a bold-key line (`- **Warranty:** five years`) both trip every
  // structural signal above, so a deriver that answers with the *label* rather
  // than the claim was scoring 0.86 on a single word.
  // A `Key: value` claim is self-contained at any length — the key *is* the
  // subject — so the word-count penalty must not bury "Capacity: 2.5 L".
  const hasKey = /^[A-Z][^:]{1,40}:\s*\S/.test(claim);
  if (!hasKey) {
    if (claimWords.length < 3) score -= 0.34;
    else if (claimWords.length === 3) score -= 0.16;
  }
  // A bare label — one capitalized word, or a shouted table header — is the
  // fragment case even when it is long enough to pass the word count.
  if (/^[A-Z][A-Za-z]*$/.test(claim.trim()) || /^[A-Z][A-Z\s]+$/.test(claim.trim())) score -= 0.2;
  // No verb-like token and no value means there is nothing being asserted.
  if (claimWords.length < 6 && !/\d/.test(claim) && !VERBS.test(claim)) score -= 0.12;

  // A claim with no *subject* is not self-contained however well-formed it looks.
  // Two shapes: a bare date or measurement with nothing it belongs to, and a
  // predicate starting with a lowercase verb where the subject was dropped.
  // A `Key: value` line is deliberately exempt — the key *is* the subject.
  if (!hasKey) {
    if (/^[\d\s,.:/–—-]+$/.test(claim) || BARE_DATE.test(claim)) score -= 0.3;
    else if (/^[a-z]+\s/.test(claim) && VERBS.test(claimWords[0] ?? '')) score -= 0.22;
  }

  return Math.round(Math.max(0.05, Math.min(0.98, score)) * 100) / 100;
}

const DOCUMENT_SUMMARY = `Summarize a document stored in a personal knowledge base — a bill, a contract, a
scan, a receipt. Reply with JSON only.

{ "summary": "one or two sentences, under 200 characters, saying what this document is and its most
load-bearing values: who issued it, what it covers, amounts, dates, identifiers" }

The text may be OCR output with errors in it, and may be only the first pages of a longer document. Summarize
what is there. Do not guess at what is missing.`;

/**
 * A stored document has extracted text, a summary and embeddings of its own.
 *
 * One summary per *document*, not per file: a passport split into `passport.pdf` and
 * `passport-2.pdf` is one thing, and two half-summaries describe neither. The caller joins
 * the parts' text before calling, so what is summarized is the whole document.
 */
export async function summarizeDocument(
  text: string,
  chat: ModelClient,
): Promise<{ summary: string | null; error: string | null }> {
  if (!chat.available) return { summary: null, error: chat.unavailableReason ?? 'chat model unavailable' };

  // Enough to say what a document is without paying for a 40-page contract: the opening
  // pages of a document are where it identifies itself. A second, shorter attempt follows a
  // reply a small model could not keep as JSON — the same trade `derivePage` makes, and the
  // difference between a document with a summary and one without.
  for (const chars of [6000, 2000]) {
    const result = await chat.chat(
      [
        { role: 'system', content: DOCUMENT_SUMMARY },
        { role: 'user', content: text.slice(0, chars) },
      ],
      { json: true, maxTokens: 300 },
    );
    if (!result.ok || !result.value) return { summary: null, error: result.error ?? 'summary failed' };

    const summary = cleanSummary(parseJsonLoose<{ summary?: unknown }>(result.value)?.summary);
    if (summary) return { summary, error: null };
  }

  // Reported rather than passed over: a document with no summary is a document that only
  // full-text search can find, and the caller should know which ones those are.
  return { summary: null, error: 'the chat model did not return a usable summary' };
}
