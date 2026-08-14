import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { sha256 } from '../store/ids.ts';
import type { ImagePart, ModelClient } from '../models/client.ts';

const run = promisify(execFile);

/**
 * **Extraction happens on arrival, always** — text layer first, OCR for scans,
 * converters for Office formats. No caller ever runs an extraction tool, and a
 * stored PDF is searchable by its own content.
 *
 * Built on what macOS already has, rather than on `brew install poppler tesseract`.
 * PDFKit reads a text layer; Vision does OCR that is faster and more accurate than
 * tesseract, hardware-accelerated and offline. Measured on this machine: a receipt
 * photo in 1.4s at 0.99 mean confidence, a 4-page bill OCR'd in 2.4s recovering
 * 99.5% of what its text layer contained.
 *
 * Making a memory layer's first run depend on two unrelated projects being installed
 * — and on their CLI flags not changing — is a worse trade than one 6-second compile
 * of 200 lines of Swift, cached thereafter. Akno is macOS-only on purpose, so using
 * the platform's own frameworks is the honest choice and not a shortcut.
 */

export interface Extraction {
  text: string;
  /** Pages for a PDF, 1 for an image, null when the concept does not apply. */
  pageCount: number | null;
  /** True when the text came from OCR rather than from a text layer. */
  ocr: boolean;
  /** Vision's mean confidence over recognised lines. Null for a text layer. */
  confidence: number | null;
  /** How the text was obtained, for `doctor` and for the ingest report. */
  via: 'text-layer' | 'ocr' | 'plain' | 'textutil' | 'vision' | 'none';
  /** Set when nothing could be extracted, and why. Never thrown. */
  note: string | null;
  /**
   * The same text page by page, when the format has pages.
   *
   * A card points at the page, the document, **and the page number within it**.
   * That last part needs the text kept per page: a quote from page 9 of a contract with no
   * page attached is a citation a reader cannot check. Absent for formats with no pages —
   * a `.txt` file has none, and inventing "page 1" would be a claim, not a fact.
   */
  sections?: { page: number; text: string }[];
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.heic',
  '.heif',
  '.webp',
  '.tiff',
  '.tif',
  '.gif',
  '.bmp',
]);
const PLAIN_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.yaml',
  '.yml',
  '.log',
]);
/** Formats `textutil` handles natively — it ships with macOS. */
const TEXTUTIL_EXTENSIONS = new Set([
  '.rtf',
  '.rtfd',
  '.doc',
  '.docx',
  '.odt',
  '.html',
  '.htm',
  '.webarchive',
]);

export interface ExtractOptions {
  absPath: string;
  /** Pages OCR'd before stopping. A 200-page scan need not be fully searchable to be findable. */
  maxOcrPages: number;
  /** Used when OCR finds no text in an image — a photo rather than a document. */
  vision?: ModelClient;
  maxBytes: number;
}

export async function extract(options: ExtractOptions): Promise<Extraction> {
  const extension = path.extname(options.absPath).toLowerCase();

  const stat = await fsp.stat(options.absPath).catch(() => null);
  if (!stat) return none('the file could not be read');
  if (stat.size === 0) return none('the file is empty');
  if (stat.size > options.maxBytes) {
    return none(`the file is ${Math.round(stat.size / 1_048_576)} MB, over the configured limit`);
  }

  if (PLAIN_EXTENSIONS.has(extension)) {
    const text = await fsp.readFile(options.absPath, 'utf8').catch(() => '');
    return { text: text.trim(), pageCount: null, ocr: false, confidence: null, via: 'plain', note: null };
  }

  if (TEXTUTIL_EXTENSIONS.has(extension)) return textutil(options.absPath);
  if (extension === '.pdf') return pdf(options);
  if (IMAGE_EXTENSIONS.has(extension)) return image(options);

  return none(`no extractor for ${extension || 'a file with no extension'}`);
}

function none(note: string): Extraction {
  return { text: '', pageCount: null, ocr: false, confidence: null, via: 'none', note };
}

/**
 * `via` for a row extracted before it was persisted, worked out from what *was* kept.
 *
 * A back-compat shim with a shelf life: the real value is written on the next extraction,
 * and this only ever answers for `extract_via IS NULL`. It lives here because the extension
 * sets are the classifier, and a second copy of them somewhere else would drift from the
 * one that decides what `extract()` actually does.
 *
 * The one thing it cannot recover is `vision` versus `ocr` on an image, because both leave
 * `ocr = 0`… except that they do not: OCR sets the flag and a model's description does not.
 * That is the whole distinction, and it survived.
 */
export function legacyVia(row: { relPath: string; ocr: boolean; hasText: boolean }): Extraction['via'] {
  const extension = path.extname(row.relPath).toLowerCase();
  if (!row.hasText) return 'none';
  if (PLAIN_EXTENSIONS.has(extension)) return 'plain';
  if (TEXTUTIL_EXTENSIONS.has(extension)) return 'textutil';
  if (extension === '.pdf') return row.ocr ? 'ocr' : 'text-layer';
  if (IMAGE_EXTENSIONS.has(extension)) return row.ocr ? 'ocr' : 'vision';
  return 'none';
}

// ─── PDF and images, via the cached Swift helper ─────────────────────────────

interface SwiftResult {
  text: string;
  pages: number;
  ocr: boolean;
  confidence?: number;
  sections?: { page: number; text: string }[];
  error?: string;
}

async function pdf(options: ExtractOptions): Promise<Extraction> {
  const binary = await ensureExtractor();
  if (!binary) {
    return none('the extractor could not be built — is the Xcode command line tools package installed?');
  }

  const result = await callSwift(binary, [
    'pdf',
    options.absPath,
    '--ocr-pages',
    String(options.maxOcrPages),
  ]);
  if (!result) return none('the extractor did not return a result');
  if (result.error) return none(result.error);

  return {
    text: result.text.trim(),
    pageCount: result.pages,
    ocr: result.ocr,
    confidence: result.confidence ?? null,
    via: result.ocr ? 'ocr' : 'text-layer',
    ...(result.sections?.length ? { sections: result.sections } : {}),
    note:
      result.ocr && result.pages > options.maxOcrPages
        ? `scanned: OCR read the first ${options.maxOcrPages} of ${result.pages} pages`
        : null,
  };
}

async function image(options: ExtractOptions): Promise<Extraction> {
  const binary = await ensureExtractor();
  const result = binary ? await callSwift(binary, ['image', options.absPath]) : null;

  const text = (result?.text ?? '').trim();
  if (text.length > 0) {
    return {
      text,
      pageCount: 1,
      ocr: true,
      confidence: result?.confidence ?? null,
      via: 'ocr',
      note: null,
      sections: [{ page: 1, text }],
    };
  }

  // **Photos with no text yield no page; OCR still covers scans and
  // screenshots, which is most of what arrives.** With a vision model configured, a
  // photo can still be described — but that is a different claim about the file, so
  // it is labelled `via: 'vision'` and never confused with OCR of real text.
  if (options.vision?.available) {
    const described = await describeImage(options.absPath, options.vision);
    if (described) {
      return { text: described, pageCount: 1, ocr: false, confidence: null, via: 'vision', note: null };
    }
  }

  return none(
    binary
      ? 'no text found in the image, and no vision model is configured to describe it'
      : 'the extractor could not be built, and no vision model is configured',
  );
}

async function describeImage(absPath: string, vision: ModelClient): Promise<string | null> {
  const data = await fsp.readFile(absPath).catch(() => null);
  if (!data) return null;
  const mime = mimeFor(path.extname(absPath).toLowerCase());
  const images: ImagePart[] = [{ data, mime }];

  const result = await vision.chat(
    [
      {
        role: 'system',
        content:
          'Describe an image for a personal knowledge base index, so it can be found again by search. ' +
          'Two or three sentences. Name what it is, what is in it, and any text, date, place or amount ' +
          'you can read. Do not speculate about who took it or why, and do not describe what you cannot ' +
          'see. If it is a document, transcribe the readable text instead of describing it.',
      },
      { role: 'user', content: 'Describe this image.' },
    ],
    { images, maxTokens: 600 },
  );
  return result.ok && result.value ? result.value.trim() : null;
}

function mimeFor(extension: string): string {
  const table: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  };
  return table[extension] ?? 'application/octet-stream';
}

async function callSwift(binary: string, args: string[]): Promise<SwiftResult | null> {
  try {
    // 10 MB: a fully OCR'd 12-page scan runs to a few hundred KB, so this is slack
    // rather than a limit anyone will meet.
    const { stdout } = await run(binary, args, { maxBuffer: 10 * 1_048_576, timeout: 300_000 });
    return JSON.parse(stdout) as SwiftResult;
  } catch {
    return null;
  }
}

// ─── textutil, which ships with macOS ───────────────────────────────────────

async function textutil(absPath: string): Promise<Extraction> {
  try {
    const { stdout } = await run('/usr/bin/textutil', ['-convert', 'txt', '-stdout', absPath], {
      maxBuffer: 10 * 1_048_576,
      timeout: 60_000,
    });
    const text = stdout.trim();
    return text.length > 0
      ? { text, pageCount: null, ocr: false, confidence: null, via: 'textutil', note: null }
      : none('textutil found no text');
  } catch (err) {
    return none(`textutil could not read the file: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Building and caching the helper ────────────────────────────────────────

let cachedBinary: string | null | undefined;

/**
 * Compiles `swift/extract.swift` on first use and reuses it after, keyed by a hash of
 * the source — so upgrading Akno recompiles, and a hand-edited source is picked up.
 *
 * Cached in `~/Library/Caches`, **not** in the state directory. The binary is an
 * artifact of Akno, identical for every knowledge base, and putting it under
 * `state_dir` meant a second knowledge base compiled its own copy of the same 200
 * lines. `Caches` is also the directory macOS is allowed to reclaim, which is exactly
 * right for something rebuildable in six seconds.
 *
 * No `-O`: every expensive thing here happens inside Vision and PDFKit, so optimizing
 * the glue buys nothing and costs 23 of the 29 seconds.
 */
async function ensureExtractor(_stateDir?: string): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary;

  const source = findSwiftSource();
  if (!source) {
    cachedBinary = null;
    return null;
  }

  const version = sha256(await fsp.readFile(source, 'utf8')).slice(0, 12);
  const binary = path.join(cacheDir(), `akno-extract-${version}`);

  if (fs.existsSync(binary)) {
    cachedBinary = binary;
    return binary;
  }

  try {
    await fsp.mkdir(path.dirname(binary), { recursive: true });
    // Compile to a temp name and rename, so two processes racing on first use cannot
    // leave a half-written binary that the loser then tries to execute.
    const temp = `${binary}.${process.pid}.tmp`;
    await run('swiftc', ['-o', temp, source], { timeout: 180_000 });
    await fsp.rename(temp, binary);
    await fsp.chmod(binary, 0o755);
    cachedBinary = binary;
    return binary;
  } catch {
    // Degrade, never fail: plain text and Office formats still extract, and images
    // fall back to the vision model if one is configured.
    cachedBinary = null;
    return null;
  }
}

function cacheDir(): string {
  return process.env.AKNO_CACHE_DIR ?? path.join(os.homedir(), 'Library', 'Caches', 'akno', 'bin');
}

/** Beside `dist` when installed, at the package root when running from source. */
function findSwiftSource(): string | null {
  for (const up of ['..', '../..', '../../..', '../../../..']) {
    const candidate = path.resolve(import.meta.dirname, up, 'swift', 'extract.swift');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** What `doctor` reports, so a missing capability is visible rather than surprising. */
export async function extractionCapabilities(): Promise<{
  swift: boolean;
  textutil: boolean;
  note: string | null;
}> {
  const binary = await ensureExtractor();
  return {
    swift: binary !== null,
    textutil: fs.existsSync('/usr/bin/textutil'),
    note: binary
      ? null
      : 'PDF and image extraction is unavailable: the Swift helper could not be built. ' +
        'Install the Xcode command line tools (`xcode-select --install`).',
  };
}
