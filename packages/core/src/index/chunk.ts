import type { ParsedPage } from '../kb/page.ts';

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
  const chunks: Chunk[] = [];

  for (const section of splitByHeading(page, 2)) {
    if (measure(section) <= options.maxChars) {
      chunks.push(toChunk(section));
      continue;
    }

    // Step 2, and it is the step worth having: an oversized `##` section usually
    // has `###` subsections, and the author put them there to say where topics
    // start. Splitting on them instead of on blank lines keeps each chunk's
    // breadcrumb specific — `Policy › Excess` rather than a second anonymous
    // slice of `Policy` — which is what a reader sees on the card.
    const subsections = splitSection(section, 3);
    for (const subsection of subsections) {
      if (measure(subsection) <= options.maxChars) chunks.push(toChunk(subsection));
      // Step 3: still over the cap, so fall back to paragraph boundaries.
      else chunks.push(...splitByParagraph(subsection, options));
    }
  }

  return chunks
    .flatMap((chunk) => enforceCap(chunk, options))
    .filter((chunk) => chunk.text.trim().length > 0)
    .map((chunk, index) => ({ ...chunk, ord: index }));
}

/**
 * The spec's three steps all split on structure the author supplied — headings,
 * then blank lines. None of them can divide a *single* line longer than the cap,
 * and those exist: a pasted paragraph with no wrapping, a wide markdown table row,
 * an inlined data URI. Without this the "hard cap" is not hard, and a chunk can
 * arrive at the embedding endpoint over its context length, where it is silently
 * truncated — losing the tail of a page with no indication that it happened.
 *
 * So sentence boundaries first, and a blunt character cut only when there are
 * none. Line addressing survives either way: every piece keeps the line range it
 * came from, because it came from one line.
 */
function enforceCap(chunk: Chunk, options: ChunkOptions): Chunk[] {
  if (chunk.text.length <= options.maxChars) return [chunk];

  const pieces: string[] = [];
  let rest = chunk.text;
  while (rest.length > options.maxChars) {
    const window = rest.slice(0, options.maxChars);
    // Prefer the last sentence end in the back half of the window: cutting at the
    // very first one would produce a stream of tiny chunks.
    const boundary = lastSentenceEnd(window, Math.floor(options.maxChars / 2));
    const cut = boundary ?? lastSpace(window, Math.floor(options.maxChars / 2)) ?? options.maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) pieces.push(rest);

  return pieces.map((text) => ({ ...chunk, text }));
}

function lastSentenceEnd(text: string, minimum: number): number | null {
  for (let i = text.length - 1; i >= minimum; i--) {
    const char = text[i]!;
    if ((char === '.' || char === '?' || char === '!' || char === ';') && /\s/.test(text[i + 1] ?? ' ')) {
      return i + 1;
    }
  }
  return null;
}

function lastSpace(text: string, minimum: number): number | null {
  const index = text.lastIndexOf(' ');
  return index >= minimum ? index + 1 : null;
}

function measure(section: Section): number {
  return section.lines.reduce((total, line) => total + line.text.length + 1, -1);
}

function toChunk(section: Section): Chunk {
  return {
    ord: 0,
    kind: 'full',
    headingPath: section.headings.join(' › '),
    text: section.lines.map((line) => line.text).join('\n'),
    lineStart: section.lines[0]!.line,
    lineEnd: section.lines.at(-1)!.line,
  };
}

/**
 * Re-splits one already-extracted section on a deeper heading level. Lines before
 * the first subheading stay with the parent, so a section's own introduction is
 * not orphaned onto whichever subsection happens to follow it.
 */
function splitSection(section: Section, depth: number): Section[] {
  const out: Section[] = [];
  const headings = [...section.headings];
  let current: Section = { headings: [...headings], lines: [], depth: section.depth };

  for (const entry of section.lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(entry.text);
    if (heading && heading[1]!.length === depth) {
      if (current.lines.length > 0) out.push(current);
      const label = heading[2]!.replace(/[#*`]/g, '').trim();
      current = { headings: [...headings, label], lines: [entry], depth };
      continue;
    }
    current.lines.push(entry);
  }
  if (current.lines.length > 0) out.push(current);

  // No subheadings found: hand the section back unchanged so the caller falls
  // through to paragraph splitting rather than looping.
  return out.length > 1 ? out : [section];
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

/**
 * Step 3. Paragraph boundaries with a small overlap: splitting mid-sentence costs
 * retrieval quality for no gain, and a blank line is the author's own boundary —
 * the same reason headings are trusted above.
 */
function splitByParagraph(section: Section, options: ChunkOptions): Chunk[] {
  const headingPath = section.headings.join(' › ');
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
    // An overlap that kept *everything* makes no progress, and the final flush
    // then emits the same text a second time — duplicating content in the index,
    // where one line can match twice and inflate a page's apparent relevance. It
    // happens whenever a single line is longer than overlapChars, which is most
    // long lines.
    if (overlap.length === buffer.length) {
      buffer = [];
      bufferChars = 0;
      return;
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

/** A document's chunk: its text, plus the page inside the document it came from. */
export interface DocumentChunk {
  ord: number;
  text: string;
  /** Page within the document, or null for a format with no pages. */
  docPage: number | null;
}

/**
 * §11. Chunks a document's extracted text so a PDF is searchable by its own content and a
 * hit can name the page it is on.
 *
 * Page boundaries are honoured before size: a chunk that straddles two pages cannot be
 * cited as being on either, and "page 9 of the contract" is the part of the citation a
 * reader actually uses to check it. Within a page, long text is split on blank lines and
 * then on sentence ends, because a document has no headings to follow — which is exactly
 * what distinguishes this from `chunkPage`.
 */
export function chunkDocument(
  extraction: { text: string; sections?: { page: number; text: string }[] },
  options: Pick<ChunkOptions, 'targetChars' | 'maxChars'>,
): DocumentChunk[] {
  const pages = extraction.sections?.length ? extraction.sections : [{ page: 0, text: extraction.text }];

  const out: DocumentChunk[] = [];
  for (const page of pages) {
    for (const text of splitText(page.text, options)) {
      out.push({ ord: out.length, text, docPage: page.page > 0 ? page.page : null });
    }
  }
  return out;
}

/** Blank lines first, then sentence ends, then a hard cut — in that order of preference. */
function splitText(text: string, options: Pick<ChunkOptions, 'targetChars' | 'maxChars'>): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= options.maxChars) return [trimmed];

  const out: string[] = [];
  let current = '';
  const flush = (): void => {
    const value = current.trim();
    if (value.length > 0) out.push(value);
    current = '';
  };

  for (const paragraph of trimmed.split(/\n\s*\n/)) {
    for (const piece of paragraph.length > options.maxChars ? sentences(paragraph, options) : [paragraph]) {
      if (current.length > 0 && current.length + piece.length > options.targetChars) flush();
      current = current.length > 0 ? `${current}\n\n${piece}` : piece;
      if (current.length >= options.targetChars) flush();
    }
  }
  flush();
  return out;
}

function sentences(text: string, options: Pick<ChunkOptions, 'maxChars'>): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= options.maxChars) {
      out.push(part);
      continue;
    }
    // Scanned text can be one unbroken run with no punctuation at all. A hard cut is the
    // honest last resort: better a chunk boundary mid-sentence than a chunk the embedder
    // silently truncates.
    for (let i = 0; i < part.length; i += options.maxChars) out.push(part.slice(i, i + options.maxChars));
  }
  return out;
}
