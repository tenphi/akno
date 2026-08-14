import path from 'node:path';
import type { Extraction } from './extract.ts';

/**
 * The extracted text, written beside the file it came from.
 *
 * The text of a stored document already exists — `documents.text`, read once on arrival —
 * and `read({document})` hands back every character of it. What did not exist is a way for
 * anything that is *not* Akno to see it: a `grep`, an editor, a git diff, an agent that
 * has a folder and no socket. The page beside a stored PDF is two sentences on purpose, and
 * two sentences cannot hold a nine-page lease, so the text had nowhere on disk to live and
 * the only way back to it was to OCR the PDF again.
 *
 * A rendition is that file. It is derived, regenerable and never authoritative: the source
 * bytes are the document, `documents.text` is what search reads, and this is a convenience
 * copy that says so in its own first three lines.
 */

export interface RenditionSource {
  relPath: string;
  text: string;
  pageCount: number | null;
  ocr: boolean;
  via: Extraction['via'];
  confidence: number | null;
}

export interface RenditionGate {
  minChars: number;
  /** The `ingest` verb of the folder rule in force for the owning page. */
  ingestRule: 'page' | 'document' | 'file' | 'auto' | 'ignore' | undefined;
}

/**
 * Whether a document earns a file beside it — and, when it does not, why not.
 *
 * An allowlist on `via` rather than a denylist, so a format added later has to say out loud
 * that its text is the document's own words before those words are written to disk under
 * the document's name.
 */
export function renditionWanted(
  source: RenditionSource,
  gate: RenditionGate,
): { write: boolean; reason: string } {
  if (gate.ingestRule === 'ignore' || gate.ingestRule === 'file') {
    // `ingest: "file"` means "index the bytes, write me no pages here". A rendition is a
    // file written into that folder, so the rule covers it for the same reason.
    return { write: false, reason: `the folder rule says ingest: "${gate.ingestRule}"` };
  }
  if (source.text.length === 0) return { write: false, reason: 'nothing was extracted' };

  // The file already *is* its text. A byte-for-byte copy under a longer name is not a
  // convenience, it is a second thing to keep in step.
  if (source.via === 'plain') return { write: false, reason: 'the file is already text' };

  // A model looking at a photograph and saying what it sees is not the file's words. Writing
  // that into `garden.jpg.txt` would claim it is, and a reader deciding whether to trust a
  // number has no way left to tell.
  if (source.via === 'vision') {
    return { write: false, reason: "the text is a model's description of an image, not the file's words" };
  }
  if (source.via === 'none') return { write: false, reason: 'the text could not be read' };

  if (source.text.length < gate.minChars) {
    return {
      write: false,
      reason: `${source.text.length} characters is under ingest.text_rendition_min_chars (${gate.minChars})`,
    };
  }
  return { write: true, reason: 'the text is the document’s own and does not fit on its page' };
}

/** The first thing in every rendition, and the only claim of authorship there is. */
const HEADER = '# Extracted text of ';

/**
 * Whether Akno wrote this, judged from the file itself.
 *
 * The same question `looksLikeLedger` asks of a `timeline.md`, and answered the same way:
 * a reserved path that exists and is not what Akno expects is left completely alone.
 * Somebody who opened `contract.pdf.txt` and fixed three OCR mistakes by hand did something
 * useful, and reverting it on the next index pass is not a recoverable mistake.
 */
export function looksLikeRendition(head: string): boolean {
  return head.startsWith(HEADER);
}

/**
 * A provenance header, a blank line, then the text exactly as it is stored.
 *
 * The header is three lines against tens of thousands of characters, and it buys the thing
 * `provenanceLines` exists for: text recognised from a scan at 0.87 confidence is a good
 * guess, not a transcript, and a file that does not say so invites being quoted as one.
 *
 * **No page markers.** The temptation is real — a citation wants "page 9" — but the per-page
 * sections and the joined text are built separately during extraction and are not the same
 * string for a PDF with a text layer. A rendition assembled from sections would therefore
 * hold different bytes from the text `read` returns and the summary was written from: one
 * document with two texts that can quietly disagree. Page numbers already live where they
 * survive being checked, on the chunks recall cites.
 */
export function renditionBody(source: RenditionSource): string {
  const name = path.posix.basename(source.relPath.replaceAll('\\', '/'));
  const pages =
    source.pageCount !== null ? `${source.pageCount} page${source.pageCount === 1 ? '' : 's'}, ` : '';
  const confidence = source.confidence !== null ? ` at ${source.confidence.toFixed(2)} mean confidence` : '';

  const how =
    source.via === 'ocr'
      ? `recognised by OCR${confidence}, not typed`
      : source.via === 'textutil'
        ? 'converted from the original format'
        : "read from the file's own text layer";

  return (
    `${HEADER}${name}\n` +
    `# ${pages}${how}.\n` +
    `# Written by Akno from the file beside it. Edits here are overwritten; edit the source.\n` +
    `\n${source.text}\n`
  );
}

/**
 * Where the text of a document goes: the document's own name, with `.txt` for an extension.
 *
 * `contract.txt` beside `contract.pdf` rather than `contract.pdf.txt`, because a document is
 * one thing and its stem is its name — the same reason `passport.pdf` and `passport-2.pdf`
 * are one document. Appending instead of replacing produces a second file beside anyone who
 * already ran `pdftotext`, which is two copies of one text under two names.
 *
 * The reader accepts both spellings; only this one is written.
 */
export function renditionPathFor(relPath: string): string {
  const extension = path.posix.extname(relPath.replaceAll('\\', '/'));
  return `${extension ? relPath.slice(0, -extension.length) : relPath}.txt`;
}
