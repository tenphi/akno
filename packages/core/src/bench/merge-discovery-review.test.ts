import { describe, expect, it } from 'vitest';
import {
  completeMergeDiscoveryReview,
  createMergeDiscoveryReviewPacket,
  type MergeDiscoveryReviewPacket,
} from './merge-discovery-review.ts';
import {
  MERGE_DISCOVERY_HELD_OUT_FINGERPRINT,
  mergeDiscoveryCorpus,
  mergeDiscoveryCorpusFingerprint,
  validateMergeDiscoveryCorpora,
} from './merge-discovery-corpus.ts';

describe('merge discovery held-out review', () => {
  it('keeps development and frozen held-out sources and cases disjoint', () => {
    const development = mergeDiscoveryCorpus('development');
    const test = mergeDiscoveryCorpus('test');
    const developmentPages = new Set(development.pages.map((page) => page.id));
    const developmentCases = new Set(development.cases.map((benchCase) => benchCase.id));

    expect(test.frozen).toBe(true);
    expect(test.pages).toHaveLength(18);
    expect(test.cases).toHaveLength(12);
    expect(test.pages.every((page) => !developmentPages.has(page.id))).toBe(true);
    expect(test.cases.every((benchCase) => !developmentCases.has(benchCase.id))).toBe(true);
    expect(new Set(test.pages.map((page) => page.id)).size).toBe(test.pages.length);
    expect(new Set(test.cases.map((benchCase) => benchCase.id)).size).toBe(test.cases.length);
    expect(
      test.cases.every(
        (benchCase) =>
          test.pages.some((page) => page.id === benchCase.left) &&
          test.pages.some((page) => page.id === benchCase.right),
      ),
    ).toBe(true);
    expect(mergeDiscoveryCorpusFingerprint(development)).not.toBe(mergeDiscoveryCorpusFingerprint(test));
    expect(mergeDiscoveryCorpusFingerprint(test)).toBe(MERGE_DISCOVERY_HELD_OUT_FINGERPRINT);
    expect(validateMergeDiscoveryCorpora).not.toThrow();
  });

  it('exports a time-independent, model-output-free packet', () => {
    const first = createMergeDiscoveryReviewPacket(new Date('2040-01-02T03:04:05.000Z'));
    const second = createMergeDiscoveryReviewPacket(new Date('2041-02-03T04:05:06.000Z'));

    expect(first.packetFingerprint).toBe(second.packetFingerprint);
    expect(JSON.stringify(first)).not.toMatch(/score|latency|promptVersion|modelDecision/);
    expect(first.sources.every((source) => source.review === 'pending')).toBe(true);
    expect(first.cases.every((benchCase) => benchCase.review === 'pending')).toBe(true);
  });

  it('accepts only a complete independent approval and emits content-free evidence', () => {
    const packet = createMergeDiscoveryReviewPacket(new Date('2040-01-02T03:04:05.000Z'));
    expect(() => completeMergeDiscoveryReview(packet)).toThrow('verdict is not approved');

    const evidence = completeMergeDiscoveryReview(approve(packet));
    expect(evidence).toMatchObject({
      kind: 'merge_discovery_review_evidence',
      corpusFingerprint: packet.corpus.fingerprint,
      sourceReviews: packet.sources.length,
      caseReviews: packet.cases.length,
      independenceConfirmed: true,
      checksConfirmed: true,
    });
    expect(JSON.stringify(evidence)).not.toContain('Ada Marlow');
  });

  it('rejects corpus content changed after export', () => {
    const packet = approve(createMergeDiscoveryReviewPacket(new Date('2040-01-02T03:04:05.000Z')));
    packet.sources[0]!.text += ' changed';
    expect(() => completeMergeDiscoveryReview(packet)).toThrow('does not match its fingerprint');
  });
});

function approve(packet: MergeDiscoveryReviewPacket): MergeDiscoveryReviewPacket {
  return {
    ...packet,
    sources: packet.sources.map((source) => ({ ...source, review: 'pass' })),
    cases: packet.cases.map((benchCase) => ({ ...benchCase, review: 'pass' })),
    review: {
      verdict: 'approved',
      reviewerKind: 'human',
      reviewedAt: '2040-01-02T04:05:06.000Z',
      independence: {
        didNotAuthorCorpus: true,
        didNotTuneClassifier: true,
        reviewedWithoutBenchmarkOutputs: true,
      },
      checks: {
        inventedContent: true,
        sourceClarity: true,
        pairPurposeAccuracy: true,
        hardNegativeCoverage: true,
        splitIsolation: true,
      },
      issues: [],
    },
  };
}
