import { AknoError } from '@tenphi/akno-protocol';
import {
  MAINTENANCE_TRANSFORMS,
  type AknoConfig,
  type MaintenanceLimits,
  type MaintenancePolicy,
  type MaintenanceProfile,
  type MaintenanceTransform,
} from '../config/schema.ts';
import type { DreamOptions } from './dream.ts';
import type { MaintenanceMode } from './plans.ts';

export type MaintenancePhaseAuthority = 'disabled' | MaintenanceMode;
export type EffectiveMaintenancePolicy = MaintenancePolicy;

/** Content-safe explanation of what an unqualified `akno dream` is allowed to do. */
export interface MaintenanceAuthority {
  profile: MaintenanceProfile;
  mode: MaintenanceMode;
  automaticKnowledgeBaseWrites: boolean;
  /** @deprecated Compatibility summary for clients from before inference had per-phase authority. */
  inference: 'preview' | 'write-when-enabled';
  observe: MaintenancePhaseAuthority;
  reflect: MaintenancePhaseAuthority;
  curate: MaintenancePhaseAuthority;
  adopt: MaintenancePhaseAuthority;
  policies: Record<MaintenanceTransform, MaintenancePolicy>;
  limits: MaintenanceLimits;
}

export function configuredMaintenanceAuthority(config: AknoConfig): MaintenanceAuthority {
  const mode = profileMode(config.maintenance.profile);
  const policies = Object.fromEntries(
    MAINTENANCE_TRANSFORMS.map((kind) => [kind, configuredTransformPolicy(config, kind)]),
  ) as Record<MaintenanceTransform, MaintenancePolicy>;
  const observe = policyPhaseAuthority(config.maintenance.observe.enabled, [policies.observe]);
  const reflect = policyPhaseAuthority(config.maintenance.reflect.enabled, [policies.reflect]);
  const curate = policyPhaseAuthority(true, [
    policies.hygiene,
    policies.synthesis,
    policies.split,
    policies.extract,
    policies.merge,
    config.maintenance.conflicts.resolve ? policies.contradiction : 'off',
    config.maintenance.repair.links ? policies.broken_link : 'off',
  ]);
  const adopt = policyPhaseAuthority(true, [policies.adopt]);
  const automaticKnowledgeBaseWrites = MAINTENANCE_TRANSFORMS.some(
    (kind) => policies[kind] === 'auto' && transformEnabled(config, kind),
  );
  return {
    profile: config.maintenance.profile,
    mode,
    automaticKnowledgeBaseWrites,
    inference: mode === 'auto' ? 'write-when-enabled' : 'preview',
    observe,
    reflect,
    curate,
    adopt,
    policies,
    limits: { ...config.maintenance.limits },
  };
}

/** Fully resolved authority for one transformation before a one-run ceiling is applied. */
export function configuredTransformPolicy(config: AknoConfig, kind: MaintenanceTransform): MaintenancePolicy {
  return config.maintenance.policies[kind];
}

/** Intersect a class policy with a lower one-run mode. `off` is never promoted. */
export function effectiveTransformPolicy(
  config: AknoConfig,
  kind: MaintenanceTransform,
  runMode?: MaintenanceMode,
): MaintenancePolicy {
  const configured = configuredTransformPolicy(config, kind);
  if (!runMode || configured === 'off') return configured;
  return authorityRank(configured) <= authorityRank(runMode) ? configured : runMode;
}

export function policyMode(policy: MaintenancePolicy): MaintenanceMode | null {
  return policy === 'off' ? null : policy;
}

/** Highest effective authority among the enabled classes, for the plan/run envelope. */
export function highestPolicyMode(policies: Iterable<MaintenancePolicy>): MaintenanceMode | null {
  let selected: MaintenanceMode | null = null;
  for (const policy of policies) {
    const mode = policyMode(policy);
    if (mode && (!selected || authorityRank(mode) > authorityRank(selected))) selected = mode;
  }
  return selected;
}

/** A run override may reduce configured authority, never promote it. */
export function assertMaintenanceModeAllowed(config: AknoConfig, options: DreamOptions): void {
  if (!options.mode) return;
  const profileCeiling = profileMode(config.maintenance.profile);
  if (authorityRank(options.mode) > authorityRank(profileCeiling)) {
    throw authorityError(options.mode, `the ${config.maintenance.profile} profile`, profileCeiling);
  }
}

export function inferenceDryRun(config: AknoConfig, options: DreamOptions): boolean {
  if (options.dryRun) return true;
  const runMode = options.mode ?? profileMode(config.maintenance.profile);
  return runMode === 'audit' || runMode === 'review';
}

export function profileMode(profile: MaintenanceProfile): MaintenanceMode {
  return profile === 'autonomous' ? 'auto' : profile;
}

function transformEnabled(config: AknoConfig, kind: MaintenanceTransform): boolean {
  if (kind === 'observe') return config.maintenance.observe.enabled;
  if (kind === 'reflect') return config.maintenance.reflect.enabled;
  if (kind === 'contradiction') return config.maintenance.conflicts.resolve;
  if (kind === 'broken_link') return config.maintenance.repair.links;
  return true;
}

function policyPhaseAuthority(
  enabled: boolean,
  policies: Iterable<MaintenancePolicy>,
): MaintenancePhaseAuthority {
  if (!enabled) return 'disabled';
  return highestPolicyMode(policies) ?? 'disabled';
}

function authorityRank(mode: MaintenanceMode): number {
  return mode === 'audit' ? 0 : mode === 'review' ? 1 : 2;
}

function authorityError(requested: MaintenanceMode, source: string, ceiling: MaintenanceMode): AknoError {
  return new AknoError(
    'invalid',
    `mode '${requested}' exceeds ${source} authority '${ceiling}'; lower the run mode or change configuration`,
  );
}
