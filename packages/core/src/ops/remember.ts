import { RememberInput, type ApprovalRequest, type RememberOutput, type WriteTarget } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { runRetain, type RetainCandidate } from '../write/retain.ts';
import { newPrefixedId } from '../store/ids.ts';
import { recall } from './recall.ts';
import { write } from './write.ts';

/**
 * §8. Hand over a transcript or notes; Akno runs the retain mission with its own
 * model and produces the writes itself. **The answer for a host that does not want
 * to build a curator** — an agent that wants control uses `write` and ignores this.
 *
 * The steps are §8's, in order: retain mission → route by recall → conflict check →
 * edit the file → journal → the indexer follows. `remember` never writes a fact.
 * It writes a *sentence into a file*, and facts appear afterwards because facts are
 * derived from sentences.
 */
export async function remember(ctx: AknoContext, rawInput: unknown): Promise<RememberOutput> {
  const input = RememberInput.parse(rawInput);

  const retained = await runRetain(input.text, ctx.models.chat, {
    today: new Date().toISOString().slice(0, 10),
  });

  if (retained.error) {
    // §14: no chat model means no `remember`. Saying so is the whole contract —
    // silently keeping nothing would look identical to "nothing was worth keeping".
    return {
      status: 'degraded',
      degraded: [ctx.models.chat.degradedReason({})],
      outcome: 'noop',
      note: `the retain mission could not run: ${retained.error}`,
    };
  }

  if (retained.candidates.length === 0 && retained.events.length === 0) {
    return {
      status: 'ok',
      outcome: 'noop',
      considered: [],
      note: 'nothing in that text was worth keeping — no durable claim, decision or preference',
    };
  }

  // ── Route ───────────────────────────────────────────────────────────────
  const routed = await Promise.all(
    retained.candidates.map(async (candidate) => ({
      candidate,
      ...(await route(ctx, candidate)),
    })),
  );

  const considered = routed.map((entry) => ({
    claim: entry.candidate.text,
    kept: entry.slug !== null,
    slug: entry.slug,
    score: Math.round(entry.score * 1000) / 1000,
  }));

  if (input.dry_run) {
    return {
      status: 'ok',
      outcome: 'ok',
      considered,
      note: 'dry run — nothing was written',
    };
  }

  // ── Write ───────────────────────────────────────────────────────────────
  const wrote: WriteTarget[] = [];
  const approvals: ApprovalRequest[] = [];
  const changeIds: string[] = [];
  let added = 0;

  for (const entry of routed) {
    if (entry.slug === null) {
      // §8: below the threshold it becomes a `requires_approval` proposal listing
      // the candidates rather than a guess. A fact quietly landing on a plausible
      // wrong page is invisible until someone reads it back months later.
      approvals.push(proposeUnrouted(ctx, entry.candidate, entry.nearest));
      continue;
    }

    const result = await write(ctx, { slug: entry.slug, append: entry.candidate.text });
    if (result.outcome === 'ok') {
      wrote.push(...(result.wrote ?? []));
      if (result.change_id) changeIds.push(result.change_id);
      added += result.facts?.added ?? 0;
    } else if (result.approval) {
      approvals.push(result.approval);
    } else if (result.conflict) {
      // A conflict from `remember` is not something to resolve unilaterally: the
      // caller has a user to ask, and this op has no mandate to overwrite a value.
      approvals.push({
        proposal_id: recordConflictProposal(ctx, entry.slug, entry.candidate, result.conflict.existing),
        reason:
          `'${entry.slug}' already claims something different: ${result.conflict.existing}. ` +
          'Ask which is current.',
        nearest: [entry.slug],
      });
    }
  }

  // §10 step 3: the retain mission emits events alongside facts, and this is what
  // makes the timeline maintain itself — nobody has to notice a sentence was an
  // event.
  for (const event of retained.events) {
    const result = await write(ctx, { event });
    if (result.outcome === 'ok') {
      wrote.push(...(result.wrote ?? []));
      if (result.change_id) changeIds.push(result.change_id);
    }
  }

  if (wrote.length === 0) {
    return {
      status: 'ok',
      outcome: approvals.length > 0 ? 'requires_approval' : 'noop',
      considered,
      ...(approvals.length > 0 ? { approvals } : {}),
      note:
        approvals.length > 0
          ? 'nothing was written: every candidate needs a decision from the user'
          : 'nothing was written',
    };
  }

  return {
    status: 'ok',
    outcome: approvals.length > 0 ? 'requires_approval' : 'ok',
    ...(changeIds[0] ? { change_id: changeIds[0] } : {}),
    wrote,
    facts: { retired: 0, added },
    considered,
    ...(approvals.length > 0 ? { approvals } : {}),
  };
}

// ─── Routing ────────────────────────────────────────────────────────────────

/**
 * §8 step 2. An internal `recall` finds where a claim belongs. **Best score at or
 * above `route_threshold` wins and the write proceeds; below that it becomes a
 * proposal listing the candidates** rather than a guess.
 *
 * §19 is candid that 0.5 is a placeholder and cannot be tuned by intuition,
 * because the failure it guards against — a fact quietly landing on a plausible
 * wrong page — is invisible until someone reads it back months later. The
 * mechanism is here; only the number moves.
 */
async function route(
  ctx: AknoContext,
  candidate: RetainCandidate,
): Promise<{ slug: string | null; score: number; nearest: string[] }> {
  const result = await recall(ctx, {
    query: `${candidate.subject}. ${candidate.text}`,
    mode: 'lookup',
    limit: 5,
    // Summaries only: routing is a decision about *which page*, and line windows
    // are budget spent on text nobody reads here.
    depth: 'summary',
  });

  const best = result.cards[0];
  const nearest = result.cards.slice(0, 4).map((card) => card.slug);
  if (!best) return { slug: null, score: 0, nearest };

  // Never route into a `reference` page: it is somebody else's words, and §5 is
  // explicit that only claims become facts. Appending a claim to evidence would
  // make the class boundary meaningless.
  const writable = result.cards.find((card) => card.class === 'full');
  if (!writable) return { slug: null, score: best.score, nearest };

  return writable.score >= ctx.config.routeThreshold
    ? { slug: writable.slug, score: writable.score, nearest }
    : { slug: null, score: writable.score, nearest };
}

function proposeUnrouted(ctx: AknoContext, candidate: RetainCandidate, nearest: string[]): ApprovalRequest {
  const id = newPrefixedId('prop');
  ctx.store.db
    .prepare(
      `INSERT INTO proposals(id, at, kind, reason, subject, payload, nearest, status)
       VALUES(?, ?, 'route', ?, ?, ?, ?, 'pending')`,
    )
    .run(
      id,
      new Date().toISOString(),
      `no page scored above ${ctx.config.routeThreshold} for "${candidate.subject}"`,
      candidate.subject,
      JSON.stringify({ append: candidate.text }),
      JSON.stringify(nearest),
    );

  return {
    proposal_id: id,
    reason: `nothing scored above ${ctx.config.routeThreshold} for "${candidate.subject}" — ask where this goes`,
    nearest,
  };
}

function recordConflictProposal(
  ctx: AknoContext,
  slug: string,
  candidate: RetainCandidate,
  existing: string,
): string {
  const id = newPrefixedId('prop');
  ctx.store.db
    .prepare(
      `INSERT INTO proposals(id, at, kind, reason, subject, payload, nearest, status)
       VALUES(?, ?, 'conflict', ?, ?, ?, ?, 'pending')`,
    )
    .run(
      id,
      new Date().toISOString(),
      `'${slug}' already claims: ${existing}`,
      slug,
      JSON.stringify({ slug, append: candidate.text }),
      JSON.stringify([slug]),
    );
  return id;
}
