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
