import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAiLunaPreset, type OpenAiLunaPreflightReport } from '@tenphi/akno-core';
import { initCommand, openAiInitPreview, readableKnowledgeBasePath } from './init-cmd.ts';

afterEach(() => vi.restoreAllMocks());

describe('OpenAI init preview', () => {
  it('is explicit about authority, model count, and the release blocker', () => {
    const config = openAiLunaPreset({
      aknoPath: '/invented/knowledge-base',
      maintenance: 'autonomous',
    });
    const preview = openAiInitPreview('/invented/knowledge-base', 'autonomous', config, failedPreflight());

    expect(preview).toMatchObject({
      preset: 'openai-luna',
      presetStatus: 'experimental',
      writable: false,
      knowledgeBase: { readable: true, willModify: false },
      maintenance: 'autonomous',
      endpointCount: 1,
      modelCount: 2,
      credential: { env: 'AKNO_OPENAI_API_KEY', present: true },
    });
    expect(preview.writeBlocker).toContain('release gate');
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
});

function failedPreflight(): OpenAiLunaPreflightReport {
  return {
    kind: 'openai_luna_preflight',
    preset: 'openai-luna',
    presetStatus: 'experimental',
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
