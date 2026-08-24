import { z } from 'zod';
import { DatePrefix, Line, PageRole, RecallQualification, ResultEnvelope, SlugFilter } from '../common.ts';

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
  /** Answer skips reranking by default; opt in when strict retrieval qualification is worth the latency. */
  rerank: z.boolean().optional(),
  /** Return the bounded evidence supplied to the answer model. Off keeps the response compact. */
  include_context: z.boolean().optional(),
  /** Per-call answer ceiling, still bounded by the configured answer role. */
  max_answer_tokens: z.number().int().positive().max(8192).optional(),
});
export type AnswerInput = z.infer<typeof AnswerInput>;

export const AnswerContextItem = z.discriminatedUnion('type', [
  z.object({
    evidence_id: z.string(),
    type: z.literal('page'),
    slug: z.string(),
    title: z.string(),
    lines: z.array(Line).min(1),
  }),
  z.object({
    evidence_id: z.string(),
    type: z.literal('document'),
    document_id: z.string(),
    owner_slug: z.string().optional(),
    pages: z.array(z.number().int().positive()).min(1).optional(),
    quote: z.string().min(1),
  }),
]);
export type AnswerContextItem = z.infer<typeof AnswerContextItem>;

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

/** A content-free receipt for one request to the configured answer model. */
export const AnswerModelCallReceipt = z.object({
  model: z.string(),
  latency_ms: z.number().nonnegative(),
  /** Null means the compatible endpoint did not report this value; it is never estimated here. */
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  total_tokens: z.number().int().nonnegative().nullable(),
});
export type AnswerModelCallReceipt = z.infer<typeof AnswerModelCallReceipt>;

export const AnswerOutput = ResultEnvelope.extend({
  outcome: z.enum(['complete', 'partial', 'not_found', 'not_answered']),
  answer: z.string().nullable(),
  coverage: z.record(z.string(), z.boolean()),
  citations: z.array(AnswerCitation),
  /** Present only when explicitly requested; contains the exact bounded evidence considered. */
  context: z.array(AnswerContextItem).optional(),
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
  /** Actual provider receipts. These are separate from the bounded token estimates above. */
  model_usage: z.object({
    generation: AnswerModelCallReceipt.nullable(),
    verification: AnswerModelCallReceipt.nullable(),
  }),
});
export type AnswerOutput = z.infer<typeof AnswerOutput>;
