import { AknoError } from '@tenphi/akno-protocol';
import type { AknoConfig, MaintenanceProfile } from '../config/schema.ts';
import type { DreamOptions, DreamPhase } from './dream.ts';
import type { MaintenanceMode } from './plans.ts';

export type MaintenancePhaseAuthority = 'disabled' | 'preview' | 'legacy-write' | MaintenanceMode;

/** Content-safe explanation of what an unqualified `akno dream` is allowed to do. */
export interface MaintenanceAuthority {
  profile: MaintenanceProfile;
  mode: MaintenanceMode | 'custom';
  automaticKnowledgeBaseWrites: boolean;
  /** Observe and reflect are not plan-backed yet, so review deliberately lowers them to preview. */
  inference: 'preview' | 'write-when-enabled';
  curate: MaintenancePhaseAuthority;
  adopt: MaintenancePhaseAuthority;
}

export function configuredMaintenanceAuthority(config: AknoConfig): MaintenanceAuthority {
  const mode = profileMode(config.maintenance.profile) ?? 'custom';
  const inference = mode === 'audit' || mode === 'review' ? 'preview' : 'write-when-enabled';
  const curate = phaseAuthority(
    config.maintenance.curate.enabled,
    config.maintenance.curate.mode,
    config.maintenance.curate.write,
  );
  const adopt = phaseAuthority(config.maintenance.adopt.enabled, config.maintenance.adopt.mode, false);
  const inferenceWrites =
    inference === 'write-when-enabled' &&
    (config.maintenance.observe.enabled || config.maintenance.reflect.enabled);
  return {
    profile: config.maintenance.profile,
    mode,
    automaticKnowledgeBaseWrites:
      inferenceWrites || curate === 'auto' || curate === 'legacy-write' || adopt === 'auto',
    inference,
    curate,
    adopt,
  };
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

function authorityRank(mode: MaintenanceMode): number {
  return mode === 'audit' ? 0 : mode === 'review' ? 1 : 2;
}

function authorityError(requested: MaintenanceMode, source: string, ceiling: MaintenanceMode): AknoError {
  return new AknoError(
    'invalid',
    `mode '${requested}' exceeds ${source} authority '${ceiling}'; lower the run mode or change configuration`,
  );
}
