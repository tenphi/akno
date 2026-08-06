import type fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export type FileKind = 'page' | 'attachment';

export interface ScannedFile {
  relPath: string;
  absPath: string;
  size: number;
  /** Nanosecond mtime as a string — a float loses precision above ~2^53 ns. */
  mtimeNs: string;
  kind: FileKind;
  /** Present only once the file has actually been hashed. */
  sha256?: string;
  /**
   * §16. A knowledge base inside iCloud Drive or Dropbox with storage
   * optimization on will have evicted files that look present but read as
   * placeholders. Indexing a zero-byte stand-in as though the document were
   * empty is worse than skipping it and saying so.
   */
  dataless?: boolean;
}

export interface ScanOptions {
  root: string;
  ignore: string[];
  pageExtensions: string[];
  maxPageBytes: number;
}

/**
 * Walks the knowledge base and stats every file. Deliberately does not hash:
 * §6's fast path is that a restart *stats* rather than re-indexing, and only
 * files whose mtime or size moved get hashed.
 */
export async function scanTree(options: ScanOptions): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  const ignore = new Set(options.ignore.map((entry) => entry.replace(/\/+$/, '')));
  await walk(options.root, '', out, ignore, options);
  return out;
}

async function walk(
  root: string,
  relDir: string,
  out: ScannedFile[],
  ignore: Set<string>,
  options: ScanOptions,
): Promise<void> {
  const absDir = relDir ? path.join(root, relDir) : root;

  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    // An unreadable directory is reported by `doctor`, not fatal here — a
    // permissions problem in one folder should not cost the whole index.
    return;
  }

  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    // Dotfiles are never knowledge. Obsidian, git, sync clients and editors all
    // put working state in them, and none of it is a note.
    if (entry.name.startsWith('.')) continue;

    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (ignore.has(rel)) continue;

    if (entry.isDirectory()) {
      await walk(root, rel, out, ignore, options);
      continue;
    }
    // A symlink could point outside the knowledge base; following one turns
    // "index this folder" into something the user did not agree to.
    if (!entry.isFile()) continue;

    const absPath = path.join(root, rel);
    // `bigint: true` is what exposes mtimeNs. A float mtime loses precision above
    // ~2^53 nanoseconds, which is well inside the range real timestamps use, and
    // an imprecise mtime silently defeats the stat fast path.
    let stat: fs.BigIntStats;
    try {
      stat = await fsp.stat(absPath, { bigint: true });
    } catch {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    const isPage = options.pageExtensions.includes(extension);
    const size = Number(stat.size);
    const file: ScannedFile = {
      relPath: rel,
      absPath,
      size,
      mtimeNs: String(stat.mtimeNs),
      kind: isPage ? 'page' : 'attachment',
    };
    // §16. A file that reports a size but occupies no blocks is the classic
    // dataless signature: iCloud or Dropbox has evicted the contents and left a
    // placeholder that reads as empty.
    if (size > 0 && stat.blocks === 0n) file.dataless = true;
    if (isPage && size > options.maxPageBytes) continue;
    out.push(file);
  }
}

export async function hashFile(absPath: string): Promise<string> {
  const hash = createHash('sha256');
  const handle = await fsp.open(absPath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

/** Bounded-concurrency map. Hashing 5,000 files takes ~116ms; the bound keeps a
 *  slow disk or a network mount from opening every file at once. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}
