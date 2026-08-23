import type { MaintenanceLimits } from '../config/schema.ts';

export type MaintenanceBudgetDimension =
  'max_items' | 'max_files_changed' | 'max_bytes_written' | 'max_high_risk_items';

export interface MaintenanceBudgetUsage {
  items: number;
  filesChanged: number;
  bytesWritten: number;
  highRiskItems: number;
}

export interface MaintenanceBudgetReceipt {
  limits: MaintenanceLimits;
  used: MaintenanceBudgetUsage;
  deferredItems: number;
}

export interface MaintenanceBudgetTracker {
  limits: MaintenanceLimits;
  items: number;
  files: Set<string>;
  bytesWritten: number;
  highRiskItems: number;
  deferredItems: number;
}

export interface MaintenanceBudgetItem {
  risk: 'low' | 'medium' | 'high';
  operations: { type: 'replace' | 'create' | 'delete'; relPath: string; after?: string }[];
  /** Logical independently drafted transformations in one atomic item. Defaults to one. */
  items?: number;
}

export interface MaintenanceBudgetExceeded {
  dimension: MaintenanceBudgetDimension;
  used: number;
  item: number;
  limit: number;
}

export type MaintenanceBudgetDecision =
  { allowed: true } | { allowed: false; exceeded: MaintenanceBudgetExceeded[] };

export function createMaintenanceBudget(limits: MaintenanceLimits): MaintenanceBudgetTracker {
  return {
    limits: { ...limits },
    items: 0,
    files: new Set<string>(),
    bytesWritten: 0,
    highRiskItems: 0,
    deferredItems: 0,
  };
}

/**
 * Reserve one complete item or none of it.
 *
 * Files are distinct paths over the invocation; bytes are the exact UTF-8 output bytes written by create and
 * replace operations. Deletes consume a file slot but write no new bytes. A denied reservation mutates only
 * the deferred count, so a later independent item may still fit.
 */
export function reserveMaintenanceBudget(
  tracker: MaintenanceBudgetTracker,
  item: MaintenanceBudgetItem,
): MaintenanceBudgetDecision {
  const paths = new Set(item.operations.map((operation) => operation.relPath));
  const additionalFiles = [...paths].filter((relPath) => !tracker.files.has(relPath));
  const bytesWritten = item.operations.reduce(
    (bytes, operation) =>
      bytes + (operation.type === 'delete' ? 0 : Buffer.byteLength(operation.after ?? '')),
    0,
  );
  const items = Math.max(1, Math.floor(item.items ?? 1));
  const highRiskItems = item.risk === 'high' ? items : 0;
  const exceeded: MaintenanceBudgetExceeded[] = [];
  check(exceeded, 'max_items', tracker.items, items, tracker.limits.maxItems);
  check(
    exceeded,
    'max_files_changed',
    tracker.files.size,
    additionalFiles.length,
    tracker.limits.maxFilesChanged,
  );
  check(exceeded, 'max_bytes_written', tracker.bytesWritten, bytesWritten, tracker.limits.maxBytesWritten);
  check(
    exceeded,
    'max_high_risk_items',
    tracker.highRiskItems,
    highRiskItems,
    tracker.limits.maxHighRiskItems,
  );
  if (exceeded.length > 0) {
    tracker.deferredItems += 1;
    return { allowed: false, exceeded };
  }

  tracker.items += items;
  for (const relPath of paths) tracker.files.add(relPath);
  tracker.bytesWritten += bytesWritten;
  tracker.highRiskItems += highRiskItems;
  return { allowed: true };
}

export function maintenanceBudgetReceipt(tracker: MaintenanceBudgetTracker): MaintenanceBudgetReceipt {
  return {
    limits: { ...tracker.limits },
    used: {
      items: tracker.items,
      filesChanged: tracker.files.size,
      bytesWritten: tracker.bytesWritten,
      highRiskItems: tracker.highRiskItems,
    },
    deferredItems: tracker.deferredItems,
  };
}

function check(
  exceeded: MaintenanceBudgetExceeded[],
  dimension: MaintenanceBudgetDimension,
  used: number,
  item: number,
  limit: number,
): void {
  if (used + item > limit) exceeded.push({ dimension, used, item, limit });
}
