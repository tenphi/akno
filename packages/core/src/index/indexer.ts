import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoConfig } from '../config/schema.ts';
import { effectiveRule } from '../rules/compile.ts';
import { hashFile, mapWithConcurrency, scanTree, type ScannedFile } from '../kb/scan.ts';
import { ATTACHMENT_NAME, parsePage, resolveClass, type ParsedPage } from '../kb/page.ts';
import { withId } from '../kb/frontmatter.ts';
import { applyReferenceFence, chunkPage, embeddingText, type Chunk } from './chunk.ts';
import { derivePage, type DerivedFact } from './derive.ts';
import { eventId, factId, newPageId, sha256 } from '../store/ids.ts';
import type { Store } from '../store/db.ts';
import type { ModelClient } from '../models/client.ts';

export interface IndexOptions {
  /** Hash every file instead of trusting mtime+size. The correctness path (§6). */
  verify?: boolean;
  /** Skip the model-backed passes. Structure indexes in milliseconds without them. */
  structuralOnly?: boolean;
  /** Re-derive summaries and facts even where the body hash has not moved. */
  rederive?: boolean;
  /** Re-chunk and re-embed even where the content hash matches. */
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
  phase: 'scan' | 'hash' | 'pages' | 'embed' | 'derive' | 'documents' | 'done';
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
  eventsIndexed: number;
  factsDerived: number;
  excluded: number;
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
 * §6, §12. Reconciles the index against the knowledge base. Both directions are
 * first class: the user restructures everything on a Sunday afternoon and this
 * reconciles, without ever asking them to go through Akno.
 *
 * A restart does **not** re-index — it stats. Only files whose mtime or size
 * moved get hashed, so a full restart with nothing changed is a 1.2ms sweep.
 */
export class Indexer {
  readonly #config: AknoConfig;
  readonly #store: Store;
  readonly #models: { embedding: ModelClient; chat: ModelClient };

  constructor(config: AknoConfig, store: Store, models: { embedding: ModelClient; chat: ModelClient }) {
    this.#config = config;
    this.#store = store;
    this.#models = models;
  }

  async run(options: IndexOptions = {}): Promise<IndexReport> {
    const started = performance.now();
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
      eventsIndexed: 0,
      factsDerived: 0,
      excluded: 0,
      warnings: [],
      durationMs: 0,
    };
    const progress = options.onProgress ?? ((): void => {});

    progress({ phase: 'scan', done: 0, total: 0 });
    const scanned = await scanTree({
      root: this.#config.aknoPath,
      ignore: this.#config.ignore,
      pageExtensions: this.#config.pageExtensions,
      maxPageBytes: this.#config.maxPageBytes,
    });
    const files = options.only ? scanned.filter((file) => options.only!.includes(file.relPath)) : scanned;
    report.scanned = files.length;

    const known = this.knownFiles();

    // ── Stat fast path ─────────────────────────────────────────────────────
    // mtime is a fast path, not a correctness guarantee — sync clients and
    // restored backups can preserve it across a real content change. §6 puts the
    // full hash sweep on `--verify` and the periodic backstop, not every start.
    const changed: ScannedFile[] = [];
    for (const file of files) {
      const prior = known.get(file.relPath);
      const moved = !prior || prior.size !== file.size || prior.mtime_ns !== file.mtimeNs;
      if (options.verify || moved) changed.push(file);
      else {
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
      if (prior && prior.sha256 === file.sha256 && !options.reindexUnchanged) {
        this.touchFile(file);
        if (file.kind === 'page') report.pagesUnchanged++;
        return false;
      }
      return true;
    });

    // ── Deletions and renames ──────────────────────────────────────────────
    // Only a full pass can conclude a file is gone; a `--only` pass sees a
    // fraction of the tree by design.
    if (!options.only) {
      const present = new Set(files.map((file) => file.relPath));
      const vanished = [...known.values()].filter((row) => !present.has(row.rel_path));
      this.reconcileDeletions(vanished, needsIndex, report);
    }

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
    if (!options.only) this.resolveLinks();

    // ── Model-backed passes ────────────────────────────────────────────────
    // Scoped to the pages this pass touched when the caller named files. Without
    // that scope, a single `write` into a knowledge base with an embedding backlog
    // blocks on the *whole* backlog — 223 pages of model calls to save one line.
    // §8 says the indexer follows the write; it does not say it catches up on
    // everything else first.
    if (!options.structuralOnly) {
      const scoped = options.modelPaths ?? options.only;
      const scope = scoped ? this.#pageIdsFor(scoped) : null;
      await this.embedPending(report, progress, scope);
      await this.derivePending(report, progress, options.rederive ?? false, scope);
    }

    report.durationMs = performance.now() - started;
    progress({ phase: 'done', done: 1, total: 1 });
    return report;
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
   * §12. Rename `people/ada.md` to `people/ada-marlow.md` in a file manager
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

      this.#store.transaction(() => {
        if (row.page_id) {
          this.#store.vectors.removeForPage(row.page_id);
          this.deleteChunkRows(row.page_id);
          this.#store.db.prepare('DELETE FROM pages WHERE id = ?').run(row.page_id);
        } else {
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
    const resolved = resolveClass(page, { ...rule, glob: rule.glob }, this.#config.paths.observations);

    if (resolved.class === 'excluded') {
      // An excluded page must leave nothing behind, including from a pass that
      // ran before the rule existed.
      const existing = this.pageIdForPath(file.relPath);
      if (existing) this.removePage(existing);
      this.recordFile(file, null);
      report.excluded++;
      return;
    }

    const pageId = this.resolvePageId(page, file);
    const chunks = applyReferenceFence(
      chunkPage(page, {
        targetChars: this.#config.index.chunkTargetChars,
        maxChars: this.#config.index.chunkMaxChars,
        overlapChars: this.#config.index.chunkOverlapChars,
      }),
      page.referenceFenceLine,
    );

    // A `reference` page is evidence from top to bottom, fence or no fence.
    const effectiveChunks =
      resolved.class === 'reference'
        ? chunks.map((chunk) => ({ ...chunk, kind: 'reference' as const }))
        : chunks;

    this.#store.transaction(() => {
      this.upsertPage(pageId, page, resolved.class, file);
      this.replaceChunks(pageId, effectiveChunks);
      this.replaceEvents(pageId, page);
      this.replaceLinks(pageId, page);
      this.recordFile(file, pageId);
    });

    report.pagesIndexed++;
    report.chunksWritten += effectiveChunks.length;
    report.eventsIndexed += page.events.length;

    // The single write Akno ever makes into a page, and only when asked (§12).
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
      // indexing on the next sweep (§12).
      this.recordFile(
        { ...file, size: Number(stat.size), mtimeNs: String(stat.mtimeNs), sha256: sha256(updated) },
        pageId,
      );
    } catch (err) {
      report.warnings.push(`could not write id into ${file.relPath}: ${errorMessage(err)}`);
    }
  }

  private upsertPage(pageId: string, page: ParsedPage, pageClass: string, file: ScannedFile): void {
    const existing = this.#store.db.prepare('SELECT created_at FROM pages WHERE id = ?').get(pageId) as
      { created_at: string | null } | undefined;

    this.#store.db
      .prepare(
        `INSERT INTO pages(
           id, slug, rel_path, title, type, tags, class, frontmatter, body_hash,
           reference_fence_line, body_line, line_count, bytes, created_at, updated_at, indexed_at
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug, rel_path = excluded.rel_path, title = excluded.title,
           type = excluded.type, tags = excluded.tags, class = excluded.class,
           frontmatter = excluded.frontmatter, body_hash = excluded.body_hash,
           reference_fence_line = excluded.reference_fence_line, body_line = excluded.body_line,
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
        pageClass,
        JSON.stringify(page.frontmatter.data),
        page.bodyHash,
        page.referenceFenceLine,
        page.bodyLine,
        page.lines.length,
        file.size,
        existing?.created_at ?? nowIso(),
        mtimeIso(file.mtimeNs),
        nowIso(),
      );
  }

  private replaceChunks(pageId: string, chunks: Chunk[]): void {
    this.#store.vectors.removeForPage(pageId);
    this.deleteChunkRows(pageId);

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

  /** FTS5 external-content tables need explicit deletes; there are no triggers. */
  private deleteChunkRows(pageId: string): void {
    const rows = this.#store.db.prepare('SELECT id FROM chunks WHERE page_id = ?').all(pageId) as {
      id: number;
    }[];
    const deleteFts = this.#store.db.prepare('DELETE FROM chunks_fts WHERE rowid = ?');
    for (const row of rows) deleteFts.run(row.id);
    this.#store.db.prepare('DELETE FROM chunks WHERE page_id = ?').run(pageId);
  }

  private replaceEvents(pageId: string, page: ParsedPage): void {
    this.#store.db.prepare('DELETE FROM events WHERE source_page = ?').run(pageId);
    const insert = this.#store.db.prepare(
      `INSERT INTO events(id, date, summary, target_slug, source_slug, source_page, line)
       VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    );
    for (const event of page.events) {
      // Duplicates collapse on (date, target, summary), so an event that exists
      // both in the ledger and on its page counts once (§10).
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
    `);
  }

  private removePage(pageId: string): void {
    this.#store.transaction(() => {
      this.#store.vectors.removeForPage(pageId);
      this.deleteChunkRows(pageId);
      this.#store.db.prepare('DELETE FROM pages WHERE id = ?').run(pageId);
    });
  }

  // ─── Attachments ──────────────────────────────────────────────────────────

  /**
   * §11. Extraction, OCR and naming land with `ingest`. What this cut does is
   * *notice* attachments and attach them to their page, so a card can say "this
   * page has a 9-page PDF" and `doctor` can report how many are un-extracted.
   * Recording them now also means the write path inherits a populated table
   * rather than starting from an empty one.
   */
  private registerAttachment(file: ScannedFile, report: IndexReport): void {
    const pageId = this.attachmentOwner(file.relPath);
    const id = `doc_${(file.sha256 ?? file.relPath).slice(0, 12)}`;
    this.#store.transaction(() => {
      this.#store.db
        .prepare(
          `INSERT INTO documents(id, page_id, rel_path, mime, sha256, label, text, summary,
                                 page_count, ocr, bytes, indexed_at)
           VALUES(?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?)
           ON CONFLICT(rel_path) DO UPDATE SET
             page_id = excluded.page_id, sha256 = excluded.sha256,
             mime = excluded.mime, bytes = excluded.bytes, indexed_at = excluded.indexed_at`,
        )
        .run(id, pageId, file.relPath, guessMime(file.relPath), file.sha256 ?? '', file.size, nowIso());
      this.recordFile(file, null);
    });
    if (pageId) report.documentsLinked++;
  }

  /**
   * Two ways an attachment belongs to a page. The content-addressed shape
   * `<page-basename>-<8 hex>.<ext>` is the one Akno creates (§11). A plain
   * `passport.pdf` beside `passport.md` is the one people already have, and
   * refusing to recognise it would make the feature useless on an existing
   * knowledge base.
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
    return row?.id ?? null;
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
          kind: 'full',
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
    if (!this.#models.chat.available) return;
    if (scope && scope.size === 0) return;

    // §7: no eligibility list — every `full` page is a candidate. A `reference`
    // page is summarized but never fact-mined; `derivePage` enforces that by
    // reading only above the fence, and a fully-reference page has no mineable
    // region at all.
    const scopeClause = scope ? ` AND id IN (${[...scope].map(() => '?').join(',')})` : '';
    const pending = this.#store.db
      .prepare(
        `SELECT id, slug, rel_path, body_hash, class FROM pages
          WHERE class != 'excluded' AND (? = 1 OR derived_hash IS NULL OR derived_hash != body_hash)
          ${scopeClause}
          ORDER BY updated_at DESC`,
      )
      .all(force ? 1 : 0, ...(scope ?? [])) as {
      id: string;
      slug: string;
      rel_path: string;
      body_hash: string;
      class: string;
    }[];
    if (pending.length === 0) return;

    progress({ phase: 'derive', done: 0, total: pending.length });
    const concurrency = Math.max(1, this.#config.models.chat.concurrency ?? 2);
    let done = 0;

    await mapWithConcurrency(pending, concurrency, async (row) => {
      try {
        const content = await fsp.readFile(path.join(this.#config.aknoPath, row.rel_path), 'utf8');
        const page = parsePage(row.rel_path, content);
        const isReference = row.class === 'reference';
        const derived = await derivePage(page, this.#models.chat, {
          summaries: wantSummaries,
          // A reference page is evidence. Only claims become facts (§5).
          facts: wantFacts && !isReference,
        });

        if (derived.error) {
          report.warnings.push(`derivation for ${row.slug}: ${derived.error}`);
        } else {
          if (derived.partial) report.warnings.push(`derivation for ${row.slug}: ${derived.partial}`);
          this.#store.transaction(() => {
            this.#store.db
              .prepare('UPDATE pages SET summary = ?, keywords = ?, derived_hash = ? WHERE id = ?')
              .run(derived.summary, JSON.stringify(derived.keywords), row.body_hash, row.id);
            this.replaceFacts(row.id, derived.facts);
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
   * §7. Supersession is structural: a fact whose source line is gone or changed
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
   * Conflating the two invents history. §8 already notes that a fresh derivation
   * may phrase a claim differently, so retiring on id alone would make every
   * `--rederive` flood recall with "was X until today" for values that never
   * changed — and an invented historical claim is worse than none, because a
   * reader has no way to tell it apart from a real one.
   */
  private replaceFacts(pageId: string, facts: DerivedFact[]): void {
    const now = nowIso();
    const today = now.slice(0, 10);

    const existing = this.#store.db
      .prepare('SELECT id, source_line_hash FROM facts WHERE page_id = ?')
      .all(pageId) as { id: string; source_line_hash: string }[];
    const incomingIds = new Set(facts.map((fact) => factId(pageId, fact.sourceLineHash, fact.claim)));
    // The source lines this derivation could still see.
    const liveLineHashes = new Set(facts.map((fact) => fact.sourceLineHash));

    const insert = this.#store.db.prepare(
      `INSERT INTO facts(id, page_id, claim, subject, attribute, value, line_start, line_end,
                         source_line_hash, confidence, valid_from, valid_to, first_seen, last_seen)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         line_start = excluded.line_start, line_end = excluded.line_end,
         confidence = excluded.confidence, last_seen = excluded.last_seen, valid_to = NULL`,
    );

    for (const fact of facts) {
      insert.run(
        factId(pageId, fact.sourceLineHash, fact.claim),
        pageId,
        fact.claim,
        fact.subject,
        fact.attribute,
        fact.value,
        fact.line,
        fact.line,
        fact.sourceLineHash,
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
      if (liveLineHashes.has(row.source_line_hash)) drop.run(row.id);
      else retire.run(today, row.id);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isLedger(slug: string, config: AknoConfig): boolean {
  return slug === config.paths.timeline.replace(/\.(md|markdown)$/i, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function mtimeIso(mtimeNs: string): string {
  const ms = Number(BigInt(mtimeNs) / 1_000_000n);
  return new Date(ms).toISOString();
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
