import http from 'node:http';
import { describe, expect, it } from 'vitest';
import type { AknoConfig, ResolvedModelRole } from '../config/schema.ts';
import { runRankingEndToEnd } from './ranking-end-to-end.ts';

describe('end-to-end ranking benchmark', () => {
  it('fails closed after indexing when the selected embedding role is unavailable', async () => {
    const report = await runRankingEndToEnd(unavailableConfig(), {
      system: 'fusion',
      candidateCount: 10,
      concurrency: 4,
    });

    expect(report.schemaVersion).toBe('ranking-end-to-end-v4');
    expect(report).toMatchObject({
      retrievalPoolCount: 10,
      candidateSelectionVersion: 'fusion-semantic-tail-v1',
    });
    expect(report.corpus).toMatchObject({ queries: 60, sources: 120, categories: 8 });
    expect(report.embedding.available).toBe(false);
    expect(report.embedding).toMatchObject({ dimensions: 32, totalChunks: 120, embeddedChunks: 0 });
    expect(report.passed).toBe(false);
    expect(report.candidateGeneration.degradedQueries).toBe(60);
    expect(report.candidateGeneration.unavailableQueries).toBe(60);
    expect(report.fusionPool).toEqual(report.candidateGeneration);
    expect(report.rankedRecall).toEqual(report.candidateGeneration);
    expect(report.queries).toHaveLength(60);
    expect(report.queries.every((query) => query.candidateOrder.length === 0)).toBe(true);
    expect(report.queries.every((query) => query.rankedOrder.length === 0)).toBe(true);
    expect(report.queries[0]).not.toHaveProperty('query');
    expect(report.queries[0]).not.toHaveProperty('text');
  });

  it('measures candidate recall after the selected embedding role indexes every chunk', async () => {
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { input: string[] };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            data: body.input.map((text, index) => ({
              index,
              embedding: inventedEmbedding(text),
            })),
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    try {
      const report = await runRankingEndToEnd(embeddingConfig(`http://127.0.0.1:${port}/v1`), {
        system: 'fusion',
        candidateCount: 10,
        concurrency: 4,
      });

      expect(report.embedding).toMatchObject({
        provider: 'invented-provider',
        model: 'invented-embedding-model',
        dimensions: 32,
        available: true,
        totalChunks: 120,
        embeddedChunks: 120,
      });
      expect(report.candidateGeneration.degradedQueries).toBe(0);
      expect(report.fusionPool).toEqual(report.candidateGeneration);
      const misses = report.queries
        .filter((query) => query.candidateRank === null)
        .map((query) => query.queryId);
      expect(
        report.candidateGeneration.directAnswerRecall,
        `candidate misses: ${misses.join(', ')}`,
      ).toBeGreaterThanOrEqual(0.9);
      expect(report.rankedRecall).toEqual(report.candidateGeneration);
      expect(report.queries.some((query) => query.candidateOrder.length > 0)).toBe(true);
      expect(
        report.queries.find((query) => query.queryId === 'blackwater-meeting-place-direct_answer-05'),
      ).toMatchObject({
        directAnswerIds: ['blackwater-meeting-date-direct', 'blackwater-meeting-place-direct'],
      });
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });
});

function inventedEmbedding(text: string): number[] {
  const embedding = Array.from({ length: 32 }, () => 0);
  for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let hash = 2166136261;
    for (const character of token) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    embedding[(hash >>> 0) % embedding.length]! += 1;
  }
  return embedding;
}

function embeddingConfig(baseUrl: string): AknoConfig {
  const config = unavailableConfig();
  const provider = {
    name: 'invented-provider',
    baseUrl,
    apiKey: null,
    headers: {},
    maxRetries: 0,
  };
  config.providers = { 'invented-provider': provider };
  config.models.embedding = {
    role: 'embedding',
    provider,
    id: 'invented-embedding-model',
    enabled: true,
    requested: true,
    timeoutMs: 1111,
    unavailableReason: null,
    dimensions: 32,
    batch: 8,
  };
  return config;
}

function unavailableConfig(): AknoConfig {
  const role = (name: ResolvedModelRole['role']): ResolvedModelRole => ({
    role: name,
    provider: null,
    id: null,
    enabled: false,
    requested: false,
    timeoutMs: 1111,
    unavailableReason: 'invented unavailable role',
  });
  return {
    providers: {},
    models: {
      embedding: { ...role('embedding'), dimensions: 32, batch: 8 },
      reranker: role('reranker'),
      derive: role('derive'),
      expansion: role('expansion'),
      vision: role('vision'),
    },
  } as AknoConfig;
}
