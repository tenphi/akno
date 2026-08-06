import YAML from 'yaml';

/**
 * §4. Akno *reads* several frontmatter keys and *writes* exactly one (`id`).
 * Every other key is preserved byte for byte and ignored.
 *
 * That guarantee is why this module never round-trips through the YAML
 * serializer on a write. A parse-and-re-emit reflows quotes, reorders nothing
 * reliably, drops comments, and turns `date: '2026-05-26T00:00:00.000Z'` into an
 * unquoted timestamp. Instead we keep the raw frontmatter text and splice into
 * it, so a page Akno touched still diffs as one added line.
 */

export interface Frontmatter {
  /** Parsed values. Empty object when the page has no frontmatter block. */
  data: Record<string, unknown>;
  /** The raw YAML between the `---` fences, without the fences. */
  raw: string;
  /** Whether a frontmatter block was present at all. */
  present: boolean;
  /** Byte offset in the original file where the body begins. */
  bodyOffset: number;
  /** 1-based line number of the first body line. Line addressing hangs off this. */
  bodyLine: number;
}

const FENCE = /^---\r?\n/;

export function parseFrontmatter(content: string): Frontmatter {
  if (!FENCE.test(content)) {
    return { data: {}, raw: '', present: false, bodyOffset: 0, bodyLine: 1 };
  }

  const firstFenceEnd = content.indexOf('\n') + 1;
  // Find the closing fence: a line that is exactly `---`.
  const closeMatch = /^---[ \t]*\r?$|^---[ \t]*$/m.exec(content.slice(firstFenceEnd));
  if (!closeMatch || closeMatch.index === undefined) {
    // An unterminated fence is not frontmatter; treat the whole file as body
    // rather than swallowing it.
    return { data: {}, raw: '', present: false, bodyOffset: 0, bodyLine: 1 };
  }

  const rawStart = firstFenceEnd;
  const rawEnd = firstFenceEnd + closeMatch.index;
  const raw = content.slice(rawStart, rawEnd);

  let bodyOffset = rawEnd + closeMatch[0].length;
  if (content[bodyOffset] === '\r') bodyOffset++;
  if (content[bodyOffset] === '\n') bodyOffset++;

  let data: Record<string, unknown> = {};
  try {
    const parsed = YAML.parse(raw, { logLevel: 'silent' });
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML in someone's notes is their business, not a reason to skip
    // the page. The body still indexes; `doctor` reports the parse failure.
    data = {};
  }

  const bodyLine = countLines(content.slice(0, bodyOffset)) + 1;
  return { data, raw, present: true, bodyOffset, bodyLine };
}

function countLines(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') count++;
  return count;
}

/** `tags: [a, b]`, `tags:\n  - a`, and `tags: a` all mean the same thing here. */
export function readTags(data: Record<string, unknown>): string[] {
  const value = data.tags;
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string');
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export function readString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Splices `id: <value>` into an existing frontmatter block, or creates a
 * minimal one. Only ever called when `write_ids` is on. Everything else in the
 * file — including the byte-for-byte frontmatter of keys Akno does not know —
 * is untouched.
 */
export function withId(content: string, id: string): string {
  const fm = parseFrontmatter(content);
  if (!fm.present) {
    return `---\nid: ${id}\n---\n\n${content}`;
  }
  if (typeof fm.data.id === 'string' && fm.data.id.length > 0) return content;
  const head = content.slice(0, fm.bodyOffset);
  // Insert immediately after the opening fence so `id` reads first, which is
  // where a human scanning frontmatter expects an identifier to be.
  const firstNewline = head.indexOf('\n') + 1;
  return `${head.slice(0, firstNewline)}id: ${id}\n${head.slice(firstNewline)}${content.slice(fm.bodyOffset)}`;
}
