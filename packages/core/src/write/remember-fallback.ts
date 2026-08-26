import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { folderCatalog, type FolderCatalogEntry } from '../kb/folders.ts';
import { isReserved } from '../reserved.ts';

export type RememberFallbackUnavailableReason =
  'reserved_path' | 'existing_page_not_admitted' | 'unindexed_page_exists' | 'folder_not_admitted';

export type RememberFallbackResolution =
  | { slug: string; status: 'existing_page' | 'new_page' }
  | { slug: string; status: 'unavailable'; reason: RememberFallbackUnavailableReason };

/**
 * Resolve the explicit catch-all independently of semantic routing. Configuration names one exact page;
 * admission still comes from the page or its parent folder, so this option cannot grant itself write authority.
 */
export async function resolveRememberFallback(
  ctx: AknoContext,
  catalog: FolderCatalogEntry[] = folderCatalog(ctx.config, ctx.store),
): Promise<RememberFallbackResolution | null> {
  const slug = ctx.config.maintenance.retain.fallbackPage;
  if (!slug) return null;
  if (isReserved(slug, ctx.config)) return { slug, status: 'unavailable', reason: 'reserved_path' };

  const row = ctx.store.db.prepare('SELECT role, remember_management FROM pages WHERE slug = ?').get(slug) as
    { role: string; remember_management: string } | undefined;
  if (row) {
    return row.role === 'knowledge' && row.remember_management === 'integrate'
      ? { slug, status: 'existing_page' }
      : { slug, status: 'unavailable', reason: 'existing_page_not_admitted' };
  }

  // An indexed page has policy metadata. Existing bytes without an index row do not, and treating them as a
  // new managed page would overwrite user-authored content before Akno had classified it.
  if (await fallbackFileExists(ctx, slug)) {
    return { slug, status: 'unavailable', reason: 'unindexed_page_exists' };
  }

  const parent = slug.slice(0, slug.lastIndexOf('/'));
  const admitted = catalog.some(
    (folder) =>
      folder.path === parent &&
      folder.role === 'knowledge' &&
      folder.remember === 'integrate' &&
      folder.creatable,
  );
  return admitted
    ? { slug, status: 'new_page' }
    : { slug, status: 'unavailable', reason: 'folder_not_admitted' };
}

async function fallbackFileExists(ctx: AknoContext, slug: string): Promise<boolean> {
  for (const extension of ctx.config.pageExtensions) {
    try {
      if ((await fsp.stat(path.join(ctx.config.aknoPath, `${slug}${extension}`))).isFile()) return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return false;
}
