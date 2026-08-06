import fs from 'node:fs';
import { connect, defaultSocketPath } from '@akno/client';
import { loadConfig, open, type Akno } from '@akno/core';
import type { AknoOps } from '@akno/protocol';
import { style } from './output.js';

export interface OpsHandle {
  ops: AknoOps;
  /** Set when the ops run in-process, for commands that need more than the ops. */
  akno: Akno | null;
  via: 'socket' | 'in-process';
  close(): Promise<void>;
}

/**
 * §6, §16. Spawning a process per memory call costs 33ms against 0.04ms for a
 * long-lived handle — an 800× difference, none of it the database. So a read
 * command prefers a running service and only falls back to in-process, where the
 * 33ms does not matter because there is nothing else in the process anyway.
 *
 * Falling back rather than failing also means the CLI works before the user has
 * ever run `akno serve`, which is the first thing they will try.
 */
export async function resolveOps(
  values: { connect?: boolean; json?: boolean },
  openOptions: { aknoPath?: string; stateDir?: string },
): Promise<OpsHandle> {
  const socketPath = socketFor(openOptions);

  if (values.connect || fs.existsSync(socketPath)) {
    try {
      const client = await connect({ socket: socketPath });
      return {
        ops: client,
        akno: null,
        via: 'socket',
        close: () => client.close(),
      };
    } catch (err) {
      if (values.connect) throw err;
      // A stale socket file from a crashed service is common enough that
      // failing here would be a bad default.
      if (!values.json) {
        process.stderr.write(
          style.grey(`no service on ${socketPath}; opening the index in-process\n`),
        );
      }
    }
  }

  // Read-only: a one-shot read must never take the write handle out from under a
  // service that is about to start, and it does not need it.
  const akno = await open({ ...openOptions, writable: false });
  return {
    ops: akno,
    akno,
    via: 'in-process',
    close: () => akno.close(),
  };
}

function socketFor(openOptions: { aknoPath?: string; stateDir?: string }): string {
  try {
    return loadConfig(openOptions).socketPath;
  } catch {
    // Config may be incomplete — the caller will get a better error from `open()`.
    return defaultSocketPath();
  }
}
