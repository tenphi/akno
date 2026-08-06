import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `~/Notes` → `/Users/you/Notes`. Only a leading `~` is special. */
export function expandTilde(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function resolveUserPath(input: string, base?: string): string {
  const expanded = expandTilde(input);
  if (path.isAbsolute(expanded)) return path.normalize(expanded);
  return path.resolve(base ?? process.cwd(), expanded);
}

/**
 * The repo root, found by walking up from this module until `pnpm-workspace.yaml`
 * appears. Used to locate `config/default.jsonc` when running from source; an
 * installed package falls back to the packaged copy beside `dist`.
 */
export function findRepoRoot(startDir?: string): string | null {
  let dir = startDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    const parent = path.dirname(dir);
    if (isRepoRoot(dir)) return dir;
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function isRepoRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
}

/** Slug ↔ path. A slug is the page path minus its extension, always POSIX-style. */
export function pathToSlug(relPath: string): string {
  const withoutExt = relPath.replace(/\.(md|markdown)$/i, '');
  return withoutExt.split(path.sep).join('/');
}

export function slugToRelPath(slug: string, extension = '.md'): string {
  return `${slug.split('/').join(path.sep)}${extension}`;
}

/**
 * Rejects a slug that would escape the knowledge base. Absolute paths, `..`
 * segments and drive letters all fail — a caller must not be able to name a
 * file outside the folder the user pointed Akno at.
 */
export function isSafeSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > 512) return false;
  if (slug.startsWith('/') || slug.startsWith('~')) return false;
  if (/^[a-zA-Z]:/.test(slug)) return false;
  if (slug.includes('\0')) return false;
  return slug.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}
