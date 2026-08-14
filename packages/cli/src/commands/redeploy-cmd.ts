import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style } from '../output.ts';

/**
 * `akno redeploy` — one command to apply local changes end-to-end.
 *
 * The thing to run after editing Akno, so nobody has to remember the sequence. Two steps, and
 * **they are for different consumers**, which is the part worth knowing:
 *
 *  1. `tsc --build`. The service itself does not need this — launchd runs `packages/cli/src/bin.ts`
 *     and Node strips the types, so a source edit is live at the next start. What needs building is
 *     `packages/protocol/dist` and `packages/client/dist`, because **a host importing
 *     `@akno/client` imports the built JavaScript.** Skip the build and Luna keeps calling the
 *     previous op registry: a new op is simply not there, and the failure is `unknown op`.
 *  2. Restart the `dev.akno` launchd agent, which holds the index, the watcher and the models, and
 *     outlives every host that talks to it. A source edit reaches it only here.
 *
 * Then it **waits for the socket**. `launchctl kickstart` returns as soon as launchd has spawned the
 * process, not when the process is listening — so the obvious next command fails with "no Akno
 * service at …", which reads like a broken deploy rather than an impatient one. Observed exactly
 * that, with a three-second sleep in front of it.
 *
 *   akno redeploy
 *   akno redeploy --no-build     # restart only
 *   akno redeploy --no-restart   # build only, for a host that has no service installed
 */

const REDEPLOY_HELP = `akno redeploy [options]

  Apply local changes: build, then restart the service, then wait for its socket.

  The build is for the *hosts*, not for the service — launchd runs the TypeScript
  directly, but anything importing @akno/client imports packages/*/dist. Skipping
  it is how a host ends up calling an op registry one version behind.

  --no-build          Restart only.
  --no-restart        Build only. For a checkout with no service installed.
  --timeout <s>       How long to wait for the socket. Default 30.
  --json`;

const LABEL = 'dev.akno';

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
  skipped: 'asked' | 'not-darwin' | 'no-service' | null;
}

export function redeployPlan(input: {
  build: boolean;
  restart: boolean;
  darwin: boolean;
  serviceInstalled: boolean;
}): RedeployPlan {
  if (!input.restart) return { build: input.build, restart: false, skipped: 'asked' };
  if (!input.darwin) return { build: input.build, restart: false, skipped: 'not-darwin' };
  if (!input.serviceInstalled) return { build: input.build, restart: false, skipped: 'no-service' };
  return { build: input.build, restart: true, skipped: null };
}

const SKIP_NOTE: Record<NonNullable<RedeployPlan['skipped']>, string> = {
  asked: 'the service was left alone',
  'not-darwin': 'restarting a service is macOS-only for now — restart it yourself',
  'no-service': `no service installed (${LABEL}) — nothing to restart. \`akno service install\` sets one up.`,
};

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
  const { loadConfig } = await import('@akno/core');
  const config = loadConfig(openOptionsFrom(values));
  result.socket = config.socketPath;

  const plist = path.join(process.env.HOME ?? '', 'Library', 'LaunchAgents', `${LABEL}.plist`);
  const plan = redeployPlan({
    build: values.build,
    restart: values.restart,
    darwin: process.platform === 'darwin',
    serviceInstalled: fs.existsSync(plist),
  });

  if (plan.skipped) {
    result.ready = fs.existsSync(config.socketPath);
    report(values.json, result, SKIP_NOTE[plan.skipped]);
    return 0;
  }

  if (!values.json) heading('restarting');
  const kick = spawnSync('launchctl', ['kickstart', '-k', `gui/${process.getuid?.() ?? ''}/${LABEL}`], {
    stdio: values.json ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (kick.status !== 0) {
    fail(
      values.json,
      result,
      `launchctl kickstart failed (exit ${kick.status ?? 'unknown'})${buildTail(kick.stderr)}`,
    );
    return 1;
  }
  result.restarted = true;

  // ── Wait ──────────────────────────────────────────────────────────────────
  const timeoutMs = Math.max(1, Number(values.timeout ?? 30)) * 1000;
  result.ready = await waitForSocket(config.socketPath, timeoutMs);
  if (!result.ready) {
    // The restart happened; the process did not come up. Reported as a failure rather than a
    // success with a caveat, because everything the caller does next will fail.
    fail(
      values.json,
      result,
      `restarted, but nothing is listening on ${config.socketPath} after ${timeoutMs / 1000}s — ` +
        'check `akno service status` and the log',
    );
    return 1;
  }

  report(values.json, result, null);
  return 0;
}

/**
 * The socket's existence is the readiness signal, because it is created last: the service takes the
 * write lock, opens the store and starts the watcher before it listens.
 */
async function waitForSocket(socketPath: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(socketPath)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return fs.existsSync(socketPath);
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
