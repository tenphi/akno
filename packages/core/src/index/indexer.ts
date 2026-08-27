import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoConfig } from '../config/schema.ts';
import { indexScanIgnore } from '../config/load.ts';
import { ledgerSlug } from '../reserved.ts';
import { extract, type Extraction } from '../ingest/extract.ts';
import { documentPart, documentRendition } from '../ingest/parts.ts';
import { looksLikeRendition, renditionBody, renditionPathFor, renditionWanted } from '../ingest/rendition.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { effectiveRule } from '../rules/compile.ts';
import { hashFile, mapWithConcurrency, scanTree, type ScannedFile } from '../kb/scan.ts';
import {
  ATTACHMENT_NAME,
  parsePage,
  resolvePagePolicy,
  type ParsedPage,
  type ResolvedPagePolicy,
} from '../kb/page.ts';
import { withId } from '../kb/frontmatter.ts';
import {
  applySourceFence,
  chunkDocument,
  chunkPage,
  embeddingText,
  type Chunk,
  type DocumentChunk,
} from './chunk.ts';
import { bodyItemIds, bodyLineHashes, derivePage, summarizeDocument, type DerivedFact } from './derive.ts';
import { eventId, factId, managedFactId, newPageId, sha256 } from '../store/ids.ts';
import type { Store } from '../store/db.ts';
import type { ModelClient } from '../models/client.ts';
import { rebuildEvidenceGraph } from './graph.ts';
import { resolveContextualEntityMentions } from './entity-resolution.ts';
import { IndexRevisionCoordinator, type IndexRevisionBarrier } from './revision-barrier.ts';

export interface IndexOptions {
  /** Hash every file instead of trusting mtime+size. The correctness path. */
  verify?: boolean;
  /** Skip the model-backed passes. Structure indexes in milliseconds without them. */
  structuralOnly?: boolean;
  /** Re-derive summaries and facts even where the body hash has not moved. */
  rederive?: boolean;
  /**
   * Re-examine the named paths even though nothing about them changed.
   *
   * The point is ownership, not content: after a page is written *for* an existing attachment,
   * the attachment's bytes are the same as ever, so the stat fast path skips it and nothing
   * re-resolves which page owns it. This forces that one question to be asked again.
   */
  reindexUnchanged?: boolean;
  onProgress?: (progress: IndexProgress) => void;
  /** Restrict the pass to these relative paths — what the watcher uses. */
  only?: string[];
  /**
   * Restrict the **model-backed** passes to these paths while still walking the
   * whole tree structurally.
   *
   * `undo`, `forget` and `move` all need a full walk, because only a full pass can
   * conclude a file is gone. But a full walk must not drag the entire embedding and
   * derivation backlog along with it: reversing a one-line change should not cost
   * 223 pages of model calls. Structure is ~10ms; model work is seconds per page,
   * and the two scopes are genuinely different questions.
   */
  modelPaths?: string[];
}

export interface IndexProgress {
  phase:
    | 'scan'
    | 'hash'
    | 'pages'
    | 'embed'
    | 'derive'
    | 'documents'
    | 'graph'
    | 'extract'
    | 'renditions'
    | 'summarize'
    | 'done';
  done: number;
  total: number;
  detail?: string;
}

export interface IndexReport {
  scanned: number;
  hashed: number;
  pagesIndexed: number;
  pagesUnchanged: number;
  pagesRemoved: number;
  pagesRenamed: number;
  chunksWritten: number;
  chunksEmbedded: number;
  pagesDerived: number;
  documentsLinked: number;
  /** Attachments whose text was read this pass — extraction happens on arrival, always. */
  documentsExtracted: number;
  /** Documents given a summary this pass — one per document, not one per file. */
  documentsSummarized: number;
  /** `<file>.txt` written beside a document this pass. Zero unless `ingest.text_rendition`. */
  renditionsWritten: number;
  eventsIndexed: number;
  factsDerived: number;
  graphNodes: number;
  graphEdges: number;
  graphEntities: number;
  graphMentions: number;
  graphAmbiguousMentions: number;
  graphUnresolvedMentions: number;
  graphContextualMentions: number;
  graphContextualResolved: number;
  graphContextualAbstained: number;
  graphContextualCached: number;
  graphContextualFailed: number;
  graphFacts: number;
  graphFactEdges: number;
  graphNonTraversableFacts: number;
  ignored: number;
  /** Non-fatal problems worth reporting rather than throwing. `doctor` prints these. */
  warnings: string[];
  durationMs: number;
}

interface FileRow {
  rel_path: string;
  size: number;
  mtime_ns: string;
  sha256: string;
  kind: string;
  page_id: string | null;
}

/**
 * Reconciles the index against the knowledge base. Both directions are
 * first class: the user restructures everything on a Sunday afternoon and this
 * reconciles, without ever asking them to go through Akno.
 *
 * A restart does **not** re-index — it stats. Only files whose mtime or size
 * moved get hashed, so a full restart with nothing changed is a 1.2ms sweep.
 */
export class Indexer {
  readonly #config: AknoConfig;
  readonly #store: Store;
  readonly #models: { embedding: ModelClient; derive: ModelClient };
  readonly #revision = new IndexRevisionCoordinator();

  constructor(config: AknoConfig, store: Store, models: { embedding: ModelClient; derive: ModelClient }) {
    this.#config = config;
    this.#store = store;
    this.#models = models;
  }

  async run(options: IndexOptions = {}): Promise<IndexReport> {
    return this.#revision.run(() => this.runPass(options));
  }

  /** Finish a caller-visible memory mutation even when a background dream owns a planner revision. */
  async runForeground(options: IndexOptions = {}): Promise<IndexReport> {
    return this.#revision.runForeground(() => this.runPass(options));
  }

  /** Notify a planner barrier about a foreground policy mutation that has no index pass. */
  invalidateRevisionBarrier(): boolean {
    return this.#revision.invalidateForForeground();
  }

  /** Hold one indexed revision while a full dream run constructs its complete planner wave. */
  acquireRevisionBarrier(): Promise<IndexRevisionBarrier> {
    return this.#revision.acquire();
  }

  private async runPass(options: IndexOptions): Promise<IndexReport> {
    const started = performance.now();
    // Per pass: the folder may have changed since the last one, and a stale listing would
    // decide a rendition against files that are no longer there.
    this.#entriesCache.clear();
    const report: IndexReport = {
      scanned: 0,
      hashed: 0,
      pagesIndexed: 0,
      pagesUnchanged: 0,
      pagesRemoved: 0,
      pagesRenamed: 0,
      chunksWritten: 0,
      chunksEmbedded: 0,
      pagesDerived: 0,
      documentsLinked: 0,
      documentsExtracted: 0,
      documentsSummarized: 0,
      renditionsWritten: 0,
      eventsIndexed: 0,
      factsDerived: 0,
      graphNodes: 0,
      graphEdges: 0,
      graphEntities: 0,
      graphMentions: 0,
      graphAmbiguousMentions: 0,
      graphUnresolvedMentions: 0,
      graphContextualMentions: 0,
      graphContextualResolved: 0,
      graphContextualAbstained: 0,
      graphContextualCached: 0,
      graphContextualFailed: 0,
      graphFacts: 0,
      graphFactEdges: 0,
      graphNonTraversableFacts: 0,
      ignored: 0,
      warnings: [],
      durationMs: 0,
    };
    const progress = options.onProgress ?? ((): void => {});

    progress({ phase: 'scan', done: 0, total: 0 });
    const scanned = await scanTree({
      root: this.#config.aknoPath,
      ignore: this.scanIgnore(),
      pageExtensions: this.#config.pageExtensions,
      maxPageBytes: this.#config.maxPageBytes,
    });
    const files = options.only ? scanned.filter((file) => options.only!.includes(file.relPath)) : scanned;
    report.scanned = files.length;

    const known = this.knownFiles();

    // ── Rule changes ───────────────────────────────────────────────────────
    // A rule edit is not a file edit. Without this, assigning `role: ignored` to a folder
    // and re-indexing reports "223 pages unchanged" and leaves those pages indexed,
    // searchable and asserted as facts — the config silently doing nothing, which is
    // exactly the failure Akno exists to avoid. A `--only` pass sees a fraction of the
    // tree and is not the place to conclude anything about the rest of it.
    const reclassified = options.only ? new Set<string>() : this.reclassify(report);
    if (!options.only) for (const relPath of this.pageFilesWithNoPage(report)) reclassified.add(relPath);

    // ── Stat fast path ─────────────────────────────────────────────────────
    // mtime is a fast path, not a correctness guarantee — sync clients and
    // restored backups can preserve it across a real content change. The
    // full hash sweep on `--verify` and the periodic backstop, not every start.
    const changed: ScannedFile[] = [];
    for (const file of files) {
      const prior = known.get(file.relPath);
      const moved = !prior || prior.size !== file.size || prior.mtime_ns !== file.mtimeNs;
      if (options.verify || moved || options.reindexUnchanged || reclassified.has(file.relPath)) {
        changed.push(file);
      } else {
        file.sha256 = prior.sha256;
        if (file.kind === 'page') report.pagesUnchanged++;
      }
    }

    progress({ phase: 'hash', done: 0, total: changed.length });
    let hashed = 0;
    await mapWithConcurrency(changed, this.#config.index.hashConcurrency, async (file) => {
      try {
        file.sha256 = await hashFile(file.absPath);
      } catch (err) {
        report.warnings.push(`could not hash ${file.relPath}: ${errorMessage(err)}`);
      }
      progress({ phase: 'hash', done: ++hashed, total: changed.length });
    });
    report.hashed = changed.filter((f) => f.sha256).length;

    // A hash that matches what we recorded means mtime lied — nothing to do.
    const needsIndex = changed.filter((file) => {
      if (!file.sha256) return false;
      const prior = known.get(file.relPath);
      if (
        prior &&
        prior.sha256 === file.sha256 &&
        !options.reindexUnchanged &&
        !reclassified.has(file.relPath)
      ) {
        this.touchFile(file);
        if (file.kind === 'page') report.pagesUnchanged++;
        return false;
      }
      return true;
    });

    // ── Deletions and renames ──────────────────────────────────────────────
    //
    // A full pass may conclude a file is gone about *any* file. A scoped pass may conclude it
    // about **the files it was handed**: the caller named those paths, and one that has a
    // record and is not on disk has genuinely vanished.
    //
    // That distinction is what lets a move keep its identity. The watcher sees a folder
    // renamed as a batch of departures and arrivals in one scoped pass, and refusing to look
    // at the departures split the pair across passes — by the time a full pass ran, the
    // arrival had already been indexed as a brand new page, and the vanished one could only
    // be deleted. Twenty-seven notes moved in Obsidian lost their ids that way, and with them
    // every fact, link and journal entry hanging off them.
    const present = new Set(files.map((file) => file.relPath));
    const inScope = options.only ? new Set(options.only) : null;
    const vanished = [...known.values()].filter(
      (row) => !present.has(row.rel_path) && (!inScope || inScope.has(row.rel_path)),
    );
    if (vanished.length > 0) this.reconcileDeletions(vanished, needsIndex, report);

    // A rendition policy that moved has to ask again about every document it already
    // declined, or lowering the threshold does nothing at all. Same problem as a rule
    // change, same shape of fix.
    this.reconsiderRenditions(report);
    if (!options.only) this.reconcileRenditionClaims(report);

    // ── Pages ──────────────────────────────────────────────────────────────
    const pageFiles = needsIndex.filter((file) => file.kind === 'page');
    progress({ phase: 'pages', done: 0, total: pageFiles.length });
    let pageIndex = 0;
    for (const file of pageFiles) {
      try {
        await this.indexPage(file, report);
      } catch (err) {
        report.warnings.push(`could not index ${file.relPath}: ${errorMessage(err)}`);
      }
      progress({ phase: 'pages', done: ++pageIndex, total: pageFiles.length, detail: file.relPath });
    }

    // ── Attachments ────────────────────────────────────────────────────────
    const attachments = needsIndex.filter((file) => file.kind === 'attachment');
    progress({ phase: 'documents', done: 0, total: attachments.length });
    for (const file of attachments) {
      this.registerAttachment(file, report);
    }

    // Broken-link resolution needs every page present, so it runs last.
    //
    // On a scoped pass too, which it did not used to be. A scoped pass is what every `write` runs,
    // so creating the page a link pointed at left that link marked broken until the next full index
    // — the file was right and the index disagreed with it, which is the one thing the index may
    // not do. It is a single UPDATE over a table with one row per link; scoping it would save
    // nothing worth the inconsistency.
    this.resolveLinks();

    // ── Model-backed passes ────────────────────────────────────────────────
    // Scoped to the pages this pass touched when the caller named files. Without
    // that scope, a single `write` into a knowledge base with an embedding backlog
    // blocks on the *whole* backlog — 223 pages of model calls to save one line.
    // The indexer follows the write; that does not mean it catches up on
    // everything else first.
    if (!options.structuralOnly) {
      const scoped = options.modelPaths ?? options.only;
      const scope = scoped ? this.#pageIdsFor(scoped) : null;
      // Before embedding, so the chunks it produces are embedded in the same pass rather
      // than sitting unsearchable until the next one.
      await this.extractPending(report, progress, options.only ?? null);
      // After extraction, so a document read this pass gets its text beside it in the same
      // pass, and before embedding, because a rendition produces nothing to embed.
      await this.writeRenditions(report, progress, options.only ?? null);
      await this.embedPending(report, progress, scope);
      await this.summarizeDocuments(report, progress);
      await this.derivePending(report, progress, options.rederive ?? false, scope);
    }

    // Graph rows are cheap, private derived state. Build after derivation so facts produced
    // by this pass become relationships immediately, while structural-only passes still
    // reconcile the complete graph from the facts already present.
    progress({ phase: 'graph', done: 0, total: 1 });
    const contextualModelId = this.#config.graph.contextualResolution.enabled
      ? this.#models.derive.modelId
      : null;
    let graph = rebuildEvidenceGraph(this.#store, {
      conflictModelId: this.#models.derive.modelId,
      contextualModelId,
    });
    if (!options.structuralOnly && this.#config.graph.contextualResolution.enabled) {
      const contextual = await resolveContextualEntityMentions(this.#store, this.#models.derive, {
        maxCandidates: this.#config.graph.contextualResolution.maxCandidates,
        maxMentions: this.#config.graph.contextualResolution.maxMentionsPerIndex,
        ...(this.#config.graph.contextualResolution.reasoningEffort
          ? { reasoningEffort: this.#config.graph.contextualResolution.reasoningEffort }
          : {}),
      });
      report.graphContextualResolved = contextual.resolved;
      report.graphContextualAbstained = contextual.abstained;
      report.graphContextualCached = contextual.cached;
      report.graphContextualFailed = contextual.failed;
      report.warnings.push(...contextual.warnings);
      // A new selected verdict becomes an edge only through the same complete graph rebuild as
      // exact evidence. Abstentions need no projection; they intentionally remain ambiguous.
      if (contextual.resolved > 0) {
        graph = rebuildEvidenceGraph(this.#store, {
          conflictModelId: this.#models.derive.modelId,
          contextualModelId,
        });
      }
    }
    report.graphNodes = graph.nodes;
    report.graphEdges = graph.edges;
    report.graphEntities = graph.entities;
    report.graphMentions = graph.mentions;
    report.graphAmbiguousMentions = graph.ambiguousMentions;
    report.graphUnresolvedMentions = graph.unresolvedMentions;
    report.graphContextualMentions = graph.contextualMentions;
    report.graphFacts = graph.facts;
    report.graphFactEdges = graph.factEdges;
    report.graphNonTraversableFacts = graph.nonTraversableFacts;
    progress({ phase: 'graph', done: 1, total: 1 });

    report.durationMs = performance.now() - started;
    progress({ phase: 'done', done: 1, total: 1 });
    return report;
  }

  /**
   * Pages whose policy may have moved because the *rules* moved, not because the file did.
   *
   * The resolved rules are fingerprinted in `meta`. While the fingerprint holds this is
   * one query that finds nothing; when it moves, every page is re-resolved and the ones
   * are handed back to be re-indexed. Their derivations are dropped in the same breath:
   * a page that just became `source` was fact-mined under the old
   * rule, and those facts assert claims the rules now say it never made.
   *
   * Re-indexing all pages on the rare rule change is deliberate: rules also supply
   * management and about metadata, so comparing only role would leave policy stale.
   */
  private reclassify(report: IndexReport): Set<string> {
    const fingerprint = sha256(JSON.stringify(this.#config.rules));
    if (this.#store.meta(RULES_FINGERPRINT) === fingerprint) return new Set();

    const rows = this.#store.db.prepare('SELECT id, rel_path FROM pages').all() as {
      id: string;
      rel_path: string;
    }[];

    const moved = new Set<string>();
    const clearDerived = this.#store.db.prepare('UPDATE pages SET derived_hash = NULL WHERE id = ?');
    for (const row of rows) {
      moved.add(row.rel_path);
      clearDerived.run(row.id);
    }

    // An ignored page has no `pages` row at all — that is what ignored means.
    // Walking only `pages` would therefore make exclusion a one-way door: deleting the
    // rule would leave the file recorded, unchanged on disk, and permanently invisible.
    const dropped = this.#store.db
      .prepare("SELECT rel_path FROM files WHERE kind = 'page' AND page_id IS NULL")
      .all() as { rel_path: string }[];
    for (const row of dropped) {
      const slug = row.rel_path.replace(/\.(md|markdown)$/i, '');
      if (this.policyFor(slug).role === 'ignored') continue;
      moved.add(row.rel_path);
    }

    if (moved.size > 0) {
      // Default to visible: a pass that quietly re-indexed a third of the knowledge
      // base because a rule changed should say so.
      report.warnings.push(
        `the rules changed since the last pass: ${moved.size} page policy/policies were re-indexed`,
      );
    }
    this.#store.setMeta(RULES_FINGERPRINT, fingerprint);
    return moved;
  }

  /**
   * Page files the index has a record of and no page for.
   *
   * The stat fast path asks `files` whether anything moved, so a file whose `files` row is
   * intact is never looked at again — and that is exactly the state a reorganization can
   * leave behind, with the `pages` row deleted underneath a `files` row that still points at
   * it. The file is on disk, the index says "unchanged", and recall cannot return it: the
   * folder and the index disagree, and the index is the one that must yield.
   *
   * `reclassify` looks for the same failure one shape over — `page_id IS NULL`, a file the
   * rules excluded — and misses this one, where the id is set and the page it names is gone.
   */
  private pageFilesWithNoPage(report: IndexReport): string[] {
    const rows = this.#store.db
      .prepare(
        `SELECT f.rel_path FROM files f
          WHERE f.kind = 'page'
            AND f.page_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.id = f.page_id)`,
      )
      .all() as { rel_path: string }[];

    if (rows.length > 0) {
      report.warnings.push(
        `${rows.length} page(s) were on disk with nothing indexed for them, and were re-read`,
      );
    }
    return rows.map((row) => row.rel_path);
  }

  /**
   * What the scan skips: the configured list, plus Akno's own files inside the knowledge
   * base.
   *
   * `akno.jsonc` is not memory — it is the rules that decide what memory *is*. It was
   * being registered as an attachment of the root, which is how a taxonomy ends up
   * described in `doctor` as a document whose contents could not be extracted.
   */
  private scanIgnore(): string[] {
    return indexScanIgnore(this.#config.ignore);
  }

  /** The policy current rules give a slug, ignoring page-local declarations. */
  private policyFor(slug: string): ResolvedPagePolicy {
    const rule = effectiveRule(slug, this.#config.rules);
    return resolvePagePolicy(
      { slug, declaredRole: null, declaredManagement: {}, about: [], aliases: [] },
      rule,
      this.#config.paths.observations,
    );
  }

  // ─── Files table ──────────────────────────────────────────────────────────

  private knownFiles(): Map<string, FileRow> {
    const rows = this.#store.db
      .prepare('SELECT rel_path, size, mtime_ns, sha256, kind, page_id FROM files')
      .all() as FileRow[];
    return new Map(rows.map((row) => [row.rel_path, row]));
  }

  private touchFile(file: ScannedFile): void {
    this.#store.db
      .prepare('UPDATE files SET mtime_ns = ?, size = ?, indexed_at = ? WHERE rel_path = ?')
      .run(file.mtimeNs, file.size, nowIso(), file.relPath);
  }

  private recordFile(file: ScannedFile, pageId: string | null): void {
    this.#store.db
      .prepare(
        `INSERT INTO files(rel_path, size, mtime_ns, sha256, kind, page_id, indexed_at)
         VALUES(?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(rel_path) DO UPDATE SET
           size = excluded.size, mtime_ns = excluded.mtime_ns, sha256 = excluded.sha256,
           kind = excluded.kind, page_id = excluded.page_id, indexed_at = excluded.indexed_at`,
      )
      .run(file.relPath, file.size, file.mtimeNs, file.sha256 ?? '', file.kind, pageId, nowIso());
  }

  // ─── Rename following ─────────────────────────────────────────────────────

  /**
   * Rename `people/ada.md` to `people/ada-marlow.md` in a file manager
   * and content hashing sees a delete plus a create. Facts, journal entries and
   * inbound links all point at a slug that no longer exists.
   *
   * In sidecar-identity mode the recovery is the body hash: a vanished file and a
   * new file with identical content are the same page, so the id — and every fact
   * and link hanging off it — survives the move. This is what `write_ids: false`
   * trades away when the database is deleted, and nothing else.
   */
  private reconcileDeletions(vanished: FileRow[], arriving: ScannedFile[], report: IndexReport): void {
    const arrivingByHash = new Map<string, ScannedFile>();
    for (const file of arriving) {
      if (file.sha256 && !arrivingByHash.has(file.sha256)) arrivingByHash.set(file.sha256, file);
    }

    for (const row of vanished) {
      const successor = arrivingByHash.get(row.sha256);
      if (successor && successor.kind === row.kind && row.page_id) {
        // Same bytes, new path: follow the id rather than retiring it.
        const slug = successor.relPath.replace(/\.(md|markdown)$/i, '');
        this.#store.transaction(() => {
          this.#store.db
            .prepare('UPDATE pages SET slug = ?, rel_path = ? WHERE id = ?')
            .run(slug, successor.relPath, row.page_id);
          this.#store.db.prepare('DELETE FROM files WHERE rel_path = ?').run(row.rel_path);
        });
        report.pagesRenamed++;
        // The successor still needs indexing for its links and events, but its
        // page row already exists under the right id.
        arrivingByHash.delete(row.sha256);
        continue;
      }

      // A missing attachment is not the same thing as an explicit forget. Its extracted
      // text may be the only surviving readable copy, so keep the document and its chunks
      // addressable while recording that the original can no longer be checked. A same-hash
      // successor is still handled as a move below by retiring this path and registering the
      // new one; preserving both would collide on the content-derived document id.
      if (row.kind === 'attachment' && !successor) {
        this.#store.transaction(() => {
          this.#store.db
            .prepare(
              `UPDATE documents
                  SET availability = 'missing', missing_since = COALESCE(missing_since, ?)
                WHERE rel_path = ?`,
            )
            .run(nowIso(), row.rel_path);
          this.#store.db.prepare('DELETE FROM files WHERE rel_path = ?').run(row.rel_path);
        });
        report.warnings.push(
          `${row.rel_path} is missing; retained indexed document evidence is now degraded`,
        );
        continue;
      }

      this.#store.transaction(() => {
        if (row.page_id) {
          // A page disappearing removes its own claims, not the evidence files that used
          // to hang beneath it. Detach document chunks before the page delete so the FK
          // cascade cannot erase a retained extraction when both files disappear together.
          this.deleteChunkRows(BODY_CHUNKS_FOR_PAGE, row.page_id);
          this.#store.db
            .prepare('UPDATE chunks SET page_id = NULL WHERE page_id = ? AND document_id IS NOT NULL')
            .run(row.page_id);
          this.#store.db.prepare('UPDATE documents SET page_id = NULL WHERE page_id = ?').run(row.page_id);
          this.#store.db.prepare('DELETE FROM pages WHERE id = ?').run(row.page_id);
        } else {
          const document = this.#store.db
            .prepare('SELECT id FROM documents WHERE rel_path = ?')
            .get(row.rel_path) as { id: string } | undefined;
          if (document) this.deleteChunkRows(CHUNKS_FOR_DOCUMENT, document.id);
          this.#store.db.prepare('DELETE FROM documents WHERE rel_path = ?').run(row.rel_path);
        }
        this.#store.db.prepare('DELETE FROM files WHERE rel_path = ?').run(row.rel_path);
      });
      if (row.kind === 'page') report.pagesRemoved++;
    }
  }

  // ─── One page ─────────────────────────────────────────────────────────────

  private async indexPage(file: ScannedFile, report: IndexReport): Promise<void> {
    if (file.dataless) {
      report.warnings.push(
        `${file.relPath} reads as a placeholder — a sync client has evicted it. Not indexed; ` +
          'download it or turn off storage optimization for this folder.',
      );
      return;
    }

    const content = await fsp.readFile(file.absPath, 'utf8');
    const page = parsePage(file.relPath, content);
    const rule = effectiveRule(page.slug, this.#config.rules);
    const resolved = resolvePagePolicy(page, { ...rule, glob: rule.glob }, this.#config.paths.observations);

    if (resolved.role === 'ignored') {
      // An ignored page must leave nothing behind, including from a pass that
      // ran before the rule existed.
      const existing = this.pageIdForPath(file.relPath);
      if (existing) this.removePage(existing);
      this.recordFile(file, null);
      report.ignored++;
      return;
    }

    const pageId = this.resolvePageId(page, file);
    const chunks = applySourceFence(
      chunkPage(page, {
        targetChars: this.#config.index.chunkTargetChars,
        maxChars: this.#config.index.chunkMaxChars,
        overlapChars: this.#config.index.chunkOverlapChars,
      }),
      page.sourceFenceLine,
    );

    // A `source` page is evidence from top to bottom, fence or no fence.
    const effectiveChunks =
      resolved.role === 'source' ? chunks.map((chunk) => ({ ...chunk, kind: 'source' as const })) : chunks;

    this.#store.transaction(() => {
      this.upsertPage(pageId, page, resolved, file);
      this.replaceChunks(pageId, effectiveChunks);
      this.replaceEvents(pageId, page);
      this.replaceLinks(pageId, page);
      this.recordFile(file, pageId);
    });

    report.pagesIndexed++;
    report.chunksWritten += effectiveChunks.length;
    report.eventsIndexed += page.events.length;

    // The single write Akno ever makes into a page, and only when asked.
    if (this.#config.writeIds && !page.frontmatterId) {
      await this.writeIdIntoPage(file, content, pageId, report);
    }
  }

  /**
   * Identity resolution, in order: a frontmatter `id` the user or a previous run
   * wrote; the sidecar row for this path; the sidecar row for these exact bytes
   * (a move the deletion pass did not catch, e.g. a copy); a fresh id.
   */
  private resolvePageId(page: ParsedPage, file: ScannedFile): string {
    if (page.frontmatterId) {
      const existing = this.#store.db.prepare('SELECT id FROM pages WHERE id = ?').get(page.frontmatterId) as
        { id: string } | undefined;
      if (existing) return existing.id;
      // A page carrying an id from another machine keeps it — that is the point
      // of writing one at all.
      return page.frontmatterId;
    }

    const byPath = this.pageIdForPath(file.relPath);
    if (byPath) return byPath;

    if (file.sha256) {
      const byHash = this.#store.db
        .prepare('SELECT page_id FROM files WHERE sha256 = ? AND kind = ? AND page_id IS NOT NULL LIMIT 1')
        .get(file.sha256, 'page') as { page_id: string } | undefined;
      if (byHash?.page_id) {
        const stillThere = this.#store.db
          .prepare('SELECT rel_path FROM pages WHERE id = ?')
          .get(byHash.page_id) as { rel_path: string } | undefined;
        // Only adopt the id if the original file is actually gone; otherwise this
        // is a genuine duplicate and both pages need their own identity.
        if (stillThere && !fileExists(path.join(this.#config.aknoPath, stillThere.rel_path))) {
          return byHash.page_id;
        }
      }
    }

    return newPageId();
  }

  private pageIdForPath(relPath: string): string | null {
    const row = this.#store.db.prepare('SELECT id FROM pages WHERE rel_path = ?').get(relPath) as
      { id: string } | undefined;
    return row?.id ?? null;
  }

  private async writeIdIntoPage(
    file: ScannedFile,
    content: string,
    pageId: string,
    report: IndexReport,
  ): Promise<void> {
    const updated = withId(content, pageId);
    if (updated === content) return;
    try {
      await fsp.writeFile(file.absPath, updated, 'utf8');
      const stat = await fsp.stat(file.absPath, { bigint: true });
      // Record the hash of our own write, so adding an `id` never re-triggers
      // indexing on the next sweep.
      this.recordFile(
        { ...file, size: Number(stat.size), mtimeNs: String(stat.mtimeNs), sha256: sha256(updated) },
        pageId,
      );
    } catch (err) {
      report.warnings.push(`could not write id into ${file.relPath}: ${errorMessage(err)}`);
    }
  }

  private upsertPage(pageId: string, page: ParsedPage, policy: ResolvedPagePolicy, file: ScannedFile): void {
    const existing = this.#store.db.prepare('SELECT created_at FROM pages WHERE id = ?').get(pageId) as
      { created_at: string | null } | undefined;

    this.#store.db
      .prepare(
        `INSERT INTO pages(
           id, slug, rel_path, title, type, tags, role, remember_management, dream_management,
           about, aliases, frontmatter, body_hash, source_fence_line, body_line, line_count,
           bytes, created_at, updated_at, indexed_at
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug, rel_path = excluded.rel_path, title = excluded.title,
           type = excluded.type, tags = excluded.tags, role = excluded.role,
           remember_management = excluded.remember_management,
           dream_management = excluded.dream_management,
           about = excluded.about, aliases = excluded.aliases,
           frontmatter = excluded.frontmatter, body_hash = excluded.body_hash,
           source_fence_line = excluded.source_fence_line, body_line = excluded.body_line,
           line_count = excluded.line_count, bytes = excluded.bytes,
           updated_at = excluded.updated_at, indexed_at = excluded.indexed_at`,
      )
      .run(
        pageId,
        page.slug,
        file.relPath,
        page.title,
        page.type,
        JSON.stringify(page.tags),
        policy.role,
        policy.remember,
        policy.dream,
        JSON.stringify(policy.about),
        JSON.stringify(page.aliases),
        JSON.stringify(page.frontmatter.data),
        page.bodyHash,
        page.sourceFenceLine,
        page.bodyLine,
        page.lines.length,
        file.size,
        existing?.created_at ?? nowIso(),
        mtimeIso(file.mtimeNs),
        nowIso(),
      );
  }

  private replaceChunks(pageId: string, chunks: Chunk[]): void {
    // Only the page's *body* chunks. Its documents' chunks come from the files beside it,
    // are invalidated by those files' hashes, and would otherwise be destroyed by
    // every edit to the page and rebuilt only on the next extraction pass.
    this.deleteChunkRows(BODY_CHUNKS_FOR_PAGE, pageId);

    const insert = this.#store.db.prepare(
      `INSERT INTO chunks(page_id, ord, kind, heading_path, text, line_start, line_end, embedded)
       VALUES(?, ?, ?, ?, ?, ?, ?, 0)`,
    );
    const insertFts = this.#store.db.prepare(
      'INSERT INTO chunks_fts(rowid, text, heading_path) VALUES(?, ?, ?)',
    );
    for (const chunk of chunks) {
      const result = insert.run(
        pageId,
        chunk.ord,
        chunk.kind,
        chunk.headingPath,
        chunk.text,
        chunk.lineStart,
        chunk.lineEnd,
      );
      insertFts.run(Number(result.lastInsertRowid), chunk.text, chunk.headingPath);
    }
  }

  /**
   * FTS5 external-content tables need explicit deletes; there are no triggers. Vectors are
   * removed per chunk id for the same reason a page's document chunks survive a page edit:
   * `removeForPage` cannot tell the two kinds apart.
   */
  private deleteChunkRows(select: string, parameter: string): void {
    const rows = this.#store.db.prepare(select).all(parameter) as { id: number }[];
    const deleteFts = this.#store.db.prepare('DELETE FROM chunks_fts WHERE rowid = ?');
    const deleteChunk = this.#store.db.prepare('DELETE FROM chunks WHERE id = ?');
    for (const row of rows) {
      deleteFts.run(row.id);
      this.#store.vectors.remove(row.id);
      deleteChunk.run(row.id);
    }
  }

  private replaceEvents(pageId: string, page: ParsedPage): void {
    this.#store.db.prepare('DELETE FROM events WHERE source_page = ?').run(pageId);
    const insert = this.#store.db.prepare(
      `INSERT INTO events(id, date, summary, target_slug, source_slug, source_page, line)
       VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    );
    for (const event of page.events) {
      // Duplicates collapse on (date, target, summary), so an event that exists
      // both in the ledger and on its page counts once.
      const target = event.targetSlug ?? (isLedger(page.slug, this.#config) ? null : page.slug);
      insert.run(
        eventId(event.date, target, event.summary),
        event.date,
        event.summary,
        target,
        page.slug,
        pageId,
        event.line,
      );
    }
  }

  private replaceLinks(pageId: string, page: ParsedPage): void {
    this.#store.db.prepare('DELETE FROM links WHERE from_page = ?').run(pageId);
    const insert = this.#store.db.prepare(
      'INSERT INTO links(from_page, to_slug, to_page, kind, line, broken) VALUES(?, ?, ?, ?, ?, ?)',
    );
    const findPage = this.#store.db.prepare('SELECT id FROM pages WHERE slug = ?');
    for (const link of page.links) {
      if (link.kind === 'embed') {
        // A file embed is not a page reference and can never be a broken one.
        insert.run(pageId, link.toSlug, null, 'embed', link.line, 0);
        continue;
      }
      const target = findPage.get(link.toSlug) as { id: string } | undefined;
      insert.run(pageId, link.toSlug, target?.id ?? null, link.kind, link.line, target ? 0 : 1);
    }
  }

  /**
   * A link written before its target existed is not broken. Re-resolving after
   * every page is present is the difference between a useful broken-link report
   * and one nobody reads.
   */
  private resolveLinks(): void {
    this.#store.db.exec(`
      UPDATE links SET
        to_page = (SELECT id FROM pages WHERE pages.slug = links.to_slug),
        broken  = CASE WHEN EXISTS (SELECT 1 FROM pages WHERE pages.slug = links.to_slug) THEN 0 ELSE 1 END
      WHERE kind != 'embed'
    `);
  }

  private removePage(pageId: string): void {
    this.#store.transaction(() => {
      this.deleteChunkRows(ALL_CHUNKS_FOR_PAGE, pageId);
      this.#store.db.prepare('DELETE FROM pages WHERE id = ?').run(pageId);
    });
  }

  // ─── Attachments ──────────────────────────────────────────────────────────

  /**
   * Extraction, OCR and naming land with `ingest`. What this cut does is
   * *notice* attachments and attach them to their page, so a card can say "this
   * page has a 9-page PDF" and `doctor` can report how many are un-extracted.
   * Recording them now also means the write path inherits a populated table
   * rather than starting from an empty one.
   */
  private registerAttachment(file: ScannedFile, report: IndexReport): void {
    const onDisk = (relPath: string): boolean => fs.existsSync(path.join(this.#config.aknoPath, relPath));

    // A rendition is asked about first, and it settles both questions at once: `contract.pdf.txt`
    // belongs to whatever group and page `contract.pdf` does. Asking the part rule first would
    // give it a group of its own and make it a second document — which is the entire thing this
    // column exists to prevent.
    let rendition = documentRendition(file.relPath, { entries: (dir) => this.entriesOf(dir) });
    if (!rendition) {
      // A restored rendition cannot rediscover its source through the directory while that
      // source is still missing. Its durable relationship is stronger evidence than today's
      // incomplete folder listing, so keep it until the original returns or is forgotten.
      const previous = this.#store.db
        .prepare(
          `SELECT rendition.renders
             FROM documents rendition
             JOIN documents source ON source.rel_path = rendition.renders
            WHERE rendition.rel_path = ? AND source.availability = 'missing'`,
        )
        .get(file.relPath) as { renders: string } | undefined;
      if (previous) rendition = { source: previous.renders };
    }
    const target = rendition?.source ?? file.relPath;

    // Parts of one document resolve ownership through the group, so `passport-2.pdf` lands
    // on the page that owns `passport.pdf` rather than nowhere at all.
    const group = documentPart(target, {
      // Asked of the disk rather than of `files`, so the answer does not depend on which of
      // the two parts this pass happened to reach first.
      hasPartOne: (groupKey) => onDisk(groupKey),
    });
    const pageId = this.attachmentOwner(group.groupKey) ?? this.attachmentOwner(target);
    const id = `doc_${(file.sha256 ?? file.relPath).slice(0, 12)}`;
    this.#store.transaction(() => {
      this.#store.db
        .prepare(
          `INSERT INTO documents(id, page_id, rel_path, mime, sha256, label, text, summary,
                                 page_count, ocr, bytes, indexed_at, group_key, part, renders,
                                 availability, missing_since, file_created_at, file_modified_at)
           VALUES(?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?, ?, ?, ?, 'available', NULL, ?, ?)
           ON CONFLICT(rel_path) DO UPDATE SET
             page_id = excluded.page_id, sha256 = excluded.sha256,
             mime = excluded.mime, bytes = excluded.bytes, indexed_at = excluded.indexed_at,
             group_key = excluded.group_key, part = excluded.part, renders = excluded.renders,
             availability = 'available', missing_since = NULL,
             file_created_at = COALESCE(documents.file_created_at, excluded.file_created_at),
             file_modified_at = excluded.file_modified_at`,
        )
        .run(
          id,
          pageId,
          file.relPath,
          guessMime(file.relPath),
          file.sha256 ?? '',
          file.size,
          nowIso(),
          group.groupKey,
          rendition ? 1 : group.part,
          rendition?.source ?? null,
          filesystemIso(file.birthtimeNs),
          filesystemIso(file.mtimeNs),
        );

      // Ownership can change without the file bytes changing: adding or removing an embed
      // changes the result container, but should not require extracting the document again.
      const stored = this.#store.db
        .prepare('SELECT id FROM documents WHERE rel_path = ?')
        .get(file.relPath) as { id: string } | undefined;
      if (stored) {
        this.#store.db.prepare('UPDATE chunks SET page_id = ? WHERE document_id = ?').run(pageId, stored.id);
      }

      // A file that has just *become* a rendition — someone's own `pdftotext` output, indexed
      // as a document of its own before the rule could recognise it — is still carrying its
      // own text and chunks, and those are the duplicate hits. Drop them: the words belong to
      // the file it renders and are indexed there.
      if (rendition) {
        const row = this.#store.db
          .prepare('SELECT id FROM documents WHERE rel_path = ?')
          .get(file.relPath) as { id: string } | undefined;
        if (row) {
          this.deleteChunkRows(CHUNKS_FOR_DOCUMENT, row.id);
          this.#store.db
            .prepare(
              `UPDATE documents SET text = NULL, summary = NULL, page_count = NULL, ocr = 0,
                                    extracted_sha = NULL, extract_via = NULL, confidence = NULL
                WHERE id = ?`,
            )
            .run(row.id);
        }
      }
      this.recordFile(file, null);
    });
    if (pageId) report.documentsLinked++;
  }

  /**
   * Filenames in one directory of the knowledge base, memoized for the pass.
   *
   * Recognising `contract.txt` as the text of `contract.pdf` is a question about the folder
   * rather than about the file, and it is asked once per attachment. Reading the directory
   * each time would turn a folder of 200 scans into 200 readdirs of the same folder.
   */
  #entriesCache = new Map<string, string[]>();

  private entriesOf(directory: string): string[] {
    const cached = this.#entriesCache.get(directory);
    if (cached) return cached;
    const absDir = directory === '.' ? this.#config.aknoPath : path.join(this.#config.aknoPath, directory);
    let entries: string[];
    try {
      entries = fs.readdirSync(absDir);
    } catch {
      entries = [];
    }
    this.#entriesCache.set(directory, entries);
    return entries;
  }

  /**
   * Two ways an attachment belongs to a page. The content-addressed shape
   * `<page-basename>-<8 hex>.<ext>` is the one Akno creates. A plain
   * `passport.pdf` beside `passport.md` is the one people already have, and
   * refusing to recognise it would make the feature useless on an existing
   * knowledge base.
   */
  /**
   * The page a file belongs to: by Akno's own `<page>-<8 hex>.<ext>` naming, by a matching
   * stem beside it, or because a page embeds it. Called with the group's part-one path
   * first, so every part of a multi-part document lands on one page.
   */
  private attachmentOwner(relPath: string): string | null {
    const dir = path.posix.dirname(relPath.replace(/\\/g, '/'));
    const base = path.posix.basename(relPath);
    const find = this.#store.db.prepare('SELECT id FROM pages WHERE slug = ?');

    const addressed = ATTACHMENT_NAME.exec(base);
    if (addressed) {
      const slug = dir === '.' ? addressed[1]! : `${dir}/${addressed[1]!}`;
      const row = find.get(slug) as { id: string } | undefined;
      if (row) return row.id;
    }

    const stem = base.replace(/\.[^.]+$/, '');
    const slug = dir === '.' ? stem : `${dir}/${stem}`;
    const row = find.get(slug) as { id: string } | undefined;
    if (row) return row.id;

    // A page that embeds the file says so itself, which beats any naming convention: this
    // is how `passport-2.pdf` belongs to `passport.md`, and it is what the author wrote.
    // Scoped to the same folder, because two people's pages can each embed a file called
    // `residence-permit-2.jpg` and they are not the same file.
    const embedded = this.#store.db
      .prepare(
        `SELECT p.id, p.rel_path FROM links l
           JOIN pages p ON p.id = l.from_page
          WHERE l.kind = 'embed' AND l.to_slug = ?`,
      )
      .all(base) as { id: string; rel_path: string }[];
    for (const candidate of embedded) {
      const candidateDir = path.posix.dirname(candidate.rel_path.replace(/\\/g, '/'));
      if (candidateDir === dir) return candidate.id;
    }
    return null;
  }

  // ─── Embedding ────────────────────────────────────────────────────────────

  /** Page ids for the given relative paths, for scoping a targeted pass. */
  #pageIdsFor(relPaths: string[]): Set<string> {
    const out = new Set<string>();
    if (relPaths.length === 0) return out;
    const find = this.#store.db.prepare('SELECT id FROM pages WHERE rel_path = ?');
    for (const relPath of relPaths) {
      const row = find.get(relPath) as { id: string } | undefined;
      if (row) out.add(row.id);
    }
    return out;
  }

  /**
   * **Extraction happens on arrival, always** — and this is what makes that true for
   * attachments Akno did not place itself: a PDF someone dropped into `documents/` by
   * hand, or one that predates Akno entirely. Their text is read, chunked, and indexed
   * against the document, so the file is searchable by its own content.
   *
   * The invalidation rule is the *file* hash, which is why `extracted_sha` exists:
   * re-extract when the bytes change, and never otherwise. Extraction is local — PDFKit,
   * Vision, `textutil` — so a backlog costs seconds, not model calls.
   *
   * A document with no page of its own is chunked with a NULL page id and returned as a
   * first-class document card. Organization improves the result, but is not a visibility gate.
   */
  private async extractPending(
    report: IndexReport,
    progress: (p: IndexProgress) => void,
    only: string[] | null,
  ): Promise<void> {
    const scopeClause = only ? ` AND d.rel_path IN (${only.map(() => '?').join(',')})` : '';
    const stale = this.#store.db
      .prepare(
        `SELECT DISTINCT d.group_key FROM documents d
          WHERE d.renders IS NULL
            AND d.availability = 'available'
            AND (
                  d.extracted_sha IS NULL
               OR d.extracted_sha != d.sha256
               -- Self-healing: a page removed and restored takes its document's chunks with
               -- it, and the file hash never moved to signal that they are missing.
               OR NOT EXISTS (SELECT 1 FROM chunks WHERE chunks.document_id = d.id)
                )
          ${scopeClause}`,
      )
      .all(...(only ?? [])) as { group_key: string }[];
    if (stale.length === 0) return;

    // Whole groups, in part order. One stale part shifts the page offsets of every part
    // after it, so a group is extracted together or not at all — otherwise a citation reads
    // "page 5" against a document that has since become six pages longer at the front.
    const partsOf = this.#store.db.prepare(
      `SELECT id, rel_path, sha256, page_id, part, page_count, availability FROM documents
        WHERE group_key = ? AND renders IS NULL ORDER BY part`,
    );
    const groups = stale.map((row) => partsOf.all(row.group_key) as DocumentPartRow[]);
    const total = groups.reduce((sum, parts) => sum + parts.length, 0);

    progress({ phase: 'extract', done: 0, total });
    let done = 0;

    for (const parts of groups) {
      let pageOffset = 0;
      for (const row of parts) {
        if (row.availability === 'missing') {
          // Preserve the established page numbering when another part changes while this
          // one is away. Re-extracting the later part at offset zero would make every stored
          // citation after the gap point at the wrong page.
          pageOffset += row.page_count ?? 0;
          progress({ phase: 'extract', done: ++done, total, detail: row.rel_path });
          continue;
        }
        const absPath = path.join(this.#config.aknoPath, row.rel_path);
        try {
          const extraction = await extract({
            absPath,
            maxOcrPages: this.#config.ingest.maxOcrPages,
            maxBytes: this.#config.ingest.maxFileBytes,
          });

          const offset = pageOffset;
          this.#store.transaction(() => {
            this.#store.db
              .prepare(
                `UPDATE documents
                    SET text = ?, page_count = ?, ocr = ?, extracted_sha = ?, page_offset = ?,
                        extract_via = ?, confidence = ?,
                        -- New text means the file beside it is stale. Cleared in the same
                        -- statement that changes the text, so the two cannot drift.
                        rendition_sha = NULL
                  WHERE id = ?`,
              )
              .run(
                extraction.text.length > 0 ? extraction.text : null,
                extraction.pageCount,
                extraction.ocr ? 1 : 0,
                // Recorded even when nothing could be read, so an unreadable file is not
                // re-OCR'd on every pass. A changed file gets another go.
                row.sha256,
                offset,
                extraction.via,
                extraction.confidence,
                row.id,
              );

            this.replaceDocumentChunks(
              row.id,
              row.page_id,
              chunkDocument(extraction, {
                targetChars: this.#config.index.chunkTargetChars,
                maxChars: this.#config.index.chunkMaxChars,
              }),
              offset,
            );
          });

          pageOffset += extraction.pageCount ?? 0;
          if (extraction.text.length > 0) report.documentsExtracted++;
          else if (extraction.note) report.warnings.push(`${row.rel_path}: ${extraction.note}`);
        } catch (err) {
          report.warnings.push(`could not extract ${row.rel_path}: ${errorMessage(err)}`);
        }
        progress({ phase: 'extract', done: ++done, total, detail: row.rel_path });
      }
    }
  }

  /**
   * The extracted text, written beside the file it came from.
   *
   * Invalidated by `rendition_sha`, never by whether the file happens to be there: a steady
   * state costs one indexed comparison per pass rather than a `stat` per document, and a
   * rendition the user deleted stays deleted, because the folder is theirs and deleting a
   * file in it is an instruction rather than damage to repair.
   *
   * A decline is recorded too — the same reason `extracted_sha` is written when nothing
   * could be read. Without that, every photograph in the knowledge base is reconsidered on
   * every pass forever to reach the same answer.
   */
  private async writeRenditions(
    report: IndexReport,
    progress: (p: IndexProgress) => void,
    only: string[] | null,
  ): Promise<void> {
    if (!this.#config.ingest.textRendition) return;

    // Qualified: this query joins `pages`, which has a `rel_path` of its own, and an
    // unqualified one is ambiguous. Only the watcher passes a scope, so an unqualified name
    // here fails on exactly the path a full index never takes.
    const scopeClause = only ? ` AND d.rel_path IN (${only.map(() => '?').join(',')})` : '';
    const pending = this.#store.db
      .prepare(
        `SELECT d.id, d.rel_path, d.sha256, d.text, d.page_count, d.ocr, d.extract_via, d.confidence,
                p.slug
           FROM documents d LEFT JOIN pages p ON p.id = d.page_id
          WHERE d.renders IS NULL
            AND d.availability = 'available'
            AND (d.rendition_sha IS NULL OR d.rendition_sha != d.sha256)
          ${scopeClause}`,
      )
      .all(...(only ?? [])) as {
      id: string;
      rel_path: string;
      sha256: string;
      text: string | null;
      page_count: number | null;
      ocr: number;
      extract_via: string | null;
      confidence: number | null;
      slug: string | null;
    }[];
    if (pending.length === 0) return;

    const decided = this.#store.db.prepare('UPDATE documents SET rendition_sha = ? WHERE id = ?');
    progress({ phase: 'renditions', done: 0, total: pending.length });
    let done = 0;

    for (const row of pending) {
      const source = {
        relPath: row.rel_path,
        text: row.text ?? '',
        pageCount: row.page_count,
        ocr: row.ocr === 1,
        // Null only where the text is null too — the two are cleared together whenever a
        // hash changes or a file turns out to be a rendition. So 'none' is not a fallback
        // for an unknown provenance; it is the provenance of a row with nothing extracted.
        via: (row.extract_via as Extraction['via'] | null) ?? 'none',
        confidence: row.confidence,
      };
      const gate = renditionWanted(source, {
        minChars: this.#config.ingest.textRenditionMinChars,
        ingestRule: effectiveRule(row.slug ?? row.rel_path, this.#config.rules).ingest,
      });

      if (gate.write) {
        const relPath = renditionPathFor(row.rel_path);
        try {
          // The name a rendition gets has to be one that reads back as *this* document's.
          // `scan.jpg` and `scan.pdf` in one folder both want `scan.txt`, and a file two
          // documents claim belongs to neither.
          const claims = documentRendition(relPath, { entries: (dir) => this.entriesOf(dir) });
          if (claims?.source !== row.rel_path) {
            report.warnings.push(
              `${relPath} would not read back as the text of ${row.rel_path}` +
                `${claims ? ` — that name belongs to ${claims.source}` : ', so it was not written'}`,
            );
            // Not recorded as decided. "This photo does not earn one" is an answer worth
            // keeping; "I could not work out a name for this" is a failure, and the folder it
            // failed against is one file away from making it answerable. Same reason a
            // summary is retried while an unreadable file is not.
            progress({ phase: 'renditions', done: ++done, total: pending.length, detail: row.rel_path });
            continue;
          }
          if (await this.renditionIsOurs(relPath)) {
            await writeFileAtomic(this.#config.aknoPath, relPath, renditionBody(source));
            report.renditionsWritten++;
          }
          // A `.txt` somebody wrote themselves already holds this document's text under this
          // document's name. That is the file, not a conflict — and overwriting the hand
          // corrections in it is the one thing not to do.
        } catch (err) {
          report.warnings.push(`could not write ${relPath}: ${errorMessage(err)}`);
          progress({ phase: 'renditions', done: ++done, total: pending.length, detail: row.rel_path });
          continue;
        }
      }
      decided.run(row.sha256, row.id);
      progress({ phase: 'renditions', done: ++done, total: pending.length, detail: row.rel_path });
    }
  }

  /**
   * Whether Akno may write this path: only if it is free, or holds something Akno
   * itself put there — which the file says in its own first line.
   *
   * Existing and being *recognised* as a rendition is not the same question. The scanner
   * recognises `contract.pdf.txt` by its name, and a person's own file can have that name.
   * Authorship has to be read from the contents or the check answers yes to everything.
   */
  private async renditionIsOurs(relPath: string): Promise<boolean> {
    const absPath = path.join(this.#config.aknoPath, relPath);
    const head = await fsp.readFile(absPath, 'utf8').catch(() => null);
    if (head === null) return true;
    return looksLikeRendition(head.slice(0, 200));
  }

  /**
   * Whether each document still is — or has become — a rendition of another.
   *
   * `registerAttachment` answers that question for files the pass looked at, and the stat
   * fast path means an unchanged file is never looked at again. So the answer would be
   * frozen at whatever was true when the file first arrived: a `contract.txt` indexed before
   * the rule could recognise it keeps its own chunks and goes on returning the contract's
   * every phrase a second time, and one whose PDF has since been deleted stays a rendition
   * of nothing. Neither file changed; what changed is what is around it.
   *
   * A query over `documents` rather than over the tree, so it costs one pass over a table
   * with one row per attachment and nothing per note.
   */
  private reconcileRenditionClaims(report: IndexReport): void {
    const rows = this.#store.db
      .prepare('SELECT id, rel_path, renders, availability FROM documents')
      .all() as {
      id: string;
      rel_path: string;
      renders: string | null;
      availability: 'available' | 'missing';
    }[];

    let changed = 0;
    for (const row of rows) {
      // Filesystem classification cannot rediscover a file that is not there. Keep its last
      // durable rendition relationship until the file returns or is explicitly forgotten.
      if (row.availability === 'missing') continue;
      if (row.renders) {
        const source = this.#store.db
          .prepare('SELECT availability FROM documents WHERE rel_path = ?')
          .get(row.renders) as { availability: 'available' | 'missing' } | undefined;
        if (source?.availability === 'missing') continue;
      }
      const verdict = documentRendition(row.rel_path, { entries: (dir) => this.entriesOf(dir) });
      const renders = verdict?.source ?? null;
      if (renders === row.renders) continue;

      this.#store.transaction(() => {
        this.#store.db.prepare('UPDATE documents SET renders = ? WHERE id = ?').run(renders, row.id);
        if (renders) {
          // Its words belong to the file it renders and are indexed there. Two copies is the
          // duplicate this whole distinction exists to remove.
          this.deleteChunkRows(CHUNKS_FOR_DOCUMENT, row.id);
          this.#store.db
            .prepare(
              `UPDATE documents SET text = NULL, summary = NULL, page_count = NULL, ocr = 0,
                                    extracted_sha = NULL, extract_via = NULL, confidence = NULL
                WHERE id = ?`,
            )
            .run(row.id);
        } else {
          // No longer renders anything — the file it copied is gone. It is a document again,
          // and `extractPending` reads it on the next pass because its hash is unrecorded.
          this.#store.db.prepare('UPDATE documents SET extracted_sha = NULL WHERE id = ?').run(row.id);
        }
      });
      changed++;
    }

    if (changed > 0) {
      report.warnings.push(
        `${changed} document(s) changed between being a document and being the text of one`,
      );
    }
  }

  /**
   * A rendition policy that moved has to ask again about every document it declined.
   *
   * Same problem `reclassify` solves for rules, and for the same reason: declines are
   * recorded so they are not recomputed, which means lowering the threshold would otherwise
   * change nothing until the files themselves changed.
   */
  private reconsiderRenditions(report: IndexReport): void {
    const fingerprint = sha256(
      JSON.stringify({
        enabled: this.#config.ingest.textRendition,
        minChars: this.#config.ingest.textRenditionMinChars,
        // Where the file goes is part of the policy, not an implementation detail: a
        // rendition already written under a different name is not the one that would be
        // written now. Derived from the naming itself so it cannot go stale.
        scheme: renditionPathFor('scheme.pdf'),
      }),
    );
    if (this.#store.meta(RENDITION_FINGERPRINT) === fingerprint) return;

    const first = this.#store.meta(RENDITION_FINGERPRINT) === null;
    const cleared = this.#store.db
      .prepare(
        'UPDATE documents SET rendition_sha = NULL WHERE renders IS NULL AND rendition_sha IS NOT NULL',
      )
      .run();
    this.#store.setMeta(RENDITION_FINGERPRINT, fingerprint);

    if (!first && cleared.changes > 0) {
      report.warnings.push(
        `the text rendition policy changed since the last pass: ${cleared.changes} document(s) were reconsidered`,
      );
    }
  }

  /**
   * A stored document has extracted text, a summary and embeddings of its own — one
   * summary per *document*, so a passport split into two files does not get two
   * half-summaries describing halves of one thing.
   *
   * Kept separate from extraction because the two are invalidated by different things:
   * extraction by the file's hash, a summary by not having one. A model that was down,
   * or that failed to answer in JSON, is retried on the next pass instead of waiting for the
   * bytes on disk to change.
   */
  private async summarizeDocuments(report: IndexReport, progress: (p: IndexProgress) => void): Promise<void> {
    if (!this.#models.derive.available) return;

    const groups = this.#store.db
      .prepare(
        `SELECT group_key FROM documents
          WHERE renders IS NULL
          GROUP BY group_key
          HAVING sum(CASE WHEN availability = 'missing' THEN 1 ELSE 0 END) = 0
             AND sum(CASE WHEN text IS NOT NULL AND summary IS NULL THEN 1 ELSE 0 END) > 0`,
      )
      .all() as { group_key: string }[];
    if (groups.length === 0) return;

    // Renditions excluded: one summary per document means the file holding a copy of the
    // text is not a second thing to describe, and joining its text in would summarize the
    // document twice over.
    const partsOf = this.#store.db.prepare(
      `SELECT id, text FROM documents
        WHERE group_key = ? AND renders IS NULL AND availability = 'available'
        ORDER BY part`,
    );
    const write = this.#store.db.prepare('UPDATE documents SET summary = ? WHERE id = ?');

    progress({ phase: 'summarize', done: 0, total: groups.length });
    let done = 0;

    for (const group of groups) {
      const parts = partsOf.all(group.group_key) as { id: string; text: string | null }[];
      const text = parts
        .map((part) => part.text)
        .filter((value): value is string => value !== null)
        .join('\n\n');
      if (text.length === 0) continue;

      const summarized = await summarizeDocument(text, this.#models.derive);
      if (summarized.summary) {
        this.#store.transaction(() => {
          for (const part of parts) write.run(summarized.summary, part.id);
        });
        report.documentsSummarized++;
      } else if (summarized.error) {
        report.warnings.push(`could not summarize ${group.group_key}: ${summarized.error}`);
      }
      progress({ phase: 'summarize', done: ++done, total: groups.length, detail: group.group_key });
    }
  }

  /**
   * A document's chunks are `source`: evidence, quoted in a capped
   * window, never mined for facts. A contract is not the household asserting its terms.
   */
  private replaceDocumentChunks(
    documentId: string,
    pageId: string | null,
    chunks: DocumentChunk[],
    pageOffset: number,
  ): void {
    this.deleteChunkRows(CHUNKS_FOR_DOCUMENT, documentId);

    const identity = this.#store.db
      .prepare('SELECT rel_path, label FROM documents WHERE id = ?')
      .get(documentId) as { rel_path: string; label: string | null } | undefined;
    const heading = identity ? [identity.label, identity.rel_path].filter(Boolean).join(' · ') : '';

    const insert = this.#store.db.prepare(
      `INSERT INTO chunks(page_id, document_id, doc_page, ord, kind, heading_path, text,
                          line_start, line_end, embedded)
       VALUES(?, ?, ?, ?, 'source', ?, ?, 0, 0, 0)`,
    );
    const insertFts = this.#store.db.prepare(
      'INSERT INTO chunks_fts(rowid, text, heading_path) VALUES(?, ?, ?)',
    );
    // An unreadable attachment still has a stable identity. A zero-text chunk makes an
    // exact filename lookup find that identity through `heading_path` without inventing
    // document content or allowing an empty body to match topical queries.
    const searchable = chunks.length > 0 ? chunks : [{ ord: 0, text: '', docPage: null }];
    for (const chunk of searchable) {
      // The page number within the *whole* document, not within this file: page 2 of
      // `passport-2.pdf` is page 5 of the passport, and that is the one a reader can find.
      const docPage = chunk.docPage === null ? null : chunk.docPage + pageOffset;
      const result = insert.run(pageId, documentId, docPage, chunk.ord, heading, chunk.text);
      insertFts.run(Number(result.lastInsertRowid), chunk.text, heading);
    }
  }

  private async embedPending(
    report: IndexReport,
    progress: (p: IndexProgress) => void,
    scope: Set<string> | null,
  ): Promise<void> {
    if (!this.#models.embedding.available) return;
    if (scope && scope.size === 0) return;

    const pending = (
      scope
        ? this.#store.db
            .prepare(
              `SELECT id, text, heading_path FROM chunks
                WHERE embedded = 0 AND page_id IN (${[...scope].map(() => '?').join(',')}) ORDER BY id`,
            )
            .all(...scope)
        : this.#store.db
            .prepare('SELECT id, text, heading_path FROM chunks WHERE embedded = 0 ORDER BY id')
            .all()
    ) as { id: number; text: string; heading_path: string }[];
    if (pending.length === 0) return;

    const batchSize = this.#config.models.embedding.batch ?? 32;
    progress({ phase: 'embed', done: 0, total: pending.length });

    const markEmbedded = this.#store.db.prepare('UPDATE chunks SET embedded = 1 WHERE id = ?');
    let done = 0;

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const texts = batch.map((chunk) =>
        embeddingText({
          ord: 0,
          kind: 'knowledge',
          headingPath: chunk.heading_path,
          text: chunk.text,
          lineStart: 0,
          lineEnd: 0,
        }),
      );

      const result = await this.#models.embedding.embed(texts);
      if (!result.ok || !result.value) {
        // A partial embed is honest and recoverable: `embedded = 0` rows are
        // picked up next pass, and recall reports `degraded` in the meantime.
        report.warnings.push(`embedding stopped after ${done} chunks: ${result.error ?? 'unknown error'}`);
        break;
      }

      this.#store.transaction(() => {
        for (let j = 0; j < batch.length; j++) {
          const vector = result.value![j];
          if (!vector) continue;
          this.#store.vectors.upsert(batch[j]!.id, vector);
          markEmbedded.run(batch[j]!.id);
        }
      });

      done += batch.length;
      report.chunksEmbedded += batch.length;
      progress({ phase: 'embed', done, total: pending.length });
    }
  }

  // ─── Derivation ───────────────────────────────────────────────────────────

  private async derivePending(
    report: IndexReport,
    progress: (p: IndexProgress) => void,
    force: boolean,
    scope: Set<string> | null,
  ): Promise<void> {
    const wantSummaries = this.#config.index.summaries;
    const wantFacts = this.#config.index.facts;
    if (!wantSummaries && !wantFacts) return;
    if (!this.#models.derive.available) return;
    if (scope && scope.size === 0) return;

    // Every indexed page may be summarized, but only canonical knowledge pages
    // assert facts. Source and inference pages remain retrievable evidence.
    const scopeClause = scope ? ` AND id IN (${[...scope].map(() => '?').join(',')})` : '';
    const pending = this.#store.db
      .prepare(
        `SELECT id, slug, rel_path, body_hash, role FROM pages
          WHERE role != 'ignored' AND (? = 1 OR derived_hash IS NULL OR derived_hash != body_hash)
          ${scopeClause}
          ORDER BY updated_at DESC`,
      )
      .all(force ? 1 : 0, ...(scope ?? [])) as {
      id: string;
      slug: string;
      rel_path: string;
      body_hash: string;
      role: string;
    }[];
    if (pending.length === 0) return;

    progress({ phase: 'derive', done: 0, total: pending.length });
    const concurrency = Math.max(1, this.#config.models.derive.concurrency ?? 2);
    let done = 0;

    await mapWithConcurrency(pending, concurrency, async (row) => {
      try {
        const content = await fsp.readFile(path.join(this.#config.aknoPath, row.rel_path), 'utf8');
        const page = parsePage(row.rel_path, content);
        const wantedFacts = wantFacts && row.role === 'knowledge';
        const derived = await derivePage(page, this.#models.derive, {
          summaries: wantSummaries,
          facts: wantedFacts,
        });

        if (derived.error) {
          report.warnings.push(`derivation for ${row.slug}: ${derived.error}`);
        } else if (derived.partial && wantedFacts) {
          // **The facts half failed. Keep the summary, and touch nothing else.**
          //
          // This used to fall through to the branch below, which meant a transient failure —
          // one 400, one unparseable answer — did two permanent things. `replaceFacts` with an
          // empty list *deleted* every fact on the page, because a fact whose source line is
          // still present and which the derivation did not repeat is a rephrasing, not a
          // supersession, and rephrasings are deleted. Then `derived_hash` was stamped, so the
          // page read as derived and was never offered to another pass. One flaky call, and a
          // page's facts were gone with no superseded rows to show they had ever existed.
          //
          // Observed here on 2026-08-17: `people/ada-marlow`, `timeline` and
          // `shopping/zephyr-qx-100` lost every fact to a token-parameter race that a
          // retry would have fixed, and nothing would ever have retried them.
          //
          // So the hash stays unstamped and the page comes back next pass, exactly as an outright
          // `error` already does. The cost is honest and bounded: a page whose full derivation
          // genuinely cannot succeed is re-attempted once per index pass, and its summary is
          // rewritten each time. That is the same bill the `error` branch above already accepts,
          // and it buys the difference between a stale fact and a deleted one.
          report.warnings.push(`derivation for ${row.slug}: ${derived.partial}`);
          this.#store.db
            .prepare('UPDATE pages SET summary = ?, keywords = ? WHERE id = ?')
            .run(derived.summary, JSON.stringify(derived.keywords), row.id);
        } else {
          // A `partial` still reaches here when facts were never wanted — a `source` page asks for
          // a summary alone, so there is nothing held back and nothing to protect.
          if (derived.partial) report.warnings.push(`derivation for ${row.slug}: ${derived.partial}`);
          this.#store.transaction(() => {
            this.#store.db
              .prepare('UPDATE pages SET summary = ?, keywords = ?, derived_hash = ? WHERE id = ?')
              .run(derived.summary, JSON.stringify(derived.keywords), row.body_hash, row.id);
            this.replaceFacts(row.id, derived.facts, bodyLineHashes(page), bodyItemIds(page));
          });
          report.pagesDerived++;
          report.factsDerived += derived.facts.length;
        }
      } catch (err) {
        report.warnings.push(`derivation for ${row.slug} failed: ${errorMessage(err)}`);
      }
      progress({ phase: 'derive', done: ++done, total: pending.length, detail: row.slug });
    });
  }

  /**
   * Supersession is structural: a fact whose source line is gone or changed
   * gets `valid_to` set rather than being deleted, so recall can return it *as
   * superseded* — "was €28 until June" — instead of as a second competing current
   * answer.
   *
   * The distinction that matters is **why** a fact disappeared:
   *
   * - Its source line changed or went away → a real supersession. Retire it.
   * - Its source line is byte-identical and the deriver merely phrased the claim
   *   differently → not a supersession at all. Delete it.
   *
   * Conflating the two invents history. A fresh derivation
   * may phrase a claim differently, so retiring on id alone would make every
   * `--rederive` flood recall with "was X until today" for values that never
   * changed — and an invented historical claim is worse than none, because a
   * reader has no way to tell it apart from a real one.
   *
   * `presentLines` therefore comes from **the page**, not from the incoming facts. Read
   * from the facts, an empty derivation looks like every source line vanishing at once, so
   * a page that merely became `source` — or one where a small model returned no facts
   * this time — retired its whole history as superseded on lines nobody had touched.
   */
  private replaceFacts(
    pageId: string,
    facts: DerivedFact[],
    presentLines: Set<string>,
    presentItems: Set<string>,
  ): void {
    const now = nowIso();
    const today = now.slice(0, 10);

    const existing = this.#store.db
      .prepare('SELECT id, source_line_hash, item_id FROM facts WHERE page_id = ?')
      .all(pageId) as { id: string; source_line_hash: string; item_id: string | null }[];
    const idFor = (fact: DerivedFact): string =>
      fact.itemId ? managedFactId(fact.itemId) : factId(pageId, fact.sourceLineHash, fact.claim);
    const incomingIds = new Set(facts.map(idFor));

    const insert = this.#store.db.prepare(
      `INSERT INTO facts(id, page_id, claim, subject, attribute, value, line_start, line_end,
                         source_line_hash, item_id, confidence, valid_from, valid_to, first_seen, last_seen)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         page_id = excluded.page_id, claim = excluded.claim, subject = excluded.subject,
         attribute = excluded.attribute, value = excluded.value,
         line_start = excluded.line_start, line_end = excluded.line_end,
         source_line_hash = excluded.source_line_hash, item_id = excluded.item_id,
         confidence = excluded.confidence, last_seen = excluded.last_seen, valid_to = NULL`,
    );

    for (const fact of facts) {
      insert.run(
        idFor(fact),
        pageId,
        fact.claim,
        fact.subject,
        fact.attribute,
        fact.value,
        fact.line,
        fact.line,
        fact.sourceLineHash,
        fact.itemId,
        fact.confidence,
        today,
        now,
        now,
      );
    }

    const retire = this.#store.db.prepare('UPDATE facts SET valid_to = ? WHERE id = ? AND valid_to IS NULL');
    const drop = this.#store.db.prepare('DELETE FROM facts WHERE id = ?');
    for (const row of existing) {
      if (incomingIds.has(row.id)) continue;
      if ((row.item_id && presentItems.has(row.item_id)) || presentLines.has(row.source_line_hash))
        drop.run(row.id);
      else retire.run(today, row.id);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isLedger(slug: string, config: AknoConfig): boolean {
  return slug === ledgerSlug(config);
}

function nowIso(): string {
  return new Date().toISOString();
}

function mtimeIso(mtimeNs: string): string {
  const ms = Number(BigInt(mtimeNs) / 1_000_000n);
  return new Date(ms).toISOString();
}

function filesystemIso(nanoseconds: string): string | null {
  const value = BigInt(nanoseconds);
  if (value <= 0n) return null;
  return mtimeIso(nanoseconds);
}

function fileExists(absPath: string): boolean {
  return fs.existsSync(absPath);
}

function guessMime(relPath: string): string | null {
  const extension = path.extname(relPath).toLowerCase();
  const table: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.heic': 'image/heic',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.eml': 'message/rfc822',
    '.html': 'text/html',
  };
  return table[extension] ?? null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `meta` key holding the fingerprint of the rules the index was last built under. */
const RULES_FINGERPRINT = 'rules_fingerprint';

/** The same, for the settings that decide which documents get a `.txt` beside them. */
const RENDITION_FINGERPRINT = 'rendition_fingerprint';

interface DocumentPartRow {
  id: string;
  rel_path: string;
  sha256: string;
  page_id: string | null;
  part: number;
  page_count: number | null;
  availability: 'available' | 'missing';
}

const ALL_CHUNKS_FOR_PAGE = 'SELECT id FROM chunks WHERE page_id = ?';
const BODY_CHUNKS_FOR_PAGE = 'SELECT id FROM chunks WHERE page_id = ? AND document_id IS NULL';
const CHUNKS_FOR_DOCUMENT = 'SELECT id FROM chunks WHERE document_id = ?';
