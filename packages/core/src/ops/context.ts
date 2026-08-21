import {
  ContextInput,
  type Card,
  type ContextOutput,
  type Event,
  type RecallResult,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { estimateTokens } from '../recall/assemble.ts';
import { recall } from './recall.ts';
import { read } from './read.ts';
import { timeline } from './timeline.ts';
import { list } from './list.ts';

/**
 * **One budget, one assembly.** `context` composes the whole pre-turn bundle
 * — pinned pages, recent timeline, structure tree, and this turn's recall —
 * against a single budget. Separate injections with separate budgets overrun
 * together.
 *
 * Why this matters: with the bundle assembled, a turn like "when does
 * the car insurance renew?" costs **zero tool calls**, and the assistant cannot
 * invent the date because every line it was handed says which file and which line
 * it came from.
 */
export async function context(ctx: AknoContext, rawInput: unknown): Promise<ContextOutput> {
  const input = ContextInput.parse(rawInput);
  let remaining = input.budget;
  const degraded = new Set<NonNullable<ContextOutput['degraded']>[number]>();
  let droppedCards = 0;
  let droppedEvents = 0;

  // ── Pinned pages first ───────────────────────────────────────────────────
  // They were pinned precisely so they do not have to compete for room.
  const pinned: Card[] = [];
  for (const slug of input.pinned ?? []) {
    try {
      const result = await read(ctx, { slug });
      if (!result.page) continue;
      const card = cardFromPage(result.page);
      const cost = estimateTokens(card);
      if (cost > remaining) {
        droppedCards++;
        continue;
      }
      pinned.push(card);
      remaining -= cost;
    } catch {
      // A pinned page that no longer exists should not fail the whole bundle;
      // the host's pin list is allowed to go stale.
      droppedCards++;
    }
  }

  // ── Structure outline ────────────────────────────────────────────────────
  let structure: string | undefined;
  if (input.structure !== false) {
    const tree = await list(ctx, { kind: 'tree', depth: 2 });
    if (tree.tree) {
      const cost = Math.ceil(tree.tree.length / 4);
      if (cost <= remaining * 0.15) {
        structure = tree.tree;
        remaining -= cost;
      }
    }
  }

  // ── Recent timeline ──────────────────────────────────────────────────────
  const events: Event[] = [];
  const days = input.timeline_days ?? 90;
  if (days > 0) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const ledger = await timeline(ctx, { since, limit: 60 });
    // The ledger is capped at a fraction of the budget: recent history is
    // context, not the answer, and a long ledger must not crowd out the cards.
    let ledgerBudget = Math.floor(remaining * 0.25);
    for (const event of ledger.events) {
      const cost = Math.ceil((event.summary.length + event.date.length + 20) / 4);
      if (cost > ledgerBudget) {
        droppedEvents = ledger.events.length - events.length;
        break;
      }
      events.push(event);
      ledgerBudget -= cost;
      remaining -= cost;
    }
  }

  // ── This turn's recall ───────────────────────────────────────────────────
  let cards: Card[] = [];
  let results: RecallResult[] = [];
  let searched: string[] = [];
  let coverage: Record<string, boolean> | undefined;

  if (input.query) {
    const pinnedSlugs = new Set(pinned.map((card) => card.slug));
    const result = await recall(ctx, {
      query: input.query,
      budget: remaining,
      ...(input.mode ? { mode: input.mode } : {}),
    });
    searched = result.searched;
    if (result.coverage) coverage = result.coverage;
    for (const reason of result.degraded ?? []) degraded.add(reason);
    // A pinned page already in the bundle must not be paid for twice.
    results = result.results.filter((entry) => entry.type === 'document' || !pinnedSlugs.has(entry.slug));
    cards = result.cards.filter((card) => !pinnedSlugs.has(card.slug));
    droppedCards += result.cards.length - cards.length;
    remaining -= result.budget_used;
  }

  const budgetUsed = input.budget - Math.max(0, remaining);
  const anyDropped = droppedCards > 0 || droppedEvents > 0;

  return {
    status: degraded.size > 0 ? 'degraded' : results.length === 0 && pinned.length === 0 ? 'empty' : 'ok',
    ...(degraded.size > 0 ? { degraded: [...degraded] } : {}),
    pinned,
    results,
    cards,
    events,
    ...(structure ? { structure } : {}),
    searched,
    ...(coverage ? { coverage } : {}),
    budget_used: budgetUsed,
    // Default to visible. A silent trim reads as "that's everything".
    ...(anyDropped ? { dropped: { cards: droppedCards, events: droppedEvents } } : {}),
  };
}

/** A pinned page is delivered in the same card shape as a recalled one, so the
 *  host has one thing to render and the model one thing to read. */
function cardFromPage(page: NonNullable<Awaited<ReturnType<typeof read>>['page']>): Card {
  return {
    slug: page.slug,
    title: page.title,
    role: page.role,
    summary: page.summary,
    score: 1,
    lines: page.lines.filter((line) => line.text.trim().length > 0),
    ...(page.superseded ? { superseded: page.superseded } : {}),
    ...(page.links.length > 0 ? { links: page.links } : {}),
    ...(page.documents ? { documents: page.documents } : {}),
    ...(page.updated ? { updated: page.updated } : {}),
  };
}
