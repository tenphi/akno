import { z } from 'zod';
import {
  Card,
  DatePrefix,
  Depth,
  PageRole,
  RecallMode,
  RecallQualification,
  RecallResult,
  ResultEnvelope,
  SlugFilter,
} from '../common.ts';

export const RecallInput = z.object({
  query: z.string().min(1),
  /** Inferred from the query when absent. Passing it explicitly always wins, and
   *  getting it wrong costs relevance, never correctness. */
  mode: RecallMode.optional(),
  depth: Depth.optional(),
  limit: z.number().int().positive().max(100).optional(),
  /** Token budget for the assembled response. Whole cards are filled first. */
  budget: z.number().int().positive().optional(),
  /** `source` pages compete for relevance on equal terms and come back capped.
   *  Passing `include: ['source']` with `depth: 'full'` overrides the cap —
   *  role is a relevance policy, not access control. */
  include: z.array(PageRole).optional(),
  /**
   * Skip query expansion for this call. Worth it when the query is already the text
   * you want to match — routing a document by its own summary, say — where a model
   * rewriting it costs a round trip and buys nothing.
   */
  expand: z.boolean().optional(),
  filter: SlugFilter.optional(),
  since: DatePrefix.optional(),
  until: DatePrefix.optional(),
});
export type RecallInput = z.infer<typeof RecallInput>;

export const RecallOutput = ResultEnvelope.extend({
  /** Authoritative mixed page/document results. Use `type` to select the variant. */
  results: z.array(RecallResult),
  /**
   * Page-only compatibility view. New clients should use `results`; orphan documents cannot
   * be represented here. Kept for one compatibility cycle.
   * @deprecated Use `results`.
   */
  cards: z.array(Card),
  /** Every query actually issued, including expansions. On `empty` this is the
   *  proof — an agent can say "not recorded" because the layer showed its work. */
  searched: z.array(z.string()),
  budget_used: z.number().int().nonnegative(),
  /**
   * Whether `score` means anything on its own.
   *
   * `absolute` — a cross-encoder or the embedding arm supplied a real 0..1 relevance,
   * and `relevance` is set on every card. Safe to threshold.
   * `relative` — scores only order this result set. The top hit is 1.0 whether it is
   * a perfect match or the least bad of a bad batch, so thresholding it is a mistake:
   * every query appears to succeed.
   */
  scores: z.enum(['absolute', 'relative']),
  /** Present when a reranker judged candidates, including when filtering was disabled or unavailable. */
  qualification: RecallQualification.optional(),
  /**
   * `question` mode only. Which concepts from the question the results
   * actually cover. Deterministic — did the key terms appear in what came back —
   * not a model judging whether the answer is there. Closes the most common
   * hallucination path: a page ranks first because it matches half the question,
   * and the agent invents the other half.
   */
  coverage: z.record(z.string(), z.boolean()).optional(),
  mode: RecallMode,
});
export type RecallOutput = z.infer<typeof RecallOutput>;
