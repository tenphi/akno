import {
  RememberInput,
  type ApprovalRequest,
  type FolderRequired,
  type RememberOutput,
  type WriteTarget,
} from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { ModelClient } from '../models/client.ts';
import { runRetain, type RetainCandidate } from '../write/retain.ts';
import { newPrefixedId } from '../store/ids.ts';
import { isReserved } from '../reserved.ts';
import { folderCatalog } from '../kb/folders.ts';
import { recall } from './recall.ts';
import { write } from './write.ts';

/**
 * Hand over a transcript or notes; Akno runs the retain mission with its own
 * model and produces the writes itself. **The answer for a host that does not want
 * to build a curator** — an agent that wants control uses `write` and ignores this.
 *
 * The steps, in order: retain mission → route by recall → conflict check →
 * edit the file → journal → the indexer follows. `remember` never writes a fact.
 * It writes a *sentence into a file*, and facts appear afterwards because facts are
 * derived from sentences.
 *
 * **Two things the caller controls, and one it does not.** It supplies the text and,
 * optionally, a `mission` — what to pay attention to in this particular text, which is the
 * knowledge only the caller has: that a message was forwarded and belongs on somebody else's
 * page, that a channel is mostly logistics, that a subject matters today. What it cannot
 * supply is a replacement for the standing rules; the mission is appended to them. A host
 * that wants to decide phrasing and placement itself has `write` for exactly that.
 *
 * **Retain runs on the cycle's model when one is configured.** It is a maintenance tier, and
 * the tier's output is largely a function of the model behind it — the same measurement that
 * put `maintenance.model` there in the first place. A knowledge base pointing the nightly
 * cycle at a strong model wants its conversation digests to use it too, and would not expect
 * to configure that twice.
 */
export async function remember(ctx: AknoContext, rawInput: unknown): Promise<RememberOutput> {
  const input = RememberInput.parse(rawInput);

  // Retain is a tier with a mission and an on/off switch like the others. Honouring
  // both here is what makes that config real: a `mission` nothing reads is a promise the file
  // makes and the code breaks.
  if (!ctx.config.maintenance.retain.enabled) {
    return {
      status: 'ok',
      outcome: 'noop',
      note: 'the retain tier is disabled in config (maintenance.retain.enabled) — nothing was kept',
    };
  }

  const curator = ctx.config.maintenance.model
    ? new ModelClient(ctx.config.maintenance.model)
    : ctx.models.derive;

  // The caller's mission wins over the install's, because it is the more specific of the two:
  // config states a standing policy, a call states what is true of this text.
  const mission = input.mission ?? ctx.config.maintenance.retain.mission;
  const catalog = folderCatalog(ctx.config, ctx.store);

  const retained = await runRetain(input.text, curator, {
    today: new Date().toISOString().slice(0, 10),
    ...(mission ? { mission } : {}),
    folders: catalog,
  });

  if (retained.error) {
    // No model means no `remember`. Saying so is the whole contract —
    // silently keeping nothing would look identical to "nothing was worth keeping".
    return {
      status: 'degraded',
      degraded: [curator.degradedReason({})],
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

  // `kept` covers a claim bound for a page that does not exist yet, not just one that routed.
  // It used to mean "routed", and once creating became possible that made every new page read
  // back as a claim that had been dropped.
  const considered = routed.map((entry) => ({
    claim: entry.candidate.text,
    kept: entry.slug !== null || entry.candidate.page !== undefined,
    slug: entry.slug ?? entry.candidate.page ?? null,
    score: Math.round(entry.score * 1000) / 1000,
    written: false,
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
  const foldersNeeded: FolderRequired[] = [];
  const changeIds: string[] = [];
  let added = 0;

  for (const [index, entry] of routed.entries()) {
    // Nothing existing holds this. **A page is created rather than a question filed** —
    // `remember` had no create path at all, so a claim with no home became a proposal, and a
    // proposal is a page nobody writes. It fell hardest on findings about the world: their
    // natural folders are `reference` class, routing refuses those on principle, and every
    // finding therefore arrived at the one outcome that stores nothing.
    const target = entry.slug ?? entry.candidate.page ?? null;
    const creating = entry.slug === null;
    if (target === null) {
      // No destination and no suggestion. This is the one case still worth a question: the
      // curator could not even name where it would go.
      approvals.push(proposeUnrouted(ctx, entry.candidate, entry.nearest));
      continue;
    }

    const result = await write(
      ctx,
      creating
        ? { slug: target, content: entry.candidate.text, title: titleFor(entry.candidate) }
        : { slug: target, append: entry.candidate.text },
    );
    if (result.outcome === 'ok') {
      considered[index]!.written = true;
      wrote.push(...(result.wrote ?? []));
      if (result.change_id) changeIds.push(result.change_id);
      added += result.facts?.added ?? 0;
    } else if (result.requires_folder) {
      // The caller declares the folder and calls again. Nothing is filed for a user to
      // answer, because there is nothing here a user could usefully answer.
      foldersNeeded.push(result.requires_folder);
    } else if (result.approval) {
      approvals.push(result.approval);
    } else if (result.conflict) {
      // A conflict from `remember` is not something to resolve unilaterally: the
      // caller has a user to ask, and this op has no mandate to overwrite a value.
      approvals.push({
        proposal_id: recordConflictProposal(ctx, target, entry.candidate, result.conflict.existing),
        reason:
          `'${target}' already claims something different: ${result.conflict.existing}. ` +
          'Ask which is current.',
        nearest: [target],
      });
    }
  }

  // The retain mission emits events alongside facts, and this is what
  // makes the timeline maintain itself — nobody has to notice a sentence was an
  // event.
  for (const event of retained.events) {
    const result = await write(ctx, { event });
    if (result.outcome === 'ok') {
      wrote.push(...(result.wrote ?? []));
      if (result.change_id) changeIds.push(result.change_id);
    }
  }

  // Deduplicated: three findings bound for the same new folder are one thing to do, not three.
  const folders = foldersNeeded.filter(
    (required, index) => foldersNeeded.findIndex((other) => other.folder === required.folder) === index,
  );

  // `requires_folder` outranks `requires_approval` in the outcome, because they ask different
  // people. A folder is the caller's to declare, now, without leaving the turn; an approval
  // waits on the user. Reporting the first as the second is how a caller learns to stop.
  const outcome = folders.length > 0 ? 'requires_folder' : approvals.length > 0 ? 'requires_approval' : null;

  const held = [
    folders.length > 0
      ? `${folders.map((required) => `'${required.folder}'`).join(', ')} ` +
        `${folders.length === 1 ? 'has' : 'have'} not been declared — call \`folder\` with a ` +
        'description of what belongs there, then repeat this'
      : null,
    approvals.length > 0 ? 'some claims need the user to say where they go' : null,
  ].filter(Boolean);

  if (wrote.length === 0) {
    return {
      status: 'ok',
      outcome: outcome ?? 'noop',
      considered,
      ...(approvals.length > 0 ? { approvals } : {}),
      ...(folders.length > 0 ? { requires_folder: folders } : {}),
      note: held.length > 0 ? `nothing was written: ${held.join('; ')}` : 'nothing was written',
    };
  }

  return {
    status: 'ok',
    outcome: outcome ?? 'ok',
    ...(changeIds[0] ? { change_id: changeIds[0] } : {}),
    wrote,
    facts: { retired: 0, added },
    considered,
    ...(approvals.length > 0 ? { approvals } : {}),
    ...(folders.length > 0 ? { requires_folder: folders } : {}),
    ...(held.length > 0 ? { note: held.join('; ') } : {}),
  };
}

/**
 * A title for a page being created, from the subject the curator already named.
 *
 * `write` derives one from the slug when none is given, and a slug-derived title reads like a
 * filename ("Tvr Complaint 2026 08"). The subject is a phrase a person wrote.
 */
function titleFor(candidate: RetainCandidate): string {
  const subject = candidate.subject.trim();
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

// ─── Routing ────────────────────────────────────────────────────────────────

/**
 * An internal `recall` finds where a claim belongs. **Best score at or above
 * `route_threshold` wins and the claim is appended there; below that a page is created** at
 * the slug the curator suggested.
 *
 * The second half is new, and it is the difference between a knowledge base that grows and one
 * that only thickens. Below the threshold used to mean a proposal — a question for the user
 * about where a claim goes — and a proposal is a page nobody writes. It fell hardest on
 * exactly the material a knowledge base most needs new pages for: a finding about the world
 * belongs in `research/` or `wiki/`, those folders are `reference` class, routing refuses
 * reference pages on principle, and so every finding reached the one outcome that stores
 * nothing. Creating is the honest answer to "nothing here holds this".
 *
 * 0.5 is a placeholder and cannot be tuned by intuition, because the failure it guards against
 * is invisible until someone reads it back months later. The mechanism is here; only the
 * number moves.
 */
/**
 * Routing thresholds **`relevance`, never `score`.**
 *
 * `score` orders one result set: the best hit is 1.0 whether it is a perfect match or
 * the least bad of a bad batch. Thresholding it meant every document found a home and
 * "A document with no home stays put" could never fire — routing looked like it
 * worked and was in fact unconditional.
 *
 * `relevance` is absolute when a cross-encoder or the embedding arm supplied one. With
 * neither — a lexical-only search — there is no number to compare, so routing refuses
 * and asks. The failure this guards against — a fact quietly landing on a plausible wrong
 * page — is invisible until someone reads it back months later, and a guess is worse than a
 * question.
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
    // The query is the claim itself; a model rewriting it cannot improve the match.
    expand: false,
  });

  // Never route into a `reference` page: it is somebody else's words, and the rule is
  // explicit that only claims become facts. Appending a claim to evidence would make
  // the class boundary meaningless.
  //
  // And never into a reserved path. The ledger is the one that bites: it is a plain `full`
  // page, so nothing above disqualified it, and a ledger that already records events about a
  // subject is *the best lexical match for that subject* — which is how a claim about an
  // ongoing complaint came to be appended below the event list of the page recording it, in
  // prose the event parser cannot see. The destination that scores highest is not always a
  // destination.
  const candidates = result.cards.filter(
    (card) =>
      card.class === 'full' &&
      !isReserved(card.slug, ctx.config) &&
      isInsideSuggestedFolder(card.slug, candidate.page),
  );

  // Suggestions are drawn from the same set, not from every card. Offering a `reference` page as
  // somewhere a claim "could go instead" proposes a destination this very function would refuse —
  // observed live: a rent figure was offered four dispute pages, all of them evidence, and the
  // agent read the list as the intended home and told the user it would be filed there.
  const nearest = candidates.slice(0, 4).map((card) => card.slug);

  const writable = candidates.find((card) => card.relevance !== undefined);
  if (!writable) return { slug: null, score: 0, nearest };

  const relevance = writable.relevance!;
  return relevance >= ctx.config.routeThreshold
    ? { slug: writable.slug, score: relevance, nearest }
    : { slug: null, score: relevance, nearest };
}

/**
 * The retain model chooses the taxonomy branch from the complete folder catalog; recall chooses a
 * page inside that branch. Letting recall cross the branch boundary turns topical similarity into
 * ownership — a general music finding can otherwise land on a person's repertoire page.
 */
function isInsideSuggestedFolder(slug: string, suggestedPage: string | undefined): boolean {
  // No taxonomy choice means no automatic destination. The retain prompt asks for one whenever
  // an existing folder fits; omission is uncertainty, and uncertainty should become a proposal.
  if (!suggestedPage) return false;
  const folder = suggestedPage.slice(0, suggestedPage.lastIndexOf('/'));
  return slug.startsWith(`${folder}/`);
}

export { isInsideSuggestedFolder as isInsideSuggestedFolderForTesting };

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
      nearest.length > 0
        ? `no page scored above ${ctx.config.routeThreshold} for "${candidate.subject}"`
        : `no page exists that could hold "${candidate.subject}" — every near match is reference material`,
      candidate.subject,
      JSON.stringify({ append: candidate.text }),
      JSON.stringify(nearest),
    );

  return {
    proposal_id: id,
    reason:
      nearest.length > 0
        ? `nothing scored above ${ctx.config.routeThreshold} for "${candidate.subject}" — ask where this goes`
        : `no page could hold "${candidate.subject}" — every near match is reference material, so this needs a new page`,
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
