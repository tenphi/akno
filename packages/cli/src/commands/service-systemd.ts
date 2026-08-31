import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Hello, PROTOCOL_VERSION } from '@tenphi/akno-protocol';

export interface SystemdServiceDefinition {
  label: string;
  node: string;
  script: string;
  args: string[];
  environment?: Record<string, string>;
}

export interface SystemdInstallTarget {
  aknoPath: string;
  stateDir: string;
  socketPath: string;
  configPath: string | null;
}

export interface SystemdPaths {
  directory: string;
  service: string;
  dreamService: string;
  dreamTimer: string;
  healthService: string;
  healthTimer: string;
  target: string;
}

export type Systemctl = (args: string[]) => SpawnSyncReturns<string>;

function writePrivateFileAtomic(filePath: string, contents: string): void {
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  let created = false;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    created = true;
    fs.fchmodSync(descriptor, 0o600);
    fs.writeFileSync(descriptor, contents);
    const descriptorToClose = descriptor;
    descriptor = undefined;
    fs.closeSync(descriptorToClose);
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    if (created) fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function systemdPaths(label: string, configHome = process.env.XDG_CONFIG_HOME): SystemdPaths {
  const directory = path.join(configHome || path.join(process.env.HOME ?? '', '.config'), 'systemd', 'user');
  return {
    directory,
    service: path.join(directory, `${label}.service`),
    dreamService: path.join(directory, `${label}.dream.service`),
    dreamTimer: path.join(directory, `${label}.dream.timer`),
    healthService: path.join(directory, `${label}.dream-health.service`),
    healthTimer: path.join(directory, `${label}.dream-health.timer`),
    target: path.join(directory, `${label}.target.json`),
  };
}

export function systemdUnit(definition: SystemdServiceDefinition, oneshot = false): string {
  const command = [definition.node, definition.script, ...definition.args]
    .map((value) => systemdQuote(value))
    .join(' ');
  const environment = Object.entries(definition.environment ?? {})
    .map(([name, value]) => `Environment=${systemdQuote(`${name}=${value}`, false)}\n`)
    .join('');
  return `[Unit]\nDescription=Akno ${definition.label}\n\n[Service]\nType=${oneshot ? 'oneshot' : 'simple'}\n${environment}ExecStart=${command}\n${oneshot ? '' : 'Restart=always\nRestartSec=1\n'}${oneshot ? '' : '\n[Install]\nWantedBy=default.target\n'}`;
}

export function systemdTimer(label: string, hour: number, minute: number): string {
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  return `[Unit]\nDescription=Schedule ${label}\n\n[Timer]\nOnCalendar=*-*-* ${time}\nPersistent=true\nUnit=${label}.service\n\n[Install]\nWantedBy=timers.target\n`;
}

function systemdQuote(value: string, escapeDollar = true): string {
  if (/[^\t\x20-\x7e]/.test(value)) throw new Error('systemd arguments must not contain a control character');
  // `%` is a systemd specifier. `$` triggers environment expansion only in command lines;
  // Environment= values preserve it literally, so doubling there would change the selector.
  let escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%');
  if (escapeDollar) escaped = escaped.replaceAll('$', () => '$$');
  return `"${escaped}"`;
}

export function systemdInstallPlan(label: string, dream: boolean): string[][] {
  const schedules = [`${label}.dream.timer`, `${label}.dream-health.timer`];
  return [
    ...(!dream ? [['disable', '--now', ...schedules]] : []),
    ['daemon-reload'],
    ['enable', `${label}.service`],
    ['restart', `${label}.service`],
    ...(dream ? [['enable', '--now', ...schedules]] : []),
  ];
}

export interface InstallSystemdOptions {
  label: string;
  node: string;
  script: string;
  serviceArgs: string[];
  dreamArgs: string[];
  healthArgs: string[];
  dreamHour: number;
  dream: boolean;
  socketPath: string;
  target: SystemdInstallTarget;
  configHome?: string;
  systemctl?: Systemctl;
  waitForReady?: (socketPath: string, timeoutMs: number) => Promise<boolean>;
}

export async function installSystemdService(options: InstallSystemdOptions): Promise<SystemdPaths> {
  const paths = systemdPaths(options.label, options.configHome);
  const systemctl = options.systemctl ?? defaultSystemctl;
  fs.mkdirSync(paths.directory, { recursive: true });
  writePrivateFileAtomic(paths.target, `${JSON.stringify(options.target, null, 2)}\n`);
  const environment = options.target.configPath ? { AKNO_CONFIG: options.target.configPath } : undefined;
  fs.writeFileSync(
    paths.service,
    systemdUnit({
      label: options.label,
      node: options.node,
      script: options.script,
      args: options.serviceArgs,
      environment,
    }),
  );
  if (options.dream) {
    fs.writeFileSync(
      paths.dreamService,
      systemdUnit(
        {
          label: `${options.label}.dream`,
          node: options.node,
          script: options.script,
          args: options.dreamArgs,
          environment,
        },
        true,
      ),
    );
    fs.writeFileSync(paths.dreamTimer, systemdTimer(`${options.label}.dream`, options.dreamHour, 0));
    const healthHour = (options.dreamHour + 2) % 24;
    fs.writeFileSync(
      paths.healthService,
      systemdUnit(
        {
          label: `${options.label}.dream-health`,
          node: options.node,
          script: options.script,
          args: options.healthArgs,
          environment,
        },
        true,
      ),
    );
    fs.writeFileSync(paths.healthTimer, systemdTimer(`${options.label}.dream-health`, healthHour, 5));
  } else {
    disableUnits(
      [
        [paths.dreamTimer, `${options.label}.dream.timer`],
        [paths.healthTimer, `${options.label}.dream-health.timer`],
      ],
      systemctl,
    );
    for (const target of [paths.dreamService, paths.dreamTimer, paths.healthService, paths.healthTimer]) {
      fs.rmSync(target, { force: true });
    }
  }

  const plan = systemdInstallPlan(options.label, options.dream).filter(
    (args) => options.dream || args[0] !== 'disable',
  );
  const schedule = options.dream ? plan.pop() : undefined;
  for (const args of plan) {
    const result = systemctl(args);
    if (result.status !== 0 && args[0] !== 'disable') throw systemctlError(args, result);
  }
  const ready = await (options.waitForReady ?? waitForSocket)(options.socketPath, 30_000);
  if (!ready) throw new Error(`systemd restarted ${options.label}, but ${options.socketPath} is not ready`);
  if (schedule) {
    const result = systemctl(schedule);
    if (result.status !== 0) throw systemctlError(schedule, result);
  }
  return paths;
}

export function readSystemdInstallTarget(label: string, configHome?: string): SystemdInstallTarget | null {
  try {
    return JSON.parse(
      fs.readFileSync(systemdPaths(label, configHome).target, 'utf8'),
    ) as SystemdInstallTarget;
  } catch {
    return null;
  }
}

export function uninstallSystemdService(
  label: string,
  configHome?: string,
  systemctl: Systemctl = defaultSystemctl,
): SystemdPaths {
  const paths = systemdPaths(label, configHome);
  disableUnits(
    [
      [paths.service, `${label}.service`],
      [paths.dreamTimer, `${label}.dream.timer`],
      [paths.healthTimer, `${label}.dream-health.timer`],
    ],
    systemctl,
  );
  for (const unitPath of Object.values(paths).filter((candidate) => candidate !== paths.directory)) {
    fs.rmSync(unitPath, { force: true });
  }
  const reloaded = systemctl(['daemon-reload']);
  if (reloaded.status !== 0) throw systemctlError(['daemon-reload'], reloaded);
  const failed = [`${label}.service`, `${label}.dream.service`, `${label}.dream-health.service`].filter(
    (unit) => systemctl(['is-failed', '--quiet', unit]).status === 0,
  );
  if (failed.length > 0) {
    const args = ['reset-failed', ...failed];
    const result = systemctl(args);
    if (result.status !== 0) throw systemctlError(args, result);
  }
  return paths;
}

export function systemdUnitIsActive(unit: string, systemctl: Systemctl = defaultSystemctl): boolean {
  return systemctl(['is-active', '--quiet', unit]).status === 0;
}

function disableUnits(units: readonly (readonly [string, string])[], systemctl: Systemctl): void {
  const selected = units
    .filter(
      ([unitPath, unit]) => fs.existsSync(unitPath) || systemctl(['is-active', '--quiet', unit]).status === 0,
    )
    .map(([, unit]) => unit);
  if (selected.length === 0) return;
  const args = ['disable', '--now', ...selected];
  const result = systemctl(args);
  if (result.status !== 0) throw systemctlError(args, result);
}

function defaultSystemctl(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('systemctl', ['--user', ...args], { encoding: 'utf8' });
}

function systemctlError(args: string[], result: SpawnSyncReturns<string>): Error {
  const detail = (result.stderr || result.error?.message || '').trim();
  return new Error(
    `systemctl --user ${args.join(' ')} failed (exit ${result.status ?? 'unknown'})${detail ? `: ${detail}` : ''}`,
  );
}

export function isCompatibleAknoHello(line: string): boolean {
  try {
    const hello = Hello.safeParse(JSON.parse(line.trim()));
    return hello.success && hello.data.protocol === PROTOCOL_VERSION;
  } catch {
    return false;
  }
}

export async function aknoSocketIsReady(socketPath: string): Promise<boolean> {
  const socket = net.createConnection(socketPath);
  socket.setEncoding('utf8');
  try {
    await once(socket, 'connect', { signal: AbortSignal.timeout(500) });
    const [chunk] = (await once(socket, 'data', { signal: AbortSignal.timeout(500) })) as [string];
    return isCompatibleAknoHello(chunk.split('\n')[0] ?? '');
  } catch {
    return false;
  } finally {
    socket.destroy();
  }
}

async function waitForSocket(socketPath: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await aknoSocketIsReady(socketPath)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
