import { createHash } from 'node:crypto';
import { RANKING_CORPUS, type RankingCorpus } from './ranking-corpus.ts';

export const RANKING_REVIEW_PACKET_SCHEMA_VERSION = 'ranking-corpus-review-packet-v1';
export const RANKING_REVIEW_EVIDENCE_SCHEMA_VERSION = 'ranking-corpus-review-evidence-v1';

export type RankingReviewMark = 'pending' | 'pass' | 'issue';
export type RankingReviewerKind = 'human' | 'model';

export interface RankingReviewSource {
  id: string;
  text: string;
  sourceKind: 'page' | 'document';
  instructionBearing: boolean;
  review: RankingReviewMark;
}

export interface RankingReviewCase {
  id: string;
  split: 'development' | 'test';
  category: string;
  query: string;
  intent: string;
  candidates: Array<{
    id: string;
    text: string;
    sourceKind: 'page' | 'document';
    instructionBearing: boolean;
    grade: 0 | 1 | 2 | 3;
  }>;
  review: RankingReviewMark;
}

export interface RankingReviewIssue {
  scope: 'corpus' | 'source' | 'case';
  id: string | null;
  description: string;
}

export interface RankingReviewDecision {
  verdict: 'pending' | 'approved' | 'changes_requested';
  reviewerKind: RankingReviewerKind | null;
  reviewedAt: string | null;
  independence: {
    didNotAuthorCorpus: boolean;
    didNotTuneRuntimeContract: boolean;
    reviewedWithoutBenchmarkOutputs: boolean;
  };
  checks: {
    inventedContent: boolean;
    sourceClarity: boolean;
    queryIntentAlignment: boolean;
    poolAndJudgmentAccuracy: boolean;
    splitIsolation: boolean;
  };
  issues: RankingReviewIssue[];
}

export interface RankingReviewPacket {
  kind: 'ranking_corpus_review_packet';
  schemaVersion: string;
  createdAt: string;
  corpus: {
    version: string;
    fingerprint: string;
    sources: number;
    queries: number;
    judgments: number;
  };
  packetFingerprint: string;
  instructions: string[];
  sources: RankingReviewSource[];
  cases: RankingReviewCase[];
  review: RankingReviewDecision;
}

/** Content-free proof copied into a matrix after the complete packet validates. */
export interface RankingReviewEvidence {
  kind: 'ranking_corpus_review_evidence';
  schemaVersion: string;
  corpusVersion: string;
  corpusFingerprint: string;
  packetFingerprint: string;
  receiptFingerprint: string;
  reviewerKind: RankingReviewerKind;
  reviewedAt: string;
  sourceReviews: number;
  caseReviews: number;
  independenceConfirmed: true;
  checksConfirmed: true;
}

export function rankingCorpusFingerprint(corpus: RankingCorpus = RANKING_CORPUS): string {
  return sha256(
    JSON.stringify({
      version: corpus.version,
      candidates: Object.values(corpus.candidates)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((candidate) => ({
          id: candidate.id,
          text: candidate.text,
          sourceKind: candidate.sourceKind,
          instructionBearing: candidate.instructionBearing ?? false,
        })),
      cases: [...corpus.cases]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((benchCase) => ({
          id: benchCase.id,
          split: benchCase.split,
          category: benchCase.category,
          query: benchCase.query,
          intent: benchCase.intent,
          pool: benchCase.pool,
          judgments: benchCase.pool.map((id) => [id, benchCase.judgments[id]]),
        })),
    }),
  );
}

export function createRankingReviewPacket(now = new Date()): RankingReviewPacket {
  const packet: RankingReviewPacket = {
    kind: 'ranking_corpus_review_packet',
    schemaVersion: RANKING_REVIEW_PACKET_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    corpus: {
      version: RANKING_CORPUS.version,
      fingerprint: rankingCorpusFingerprint(),
      sources: Object.keys(RANKING_CORPUS.candidates).length,
      queries: RANKING_CORPUS.cases.length,
      judgments: RANKING_CORPUS.cases.reduce((sum, benchCase) => sum + benchCase.pool.length, 0),
    },
    packetFingerprint: '',
    instructions: [
      'Review this packet in a separate session from corpus authorship and runtime prompt tuning.',
      'Do not consult benchmark outputs while deciding whether a source, query, pool, or grade is correct.',
      'Each case repeats its frozen candidate texts in rank order; verify every grade, then mark the case pass or issue.',
      'Mark every source and case pass or issue; describe every issue and request changes when any remain.',
      'Approve only after every global check and independence attestation is true.',
      'Return the completed packet; Akno copies only its content-free receipt into the ranking matrix.',
    ],
    sources: Object.values(RANKING_CORPUS.candidates)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((candidate) => ({
        id: candidate.id,
        text: candidate.text,
        sourceKind: candidate.sourceKind,
        instructionBearing: candidate.instructionBearing ?? false,
        review: 'pending',
      })),
    cases: [...RANKING_CORPUS.cases]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((benchCase) => ({
        id: benchCase.id,
        split: benchCase.split,
        category: benchCase.category,
        query: benchCase.query,
        intent: benchCase.intent,
        candidates: benchCase.pool.map((id) => {
          const candidate = RANKING_CORPUS.candidates[id]!;
          return {
            id,
            text: candidate.text,
            sourceKind: candidate.sourceKind,
            instructionBearing: candidate.instructionBearing ?? false,
            grade: benchCase.judgments[id]!,
          };
        }),
        review: 'pending',
      })),
    review: {
      verdict: 'pending',
      reviewerKind: null,
      reviewedAt: null,
      independence: {
        didNotAuthorCorpus: false,
        didNotTuneRuntimeContract: false,
        reviewedWithoutBenchmarkOutputs: false,
      },
      checks: {
        inventedContent: false,
        sourceClarity: false,
        queryIntentAlignment: false,
        poolAndJudgmentAccuracy: false,
        splitIsolation: false,
      },
      issues: [],
    },
  };
  packet.packetFingerprint = reviewPacketFingerprint(packet);
  return packet;
}

export function reviewPacketFingerprint(packet: RankingReviewPacket): string {
  return sha256(
    JSON.stringify({
      kind: packet.kind,
      schemaVersion: packet.schemaVersion,
      corpus: packet.corpus,
      sources: packet.sources.map(({ review: _review, ...source }) => source),
      cases: packet.cases.map(({ review: _review, ...benchCase }) => benchCase),
    }),
  );
}

export function completeRankingReview(packetValue: unknown): RankingReviewEvidence {
  if (!isReviewPacket(packetValue)) throw new Error('invalid ranking review packet shape');
  const packet = packetValue;
  if (packet.schemaVersion !== RANKING_REVIEW_PACKET_SCHEMA_VERSION) {
    throw new Error('unsupported ranking review packet schema');
  }
  if (reviewPacketFingerprint(packet) !== packet.packetFingerprint) {
    throw new Error('ranking review packet content does not match its fingerprint');
  }
  const expected = createRankingReviewPacket(new Date(0));
  if (
    packet.packetFingerprint !== expected.packetFingerprint ||
    packet.corpus.version !== expected.corpus.version ||
    packet.corpus.fingerprint !== expected.corpus.fingerprint
  ) {
    throw new Error('ranking review packet does not match the current corpus');
  }
  if (packet.review.verdict !== 'approved') throw new Error('ranking review verdict is not approved');
  if (packet.review.reviewerKind !== 'human' && packet.review.reviewerKind !== 'model') {
    throw new Error('ranking review must identify the reviewer kind');
  }
  if (!packet.review.reviewedAt || Number.isNaN(Date.parse(packet.review.reviewedAt))) {
    throw new Error('ranking review needs a valid reviewedAt timestamp');
  }
  if (Object.values(packet.review.independence).some((value) => value !== true)) {
    throw new Error('ranking review independence attestations are incomplete');
  }
  if (Object.values(packet.review.checks).some((value) => value !== true)) {
    throw new Error('ranking review corpus checks are incomplete');
  }
  const pendingSource = packet.sources.find((source) => source.review !== 'pass');
  if (pendingSource) throw new Error(`ranking source ${pendingSource.id} is not approved`);
  const pendingCase = packet.cases.find((benchCase) => benchCase.review !== 'pass');
  if (pendingCase) throw new Error(`ranking case ${pendingCase.id} is not approved`);
  if (packet.review.issues.length > 0) throw new Error('ranking review still contains unresolved issues');

  return {
    kind: 'ranking_corpus_review_evidence',
    schemaVersion: RANKING_REVIEW_EVIDENCE_SCHEMA_VERSION,
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

export function rankingReviewEvidenceMatches(
  evidence: RankingReviewEvidence | null,
  corpus: { version: string; fingerprint?: string | null; sources: number },
): boolean {
  return Boolean(
    evidence &&
    evidence.kind === 'ranking_corpus_review_evidence' &&
    evidence.schemaVersion === RANKING_REVIEW_EVIDENCE_SCHEMA_VERSION &&
    evidence.corpusVersion === corpus.version &&
    evidence.corpusFingerprint === corpus.fingerprint &&
    evidence.sourceReviews === corpus.sources &&
    evidence.caseReviews === RANKING_CORPUS.cases.length &&
    evidence.independenceConfirmed === true &&
    evidence.checksConfirmed === true &&
    (evidence.reviewerKind === 'human' || evidence.reviewerKind === 'model') &&
    !Number.isNaN(Date.parse(evidence.reviewedAt)) &&
    /^[a-f0-9]{64}$/.test(evidence.packetFingerprint) &&
    /^[a-f0-9]{64}$/.test(evidence.receiptFingerprint),
  );
}

function isReviewPacket(value: unknown): value is RankingReviewPacket {
  if (!value || typeof value !== 'object') return false;
  const packet = value as Partial<RankingReviewPacket>;
  return Boolean(
    packet.kind === 'ranking_corpus_review_packet' &&
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
