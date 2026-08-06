import type { ParsedPage } from '../kb/page.js';

export interface Chunk {
  ord: number;
  /** 'full' or 'reference' — a chunk below the fence is evidence, never mined (§5). */
  kind: 'full' | 'reference';
  /** `Car insurance 2026 › Policy`. Prepended to the embedded text and shown as
   *  a breadcrumb on the card, because a heading is the author saying where a
   *  topic starts. */
  headingPath: string;
  text: string;
  lineStart: number;
  lineEnd: number;
}

export interface ChunkOptions {
  targetChars: number;
  maxChars: number;
  overlapChars: number;
}

interface Section {
  headings: string[];
  lines: { text: string; line: number }[];
  /** Heading depth this section was split at, so the next level down is known. */
  depth: number;
}

/**
 * §6. Chunks follow the document's own structure:
 *
 *   1. Split at `##`. One section, one chunk.
 *   2. A section over the size cap splits at `###`.
 *   3. Still over the cap — split at paragraph boundaries with a small overlap.
 *   4. A page with no headings under the cap is one chunk. Most pages are.
 */
export function chunkPage(page: ParsedPage, options: ChunkOptions): Chunk[] {
  const sections = splitByHeading(page, 2);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    for (const piece of fitSection(section, options)) {
      chunks.push(piece);
    }
  }

  return chunks
    .filter((chunk) => chunk.text.trim().length > 0)
    .map((chunk, index) => ({ ...chunk, ord: index }));
}

/**
 * Splits on headings at `depth`, carrying the enclosing heading path so a
 * `###` chunk still knows which `##` and `#` it sits under.
 */
function splitByHeading(page: ParsedPage, depth: number): Section[] {
  const sections: Section[] = [];
  // Index 0 is the `#` level; the stack tracks the current path at every depth.
  const headingStack: string[] = [];
  let current: Section | null = null;

  const fenceLine = page.referenceFenceLine;

  for (let i = 0; i < page.lines.length; i++) {
    const text = page.lines[i]!;
    const line = page.bodyLine + i;

    const heading = /^(#{1,6})\s+(.*)$/.exec(text);
    if (heading) {
      const level = heading[1]!.length;
      const label = heading[2]!.replace(/[#*`]/g, '').trim();
      headingStack.length = Math.max(0, level - 1);
      headingStack[level - 1] = label;

      if (level <= depth) {
        current = { headings: compactHeadings(headingStack), lines: [], depth: level };
        sections.push(current);
        // The heading itself belongs to its section — it is often the most
        // search-relevant text on the page.
        current.lines.push({ text, line });
        continue;
      }
    }

    if (!current) {
      current = { headings: compactHeadings(headingStack), lines: [], depth: 1 };
      sections.push(current);
    }
    current.lines.push({ text, line });

    // A fence line starts a new section: the class changes, so the chunk must.
    if (fenceLine !== null && line === fenceLine) {
      current = { headings: compactHeadings(headingStack), lines: [], depth };
      sections.push(current);
    }
  }

  return sections.filter((section) => section.lines.some((l) => l.text.trim().length > 0));
}

function compactHeadings(stack: (string | undefined)[]): string[] {
  return stack.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function fitSection(section: Section, options: ChunkOptions): Chunk[] {
  const text = section.lines.map((l) => l.text).join('\n');
  const lineStart = section.lines[0]!.line;
  const lineEnd = section.lines.at(-1)!.line;
  const headingPath = section.headings.join(' › ');

  if (text.length <= options.maxChars) {
    return [{ ord: 0, kind: 'full', headingPath, text, lineStart, lineEnd }];
  }

  // Step 3: paragraph boundaries with a small overlap. Splitting mid-sentence
  // costs retrieval quality for no gain — a blank line is the author's own
  // boundary, the same reason headings are trusted above.
  return splitByParagraph(section, options, headingPath);
}

function splitByParagraph(section: Section, options: ChunkOptions, headingPath: string): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer: { text: string; line: number }[] = [];
  let bufferChars = 0;

  const flush = (): void => {
    if (buffer.length === 0) return;
    chunks.push({
      ord: 0,
      kind: 'full',
      headingPath,
      text: buffer.map((l) => l.text).join('\n'),
      lineStart: buffer[0]!.line,
      lineEnd: buffer.at(-1)!.line,
    });
    // Overlap: keep trailing lines up to overlapChars so a claim straddling a
    // boundary is retrievable from either side.
    const overlap: { text: string; line: number }[] = [];
    let overlapChars = 0;
    for (let i = buffer.length - 1; i >= 0 && overlapChars < options.overlapChars; i--) {
      overlap.unshift(buffer[i]!);
      overlapChars += buffer[i]!.text.length + 1;
    }
    buffer = overlap;
    bufferChars = overlapChars;
  };

  for (const line of section.lines) {
    const isBlank = line.text.trim().length === 0;
    buffer.push(line);
    bufferChars += line.text.length + 1;

    if (bufferChars >= options.targetChars && isBlank) flush();
    else if (bufferChars >= options.maxChars) flush();
  }
  // The final flush must not leave an overlap-only tail behind as a chunk.
  if (buffer.length > 0) {
    const remaining = buffer.map((l) => l.text).join('\n');
    if (remaining.trim().length > 0) {
      chunks.push({
        ord: 0,
        kind: 'full',
        headingPath,
        text: remaining,
        lineStart: buffer[0]!.line,
        lineEnd: buffer.at(-1)!.line,
      });
    }
  }

  return chunks;
}

/**
 * Marks chunks below the reference fence. Done after chunking rather than during
 * so the fence position is the single thing that decides it.
 */
export function applyReferenceFence(chunks: Chunk[], fenceLine: number | null): Chunk[] {
  if (fenceLine === null) return chunks;
  return chunks.map((chunk) => (chunk.lineStart >= fenceLine ? { ...chunk, kind: 'reference' } : chunk));
}

/**
 * The heading path is prepended to the embedded text (§6). Without it a chunk
 * reading "Premium: €33/month" embeds with no idea what it is the premium *of*.
 */
export function embeddingText(chunk: Chunk): string {
  return chunk.headingPath ? `${chunk.headingPath}\n\n${chunk.text}` : chunk.text;
}
