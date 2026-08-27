import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  AknoError,
  COMMAND_NAMES,
  isCommandName,
  type CommandName,
  OPS,
  WireRequest,
  createLineDecoder,
  encodeLine,
  isOpName,
  PROTOCOL_VERSION,
  type Hello,
} from '@tenphi/akno-protocol';
import {
  MAINTENANCE_PLAN_STATUSES,
  type Akno,
  type MaintenanceMode,
  type MaintenancePlanStatus,
  type MaintenanceStatusQuery,
} from '@tenphi/akno-core';

export interface SocketServer {
  readonly path: string;
  close(): Promise<void>;
}

/**
 * The default door: no port, filesystem permissions are the auth, and it is
 * the fastest. Newline-delimited JSON over a unix socket, framed by the protocol
 * package so this file and the client cannot disagree about the wire.
 */
export async function serveSocket(
  akno: Akno,
  socketPath: string,
  options: { allow?: string[]; log?: (message: string) => void } = {},
): Promise<SocketServer> {
  fs.mkdirSync(path.dirname(socketPath), { recursive: true });

  // A socket file left behind by a crash blocks bind. The write lock is what
  // actually prevents two servers, so removing a dead socket is safe here.
  if (fs.existsSync(socketPath)) {
    if (await isLive(socketPath)) {
      throw new AknoError('read_only', `another Akno is already listening on ${socketPath}`);
    }
    fs.rmSync(socketPath, { force: true });
  }

  const server = net.createServer((socket) => {
    socket.setNoDelay(true);
    socket.setEncoding('utf8');

    const hello: Hello = {
      hello: 'akno',
      protocol: PROTOCOL_VERSION,
      version: '0.1.0',
      writable: akno.writable,
      akno_path: akno.config.aknoPath,
      ops: options.allow ?? Object.keys(OPS),
      commands: [...COMMAND_NAMES],
    };
    socket.write(encodeLine(hello));

    const decode = createLineDecoder();
    socket.on('data', (chunk: string) => {
      for (const raw of decode(chunk)) {
        void handle(raw, socket, akno, options);
      }
    });
    socket.on('error', () => socket.destroy());
  });

  // macOS allows 104 bytes for a socket path, including the terminator. Past that the bind
  // *succeeds* on a silently truncated name and the chmod below fails with a bare ENOENT stack
  // trace — which is what a deep `state_dir` produced. Said plainly and up front instead.
  const pathBytes = Buffer.byteLength(socketPath) + 1;
  if (pathBytes > 104) {
    throw new AknoError(
      'invalid',
      `the socket path is ${pathBytes} bytes and macOS allows 104: ${socketPath}. ` +
        'Set `server.socket` to an absolute path somewhere shorter, or move `state_dir`.',
    );
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      try {
        // Owner-only: the socket *is* the authentication boundary. If it cannot be locked
        // down, the door does not open — a world-readable socket is worse than no socket.
        fs.chmodSync(socketPath, 0o600);
      } catch (err) {
        reject(
          new AknoError(
            'unavailable',
            `the socket could not be secured at ${socketPath}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        return;
      }
      resolve();
    });
  });

  return {
    path: socketPath,
    async close(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(socketPath, { force: true });
    },
  };
}

/**
 * Operator commands, run by the process that holds the write handle. Input is
 * shaped by the CLI that sends it; each of these is a small, named bag of options rather than
 * an op with a schema, which is why they are not in the registry.
 */
async function runCommand(akno: Akno, command: CommandName, input: unknown): Promise<unknown> {
  const options = (input ?? {}) as Record<string, never>;
  switch (command) {
    case 'index':
      return akno.index(options);
    case 'inbox':
      return akno.inbox(options);
    case 'dream':
      return akno.dream(options);
    case 'approve': {
      const slug = (input as { slug?: unknown } | null)?.slug;
      return akno.approve(
        idFrom(input, 'proposal_id'),
        typeof slug === 'string' && slug.length > 0 ? { slug } : {},
      );
    }
    case 'decline':
      return akno.decline(idFrom(input, 'proposal_id'));
    case 'changes':
      return akno.changes(limitFrom(input));
    case 'proposals':
      return akno.proposals();
    case 'plan': {
      const action = stringFrom(input, 'action');
      switch (action) {
        case 'list':
          return akno.plans(limitFrom(input), planStatusesFrom(input));
        case 'show':
          return akno.plan(idFrom(input, 'plan_id'));
        case 'diff': {
          const item = (input as { item_id?: unknown } | null)?.item_id;
          const revision = optionalPositiveInteger(input, 'revision');
          return akno.maintenanceDiff(
            idFrom(input, 'plan_id'),
            typeof item === 'string' && item.length > 0 ? item : undefined,
            revision,
          );
        }
        case 'revise': {
          const relPath = (input as { rel_path?: unknown } | null)?.rel_path;
          const reason = (input as { reason?: unknown } | null)?.reason;
          if (relPath !== undefined && (typeof relPath !== 'string' || relPath.length === 0)) {
            throw new AknoError('invalid', 'rel_path must be a non-empty string');
          }
          if (reason !== undefined && typeof reason !== 'string') {
            throw new AknoError('invalid', 'reason must be a string');
          }
          return akno.revisePlan(idFrom(input, 'plan_id'), idFrom(input, 'item_id'), {
            after: stringFrom(input, 'after'),
            ...(typeof relPath === 'string' ? { relPath } : {}),
            ...(typeof reason === 'string' ? { reason } : {}),
          });
        }
        case 'decide': {
          const outcome = stringFrom(input, 'outcome');
          if (outcome !== 'approve' && outcome !== 'reject') {
            throw new AknoError('invalid', 'outcome must be approve or reject');
          }
          const reason = (input as { reason?: unknown } | null)?.reason;
          const idempotencyKey = optionalStringFrom(input, 'idempotency_key');
          return akno.decidePlan(
            idFrom(input, 'plan_id'),
            idFrom(input, 'item_id'),
            outcome,
            typeof reason === 'string' ? reason : '',
            idempotencyKey ? { idempotencyKey } : {},
          );
        }
        case 'apply': {
          const idempotencyKey = optionalStringFrom(input, 'idempotency_key');
          return akno.applyPlan(idFrom(input, 'plan_id'), idempotencyKey ? { idempotencyKey } : {});
        }
        case 'supersede': {
          const reason = (input as { reason?: unknown } | null)?.reason;
          return akno.supersedePlan(
            idFrom(input, 'plan_id'),
            typeof reason === 'string' ? reason : undefined,
          );
        }
        case 'prune':
          return akno.prunePlans({ apply: booleanFrom(input, 'apply', false) });
        case 'status':
          return akno.maintenanceStatus(statusQueryFrom(input));
        case 'policy': {
          const mode = optionalMaintenanceMode(input);
          return akno.maintenancePolicy(stringFrom(input, 'path'), mode);
        }
        default:
          throw new AknoError('invalid', `unknown plan action: ${action}`);
      }
    }
  }
}

function optionalMaintenanceMode(input: unknown): MaintenanceMode | undefined {
  const value = (input as Record<string, unknown> | null)?.mode;
  if (value === undefined) return undefined;
  if (value === 'audit' || value === 'review' || value === 'auto') return value;
  throw new AknoError('invalid', 'mode must be audit, review, or auto');
}

function idFrom(input: unknown, key: string): string {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AknoError('invalid', `${key} is required`);
  }
  return value;
}

function stringFrom(input: unknown, key: string): string {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AknoError('invalid', `${key} is required`);
  }
  return value;
}

function optionalStringFrom(input: unknown, key: string): string | undefined {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AknoError('invalid', `${key} must be a non-empty string`);
  }
  return value;
}

function booleanFrom(input: unknown, key: string, fallback: boolean): boolean {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new AknoError('invalid', `${key} must be boolean`);
  return value;
}

function optionalPositiveInteger(input: unknown, key: string): number | undefined {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new AknoError('invalid', `${key} must be a positive integer`);
  }
  return value;
}

function limitFrom(input: unknown): number {
  const value = (input as { limit?: unknown } | null)?.limit;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 20;
}

function planStatusesFrom(input: unknown): MaintenancePlanStatus[] {
  const value = (input as { status?: unknown } | null)?.status;
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (status) =>
        typeof status !== 'string' || !(MAINTENANCE_PLAN_STATUSES as readonly string[]).includes(status),
    )
  ) {
    throw new AknoError('invalid', `plan status must contain: ${MAINTENANCE_PLAN_STATUSES.join(', ')}`);
  }
  return [...new Set(value)] as MaintenancePlanStatus[];
}

function statusQueryFrom(input: unknown): MaintenanceStatusQuery {
  const values = (input as Record<string, unknown> | null) ?? {};
  const runId = values.run_id;
  const last = values.last;
  const pending = values.pending;
  const selected = Number(runId !== undefined) + Number(last !== undefined) + Number(pending === true);
  if (selected > 1) throw new AknoError('invalid', 'choose only one of run_id, last, or pending');
  if (runId !== undefined && (typeof runId !== 'string' || runId.length === 0)) {
    throw new AknoError('invalid', 'run_id must be a non-empty string');
  }
  if (last !== undefined && (typeof last !== 'number' || !Number.isInteger(last) || last < 1 || last > 100)) {
    throw new AknoError('invalid', 'last must be an integer from 1 to 100');
  }
  if (pending !== undefined && typeof pending !== 'boolean') {
    throw new AknoError('invalid', 'pending must be boolean');
  }
  return {
    ...(typeof runId === 'string' ? { runId } : {}),
    ...(typeof last === 'number' ? { last } : {}),
    ...(pending === true ? { pending: true } : {}),
  };
}

async function handle(
  raw: string,
  socket: net.Socket,
  akno: Akno,
  options: { allow?: string[]; log?: (message: string) => void },
): Promise<void> {
  let request;
  try {
    request = WireRequest.parse(JSON.parse(raw));
  } catch {
    socket.write(
      encodeLine({ id: 0, ok: false, error: { code: 'invalid', message: 'malformed request line' } }),
    );
    return;
  }

  const started = performance.now();
  try {
    if (request.kind === 'command') {
      // Exactly one process holds the write handle, so maintenance that writes has to be
      // reachable *through* the service rather than racing it.
      if (!isCommandName(request.op)) {
        throw new AknoError('invalid', `unknown command: ${request.op}`);
      }
      const result = await runCommand(akno, request.op, request.input);
      options.log?.(`${request.op} ${(performance.now() - started).toFixed(1)}ms`);
      socket.write(encodeLine({ id: request.id, ok: true, result }));
      return;
    }

    if (!isOpName(request.op)) {
      throw new AknoError('invalid', `unknown op: ${request.op}`);
    }
    // Trust is a parameter, not a property of the transport: the same code
    // runs with different permissions, so an MCP caller can be denied `forget`
    // without a second code path that grows its own bugs.
    if (options.allow && !options.allow.includes(request.op)) {
      throw new AknoError('forbidden', `${request.op} is not allowed on this door`);
    }
    // Honoured because this door is trusted: filesystem permissions are its authentication, and
    // without it a host mediating for an agent could never answer a gated proposal on the owner's
    // behalf — the gate would be unanswerable through the door the service is reached by.
    const result = await akno.call(
      request.op,
      request.input as never,
      request.actor ? { actor: request.actor } : {},
    );
    options.log?.(`${request.op} ${(performance.now() - started).toFixed(1)}ms`);
    socket.write(encodeLine({ id: request.id, ok: true, result }));
  } catch (err) {
    const error = AknoError.from(err);
    options.log?.(`${request.op} ${error.code}: ${error.message}`);
    socket.write(encodeLine({ id: request.id, ok: false, error: error.toJSON() }));
  }
}

/** A socket nobody is listening on refuses the connection immediately. */
async function isLive(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createConnection(socketPath);
    const done = (live: boolean): void => {
      probe.destroy();
      resolve(live);
    };
    probe.once('connect', () => done(true));
    probe.once('error', () => done(false));
    setTimeout(() => done(false), 500);
  });
}
