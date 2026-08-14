import fs from 'node:fs';
import path from 'node:path';
import type { AknoConfig } from '../config/schema.ts';
import { effectiveRule } from '../rules/compile.ts';
import { isReserved } from '../reserved.ts';

/**
 * Physical folders in the knowledge base, including ones that contain no pages.
 *
 * Pages cannot represent an empty directory in the index. Structure callers still need to see
 * directories the user created themselves, both to honour that taxonomy and to avoid inventing a
 * parallel folder. This walk reads names only: it never opens or indexes the files inside them.
 */
export function physicalFolders(
  config: AknoConfig,
  options: { under?: string; depth?: number } = {},
): string[] {
  const under = (options.under ?? '').replace(/^\/+|\/+$/g, '');
  const maxDepth = Math.max(1, options.depth ?? 8);
  const ignored = new Set(config.ignore.map((entry) => entry.replace(/^\/+|\/+$/g, '')));
  const out: string[] = [];

  walk(under, 0);
  return out.sort();

  function walk(relDir: string, depth: number): void {
    if (depth >= maxDepth) return;
    const absDir = path.join(config.aknoPath, relDir);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (ignored.has(entry.name) || ignored.has(rel)) continue;
      if (isReserved(rel, config)) continue;
      if (effectiveRule(`${rel}/x`, config.rules).class === 'excluded') continue;
      out.push(rel);
      walk(rel, depth + 1);
    }
  }
}

/** True when the user has already made this folder on disk, even if it is empty. */
export function physicalFolderExists(config: AknoConfig, folder: string): boolean {
  if (isReserved(folder, config)) return false;
  if (effectiveRule(`${folder}/x`, config.rules).class === 'excluded') return false;
  try {
    return fs.statSync(path.join(config.aknoPath, folder)).isDirectory();
  } catch {
    return false;
  }
}
