import { AknoError } from '@tenphi/akno-protocol';
import { MAINTENANCE_TRANSFORMS, type AknoConfig, type MaintenanceTransform } from '../config/schema.ts';
import type { AknoContext } from '../context.ts';
import type { MaintenanceMode } from './plans.ts';
import type { DreamRunVerificationReceipt } from './run-verification.ts';

export const MAINTENANCE_ROLLBACK_PAUSE_THRESHOLD = 3;

export type MaintenanceRecoveryReason =
  | 'live_bytes_uncertain'
  | 'plan_store_unavailable'
  | 'journal_receipt_missing'
  | 'verification_unproven'
  | 'rollback_threshold';

export interface MaintenanceRecoveryEntry {
  scope: 'profile' | 'transform';
  transform: MaintenanceTransform | null;
  reason: MaintenanceRecoveryReason;
  consecutiveFailures: number;
  pausedAt: string | null;
  lastFailureAt: string;
  lastRunId: string;
  recoveryCommand: string | null;
}

export interface MaintenanceRecoveryStatus {
  automaticApply: 'available' | 'partially_paused' | 'paused';
  profile: MaintenanceRecoveryEntry | null;
  transforms: MaintenanceRecoveryEntry[];
}

export type MaintenanceRecoveryScope = { profile: true } | { transform: MaintenanceTransform };

interface RecoveryRow {
  scope: 'profile' | 'transform';
  transform: string | null;
  reason_code: MaintenanceRecoveryReason;
  consecutive_failures: number;
  paused_at: string | null;
  last_failure_at: string;
  last_run_id: string;
}

interface RecoveryItemRow {
  id: string;
  kind: string;
  status: 'applied' | 'verification_failed';
  verification: string | null;
}

export function maintenanceRecoveryStatus(ctx: AknoContext): MaintenanceRecoveryStatus {
  if (!recoveryTableAvailable(ctx)) return emptyMaintenanceRecoveryStatus();
  const rows = ctx.store.db
    .prepare('SELECT * FROM maintenance_recovery_state ORDER BY scope, transform')
    .all() as RecoveryRow[];
  const entries = rows.flatMap((row) => {
    const entry = recoveryEntry(row);
    return entry ? [entry] : [];
  });
  const profile = entries.find((entry) => entry.scope === 'profile') ?? null;
  const transforms = entries.filter((entry) => entry.scope === 'transform');
  return {
    automaticApply: profile
      ? 'paused'
      : transforms.some((entry) => entry.pausedAt !== null)
        ? 'partially_paused'
        : 'available',
    profile,
    transforms,
  };
}

export function resumeMaintenanceRecovery(
  ctx: AknoContext,
  scope: MaintenanceRecoveryScope,
): MaintenanceRecoveryStatus {
  if (!ctx.writable)
    throw new AknoError('read_only', 'resuming automatic maintenance needs the write handle');
  if (!recoveryTableAvailable(ctx)) return emptyMaintenanceRecoveryStatus();
  const key = 'profile' in scope ? 'profile' : `transform:${scope.transform}`;
  const removed = ctx.store.db.prepare('DELETE FROM maintenance_recovery_state WHERE scope_key = ?').run(key);
  if (removed.changes === 0) {
    throw new AknoError('not_found', `${recoveryScopeLabel(scope)} is not paused and has no failure streak`);
  }
  return maintenanceRecoveryStatus(ctx);
}

/** Lower only automatic authority. Audit/review runs remain available while recovery is pending. */
export function configWithMaintenanceRecovery(
  config: AknoConfig,
  status: MaintenanceRecoveryStatus,
  mode: MaintenanceMode,
): AknoConfig {
  if (mode !== 'auto') return config;
  const paused = status.transforms
    .filter((entry) => entry.pausedAt !== null && entry.transform !== null)
    .map((entry) => entry.transform!);
  if (paused.length === 0) return config;
  const policies = { ...config.maintenance.policies };
  for (const transform of paused) policies[transform] = 'off';
  return { ...config, maintenance: { ...config.maintenance, policies } };
}

export function assertProfileAutomaticApplyAvailable(
  status: MaintenanceRecoveryStatus,
  mode: MaintenanceMode,
): void {
  if (mode !== 'auto' || !status.profile) return;
  throw new AknoError(
    'conflict',
    'automatic maintenance is paused because Akno could not prove a safe apply state; inspect status and recovery plans, then run `akno dream resume --profile`',
    { maintenance_pause: 'profile', reason: status.profile.reason },
  );
}

export function recordMaintenanceRecovery(
  ctx: AknoContext,
  input: {
    runId: string;
    mode: MaintenanceMode | 'legacy';
    planIds: readonly string[];
    verification: DreamRunVerificationReceipt | null;
  },
): MaintenanceRecoveryStatus {
  if (!ctx.writable || !recoveryTableAvailable(ctx)) return maintenanceRecoveryStatus(ctx);
  const now = new Date().toISOString();
  const rollbacks = new Map<MaintenanceTransform, number>();
  const successes = new Set<MaintenanceTransform>();
  let profileReason = verificationPauseReason(input.verification);

  ctx.store.transaction(() => {
    for (const planId of new Set(input.planIds)) {
      const plan = ctx.store.db
        .prepare('SELECT 1 AS present FROM maintenance_plans WHERE id = ?')
        .get(planId);
      if (!plan) {
        profileReason ??= 'plan_store_unavailable';
        continue;
      }
      const items = ctx.store.db
        .prepare(
          `SELECT id, kind, status, verification FROM maintenance_items
            WHERE plan_id = ? AND recovery_recorded_at IS NULL
              AND status IN ('applied', 'verification_failed')
            ORDER BY ord, rowid`,
        )
        .all(planId) as RecoveryItemRow[];
      for (const item of items) {
        const transform = maintenanceTransform(item.kind);
        const verificationStatus = storedVerificationStatus(item.verification);
        if (item.status === 'verification_failed') {
          if (verificationStatus === 'rolled_back' && transform && input.mode === 'auto') {
            rollbacks.set(transform, (rollbacks.get(transform) ?? 0) + 1);
          } else if (verificationStatus === 'failed') {
            profileReason ??= 'live_bytes_uncertain';
          }
        } else if (transform && verificationStatus === 'passed' && input.mode === 'auto') {
          successes.add(transform);
        }
        ctx.store.db
          .prepare('UPDATE maintenance_items SET recovery_recorded_at = ? WHERE id = ?')
          .run(now, item.id);
      }
    }

    for (const transform of MAINTENANCE_TRANSFORMS) {
      const failures = rollbacks.get(transform) ?? 0;
      if (failures > 0) {
        recordRollbackFailures(ctx, transform, failures, input.runId, now);
      } else if (successes.has(transform)) {
        clearUnpausedTransformStreak(ctx, transform);
      }
    }
    if (profileReason) pauseProfile(ctx, profileReason, input.runId, now);
  });
  return maintenanceRecoveryStatus(ctx);
}

function recordRollbackFailures(
  ctx: AknoContext,
  transform: MaintenanceTransform,
  failures: number,
  runId: string,
  now: string,
): void {
  const key = `transform:${transform}`;
  const existing = ctx.store.db
    .prepare('SELECT consecutive_failures, paused_at FROM maintenance_recovery_state WHERE scope_key = ?')
    .get(key) as { consecutive_failures: number; paused_at: string | null } | undefined;
  const consecutive = (existing?.consecutive_failures ?? 0) + failures;
  const pausedAt = existing?.paused_at ?? (consecutive >= MAINTENANCE_ROLLBACK_PAUSE_THRESHOLD ? now : null);
  ctx.store.db
    .prepare(
      `INSERT INTO maintenance_recovery_state
        (scope_key, scope, transform, reason_code, consecutive_failures, paused_at,
         last_failure_at, last_run_id, updated_at)
       VALUES (?, 'transform', ?, 'rollback_threshold', ?, ?, ?, ?, ?)
       ON CONFLICT(scope_key) DO UPDATE SET
         reason_code = excluded.reason_code,
         consecutive_failures = excluded.consecutive_failures,
         paused_at = excluded.paused_at,
         last_failure_at = excluded.last_failure_at,
         last_run_id = excluded.last_run_id,
         updated_at = excluded.updated_at`,
    )
    .run(key, transform, consecutive, pausedAt, now, runId, now);
}

function clearUnpausedTransformStreak(ctx: AknoContext, transform: MaintenanceTransform): void {
  ctx.store.db
    .prepare(
      `DELETE FROM maintenance_recovery_state
        WHERE scope_key = ? AND scope = 'transform' AND paused_at IS NULL`,
    )
    .run(`transform:${transform}`);
}

function pauseProfile(
  ctx: AknoContext,
  reason: Exclude<MaintenanceRecoveryReason, 'rollback_threshold'>,
  runId: string,
  now: string,
): void {
  ctx.store.db
    .prepare(
      `INSERT INTO maintenance_recovery_state
        (scope_key, scope, transform, reason_code, consecutive_failures, paused_at,
         last_failure_at, last_run_id, updated_at)
       VALUES ('profile', 'profile', NULL, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(scope_key) DO UPDATE SET
         reason_code = excluded.reason_code,
         consecutive_failures = CASE
           WHEN maintenance_recovery_state.last_run_id = excluded.last_run_id
             THEN maintenance_recovery_state.consecutive_failures
           ELSE maintenance_recovery_state.consecutive_failures + 1
         END,
         paused_at = coalesce(maintenance_recovery_state.paused_at, excluded.paused_at),
         last_failure_at = excluded.last_failure_at,
         last_run_id = excluded.last_run_id,
         updated_at = excluded.updated_at`,
    )
    .run(reason, now, now, runId, now);
}

function verificationPauseReason(
  verification: DreamRunVerificationReceipt | null,
): Exclude<MaintenanceRecoveryReason, 'rollback_threshold'> | null {
  if (!verification) return null;
  const codes = new Set(verification.issues.map((issue) => issue.code));
  if (codes.has('plan_unavailable')) return 'plan_store_unavailable';
  if (codes.has('missing_change_id')) return 'journal_receipt_missing';
  if (codes.has('affected_path_mismatch') || codes.has('snapshot_scan_failed')) {
    return 'verification_unproven';
  }
  return null;
}

function recoveryEntry(row: RecoveryRow): MaintenanceRecoveryEntry | null {
  const transform = row.transform ? maintenanceTransform(row.transform) : null;
  if (row.scope === 'transform' && !transform) return null;
  return {
    scope: row.scope,
    transform,
    reason: row.reason_code,
    consecutiveFailures: row.consecutive_failures,
    pausedAt: row.paused_at,
    lastFailureAt: row.last_failure_at,
    lastRunId: row.last_run_id,
    recoveryCommand:
      row.paused_at === null
        ? null
        : row.scope === 'profile'
          ? 'akno dream resume --profile'
          : `akno dream resume --transform ${transform}`,
  };
}

function storedVerificationStatus(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { status?: unknown };
    return typeof parsed.status === 'string' ? parsed.status : null;
  } catch {
    return null;
  }
}

function maintenanceTransform(value: string): MaintenanceTransform | null {
  return (MAINTENANCE_TRANSFORMS as readonly string[]).includes(value)
    ? (value as MaintenanceTransform)
    : null;
}

function recoveryScopeLabel(scope: MaintenanceRecoveryScope): string {
  return 'profile' in scope ? 'the maintenance profile' : `${scope.transform} maintenance`;
}

function recoveryTableAvailable(ctx: AknoContext): boolean {
  return Boolean(
    ctx.store.db
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('maintenance_recovery_state'),
  );
}

function emptyMaintenanceRecoveryStatus(): MaintenanceRecoveryStatus {
  return { automaticApply: 'available', profile: null, transforms: [] };
}
