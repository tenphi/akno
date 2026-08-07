import fs from 'node:fs';
import { connect, defaultSocketPath } from '@akno/client';
import { loadConfig, open, type Akno } from '@akno/core';
import type { CommandName, AknoOps, OpInput, OpName, OpResult } from '@akno/protocol';
import { style } from './output.ts';

export interface OpsHandle {
  /**
   * The named ops, plus the dynamic `call` both sides implement — a door that dispatches by
   * name (MCP, HTTP) needs it, and dropping it here would force such a door to re-resolve the
   * service itself and duplicate the fallback rules.
   */
  ops: AknoOps & { call<N extends OpName>(op: N, input: OpInput<N>): Promise<OpResult<N>> };
  /** Set when the ops run in-process, for commands that need more than the ops. */
  akno: Akno | null;
  via: 'socket' | 'in-process';
  close(): Promise<void>;
}

/**
 * Spawning a process per memory call costs 33ms against 0.04ms for a
 * long-lived handle — an 800× difference, none of it the database. So a read
 * command prefers a running service and only falls back to in-process, where the
 * 33ms does not matter because there is nothing else in the process anyway.
 *
 * Falling back rather than failing also means the CLI works before the user has
 * ever run `akno serve`, which is the first thing they will try.
 *
 * **Writes route the same way, and must.** They used to call `open()` directly, which meant every
 * one of them failed `read_only` whenever the service was running — the arrangement the docs
 * recommend. `akno remember` from a terminal, on a machine set up as documented, could not write.
 */
export async function resolveOps(
  values: { connect?: boolean; json?: boolean },
  openOptions: { aknoPath?: string; stateDir?: string },
  options: { write?: boolean; actor?: 'user' | 'agent' | 'akno' } = {},
): Promise<OpsHandle> {
  const socketPath = socketFor(openOptions);

  if (values.connect || fs.existsSync(socketPath)) {
    try {
      const client = await connect({
        socket: socketPath,
        // Stated per connection, because the alternative is a write from a person at a terminal
        // being gated as though an agent had asked — and a gated proposal being unanswerable
        // through the door the service is meant to be reached by.
        ...(options.actor ? { actor: options.actor } : {}),
      });
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
        process.stderr.write(style.grey(`no service on ${socketPath}; opening the index in-process\n`));
      }
    }
  }

  // A read takes no write handle: a one-shot must never pull it out from under a service that is
  // about to start, and it does not need it. A write has no choice — with no service there is
  // nobody else to do it.
  const akno = await open({
    ...openOptions,
    writable: options.write === true,
    ...(options.actor ? { actor: options.actor } : {}),
  });
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

/**
 * Runs maintenance — `index`, `inbox`, `dream` — through the running service when there
 * is one, and in-process when there is not.
 *
 * Exactly one process may hold the write handle, so with a service running these have to go
 * *through* it. They used to open the index directly and be refused, each in its own way: the
 * nightly cycle failed with "another process holds the write handle", `index` warned and
 * exited, and `inbox` reported an empty inbox it had never been able to read.
 */
export async function runMaintenance<T>(
  command: CommandName,
  input: Record<string, unknown>,
  values: { connect?: boolean; json?: boolean },
  openOptions: { aknoPath?: string; stateDir?: string },
  inProcess: (akno: Akno) => Promise<T>,
  options: { writable?: boolean } = {},
): Promise<T> {
  const socketPath = socketFor(openOptions);

  if (values.connect || fs.existsSync(socketPath)) {
    try {
      const client = await connect({ socket: socketPath });
      try {
        if (!values.json) {
          process.stderr.write(style.grey(`via the service on ${socketPath}\n`));
        }
        return (await client.command(command, input)) as T;
      } finally {
        await client.close();
      }
    } catch (err) {
      // `--connect` means the caller wants the service or nothing; otherwise a stale socket
      // file from a crashed service must not stop a one-off pass.
      if (values.connect) throw err;
      if (!values.json) {
        process.stderr.write(style.grey(`no service on ${socketPath}; running in-process\n`));
      }
    }
  }

  // `proposals` and `changes` only read; taking the write handle for them would block a service
  // from starting while somebody lists their pending approvals.
  const akno = await open({ ...openOptions, ...(options.writable === false ? { writable: false } : {}) });
  try {
    return await inProcess(akno);
  } finally {
    await akno.close();
  }
}
