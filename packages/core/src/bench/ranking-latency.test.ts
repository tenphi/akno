import http from 'node:http';
import { describe, expect, it } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import { refreshRankingLatencyReport, runRankingLatencyBench } from './ranking-latency.ts';

describe('ranking latency profiles', () => {
  it('separates the fresh-client receipt from warm single-flight and loaded calls', async () => {
    const instance = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          messages: Array<{ content: string }>;
        };
        const prompt = JSON.parse(body.messages.at(-1)!.content) as {
          candidates: Array<{ candidate_id: string }>;
        };
        const judgments = Object.fromEntries(
          prompt.candidates.map((candidate, index) => [candidate.candidate_id, [0, index + 1]]),
        );
        setTimeout(() => {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              choices: [{ message: { content: JSON.stringify({ j: judgments }) } }],
              usage: { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
            }),
          );
        }, 1);
      });
    });
    await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const { port } = instance.address() as { port: number };

    try {
      const config = {
        providers: {
          invented: {
            name: 'invented',
            baseUrl: `http://127.0.0.1:${port}/v1`,
            apiKey: null,
            headers: {},
            maxRetries: 0,
          },
        },
        models: {},
      } as unknown as AknoConfig;
      const report = await runRankingLatencyBench(config, {
        candidateCount: 10,
        excerptChars: 800,
        loadConcurrency: 3,
        provider: 'invented',
        model: 'invented-model',
        reasoningEffort: 'none',
      });

      expect(report.schemaVersion).toBe('ranking-latency-v1');
      expect(report.interactive).toMatchObject({
        concurrency: 1,
        cold: { samples: 1, validResponseRate: 1, endpointRequests: 1 },
        warm: {
          samples: 59,
          validResponseRate: 1,
          fallbackCount: 0,
          endpointRequests: 59,
          extraEndpointRequests: 0,
        },
      });
      expect(report.loaded).toMatchObject({
        concurrency: 3,
        cold: { samples: 1, validResponseRate: 1, endpointRequests: 1 },
        warm: {
          samples: 59,
          validResponseRate: 1,
          fallbackCount: 0,
          endpointRequests: 59,
          extraEndpointRequests: 0,
        },
      });
      expect(report.interactive.warm.tokenUsage).toMatchObject({
        reportedQueries: 59,
        inputTokens: 6_549,
        outputTokens: 1_298,
      });
      expect(report.passed).toBe(true);
      expect(report.blockers).toEqual([]);

      const stricterStoredContract = refreshRankingLatencyReport({
        ...report,
        thresholds: { interactiveP95LatencyMs: 0 },
      });
      expect(stricterStoredContract.thresholds.interactiveP95LatencyMs).toBe(0);
      expect(stricterStoredContract.blockers).toContain('interactive_latency');
    } finally {
      instance.close();
      instance.closeAllConnections();
    }
  });
});
