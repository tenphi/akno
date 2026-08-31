import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { isIP } from 'node:net';
import { AknoError, OPS, PROTOCOL_VERSION, isOpName, type Hello, type OpName } from '@tenphi/akno-protocol';
import type { Akno } from '@tenphi/akno-core';
import { AKNO_VERSION } from '../version.ts';

export interface HttpServer {
  readonly address: string;
  readonly loopback: boolean;
  close(): Promise<void>;
}

interface HttpIdentity {
  name: string;
  token: string;
  actor: 'user' | 'agent' | 'akno';
  allow: string[];
}

export interface HttpServerOptions {
  /** Final door restriction; every public or authenticated policy is intersected with it. */
  allow?: string[];
  /** Unauthenticated loopback policy. Defaults to registry read operations. */
  publicAllow?: string[];
  identities?: HttpIdentity[];
  log?: (message: string) => void;
}

interface RequestAccess {
  actor: 'user' | 'agent' | 'akno';
  ops: OpName[];
  identity: string;
}

/**
 * HTTP is the network-facing door. Loopback callers get a read-only public policy;
 * authenticated callers get the actor and operation set owned by their credential.
 * A request header can never promote either one.
 */
export async function serveHttp(
  akno: Akno,
  address: string,
  options: HttpServerOptions = {},
): Promise<HttpServer> {
  const [host, portText] = splitAddress(address);
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new AknoError('invalid', `not a valid host:port — ${address}`);
  }

  const identities = (options.identities ?? []).map((identity) => ({
    ...identity,
    digest: tokenDigest(identity.token),
    allow: allowedOps(identity.allow, options.allow),
  }));
  if (!isLoopback(host) && identities.length === 0) {
    throw new AknoError(
      'forbidden',
      `HTTP cannot bind ${host} without a configured bearer identity in server.http_access`,
      { reason: 'http_auth_required' },
    );
  }
  ensureDistinctCredentials(identities);

  const loopbackTarget = isLoopback(host);
  const publicOps = loopbackTarget
    ? allowedOps(options.publicAllow ?? readOps(), options.allow).filter((name) => OPS[name].kind === 'read')
    : [];
  const server = http.createServer((request, response) => {
    void route(request, response, akno, {
      publicOps,
      identities,
      log: options.log,
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const bound = server.address();
  const actualHost = typeof bound === 'object' && bound ? bound.address : host;
  const actualPort = typeof bound === 'object' && bound ? bound.port : port;
  const loopback = isLoopback(actualHost);
  if (loopbackTarget && !loopback) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new AknoError('forbidden', `HTTP loopback name ${host} resolved to non-loopback ${actualHost}`, {
      reason: 'http_auth_required',
    });
  }
  return {
    address: formatAddress(actualHost, actualPort),
    loopback,
    async close(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function route(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  akno: Akno,
  options: {
    publicOps: OpName[];
    identities: (HttpIdentity & { digest: Buffer; allow: OpName[] })[];
    log?: (message: string) => void;
  },
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') {
    send(response, 200, { ok: true, writable: akno.writable });
    return;
  }

  let access: RequestAccess;
  try {
    if (request.headers['x-akno-actor'] !== undefined) {
      throw new AknoError('forbidden', 'HTTP callers cannot declare an actor', {
        reason: 'server_owned_actor',
      });
    }
    access = authenticate(request, options.publicOps, options.identities);
  } catch (error) {
    const denied = AknoError.from(error);
    const unauthorized = denied.details?.reason === 'invalid_http_credential';
    send(response, unauthorized ? 401 : statusFor(denied.code), {
      ok: false,
      error: denied.toJSON(),
    });
    return;
  }

  if (url.pathname === '/hello') {
    const hello: Hello = {
      hello: 'akno',
      protocol: PROTOCOL_VERSION,
      version: AKNO_VERSION,
      writable: akno.writable && access.ops.some((op) => OPS[op].kind === 'write'),
      akno_path: akno.config.aknoPath,
      ops: access.ops,
    };
    send(response, 200, hello);
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
    if (!access.ops.includes(op)) {
      throw new AknoError('forbidden', `${op} is not allowed for this HTTP identity`);
    }
    const input = await readJson(request);
    const started = performance.now();
    const result = await akno.call(op, input as never, { actor: access.actor });
    options.log?.(`${op} ${access.identity} ${(performance.now() - started).toFixed(1)}ms`);
    send(response, 200, { ok: true, result });
  } catch (error) {
    const failed = AknoError.from(error);
    options.log?.(`${op} ${access.identity} ${failed.code}: ${failed.message}`);
    send(response, statusFor(failed.code), { ok: false, error: failed.toJSON() });
  }
}

function authenticate(
  request: http.IncomingMessage,
  publicOps: OpName[],
  identities: (HttpIdentity & { digest: Buffer; allow: OpName[] })[],
): RequestAccess {
  const authorization = request.headers.authorization;
  if (authorization === undefined) {
    if (publicOps.length === 0) {
      throw new AknoError('forbidden', 'HTTP bearer credential required', {
        reason: 'invalid_http_credential',
      });
    }
    return { actor: 'agent', ops: publicOps, identity: 'public' };
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  const candidate = tokenDigest(match?.[1] ?? '');
  let selected: (typeof identities)[number] | null = null;
  // Evaluate every fixed-size digest. Authentication time does not reveal which entry matched.
  for (const identity of identities) {
    if (timingSafeEqual(candidate, identity.digest)) selected = identity;
  }
  if (!match || !selected) {
    throw new AknoError('forbidden', 'HTTP bearer credential rejected', {
      reason: 'invalid_http_credential',
    });
  }
  return {
    actor: selected.actor,
    ops: selected.allow,
    identity: selected.name,
  };
}

function tokenDigest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function ensureDistinctCredentials(identities: { name: string; digest: Buffer }[]): void {
  for (let left = 0; left < identities.length; left++) {
    for (let right = left + 1; right < identities.length; right++) {
      if (timingSafeEqual(identities[left]!.digest, identities[right]!.digest)) {
        throw new AknoError('invalid', 'server.http_access contains duplicate bearer credentials');
      }
    }
  }
}

function readOps(): string[] {
  return Object.keys(OPS).filter((name) => OPS[name as OpName].kind === 'read');
}

function allowedOps(policy: string[], door: string[] | undefined): OpName[] {
  const restriction = door ? new Set(door) : null;
  return [...new Set(policy)].filter(
    (name): name is OpName => isOpName(name) && (!restriction || restriction.has(name)),
  );
}

/** HTTP status codes chosen so a proxy or dashboard reads them correctly. */
function statusFor(code: string): number {
  switch (code) {
    case 'invalid':
      return 400;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'read_only':
    case 'busy':
    case 'conflict':
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
  if (address.startsWith('[')) {
    const bracket = address.indexOf(']');
    if (bracket < 0 || address[bracket + 1] !== ':') return [address, ''];
    return [address.slice(1, bracket), address.slice(bracket + 2)];
  }
  const index = address.lastIndexOf(':');
  if (index === -1) return ['127.0.0.1', address];
  return [address.slice(0, index) || '127.0.0.1', address.slice(index + 1)];
}

function isLoopback(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === 'localhost' || normalized === '::1') return true;
  if (isIP(normalized) !== 4) return false;
  return normalized.split('.')[0] === '127';
}

function formatAddress(host: string, port: number): string {
  return isIP(host) === 6 ? `[${host}]:${port}` : `${host}:${port}`;
}
