import { AknoError } from '@tenphi/akno-protocol';
import {
  MAINTENANCE_TRANSFORMS,
  type AknoConfig,
  type MaintenancePolicy,
  type MaintenanceProfile,
  type MaintenanceTransform,
} from '../config/schema.ts';
import type { DreamOptions, DreamPhase } from './dream.ts';
import type { MaintenanceMode } from './plans.ts';

export type MaintenancePhaseAuthority = 'disabled' | 'preview' | 'legacy-write' | MaintenanceMode;
export type EffectiveMaintenancePolicy = MaintenancePolicy | 'legacy-preview' | 'legacy-write';

/** Content-safe explanation of what an unqualified `akno dream` is allowed to do. */
export interface MaintenanceAuthority {
  profile: MaintenanceProfile;
  mode: MaintenanceMode | 'custom';
  automaticKnowledgeBaseWrites: boolean;
  /** Observe and reflect are not plan-backed yet, so review deliberately lowers them to preview. */
  inference: 'preview' | 'write-when-enabled';
  curate: MaintenancePhaseAuthority;
  adopt: MaintenancePhaseAuthority;
  policies: Record<MaintenanceTransform, EffectiveMaintenancePolicy>;
}

export function configuredMaintenanceAuthority(config: AknoConfig): MaintenanceAuthority {
  const mode = profileMode(config.maintenance.profile) ?? 'custom';
  const inference = mode === 'audit' || mode === 'review' ? 'preview' : 'write-when-enabled';
  const inferenceWrites =
    inference === 'write-when-enabled' &&
    (config.maintenance.observe.enabled || config.maintenance.reflect.enabled);
  const policies = Object.fromEntries(
    MAINTENANCE_TRANSFORMS.map((kind) => [kind, configuredTransformPolicy(config, kind)]),
  ) as Record<MaintenanceTransform, EffectiveMaintenancePolicy>;
  const policyMatrix = config.maintenance.profile !== 'custom' || config.maintenance.policiesConfigured;
  const curate = policyMatrix
    ? policyPhaseAuthority(
        config.maintenance.curate.enabled,
        MAINTENANCE_TRANSFORMS.filter((kind) => kind !== 'adopt').map((kind) => policies[kind]),
      )
    : phaseAuthority(
        config.maintenance.curate.enabled,
        config.maintenance.curate.mode,
        config.maintenance.curate.write,
      );
  const adopt = policyMatrix
    ? policyPhaseAuthority(config.maintenance.adopt.enabled, [policies.adopt])
    : phaseAuthority(config.maintenance.adopt.enabled, config.maintenance.adopt.mode, false);
  const planWrites = MAINTENANCE_TRANSFORMS.some((kind) => {
    if (policies[kind] !== 'auto') return false;
    if (kind === 'adopt') return config.maintenance.adopt.enabled;
    if (!config.maintenance.curate.enabled) return false;
    if (kind === 'contradiction') return config.maintenance.conflicts.resolve;
    if (kind === 'broken_link') return config.maintenance.repair.links;
    return true;
  });
  return {
    profile: config.maintenance.profile,
    mode,
    automaticKnowledgeBaseWrites: inferenceWrites || planWrites || curate === 'legacy-write',
    inference,
    curate,
    adopt,
    policies,
  };
}

/** Fully resolved authority for one transformation before a one-run ceiling is applied. */
export function configuredTransformPolicy(
  config: AknoConfig,
  kind: MaintenanceTransform,
): EffectiveMaintenancePolicy {
  const configured = config.maintenance.policies[kind];
  if (configured) return configured;
  if (config.maintenance.policiesConfigured) return 'off';
  if (kind === 'adopt') {
    return config.maintenance.adopt.enabled ? (config.maintenance.adopt.mode ?? 'off') : 'off';
  }
  if (!config.maintenance.curate.enabled) return 'off';
  return (
    config.maintenance.curate.mode ?? (config.maintenance.curate.write ? 'legacy-write' : 'legacy-preview')
  );
}

/** Intersect a class policy with a lower one-run mode. `off` is never promoted. */
export function effectiveTransformPolicy(
  config: AknoConfig,
  kind: MaintenanceTransform,
  runMode?: MaintenanceMode,
): EffectiveMaintenancePolicy {
  const configured = configuredTransformPolicy(config, kind);
  if (!runMode || configured === 'off') return configured;
  if (configured === 'legacy-preview' || configured === 'legacy-write') return runMode;
  return authorityRank(configured) <= authorityRank(runMode) ? configured : runMode;
}

export function policyMode(policy: EffectiveMaintenancePolicy): MaintenanceMode | null {
  return policy === 'audit' || policy === 'review' || policy === 'auto' ? policy : null;
}

/** Highest effective authority among the named classes, for the plan/run envelope. */
export function highestPolicyMode(policies: Iterable<EffectiveMaintenancePolicy>): MaintenanceMode | null {
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
  if (profileCeiling && authorityRank(options.mode) > authorityRank(profileCeiling)) {
    throw authorityError(options.mode, `the ${config.maintenance.profile} profile`, profileCeiling);
  }

  if (config.maintenance.profile !== 'custom') return;
  const phases: DreamPhase[] = options.phase ? [options.phase] : ['curate', 'adopt'];
  for (const phase of phases) {
    const enabled =
      phase === 'curate'
        ? config.maintenance.curate.enabled
        : phase === 'adopt'
          ? config.maintenance.adopt.enabled
          : false;
    if (!enabled) continue;
    const configured =
      phase === 'curate'
        ? config.maintenance.curate.mode
        : phase === 'adopt'
          ? config.maintenance.adopt.mode
          : null;
    if (configured && authorityRank(options.mode) > authorityRank(configured)) {
      throw authorityError(options.mode, `configured ${phase} mode`, configured);
    }
  }
}

/** Legacy inference phases preview whenever the run or profile cannot authorize an immediate write. */
export function inferenceDryRun(config: AknoConfig, options: DreamOptions): boolean {
  if (options.dryRun) return true;
  const runMode = options.mode ?? profileMode(config.maintenance.profile);
  return runMode === 'audit' || runMode === 'review';
}

export function profileMode(profile: MaintenanceProfile): MaintenanceMode | null {
  if (profile === 'audit' || profile === 'review') return profile;
  if (profile === 'autonomous') return 'auto';
  return null;
}

function phaseAuthority(
  enabled: boolean,
  mode: MaintenanceMode | null,
  legacyWrite: boolean,
): MaintenancePhaseAuthority {
  if (!enabled) return 'disabled';
  if (mode) return mode;
  return legacyWrite ? 'legacy-write' : 'preview';
}

function policyPhaseAuthority(
  enabled: boolean,
  policies: Iterable<EffectiveMaintenancePolicy>,
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
