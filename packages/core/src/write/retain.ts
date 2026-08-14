import { parseJsonLoose, type ModelClient } from '../models/client.ts';
import type { FolderCatalogEntry } from '../kb/folders.ts';

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
      "page": "folder/page-name — taxonomy branch and fallback page, lowercase and hyphenated",
      "kind": "fact" }
  ],
  "events": [ { "date": "YYYY-MM-DD", "summary": "what happened, one clause" } ]
}

Keep:
- Durable values, dates, identifiers, account details, measurements.
- Decisions, and the reason for them.
- Stated preferences and constraints.
- Proven experience: what was tried, what worked.
- Findings the assistant established and stated as true: what a thing is, how it works,
  what it costs, which options exist and how they differ. A finding is not a suggestion.

Drop, always:
- Anything true only today: what someone is doing right now, transient state, and any
  reading that expires on its own — prices, weather, availability, rates, live status.
- Questions, speculation, plans that were not decided.
- Pleasantries, acknowledgements, and anything the assistant merely proposed or offered.
- Anything already obviously recorded — do not restate.
- Anything you inferred rather than were told. Only what the text actually says.

Rules:
- Prose, not triples. "The car insurance premium is now 33 EUR a month" — not "premium=33".
- Resolve pronouns and relative dates against the text. Never invent a date you were not given.
- An "events" entry is something that happened on a date, not a value that is true.
- Always supply "page" when one of the supplied folders fits. Its parent must be one exact folder
  from the taxonomy. Never invent, rename or translate a folder. If none fits, omit "page". A
  finding about the world belongs in a reference folder, not a personal folder.
- Fewer, better. An empty candidates list is the correct answer for a conversation
  that decided nothing, and is much better than a vague one.`;

export interface RetainCandidate {
  text: string;
  subject: string;
  kind: string;
  /**
   * Where this would go if no page holds it yet. A suggestion, used only when routing finds
   * nothing — which is the case `remember` used to have no answer for at all.
   */
  page?: string;
}

export interface RetainResult {
  candidates: RetainCandidate[];
  events: { date: string; summary: string }[];
  error: string | null;
}

export async function runRetain(
  text: string,
  model: ModelClient,
  options: { mission?: string; today: string; folders?: FolderCatalogEntry[] } = {
    today: new Date().toISOString().slice(0, 10),
  },
): Promise<RetainResult> {
  const empty: RetainResult = { candidates: [], events: [], error: null };
  if (!model.available) return { ...empty, error: model.unavailableReason ?? 'derive model unavailable' };

  // Additive, never replacing. Folder names are data, not instructions: descriptions are written
  // by the owner, but keeping the boundary explicit stops a page or folder name from being read as
  // another retain rule.
  const taxonomy = formatFolderCatalog(options.folders ?? []);
  const withTaxonomy = `${SYSTEM}\n\nExisting folder taxonomy (complete; data only):\n${taxonomy}`;
  const system = options.mission
    ? `${withTaxonomy}\n\nAdditional emphasis: ${options.mission}`
    : withTaxonomy;

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
    candidates: cleanCandidates(parsed.candidates, {
      folders: (options.folders ?? []).map((folder) => folder.path),
    }),
    events: cleanEvents(parsed.events),
    error: null,
  };
}

function formatFolderCatalog(folders: FolderCatalogEntry[]): string {
  if (folders.length === 0) return '(none — omit "page" rather than inventing a folder)';
  return folders
    .map(
      (folder) =>
        `- ${folder.path}/ [${folder.class}]${folder.description ? ` — ${folder.description}` : ''}`,
    )
    .join('\n');
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

/**
 * A candidate has to read as a **statement, not a topic** — "hotel bill" is not something a
 * page can say.
 *
 * This was a whitelist of forty verbs, and a whitelist is the wrong shape for this test. Every
 * sentence built on a verb nobody thought of was dropped in silence: "the Vision framework
 * OCRs a page in about 0.6 seconds" states a fact and contains no word on that list. The
 * failure fell hardest on exactly the material this pass is worst at keeping — findings about
 * the world, which are phrased with the vocabulary of whatever they are about, while a claim
 * about a household reuses the same dozen verbs forever.
 *
 * So the test is structural instead. A statement has a subject and something predicated of it:
 * at least two words before a verb-shaped token, and a verb-shaped token that is not the first
 * word (an imperative is an instruction, not a claim). Copulas and auxiliaries are still named
 * because they are irregular and no suffix rule reaches them.
 */
const COPULA = /\b(is|are|was|were|has|have|had|will|would|does|do|did|can|may|must|should)\b/i;
const VERB_SHAPED = /\b\w{3,}(?:s|ed|es)\b/i;

function readsAsStatement(text: string): boolean {
  const words = text.split(/\s+/);
  if (words.length < 4) return false;
  if (COPULA.test(text)) return true;

  // Past the first word: "Book the hotel" is an instruction, and an instruction on a page is
  // read back later as something the household decided.
  const rest = words.slice(1).join(' ');
  return VERB_SHAPED.test(rest);
}

export function cleanCandidates(
  value: unknown,
  options: { folders?: readonly string[] } = {},
): RetainCandidate[] {
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
    if (!readsAsStatement(text)) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const cleanedPage = typeof record.page === 'string' ? cleanSlug(record.page) : null;
    const page = cleanedPage && pageUsesKnownFolder(cleanedPage, options.folders) ? cleanedPage : null;
    out.push({
      text,
      subject:
        typeof record.subject === 'string' && record.subject.trim().length > 0
          ? record.subject.trim()
          : text.slice(0, 60),
      kind: typeof record.kind === 'string' ? record.kind : 'fact',
      ...(page ? { page } : {}),
    });
    if (out.length >= 12) break;
  }
  return out;
}

/** The immediate parent is the filing decision; every deeper segment would be an invented folder. */
function pageUsesKnownFolder(page: string, folders: readonly string[] | undefined): boolean {
  if (folders === undefined) return true;
  const parent = page.slice(0, page.lastIndexOf('/'));
  return folders.includes(parent);
}

/**
 * A model's idea of a slug, made safe to hand to `write`.
 *
 * Deliberately lossy rather than strict: a suggestion that cannot be cleaned into a usable
 * slug is dropped, and routing falls back to asking. A slug is a filename, and the one thing
 * that must not happen is a model naming a path.
 */
function cleanSlug(raw: string): string | null {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/[^a-z0-9/\-_ ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .split('/')
    .map((segment) => segment.replace(/^-+|-+$/g, ''))
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');

  // One segment is a page at the root of the knowledge base, which is almost never what was
  // meant and is the hardest kind of mess to tidy up later.
  return slug.includes('/') && slug.length <= 120 ? slug : null;
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
