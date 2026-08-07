import { RecallInput, type DegradedReason, type PageClass, type RecallOutput } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { indexDegradation } from '../context.ts';
import { expandQuery, inferMode, splitMultiPart } from '../recall/expand.ts';
import { hybridSearch, normalizeScores, rerankHits, type ChunkHit } from '../recall/search.ts';

/**
 * The retrieval op. Expand → hybrid search → rerank → assemble → fit a
 * budget. `mode` selects the expansion strategy and is inferred from the query
 * by default.
 *
 * Four properties matter more here than ranking quality: every line carries its
 * address, absence has a reason, superseded values come back labelled, and one
 * budget governs the whole assembly.
 */
export async function recall(ctx: AknoContext, rawInput: unknown): Promise<RecallOutput> {
  const input = RecallInput.parse(rawInput);
  const mode = input.mode ?? inferMode(input.query);
  const depth = input.depth ?? (mode === 'explore' ? 'summary' : 'lines');
  const limit =
    input.limit ?? (mode === 'explore' ? ctx.config.recall.defaultLimit * 2 : ctx.config.recall.defaultLimit);
  const budget = input.budget ?? ctx.config.recall.defaultBudget;

  const degraded = new Set<DegradedReason>();
  const notes: string[] = [];

  // A knowledge base with nothing in it is `empty`, not a failure — but it must
  // not be confused with an index that could not be read.
  const chunkCount = (ctx.store.db.prepare('SELECT count(*) AS c FROM chunks').get() as { c: number }).c;
  if (chunkCount === 0) {
    return {
      status: 'empty',
      cards: [],
      searched: [input.query],
      budget_used: 0,
      mode,
      scores: 'relative',
      note: 'the index holds no chunks yet — run `akno index`',
    };
  }

  // Multi-part questions are split and searched separately, then merged.
  const parts = mode === 'question' ? splitMultiPart(input.query) : [input.query];

  const allQueries: string[] = [];
  const allVectorTexts: string[] = [];
  const allConcepts: string[] = [];

  for (const part of parts) {
    const expansion = await expandQuery(
      part,
      mode,
      ctx.models.chat,
      input.expand ?? ctx.config.recall.expansion,
      ctx.config.recall.expansionTimeoutMs,
    );
    allQueries.push(...expansion.queries);
    allVectorTexts.push(...expansion.vectorTexts);
    allConcepts.push(...expansion.concepts);
    if (expansion.degraded) degraded.add(expansion.degraded);
    if (expansion.note) notes.push(expansion.note);
  }

  const pageIds = resolveFilter(ctx, input);
  if (pageIds !== null && pageIds.size === 0) {
    return {
      status: 'empty',
      cards: [],
      searched: dedupe(allQueries),
      budget_used: 0,
      mode,
      scores: 'relative',
      note: 'the filter matched no pages',
    };
  }

  let search;
  try {
    search = await hybridSearch(ctx.store, ctx.models.embedding, {
      queries: dedupe(allQueries),
      vectorTexts: dedupe(allVectorTexts),
      candidatesPerArm: ctx.config.recall.candidatesPerArm,
      prefilterAbove: ctx.config.index.annThresholdChunks,
      ...(pageIds ? { pageIds } : {}),
    });
  } catch (err) {
    // The index could not be read. Say so — an agent can honestly offer to check
    // again, which it cannot do if this returns as "nothing recorded".
    return {
      status: 'unavailable',
      cards: [],
      searched: dedupe(allQueries),
      budget_used: 0,
      mode,
      scores: 'relative',
      note: err instanceof Error ? err.message : String(err),
    };
  }
  for (const reason of search.degraded) degraded.add(reason);
  notes.push(...search.notes);

  let hits: ChunkHit[] = search.hits;
  let reranked = false;
  if (hits.length > 1 && ctx.models.reranker.available) {
    const result = await rerankHits(
      ctx.store,
      ctx.models.reranker,
      input.query,
      hits,
      ctx.config.models.reranker.topK ?? 40,
      ctx.config.models.reranker.maxChars ?? 800,
    );
    hits = result.hits;
    reranked = result.degraded === null;
    if (result.degraded) degraded.add(result.degraded);
    if (result.note) notes.push(result.note);
  } else if (ctx.models.reranker.requested && !ctx.models.reranker.available) {
    // `requested` rather than `enabled`: the resolved `enabled` is already false
    // whenever the role is unusable, so testing it here could never fire and a
    // user who asked for a reranker would never be told they are not getting one.
    degraded.add(ctx.models.reranker.degradedReason({}));
    if (ctx.models.reranker.unavailableReason) notes.push(ctx.models.reranker.unavailableReason);
  }

  // Fused ranks only mean something relative to each other, so put them on a
  // readable scale when a cross-encoder did not supply an absolute one. `relevance`
  // survives this untouched — it is the field a caller may threshold.
  if (!reranked) hits = normalizeScores(hits);
  const scores: 'absolute' | 'relative' = hits.some((hit) => hit.relevance !== undefined)
    ? 'absolute'
    : 'relative';

  const assembled = ctx.assembler.assemble({
    hits,
    mode,
    depth,
    // A lookup wants deep line windows around what matched; a question wants
    // tight ones across more cards, because the answer is usually one line and
    // the surrounding paragraph is budget spent on nothing.
    lineWindow:
      mode === 'question'
        ? Math.max(2, Math.ceil(ctx.config.recall.lineWindow / 2))
        : ctx.config.recall.lineWindow,
    limit,
    budget,
    concepts: dedupe(allConcepts),
    include: (input.include as PageClass[] | undefined) ?? null,
  });

  for (const reason of indexDegradation(ctx.store)) degraded.add(reason);
  const reasons = [...degraded];
  const searched = dedupe(allQueries);

  if (assembled.cards.length === 0) {
    // `empty` carries the expanded queries that found nothing. That list is the
    // proof an agent needs to say "not recorded" honestly.
    return {
      status: reasons.length > 0 ? 'degraded' : 'empty',
      ...(reasons.length > 0 ? { degraded: reasons } : {}),
      cards: [],
      searched,
      budget_used: 0,
      mode,
      scores,
      ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
      note:
        reasons.length > 0
          ? 'nothing matched, and the search ran without part of its model stack — this is not proof of absence'
          : 'nothing matched any of the queries listed in `searched`',
    };
  }

  return {
    status: reasons.length > 0 ? 'degraded' : 'ok',
    ...(reasons.length > 0 ? { degraded: reasons } : {}),
    cards: assembled.cards,
    searched,
    budget_used: assembled.budgetUsed,
    mode,
    scores,
    ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
  };
}

/** Filters are applied as a page-id restriction so both search arms honour them. */
function resolveFilter(ctx: AknoContext, input: ReturnType<typeof RecallInput.parse>): Set<string> | null {
  const filter = input.filter;
  const hasFilter = Boolean(
    filter?.folder || filter?.type || filter?.tags?.length || filter?.class || input.since || input.until,
  );
  if (!hasFilter) return null;

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter?.folder) {
    clauses.push('(slug = ? OR slug LIKE ?)');
    params.push(filter.folder, `${filter.folder}/%`);
  }
  if (filter?.type) {
    clauses.push('type = ?');
    params.push(filter.type);
  }
  if (filter?.class) {
    clauses.push('class = ?');
    params.push(filter.class);
  }
  if (input.since) {
    clauses.push('updated_at >= ?');
    params.push(input.since);
  }
  if (input.until) {
    // A `YYYY-MM` bound means "through the end of that month".
    clauses.push('updated_at <= ?');
    params.push(`${input.until}￿`);
  }

  const sql = `SELECT id, tags FROM pages${clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''}`;
  const rows = ctx.store.db.prepare(sql).all(...params) as { id: string; tags: string }[];

  const wanted = filter?.tags?.map((tag) => tag.toLowerCase()) ?? [];
  const ids = new Set<string>();
  for (const row of rows) {
    if (wanted.length > 0) {
      const tags = (JSON.parse(row.tags) as string[]).map((tag) => tag.toLowerCase());
      if (!wanted.every((tag) => tags.includes(tag))) continue;
    }
    ids.add(row.id);
  }
  return ids;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase().trim();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
