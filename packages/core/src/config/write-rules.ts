import type { FolderRuleDoc } from './schema.ts';

/**
 * **Adding a folder rule to `<akno_path>/akno.json` without rewriting the file.**
 *
 * This is the one config file Akno writes, and it is also the one config file that lives
 * inside the user's own folder — a git repo under active hand editing, full of comments
 * explaining why each rule is what it is. Parsing it and stringifying it back would produce
 * valid JSON and destroy all of that: the explanation of why `conversations/**` is reference
 * material is worth more than the rule it annotates, because the rule can be re-derived and
 * the reasoning cannot.
 *
 * So this is a **textual insert**. It finds the `folders` block, works out where the block
 * ends, and puts new lines there. Every other byte in the file is carried through untouched,
 * which also means a `git diff` after an agent declares a folder is one hunk that a person
 * can read.
 *
 * The parsing here is deliberately narrow: enough to locate one top-level key's object and
 * its matching brace while respecting strings and comments, and nothing more. A general
 * JSONC editor is a much larger thing to get right, and every part of it beyond this would
 * be unused.
 */

export interface FolderEntry {
  /** The glob as it will appear as a key, e.g. `research/**`. */
  glob: string;
  rule: FolderRuleDoc;
}

const HEADER = `{
  // Rules for this knowledge base. Akno reads this file from the root of the notes,
  // so the taxonomy travels with the folder rather than living in a machine's config.
  //
  // Three classes. \`full\` is the default and needs no entry here:
  //   full       indexed, recall returns matching lines, mined for facts
  //   reference  indexed and searchable, quoted in a capped window, never mined for facts
  //   excluded   not indexed at all
  //
  // \`description\` says what belongs in the folder. It is the field a caller reads before
  // filing a page, so it is worth writing for a reader who has never seen this base.
  "folders": {
  }
}
`;

/**
 * Returns the file's new text with `entry` added to its `folders` block.
 *
 * `source` is null when the file does not exist yet, in which case a commented skeleton is
 * created around the entry — the same explanation a person would otherwise have to go and
 * find in the docs.
 *
 * Throws when the file exists but has no `folders` block to add to, rather than inventing
 * one at a guess: a file shaped differently than expected is a file somebody meant something
 * by.
 */
export function addFolderRule(source: string | null, entry: FolderEntry): string {
  const text = source ?? HEADER;
  const block = findObjectValue(text, 'folders');
  if (!block) {
    throw new Error('akno.json has no `folders` block to add a rule to');
  }

  const indent = `${indentOfLineAt(text, block.close)}  `;
  const lines = renderEntry(entry, indent);

  // The end of the previous rule, or the opening brace when there is none. `{` means the
  // block is empty and `,` means the previous entry already ends in one; anything else is the
  // end of a rule and needs a comma before another can follow it.
  const lastMeaningful = lastMeaningfulOffset(text, block.open + 1, block.close);
  const needsComma = text[lastMeaningful] !== '{' && text[lastMeaningful] !== ',';
  const comma = needsComma ? ',' : '';

  const head = text.slice(0, lastMeaningful + 1);

  // A closing brace sharing its line with content (`"folders": {}`) has no line of its own to
  // insert before, so the entry is opened onto one.
  if (!isFirstOnItsLine(text, block.close)) {
    return `${head}${comma}\n${lines}\n${indent.slice(2)}${text.slice(block.close)}`;
  }

  // Everything between the last rule and the closing brace's line is carried across verbatim:
  // it is usually a comment about the rule above it, and moving it would silently reattach it
  // to ours.
  const between = text.slice(lastMeaningful + 1, startOfLineAt(text, block.close));
  const rest = text.slice(startOfLineAt(text, block.close));
  return `${head}${comma}${between}${lines}\n${rest}`;
}

/** True when `folders` already has a rule under exactly this glob. */
export function hasFolderRule(folders: Record<string, unknown> | undefined, glob: string): boolean {
  return folders !== undefined && Object.prototype.hasOwnProperty.call(folders, glob);
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function renderEntry(entry: FolderEntry, indent: string): string {
  const fields = Object.entries(entry.rule)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${indent}  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);

  // A one-line rule reads fine, but `description` is a sentence — every real entry is
  // multi-line, so they all are, and the file stays uniform.
  return [`${indent}${JSON.stringify(entry.glob)}: {`, fields.join(',\n'), `${indent}}`].join('\n');
}

// ─── The narrow JSONC scan ──────────────────────────────────────────────────

interface ObjectSpan {
  /** Offset of the value's opening `{`. */
  open: number;
  /** Offset of its matching `}`. */
  close: number;
}

/**
 * Finds a key at the root object's own depth and the object it maps to.
 *
 * Depth-aware on purpose: a nested `"folders"` under some other key is not the one being
 * asked for, and a match inside a string or a comment is not a key at all.
 */
function findObjectValue(text: string, key: string): ObjectSpan | null {
  const wanted = JSON.stringify(key);
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }

    const ch = text[i];
    if (ch === '{' || ch === '[') {
      depth++;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth--;
      continue;
    }
    if (ch !== '"') continue;

    // Every string is stepped over, at every depth. A `slug_pattern` of `"^{a}$"` read
    // character by character would take the depth counter with it.
    const end = endOfString(text, i);
    if (depth !== 1 || text.slice(i, end) !== wanted) {
      i = end - 1;
      continue;
    }

    const colon = nextCode(text, end);
    if (colon === null || text[colon] !== ':') {
      i = end - 1;
      continue;
    }
    const open = nextCode(text, colon + 1);
    if (open === null || text[open] !== '{') return null;

    const close = matchingBrace(text, open);
    return close === null ? null : { open, close };
  }

  return null;
}

/** The offset after any comment or whitespace starting at `i`; `i` itself when there is none. */
function skipNonCode(text: string, i: number): number {
  if (text[i] === '/' && text[i + 1] === '/') {
    let j = i + 2;
    while (j < text.length && text[j] !== '\n') j++;
    return j;
  }
  if (text[i] === '/' && text[i + 1] === '*') {
    let j = i + 2;
    while (j < text.length - 1 && !(text[j] === '*' && text[j + 1] === '/')) j++;
    return Math.min(j + 2, text.length);
  }
  return i;
}

function endOfString(text: string, quote: number): number {
  let i = quote + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === '"') return i + 1;
    i++;
  }
  return text.length;
}

/** The next offset holding something that is not whitespace and not a comment. */
function nextCode(text: string, from: number): number | null {
  let i = from;
  while (i < text.length) {
    if (/\s/.test(text[i]!)) {
      i++;
      continue;
    }
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    return i;
  }
  return null;
}

function matchingBrace(text: string, open: number): number | null {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }
    const ch = text[i];
    if (ch === '"') {
      i = endOfString(text, i) - 1;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}

/**
 * The last offset inside the block that is neither whitespace nor comment — the end of the
 * previous rule, or the opening brace when there is no previous rule.
 *
 * Scanned forwards rather than backwards: a `//` comment can only be recognised from its
 * start, so reading the file in reverse would mistake the contents of a trailing comment for
 * code — which is exactly the case that needs handling, a note written under the last rule.
 */
function lastMeaningfulOffset(text: string, from: number, until: number): number {
  let last: number | null = null;
  let i = from;
  while (i < until) {
    if (/\s/.test(text[i]!)) {
      i++;
      continue;
    }
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    if (text[i] === '"') {
      const end = endOfString(text, i);
      last = end - 1;
      i = end;
      continue;
    }
    last = i;
    i++;
  }
  return last ?? from - 1;
}

function startOfLineAt(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

function isFirstOnItsLine(text: string, offset: number): boolean {
  return text.slice(startOfLineAt(text, offset), offset).trim().length === 0;
}

function indentOfLineAt(text: string, offset: number): string {
  const line = text.slice(startOfLineAt(text, offset), offset);
  return /^[ \t]*/.exec(line)![0];
}
