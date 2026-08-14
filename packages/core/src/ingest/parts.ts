import path from 'node:path';

/**
 * Scanning a passport gives you `passport.pdf` and `passport-2.pdf`. They are not two
 * documents — they are one document someone's scanner cut in half.
 *
 * Treating them separately produces two pages, two summaries and two half-answers, and
 * "page 2" of the second file is really page 5 of the passport. So files that differ only
 * by a trailing `-<n>` are read as **parts of one document**: one owning page, one summary,
 * and page numbers that run through the whole thing.
 *
 * The rule is deliberately narrow, because the cost of a wrong guess is two unrelated
 * documents welded together:
 *
 * - The extension must match. `passport.jpg` beside `passport.pdf` is a second rendition of
 *   the same thing, not its second half, and merging their text would interleave two
 *   readings of one page.
 * - The suffix must be one or two digits **not preceded by a digit**. `bill-2026.pdf` is a
 *   year and `invoice-100.pdf` is an invoice number — but the case that actually bit was
 *   `waternet-annual-bill-2026-07-28.pdf`, read as part 28 of a bill that does not exist.
 *   Two bills dated `-27` and `-28` would have been welded into one document.
 * - Part one must exist on disk. A lone `-<n>` file is its own document, whatever its name
 *   suggests, because the alternative is inventing a document out of a filename.
 * - A content-addressed attachment (`<page>-<8 hex>.<ext>`) is never a part. Its suffix is
 *   a hash, and Akno wrote it.
 */

/**
 * The other thing a second file beside a document can be.
 *
 * The part rule above excludes a differing extension because `passport.jpg` beside
 * `passport.pdf` is "a second rendition of the same thing, not its second half". That
 * category was named and then had nowhere to go. This is where it goes: `contract.pdf.txt`
 * holds the *same* text as `contract.pdf`, in a format anything can open.
 *
 * The distinction is not cosmetic. Parts concatenate — `read` joins their text and page
 * numbers run through the whole group — while a rendition must never be joined to what it
 * renders, or a contract's every phrase comes back twice.
 *
 * Two spellings, because both occur. Akno writes `contract.pdf.txt`; a person who ran
 * `pdftotext` before Akno existed wrote `contract.txt` beside `contract.pdf`, and that
 * second one is the case that was quietly costing double hits on every phrase in the file.
 *
 * The rule stays as narrow as the part rule, and for the same reasons:
 *
 * - **Only a `.txt` is ever a rendition.** `passport.jpg` beside `passport.pdf` is two
 *   renderings with no way to say which is the document, so neither is folded into the other.
 * - **The source must exist, and be a format text is extracted *from*.** A `.txt` beside a
 *   `.csv` is two text files, not a rendering of one.
 * - **An ambiguous stem is refused.** `contract.txt` beside both `contract.pdf` and
 *   `contract.docx` names no one document, and picking either would attach the text of one
 *   file to a different file's name.
 * - `.txt.txt` is refused. Whatever it is, it is not a rendering of a text file.
 */
export interface DocumentRendition {
  /** The rel_path of the file this one renders. */
  source: string;
}

export interface RenditionOptions {
  /** Names of the files in a directory, for finding a same-stem sibling. */
  entries: (directory: string) => string[];
}

/** Formats whose text is a copy of somebody else's, so a `.txt` of one adds nothing. */
const PLAIN = new Set(['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.yaml', '.yml', '.log']);

export function documentRendition(relPath: string, options: RenditionOptions): DocumentRendition | null {
  const normalized = relPath.replaceAll('\\', '/');
  if (path.posix.extname(normalized).toLowerCase() !== '.txt') return null;

  const directory = path.posix.dirname(normalized);
  const stem = path.posix.basename(normalized.slice(0, -'.txt'.length));
  const siblings = options.entries(directory);
  const inDirectory = (name: string): string => (directory === '.' ? name : `${directory}/${name}`);

  // Asked of the folder rather than of the name. Whether a stem "has an extension" cannot be
  // decided by looking for a dot: `Rental Agreement … A. N. Marlow … Aug 5 2031` has four, and
  // none of them starts an extension. Whether a file of that exact name is *there* is a fact.
  if (siblings.includes(stem)) {
    return isExtractable(stem) ? { source: inDirectory(stem) } : null;
  }

  // Otherwise the folder has to hold exactly one document this could be the text of.
  const candidates = siblings.filter((name) => isExtractable(name) && withoutExtension(name) === stem).sort();
  return candidates.length === 1 ? { source: inDirectory(candidates[0]!) } : null;
}

/** A format text is extracted *from*, rather than one that is already text. */
function isExtractable(name: string): boolean {
  const extension = path.posix.extname(name).toLowerCase();
  return extension.length > 0 && !PLAIN.has(extension);
}

function withoutExtension(name: string): string {
  const extension = path.posix.extname(name);
  return extension ? name.slice(0, -extension.length) : name;
}

export interface DocumentPart {
  /**
   * The rel_path of part one — the group's identity, whether or not that file exists. Files
   * sharing one `groupKey` are one document.
   */
  groupKey: string;
  /** 1 for the bare file, `n` for `-<n>`. Parts are ordered by this. */
  part: number;
}

const PART_SUFFIX = /^(.*[^\d-])-(\d{1,2})$/;

export interface PartOptions {
  /**
   * Whether the group's part one exists. Without this check a date-suffixed name invents a
   * document: the guard is that a part implies something to be a part *of*.
   */
  hasPartOne?: (groupKey: string) => boolean;
}

export function documentPart(relPath: string, options: PartOptions = {}): DocumentPart {
  const normalized = relPath.replaceAll('\\', '/');
  const extension = path.posix.extname(normalized);
  const base = path.posix.basename(normalized, extension);
  const directory = path.posix.dirname(normalized);

  const match = PART_SUFFIX.exec(base);
  if (!match) return { groupKey: normalized, part: 1 };

  const part = Number(match[2]);
  // 0 is not a part number anyone writes, and a leading-zero form (`-02`) is a page label
  // from a scanner rather than a sequence Akno should reorder.
  if (part < 1 || match[2]!.startsWith('0')) return { groupKey: normalized, part: 1 };

  const stem = match[1]!;
  const groupBase = `${stem}${extension}`;
  const groupKey = directory === '.' ? groupBase : `${directory}/${groupBase}`;

  if (options.hasPartOne && !options.hasPartOne(groupKey)) return { groupKey: normalized, part: 1 };
  return { groupKey, part };
}
