import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import type {
  DreamModelDegradation,
  DreamRunReceipt,
  MaintenanceNotificationMode,
  MaintenanceStatus,
} from '@tenphi/akno-core';
import type { DreamScheduleStatus } from './dream-schedule.ts';

const REPEATED_DEGRADATION_RUNS = 3;
const MAX_REMEMBERED_FINGERPRINTS = 100;

type MaintenanceNotificationCause =
  | 'review_backlog'
  | 'run_failed'
  | 'run_incomplete'
  | 'verification_pending'
  | 'budget_backlog'
  | 'repeated_degradation'
  | 'missed_cycle'
  | 'quiet_success';

/** Deliberately content-free: this is safe to show on a locked screen. */
export interface MaintenanceNotification {
  fingerprint: string;
  title: string;
  body: string;
  causes: MaintenanceNotificationCause[];
}

export interface NotificationDelivery {
  status: 'sent' | 'disabled' | 'not_needed' | 'duplicate' | 'unsupported' | 'failed';
  error?: string;
}

interface NotificationState {
  sent: string[];
}

export function scheduledRunNotification(
  mode: MaintenanceNotificationMode,
  run: DreamRunReceipt,
  status: MaintenanceStatus,
  history: DreamRunReceipt[],
): MaintenanceNotification | null {
  if (mode === 'off') return null;

  const causes: MaintenanceNotificationCause[] = [];
  const details: string[] = [];
  if (run.status === 'failed') {
    causes.push('run_failed');
    details.push(`cycle failed${run.errorCode ? ` (${run.errorCode})` : ''}`);
  } else if (run.status === 'partially_completed') {
    causes.push('run_incomplete');
    details.push('cycle needs a retry or inspection');
  }
  if (status.awaitingHuman > 0) {
    causes.push('review_backlog');
    details.push(`${status.awaitingHuman} review item${status.awaitingHuman === 1 ? '' : 's'} waiting`);
  } else if (run.status === 'awaiting_review') {
    causes.push('review_backlog');
    details.push('review items waiting');
  }
  if (status.verificationPending > 0) {
    causes.push('verification_pending');
    details.push(
      `${status.verificationPending} verification${status.verificationPending === 1 ? '' : 's'} pending`,
    );
  }
  const deferred = Math.max(status.budgetDeferred, run.budget?.deferredItems ?? 0);
  if (deferred > 0) {
    causes.push('budget_backlog');
    details.push(`${deferred} item${deferred === 1 ? '' : 's'} deferred by budget`);
  }

  const repeated = repeatedDegradations(run, history);
  if (repeated.length > 0) {
    causes.push('repeated_degradation');
    const labels = [...new Set(repeated.map((entry) => `${entry.stage}: ${entry.reason}`))];
    const visible = labels.slice(0, 3).join(', ');
    const remaining = labels.length > 3 ? ` +${labels.length - 3} more` : '';
    details.push(`model degraded for ${REPEATED_DEGRADATION_RUNS} cycles (${visible}${remaining})`);
  }

  if (causes.length === 0) {
    if (mode !== 'all') return null;
    causes.push('quiet_success');
    details.push(
      `cycle completed · ${run.changeIds.length} verified change${run.changeIds.length === 1 ? '' : 's'}`,
    );
  }

  return {
    fingerprint: `run:${run.id}`,
    title: causes.includes('quiet_success') ? 'Akno nightly maintenance' : 'Akno needs attention',
    body: `${details.join(' · ')} · ${run.id}`,
    causes,
  };
}

export function missedCycleNotification(
  mode: MaintenanceNotificationMode,
  schedule: DreamScheduleStatus,
): MaintenanceNotification | null {
  if (mode === 'off' || schedule.health !== 'overdue' || !schedule.previousExpectedAt) return null;
  return {
    fingerprint: `missed:${schedule.previousExpectedAt}`,
    title: 'Akno needs attention',
    body: `nightly cycle missed its two-hour window · expected ${schedule.previousExpectedAt}`,
    causes: ['missed_cycle'],
  };
}

export function scheduledCommandFailureNotification(
  mode: MaintenanceNotificationMode,
  errorCode: string,
  startedAt: Date,
): MaintenanceNotification | null {
  if (mode === 'off') return null;
  return {
    fingerprint: `command-failed:${localDay(startedAt)}`,
    title: 'Akno needs attention',
    body: `nightly maintenance command failed (${safeErrorCode(errorCode)})`,
    causes: ['run_failed'],
  };
}

export function deliverMaintenanceNotification(
  mode: MaintenanceNotificationMode,
  notification: MaintenanceNotification | null,
  stateDir: string,
  options: {
    platform?: NodeJS.Platform;
    spawn?: typeof spawnSync;
  } = {},
): NotificationDelivery {
  if (mode === 'off') return { status: 'disabled' };
  if (!notification) return { status: 'not_needed' };
  if ((options.platform ?? process.platform) !== 'darwin') return { status: 'unsupported' };

  const statePath = path.join(stateDir, 'maintenance-notifications.json');
  const state = readNotificationState(statePath);
  if (state.sent.includes(notification.fingerprint)) return { status: 'duplicate' };

  const spawn = options.spawn ?? spawnSync;
  let result: SpawnSyncReturns<string>;
  try {
    result = spawn(
      '/usr/bin/osascript',
      [
        '-l',
        'JavaScript',
        '-e',
        'function run(argv) { const app = Application.currentApplication(); app.includeStandardAdditions = true; app.displayNotification(argv[1], { withTitle: argv[0] }); }',
        notification.title,
        notification.body,
      ],
      { encoding: 'utf8', timeout: 5_000 },
    );
  } catch (error) {
    return { status: 'failed', error: safeDeliveryError(error) };
  }
  if (result.error || result.status !== 0) {
    return {
      status: 'failed',
      error: safeDeliveryError(result.error ?? `osascript exited ${result.status}`),
    };
  }

  rememberNotification(statePath, state, notification.fingerprint);
  return { status: 'sent' };
}

function repeatedDegradations(run: DreamRunReceipt, history: DreamRunReceipt[]): DreamModelDegradation[] {
  if (run.degraded.length === 0) return [];
  const fullRuns = history.filter(
    (candidate) => candidate.requestedPhase === null && candidate.status !== 'running',
  );
  const currentIndex = fullRuns.findIndex((candidate) => candidate.id === run.id);
  const consecutive =
    currentIndex >= 0 ? fullRuns.slice(currentIndex, currentIndex + REPEATED_DEGRADATION_RUNS) : [];
  if (consecutive.length < REPEATED_DEGRADATION_RUNS) return [];
  return run.degraded.filter((degradation) =>
    consecutive.every((candidate) => candidate.degraded.some((entry) => sameDegradation(entry, degradation))),
  );
}

function sameDegradation(left: DreamModelDegradation, right: DreamModelDegradation): boolean {
  return left.stage === right.stage && left.reason === right.reason;
}

function readNotificationState(statePath: string): NotificationState {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8')) as Partial<NotificationState>;
    return {
      sent: Array.isArray(parsed.sent) ? parsed.sent.filter((value) => typeof value === 'string') : [],
    };
  } catch {
    return { sent: [] };
  }
}

function rememberNotification(statePath: string, state: NotificationState, fingerprint: string): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const next = {
    sent: [fingerprint, ...state.sent.filter((value) => value !== fingerprint)].slice(
      0,
      MAX_REMEMBERED_FINGERPRINTS,
    ),
  };
  const temporary = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, statePath);
}

/** Delivery failures are operational only; never propagate script output into status or logs. */
function safeDeliveryError(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (typeof error === 'string' && /^osascript exited -?\d+$/.test(error)) return error;
  return 'notification delivery failed';
}

function safeErrorCode(value: string): string {
  return /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : 'internal';
}

function localDay(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
