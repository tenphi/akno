import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  AknoError,
  Hello,
  OP_NAMES,
  PROTOCOL_VERSION,
  createLineDecoder,
  encodeLine,
  type AknoOps,
  type Hello as HelloMessage,
  type OpInput,
  type OpName,
  type OpResult,
} from '@tenphi/akno-protocol';

/**
 * `@tenphi/akno-client` has the **identical interface** to the library — same
 * ops, same schemas, generated from the same registry. Swapping `open()` for
 * `connect()` is the only difference between embedding and connecting, so the
 * decision is reversible and nothing above the call site knows which is in use.
 *
 * No native dependencies live here: sqlite-vec and the SQLite bindings never
 * enter the host's build.
 */

export interface ConnectOptions {
  /** Unix socket path. Defaults to `~/.akno/akno.sock`. */
  socket?: string;
  /** `host:port` for a loopback HTTP door instead of a socket. */
  http?: string;
  timeoutMs?: number;
  /** Fail rather than warn when the server's protocol version differs. */
  strictVersion?: boolean;
  /**
   * Who this connection speaks for. Default `agent`, which is what the gate assumes.
   *
   * A host that mediates between a person and an agent needs both, and can say so per call. The
   * distinction is not cosmetic: `user` is never gated, so a proposal the agent could not write is
   * answered by passing `actor: 'user'` on the replay — the mechanism `akno approve` uses.
   */
  actor?: 'user' | 'agent' | 'akno';
}

export interface AknoClient extends AknoOps {
  readonly hello: HelloMessage;
  /** `actor` overrides the connection's default for this one call. */
  call<N extends OpName>(
    op: N,
    input: OpInput<N>,
    options?: { actor?: 'user' | 'agent' | 'akno' },
  ): Promise<OpResult<N>>;
  /**
   * Ask the writer to do maintenance: `index`, `inbox`, `dream`.
   *
   * Not an op — the ten ops are what an agent calls about memory, and these are operator
   * commands about the process. They exist here because exactly one process may write: with a
   * service running, work that writes is either reachable through it or not reachable at all.
   */
  command(name: string, input?: unknown): Promise<unknown>;
  close(): Promise<void>;
}

export function defaultSocketPath(): string {
  return process.env.AKNO_SOCKET ?? path.join(os.homedir(), '.akno', 'akno.sock');
}

export async function connect(options: ConnectOptions = {}): Promise<AknoClient> {
  return options.http
    ? connectHttp(options.http, options)
    : connectSocket(options.socket ?? defaultSocketPath(), options);
}

// ─── Unix socket ────────────────────────────────────────────────────────────

/**
 * The preferred door for a host on the same machine: no port, filesystem
 * permissions are the auth, and it is the fastest. A round trip measures 18µs
 * against a recall budget of 300ms — five thousandths of one percent, which is
 * why IPC cost is not a reason to embed.
 */
async function connectSocket(socketPath: string, options: ConnectOptions): Promise<AknoClient> {
  const socket = await new Promise<net.Socket>((resolve, reject) => {
    const candidate = net.createConnection(socketPath);
    const onError = (err: Error): void => {
      candidate.destroy();
      reject(
        new AknoError(
          'unavailable',
          `no Akno service at ${socketPath}: ${err.message}. Start one with \`akno serve\`.`,
        ),
      );
    };
    candidate.once('error', onError);
    candidate.once('connect', () => {
      candidate.off('error', onError);
      resolve(candidate);
    });
  });

  socket.setNoDelay(true);
  const decode = createLineDecoder();
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  let helloResolve: ((value: HelloMessage) => void) | null = null;
  const helloPromise = new Promise<HelloMessage>((resolve) => {
    helloResolve = resolve;
  });
  let nextId = 1;
  let closed = false;

  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    for (const raw of decode(chunk)) {
      let message: unknown;
      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }

      const maybeHello = Hello.safeParse(message);
      if (maybeHello.success) {
        helloResolve?.(maybeHello.data);
        continue;
      }

      const envelope = message as { id?: number; ok?: boolean; result?: unknown; error?: unknown };
      if (typeof envelope.id !== 'number') continue;
      const waiter = pending.get(envelope.id);
      if (!waiter) continue;
      pending.delete(envelope.id);
      if (envelope.ok) waiter.resolve(envelope.result);
      else waiter.reject(AknoError.from(envelope.error));
    }
  });

  const die = (err: Error): void => {
    closed = true;
    for (const waiter of pending.values()) waiter.reject(err);
    pending.clear();
  };
  socket.on('error', (err) => die(AknoError.from(err)));
  socket.on('close', () => die(new AknoError('unavailable', 'the Akno service closed the connection')));

  const timeoutMs = options.timeoutMs ?? 30_000;
  const resolved = await withTimeout(
    helloPromise,
    5000,
    new AknoError('unavailable', `${socketPath} accepted a connection but sent no handshake`),
  );
  assertVersion(resolved, options);

  async function send(
    op: string,
    input: unknown,
    kind: 'op' | 'command',
    actor?: 'user' | 'agent' | 'akno',
  ): Promise<unknown> {
    if (closed) throw new AknoError('unavailable', 'the connection is closed');
    const id = nextId++;
    const promise = new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    socket.write(
      encodeLine({
        id,
        op,
        ...(kind === 'command' ? { kind } : {}),
        input,
        ...(actor ? { actor } : {}),
      }),
    );
    // A command is maintenance: reconciling a large tree or running the cycle takes minutes,
    // where an op that slow has already failed at its job.
    const deadline = kind === 'command' ? Math.max(timeoutMs, 15 * 60_000) : timeoutMs;
    return withTimeout(
      promise,
      deadline,
      new AknoError('unavailable', `${op} did not respond within ${deadline}ms`),
    );
  }

  async function call<N extends OpName>(
    op: N,
    input: OpInput<N>,
    callOptions: { actor?: 'user' | 'agent' | 'akno' } = {},
  ): Promise<OpResult<N>> {
    return (await send(op, input, 'op', callOptions.actor ?? options.actor)) as OpResult<N>;
  }

  async function command(name: string, input?: unknown): Promise<unknown> {
    if (resolved.commands && !resolved.commands.includes(name)) {
      throw new AknoError('not_implemented', `the service on this socket does not accept '${name}'`);
    }
    return send(name, input ?? {}, 'command');
  }

  return {
    ...bindOps(call),
    hello: resolved,
    call,
    command,
    async close(): Promise<void> {
      closed = true;
      await new Promise<void>((resolve) => socket.end(() => resolve()));
    },
  };
}

// ─── Loopback HTTP ──────────────────────────────────────────────────────────

/**
 * The HTTP door matters for containerized agents: Akno runs on the host
 * and the agent reaches it over the network, so the knowledge base and the index
 * never need to be mounted into a sandbox — which also keeps the single-writer
 * property that makes WAL concurrency safe.
 */
async function connectHttp(address: string, options: ConnectOptions): Promise<AknoClient> {
  const base = address.startsWith('http') ? address.replace(/\/+$/, '') : `http://${address}`;
  const timeoutMs = options.timeoutMs ?? 30_000;

  let response: Response;
  try {
    response = await fetch(`${base}/hello`);
  } catch (err) {
    throw new AknoError(
      'unavailable',
      `no Akno service at ${base}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const hello = Hello.parse(await response.json());
  assertVersion(hello, options);

  async function call<N extends OpName>(
    op: N,
    input: OpInput<N>,
    callOptions: { actor?: 'user' | 'agent' | 'akno' } = {},
  ): Promise<OpResult<N>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const actor = callOptions.actor ?? options.actor;
    try {
      const result = await fetch(`${base}/op/${op}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(actor ? { 'x-akno-actor': actor } : {}),
        },
        body: JSON.stringify(input ?? {}),
        signal: controller.signal,
      });
      const body = (await result.json()) as { ok?: boolean; result?: unknown; error?: unknown };
      if (!body.ok) throw AknoError.from(body.error);
      return body.result as OpResult<N>;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ...bindOps(call),
    hello,
    call,
    // Deliberately not over HTTP. That door exists so a containerized agent can reach memory;
    // asking the host to reconcile its filesystem or run its maintenance cycle is operator
    // work, and the socket — where filesystem permissions are the auth — is where it belongs.
    command: async (name: string): Promise<unknown> => {
      throw new AknoError('forbidden', `'${name}' is not available over the HTTP door — use the socket`);
    },
    close: async (): Promise<void> => {},
  };
}

// ─── Shared ─────────────────────────────────────────────────────────────────

/** Generated from the registry, so a new op needs no change in this file. */
function bindOps(call: <N extends OpName>(op: N, input: OpInput<N>) => Promise<OpResult<N>>): AknoOps {
  const ops = {} as Record<string, unknown>;
  for (const name of OP_NAMES) {
    ops[name] = (input: unknown) => call(name, input as OpInput<typeof name>);
  }
  return ops as AknoOps;
}

/**
 * A version handshake on connect, with the client refusing a server it cannot
 * speak to rather than failing subtly later.
 */
function assertVersion(hello: HelloMessage, options: ConnectOptions): void {
  if (hello.protocol === PROTOCOL_VERSION) return;
  const detail = `client speaks protocol ${PROTOCOL_VERSION}, server speaks ${hello.protocol}`;
  if (options.strictVersion !== false) {
    throw new AknoError('invalid', `Akno version mismatch: ${detail}. Upgrade one of them.`);
  }
  process.emitWarning(`Akno version mismatch: ${detail}`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(error), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { PROTOCOL_VERSION, AknoError } from '@tenphi/akno-protocol';
export type { Card, AknoOps, Line, OpName, RecallMode } from '@tenphi/akno-protocol';
