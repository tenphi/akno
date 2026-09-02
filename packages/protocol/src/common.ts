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
/** Narrow authority for inserting Akno-owned level-two observation blocks. */
export const ObserveManagement = z.enum(['deny', 'integrate']);
export type ObserveManagement = z.infer<typeof ObserveManagement>;
export const DreamManagement = z.enum(['none', 'hygiene', 'synthesize']);
export type DreamManagement = z.infer<typeof DreamManagement>;
export const PageManagement = z.object({
  remember: RememberManagement.optional(),
  observe: ObserveManagement.optional(),
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

/**
 * Which semantic form of retained memory is useful for this read.
 *
 * This is deliberately separate from `RecallMode`: lookup/question/explore controls how Akno
 * searches, while this value controls whether a matching retained sentence may be used as a
 * current fact, attributed report, plan, historical record, unresolved question, or explicitly
 * noncanonical discussion. When omitted, the query is resolved conservatively and ordinary
 * factual memory wins.
 */
export const MemoryView = z.enum([
  'factual',
  'history',
  'planning',
  'reports',
  'questions',
  'discussion',
  'all',
]);
export type MemoryView = z.infer<typeof MemoryView>;

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

export const TemporalPrecision = z.enum(['instant', 'day', 'month', 'year', 'unknown']);
export type TemporalPrecision = z.infer<typeof TemporalPrecision>;

export const TemporalRelation = z.enum(['occurred', 'valid', 'scheduled', 'due']);
export type TemporalRelation = z.infer<typeof TemporalRelation>;

export const TemporalStatus = z.enum(['actual', 'scheduled', 'planned', 'tentative']);
export type TemporalStatus = z.infer<typeof TemporalStatus>;

export const IanaTimezone = z
  .string()
  .min(1)
  .max(100)
  .refine(validTimezone, 'timezone must be an IANA timezone');
export type IanaTimezone = z.infer<typeof IanaTimezone>;

export const TemporalRecurrence = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().max(100).optional(),
  weekdays: z
    .array(z.enum(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']))
    .max(7)
    .optional(),
  until: z.string().min(1).max(100).optional(),
});
export type TemporalRecurrence = z.infer<typeof TemporalRecurrence>;

export const RetainedTime = z
  .object({
    start: z.string().min(1).max(100).optional(),
    until: z.string().min(1).max(100).optional(),
    precision: TemporalPrecision,
    relation: TemporalRelation,
    status: TemporalStatus,
    timezone: IanaTimezone.optional(),
    mentioned_at: z.string().datetime({ offset: true }).optional(),
    recurrence: TemporalRecurrence.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.precision !== 'unknown' && value.start === undefined && value.until === undefined) {
      ctx.addIssue({ code: 'custom', message: 'retained time needs start or until' });
    }
    for (const [name, boundary] of [
      ['start', value.start],
      ['until', value.until],
    ] as const) {
      if (boundary !== undefined && !validTemporalBoundary(boundary, value.precision)) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} does not match ${value.precision} precision`,
        });
      }
    }
    const allowedStatus = {
      occurred: ['actual'],
      valid: ['actual', 'tentative'],
      scheduled: ['scheduled', 'planned', 'tentative'],
      due: ['scheduled', 'planned', 'tentative'],
    }[value.relation];
    if (!allowedStatus.includes(value.status)) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: `${value.status} is not valid for ${value.relation}`,
      });
    }
    if (value.start && value.until && temporalBoundaryAfter(value.start, value.until, value.precision)) {
      ctx.addIssue({ code: 'custom', path: ['until'], message: 'temporal interval is reversed' });
    }
    if (value.recurrence) {
      if (!value.start) {
        ctx.addIssue({
          code: 'custom',
          path: ['recurrence'],
          message: 'recurrence requires an anchored start',
        });
      }
      if (value.recurrence.weekdays && value.recurrence.frequency !== 'weekly') {
        ctx.addIssue({
          code: 'custom',
          path: ['recurrence', 'weekdays'],
          message: 'weekdays are valid only for weekly recurrence',
        });
      }
      if (value.recurrence.until && !validTemporalBoundary(value.recurrence.until, value.precision)) {
        ctx.addIssue({
          code: 'custom',
          path: ['recurrence', 'until'],
          message: `recurrence until does not match ${value.precision} precision`,
        });
      }
      if (
        value.start &&
        value.recurrence.until &&
        temporalBoundaryAfter(value.start, value.recurrence.until, value.precision)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['recurrence', 'until'],
          message: 'recurrence until precedes its anchored start',
        });
      }
      if (value.precision === 'instant' && !value.timezone) {
        ctx.addIssue({
          code: 'custom',
          path: ['timezone'],
          message: 'an instant recurrence requires an IANA timezone',
        });
      }
      const frequencySupported =
        value.precision === 'instant' ||
        value.precision === 'day' ||
        (value.precision === 'month' && ['monthly', 'yearly'].includes(value.recurrence.frequency)) ||
        (value.precision === 'year' && value.recurrence.frequency === 'yearly');
      if (!frequencySupported) {
        ctx.addIssue({
          code: 'custom',
          path: ['recurrence', 'frequency'],
          message: `${value.recurrence.frequency} recurrence cannot preserve ${value.precision} precision`,
        });
      }
    }
  });
export type RetainedTime = z.infer<typeof RetainedTime>;

export const ClockRelation = z.enum([
  'past',
  'today',
  'current_period',
  'ongoing',
  'future',
  'overdue',
  'undated',
]);
export type ClockRelation = z.infer<typeof ClockRelation>;

function validTemporalBoundary(value: string, precision: TemporalPrecision): boolean {
  if (precision === 'unknown') return value.length <= 100;
  if (precision === 'instant') return z.string().datetime({ offset: true }).safeParse(value).success;
  if (precision === 'year') return /^\d{4}$/.test(value);
  if (precision === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function temporalBoundaryAfter(left: string, right: string, precision: TemporalPrecision): boolean {
  if (precision === 'unknown') return false;
  if (precision === 'instant') return Date.parse(left) > Date.parse(right);
  return left > right;
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Semantic qualification for an Akno-managed level-one memory item.
 *
 * The payload stays searchable even when it is a report, proposal, hypothesis,
 * or rejection. `answer_eligible` is the deterministic boundary that prevents
 * those useful-but-noncanonical memories from becoming ordinary factual answer
 * evidence.
 */
export const MemoryQualification = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('qualified'),
    id: z.string(),
    level: z.literal(1),
    kind: z.enum(['claim', 'decision', 'preference', 'plan', 'event', 'question']),
    subject: z.string(),
    source_role: z.enum(['user', 'assistant', 'external', 'unknown']),
    source_speaker: z.string().optional(),
    commitment: z.enum(['asserted', 'tentative', 'hypothetical', 'counterfactual', 'none']),
    disposition: z.enum([
      'active',
      'proposed',
      'accepted',
      'rejected',
      'resolved',
      'cancelled',
      'completed',
      'superseded',
    ]),
    polarity: z.enum(['affirmed', 'negated']),
    basis: z.enum(['self_attested', 'source_report', 'cited_evidence', 'system_record']),
    answer_eligible: z.boolean(),
    current_eligible: z.boolean(),
    temporal: z
      .object({
        time: RetainedTime,
        clock_relation: ClockRelation,
        actionable: z.boolean(),
      })
      .optional(),
  }),
  z.object({
    status: z.literal('unavailable'),
    id: z.string(),
    answer_eligible: z.literal(false),
  }),
]);
export type MemoryQualification = z.infer<typeof MemoryQualification>;

export const ObservationDisposition = z.enum(['active', 'weakened', 'retracted', 'superseded']);
export type ObservationDisposition = z.infer<typeof ObservationDisposition>;

export const ObservationEvidence = z.object({
  fact: z.string(),
  slug: z.string(),
  line: z.number().int().positive(),
  line_hash: z.string(),
  proof_groups: z.array(z.string()).min(1),
});
export type ObservationEvidence = z.infer<typeof ObservationEvidence>;

/** Present only on the readable payload owned by a valid level-two marker. */
export const ObservationQualification = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('eligible'),
    id: z.string(),
    level: z.literal(2),
    subject: z.string(),
    disposition: ObservationDisposition,
    proof_count: z.number().int().min(2),
    evidence: z.array(ObservationEvidence).min(2),
  }),
  z.object({
    status: z.literal('ineligible'),
    id: z.string(),
    level: z.literal(2),
    disposition: ObservationDisposition,
    reason: z.string(),
  }),
]);
export type ObservationQualification = z.infer<typeof ObservationQualification>;

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
  /** Present when this line is the visible payload of an Akno-managed memory item. */
  memory: MemoryQualification.optional(),
  /** Present when this line is the visible payload of a level-two observation. */
  observation: ObservationQualification.optional(),
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

export const GraphRelation = z.enum([
  'canonical_record',
  'links_to',
  'mentions',
  'about',
  'has_attribute',
  'related_entity',
  'owns_document',
  'participates_in',
  'derived_from',
  'corrects',
  'supersedes',
  'contradicts',
  'fulfills',
  'answers',
  'caused_by',
]);
export type GraphRelation = z.infer<typeof GraphRelation>;

export const GraphNodeKind = z.enum(['entity', 'page', 'document', 'fact', 'event', 'memory', 'observation']);
export type GraphNodeKind = z.infer<typeof GraphNodeKind>;

/** Compact identity only. Read the referenced page or document for content. */
export const GraphNodeRef = z.object({
  id: z.string(),
  kind: GraphNodeKind,
  slug: z.string().optional(),
  label: z.string().optional(),
  role: PageRole.optional(),
  entity: z.string().optional(),
  entity_type: z.enum(['person', 'organization', 'place', 'product', 'event', 'concept', 'other']).optional(),
  document: z.string().optional(),
  fact: z.string().optional(),
  event: z.string().optional(),
  memory: z.string().optional(),
  observation: z.string().optional(),
  date: z.string().optional(),
  line_start: z.number().int().positive().optional(),
  line_end: z.number().int().positive().optional(),
  availability: DocumentAvailability.shape.status.optional(),
});
export type GraphNodeRef = z.infer<typeof GraphNodeRef>;

/** A locator, never a copied claim or excerpt. */
export const GraphEvidenceLocator = z.object({
  kind: z.enum(['page_line', 'fact_line', 'frontmatter', 'document']),
  slug: z.string().optional(),
  document: z.string().optional(),
  event: z.string().optional(),
  fact: z.string().optional(),
  memory: z.string().optional(),
  line_start: z.number().int().positive().optional(),
  line_end: z.number().int().positive().optional(),
  field: z.string().optional(),
});
export type GraphEvidenceLocator = z.infer<typeof GraphEvidenceLocator>;

/** Why one recall candidate entered the fused candidate set. */
export const RecallMatchArm = z.enum(['lexical', 'vector', 'graph']);
export type RecallMatchArm = z.infer<typeof RecallMatchArm>;

/** Compact, self-contained graph explanation attached only to a returned card. */
export const RecallGraphPath = z.object({
  seed: GraphNodeRef,
  target: GraphNodeRef,
  nodes: z.array(GraphNodeRef).min(2).max(4),
  relations: z.array(GraphRelation).min(1).max(3),
  hops: z.number().int().positive().max(3),
  confidence: z.number().min(0).max(1),
  evidence: z.array(GraphEvidenceLocator).min(1).max(3),
});
export type RecallGraphPath = z.infer<typeof RecallGraphPath>;

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
  via: z.enum(['plain', 'textutil', 'libreoffice', 'text-layer', 'ocr', 'vision', 'none']),
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
  /** Candidate-generation arms that found this page. Scores across these arms are fused by rank. */
  matched_by: z.array(RecallMatchArm).optional(),
  /** Bounded graph paths that contributed this returned page, with locators but no copied claims. */
  graph_paths: z.array(RecallGraphPath).optional(),
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
  matched_by: z.array(RecallMatchArm).optional(),
  graph_paths: z.array(RecallGraphPath).optional(),
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
  /** Automatic retention could not independently verify extracted semantics. */
  'retain_verification_failed',
  /** A retained source could not complete its validated write/reconciliation path. */
  'retain_apply_failed',
  /** Retained temporal rows are absent, stale, or excluded by malformed temporal metadata. */
  'partial_temporal_index',
  /** Retained-memory discourse projection is absent, stale, ambiguous, or malformed. */
  'partial_memory_index',
  /** A bounded recurrence/range guard stopped timeline expansion. */
  'timeline_range_limited',
  'expansion_failed',
  'no_vector_index',
  'partial_index',
  /** The file yielded no text — nothing to read back, and no model involved either way. */
  'no_document_text',
  /** The original bytes are gone; recall is using a retained extraction or rendition. */
  'document_source_missing',
  /** Recall could not read the optional structural graph candidate arm. */
  'no_graph_index',
  /** Canonical entity names are not completely available for exact seeding. */
  'no_entity_index',
  /** One or more query names were ambiguous and Akno abstained. */
  'entity_resolution_failed',
  /** Base index rows and their rebuildable graph projection are out of step. */
  'partial_graph_index',
  /** A path, seed, or per-node fan-out safety cap stopped traversal. */
  'graph_traversal_limited',
  /** Related evidence exists, but no model role is available to produce a grounded answer. */
  'no_answer_model',
  /** The answer-generation request failed or returned an invalid draft. */
  'answer_failed',
  /** Independent support verification failed or could not run. */
  'answer_verification_failed',
  /** The answer hit a configured generation or output safety cap. */
  'answer_truncated',
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

/** What the reranker was allowed to remove, kept visible so fewer results never looks accidental. */
export const RecallQualification = z.object({
  model: z.enum(['llm', 'native']),
  /** Content-free runtime identity and cost receipt for the qualification request. */
  model_id: z.string().optional(),
  latency_ms: z.number().nonnegative().optional(),
  input_tokens: z.number().int().nonnegative().nullable().optional(),
  output_tokens: z.number().int().nonnegative().nullable().optional(),
  total_tokens: z.number().int().nonnegative().nullable().optional(),
  applied: z.boolean(),
  judged: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  /** Candidates outside the bounded rerank window. Omitted when qualification is applied. */
  unjudged: z.number().int().nonnegative(),
  basis: z.enum(['llm_grade', 'native_auto', 'native_manual', 'disabled', 'calibration_failed']),
  /** Native raw-score boundary; null for LLM grades or when calibration failed. */
  threshold: z.number().nullable(),
});
export type RecallQualification = z.infer<typeof RecallQualification>;

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
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'expected YYYY, YYYY-MM or YYYY-MM-DD')
  .refine(validDatePrefix, 'date prefix is not a real calendar period');

function validDatePrefix(value: string): boolean {
  if (value.length === 4) return true;
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return false;
  if (value.length === 7) return true;
  return validTemporalBoundary(value, 'day');
}
