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
      schemaVersion: 'auto-recall-answer-benchmark-v1',
      hostPromptVersion: 'auto-recall-host-answer-v1',
      development: true,
      artifactPersisted: false,
      releaseEligible: false,
      passed: true,
      split: 'development',
      corpus: {
        cases: 11,
        sources: 15,
        categories: 11,
        frozen: false,
        independentlyReviewed: false,
        graphCasesExcluded: 1,
      },
      embedding: { available: true, totalChunks: 15, embeddedChunks: 15 },
      qualifier: { available: true, mode: 'llm' },
      hostModel: { available: true, warmupOk: true },
      metrics: {
        executionRate: 1,
        activationAccuracy: 1,
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
    expect(report.execution.hostModelCalls).toBe(22);
    expect(report.execution.hostUsageReportedCalls).toBe(22);
    expect(report.execution.qualificationCalls).toBeGreaterThan(0);
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
        version: 'auto-recall-answer-held-out-v1',
        fingerprint: AUTO_RECALL_ANSWER_HELD_OUT_FINGERPRINT,
        cases: 11,
        sources: 16,
        categories: 11,
        frozen: true,
        independentlyReviewed: false,
        graphCasesExcluded: 1,
      },
      execution: { operations: 22, hostModelCalls: 44 },
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
      const order = (payload.candidates ?? []).map((candidate) => ({
        id: candidate.candidate_id,
        grade: supports(payload.query ?? '', candidate.excerpt) ? 3 : 0,
      }));
      return completion({ order });
    }
    return completion(hostAnswer(payload.current_user_prompt ?? '', payload.memory_evidence ?? null));
  }) as typeof fetch;
}

function supports(question: string, evidence: string): boolean {
  const query = question.toLowerCase();
  const excerpt = evidence.toLowerCase();
  const match = query.includes('silverpine-direct')
    ? ['silverpine-direct', ['five-year']]
    : query.includes('amberlark-service')
      ? ['amberlark-service', ['every six months']]
      : query.includes('foxglove-compound')
        ? ['foxglove-compound', ['14 may 2027', '1111 eur']]
        : query.includes('kestrel-partial')
          ? ['kestrel-partial', ['moonstone']]
          : query.includes('osprey-negative')
            ? ['osprey-negative', ['does not include']]
            : query.includes('willow-current')
              ? ['willow-current', ['current inspection cadence is every six months']]
              : query.includes('tern-instruction')
                ? ['tern-instruction', ['seven-year']]
                : query.includes('heron-orphan')
                  ? ['heron-orphan', ['18:00']]
                  : query.includes('juniper held-out')
                    ? ['juniper held-out', ['four years']]
                    : query.includes('seabright held-out')
                      ? ['seabright held-out', ['every nine months']]
                      : query.includes('bramble held-out')
                        ? ['bramble held-out', ['22 june 2028', '2222 eur']]
                        : query.includes('lantern held-out')
                          ? ['lantern held-out', ['starlight']]
                          : query.includes('cormorant held-out')
                            ? ['cormorant held-out', ['excludes volcanic-ash']]
                            : query.includes('rowan held-out')
                              ? ['current rowan held-out', ['active inspection cadence']]
                              : query.includes('petrel held-out')
                                ? ['petrel held-out', ['eight years']]
                                : query.includes('kingfisher held-out')
                                  ? ['kingfisher held-out', ['07:30']]
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
  if (lower.includes('silverpine-direct') && evidence.includes('five-year'))
    return answered('The warranty lasts five years.');
  if (lower.includes('amberlark-service') && evidence.includes('every six months'))
    return answered('Inspections recur every six months.');
  if (
    lower.includes('foxglove-compound') &&
    evidence.includes('14 May 2027') &&
    evidence.includes('1111 EUR')
  )
    return answered('The renewal date is 14 May 2027 and the fee is 1111 EUR.');
  if (lower.includes('kestrel-partial') && evidence.includes('moonstone'))
    return answered('The access phrase is moonstone; the service interval is not recorded.');
  if (lower.includes('osprey-negative') && evidence.includes('does not include'))
    return answered('Coverage does not include saltwater damage.');
  if (lower.includes('willow-current') && evidence.includes('current inspection cadence is every six months'))
    return answered('The current cadence is every six months.');
  if (lower.includes('tern-instruction') && evidence.includes('seven-year'))
    return answered('The warranty lasts seven years.');
  if (lower.includes('heron-orphan') && evidence.includes('18:00'))
    return answered('The archive closes at 18:00.');
  if (lower.includes('juniper held-out') && evidence.includes('four years'))
    return answered('The warranty lasts four years.');
  if (lower.includes('seabright held-out') && evidence.includes('every nine months'))
    return answered('The inspection interval is every nine months.');
  if (
    lower.includes('bramble held-out') &&
    evidence.includes('22 June 2028') &&
    evidence.includes('2222 EUR')
  )
    return answered('The next renewal is 22 June 2028 and the amount due is 2222 EUR.');
  if (lower.includes('lantern held-out') && evidence.includes('starlight'))
    return answered('The access phrase is starlight; the arrival window is not recorded.');
  if (lower.includes('cormorant held-out') && evidence.includes('excludes volcanic-ash'))
    return answered('Coverage excludes volcanic-ash damage.');
  if (
    lower.includes('rowan held-out') &&
    evidence.includes('active inspection cadence is every three months')
  )
    return answered('The current cadence is every three months.');
  if (lower.includes('petrel held-out') && evidence.includes('eight years'))
    return answered('The warranty lasts eight years.');
  if (lower.includes('kingfisher held-out') && evidence.includes('07:30'))
    return answered('The archive opens at 07:30.');
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
