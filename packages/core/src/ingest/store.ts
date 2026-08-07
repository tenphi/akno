import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import type { Extraction } from './extract.ts';
import type { ChangeFile } from '../write/journal.ts';

/**
 * Where a stored document actually goes, and how it gets recorded.
 *
 * **Stored files are content-addressed**: `<page-basename>-<sha8>.<ext>`. That is worth
 * more than it looks — naming a file after its page forces a whole family of rules
 * ("a document must get its own page", "two files on one page each need a label to tell
 * them apart", "never park a document on a person's page"). Content addressing makes
 * all of them unnecessary: files are unique by construction, several can sit on one
 * page without ambiguity, and `label` goes back to being a description rather than a
 * disambiguator.
 *
 * One implementation, used by `ingest` and by `write`'s `documents` field. Two would
 * eventually disagree about the naming scheme, and the scheme is the whole point.
 */

export interface StoredDocument {
  /** Path inside the knowledge base, content-addressed. */
  relPath: string;
  sha256: string;
  bytes: number;
  /** For the journal. A moved file records its origin so undo can put it back. */
  file: ChangeFile;
}

export interface StoreOptions {
  ctx: AknoContext;
  /** Absolute path to read from. */
  source: string;
  /** The page this attachment belongs to. Supplies the basename. */
  pageSlug: string;
  /**
   * Move rather than copy.
   *
   * **The inbox is the only place Akno moves files.** A file dropped straight
   * into `documents/` was put there on purpose; Akno will name it, page it and index
   * it, but never relocate it. An external file handed to `ingest` is copied, so the
   * caller still has what they passed.
   */
  move: boolean;
}

export async function storeDocument(options: StoreOptions): Promise<StoredDocument> {
  const { ctx, source, pageSlug } = options;
  const extension = path.extname(source).toLowerCase();
  const sha = await sha256File(source);
  const relPath = `${pageSlug}-${sha.slice(0, 8)}${extension}`;
  const target = path.join(ctx.config.aknoPath, relPath);

  await fsp.mkdir(path.dirname(target), { recursive: true });
  const stat = await fsp.stat(source);

  if (options.move) {
    await fsp.rename(source, target).catch(async (err) => {
      // A rename across devices fails; an inbox can sit on a different volume.
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
      await fsp.copyFile(source, target);
      await fsp.rm(source);
    });
  } else {
    await fsp.copyFile(source, target);
  }

  return {
    relPath,
    sha256: sha,
    bytes: stat.size,
    // Binary bytes never go in the journal — `before: null` with the file recorded as
    // created is enough for undo, which removes it.
    file: { relPath, action: 'created', before: null, after: null },
  };
}

/**
 * Writes the extraction into the `documents` row the indexer created.
 *
 * The full text lives here rather than in the page body, which is what makes a stored PDF
 * searchable by its own content without turning a 40-page contract into a 40-page Markdown
 * file.
 */
export function recordDocument(options: {
  ctx: AknoContext;
  relPath: string;
  extraction: Extraction;
  summary?: string | null;
  label?: string | null;
}): string | null {
  const { ctx, relPath, extraction } = options;
  ctx.store.db
    .prepare(
      `UPDATE documents
          SET text = ?, summary = ?, page_count = ?, ocr = ?, label = coalesce(?, label)
        WHERE rel_path = ?`,
    )
    .run(
      extraction.text.length > 0 ? extraction.text : null,
      options.summary ?? null,
      extraction.pageCount,
      extraction.ocr ? 1 : 0,
      options.label ?? null,
      relPath,
    );

  const row = ctx.store.db.prepare('SELECT id FROM documents WHERE rel_path = ?').get(relPath) as
    { id: string } | undefined;
  return row?.id ?? null;
}

/**
 * Where a document's provenance is stated in the page itself.
 *
 * A reader deciding whether to trust a number should know whether it was typed, read
 * off a scan, or *described by a model that looked at a picture*. The last is not the
 * document's own text at all, and presenting the three identically would be a false
 * claim about where the words came from: cite or stay quiet, applied to files.
 */
export function provenanceLines(extraction: Extraction): string[] {
  const out: string[] = [];
  if (extraction.pageCount !== null) out.push(`- Pages: ${extraction.pageCount}`);
  if (extraction.via === 'ocr') {
    const confidence =
      extraction.confidence !== null ? ` (confidence ${extraction.confidence.toFixed(2)})` : '';
    out.push(`- Text below: recognised by OCR${confidence}`);
  } else if (extraction.via === 'vision') {
    out.push("- Text below: a model's description of the image, not text found in it");
  }
  return out;
}

async function sha256File(absPath: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256');
  const handle = await fsp.open(absPath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}
