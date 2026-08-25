import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAiLunaPreset, type OpenAiLunaPreflightReport } from '@tenphi/akno-core';
import { initCommand, openAiInitPreview, readableKnowledgeBasePath } from './init-cmd.ts';

const temporary: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('OpenAI init', () => {
  it('is explicit about authority, model count, and preflight failure', () => {
    const config = openAiLunaPreset({
      aknoPath: '/invented/knowledge-base',
      maintenance: 'autonomous',
    });
    const preview = openAiInitPreview('/invented/knowledge-base', 'autonomous', config, failedPreflight());

    expect(preview).toMatchObject({
      preset: 'openai-luna',
      presetStatus: 'recommended',
      writable: true,
      writeBlocker: 'the requested model preflight did not pass',
      knowledgeBase: { readable: true, willModify: false },
      maintenance: 'autonomous',
      endpointCount: 1,
      modelCount: 2,
      credential: { env: 'AKNO_OPENAI_API_KEY', present: true },
    });
    expect(JSON.stringify(preview)).not.toContain('sk-invented-fixture-key');
  });

  it('rejects a missing knowledge-base folder without throwing', () => {
    expect(readableKnowledgeBasePath('/invented/missing-knowledge-base')).toBe(false);
  });

  it('reports an invalid knowledge-base folder as a usage error', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = await initCommand([
      '--preset',
      'openai-luna',
      '--akno-path',
      '/invented/missing-knowledge-base',
      '--dry-run',
    ]);

    expect(result).toBe(2);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('akno_path does not exist: /invented/missing-knowledge-base'),
    );
  });

  it('creates a new machine config without requiring force', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'state', 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await initCommand([
      '--preset',
      'openai-luna',
      '--akno-path',
      knowledgeBase,
      '--maintenance',
      'autonomous',
    ]);

    expect(result).toBe(0);
    expect(fs.statSync(target).mode & 0o777).toBe(0o600);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toMatchObject({
      akno_path: knowledgeBase,
      models: {
        embedding: { id: 'text-embedding-3-small' },
        reranker: { id: 'gpt-5.6-luna', top_k: 10, reasoning_effort: 'none' },
      },
      maintenance: { profile: 'autonomous' },
    });
  });

  it('requires force for an existing config and preserves unrelated keys', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    const original = `${JSON.stringify(
      {
        akno_path: knowledgeBase,
        providers: { local: { base_url: 'http://127.0.0.1:41111/v1' } },
        models: { reranker: { id: 'invented-native-reranker', mode: 'endpoint' } },
        maintenance: { policies: { merge: 'audit' } },
        invented_extension: { keep: true },
      },
      null,
      2,
    )}\n`;
    fs.writeFileSync(target, original, 'utf8');
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const argv = ['--preset', 'openai-luna', '--akno-path', knowledgeBase, '--maintenance', 'review'];

    expect(await initCommand(argv)).toBe(2);
    expect(fs.readFileSync(target, 'utf8')).toBe(original);
    expect(await initCommand([...argv, '--force'])).toBe(0);
    const written = JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, unknown>;
    expect(written).toMatchObject({
      invented_extension: { keep: true },
      providers: { openai: { base_url: 'https://api.openai.com/v1' } },
      models: { reranker: { id: 'gpt-5.6-luna', mode: 'llm' } },
      maintenance: { profile: 'review', policies: { merge: 'audit' } },
    });
    expect(Object.keys(written.providers as Record<string, unknown>)).toEqual(['openai']);
  });

  it('does not write when a requested preflight fails', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.stubEnv('AKNO_OPENAI_API_KEY', '');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = await initCommand(['--preset', 'openai-luna', '--akno-path', knowledgeBase, '--check']);

    expect(result).toBe(1);
    expect(fs.existsSync(target)).toBe(false);
  });
});

function failedPreflight(): OpenAiLunaPreflightReport {
  return {
    kind: 'openai_luna_preflight',
    preset: 'openai-luna',
    presetStatus: 'recommended',
    passed: false,
    credentialPresent: true,
    embedding: {
      status: 'failed',
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: null,
      error: 'embedding endpoint returned 403',
    },
    generative: {
      status: 'ok',
      provider: 'openai',
      model: 'gpt-5.6-luna',
      promptVersion: 'invented-prompt-v1',
      schemaVersion: 'invented-schema-v1',
      latencyMs: 111,
      error: null,
    },
  };
}

function inventedDirectory(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-init-command-'));
  temporary.push(target);
  return target;
}
