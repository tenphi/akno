import fs from 'node:fs';
import path from 'node:path';
import type { AknoContext } from './context.ts';
import { looksLikeLedger } from './reserved.ts';
import { extractionCapabilities } from './ingest/extract.ts';
import { readOnlyExplanation } from './open.ts';
import { ModelClient } from './models/client.ts';
import { generativeModelIds, providerApiReport, type ProviderApiResolution } from './models/provider-api.ts';
import { probeAnswerModel, type AnswerCapabilityCheck, type AnswerCapabilityProbe } from './ops/answer.ts';

/**
 * What's present, what's degraded, and **what that costs.** The last
 * part is the one that matters: "no reranker" means nothing to a reader, and
 * "hybrid score ordering instead of cross-encoder reranking" means something.
 *
 * Model latency and index latency are reported separately, because a memory system which
 * feels slow after idling is almost never suffering from its storage engine — and conflating
 * the two hides that.
 */

export interface RoleReport {
  role: string;
  configured: boolean;
  available: boolean;
  model: string | null;
  endpoint: string | null;
  latencyMs: number | null;
  error: string | null;
  /** Plain-language consequence of this role being unavailable. */
  withoutIt: string;
  /** Production-shaped probes are reported separately from a generic transport ping. */
  checks?: AnswerCapabilityProbe;
}

export interface DoctorReport {
  aknoPath: string;
  stateDir: string;
  configSources: string[];
  writable: boolean;
  lockHeldBy: number | null;
  readOnlyReason: 'requested' | 'held' | 'unwritable' | null;
  vectorBackend: 'vec0' | 'fallback';
  counts: {
    pages: number;
    chunks: number;
    chunksEmbedded: number;
    facts: number;
    factsSuperseded: number;
    events: number;
    documents: number;
    /** Originals absent from disk while their durable indexed identity is retained. */
    documentsMissing: number;
    documentsExtracted: number;
    /** Extracted text with no searchable chunk. Ownership no longer affects this count. */
    documentsUnsearchable: number;
    /** `<file>.txt` written beside a document. Counted apart: they are not documents of their own. */
    renditions: number;
    links: number;
    brokenLinks: number;
    ignoredRules: number;
  };
  byRole: Record<string, number>;
  index: {
    /** Time to open the handle and run one point lookup. Not a model number. */
    openMs: number;
    lexicalMs: number;
    vectorMs: number | null;
  };
  models: RoleReport[];
  /** Content-free resolution state for each provider's generative transport. */
  providerApis: ProviderApiResolution[];
  /** The extraction path. A missing capability must be visible, not surprising. */
  extraction: { swift: boolean; textutil: boolean; note: string | null };
  reserved: { path: string; state: 'ok' | 'missing' | 'occupied'; note?: string }[];
  warnings: string[];
}

export async function doctor(
  ctx: AknoContext,
  options: { probeModels?: boolean } = {},
): Promise<DoctorReport> {
  const db = ctx.store.db;
  const warnings: string[] = [];

  const count = (sql: string, ...params: unknown[]): number =>
    (db.prepare(sql).get(...params) as { c: number }).c;

  const counts = {
    pages: count('SELECT count(*) AS c FROM pages'),
    chunks: count('SELECT count(*) AS c FROM chunks'),
    chunksEmbedded: count('SELECT count(*) AS c FROM chunks WHERE embedded = 1'),
    facts: count('SELECT count(*) AS c FROM facts WHERE valid_to IS NULL'),
    factsSuperseded: count('SELECT count(*) AS c FROM facts WHERE valid_to IS NOT NULL'),
    events: count('SELECT count(*) AS c FROM events'),
    // Renditions are left out of all three. A `.txt` beside a contract is that contract in
    // another format, not a fourteenth attachment with nothing readable in it — counting it
    // as one would report the feature working as a knowledge base full of unreadable files.
    documents: count('SELECT count(*) AS c FROM documents WHERE renders IS NULL'),
    documentsMissing: count(
      "SELECT count(*) AS c FROM documents WHERE renders IS NULL AND availability = 'missing'",
    ),
    documentsExtracted: count(
      'SELECT count(*) AS c FROM documents WHERE renders IS NULL AND text IS NOT NULL',
    ),
    documentsUnsearchable: count(
      `SELECT count(*) AS c FROM documents d
        WHERE d.renders IS NULL AND d.text IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM chunks c WHERE c.document_id = d.id)`,
    ),
    renditions: count('SELECT count(*) AS c FROM documents WHERE renders IS NOT NULL'),
    links: count('SELECT count(*) AS c FROM links'),
    brokenLinks: count('SELECT count(*) AS c FROM links WHERE broken = 1'),
    ignoredRules: ctx.config.rules.filter((rule) => rule.role === 'ignored').length,
  };

  const byRole: Record<string, number> = {};
  for (const row of db.prepare('SELECT role, count(*) AS c FROM pages GROUP BY role').all() as {
    role: string;
    c: number;
  }[]) {
    byRole[row.role] = row.c;
  }

  // ── Index latency, isolated from any model ───────────────────────────────
  const openStart = performance.now();
  db.prepare('SELECT id FROM pages LIMIT 1').get();
  const openMs = performance.now() - openStart;

  const lexStart = performance.now();
  try {
    db.prepare('SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ? LIMIT 10').all('"the"');
  } catch {
    // An empty index has nothing to match; the number is still meaningful.
  }
  const lexicalMs = performance.now() - lexStart;

  let vectorMs: number | null = null;
  if (counts.chunksEmbedded > 0) {
    const probe = new Float32Array(ctx.store.vectors.dimensions);
    probe[0] = 1;
    const vecStart = performance.now();
    ctx.store.vectors.search(probe, 10);
    vectorMs = performance.now() - vecStart;
  }

  // ── Models ───────────────────────────────────────────────────────────────
  const consequences: Record<string, string> = {
    embedding:
      'lexical search only — no semantic matching, and question-mode hypothetical expansion is inert',
    reranker:
      'hybrid score ordering instead of cross-encoder reranking; recall still works, ordering is coarser',
    derive:
      'no summaries, keywords, fact derivation, remember, ingest naming or observations — recall still works',
    expansion:
      'recall searches the words you typed and nothing more: no synonyms, no hypothetical answer for a question',
    answer: 'direct grounded answer generation is unavailable; recall still returns inspectable evidence',
    vision:
      'photos with no text yield no page; OCR still covers scans and screenshots, which is most arrivals',
  };

  const models: RoleReport[] = [];
  for (const [role, client] of Object.entries(ctx.models)) {
    const resolved = ctx.config.models[role as keyof typeof ctx.config.models];
    const report: RoleReport = {
      role,
      configured: resolved.id !== null,
      available: client.available,
      model: resolved.id,
      endpoint: resolved.provider?.baseUrl ?? null,
      latencyMs: null,
      error: client.unavailableReason,
      withoutIt: consequences[role] ?? '',
    };
    if (options.probeModels !== false && client.available) {
      if (role === 'answer') {
        const checks = await probeAnswerModel(client);
        report.checks = checks;
        report.latencyMs = capabilityLatency(checks);
        const failed = Object.entries(checks).find(([, check]) => check.status !== 'ok');
        if (failed) {
          report.available = false;
          report.error = `${failed[0]} check ${failed[1].status}: ${failed[1].error ?? 'unknown failure'}`;
        }
      } else {
        const ping = await client.ping();
        report.latencyMs = Math.round(ping.latencyMs);
        if (!ping.ok) {
          report.available = false;
          report.error = ping.error ?? 'ping failed';
        }
      }
    }
    models.push(report);
  }

  const providerApis = Object.values(ctx.config.providers).map((provider) =>
    providerApiReport(provider, generativeModelIds(ctx.config, provider)),
  );

  // The cycle's own model, when a knowledge base points the maintenance tiers somewhere else.
  // Probed here or nowhere: without this, a typo in it surfaces at 03:00 in a log nobody reads.
  if (ctx.config.maintenance.model) {
    const resolved = ctx.config.maintenance.model;
    const client = new ModelClient(resolved);
    const report: RoleReport = {
      role: 'derive (maintenance)',
      configured: resolved.id !== null,
      available: client.available,
      model: resolved.id,
      endpoint: resolved.provider?.baseUrl ?? null,
      latencyMs: null,
      error: client.unavailableReason,
      withoutIt: 'the maintenance cycle falls back to nothing — observe and reflect cannot run',
    };
    if (options.probeModels !== false && client.available) {
      const ping = await client.ping();
      report.latencyMs = Math.round(ping.latencyMs);
      if (!ping.ok) {
        report.available = false;
        report.error = ping.error ?? 'ping failed';
      }
    }
    models.push(report);
  }

  // ── Extraction ───────────────────────────────────────────────────────────
  const extraction = await extractionCapabilities();

  // ── Reserved paths ───────────────────────────────────────────────────────
  // If a reserved path already exists and isn't what Akno expects, it is
  // left completely alone. Warn, point at the config key, refuse to adopt it.
  const reserved: DoctorReport['reserved'] = [];
  const timelineAbs = path.join(ctx.config.aknoPath, ctx.config.paths.timeline);
  if (!fs.existsSync(timelineAbs)) {
    reserved.push({ path: ctx.config.paths.timeline, state: 'missing', note: 'no event ledger yet' });
  } else if (!looksLikeLedger(timelineAbs)) {
    reserved.push({
      path: ctx.config.paths.timeline,
      state: 'occupied',
      note: 'exists but holds no event lines — remap with paths.timeline if this file means something else',
    });
  } else {
    reserved.push({ path: ctx.config.paths.timeline, state: 'ok' });
  }

  const inboxAbs = path.join(ctx.config.aknoPath, ctx.config.paths.inbox);
  reserved.push({
    path: `${ctx.config.paths.inbox}/`,
    state: fs.existsSync(inboxAbs) ? 'ok' : 'missing',
    ...(fs.existsSync(inboxAbs)
      ? {}
      : { note: 'no drop folder yet — create it, or set `paths.inbox`, and dropped files file themselves' }),
  });

  // ── Warnings ─────────────────────────────────────────────────────────────
  if (counts.chunks > 0 && counts.chunksEmbedded < counts.chunks) {
    warnings.push(
      `${counts.chunks - counts.chunksEmbedded} of ${counts.chunks} chunks are not embedded — ` +
        'recall is running partly lexical. Run `akno index` again once the embedding endpoint is up.',
    );
  }
  if (counts.documents > counts.documentsExtracted) {
    warnings.push(
      `${counts.documents - counts.documentsExtracted} attachments have no readable text — a photo with ` +
        'nothing written in it, or a format with no extractor. They remain visible by filename.',
    );
  }
  if (counts.documentsMissing > 0) {
    warnings.push(
      `${counts.documentsMissing} document originals are missing — retained indexed text remains ` +
        'searchable but is reported as degraded. Restore the files or explicitly forget them.',
    );
  }
  if (counts.documentsUnsearchable > 0) {
    warnings.push(
      `${counts.documentsUnsearchable} attachments have extracted text but no search chunks. ` +
        'Run `akno index` to repair the derived index.',
    );
  }
  if (extraction.note) warnings.push(extraction.note);
  if (counts.brokenLinks > 0) {
    warnings.push(`${counts.brokenLinks} wikilinks point at pages that do not exist.`);
  }
  // Only a *surprise* is a warning. `doctor` itself asks for a read-only handle so that
  // inspecting a knowledge base never takes the write lock from a running service, and
  // announcing that as a problem — naming a process that does not exist — sent the reader
  // hunting for a second Akno there was no evidence of.
  if (!ctx.writable && ctx.readOnlyReason !== 'requested') {
    warnings.push(`this instance is read-only: ${readOnlyExplanation(ctx.readOnlyReason, ctx.lockHeldBy)}`);
  }
  if (ctx.store.vectors.kind === 'fallback') {
    warnings.push(
      'sqlite-vec could not be loaded, so vector search is running in the JS fallback. ' +
        'Correct, but slower on a large knowledge base.',
    );
  }
  if (counts.chunks === 0) {
    warnings.push('the index is empty — run `akno index`.');
  }
  const stale = staleBuild();
  if (stale) warnings.push(stale);
  // A rule is matched against a page's *slug*, which carries no extension, so a glob
  // ending in `.md` can never match anything. `akno rules` lists it like any other rule,
  // which makes it look applied — the one thing a config guard should never do.
  for (const rule of ctx.config.rules) {
    const extension = ctx.config.pageExtensions.find((ext) => rule.glob.toLowerCase().endsWith(ext));
    if (!extension) continue;
    warnings.push(
      `the rule '${rule.glob}' (${rule.source}) can never match: rules apply to slugs, which have no ` +
        `extension. Write '${rule.glob.slice(0, -extension.length)}' instead.`,
    );
  }

  return {
    aknoPath: ctx.config.aknoPath,
    stateDir: ctx.config.stateDir,
    configSources: ctx.config.sources,
    writable: ctx.writable,
    lockHeldBy: ctx.lockHeldBy,
    readOnlyReason: ctx.readOnlyReason,
    vectorBackend: ctx.store.vectors.kind,
    counts,
    byRole,
    index: {
      openMs: round(openMs),
      lexicalMs: round(lexicalMs),
      vectorMs: vectorMs === null ? null : round(vectorMs),
    },
    models,
    providerApis,
    extraction,
    reserved,
    warnings,
  };
}

function capabilityLatency(checks: AnswerCapabilityProbe): number {
  return (Object.values(checks) as AnswerCapabilityCheck[]).reduce(
    (total, check) => total + (check.latencyMs ?? 0),
    0,
  );
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * **Has the build run since the source last changed?**
 *
 * Here because the failure it catches is invisible everywhere else. `serve-cmd.ts` imports
 * `@tenphi/akno-core`, whose `exports` point at `dist/index.js`, so the running service executes built
 * JavaScript — while `vitest` imports `./*.ts` directly. That combination lets a fix be committed, the
 * service restarted, the tests green, and the old code still serving: the suite proves the change is
 * right and says nothing about whether it is loaded. It happened, and the afternoon went into
 * suspecting the fix.
 *
 * **Measured against `tsconfig.tsbuildinfo`, not against the emitted `.js`.** Two earlier versions of
 * this got it wrong in opposite ways, and both would have been ignored inside a day:
 *
 * - against `dist/index.js`: `tsc --build` rewrites that file only when `index.ts` changes, so it read
 *   as stale immediately after a successful build.
 * - against each file's own output: TypeScript decides what to emit from content, not mtime, so a
 *   `touch` — or a `git checkout` restamping files — emits nothing and the warning stuck forever.
 *
 * `tsbuildinfo` is rewritten on every successful build run whether or not anything is emitted, which
 * is exactly the question here: *did the build run after I edited this?* Verified rather than assumed —
 * a touch-then-build leaves `dist/models/client.js` untouched and moves `tsconfig.tsbuildinfo`.
 *
 * mtime, not content: a cheap stat on a diagnostics path. A touched file with no real change warns
 * harmlessly, and one build clears it.
 */
function staleBuild(): string | null {
  // The package root, found by walking up to the `package.json` that declares this package.
  //
  // Not by looking for a `src/` or `dist/` segment in the path: this module runs from both — `dist`
  // under the service and the CLI, which is the whole point of the check, and `src` under `vitest` —
  // and as the *last* segment neither has a trailing separator to match on. That was the first
  // version, and it silently found nothing in the one place it matters, which is the same class of
  // mistake it exists to catch.
  const root = packageRoot(path.dirname(new URL(import.meta.url).pathname));
  if (!root) return null;
  const srcDir = path.join(root, 'src');
  if (!fs.existsSync(srcDir)) return null;
  if (!fs.existsSync(path.join(root, 'dist'))) {
    return '`packages/core/dist` has never been built — a host importing @tenphi/akno-core gets nothing. Run `akno redeploy`.';
  }

  let builtAt: number;
  try {
    builtAt = fs.statSync(path.join(root, 'tsconfig.tsbuildinfo')).mtimeMs;
  } catch {
    // No incremental record — a published package, or a build configured without one. Nothing
    // reliable to compare against, and a guess here is worse than silence.
    return null;
  }

  const stale = firstNewerThan(srcDir, srcDir, builtAt);
  if (!stale) return null;
  return (
    `\`${stale}\` has changed since the last build. The service runs the built JavaScript, so this ` +
    'change is not loaded however often it restarts — run `akno redeploy`.'
  );
}

/**
 * The first source file modified after `since`, relative to the package root, or null.
 *
 * Returns on the first hit: the message names one file to make the point, and walking the rest buys
 * nothing once the answer is "run the build".
 */
export function firstNewerThan(dir: string, srcRoot: string, since: number): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = firstNewerThan(full, srcRoot, since);
      if (found) return found;
      continue;
    }
    // Tests are not emitted, so editing one cannot leave the service behind.
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
    try {
      if (fs.statSync(full).mtimeMs > since) return path.join('src', path.relative(srcRoot, full));
    } catch {
      // A file that vanished between readdir and stat is not a stale build.
    }
  }
  return null;
}

/** Nearest ancestor directory holding a `package.json`, or null. */
function packageRoot(from: string): string | null {
  let dir = from;
  for (let up = 0; up < 8; up++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}
