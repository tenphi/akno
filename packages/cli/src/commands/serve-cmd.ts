import fs from 'node:fs';
import path from 'node:path';
import { open } from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, kv, line, ms, style, warn } from '../output.ts';
import { serveSocket } from '../serve/socket.ts';
import { serveHttp } from '../serve/http.ts';
import { serveMcp } from '../serve/mcp.ts';
import { resolveOps } from '../ops-handle.ts';
import { AknoError } from '@tenphi/akno-protocol';
import { DREAM_HEALTH_LABEL, DREAM_SCHEDULE_LABEL } from './dream-schedule.ts';

const SERVE_HELP = `akno serve [options]

  Hold the index, the watcher and the model connections in one long-lived
  process. Spawning a process per memory call costs 33ms against 0.04ms for a
  long-lived handle — an 800x difference, and none of it is the database.

  --mcp                     stdio MCP, for any agent that speaks it. Logs go to
                            stderr because stdout is the protocol.
  --http <host:port>        HTTP for containers or remote agents. Loopback is
                            public read-only; non-loopback requires http_access.
  --socket <path>           Override the unix socket path.
  --no-watch                Do not watch the knowledge base.
  --index-on-start          Reconcile before accepting connections.
  --allow <op,...>          Restrict which ops this door exposes.`;

export async function serveCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    mcp: boolean;
    http?: string;
    socket?: string;
    watch: boolean;
    'index-on-start': boolean;
    allow?: string;
  }>(argv, {
    mcp: { type: 'boolean', default: false },
    http: { type: 'string' },
    socket: { type: 'string' },
    watch: { type: 'boolean', default: true },
    'index-on-start': { type: 'boolean', default: false },
    allow: { type: 'string' },
  });

  if (values.help) {
    line(SERVE_HELP);
    return 0;
  }

  // stdout belongs to the MCP protocol. Anything written there corrupts the
  // stream, so every log line goes to stderr in that mode.
  const isMcp = values.mcp;
  const log = (message: string): void => {
    const stamp = new Date().toISOString().slice(11, 19);
    process.stderr.write(`${style.grey(stamp)} ${message}\n`);
  };

  // A second door in front of the service that already holds the write handle, rather than a
  // second Akno. Opening the index here would give this process a read-only handle — the MCP
  // tools would all be present and every write would fail, which is the worst of both. The
  // service owns the index, the watcher and the models; this is stdio translated onto its socket.
  //
  // Only for `--mcp`: the socket door *is* the service, so serving it this way would be a
  // process forwarding to itself.
  if (isMcp) {
    const forwarded = await serveMcpThroughService(values, log);
    if (forwarded !== null) return forwarded;
  }

  const mem = await open({
    ...openOptionsFrom(values),
    // A service start is nearly always a restart, and the outgoing process is usually still closing
    // its database when this one opens. Without a wait, the replacement comes up read-only and stays
    // that way — refusing every write for its whole life, naming a pid that has already exited.
    writeLockWaitMs: 10_000,
    watch: values.watch,
    watchEvents: {
      onIndexed: (report, changed) => {
        if (report.pagesIndexed === 0 && report.pagesRemoved === 0 && report.pagesRenamed === 0) return;
        const what =
          changed.length > 0 && changed.length <= 3 ? changed.join(', ') : `${report.pagesIndexed} pages`;
        log(
          `indexed ${what} in ${ms(report.durationMs)}` +
            `${report.pagesRenamed > 0 ? ` (${report.pagesRenamed} renamed)` : ''}` +
            `${report.pagesRemoved > 0 ? ` (${report.pagesRemoved} removed)` : ''}`,
        );
        for (const warning of report.warnings.slice(0, 3)) log(style.yellow(`  ${warning}`));
      },
      onError: (error) => log(style.red(`watcher: ${error.message}`)),
    },
  });

  if (!mem.writable) {
    warn(
      `pid ${mem.lockHeldBy} holds the write handle. This instance is read-only: it will serve ` +
        'reads but will not index or watch. Do not run two Aknos against one knowledge base.',
    );
    // Read-only is decided once, when the database is opened, and the connection itself is opened
    // that way — so a service that lost the race cannot promote itself in place. It can notice that
    // the holder is gone and stand down, which under a supervisor means coming straight back with
    // the handle. Without that, losing a restart race by a second costs every write until somebody
    // notices, which on this install was hours of refusals naming a pid that had long exited.
    watchForAReleasedHandle(mem.lockHeldBy, log);
  }

  const requestedAllow = values.allow?.split(',').map((op) => op.trim());
  const allow = isMcp ? effectiveMcpAllow(mem.config.server.mcpAllow, requestedAllow) : requestedAllow;

  if (values['index-on-start'] && mem.writable) {
    const report = await mem.index({});
    log(
      `startup index: ${report.pagesIndexed} indexed, ${report.pagesUnchanged} unchanged in ${ms(report.durationMs)}`,
    );
  }

  const closers: (() => Promise<void>)[] = [];

  try {
    if (isMcp) {
      const server = await serveMcp(mem, { ...(allow ? { allow } : {}), log });
      closers.push(() => server.close());
      log(`MCP ready over stdio — ${(allow ?? []).length || 'all'} ops, ${mem.config.aknoPath}`);
    } else {
      const socketPath = values.socket ? path.resolve(values.socket) : mem.config.socketPath;
      const socket = await serveSocket(mem, socketPath, { ...(allow ? { allow } : {}), log });
      closers.push(() => socket.close());

      heading('Akno serving');
      kv([
        ['knowledge base', mem.config.aknoPath],
        ['socket', socket.path],
        ['watching', values.watch && mem.writable ? 'yes' : 'no'],
        ['writable', mem.writable ? 'yes' : `no (pid ${mem.lockHeldBy})`],
      ]);
    }

    const httpAddress = values.http ?? mem.config.server.http;
    if (httpAddress) {
      const identities = mem.config.server.httpAccess
        .filter((identity) => identity.token !== null)
        .map((identity) => ({ ...identity, token: identity.token! }));
      const missingIdentities = mem.config.server.httpAccess.filter((identity) => identity.token === null);
      for (const identity of missingIdentities) {
        warn(`HTTP identity '${identity.name}' is disabled because ${identity.tokenEnv} is not set.`);
      }
      const server = await serveHttp(mem, httpAddress, {
        ...(allow ? { allow } : {}),
        publicAllow: mem.config.server.httpPublicAllow,
        identities,
        log,
      });
      closers.push(() => server.close());
      if (!server.loopback) {
        log(`HTTP bearer authentication active for ${identities.length} identity/identities`);
      }
      log(`HTTP ready on ${server.address}`);
    }

    // `KeepAlive` under launchd means the service outlives every host that
    // talks to it, which is the whole point of running it separately. Shutting
    // down cleanly is what makes a restart cost 3ms instead of a WAL replay.
    await waitForShutdown(log, { onStdinEnd: isMcp });
    return 0;
  } finally {
    for (const close of closers) await close().catch(() => {});
    await mem.close();
  }
}

/**
 * Serves MCP over an existing service, or returns null when there is none to serve over.
 *
 * `--connect` turns "there is no service" into an error instead, for a host that would rather
 * fail loudly at spawn than quietly get a second Akno it did not ask for.
 */
async function serveMcpThroughService(
  values: { connect?: boolean; allow?: string; aknoPath?: string; stateDir?: string },
  log: (message: string) => void,
): Promise<number | null> {
  const handle = await resolveOps({ ...values, json: true }, openOptionsFrom(values));
  if (handle.via !== 'socket') {
    await handle.close();
    return null;
  }

  const servicePolicy = handle.hello?.mcp_ops ?? [];
  const requested = values.allow?.split(',').map((op) => op.trim());
  const allow = effectiveMcpAllow(servicePolicy, requested);
  const server = await serveMcp(handle.ops, { allow, log });
  log(`MCP ready over stdio — ${allow.length} ops, through the running service`);
  try {
    await waitForShutdown(log, { onStdinEnd: true });
    return 0;
  } finally {
    await server.close();
    await handle.close();
  }
}

export function effectiveMcpAllow(policy: string[], restriction: string[] | undefined): string[] {
  if (!restriction) return [...policy];
  const allowed = new Set(restriction);
  return policy.filter((name) => allowed.has(name));
}

function waitForShutdown(
  log: (message: string) => void,
  options: { onStdinEnd?: boolean } = {},
): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (signal: string): void => {
      if (done) return;
      done = true;
      log(`${signal} — shutting down`);
      resolve();
    };
    process.once('SIGINT', () => finish('SIGINT'));
    process.once('SIGTERM', () => finish('SIGTERM'));
    // launchd sends SIGHUP on a `launchctl kickstart -k`.
    process.once('SIGHUP', () => finish('SIGHUP'));
    // An MCP server is a child of the agent that spawned it, and stdio is the whole
    // relationship: when that pipe closes the client is gone and there is nobody left to serve.
    // Waiting for a signal instead leaves a process per spawn holding a socket connection.
    if (options.onStdinEnd) {
      process.stdin.once('end', () => finish('stdin closed'));
      process.stdin.once('close', () => finish('stdin closed'));
      process.stdin.resume();
    }
  });
}

const SERVICE_HELP = `akno service <install | uninstall | status> [options]

  Manage the macOS launchd user agents, so nobody hand-edits XML.

    dev.akno        KeepAlive — the index, watcher and models in one process, which
                      is why it outlives every host that talks to it.
    dev.akno.dream  Nightly — the maintenance cycle. Observe runs on a schedule,
                      and this is that schedule. It resolves maintenance.profile at
                      run time, so changing authority does not require reinstalling it.
    dev.akno.dream-health
                      Daily — after the two-hour grace window, reports a missed cycle
                      when local maintenance notifications are enabled.

  --http <addr>       Serve loopback HTTP as well as the socket.
  --dream-hour <0-23> When the nightly cycle runs. Default 3.
  --no-dream          Do not install the nightly agent.`;

const PLIST_LABEL = 'dev.akno';

export async function serviceCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ http?: string; 'dream-hour'?: string; dream: boolean }>(argv, {
    http: { type: 'string' },
    'dream-hour': { type: 'string' },
    dream: { type: 'boolean', default: true },
  });

  if (values.help || positionals.length === 0) {
    line(SERVICE_HELP);
    return values.help ? 0 : 1;
  }

  if (process.platform !== 'darwin') {
    warn(
      '`akno service` manages a macOS launchd agent; managed Linux service installation is not available.',
    );
    return 1;
  }

  const agents = path.join(process.env.HOME ?? '', 'Library', 'LaunchAgents');
  const plistPath = path.join(agents, `${PLIST_LABEL}.plist`);
  const dreamPath = path.join(agents, `${DREAM_SCHEDULE_LABEL}.plist`);
  const dreamHealthPath = path.join(agents, `${DREAM_HEALTH_LABEL}.plist`);
  const action = positionals[0];

  if (action === 'status') {
    let installed = false;
    for (const [label, target] of [
      [PLIST_LABEL, plistPath],
      [DREAM_SCHEDULE_LABEL, dreamPath],
      [DREAM_HEALTH_LABEL, dreamHealthPath],
    ] as const) {
      if (fs.existsSync(target)) {
        installed = true;
        line(`${style.green('installed')}  ${target}`);
        line(style.grey(`  launchctl print gui/$(id -u)/${label}   # live state`));
      } else {
        line(`${style.grey('not installed')}  ${target}`);
      }
    }
    return installed ? 0 : 1;
  }

  if (action === 'uninstall') {
    const removed = [plistPath, dreamPath, dreamHealthPath].filter((target) => fs.existsSync(target));
    if (removed.length === 0) {
      line(style.grey('not installed'));
      return 0;
    }
    for (const target of removed) {
      fs.rmSync(target);
      line(`removed ${target}`);
    }
    line(style.grey(`run: launchctl bootout gui/$(id -u)/${PLIST_LABEL}`));
    if (removed.includes(dreamPath)) {
      line(style.grey(`run: launchctl bootout gui/$(id -u)/${DREAM_SCHEDULE_LABEL}`));
    }
    if (removed.includes(dreamHealthPath)) {
      line(style.grey(`run: launchctl bootout gui/$(id -u)/${DREAM_HEALTH_LABEL}`));
    }
    return 0;
  }

  if (action !== 'install') {
    line(SERVICE_HELP);
    return 1;
  }

  // Before anything is written. A bad hour used to abort between the two agents, leaving the
  // service installed, the nightly cycle not, and an error message about neither.
  const hour = dreamHour(values['dream-hour']);

  const { loadConfig } = await import('@tenphi/akno-core');
  const config = loadConfig(openOptionsFrom(values));
  const binary = process.argv[1] ?? 'akno';
  // An installer reached through guided setup carries the exact target the user confirmed.
  // Persist those flags in every agent; otherwise launchd would later resolve whichever
  // checkout config happens to be visible from its working directory.
  const targetArgs = serviceTargetArgs(values);
  const args = ['serve', ...targetArgs, ...(values.http ? ['--http', values.http] : [])];

  fs.mkdirSync(agents, { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.writeFileSync(
    plistPath,
    plist({
      label: PLIST_LABEL,
      node: process.execPath,
      script: binary,
      args,
      logDir: config.logDir,
      keepAlive: true,
    }),
    'utf8',
  );
  line(`wrote ${plistPath}`);
  line(style.grey(`run: launchctl bootstrap gui/$(id -u) ${plistPath}`));

  if (values.dream) {
    // Observe runs on a schedule. A second agent rather than a timer inside `serve`,
    // because the cycle is a *pass* with an exit code and a log — something a person can run
    // by hand, read the output of, and undo — not a background thread nobody can address.
    fs.writeFileSync(
      dreamPath,
      plist({
        label: DREAM_SCHEDULE_LABEL,
        node: process.execPath,
        script: binary,
        // Keep authority unqualified: `dream` resolves the current named profile every night.
        // The marker enables local notification delivery; it does not change dream behaviour.
        args: ['dream', '--scheduled', ...targetArgs],
        logDir: config.logDir,
        logName: 'dream',
        calendarHour: hour,
      }),
      'utf8',
    );
    line(`wrote ${dreamPath}  ${style.grey(`(daily at ${String(hour).padStart(2, '0')}:00)`)}`);
    line(style.grey(`  maintenance profile: ${config.maintenance.profile} (resolved at run time)`));
    line(style.grey(`run: launchctl bootstrap gui/$(id -u) ${dreamPath}`));

    const healthHour = (hour + 2) % 24;
    fs.writeFileSync(
      dreamHealthPath,
      plist({
        label: DREAM_HEALTH_LABEL,
        node: process.execPath,
        script: binary,
        args: ['dream', 'notify', '--schedule-health', ...targetArgs],
        logDir: config.logDir,
        logName: 'dream-health',
        calendarHour: healthHour,
        calendarMinute: 5,
      }),
      'utf8',
    );
    line(
      `wrote ${dreamHealthPath}  ${style.grey(
        `(daily at ${String(healthHour).padStart(2, '0')}:05; notification policy resolved at run time)`,
      )}`,
    );
    line(style.grey(`run: launchctl bootstrap gui/$(id -u) ${dreamHealthPath}`));
  }

  line(style.grey(`logs: ${config.logDir}`));
  return 0;
}

export function serviceTargetArgs(values: { 'akno-path'?: string; 'state-dir'?: string }): string[] {
  return [
    ...(values['akno-path'] ? ['--akno-path', values['akno-path']] : []),
    ...(values['state-dir'] ? ['--state-dir', values['state-dir']] : []),
  ];
}

/** An hour outside 0-23 is a typo, and a nightly job at "25:00" would silently never run. */
function dreamHour(raw: string | undefined): number {
  if (raw === undefined) return 3;
  const hour = Number(raw);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new AknoError('invalid', `--dream-hour wants 0-23, not '${raw}'`);
  }
  return hour;
}

export interface PlistOptions {
  label: string;
  node: string;
  script: string;
  args: string[];
  logDir: string;
  /** Log basename, so the nightly cycle does not interleave with the service's log. */
  logName?: string;
  /** The service: restarted whenever it stops. */
  keepAlive?: boolean;
  /** The nightly cycle: run once a day at this hour. */
  calendarHour?: number;
  calendarMinute?: number;
}

/** Exported for exact scheduler fixture tests; service installation is the only production caller. */
export function plist(options: PlistOptions): string {
  const { label, node, script, args, logDir } = options;
  const logName = options.logName ?? 'akno';
  const programArgs = [node, script, ...args]
    .map((arg) => `    <string>${escapeXml(arg)}</string>`)
    .join('\n');
  const schedule =
    options.calendarHour === undefined
      ? `  <key>RunAtLoad</key><true/>\n  <key>KeepAlive</key>${options.keepAlive ? '<true/>' : '<false/>'}`
      : `  <key>StartCalendarInterval</key>\n  <dict><key>Hour</key><integer>${options.calendarHour}</integer><key>Minute</key><integer>${options.calendarMinute ?? 0}</integer></dict>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${programArgs}
  </array>
${schedule}
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${escapeXml(path.join(logDir, `${logName}.log`))}</string>
  <key>StandardErrorPath</key><string>${escapeXml(path.join(logDir, `${logName}.err.log`))}</string>
</dict>
</plist>
`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });
}

/**
 * Wait for the process holding the write handle to exit, then stand down so a supervisor can
 * restart this one with the handle.
 *
 * Exit code 0 on purpose: nothing failed. Under launchd's `KeepAlive` the replacement is up in a
 * second, and under no supervisor at all the operator gets a line saying exactly what happened and
 * what to do.
 */
function watchForAReleasedHandle(heldBy: number | null, log: (message: string) => void): void {
  if (heldBy === null) return;
  const timer = setInterval(() => {
    if (isAlive(heldBy)) return;
    clearInterval(timer);
    log(`pid ${heldBy} has exited and the write handle is free — restarting to take it`);
    process.exit(0);
  }, 15_000);
  timer.unref();
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
