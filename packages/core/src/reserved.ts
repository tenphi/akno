import fs from 'node:fs';
import type { AknoConfig } from './config/schema.ts';

/**
 * Reserved paths. Almost everything in a knowledge base is the user's; this
 * is the whole list of what is not, and the rule that governs all of it is the
 * same: **if a reserved path already exists and isn't what Akno expects, leave
 * it completely alone.**
 *
 * Both `open()` (which refuses to start rather than adopt one) and `doctor`
 * (which reports it) need the same predicate, and two copies that could disagree
 * about whether a file is a ledger is exactly the bug worth not having.
 */

/**
 * The ledger's slug — `timeline.md` becomes `timeline`.
 *
 * One derivation, three callers. It used to be written out separately in the write path and
 * in the indexer, which is two chances to disagree about which page is the ledger, and
 * whichever one was wrong would be wrong silently.
 */
export function ledgerSlug(config: AknoConfig): string {
  return stripExtension(config.paths.timeline);
}

/**
 * **Every slug prefix a caller must not aim a page write at.**
 *
 * These are Akno's own structures, not the user's notes: the ledger is maintained by
 * `insertEvent` and nothing else, the inbox is a queue that empties itself, observations are
 * written by the cycle with their own evidence, and the journal is a record of what happened.
 * A claim landing on any of them is a claim in a file whose shape means something specific —
 * and on the ledger, where prose is invisible to the event parser, it is a claim in a file
 * that will never be read back.
 */
export function reservedSlugs(config: AknoConfig): string[] {
  return [
    ledgerSlug(config),
    stripExtension(config.paths.inbox),
    stripExtension(config.paths.observations),
    stripExtension(config.paths.journal),
  ].filter((slug) => slug.length > 0);
}

/** True when `slug` is a reserved path or lives underneath one. */
export function isReserved(slug: string, config: AknoConfig): boolean {
  return reservedSlugs(config).some((reserved) => slug === reserved || slug.startsWith(`${reserved}/`));
}

function stripExtension(relPath: string): string {
  return relPath.replace(/\.(md|markdown)$/i, '').replace(/\/+$/, '');
}

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
