import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { quarantineReasonsForPath } from '../index/page-quarantine.ts';
import { owningTimeline, selectTimelines, timelineCatalog } from '../timeline/boundaries.ts';
import { restoreFile, writeFileAtomic } from '../write/atomic.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { normalizeTimelineLedger, retainedLedgerStages } from '../write/retained-timeline-ledger.ts';

export interface RetainedTimelineLedgerReport {
  status: 'ok';
  scannedPages: number;
  changedPaths: string[];
  applied: boolean;
  changeId: string | null;
}

/** Explicit, previewable reconciliation; ordinary index passes never rewrite Markdown. */
export async function migrateRetainedTimelineLedgers(
  ctx: AknoContext,
  options: { apply?: boolean; timeline?: string } = {},
): Promise<RetainedTimelineLedgerReport> {
  const catalog = timelineCatalog(ctx.config, ctx.store);
  const selected = options.timeline
    ? new Set(selectTimelines(catalog, options.timeline).map((entry) => entry.slug))
    : null;
  const pages = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.slug, p.rel_path
       FROM managed_memory_entries m JOIN pages p ON p.id = m.source_page
      ORDER BY p.slug`,
    )
    .all() as { slug: string; rel_path: string }[];
  const relevantPages = selected
    ? pages.filter((page) => selected.has(owningTimeline(catalog, page.slug).slug))
    : pages;
  const edits: { slug: string; before: string; after: string }[] = [];
  for (const page of relevantPages) {
    if (quarantineReasonsForPath(ctx.store, page.rel_path).length > 0)
      throw new AknoError('conflict', `${page.slug} is quarantined; repair it before reconciling timelines`);
    const content = await fsp.readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8').catch(() => {
      throw new AknoError(
        'unavailable',
        `${page.slug} cannot be read; re-index before reconciling timelines`,
      );
    });
    edits.push({ slug: page.slug, before: content, after: content });
  }
  const stages = (
    await retainedLedgerStages(ctx, edits, {
      reconcileAll: true,
      ...(options.timeline ? { timeline: options.timeline } : {}),
    })
  ).map((stage) => ({
    ...stage,
    after: normalizeTimelineLedger(stage.after),
  }));
  if (options.apply && stages.length > 0) {
    const files: ChangeFile[] = [];
    let changeId: string;
    try {
      for (const stage of stages)
        files.push(fileEntry(await writeFileAtomic(ctx.config.aknoPath, stage.relPath, stage.after)));
      changeId = ctx.journal.record({
        actor: ctx.actor,
        op: 'migrate',
        summary: `reconciled ${stages.length} retained timeline ledger(s)`,
        files,
      });
    } catch (error) {
      for (const file of [...files].reverse())
        await restoreFile(ctx.config.aknoPath, file.relPath, file.before);
      throw error;
    }
    await ctx.indexer.runForeground({ only: stages.map((stage) => stage.relPath), modelPaths: [] });
    return {
      status: 'ok',
      scannedPages: relevantPages.length,
      changedPaths: stages.map((stage) => stage.relPath),
      applied: true,
      changeId,
    };
  }
  return {
    status: 'ok',
    scannedPages: relevantPages.length,
    changedPaths: stages.map((stage) => stage.relPath),
    applied: false,
    changeId: null,
  };
}
