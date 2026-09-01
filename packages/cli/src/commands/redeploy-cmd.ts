import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AknoError } from '@tenphi/akno-protocol';

import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style } from '../output.ts';
import {
  aknoSocketIsReady,
  readSystemdInstallTarget,
  systemdPaths,
  type SystemdInstallTarget,
} from './service-systemd.ts';

/**
 * `akno redeploy` — one command to apply local changes end-to-end.
 *
 * The thing to run after editing Akno, so nobody has to remember the sequence. Two steps:
 *
 *  1. `tsc --build`. **The service needs this too, and that is easy to get wrong.** launchd runs
 *     `packages/cli/src/bin.ts` and Node strips the types, so the CLI's own files are live at the
 *     next start — but everything under `packages/core` reaches it as a *package*: `serve-cmd.ts`
 *     imports `@tenphi/akno-core`, whose `exports` field points at `dist/index.js`. So a source edit
 *     inside core is invisible to the running service until it is built, however many times the
 *     agent is restarted. Hosts need the build for their own reason: anything importing
 *     `@tenphi/akno-client` imports the built JavaScript, and skipping it leaves a host calling the previous
 *     op registry, where a new op is simply not there and the failure is `unknown op`.
 *
 *     This comment used to say the service did not need the build. It cost an afternoon: a fix to
 *     `models/client.ts` was committed, the agent restarted, the identical failure reproduced, and
 *     the code looked wrong when it was merely not loaded. `vitest` imports `./client.ts` directly,
 *     so the tests passed throughout and proved nothing about what was running.
 *  2. Restart the `dev.akno` launchd agent, which holds the index, the watcher and the models, and
 *     outlives every host that talks to it. A built change reaches it only here.
 *
 * Then it **waits for the socket**. `launchctl kickstart` returns as soon as launchd has spawned the
 * process, not when the process is listening — so the obvious next command fails with "no Akno
 * service at …", which reads like a broken deploy rather than an impatient one. A normal start gets
 * a 30-second fast path. If launchd says the replacement is still running, redeploy keeps waiting up
 * to a bounded three minutes instead of reporting a false failure during a slow live handoff.
 *
 *   akno redeploy
 *   akno redeploy --no-build     # restart only
 *   akno redeploy --no-restart   # build only, for a host that has no service installed
 */

const REDEPLOY_HELP = `akno redeploy [options]

  Apply local changes: build, then restart the service, then wait for its socket.

  The build is not optional for the service either: launchd runs the CLI's TypeScript
  directly, but core reaches it as @tenphi/akno-core, whose exports point at dist. A change
  under packages/core is invisible to a restarted service until it is built.

  Hosts need it for their own reason — anything importing @tenphi/akno-client imports
  packages/*/dist, and skipping it is how a host ends up calling an op registry one
  version behind.

  --no-build          Restart only.
  --no-restart        Build only. For a checkout with no service installed.
  --timeout <s>       Hard socket deadline. By default wait 30s, then up to 180s
                      while the launchd replacement is still running.
  --json`;

const LABEL = 'dev.akno';
const DEFAULT_FAST_SOCKET_WAIT_MS = 30_000;
const DEFAULT_MAX_SOCKET_WAIT_MS = 180_000;

export interface RedeployWaitPolicy {
  fastMs: number;
  maximumMs: number;
}

/** An explicit timeout is a hard operator choice; the default has a fast and slow handoff tier. */
export function redeployWaitPolicy(timeoutSeconds?: string): RedeployWaitPolicy {
  if (timeoutSeconds !== undefined) {
    const seconds = Number(timeoutSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new AknoError('invalid', '--timeout must be a positive number of seconds');
    }
    const milliseconds = Math.max(1, seconds) * 1000;
    return { fastMs: milliseconds, maximumMs: milliseconds };
  }
  return { fastMs: DEFAULT_FAST_SOCKET_WAIT_MS, maximumMs: DEFAULT_MAX_SOCKET_WAIT_MS };
}

/** Content-safe launchctl output parser used only after the fast socket deadline expires. */
export function launchdServiceIsRunning(output: string): boolean {
  return /^\s*state = running\s*$/m.test(output) && /^\s*pid = \d+\s*$/m.test(output);
}

export interface SocketIdentity {
  device: number;
  inode: number;
  changedAtMs: number;
}

/** A pre-restart listener is not evidence that the replacement is ready. */
export function socketWasReplaced(previous: SocketIdentity | null, current: SocketIdentity | null): boolean {
  if (!current) return false;
  if (!previous) return true;
  return (
    current.device !== previous.device ||
    current.inode !== previous.inode ||
    current.changedAtMs !== previous.changedAtMs
  );
}

/**
 * What a redeploy will actually do, before it does any of it.
 *
 * Split out because the interesting part of this command is a decision table, and a decision table
 * that only exists inside a function that shells out to `pnpm` and `launchctl` is a decision table
 * nothing checks. Two of its rows are load-bearing:
 *
 * - **A failed build restarts nothing.** Restarting anyway puts the *previous* code back into
 *   service and reports success, which is worse than stopping — the deploy looks done and the
 *   change is not there.
 * - **No service installed is not a failure.** A checkout that talks to Akno in-process has
 *   nothing to restart, and a launchctl error about an unfamiliar label is not an improvement on
 *   saying so.
 */
export interface RedeployPlan {
  build: boolean;
  restart: boolean;
  /** Why the restart is not happening, when it is not. Null when it is. */
  skipped: 'asked' | 'unsupported' | 'no-service' | null;
}

export function redeployPlan(input: {
  build: boolean;
  restart: boolean;
  darwin: boolean;
  linux: boolean;
  serviceInstalled: boolean;
}): RedeployPlan {
  if (!input.restart) return { build: input.build, restart: false, skipped: 'asked' };
  if (!input.darwin && !input.linux) return { build: input.build, restart: false, skipped: 'unsupported' };
  if (!input.serviceInstalled) return { build: input.build, restart: false, skipped: 'no-service' };
  return { build: input.build, restart: true, skipped: null };
}

const SKIP_NOTE: Record<NonNullable<RedeployPlan['skipped']>, string> = {
  asked: 'the service was left alone',
  unsupported: 'restarting a service is supported on macOS and Linux — restart it yourself',
  'no-service': `no service installed (${LABEL}) — nothing to restart. \`akno service install\` sets one up.`,
};

export function redeployTarget(
  linux: boolean,
  current: SystemdInstallTarget,
  installed: SystemdInstallTarget | null,
): SystemdInstallTarget {
  return linux && installed ? installed : current;
}

export async function redeployCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ build: boolean; restart: boolean; timeout?: string }>(argv, {
    build: { type: 'boolean', default: true },
    restart: { type: 'boolean', default: true },
    timeout: { type: 'string' },
  });

  if (values.help) {
    line(REDEPLOY_HELP);
    return 0;
  }

  const result: {
    built: boolean;
    restarted: boolean;
    socket: string | null;
    ready: boolean;
    note?: string;
  } = { built: false, restarted: false, socket: null, ready: false };

  // ── Build ─────────────────────────────────────────────────────────────────
  if (values.build) {
    const root = repoRoot();
    if (!root) {
      fail(values.json, result, 'cannot find the repo root — run this from inside an Akno checkout');
      return 1;
    }
    if (!values.json) heading('building');
    const build = spawnSync('pnpm', ['run', 'build'], {
      cwd: root,
      stdio: values.json ? 'pipe' : 'inherit',
      encoding: 'utf8',
    });
    if (build.status !== 0) {
      // Nothing is restarted after a failed build. Restarting anyway would put the *old* code back
      // into service and report success, which is the one outcome worse than stopping.
      fail(values.json, result, `build failed (exit ${build.status ?? 'unknown'})${buildTail(build.stderr)}`);
      return 1;
    }
    result.built = true;
  }

  // ── Restart ───────────────────────────────────────────────────────────────
  const { loadConfig } = await import('@tenphi/akno-core');
  const config = loadConfig(openOptionsFrom(values));

  const darwin = process.platform === 'darwin';
  const linux = process.platform === 'linux';
  const target = redeployTarget(
    linux,
    {
      aknoPath: config.aknoPath,
      stateDir: config.stateDir,
      socketPath: config.socketPath,
      configPath: process.env.AKNO_CONFIG ?? null,
    },
    linux ? readSystemdInstallTarget(LABEL) : null,
  );
  result.socket = target.socketPath;
  const serviceDefinition = darwin
    ? path.join(process.env.HOME ?? '', 'Library', 'LaunchAgents', `${LABEL}.plist`)
    : systemdPaths(LABEL).service;
  const plan = redeployPlan({
    build: values.build,
    restart: values.restart,
    darwin,
    linux,
    serviceInstalled: fs.existsSync(serviceDefinition),
  });

  if (plan.skipped) {
    result.ready = await socketAcceptsConnections(target.socketPath);
    report(values.json, result, SKIP_NOTE[plan.skipped]);
    return 0;
  }

  const previousSocket = socketIdentity(target.socketPath);
  if (!values.json) heading('restarting');
  const restartCommand = darwin
    ? (['launchctl', ['kickstart', '-k', `gui/${process.getuid?.() ?? ''}/${LABEL}`]] as const)
    : (['systemctl', ['--user', 'restart', `${LABEL}.service`]] as const);
  const kick = spawnSync(restartCommand[0], restartCommand[1], {
    stdio: values.json ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (kick.status !== 0) {
    fail(
      values.json,
      result,
      `${restartCommand[0]} restart failed (exit ${kick.status ?? 'unknown'})${buildTail(kick.stderr)}`,
    );
    return 1;
  }
  result.restarted = true;

  // ── Wait ──────────────────────────────────────────────────────────────────
  const waitPolicy = redeployWaitPolicy(values.timeout);
  result.ready = await waitForSocket(target.socketPath, waitPolicy.fastMs, previousSocket);
  let waitedMs = waitPolicy.fastMs;
  if (!result.ready && waitPolicy.maximumMs > waitPolicy.fastMs && replacementIsRunning(darwin)) {
    if (!values.json) {
      line(
        style.grey(
          `replacement is still starting after ${waitPolicy.fastMs / 1000}s; ` +
            `waiting up to ${waitPolicy.maximumMs / 1000}s`,
        ),
      );
    }
    result.ready = await waitForSocket(
      target.socketPath,
      waitPolicy.maximumMs - waitPolicy.fastMs,
      previousSocket,
    );
    waitedMs = waitPolicy.maximumMs;
  }
  if (!result.ready) {
    // The restart happened; the process did not come up. Reported as a failure rather than a
    // success with a caveat, because everything the caller does next will fail.
    fail(
      values.json,
      result,
      `restarted, but nothing is listening on ${target.socketPath} after ${waitedMs / 1000}s — ` +
        'check `akno service status` and the log',
    );
    return 1;
  }

  report(values.json, result, null);
  return 0;
}

/**
 * Readiness requires a replacement socket that accepts connections. Existence alone can be the
 * outgoing service's still-live path during a launchd handoff.
 */
async function waitForSocket(
  socketPath: string,
  timeoutMs: number,
  previous: SocketIdentity | null,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (
      socketWasReplaced(previous, socketIdentity(socketPath)) &&
      (await socketAcceptsConnections(socketPath))
    ) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return (
    socketWasReplaced(previous, socketIdentity(socketPath)) && (await socketAcceptsConnections(socketPath))
  );
}

function socketIdentity(socketPath: string): SocketIdentity | null {
  try {
    const stat = fs.statSync(socketPath);
    if (!stat.isSocket()) return null;
    return { device: stat.dev, inode: stat.ino, changedAtMs: stat.ctimeMs };
  } catch {
    return null;
  }
}

async function socketAcceptsConnections(socketPath: string): Promise<boolean> {
  return aknoSocketIsReady(socketPath);
}

function replacementIsRunning(darwin: boolean): boolean {
  if (!darwin) {
    return spawnSync('systemctl', ['--user', 'is-active', '--quiet', `${LABEL}.service`]).status === 0;
  }
  const inspected = spawnSync('launchctl', ['print', `gui/${process.getuid?.() ?? ''}/${LABEL}`], {
    encoding: 'utf8',
  });
  return inspected.status === 0 && launchdServiceIsRunning(inspected.stdout ?? '');
}

/** Walks up for the workspace marker, so this works from any directory in the checkout. */
function repoRoot(): string | null {
  let dir = import.meta.dirname;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function buildTail(stderr: string | null): string {
  const tail = (stderr ?? '').trim().split('\n').slice(-3).join('\n');
  return tail ? `\n${tail}` : '';
}

type Result = { built: boolean; restarted: boolean; socket: string | null; ready: boolean; note?: string };

function report(asJson: boolean | undefined, result: Result, note: string | null): void {
  if (note) result.note = note;
  if (asJson) {
    json({ ok: true, ...result });
    return;
  }
  line();
  kv([
    ['built', result.built ? 'yes' : 'skipped'],
    ['restarted', result.restarted ? LABEL : 'no'],
    ['socket', result.ready ? `${result.socket} (up)` : (result.socket ?? null)],
  ]);
  if (note) line(style.grey(`\n  ${note}`));
}

function fail(asJson: boolean | undefined, result: Result, message: string): void {
  if (asJson) {
    json({ ok: false, ...result, error: message });
    return;
  }
  line(`\n${style.red('redeploy failed')}  ${message}`);
}
