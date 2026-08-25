import { describe, expect, it } from 'vitest';
import {
  completeRankingReview,
  createRankingReviewPacket,
  rankingCorpusFingerprint,
  rankingReviewEvidenceMatches,
  rebaseRankingReviewPacket,
  reviewPacketFingerprint,
} from './ranking-review.ts';

describe('ranking corpus review handoff', () => {
  it('exports the whole invented corpus without benchmark outcomes', () => {
    const first = createRankingReviewPacket(new Date('2027-01-02T03:04:05.000Z'));
    const second = createRankingReviewPacket(new Date('2027-02-03T04:05:06.000Z'));

    expect(first.corpus).toEqual({
      version: 'invented-ranking-v4',
      fingerprint: rankingCorpusFingerprint(),
      sources: 120,
      queries: 80,
      judgments: 3200,
    });
    expect(first.sources.every((source) => source.review === 'pending')).toBe(true);
    expect(first.cases.every((benchCase) => benchCase.review === 'pending')).toBe(true);
    expect(first.packetFingerprint).toBe(second.packetFingerprint);
    expect(JSON.stringify(first)).not.toContain('validResponseRate');
    expect(JSON.stringify(first)).not.toContain('ndcgAt10');
  });

  it('requires every review and independence attestation before issuing evidence', () => {
    const packet = createRankingReviewPacket(new Date('2027-01-02T03:04:05.000Z'));
    expect(() => completeRankingReview(packet)).toThrow('verdict is not approved');

    const completed = approvedPacket();
    const evidence = completeRankingReview(completed);

    expect(evidence).toMatchObject({
      corpusFingerprint: rankingCorpusFingerprint(),
      reviewerKind: 'model',
      reviewedAt: '2027-01-03T04:05:06.000Z',
      sourceReviews: 120,
      caseReviews: 80,
      independenceConfirmed: true,
      checksConfirmed: true,
    });
    expect(
      rankingReviewEvidenceMatches(evidence, {
        version: completed.corpus.version,
        fingerprint: completed.corpus.fingerprint,
        sources: completed.corpus.sources,
      }),
    ).toBe(true);
  });

  it('rejects changed or stale corpus content even if its packet hash is recomputed', () => {
    const changed = approvedPacket();
    changed.sources[0] = { ...changed.sources[0]!, text: 'Invented replacement source text.' };
    expect(() => completeRankingReview(changed)).toThrow('does not match its fingerprint');

    changed.packetFingerprint = reviewPacketFingerprint(changed);
    expect(() => completeRankingReview(changed)).toThrow('does not match the current corpus');
  });

  it('carries forward only exact pass decisions and preserves changed-entry issues', () => {
    const previous = approvedPacket();
    const changedId = previous.cases[0]!.id;
    previous.corpus = {
      ...previous.corpus,
      version: 'invented-ranking-previous',
      fingerprint: 'a'.repeat(64),
    };
    previous.cases[0] = {
      ...previous.cases[0]!,
      query: 'Invented previous query wording?',
      review: 'issue',
    };
    previous.review.verdict = 'changes_requested';
    previous.review.issues = [
      { scope: 'case', id: changedId, description: 'The invented query needs correction.' },
    ];
    previous.packetFingerprint = reviewPacketFingerprint(previous);

    const rebased = rebaseRankingReviewPacket(previous, new Date('2027-02-03T04:05:06.000Z'));

    expect(rebased.corpus.version).toBe('invented-ranking-v4');
    expect(rebased.sources.every((source) => source.review === 'pass')).toBe(true);
    expect(rebased.cases.filter((benchCase) => benchCase.review === 'pending').map(({ id }) => id)).toEqual([
      changedId,
    ]);
    expect(rebased.review).toMatchObject({
      verdict: 'pending',
      reviewerKind: null,
      reviewedAt: null,
      issues: [{ scope: 'case', id: changedId }],
    });
    expect(Object.values(rebased.review.independence).every((value) => value === false)).toBe(true);
    expect(Object.values(rebased.review.checks).every((value) => value === false)).toBe(true);
    expect(rebased.instructions[0]).toContain('120 sources and 79 cases');
  });
});

function approvedPacket() {
  const packet = createRankingReviewPacket(new Date('2027-01-02T03:04:05.000Z'));
  packet.sources = packet.sources.map((source) => ({ ...source, review: 'pass' }));
  packet.cases = packet.cases.map((benchCase) => ({ ...benchCase, review: 'pass' }));
  packet.review = {
    verdict: 'approved',
    reviewerKind: 'model',
    reviewedAt: '2027-01-03T04:05:06.000Z',
    independence: {
      didNotAuthorCorpus: true,
      didNotTuneRuntimeContract: true,
      reviewedWithoutBenchmarkOutputs: true,
    },
    checks: {
      inventedContent: true,
      sourceClarity: true,
      queryIntentAlignment: true,
      poolAndJudgmentAccuracy: true,
      splitIsolation: true,
    },
    issues: [],
  };
  return packet;
}
