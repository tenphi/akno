import { isDeepStrictEqual } from 'node:util';
import type { AknoContext } from '../context.ts';
import { indexScanIgnore } from '../config/load.ts';
import { hashFile, mapWithConcurrency, scanTree } from '../kb/scan.ts';
import type { DreamModelUsageReceipt } from './model-telemetry.ts';
import type { MaintenanceBudgetReceipt, MaintenanceBudgetTracker } from './budget.ts';
import {
  getMaintenancePlan,
  reverifyAppliedMaintenanceItem,
  type MaintenanceItem,
  type MaintenanceOperation,
} from './plans.ts';
import type { DreamRunFileManifest } from './runs.ts';

export type DreamRunVerificationStatus = 'passed' | 'failed';
export type DreamRunVerificationCheckStatus = DreamRunVerificationStatus | 'not_applicable' | 'not_recorded';
export type DreamRunVerificationIssueCode =
  | 'plan_unavailable'
  | 'missing_change_id'
  | 'item_verification_incomplete'
  | 'item_verification_failed'
  | 'affected_path_mismatch'
  | 'snapshot_scan_failed'
  | 'unattributed_file_change'
  | 'budget_receipt_mismatch'
  | 'model_usage_mismatch';

export interface DreamRunVerificationIssue {
  code: DreamRunVerificationIssueCode;
  count: number;
}

/** Content-safe final proof for one invocation. Paths, item ids, and verifier details stay in plans. */
export interface DreamRunVerificationReceipt {
  status: DreamRunVerificationStatus;
  checkedAt: string;
  plans: number;
  appliedItems: number;
  affectedFiles: number;
  /** Null on historical receipts and when the final filesystem scan could not complete. */
  unattributedFiles: number | null;
  checks: {
    appliedItems: DreamRunVerificationCheckStatus;
    affectedPaths: DreamRunVerificationCheckStatus;
    wholeSnapshot: DreamRunVerificationCheckStatus;
    budget: DreamRunVerificationStatus;
    modelUsage: DreamRunVerificationStatus;
  };
  issues: DreamRunVerificationIssue[];
}

/**
 * Re-run deterministic postconditions for writes attributed to this invocation after its complete
 * apply wave, then prove that the content-safe accounting matches its in-memory sources. Attached
 * plans can contain applied history from earlier invocations and must not make that history new work.
 */
export async function verifyDreamRun(
  ctx: AknoContext,
  planIds: readonly string[],
  runChangeIds: readonly string[],
  budgetTracker: MaintenanceBudgetTracker,
  budget: MaintenanceBudgetReceipt,
  modelUsage: DreamModelUsageReceipt,
  baseline: DreamRunFileManifest,
): Promise<DreamRunVerificationReceipt> {
  const issues = new Map<DreamRunVerificationIssueCode, number>();
  const uniquePlanIds = [...new Set(planIds)];
  const currentChanges = new Set(runChangeIds);
  const affectedFiles = new Set<string>();
  const currentItems = new Map<string, MaintenanceItem>();
  const applied: MaintenanceItem[] = [];
  let appliedItems = 0;
  let itemReceiptFailed = false;
  let affectedPathFailed = false;

  for (const planId of uniquePlanIds) {
    let items: MaintenanceItem[];
    try {
      items = getMaintenancePlan(ctx, planId).items;
    } catch {
      addIssue(issues, 'plan_unavailable');
      itemReceiptFailed = true;
      continue;
    }

    for (const item of items) {
      const belongsToRun = item.changeId !== null && currentChanges.has(item.changeId);
      // A reused plan can also contain failed or pending history from an earlier invocation.
      if (!belongsToRun) continue;
      currentItems.set(item.changeId!, item);
      if (item.status === 'verification_failed') {
        addIssue(issues, 'item_verification_failed');
        itemReceiptFailed = true;
        continue;
      }
      if (['approved', 'applying', 'verification_pending'].includes(item.status)) {
        addIssue(issues, 'item_verification_incomplete');
        itemReceiptFailed = true;
        continue;
      }
      if (item.status !== 'applied') continue;

      appliedItems += 1;
      applied.push(item);
      for (const operation of item.operations) addOperationPaths(affectedFiles, operation);
      if (!item.changeId) {
        addIssue(issues, 'missing_change_id');
        itemReceiptFailed = true;
      }
      if (item.verification?.status !== 'passed') {
        addIssue(issues, 'item_verification_incomplete');
        itemReceiptFailed = true;
      }
    }
  }

  // Plan order can differ from apply order after dependency scheduling or a retry wave. The
  // journal rowid is the write order; timestamps can collide within one millisecond.
  const journalChangeIds = journalOrderedChangeIds(ctx.store.db, runChangeIds);
  const journalChanges = new Set(journalChangeIds);
  for (const item of applied) {
    if (journalChanges.has(item.changeId!)) continue;
    addIssue(issues, 'missing_change_id');
    itemReceiptFailed = true;
  }
  const orderedChangeIds = [...journalChangeIds, ...runChangeIds.filter((id) => !journalChanges.has(id))];
  const superseded = supersededAppliedPaths(orderedChangeIds, applied);
  for (const item of applied) {
    const paths = new Set<string>();
    for (const operation of item.operations) addOperationPaths(paths, operation);
    const laterPaths = superseded.get(item.changeId!) ?? new Set<string>();
    // Immediate verification proved the old bytes; later applied writes now own these paths.
    if (paths.size > 0 && laterPaths.size === paths.size) continue;
    try {
      if (
        !(await reverifyAppliedMaintenanceItem(
          ctx,
          item,
          item.kind === 'managed_item' ? laterPaths : undefined,
        ))
      ) {
        addIssue(issues, 'affected_path_mismatch');
        affectedPathFailed = true;
      }
    } catch {
      addIssue(issues, 'affected_path_mismatch');
      affectedPathFailed = true;
    }
  }

  const budgetPassed = budgetReceiptMatchesTracker(budgetTracker, budget);
  if (!budgetPassed) addIssue(issues, 'budget_receipt_mismatch');
  const modelUsagePassed = modelUsageIsConsistent(modelUsage);
  if (!modelUsagePassed) addIssue(issues, 'model_usage_mismatch');

  let unattributedFiles: number | null = null;
  let wholeSnapshotPassed = true;
  try {
    const observed = await captureCurrentFileManifest(ctx);
    const itemsForAttribution = orderedChangeIds.flatMap((id) => {
      const item = currentItems.get(id);
      return item ? [item] : [];
    });
    unattributedFiles = countUnattributedFileChanges(baseline, observed, itemsForAttribution);
    if (unattributedFiles > 0) {
      addIssue(issues, 'unattributed_file_change', unattributedFiles);
      wholeSnapshotPassed = false;
    }
  } catch {
    addIssue(issues, 'snapshot_scan_failed');
    wholeSnapshotPassed = false;
  }

  return {
    status: issues.size === 0 ? 'passed' : 'failed',
    checkedAt: new Date().toISOString(),
    plans: uniquePlanIds.length,
    appliedItems,
    affectedFiles: affectedFiles.size,
    unattributedFiles,
    checks: {
      appliedItems:
        appliedItems === 0 && !itemReceiptFailed ? 'not_applicable' : itemReceiptFailed ? 'failed' : 'passed',
      affectedPaths:
        appliedItems === 0 && !affectedPathFailed
          ? 'not_applicable'
          : affectedPathFailed
            ? 'failed'
            : 'passed',
      wholeSnapshot: wholeSnapshotPassed ? 'passed' : 'failed',
      budget: budgetPassed ? 'passed' : 'failed',
      modelUsage: modelUsagePassed ? 'passed' : 'failed',
    },
    issues: [...issues].map(([code, count]) => ({ code, count })),
  };
}

/** SQLite rowid records actual application order even when plans are later reported out of order. */
export function journalOrderedChangeIds(
  db: AknoContext['store']['db'],
  changeIds: readonly string[],
): string[] {
  if (changeIds.length === 0) return [];
  return (
    db
      .prepare(`SELECT id FROM changes WHERE id IN (${changeIds.map(() => '?').join(', ')}) ORDER BY rowid`)
      .all(...changeIds) as { id: string }[]
  ).map((row) => row.id);
}

/** A rollback or historical plan item never supersedes a path from this run. */
export function supersededAppliedPaths(
  changeIds: readonly string[],
  items: readonly Pick<MaintenanceItem, 'changeId' | 'status' | 'operations'>[],
): Map<string, Set<string>> {
  const byChange = new Map(
    items.filter((item) => item.status === 'applied' && item.changeId).map((item) => [item.changeId!, item]),
  );
  const laterPaths = new Set<string>();
  const result = new Map<string, Set<string>>();
  for (const id of [...changeIds].reverse()) {
    const item = byChange.get(id);
    if (!item) continue;
    const paths = new Set<string>();
    for (const operation of item.operations) addOperationPaths(paths, operation);
    result.set(id, new Set([...paths].filter((path) => laterPaths.has(path))));
    for (const path of paths) laterPaths.add(path);
  }
  return result;
}

/**
 * Compare the observed tree with the run baseline plus every sealed write that reached disk.
 * Paths touched by a failed item remain that item's responsibility; they are not also blamed on
 * an unrelated user or sync-client edit.
 */
export function countUnattributedFileChanges(
  baseline: DreamRunFileManifest,
  observed: DreamRunFileManifest,
  items: readonly Pick<MaintenanceItem, 'status' | 'changeId' | 'operations'>[],
): number {
  const expected = new Map(baseline);
  const itemOwnedPaths = new Set<string>();

  for (const item of items) {
    const reachedDisk = item.status === 'applied' || item.status === 'verification_pending';
    const ownsPath = reachedDisk || item.changeId !== null;
    for (const operation of item.operations) {
      if (ownsPath) addOperationPaths(itemOwnedPaths, operation);
      if (reachedDisk) applyExpectedOperation(expected, operation);
    }
  }

  const paths = new Set([...expected.keys(), ...observed.keys()]);
  let unattributed = 0;
  for (const relPath of paths) {
    if (expected.get(relPath) === observed.get(relPath)) continue;
    if (!itemOwnedPaths.has(relPath)) unattributed += 1;
  }
  return unattributed;
}

export function budgetReceiptMatchesTracker(
  tracker: MaintenanceBudgetTracker,
  receipt: MaintenanceBudgetReceipt,
): boolean {
  const expected: MaintenanceBudgetReceipt = {
    limits: { ...tracker.limits },
    used: {
      items: tracker.items,
      filesChanged: tracker.files.size,
      bytesWritten: tracker.bytesWritten,
      highRiskItems: tracker.highRiskItems,
    },
    deferredItems: tracker.deferredItems,
  };
  return isDeepStrictEqual(expected, receipt) && budgetValuesAreValid(receipt);
}

export function modelUsageIsConsistent(usage: DreamModelUsageReceipt): boolean {
  if (!usageValuesAreValid(usage)) return false;
  if (usage.successfulCalls + usage.failedCalls !== usage.calls) return false;
  if (usage.usageReportedCalls > usage.calls) return false;
  if (new Set(usage.stages.map((stage) => stage.stage)).size !== usage.stages.length) return false;

  const summed = {
    calls: sum(usage.stages.map((stage) => stage.calls)),
    successfulCalls: sum(usage.stages.map((stage) => stage.successfulCalls)),
    failedCalls: sum(usage.stages.map((stage) => stage.failedCalls)),
    usageReportedCalls: sum(usage.stages.map((stage) => stage.usageReportedCalls)),
    inputTokens: sumNullable(usage.stages.map((stage) => stage.inputTokens)),
    outputTokens: sumNullable(usage.stages.map((stage) => stage.outputTokens)),
    totalTokens: sumNullable(usage.stages.map((stage) => stage.totalTokens)),
    latencyMs: sum(usage.stages.map((stage) => stage.latencyMs)),
  };
  if (summed.calls !== usage.calls) return false;
  if (summed.successfulCalls !== usage.successfulCalls) return false;
  if (summed.failedCalls !== usage.failedCalls) return false;
  if (summed.usageReportedCalls !== usage.usageReportedCalls) return false;
  if (summed.inputTokens !== usage.inputTokens) return false;
  if (summed.outputTokens !== usage.outputTokens) return false;
  if (summed.totalTokens !== usage.totalTokens) return false;
  // Each stage and the total round independently, so their integer sums can differ slightly.
  return Math.abs(summed.latencyMs - usage.latencyMs) <= Math.max(1, usage.stages.length);
}

function addIssue(
  issues: Map<DreamRunVerificationIssueCode, number>,
  code: DreamRunVerificationIssueCode,
  count = 1,
): void {
  issues.set(code, (issues.get(code) ?? 0) + count);
}

async function captureCurrentFileManifest(ctx: AknoContext): Promise<Map<string, string>> {
  const files = await scanTree({
    root: ctx.config.aknoPath,
    ignore: indexScanIgnore(ctx.config.ignore),
    pageExtensions: ctx.config.pageExtensions,
    maxPageBytes: ctx.config.maxPageBytes,
  });
  await mapWithConcurrency(files, ctx.config.index.hashConcurrency, async (file) => {
    file.sha256 = await hashFile(file.absPath);
  });
  return new Map(files.map((file) => [file.relPath, file.sha256!]));
}

function addOperationPaths(paths: Set<string>, operation: MaintenanceOperation): void {
  paths.add(operation.relPath);
  if (operation.type === 'move') paths.add(operation.toRelPath);
}

function applyExpectedOperation(expected: Map<string, string>, operation: MaintenanceOperation): void {
  if (operation.type === 'delete') {
    expected.delete(operation.relPath);
    return;
  }
  if (operation.type === 'move') {
    expected.delete(operation.relPath);
    expected.set(operation.toRelPath, operation.beforeHash);
    return;
  }
  expected.set(operation.relPath, operation.afterHash);
}

function budgetValuesAreValid(receipt: MaintenanceBudgetReceipt): boolean {
  const pairs = [
    [receipt.used.items, receipt.limits.maxItems],
    [receipt.used.filesChanged, receipt.limits.maxFilesChanged],
    [receipt.used.bytesWritten, receipt.limits.maxBytesWritten],
    [receipt.used.highRiskItems, receipt.limits.maxHighRiskItems],
  ];
  return (
    pairs.every(
      ([used, limit]) => nonnegativeInteger(used!) && nonnegativeInteger(limit!) && used! <= limit!,
    ) && nonnegativeInteger(receipt.deferredItems)
  );
}

function usageValuesAreValid(usage: DreamModelUsageReceipt): boolean {
  const entries = [usage, ...usage.stages];
  return entries.every(
    (entry) =>
      nonnegativeInteger(entry.calls) &&
      nonnegativeInteger(entry.successfulCalls) &&
      nonnegativeInteger(entry.failedCalls) &&
      entry.successfulCalls + entry.failedCalls === entry.calls &&
      nonnegativeInteger(entry.usageReportedCalls) &&
      entry.usageReportedCalls <= entry.calls &&
      nullableNonnegativeInteger(entry.inputTokens) &&
      nullableNonnegativeInteger(entry.outputTokens) &&
      nullableNonnegativeInteger(entry.totalTokens) &&
      nonnegativeInteger(entry.latencyMs),
  );
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function nullableNonnegativeInteger(value: number | null): boolean {
  return value === null || nonnegativeInteger(value);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumNullable(values: (number | null)[]): number | null {
  return values.every((value) => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
