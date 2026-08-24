import { AnswerInput, type AnswerOutput, type DegradedReason } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { recall } from './recall.ts';

/**
 * Direct answering composes over recall; it never owns a second search path.
 *
 * The first vertical slice intentionally stops after compact discovery. A related result without an answer
 * model is degraded/not_answered, which lets every public door adopt the final contract without pretending
 * that retrieval cards are already a supported prose answer.
 */
export async function answer(ctx: AknoContext, rawInput: unknown): Promise<AnswerOutput> {
  const input = AnswerInput.parse(rawInput);
  const recalled = await recall(ctx, {
    query: input.question,
    mode: 'question',
    depth: 'lines',
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.retrieval_budget !== undefined ? { budget: input.retrieval_budget } : {}),
    ...(input.include !== undefined ? { include: input.include } : {}),
    ...(input.filter !== undefined ? { filter: input.filter } : {}),
    ...(input.since !== undefined ? { since: input.since } : {}),
    ...(input.until !== undefined ? { until: input.until } : {}),
    ...(input.expand !== undefined ? { expand: input.expand } : {}),
    ...(input.graph !== undefined ? { graph: input.graph } : {}),
  });

  const relatedPageSlugs = dedupeStrings(
    recalled.results.flatMap((result) => (result.type === 'page' ? [result.slug] : [])),
  );
  const relatedDocuments = [
    ...new Map(
      recalled.results.flatMap((result) =>
        result.type === 'document' ? [[result.id, { id: result.id }]] : [],
      ),
    ).values(),
  ];
  const base: Omit<AnswerOutput, 'status' | 'outcome' | 'degraded' | 'note'> = {
    answer: null,
    coverage: recalled.coverage ?? {},
    citations: [],
    related_page_slugs: relatedPageSlugs,
    related_documents: relatedDocuments,
    searched: recalled.searched,
    ...(recalled.qualification ? { qualification: recalled.qualification } : {}),
    budget_used: {
      retrieval_tokens: recalled.budget_used,
      evidence_tokens: 0,
      answer_tokens: 0,
    },
  };

  if (recalled.status === 'empty') {
    return {
      status: 'empty',
      outcome: 'not_found',
      ...base,
      note: recalled.note ?? 'qualified recall completed and found no supporting memory',
    };
  }
  if (recalled.status === 'unavailable') {
    return {
      status: 'unavailable',
      outcome: 'not_answered',
      ...base,
      note: recalled.note ?? 'memory evidence could not be read, so no grounded answer is possible',
    };
  }
  if (recalled.results.length === 0) {
    return {
      status: 'degraded',
      outcome: 'not_answered',
      ...base,
      ...(recalled.degraded ? { degraded: recalled.degraded } : {}),
      note: recalled.note ?? 'recall was incomplete and found no trustworthy answer evidence',
    };
  }

  const degraded = dedupeReasons([...(recalled.degraded ?? []), 'no_answer_model']);
  return {
    status: 'degraded',
    degraded,
    outcome: 'not_answered',
    ...base,
    note: 'related memory was found, but no answer model is configured; use recall to inspect the evidence',
  };
}

function dedupeReasons(reasons: DegradedReason[]): DegradedReason[] {
  return [...new Set(reasons)];
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}
