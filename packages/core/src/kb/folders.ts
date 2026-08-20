import fs from 'node:fs';
import path from 'node:path';
import type { PageRole, RememberManagement } from '@tenphi/akno-protocol';
import type { AknoConfig } from '../config/schema.ts';
import type { Store } from '../store/db.ts';
import { effectiveRule } from '../rules/compile.ts';
import { isReserved } from '../reserved.ts';

export interface FolderCatalogEntry {
  path: string;
  role: PageRole;
  remember: RememberManagement;
  eligible: boolean;
  description?: string;
}

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
      if (effectiveRule(`${rel}/x`, config.rules).role === 'ignored') continue;
      out.push(rel);
      walk(rel, depth + 1);
    }
  }
}

/** True when the user has already made this folder on disk, even if it is empty. */
export function physicalFolderExists(config: AknoConfig, folder: string): boolean {
  if (isReserved(folder, config)) return false;
  if (effectiveRule(`${folder}/x`, config.rules).role === 'ignored') return false;
  try {
    return fs.statSync(path.join(config.aknoPath, folder)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Every visible folder a curator may choose as a page's parent.
 *
 * The catalog deliberately combines three sources. The page index supplies folders with content,
 * the filesystem supplies empty folders the user made by hand, and rules supply declared folders
 * that have not received their first page yet. Leaving out any one of them teaches a curator to
 * invent a parallel taxonomy for exactly the folders whose purpose was stated most explicitly.
 */
export function folderCatalog(config: AknoConfig, store: Store): FolderCatalogEntry[] {
  const paths = new Set(physicalFolders(config, { depth: Number.MAX_SAFE_INTEGER }));
  const rows = store.db.prepare("SELECT slug FROM pages WHERE role != 'ignored' ORDER BY slug").all() as {
    slug: string;
  }[];

  for (const { slug } of rows) {
    const segments = slug.split('/');
    for (let depth = 1; depth < segments.length; depth++) {
      paths.add(segments.slice(0, depth).join('/'));
    }
  }

  for (const rule of config.rules) {
    const folderPath = rule.glob.replace(/\/\*+$/, '');
    if (folderPath.length > 0 && !folderPath.includes('*')) paths.add(folderPath);
  }

  return [...paths]
    .filter((folderPath) => {
      if (isReserved(folderPath, config)) return false;
      return effectiveRule(`${folderPath}/x`, config.rules).role !== 'ignored';
    })
    .sort()
    .map((folderPath) => {
      const rule = effectiveRule(`${folderPath}/x`, config.rules);
      const role = rule.role ?? 'knowledge';
      const remember = rule.remember ?? (role === 'knowledge' ? 'integrate' : 'deny');
      return {
        path: folderPath,
        role,
        remember,
        eligible: role !== 'ignored' && remember === 'integrate',
        ...(rule.description ? { description: rule.description } : {}),
      };
    });
}
