import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import { MODEL_FREE_PRESET, modelFreePreset } from './model-free.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('model-free setup', () => {
  it('explicitly disables every role without adding or deleting provider definitions', () => {
    const aknoPath = inventedKnowledgeBase();
    const preset = modelFreePreset({ aknoPath, maintenance: 'audit' });
    const config = loadConfig({
      isolated: true,
      overrides: {
        providers: { invented: { base_url: 'http://127.0.0.1:41111/v1' } },
        ...preset,
      },
    });

    expect(MODEL_FREE_PRESET).toBe('no-model');
    expect(preset.providers).toBeUndefined();
    expect(Object.values(config.models).every((role) => role.id === null && !role.enabled)).toBe(true);
    expect(config.maintenance.model).toBeNull();
    expect(config.maintenance.profile).toBe('audit');
    expect(config.providers.invented).toBeDefined();
  });
});

function inventedKnowledgeBase(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-model-free-'));
  temporary.push(target);
  return target;
}
