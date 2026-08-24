import { describe, expect, it } from 'vitest';
import {
  completeRankingReview,
  createRankingReviewPacket,
  rankingCorpusFingerprint,
  rankingReviewEvidenceMatches,
  reviewPacketFingerprint,
} from './ranking-review.ts';

describe('ranking corpus review handoff', () => {
  it('exports the whole invented corpus without benchmark outcomes', () => {
    const first = createRankingReviewPacket(new Date('2027-01-02T03:04:05.000Z'));
    const second = createRankingReviewPacket(new Date('2027-02-03T04:05:06.000Z'));

    expect(first.corpus).toEqual({
      version: 'invented-ranking-v2',
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
