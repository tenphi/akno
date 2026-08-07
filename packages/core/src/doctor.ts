import fs from 'node:fs';
import path from 'node:path';
import type { AknoContext } from './context.ts';
import { looksLikeLedger } from './reserved.ts';
import { extractionCapabilities } from './ingest/extract.ts';
import { readOnlyExplanation } from './open.ts';
import { ModelClient } from './models/client.ts';

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
    documentsExtracted: number;
    /** Extracted, but owned by no page — so nothing recall can return. */
    documentsUnsearchable: number;
    links: number;
    brokenLinks: number;
    excludedRules: number;
  };
  byClass: Record<string, number>;
  index: {
    /** Time to open the handle and run one point lookup. Not a model number. */
    openMs: number;
    lexicalMs: number;
    vectorMs: number | null;
  };
  models: RoleReport[];
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
    documents: count('SELECT count(*) AS c FROM documents'),
    documentsExtracted: count('SELECT count(*) AS c FROM documents WHERE text IS NOT NULL'),
    documentsUnsearchable: count(
      'SELECT count(*) AS c FROM documents WHERE text IS NOT NULL AND page_id IS NULL',
    ),
    links: count('SELECT count(*) AS c FROM links'),
    brokenLinks: count('SELECT count(*) AS c FROM links WHERE broken = 1'),
    excludedRules: ctx.config.rules.filter((rule) => rule.class === 'excluded').length,
  };

  const byClass: Record<string, number> = {};
  for (const row of db.prepare('SELECT class, count(*) AS c FROM pages GROUP BY class').all() as {
    class: string;
    c: number;
  }[]) {
    byClass[row.class] = row.c;
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
      const ping = await client.ping();
      report.latencyMs = Math.round(ping.latencyMs);
      if (!ping.ok) {
        report.available = false;
        report.error = ping.error ?? 'ping failed';
      }
    }
    models.push(report);
  }

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
        'nothing written in it, or a format with no extractor. They are still listed on their page.',
    );
  }
  if (counts.documentsUnsearchable > 0) {
    // Extracted, but with no page to hang a card on: recall returns page cards, so a
    // document nothing points at has nowhere to be returned. Say so, and say the fix.
    warnings.push(
      `${counts.documentsUnsearchable} attachments have text that recall cannot reach, because no page ` +
        'owns them. Embed one from a page with `![[filename]]`, or name it `<page>-<8 hex>.<ext>`.',
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
  if (counts.pages === 0) {
    warnings.push('the index is empty — run `akno index`.');
  }
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
    byClass,
    index: {
      openMs: round(openMs),
      lexicalMs: round(lexicalMs),
      vectorMs: vectorMs === null ? null : round(vectorMs),
    },
    models,
    extraction,
    reserved,
    warnings,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
