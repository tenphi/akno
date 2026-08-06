import fs from 'node:fs';
import path from 'node:path';
import { open } from '@akno/core';
import { openOptionsFrom, parse } from '../args.js';
import { heading, kv, line, ms, style, warn } from '../output.js';
import { serveSocket } from '../serve/socket.js';
import { serveHttp } from '../serve/http.js';
import { serveMcp } from '../serve/mcp.js';

export const SERVE_HELP = `akno serve [options]

  Hold the index, the watcher and the model connections in one long-lived
  process. Spawning a process per memory call costs 33ms against 0.04ms for a
  long-lived handle — an 800x difference, and none of it is the database.

  --mcp                     stdio MCP, for any agent that speaks it. Logs go to
                            stderr because stdout is the protocol.
  --http <host:port>        Loopback HTTP, for agents in containers or on another
                            host. No auth of its own — put it behind one.
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

  const mem = await open({
    ...openOptionsFrom(values),
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
  }

  const allow = values.allow
    ? values.allow.split(',').map((op) => op.trim())
    : isMcp
      ? mem.config.server.mcpAllow
      : undefined;

  if (values['index-on-start'] && mem.writable) {
    const report = await mem.index({});
    log(`startup index: ${report.pagesIndexed} indexed, ${report.pagesUnchanged} unchanged in ${ms(report.durationMs)}`);
  }

  const closers: (() => Promise<void>)[] = [];

  try {
    if (isMcp) {
      const server = await serveMcp(mem, { ...(allow ? { allow } : {}), log });
      closers.push(() => server.close());
      log(`MCP ready over stdio — ${(allow ?? []).length || 'all'} ops, ${mem.config.aknoPath}`);
    } else {
      const socketPath = values.socket
        ? path.resolve(values.socket)
        : mem.config.socketPath;
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
      const server = await serveHttp(mem, httpAddress, { ...(allow ? { allow } : {}), log });
      closers.push(() => server.close());
      const [host] = server.address.split(':');
      if (host !== '127.0.0.1' && host !== 'localhost') {
        warn(
          `the HTTP door is bound to ${server.address}, not loopback. It has no authentication of ` +
            'its own — anything that can reach that address can read your knowledge base.',
        );
      }
      log(`HTTP ready on ${server.address}`);
    }

    // §16. `KeepAlive` under launchd means the service outlives every host that
    // talks to it, which is the whole point of running it separately. Shutting
    // down cleanly is what makes a restart cost 3ms instead of a WAL replay.
    await waitForShutdown(log);
    return 0;
  } finally {
    for (const close of closers) await close().catch(() => {});
    await mem.close();
  }
}

function waitForShutdown(log: (message: string) => void): Promise<void> {
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
  });
}

export const SERVICE_HELP = `akno service <install | uninstall | status>

  Manage the macOS launchd user agent, so nobody hand-edits XML. Because it is
  KeepAlive, the service outlives every host that talks to it.`;

const PLIST_LABEL = 'dev.akno';

export async function serviceCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ http?: string }>(argv, { http: { type: 'string' } });

  if (values.help || positionals.length === 0) {
    line(SERVICE_HELP);
    return values.help ? 0 : 1;
  }

  if (process.platform !== 'darwin') {
    warn('`akno service` manages a macOS launchd agent; v1 targets macOS only.');
    return 1;
  }

  const plistPath = path.join(
    process.env.HOME ?? '',
    'Library',
    'LaunchAgents',
    `${PLIST_LABEL}.plist`,
  );
  const action = positionals[0];

  if (action === 'status') {
    if (!fs.existsSync(plistPath)) {
      line(`${style.grey('not installed')}  ${plistPath}`);
      return 1;
    }
    line(`${style.green('installed')}  ${plistPath}`);
    line(style.grey('  launchctl print gui/$(id -u)/dev.akno   # live state'));
    return 0;
  }

  if (action === 'uninstall') {
    if (!fs.existsSync(plistPath)) {
      line(style.grey('not installed'));
      return 0;
    }
    fs.rmSync(plistPath);
    line(`removed ${plistPath}`);
    line(style.grey(`run: launchctl bootout gui/$(id -u)/${PLIST_LABEL}`));
    return 0;
  }

  if (action !== 'install') {
    line(SERVICE_HELP);
    return 1;
  }

  const { loadConfig } = await import('@akno/core');
  const config = loadConfig(openOptionsFrom(values));
  const binary = process.argv[1] ?? 'akno';
  const args = ['serve', ...(values.http ? ['--http', values.http] : [])];

  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.writeFileSync(plistPath, plist(PLIST_LABEL, process.execPath, binary, args, config.logDir), 'utf8');

  line(`wrote ${plistPath}`);
  line(style.grey(`run: launchctl bootstrap gui/$(id -u) ${plistPath}`));
  line(style.grey(`logs: ${config.logDir}`));
  return 0;
}

function plist(
  label: string,
  node: string,
  script: string,
  args: string[],
  logDir: string,
): string {
  const programArgs = [node, script, ...args]
    .map((arg) => `    <string>${escapeXml(arg)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${programArgs}
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${escapeXml(path.join(logDir, 'akno.log'))}</string>
  <key>StandardErrorPath</key><string>${escapeXml(path.join(logDir, 'akno.err.log'))}</string>
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
