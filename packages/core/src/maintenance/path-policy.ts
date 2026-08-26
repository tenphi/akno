import path from 'node:path';
import {
  AknoError,
  type DreamManagement,
  type PageRole,
  type RememberManagement,
} from '@tenphi/akno-protocol';
import type {
  AknoConfig,
  MaintenanceLimits,
  MaintenancePolicy,
  MaintenanceProfile,
  MaintenanceTransform,
} from '../config/schema.ts';
import type { AknoContext } from '../context.ts';
import { folderCatalog } from '../kb/folders.ts';
import { isReserved } from '../reserved.ts';
import { effectiveRule, matchRules } from '../rules/compile.ts';
import type { MaintenanceMode } from './plans.ts';
import { assertMaintenanceModeAllowed, effectiveTransformPolicy, profileMode } from './profile.ts';

export const PAGE_MAINTENANCE_TRANSFORMS = [
  'hygiene',
  'synthesis',
  'split',
  'extract',
  'merge',
  'contradiction',
  'broken_link',
] as const satisfies readonly MaintenanceTransform[];

export type PageMaintenanceTransform = (typeof PAGE_MAINTENANCE_TRANSFORMS)[number];
const MODEL_PLANNED_PAGE_TRANSFORMS = new Set<PageMaintenanceTransform>([
  'hygiene',
  'synthesis',
  'split',
  'extract',
  'merge',
]);
export type MaintenancePathState = 'indexed_page' | 'not_indexed' | 'non_page' | 'ignored';
export type MaintenancePolicySource = 'frontmatter' | 'folder_rule' | 'provenance' | 'default';
export type MaintenancePathOutcome =
  'ineligible' | 'off' | 'audit_only' | 'awaiting_human' | 'curator_then_apply' | 'apply_blocked';

export interface MaintenancePathReason {
  layer: 'path' | 'page' | 'configuration' | 'policy' | 'budget' | 'model';
  code: string;
  message: string;
}

export interface MaintenancePathTransformPolicy {
  kind: PageMaintenanceTransform;
  configuredPolicy: MaintenancePolicy;
  effectivePolicy: MaintenancePolicy;
  outcome: MaintenancePathOutcome;
  canInspect: boolean;
  decision: 'none' | 'human' | 'curator';
  automaticApplyPossible: boolean;
  blockers: MaintenancePathReason[];
  applyBlockers: MaintenancePathReason[];
}

export interface MaintenancePathPolicy {
  slug: string;
  state: MaintenancePathState;
  exists: boolean;
  profile: MaintenanceProfile;
  runMode: MaintenanceMode;
  maintenanceModel: { id: string | null; configured: boolean };
  page: {
    role: PageRole;
    roleSource: MaintenancePolicySource;
    remember: RememberManagement;
    rememberSource: MaintenancePolicySource;
    dream: DreamManagement;
    dreamSource: 'frontmatter' | 'default';
    bytes: number | null;
    reserved: boolean;
  };
  rules: {
    effective: Record<string, unknown>;
    candidates: { glob: string; source: string }[];
  };
  transformations: MaintenancePathTransformPolicy[];
  pathIndependent: {
    kind: Extract<MaintenanceTransform, 'observe' | 'reflect' | 'adopt'>;
    policy: MaintenancePolicy;
    enabled: boolean;
    reason: string;
  }[];
  limits: MaintenanceLimits;
  remainingChecks: string[];
}

interface PagePolicyRow {
  slug: string;
  role: PageRole;
  remember_management: RememberManagement;
  dream_management: DreamManagement;
  frontmatter: string;
  bytes: number;
}

/**
 * Explain the default scheduled authority for one page path without inspecting page content.
 * The answer describes permission and eligibility, not whether tonight will discover a candidate.
 */
export function explainMaintenancePath(
  ctx: AknoContext,
  rawPath: string,
  requestedMode?: MaintenanceMode,
): MaintenancePathPolicy {
  const normalized = normalizePolicyPath(rawPath, ctx.config);
  if (requestedMode) assertMaintenanceModeAllowed(ctx.config, { mode: requestedMode });
  const runMode = requestedMode ?? profileMode(ctx.config.maintenance.profile);
  const matched = matchRules(normalized.slug, ctx.config.rules);
  const rule = effectiveRule(normalized.slug, ctx.config.rules);
  const row = ctx.store.db
    .prepare(
      `SELECT slug, role, remember_management, dream_management, frontmatter, bytes
         FROM pages WHERE slug = ?`,
    )
    .get(normalized.slug) as PagePolicyRow | undefined;
  const declarations = row ? pageDeclarations(row.frontmatter) : {};
  // Current declarations win over cached index values: operators commonly ask immediately after changing a
  // folder rule, before the next index pass has reconciled the page row.
  const role = declarations.role ?? rule.role ?? row?.role ?? inferredRole(normalized.slug, ctx.config);
  const roleSource = declarations.role
    ? 'frontmatter'
    : rule.role
      ? 'folder_rule'
      : inferredRoleSource(normalized.slug, ctx.config);
  const remember = declarations.remember ?? rule.remember ?? 'deny';
  const rememberSource = declarations.remember ? 'frontmatter' : rule.remember ? 'folder_rule' : 'default';
  const dream = row?.dream_management ?? 'none';
  const state = row
    ? 'indexed_page'
    : normalized.ignored
      ? 'ignored'
      : normalized.nonPage
        ? 'non_page'
        : 'not_indexed';
  const maintenanceRole = ctx.config.maintenance.model ?? ctx.config.models.derive;
  const hasExtractionDestination = folderCatalog(ctx.config, ctx.store).some(
    (entry) =>
      entry.eligible && entry.role === 'knowledge' && entry.remember === 'integrate' && entry.path.length > 0,
  );
  const page: MaintenancePathPolicy['page'] = {
    role,
    roleSource,
    remember,
    rememberSource,
    dream,
    dreamSource: declarations.dream ? ('frontmatter' as const) : ('default' as const),
    bytes: row?.bytes ?? null,
    reserved: isReserved(normalized.slug, ctx.config),
  };

  return {
    slug: normalized.slug,
    state,
    exists: row !== undefined,
    profile: ctx.config.maintenance.profile,
    runMode,
    maintenanceModel: { id: maintenanceRole.id, configured: modelConfigured(maintenanceRole) },
    page,
    rules: {
      effective: contentSafeRule(rule),
      candidates: matched.candidates.map((candidate) => ({
        glob: candidate.glob,
        source: ruleSourceLabel(candidate.source, ctx.config),
      })),
    },
    transformations: PAGE_MAINTENANCE_TRANSFORMS.map((kind) =>
      explainPageTransform(
        ctx.config,
        normalized.slug,
        state,
        page,
        kind,
        runMode,
        modelConfigured(maintenanceRole),
        hasExtractionDestination,
      ),
    ),
    pathIndependent: [
      {
        kind: 'observe',
        policy: effectiveTransformPolicy(ctx.config, 'observe', runMode),
        enabled: ctx.config.maintenance.observe.enabled,
        reason: 'observe writes derived pattern pages from evidence groups, not this page as a target',
      },
      {
        kind: 'reflect',
        policy: effectiveTransformPolicy(ctx.config, 'reflect', runMode),
        enabled: ctx.config.maintenance.reflect.enabled,
        reason: 'reflect writes derived principle pages from observation groups, not this page as a target',
      },
      {
        kind: 'adopt',
        policy: effectiveTransformPolicy(ctx.config, 'adopt', runMode),
        enabled: true,
        reason: 'adopt targets readable orphan documents rather than an indexed Markdown page',
      },
    ],
    limits: { ...ctx.config.maintenance.limits },
    remainingChecks: [
      'a qualifying candidate must be discovered from the current index',
      'the exact proposal must pass transformation-specific deterministic guards',
      'configured model capabilities must still answer successfully during the run',
      'the item must fit the remaining shared run budget',
      'review needs a human decision; auto needs an independent curator decision',
      'sealed inputs must still match immediately before apply',
      'every applied operation is re-indexed and verified or rolled back',
    ],
  };
}

/** The page-owned structural boundary used by both planners and the explanation above. */
export function pageAllowsMaintenanceTransform(
  config: AknoConfig,
  page: { slug: string; role: string; dreamManagement: string },
  kind: PageMaintenanceTransform,
): boolean {
  if (isReserved(page.slug, config) || page.role !== 'knowledge') return false;
  if (kind === 'broken_link') {
    return page.dreamManagement === 'hygiene' || page.dreamManagement === 'synthesize';
  }
  return page.dreamManagement === requiredDreamMode(kind);
}

/** Exact folder allowlist semantics shared with merge candidate discovery. */
export function mergePathAllowed(slug: string, folders: string[]): boolean {
  const value = slug.toLowerCase();
  return folders.some((raw) => {
    const folder = raw
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();
    return folder === '*' || (folder.length > 0 && value.startsWith(`${folder}/`));
  });
}

function explainPageTransform(
  config: AknoConfig,
  slug: string,
  state: MaintenancePathState,
  page: MaintenancePathPolicy['page'],
  kind: PageMaintenanceTransform,
  runMode: MaintenanceMode,
  maintenanceModelConfigured: boolean,
  hasExtractionDestination: boolean,
): MaintenancePathTransformPolicy {
  const configuredPolicy = config.maintenance.policies[kind];
  const effectivePolicy = effectiveTransformPolicy(config, kind, runMode);
  const blockers: MaintenancePathReason[] = [];

  if (effectivePolicy === 'off') {
    blockers.push(reason('policy', 'policy_off', 'this transformation policy is off'));
  }
  if (state !== 'indexed_page') {
    const stateMessage =
      state === 'ignored'
        ? 'the path is excluded from the index'
        : state === 'non_page'
          ? 'the path is not a configured Markdown page type'
          : 'no indexed page exists at this path';
    blockers.push(reason('path', state, stateMessage));
  } else {
    if (page.reserved) {
      blockers.push(reason('path', 'reserved_path', 'the path is owned by an Akno subsystem'));
    }
    if (page.role !== 'knowledge') {
      blockers.push(
        reason('page', 'role_not_knowledge', `the resolved page role is ${page.role}, not knowledge`),
      );
    }
    const required = requiredDreamMode(kind);
    const dreamAllowed =
      kind === 'broken_link'
        ? page.dream === 'hygiene' || page.dream === 'synthesize'
        : page.dream === required;
    if (!dreamAllowed) {
      blockers.push(
        reason(
          'page',
          'dream_opt_in',
          kind === 'broken_link'
            ? 'the page must declare dream: hygiene or dream: synthesize'
            : `the page must declare dream: ${required}`,
        ),
      );
    }
  }

  addTransformationConfigurationBlockers(config, slug, page, kind, blockers, hasExtractionDestination);
  if (MODEL_PLANNED_PAGE_TRANSFORMS.has(kind) && !maintenanceModelConfigured) {
    blockers.push(
      reason('model', 'planner_model_unavailable', 'no maintenance model capability is configured'),
    );
  }

  const canInspect = blockers.length === 0;
  const applyBlockers =
    canInspect && effectivePolicy === 'auto'
      ? automaticApplyBlockers(config, kind, maintenanceModelConfigured)
      : [];
  const decision =
    !canInspect || effectivePolicy === 'audit' || effectivePolicy === 'off'
      ? 'none'
      : effectivePolicy === 'review'
        ? 'human'
        : 'curator';
  const automaticApplyPossible = canInspect && effectivePolicy === 'auto' && applyBlockers.length === 0;
  const outcome: MaintenancePathOutcome =
    effectivePolicy === 'off'
      ? 'off'
      : !canInspect
        ? 'ineligible'
        : effectivePolicy === 'audit'
          ? 'audit_only'
          : effectivePolicy === 'review'
            ? 'awaiting_human'
            : applyBlockers.length > 0
              ? 'apply_blocked'
              : 'curator_then_apply';

  return {
    kind,
    configuredPolicy,
    effectivePolicy,
    outcome,
    canInspect,
    decision,
    automaticApplyPossible,
    blockers,
    applyBlockers,
  };
}

function addTransformationConfigurationBlockers(
  config: AknoConfig,
  slug: string,
  page: MaintenancePathPolicy['page'],
  kind: PageMaintenanceTransform,
  blockers: MaintenancePathReason[],
  hasExtractionDestination: boolean,
): void {
  const curate = config.maintenance.curate;
  if (kind === 'split') {
    if (curate.maxSplits === 0) {
      blockers.push(reason('configuration', 'split_limit_zero', 'the split planner limit is zero'));
    } else if (page.bytes !== null && page.bytes < curate.splitAfterBytes) {
      blockers.push(
        reason(
          'configuration',
          'below_split_threshold',
          `the page is below the configured ${curate.splitAfterBytes}-byte split threshold`,
        ),
      );
    }
  }
  if (kind === 'extract') {
    if (curate.maxExtracts === 0) {
      blockers.push(reason('configuration', 'extract_limit_zero', 'the extraction planner limit is zero'));
    } else if (!hasExtractionDestination) {
      blockers.push(
        reason(
          'configuration',
          'no_extraction_destination',
          'the knowledge-base taxonomy has no eligible extraction destination folder',
        ),
      );
    } else if (page.bytes !== null && page.bytes < curate.extractAfterBytes) {
      blockers.push(
        reason(
          'configuration',
          'below_extract_threshold',
          `the page is below the configured ${curate.extractAfterBytes}-byte extraction threshold`,
        ),
      );
    }
  }
  if (kind === 'merge') {
    if (curate.maxMerges === 0) {
      blockers.push(reason('configuration', 'merge_limit_zero', 'the merge planner limit is zero'));
    } else if (!mergePathAllowed(slug, curate.mergeFolders)) {
      blockers.push(
        reason('configuration', 'merge_folder', 'the page is outside the configured merge folder allowlist'),
      );
    }
  }
  if (kind === 'contradiction' && !config.maintenance.conflicts.resolve) {
    blockers.push(
      reason('configuration', 'contradiction_resolution_off', 'contradiction resolution is disabled'),
    );
  }
  if (kind === 'broken_link' && !config.maintenance.repair.links) {
    blockers.push(reason('configuration', 'broken_link_repair_off', 'broken-link planning is disabled'));
  }
}

function automaticApplyBlockers(
  config: AknoConfig,
  kind: PageMaintenanceTransform,
  maintenanceModelConfigured: boolean,
): MaintenancePathReason[] {
  const blockers: MaintenancePathReason[] = [];
  const limits = config.maintenance.limits;
  if (limits.maxItems === 0 || limits.maxFilesChanged === 0 || limits.maxBytesWritten === 0) {
    blockers.push(
      reason('budget', 'zero_write_budget', 'a whole-run apply limit is zero, so no item can be written'),
    );
  }
  if (
    limits.maxHighRiskItems === 0 &&
    (kind === 'synthesis' || kind === 'merge' || kind === 'contradiction')
  ) {
    blockers.push(reason('budget', 'zero_high_risk_budget', 'the whole-run high-risk item limit is zero'));
  }
  if (!maintenanceModelConfigured) {
    blockers.push(
      reason(
        'model',
        'curator_model_unavailable',
        'automatic apply requires a configured maintenance curator model',
      ),
    );
  }
  return blockers;
}

function requiredDreamMode(kind: PageMaintenanceTransform): Exclude<DreamManagement, 'none'> {
  return kind === 'hygiene' ? 'hygiene' : 'synthesize';
}

function normalizePolicyPath(
  raw: string,
  config: AknoConfig,
): {
  slug: string;
  ignored: boolean;
  nonPage: boolean;
} {
  let portable = raw.trim().replaceAll('\\', '/');
  if (!portable || portable.startsWith('/') || portable.startsWith('~') || /^[A-Za-z]:/.test(portable)) {
    throw new AknoError('invalid', 'maintenance policy path must be relative to the knowledge-base root');
  }
  portable = path.posix.normalize(portable).replace(/^\.\//, '');
  if (portable === '..' || portable.startsWith('../') || portable.includes('\0')) {
    throw new AknoError('invalid', 'maintenance policy path must stay inside the knowledge-base root');
  }
  const extension = path.posix.extname(portable).toLowerCase();
  const pageExtension = config.pageExtensions.includes(extension);
  const slug = pageExtension ? portable.slice(0, -extension.length) : portable;
  const segments = portable.split('/');
  const ignoredNames = new Set(config.ignore.map((entry) => entry.replace(/^\/+|\/+$/g, '')));
  const ignored =
    segments.some((segment) => segment.startsWith('.') || ignoredNames.has(segment)) ||
    [...ignoredNames].some((entry) => portable === entry || portable.startsWith(`${entry}/`));
  const nonPage = extension.length > 0 && !pageExtension;
  if (!slug || slug.length > 512) {
    throw new AknoError('invalid', 'maintenance policy path is not usable');
  }
  return { slug, ignored, nonPage };
}

function inferredRole(slug: string, config: AknoConfig): PageRole {
  return inferredRoleSource(slug, config) === 'provenance' ? 'inference' : 'knowledge';
}

function inferredRoleSource(slug: string, config: AknoConfig): MaintenancePolicySource {
  const observations = config.paths.observations.replace(/\.(md|markdown)$/i, '').replace(/\/+$/, '');
  return slug === observations || slug.startsWith(`${observations}/`) ? 'provenance' : 'default';
}

export function pageDeclarations(frontmatter: string): {
  role?: PageRole;
  remember?: RememberManagement;
  dream?: DreamManagement;
} {
  try {
    const parsed = JSON.parse(frontmatter) as Record<string, unknown>;
    const akno = record(parsed.akno);
    const management = record(akno.management);
    return {
      ...(isPageRole(akno.role) ? { role: akno.role } : {}),
      ...(management.remember === 'deny' || management.remember === 'integrate'
        ? { remember: management.remember }
        : {}),
      ...(management.dream === 'none' || management.dream === 'hygiene' || management.dream === 'synthesize'
        ? { dream: management.dream }
        : {}),
    };
  } catch {
    return {};
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isPageRole(value: unknown): value is PageRole {
  return value === 'knowledge' || value === 'source' || value === 'inference' || value === 'ignored';
}

function modelConfigured(role: AknoConfig['models']['derive']): boolean {
  return role.enabled && role.provider !== null && role.id !== null;
}

/** Status output keeps authority fields, not private taxonomy prose or local configuration paths. */
function contentSafeRule(rule: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    ['role', 'remember', 'ingest', 'max_depth'].flatMap((key) =>
      rule[key] === undefined ? [] : [[key, rule[key]]],
    ),
  );
}

function ruleSourceLabel(source: string, config: AknoConfig): string {
  if (source === '<overrides>') return 'runtime overrides';
  if (source.includes('AKNO_')) return 'environment';
  if (source.startsWith(config.aknoPath)) return 'knowledge-base rules';
  return 'configuration';
}

function reason(layer: MaintenancePathReason['layer'], code: string, message: string): MaintenancePathReason {
  return { layer, code, message };
}
