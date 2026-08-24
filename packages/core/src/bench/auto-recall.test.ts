import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AknoConfig, ResolvedModelRole } from '../config/schema.ts';
import {
  markAutoRecallBenchPersisted,
  runAutoRecallBench,
  validateAutoRecallCorpora,
} from './auto-recall.ts';

afterEach(() => vi.unstubAllGlobals());

describe('auto-recall benchmark', () => {
  it('runs invented prompts through the production profile without content in its report', async () => {
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAutoRecallBench(config(), { concurrency: 3 });
    expect(failures(report)).toEqual([]);
    expect(report).toMatchObject({
      kind: 'invented_auto_recall_benchmark',
      schemaVersion: 'auto-recall-benchmark-v1',
      policyVersion: 'auto-recall-v1',
      development: true,
      artifactPersisted: false,
      releaseEligible: false,
      passed: true,
      split: 'development',
      corpus: {
        cases: 14,
        sources: 12,
        categories: 9,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
        frozen: false,
        independentlyReviewed: false,
      },
      embedding: { available: true },
      qualifier: { available: true, mode: 'llm' },
      metrics: {
        executionRate: 1,
        activationPrecision: 1,
        activationRecall: 1,
        activationAccuracy: 1,
        sourcePrecision: 1,
        sourceRecall: 1,
        irrelevantInjectionRate: 0,
        qualificationAccuracy: 1,
        locatorAccuracy: 1,
        evidenceIsolation: 1,
        budgetCompliance: 1,
        degradedRate: 0,
      },
      blockers: [],
    });
    expect(report.execution.qualificationCalls).toBeGreaterThan(0);
    expect(report.execution.usageReportedCalls).toBe(report.execution.qualificationCalls);
    expect(report.execution.providerTotalTokens).toBe(
      report.execution.providerInputTokens + report.execution.providerOutputTokens,
    );
    expect(report.releaseBlockers).toEqual([
      'held_out_split',
      'independent_review',
      'five_runs',
      'persisted_artifact',
    ]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('silverpine-contact');
    expect(serialized).not.toContain('violet-gull');
    expect(serialized).not.toContain('five-year warranty');
  });

  it('runs the frozen held-out split repeatedly and binds release evidence to persistence', async () => {
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAutoRecallBench(config(), { split: 'test', runs: 2, concurrency: 3 });
    expect(failures(report)).toEqual([]);
    expect(report).toMatchObject({
      development: false,
      split: 'test',
      passed: true,
      corpus: {
        version: 'auto-recall-held-out-v1',
        fingerprint: '204100f89a413156e28cbaa364389ec0ef246702342dcc478e32e584956f26a4',
        cases: 12,
        sources: 11,
        categories: 8,
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
    expect(report.releaseBlockers).toEqual(['independent_review', 'five_runs', 'persisted_artifact']);
    const persisted = markAutoRecallBenchPersisted(report);
    expect(persisted.artifactPersisted).toBe(true);
    expect(persisted.releaseBlockers).toEqual(['independent_review', 'five_runs']);
  });

  it('fails closed without issuing cases when an embedding prerequisite is unavailable', async () => {
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

    const report = await runAutoRecallBench(unavailable);
    expect(report.passed).toBe(false);
    expect(report.execution.operations).toBe(0);
    expect(report.metrics.executionRate).toBe(0);
    expect(report.blockers).toContain('embedding_available');
    expect(report.cases.every((benchCase) => benchCase.error === 'embedding_unavailable')).toBe(true);
  });

  it('keeps development and frozen held-out inputs disjoint and fingerprint-bound', () => {
    expect(() => validateAutoRecallCorpora()).not.toThrow();
  });
});

function failures(report: Awaited<ReturnType<typeof runAutoRecallBench>>) {
  return report.cases
    .filter((benchCase) => !benchCase.passed)
    .map((benchCase) => ({
      id: benchCase.id,
      activated: benchCase.activated,
      basis: benchCase.activationBasis,
      qualification: benchCase.qualificationRun,
      selected: benchCase.selectedSources,
      relevance: benchCase.selectedRelevance,
      error: benchCase.error,
    }));
}

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
          data: (body.input ?? []).map((text, index) => ({ index, embedding: inventedEmbedding(text) })),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    const payload = JSON.parse(body.messages?.at(-1)?.content ?? '{}') as {
      query?: string;
      candidates?: Array<{ candidate_id: string; excerpt: string }>;
    };
    const query = (payload.query ?? '').toLowerCase();
    const directMarkers = query.includes('copperfin-cadence')
      ? ['copperfin-cadence']
      : query.includes('bramble-cadence')
        ? ['bramble-cadence']
        : query.includes('kingfisher-hours')
          ? ['kingfisher-hours']
          : query.includes('tern-hours')
            ? ['tern-hours']
            : query.includes('access colour')
              ? ['heron-reference']
              : query.includes('arrival window')
                ? ['oriole-reference']
                : [];
    const order = (payload.candidates ?? []).map((candidate) => ({
      id: candidate.candidate_id,
      grade: directMarkers.some((marker) => candidate.excerpt.toLowerCase().includes(marker)) ? 3 : 0,
    }));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ order }) } }],
        usage: { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
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
      reranker: {
        ...role('reranker'),
        provider,
        id: 'invented-qualifier-model',
        enabled: true,
        requested: true,
        unavailableReason: null,
        rerankerMode: 'llm',
        excludeIrrelevant: true,
        topK: 8,
        maxChars: 800,
        reasoningEffort: 'none',
      },
      answer: role('answer'),
      derive: role('derive'),
      expansion: role('expansion'),
      vision: role('vision'),
    },
  } as AknoConfig;
}
