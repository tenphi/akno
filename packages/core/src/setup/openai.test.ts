import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import {
  OPENAI_LUNA_EMBEDDING_DIMENSIONS,
  openAiLunaPreset,
  preflightOpenAiLuna,
  setupPreflightError,
} from './openai.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('recommended OpenAI minimum setup', () => {
  it('keeps one endpoint, two model ids, and task-specific reasoning explicit', () => {
    const preset = openAiLunaPreset({
      aknoPath: '/invented/knowledge-base',
      maintenance: 'autonomous',
    });

    expect(Object.keys(preset.providers ?? {})).toEqual(['openai']);
    expect(preset.providers?.openai?.api_key).toEqual({ env: 'AKNO_OPENAI_API_KEY' });
    expect(preset.providers?.openai?.api).toBe('responses');
    expect(preset.models).toMatchObject({
      embedding: {
        provider: 'openai',
        id: 'text-embedding-3-small',
        dimensions: OPENAI_LUNA_EMBEDDING_DIMENSIONS,
      },
      reranker: {
        provider: 'openai',
        id: 'gpt-6-luna',
        mode: 'decisions',
        max_output_tokens: 256,
        reasoning_effort: 'none',
      },
      expansion: { provider: 'openai', id: 'gpt-6-luna', reasoning_effort: 'none' },
      derive: { provider: 'openai', id: 'gpt-6-luna', reasoning_effort: 'low' },
      answer: { provider: 'openai', id: 'gpt-6-luna', reasoning_effort: 'low' },
    });
    expect(preset.maintenance).toMatchObject({
      profile: 'autonomous',
      model: { provider: 'openai', id: 'gpt-6-luna', reasoning_effort: 'medium' },
    });
    expect(JSON.stringify(preset)).not.toContain('sk-');
  });

  it('reports a missing credential without making a request', async () => {
    const root = inventedKnowledgeBase();
    const preset = openAiLunaPreset({ aknoPath: root, maintenance: 'audit' });
    const config = loadConfig({
      isolated: true,
      env: { AKNO_OPENAI_API_KEY: '' },
      overrides: preset,
    });

    const report = await preflightOpenAiLuna(config);

    expect(report).toMatchObject({
      passed: false,
      credentialPresent: false,
      embedding: { status: 'unavailable' },
      generative: { status: 'unavailable' },
    });
    expect(JSON.stringify(report)).not.toContain('undefined');
  });

  it('inherits the derive endpoint for answer when an existing setup has no answer override', () => {
    const root = inventedKnowledgeBase();
    const config = loadConfig({
      isolated: true,
      overrides: {
        akno_path: root,
        providers: { invented: { base_url: 'http://127.0.0.1:41111/v1' } },
        models: { derive: { provider: 'invented', id: 'invented-generative-model' } },
      },
    });

    expect(config.models.answer).toMatchObject({
      role: 'answer',
      id: 'invented-generative-model',
      enabled: true,
      provider: { name: 'invented' },
    });
  });

  it('reduces an access denial to one content-safe diagnostic', () => {
    const error = setupPreflightError(
      'embedding endpoint returned 403: {"error":{"message":"Project proj_inventedfixture123 does not have access to model `text-embedding-3-small`"}}',
    );

    expect(error).toBe(
      'embedding endpoint returned 403: configured project does not have access to model text-embedding-3-small',
    );
    expect(error).not.toContain('proj_inventedfixture123');
    expect(error).not.toContain('{');
  });

  it('checks embedding dimensions and the invented ranking contract through one provider', async () => {
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          input?: string[] | { content: string }[];
        };
        response.writeHead(200, { 'content-type': 'application/json' });
        if (request.url?.endsWith('/embeddings')) {
          response.end(
            JSON.stringify({
              data: [{ index: 0, embedding: Array(OPENAI_LUNA_EMBEDDING_DIMENSIONS).fill(0.111) }],
            }),
          );
          return;
        }
        if (request.url?.endsWith('/responses')) {
          response.end(JSON.stringify({ output_text: 'ok' }));
          return;
        }
        const candidates = JSON.parse(body.input as unknown as string).candidates as { id: string }[];
        response.end(
          JSON.stringify({
            answers: candidates.map((candidate, index) => ({
              type: 'score',
              name: candidate.id,
              score: [3, 1, 0][index],
              confidence: 1,
              probabilities: [0, 1, 2, 3].map((value) => ({
                value,
                probability: value === [3, 1, 0][index] ? 1 : 0,
              })),
            })),
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    try {
      const root = inventedKnowledgeBase();
      const preset = openAiLunaPreset({ aknoPath: root, maintenance: 'review' });
      preset.providers!.openai!.base_url = `http://127.0.0.1:${port}/v1`;
      const config = loadConfig({
        isolated: true,
        env: { AKNO_OPENAI_API_KEY: 'sk-invented-fixture-key' },
        overrides: preset,
      });

      const report = await preflightOpenAiLuna(config);

      expect(report).toMatchObject({
        passed: true,
        credentialPresent: true,
        embedding: { status: 'ok', dimensions: OPENAI_LUNA_EMBEDDING_DIMENSIONS },
        generative: {
          status: 'ok',
          promptVersion: 'akno-decisions-relevance-v2',
          schemaVersion: 'decisions-score-distribution-v1',
        },
      });
      expect(JSON.stringify(report)).not.toContain('sk-invented-fixture-key');
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });
});

function inventedKnowledgeBase(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-openai-setup-'));
  temporary.push(root);
  return root;
}
