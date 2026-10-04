import fs from 'node:fs';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { Journal } from './journal.ts';

export interface PageObservation {
  relPath: string;
  content: string | null;
  cursor: number;
  hasMore: boolean;
  transitions: { sequence: number; actor: string; before: string | null; after: string | null }[];
}

/** Raw text, not indexed projections: editor saves and deletion must be visible immediately. */
export function observePage(journal: Journal, root: string, relPath: string, after: number): PageObservation {
  if (!Number.isSafeInteger(after) || after < 0)
    throw new AknoError('invalid', 'after must be a nonnegative journal cursor');
  const segments = relPath.split('/');
  if (
    !relPath.endsWith('.md') ||
    relPath.includes('\\') ||
    segments.some((part) => !part || part.startsWith('.'))
  ) {
    throw new AknoError('invalid', 'observation requires a relative Markdown page path');
  }
  const resolvedRoot = fs.realpathSync(root);
  let target = resolvedRoot;
  let content: string | null = null;
  try {
    for (const [index, segment] of segments.entries()) {
      target = path.join(target, segment);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink())
        throw new AknoError('forbidden', 'watched pages cannot traverse symbolic links');
      if (index < segments.length - 1 && !stat.isDirectory())
        throw new AknoError('invalid', 'page parent is not a directory');
      if (index === segments.length - 1 && (!stat.isFile() || stat.size > 2 * 1024 * 1024)) {
        throw new AknoError('invalid', 'watched page must be a regular Markdown file under 2 MiB');
      }
    }
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const resolved = fs.realpathSync(target);
      const opened = fs.fstatSync(fd);
      const current = fs.statSync(resolved);
      if (
        !resolved.startsWith(resolvedRoot + path.sep) ||
        opened.ino !== current.ino ||
        opened.dev !== current.dev
      ) {
        throw new AknoError('forbidden', 'watched page changed location while being read');
      }
      if (!opened.isFile() || opened.size > 2 * 1024 * 1024)
        throw new AknoError('invalid', 'watched page is not a bounded regular file');
      content = fs.readFileSync(fd, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return { relPath, content, ...journal.pageTransitions(relPath, after) };
}
