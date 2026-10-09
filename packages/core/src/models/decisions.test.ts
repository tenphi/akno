import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelClient } from './client.ts';
import { parseScoreDecisions } from './decisions.ts';
import type { ResolvedModelRole } from '../config/schema.ts';
const questions = [
  { name: 'a', instructions: 'Rate invented evidence.', levels: [{ label: 'No' }, { label: 'Yes' }] },
];
const answer = {
  type: 'score',
  name: 'a',
  score: 0.9,
  confidence: 0.8,
  probabilities: [
    { value: 0, probability: 0.1 },
    { value: 1, probability: 0.9 },
  ],
};
afterEach(() => vi.unstubAllGlobals());
describe('Decisions contract', () => {
  it('rejects missing, duplicate, unknown and inconsistent answers', () => {
    for (const value of [
      [],
      [answer, answer],
      [{ ...answer, name: 'unknown' }],
      [{ ...answer, score: 0.1 }],
      [
        {
          ...answer,
          probabilities: [
            { value: 0, probability: 0.1 },
            { value: 0, probability: 0.9 },
          ],
        },
      ],
      [
        {
          ...answer,
          probabilities: [
            { value: 0, probability: 0.1 },
            { value: 1, probability: 0.1 },
          ],
        },
      ],
    ])
      expect(parseScoreDecisions(value, questions)).toBeNull();
    expect(parseScoreDecisions([answer], questions)?.[0]?.score).toBe(0.9);
  });
  it('uses the dedicated endpoint with usage and telemetry despite unresolved generation transport', async () => {
    const calls: unknown[] = [];
    const role: ResolvedModelRole = {
      role: 'reranker',
      id: 'gpt-6-luna',
      enabled: true,
      requested: true,
      timeoutMs: 1000,
      rerankerMode: 'decisions',
      unavailableReason: null,
      provider: {
        name: 'invented',
        baseUrl: 'https://example.test/v1',
        apiKey: 'invented-key',
        headers: {},
        api: 'auto',
        maxRetries: 0,
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        expect(String(url)).toBe('https://example.test/v1/decisions');
        const body = JSON.parse(init.body);
        expect(body.questions[0].type).toBe('score');
        expect(body.max_output_tokens).toBeUndefined();
        return Response.json({ answers: [answer], usage: { input_tokens: 111 } });
      }),
    );
    const model = new ModelClient(role, (receipt) => calls.push(receipt));
    const result = await model.scoreDecisions('invented evidence', questions);
    expect(result).toMatchObject({
      ok: true,
      endpointRequests: 1,
      usage: { inputTokens: 111, outputTokens: 0, totalTokens: 111 },
    });
    expect(calls).toMatchObject([{ event: 'call', ok: true }]);
  });
  it('reports a failed batch instead of accepting partial evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ answers: [] })),
    );
    const role: ResolvedModelRole = {
      role: 'reranker',
      id: 'gpt-6-luna',
      enabled: true,
      requested: true,
      timeoutMs: 1000,
      rerankerMode: 'decisions',
      unavailableReason: null,
      provider: {
        name: 'invented',
        baseUrl: 'https://example.test/v1',
        apiKey: null,
        headers: {},
        api: 'responses',
        maxRetries: 0,
      },
    };
    expect(await new ModelClient(role).scoreDecisions('invented evidence', questions)).toMatchObject({
      ok: false,
      value: null,
      reason: 'bad_response',
    });
  });
});
