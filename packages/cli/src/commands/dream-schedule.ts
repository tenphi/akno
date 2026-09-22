import fs from 'node:fs';
import path from 'node:path';
import type { DreamRunReceipt } from '@tenphi/akno-core';
import { systemdPaths, systemdUnitIsActive } from './service-systemd.ts';
import { inspectLaunchdJob, parseLaunchdPlist, type LaunchdDefinitionStatus } from './service-launchd.ts';

export const DREAM_SCHEDULE_LABEL = 'dev.akno.dream';
export const DREAM_HEALTH_LABEL = 'dev.akno.dream-health';
const DREAM_SCHEDULE_GRACE_MS = 2 * 60 * 60 * 1_000;

export type DreamScheduleHealth =
  | 'unsupported'
  | 'not_installed'
  | 'installed_not_loaded'
  | 'definition_drift'
  | 'definition_unknown'
  | 'invalid_schedule'
  | 'not_due'
  | 'within_window'
  | 'running'
  | 'on_time'
  | 'last_run_failed'
  | 'overdue';

export interface DreamScheduleStatus {
  label: typeof DREAM_SCHEDULE_LABEL;
  installed: boolean;
  loaded: boolean | null;
  definition: LaunchdDefinitionStatus | null;
  installedAt: string | null;
  hour: number | null;
  minute: number | null;
  timezone: string;
  previousExpectedAt: string | null;
  nextExpectedAt: string | null;
  graceUntil: string | null;
  latestFullRun: Pick<DreamRunReceipt, 'id' | 'status' | 'startedAt'> | null;
  missedCycleCheck: {
    label: typeof DREAM_HEALTH_LABEL;
    installed: boolean;
    loaded: boolean | null;
    definition: LaunchdDefinitionStatus | null;
    hour: number | null;
    minute: number | null;
  };
  health: DreamScheduleHealth;
}

interface DreamScheduleProbe {
  platform: string;
  installed: boolean;
  loaded: boolean | null;
  definition?: LaunchdDefinitionStatus | null;
  installedAt: Date | null;
  calendar: { hour: number; minute: number } | null;
  now: Date;
  timezone: string;
  missedCycleCheck?: {
    installed: boolean;
    loaded: boolean | null;
    definition?: LaunchdDefinitionStatus | null;
    calendar: { hour: number; minute: number } | null;
  };
}

/** Read only the launchd metadata needed for content-safe maintenance status. */
export function inspectDreamSchedule(latestFullRun: DreamRunReceipt | null): DreamScheduleStatus {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  if (process.platform === 'linux') {
    const paths = systemdPaths('dev.akno');
    const installed = fs.existsSync(paths.dreamTimer);
    const healthInstalled = fs.existsSync(paths.healthTimer);
    return calculateDreamSchedule(
      {
        platform: process.platform,
        installed,
        loaded: installed ? systemdUnitIsActive(DREAM_SCHEDULE_LABEL + '.timer') : false,
        definition: null,
        installedAt: installed ? fs.statSync(paths.dreamTimer).mtime : null,
        calendar: installed ? parseSystemdCalendar(fs.readFileSync(paths.dreamTimer, 'utf8')) : null,
        now: new Date(),
        timezone,
        missedCycleCheck: {
          installed: healthInstalled,
          loaded: healthInstalled ? systemdUnitIsActive(DREAM_HEALTH_LABEL + '.timer') : false,
          definition: null,
          calendar: healthInstalled ? parseSystemdCalendar(fs.readFileSync(paths.healthTimer, 'utf8')) : null,
        },
      },
      latestFullRun,
    );
  }
  if (process.platform !== 'darwin') {
    return calculateDreamSchedule(
      {
        platform: process.platform,
        installed: false,
        loaded: null,
        definition: null,
        installedAt: null,
        calendar: null,
        now: new Date(),
        timezone,
        missedCycleCheck: { installed: false, loaded: null, calendar: null },
      },
      latestFullRun,
    );
  }

  const plistPath = path.join(
    process.env.HOME ?? '',
    'Library',
    'LaunchAgents',
    `${DREAM_SCHEDULE_LABEL}.plist`,
  );
  const installed = fs.existsSync(plistPath);
  const inspection = inspectLaunchdJob(DREAM_SCHEDULE_LABEL, plistPath);
  const calendar = inspection.installed?.calendar ?? null;
  const installedAt = installed ? fs.statSync(plistPath).mtime : null;
  const loaded = launchdLoaded(inspection.status);
  const missedCycleCheck = inspectLaunchdCalendar(DREAM_HEALTH_LABEL);

  return calculateDreamSchedule(
    {
      platform: process.platform,
      installed,
      loaded,
      definition: inspection.status,
      installedAt,
      calendar,
      now: new Date(),
      timezone,
      missedCycleCheck,
    },
    latestFullRun,
  );
}

/** Parse the one daily calendar interval written by `akno service install`. */
export function parseDreamCalendar(plist: string): { hour: number; minute: number } | null {
  return parseLaunchdPlist(plist)?.calendar ?? null;
}

export function parseSystemdCalendar(unit: string): { hour: number; minute: number } | null {
  const match = unit.match(/^OnCalendar=\*-\*-\* (\d{2}):(\d{2}):00$/m);
  if (!match?.[1] || !match[2]) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function calculateDreamSchedule(
  probe: DreamScheduleProbe,
  latestFullRun: DreamRunReceipt | null,
): DreamScheduleStatus {
  const base = {
    label: DREAM_SCHEDULE_LABEL,
    installed: probe.installed,
    loaded: probe.loaded,
    definition: probe.definition ?? null,
    installedAt: probe.installedAt?.toISOString() ?? null,
    hour: probe.calendar?.hour ?? null,
    minute: probe.calendar?.minute ?? null,
    timezone: probe.timezone,
    latestFullRun: latestFullRun
      ? { id: latestFullRun.id, status: latestFullRun.status, startedAt: latestFullRun.startedAt }
      : null,
    missedCycleCheck: {
      label: DREAM_HEALTH_LABEL,
      installed: probe.missedCycleCheck?.installed ?? false,
      loaded:
        probe.platform === 'darwin' || probe.platform === 'linux'
          ? (probe.missedCycleCheck?.loaded ?? false)
          : null,
      definition: probe.missedCycleCheck?.definition ?? null,
      hour: probe.missedCycleCheck?.calendar?.hour ?? null,
      minute: probe.missedCycleCheck?.calendar?.minute ?? null,
    },
  } as const;

  if (probe.platform !== 'darwin' && probe.platform !== 'linux') {
    return {
      ...base,
      loaded: null,
      previousExpectedAt: null,
      nextExpectedAt: null,
      graceUntil: null,
      health: 'unsupported',
    };
  }
  if (!probe.installed) {
    return {
      ...base,
      previousExpectedAt: null,
      nextExpectedAt: null,
      graceUntil: null,
      health: 'not_installed',
    };
  }
  if (probe.definition === 'drifted') {
    return {
      ...base,
      previousExpectedAt: null,
      nextExpectedAt: null,
      graceUntil: null,
      health: 'definition_drift',
    };
  }
  if (probe.definition === 'unavailable') {
    return {
      ...base,
      previousExpectedAt: null,
      nextExpectedAt: null,
      graceUntil: null,
      health: 'definition_unknown',
    };
  }
  if (!probe.calendar) {
    return {
      ...base,
      previousExpectedAt: null,
      nextExpectedAt: null,
      graceUntil: null,
      health: 'invalid_schedule',
    };
  }

  const { previous, next } = dailyWindow(probe.now, probe.calendar.hour, probe.calendar.minute);
  const graceUntil = new Date(previous.getTime() + DREAM_SCHEDULE_GRACE_MS);
  const timing = {
    previousExpectedAt: previous.toISOString(),
    nextExpectedAt: next.toISOString(),
    graceUntil: graceUntil.toISOString(),
  };
  if (probe.loaded === false) return { ...base, ...timing, health: 'installed_not_loaded' };
  if (probe.installedAt && probe.installedAt > previous) {
    return { ...base, ...timing, health: 'not_due' };
  }

  const latestStartedAt = latestFullRun ? Date.parse(latestFullRun.startedAt) : Number.NaN;
  if (Number.isFinite(latestStartedAt) && latestStartedAt >= previous.getTime()) {
    const health =
      latestFullRun?.status === 'running'
        ? 'running'
        : latestFullRun?.status === 'failed'
          ? 'last_run_failed'
          : 'on_time';
    return { ...base, ...timing, health };
  }
  return {
    ...base,
    ...timing,
    health: probe.now < graceUntil ? 'within_window' : 'overdue',
  };
}

function inspectLaunchdCalendar(label: string): {
  installed: boolean;
  loaded: boolean | null;
  definition: LaunchdDefinitionStatus;
  calendar: { hour: number; minute: number } | null;
} {
  const plistPath = path.join(process.env.HOME ?? '', 'Library', 'LaunchAgents', `${label}.plist`);
  const inspection = inspectLaunchdJob(label, plistPath);
  return {
    installed: inspection.status !== 'not_installed',
    loaded: launchdLoaded(inspection.status),
    definition: inspection.status,
    calendar: inspection.installed?.calendar ?? null,
  };
}

function launchdLoaded(status: LaunchdDefinitionStatus): boolean | null {
  if (status === 'unavailable') return null;
  return status === 'matching' || status === 'drifted';
}

function dailyWindow(now: Date, hour: number, minute: number): { previous: Date; next: Date } {
  const today = new Date(now);
  today.setHours(hour, minute, 0, 0);
  if (now < today) {
    const previous = new Date(today);
    previous.setDate(previous.getDate() - 1);
    return { previous, next: today };
  }
  const next = new Date(today);
  next.setDate(next.getDate() + 1);
  return { previous: today, next };
}
