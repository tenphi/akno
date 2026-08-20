import fs from 'node:fs';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import { readJsoncFile } from './jsonc.ts';
import { expandTilde, findRepoRoot, resolveUserPath } from './paths.ts';
import { compileRules } from '../rules/compile.ts';
import {
  ConfigDoc,
  type AknoConfig,
  type ProviderDoc,
  type ResolvedModelRole,
  type ResolvedProvider,
  type SecretRef,
} from './schema.ts';

/**
 * The rules file that travels with the notes. Named here rather than inline because
 * the indexer has to know to skip it: it lives *inside* the knowledge base but is Akno's
 * own configuration, and indexing it files the taxonomy as a memory object.
 */
export const KB_RULES_FILE = 'akno.json';

export interface LoadOptions {
  /** Wins over every file, for `open({ aknoPath })` and `--akno-path`. */
  aknoPath?: string;
  stateDir?: string;
  /**
   * Skip `config/local.jsonc` and `~/.akno/config.json`, leaving committed
   * defaults plus env. Also settable with `AKNO_ISOLATED=1`, which is how CI
   * keeps a developer's local overlay out of a test run.
   */
  isolated?: boolean;
  /** Extra overlay applied last, above env. Used by tests and one-shot CLI flags. */
  overrides?: ConfigDoc;
  env?: NodeJS.ProcessEnv;
}

/**
 * Config is assembled from four layers, lowest precedence first — which is also what the
 * repo's gitignore strategy is built around:
 *
 *   1. `config/default.jsonc`       committed, machine-independent, every key
 *   2. `~/.akno/config.json`      the installed machine's own config
 *   3. `config/local.jsonc`         gitignored dev overlay for this checkout
 *   4. `AKNO_*` environment       for containers and CI
 *
 * Secrets are the one thing no config layer holds. A config file names the variable that carries a
 * credential, never the credential, so it stays safe to read, diff and paste. The variables
 * themselves come from the environment, or from a gitignored `.env` beside the config — loaded
 * here rather than by a launcher, because a service started by launchd inherits almost nothing and
 * "put it in .env" has to be true for the person who read that in `.env.example`.
 *
 * Rules are a fifth, narrower layer: `<akno_path>/akno.json` wins over all
 * of the above for `folders`, so rules can travel with the notes.
 */
export function loadConfig(options: LoadOptions = {}): AknoConfig {
  const env = { ...dotEnv(), ...(options.env ?? process.env) };
  // A developer's `config/local.jsonc` must not be able to perturb a CI run or a
  // test. `AKNO_ISOLATED=1` restricts the stack to committed defaults plus env.
  const isolated = options.isolated ?? isTruthy(env.AKNO_ISOLATED ?? '');
  const sources: string[] = [];
  const layers: ConfigDoc[] = [];
  /** Rule provenance, in merge order. A rule's `source` must name the file that
   *  declared it — attributing it to whichever layer happened to be merged last
   *  makes `akno rules` confidently wrong. */
  const ruleLayers: { folders: Record<string, unknown>; source: string }[] = [];
  const recordRules = (doc: ConfigDoc, source: string): void => {
    if (doc.folders && Object.keys(doc.folders).length > 0) {
      ruleLayers.push({ folders: doc.folders, source });
    }
  };

  const defaultPath = findDefaultConfig();
  const defaults = readJsoncFile<unknown>(defaultPath);
  if (!defaults) {
    throw new AknoError('internal', `committed defaults are missing at ${defaultPath}`);
  }
  const defaultLayer = parseLayer(defaults, defaultPath);
  layers.push(defaultLayer);
  sources.push(defaultPath);
  recordRules(defaultLayer, defaultPath);

  if (!isolated) {
    for (const candidate of machineConfigCandidates(env, options)) {
      const doc = readJsoncFile<unknown>(candidate);
      if (doc) {
        const layer = parseLayer(doc, candidate);
        layers.push(layer);
        sources.push(candidate);
        recordRules(layer, candidate);
        break;
      }
    }

    const localPath = repoLocalConfigPath();
    if (localPath) {
      const doc = readJsoncFile<unknown>(localPath);
      if (doc) {
        const layer = parseLayer(doc, localPath);
        layers.push(layer);
        sources.push(localPath);
        recordRules(layer, localPath);
      }
    }
  }

  const envLayer = envOverlay(env);
  if (Object.keys(envLayer).length > 0) {
    layers.push(envLayer);
    sources.push('AKNO_* environment');
  }

  if (options.overrides) {
    const layer = parseLayer(options.overrides, '<overrides>');
    layers.push(layer);
    sources.push('<overrides>');
    recordRules(layer, '<overrides>');
  }

  const doc = layers.reduce<ConfigDoc>((acc, layer) => mergeDoc(acc, layer), {});
  if (options.aknoPath) doc.akno_path = options.aknoPath;
  if (options.stateDir) doc.state_dir = options.stateDir;

  return resolve(doc, sources, ruleLayers, env);
}

// ─── Layer discovery ────────────────────────────────────────────────────────

function findDefaultConfig(): string {
  const repoRoot = findRepoRoot();
  if (repoRoot) {
    const inRepo = path.join(repoRoot, 'config', 'default.jsonc');
    if (fs.existsSync(inRepo)) return inRepo;
  }
  // Installed: `config/` is shipped beside the package's `dist` (see the core
  // package's prepack), so walk up from this module rather than from cwd.
  for (const up of ['..', '../..', '../../..']) {
    const candidate = path.resolve(import.meta.dirname, up, 'config', 'default.jsonc');
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(findRepoRoot() ?? process.cwd(), 'config', 'default.jsonc');
}

function machineConfigCandidates(env: NodeJS.ProcessEnv, options: LoadOptions): string[] {
  if (env.AKNO_CONFIG) return [resolveUserPath(env.AKNO_CONFIG)];
  const stateDir = expandTilde(options.stateDir ?? env.AKNO_STATE_DIR ?? '~/.akno');
  return [path.join(stateDir, 'config.json'), path.join(stateDir, 'config.jsonc')];
}

function repoLocalConfigPath(): string | null {
  const repoRoot = findRepoRoot();
  return repoRoot ? path.join(repoRoot, 'config', 'local.jsonc') : null;
}

function parseLayer(raw: unknown, label: string): ConfigDoc {
  const parsed = ConfigDoc.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new AknoError('invalid', `${label} has invalid config:\n${issues}`);
  }
  return parsed.data;
}

/**
 * A deliberately short list. Env config is for containers and CI, where a file
 * is awkward; anything richer belongs in a config file where it can carry a
 * comment explaining itself.
 */
function envOverlay(env: NodeJS.ProcessEnv): ConfigDoc {
  const doc: ConfigDoc = {};
  if (env.AKNO_PATH) doc.akno_path = env.AKNO_PATH;
  if (env.AKNO_STATE_DIR) doc.state_dir = env.AKNO_STATE_DIR;
  if (env.AKNO_HTTP) doc.server = { ...doc.server, http: env.AKNO_HTTP };
  if (env.AKNO_WRITE_IDS) doc.write_ids = isTruthy(env.AKNO_WRITE_IDS);
  if (env.AKNO_MODEL_BASE_URL) {
    doc.providers = { ...doc.providers, local: { base_url: env.AKNO_MODEL_BASE_URL } };
  }
  if (env.AKNO_EMBEDDING_MODEL) {
    doc.models = { ...doc.models, embedding: { id: env.AKNO_EMBEDDING_MODEL } };
  }
  if (env.AKNO_DERIVE_MODEL) doc.models = { ...doc.models, derive: { id: env.AKNO_DERIVE_MODEL } };
  if (env.AKNO_EXPANSION_MODEL) {
    doc.models = { ...doc.models, expansion: { id: env.AKNO_EXPANSION_MODEL } };
  }
  return doc;
}

/**
 * `.env` beside the config, parsed as `KEY=value` lines. The real environment wins over it, so a
 * one-off `AKNO_OPENAI_API_KEY=… akno doctor` still overrides the file.
 *
 * No dependency and no expansion: this file holds credentials, and a parser that resolved `$OTHER`
 * or ran command substitution would be reading shell syntax it is not a shell for.
 */
function dotEnv(): NodeJS.ProcessEnv {
  const root = findRepoRoot();
  if (!root) return {};
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    return {};
  }

  const out: NodeJS.ProcessEnv = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (key.length > 0) out[key] = value;
  }
  return out;
}

function isTruthy(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

// ─── Merge ──────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep merge, with one deliberate asymmetry: **arrays replace, they do not
 * concatenate.** An overlay setting `ignore: [".git"]` means exactly that list.
 * Appending would make it impossible to *remove* a default, and a config you
 * cannot subtract from is a config you end up fighting.
 */
function mergeDoc<T>(base: T, overlay: T): T {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return (overlay === undefined ? base : overlay) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value) ? mergeDoc(existing, value) : value;
  }
  return out as T;
}

/**
 * Executables and installers. Not a security boundary — Akno never runs what it
 * ingests — but a knowledge base is a place for documents, and a `.dmg` filed as a
 * memory is a mistake worth refusing rather than indexing.
 */
const DEFAULT_BLOCKED = [
  'exe',
  'dll',
  'so',
  'dylib',
  'app',
  'pkg',
  'dmg',
  'msi',
  'bat',
  'cmd',
  'com',
  'scr',
  'jar',
  'sh',
  'bash',
  'zsh',
  'ps1',
];

// ─── Resolution ─────────────────────────────────────────────────────────────

function resolveSecret(ref: SecretRef | null | undefined, env: NodeJS.ProcessEnv): string | null {
  if (!ref) return null;
  const value = env[ref.env];
  return value && value.length > 0 ? value : null;
}

function resolveProviders(
  docs: Record<string, ProviderDoc> | undefined,
  env: NodeJS.ProcessEnv,
): Record<string, ResolvedProvider> {
  const out: Record<string, ResolvedProvider> = {};
  for (const [name, doc] of Object.entries(docs ?? {})) {
    if (!doc.base_url) continue; // A provider with no endpoint is not a provider.
    const headers: Record<string, string> = {};
    for (const [header, value] of Object.entries(doc.headers ?? {})) {
      const resolved = typeof value === 'string' ? value : resolveSecret(value, env);
      if (resolved) headers[header] = resolved;
    }
    out[name] = {
      name,
      baseUrl: doc.base_url.replace(/\/+$/, ''),
      apiKey: resolveSecret(doc.api_key, env),
      headers,
      maxRetries: doc.max_retries ?? 2,
    };
  }
  return out;
}

/**
 * A role resolves to usable, or to a *stated reason* it is not. Degrade,
 * never fail — but never degrade silently either. Every reason string here shows
 * up in `akno doctor` and in the `degraded` array on a result.
 */
function resolveRole(
  role: ResolvedModelRole['role'],
  doc: Record<string, unknown> | undefined,
  providers: Record<string, ResolvedProvider>,
  fallbackTimeout: number,
): ResolvedModelRole {
  const providerName = (doc?.provider as string | undefined) ?? 'local';
  const provider = providers[providerName] ?? null;
  const id = (doc?.id as string | null | undefined) ?? null;
  const explicitlyEnabled = doc?.enabled as boolean | undefined;
  // `enabled` defaults to true for the roles that carry their weight, and to
  // false for the two the spec ships off (reranker, vision) — the default config
  // states both, so an absent value here means "not overridden".
  const enabled = explicitlyEnabled !== false;

  let unavailableReason: string | null = null;
  if (!enabled) unavailableReason = `${role} is disabled in config`;
  else if (!id) unavailableReason = `no model id configured for ${role}`;
  else if (!provider) unavailableReason = `provider "${providerName}" has no base_url`;

  const resolved: ResolvedModelRole = {
    role,
    provider,
    id,
    enabled: enabled && unavailableReason === null,
    requested: enabled,
    timeoutMs: (doc?.timeout_ms as number | undefined) ?? fallbackTimeout,
    unavailableReason,
  };
  if (typeof doc?.dimensions === 'number') resolved.dimensions = doc.dimensions;
  if (typeof doc?.batch === 'number') resolved.batch = doc.batch;
  if (typeof doc?.top_k === 'number') resolved.topK = doc.top_k;
  if (typeof doc?.max_chars === 'number') resolved.maxChars = doc.max_chars;
  if (typeof doc?.score_offset === 'number') resolved.scoreOffset = doc.score_offset;
  if (typeof doc?.max_output_tokens === 'number') resolved.maxOutputTokens = doc.max_output_tokens;
  if (typeof doc?.concurrency === 'number') resolved.concurrency = doc.concurrency;
  return resolved;
}

function resolve(
  doc: ConfigDoc,
  sources: string[],
  ruleLayers: { folders: Record<string, unknown>; source: string }[],
  env: NodeJS.ProcessEnv,
): AknoConfig {
  if (!doc.akno_path) {
    throw new AknoError(
      'invalid',
      'akno_path is not set. Point Akno at your knowledge base in config/local.jsonc ' +
        '(copy config/local.example.jsonc), in ~/.akno/config.json, or with AKNO_PATH.',
    );
  }

  const aknoPath = resolveUserPath(doc.akno_path);
  if (!fs.existsSync(aknoPath)) {
    throw new AknoError('invalid', `akno_path does not exist: ${aknoPath}`);
  }
  if (!fs.statSync(aknoPath).isDirectory()) {
    throw new AknoError('invalid', `akno_path is not a directory: ${aknoPath}`);
  }

  const stateDir = resolveUserPath(doc.state_dir ?? '~/.akno');
  const providers = resolveProviders(doc.providers, env);

  // Rules found in the knowledge base win over machine config, so they can be
  // versioned with the notes and survive a move to another machine.
  const kbRulesPath = path.join(aknoPath, KB_RULES_FILE);
  const kbRules = readJsoncFile<{ folders?: Record<string, unknown>; gate?: string }>(kbRulesPath);
  const rules = compileRules([
    ...ruleLayers,
    ...(kbRules?.folders ? [{ folders: kbRules.folders, source: kbRulesPath }] : []),
  ]);
  const gate = (kbRules?.gate as AknoConfig['gate'] | undefined) ?? doc.gate ?? 'top-level';
  if (kbRules) sources.push(kbRulesPath);

  return {
    aknoPath,
    stateDir,
    dbPath: path.join(stateDir, 'akno.db'),
    socketPath: path.join(stateDir, doc.server?.socket ?? 'akno.sock'),
    lockPath: path.join(stateDir, 'akno.lock'),
    trashDir: path.join(stateDir, 'trash'),
    logDir: path.join(stateDir, 'logs'),
    paths: {
      timeline: doc.paths?.timeline ?? 'timeline.md',
      inbox: doc.paths?.inbox ?? 'inbox',
      observations: doc.paths?.observations ?? 'observations',
      journal: doc.paths?.journal ?? 'journal',
    },
    createReservedPaths: doc.create_reserved_paths ?? false,
    writeIds: doc.write_ids ?? false,
    ignore: doc.ignore ?? ['.git', '.obsidian', '.akno', 'node_modules'],
    pageExtensions: (doc.page_extensions ?? ['.md', '.markdown']).map((e) => e.toLowerCase()),
    maxPageBytes: doc.max_page_bytes ?? 1_048_576,
    gate,
    routeThreshold: doc.route_threshold ?? 0.5,
    looseEvents: doc.loose_events ?? 'ledger',
    derivedInFrontmatter: doc.derived_in_frontmatter ?? 'none',
    providers,
    models: {
      embedding: resolveRole('embedding', doc.models?.embedding, providers, 60_000),
      reranker: resolveRole('reranker', doc.models?.reranker, providers, 30_000),
      derive: resolveRole('derive', doc.models?.derive, providers, 120_000),
      // A shorter default ceiling than derive's two minutes, because this one is on the recall
      // path. `recall.expansion_timeout_ms` is the deadline that actually governs a call; this
      // is the backstop for a model that accepts the connection and then goes quiet.
      expansion: resolveRole('expansion', doc.models?.expansion, providers, 30_000),
      vision: resolveRole('vision', doc.models?.vision, providers, 120_000),
    },
    index: {
      chunkTargetChars: doc.index?.chunk_target_chars ?? 1200,
      chunkMaxChars: doc.index?.chunk_max_chars ?? 4000,
      chunkOverlapChars: doc.index?.chunk_overlap_chars ?? 120,
      summaries: doc.index?.summaries ?? true,
      facts: doc.index?.facts ?? true,
      hashConcurrency: doc.index?.hash_concurrency ?? 8,
      annThresholdChunks: doc.index?.ann_threshold_chunks ?? 20_000,
    },
    recall: {
      defaultBudget: doc.recall?.default_budget ?? 8000,
      defaultLimit: doc.recall?.default_limit ?? 8,
      candidatesPerArm: doc.recall?.candidates_per_arm ?? 60,
      lineWindow: doc.recall?.line_window ?? 6,
      sourceQuoteLines: doc.recall?.source_quote_lines ?? 6,
      expansion: doc.recall?.expansion ?? true,
      expansionTimeoutMs: doc.recall?.expansion_timeout_ms ?? 4000,
      rank: {
        knowledge: doc.recall?.rank?.knowledge ?? 1,
        source: doc.recall?.rank?.source ?? 0.85,
        inference: doc.recall?.rank?.inference ?? 0.6,
      },
    },
    watch: {
      enabled: doc.watch?.enabled ?? true,
      debounceMs: doc.watch?.debounce_ms ?? 400,
      sweepIntervalMs: doc.watch?.sweep_interval_ms ?? 300_000,
      verifyIntervalMs: doc.watch?.verify_interval_ms ?? 3_600_000,
    },
    server: {
      socket: doc.server?.socket ?? 'akno.sock',
      http: doc.server?.http ?? null,
      mcpAllow: doc.server?.mcp_allow ?? ['recall', 'read', 'list', 'timeline', 'context'],
    },
    ingest: {
      maxFileBytes: Math.round((doc.ingest?.max_file_mb ?? 25) * 1_048_576),
      maxOcrPages: doc.ingest?.max_ocr_pages ?? 12,
      nameConfidence: doc.ingest?.name_confidence ?? 0.55,
      blockedExtensions: (doc.ingest?.blocked_extensions ?? DEFAULT_BLOCKED).map((extension: string) =>
        extension.replace(/^\./, '').toLowerCase(),
      ),
      textRendition: doc.ingest?.text_rendition ?? false,
      textRenditionMinChars: doc.ingest?.text_rendition_min_chars ?? 1000,
    },
    maintenance: {
      // Resolved through the same path as any role, so a typo in the provider name fails the
      // same way and `doctor` can probe it like the rest.
      model: doc.maintenance?.model
        ? resolveRole('maintenance', doc.maintenance.model, providers, 120_000)
        : null,
      logChanges: doc.maintenance?.log_changes ?? false,
      retain: {
        enabled: doc.maintenance?.retain?.enabled ?? true,
        mission: doc.maintenance?.retain?.mission ?? null,
      },
      observe: {
        // Off by default, from measurement rather than caution. On a real 223-page knowledge
        // base with a local 3B model, a run produced 18 candidate patterns of which about
        // three were worth keeping — and every one of them would have been recalled later as
        // truth. The guardrails hold; what they cannot do is make a small model insightful.
        // Enable it with a model you have seen produce patterns worth having.
        enabled: doc.maintenance?.observe?.enabled ?? false,
        mission: doc.maintenance?.observe?.mission ?? null,
        // The floor, and the schema refuses to go below it: one page agreeing with
        // itself is not a pattern.
        minEvidence: Math.max(2, doc.maintenance?.observe?.min_evidence ?? 2),
        maxSubjects: doc.maintenance?.observe?.max_subjects ?? 40,
      },
      reflect: {
        // At a few hundred pages a "pattern" is one coincidence away from noise.
        enabled: doc.maintenance?.reflect?.enabled ?? false,
        mission: doc.maintenance?.reflect?.mission ?? null,
      },
      curate: {
        enabled: doc.maintenance?.curate?.enabled ?? false,
        mode: doc.maintenance?.curate?.mode ?? null,
        write: doc.maintenance?.curate?.write ?? false,
        verify: doc.maintenance?.curate?.verify ?? true,
        maxPages: doc.maintenance?.curate?.max_pages ?? 8,
        maxSplits: doc.maintenance?.curate?.max_splits ?? 3,
        maxExtracts: doc.maintenance?.curate?.max_extracts ?? 3,
        maxChildrenPerPage: doc.maintenance?.curate?.max_children_per_page ?? 2,
        splitAfterBytes: doc.maintenance?.curate?.split_after_bytes ?? 16_384,
        splitSectionBytes: doc.maintenance?.curate?.split_section_bytes ?? 8_192,
        extractAfterBytes: doc.maintenance?.curate?.extract_after_bytes ?? 8_192,
        extractSectionBytes: doc.maintenance?.curate?.extract_section_bytes ?? 1_024,
      },
      adopt: {
        enabled: doc.maintenance?.adopt?.enabled ?? true,
        maxPages: doc.maintenance?.adopt?.max_pages ?? 20,
      },
      conflicts: {
        enabled: doc.maintenance?.conflicts?.enabled ?? true,
        verify: doc.maintenance?.conflicts?.verify ?? true,
        maxPairs: doc.maintenance?.conflicts?.max_pairs ?? 40,
      },
      repair: {
        enabled: doc.maintenance?.repair?.enabled ?? false,
        links: doc.maintenance?.repair?.links ?? true,
        conflicts: doc.maintenance?.repair?.conflicts ?? true,
        maxChanges: doc.maintenance?.repair?.max_changes ?? 25,
      },
    },
    trashRetentionDays: doc.trash_retention_days ?? 30,
    rules,
    sources,
  };
}
