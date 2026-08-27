import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { replaceTopLevelString } from '../kb/frontmatter.ts';
import { normalizeLinkTarget, parsePage, resolvePagePolicy } from '../kb/page.ts';
import { isReserved } from '../reserved.ts';
import { declaringRule, effectiveRule } from '../rules/compile.ts';
import { sha256 } from '../store/ids.ts';
import { configuredTransformPolicy } from './profile.ts';

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

interface RuleDriftCandidateBase {
  pageId: string;
  slug: string;
  relPath: string;
  role: string;
  ruleGlob: string;
}

export type RuleDriftCandidate = RuleDriftCandidateBase &
  (
    | { field: 'type'; expectedType: string; foundType: string }
    | { field: 'slug_pattern' }
    | { field: 'max_depth'; maxDepth: number; foundDepth: number }
  );

export type RuleRepairAssessment =
  | {
      status: 'ready';
      code: 'exact_type' | 'exact_relocation';
      reason: string;
    }
  | {
      status: 'report_only';
      code: 'slug_has_no_exact_repair' | 'relocation_not_declared';
      reason: string;
    }
  | {
      status: 'held';
      code:
        | 'role_not_knowledge'
        | 'policy_off'
        | 'planner_limit_zero'
        | 'reserved_source'
        | 'source_unreadable'
        | 'type_not_scalar'
        | 'relocation_rule_invalid'
        | 'destination_unsafe'
        | 'destination_occupied'
        | 'destination_not_knowledge'
        | 'destination_rule_conflict'
        | 'location_dependent_reference'
        | 'self_link'
        | 'owned_documents'
        | 'incoming_about'
        | 'reference_backlink'
        | 'backlink_unreadable'
        | 'backlink_unrewritable';
      reason: string;
    };

export interface RuleRepairPreparation {
  assessment: RuleRepairAssessment;
  draft: RuleDriftDraft | null;
}

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
      `SELECT id, slug, rel_path, role, type FROM pages
        WHERE role = 'knowledge'
        ORDER BY slug`,
    )
    .all() as { id: string; slug: string; rel_path: string; role: string; type: string | null }[];
  const drafts: RuleDriftDraft[] = [];
  const terminal = ctx.store.db.prepare(
    `SELECT 1 FROM maintenance_items
      WHERE kind = 'rule_drift' AND input_hash = ? AND subject = ?
        AND status IN ('applied', 'rejected') LIMIT 1`,
  );

  for (const page of pages) {
    if (drafts.length >= options.limit) break;
    const rule = effectiveRule(page.slug, ctx.config.rules);
    const typeDeclaration = declaringRule(page.slug, ctx.config.rules, 'type');
    if (rule.type && typeDeclaration?.type === rule.type && page.type && page.type !== rule.type) {
      const prepared = await prepareRuleRepair(ctx, {
        pageId: page.id,
        slug: page.slug,
        relPath: page.rel_path,
        role: page.role,
        field: 'type',
        ruleGlob: typeDeclaration.glob,
        expectedType: rule.type,
        foundType: page.type,
      });
      if (prepared.draft && !terminal.get(prepared.draft.inputHash, page.slug)) {
        drafts.push(prepared.draft);
        continue;
      }
    }

    const depthDeclaration = declaringRule(page.slug, ctx.config.rules, 'max_depth');
    if (!depthDeclaration?.max_depth) continue;
    const ruleRoot = depthDeclaration.glob
      .replace(/\/\*\*?$/, '')
      .split('/')
      .filter(Boolean);
    const foundDepth = page.slug.split('/').length - ruleRoot.length;
    if (foundDepth <= depthDeclaration.max_depth) continue;
    const prepared = await prepareRuleRepair(ctx, {
      pageId: page.id,
      slug: page.slug,
      relPath: page.rel_path,
      role: page.role,
      field: 'max_depth',
      ruleGlob: depthDeclaration.glob,
      maxDepth: depthDeclaration.max_depth,
      foundDepth,
    });
    if (!prepared.draft || terminal.get(prepared.draft.inputHash, page.slug)) continue;
    drafts.push(prepared.draft);
  }

  return drafts;
}

/** Shared deterministic analysis used by both planning and housekeeping explanations. */
export async function prepareRuleRepair(
  ctx: AknoContext,
  candidate: RuleDriftCandidate,
): Promise<RuleRepairPreparation> {
  if (configuredTransformPolicy(ctx.config, 'rule_drift') === 'off') {
    return outcome('held', 'policy_off', 'the rule_drift maintenance policy is off');
  }
  if (ctx.config.maintenance.curate.maxRuleDrifts === 0) {
    return outcome('held', 'planner_limit_zero', 'max_rule_drifts is zero');
  }
  if (candidate.field === 'slug_pattern') {
    return outcome(
      'report_only',
      'slug_has_no_exact_repair',
      'a slug pattern diagnoses the name but does not determine one exact replacement',
    );
  }
  if (candidate.role !== 'knowledge') {
    return outcome(
      'held',
      'role_not_knowledge',
      'source/reference material is outside autonomous rule-repair authority',
    );
  }
  if (isReserved(candidate.slug, ctx.config)) {
    return outcome('held', 'reserved_source', 'the page belongs to a reserved Akno subsystem');
  }
  const before = await fsp
    .readFile(path.join(ctx.config.aknoPath, candidate.relPath), 'utf8')
    .catch(() => null);
  if (before === null)
    return outcome('held', 'source_unreadable', 'the indexed source bytes are unavailable');

  if (candidate.field === 'type') {
    const after = replaceTopLevelString(before, 'type', candidate.expectedType);
    if (after === null || after === before) {
      return outcome('held', 'type_not_scalar', 'the current type is not one replaceable top-level scalar');
    }
    return {
      assessment: {
        status: 'ready',
        code: 'exact_type',
        reason: 'one exact top-level type replacement is available',
      },
      draft: {
        kind: 'rule_drift',
        correction: 'type',
        slug: candidate.slug,
        relPath: candidate.relPath,
        inputHash: sha256(before),
        before,
        after,
        ruleGlob: candidate.ruleGlob,
        expectedType: candidate.expectedType,
        foundType: candidate.foundType,
        ruleFingerprint: sha256(JSON.stringify({ glob: candidate.ruleGlob, type: candidate.expectedType })),
      },
    };
  }
  return prepareDepthRepair(ctx, candidate, before);
}

async function prepareDepthRepair(
  ctx: AknoContext,
  candidate: Extract<RuleDriftCandidate, { field: 'max_depth' }>,
  before: string,
): Promise<RuleRepairPreparation> {
  const declaration = declaringRule(candidate.slug, ctx.config.rules, 'max_depth');
  if (
    !declaration?.max_depth ||
    !declaration.relocate_to ||
    declaringRule(candidate.slug, ctx.config.rules, 'relocate_to')?.glob !== declaration.glob
  ) {
    return outcome(
      'report_only',
      'relocation_not_declared',
      'max_depth diagnoses placement but the same rule does not name relocate_to',
    );
  }

  const relocateTo = normalizeFolder(declaration.relocate_to);
  if (!relocateTo) {
    return outcome('held', 'relocation_rule_invalid', 'relocate_to is not one safe folder path');
  }
  const basename = candidate.slug.slice(candidate.slug.lastIndexOf('/') + 1);
  const destinationSlug = `${relocateTo}/${basename}`;
  const destinationRelPath = `${destinationSlug}.md`;
  if (destinationSlug === candidate.slug || isReserved(destinationSlug, ctx.config)) {
    return outcome('held', 'destination_unsafe', 'the declared destination is not a safe distinct page path');
  }
  if (ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(destinationSlug)) {
    return outcome('held', 'destination_occupied', 'a page already occupies the exact destination');
  }
  const destinationPath = path.join(ctx.config.aknoPath, destinationRelPath);
  if (
    await fsp
      .stat(destinationPath)
      .then(() => true)
      .catch(() => false)
  )
    return outcome('held', 'destination_occupied', 'a file already occupies the exact destination');

  const parsed = parsePage(candidate.relPath, before);
  const destinationPage = parsePage(destinationRelPath, before);
  const destinationRule = effectiveRule(destinationSlug, ctx.config.rules);
  const destinationPolicy = resolvePagePolicy(
    destinationPage,
    destinationRule,
    ctx.config.paths.observations,
  );
  if (destinationPolicy.role !== 'knowledge') {
    return outcome('held', 'destination_not_knowledge', 'the exact destination is not live knowledge');
  }
  if (destinationRuleIssues(destinationSlug, ctx) > 0) {
    return outcome(
      'held',
      'destination_rule_conflict',
      'the exact destination violates its current folder rules',
    );
  }
  if (hasLocationDependentMarkdown(before, candidate.slug)) {
    return outcome(
      'held',
      'location_dependent_reference',
      'a relative Markdown reference would change meaning after a byte-preserving move',
    );
  }
  if (parsed.links.some((link) => link.toSlug === candidate.slug)) {
    return outcome('held', 'self_link', 'a self-link would still name the retired path');
  }
  const documents = ctx.store.db
    .prepare('SELECT count(*) AS n FROM documents WHERE page_id = ?')
    .get(candidate.pageId) as { n: number };
  if (documents.n > 0) {
    return outcome('held', 'owned_documents', 'owned documents need a separate attachment-aware move');
  }
  const aboutRows = ctx.store.db
    .prepare('SELECT id, about FROM pages WHERE id != ?')
    .all(candidate.pageId) as {
    id: string;
    about: string;
  }[];
  if (
    aboutRows.some((row) =>
      jsonStrings(row.about).some((slug) => slug.toLowerCase() === candidate.slug.toLowerCase()),
    )
  ) {
    return outcome(
      'held',
      'incoming_about',
      'an incoming about relationship would retain the retired identity',
    );
  }

  const inboundRows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.id, p.slug, p.rel_path, p.role
         FROM links l JOIN pages p ON p.id = l.from_page
        WHERE lower(l.to_slug) = lower(?) AND l.from_page != ? AND l.kind != 'embed'
        ORDER BY p.slug`,
    )
    .all(candidate.slug, candidate.pageId) as { id: string; slug: string; rel_path: string; role: string }[];
  if (inboundRows.some((row) => row.role !== 'knowledge' || isReserved(row.slug, ctx.config))) {
    return outcome(
      'held',
      'reference_backlink',
      'an inbound link belongs to protected or reference material',
    );
  }
  const inbound: DepthRuleDriftDraft['inbound'] = [];
  for (const row of inboundRows) {
    const content = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (content === null) {
      return outcome('held', 'backlink_unreadable', 'an indexed inbound-link page is unreadable');
    }
    const after = rewritePageLinks(content, row.slug, candidate.slug, destinationSlug);
    if (after === content) {
      return outcome('held', 'backlink_unrewritable', 'an indexed inbound link cannot be rewritten exactly');
    }
    inbound.push({ slug: row.slug, relPath: row.rel_path, before: content, after });
  }

  const inputHash = sha256(
    JSON.stringify([
      [candidate.relPath, sha256(before)],
      ...inbound.map((entry) => [entry.relPath, sha256(entry.before)]),
    ]),
  );
  return {
    assessment: {
      status: 'ready',
      code: 'exact_relocation',
      reason: 'one exact byte-preserving relocation and complete backlink update are available',
    },
    draft: {
      kind: 'rule_drift',
      correction: 'max_depth',
      slug: candidate.slug,
      relPath: candidate.relPath,
      inputHash,
      before,
      pageId: candidate.pageId,
      maxDepth: declaration.max_depth,
      foundDepth: candidate.foundDepth,
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
    },
  };
}

function outcome(
  status: 'held' | 'report_only',
  code: Extract<RuleRepairAssessment, { status: typeof status }>['code'],
  reason: string,
): RuleRepairPreparation {
  return { assessment: { status, code, reason } as RuleRepairAssessment, draft: null };
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
