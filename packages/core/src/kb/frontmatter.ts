import YAML from 'yaml';

/**
 * Akno *reads* several frontmatter keys and *writes* exactly one (`id`).
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
  return spliceAfterFence(content, [`id: ${id}`]);
}

/**
 * Inserts lines immediately after the opening fence of an existing block, leaving
 * every other byte alone. Immediately after, because that is where a human scanning
 * frontmatter expects an identifier or a title to be.
 *
 * Splicing rather than parse-and-re-emit for the reason at the top of this file: the
 * keys already there keep their exact quoting, ordering and comments.
 */
export function spliceAfterFence(content: string, lines: string[]): string {
  if (lines.length === 0) return content;
  const fm = parseFrontmatter(content);
  if (!fm.present) return `---\n${lines.join('\n')}\n---\n\n${content}`;
  const head = content.slice(0, fm.bodyOffset);
  const firstNewline = head.indexOf('\n') + 1;
  return (
    head.slice(0, firstNewline) +
    `${lines.join('\n')}\n` +
    head.slice(firstNewline) +
    content.slice(fm.bodyOffset)
  );
}

/**
 * Adds identity aliases without round-tripping the rest of the frontmatter through YAML.
 *
 * Merge is allowed to retire one page identity, but the old title and slug must remain
 * discoverable on the canonical page. Complex inline `akno` mappings are refused: silently
 * reformatting an owner's unknown keys and comments would make a structural cleanup broader
 * than the plan says it is.
 */
export function withAknoAliases(content: string, aliases: string[]): string | null {
  const additions = [...new Set(aliases.map((value) => value.trim()).filter(Boolean))];
  if (additions.length === 0) return content;
  const fm = parseFrontmatter(content);
  if (fm.present && fm.raw.trim().length > 0 && Object.keys(fm.data).length === 0) return null;
  const akno = fm.data.akno;
  const record =
    akno && typeof akno === 'object' && !Array.isArray(akno)
      ? (akno as Record<string, unknown>)
      : null;
  if (akno !== undefined && !record) return null;
  const existingValue = record?.aliases;
  if (existingValue !== undefined && !Array.isArray(existingValue)) return null;
  const existing = (existingValue ?? []).filter((value): value is string => typeof value === 'string');
  const wanted = [...new Set([...existing, ...additions])];
  if (wanted.length === existing.length) return content;
  const missing = wanted.filter((value) => !existing.includes(value));
  const rendered = wanted.map((value) => `    - ${JSON.stringify(value)}`);

  if (!fm.present || !record) {
    return spliceAfterFence(content, ['akno:', '  aliases:', ...rendered]);
  }

  const newline = fm.raw.includes('\r\n') ? '\r\n' : '\n';
  if (newline === '\r\n' && fm.raw.replaceAll('\r\n', '').includes('\n')) return null;
  const lines = fm.raw.split(newline);
  const aknoIndex = lines.findIndex((line) => /^akno:[ \t]*(?:#.*)?$/.test(line));
  if (aknoIndex < 0) return null;
  let blockEnd = lines.length;
  for (let index = aknoIndex + 1; index < lines.length; index++) {
    const line = lines[index]!;
    if (line.trim() && !/^[ \t]/.test(line)) {
      blockEnd = index;
      break;
    }
  }
  const aliasesIndex = lines.findIndex(
    (line, index) => index > aknoIndex && index < blockEnd && /^  aliases:/.test(line),
  );
  if (aliasesIndex < 0) {
    lines.splice(aknoIndex + 1, 0, '  aliases:', ...rendered);
  } else {
    const match = /^  aliases:[ \t]*(.*)$/.exec(lines[aliasesIndex]!);
    const tail = match?.[1]?.trim() ?? '';
    if (tail.startsWith('[') && tail.endsWith(']')) {
      lines[aliasesIndex] = `  aliases: ${JSON.stringify(wanted)}`;
    } else if (tail.length === 0) {
      let insertAt = aliasesIndex + 1;
      while (insertAt < blockEnd && (/^[ \t]{4,}/.test(lines[insertAt]!) || !lines[insertAt]!.trim())) {
        insertAt++;
      }
      lines.splice(insertAt, 0, ...missing.map((value) => `    - ${JSON.stringify(value)}`));
    } else {
      return null;
    }
  }

  const firstFenceEnd = content.indexOf('\n') + 1;
  const rawEnd = firstFenceEnd + fm.raw.length;
  return content.slice(0, firstFenceEnd) + lines.join(newline) + content.slice(rawEnd);
}

/** A frontmatter block a caller supplied, split from the body it came with. */
export interface DeclaredFrontmatter {
  /** The block verbatim, fences and trailing newline included. */
  head: string;
  /** Everything after the closing fence. */
  body: string;
  data: Record<string, unknown>;
}

/**
 * Reads a frontmatter block off the front of text a *caller* supplied, rather than off a
 * file on disk.
 *
 * This exists because `read` hands back the whole file, frontmatter included. A caller that
 * read a page, revised it and sent the result back therefore carries a block with it, and
 * treating that block as body text is how a page grows a second one — the head is preserved,
 * the block lands underneath it, and nothing that reads frontmatter can see it. Rewriting the
 * declaration is a legitimate thing for a caller to want: `role`, `management` and `temporal`
 * live nowhere else in the write API.
 *
 * Returns `null` when there is nothing to adopt — no fence, an unterminated fence, or a fence
 * pair whose contents are not a mapping. That last case is the guard that matters: a body
 * opening with a `---` horizontal rule and containing another one looks exactly like a
 * frontmatter block until you try to parse it, and a horizontal rule is not a declaration.
 */
export function declaredFrontmatter(text: string): DeclaredFrontmatter | null {
  // Leading blank lines are a formatting accident, not a statement that the block is body.
  const trimmed = text.replace(/^(?:[ \t]*\r?\n)*/, '');
  const fm = parseFrontmatter(trimmed);
  if (!fm.present || Object.keys(fm.data).length === 0) return null;
  return {
    head: trimmed.slice(0, fm.bodyOffset),
    body: trimmed.slice(fm.bodyOffset),
    data: fm.data,
  };
}
