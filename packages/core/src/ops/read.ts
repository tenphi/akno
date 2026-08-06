import fs from 'node:fs';
import path from 'node:path';
import { AknoError, ReadInput, type PageClass, type ReadOutput } from '@akno/protocol';
import type { AknoContext } from '../context.js';

/**
 * §5. `read({slug})` returns the full body of a `reference` page every time.
 * The class governs only what recall pulls in unprompted — **this is a relevance
 * policy, not access control.**
 */
export async function read(ctx: AknoContext, rawInput: unknown): Promise<ReadOutput> {
  const input = ReadInput.parse(rawInput);
  if (input.document) return readDocument(ctx, input.document);
  return readPage(ctx, input);
}

interface PageRow {
  id: string;
  slug: string;
  rel_path: string;
  title: string;
  type: string | null;
  tags: string;
  class: PageClass;
  frontmatter: string;
  summary: string | null;
  keywords: string | null;
  reference_fence_line: number | null;
  bytes: number;
  updated_at: string | null;
}

function readPage(ctx: AknoContext, input: ReturnType<typeof ReadInput.parse>): ReadOutput {
  const row = (
    input.slug
      ? ctx.store.db.prepare(SELECT_PAGE + ' WHERE slug = ?').get(input.slug)
      : ctx.store.db.prepare(SELECT_PAGE + ' WHERE id = ?').get(input.id)
  ) as PageRow | undefined;

  if (!row) {
    throw new AknoError('not_found', `no page at ${input.slug ?? input.id}`, {
      // A near-miss list turns "not found" into something the caller can act on
      // instead of guessing again.
      nearest: nearestSlugs(ctx, input.slug ?? ''),
    });
  }

  let content: string;
  try {
    content = fs.readFileSync(path.join(ctx.config.aknoPath, row.rel_path), 'utf8');
  } catch (err) {
    // The index says it exists and the file does not. That is `unavailable`, not
    // `not_found`: the knowledge base did record this, and the caller should say
    // so rather than "there is nothing about that".
    throw new AknoError('unavailable', `${row.slug} is indexed but could not be read: ${message(err)}`);
  }

  const allLines = content.split('\n');
  const from = input.from_line ?? 1;
  const to = input.to_line ?? allLines.length;
  const lines = allLines
    .slice(from - 1, to)
    .map((text, index) => ({ n: from + index, text }))
    .filter((line) => line.text.length > 0 || line.n === from);

  const facts = ctx.store.db
    .prepare('SELECT claim, line_start, confidence, valid_to FROM facts WHERE page_id = ?')
    .all(row.id) as { claim: string; line_start: number; confidence: number; valid_to: string | null }[];

  const withConfidence = lines.map((line) => {
    const live = facts.filter((fact) => fact.line_start === line.n && fact.valid_to === null);
    if (live.length === 0) return line;
    return { ...line, confidence: live.reduce((a, b) => (b.confidence > a.confidence ? b : a)).confidence };
  });

  const links = ctx.store.db
    .prepare('SELECT DISTINCT to_slug, broken FROM links WHERE from_page = ?')
    .all(row.id) as { to_slug: string; broken: number }[];
  const backlinks = ctx.store.db
    .prepare('SELECT DISTINCT p.slug FROM links l JOIN pages p ON p.id = l.from_page WHERE l.to_page = ?')
    .all(row.id) as { slug: string }[];

  const documents = ctx.store.db
    .prepare('SELECT id, rel_path, mime, label, page_count FROM documents WHERE page_id = ?')
    .all(row.id) as {
    id: string;
    rel_path: string;
    mime: string | null;
    label: string | null;
    page_count: number | null;
  }[];

  const superseded = facts
    .filter((fact) => fact.valid_to !== null)
    .map((fact) => ({ claim: fact.claim, valid_to: fact.valid_to! }));

  return {
    status: 'ok',
    page: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      type: row.type,
      tags: JSON.parse(row.tags) as string[],
      class: row.class,
      frontmatter: JSON.parse(row.frontmatter) as Record<string, unknown>,
      summary: row.summary,
      ...(row.keywords ? { keywords: JSON.parse(row.keywords) as string[] } : {}),
      lines: withConfidence,
      reference_fence_line: row.reference_fence_line,
      links: links.filter((link) => link.broken === 0).map((link) => link.to_slug),
      backlinks: backlinks.map((link) => link.slug),
      ...(links.some((l) => l.broken === 1)
        ? { broken_links: links.filter((l) => l.broken === 1).map((l) => l.to_slug) }
        : {}),
      ...(superseded.length > 0 ? { superseded } : {}),
      ...(documents.length > 0
        ? {
            documents: documents.map((doc) => ({
              id: doc.id,
              rel_path: doc.rel_path,
              ...(doc.mime ? { mime: doc.mime } : {}),
              ...(doc.label ? { label: doc.label } : {}),
              ...(doc.page_count !== null ? { pages: doc.page_count } : {}),
            })),
          }
        : {}),
      ...(row.updated_at ? { updated: row.updated_at.slice(0, 10) } : {}),
      bytes: row.bytes,
    },
  };
}

function readDocument(ctx: AknoContext, documentId: string): ReadOutput {
  const row = ctx.store.db
    .prepare(
      `SELECT d.id, d.rel_path, d.mime, d.sha256, d.label, d.text, d.page_count, d.ocr, d.bytes, p.slug
         FROM documents d LEFT JOIN pages p ON p.id = d.page_id WHERE d.id = ?`,
    )
    .get(documentId) as
    | {
        id: string;
        rel_path: string;
        mime: string | null;
        sha256: string;
        label: string | null;
        text: string | null;
        page_count: number | null;
        ocr: number;
        bytes: number;
        slug: string | null;
      }
    | undefined;

  if (!row) throw new AknoError('not_found', `no document with id ${documentId}`);

  // §11 promises extraction on arrival, always. That lands with `ingest`; until
  // then a document row is real but has no text, and saying which is better than
  // returning `null` and letting the caller assume the file is empty.
  const note =
    row.text === null
      ? 'text extraction is not available in this build — the document is registered but not extracted'
      : undefined;

  return {
    status: row.text === null ? 'degraded' : 'ok',
    ...(row.text === null ? { degraded: ['no_chat_model' as const] } : {}),
    ...(note ? { note } : {}),
    document: {
      id: row.id,
      page: row.slug,
      rel_path: row.rel_path,
      mime: row.mime,
      sha256: row.sha256,
      label: row.label,
      page_count: row.page_count,
      ocr: row.ocr === 1,
      text: row.text,
      bytes: row.bytes,
    },
  };
}

const SELECT_PAGE = `SELECT id, slug, rel_path, title, type, tags, class, frontmatter, summary,
                            keywords, reference_fence_line, bytes, updated_at
                       FROM pages`;

/** Cheap prefix and substring match. Good enough to catch a typo or a wrong folder. */
function nearestSlugs(ctx: AknoContext, slug: string): string[] {
  if (slug.length === 0) return [];
  const leaf = slug.split('/').pop() ?? slug;
  const rows = ctx.store.db
    .prepare('SELECT slug FROM pages WHERE slug LIKE ? OR slug LIKE ? LIMIT 5')
    .all(`%${leaf}%`, `${slug}%`) as { slug: string }[];
  return rows.map((row) => row.slug);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
