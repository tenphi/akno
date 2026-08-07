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
} from '@akno/protocol';
import type { Akno } from '@akno/core';

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
 * The three maintenance commands, run by the process that holds the write handle. Input is
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
  }
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
    const result = await akno.call(request.op, request.input as never);
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
