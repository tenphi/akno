import { sha256 } from '../store/ids.ts';
import {
  MERGE_DISCOVERY_CORPUS_VERSION,
  mergeDiscoveryCorpus,
  mergeDiscoveryCorpusFingerprint,
  validateMergeDiscoveryCorpora,
  type MergeDiscoveryCategory,
} from './merge-discovery-corpus.ts';

export const MERGE_DISCOVERY_REVIEW_PACKET_VERSION = 'merge-discovery-review-packet-v1';
export const MERGE_DISCOVERY_REVIEW_EVIDENCE_VERSION = 'merge-discovery-review-evidence-v1';

export type MergeDiscoveryReviewMark = 'pending' | 'pass' | 'issue';
export type MergeDiscoveryReviewerKind = 'human' | 'model';

export interface MergeDiscoveryReviewSource {
  id: string;
  text: string;
  review: MergeDiscoveryReviewMark;
}

export interface MergeDiscoveryReviewCase {
  id: string;
  category: MergeDiscoveryCategory;
  expected: 'candidate' | 'keep_separate';
  left: { id: string; text: string };
  right: { id: string; text: string };
  review: MergeDiscoveryReviewMark;
}

export interface MergeDiscoveryReviewIssue {
  scope: 'corpus' | 'source' | 'case';
  id: string | null;
  description: string;
}

export interface MergeDiscoveryReviewPacket {
  kind: 'merge_discovery_review_packet';
  schemaVersion: string;
  createdAt: string;
  corpus: {
    version: string;
    fingerprint: string;
    sources: number;
    cases: number;
  };
  packetFingerprint: string;
  instructions: string[];
  sources: MergeDiscoveryReviewSource[];
  cases: MergeDiscoveryReviewCase[];
  review: {
    verdict: 'pending' | 'approved' | 'changes_requested';
    reviewerKind: MergeDiscoveryReviewerKind | null;
    reviewedAt: string | null;
    independence: {
      didNotAuthorCorpus: boolean;
      didNotTuneClassifier: boolean;
      reviewedWithoutBenchmarkOutputs: boolean;
    };
    checks: {
      inventedContent: boolean;
      sourceClarity: boolean;
      pairPurposeAccuracy: boolean;
      hardNegativeCoverage: boolean;
      splitIsolation: boolean;
    };
    issues: MergeDiscoveryReviewIssue[];
  };
}

/** Content-free proof copied into a held-out benchmark artifact. */
export interface MergeDiscoveryReviewEvidence {
  kind: 'merge_discovery_review_evidence';
  schemaVersion: string;
  corpusVersion: string;
  corpusFingerprint: string;
  packetFingerprint: string;
  receiptFingerprint: string;
  reviewerKind: MergeDiscoveryReviewerKind;
  reviewedAt: string;
  sourceReviews: number;
  caseReviews: number;
  independenceConfirmed: true;
  checksConfirmed: true;
}

/** Exports the frozen corpus without prompts, scores, model decisions, or benchmark outputs. */
export function createMergeDiscoveryReviewPacket(now = new Date()): MergeDiscoveryReviewPacket {
  validateMergeDiscoveryCorpora();
  const corpus = mergeDiscoveryCorpus('test');
  const pageById = new Map(corpus.pages.map((page) => [page.id, page]));
  const packet: MergeDiscoveryReviewPacket = {
    kind: 'merge_discovery_review_packet',
    schemaVersion: MERGE_DISCOVERY_REVIEW_PACKET_VERSION,
    createdAt: now.toISOString(),
    corpus: {
      version: MERGE_DISCOVERY_CORPUS_VERSION,
      fingerprint: mergeDiscoveryCorpusFingerprint(corpus),
      sources: corpus.pages.length,
      cases: corpus.cases.length,
    },
    packetFingerprint: '',
    instructions: [
      'Review this packet in a separate session from corpus authorship and classifier prompt tuning.',
      'Do not run or inspect benchmark outputs while judging the corpus.',
      'Verify that every source is invented, unambiguous, and free of hidden instructions.',
      'For each pair, verify whether the pages should become one durable page or remain separate.',
      'Mark every source and case pass or issue; describe every issue and request changes when any remain.',
      'Approve only after every independence attestation and global check is true.',
      'Return this completed packet; Akno stores only a content-free review receipt in benchmark results.',
    ],
    sources: [...corpus.pages]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((page) => ({ id: page.id, text: page.text, review: 'pending' })),
    cases: [...corpus.cases]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((benchCase) => ({
        id: benchCase.id,
        category: benchCase.category,
        expected: benchCase.expected,
        left: { id: benchCase.left, text: pageById.get(benchCase.left)!.text },
        right: { id: benchCase.right, text: pageById.get(benchCase.right)!.text },
        review: 'pending',
      })),
    review: {
      verdict: 'pending',
      reviewerKind: null,
      reviewedAt: null,
      independence: {
        didNotAuthorCorpus: false,
        didNotTuneClassifier: false,
        reviewedWithoutBenchmarkOutputs: false,
      },
      checks: {
        inventedContent: false,
        sourceClarity: false,
        pairPurposeAccuracy: false,
        hardNegativeCoverage: false,
        splitIsolation: false,
      },
      issues: [],
    },
  };
  packet.packetFingerprint = reviewPacketFingerprint(packet);
  return packet;
}

export function completeMergeDiscoveryReview(packetValue: unknown): MergeDiscoveryReviewEvidence {
  if (!isReviewPacket(packetValue)) throw new Error('invalid merge discovery review packet shape');
  const packet = packetValue;
  if (packet.schemaVersion !== MERGE_DISCOVERY_REVIEW_PACKET_VERSION) {
    throw new Error('unsupported merge discovery review packet schema');
  }
  if (reviewPacketFingerprint(packet) !== packet.packetFingerprint) {
    throw new Error('merge discovery review packet content does not match its fingerprint');
  }
  const expected = createMergeDiscoveryReviewPacket(new Date(0));
  if (
    packet.packetFingerprint !== expected.packetFingerprint ||
    packet.corpus.version !== expected.corpus.version ||
    packet.corpus.fingerprint !== expected.corpus.fingerprint
  ) {
    throw new Error('merge discovery review packet does not match the current held-out corpus');
  }
  if (packet.review.verdict !== 'approved') {
    throw new Error('merge discovery review verdict is not approved');
  }
  if (packet.review.reviewerKind !== 'human' && packet.review.reviewerKind !== 'model') {
    throw new Error('merge discovery review must identify the reviewer kind');
  }
  if (!packet.review.reviewedAt || Number.isNaN(Date.parse(packet.review.reviewedAt))) {
    throw new Error('merge discovery review needs a valid reviewedAt timestamp');
  }
  if (Object.values(packet.review.independence).some((value) => value !== true)) {
    throw new Error('merge discovery review independence attestations are incomplete');
  }
  if (Object.values(packet.review.checks).some((value) => value !== true)) {
    throw new Error('merge discovery review corpus checks are incomplete');
  }
  const pendingSource = packet.sources.find((source) => source.review !== 'pass');
  if (pendingSource) throw new Error(`merge discovery source ${pendingSource.id} is not approved`);
  const pendingCase = packet.cases.find((benchCase) => benchCase.review !== 'pass');
  if (pendingCase) throw new Error(`merge discovery case ${pendingCase.id} is not approved`);
  if (packet.review.issues.length > 0) {
    throw new Error('merge discovery review still contains unresolved issues');
  }

  return {
    kind: 'merge_discovery_review_evidence',
    schemaVersion: MERGE_DISCOVERY_REVIEW_EVIDENCE_VERSION,
    corpusVersion: packet.corpus.version,
    corpusFingerprint: packet.corpus.fingerprint,
    packetFingerprint: packet.packetFingerprint,
    receiptFingerprint: sha256(
      JSON.stringify({
        packet: packet.packetFingerprint,
        sourceReviews: packet.sources.map((source) => [source.id, source.review]),
        caseReviews: packet.cases.map((benchCase) => [benchCase.id, benchCase.review]),
        review: packet.review,
      }),
    ),
    reviewerKind: packet.review.reviewerKind,
    reviewedAt: new Date(packet.review.reviewedAt).toISOString(),
    sourceReviews: packet.sources.length,
    caseReviews: packet.cases.length,
    independenceConfirmed: true,
    checksConfirmed: true,
  };
}

function reviewPacketFingerprint(packet: MergeDiscoveryReviewPacket): string {
  return sha256(
    JSON.stringify({
      schemaVersion: packet.schemaVersion,
      corpus: packet.corpus,
      sources: packet.sources.map(({ review: _review, ...source }) => source),
      cases: packet.cases.map(({ review: _review, ...benchCase }) => benchCase),
    }),
  );
}

function isReviewPacket(value: unknown): value is MergeDiscoveryReviewPacket {
  if (!value || typeof value !== 'object') return false;
  const packet = value as Partial<MergeDiscoveryReviewPacket>;
  return Boolean(
    packet.kind === 'merge_discovery_review_packet' &&
    packet.corpus &&
    typeof packet.corpus === 'object' &&
    typeof packet.packetFingerprint === 'string' &&
    Array.isArray(packet.sources) &&
    Array.isArray(packet.cases) &&
    packet.review &&
    typeof packet.review === 'object' &&
    packet.review.independence &&
    packet.review.checks &&
    Array.isArray(packet.review.issues),
  );
}
