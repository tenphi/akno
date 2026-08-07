import { z } from 'zod';
import { PageClass } from '@akno/protocol';

/**
 * The config document as it appears on disk. Every field is optional here —
 * `config/default.jsonc` supplies the values and this schema only says what a
 * key is allowed to be. The resolved, fully-populated shape is `AknoConfig`.
 */

/** A credential is named, never inlined. This is the only way to reference one. */
export const SecretRef = z.object({ env: z.string().min(1) });
export type SecretRef = z.infer<typeof SecretRef>;

export const ProviderDoc = z.object({
  base_url: z.string().url().nullable().optional(),
  api_key: SecretRef.nullable().optional(),
  /** Extra headers, for a gateway that wants one. Values may be secret refs. */
  headers: z.record(z.string(), z.union([z.string(), SecretRef])).optional(),
});
export type ProviderDoc = z.infer<typeof ProviderDoc>;

const modelRoleBase = {
  provider: z.string().optional(),
  id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  timeout_ms: z.number().int().positive().optional(),
};

const EmbeddingRoleDoc = z.object({
  ...modelRoleBase,
  dimensions: z.number().int().positive().optional(),
  batch: z.number().int().positive().optional(),
});
const RerankerRoleDoc = z.object({
  ...modelRoleBase,
  top_k: z.number().int().positive().optional(),
  max_chars: z.number().int().positive().optional(),
});
const ChatRoleDoc = z.object({
  ...modelRoleBase,
  max_output_tokens: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
});
const VisionRoleDoc = z.object({ ...modelRoleBase });

const ModelsDoc = z.object({
  embedding: EmbeddingRoleDoc.optional(),
  reranker: RerankerRoleDoc.optional(),
  chat: ChatRoleDoc.optional(),
  vision: VisionRoleDoc.optional(),
});

/** One rule per glob. Most specific wins; `akno rules <path>` explains why. */
export const FolderRuleDoc = z.object({
  class: PageClass.optional(),
  type: z.string().optional(),
  /** `page | document | file | auto | ignore` — behaviour differs by folder, so
   *  it is declared once rather than classified per arrival. */
  ingest: z.enum(['page', 'document', 'file', 'auto', 'ignore']).optional(),
  /** Multiplied into the score at assembly. Demotes without hiding. */
  rank: z.number().min(0).max(2).optional(),
  /** Makes a folder an inbox: arrivals are routed out of it. */
  route: z.boolean().optional(),
  /** Enforced structure, reported by `doctor` rather than silently applied. */
  max_depth: z.number().int().positive().optional(),
  slug_pattern: z.string().optional(),
});
export type FolderRuleDoc = z.infer<typeof FolderRuleDoc>;

const PathsDoc = z.object({
  timeline: z.string().optional(),
  inbox: z.string().optional(),
  observations: z.string().optional(),
  journal: z.string().optional(),
});

const IndexDoc = z.object({
  chunk_target_chars: z.number().int().positive().optional(),
  chunk_max_chars: z.number().int().positive().optional(),
  chunk_overlap_chars: z.number().int().nonnegative().optional(),
  summaries: z.boolean().optional(),
  facts: z.boolean().optional(),
  hash_concurrency: z.number().int().positive().optional(),
  ann_threshold_chunks: z.number().int().positive().optional(),
});

const RecallDoc = z.object({
  default_budget: z.number().int().positive().optional(),
  default_limit: z.number().int().positive().optional(),
  candidates_per_arm: z.number().int().positive().optional(),
  line_window: z.number().int().positive().optional(),
  reference_quote_lines: z.number().int().positive().optional(),
  expansion: z.boolean().optional(),
  expansion_timeout_ms: z.number().int().positive().optional(),
  rank: z
    .object({
      full: z.number().min(0).optional(),
      reference: z.number().min(0).optional(),
      observation: z.number().min(0).optional(),
    })
    .optional(),
});

const WatchDoc = z.object({
  enabled: z.boolean().optional(),
  debounce_ms: z.number().int().nonnegative().optional(),
  sweep_interval_ms: z.number().int().nonnegative().optional(),
  verify_interval_ms: z.number().int().nonnegative().optional(),
});

const ServerDoc = z.object({
  socket: z.string().optional(),
  http: z.string().nullable().optional(),
  mcp_allow: z.array(z.string()).optional(),
});

const IngestDoc = z.object({
  max_file_mb: z.number().positive().optional(),
  max_ocr_pages: z.number().int().positive().optional(),
  name_confidence: z.number().min(0).max(1).optional(),
  blocked_extensions: z.array(z.string()).optional(),
});

/**
 * A **mission** appends emphasis to a fixed system prompt and never replaces it. That
 * is a guardrail, not a convenience: every rule that keeps an inference engine honest lives
 * in the fixed part, and a replaceable prompt is how they all get lost at once.
 */
const TierDoc = z.object({
  enabled: z.boolean().optional(),
  // Nullable so the committed default can *show* the key with no value, rather than leaving
  // a reader to guess that it exists.
  mission: z.string().nullable().optional(),
});

const MaintenanceDoc = z.object({
  /**
   * The chat model the cycle uses, when it should not be the one per-turn work uses.
   *
   * Not a fifth model role — it is the same `chat` capability, pointed somewhere else
   * for the one caller that runs unattended. Measured on a real base: the observe tier's output
   * is almost entirely a function of the model behind it, and a knowledge base wanting a strong
   * model once a night should not thereby send every recall expansion to a paid API.
   */
  // Nullable so the committed default can name the key while leaving it unset.
  model: ChatRoleDoc.nullable().optional(),
  retain: TierDoc.optional(),
  observe: TierDoc.extend({
    /** Distinct source pages an observation needs. The floor is two. */
    min_evidence: z.number().int().min(2).optional(),
    /** Subjects looked at per run, most recently touched first. */
    max_subjects: z.number().int().positive().optional(),
  }).optional(),
  reflect: TierDoc.optional(),
  adopt: z
    .object({
      enabled: z.boolean().optional(),
      /** Pages created per run. A folder of media should not become 500 pages overnight. */
      max_pages: z.number().int().positive().optional(),
    })
    .optional(),
  conflicts: z
    .object({
      enabled: z.boolean().optional(),
      /** Ask the chat model whether a candidate pair really conflicts. */
      verify: z.boolean().optional(),
      max_pairs: z.number().int().positive().optional(),
    })
    .optional(),
});

export const ConfigDoc = z.object({
  akno_path: z.string().nullable().optional(),
  state_dir: z.string().optional(),
  paths: PathsDoc.optional(),
  create_reserved_paths: z.boolean().optional(),
  write_ids: z.boolean().optional(),
  ignore: z.array(z.string()).optional(),
  page_extensions: z.array(z.string()).optional(),
  max_page_bytes: z.number().int().positive().optional(),
  gate: z.enum(['top-level', 'all', 'none']).optional(),
  route_threshold: z.number().min(0).max(1).optional(),
  loose_events: z.enum(['ledger', 'daily']).optional(),
  derived_in_frontmatter: z.enum(['none', 'summary', 'all']).optional(),
  providers: z.record(z.string(), ProviderDoc).optional(),
  models: ModelsDoc.optional(),
  index: IndexDoc.optional(),
  recall: RecallDoc.optional(),
  watch: WatchDoc.optional(),
  server: ServerDoc.optional(),
  ingest: IngestDoc.optional(),
  maintenance: MaintenanceDoc.optional(),
  trash_retention_days: z.number().int().nonnegative().optional(),
  folders: z.record(z.string(), FolderRuleDoc).optional(),
});
export type ConfigDoc = z.infer<typeof ConfigDoc>;

// ─── Resolved shape ─────────────────────────────────────────────────────────
// What the rest of the codebase consumes: no optionals, absolute paths, secrets
// already read out of the environment.

export interface ResolvedProvider {
  name: string;
  baseUrl: string;
  apiKey: string | null;
  headers: Record<string, string>;
}

export interface ResolvedModelRole {
  role: 'embedding' | 'reranker' | 'chat' | 'vision';
  provider: ResolvedProvider | null;
  id: string | null;
  /** True once the role resolved to something usable. */
  enabled: boolean;
  /**
   * What the user asked for, kept separate from what resolved. `enabled` is
   * forced false whenever a role is unusable, so it cannot answer "was this
   * wanted?" — and without that, a misconfigured role degrades in silence.
   */
  requested: boolean;
  timeoutMs: number;
  /** Present only on the embedding role. */
  dimensions?: number;
  batch?: number;
  topK?: number;
  /** Characters of each candidate sent to the reranker. Cost scales with tokens. */
  maxChars?: number;
  maxOutputTokens?: number;
  concurrency?: number;
  /** Why the role is unusable, when it is. Reported verbatim by `doctor`. */
  unavailableReason: string | null;
}

export interface FolderRule extends FolderRuleDoc {
  glob: string;
  /** Which file the rule came from, for `akno rules <path>`. */
  source: string;
  /** Higher wins. Derived from glob shape, not declaration order. */
  specificity: number;
}

export interface AknoConfig {
  aknoPath: string;
  stateDir: string;
  dbPath: string;
  socketPath: string;
  lockPath: string;
  trashDir: string;
  logDir: string;
  paths: { timeline: string; inbox: string; observations: string; journal: string };
  createReservedPaths: boolean;
  writeIds: boolean;
  ignore: string[];
  pageExtensions: string[];
  maxPageBytes: number;
  gate: 'top-level' | 'all' | 'none';
  routeThreshold: number;
  looseEvents: 'ledger' | 'daily';
  derivedInFrontmatter: 'none' | 'summary' | 'all';
  providers: Record<string, ResolvedProvider>;
  models: {
    embedding: ResolvedModelRole;
    reranker: ResolvedModelRole;
    chat: ResolvedModelRole;
    vision: ResolvedModelRole;
  };
  index: {
    chunkTargetChars: number;
    chunkMaxChars: number;
    chunkOverlapChars: number;
    summaries: boolean;
    facts: boolean;
    hashConcurrency: number;
    annThresholdChunks: number;
  };
  recall: {
    defaultBudget: number;
    defaultLimit: number;
    candidatesPerArm: number;
    lineWindow: number;
    referenceQuoteLines: number;
    expansion: boolean;
    expansionTimeoutMs: number;
    rank: { full: number; reference: number; observation: number };
  };
  watch: { enabled: boolean; debounceMs: number; sweepIntervalMs: number; verifyIntervalMs: number };
  server: { socket: string; http: string | null; mcpAllow: string[] };
  ingest: {
    maxFileBytes: number;
    maxOcrPages: number;
    /** Below this, a document keeps its name and gets no page. */
    nameConfidence: number;
    blockedExtensions: string[];
  };
  maintenance: {
    /** Null when the cycle uses the `chat` role, which is the default. */
    model: ResolvedModelRole | null;
    retain: { enabled: boolean; mission: string | null };
    observe: {
      enabled: boolean;
      mission: string | null;
      minEvidence: number;
      maxSubjects: number;
    };
    /** Ships as an extension point, off by default. */
    reflect: { enabled: boolean; mission: string | null };
    adopt: { enabled: boolean; maxPages: number };
    conflicts: { enabled: boolean; verify: boolean; maxPairs: number };
  };
  trashRetentionDays: number;
  rules: FolderRule[];
  /** Files the config was assembled from, lowest precedence first. */
  sources: string[];
}
