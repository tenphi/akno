import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { effectiveRule } from '../rules/compile.ts';
import { cleanSlug } from '../ingest/name.ts';
import type { Extraction } from '../ingest/extract.ts';
import { provenanceLines } from '../ingest/store.ts';
import { sha256 } from '../store/ids.ts';

/**
 * A page for a document that has none, written beside the file.
 *
 * An attachment nobody's page points at is already returned as a standalone document card.
 * Adoption gives that evidence a durable, browsable home with page policy and links.
 *
 * The filing operation is the one `ingest` already applies to every arrival: give it a page that says what
 * it is and embeds it. An orphan is simply an arrival nobody ran `ingest` on, so it gets the
 * same shape of page, from the summary the extraction pass already produced — no model call of
 * its own, and no inference beyond what the document says about itself.
 *
 * Three limits, because this writes files into somebody's notes:
 *
 * - **`ingest: "file"` is honoured.** That rule exists precisely for a folder of media where a
 *   stub page per file would be noise rather than memory, and this is the behaviour it turns
 *   off. `ingest: "ignore"` is skipped too.
 * - **Capped per run.** A folder of 500 unowned PDFs should not become 500 pages overnight
 *   before anyone has seen the first one; the cap makes the first night's report arrive while
 *   it is still small enough to read — and `--dry-run` shows it without writing.
 * - **The file is never touched.** Only the inbox moves files, ever. Nothing
 *   here renames, moves, or rewrites a byte of the document.
 */

export interface AdoptedDocument {
  slug: string;
  /** The files the page now owns — parts of one document share a page. */
  files: string[];
  action: 'planned' | 'created' | 'skipped' | 'blocked' | 'rejected';
  reason?: string;
}

export interface AdoptionDraft {
  slug: string;
  relPath: string;
  inputHash: string;
  after: string;
  /** Persist the exact proposal, but do not decide or apply it until this condition is resolved. */
  blockedReason?: string;
  documents: {
    id: string;
    relPath: string;
    sha256: string;
    metadataHash: string;
    groupKey: string;
  }[];
}

export interface AdoptionSnapshot {
  indexRevision: string;
  knowledgeBaseFingerprint: string;
  configurationFingerprint: string;
}

interface OrphanGroup {
  groupKey: string;
  parts: {
    id: string;
    relPath: string;
    sha256: string;
    summary: string | null;
    ocr: number;
    pageCount: number | null;
    extractVia: string | null;
    confidence: number | null;
  }[];
}

/**
 * Seal exact page creations without touching the knowledge base.
 *
 * The document hashes become item inputs and the run-start manifest is retained as plan evidence.
 * Apply rechecks both the source files and their orphaned index rows, so a page is never created
 * from a stale summary or for a document somebody filed while the plan was waiting.
 */
export async function planOrphanAdoptions(
  ctx: AknoContext,
  options: { limit: number; documentId?: string },
): Promise<{ adopted: AdoptedDocument[]; drafts: AdoptionDraft[] }> {
  const adopted: AdoptedDocument[] = [];
  const drafts: AdoptionDraft[] = [];

  for (const group of orphanGroups(ctx, options.documentId)) {
    if (drafts.length >= options.limit) break;

    const first = group.parts[0]!;
    const directory = path.posix.dirname(first.relPath.replaceAll('\\', '/'));
    const stem = cleanSlug(path.posix.basename(first.relPath));
    if (!stem) {
      adopted.push({
        slug: first.relPath,
        files: group.parts.map((part) => part.relPath),
        action: 'skipped',
        reason: 'no usable page name could be made from the filename',
      });
      continue;
    }

    const slug = directory === '.' ? stem : `${directory}/${stem}`;

    // The rule governs the *page's* location, which is where it would live.
    const rule = effectiveRule(slug, ctx.config.rules);
    if (rule.ingest === 'file' || rule.ingest === 'ignore') {
      adopted.push({
        slug,
        files: group.parts.map((part) => part.relPath),
        action: 'skipped',
        reason: `the rule for this folder says ingest: ${rule.ingest}`,
      });
      continue;
    }

    const relPath = `${slug}.md`;
    const absPath = path.join(ctx.config.aknoPath, relPath);
    const taken =
      (await fsp.stat(absPath).catch(() => null)) !== null ||
      ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug) !== undefined;

    const documents = group.parts.map((part) => ({
      id: part.id,
      relPath: part.relPath,
      sha256: part.sha256,
      metadataHash: sha256(
        JSON.stringify([part.summary, part.ocr, part.pageCount, part.extractVia, part.confidence]),
      ),
      groupKey: group.groupKey,
    }));
    const inputHash = sha256(
      JSON.stringify({
        documents: documents.map((document) => [
          document.id,
          document.relPath,
          document.sha256,
          document.metadataHash,
          document.groupKey,
        ]),
      }),
    );
    const draft: AdoptionDraft = {
      slug,
      relPath,
      inputHash,
      after: composeDocumentPage(group),
      ...(taken
        ? {
            blockedReason:
              'a page already exists at that path — add the document embed to it or move that page before retrying',
          }
        : {}),
      documents,
    };
    if (taken) {
      // Sealing the collision makes it visible and resolvable without inventing a suffixed near-duplicate.
      // The source remains orphaned and recallable; removing the collision lets this exact item be approved.
      adopted.push({
        slug,
        files: group.parts.map((part) => part.relPath),
        action: 'blocked',
        reason: draft.blockedReason,
      });
      drafts.push(draft);
      continue;
    }
    const rejectedBy = matchingRejectedItem(ctx, draft);
    adopted.push({
      slug,
      files: group.parts.map((part) => part.relPath),
      action: rejectedBy ? 'rejected' : 'planned',
      ...(rejectedBy ? { reason: `the unchanged filing page was previously rejected as ${rejectedBy}` } : {}),
    });
    if (!rejectedBy) drafts.push(draft);
  }

  return { adopted, drafts };
}

/** A rejected exact item is a durable decision; do not ask again until its inputs change. */
function matchingRejectedItem(ctx: AknoContext, draft: AdoptionDraft): string | null {
  const available = ctx.store.db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'maintenance_items'")
    .get();
  if (!available) return null;
  const rows = ctx.store.db
    .prepare(
      `SELECT id, operations FROM maintenance_items
        WHERE kind = 'adopt' AND status = 'rejected' AND subject = ? AND input_hash = ?
        ORDER BY rowid DESC`,
    )
    .all(draft.slug, draft.inputHash) as { id: string; operations: string }[];
  const afterHash = sha256(draft.after);
  for (const row of rows) {
    try {
      const operations = JSON.parse(row.operations) as unknown;
      if (
        Array.isArray(operations) &&
        operations.length === 1 &&
        typeof operations[0] === 'object' &&
        operations[0] !== null &&
        'type' in operations[0] &&
        operations[0].type === 'create' &&
        'relPath' in operations[0] &&
        operations[0].relPath === draft.relPath &&
        'afterHash' in operations[0] &&
        operations[0].afterHash === afterHash
      ) {
        return row.id;
      }
    } catch {
      // A malformed old private payload is not evidence of a rejection.
    }
  }
  return null;
}

/**
 * Unowned documents with text, grouped so parts of one document get one page — the whole point
 * of grouping parts at all, and the difference between one passport page and thirteen.
 *
 * Documents with no readable text are left out: a page whose body is a filename helps nobody,
 * and `doctor` already reports them as unreadable.
 */
function orphanGroups(ctx: AknoContext, documentId?: string): OrphanGroup[] {
  const selected = documentId
    ? (ctx.store.db
        .prepare('SELECT COALESCE(group_key, rel_path) AS group_key FROM documents WHERE id = ?')
        .get(documentId) as { group_key: string } | undefined)
    : undefined;
  if (documentId && !selected) return [];
  const rows = (
    selected
      ? ctx.store.db
          .prepare(
            `SELECT id, rel_path, sha256, group_key, summary, ocr, page_count, extract_via, confidence
               FROM documents
              WHERE page_id IS NULL AND text IS NOT NULL AND COALESCE(group_key, rel_path) = ?
              ORDER BY group_key, part`,
          )
          .all(selected.group_key)
      : ctx.store.db
          .prepare(
            `SELECT id, rel_path, sha256, group_key, summary, ocr, page_count, extract_via, confidence
               FROM documents
              WHERE page_id IS NULL AND text IS NOT NULL
              ORDER BY group_key, part`,
          )
          .all()
  ) as {
    id: string;
    rel_path: string;
    sha256: string;
    group_key: string | null;
    summary: string | null;
    ocr: number;
    page_count: number | null;
    extract_via: string | null;
    confidence: number | null;
  }[];

  const groups = new Map<string, OrphanGroup>();
  for (const row of rows) {
    const key = row.group_key ?? row.rel_path;
    const part = {
      id: row.id,
      relPath: row.rel_path,
      sha256: row.sha256,
      summary: row.summary,
      ocr: row.ocr,
      pageCount: row.page_count,
      extractVia: row.extract_via,
      confidence: row.confidence,
    };
    const existing = groups.get(key);
    if (existing) existing.parts.push(part);
    else groups.set(key, { groupKey: key, parts: [part] });
  }
  return [...groups.values()];
}

/**
 * The same shape `ingest` writes: what the document is, then a pointer to it. Nothing is
 * inferred here that the document does not say about itself, and the file's own text stays
 * indexed against the document rather than copied into the page.
 */
function composeDocumentPage(group: OrphanGroup): string {
  const first = group.parts[0]!;
  const title = titleFrom(first.relPath);
  const summary = group.parts.find((part) => part.summary)?.summary;

  const embeds = group.parts
    .map((part) => {
      // `via` is read, never reconstructed from the `ocr` flag. The flag cannot express the
      // one case this line exists for: an image a model *described* rather than read, which
      // would otherwise be adopted into a page claiming OCR had found the words.
      const provenance = provenanceLines({
        text: '',
        pageCount: part.pageCount,
        ocr: part.ocr === 1,
        confidence: part.confidence,
        via: (part.extractVia as Extraction['via'] | null) ?? 'none',
        note: null,
      });
      const name = path.posix.basename(part.relPath.replaceAll('\\', '/'));
      return provenance.length > 0 ? `![[${name}]]\n\n${provenance.join('\n')}` : `![[${name}]]`;
    })
    .join('\n\n');

  return (
    `---\ntitle: ${title}\n---\n\n` +
    `# ${title}\n\n` +
    (summary ? `${summary}\n\n` : `A document stored here. Its text is indexed and searchable.\n\n`) +
    `${embeds}\n`
  );
}

/** `Rental Agreement Aug 5 2031.pdf` → `Rental Agreement Aug 5 2031`, tidied but not invented. */
function titleFrom(relPath: string): string {
  const base = path.posix
    .basename(relPath.replaceAll('\\', '/'))
    .replace(/\.[A-Za-z0-9]{1,8}$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
