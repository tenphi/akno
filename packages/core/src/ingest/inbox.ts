import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { effectiveRule } from '../rules/compile.ts';
import { ingestFile } from '../ops/ingest.ts';

/**
 * **The inbox: a folder where you drop anything and it files itself.**
 *
 * ```jsonc
 * "inbox/**": { "ingest": "auto", "route": true }
 * ```
 *
 * `route: true` is what makes it an inbox rather than just a folder. On arrival Akno
 * extracts, names, summarizes, and then **routes** — the same recall-based routing
 * `remember` uses, against the same threshold. Above it, the file and its page move
 * there. Below it, the file **stays in the inbox** with a proposal attached.
 *
 * That failure mode is deliberate: an unrouted file sits visibly where you dropped it,
 * rather than being filed confidently into the wrong place, where you would never look
 * for it. **An inbox with three things in it is a to-do list. A misfiled document is a
 * lost one.**
 *
 * **The inbox is the only place Akno moves files.** A file dropped straight into
 * `documents/` was put there on purpose; Akno will name it, page it and index it, but
 * never relocate it. Automatic filing is opt-in per folder, every move is journalled and
 * reported in `doctor`, and every one is reversible with `undo`.
 */

export interface InboxResult {
  /** Files that found a home and moved out. */
  filed: { source: string; slug: string }[];
  /** Files still sitting in the inbox, each with the reason. */
  waiting: { source: string; reason: string; proposalId?: string }[];
  /** Files skipped by rule or because they are not documents at all. */
  skipped: { source: string; reason: string }[];
}

/**
 * Folders that behave as an inbox: the reserved `inbox/`, plus any folder whose rule
 * carries `route: true`.
 *
 * The reserved one is always included, not used as a fallback. Akno *creates* it on
 * startup with a README saying its contents are extracted, named and routed — so a user
 * declaring a second inbox somewhere else must not silently turn the first one into a
 * folder that quietly accumulates files nobody looks at again.
 */
function inboxFolders(ctx: AknoContext): string[] {
  const folders = new Set<string>([ctx.config.paths.inbox]);
  for (const rule of ctx.config.rules) {
    if (rule.route !== true) continue;
    // `inbox/**` → `inbox`. A rule's glob is how the folder is named, so an inbox is
    // wherever the user said it is rather than a hardcoded path.
    const folder = rule.glob.replace(/\/\*\*?$/, '').replace(/\/$/, '');
    if (folder.length > 0 && !folder.includes('*')) folders.add(folder);
  }
  return [...folders];
}

/** True when a relative path sits inside a configured inbox. */
export function isInInbox(ctx: AknoContext, relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return inboxFolders(ctx).some((folder) => normalized === folder || normalized.startsWith(`${folder}/`));
}

/**
 * Processes everything currently sitting in the inbox. Safe to call repeatedly: a file
 * that could not be routed stays put and is simply reconsidered next time, which is what
 * makes the inbox a to-do list rather than a queue that loses things.
 */
export async function processInbox(
  ctx: AknoContext,
  options: { only?: string[]; limit?: number } = {},
): Promise<InboxResult> {
  const result: InboxResult = { filed: [], waiting: [], skipped: [] };
  const limit = options.limit ?? 50;
  let processed = 0;

  for (const folder of inboxFolders(ctx)) {
    const absFolder = path.join(ctx.config.aknoPath, folder);
    let entries: string[];
    try {
      entries = (await fsp.readdir(absFolder, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();
    } catch {
      continue; // No inbox on disk yet. Nothing to do, and nothing to report.
    }

    for (const name of entries) {
      if (processed >= limit) break;
      const relPath = `${folder}/${name}`;
      if (options.only && !options.only.includes(relPath)) continue;

      // A page written *about* an inbox item, and the README startup puts there, are not
      // arrivals to be filed.
      if (ctx.config.pageExtensions.includes(path.extname(name).toLowerCase())) {
        result.skipped.push({ source: relPath, reason: 'a Markdown page, not a dropped document' });
        continue;
      }

      const rule = effectiveRule(relPath.replace(/\.[^.]+$/, ''), ctx.config.rules);
      if (rule.ingest === 'ignore') {
        result.skipped.push({ source: relPath, reason: 'ingest: ignore' });
        continue;
      }

      processed++;
      try {
        const ingested = await ingestFile(
          ctx,
          // No `folder`: the inbox exists precisely so routing decides. Passing one would
          // make it an ordinary folder with extra steps.
          { route: true },
          {
            source: path.join(ctx.config.aknoPath, relPath),
            originalName: name,
            // The one place Akno moves files.
            move: true,
          },
        );

        if (ingested.outcome === 'ok' && ingested.slug) {
          result.filed.push({ source: relPath, slug: ingested.slug });
        } else if (ingested.outcome === 'duplicate') {
          // Already stored under another name. Leaving the copy in the inbox is the
          // honest outcome: deleting a file the user put there is not Akno's call.
          result.waiting.push({
            source: relPath,
            reason: `already stored as ${ingested.rel_path} — delete this copy if you meant to`,
          });
        } else {
          result.waiting.push({
            source: relPath,
            reason: ingested.note ?? ingested.outcome,
            ...(ingested.approval ? { proposalId: ingested.approval.proposal_id } : {}),
          });
        }
      } catch (err) {
        result.waiting.push({
          source: relPath,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
