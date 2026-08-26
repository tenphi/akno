import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigDoc } from './schema.ts';
import { loadConfig } from './load.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('provider generative transport', () => {
  it('keeps existing OpenAI-compatible providers on Chat Completions', () => {
    const config = configWithProvider({ base_url: 'http://127.0.0.1:41111/v1' });

    expect(config.providers.invented?.api).toBe('chat_completions');
  });

  it('resolves an explicit Responses provider without changing its dedicated endpoints', () => {
    const config = configWithProvider({
      base_url: 'https://models.example.test/v1',
      api: 'responses',
    });

    expect(config.providers.invented).toMatchObject({
      baseUrl: 'https://models.example.test/v1',
      api: 'responses',
    });
    expect(config.models.embedding.provider).toBe(config.providers.invented);
  });

  it('rejects an unknown transport instead of guessing at runtime', () => {
    expect(
      ConfigDoc.safeParse({
        providers: { invented: { base_url: 'https://models.example.test/v1', api: 'invented_api' } },
      }).success,
    ).toBe(false);
  });
});

function configWithProvider(provider: { base_url: string; api?: 'chat_completions' | 'responses' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-provider-api-'));
  temporary.push(root);
  return loadConfig({
    isolated: true,
    overrides: {
      akno_path: root,
      providers: { invented: provider },
      models: { embedding: { provider: 'invented', id: 'invented-embedding-model' } },
    },
  });
}
