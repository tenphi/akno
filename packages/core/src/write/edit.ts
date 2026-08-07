import { AknoError } from '@akno/protocol';
import { parseFrontmatter } from '../kb/frontmatter.ts';

/**
 * The four ways `write` can change a body, and the rule they all obey: **never
 * touch the frontmatter.** Every key except `id` is preserved byte for
 * byte, so every edit here operates on the body and splices it back under the
 * original head.
 */

export type BodyEdit =
  | { kind: 'content'; content: string }
  | { kind: 'append'; text: string }
  | { kind: 'patch'; patch: string }
  | { kind: 'replace'; find: string; with: string };

export interface EditResult {
  content: string;
  /** Lines that changed, for the journal summary and the write report. */
  firstChangedLine: number | null;
}

export function applyEdit(original: string, edit: BodyEdit): EditResult {
  const frontmatter = parseFrontmatter(original);
  const head = original.slice(0, frontmatter.bodyOffset);
  const body = original.slice(frontmatter.bodyOffset);

  const nextBody = editBody(body, edit);
  const content = head + nextBody;
  return { content, firstChangedLine: firstDifference(original, content) };
}

function editBody(body: string, edit: BodyEdit): string {
  switch (edit.kind) {
    case 'content':
      return endWithNewline(edit.content);

    case 'append': {
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
