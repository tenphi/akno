import fs from 'node:fs';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

export interface LaunchdDefinition {
  arguments: string[];
  calendar: { hour: number; minute: number } | null;
}

export type LaunchdDefinitionStatus = 'matching' | 'drifted' | 'not_loaded' | 'not_installed' | 'unavailable';

export interface LaunchdJobInspection {
  label: string;
  plistPath: string;
  status: LaunchdDefinitionStatus;
  installed: LaunchdDefinition | null;
  loaded: LaunchdDefinition | null;
  pid: number | null;
}

export type Launchctl = (args: string[]) => SpawnSyncReturns<string>;

/** Parse the executable, arguments, and daily schedule that determine what launchd will run. */
export function parseLaunchdPlist(plist: string): LaunchdDefinition | null {
  const argumentsBody = plist.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1];
  if (!argumentsBody) return null;
  const commandArguments = [...argumentsBody.matchAll(/<string>([\s\S]*?)<\/string>/g)].map((match) =>
    unescapeXml(match[1] ?? ''),
  );
  if (commandArguments.length === 0) return null;
  const calendarBody = plist.match(/<key>StartCalendarInterval<\/key>\s*<dict>([\s\S]*?)<\/dict>/)?.[1];
  const calendar = calendarBody === undefined ? null : parsePlistCalendar(calendarBody);
  if (calendarBody !== undefined && calendar === null) return null;
  return { arguments: commandArguments, calendar };
}

/** Parse the content-safe subset of `launchctl print gui/<uid>/<label>`. */
export function parseLoadedLaunchdDefinition(
  output: string,
): (LaunchdDefinition & { pid: number | null }) | null {
  const argumentsBody = output.match(/^\s*arguments = \{\s*$([\s\S]*?)^\s*\}\s*$/m)?.[1];
  if (!argumentsBody) return null;
  const commandArguments = argumentsBody
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (commandArguments.length === 0) return null;
  const descriptor = output.match(/^\s*descriptor = \{\s*$([\s\S]*?)^\s*\}\s*$/m)?.[1];
  const calendar = descriptor === undefined ? null : parseLaunchdDescriptor(descriptor);
  if (descriptor !== undefined && calendar === null) return null;
  const pidText = output.match(/^\s*pid = (\d+)\s*$/m)?.[1];
  return {
    arguments: commandArguments,
    calendar,
    pid: pidText === undefined ? null : Number(pidText),
  };
}

export function inspectLaunchdJob(
  label: string,
  plistPath: string,
  launchctl: Launchctl = defaultLaunchctl,
  uid: number | undefined = process.getuid?.(),
): LaunchdJobInspection {
  if (!fs.existsSync(plistPath)) {
    return { label, plistPath, status: 'not_installed', installed: null, loaded: null, pid: null };
  }
  let installed: LaunchdDefinition | null = null;
  try {
    installed = parseLaunchdPlist(fs.readFileSync(plistPath, 'utf8'));
  } catch {}
  if (!installed || uid === undefined) {
    return { label, plistPath, status: 'unavailable', installed, loaded: null, pid: null };
  }
  const printed = launchctl(['print', `gui/${uid}/${label}`]);
  if (printed.status !== 0) {
    return { label, plistPath, status: 'not_loaded', installed, loaded: null, pid: null };
  }
  const parsed = parseLoadedLaunchdDefinition(printed.stdout ?? '');
  if (!parsed) {
    return { label, plistPath, status: 'unavailable', installed, loaded: null, pid: null };
  }
  const loaded = { arguments: parsed.arguments, calendar: parsed.calendar };
  return {
    label,
    plistPath,
    status: sameDefinition(installed, loaded) ? 'matching' : 'drifted',
    installed,
    loaded,
    pid: parsed.pid,
  };
}

export interface LaunchdReloadResult {
  inspection: LaunchdJobInspection;
  reloaded: boolean;
  error: string | null;
}

/** Reload only stale or unloaded jobs, then prove launchd accepted the intended definition. */
export function reloadLaunchdJob(
  inspection: LaunchdJobInspection,
  launchctl: Launchctl = defaultLaunchctl,
  uid: number | undefined = process.getuid?.(),
): LaunchdReloadResult {
  if (inspection.status === 'matching') return { inspection, reloaded: false, error: null };
  if (inspection.status === 'not_installed') {
    return { inspection, reloaded: false, error: `${inspection.label} is not installed` };
  }
  if (inspection.status === 'unavailable' || uid === undefined) {
    return { inspection, reloaded: false, error: `${inspection.label} definition is unavailable` };
  }
  const domain = `gui/${uid}`;
  if (inspection.status === 'drifted') {
    const removed = launchctl(['bootout', `${domain}/${inspection.label}`]);
    if (removed.status !== 0) {
      return { inspection, reloaded: false, error: `${inspection.label} could not unload` };
    }
  }
  const loaded = launchctl(['bootstrap', domain, inspection.plistPath]);
  if (loaded.status !== 0) {
    return { inspection, reloaded: false, error: `${inspection.label} could not load` };
  }
  const verified = inspectLaunchdJob(inspection.label, inspection.plistPath, launchctl, uid);
  if (verified.status !== 'matching') {
    return { inspection: verified, reloaded: true, error: `${inspection.label} reload did not match` };
  }
  return { inspection: verified, reloaded: true, error: null };
}

function sameDefinition(left: LaunchdDefinition, right: LaunchdDefinition): boolean {
  return (
    left.arguments.length === right.arguments.length &&
    left.arguments.every((argument, index) => argument === right.arguments[index]) &&
    left.calendar?.hour === right.calendar?.hour &&
    left.calendar?.minute === right.calendar?.minute
  );
}

function parsePlistCalendar(body: string): { hour: number; minute: number } | null {
  const hour = plistInteger(body, 'Hour');
  const minute = plistInteger(body, 'Minute') ?? 0;
  if (hour === null || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function parseLaunchdDescriptor(body: string): { hour: number; minute: number } | null {
  const hourText = body.match(/^\s*"Hour" => (\d+)\s*$/m)?.[1];
  const minuteText = body.match(/^\s*"Minute" => (\d+)\s*$/m)?.[1];
  if (hourText === undefined) return null;
  const hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function plistInteger(body: string, key: string): number | null {
  const match = body.match(new RegExp(`<key>${key}</key>\\s*<integer>(\\d+)</integer>`));
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function unescapeXml(value: string): string {
  return value.replace(/&(lt|gt|amp|apos|quot);/g, (_, entity: string) => {
    switch (entity) {
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'amp':
        return '&';
      case 'apos':
        return "'";
      default:
        return '"';
    }
  });
}

function defaultLaunchctl(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('launchctl', args, { encoding: 'utf8' });
}
