import { z } from 'zod';

/**
 * Not everything in a knowledge base is knowledge. `full` pages are claims;
 * `reference` pages are evidence. Only claims become facts.
 */
export const PageClass = z.enum(['full', 'reference', 'excluded']);
export type PageClass = z.infer<typeof PageClass>;

/**
 * One op, three expansion modes — because looking something up and
 * answering a question are different retrieval problems, but must not be
 * different ops. Inferred from the query unless passed explicitly.
 */
export const RecallMode = z.enum(['lookup', 'question', 'explore']);
export type RecallMode = z.infer<typeof RecallMode>;

/** How much of a page body a card carries back. */
export const Depth = z.enum(['summary', 'lines', 'full']);
export type Depth = z.infer<typeof Depth>;

/**
 * Absence has a reason. Three distinct outcomes, never one silent empty
 * result: `empty` proved nothing matched, `degraded` means a model was missing
 * and the search was weaker, `unavailable` means the index could not be read.
 */
export const ResultStatus = z.enum(['ok', 'empty', 'degraded', 'unavailable']);
export type ResultStatus = z.infer<typeof ResultStatus>;

/**
 * Every line Akno returns carries the file and line it came from. `confidence`
 * is present when a fact was derived from this line — how sure the deriver is
 * that the line states a well-formed durable claim, not how sure it is the claim
 * is true.
 */
export const Line = z.object({
  n: z.number().int().positive(),
  text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});
export type Line = z.infer<typeof Line>;

/**
 * A replaced value comes back labelled, not as a second competing current
 * answer. Two live readings of one attribute is the most common way a prose
 * knowledge base starts lying.
 */
export const SupersededClaim = z.object({
  claim: z.string(),
  valid_to: z.string(),
});
export type SupersededClaim = z.infer<typeof SupersededClaim>;

/** An attachment that matched, and where inside it. */
export const DocumentRef = z.object({
  id: z.string(),
  rel_path: z.string().optional(),
  mime: z.string().optional(),
  label: z.string().optional(),
  pages: z.number().int().nonnegative().optional(),
  /**
   * Files this document is made of, when more than one — `passport.pdf` plus
   * `passport-2.pdf` is one document in two files. `pages` and `matched_page` both
   * count through the whole of it, so a page number is one a reader can look up.
   */
  parts: z.number().int().positive().optional(),
  matched_page: z.number().int().positive().optional(),
  /** What the document is, in a sentence. A stored document has a summary of its own. */
  summary: z.string().optional(),
  /**
   * The matching text from inside the document, capped by `recall.reference_quote_lines`.
   *
   * A document is evidence, not a claim, so it comes back as a quote window rather
   * than in full — and as a quote attributed to the document and its page, never as a line
   * citation on the Markdown page, which has no such line.
   */
  quote: z.string().optional(),
});
export type DocumentRef = z.infer<typeof DocumentRef>;

/**
 * Recall returns page cards, not chunks — a chunk boundary is an indexing
 * artifact and means nothing to a reader.
 */
export const Card = z.object({
  slug: z.string(),
  title: z.string(),
  class: PageClass,
  summary: z.string().nullable(),
  /** `Car insurance 2026 › Policy` — the heading path of the best-matching chunk. */
  breadcrumb: z.string().optional(),
  updated: z.string().optional(),
  score: z.number(),
  /**
   * An **absolute** relevance in 0..1, when one is available: a cross-encoder's
   * judgement, or cosine similarity from the embedding arm. Absent on a lexical-only
   * search, where nothing produces a comparable number.
   *
   * `score` ranks within one result set and cannot be compared to a fixed threshold —
   * the best hit of a bad set still ranks first. This is the field to threshold on.
   */
  relevance: z.number().min(0).max(1).optional(),
  lines: z.array(Line),
  superseded: z.array(SupersededClaim).optional(),
  links: z.array(z.string()).optional(),
  documents: z.array(DocumentRef).optional(),
  /** Set when the class capped what this card could contribute. */
  truncated: z.boolean().optional(),
});
export type Card = z.infer<typeof Card>;

/**
 * Named, machine-readable reasons a result is `degraded`. A rule that quietly
 * excludes half a knowledge base is worse than no rule — default to visible.
 */
export const DegradedReason = z.enum([
  'no_embedding_model',
  'no_reranker',
  'no_chat_model',
  'embedding_failed',
  'rerank_failed',
  'expansion_failed',
  'no_vector_index',
  'partial_index',
]);
export type DegradedReason = z.infer<typeof DegradedReason>;

/** Every op's response carries these, so a caller can branch uniformly. */
export const ResultEnvelope = z.object({
  status: ResultStatus,
  degraded: z.array(DegradedReason).optional(),
  /** Human-readable note attached to a non-`ok` status. */
  note: z.string().optional(),
});
export type ResultEnvelope = z.infer<typeof ResultEnvelope>;

export const SlugFilter = z.object({
  folder: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  class: PageClass.optional(),
});
export type SlugFilter = z.infer<typeof SlugFilter>;

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` — the granularities a ledger is filtered by. */
export const DatePrefix = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'expected YYYY, YYYY-MM or YYYY-MM-DD');
