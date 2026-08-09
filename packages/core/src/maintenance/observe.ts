import { parseJsonLoose, type ModelClient } from '../models/client.ts';
import { contentWords } from '../kb/words.ts';

/**
 * **Observe: combine repeated facts into stable patterns and habits. Never restate the
 * facts.**
 *
 * This tier is an inference engine writing prose into a knowledge base, and in a prose
 * knowledge base a bad write is recalled later **as truth**. So the guardrails are
 * enforced here in code, not asked for in the prompt:
 *
 * - **Evidence or nothing.** At least `min_evidence` distinct source pages, and every slug
 *   checked against the pages actually shown to the model. A model citing a page it was
 *   never given is the failure mode this exists for.
 * - **No hedged language, ever.** "might", "seems", "possibly" — a hedge written as prose
 *   reads as an assertion three months later, when nobody remembers it was a guess.
 * - **Never restate the facts.** A line that repeats a source line adds nothing and costs a
 *   recall slot; the point of the tier is the pattern *across* facts.
 * - **Nothing about a person's health, relationships, finances, beliefs or character.** The
 *   canonical example of what this tier must not do. The prompt says it too, and a real run wrote
 *   "X lives with a wife" anyway — which is why it is a guard and not only an instruction.
 * - **Nothing about the records themselves.** "Each location is described by a street address"
 *   is an observation about a knowledge base, not about a life, and it is what a model reaches
 *   for when the facts have nothing else in common.
 * - **Missions are additive.** The mission string appends emphasis to this fixed prompt and
 *   never replaces it, because every rule above lives in the fixed part.
 *
 * The caller enforces the two guards that need the knowledge base rather than the text:
 * `full` pages only, and no observation as evidence for another observation.
 */

const SYSTEM = `You look for stable patterns across facts already recorded in a personal knowledge base.

You are given facts grouped by subject, each tagged with the page it came from. Reply with JSON only:

{
  "observations": [
    { "pattern": "one sentence stating a stable pattern, habit, or tendency",
      "evidence": ["page/slug", "another/slug"],
      "confidence": 0.0 }
  ]
}

What counts as a pattern:
- A habit visible across several separate records: a recurring choice, a repeated interval, a consistent preference.
- A tendency the facts agree on: how something is usually done, what is usually chosen, what keeps happening.

Hard rules:
- Every observation needs at least two DIFFERENT pages in "evidence", quoting their slugs exactly as given.
- Never restate a fact. If your sentence is one of the facts reworded, drop it.
- Never hedge. No "might", "seems", "possibly", "appears to", "probably". If you are not sure, leave it out.
- Never infer about someone's health, finances, beliefs, relationships or character. Patterns about
  practices and preferences only.
- State the pattern, not the reasoning, and never mention "the facts" or "the pages".
- Fewer, better. An empty list is the correct answer for facts that share only a subject, and is much
  better than a vague pattern nobody can act on.
- You may be shown patterns already recorded for this subject. Never repeat one, and never reword one.
  Report only what those lines do not already say. If they cover it, return an empty list — that is the
  expected answer on most nights, because the facts rarely change between one night and the next.`;

export interface ObservationCandidate {
  pattern: string;
  evidence: string[];
  confidence: number;
}

export interface ObserveMissionResult {
  observations: ObservationCandidate[];
  error: string | null;
  /** Candidates dropped by a guard, and which guard. Reported, never silent. */
  rejected: { pattern: string; reason: string }[];
}

/**
 * The forbidden ground, as a guard rather than an instruction. A real run produced "X lives
 * with a wife" from two people's pages with the prompt rule in place: an inference about a
 * relationship, written as prose, recalled later as truth.
 *
 * Deliberately narrow. It cannot catch every sensitive inference, and its job is not to — it is
 * to make the *named categories* impossible to write, so a miss is a gap and never a
 * licence.
 */
const SENSITIVE =
  /\b(wife|husband|spouse|partner|married|divorced|dating|girlfriend|boyfriend|sibling\w*|brother\w*|sister\w*|son|daughter|children|kids|parents?|family|pregnan\w*|ill|illness|disease|diagnos\w*|depress\w*|anxiet\w*|therapy|medication|salary|debt|broke|wealthy|poor|religio\w*|believes?|faith|prays?|votes?|political|lazy|careless|impulsive|honest|dishonest)\b/i;

/**
 * A "pattern" about the shape of the records rather than about anything that happened. What a
 * model reaches for when the facts under one heading have nothing else in common.
 */
const ABOUT_THE_RECORDS =
  /\b(each (entry|page|record|item|location|line)|every (entry|page|record|item)|is (described|recorded|listed|documented|stored)|these (pages|records|entries|notes)|the (pages|records|entries|dataset|data))\b/i;

/**
 * "The records consistently say X" — a single fact with a preamble bolted on.
 *
 * Real runs produced "Employment documents consistently record the employee's date of birth as 3
 * March 1911" and "Employment records consistently identify Vulpine Mutual B.V. as the employer".
 * Neither is a pattern across facts; each is one fact, restated, with the agreement of the sources
 * offered as if it were the insight. The first also copies a personal identifier onto a derived page
 * that nobody asked for it to be on.
 *
 * `ABOUT_THE_RECORDS` misses these because the sentence is grammatically about the subject — it is
 * the *documents* that do the identifying — so the shape has to be matched directly.
 */
const RECORDS_SAY =
  /\b(records?|documents?|entries|files?|statements?|pages?)\b[^.]{0,40}\b(consistently|always|all|repeatedly)?\s*\b(record|records|identify|identifies|show|shows|list|lists|state|states|confirm|confirms|indicate|indicates)\b/i;

/**
 * A template rather than a claim. A real run produced "Italian cities are often located at Via
 * [number] [street name] [zip code]" — a description of how an address is written, dressed as a
 * fact about cities.
 */
const TEMPLATE = /\[[a-z ]{3,20}\]/i;

/** A hedge in prose is an assertion by the time anyone reads it back. */
const HEDGES =
  /\b(might|may|maybe|seems?|appears?|possibly|probably|perhaps|likely|unlikely|could be|suggests?|apparently|tends? to suggest)\b/i;

export interface ObserveInput {
  subject: string;
  /** Facts as shown to the model: the claim and the page it came from. */
  facts: { claim: string; slug: string }[];
  model: ModelClient;
  mission?: string | null;
  minEvidence: number;
  /**
   * Patterns already written for this subject on a previous night.
   *
   * Without these the cycle re-derives the same insight from the same unchanged facts every night
   * and appends it again in different words — the page grows forever and says one thing. The
   * string check that used to be the only guard cannot catch it: "declined in each successive
   * period" and "declined in each recorded period" are the same observation and different strings.
   *
   * These go in the prompt as well as the guard: they are the few lines most likely to be repeated,
   * and they are few enough to show.
   */
  existing?: string[];
  /**
   * Every other observation already written, on any page.
   *
   * A guard only — showing a model two hundred unrelated observations is noise, and the ones worth
   * putting in front of it are already in `existing`. Subjects overlap more than the grouping
   * suggests: "the Bunq account nets positive across the recorded periods" and "recorded periods
   * end with a positive net result" landed on two different pages saying one thing.
   */
  otherObservations?: string[];
  /**
   * Every other live fact in the knowledge base.
   *
   * `facts` is what this subject's group was built from, so restating one of those was already
   * caught. This covers the rest: a claim recorded under one subject and handed back as an
   * "observation" under another is still a fact the knowledge base already holds, and writing it
   * twice makes one source look like two agreeing.
   */
  knownFacts?: string[];
}

export async function runObserveMission(input: ObserveInput): Promise<ObserveMissionResult> {
  const empty: ObserveMissionResult = { observations: [], error: null, rejected: [] };
  if (!input.model.available) {
    return { ...empty, error: input.model.unavailableReason ?? 'the model is unavailable' };
  }

  const allowed = new Set(input.facts.map((fact) => fact.slug));
  // Below the floor there is nothing to observe *across*, so the call is skipped rather than
  // made and then rejected.
  if (allowed.size < input.minEvidence) return empty;

  const system = input.mission ? `${SYSTEM}\n\nAdditional emphasis: ${input.mission}` : SYSTEM;
  const listed = input.facts.map((fact) => `- [${fact.slug}] ${fact.claim}`).join('\n');
  const known = (input.existing ?? []).slice(0, 20);
  const alreadyRecorded =
    known.length > 0
      ? `\n\nAlready recorded for this subject — do not repeat or reword:\n${known.map((line) => `- ${line}`).join('\n')}`
      : '';

  const result = await input.model.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Subject: ${input.subject}\n\nFacts:\n${listed}${alreadyRecorded}` },
    ],
    { json: true, maxTokens: 700 },
  );
  if (!result.ok || !result.value) return { ...empty, error: result.error ?? 'the observe mission failed' };

  const parsed = parseJsonLoose<{ observations?: unknown }>(result.value);
  if (!parsed || !Array.isArray(parsed.observations)) {
    return { ...empty, error: 'the observe mission did not return usable JSON' };
  }

  const observations: ObservationCandidate[] = [];
  const rejected: { pattern: string; reason: string }[] = [];

  for (const entry of parsed.observations.slice(0, 8)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const pattern = typeof record.pattern === 'string' ? record.pattern.trim().replace(/\s+/g, ' ') : '';
    if (pattern.length < 12 || pattern.length > 400) continue;

    if (HEDGES.test(pattern)) {
      rejected.push({ pattern, reason: 'hedged language' });
      continue;
    }

    if (SENSITIVE.test(pattern)) {
      rejected.push({ pattern, reason: "inferring about a person's private life is out of bounds" });
      continue;
    }

    if (ABOUT_THE_RECORDS.test(pattern)) {
      rejected.push({ pattern, reason: 'describes the records rather than what they record' });
      continue;
    }

    if (RECORDS_SAY.test(pattern)) {
      rejected.push({ pattern, reason: 'one fact restated as "the records consistently say it"' });
      continue;
    }

    if (TEMPLATE.test(pattern)) {
      rejected.push({ pattern, reason: 'a template with placeholders, not a claim' });
      continue;
    }

    // The model was asked not to repeat itself; this is what happens when it does anyway. Only
    // catches near-identical wording — real rewrites share too few words for any threshold that
    // would not also merge genuinely different observations, which is why the prompt does the work
    // and this only backstops it.
    if (known.some((line) => nearlyTheSame(line, pattern))) {
      rejected.push({ pattern, reason: 'already recorded for this subject' });
      continue;
    }

    // The same thing said on somebody else's page. Grouping is by folder and subject, so two
    // groups can reach one conclusion from overlapping facts and each write it to its own page —
    // where neither looks like a duplicate, because neither page contains the other.
    if ((input.otherObservations ?? []).some((line) => nearlyTheSame(line, pattern))) {
      rejected.push({ pattern, reason: 'already recorded on another observation page' });
      continue;
    }

    // Only slugs the model was actually shown. Anything else is invention, and an invented
    // citation is worse than no observation because it looks checkable.
    const evidence = [
      ...new Set(
        (Array.isArray(record.evidence) ? record.evidence : [])
          .filter((slug): slug is string => typeof slug === 'string')
          .map((slug) => slug.trim())
          .filter((slug) => allowed.has(slug)),
      ),
    ];
    if (evidence.length < input.minEvidence) {
      rejected.push({
        pattern,
        reason: `cited ${evidence.length} usable source page(s), needs ${input.minEvidence}`,
      });
      continue;
    }

    if (restatesAFact(pattern, input.facts.map((fact) => fact.claim).concat(input.knownFacts ?? []))) {
      rejected.push({ pattern, reason: 'restates a fact rather than observing across them' });
      continue;
    }

    const confidence = typeof record.confidence === 'number' ? clamp(record.confidence) : 0.6;
    observations.push({ pattern, evidence, confidence });
  }

  // One per subject per run, the best the model was willing to stand behind.
  //
  // Not a token saving: given a subject with nothing much in common, a model produces three
  // variations on the same weak idea — a real run wrote three separate "Italian cities are
  // often located…" lines for one folder. Keeping the strongest makes a thin subject cost one
  // line instead of three, and the advice for this tier is fewer and better.
  observations.sort((a, b) => b.confidence - a.confidence);
  return { observations: observations.slice(0, 1), error: null, rejected };
}

/**
 * **Never restate the facts.** Judged by word overlap against each source claim rather
 * than by asking the model, because "did you just reword one of these" is exactly the
 * question a model that rewrote one will answer wrongly.
 */
function restatesAFact(pattern: string, claims: string[]): boolean {
  const patternWords = contentWords(pattern);
  if (patternWords.size === 0) return true;

  for (const claim of claims) {
    const factWords = contentWords(claim);
    if (factWords.size === 0) continue;
    let shared = 0;
    for (const word of patternWords) if (factWords.has(word)) shared++;
    // Four fifths of one claim's content words, in a sentence that is meant to say something
    // no single claim does.
    if (shared / patternWords.size >= 0.8) return true;
  }
  return false;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.6;
  return Math.min(1, Math.max(0, value));
}

/**
 * Two patterns that differ only in wording.
 *
 * Content words only, compared as a set — "Total spending declined in each successive period" and
 * "…in each recorded period" differ by one word out of nine and are plainly the same observation.
 * The bar is high on purpose: on a page scoped to one subject, every line is about that subject, so
 * a loose threshold would merge two real patterns about it. Anything a genuine rewrite gets past is
 * the prompt's job, not this one's.
 */
function nearlyTheSame(a: string, b: string): boolean {
  const words = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/\[\[[^\]]*\]\]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3),
    );
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return false;

  let shared = 0;
  for (const word of right) if (left.has(word)) shared += 1;
  return shared / new Set([...left, ...right]).size >= 0.75;
}
