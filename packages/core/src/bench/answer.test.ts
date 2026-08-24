import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AknoConfig, ResolvedModelRole } from '../config/schema.ts';
import { markAnswerBenchPersisted, runAnswerBench } from './answer.ts';

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
      schemaVersion: 'answer-benchmark-v3',
      development: true,
      artifactPersisted: false,
      releaseEligible: false,
      passed: true,
      split: 'development',
      corpus: {
        cases: 12,
        sources: 15,
        categories: 12,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
        frozen: false,
        independentlyReviewed: false,
      },
      embedding: { available: true, totalChunks: 15, embeddedChunks: 15 },
      answerModel: {
        available: true,
        generationPromptVersion: 'answer-generation-v3',
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
    expect(report.stability).toEqual({
      requestedRuns: 1,
      completedRuns: 1,
      stableCaseRate: null,
      minimumRunPassRate: 1,
      flakyCaseIds: [],
    });
    expect(report.execution.modelCalls).toBeGreaterThan(0);
    expect(report.execution.usageReportedCalls).toBe(report.execution.modelCalls);
    expect(report.execution.providerTotalTokens).toBe(
      report.execution.providerInputTokens + report.execution.providerOutputTokens,
    );
    expect(report.cases.every((benchCase) => benchCase.passed)).toBe(true);
    expect(report.releaseBlockers).toEqual([
      'held_out_split',
      'independent_review',
      'five_runs',
      'persisted_artifact',
    ]);
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

  it('runs the explicit frozen held-out split repeatedly and reports decision stability', async () => {
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAnswerBench(config(), { split: 'test', runs: 2, concurrency: 3 });

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
      schemaVersion: 'answer-benchmark-v3',
      development: false,
      split: 'test',
      passed: true,
      corpus: {
        version: 'answer-held-out-v1',
        fingerprint: '25118179977f288c4ad7cce26d9cb4c31a3a20936f2cb08fa4938860d7688db2',
        cases: 12,
        sources: 16,
        categories: 12,
        frozen: true,
        independentlyReviewed: false,
      },
      execution: { operations: 24 },
      stability: {
        requestedRuns: 2,
        completedRuns: 2,
        stableCaseRate: 1,
        minimumRunPassRate: 1,
        flakyCaseIds: [],
      },
      blockers: [],
    });
    expect(report.runs).toHaveLength(2);
    expect(report.runs.every((run) => run.passed)).toBe(true);
    expect(report.releaseBlockers).toEqual(['independent_review', 'five_runs', 'persisted_artifact']);
    const persisted = markAnswerBenchPersisted(report);
    expect(persisted.artifactPersisted).toBe(true);
    expect(persisted.releaseBlockers).toEqual(['independent_review', 'five_runs']);
  });

  it('fails the stability gate when repeated decisions disagree', async () => {
    vi.stubGlobal('fetch', inventedProvider({ alternateHeldOutAmbiguity: true }));

    const report = await runAnswerBench(config(), { split: 'test', runs: 2, concurrency: 3 });

    expect(report.stability).toMatchObject({
      stableCaseRate: 11 / 12,
      minimumRunPassRate: 11 / 12,
      flakyCaseIds: ['held-indistinguishable-bo-winters'],
    });
    expect(report.passed).toBe(false);
    expect(report.blockers).toContain('case_stability');
  });
});

function inventedProvider(options: { alternateHeldOutAmbiguity?: boolean } = {}): typeof fetch {
  let heldOutAmbiguityCalls = 0;
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
      : generation(
          user.question ?? '',
          user.evidence ?? [],
          Boolean(
            options.alternateHeldOutAmbiguity &&
            (user.question ?? '').toLowerCase().includes('sanderling held-out') &&
            heldOutAmbiguityCalls++ % 2 === 1,
          ),
        );
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
  answerHeldOutAmbiguity = false,
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
    return { blocks: [], missing_concepts: ['unambiguous identity'] };
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
  if (lower.includes('juniper held-out')) return draft('The warranty lasts four years.', cited('four years'));
  if (lower.includes('seabright held-out')) {
    return draft('Inspections are required every nine months.', cited('every nine months'));
  }
  if (lower.includes('bramble held-out')) {
    return {
      blocks: [
        { text: 'The next renewal date is 22 June 2028.', evidence_ids: [cited('22 june 2028')] },
        { text: 'The amount due is 2222 EUR.', evidence_ids: [cited('2222 eur')] },
      ],
      missing_concepts: [],
    };
  }
  if (lower.includes('lantern held-out')) {
    return {
      blocks: [{ text: 'The access phrase is starlight.', evidence_ids: [cited('starlight')] }],
      missing_concepts: ['permitted arrival window'],
    };
  }
  if (lower.includes('cormorant held-out')) {
    return draft('Coverage excludes volcanic-ash damage.', cited('volcanic-ash'));
  }
  if (lower.includes('rowan held-out')) {
    return draft('The current cadence is every three months.', cited('active inspection'));
  }
  if (lower.includes('petrel held-out')) {
    return draft('The warranty lasts eight years.', cited('eight years'));
  }
  if (lower.includes('marigold held-out')) {
    return { blocks: [], missing_concepts: ['price'] };
  }
  if (lower.includes('sanderling held-out')) {
    if (answerHeldOutAmbiguity) {
      return {
        blocks: [
          {
            text: 'Two registers conflict: one says gold and the other says silver.',
            evidence_ids: [cited('gold access'), cited('silver access')],
          },
        ],
        missing_concepts: ['unambiguous identity'],
      };
    }
    return { blocks: [], missing_concepts: ['unambiguous identity'] };
  }
  if (lower.includes('kingfisher held-out')) {
    return draft('The archive opens at 07:30.', cited('kingfisher held-out'));
  }
  if (lower.includes('ibis held-out')) {
    return {
      blocks: [
        {
          text: 'The terminal codeword is sunstone.',
          evidence_ids: [cited('ibis held-out'), cited('continue to'), cited('sunstone')],
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
