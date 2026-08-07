import path from 'node:path';
import { parseJsonLoose, type ModelClient } from '../models/client.ts';

/**
 * **Files arrive with useless names.** `IMG_4821.HEIC`. `Scan 2026-08-06 at
 * 14.22.pdf`. `document(3).pdf`. A camera or a scanner named these, and the name says
 * nothing about what is inside — six months later nobody can find them, and neither
 * can search, because the filename is indexed and contributes only noise.
 *
 * Akno already has the text. Once it has that, naming is nearly free: **one call to
 * the derive model over the extracted text returns title, slug, summary, type and
 * a suggested folder together.** Not five calls — the model is reading the document
 * once either way.
 *
 * Two guards, both of which matter more than the naming does:
 *
 * - **A good name is left alone.** `2024-lease-agreement.pdf` carries information and
 *   is kept. Renaming only fires when the filename adds nothing the content does not
 *   already say.
 * - **Low confidence means no rename.** A photo of a garden or a corrupt scan keeps
 *   its name, gets no page, and is flagged in `doctor` rather than given a confident
 *   wrong one.
 */

export interface NamedDocument {
  title: string;
  /** Basename only. The folder is decided by routing, not here. */
  slug: string;
  summary: string;
  type: string | null;
  /** A folder the model thinks fits. Advisory — routing decides. */
  suggestedFolder: string | null;
  /** The model's own confidence that it understood the document at all, 0..1. */
  confidence: number;
  error: string | null;
}

const SYSTEM = `You are naming a document for a personal knowledge base from its extracted text.

Reply with JSON only:
{
  "title": "what a person would call this, 3-8 words",
  "slug": "kebab-case-file-name, no folder, no extension",
  "summary": "one or two sentences: what it is, and its most load-bearing values",
  "type": "one lowercase word, e.g. invoice receipt contract statement policy letter report photo note",
  "folder": "an existing folder from the list you were given, or null if none fit",
  "confidence": 0.0
}

The naming rule is **kind + subject + date**, from the content:
  invoice-northern-water-2026-07
  contract-apartment-lease-2024-08
  receipt-car-rental-2026-06

Rules:
- Name it from what the text says. Never from the original filename — that is the
  thing being replaced.
- Include a date in the slug when the document has one, in YYYY-MM or YYYY-MM-DD.
- No personal names in the slug unless the document is *about* that person
  (an identity document, a contract in their name).
- "confidence" is how sure you are that you understood what this document is:
    0.9+  the text plainly says what it is
    0.5   you can guess from fragments
    0.2   the text is garbled, or too short to tell
    0.0   you cannot tell at all
  Be honest. A low number is useful; a confident wrong name is not.
- Reply with confidence 0 rather than inventing a title for text you cannot read.`;

export interface NameOptions {
  /** Extracted text. Truncated before the call — a name does not need 40 pages. */
  text: string;
  originalName: string;
  /** Folders that exist, so the suggestion is a real place and not an invention. */
  folders: string[];
  derive: ModelClient;
}

export async function nameDocument(options: NameOptions): Promise<NamedDocument> {
  const empty: NamedDocument = {
    title: '',
    slug: '',
    summary: '',
    type: null,
    suggestedFolder: null,
    confidence: 0,
    error: null,
  };

  if (!options.derive.available) {
    return { ...empty, error: options.derive.unavailableReason ?? 'derive model unavailable' };
  }
  if (options.text.trim().length < 20) {
    return { ...empty, error: 'too little text to name the document from' };
  }

  // The opening of a document says what it is. 6000 characters covers a multi-page
  // contract's first pages, and sending 40 pages to choose 5 words is waste.
  const excerpt = options.text.slice(0, 6000);
  const folders = options.folders.slice(0, 60).join(', ');

  const result = await options.derive.chat(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Existing folders: ${folders || '(none yet)'}\n\nExtracted text:\n\n${excerpt}`,
      },
    ],
    { json: true, maxTokens: 500 },
  );
  if (!result.ok || !result.value) return { ...empty, error: result.error ?? 'naming failed' };

  const parsed = parseJsonLoose<Record<string, unknown>>(result.value);
  if (!parsed) return { ...empty, error: 'naming returned unparseable JSON' };

  const slug = cleanSlug(parsed.slug);
  const title = unslug(cleanText(parsed.title, 120));
  if (!slug || !title) return { ...empty, error: 'naming returned no usable slug or title' };

  const suggested = cleanText(parsed.folder, 200);
  return {
    title,
    slug,
    summary: cleanText(parsed.summary, 400) ?? '',
    type: cleanType(parsed.type),
    // Only a folder that actually exists. A model inventing `invoices/` and Akno
    // creating it is exactly the action the gate exists to prevent.
    suggestedFolder: suggested && options.folders.includes(suggested) ? suggested : null,
    confidence: clampConfidence(parsed.confidence),
    error: null,
  };
}

/**
 * A title a small model produced by echoing the slug — `ip-datagrams-on-avian-carriers` —
 * turned back into words.
 *
 * The prompt asks for "what a person would call this", and models answer that with a slug
 * often enough to matter: the title is what every recall card shows, so it is the one
 * field where a machine-shaped answer is most visible. Only fired when there is no space
 * at all, so a hyphenated title someone meant — `Zephyr QX-100 warranty` — is untouched.
 */
export function unslug(title: string | null): string | null {
  if (title === null || /\s/.test(title)) return title;
  if (!/[-_]/.test(title)) return title;
  return title.replace(/[-_]+/g, ' ');
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function cleanType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const type = value.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return /^[a-z][a-z-]{1,30}$/.test(type) ? type : null;
}

/**
 * A model asked for a filename will sometimes answer with a path, an extension, or
 * a sentence. Only the basename shape survives — the folder is routing's decision,
 * and a slug that can express `../` is one refactor away from being used as a path.
 */
export function cleanSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const base = value
    .trim()
    .toLowerCase()
    .split('/')
    .pop()!
    .replace(/\.[a-z0-9]{1,8}$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return base.length >= 3 ? base : null;
}

/**
 * Renaming only fires when the filename adds nothing the content does not
 * already say — camera and scanner patterns, bare hashes and UUIDs, `document(3)`, or
 * a name with no words in it beyond a date.
 *
 * The bias is deliberately toward keeping: a name someone chose carries intent that
 * no model can reconstruct, and getting this wrong is destructive in a way a bad
 * summary is not.
 */
const USELESS_NAME = [
  /^img[_-]?\d+$/i,
  /^dsc[_-]?\d+$/i,
  /^dscn\d+$/i,
  /^p\d{7,}$/i,
  // Pixel and other Android cameras: PXL_20260806_141500, MVIMG_, PANO_, VID_.
  /^(pxl|mvimg|pano|vid|burst)[_-]?\d+/i,
  // Photo Booth and the iOS simulator.
  /^photo on \d{4}-\d{2}-\d{2}/i,
  /^simulator screenshot/i,
  /^photo[_ -]?\d*$/i,
  /^image[_ -]?\d*$/i,
  /^screenshot[_ -]/i,
  /^screen shot /i,
  /^scan(ned)?([_ -]|$)/i,
  /^scan \d{4}-\d{2}-\d{2} at /i,
  /^document\s*\(\d+\)$/i,
  /^document\d*$/i,
  /^untitled/i,
  /^file[_-]?\d*$/i,
  /^download(\s*\(\d+\))?$/i,
  /^whatsapp (image|document|video)/i,
  /^telegram/i,
  /^[0-9a-f]{16,}$/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^\d{8,}$/,
  /^[\d\s._-]+$/,
];

export function nameIsUseless(originalName: string): boolean {
  const file = path.basename(originalName).trim();
  // `path.extname('.pdf')` is '' — a leading dot means a hidden file, not an
  // extension — so a name that is nothing but an extension has to be caught here.
  if (/^\.[A-Za-z0-9]{1,8}$/.test(file)) return true;

  const base = path.basename(file, path.extname(file)).trim();
  if (base.length === 0) return true;
  if (USELESS_NAME.some((pattern) => pattern.test(base))) return true;

  // A name whose only content is a date says when, never what. Common for scanners.
  const withoutDates = base.replace(/\d{4}[-_.]?\d{2}[-_.]?\d{2}|\d{2}[-_.]\d{2}[-_.]\d{4}/g, '');
  const words = withoutDates.split(/[^A-Za-z]+/).filter((word) => word.length >= 3);
  return words.length === 0;
}

/**
 * The second naming guard depends on this number being meaningful, so an absent or
 * nonsense value reads as **no** confidence rather than as full confidence. A model
 * that forgets the field must not thereby get permission to rename.
 */
function clampConfidence(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.max(0, Math.min(1, parsed)) * 100) / 100;
}
