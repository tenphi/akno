import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  AknoError,
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
 * §16. The default door: no port, filesystem permissions are the auth, and it is
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

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      // Owner-only: the socket *is* the authentication boundary.
      fs.chmodSync(socketPath, 0o600);
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

  try {
    if (!isOpName(request.op)) {
      throw new AknoError('invalid', `unknown op: ${request.op}`);
    }
    // §16. Trust is a parameter, not a property of the transport: the same code
    // runs with different permissions, so an MCP caller can be denied `forget`
    // without a second code path that grows its own bugs.
    if (options.allow && !options.allow.includes(request.op)) {
      throw new AknoError('forbidden', `${request.op} is not allowed on this door`);
    }
    const started = performance.now();
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
