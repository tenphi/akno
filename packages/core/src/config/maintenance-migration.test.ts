import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseJsonc } from './jsonc.ts';
import {
  applyMaintenanceConfigMigration,
  planMaintenanceConfigMigrationFromSources,
} from './maintenance-migration.ts';
import { legacyMaintenanceKeys } from './load.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('maintenance configuration migration', () => {
  it('converts direct legacy writes into complete plan-backed policies', () => {
    const content = `{
  // This unrelated comment survives the maintenance replacement.
  "label": "invented fixture",
  "maintenance": {
    "profile": "custom",
    "observe": { "enabled": true },
    "reflect": { "enabled": false },
    "curate": { "enabled": true, "mode": null, "write": true, "verify": false },
    "adopt": { "enabled": false, "mode": "review" },
    "conflicts": { "resolve": true },
    "repair": { "links": false }
  }
}
`;
    const plan = planMaintenanceConfigMigrationFromSources([{ path: '/fixture/config.jsonc', content }]);

    expect(plan).toMatchObject({
      required: true,
      profile: 'autonomous',
      sourceFiles: 1,
      changedFiles: 1,
      convertedDirectWrites: ['observe', 'hygiene', 'synthesis', 'split', 'extract', 'merge'],
      policies: {
        observe: 'auto',
        reflect: 'off',
        hygiene: 'auto',
        contradiction: 'auto',
        broken_link: 'off',
        adopt: 'off',
      },
    });
    expect(plan.changes[0]!.after).toContain('This unrelated comment survives');
    const migrated = parseJsonc<Record<string, unknown>>(plan.changes[0]!.after);
    expect(legacyMaintenanceKeys(migrated)).toEqual([]);
    expect(migrated.maintenance).toMatchObject({
      profile: 'autonomous',
      policies: plan.policies,
      curate: { verify: false },
    });
  });

  it('materializes named-profile inheritance and removes ignored legacy leaves', () => {
    const content = JSON.stringify({
      maintenance: {
        profile: 'autonomous',
        observe: { enabled: true },
        reflect: { enabled: true },
        curate: { enabled: false, mode: 'audit', write: false },
        adopt: { enabled: false, mode: 'audit' },
      },
    });
    const plan = planMaintenanceConfigMigrationFromSources([{ path: '/fixture/local.jsonc', content }]);

    expect(plan.profile).toBe('autonomous');
    expect(new Set(Object.values(plan.policies!))).toEqual(new Set(['auto']));
    expect(legacyMaintenanceKeys(parseJsonc(plan.changes[0]!.after))).toEqual([]);
  });

  it('keeps a custom allowlist bounded by disabled planners', () => {
    const content = JSON.stringify({
      maintenance: {
        profile: 'custom',
        policies: { observe: 'auto', reflect: 'review', hygiene: 'auto', adopt: 'review' },
        observe: { enabled: false },
        reflect: { enabled: true },
        curate: { enabled: true },
        adopt: { enabled: true },
      },
    });
    const plan = planMaintenanceConfigMigrationFromSources([{ path: '/fixture/local.jsonc', content }]);

    expect(plan.profile).toBe('autonomous');
    expect(plan.policies).toMatchObject({
      observe: 'off',
      reflect: 'review',
      hygiene: 'auto',
      synthesis: 'off',
      adopt: 'review',
    });
  });

  it('stale-checks and atomically replaces a configuration file', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-config-migrate-'));
    temporary.push(root);
    const configPath = path.join(root, 'config.jsonc');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ maintenance: { profile: 'custom', adopt: { enabled: true, mode: 'auto' } } }),
    );
    const plan = planMaintenanceConfigMigrationFromSources([
      { path: configPath, content: fs.readFileSync(configPath, 'utf8') },
    ]);

    await applyMaintenanceConfigMigration(plan);

    const migrated = parseJsonc<Record<string, unknown>>(fs.readFileSync(configPath, 'utf8'));
    expect(legacyMaintenanceKeys(migrated)).toEqual([]);
    expect(migrated.maintenance).toMatchObject({ profile: 'autonomous' });
    expect(fs.readdirSync(root)).toEqual(['config.jsonc']);
  });

  it('does not overwrite configuration changed after inspection', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-config-stale-'));
    temporary.push(root);
    const basePath = path.join(root, 'config.json');
    const localPath = path.join(root, 'local.jsonc');
    const base = JSON.stringify({
      maintenance: { profile: 'custom', curate: { enabled: true } },
    });
    const local = JSON.stringify({ maintenance: { curate: { write: false } } });
    fs.writeFileSync(basePath, base);
    fs.writeFileSync(localPath, local);
    const plan = planMaintenanceConfigMigrationFromSources([
      { path: basePath, content: base },
      { path: localPath, content: local },
    ]);
    const concurrent = `${local}\n// Invented concurrent edit.\n`;
    fs.writeFileSync(localPath, concurrent);

    await expect(applyMaintenanceConfigMigration(plan)).rejects.toMatchObject({ code: 'conflict' });

    expect(fs.readFileSync(basePath, 'utf8')).toBe(base);
    expect(fs.readFileSync(localPath, 'utf8')).toBe(concurrent);
    expect(fs.readdirSync(root).sort()).toEqual(['config.json', 'local.jsonc']);
  });
});
