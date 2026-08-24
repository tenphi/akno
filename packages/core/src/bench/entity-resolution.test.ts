import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import { runEntityResolutionBench } from './entity-resolution.ts';

afterEach(() => vi.unstubAllGlobals());

describe('entity-resolution benchmark', () => {
  it('gates clear selection and conservative abstention without opening a knowledge base', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body)) as {
        messages: { role: string; content: string }[];
      };
      const input = JSON.parse(request.messages.at(-1)!.content) as {
        source: { context: string };
        candidates: { candidate_id: string; label: string; slug: string }[];
      };
      let selectedSlug: string | null = null;
      if (input.source.context.includes('works with Vulpine Mutual')) selectedSlug = 'people/ada-marlow';
      if (input.source.context.includes('model QX-100')) selectedSlug = 'products/zephyr-qx-100';
      if (input.source.context.includes('organization Vulpine')) {
        selectedSlug = 'organizations/vulpine-mutual';
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  order: input.candidates.map((candidate) => ({
                    id: candidate.candidate_id,
                    grade: candidate.slug === selectedSlug ? 3 : selectedSlug ? 0 : 1,
                  })),
                  rationale: selectedSlug ? 'distinguishing_evidence' : 'insufficient',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const provider = {
      name: 'openai',
      baseUrl: 'https://invented.invalid/v1',
      apiKey: null,
      headers: {},
      maxRetries: 0,
    };
    const config = {
      providers: { openai: provider },
      models: {
        derive: {
          role: 'derive',
          provider,
          id: 'fixture-model',
          enabled: true,
          requested: true,
          timeoutMs: 1000,
          reasoningEffort: 'none',
          unavailableReason: null,
        },
      },
    } as unknown as AknoConfig;

    const report = await runEntityResolutionBench(config);

    expect(report.passed).toBe(true);
    expect(report.cases).toHaveLength(8);
    expect(report.metrics).toEqual({
      validResponseRate: 1,
      clearRecall: 1,
      selectionPrecision: 1,
      indistinguishableAbstention: 1,
      adversarialAbstention: 1,
      expectedOutcomeAccuracy: 1,
    });
  });
});
