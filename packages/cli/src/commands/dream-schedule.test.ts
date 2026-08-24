import type { DreamRunReceipt } from '@tenphi/akno-core';
import { describe, expect, it } from 'vitest';
import { calculateDreamSchedule, parseDreamCalendar } from './dream-schedule.ts';

describe('dream schedule status', () => {
  it('parses the daily launchd interval without reading program arguments or paths', () => {
    expect(
      parseDreamCalendar(`
        <key>ProgramArguments</key><array><string>/invented/private/path</string></array>
        <key>StartCalendarInterval</key>
        <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>15</integer></dict>
      `),
    ).toEqual({ hour: 3, minute: 15 });
    expect(parseDreamCalendar('<key>RunAtLoad</key><true/>')).toBeNull();
  });

  it('distinguishes absent, unloaded, invalid, and newly installed schedules', () => {
    const now = new Date(2030, 0, 2, 6, 0);
    expect(calculateDreamSchedule(probe(now, { installed: false }), null).health).toBe('not_installed');
    expect(calculateDreamSchedule(probe(now, { loaded: false }), null).health).toBe('installed_not_loaded');
    expect(calculateDreamSchedule(probe(now, { calendar: null }), null).health).toBe('invalid_schedule');
    expect(calculateDreamSchedule(probe(now, { installedAt: new Date(2030, 0, 2, 5, 0) }), null).health).toBe(
      'not_due',
    );
  });

  it('uses a two-hour window before declaring a full cycle overdue', () => {
    expect(calculateDreamSchedule(probe(new Date(2030, 0, 2, 4, 59)), null).health).toBe('within_window');
    expect(calculateDreamSchedule(probe(new Date(2030, 0, 2, 5, 1)), null).health).toBe('overdue');
  });

  it('reports an on-time, running, or failed full-cycle receipt separately', () => {
    const now = new Date(2030, 0, 2, 6, 0);
    const started = new Date(2030, 0, 2, 3, 10);
    expect(calculateDreamSchedule(probe(now), run(started, 'completed')).health).toBe('on_time');
    expect(calculateDreamSchedule(probe(now), run(started, 'running')).health).toBe('running');
    expect(calculateDreamSchedule(probe(now), run(started, 'failed')).health).toBe('last_run_failed');
  });
});

function probe(
  now: Date,
  overrides: Partial<Parameters<typeof calculateDreamSchedule>[0]> = {},
): Parameters<typeof calculateDreamSchedule>[0] {
  return {
    platform: 'darwin',
    installed: true,
    loaded: true,
    installedAt: new Date(2029, 11, 1, 12, 0),
    calendar: { hour: 3, minute: 0 },
    now,
    timezone: 'Europe/Amsterdam',
    ...overrides,
  };
}

function run(startedAt: Date, status: DreamRunReceipt['status']): DreamRunReceipt {
  return {
    id: 'run_aaaaaaaa',
    startedAt: startedAt.toISOString(),
    finishedAt: status === 'running' ? null : new Date(startedAt.getTime() + 111).toISOString(),
    status,
    profile: 'autonomous',
    mode: 'auto',
    dryRun: false,
    requestedPhase: null,
    snapshot: {
      capturedAt: startedAt.toISOString(),
      schemaVersion: 22,
      indexRevision: 'a'.repeat(64),
      knowledgeBaseFingerprint: 'b'.repeat(64),
      configurationFingerprint: 'c'.repeat(64),
      indexedFiles: 11,
      requestedPhases: ['housekeeping'],
      plannerVersion: 'dream-lifecycle-v1',
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
    budget: null,
    durationMs: status === 'running' ? null : 111,
    maintenancePlanIds: [],
    maintenancePlanId: null,
    changeIds: [],
    errorCode: status === 'failed' ? 'unavailable' : null,
    persisted: true,
  };
}
