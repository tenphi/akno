import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AknoError } from '@akno/protocol';

/**
 * §11. `ingest` pulls documents from "a file, a folder, a URL". This is the URL.
 *
 * Downloading is the one thing `ingest` does that reaches outside the machine, so the
 * limits are deliberate rather than defensive-by-habit:
 *
 * - **http and https only.** `file://` would make `ingest({url})` a way to read any
 *   path on the machine through an interface that looks like it fetches the web, and
 *   `data:` would smuggle bytes past the size cap.
 * - **Redirects are followed** by `fetch`, which caps the chain itself; a redirect is
 *   normal and an infinite one is already handled below us.
 * - **The size cap applies to what arrives, not to what the server claims.** A
 *   `Content-Length` is a promise, and the stream is what actually lands on disk.
 * - **The filename comes from the response, then the URL, then the content type.** A
 *   URL path is often `/download` or `/`, which says nothing — and §11 is explicit that
 *   a name adding nothing is exactly what naming-from-content replaces.
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

export interface FetchOptions {
  url: string;
  maxBytes: number;
  timeoutMs?: number;
}

export async function fetchDocument(options: FetchOptions): Promise<Fetched> {
  const url = parseUrl(options.url);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      headers: { accept: '*/*' },
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new AknoError(
      'unavailable',
      timedOut
        ? `fetching ${url.href} timed out`
        : `could not fetch ${url.href}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new AknoError('unavailable', `${url.href} returned ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new AknoError('unavailable', `${url.href} returned no body`);
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim() || null;
  const originalName = filenameFor(response, url, contentType);

  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'akno-fetch-'));
  const target = path.join(directory, originalName);
  const handle = await fsp.open(target, 'w');

  let written = 0;
  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      written += chunk.byteLength;
      // Enforced against the bytes that actually arrive: `Content-Length` is a claim,
      // and a server willing to lie about the size is exactly the one to guard against.
      if (written > options.maxBytes) {
        await handle.close();
        await fsp.rm(directory, { recursive: true, force: true });
        throw new AknoError(
          'invalid',
          `${url.href} is larger than the configured limit of ${Math.round(options.maxBytes / 1_048_576)} MB`,
        );
      }
      await handle.write(chunk);
    }
  } finally {
    await handle.close().catch(() => {});
  }

  if (written === 0) {
    await fsp.rm(directory, { recursive: true, force: true });
    throw new AknoError('unavailable', `${url.href} returned an empty body`);
  }

  return { path: target, originalName, contentType, bytes: written, finalUrl: response.url || url.href };
}

/** The temp directory a fetch created. Removed once the bytes have been stored. */
export async function cleanupFetch(fetched: Fetched): Promise<void> {
  await fsp.rm(path.dirname(fetched.path), { recursive: true, force: true });
}

function parseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AknoError('invalid', `not a usable URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AknoError(
      'invalid',
      `only http and https URLs are fetched, not ${url.protocol} — pass a local path instead`,
    );
  }
  return url;
}

/**
 * `Content-Disposition`, then the URL's last path segment, then an extension guessed
 * from the content type. Every one of these can be useless, which is fine: §11 renames
 * from content anyway, and a useless name is what triggers that.
 */
function filenameFor(response: Response, url: URL, contentType: string | null): string {
  const disposition = response.headers.get('content-disposition');
  const candidates: string[] = [];

  if (disposition) {
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    const raw = star?.[1] ?? plain?.[1];
    // `path.basename` is what stops `../../../etc/passwd` being a path: a server chooses
    // this header, so it is untrusted input that becomes a filename.
    if (raw) candidates.push(sanitize(path.basename(safeDecode(raw.trim()))));
  }
  candidates.push(sanitize(path.basename(safeDecode(url.pathname))));

  const extension = extensionFor(contentType);
  for (const candidate of candidates) {
    if (candidate.length === 0 || candidate === '.' || candidate === '..') continue;
    // The extractor dispatches on the extension, so a name without one is unusable even
    // though it reads fine. Servers send `filename="report"` often enough that guessing
    // from the content type is the difference between working and skipping.
    return path.extname(candidate) ? candidate : `${candidate}${extension}`;
  }

  return `download${extension}`;
}

/**
 * A server chooses these bytes, so they are untrusted input on their way to becoming a
 * filename: separators and control characters are dropped. Spaces survive, because a
 * filename with spaces is ordinary and the rename in §11 handles presentation anyway.
 */
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
  // No extension at all is honest: the extractor dispatches on it and will say it has
  // none, which is better than claiming `.bin` and looking like a decision.
  return contentType ? (table[contentType] ?? '') : '';
}
