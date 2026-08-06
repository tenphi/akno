import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  let dir = startDir ?? import.meta.dirname;
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
