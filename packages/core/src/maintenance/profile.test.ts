import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import type { ConfigDoc } from '../config/schema.ts';
import {
  assertMaintenanceModeAllowed,
  configuredMaintenanceAuthority,
  effectiveTransformPolicy,
  inferenceDryRun,
} from './profile.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('maintenance profiles', () => {
  it('preserves phase-level behavior under the compatibility profile', () => {
    const config = fixtureConfig({
      profile: 'custom',
      curate: { enabled: true, mode: null, write: true },
      adopt: { enabled: false, mode: 'review' },
      conflicts: { enabled: false, resolve: false },
      repair: { links: false },
    });

    expect(config.maintenance).toMatchObject({
      profile: 'custom',
      curate: { enabled: true, mode: null, write: true },
      adopt: { enabled: false, mode: 'review' },
      conflicts: { enabled: false, resolve: false },
      repair: { links: false },
    });
    expect(configuredMaintenanceAuthority(config)).toMatchObject({
      profile: 'custom',
      mode: 'custom',
      curate: 'legacy-write',
      adopt: 'disabled',
    });
  });

  it.each([
    ['audit', 'audit', false],
    ['review', 'review', false],
    ['autonomous', 'auto', true],
  ] as const)('expands %s across every plan-backed phase', (profile, mode, automaticWrites) => {
    const config = fixtureConfig({
      profile,
      curate: { enabled: false, mode: null },
      adopt: { enabled: false, mode: null },
      conflicts: { enabled: false, resolve: false },
      repair: { links: false },
    });

    expect(config.maintenance).toMatchObject({
      profile,
      curate: { enabled: true, mode },
      adopt: { enabled: true, mode },
      conflicts: { enabled: true, resolve: true },
      repair: { links: true },
    });
    expect(configuredMaintenanceAuthority(config)).toMatchObject({
      profile,
      mode,
      automaticKnowledgeBaseWrites: automaticWrites,
      inference: profile === 'autonomous' ? 'write-when-enabled' : 'preview',
      curate: mode,
      adopt: mode,
    });
  });

  it('previews legacy inference in review and accepts a lower one-run mode in autonomous', () => {
    const review = fixtureConfig({ profile: 'review', observe: { enabled: true } });
    const autonomous = fixtureConfig({ profile: 'autonomous', observe: { enabled: true } });

    expect(inferenceDryRun(review, {})).toBe(true);
    expect(inferenceDryRun(autonomous, {})).toBe(false);
    expect(inferenceDryRun(autonomous, { mode: 'audit' })).toBe(true);
    expect(() => assertMaintenanceModeAllowed(autonomous, { mode: 'audit' })).not.toThrow();
    expect(() => assertMaintenanceModeAllowed(review, { mode: 'auto' })).toThrow(
      "mode 'auto' exceeds the review profile authority 'review'",
    );
  });

  it('resolves named-profile overrides without allowing a policy to exceed its ceiling', () => {
    const autonomous = fixtureConfig({
      profile: 'autonomous',
      policies: { merge: 'review', broken_link: 'off' },
    });
    const review = fixtureConfig({ profile: 'review', policies: { hygiene: 'auto' } });

    expect(autonomous.maintenance.policies).toMatchObject({
      hygiene: 'auto',
      merge: 'review',
      broken_link: 'off',
      adopt: 'auto',
    });
    expect(configuredMaintenanceAuthority(autonomous).policies).toMatchObject({
      hygiene: 'auto',
      merge: 'review',
      broken_link: 'off',
    });
    expect(review.maintenance.policies.hygiene).toBe('review');
  });

  it('treats an explicit custom policy map as an allowlist and lowers it for one run', () => {
    const config = fixtureConfig({
      profile: 'custom',
      policies: { hygiene: 'auto', merge: 'review' },
      curate: { enabled: true },
    });

    expect(configuredMaintenanceAuthority(config)).toMatchObject({
      curate: 'auto',
      adopt: 'disabled',
      policies: {
        hygiene: 'auto',
        merge: 'review',
        synthesis: 'off',
        broken_link: 'off',
        adopt: 'off',
      },
    });
    expect(effectiveTransformPolicy(config, 'hygiene', 'audit')).toBe('audit');
    expect(effectiveTransformPolicy(config, 'merge', 'auto')).toBe('review');
    expect(effectiveTransformPolicy(config, 'synthesis', 'auto')).toBe('off');
  });

  it('does not report automatic writes when a custom policy names a disabled planner', () => {
    const config = fixtureConfig({
      profile: 'custom',
      policies: { hygiene: 'auto', adopt: 'auto' },
      curate: { enabled: false },
      adopt: { enabled: false },
    });

    expect(configuredMaintenanceAuthority(config).automaticKnowledgeBaseWrites).toBe(false);
  });

  it('resolves whole-run limits, including an explicit zero high-risk allowance', () => {
    const defaults = fixtureConfig({ profile: 'autonomous' });
    const bounded = fixtureConfig({
      profile: 'autonomous',
      limits: {
        max_items: 5,
        max_files_changed: 7,
        max_bytes_written: 1111,
        max_high_risk_items: 0,
      },
    });

    expect(defaults.maintenance.limits).toEqual({
      maxItems: 30,
      maxFilesChanged: 40,
      maxBytesWritten: 500_000,
      maxHighRiskItems: 3,
    });
    expect(configuredMaintenanceAuthority(bounded).limits).toEqual({
      maxItems: 5,
      maxFilesChanged: 7,
      maxBytesWritten: 1111,
      maxHighRiskItems: 0,
    });
  });
});

function fixtureConfig(maintenance: NonNullable<ConfigDoc['maintenance']>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-profile-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-profile-state-'));
  temporary.push(root, stateDir);
  return loadConfig({
    isolated: true,
    env: {},
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      maintenance,
    },
  });
}
