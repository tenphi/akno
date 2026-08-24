import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { normalizeLinkTarget } from '../kb/page.ts';
import { sha256 } from '../store/ids.ts';
import { candidatesFor } from './repair.ts';
import { pageAllowsMaintenanceTransform } from './path-policy.ts';

export type LinkIdentitySignal = 'canonical' | 'alias' | 'move_history';

export interface LinkRepair {
  from: string;
  brokenTarget: string;
  newTarget: string;
  signal: LinkIdentitySignal;
  action: 'planned' | 'applied' | 'rejected';
}

export interface RepairResult {
  links: LinkRepair[];
  /** Retained for report compatibility; plan-backed contradiction items own claim rewrites. */
  claims: { slug: string; line: number; before: string; after: string; supersededBy: string }[];
  /** What was found but deliberately not planned, and why. Reported, never silent. */
  declined: { what: string; reason: string; candidates?: string[] }[];
}

interface LinkOperationDraft {
  slug: string;
  relPath: string;
  before: string;
  after: string;
}

interface LinkTargetSeal {
  slug: string;
  relPath: string;
  contentHash: string;
}

export interface BrokenLinkDraft {
  kind: 'broken_link';
  slug: string;
  inputHash: string;
  operations: LinkOperationDraft[];
  targets: LinkTargetSeal[];
  repairs: LinkRepair[];
}

export interface BrokenLinkPlanResult {
  drafts: BrokenLinkDraft[];
  report: RepairResult;
}

interface PageIdentity {
  slug: string;
  relPath: string;
  title: string;
  aliases: string[];
}

interface ResolvedTarget {
  page: PageIdentity;
  signal: LinkIdentitySignal;
}

/**
 * Build exact link-only plan items. A similarity match may explain a finding, but only an exact
 * canonical identity, alias, or recorded move can authorize a proposed rewrite.
 */
export async function planBrokenLinks(ctx: AknoContext, maxChanges: number): Promise<BrokenLinkPlanResult> {
  const report: RepairResult = { links: [], claims: [], declined: [] };
  const drafts: BrokenLinkDraft[] = [];
  const identities = pageIdentities(ctx);
  const moves = moveHistory(ctx);
  const allSlugs = identities.map((page) => page.slug);
  const rows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.slug AS from_slug, p.rel_path, p.role, p.dream_management, l.to_slug
         FROM links l JOIN pages p ON p.id = l.from_page
        WHERE l.broken = 1 AND l.kind != 'embed'
        ORDER BY p.slug, l.to_slug`,
    )
    .all() as {
    from_slug: string;
    rel_path: string;
    role: string;
    dream_management: string;
    to_slug: string;
  }[];

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const held = grouped.get(row.from_slug);
    if (held) held.push(row);
    else grouped.set(row.from_slug, [row]);
  }

  let planned = 0;
  for (const [slug, links] of grouped) {
    if (planned >= maxChanges) break;
    const first = links[0]!;
    if (
      !pageAllowsMaintenanceTransform(
        ctx.config,
        { slug, role: first.role, dreamManagement: first.dream_management },
        'broken_link',
      )
    ) {
      for (const link of links) {
        report.declined.push({
          what: `[[${link.to_slug}]]`,
          reason: `${slug} is not opted into dream: hygiene or dream: synthesize`,
        });
      }
      continue;
    }

    const before = await readPage(ctx, first.rel_path);
    if (before === null) {
      for (const link of links) {
        report.declined.push({
          what: `[[${link.to_slug}]]`,
          reason: `${slug} could not be read while sealing the proposal`,
        });
      }
      continue;
    }
    let after = before;
    const repairs: LinkRepair[] = [];
    const sealedTargets = new Map<string, LinkTargetSeal>();

    for (const link of links) {
      if (planned >= maxChanges) break;
      const resolved = resolveTarget(link.to_slug, identities, moves);
      if (!resolved) {
        const similar = candidatesFor(link.to_slug, allSlugs);
        report.declined.push({
          what: `[[${link.to_slug}]]`,
          reason:
            similar.length > 0
              ? `${similar.length} similarity-only candidate${similar.length === 1 ? '' : 's'}; no exact identity signal`
              : 'no page with an exact canonical identity, alias, or move history',
          ...(similar.length > 0 ? { candidates: similar } : {}),
        });
        continue;
      }
      if (resolved.length !== 1) {
        report.declined.push({
          what: `[[${link.to_slug}]]`,
          reason: `${resolved.length} pages share the strongest exact identity signal`,
          candidates: resolved.map((entry) => entry.page.slug),
        });
        continue;
      }
      const target = resolved[0]!;
      const next = replaceLinkTarget(after, slug, link.to_slug, target.page.slug);
      if (next === after) {
        report.declined.push({
          what: `[[${link.to_slug}]]`,
          reason: 'the indexed broken target is no longer present in the source bytes',
        });
        continue;
      }
      if (!sealedTargets.has(target.page.slug)) {
        const targetBefore = target.page.slug === slug ? before : await readPage(ctx, target.page.relPath);
        if (targetBefore === null) {
          report.declined.push({
            what: `[[${link.to_slug}]]`,
            reason: 'the exact target could not be sealed against concurrent edits',
          });
          continue;
        }
        sealedTargets.set(target.page.slug, {
          slug: target.page.slug,
          relPath: target.page.relPath,
          contentHash: sha256(targetBefore),
        });
      }
      after = next;
      const repair: LinkRepair = {
        from: slug,
        brokenTarget: link.to_slug,
        newTarget: target.page.slug,
        signal: target.signal,
        action: 'planned',
      };
      repairs.push(repair);
      report.links.push(repair);
      planned += 1;
    }

    if (repairs.length === 0 || after === before) continue;
    const operations: LinkOperationDraft[] = [{ slug, relPath: first.rel_path, before, after }];
    const targets = [...sealedTargets.values()];
    const inputHash = sha256(
      JSON.stringify({
        source: sha256(before),
        repairs: repairs.map(({ brokenTarget, newTarget, signal }) => ({
          brokenTarget,
          newTarget,
          signal,
        })),
        targets,
      }),
    );
    const handled = handledStatus(ctx, inputHash);
    if (handled) {
      report.links = report.links.filter((entry) => !repairs.includes(entry));
      if (handled === 'rejected') {
        report.declined.push({
          what: slug,
          reason: 'this exact broken-link proposal was previously rejected',
        });
      }
      continue;
    }
    drafts.push({ kind: 'broken_link', slug, inputHash, operations, targets, repairs });
  }

  return { drafts, report };
}

/** Reconstruct the exact allowed output during plan preflight. */
export function replaceLinkTarget(
  text: string,
  from: string,
  brokenTarget: string,
  newTarget: string,
): string {
  const key = (value: string): string => identityKey(value);
  const wanted = key(brokenTarget);
  const wikilinks = text.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (whole, target: string, alias?: string) =>
    key(normalizeLinkTarget(target, from)) === wanted ? `[[${newTarget}${alias ?? ''}]]` : whole,
  );

  const folder = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
  return wikilinks.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => {
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) return whole;
    if (key(normalizeLinkTarget(target, from)) !== wanted) return whole;
    const wasFolderRelative = target.startsWith('../') || target.startsWith('./') || !target.includes('/');
    return `](${wasFolderRelative ? relativeTo(folder, newTarget) : newTarget}.md)`;
  });
}

function resolveTarget(
  brokenTarget: string,
  pages: PageIdentity[],
  moves: Map<string, string[]>,
): ResolvedTarget[] | null {
  const moved = currentMoveTargets(identityKey(brokenTarget), moves, pages);
  if (moved.length > 0) {
    return moved.map((page) => ({ page, signal: 'move_history' }));
  }

  const wanted = identityKey(brokenTarget);
  const aliases = pages.filter((page) => page.aliases.some((alias) => identityKey(alias) === wanted));
  if (aliases.length > 0) return aliases.map((page) => ({ page, signal: 'alias' }));

  const basename = brokenTarget.split('/').at(-1) ?? brokenTarget;
  const canonical = pages.filter((page) => {
    const pageBase = page.slug.split('/').at(-1) ?? page.slug;
    return (
      identityKey(page.slug) === wanted ||
      identityKey(pageBase) === identityKey(basename) ||
      identityKey(page.title) === identityKey(basename)
    );
  });
  return canonical.length > 0 ? canonical.map((page) => ({ page, signal: 'canonical' })) : null;
}

function uniqueResolved(values: ResolvedTarget[]): ResolvedTarget[] {
  const unique = new Map(values.map((value) => [value.page.slug, value]));
  return [...unique.values()];
}

function currentMoveTargets(
  start: string,
  moves: Map<string, string[]>,
  pages: PageIdentity[],
): PageIdentity[] {
  const queue = [...(moves.get(start) ?? [])];
  const visited = new Set<string>([start]);
  const live: ResolvedTarget[] = [];
  while (queue.length > 0) {
    const slug = queue.shift()!;
    const key = identityKey(slug);
    if (visited.has(key)) continue;
    visited.add(key);
    const page = pages.find((candidate) => identityKey(candidate.slug) === key);
    if (page) {
      live.push({ page, signal: 'move_history' });
      continue;
    }
    queue.push(...(moves.get(key) ?? []));
  }
  return uniqueResolved(live).map((entry) => entry.page);
}

function pageIdentities(ctx: AknoContext): PageIdentity[] {
  const rows = ctx.store.db
    .prepare("SELECT slug, rel_path, title, aliases FROM pages WHERE role = 'knowledge' ORDER BY slug")
    .all() as {
    slug: string;
    rel_path: string;
    title: string;
    aliases: string;
  }[];
  return rows.map((row) => ({
    slug: row.slug,
    relPath: row.rel_path,
    title: row.title,
    aliases: parseAliases(row.aliases),
  }));
}

function moveHistory(ctx: AknoContext): Map<string, string[]> {
  const rows = ctx.store.db
    .prepare(
      `SELECT old.rel_path AS old_path, fresh.rel_path AS new_path
         FROM changes c
         JOIN change_files old ON old.change_id = c.id AND old.action = 'moved'
         JOIN change_files fresh ON fresh.change_id = c.id AND fresh.action = 'created'
        WHERE c.op = 'move'
          AND c.status = 'applied'
          AND old.before IS NOT NULL AND fresh.after IS NOT NULL
          AND (old.rel_path GLOB '*.md' OR old.rel_path GLOB '*.markdown')
          AND (fresh.rel_path GLOB '*.md' OR fresh.rel_path GLOB '*.markdown')`,
    )
    .all() as { old_path: string; new_path: string }[];
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const oldSlug = row.old_path.replace(/\.(md|markdown)$/i, '');
    const newSlug = row.new_path.replace(/\.(md|markdown)$/i, '');
    const key = identityKey(oldSlug);
    const held = out.get(key);
    if (held) held.push(newSlug);
    else out.set(key, [newSlug]);
  }
  return out;
}

function handledStatus(ctx: AknoContext, inputHash: string): 'applied' | 'rejected' | null {
  const row = ctx.store.db
    .prepare(
      `SELECT status FROM maintenance_items
        WHERE kind = 'broken_link' AND input_hash = ? AND status IN ('applied', 'rejected')
        ORDER BY rowid DESC LIMIT 1`,
    )
    .get(inputHash) as { status: 'applied' | 'rejected' } | undefined;
  return row?.status ?? null;
}

function parseAliases(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function identityKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)
    .join('/');
}

function relativeTo(folder: string, target: string): string {
  const from = folder ? folder.split('/') : [];
  const to = target.split('/');
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1;
  const up = Array.from({ length: from.length - shared }, () => '..');
  const relative = [...up, ...to.slice(shared)].join('/');
  // Akno accepts root-relative Markdown paths for convenience, so a nested path without
  // an explicit dot is parsed from the knowledge-base root. Mark generated nested relatives
  // explicitly or the next index/dream pass sees Akno's own repair as broken and rewrites it.
  return relative.includes('/') && !relative.startsWith('../') ? `./${relative}` : relative;
}

async function readPage(ctx: AknoContext, relPath: string): Promise<string | null> {
  return fsp.readFile(path.join(ctx.config.aknoPath, relPath), 'utf8').catch(() => null);
}
