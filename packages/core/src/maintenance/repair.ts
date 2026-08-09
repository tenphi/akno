import type { AknoContext } from '../context.ts';
import { parseJsonLoose } from '../models/client.ts';
import type { CrossPageConflict } from './conflicts.ts';

/**
 * **The tier that acts on what the others found.**
 *
 * Every other phase describes: it says a link is broken, or that two pages disagree, and leaves the
 * knowledge base exactly as it was. That is the right default and it is not, on its own, a memory —
 * a memory that notices the same fault every night for a year and never fixes it is a to-do list
 * nobody reads.
 *
 * So this one changes files, and everything about it is shaped by that being the dangerous part:
 *
 * - **Nothing is deleted.** A broken link is repointed, never removed. A stale claim is rewritten
 *   into the past tense, never cut — the sentence stays in the file, which is what makes it show up
 *   as *superseded* rather than vanishing.
 * - **A repair must be checkable.** Every link repoint names a page that exists; every conflict
 *   rewrite must keep the original value in the sentence, or it is refused. A model that decides a
 *   rent is now a different number is doing the one thing this must never do.
 * - **One change per night**, journalled, so a run you disagree with is one `undo` away.
 * - **A ceiling per run**, so a bad night is a small bad night.
 *
 * Off by default. The other tiers being wrong costs a paragraph nobody asked for; this one being
 * wrong edits your notes.
 */

export interface LinkRepair {
  from: string;
  brokenTarget: string;
  newTarget: string;
  /** `unique` needed no model: exactly one page could have been meant. */
  how: 'unique' | 'model';
}

export interface ClaimRepair {
  slug: string;
  line: number;
  before: string;
  after: string;
  supersededBy: string;
}

export interface RepairResult {
  links: LinkRepair[];
  claims: ClaimRepair[];
  /** What was found but deliberately not touched, and why. Reported, never silent. */
  declined: { what: string; reason: string }[];
}

/**
 * Candidate pages for a broken link target.
 *
 * Matched on the last segment, because that is what a rename usually keeps: `[[Blackwater-Bay]]`
 * against `travel/2031/2031-04-10-12-blackwater-bay`. Substring rather than equality for the
 * same reason — a page acquires date and country around the name it was known by.
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

const CHOOSE_TARGET = `A wikilink in a personal knowledge base points at a page that does not exist. You are given the
link text and every existing page that might be the one meant.

Reply with JSON only: {"slug": "the page meant", "confident": true}

Rules:
- "slug" must be copied exactly from the candidates given. Never invent one.
- If the candidates are all plausible and none is clearly right, reply {"slug": null, "confident": false}.
- A wrong repoint sends a reader to the wrong page, which is worse than a link that visibly does not work.`;

/** Choose among real candidates. It cannot invent a target: the answer is checked against the list. */
async function chooseTarget(
  ctx: AknoContext,
  target: string,
  candidates: string[],
): Promise<string | null> {
  if (!ctx.models.derive.available) return null;
  const result = await ctx.models.derive.chat(
    [
      { role: 'system', content: CHOOSE_TARGET },
      {
        role: 'user',
        content: `Link: [[${target}]]\n\nCandidates:\n${candidates.map((c) => `- ${c}`).join('\n')}`,
      },
    ],
    { json: true, maxTokens: 200 },
  );
  if (!result.ok || !result.value) return null;

  const parsed = parseJsonLoose<{ slug?: unknown; confident?: unknown }>(result.value);
  const slug = typeof parsed?.slug === 'string' ? parsed.slug.trim() : '';
  if (!slug || parsed?.confident !== true) return null;
  // The list is the whole point: a model that answers with a page nobody offered has invented it.
  return candidates.includes(slug) ? slug : null;
}

const REWRITE_STALE = `A personal knowledge base holds two claims about the same thing, and one of them is no longer
current. You are given the sentence that is out of date and the claim that replaced it.

Rewrite the out-of-date sentence so it reads as history rather than as a current fact. Reply with JSON only:

{"line": "the rewritten sentence"}

Rules:
- Keep every number, name and date exactly as it appears. You are changing the tense, not the value.
- Keep the sentence's own formatting: if it starts with "- " or "**Rent:**", keep that.
- One line. Never add a second sentence, and never add anything that was not already known.
- If the sentence cannot be rewritten without changing what it says, reply {"line": null}.`;

/**
 * Turn a superseded claim into a past-tense one.
 *
 * The sentence is what makes a fact: the deriver reads the file, so a fact marked stale only in the
 * database is live again the next time its page is indexed. Rewriting the line is therefore the only
 * durable way to say "this was true once" — and it is also the least destructive, because the claim
 * and its value are still on the page for anyone reading it.
 */
async function rewriteAsHistory(ctx: AknoContext, stale: string, current: string): Promise<string | null> {
  if (!ctx.models.derive.available) return null;
  const result = await ctx.models.derive.chat(
    [
      { role: 'system', content: REWRITE_STALE },
      { role: 'user', content: `Out of date:\n${stale}\n\nReplaced by:\n${current}` },
    ],
    { json: true, maxTokens: 300 },
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
  const numbers = before.match(/\d[\d.,]*/g) ?? [];
  return numbers.every((value) => after.includes(value));
}

/** Conflicts worth acting on: judged real, with a claim the model named as current. */
export function actionable(conflicts: CrossPageConflict[]): CrossPageConflict[] {
  return conflicts.filter(
    (conflict) => conflict.verdict === 'real' && conflict.likelyCurrent && conflict.claims.length >= 2,
  );
}

export { chooseTarget as chooseTargetForTesting, rewriteAsHistory as rewriteAsHistoryForTesting };
