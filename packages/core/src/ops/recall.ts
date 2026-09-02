import {
  RecallInput,
  type DegradedReason,
  type PageRole,
  type RecallOutput,
  type RecallQualification,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { indexDegradation } from '../context.ts';
import { expandQuery, inferMode, splitMultiPart } from '../recall/expand.ts';
import { graphRecallCandidates } from '../recall/graph-arm.ts';
import { fuseHits, hybridSearch, normalizeScores, rerankHits, type ChunkHit } from '../recall/search.ts';
import { inferMemoryView } from '../memory/intent.ts';
import { managedMemoryProjectionForView } from '../memory/projection.ts';

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
  const memoryView = input.memory_view ?? inferMemoryView(input.query, mode);
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
      searched: [input.query],
      budget_used: 0,
      mode,
      memory_view: memoryView,
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
      searched: dedupe(allQueries),
      budget_used: 0,
      mode,
      memory_view: memoryView,
      scores: 'relative',
      note: 'the filter matched no indexed evidence',
    };
  }

  const projection = managedMemoryProjectionForView(ctx.store, memoryView);
  if (projection.degraded) degraded.add('partial_memory_index');
  const eligibleChunkIds = intersectChunkIds(chunkIds, projection.eligibleChunkIds);
  const contextualChunkIds = intersectChunkIds(chunkIds, projection.contextualChunkIds);
  const runSearch = async (
    allowedChunkIds: Set<number>,
  ): Promise<{
    hits: ChunkHit[];
    qualification: RecallQualification | null;
    scores: 'absolute' | 'relative';
  }> => {
    if (allowedChunkIds.size === 0) return { hits: [], qualification: null, scores: 'relative' };
    const search = await hybridSearch(ctx.store, ctx.models.embedding, {
      queries: dedupe(allQueries),
      vectorTexts: dedupe(allVectorTexts),
      candidatesPerArm: ctx.config.recall.candidatesPerArm,
      prefilterAbove: ctx.config.index.annThresholdChunks,
      chunkIds: allowedChunkIds,
    });
    for (const reason of search.degraded) degraded.add(reason);
    notes.push(...search.notes);

    let hits: ChunkHit[] = search.hits;
    if (input.graph ?? ctx.config.recall.graph) {
      try {
        const graphResult = await graphRecallCandidates(ctx, input.query, search.hits, allowedChunkIds);
        for (const reason of graphResult.degraded) degraded.add(reason);
        notes.push(...graphResult.notes);
        if (graphResult.hits.length > 0) hits = fuseHits([...search.arms, graphResult.hits]);
      } catch {
        degraded.add('no_graph_index');
        notes.push('the structural graph candidate arm was unavailable');
      }
    }

    let reranked = false;
    let qualification: RecallQualification | null = null;
    const shouldRerank = input.rerank ?? true;
    if (shouldRerank && hits.length > 0 && ctx.models.reranker.available) {
      const result = await rerankHits(
        ctx.store,
        ctx.models.reranker,
        input.query,
        hits,
        ctx.config.models.reranker.topK ?? 40,
        ctx.config.models.reranker.maxChars ?? 800,
        ctx.config.models.reranker.scoreOffset ?? 'auto',
        ctx.config.models.reranker.excludeIrrelevant ?? true,
      );
      hits = result.hits;
      qualification = result.qualification;
      reranked = result.degraded === null;
      if (result.degraded) degraded.add(result.degraded);
      if (result.note) notes.push(result.note);
    } else if (shouldRerank && ctx.models.reranker.requested && !ctx.models.reranker.available) {
      degraded.add(ctx.models.reranker.degradedReason({}));
      if (ctx.models.reranker.unavailableReason) notes.push(ctx.models.reranker.unavailableReason);
    }
    if (!reranked) hits = normalizeScores(hits);
    return {
      hits,
      qualification,
      scores: hits.some((hit) => hit.relevance !== undefined) ? 'absolute' : 'relative',
    };
  };

  const assemble = (
    hits: ChunkHit[],
    memorySelection: 'eligible' | 'contextual',
  ): ReturnType<AknoContext['assembler']['assemble']> =>
    ctx.assembler.assemble({
      hits,
      mode,
      depth,
      lineWindow:
        mode === 'question'
          ? Math.max(2, Math.ceil(ctx.config.recall.lineWindow / 2))
          : ctx.config.recall.lineWindow,
      limit,
      budget,
      concepts: dedupe(allConcepts),
      include: (input.include as PageRole[] | undefined) ?? null,
      memoryView,
      memorySelection,
    });

  let pipeline;
  try {
    pipeline = await runSearch(eligibleChunkIds);
  } catch (err) {
    return {
      status: 'unavailable',
      results: [],
      searched: dedupe(allQueries),
      budget_used: 0,
      mode,
      memory_view: memoryView,
      scores: 'relative',
      note: err instanceof Error ? err.message : String(err),
    };
  }
  let assembled = assemble(pipeline.hits, 'eligible');
  let contextualFallback = false;
  if (!hasExactEvidence(assembled.results) && depth !== 'summary' && contextualChunkIds.size > 0) {
    try {
      pipeline = await runSearch(contextualChunkIds);
      assembled = assemble(pipeline.hits, 'contextual');
      contextualFallback = assembled.results.length > 0;
    } catch (err) {
      return {
        status: 'unavailable',
        results: [],
        searched: dedupe(allQueries),
        budget_used: 0,
        mode,
        memory_view: memoryView,
        scores: 'relative',
        note: err instanceof Error ? err.message : String(err),
      };
    }
  }
  const { qualification, scores } = pipeline;

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
      searched,
      budget_used: 0,
      mode,
      memory_view: memoryView,
      scores,
      ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
      ...(qualification ? { qualification } : {}),
      note:
        reasons.length > 0
          ? 'nothing matched, and the search ran without part of its model stack — this is not proof of absence'
          : qualification?.applied && qualification.rejected > 0
            ? `the reranker disqualified all ${qualification.rejected} judged candidates as irrelevant`
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
      searched,
      budget_used: assembled.budgetUsed,
      mode,
      memory_view: memoryView,
      scores,
      ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
      ...(qualification ? { qualification } : {}),
      note: 'matching document records remain, but neither their originals nor a readable copy are available',
    };
  }

  return {
    status: reasons.length > 0 ? 'degraded' : 'ok',
    ...(reasons.length > 0 ? { degraded: reasons } : {}),
    results: assembled.results,
    searched,
    budget_used: assembled.budgetUsed,
    mode,
    memory_view: memoryView,
    scores,
    ...(assembled.coverage ? { coverage: assembled.coverage } : {}),
    ...(qualification ? { qualification } : {}),
    ...(contextualFallback
      ? {
          note: `related retained memory exists, but it is not eligible for the ${memoryView} view`,
        }
      : hasMissingDocumentEvidence
        ? {
            note: 'some document evidence is retained from an indexed copy or rendition because its original is missing',
          }
        : {}),
  };
}

function hasExactEvidence(results: RecallOutput['results']): boolean {
  return results.some((result) =>
    result.type === 'document'
      ? Boolean(result.quote?.trim())
      : result.lines.length > 0 ||
        result.documents?.some((document) => Boolean(document.quote?.trim())) === true,
  );
}

function intersectChunkIds(left: Set<number> | null, right: Set<number>): Set<number> {
  if (!left) return new Set(right);
  const out = new Set<number>();
  for (const value of left) if (right.has(value)) out.add(value);
  return out;
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
