import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { replaceTopLevelString } from '../kb/frontmatter.ts';
import { normalizeLinkTarget, parsePage, resolvePagePolicy } from '../kb/page.ts';
import { isReserved } from '../reserved.ts';
import { declaringRule, effectiveRule } from '../rules/compile.ts';
import { sha256 } from '../store/ids.ts';

interface RuleDriftBase {
  kind: 'rule_drift';
  slug: string;
  relPath: string;
  inputHash: string;
  ruleGlob: string;
  ruleFingerprint: string;
}

export interface TypeRuleDriftDraft extends RuleDriftBase {
  correction: 'type';
  before: string;
  after: string;
  expectedType: string;
  foundType: string;
}

export interface DepthRuleDriftDraft extends RuleDriftBase {
  correction: 'max_depth';
  before: string;
  pageId: string;
  maxDepth: number;
  foundDepth: number;
  relocateTo: string;
  destinationSlug: string;
  destinationRelPath: string;
  inbound: { slug: string; relPath: string; before: string; after: string }[];
}

export type RuleDriftDraft = TypeRuleDriftDraft | DepthRuleDriftDraft;

/** Every path whose bytes or identity one sealed rule repair owns. */
export function ruleDriftPaths(draft: RuleDriftDraft): string[] {
  return draft.correction === 'type'
    ? [draft.relPath]
    : [draft.destinationRelPath, ...draft.inbound.map((entry) => entry.relPath), draft.relPath];
}

/**
 * Plan only drift with one exact correction. An explicit `type` has one exact scalar replacement.
 * An over-deep page has one exact destination only when the same rule also declares `relocate_to`.
 * Source pages are excluded: reference material is searchable evidence, not autonomous rewrite scope.
 */
export async function planRuleDrifts(
  ctx: AknoContext,
  options: { limit: number },
): Promise<RuleDriftDraft[]> {
  if (options.limit <= 0) return [];
  const pages = ctx.store.db
    .prepare(
      `SELECT id, slug, rel_path, type FROM pages
        WHERE role = 'knowledge'
        ORDER BY slug`,
    )
    .all() as { id: string; slug: string; rel_path: string; type: string | null }[];
  const drafts: RuleDriftDraft[] = [];
  const terminal = ctx.store.db.prepare(
    `SELECT 1 FROM maintenance_items
      WHERE kind = 'rule_drift' AND input_hash = ? AND subject = ?
        AND status IN ('applied', 'rejected') LIMIT 1`,
  );

  for (const page of pages) {
    if (drafts.length >= options.limit) break;
    if (isReserved(page.slug, ctx.config)) continue;
    const before = await fsp
      .readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8')
      .catch(() => null);
    if (before === null) continue;

    const rule = effectiveRule(page.slug, ctx.config.rules);
    const typeDeclaration = declaringRule(page.slug, ctx.config.rules, 'type');
    if (rule.type && typeDeclaration?.type === rule.type && page.type && page.type !== rule.type) {
      const inputHash = sha256(before);
      if (!terminal.get(inputHash, page.slug)) {
        const after = replaceTopLevelString(before, 'type', rule.type);
        if (after !== null && after !== before) {
          drafts.push({
            kind: 'rule_drift',
            correction: 'type',
            slug: page.slug,
            relPath: page.rel_path,
            inputHash,
            before,
            after,
            ruleGlob: typeDeclaration.glob,
            expectedType: rule.type,
            foundType: page.type,
            ruleFingerprint: sha256(JSON.stringify({ glob: typeDeclaration.glob, type: rule.type })),
          });
          continue;
        }
      }
    }

    const depthDraft = await planDepthRepair(ctx, page, before);
    if (!depthDraft || terminal.get(depthDraft.inputHash, page.slug)) continue;
    drafts.push(depthDraft);
  }

  return drafts;
}

async function planDepthRepair(
  ctx: AknoContext,
  page: { id: string; slug: string; rel_path: string },
  before: string,
): Promise<DepthRuleDriftDraft | null> {
  const declaration = declaringRule(page.slug, ctx.config.rules, 'max_depth');
  if (
    !declaration?.max_depth ||
    !declaration.relocate_to ||
    declaringRule(page.slug, ctx.config.rules, 'relocate_to')?.glob !== declaration.glob
  ) {
    return null;
  }
  const ruleRoot = declaration.glob
    .replace(/\/\*\*?$/, '')
    .split('/')
    .filter(Boolean);
  const foundDepth = page.slug.split('/').length - ruleRoot.length;
  if (foundDepth <= declaration.max_depth) return null;

  const relocateTo = normalizeFolder(declaration.relocate_to);
  if (!relocateTo) return null;
  const basename = page.slug.slice(page.slug.lastIndexOf('/') + 1);
  const destinationSlug = `${relocateTo}/${basename}`;
  const destinationRelPath = `${destinationSlug}.md`;
  if (
    destinationSlug === page.slug ||
    isReserved(destinationSlug, ctx.config) ||
    ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(destinationSlug)
  ) {
    return null;
  }
  const destinationPath = path.join(ctx.config.aknoPath, destinationRelPath);
  if (
    await fsp
      .stat(destinationPath)
      .then(() => true)
      .catch(() => false)
  )
    return null;

  const parsed = parsePage(page.rel_path, before);
  const destinationPage = parsePage(destinationRelPath, before);
  const destinationRule = effectiveRule(destinationSlug, ctx.config.rules);
  const destinationPolicy = resolvePagePolicy(
    destinationPage,
    destinationRule,
    ctx.config.paths.observations,
  );
  if (destinationPolicy.role !== 'knowledge' || destinationRuleIssues(destinationSlug, ctx) > 0) return null;
  if (
    hasLocationDependentMarkdown(before, page.slug) ||
    parsed.links.some((link) => link.toSlug === page.slug)
  ) {
    return null;
  }
  const documents = ctx.store.db
    .prepare('SELECT count(*) AS n FROM documents WHERE page_id = ?')
    .get(page.id) as { n: number };
  if (documents.n > 0) return null;
  const aboutRows = ctx.store.db.prepare('SELECT id, about FROM pages WHERE id != ?').all(page.id) as {
    id: string;
    about: string;
  }[];
  if (
    aboutRows.some((row) =>
      jsonStrings(row.about).some((slug) => slug.toLowerCase() === page.slug.toLowerCase()),
    )
  ) {
    return null;
  }

  const inboundRows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.id, p.slug, p.rel_path, p.role
         FROM links l JOIN pages p ON p.id = l.from_page
        WHERE lower(l.to_slug) = lower(?) AND l.from_page != ? AND l.kind != 'embed'
        ORDER BY p.slug`,
    )
    .all(page.slug, page.id) as { id: string; slug: string; rel_path: string; role: string }[];
  if (inboundRows.some((row) => row.role !== 'knowledge' || isReserved(row.slug, ctx.config))) return null;
  const inbound: DepthRuleDriftDraft['inbound'] = [];
  for (const row of inboundRows) {
    const content = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (content === null) return null;
    const after = rewritePageLinks(content, row.slug, page.slug, destinationSlug);
    if (after === content) return null;
    inbound.push({ slug: row.slug, relPath: row.rel_path, before: content, after });
  }

  const inputHash = sha256(
    JSON.stringify([
      [page.rel_path, sha256(before)],
      ...inbound.map((entry) => [entry.relPath, sha256(entry.before)]),
    ]),
  );
  return {
    kind: 'rule_drift',
    correction: 'max_depth',
    slug: page.slug,
    relPath: page.rel_path,
    inputHash,
    before,
    pageId: page.id,
    maxDepth: declaration.max_depth,
    foundDepth,
    relocateTo,
    destinationSlug,
    destinationRelPath,
    inbound,
    ruleGlob: declaration.glob,
    ruleFingerprint: sha256(
      JSON.stringify({
        glob: declaration.glob,
        max_depth: declaration.max_depth,
        relocate_to: relocateTo,
      }),
    ),
  };
}

function normalizeFolder(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (
    !normalized ||
    normalized.endsWith('.md') ||
    normalized.includes('*') ||
    normalized.includes('?') ||
    normalized.includes('#') ||
    normalized.split('/').some((part) => part === '.' || part === '..' || part.length === 0)
  ) {
    return null;
  }
  return normalized;
}

function destinationRuleIssues(slug: string, ctx: AknoContext): number {
  const rule = effectiveRule(slug, ctx.config.rules);
  const basename = slug.slice(slug.lastIndexOf('/') + 1);
  if (rule.slug_pattern) {
    try {
      if (!new RegExp(rule.slug_pattern).test(basename)) return 1;
    } catch {
      return 1;
    }
  }
  const declaration = declaringRule(slug, ctx.config.rules, 'max_depth');
  if (declaration?.max_depth !== undefined) {
    const rootDepth = declaration.glob
      .replace(/\/\*\*?$/, '')
      .split('/')
      .filter(Boolean).length;
    if (slug.split('/').length - rootDepth > declaration.max_depth) return 1;
  }
  return 0;
}

export function hasLocationDependentMarkdown(content: string, fromSlug: string): boolean {
  for (const match of content.matchAll(/!?\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)) {
    const href = match[1]!;
    if (/^[a-z]+:/i.test(href) || href.startsWith('#')) continue;
    const target = href.split('#', 1)[0]!;
    if (
      target.startsWith('../') ||
      target.startsWith('./') ||
      !target.replace(/\.(md|markdown)$/i, '').includes('/')
    ) {
      if (normalizeLinkTarget(target, fromSlug)) return true;
    }
  }
  return false;
}

/** Losslessly retarget page links, retaining aliases, fragments, labels, and titles. */
export function rewritePageLinks(text: string, fromPage: string, oldSlug: string, newSlug: string): string {
  const wiki = text.replace(/\[\[([^\]|#]+)((?:#[^\]|]+)?(?:\|[^\]]+)?)\]\]/g, (whole, target, suffix) => {
    return normalizeLinkTarget(String(target), fromPage).toLowerCase() === oldSlug.toLowerCase()
      ? `[[${newSlug}${String(suffix)}]]`
      : whole;
  });
  return wiki.replace(
    /(?<!!)\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(\s+[^)]*)?\)/g,
    (whole, label, href, titlePart) => {
      const value = String(href);
      const hash = value.indexOf('#');
      const target = hash >= 0 ? value.slice(0, hash) : value;
      const fragment = hash >= 0 ? value.slice(hash) : '';
      if (normalizeLinkTarget(target, fromPage).toLowerCase() !== oldSlug.toLowerCase()) return whole;
      return `[${String(label)}](${newSlug}.md${fragment}${String(titlePart ?? '')})`;
    },
  );
}

function jsonStrings(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}
