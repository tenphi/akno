import type { AknoContext } from '../context.ts';
import { parseJsonLoose } from '../models/client.ts';
import { valuesConflict } from '../write/conflict.ts';

/**
 * §8. **Cheap inline, thorough offline.** This is the thorough half.
 *
 * Inline detection compares the incoming text against the target page's own lines. That is
 * what makes it affordable on every write, and it is also exactly what it cannot see: two
 * pages that each state a different value for the same thing, neither of them being written
 * right now. Nobody is blocked by that, and nobody notices it either.
 *
 * So this pass joins **facts across the whole knowledge base** on subject and attribute —
 * the two fields the deriver assigns — and reports pairs whose values disagree. It reports;
 * it never writes. §13 says the cycle *reports* what inline checking missed, and a
 * maintenance process that silently rewrites claims is the one thing worse than a duplicate.
 *
 * `full` pages only (§5): a `reference` page is somebody else's words, and a contract
 * disagreeing with a household's notes is not a contradiction in the household's memory.
 */

export interface ConflictClaim {
  slug: string;
  line: number;
  value: string;
  claim: string;
  confidence: number;
  /** When the fact was first seen, so "which is current" has something to go on. */
  seen: string;
}

export interface CrossPageConflict {
  subject: string;
  attribute: string;
  claims: ConflictClaim[];
  /**
   * A model's judgement, when one ran. `unverified` is honest and common: the pass reports
   * structural candidates whether or not a chat model was available to judge them.
   */
  verdict: 'real' | 'not_a_conflict' | 'unverified';
  /** Which claim the model thinks is current, when it had an opinion. */
  likelyCurrent?: string;
}

interface FactRow {
  slug: string;
  line_start: number;
  subject: string | null;
  attribute: string | null;
  value: string | null;
  claim: string;
  confidence: number;
  first_seen: string;
}

/**
 * Structural candidates: live facts from `full` pages, grouped by subject and attribute,
 * where two pages carry values that disagree.
 *
 * No model call. That matters for the same reason it matters inline — the pass has to be
 * runnable on a machine with no chat model, and a candidate list is useful on its own.
 */
export function findCrossPageConflicts(ctx: AknoContext, maxPairs: number): CrossPageConflict[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT p.slug, f.line_start, f.subject, f.attribute, f.value, f.claim, f.confidence, f.first_seen
         FROM facts f JOIN pages p ON p.id = f.page_id
        WHERE f.valid_to IS NULL
          AND p.class = 'full'
          AND f.subject IS NOT NULL
          AND f.attribute IS NOT NULL
          AND f.value IS NOT NULL
          -- §7: a shaky claim must not fight a solid one, the same floor inline uses.
          AND f.confidence >= 0.5
        ORDER BY p.slug, f.line_start`,
    )
    .all() as FactRow[];

  const groups = new Map<string, FactRow[]>();
  for (const row of rows) {
    const key = `${normalize(row.subject!)}|${normalize(row.attribute!)}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const out: CrossPageConflict[] = [];
  for (const [key, facts] of groups) {
    if (facts.length < 2) continue;
    // Same page, same attribute is inline's job and usually a list rather than a
    // contradiction — two lines of one table, say.
    if (new Set(facts.map((fact) => fact.slug)).size < 2) continue;

    const disagreeing = pickDisagreeing(facts);
    if (disagreeing.length < 2) continue;

    const [subject, attribute] = key.split('|');
    out.push({
      subject: subject!,
      attribute: attribute!,
      claims: disagreeing.map((fact) => ({
        slug: fact.slug,
        line: fact.line_start,
        value: fact.value!,
        claim: fact.claim,
        confidence: fact.confidence,
        seen: fact.first_seen.slice(0, 10),
      })),
      verdict: 'unverified',
    });
    if (out.length >= maxPairs) break;
  }
  return out;
}

/** The first pair that genuinely disagrees, plus anything else disagreeing with it. */
function pickDisagreeing(facts: FactRow[]): FactRow[] {
  for (let i = 0; i < facts.length; i++) {
    const anchor = facts[i]!;
    const against = facts.filter(
      (other, index) =>
        index !== i && other.slug !== anchor.slug && valuesConflict(anchor.value!, other.value!),
    );
    if (against.length > 0) return [anchor, ...against];
  }
  return [];
}

const VERIFY = `You judge whether two claims from a personal knowledge base genuinely contradict each other.

Reply with JSON only:
{ "conflict": true, "current": "the slug of the claim more likely to be current, or null" }

Two claims conflict when they state different values for the same thing at the same time. They do NOT
conflict when:
- They describe different things that happen to share a label.
- They are the same value written differently, or one is a rounding of the other.
- They are true of different periods, and both say so.
- One is a total and the other a part of it.

When you cannot tell, answer false. A false alarm wastes someone's afternoon looking for a contradiction
that was never there.`;

/**
 * Asks the chat model whether each candidate really is a contradiction.
 *
 * §8 puts this here rather than inline: "correctness that requires a model call per write
 * belongs in the background, not in the turn." A verdict of `unverified` is left on anything
 * the model could not judge, because dropping those would turn "we did not check" into "we
 * checked and it was fine".
 */
export async function verifyConflicts(
  ctx: AknoContext,
  candidates: CrossPageConflict[],
): Promise<{ conflicts: CrossPageConflict[]; warnings: string[] }> {
  if (!ctx.models.chat.available || candidates.length === 0) {
    return { conflicts: candidates, warnings: [] };
  }

  const warnings: string[] = [];
  const conflicts: CrossPageConflict[] = [];

  for (const candidate of candidates) {
    const listed = candidate.claims
      .map((claim) => `- [${claim.slug}] ${claim.claim} (recorded ${claim.seen})`)
      .join('\n');
    const result = await ctx.models.chat.chat(
      [
        { role: 'system', content: VERIFY },
        { role: 'user', content: `Subject: ${candidate.subject} / ${candidate.attribute}\n\n${listed}` },
      ],
      { json: true, maxTokens: 200 },
    );

    if (!result.ok || !result.value) {
      warnings.push(
        `could not verify the ${candidate.subject} / ${candidate.attribute} conflict: ${result.error ?? 'no reply'}`,
      );
      conflicts.push(candidate);
      continue;
    }

    const parsed = parseJsonLoose<{ conflict?: unknown; current?: unknown }>(result.value);
    if (!parsed || typeof parsed.conflict !== 'boolean') {
      conflicts.push(candidate);
      continue;
    }

    const current =
      typeof parsed.current === 'string' && candidate.claims.some((claim) => claim.slug === parsed.current)
        ? parsed.current
        : undefined;

    conflicts.push({
      ...candidate,
      verdict: parsed.conflict ? 'real' : 'not_a_conflict',
      ...(current ? { likelyCurrent: current } : {}),
    });
  }

  return { conflicts, warnings };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}
