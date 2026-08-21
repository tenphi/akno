import { z } from 'zod';

/**
 * What a page contributes to memory. This is deliberately separate from who may
 * edit it: a canonical page can be owner-maintained or fully synthesized, while
 * a source page remains evidence either way.
 */
export const PageRole = z.enum(['knowledge', 'source', 'inference', 'ignored']);
export type PageRole = z.infer<typeof PageRole>;

/** Automatic write authority carried by a page's `akno` frontmatter block. */
export const RememberManagement = z.enum(['deny', 'integrate']);
export type RememberManagement = z.infer<typeof RememberManagement>;
export const DreamManagement = z.enum(['none', 'hygiene', 'synthesize']);
export type DreamManagement = z.infer<typeof DreamManagement>;
export const PageManagement = z.object({
  remember: RememberManagement.optional(),
  dream: DreamManagement.optional(),
});
export type PageManagement = z.infer<typeof PageManagement>;

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
  /**
   * The live fact this line produced, when it produced one — the handle `forget`
   * takes to retract it.
   *
   * Without this, `forget({fact})` was documented and unreachable: it is the op's
   * primary form, and no read path returned an id to give it. Retracting therefore
   * meant deleting a whole page, which is a much larger claim than "this one
   * sentence is wrong". It rides on the line because that is exactly what forget
   * removes — the sentence, not a database row that would be re-derived tomorrow.
   */
  fact: z.string().optional(),
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

/**
 * Whether document evidence can still be checked against its original bytes.
 *
 * Extracted text is a useful surviving copy, but it is not the original. Keeping
 * that distinction in the result lets a caller use remembered evidence without
 * implying that the source file is still present.
 */
export const DocumentAvailability = z.object({
  status: z.enum(['available', 'degraded', 'unavailable']),
  available_from: z.array(z.enum(['original', 'indexed_text', 'rendition'])),
  missing_originals: z.array(z.string()),
  available_renditions: z.array(z.string()),
  /** Earliest time an original in this document group was observed missing. */
  missing_since: z.string().optional(),
});
export type DocumentAvailability = z.infer<typeof DocumentAvailability>;

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
   * The matching text from inside the document, capped by `recall.source_quote_lines`.
   *
   * A document is evidence, not a claim, so it comes back as a quote window rather
   * than in full — and as a quote attributed to the document and its page, never as a line
   * citation on the Markdown page, which has no such line.
   */
  quote: z.string().optional(),
  availability: DocumentAvailability.optional(),
});
export type DocumentRef = z.infer<typeof DocumentRef>;

/** How searchable text was obtained from a standalone document. */
export const DocumentTextSource = z.object({
  kind: z.enum(['original_text', 'ocr_text', 'model_description', 'none']),
  via: z.enum(['plain', 'textutil', 'text-layer', 'ocr', 'vision', 'none']),
  confidence: z.number().min(0).max(1).nullable().optional(),
});
export type DocumentTextSource = z.infer<typeof DocumentTextSource>;

export const DocumentPartRef = z.object({
  id: z.string(),
  path: z.string(),
  pages: z.number().int().nonnegative().nullable().optional(),
});
export type DocumentPartRef = z.infer<typeof DocumentPartRef>;

/**
 * Recall returns page cards, not chunks — a chunk boundary is an indexing
 * artifact and means nothing to a reader.
 */
export const Card = z.object({
  slug: z.string(),
  title: z.string(),
  role: PageRole,
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
  /** Set when the role capped what this card could contribute. */
  truncated: z.boolean().optional(),
});
export type Card = z.infer<typeof Card>;

/** The page variant in the authoritative mixed recall result list. */
export const PageCard = Card.extend({ type: z.literal('page') });
export type PageCard = z.infer<typeof PageCard>;

/** Searchable evidence that has not been filed beneath a Markdown page. */
export const DocumentCard = z.object({
  type: z.literal('document'),
  id: z.string(),
  path: z.string(),
  label: z.string(),
  mime: z.string().nullable(),
  summary: z.string().optional(),
  quote: z.string().optional(),
  matched_page: z.number().int().positive().optional(),
  parts: z.array(DocumentPartRef).optional(),
  source: DocumentTextSource,
  availability: DocumentAvailability.optional(),
  ownership: z.object({
    status: z.literal('orphan'),
  }),
  suggested_actions: z
    .array(
      z.object({
        op: z.literal('adopt'),
        args: z.object({ documentId: z.string() }),
      }),
    )
    .optional(),
  score: z.number(),
  relevance: z.number().min(0).max(1).optional(),
});
export type DocumentCard = z.infer<typeof DocumentCard>;

export const RecallResult = z.discriminatedUnion('type', [PageCard, DocumentCard]);
export type RecallResult = z.infer<typeof RecallResult>;

export function isPageCard(result: RecallResult): result is PageCard {
  return result.type === 'page';
}

export function isDocumentCard(result: RecallResult): result is DocumentCard {
  return result.type === 'document';
}

/**
 * Named, machine-readable reasons a result is `degraded`. A rule that quietly
 * excludes half a knowledge base is worse than no rule — default to visible.
 */
export const DegradedReason = z.enum([
  'no_embedding_model',
  'no_reranker',
  'no_derive_model',
  'no_expansion_model',
  'embedding_failed',
  'rerank_failed',
  'derive_failed',
  'expansion_failed',
  'no_vector_index',
  'partial_index',
  /** The file yielded no text — nothing to read back, and no model involved either way. */
  'no_document_text',
  /** The original bytes are gone; recall is using a retained extraction or rendition. */
  'document_source_missing',
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
  role: PageRole.optional(),
  /** Restrict evidence to Markdown pages, stored documents, or both. */
  source: z.enum(['page', 'document', 'both']).optional(),
  /** Orphans have no page role; `orphan` therefore selects document evidence only. */
  ownership: z.enum(['orphan', 'owned', 'any']).optional(),
});
export type SlugFilter = z.infer<typeof SlugFilter>;

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` — the granularities a ledger is filtered by. */
export const DatePrefix = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'expected YYYY, YYYY-MM or YYYY-MM-DD');
