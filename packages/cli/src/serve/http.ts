import http from 'node:http';
import { AknoError, OPS, PROTOCOL_VERSION, isOpName, type Hello } from '@akno/protocol';
import type { Akno } from '@akno/core';

export interface HttpServer {
  readonly address: string;
  close(): Promise<void>;
}

/**
 * For agents in containers or on another host: Akno runs on the host and
 * the agent reaches it over the network, so the knowledge base and the index never
 * need to be mounted into a sandbox — which also keeps the single-writer property
 * that makes WAL concurrency safe.
 *
 * Binds loopback unless told otherwise, and says so loudly if not: this door has
 * no authentication of its own and is meant to sit behind one.
 */
export async function serveHttp(
  akno: Akno,
  address: string,
  options: { allow?: string[]; log?: (message: string) => void } = {},
): Promise<HttpServer> {
  const [host, portText] = splitAddress(address);
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new AknoError('invalid', `not a valid host:port — ${address}`);
  }

  const server = http.createServer((request, response) => {
    void route(request, response, akno, options);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    address: `${host}:${port}`,
    async close(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function route(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  akno: Akno,
  options: { allow?: string[]; log?: (message: string) => void },
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/hello') {
    const hello: Hello = {
      hello: 'akno',
      protocol: PROTOCOL_VERSION,
      version: '0.1.0',
      writable: akno.writable,
      akno_path: akno.config.aknoPath,
      ops: options.allow ?? Object.keys(OPS),
    };
    send(response, 200, hello);
    return;
  }

  if (url.pathname === '/health') {
    send(response, 200, { ok: true, writable: akno.writable });
    return;
  }

  const match = /^\/op\/([a-z_]+)$/.exec(url.pathname);
  if (!match || request.method !== 'POST') {
    send(response, 404, { ok: false, error: { code: 'not_found', message: 'POST /op/<name>' } });
    return;
  }

  const op = match[1]!;
  try {
    if (!isOpName(op)) throw new AknoError('invalid', `unknown op: ${op}`);
    if (options.allow && !options.allow.includes(op)) {
      throw new AknoError('forbidden', `${op} is not allowed on this door`);
    }
    const input = await readJson(request);
    const started = performance.now();
    const result = await akno.call(op, input as never);
    options.log?.(`${op} ${(performance.now() - started).toFixed(1)}ms`);
    send(response, 200, { ok: true, result });
  } catch (err) {
    const error = AknoError.from(err);
    options.log?.(`${op} ${error.code}: ${error.message}`);
    send(response, statusFor(error.code), { ok: false, error: error.toJSON() });
  }
}

/** HTTP status codes chosen so a proxy or a dashboard reads them correctly. */
function statusFor(code: string): number {
  switch (code) {
    case 'invalid':
      return 400;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'read_only':
      return 409;
    case 'not_implemented':
      return 501;
    case 'unavailable':
      return 503;
    default:
      return 500;
  }
}

function send(response: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += (chunk as Buffer).length;
    // A 4 MB cap: `remember` takes a transcript, not a corpus.
    if (bytes > 4 * 1024 * 1024) throw new AknoError('invalid', 'request body too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AknoError('invalid', 'request body is not valid JSON');
  }
}

function splitAddress(address: string): [string, string] {
  const index = address.lastIndexOf(':');
  if (index === -1) return ['127.0.0.1', address];
  return [address.slice(0, index) || '127.0.0.1', address.slice(index + 1)];
}
