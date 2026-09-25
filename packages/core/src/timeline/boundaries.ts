import fs from 'node:fs';
import path from 'node:path';
import { AknoError, type TimelineDescriptor } from '@tenphi/akno-protocol';
import type { AknoConfig } from '../config/schema.ts';
import { indexScanIgnore } from '../config/load.ts';
import type { Store } from '../store/db.ts';
import { parsePage, resolvePagePolicy } from '../kb/page.ts';
import { effectiveRule } from '../rules/compile.ts';
import { isLedgerPage } from '../reserved.ts';
import {
  hasInlineMergeConflict,
  matchesConflictPath,
  quarantineReasonsForPath,
} from '../index/page-quarantine.ts';

/** Read live declarations so an unindexed or damaged ledger can never disappear as a boundary. */
export function timelineCatalog(config: AknoConfig, store: Store): TimelineDescriptor[] {
  const defaults = config.paths.timeline.replaceAll('\\', '/');
  const ignored = new Set(indexScanIgnore(config.ignore).map((item) => item.replace(/\/+$/, '')));
  const catalog = [describe(defaults, '', true)];
  walk('');
  return catalog.sort((a, b) => Number(b.default) - Number(a.default) || a.slug.localeCompare(b.slug));

  function walk(folder: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(config.aknoPath, folder), { withFileTypes: true });
    } catch {
      // Keep an unreadable subtree fenced off, even if its declaration cannot be inspected.
      catalog.push({
        slug: `${folder}/timeline`,
        path: `${folder}/timeline.md`,
        folder,
        default: false,
        title: folder,
        description: '',
        status: 'unavailable',
        writable: false,
        note: 'folder is unreadable',
      });
      return;
    }
    for (const entry of entries) {
      const rel = folder ? `${folder}/${entry.name}` : entry.name;
      if (folder && entry.name === 'timeline.md' && rel !== defaults) {
        catalog.push(describe(rel, folder, false));
        continue;
      }
      if (entry.name.startsWith('.') || ignored.has(entry.name) || ignored.has(rel)) continue;
      if (entry.isDirectory()) {
        if (effectiveRule(`${rel}/x`, config.rules).role !== 'ignored') walk(rel);
      }
    }
  }

  function describe(rel: string, folder: string, isDefault: boolean): TimelineDescriptor {
    const slug = rel.replace(/\.(md|markdown)$/i, '');
    const result: TimelineDescriptor = {
      slug,
      path: rel,
      folder,
      default: isDefault,
      title: isDefault ? 'Timeline' : folder,
      description: '',
      status: 'ready',
      writable: false,
    };
    if (ignored.has(path.basename(rel)) || ignored.has(rel))
      return { ...result, status: 'unavailable', note: 'timeline is excluded by ignore policy' };
    try {
      const abs = path.resolve(config.aknoPath, rel);
      if (!abs.startsWith(`${path.resolve(config.aknoPath)}${path.sep}`))
        throw new Error('outside knowledge base');
      // Never follow a declaration (or parent directory) through a symlink.
      let current = config.aknoPath;
      for (const part of rel.split('/')) {
        if (part === '..' || part === '.') throw new Error('unsafe timeline path');
        current = path.join(current, part);
        const stat = (() => {
          try {
            return fs.lstatSync(current);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
          }
        })();
        if (stat?.isSymbolicLink()) throw new Error('symlink timeline');
      }
      if (!fs.existsSync(abs) && isDefault) {
        const rule = effectiveRule(slug, config.rules);
        return {
          ...result,
          status: 'virtual',
          writable: (rule.role ?? 'knowledge') === 'knowledge' && rule.remember !== 'deny',
        };
      }
      const stat = fs.lstatSync(abs);
      if (!stat.isFile() || stat.size > config.maxPageBytes)
        throw new Error('timeline is not a readable Markdown file');
      const content = fs.readFileSync(abs, 'utf8');
      if (
        hasInlineMergeConflict(content) ||
        matchesConflictPath(rel, config.index.conflictPathPatterns) ||
        quarantineReasonsForPath(store, rel).length > 0
      ) {
        return { ...result, status: 'quarantined', note: 'timeline has a Markdown source conflict' };
      }
      const page = parsePage(rel, content);
      if (!isLedgerPage(page)) {
        return {
          ...result,
          status: 'invalid',
          note: 'timeline.md must be empty or have type: timeline, a # Timeline heading, or authored event lines',
        };
      }
      const policy = resolvePagePolicy(page, effectiveRule(slug, config.rules), config.paths.observations);
      const introduction = page.body
        .split(/^##\s|^\s*[-*]\s+\*\*\d{4}-/m)[0]!
        .replace(/^#\s+.*$/m, '')
        .trim()
        .slice(0, 1000);
      return {
        ...result,
        title: content.trim().length === 0 ? result.title : page.title,
        description: introduction,
        status: policy.role === 'ignored' ? 'unavailable' : 'ready',
        writable:
          policy.role === 'knowledge' &&
          (page.declaredManagement.remember ?? effectiveRule(slug, config.rules).remember) !== 'deny',
        ...(policy.role === 'ignored' ? { note: 'timeline is ignored by page policy' } : {}),
      };
    } catch {
      return { ...result, status: 'unavailable', note: 'timeline cannot be read safely' };
    }
  }
}

export function owningTimeline(catalog: readonly TimelineDescriptor[], source: string): TimelineDescriptor {
  const normalized = source.replaceAll('\\', '/').replace(/\.(md|markdown)$/i, '');
  const exact = catalog.find((entry) => entry.slug === normalized);
  if (exact) return exact;
  return (
    catalog
      .filter((entry) => !entry.default && normalized.startsWith(`${entry.folder}/`))
      .sort((a, b) => b.folder.length - a.folder.length)[0] ?? catalog.find((entry) => entry.default)!
  );
}

export function selectTimelines(
  catalog: readonly TimelineDescriptor[],
  selector?: string,
): TimelineDescriptor[] {
  if (selector === '*') return [...catalog];
  const normalized = selector?.replace(/\.(md|markdown)$/i, '');
  const selected =
    selector === undefined
      ? catalog.find((entry) => entry.default)
      : catalog.find((entry) => entry.slug === normalized);
  if (!selected)
    throw new AknoError('invalid', 'unknown timeline; discover ledger slugs with list({kind: "timelines"})');
  return [selected];
}

export function timelineReadable(timeline: TimelineDescriptor): boolean {
  return timeline.status === 'ready' || timeline.status === 'virtual';
}

export function timelinePlacement(
  catalog: readonly TimelineDescriptor[],
  slug: string,
  basis: 'source_page' | 'ledger' | 'document_path' = 'source_page',
) {
  return { timeline: owningTimeline(catalog, slug).slug, timeline_basis: basis };
}

/** A catch-all has no authority to move an unresolved memory across a visible boundary. */
export function timelineFallbackAllowed(
  catalog: readonly TimelineDescriptor[],
  fallback: string,
  suggestions: readonly string[],
): boolean {
  if (catalog.length === 1) return timelineReadable(catalog[0]!);
  return (
    suggestions.length > 0 &&
    suggestions.every((slug) => owningTimeline(catalog, slug).slug === owningTimeline(catalog, fallback).slug)
  );
}

/** Resolve exact writes without asking a model to invent a timeline or broaden a boundary. */
export function eventTimeline(
  catalog: readonly TimelineDescriptor[],
  owner?: string,
  selector?: string,
): TimelineDescriptor | null {
  if (selector === '*') throw new AknoError('invalid', 'an event write requires one timeline');
  const selected = selector
    ? selectTimelines(catalog, selector)[0]!
    : owner
      ? owningTimeline(catalog, owner)
      : catalog.length === 1
        ? catalog[0]!
        : null;
  if (selected && owner && selected.slug !== owningTimeline(catalog, owner).slug) {
    throw new AknoError('invalid', 'the selected timeline does not own the event page');
  }
  if (selected && (!timelineReadable(selected) || !selected.writable)) {
    throw new AknoError('conflict', `timeline ${selected.slug} is unavailable or read-only`, {
      reason: selected.status === 'quarantined' ? 'source_conflict' : 'timeline_boundary_unavailable',
    });
  }
  return selected;
}
