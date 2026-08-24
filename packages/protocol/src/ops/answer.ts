import { z } from 'zod';
import { DatePrefix, PageRole, RecallQualification, ResultEnvelope, SlugFilter } from '../common.ts';

/** A direct question over the existing qualified recall pipeline. */
export const AnswerInput = z.object({
  question: z.string().trim().min(1),
  /** Maximum qualified page/document candidates considered related. */
  limit: z.number().int().positive().max(100).optional(),
  /** Internal evidence budget; answer never offers recall's full-body escape hatch. */
  retrieval_budget: z.number().int().positive().optional(),
  include: z.array(PageRole).optional(),
  filter: SlugFilter.optional(),
  since: DatePrefix.optional(),
  until: DatePrefix.optional(),
  expand: z.boolean().optional(),
  graph: z.boolean().optional(),
});
export type AnswerInput = z.infer<typeof AnswerInput>;

export const AnswerCitation = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('page'),
    slug: z.string(),
    lines: z.array(z.number().int().positive()).min(1),
  }),
  z.object({
    id: z.string(),
    type: z.literal('document'),
    document_id: z.string(),
    owner_slug: z.string().optional(),
    pages: z.array(z.number().int().positive()).min(1).optional(),
  }),
]);
export type AnswerCitation = z.infer<typeof AnswerCitation>;

export const AnswerOutput = ResultEnvelope.extend({
  outcome: z.enum(['complete', 'partial', 'not_found', 'not_answered']),
  answer: z.string().nullable(),
  coverage: z.record(z.string(), z.boolean()),
  citations: z.array(AnswerCitation),
  /** Ranked compact identities only. Use recall/read when evidence text is needed. */
  related_page_slugs: z.array(z.string()),
  related_documents: z.array(
    z.object({
      id: z.string(),
      owner_slug: z.string().optional(),
    }),
  ),
  searched: z.array(z.string()),
  qualification: RecallQualification.optional(),
  budget_used: z.object({
    retrieval_tokens: z.number().int().nonnegative(),
    evidence_tokens: z.number().int().nonnegative(),
    answer_tokens: z.number().int().nonnegative(),
  }),
});
export type AnswerOutput = z.infer<typeof AnswerOutput>;
