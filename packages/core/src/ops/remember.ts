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
import { folderCatalog, physicalFolderExists } from '../kb/folders.ts';
import { parsePage } from '../kb/page.ts';
import { contentWords } from '../kb/words.ts';
import { detectConflict } from '../write/conflict.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { placeManagedItems, type ManagedItem } from '../write/placement.ts';
import { recall } from './recall.ts';
import { appendToLedger, titleFromSlug } from './write.ts';
import fsp from 'node:fs/promises';
import path from 'node:path';

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

  // ── Place and write ─────────────────────────────────────────────────────
  // One group per target means one placement-model call per page and one journal entry for the
  // whole remember operation. A turn that keeps three related facts is one undoable decision.
  const wrote: WriteTarget[] = [];
  const approvals: ApprovalRequest[] = [];
  const foldersNeeded: FolderRequired[] = [];
  const groups = new Map<string, { entries: { index: number; candidate: RetainCandidate }[] }>();

  for (const [index, entry] of routed.entries()) {
    const target = entry.slug ?? entry.candidate.page ?? null;
    if (target === null) {
      approvals.push(proposeUnrouted(ctx, entry.candidate, entry.nearest));
      continue;
    }

    // **Creating a page on a guess is fine. Appending to an existing one is not.**
    //
    // `entry.slug === null` is routing having looked at the ranked candidates and said no page
    // here is a home for this. The claim then fell through to `candidate.page` — a slug the
    // retain model wrote before any of those candidates were scored — and if that slug happened
    // to name a real page, the claim was appended to it with nothing having judged the pairing.
    //
    // Observed 2026-08-16: a meal-box order appended to `household/concerts-2026`, a page the
    // reranker scores 0.026 against it, under a heading invented for the occasion. Nothing was
    // broken — routing refused correctly, the fallback simply outranked the refusal.
    //
    // A guess that names *no* page still creates one: that is the case the fallback exists for,
    // and a new page is inspectable and cheap to move. A guess that lands on somebody else's
    // page becomes a question instead.
    if (entry.slug === null && pageExists(ctx, target)) {
      considered[index]!.kept = false;
      considered[index]!.slug = null;
      approvals.push(proposeUnrouted(ctx, entry.candidate, entry.nearest, target));
      continue;
    }

    const group = groups.get(target) ?? { entries: [] };
    group.entries.push({ index, candidate: entry.candidate });
    groups.set(target, group);
  }

  const pending: { slug: string; relPath: string; content: string; existed: boolean; indexes: number[] }[] =
    [];
  for (const [slug, group] of groups) {
    const row = ctx.store.db
      .prepare('SELECT id, rel_path, role, remember_management FROM pages WHERE slug = ?')
      .get(slug) as { id: string; rel_path: string; role: string; remember_management: string } | undefined;

    if (row && (row.role !== 'knowledge' || row.remember_management !== 'integrate')) {
      for (const entry of group.entries) approvals.push(proposeUnrouted(ctx, entry.candidate, []));
      continue;
    }

    // The same policy, for a page that does not exist yet.
    //
    // The check above reads `role` and `remember_management` off the page row, so a folder
    // declared `remember: "deny"` protected only the pages already in it — creation consulted
    // nothing but whether the parent directory existed. `users/` is the case that bites: those
    // are per-person hot-memory pages, standing instructions injected every turn, and the
    // folder exists, so a claim the retain model addressed to `users/google-account` was
    // created there without anything having a chance to refuse. Declining to create is the
    // same answer the folder already gives to writing.
    const parent = slug.slice(0, slug.lastIndexOf('/'));
    if (!row && !physicalFolderExists(ctx.config, parent)) {
      foldersNeeded.push({
        folder: parent,
        nearest: catalog
          .filter((folder) => folder.eligible)
          .map((folder) => folder.path)
          .slice(0, 8),
      });
      continue;
    }

    const relPath = row?.rel_path ?? `${slug}.md`;
    const current = row
      ? await fsp.readFile(path.join(ctx.config.aknoPath, relPath), 'utf8')
      : newManagedPage(titleFor(group.entries[0]!.candidate, slug));
    const accepted: { index: number; candidate: RetainCandidate }[] = [];
    for (const entry of group.entries) {
      if (row) {
        const page = parsePage(relPath, current);
        const conflict = detectConflict({
          store: ctx.store,
          pageId: row.id,
          slug,
          body: page.body,
          bodyStartLine: page.bodyLine,
          incoming: entry.candidate.text,
        });
        if (conflict) {
          approvals.push({
            proposal_id: recordConflictProposal(ctx, slug, entry.candidate, conflict.existing),
            reason: `'${slug}' already claims something different: ${conflict.existing}. Ask which is current.`,
            nearest: [slug],
          });
          continue;
        }
      }
      accepted.push(entry);
    }
    if (accepted.length === 0) continue;

    const items: ManagedItem[] = accepted.map(({ candidate }) => ({
      id: newPrefixedId('itm'),
      text: candidate.text,
      source: input.source ?? 'remember',
      origin: candidate.origin ?? 'unknown',
    }));
    const placed = await placeManagedItems(current, items, curator);
    // Placement failure is recoverable and visible in Markdown: no claim is lost, and the next
    // curate pass has an explicit `## Unsorted` inbox to integrate.
    pending.push({
      slug,
      relPath,
      content: placed.content,
      existed: Boolean(row),
      indexes: accepted.map((entry) => entry.index),
    });
  }

  const files: ChangeFile[] = [];
  for (const page of pending) {
    const result = await writeFileAtomic(ctx.config.aknoPath, page.relPath, page.content);
    files.push(fileEntry(result));
    page.indexes.forEach((index) => {
      considered[index]!.written = true;
    });
    wrote.push({ slug: page.slug, action: page.existed ? 'appended' : 'created' });
  }

  for (const event of retained.events) {
    const ledger = await appendToLedger(ctx, event);
    if (ledger.file) files.push(ledger.file);
    wrote.push({
      slug: ctx.config.paths.timeline.replace(/\.(md|markdown)$/i, ''),
      line: ledger.line,
      action: 'event',
    });
  }

  const changeId =
    files.length > 0
      ? ctx.journal.record({
          actor: ctx.actor,
          op: 'remember',
          summary: `remembered ${considered.filter((entry) => entry.written).length} item(s)`,
          files,
        })
      : null;

  let added = 0;
  if (files.length > 0) {
    const paths = [...new Set(files.map((file) => file.relPath))];
    const report = await ctx.indexer.run({ only: paths, modelPaths: [] });
    ctx.derive.schedule(paths);
    added = report.factsDerived;
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
    ...(changeId ? { change_id: changeId } : {}),
    wrote,
    facts: { retired: 0, added },
    considered,
    ...(approvals.length > 0 ? { approvals } : {}),
    ...(folders.length > 0 ? { requires_folder: folders } : {}),
    ...(held.length > 0 ? { note: held.join('; ') } : {}),
  };
}

/**
 * A title for a page being created: the subject the curator named, unless that subject is not
 * what the page is.
 *
 * `write` derives one from the slug when none is given, and a slug-derived title reads like a
 * filename ("Tvr Complaint 2026 08"). The subject is a phrase a person wrote, so it wins wherever
 * the two are about the same thing.
 *
 * They are not always about the same thing, and that is this function's whole problem. The slug
 * comes from routing, which scored ranked candidates; the subject came off one claim. A claim
 * about the Shin-Osaka–Hakata Shinkansen addressed to `travel/2027/japan-trip` created that page
 * — the right page — titled "Osaka Fukuoka train", and for two days every recall reported a
 * three-week trip under the name of the single fact that happened to open it. A claim is
 * superseded in a week; the title it installed outlives it by months.
 *
 * **One shared content word is enough to keep the subject.** The question is not whether the two
 * agree closely, only whether they are about the same thing at all: `people/jane-doe` and "Jane
 * Doe" share both words, `tvr-complaint-2026-08` and "TVR complaint" share two, `japan-trip` and
 * "Osaka Fukuoka train" share none. Falling back costs a plainer title, which is a cost worth
 * paying — a slug-derived title is dull but it is never about the wrong thing.
 */
function titleFor(candidate: RetainCandidate, slug: string): string {
  const subject = candidate.subject.trim();
  if (subject.length === 0) return titleFromSlug(slug);

  const named = contentWords(slug.slice(slug.lastIndexOf('/') + 1));
  for (const word of contentWords(subject)) {
    if (named.has(word)) return subject.charAt(0).toUpperCase() + subject.slice(1);
  }
  return titleFromSlug(slug);
}

function newManagedPage(title: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n---\n\n# ${title}\n`;
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
 * belongs in `research/` or `wiki/`, those folders have the `source` role, routing refuses
 * source pages on principle, and so every finding reached the one outcome that stores
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
/**
 * Two questions, asked in order.
 *
 * The claim scores first, because the claim is what makes routing *specific*: when two pages
 * could own a subject, only the attribute text says which. But a cross-encoder judges "does
 * this passage answer this query", and a claim carries an attribute the owning page has no
 * reason to already state. Measured here: "Collegium Leoninum. В отеле … бассейн … сауна и
 * фитнес-зал" scored the trip page that names the hotel three times at **0.27**, because the
 * page's accommodation paragraph answers *where they are staying*, not *whether it has a pool*.
 * The subject alone scored the same page **0.97**. Same index, same options, same threshold.
 *
 * So the subject is asked only when the claim found nobody — the ownership question after the
 * answers-this question came back empty. It costs a second recall exactly when the alternative
 * was creating a page, never on the path that already routed, and it can only rescue a miss:
 * a claim that routed keeps the destination its own text chose.
 */
async function route(
  ctx: AknoContext,
  candidate: RetainCandidate,
): Promise<{ slug: string | null; score: number; nearest: string[] }> {
  const byClaim = await scoreDestinations(ctx, `${candidate.subject}. ${candidate.text}`, candidate);
  if (byClaim.slug !== null) return byClaim;

  const subject = candidate.subject.trim();
  if (subject.length === 0) return byClaim;
  const bySubject = await scoreDestinations(ctx, subject, candidate);
  if (bySubject.slug !== null) return bySubject;

  // Neither routed. Report whichever came closer, and prefer the claim pass's suggestions:
  // they were drawn against the text the user actually said.
  const closer = bySubject.score > byClaim.score ? bySubject : byClaim;
  return { ...closer, nearest: byClaim.nearest.length > 0 ? byClaim.nearest : bySubject.nearest };
}

async function scoreDestinations(
  ctx: AknoContext,
  query: string,
  candidate: RetainCandidate,
): Promise<{ slug: string | null; score: number; nearest: string[] }> {
  const result = await recall(ctx, {
    query,
    mode: 'lookup',
    limit: 5,
    // Summaries only: routing is a decision about *which page*, and line windows
    // are budget spent on text nobody reads here.
    depth: 'summary',
    // The query is the claim itself; a model rewriting it cannot improve the match.
    expand: false,
  });

  // Never route into a source page: it is somebody else's words, and the rule is
  // explicit that only claims become facts. Appending a claim to evidence would make
  // the role boundary meaningless.
  //
  // And never into a reserved path. The ledger is the one that bites: it is a plain `full`
  // page, so nothing above disqualified it, and a ledger that already records events about a
  // subject is *the best lexical match for that subject* — which is how a claim about an
  // ongoing complaint came to be appended below the event list of the page recording it, in
  // prose the event parser cannot see. The destination that scores highest is not always a
  // destination.
  const candidates = result.cards.filter(
    (card) =>
      card.role === 'knowledge' &&
      !isReserved(card.slug, ctx.config) &&
      isInsideSuggestedFolder(card.slug, candidate.page),
  );

  // Suggestions are drawn from the same set, not from every card. Offering a source page as
  // somewhere a claim "could go instead" proposes a destination this very function would refuse —
  // observed live: a rent figure was offered four dispute pages, all of them evidence, and the
  // agent read the list as the intended home and told the user it would be filed there.
  const nearest = candidates.slice(0, 4).map((card) => card.slug);

  // **The best-judged candidate, not the best-ranked one.**
  //
  // This took the first card with a relevance and thresholded only that. Card order is
  // `score * rankFactor`, and a card's score is the best of its chunks, so the page that leads
  // is the page with one strong passage — not necessarily the page a cross-encoder considers
  // the right home. When the leader fell below the threshold, routing refused and the claim
  // dropped to the retain model's guessed slug, with every remaining candidate unread.
  //
  // Observed 2026-08-16: a meal-box order was filed onto `household/concerts-2026`, which the
  // reranker scored 0.026, while `household/subscriptions` — already holding that supplier's
  // cancellation — scored 0.755 and was never looked at. The measurement was bought and
  // discarded. Taking the maximum cannot route anything the old code would have refused *and*
  // the threshold rejects; it can only stop a low leader from hiding a qualified page behind it.
  const scored = candidates.filter((card) => card.relevance !== undefined);
  if (scored.length === 0) return { slug: null, score: 0, nearest };

  const writable = scored.reduce((best, card) => (card.relevance! > best.relevance! ? card : best));
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

/** Does a page with this slug already exist, whatever its role? */
function pageExists(ctx: AknoContext, slug: string): boolean {
  return ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug) !== undefined;
}

/**
 * `refusedPage` names an existing page the retain model suggested and routing declined to use.
 * It gets its own wording: the other two say a page has to be *found* or *made*, and neither
 * describes the case where one was named, exists, and was judged not to be a home for this.
 */
function proposeUnrouted(
  ctx: AknoContext,
  candidate: RetainCandidate,
  nearest: string[],
  refusedPage?: string,
): ApprovalRequest {
  const id = newPrefixedId('prop');
  const threshold = ctx.config.routeThreshold;
  const stored = refusedPage
    ? `nothing scored above ${threshold} for "${candidate.subject}"; the suggested page "${refusedPage}" exists but was not judged a home for it`
    : nearest.length > 0
      ? `no page scored above ${threshold} for "${candidate.subject}"`
      : `no page exists that could hold "${candidate.subject}" — every near match is source material`;

  ctx.store.db
    .prepare(
      `INSERT INTO proposals(id, at, kind, reason, subject, payload, nearest, status)
       VALUES(?, ?, 'route', ?, ?, ?, ?, 'pending')`,
    )
    .run(
      id,
      new Date().toISOString(),
      stored,
      candidate.subject,
      JSON.stringify({ append: candidate.text }),
      JSON.stringify(nearest),
    );

  return {
    proposal_id: id,
    reason: refusedPage
      ? `"${refusedPage}" already exists and nothing judged it a home for "${candidate.subject}" — ask where this goes rather than appending to it`
      : nearest.length > 0
        ? `nothing scored above ${threshold} for "${candidate.subject}" — ask where this goes`
        : `no page could hold "${candidate.subject}" — every near match is source material, so this needs a new page`,
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
