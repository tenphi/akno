import { RecallInput, type DegradedReason, type PageRole, type RecallOutput } from '@tenphi/akno-protocol';
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
      results: [],
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
      ctx.models.expansion,
      input.expand ?? ctx.config.recall.expansion,
      ctx.config.recall.expansionTimeoutMs,
    );
    allQueries.push(...expansion.queries);
    allVectorTexts.push(...expansion.vectorTexts);
    allConcepts.push(...expansion.concepts);
    if (expansion.degraded) degraded.add(expansion.degraded);
    if (expansion.note) notes.push(expansion.note);
  }

  const chunkIds = resolveFilter(ctx, input);
  if (chunkIds !== null && chunkIds.size === 0) {
    return {
      status: 'empty',
      results: [],
      cards: [],
      searched: dedupe(allQueries),
      budget_used: 0,
      mode,
      scores: 'relative',
      note: 'the filter matched no indexed evidence',
    };
  }

  let search;
  try {
    search = await hybridSearch(ctx.store, ctx.models.embedding, {
      queries: dedupe(allQueries),
      vectorTexts: dedupe(allVectorTexts),
      candidatesPerArm: ctx.config.recall.candidatesPerArm,
      prefilterAbove: ctx.config.index.annThresholdChunks,
      ...(chunkIds ? { chunkIds } : {}),
    });
  } catch (err) {
    // The index could not be read. Say so — an agent can honestly offer to check
    // again, which it cannot do if this returns as "nothing recorded".
    return {
      status: 'unavailable',
      results: [],
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
      ctx.config.models.reranker.scoreOffset ?? 0,
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
    include: (input.include as PageRole[] | undefined) ?? null,
  });

  const documentStates = assembled.results.flatMap((result) =>
    result.type === 'document'
      ? result.availability
        ? [result.availability]
        : []
      : (result.documents ?? []).flatMap((document) =>
          document.availability ? [document.availability] : [],
        ),
  );
  const hasMissingDocumentEvidence = documentStates.some((state) => state.status !== 'available');
  if (hasMissingDocumentEvidence) {
    degraded.add('document_source_missing');
  }

  for (const reason of indexDegradation(ctx.store)) degraded.add(reason);
  const reasons = [...degraded];
  const searched = dedupe(allQueries);

  if (assembled.results.length === 0) {
    // `empty` carries the expanded queries that found nothing. That list is the
    // proof an agent needs to say "not recorded" honestly.
    return {
      status: reasons.length > 0 ? 'degraded' : 'empty',
      ...(reasons.length > 0 ? { degraded: reasons } : {}),
      results: [],
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

  const unavailableOnly = assembled.results.every(
    (result) => result.type === 'document' && result.availability?.status === 'unavailable',
  );
  if (unavailableOnly) {
    return {
      status: 'unavailable',
      results: assembled.results,
      cards: assembled.cards,
      searched,
      budget_used: assembled.budgetUsed,
      mode,
      scores,
      ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
      note: 'matching document records remain, but neither their originals nor a readable copy are available',
    };
  }

  return {
    status: reasons.length > 0 ? 'degraded' : 'ok',
    ...(reasons.length > 0 ? { degraded: reasons } : {}),
    results: assembled.results,
    cards: assembled.cards,
    searched,
    budget_used: assembled.budgetUsed,
    mode,
    scores,
    ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
    ...(hasMissingDocumentEvidence
      ? {
          note: 'some document evidence is retained from an indexed copy or rendition because its original is missing',
        }
      : {}),
  };
}

/** Filters resolve to native chunk identities so both page and document evidence can participate. */
function resolveFilter(ctx: AknoContext, input: ReturnType<typeof RecallInput.parse>): Set<number> | null {
  const filter = input.filter;
  const hasFilter = Boolean(
    filter?.folder ||
    filter?.type ||
    filter?.tags?.length ||
    filter?.role ||
    filter?.source ||
    filter?.ownership ||
    input.since ||
    input.until,
  );
  if (!hasFilter) return null;

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter?.folder) {
    clauses.push(
      `((c.document_id IS NULL AND (p.slug = ? OR p.slug LIKE ?))
         OR (c.document_id IS NOT NULL AND (d.rel_path = ? OR d.rel_path LIKE ?)))`,
    );
    params.push(filter.folder, `${filter.folder}/%`, filter.folder, `${filter.folder}/%`);
  }
  if (filter?.type) {
    clauses.push('p.type = ?');
    params.push(filter.type);
  }
  if (filter?.role) {
    // NULL never equals a role, so orphan documents are explicitly excluded.
    clauses.push('p.role = ?');
    params.push(filter.role);
  }
  if (filter?.source === 'page') clauses.push('c.document_id IS NULL');
  if (filter?.source === 'document') clauses.push('c.document_id IS NOT NULL');
  if (filter?.ownership === 'orphan') {
    clauses.push('c.document_id IS NOT NULL AND d.page_id IS NULL');
  }
  if (filter?.ownership === 'owned') clauses.push('c.page_id IS NOT NULL');
  if (input.since) {
    clauses.push(
      `(CASE WHEN c.document_id IS NULL THEN p.updated_at
             ELSE datetime(CAST(f.mtime_ns AS INTEGER) / 1000000000, 'unixepoch') END) >= ?`,
    );
    params.push(input.since);
  }
  if (input.until) {
    // A `YYYY-MM` bound means "through the end of that month".
    clauses.push(
      `(CASE WHEN c.document_id IS NULL THEN p.updated_at
             ELSE datetime(CAST(f.mtime_ns AS INTEGER) / 1000000000, 'unixepoch') END) <= ?`,
    );
    params.push(`${input.until}￿`);
  }

  const sql = `SELECT c.id, p.tags
                 FROM chunks c
                 LEFT JOIN pages p ON p.id = c.page_id
                 LEFT JOIN documents d ON d.id = c.document_id
                 LEFT JOIN files f ON f.rel_path = d.rel_path
                ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''}`;
  const rows = ctx.store.db.prepare(sql).all(...params) as { id: number; tags: string | null }[];

  const wanted = filter?.tags?.map((tag) => tag.toLowerCase()) ?? [];
  const ids = new Set<number>();
  for (const row of rows) {
    if (wanted.length > 0) {
      if (!row.tags) continue;
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
