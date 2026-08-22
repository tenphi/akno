import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import type { ConfigDoc } from '../config/schema.ts';
import { assertMaintenanceModeAllowed, configuredMaintenanceAuthority, inferenceDryRun } from './profile.ts';

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
