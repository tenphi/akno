import { parseJsonLoose, type ModelClient } from '../models/client.ts';

/**
 * **Retain: keep only long-term facts, decisions, preferences, proven
 * experience.**
 *
 * **Retain writes prose, not atomic facts** — it is a
 * page-level curator that edits the right page, and facts are derived beneath it.
 * So a candidate here is a sentence someone would actually write on a page, not a
 * triple.
 *
 * The guardrail about missions applies: a mission string appends emphasis to a
 * fixed system prompt and never replaces it. A replaceable prompt is how every
 * guard gets lost.
 */

const SYSTEM = `You decide what from a conversation is worth writing into a long-term personal knowledge base, and phrase it as prose.

Reply with JSON only:
{
  "candidates": [
    { "text": "one self-contained sentence, phrased as it should appear on a page",
      "subject": "2-5 words naming what this is about, used to find the right page",
      "kind": "fact" }
  ],
  "events": [ { "date": "YYYY-MM-DD", "summary": "what happened, one clause" } ]
}

Keep:
- Durable values, dates, identifiers, account details, measurements.
- Decisions, and the reason for them.
- Stated preferences and constraints.
- Proven experience: what was tried, what worked.

Drop, always:
- Anything true only today: what someone is doing right now, transient state.
- Questions, speculation, plans that were not decided.
- Pleasantries, acknowledgements, and the assistant's own suggestions.
- Anything already obviously recorded — do not restate.
- Anything you inferred rather than were told. Only what the text actually says.

Rules:
- Prose, not triples. "The car insurance premium is now 33 EUR a month" — not "premium=33".
- Resolve pronouns and relative dates against the text. Never invent a date you were not given.
- An "events" entry is something that happened on a date, not a value that is true.
- Fewer, better. An empty candidates list is the correct answer for a conversation
  that decided nothing, and is much better than a vague one.`;

export interface RetainCandidate {
  text: string;
  subject: string;
  kind: string;
}

export interface RetainResult {
  candidates: RetainCandidate[];
  events: { date: string; summary: string }[];
  error: string | null;
}

export async function runRetain(
  text: string,
  model: ModelClient,
  options: { mission?: string; today: string } = { today: new Date().toISOString().slice(0, 10) },
): Promise<RetainResult> {
  const empty: RetainResult = { candidates: [], events: [], error: null };
  if (!model.available) return { ...empty, error: model.unavailableReason ?? 'derive model unavailable' };

  // Additive, never replacing.
  const system = options.mission ? `${SYSTEM}\n\nAdditional emphasis: ${options.mission}` : SYSTEM;

  const result = await model.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Today is ${options.today}.\n\n${text}` },
    ],
    { json: true, maxTokens: 1200 },
  );
  if (!result.ok || !result.value) return { ...empty, error: result.error ?? 'retain failed' };

  const parsed = parseJsonLoose<{ candidates?: unknown; events?: unknown }>(result.value);
  if (!parsed) return { ...empty, error: 'retain returned unparseable JSON' };

  return {
    candidates: cleanCandidates(parsed.candidates),
    events: cleanEvents(parsed.events),
    error: null,
  };
}

/**
 * The mission says to drop speculation, and a 3B model does not reliably obey a
 * prompt that says so — observed keeping "travel insurance should be considered"
 * from a source that read "I should probably look into travel insurance at some
 * point". A prompt is a suggestion; this is the layer, which is the whole argument
 * of putting the logic in the layer.
 *
 * Mirrors the hedge list the fact deriver scores on, applied to the candidate
 * itself. A dropped candidate costs nothing — `remember` is not the only way to
 * write — while a speculation written as prose is later recalled *as truth*.
 */
const SPECULATIVE =
  /\b(should be considered|should probably|might want|could be worth|worth considering|at some point|look into|maybe|perhaps|probably|possibly|considering whether|thinking about|not sure|tbd|to be decided)\b/i;

/** A candidate has to read as a statement, not a topic. */
const HAS_VERB =
  /\b(is|are|was|were|has|have|had|will|prefers|prefer|lives|costs|cost|expires|renews|includes|owns|uses|works|covers|holds|requires|means|pays|paid|charged|booked|signed|moved|decided|chose|switched|cancelled|replaced|bought)\b/i;

function cleanCandidates(value: unknown): RetainCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: RetainCandidate[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const text = typeof record.text === 'string' ? record.text.trim().replace(/\s+/g, ' ') : '';
    // A one-word "candidate" is the same fragment problem the fact deriver has:
    // it cannot be read on the page it lands on.
    if (text.split(/\s+/).length < 4 || text.length > 400) continue;
    // Speculation, however confidently the model phrased it.
    if (SPECULATIVE.test(text)) continue;
    // A topic rather than a claim: "hotel bill" is not something a page can say.
    if (!HAS_VERB.test(text)) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      text,
      subject:
        typeof record.subject === 'string' && record.subject.trim().length > 0
          ? record.subject.trim()
          : text.slice(0, 60),
      kind: typeof record.kind === 'string' ? record.kind : 'fact',
    });
    if (out.length >= 12) break;
  }
  return out;
}

function cleanEvents(value: unknown): { date: string; summary: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { date: string; summary: string }[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const date = typeof record.date === 'string' ? record.date.trim() : '';
    const summary = typeof record.summary === 'string' ? record.summary.trim().replace(/\s+/g, ' ') : '';
    // An event with an invented or malformed date is worse than no event: it will
    // sort into the ledger somewhere nobody expects.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (summary.length < 4 || summary.length > 300) continue;
    out.push({ date, summary });
    if (out.length >= 8) break;
  }
  return out;
}
