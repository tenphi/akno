import fs from 'node:fs';
import path from 'node:path';
import { annotateLines, LINE_FACT_COLUMNS, type LineFact } from '../kb/line-facts.ts';
import { AknoError, ReadInput, type PageRole, type ReadOutput } from '@akno/protocol';
import type { AknoContext } from '../context.ts';

/**
 * `read({slug})` returns the full body of a `source` page every time.
 * The role governs only what recall pulls in unprompted — **this is a relevance
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
  role: PageRole;
  remember_management: 'deny' | 'integrate';
  dream_management: 'none' | 'hygiene' | 'synthesize';
  about: string;
  aliases: string;
  frontmatter: string;
  summary: string | null;
  keywords: string | null;
  source_fence_line: number | null;
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
    .prepare(`SELECT ${LINE_FACT_COLUMNS} FROM facts WHERE page_id = ?`)
    .all(row.id) as (LineFact & { claim: string })[];

  const withConfidence = annotateLines(lines, facts);

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
      role: row.role,
      management: { remember: row.remember_management, dream: row.dream_management },
      about: JSON.parse(row.about) as string[],
      aliases: JSON.parse(row.aliases) as string[],
      frontmatter: JSON.parse(row.frontmatter) as Record<string, unknown>,
      summary: row.summary,
      ...(row.keywords ? { keywords: JSON.parse(row.keywords) as string[] } : {}),
      lines: withConfidence,
      source_fence_line: row.source_fence_line,
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

interface DocumentRow {
  id: string;
  rel_path: string;
  mime: string | null;
  sha256: string;
  label: string | null;
  text: string | null;
  page_count: number | null;
  ocr: number;
  bytes: number;
  group_key: string | null;
  renders: string | null;
  slug: string | null;
}

const SELECT_DOCUMENT = `SELECT d.id, d.rel_path, d.mime, d.sha256, d.label, d.text, d.page_count,
                                d.ocr, d.bytes, d.group_key, d.renders, p.slug
                           FROM documents d LEFT JOIN pages p ON p.id = d.page_id`;

/**
 * A document by id, by its path in the knowledge base, or by its bare filename.
 *
 * Someone who has just read a page is holding three handles on the same file and has no
 * reason to prefer one: the `id` in `documents[]`, the `rel_path` beside it, and the
 * basename inside the `![[…]]` embed in the body. The embed is the most visible of the
 * three and used to be the only one that did not work, so the two-call route — read the
 * page, then read its document — dead-ended on a `not_found` that said only that the id was
 * wrong, with nothing to try next.
 *
 * A bare filename resolves only when exactly one file matches. Quietly picking one of two
 * `lease.pdf`s would answer a question about one document with the text of another, which
 * is worse than the error.
 */
function resolveDocument(ctx: AknoContext, handle: string): DocumentRow {
  const exact = ctx.store.db
    .prepare(`${SELECT_DOCUMENT} WHERE d.id = ? OR d.rel_path = ?`)
    .get(handle, handle) as DocumentRow | undefined;
  if (exact) return exact;

  const byName = ctx.store.db
    .prepare(`${SELECT_DOCUMENT} WHERE d.rel_path LIKE '%/' || ? LIMIT 5`)
    .all(handle) as DocumentRow[];
  if (byName.length === 1) return byName[0]!;
  if (byName.length > 1) {
    throw new AknoError('invalid', `${byName.length} documents are called ${handle} — name the path`, {
      matches: byName.map((row) => row.rel_path),
    });
  }

  const leaf = handle.split('/').pop() ?? handle;
  const nearest = ctx.store.db
    .prepare('SELECT rel_path FROM documents WHERE rel_path LIKE ? LIMIT 5')
    .all(`%${leaf}%`) as { rel_path: string }[];
  throw new AknoError('not_found', `no document at ${handle}`, {
    ...(nearest.length > 0 ? { nearest: nearest.map((row) => row.rel_path) } : {}),
  });
}

function readDocument(ctx: AknoContext, documentId: string): ReadOutput {
  const found = resolveDocument(ctx, documentId);
  // Asking for the text file beside a contract is asking for the contract. It holds a copy
  // of the same text, and answering from the copy would make which of the two you happened
  // to name matter.
  const row = found.renders ? resolveDocument(ctx, found.renders) : found;

  // A document someone's scanner cut into `passport.pdf` and `passport-2.pdf` is one
  // document, so reading any part returns the whole of it: the text of every part in order,
  // the total page count, and the other parts' paths. Asking for a passport and getting
  // half of it, with nothing saying so, is the failure this avoids.
  //
  // Renditions are not parts. `contract.pdf.txt` carries the same text as `contract.pdf`,
  // so joining it in would return the contract twice and count it as a part that could not
  // be read.
  const parts = ctx.store.db
    .prepare(
      `SELECT id, rel_path, text, page_count, ocr FROM documents
        WHERE group_key = ? AND renders IS NULL ORDER BY part`,
    )
    .all(row.group_key ?? row.rel_path) as {
    id: string;
    rel_path: string;
    text: string | null;
    page_count: number | null;
    ocr: number;
  }[];

  const readable = parts.filter((part) => part.text !== null);
  const text = readable.length > 0 ? readable.map((part) => part.text).join('\n\n') : null;
  const pageCount = parts.reduce<number | null>(
    (sum, part) => (part.page_count === null ? sum : (sum ?? 0) + part.page_count),
    null,
  );

  const notes: string[] = [];
  if (text === null) {
    notes.push(
      'nothing could be read from this file — a photo with no text in it, or a format with no extractor',
    );
  } else if (readable.length < parts.length) {
    // Partial is a result, not a failure — but a caller reasoning over half a contract has
    // to know which half it has.
    notes.push(
      `${parts.length - readable.length} of ${parts.length} parts could not be read: ` +
        parts
          .filter((part) => part.text === null)
          .map((part) => part.rel_path)
          .join(', '),
    );
  }
  if (parts.length > 1) {
    notes.push(
      `${parts.length} files, read as one document: ${parts.map((part) => part.rel_path).join(', ')}`,
    );
  }

  return {
    status: text === null ? 'degraded' : 'ok',
    // Extraction is a built-in reader, not a model call — so a file nothing could be read
    // from is its own kind of degraded, and pointing at a model would send someone to
    // configure one that would not have helped.
    ...(text === null ? { degraded: ['no_document_text' as const] } : {}),
    ...(notes.length > 0 ? { note: notes.join('. ') } : {}),
    document: {
      id: row.id,
      page: row.slug,
      rel_path: row.rel_path,
      mime: row.mime,
      sha256: row.sha256,
      label: row.label,
      page_count: pageCount,
      ocr: parts.some((part) => part.ocr === 1),
      text,
      bytes: row.bytes,
    },
  };
}

const SELECT_PAGE = `SELECT id, slug, rel_path, title, type, tags, role, remember_management,
                            dream_management, about, aliases, frontmatter, summary,
                            keywords, source_fence_line, bytes, updated_at
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
