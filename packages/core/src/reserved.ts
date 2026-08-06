import fs from 'node:fs';

/**
 * §4. Reserved paths. Almost everything in a knowledge base is the user's; this
 * is the whole list of what is not, and the rule that governs all of it is the
 * same: **if a reserved path already exists and isn't what Akno expects, leave
 * it completely alone.**
 *
 * Both `open()` (which refuses to start rather than adopt one) and `doctor`
 * (which reports it) need the same predicate, and two copies that could disagree
 * about whether a file is a ledger is exactly the bug worth not having.
 */

/**
 * An event ledger has event lines in it. A project plan someone happens to have
 * called `timeline.md` does not, and appending `- **2026-08-06** | …` into the
 * middle of their document is not a recoverable mistake.
 */
export function looksLikeLedger(absPath: string): boolean {
  try {
    const head = fs.readFileSync(absPath, 'utf8').slice(0, 8000);
    return /^\s*[-*]\s+\*\*\d{4}-\d{2}-\d{2}\*\*\s*\|/m.test(head) || /^#\s*Timeline/im.test(head);
  } catch {
    // Unreadable is not the same as "wrong shape". The indexer reports read
    // failures; refusing to start over one would be the wrong call.
    return true;
  }
}
