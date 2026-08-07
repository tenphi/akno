/**
 * The event ledger.
 *
 * **The ledger is a source file, not a rendered view.** Generating it from the
 * events index would always be tidy and correctly sorted, and it is rejected: a
 * rendered file silently discards hand edits, and the whole point of a Markdown
 * knowledge base is that hand edits are legitimate.
 *
 * So Akno maintains it **by appending only** — inserting under the right year
 * heading and never rewriting or reordering what is already there. No edit a human
 * made can be lost, and a hand-written line is indexed exactly like a generated
 * one. Automatic upkeep without the destructive part.
 *
 * Nothing about this line syntax ever reaches a prompt: there is no
 * `add_event` op). A caller hands over `{date, summary}`.
 */

export interface LedgerEvent {
  date: string;
  summary: string;
  /** The page holding the detail. Plenty of events will never have one. */
  slug?: string | null;
}

export interface LedgerInsert {
  content: string;
  /** 1-based line the new event landed on, so it can be cited as `timeline:47`. */
  line: number;
}

/** The same shape the indexer matches, used here to read dates already in place. */
const EVENT_DATE = /^\s*[-*]\s+\*\*(\d{4}-\d{2}-\d{2})\*\*\s*\|/;

export function formatEventLine(event: LedgerEvent): string {
  const summary = event.summary.trim().replace(/\s+/g, ' ');
  const link = event.slug ? ` [[${event.slug}]]` : '';
  // The bold date and the `|` are what make a line an event: the indexer matches
  // that exact shape, and prose it cannot match is invisible to search.
  return `- **${event.date}** | ${summary}${link}`;
}

/**
 * Inserts an event under its year heading, creating the heading if the year is new.
 *
 * Placement within a year is newest-first, but only among lines Akno can read as
 * events — an unparseable line a human wrote is stepped over, never reordered
 * around. If the year heading is absent it is added in the right place among the
 * other year headings, so a ledger stays readable without anything being rewritten.
 */
export function insertEvent(content: string, event: LedgerEvent): LedgerInsert {
  const line = formatEventLine(event);
  const lines = content.length === 0 ? [] : content.replace(/\n$/, '').split('\n');
  const year = event.date.slice(0, 4);

  // Already present, byte for byte: appending it twice is not append-only upkeep,
  // it is duplication. The index collapses duplicates; this avoids making
  // one in the file.
  const existing = lines.indexOf(line);
  if (existing !== -1) return { content, line: existing + 1 };

  const headings = lines
    .map((text, index) => ({ text, index, year: /^##\s+(\d{4})\s*$/.exec(text)?.[1] }))
    .filter((entry): entry is { text: string; index: number; year: string } => Boolean(entry.year));

  const target = headings.find((heading) => heading.year === year);

  if (target) {
    // The block ends at the next heading, but its *content* ends before the blank
    // line that separates the years. Inserting after that blank puts the line under
    // the next year's heading as far as any reader is concerned.
    const nextHeading = nextHeadingIndex(lines, target.index);
    let blockEnd = nextHeading;
    while (blockEnd > target.index + 1 && lines[blockEnd - 1]!.trim().length === 0) blockEnd--;

    let at = target.index + 1;
    while (at < blockEnd && lines[at]!.trim().length === 0) at++;

    // Newest first, by date, among the lines Akno can read as events. A
    // backdated entry — last week's appointment recorded today — belongs below
    // the newer ones, and putting it at the top would make the ledger wrong in a
    // way nobody notices until they read it.
    //
    // Still pure insertion: an unparseable line a human wrote is stepped over,
    // never moved, so "never rewrites or reorders" holds.
    for (let i = at; i < blockEnd; i++) {
      const existingDate = EVENT_DATE.exec(lines[i]!)?.[1];
      if (existingDate && existingDate < event.date) {
        at = i;
        break;
      }
      if (i === blockEnd - 1) at = blockEnd;
    }

    lines.splice(at, 0, line);
    return { content: `${lines.join('\n')}\n`, line: at + 1 };
  }

  // A new year. Newer years go above older ones, matching newest-first.
  const laterHeading = headings.find((heading) => heading.year < year);
  const insertAt = laterHeading ? laterHeading.index : lines.length;
  const block = [`## ${year}`, line];
  // Keep one blank line between year blocks, and none at the very top of a file
  // that is only a header.
  const needsGapBefore = insertAt > 0 && lines[insertAt - 1]!.trim().length > 0;
  const needsGapAfter = insertAt < lines.length;
  lines.splice(insertAt, 0, ...(needsGapBefore ? [''] : []), ...block, ...(needsGapAfter ? [''] : []));

  return {
    content: `${lines.join('\n')}\n`,
    line: insertAt + (needsGapBefore ? 1 : 0) + 2,
  };
}

function nextHeadingIndex(lines: string[], from: number): number {
  for (let i = from + 1; i < lines.length; i++) {
    if (/^##?\s+/.test(lines[i]!)) return i;
  }
  return lines.length;
}

/**
 * The header a ledger gets when a write has to create it. Startup creates this on
 * startup only when asked; an event write creates it because the caller asked for
 * an event and there is nowhere else to put it.
 */
export function newLedger(year: string): string {
  return (
    `---\ntype: timeline\ntitle: Timeline\n---\n\n# Timeline\n\n` +
    `What actually happened, newest first. One line per event; the detail lives on the linked\n` +
    `page, so this stays an index and never a second copy of a fact.\n\n` +
    `Append-only: never edit or remove a line, correct it with a new one. Each line reads\n` +
    `\`- **YYYY-MM-DD** | what happened. [[page/with/detail]]\` — that exact shape is what\n` +
    `makes a line an event, and prose Akno cannot match is invisible to search.\n\n` +
    `## ${year}\n`
  );
}
