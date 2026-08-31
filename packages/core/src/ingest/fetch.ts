import dns from 'node:dns/promises';
import http, { type IncomingHttpHeaders, type IncomingMessage } from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';

/**
 * `ingest` pulls documents from a file, a folder, or a URL. This is the URL.
 *
 * A URL is an instruction to make a network connection, so validation is performed on
 * resolved destinations rather than on spelling alone. Every DNS answer must be public,
 * the request is pinned to one of those validated answers, and every redirect starts the
 * same process again. That closes both redirect-to-private and DNS-rebinding paths.
 */

export interface Fetched {
  /** A temp file. The caller ingests it and is responsible for cleaning up. */
  path: string;
  /** What the server called it, for the rename guard. */
  originalName: string;
  contentType: string | null;
  bytes: number;
  finalUrl: string;
}

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface FetchOptions {
  url: string;
  maxBytes: number;
  timeoutMs?: number;
  /** Exact origins explicitly trusted to reach non-public destinations. */
  trustedOrigins?: string[];
  /** Test seam; production uses the operating system resolver. */
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  maxRedirects?: number;
}

const DENIED_DESTINATIONS = deniedDestinations();
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function fetchDocument(options: FetchOptions): Promise<Fetched> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const trusted = new Set((options.trustedOrigins ?? []).map(normalizeTrustedOrigin));
  const resolve = options.resolve ?? resolveHost;
  let url = parseUrl(options.url);
  let redirects = 0;
  let response: IncomingMessage;

  while (true) {
    const addresses = await permittedAddresses(url, trusted, resolve);
    response = await request(url, addresses, timeoutMs);
    const status = response.statusCode ?? 0;
    if (!REDIRECTS.has(status)) break;

    const location = header(response.headers, 'location');
    response.resume();
    if (!location) throw new AknoError('unavailable', 'URL redirect returned no location');
    if (redirects++ >= (options.maxRedirects ?? 5)) {
      throw new AknoError('unavailable', 'URL redirect limit exceeded');
    }
    url = parseUrl(new URL(location, url).href);
  }

  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    response.resume();
    throw new AknoError(
      'unavailable',
      `URL returned ${status}${response.statusMessage ? ` ${response.statusMessage}` : ''}`,
    );
  }

  const contentType = (header(response.headers, 'content-type') ?? '').split(';')[0]!.trim() || null;
  const originalName = filenameFor(response.headers, url, contentType);
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'akno-fetch-'));
  const target = path.join(directory, originalName);

  let written = 0;
  let handle: Awaited<ReturnType<typeof fsp.open>> | null = null;
  try {
    handle = await fsp.open(target, 'w');
    for await (const chunk of response) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      written += bytes.byteLength;
      // Enforced against the bytes that actually arrive: Content-Length is only a claim.
      if (written > options.maxBytes) {
        throw new AknoError(
          'invalid',
          `download is larger than the configured limit of ${Math.round(options.maxBytes / 1_048_576)} MB`,
        );
      }
      await handle.write(bytes);
    }
  } catch (error) {
    await fsp.rm(directory, { recursive: true, force: true });
    throw networkFailure(error);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }

  if (written === 0) {
    await fsp.rm(directory, { recursive: true, force: true });
    throw new AknoError('unavailable', 'URL returned an empty body');
  }

  return { path: target, originalName, contentType, bytes: written, finalUrl: url.href };
}

/** The temp directory a fetch created. Removed once the bytes have been stored. */
export async function cleanupFetch(fetched: Fetched): Promise<void> {
  await fsp.rm(path.dirname(fetched.path), { recursive: true, force: true });
}

/** Exposed for deterministic policy tests without making a network request. */
export async function assertSafeUrlDestination(
  raw: string,
  options: Pick<FetchOptions, 'trustedOrigins' | 'resolve'> = {},
): Promise<void> {
  const url = parseUrl(raw);
  const trusted = new Set((options.trustedOrigins ?? []).map(normalizeTrustedOrigin));
  await permittedAddresses(url, trusted, options.resolve ?? resolveHost);
}

async function permittedAddresses(
  url: URL,
  trusted: Set<string>,
  resolve: (hostname: string) => Promise<ResolvedAddress[]>,
): Promise<ResolvedAddress[]> {
  const hostname = normalizeHost(url.hostname);
  let addresses: ResolvedAddress[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
      : await resolve(hostname);
  } catch {
    throw new AknoError('unavailable', 'could not resolve URL host');
  }
  if (addresses.length === 0) throw new AknoError('unavailable', 'URL host resolved to no addresses');

  if (!trusted.has(url.origin) && addresses.some((entry) => !isPublicAddress(entry))) {
    throw new AknoError('forbidden', 'URL destination is not allowed by network policy', {
      reason: 'network_destination_denied',
    });
  }
  return addresses;
}

async function resolveHost(hostname: string): Promise<ResolvedAddress[]> {
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
}

function isPublicAddress(entry: ResolvedAddress): boolean {
  return !DENIED_DESTINATIONS.check(entry.address, entry.family === 4 ? 'ipv4' : 'ipv6');
}

function deniedDestinations(): BlockList {
  const list = new BlockList();
  for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['192.88.99.0', 24],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ] as const) {
    list.addSubnet(network, prefix, 'ipv4');
  }
  for (const [network, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['::', 96],
    ['::ffff:0:0', 96],
    ['::ffff:0:0:0', 96],
    ['64:ff9b::', 96],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['100:0:0:1::', 64],
    ['fc00::', 7],
    ['fe80::', 10],
    ['fec0::', 10],
    ['ff00::', 8],
    ['2001::', 23],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20],
    ['5f00::', 16],
  ] as const) {
    list.addSubnet(network, prefix, 'ipv6');
  }
  return list;
}

function request(url: URL, addresses: ResolvedAddress[], timeoutMs: number): Promise<IncomingMessage> {
  const transport = url.protocol === 'https:' ? https : http;
  const lookup: LookupFunction = (_hostname, lookupOptions, callback) => {
    if (lookupOptions.all) {
      callback(null, addresses);
      return;
    }
    const selected = addresses[0]!;
    callback(null, selected.address, selected.family);
  };
  return new Promise((resolve, reject) => {
    const req = transport.get(
      url,
      {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: '*/*' },
        lookup,
      },
      resolve,
    );
    req.on('error', (error) => reject(networkFailure(error)));
  });
}

function parseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AknoError('invalid', 'not a usable URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AknoError(
      'invalid',
      `only http and https URLs are fetched, not ${url.protocol} — pass a local path instead`,
    );
  }
  if (url.username || url.password) {
    throw new AknoError('invalid', 'credentials are not allowed in an ingest URL');
  }
  return url;
}

function normalizeHost(value: string): string {
  return value
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

function normalizeTrustedOrigin(value: string): string {
  const url = parseUrl(value);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new AknoError('invalid', 'a trusted URL origin may contain only scheme, host, and port');
  }
  return url.origin;
}

function networkFailure(error: unknown): AknoError {
  if (error instanceof AknoError) return error;
  const name = error instanceof Error ? error.name : '';
  return new AknoError(
    'unavailable',
    name === 'AbortError' || name === 'TimeoutError' ? 'fetching URL timed out' : 'could not fetch URL',
  );
}

function header(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Content-Disposition, then URL path, then an extension guessed from content type. */
function filenameFor(headers: IncomingHttpHeaders, url: URL, contentType: string | null): string {
  const disposition = header(headers, 'content-disposition');
  const candidates: string[] = [];

  if (disposition) {
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    const raw = star?.[1] ?? plain?.[1];
    if (raw) candidates.push(sanitize(path.basename(safeDecode(raw.trim()))));
  }
  candidates.push(sanitize(path.basename(safeDecode(url.pathname))));

  const extension = extensionFor(contentType);
  for (const candidate of candidates) {
    if (candidate.length === 0 || candidate === '.' || candidate === '..') continue;
    return path.extname(candidate) ? candidate : `${candidate}${extension}`;
  }
  return `download${extension}`;
}

function sanitize(name: string): string {
  return [...name]
    .filter((char) => char !== '/' && char !== '\\' && char.codePointAt(0)! >= 0x20)
    .join('')
    .trim();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extensionFor(contentType: string | null): string {
  const table: Record<string, string> = {
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/html': '.html',
    'text/csv': '.csv',
    'application/json': '.json',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/heic': '.heic',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/tiff': '.tiff',
    'application/rtf': '.rtf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return contentType ? (table[contentType] ?? '') : '';
}
