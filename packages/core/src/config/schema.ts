import { z } from 'zod';
import { PageRole, RememberManagement } from '@tenphi/akno-protocol';

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
  /**
   * Retries after a rate limit or a transient server error, per request.
   *
   * On the provider rather than on a role because that is where the limit actually lives: a
   * 429 is a property of an account and an endpoint, and every role pointed at this provider
   * is queueing behind the same one. Capped at 5 because a request retried six times has
   * stopped being a retry and become an outage nobody was told about.
   */
  max_retries: z.number().int().min(0).max(5).optional(),
});
export type ProviderDoc = z.infer<typeof ProviderDoc>;

const modelRoleBase = {
  provider: z.string().optional(),
  id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  timeout_ms: z.number().int().positive().optional(),
};

export const ReasoningEffort = z.enum(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
export type ReasoningEffort = z.infer<typeof ReasoningEffort>;

const EmbeddingRoleDoc = z.object({
  ...modelRoleBase,
  dimensions: z.number().int().positive().optional(),
  batch: z.number().int().positive().optional(),
});
const RerankerRoleDoc = z.object({
  ...modelRoleBase,
  /** A native `/rerank` endpoint, or a generative model using Akno's ranking prompt. */
  mode: z.enum(['endpoint', 'llm']).optional(),
  /** Remove candidates the configured reranker confidently judges irrelevant. */
  exclude_irrelevant: z.boolean().optional(),
  top_k: z.number().int().positive().optional(),
  max_chars: z.number().int().positive().optional(),
  /** Output budget and thinking level used only by `mode: "llm"`. */
  max_output_tokens: z.number().int().positive().optional(),
  reasoning_effort: ReasoningEffort.nullable().optional(),
  /**
   * Where this model's "relevant" boundary sits on its own logit scale. Subtracted before the
   * sigmoid that turns a raw score into `relevance`, so the boundary lands on 0.5.
   *
   * Rerankers do not share a scale and nothing in a GGUF declares one. Measured on the development knowledge base, 12
   * labelled queries against 120 irrelevant pairs: bge-reranker-v2-m3 puts an irrelevant pair
   * near −11 and clears 0.5 for 0.8% of them; gte-reranker-modernbert-base puts the same pairs
   * near −0.3 and clears 0.5 for **42.5%**. Both rank correctly — only one is centred where a
   * 0.5 cutoff means anything.
   *
   * Calibrating here rather than moving `route_threshold` per model is deliberate: this is the
   * single point where a logit becomes a relevance, so every consumer downstream keeps working
   * unchanged and `relevance` keeps meaning the same thing whichever model produced it.
   */
  score_offset: z.union([z.number(), z.literal('auto')]).optional(),
});
/**
 * The shape shared by the two roles that generate text. They differ in what they are *for*,
 * not in how they are configured: `derive` does the work whose quality shows up in the
 * knowledge base and can take its time, `expansion` sits on the recall path where a second
 * of latency is felt on every question. Pointing both at one model is a valid answer; so is
 * pointing `derive` at a 12B and `expansion` at a 3B, which is what a laptop wants.
 */
const TextRoleDoc = z.object({
  ...modelRoleBase,
  max_output_tokens: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  reasoning_effort: ReasoningEffort.nullable().optional(),
});
const VisionRoleDoc = z.object({
  ...modelRoleBase,
  reasoning_effort: ReasoningEffort.nullable().optional(),
});

const ModelsDoc = z.object({
  embedding: EmbeddingRoleDoc.optional(),
  reranker: RerankerRoleDoc.optional(),
  derive: TextRoleDoc.optional(),
  expansion: TextRoleDoc.optional(),
  vision: VisionRoleDoc.optional(),
});

/** One rule per glob. Most specific wins; `akno rules <path>` explains why. */
export const FolderRuleDoc = z.object({
  /**
   * What belongs in this folder, in a sentence, for whoever files the next page — which is
   * usually an agent that has never seen the folder before.
   *
   * The rest of a rule tells Akno how to *treat* a page once it is there; this is the only
   * field that says what should be there at all. Without it a taxonomy is a list of globs, and
   * the knowledge that `research/` holds findings about the world while `household/` holds
   * claims about this household lives nowhere a caller can read — which is how a rent figure
   * from a transcript ends up filed as a defence strategy.
   */
  description: z.string().max(500).optional(),
  role: PageRole.optional(),
  /** Whether the conversational curator may place claims in this folder. */
  remember: RememberManagement.optional(),
  /** Canonical entity pages the folder's pages concern. */
  about: z.array(z.string().min(1)).optional(),
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
  source_quote_lines: z.number().int().positive().optional(),
  expansion: z.boolean().optional(),
  expansion_timeout_ms: z.number().int().positive().optional(),
  /** Add exact, bounded evidence-graph candidates to recall before qualification. */
  graph: z.boolean().optional(),
  rank: z
    .object({
      knowledge: z.number().min(0).optional(),
      source: z.number().min(0).optional(),
      inference: z.number().min(0).optional(),
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
  text_rendition: z.boolean().optional(),
  text_rendition_min_chars: z.number().int().nonnegative().optional(),
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

export const MAINTENANCE_PROFILES = ['audit', 'review', 'autonomous'] as const;
export type MaintenanceProfile = (typeof MAINTENANCE_PROFILES)[number];
export const MAINTENANCE_TRANSFORMS = [
  'observe',
  'reflect',
  'hygiene',
  'synthesis',
  'split',
  'extract',
  'merge',
  'contradiction',
  'broken_link',
  'adopt',
] as const;
export type MaintenanceTransform = (typeof MAINTENANCE_TRANSFORMS)[number];
export const MAINTENANCE_POLICIES = ['off', 'audit', 'review', 'auto'] as const;
export type MaintenancePolicy = (typeof MAINTENANCE_POLICIES)[number];
export interface MaintenanceLimits {
  maxItems: number;
  maxFilesChanged: number;
  maxBytesWritten: number;
  maxHighRiskItems: number;
}

const MaintenancePolicyDoc = z.enum(MAINTENANCE_POLICIES);
const MaintenancePoliciesDoc = z.object({
  observe: MaintenancePolicyDoc.optional(),
  reflect: MaintenancePolicyDoc.optional(),
  hygiene: MaintenancePolicyDoc.optional(),
  synthesis: MaintenancePolicyDoc.optional(),
  split: MaintenancePolicyDoc.optional(),
  extract: MaintenancePolicyDoc.optional(),
  merge: MaintenancePolicyDoc.optional(),
  contradiction: MaintenancePolicyDoc.optional(),
  broken_link: MaintenancePolicyDoc.optional(),
  adopt: MaintenancePolicyDoc.optional(),
});

const MaintenanceLimitsDoc = z.object({
  max_items: z.number().int().nonnegative().optional(),
  max_files_changed: z.number().int().nonnegative().optional(),
  max_bytes_written: z.number().int().nonnegative().optional(),
  max_high_risk_items: z.number().int().nonnegative().optional(),
});

const MaintenanceDoc = z.object({
  /** One understandable authority choice for the complete scheduled cycle. */
  profile: z.enum(MAINTENANCE_PROFILES).optional(),
  /** Per-transformation authority; omitted values inherit the selected profile. */
  policies: MaintenancePoliciesDoc.optional(),
  /** Cumulative apply ceilings shared by every plan-backed phase in one dream invocation. */
  limits: MaintenanceLimitsDoc.optional(),
  /**
   * The model the cycle uses, when it should not be the one indexing uses.
   *
   * Not a role of its own — it is the same capability as `derive`, pointed somewhere else
   * for the one caller that runs unattended. Measured on a real base: the observe tier's output
   * is almost entirely a function of the model behind it, and a knowledge base wanting a strong
   * model once a night should not thereby send every recall expansion to a paid API.
   */
  // Nullable so the committed default can name the key while leaving it unset.
  model: TextRoleDoc.nullable().optional(),
  /**
   * Write every run down: what was applied, what a guard refused, what was skipped and why.
   *
   * Off by default and deliberately so — a log of inferences drawn from private notes is a
   * second copy of the sensitive part, sitting outside the notes. It is genuinely useful while
   * you are deciding whether to trust the cycle, which is why it exists; it is the owner's
   * decision to make, which is why it is not the default.
   */
  log_changes: z.boolean().optional(),
  retain: TierDoc.optional(),
  observe: TierDoc.extend({
    /** Distinct source pages an observation needs. The floor is two. */
    min_evidence: z.number().int().min(2).optional(),
    /** Subjects looked at per run, most recently touched first. */
    max_subjects: z.number().int().positive().optional(),
  }).optional(),
  reflect: TierDoc.optional(),
  curate: z
    .object({
      verify: z.boolean().optional(),
      max_pages: z.number().int().positive().optional(),
      max_splits: z.number().int().nonnegative().optional(),
      max_extracts: z.number().int().nonnegative().optional(),
      max_merges: z.number().int().nonnegative().optional(),
      /** Exact folder prefixes eligible for identity-backed merge; empty keeps merge disabled. */
      merge_folders: z.array(z.string().min(1)).optional(),
      max_children_per_page: z.number().int().positive().optional(),
      split_after_bytes: z.number().int().positive().optional(),
      split_section_bytes: z.number().int().positive().optional(),
      extract_after_bytes: z.number().int().positive().optional(),
      extract_section_bytes: z.number().int().positive().optional(),
    })
    .optional(),
  adopt: z
    .object({
      /** Pages created per run. A folder of media should not become 500 pages overnight. */
      max_pages: z.number().int().positive().optional(),
    })
    .optional(),
  /** Broken-link proposal settings. Durable writes go through curate plans. */
  repair: z
    .object({
      /** Retains the legacy report-only `repair` phase; it never writes knowledge-base bytes. */
      enabled: z.boolean().optional(),
      /** Include exact, identity-backed broken-link items in plan-backed curate runs. */
      links: z.boolean().optional(),
      /** @deprecated Migration alias for maintenance.conflicts.resolve. */
      conflicts: z.boolean().optional(),
      /** Ceiling on broken-link rewrites proposed in one plan. */
      max_changes: z.number().int().positive().optional(),
    })
    .optional(),
  conflicts: z
    .object({
      enabled: z.boolean().optional(),
      /** Ask a model whether a candidate pair really conflicts. */
      verify: z.boolean().optional(),
      /** Include guarded contradiction items in plan-backed curate runs. */
      resolve: z.boolean().optional(),
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
  /** Retries after a rate limit or transient server error, within the role's existing deadline. */
  maxRetries: number;
}

export interface ResolvedModelRole {
  /**
   * `maintenance` is the same capability as `derive`, named apart only so that a failure at
   * 03:00 says which model failed — "derive endpoint returned 401" sends someone to look at
   * the local model that was working fine.
   */
  role: 'embedding' | 'reranker' | 'derive' | 'expansion' | 'vision' | 'maintenance';
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
  /** How the reranker role is called. Absent outside that role. */
  rerankerMode?: 'endpoint' | 'llm';
  /** Whether a successful reranker may qualify candidates out of the response. */
  excludeIrrelevant?: boolean;
  /** Characters of each candidate sent to the reranker. Cost scales with tokens. */
  maxChars?: number;
  /** Logit subtracted before the sigmoid, so this model's relevant/irrelevant boundary lands on 0.5. */
  scoreOffset?: number | 'auto';
  maxOutputTokens?: number;
  concurrency?: number;
  /** Explicit provider reasoning level. Omitted means use the provider default. */
  reasoningEffort?: ReasoningEffort;
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
    derive: ResolvedModelRole;
    expansion: ResolvedModelRole;
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
    sourceQuoteLines: number;
    expansion: boolean;
    expansionTimeoutMs: number;
    graph: boolean;
    rank: { knowledge: number; source: number; inference: number };
  };
  watch: { enabled: boolean; debounceMs: number; sweepIntervalMs: number; verifyIntervalMs: number };
  server: { socket: string; http: string | null; mcpAllow: string[] };
  ingest: {
    maxFileBytes: number;
    maxOcrPages: number;
    /** Below this, a document keeps its name and gets no page. */
    nameConfidence: number;
    blockedExtensions: string[];
    /** Keep `<file>.txt` beside each document whose text is its own. Off: the folder is the user's. */
    textRendition: boolean;
    /** Under this many characters, the page already says everything the file does. */
    textRenditionMinChars: number;
  };
  maintenance: {
    /** Named authority policy for the complete cycle. */
    profile: MaintenanceProfile;
    /** Every transformation has one policy after profile inheritance and ceiling enforcement. */
    policies: Record<MaintenanceTransform, MaintenancePolicy>;
    /** Cumulative apply ceilings for one maintenance invocation. */
    limits: MaintenanceLimits;
    /** Null when the cycle uses the `derive` role, which is the default. */
    model: ResolvedModelRole | null;
    /** Append a full record of every run to `<state_dir>/logs/dream.jsonl`. */
    logChanges: boolean;
    retain: { enabled: boolean; mission: string | null };
    observe: {
      enabled: boolean;
      mission: string | null;
      minEvidence: number;
      maxSubjects: number;
    };
    /** Ships as an extension point, off by default. */
    reflect: { enabled: boolean; mission: string | null };
    curate: {
      verify: boolean;
      maxPages: number;
      maxSplits: number;
      maxExtracts: number;
      maxMerges: number;
      mergeFolders: string[];
      maxChildrenPerPage: number;
      splitAfterBytes: number;
      splitSectionBytes: number;
      extractAfterBytes: number;
      extractSectionBytes: number;
    };
    adopt: { maxPages: number };
    conflicts: { enabled: boolean; verify: boolean; resolve: boolean; maxPairs: number };
    repair: { enabled: boolean; links: boolean; maxChanges: number };
  };
  trashRetentionDays: number;
  rules: FolderRule[];
  /** Files the config was assembled from, lowest precedence first. */
  sources: string[];
}
