import { AknoError } from '@akno/protocol';
import { declaredFrontmatter, parseFrontmatter, withId } from '../kb/frontmatter.ts';

/**
 * The four ways `write` can change a body, and the rule they obey: **never touch the
 * frontmatter, unless the caller sent one.** Every key is preserved byte for byte, so an
 * edit here operates on the body and splices it back under the original head.
 *
 * The exception is `content` — a whole-page write — and it is not a loophole. `read` returns
 * the file including its frontmatter, so a caller that read a page, revised it and sent the
 * result back arrives holding a block; and `role`, `management` and `temporal` are declarable
 * nowhere else in the write API, so rewriting the declaration is a thing a caller legitimately
 * means. The old behaviour spliced that block under the existing head and produced a page with
 * two, the second invisible to everything that reads frontmatter. Adopting it is both what the
 * caller asked for and the only reading that cannot silently accumulate.
 */

export type BodyEdit =
  | { kind: 'content'; content: string }
  | { kind: 'append'; text: string; section?: string }
  | { kind: 'patch'; patch: string }
  | { kind: 'replace'; find: string; with: string };

export interface EditResult {
  content: string;
  /** Lines that changed, for the journal summary and the write report. */
  firstChangedLine: number | null;
  /**
   * Set when the write carried its own frontmatter block and it replaced the page's.
   * `dropped` names the keys the old block declared and the new one does not, because a
   * caller rewriting a declaration from memory is the likeliest way to lose a key nobody
   * meant to remove — and a rewrite nobody can see is the failure this whole path exists
   * to stop repeating.
   */
  frontmatter?: { adopted: true; dropped: string[] };
}

export function applyEdit(original: string, edit: BodyEdit): EditResult {
  const frontmatter = parseFrontmatter(original);
  const head = original.slice(0, frontmatter.bodyOffset);
  const body = original.slice(frontmatter.bodyOffset);

  if (edit.kind === 'content') {
    const declared = declaredFrontmatter(edit.content);
    if (declared) {
      // `id` is Akno's own key and the caller has no reason to be carrying it. Losing it
      // detaches the page from its row, so it survives a rewrite that omits it.
      const id = frontmatter.data.id;
      const nextHead = typeof id === 'string' && id.length > 0 ? withId(declared.head, id) : declared.head;
      // A blank line between the closing fence and the body, matching how every page Akno
      // composes is laid out. `bodyOffset` has already eaten the fence's own newline.
      const separated = declared.body.startsWith('\n') ? declared.body : `\n${declared.body}`;
      const content = nextHead + endWithNewline(separated);
      const dropped = Object.keys(frontmatter.data).filter(
        (key) => key !== 'id' && !Object.hasOwn(declared.data, key),
      );
      return {
        content,
        firstChangedLine: firstDifference(original, content),
        frontmatter: { adopted: true, dropped },
      };
    }
  }

  const nextBody = editBody(body, edit);
  const content = head + nextBody;
  return { content, firstChangedLine: firstDifference(original, content) };
}

function editBody(body: string, edit: BodyEdit): string {
  switch (edit.kind) {
    case 'content':
      return endWithNewline(edit.content);

    case 'append': {
      if (edit.section !== undefined) return appendUnderHeading(body, edit.section, edit.text);
      // A blank line before the appended text, unless the body already ends in
      // one. Appending flush against the previous line silently joins two list
      // items or two paragraphs into one.
      const trimmed = body.replace(/\s+$/, '');
      const separator = trimmed.length === 0 ? '' : '\n\n';
      return endWithNewline(`${trimmed}${separator}${edit.text.trim()}`);
    }

    case 'replace': {
      const occurrences = countOccurrences(body, edit.find);
      if (occurrences === 0) {
        throw new AknoError('invalid', `nothing to replace: the page does not contain that text`, {
          find: edit.find.slice(0, 120),
        });
      }
      if (occurrences > 1) {
        // Replacing the first of several is a coin flip about which line the
        // caller meant, and the wrong guess edits a line nobody was looking at.
        throw new AknoError(
          'invalid',
          `that text appears ${occurrences} times — include enough context to identify one`,
          { find: edit.find.slice(0, 120), occurrences },
        );
      }
      return endWithNewline(body.replace(edit.find, edit.with));
    }

    case 'patch':
      return endWithNewline(applyUnifiedDiff(body, edit.patch));
  }
}

const LIST_ITEM = /^\s*(?:[-*+]\s|\d+[.)]\s)/;

/**
 * Appends at the end of a heading's section — after its last line, before the next heading at
 * the same level or above.
 *
 * A page has structure and its author put it there. A claim about rent belongs under `## Rent`,
 * and appending it to the end of the file instead puts it under whatever heading happens to be
 * last, where a reader will attribute it to the wrong subject. That is not hypothetical: the
 * host's tool advertised this and the schema silently dropped it, so every heading-scoped
 * append had been landing at the bottom of the page.
 *
 * Absent or ambiguous is an error, matching `replace`. A caller that named a heading had one in
 * mind, and the alternative to saying so is picking one of several and being quietly wrong.
 */
function appendUnderHeading(body: string, section: string, text: string): string {
  const wanted = section
    .trim()
    .replace(/^#+\s*/, '')
    .toLowerCase();
  const lines = body.split('\n');

  const matches: { index: number; level: number }[] = [];
  lines.forEach((line, index) => {
    const heading = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (heading && heading[2]!.toLowerCase() === wanted) {
      matches.push({ index, level: heading[1]!.length });
    }
  });

  if (matches.length === 0) {
    throw new AknoError('invalid', `the page has no heading called "${section}"`, { section });
  }
  if (matches.length > 1) {
    throw new AknoError(
      'invalid',
      `"${section}" appears ${matches.length} times on this page — append without a section, or patch`,
      { section, occurrences: matches.length },
    );
  }

  const { index, level } = matches[0]!;

  // The section runs to the next heading at the same level or shallower. A deeper one is part
  // of this section, and stopping at it would insert above content that belongs above.
  let end = lines.length;
  for (let i = index + 1; i < lines.length; i++) {
    const heading = /^(#{1,6})\s/.exec(lines[i]!);
    if (heading && heading[1]!.length <= level) {
      end = i;
      break;
    }
  }

  // Back over the blank lines that separate this section from the next, so the insertion lands
  // against the section's own content rather than against the following heading.
  let at = end;
  while (at > index + 1 && lines[at - 1]!.trim() === '') at--;

  // A blank line separates two paragraphs and *breaks* a list — Markdown reads a gap between
  // items as a loose list and renders every item wrapped in a paragraph. Appending a bullet
  // under a heading is the common case here, so the two are distinguished rather than always
  // getting a gap.
  const previous = lines[at - 1]!;
  const bothListItems = LIST_ITEM.test(previous) && LIST_ITEM.test(text.trim());
  const separator = previous.trim() === '' || bothListItems ? [] : [''];

  lines.splice(at, 0, ...separator, text.trim());
  return endWithNewline(lines.join('\n'));
}

function endWithNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function firstDifference(before: string, after: string): number | null {
  if (before === after) return null;
  const a = before.split('\n');
  const b = after.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return i + 1;
  }
  return null;
}

// ─── Unified diff ───────────────────────────────────────────────────────────

/**
 * A strict unified-diff applier: every context and removal line must match the
 * file exactly, or the whole patch is refused.
 *
 * Strictness is the feature. A fuzzy applier that "finds the nearest match" will
 * eventually apply a hunk to the wrong place, and in a knowledge base that means a
 * value silently attached to the wrong subject — the exact failure Akno exists
 * to prevent. Refusing costs the caller a re-read; guessing costs correctness.
 *
 * The `@@` line numbers are treated as a hint, not as truth: agents get them wrong
 * constantly, and the context lines identify the location unambiguously anyway.
 */
export function applyUnifiedDiff(body: string, patch: string): string {
  const hunks = parseHunks(patch);
  if (hunks.length === 0) {
    throw new AknoError('invalid', 'the patch contains no @@ hunks');
  }

  const lines = body.split('\n');
  // Apply back to front so earlier hunks' line numbers stay valid.
  const located = hunks.map((hunk) => ({ hunk, at: locate(lines, hunk) }));
  located.sort((a, b) => b.at - a.at);

  for (const { hunk, at } of located) {
    const removals = hunk.lines.filter((line) => line.sign !== '+').length;
    const replacement = hunk.lines.filter((line) => line.sign !== '-').map((line) => line.text);
    lines.splice(at, removals, ...replacement);
  }

  return lines.join('\n');
}

interface Hunk {
  /** 1-based line hint from `@@ -a,b +c,d @@`. A hint only. */
  hint: number;
  lines: { sign: ' ' | '+' | '-'; text: string }[];
}

function parseHunks(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  for (const raw of patch.split('\n')) {
    const header = /^@@\s+-(\d+)(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/.exec(raw);
    if (header) {
      current = { hint: Number(header[1]), lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    // `---`/`+++` file headers, and the "\ No newline" marker, are not content.
    if (raw.startsWith('---') || raw.startsWith('+++') || raw.startsWith('\\')) continue;

    const sign = raw[0];
    if (sign === ' ' || sign === '+' || sign === '-') {
      current.lines.push({ sign, text: raw.slice(1) });
    } else if (raw.length === 0) {
      // A truly empty line in a diff is a context line for an empty line.
      current.lines.push({ sign: ' ', text: '' });
    }
  }
  return hunks.filter((hunk) => hunk.lines.length > 0);
}

/** Finds the one place a hunk's context matches, searching outward from the hint. */
function locate(lines: string[], hunk: Hunk): number {
  const expected = hunk.lines.filter((line) => line.sign !== '+').map((line) => line.text);
  if (expected.length === 0) {
    // Pure insertion: the hint is all there is to go on.
    const at = Math.min(Math.max(hunk.hint - 1, 0), lines.length);
    return at;
  }

  const matchesAt = (start: number): boolean =>
    start >= 0 &&
    start + expected.length <= lines.length &&
    expected.every((text, offset) => lines[start + offset] === text);

  const hinted = hunk.hint - 1;
  if (matchesAt(hinted)) return hinted;

  // Search outward, and require the match to be unique so an ambiguous hunk is
  // refused rather than applied to whichever copy came first.
  const found: number[] = [];
  for (let start = 0; start + expected.length <= lines.length; start++) {
    if (matchesAt(start)) found.push(start);
  }
  if (found.length === 1) return found[0]!;
  if (found.length === 0) {
    throw new AknoError('invalid', 'patch context does not match the page — re-read it and patch again', {
      expected: expected.slice(0, 3),
    });
  }
  throw new AknoError(
    'invalid',
    `patch context matches ${found.length} places — include more context to identify one`,
    { expected: expected.slice(0, 3) },
  );
}
