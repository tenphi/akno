import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import type { DreamReport } from './dream.ts';
import type { FileAction } from '../write/journal.ts';

/**
 * An audit trail of what the maintenance cycle did, written only when asked for.
 *
 * The journal in `akno.db` already holds the bytes of every change and can undo them, so this
 * is not a second copy of the truth. It records the things the journal cannot: what the cycle
 * *considered*, which guardrail refused it, which phase was skipped and why, and what it left
 * alone deliberately. That is the difference between "a page appeared last night" and
 * understanding the reasoning that put it there.
 *
 * **Off by default, and the flag is the whole point.** A knowledge base is somebody's private
 * notes; a verbose log of inferences drawn from them is a second copy of the sensitive part,
 * outside the notes, that nobody asked for. Turning it on is a decision, and it belongs to
 * whoever owns the notes — not to a default that seemed useful while debugging.
 *
 * One JSON object per run, appended. JSONL rather than a formatted log because the interesting
 * queries are structural — "every observation the model proposed that a guard refused, over two
 * weeks" is `jq`, not `grep`.
 */

export interface AppliedChange {
  phase: string;
  relPath: string;
  action: FileAction;
  /**
   * The lines this write added. For the cycle that is the whole content, because every write it
   * makes is append-only or a new file — it never rewrites an existing line, so "what is in
   * `after` and not in `before`" is exact rather than an approximation of a diff.
   */
  added: string[];
}

export function addedLines(before: string | null, after: string): string[] {
  const lines = after.split('\n');
  // The trailing newline every write ends with is not a line anybody added.
  while (lines.at(-1) === '') lines.pop();
  if (before === null) return lines;
  const had = new Set(before.split('\n'));
  return lines.filter((line) => line.length > 0 && !had.has(line));
}

/** The file the records go to. Reported back on the run, so a caller can say where to look. */
function dreamLogPath(ctx: AknoContext): string {
  return path.join(ctx.config.logDir, 'dream.jsonl');
}

/**
 * Appends one record for the run. Never throws: a cycle that failed because its own log file
 * was unwritable would be a maintenance pass defeated by its own instrumentation.
 */
export async function logDreamRun(
  ctx: AknoContext,
  report: DreamReport,
  changes: AppliedChange[],
  options: { dryRun: boolean; changeIds: readonly string[] },
): Promise<string | null> {
  const plans =
    report.maintenancePlans.length > 0
      ? report.maintenancePlans
      : report.maintenancePlan
        ? [report.maintenancePlan]
        : [];
  const record = {
    at: new Date().toISOString(),
    runId: report.run.id,
    snapshot: report.run.snapshot,
    dryRun: options.dryRun,
    durationMs: report.durationMs,
    // Which model actually answered. Worth a line of its own: the tiers' output is largely a
    // function of this, and a night that produced nothing useful is a different problem
    // depending on whether the strong model was reachable at all.
    model: ctx.config.maintenance.model?.id ?? ctx.config.models.derive.id,
    modelUsage: report.modelUsage,
    semanticMerge: report.semanticMerge,
    verification: report.verification,
    conflictRefresh: report.conflictRefresh,
    autoEstimate: report.autoEstimate ?? null,
    degraded: report.degraded,
    phases: report.phases,
    changeIds: [...options.changeIds],
    maintenancePlanIds: plans.map((plan) => plan.id),
    maintenancePlanId: report.maintenancePlan?.id ?? null,
    // What was written, with the added lines inline.
    applied: changes,
    // What was proposed and refused, which is where the reasoning shows.
    observations: report.observations,
    curated: report.curated,
    rejected: report.rejected,
    adopted: report.adopted,
    conflicts: report.conflicts,
    housekeeping: report.housekeeping,
    warnings: report.warnings,
  };

  const target = dreamLogPath(ctx);
  try {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.appendFile(target, `${JSON.stringify(record)}\n`, 'utf8');
    return target;
  } catch (error) {
    report.warnings.push(
      `the cycle ran but its log could not be written to ${target}: ${(error as Error).message}`,
    );
    return null;
  }
}
