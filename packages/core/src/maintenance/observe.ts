import { parseJsonLoose, type ModelClient } from '../models/client.ts';

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
  better than a vague pattern nobody can act on.`;

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

  const result = await input.model.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Subject: ${input.subject}\n\nFacts:\n${listed}` },
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

    if (TEMPLATE.test(pattern)) {
      rejected.push({ pattern, reason: 'a template with placeholders, not a claim' });
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

    if (restatesAFact(pattern, input.facts)) {
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
function restatesAFact(pattern: string, facts: { claim: string }[]): boolean {
  const patternWords = contentWords(pattern);
  if (patternWords.size === 0) return true;

  for (const fact of facts) {
    const factWords = contentWords(fact.claim);
    if (factWords.size === 0) continue;
    let shared = 0;
    for (const word of patternWords) if (factWords.has(word)) shared++;
    // Four fifths of one claim's content words, in a sentence that is meant to say something
    // no single claim does.
    if (shared / patternWords.size >= 0.8) return true;
  }
  return false;
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'has',
  'have',
  'had',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'as',
  'by',
  'from',
  'usually',
  'often',
  'always',
  'each',
  'every',
]);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.6;
  return Math.min(1, Math.max(0, value));
}
