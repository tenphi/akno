import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AknoConfig, ResolvedModelRole } from '../config/schema.ts';
import { runAnswerBench } from './answer.ts';

afterEach(() => vi.unstubAllGlobals());

describe('grounded-answer benchmark', () => {
  it('runs invented evidence through production generation and verification without content in its report', async () => {
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAnswerBench(config(), { concurrency: 3 });
    expect(
      report.cases
        .filter((benchCase) => !benchCase.passed)
        .map((benchCase) => ({
          id: benchCase.id,
          status: benchCase.status,
          outcome: benchCase.outcome,
          degraded: benchCase.degraded,
          facts: `${benchCase.supportedFacts}/${benchCase.requiredFacts}`,
          cited: benchCase.citedSources,
          related: benchCase.relatedSources,
        })),
    ).toEqual([]);

    expect(report).toMatchObject({
      kind: 'invented_answer_benchmark',
      schemaVersion: 'answer-benchmark-v2',
      development: true,
      releaseEligible: false,
      passed: true,
      corpus: { cases: 12, sources: 15, categories: 12, independentlyReviewed: false },
      embedding: { available: true, totalChunks: 15, embeddedChunks: 15 },
      answerModel: {
        available: true,
        generationPromptVersion: 'answer-generation-v1',
        verifierPromptVersion: 'answer-verifier-v1',
      },
      metrics: {
        executionRate: 1,
        outcomeAccuracy: 1,
        expectedFactAccuracy: 1,
        citationPrecision: 1,
        citationRecall: 1,
        retrievalRecall: 1,
        abstentionAccuracy: 1,
        privacyLeakRate: 0,
        degradedRate: 0,
        verificationFailureRate: 0,
        mixedRetrievalPassed: true,
      },
      execution: {
        modelCalls: expect.any(Number),
        usageReportedCalls: expect.any(Number),
        providerInputTokens: expect.any(Number),
        providerOutputTokens: expect.any(Number),
        providerTotalTokens: expect.any(Number),
      },
      blockers: [],
    });
    expect(report.execution.modelCalls).toBeGreaterThan(0);
    expect(report.execution.usageReportedCalls).toBe(report.execution.modelCalls);
    expect(report.execution.providerTotalTokens).toBe(
      report.execution.providerInputTokens + report.execution.providerOutputTokens,
    );
    expect(report.cases.every((benchCase) => benchCase.passed)).toBe(true);
    expect(report.releaseBlockers).toEqual(['independent_review', 'held_out_run']);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('silverpine-direct');
    expect(serialized).not.toContain('violet-gull');
    expect(serialized).not.toContain('five-year warranty');
  });

  it('fails closed without issuing answer cases when the embedding prerequisite is unavailable', async () => {
    const unavailable = config();
    unavailable.models.embedding = {
      ...unavailable.models.embedding,
      provider: null,
      id: null,
      enabled: false,
      unavailableReason: 'invented unavailable embedding role',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no model call expected'))),
    );

    const report = await runAnswerBench(unavailable);

    expect(report.passed).toBe(false);
    expect(report.embedding).toMatchObject({ available: false, totalChunks: 15, embeddedChunks: 0 });
    expect(report.execution.operations).toBe(0);
    expect(report.metrics.executionRate).toBe(0);
    expect(report.blockers).toContain('embedding_available');
    expect(report.cases.every((benchCase) => benchCase.error === 'embedding_unavailable')).toBe(true);
  });
});

function inventedProvider(): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as {
      input?: string[];
      messages?: Array<{ content: string }>;
    };
    if (url.endsWith('/embeddings')) {
      return new Response(
        JSON.stringify({
          data: (body.input ?? []).map((text, index) => ({
            index,
            embedding: inventedEmbedding(text),
          })),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    const system = body.messages?.[0]?.content ?? '';
    const user = JSON.parse(body.messages?.at(-1)?.content ?? '{}') as {
      question?: string;
      evidence?: Array<{ evidence_id: string; excerpt: string }>;
      blocks?: Array<{ block_id: string }>;
    };
    const content = system.includes('independently verify')
      ? {
          verdicts: (user.blocks ?? []).map((block) => ({
            block_id: block.block_id,
            supported: true,
          })),
        }
      : generation(user.question ?? '', user.evidence ?? []);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;
}

function generation(
  question: string,
  evidence: Array<{ evidence_id: string; excerpt: string }>,
): { blocks: Array<{ text: string; evidence_ids: string[] }>; missing_concepts: string[] } {
  const cited = (marker: string): string =>
    evidence.find((item) => item.excerpt.toLowerCase().includes(marker))?.evidence_id ?? 'missing';
  const lower = question.toLowerCase();
  if (lower.includes('silverpine-direct'))
    return draft('The warranty lasts five years.', cited('silverpine'));
  if (lower.includes('amberlark-service')) {
    return draft('Inspections happen every six months.', cited('amberlark'));
  }
  if (lower.includes('foxglove-compound')) {
    return {
      blocks: [
        { text: 'The renewal date is 14 May 2027.', evidence_ids: [cited('14 may 2027')] },
        { text: 'The renewal fee is 1111 EUR.', evidence_ids: [cited('1111 eur')] },
      ],
      missing_concepts: [],
    };
  }
  if (lower.includes('kestrel-partial')) {
    return {
      blocks: [{ text: 'The access phrase is moonstone.', evidence_ids: [cited('kestrel-partial')] }],
      missing_concepts: ['service interval'],
    };
  }
  if (lower.includes('osprey-negative')) {
    return draft('Coverage does not include saltwater damage.', cited('osprey-negative'));
  }
  if (lower.includes('willow-current')) {
    return draft('The current cadence is every six months.', cited('willow-current'));
  }
  if (lower.includes('tern-instruction')) {
    return draft('The warranty lasts seven years.', cited('tern-instruction'));
  }
  if (lower.includes('copperfin-unsupported')) {
    return { blocks: [], missing_concepts: ['requested value'] };
  }
  if (lower.includes('albatross-ambiguous')) {
    return {
      blocks: [
        {
          text: 'Two records conflict: one says blue and the other says green.',
          evidence_ids: [cited('blue access'), cited('green access')],
        },
      ],
      missing_concepts: ['unambiguous identity'],
    };
  }
  if (lower.includes('heron-orphan')) {
    return draft('The archive closes at 18:00.', cited('heron-orphan'));
  }
  if (lower.includes('albatross-graph')) {
    return {
      blocks: [
        {
          text: 'The destination value is moonstone.',
          evidence_ids: [cited('albatross-graph'), cited('conduit continues to'), cited('terminal value')],
        },
      ],
      missing_concepts: [],
    };
  }
  return { blocks: [], missing_concepts: [] };
}

function draft(text: string, evidenceId: string) {
  return { blocks: [{ text, evidence_ids: [evidenceId] }], missing_concepts: [] };
}

function inventedEmbedding(text: string): number[] {
  const vector = Array.from({ length: 32 }, () => 0);
  for (const token of text.toLowerCase().match(/[a-z0-9-]+/gu) ?? []) {
    let hash = 2_166_136_261;
    for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
    vector[(hash >>> 0) % vector.length]! += 1;
  }
  return vector;
}

function config(): AknoConfig {
  const provider = {
    name: 'invented-provider',
    baseUrl: 'https://invented.invalid/v1',
    apiKey: null,
    headers: {},
    maxRetries: 0,
  };
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
    providers: { 'invented-provider': provider },
    models: {
      embedding: {
        ...role('embedding'),
        provider,
        id: 'invented-embedding-model',
        enabled: true,
        requested: true,
        unavailableReason: null,
        dimensions: 32,
        batch: 8,
      },
      answer: {
        ...role('answer'),
        provider,
        id: 'invented-answer-model',
        enabled: true,
        requested: true,
        unavailableReason: null,
        reasoningEffort: 'none',
      },
      reranker: role('reranker'),
      derive: role('derive'),
      expansion: role('expansion'),
      vision: role('vision'),
    },
  } as AknoConfig;
}
