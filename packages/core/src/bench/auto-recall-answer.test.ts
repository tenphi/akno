import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AknoConfig, ResolvedModelRole } from '../config/schema.ts';
import {
  AUTO_RECALL_ANSWER_HELD_OUT_FINGERPRINT,
  markAutoRecallAnswerBenchPersisted,
  runAutoRecallAnswerBench,
  validateAutoRecallAnswerCorpora,
} from './auto-recall-answer.ts';

afterEach(() => vi.unstubAllGlobals());

describe('auto-recall host answer benchmark', () => {
  it('compares the same invented host turn with and without production auto-recall evidence', async () => {
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAutoRecallAnswerBench(config(), { concurrency: 3 });
    expect(failures(report)).toEqual([]);
    expect(report).toMatchObject({
      kind: 'invented_auto_recall_answer_benchmark',
      schemaVersion: 'auto-recall-answer-benchmark-v2',
      hostPromptVersion: 'auto-recall-host-answer-v1',
      development: true,
      artifactPersisted: false,
      releaseEligible: false,
      passed: true,
      split: 'development',
      corpus: {
        cases: 12,
        sources: 16,
        categories: 11,
        frozen: false,
        independentlyReviewed: false,
        graphCasesExcluded: 0,
      },
      embedding: { available: true, totalChunks: 16, embeddedChunks: 16 },
      qualifier: { available: true, mode: 'llm' },
      hostModel: { available: true, warmupOk: true },
      metrics: {
        executionRate: 1,
        activationAccuracy: 1,
        evidenceFactAccuracy: 1,
        withMemoryAccuracy: 1,
        withMemoryFactAccuracy: 1,
        withMemoryAbstentionAccuracy: 1,
        withoutMemoryAbstentionAccuracy: 1,
        pairwiseImprovementRate: 1,
        unsupportedClaimRate: 0,
        forbiddenLeakRate: 0,
      },
      blockers: [],
    });
    expect(report.execution.hostModelCalls).toBe(24);
    expect(report.execution.hostUsageReportedCalls).toBe(24);
    expect(report.execution.qualificationCalls).toBeGreaterThan(0);
    expect(report.releaseBlockers).toEqual([
      'held_out_split',
      'independent_review',
      'five_runs',
      'persisted_artifact',
    ]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('cedar-direct');
    expect(serialized).not.toContain('indigo-owl');
    expect(serialized).not.toContain('five-year warranty');
  });

  it('runs the frozen held-out comparison repeatedly and binds release evidence to persistence', async () => {
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAutoRecallAnswerBench(config(), {
      split: 'test',
      runs: 2,
      concurrency: 3,
    });
    expect(failures(report)).toEqual([]);
    expect(report).toMatchObject({
      development: false,
      split: 'test',
      passed: true,
      corpus: {
        version: 'auto-recall-answer-held-out-v2',
        fingerprint: AUTO_RECALL_ANSWER_HELD_OUT_FINGERPRINT,
        cases: 12,
        sources: 16,
        categories: 11,
        frozen: true,
        independentlyReviewed: false,
        graphCasesExcluded: 0,
      },
      execution: { operations: 24, hostModelCalls: 48 },
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
    const persisted = markAutoRecallAnswerBenchPersisted(report);
    expect(persisted.artifactPersisted).toBe(true);
    expect(persisted.releaseBlockers).toEqual(['independent_review', 'five_runs']);
  });

  it('fails closed before case execution when the embedding prerequisite is unavailable', async () => {
    const unavailable = config();
    unavailable.models.embedding = {
      ...unavailable.models.embedding,
      provider: null,
      id: null,
      enabled: false,
      unavailableReason: 'invented unavailable embedding role',
    };
    vi.stubGlobal('fetch', inventedProvider());

    const report = await runAutoRecallAnswerBench(unavailable);
    expect(report.passed).toBe(false);
    expect(report.execution.operations).toBe(0);
    expect(report.metrics.executionRate).toBe(0);
    expect(report.blockers).toContain('embedding_available');
    expect(report.cases.every((benchCase) => benchCase.error === 'embedding_unavailable')).toBe(true);
  });

  it('keeps the reused development and held-out cases disjoint and fingerprint-bound', () => {
    expect(() => validateAutoRecallAnswerCorpora()).not.toThrow();
  });
});

function failures(report: Awaited<ReturnType<typeof runAutoRecallAnswerBench>>) {
  return report.cases
    .filter((benchCase) => !benchCase.passed)
    .map((benchCase) => ({
      id: benchCase.id,
      status: benchCase.contextStatus,
      activated: benchCase.contextActivated,
      evidence: benchCase.evidenceCount,
      qualification: benchCase.qualificationRun,
      withMemory: benchCase.withMemory,
      withoutMemory: benchCase.withoutMemory,
      error: benchCase.error,
    }));
}

function inventedProvider(): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as {
      model?: string;
      input?: string[];
      messages?: Array<{ content: string }>;
    };
    if (url.endsWith('/embeddings')) {
      return response({
        data: (body.input ?? []).map((text, index) => ({ index, embedding: inventedEmbedding(text) })),
      });
    }

    const payload = JSON.parse(body.messages?.at(-1)?.content ?? '{}') as {
      query?: string;
      candidates?: Array<{ candidate_id: string; excerpt: string }>;
      current_user_prompt?: string;
      memory_evidence?: string | null;
    };
    if (body.model === 'invented-qualifier-model') {
      const judgments = Object.fromEntries(
        (payload.candidates ?? []).map((candidate, index) => [
          candidate.candidate_id,
          { g: supports(payload.query ?? '', candidate.excerpt) ? 3 : 0, r: index + 1 },
        ]),
      );
      return completion({ j: judgments });
    }
    return completion(hostAnswer(payload.current_user_prompt ?? '', payload.memory_evidence ?? null));
  }) as typeof fetch;
}

function supports(question: string, evidence: string): boolean {
  const query = question.toLowerCase();
  const excerpt = evidence.toLowerCase();
  const match = query.includes('pine-conflict')
    ? ['pine-conflict', ['1 march 2029', '1111 eur', '2222 eur']]
    : query.includes('oak-conflict')
      ? ['oak-conflict', ['3 october 2031', '5555 eur', '6666 eur']]
      : query.includes('maple renewal')
        ? ['maple renewal', ['12 april 2029', '3333 eur']]
        : query.includes('cedar-partial')
          ? ['cedar-partial', ['comet']]
          : query.includes('aspen-current')
            ? ['aspen-current', ['every four months']]
            : query.includes('swift-orphan')
              ? ['swift-orphan', ['17:00']]
              : query.includes('rook-ambiguous')
                ? ['rook-ambiguous', ['red access', 'amber access']]
                : query.includes('thistle')
                  ? ['thistle', ['every eight months']]
                  : query.includes('gull-negative')
                    ? ['gull-negative', ['excludes hail']]
                    : query.includes('elm renewal')
                      ? ['elm renewal', ['7 september 2030', '4444 eur']]
                      : query.includes('birch access')
                        ? ['birch access', ['sunrise']]
                        : query.includes('beech-current')
                          ? ['beech-current', ['every five months']]
                          : query.includes('egret-ambiguous')
                            ? ['egret-ambiguous', ['white access', 'black access']]
                            : query.includes('plover-orphan')
                              ? ['plover-orphan', ['06:30']]
                              : null;
  if (!match) return false;
  const [identity, values] = match as [string, string[]];
  return excerpt.includes(identity) && values.some((value) => excerpt.includes(value));
}

function hostAnswer(
  question: string,
  evidence: string | null,
): { outcome: 'answered' | 'not_found'; answer: string | null } {
  if (!evidence) return { outcome: 'not_found', answer: null };
  const lower = question.toLowerCase();
  if (lower.includes('cedar product terms') && evidence.includes('five years'))
    return answered('The warranty lasts five years.');
  if (lower.includes('larkspur') && evidence.includes('every eleven months'))
    return answered('Reviews recur every eleven months.');
  if (lower.includes('maple renewal') && evidence.includes('12 April 2029') && evidence.includes('3333 EUR'))
    return answered('The renewal date is 12 April 2029 and the amount due is 3333 EUR.');
  if (lower.includes('cedar-partial') && evidence.includes('comet'))
    return answered('The access phrase is comet; the arrival window is not recorded.');
  if (lower.includes('finch-negative') && evidence.includes('does not include'))
    return answered('Coverage does not include frost damage.');
  if (lower.includes('aspen-current') && evidence.includes('every four months'))
    return answered('The current cadence is every four months.');
  if (lower.includes('wren-instruction') && evidence.includes('six years'))
    return answered('The warranty lasts six years.');
  if (lower.includes('swift-orphan') && evidence.includes('17:00'))
    return answered('The archive closes at 17:00.');
  if (lower.includes('birch-direct') && evidence.includes('nine-year'))
    return answered('The warranty lasts nine years.');
  if (lower.includes('thistle') && evidence.toLowerCase().includes('every eight months'))
    return answered('The audit cadence is every eight months.');
  if (lower.includes('elm renewal') && evidence.includes('7 September 2030') && evidence.includes('4444 EUR'))
    return answered('The renewal date is 7 September 2030 and the amount due is 4444 EUR.');
  if (lower.includes('birch access') && evidence.includes('sunrise'))
    return answered('The access phrase is sunrise; the arrival window is not recorded.');
  if (lower.includes('gull-negative') && evidence.includes('excludes hail'))
    return answered('Coverage excludes hail damage.');
  if (lower.includes('beech-current') && evidence.includes('every five months'))
    return answered('The current cadence is every five months.');
  if (lower.includes('heron-instruction') && evidence.includes('ten-year'))
    return answered('The warranty lasts ten years.');
  if (lower.includes('plover-orphan') && evidence.includes('06:30'))
    return answered('The archive opens at 06:30.');
  return { outcome: 'not_found', answer: null };
}

function answered(answer: string): { outcome: 'answered'; answer: string } {
  return { outcome: 'answered', answer };
}

function completion(content: unknown): Response {
  return response({
    choices: [{ message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
  });
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
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
      answer: {
        ...role('answer'),
        provider,
        id: 'invented-host-model',
        enabled: true,
        requested: true,
        unavailableReason: null,
        reasoningEffort: 'none',
      },
      derive: role('derive'),
      expansion: role('expansion'),
      vision: role('vision'),
    },
  } as AknoConfig;
}
