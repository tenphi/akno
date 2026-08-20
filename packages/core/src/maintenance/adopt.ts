import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { effectiveRule } from '../rules/compile.ts';
import { cleanSlug } from '../ingest/name.ts';
import type { Extraction } from '../ingest/extract.ts';
import { provenanceLines } from '../ingest/store.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import type { ChangeFile } from '../write/journal.ts';

/**
 * A page for a document that has none, written beside the file.
 *
 * An attachment nobody's page points at is extracted like any other — its text is read on
 * arrival — and then has nowhere to be returned from, because recall returns page cards. It
 * is findable by nothing and reported by `doctor` forever.
 *
 * The fix is the one `ingest` already applies to every arrival: give it a page that says what
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
  action: 'created' | 'skipped';
  reason?: string;
}

interface OrphanGroup {
  groupKey: string;
  parts: { id: string; relPath: string; summary: string | null }[];
}

export async function adoptOrphans(
  ctx: AknoContext,
  options: { limit: number; dryRun: boolean },
): Promise<{ adopted: AdoptedDocument[]; files: ChangeFile[] }> {
  const adopted: AdoptedDocument[] = [];
  const files: ChangeFile[] = [];

  for (const group of orphanGroups(ctx)) {
    if (adopted.filter((entry) => entry.action === 'created').length >= options.limit) break;

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

    if (taken) {
      // A page is already there — almost always the user's own notes about this very file,
      // which is why the name collides. Writing `lease-scan-2.md` beside it would be a
      // near-duplicate nobody asked for; the fix a person wants is one `![[…]]` line in the page
      // they wrote, and that is what the report says. Skipping also means the orphan is found
      // again next run, by which time that line may exist.
      adopted.push({
        slug,
        files: group.parts.map((part) => part.relPath),
        action: 'skipped',
        reason: 'a page already exists at that path — add `![[filename]]` to it to link them',
      });
      continue;
    }

    adopted.push({
      slug: relPath.replace(/\.md$/, ''),
      files: group.parts.map((part) => part.relPath),
      action: 'created',
    });
    if (options.dryRun) continue;

    const body = composeDocumentPage(ctx, group);
    await fsp.mkdir(path.dirname(absPath), { recursive: true });
    const result = await writeFileAtomic(ctx.config.aknoPath, relPath, body);
    files.push({ relPath, action: 'created', before: null, after: result.after });
  }

  return { adopted, files };
}

/**
 * Unowned documents with text, grouped so parts of one document get one page — the whole point
 * of grouping parts at all, and the difference between one passport page and thirteen.
 *
 * Documents with no readable text are left out: a page whose body is a filename helps nobody,
 * and `doctor` already reports them as unreadable.
 */
function orphanGroups(ctx: AknoContext): OrphanGroup[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT id, rel_path, group_key, summary FROM documents
        WHERE page_id IS NULL AND text IS NOT NULL
        ORDER BY group_key, part`,
    )
    .all() as { id: string; rel_path: string; group_key: string | null; summary: string | null }[];

  const groups = new Map<string, OrphanGroup>();
  for (const row of rows) {
    const key = row.group_key ?? row.rel_path;
    const part = { id: row.id, relPath: row.rel_path, summary: row.summary };
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
function composeDocumentPage(ctx: AknoContext, group: OrphanGroup): string {
  const first = group.parts[0]!;
  const title = titleFrom(first.relPath);
  const summary = group.parts.find((part) => part.summary)?.summary;

  const embeds = group.parts
    .map((part) => {
      const document = ctx.store.db
        .prepare('SELECT ocr, page_count, extract_via, confidence FROM documents WHERE id = ?')
        .get(part.id) as
        | {
            ocr: number;
            page_count: number | null;
            extract_via: string | null;
            confidence: number | null;
          }
        | undefined;
      // `via` is read, never reconstructed from the `ocr` flag. The flag cannot express the
      // one case this line exists for: an image a model *described* rather than read, which
      // would otherwise be adopted into a page claiming OCR had found the words.
      const provenance = provenanceLines({
        text: '',
        pageCount: document?.page_count ?? null,
        ocr: document?.ocr === 1,
        confidence: document?.confidence ?? null,
        via: (document?.extract_via as Extraction['via'] | null) ?? 'none',
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
