import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readJsoncFile } from './jsonc.ts';
import { applySetupConfigWrite, planSetupConfigWrite, setupConfigTarget } from './write-setup.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('guided setup config writes', () => {
  it('targets an explicit config before checkout or state locations', () => {
    expect(
      setupConfigTarget({
        env: { AKNO_CONFIG: '/invented/config.json' },
        repoRoot: '/invented/checkout',
        stateDir: '/invented/state',
      }),
    ).toBe('/invented/config.json');
  });

  it('uses an existing installed JSONC file instead of shadowing it', () => {
    const stateDir = inventedDirectory();
    const jsonc = path.join(stateDir, 'config.jsonc');
    fs.writeFileSync(jsonc, '{}\n', 'utf8');

    expect(setupConfigTarget({ env: {}, repoRoot: null, stateDir })).toBe(jsonc);
  });

  it('preserves unrelated and unknown settings while applying a path-only diff', async () => {
    const root = inventedDirectory();
    const target = path.join(root, 'config.json');
    fs.writeFileSync(
      target,
      `${JSON.stringify(
        {
          akno_path: '/invented/old-knowledge-base',
          providers: {
            local: {
              base_url: 'http://127.0.0.1:41111/v1',
              headers: { Authorization: 'invented-secret-value' },
            },
          },
          plugin_extensions: { invented: true },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const plan = planSetupConfigWrite(target, {
      akno_path: '/invented/new-knowledge-base',
      providers: {
        openai: {
          base_url: 'https://api.openai.com/v1',
          api_key: { env: 'AKNO_OPENAI_API_KEY' },
        },
      },
    });

    expect(plan.changes).toEqual([
      { path: 'akno_path', action: 'replace' },
      { path: 'providers.openai', action: 'add' },
    ]);
    expect(JSON.stringify(plan)).not.toContain('invented-secret-value');
    await applySetupConfigWrite(plan);

    expect(readJsoncFile<Record<string, unknown>>(target)).toMatchObject({
      akno_path: '/invented/new-knowledge-base',
      providers: {
        local: {
          base_url: 'http://127.0.0.1:41111/v1',
          headers: { Authorization: 'invented-secret-value' },
        },
        openai: { api_key: { env: 'AKNO_OPENAI_API_KEY' } },
      },
      plugin_extensions: { invented: true },
    });
  });

  it('refuses to overwrite a config edited after its plan was created', async () => {
    const root = inventedDirectory();
    const target = path.join(root, 'config.json');
    fs.writeFileSync(target, '{"akno_path":"/invented/first"}\n', 'utf8');
    const plan = planSetupConfigWrite(target, { akno_path: '/invented/second' });
    fs.writeFileSync(target, '{"akno_path":"/invented/third"}\n', 'utf8');

    await expect(applySetupConfigWrite(plan)).rejects.toThrow('configuration changed');
    expect(fs.readFileSync(target, 'utf8')).toContain('/invented/third');
  });

  it('preserves comments while replacing preset-owned blocks', async () => {
    const root = inventedDirectory();
    const target = path.join(root, 'config.jsonc');
    fs.writeFileSync(
      target,
      `{
  // This extension belongs to an invented host integration.
  "invented_extension": { "enabled": true },
  // The provider block is owned by the selected preset.
  "providers": { "local": { "base_url": "http://127.0.0.1:41111/v1" } },
  "maintenance": {
    // This lowering policy remains user-owned.
    "policies": { "merge": "audit" },
    "profile": "audit",
  },
}
`,
      'utf8',
    );

    const plan = planSetupConfigWrite(
      target,
      {
        providers: {
          openai: {
            base_url: 'https://api.openai.com/v1',
            api_key: { env: 'AKNO_OPENAI_API_KEY' },
          },
        },
        maintenance: { profile: 'autonomous' },
      },
      { replacePaths: ['providers'] },
    );
    await applySetupConfigWrite(plan);

    const written = fs.readFileSync(target, 'utf8');
    expect(written).toContain('This extension belongs to an invented host integration.');
    expect(written).toContain('This lowering policy remains user-owned.');
    expect(readJsoncFile<Record<string, unknown>>(target)).toMatchObject({
      invented_extension: { enabled: true },
      providers: { openai: { api_key: { env: 'AKNO_OPENAI_API_KEY' } } },
      maintenance: { policies: { merge: 'audit' }, profile: 'autonomous' },
    });
  });
});

function inventedDirectory(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-setup-config-'));
  temporary.push(target);
  return target;
}
