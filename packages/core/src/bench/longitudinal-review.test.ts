import { describe, expect, it } from 'vitest';
import { LONGITUDINAL_CORPUS } from './longitudinal-corpus.ts';
import {
  adjudicateLongitudinal,
  longitudinalFingerprint as hash,
  longitudinalInputReview,
} from './longitudinal-review.ts';

function fixture() {
  const contract = {
    runtime: 'built-core-socket-built-client',
    policies: 'timeline_history_observe_reflect_auto_other_off',
    indexFacts: false,
    indexSummaries: false,
    expansion: false,
    reranker: false,
    maintenanceCyclesPerCheckpoint: 3,
    maxSourcePagesPerCycle: 3,
    maxTimelineItemsPerCycle: 6,
    retrievalBudget: 6000,
    answerOutputTokens: 2400,
    sourceLanguage: 'en',
    knowledgeLanguage: 'en',
    measurement: 'socket-scoped-drained-index-v2',
    seeds: null,
    cost: null,
    modelSubstitution: null,
    sourceClock: 'explicit_mentioned_at',
    worldClock: 'timeline_as_of_only',
    prompts: {
      extraction: 'invented-version',
      verifier: 'invented-version',
      answer: 'invented-version',
      answerVerifier: 'invented-version',
    },
    models: Object.fromEntries(
      ['derive', 'answer', 'embedding'].map((role) => [
        role,
        { id: null, providerFingerprint: hash(null), enabled: false, timeoutMs: 1111 },
      ]),
    ),
    artifacts: Object.fromEntries(
      [
        'core/dist/write/retain.js',
        'core/dist/maintenance/timeline-sources.js',
        'core/dist/maintenance/timeline-assertions.js',
        'core/dist/open.js',
        'cli/dist/serve/socket.js',
        'client/dist/index.js',
      ].map((file) => [file, hash(file)]),
    ),
  };
  const checkpoints = LONGITUDINAL_CORPUS.filter((entry) => entry.split === 'development').flatMap(
    (episode) =>
      ['extract-only', 'maintained'].flatMap((arm) =>
        episode.steps.map((step) => ({
          key: `${episode.id}/${arm}/1/${step.id}`,
          episode: episode.id,
          arm,
          run: 1,
          step: step.id,
          memory: [],
          timeline: { results: [], status: 'empty' },
          recall: { results: [], status: 'empty' },
          context: { results: [], pinned: [], timeline: [], status: 'empty' },
          answer: step.answer ? { answer: null, outcome: 'not_answered', status: 'empty' } : null,
          inventory: {
            memories: 0,
            activeSupports: 0,
            proofGroups: 0,
            observations: 0,
            validSupportHashes: true,
            sourceBytesUnchanged: true,
            replayStable: step.action === 'replay' ? true : null,
            cachedMaintenanceCalls: null,
          },
          operations: [],
          maintenance: [],
        })),
      ),
  );
  const packet = {
    version: 'longitudinal-packet-v2',
    corpusFingerprint: hash(LONGITUDINAL_CORPUS),
    inputReviewFingerprint: hash(longitudinalInputReview()),
    split: 'development',
    runs: 1,
    contract,
    checkpoints,
  };
  const review = {
    version: 'longitudinal-review-v1',
    packetFingerprint: hash(packet),
    reviewer: { kind: 'agent', id: 'Codex', independent: false, sourceBased: true },
    checkpoints: packet.checkpoints.map((checkpoint) => ({
      key: checkpoint.key,
      stages: Object.fromEntries(
        ['memory', 'timeline', 'recall', 'context', 'answer'].map((stage) => [
          stage,
          {
            covered: [] as string[],
            errors: [] as string[],
            abstention: stage === 'answer' && checkpoint.answer === null ? 'not_measured' : 'unjustified',
          },
        ]),
      ),
    })),
  };
  return { packet, review };
}

describe('longitudinal source-based adjudication', () => {
  it('fails an always-abstain pipeline despite zero accepted semantic errors', () => {
    const { packet, review } = fixture();
    const report = adjudicateLongitudinal(packet, review);
    expect(report.groups.every((group) => !group.passed)).toBe(true);
    expect(report.groups[0]?.coverage.memory).toMatchObject({ numerator: 0, fraction: 0 });
    expect(report.groups[0]?.gates.zeroAcceptedSemanticErrors).toBe(true);
  });

  it('requires complete coordinates, fresh packets and source contracts', () => {
    const { packet, review } = fixture();
    expect(() =>
      adjudicateLongitudinal(packet, { ...review, checkpoints: review.checkpoints.slice(1) }),
    ).toThrow('coordinates');
    expect(() =>
      adjudicateLongitudinal(packet, {
        ...review,
        checkpoints: [...review.checkpoints, review.checkpoints[0]],
      }),
    ).toThrow('coordinates');
    expect(() => adjudicateLongitudinal(packet, { ...review, packetFingerprint: hash(null) })).toThrow(
      'stale output review',
    );
    packet.corpusFingerprint = hash(null);
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('stale input contract');
  });

  it('rejects coverage without output, duplicate IDs and skipped measured stages', () => {
    const { packet, review } = fixture();
    review.checkpoints[0]!.stages.memory = { covered: ['ada-initial'], errors: [], abstention: 'none' };
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('coverage without output');
    review.checkpoints[0]!.stages.memory.covered.push('ada-initial');
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('invalid reviewed coverage');
    review.checkpoints[0]!.stages.memory = { covered: [], errors: [], abstention: 'not_measured' };
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('measured stage omitted');
  });

  it('cannot turn unavailable outcomes into successful abstentions or promote an absent answer', () => {
    const { packet, review } = fixture();
    packet.checkpoints[0]!.answer!.status = 'unavailable';
    review.packetFingerprint = hash(packet);
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('availability collapsed');
    review.checkpoints[0]!.stages.answer.abstention = 'unavailable';
    review.checkpoints[0]!.stages.answer.errors = ['unsupported_promotion'];
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('absent answer');
  });

  it('keeps seeded contamination separate from naturally produced errors', () => {
    const { packet, review } = fixture();
    const seed = review.checkpoints.find((checkpoint) =>
      checkpoint.key.includes('/extract-only/1/seeded-contamination'),
    )!;
    seed.stages.memory.errors = ['unsupported_promotion', 'qualification_loss'];
    Object.assign(seed.stages.memory, { seededErrors: ['unsupported_promotion'] });
    const report = adjudicateLongitudinal(packet, review);
    expect(report.groups[0]).toMatchObject({ seededErrors: 1, naturalErrors: 1, passed: false });
    expect(report.checkpoints.find((checkpoint) => checkpoint.key === seed.key)?.seeded).toBe(true);
    Object.assign(seed.stages.memory, { seededErrors: ['wrong_identity'] });
    expect(() => adjudicateLongitudinal(packet, review)).toThrow('seed origin without reviewed error');
  });

  it('excludes a non-temporal correction from timeline coverage', () => {
    const { packet, review } = fixture();
    const report = adjudicateLongitudinal(packet, review);
    const final = report.checkpoints.find((checkpoint) => checkpoint.step === 'recovery-restart-clock')!;
    expect(final.stages.find((stage) => stage.stage === 'memory')?.required).toBe(2);
    expect(final.stages.find((stage) => stage.stage === 'timeline')?.required).toBe(1);
  });

  it('rejects arbitrary private fields in the publication contract', () => {
    const { packet, review } = fixture();
    const altered = {
      ...packet,
      contract: { ...packet.contract, privatePayload: 'invented confidential value' },
    };
    expect(() => adjudicateLongitudinal(altered, { ...review, packetFingerprint: hash(altered) })).toThrow();
    const report = adjudicateLongitudinal(packet, review);
    expect(JSON.stringify(report)).not.toContain('privatePayload');
    expect(JSON.stringify(report)).not.toContain('reviewKnowledge');
  });
});
