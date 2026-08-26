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
  it('rejects the removed compatibility profile before unknown keys can be stripped', () => {
    let error: unknown;
    try {
      fixtureConfig({ profile: 'custom' } as never);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: 'invalid',
      details: { reason: 'removed_configuration', keys: ['maintenance.profile=custom'] },
    });
    expect((error as Error).message).toContain('configure maintenance.profile and maintenance.policies');
    expect((error as Error).message).not.toContain('migrat');
  });

  it.each([
    ['curate enabled', { profile: 'audit', curate: { enabled: false } }],
    ['curate mode', { profile: 'audit', curate: { mode: 'audit' } }],
    ['curate write', { profile: 'audit', curate: { write: false } }],
    ['adopt enabled', { profile: 'audit', adopt: { enabled: false } }],
    ['adopt mode', { profile: 'audit', adopt: { mode: 'audit' } }],
  ])('rejects removed %s authority instead of silently stripping it', (_label, maintenance) => {
    expect(() => fixtureConfig(maintenance as never)).toThrow('uses removed maintenance configuration');
  });

  it.each([
    ['audit', 'audit', false],
    ['review', 'review', false],
    ['autonomous', 'auto', true],
  ] as const)('expands %s across every plan-backed phase', (profile, mode, automaticWrites) => {
    const config = fixtureConfig({
      profile,
      conflicts: { enabled: false, resolve: false },
      repair: { links: false },
    });

    expect(config.maintenance).toMatchObject({
      profile,
      conflicts: { enabled: false, resolve: false },
      repair: { links: false },
    });
    expect(configuredMaintenanceAuthority(config)).toMatchObject({
      profile,
      mode,
      automaticKnowledgeBaseWrites: automaticWrites,
      inference: profile === 'autonomous' ? 'write-when-enabled' : 'preview',
      observe: 'disabled',
      reflect: 'disabled',
      curate: mode,
      adopt: mode,
    });
  });

  it('plans enabled inference phases under named profiles and permits a lower one-run ceiling', () => {
    const review = fixtureConfig({
      profile: 'review',
      observe: { enabled: true },
      reflect: { enabled: true },
    });
    const autonomous = fixtureConfig({
      profile: 'autonomous',
      observe: { enabled: true },
      reflect: { enabled: true },
    });

    expect(inferenceDryRun(review, {})).toBe(true);
    expect(inferenceDryRun(autonomous, {})).toBe(false);
    expect(inferenceDryRun(autonomous, { mode: 'audit' })).toBe(true);
    expect(configuredMaintenanceAuthority(review).observe).toBe('review');
    expect(configuredMaintenanceAuthority(review).reflect).toBe('review');
    expect(configuredMaintenanceAuthority(autonomous).observe).toBe('auto');
    expect(configuredMaintenanceAuthority(autonomous).reflect).toBe('auto');
    expect(effectiveTransformPolicy(autonomous, 'observe', 'audit')).toBe('audit');
    expect(effectiveTransformPolicy(autonomous, 'reflect', 'audit')).toBe('audit');
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

  it('lets explicit off policies disable planners without a second authority switch', () => {
    const config = fixtureConfig({
      profile: 'autonomous',
      policies: {
        observe: 'off',
        reflect: 'off',
        hygiene: 'off',
        managed_item: 'off',
        synthesis: 'off',
        split: 'off',
        extract: 'off',
        merge: 'off',
        contradiction: 'off',
        broken_link: 'off',
        adopt: 'off',
      },
      observe: { enabled: true },
      reflect: { enabled: true },
    });

    expect(configuredMaintenanceAuthority(config)).toMatchObject({
      curate: 'disabled',
      reflect: 'disabled',
      adopt: 'disabled',
      automaticKnowledgeBaseWrites: false,
    });
    expect(effectiveTransformPolicy(config, 'hygiene', 'audit')).toBe('off');
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
