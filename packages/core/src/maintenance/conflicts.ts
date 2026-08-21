import { z } from 'zod';
import type { AknoContext } from '../context.ts';
import { parseJsonLoose } from '../models/client.ts';
import { sha256 } from '../store/ids.ts';
import { valuesConflict } from '../write/conflict.ts';

/**
 * **Cheap inline, thorough offline.** This is the thorough half.
 *
 * Inline detection compares the incoming text against the target page's own lines. That is
 * what makes it affordable on every write, and it is also exactly what it cannot see: two
 * pages that each state a different value for the same thing, neither of them being written
 * right now. Nobody is blocked by that, and nobody notices it either.
 *
 * So this pass joins **facts across the whole knowledge base** on subject and attribute —
 * the two fields the deriver assigns — and reports pairs whose values disagree. It reports; it
 * never writes. Reporting what inline checking missed is the whole job, and a maintenance
 * process that silently rewrites claims is the one thing worse than a duplicate.
 *
 * Knowledge pages only: a source page is somebody else's words, and a contract
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
  /** Stable for the exact indexed claims and prompt policy; changes when any claim changes. */
  fingerprint: string;
  subject: string;
  attribute: string;
  claims: ConflictClaim[];
  /**
   * A model's judgement, when one ran. `unverified` is honest and common: the pass reports
   * structural candidates whether or not a model was available to judge them.
   */
  verdict: 'not_a_conflict' | 'time_scoped' | 'superseded' | 'unresolved' | 'unverified';
  /** Which claim the model thinks is current, when it had an opinion. */
  likelyCurrent?: string;
  /** Content-safe classifier rationale. Never includes claim excerpts. */
  reason?: string;
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
 * runnable on a machine with no model at all, and a candidate list is useful on its own.
 */
export function findCrossPageConflicts(ctx: AknoContext, maxPairs: number): CrossPageConflict[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT p.slug, f.line_start, f.subject, f.attribute, f.value, f.claim, f.confidence, f.first_seen
         FROM facts f JOIN pages p ON p.id = f.page_id
        WHERE f.valid_to IS NULL
          AND p.role = 'knowledge'
          AND f.subject IS NOT NULL
          AND f.attribute IS NOT NULL
          AND f.value IS NOT NULL
          -- A shaky claim must not fight a solid one; the same floor inline uses.
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
    const conflict: CrossPageConflict = {
      fingerprint: '',
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
    };
    conflict.fingerprint = conflictFingerprint(conflict);
    out.push(conflict);
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

const CONFLICT_PROMPT_VERSION = 'typed-v1';

const VERIFY = `You classify structurally incompatible claims from a personal knowledge base.

Reply with JSON only:
{ "outcome": "unresolved", "current": null, "reason": "brief content-safe reason" }

Allowed outcomes:
- not_a_conflict: different subjects, fields, scopes, equivalent values, or total-versus-part.
- time_scoped: both claims explicitly describe different periods and can remain true together.
- superseded: one claim explicitly establishes the current/effective value and the other is stale history.
- unresolved: the claims are incompatible but the supplied text does not prove which one is current.

For superseded, "current" must be copied exactly from one supplied slug. Never infer recency from page order,
confidence, or the date Akno first indexed a page. Use superseded only when the claim text itself establishes
an exact YYYY-MM-DD boundary with as-of, effective, from, or since. When uncertain, use unresolved. The reason
must describe the class of evidence without repeating names, values, or claim text.`;

export const VERIFY_SCHEMA = z.object({
  outcome: z.enum(['not_a_conflict', 'time_scoped', 'superseded', 'unresolved']),
  current: z.string().nullable(),
  reason: z.string(),
});

/**
 * Asks the derive model whether each candidate really is a contradiction.
 *
 * This belongs here rather than inline, because correctness that requires a model call per
 * write belongs in the background. A verdict of `unverified` is left on anything
 * the model could not judge, because dropping those would turn "we did not check" into "we
 * checked and it was fine".
 */
export async function verifyConflicts(
  ctx: AknoContext,
  candidates: CrossPageConflict[],
): Promise<{ conflicts: CrossPageConflict[]; warnings: string[] }> {
  if (!ctx.models.derive.available || candidates.length === 0) {
    return { conflicts: candidates, warnings: [] };
  }

  const warnings: string[] = [];
  const conflicts: CrossPageConflict[] = [];

  for (const candidate of candidates) {
    const cached = cachedVerdict(ctx, candidate);
    if (cached) {
      conflicts.push(cached);
      continue;
    }
    const listed = candidate.claims
      .map((claim) => `- [${claim.slug}] ${claim.claim} (recorded ${claim.seen})`)
      .join('\n');
    const result = await ctx.models.derive.chat(
      [
        { role: 'system', content: VERIFY },
        { role: 'user', content: `Subject: ${candidate.subject} / ${candidate.attribute}\n\n${listed}` },
      ],
      { schema: VERIFY_SCHEMA, maxTokens: 200 },
    );

    if (!result.ok || !result.value) {
      warnings.push(
        `could not verify the ${candidate.subject} / ${candidate.attribute} conflict: ${result.error ?? 'no reply'}`,
      );
      conflicts.push(candidate);
      continue;
    }

    const parsed = parseJsonLoose<{ outcome?: unknown; current?: unknown; reason?: unknown }>(result.value);
    if (
      !parsed ||
      !['not_a_conflict', 'time_scoped', 'superseded', 'unresolved'].includes(String(parsed.outcome)) ||
      typeof parsed.reason !== 'string'
    ) {
      conflicts.push(candidate);
      continue;
    }

    const proposed = parsed.outcome as Exclude<CrossPageConflict['verdict'], 'unverified'>;
    let verdict = proposed;
    const current =
      typeof parsed.current === 'string' && candidate.claims.some((claim) => claim.slug === parsed.current)
        ? parsed.current
        : undefined;

    // A model may recognize a likely chronology, but it cannot create the temporal evidence that
    // authorizes an unattended rewrite. Downgrading keeps both claims and excludes them from inference.
    if (
      verdict === 'superseded' &&
      (!current ||
        !candidate.claims.some(
          (claim) => claim.slug === current && explicitCurrentBoundary(claim.claim) !== null,
        ))
    ) {
      verdict = 'unresolved';
    }
    if (verdict === 'time_scoped' && !candidate.claims.every((claim) => explicitTimeScope(claim.claim))) {
      verdict = 'unresolved';
    }

    const classified: CrossPageConflict = {
      ...candidate,
      verdict,
      ...(verdict === 'superseded' && current ? { likelyCurrent: current } : {}),
      reason:
        verdict === proposed
          ? `classifier selected ${verdict}`
          : `classifier selected ${proposed}, but deterministic temporal evidence was insufficient; treated as unresolved`,
    };
    conflicts.push(classified);
    cacheVerdict(ctx, classified);
  }

  return { conflicts, warnings };
}

function conflictFingerprint(conflict: Pick<CrossPageConflict, 'subject' | 'attribute' | 'claims'>): string {
  return sha256(
    JSON.stringify({
      prompt: CONFLICT_PROMPT_VERSION,
      subject: normalize(conflict.subject),
      attribute: normalize(conflict.attribute),
      claims: [...conflict.claims]
        .map((claim) => ({
          slug: claim.slug,
          line: claim.line,
          value: normalize(claim.value),
          claim: normalize(claim.claim),
        }))
        .sort((a, b) => `${a.slug}:${a.line}`.localeCompare(`${b.slug}:${b.line}`)),
    }),
  );
}

/** Claims that must not support a new observation or principle in this run. */
export function ineligibleConflictClaims(conflicts: CrossPageConflict[]): Set<string> {
  const out = new Set<string>();
  for (const conflict of conflicts) {
    if (conflict.verdict === 'unresolved' || conflict.verdict === 'unverified') {
      for (const claim of conflict.claims) out.add(claimKey(claim.slug, claim.line));
    } else if (conflict.verdict === 'superseded') {
      for (const claim of conflict.claims) {
        if (claim.slug !== conflict.likelyCurrent) out.add(claimKey(claim.slug, claim.line));
      }
    }
  }
  return out;
}

export function claimKey(slug: string, line: number): string {
  return `${slug}\u0000${line}`;
}

/** A dated boundary that can be copied into retained history without inventing chronology. */
export function explicitCurrentBoundary(claim: string): string | null {
  const match = /\b(?:as\s+of|effective(?:\s+on)?|from|since)\s*:?[ \t]*(\d{4}-\d{2}-\d{2})\b/i.exec(claim);
  return match?.[1] ?? null;
}

function explicitTimeScope(claim: string): boolean {
  return (
    /\b(?:before|after|until|during|between|from|since|previously|formerly|as\s+of|effective(?:ly)?|in\s+\d{4})\b/i.test(
      claim,
    ) || /\b\d{4}-\d{2}(?:-\d{2})?\b/.test(claim)
  );
}

function cachedVerdict(ctx: AknoContext, candidate: CrossPageConflict): CrossPageConflict | null {
  if (!conflictCacheAvailable(ctx)) return null;
  const row = ctx.store.db
    .prepare(
      `SELECT verdict, current_slug, reason FROM conflict_verdicts
       WHERE fingerprint = ? AND model_id = ? AND prompt_version = ?`,
    )
    .get(candidate.fingerprint, ctx.models.derive.modelId ?? '', CONFLICT_PROMPT_VERSION) as
    { verdict: CrossPageConflict['verdict']; current_slug: string | null; reason: string | null } | undefined;
  if (!row || row.verdict === 'unverified') return null;
  return {
    ...candidate,
    verdict: row.verdict,
    ...(row.current_slug ? { likelyCurrent: row.current_slug } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  };
}

function cacheVerdict(ctx: AknoContext, conflict: CrossPageConflict): void {
  if (!ctx.writable || !conflictCacheAvailable(ctx) || conflict.verdict === 'unverified') return;
  ctx.store.db
    .prepare(
      `INSERT INTO conflict_verdicts
         (fingerprint, model_id, prompt_version, verdict, current_slug, reason, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fingerprint, model_id, prompt_version) DO UPDATE SET
         verdict = excluded.verdict, current_slug = excluded.current_slug,
         reason = excluded.reason, updated_at = excluded.updated_at`,
    )
    .run(
      conflict.fingerprint,
      ctx.models.derive.modelId ?? '',
      CONFLICT_PROMPT_VERSION,
      conflict.verdict,
      conflict.likelyCurrent ?? null,
      conflict.reason ?? null,
      new Date().toISOString(),
    );
}

function conflictCacheAvailable(ctx: AknoContext): boolean {
  const row = ctx.store.db
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'conflict_verdicts'")
    .get() as { present: number } | undefined;
  return row?.present === 1;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}
