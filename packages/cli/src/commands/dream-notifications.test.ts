import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SpawnSyncReturns } from 'node:child_process';
import type { DreamRunReceipt, MaintenanceStatus } from '@tenphi/akno-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deliverMaintenanceNotification,
  missedCycleNotification,
  scheduledCommandFailureNotification,
  scheduledRunNotification,
} from './dream-notifications.ts';
import type { DreamScheduleStatus } from './dream-schedule.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true });
});

describe('scheduled maintenance notifications', () => {
  it('keeps a successful no-op quiet unless all-run notifications are selected', () => {
    const run = fixtureRun('run_aaaaaaaa');
    expect(scheduledRunNotification('off', run, fixtureStatus(), [run])).toBeNull();
    expect(scheduledRunNotification('actionable', run, fixtureStatus(), [run])).toBeNull();
    expect(scheduledRunNotification('all', run, fixtureStatus(), [run])).toMatchObject({
      fingerprint: 'run:run_aaaaaaaa',
      causes: ['quiet_success'],
      body: 'cycle completed · 0 verified changes · run_aaaaaaaa',
    });
  });

  it('summarizes actionable backlog using counts and typed status only', () => {
    const run = fixtureRun('run_bbbbbbbb', {
      status: 'partially_completed',
      budget: { ...fixtureRun('run_unused').budget!, deferredItems: 2 },
    });
    const notification = scheduledRunNotification(
      'actionable',
      run,
      fixtureStatus({ awaitingHuman: 1, verificationPending: 3, budgetDeferred: 2 }),
      [run],
    );

    expect(notification).toMatchObject({
      causes: ['run_incomplete', 'review_backlog', 'verification_pending', 'budget_backlog'],
    });
    expect(notification?.body).toBe(
      'cycle needs a retry or inspection · 1 review item waiting · 3 verifications pending · 2 items deferred by budget · run_bbbbbbbb',
    );
    expect(JSON.stringify(notification)).not.toContain('Ada Marlow');
  });

  it('notifies about a model degradation only after three consecutive full cycles', () => {
    const degradation = {
      stage: 'curator' as const,
      reason: 'derive_failed' as const,
      failure: 'timeout' as const,
      occurrences: 1,
    };
    const newest = fixtureRun('run_cccccccc', { degraded: [degradation] });
    const second = fixtureRun('run_dddddddd', { degraded: [degradation] });
    const third = fixtureRun('run_eeeeeeee', { degraded: [degradation] });

    expect(scheduledRunNotification('actionable', newest, fixtureStatus(), [newest, second])).toBeNull();
    const notification = scheduledRunNotification('actionable', newest, fixtureStatus(), [
      newest,
      second,
      third,
    ]);
    expect(notification).toMatchObject({ causes: ['repeated_degradation'] });
    expect(notification?.body).toContain('curator: derive_failed');
  });

  it('uses the expected schedule window as the missed-cycle deduplication key', () => {
    const schedule = fixtureSchedule('overdue');
    expect(missedCycleNotification('actionable', schedule)).toMatchObject({
      fingerprint: 'missed:2030-01-02T03:00:00.000Z',
      causes: ['missed_cycle'],
    });
    expect(missedCycleNotification('actionable', { ...schedule, health: 'within_window' })).toBeNull();
    expect(
      deliverMaintenanceNotification('actionable', null, '/invented/state', { platform: 'darwin' }),
    ).toEqual({ status: 'not_needed' });
  });

  it('delivers through argv without interpolating notification text and deduplicates successful delivery', () => {
    const stateDir = temporaryStateDir();
    const spawn = vi.fn(() => successfulSpawn());
    const notification = scheduledCommandFailureNotification(
      'actionable',
      'unavailable',
      new Date(2030, 0, 2),
    )!;

    expect(
      deliverMaintenanceNotification('actionable', notification, stateDir, { platform: 'darwin', spawn }),
    ).toEqual({ status: 'sent' });
    expect(
      deliverMaintenanceNotification('actionable', notification, stateDir, { platform: 'darwin', spawn }),
    ).toEqual({ status: 'duplicate' });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        '-l',
        'JavaScript',
        'Akno needs attention',
        'nightly maintenance command failed (unavailable)',
      ]),
    );
    expect(fs.readFileSync(path.join(stateDir, 'maintenance-notifications.json'), 'utf8')).toContain(
      'command-failed:2030-01-02',
    );
  });

  it('does not mark a failed delivery as sent', () => {
    const stateDir = temporaryStateDir();
    const spawn = vi.fn(() => ({ ...successfulSpawn(), status: 1 }));
    const notification = scheduledCommandFailureNotification(
      'actionable',
      'unavailable',
      new Date(2030, 0, 2),
    )!;

    expect(
      deliverMaintenanceNotification('actionable', notification, stateDir, { platform: 'darwin', spawn }),
    ).toEqual({ status: 'failed', error: 'osascript exited 1' });
    expect(fs.existsSync(path.join(stateDir, 'maintenance-notifications.json'))).toBe(false);
  });
});

function fixtureRun(id: string, overrides: Partial<DreamRunReceipt> = {}): DreamRunReceipt {
  return {
    id,
    startedAt: '2030-01-02T03:00:00.000Z',
    finishedAt: '2030-01-02T03:00:00.111Z',
    status: 'completed',
    profile: 'autonomous',
    mode: 'auto',
    dryRun: false,
    requestedPhase: null,
    snapshot: {
      capturedAt: '2030-01-02T03:00:00.000Z',
      schemaVersion: 22,
      indexRevision: 'a'.repeat(64),
      knowledgeBaseFingerprint: 'b'.repeat(64),
      configurationFingerprint: 'c'.repeat(64),
      indexedFiles: 11,
      requestedPhases: ['housekeeping'],
      plannerVersion: 'dream-lifecycle-v2',
      modelId: 'zephyr-model',
    },
    phases: [],
    counts: {
      observations: 0,
      curated: 0,
      rejectedByGuard: 0,
      adopted: 0,
      conflicts: 0,
      repairedLinks: 0,
      warnings: 0,
    },
    budget: {
      limits: { maxItems: 30, maxFilesChanged: 40, maxBytesWritten: 500_000, maxHighRiskItems: 3 },
      used: { items: 0, filesChanged: 0, bytesWritten: 0, highRiskItems: 0 },
      deferredItems: 0,
    },
    modelUsage: {
      modelId: 'zephyr-model',
      calls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      usageReportedCalls: 0,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      latencyMs: 0,
      stages: [],
    },
    degraded: [],
    verification: null,
    durationMs: 111,
    maintenancePlanIds: [],
    maintenancePlanId: null,
    changeIds: [],
    errorCode: null,
    persisted: true,
    ...overrides,
  };
}

function fixtureStatus(overrides: Partial<MaintenanceStatus> = {}): MaintenanceStatus {
  return {
    authority: {
      profile: 'autonomous',
      mode: 'auto',
      automaticKnowledgeBaseWrites: true,
      inference: 'write-when-enabled',
      observe: 'auto',
      reflect: 'auto',
      curate: 'auto',
      adopt: 'auto',
      policies: {
        observe: 'auto',
        reflect: 'auto',
        hygiene: 'auto',
        synthesis: 'auto',
        split: 'auto',
        extract: 'auto',
        merge: 'auto',
        contradiction: 'auto',
        broken_link: 'auto',
        adopt: 'auto',
      },
      limits: { maxItems: 30, maxFilesChanged: 40, maxBytesWritten: 500_000, maxHighRiskItems: 3 },
    },
    notifications: 'actionable',
    latest: null,
    latestRun: null,
    latestFullRun: null,
    runs: [],
    pendingPlans: [],
    active: 0,
    activeRuns: 0,
    awaitingHuman: 0,
    budgetDeferred: 0,
    verificationPending: 0,
    ...overrides,
  };
}

function fixtureSchedule(health: DreamScheduleStatus['health']): DreamScheduleStatus {
  return {
    label: 'dev.akno.dream',
    installed: true,
    loaded: true,
    installedAt: '2029-12-01T12:00:00.000Z',
    hour: 3,
    minute: 0,
    timezone: 'Europe/Amsterdam',
    previousExpectedAt: '2030-01-02T03:00:00.000Z',
    nextExpectedAt: '2030-01-03T03:00:00.000Z',
    graceUntil: '2030-01-02T05:00:00.000Z',
    latestFullRun: null,
    missedCycleCheck: {
      label: 'dev.akno.dream-health',
      installed: true,
      loaded: true,
      hour: 5,
      minute: 5,
    },
    health,
  };
}

function temporaryStateDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-notification-fixture-'));
  temporaryDirectories.push(directory);
  return directory;
}

function successfulSpawn(): SpawnSyncReturns<string> {
  return {
    pid: 1111,
    output: [null, '', ''],
    stdout: '',
    stderr: '',
    status: 0,
    signal: null,
    error: undefined,
  };
}
