import { z } from 'zod';
import { MemoryQualification } from '@tenphi/akno-protocol';
import { sha256 } from '../store/ids.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';
import { LANGUAGE_CORPUS_V6 } from './language-corpus-v6.ts';
import { LANGUAGE_CORPUS_V5 } from './language-corpus-v5.ts';
import { LANGUAGE_CORPUS_V4 } from './language-corpus-v4.ts';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../ops/answer.ts';
import { RETAIN_PROMPT_VERSION, RETAIN_VERIFIER_VERSION } from '../write/retain.ts';
import { PROSE_PROJECTION_VERSION } from '../kb/prose.ts';
import { MEMORY_VIEW_VERSION } from '../memory/intent.ts';
import type { runLanguageBench } from './language.ts';

type Report = Awaited<ReturnType<typeof runLanguageBench>>;
const ReviewEvidence = z.object({
  text: z.string().trim().min(1),
  qualification: MemoryQualification.refine((value) => value.status === 'qualified'),
});
const ReviewMaterial = z.object({
  retainedItems: z.number().int().nonnegative(),
  reviewKnowledge: z.array(ReviewEvidence),
  queries: z.array(
    z.object({
      retainedEvidence: z.number().int().nonnegative(),
      reviewRetrieval: z.array(ReviewEvidence),
    }),
  ),
});
const Reviewer = z.object({
  kind: z.enum(['human', 'model']),
  id: z.string().min(1),
  independent: z.literal(true),
  didNotAuthorCorpus: z.literal(true),
  didNotTuneRuntime: z.literal(true),
});
const InputReview = z.object({
  schemaVersion: z.literal('language-input-review-v1'),
  corpusFingerprint: z.string(),
  reviewer: Reviewer.extend({ reviewedWithoutOutputs: z.literal(true) }),
  cases: z.array(z.object({ id: z.string(), approved: z.boolean(), reason: z.string().min(1) })),
});
const AnswerReview = z.object({
  queryLanguage: z.enum(['en', 'ru']),
  answerLanguage: z.enum(['en', 'ru']),
  explicitView: z.boolean(),
  usefulQualifiedAnswer: z.boolean(),
  usefulQualifiedRetrieval: z.boolean(),
  justifiedAbstention: z.boolean(),
  languageCompliant: z.boolean().nullable(),
  qualificationPreserved: z.boolean(),
  unsafeFactualPromotion: z.boolean(),
  reason: z.string().min(1),
});
const OutputReview = z.object({
  schemaVersion: z.literal('language-output-review-v1'),
  packetFingerprint: z.string(),
  reviewer: Reviewer,
  cases: z.array(
    z.object({
      id: z.string(),
      run: z.number().int().positive(),
      retentionUseful: z.boolean(),
      retentionJustifiedHold: z.boolean(),
      knowledgeLanguageCompliant: z.boolean(),
      qualificationPreserved: z.boolean(),
      unsafeFactualPromotion: z.boolean(),
      reason: z.string().min(1),
      answers: z.array(AnswerReview).length(8),
    }),
  ),
});

/** The packet excludes runtime verifier decisions and aggregate scores from semantic adjudication. */
export function languageReviewPacket(reports: Report[], rawInputReview: unknown) {
  const inputReview = InputReview.parse(rawInputReview);
  const corpusVersion = reports[0]?.corpusVersion;
  const corpus =
    corpusVersion === 'language-discourse-v3'
      ? LANGUAGE_CORPUS_V3
      : corpusVersion === 'language-discourse-v4'
        ? LANGUAGE_CORPUS_V4
        : corpusVersion === 'language-discourse-v5'
          ? LANGUAGE_CORPUS_V5
          : corpusVersion === 'language-discourse-v6'
            ? LANGUAGE_CORPUS_V6
            : null;
  if (!corpus) throw new Error('unexpected corpus');
  const fingerprint = sha256(JSON.stringify(corpus));
  if (inputReview.corpusFingerprint !== fingerprint) throw new Error('stale input review');
  exactIds(
    inputReview.cases.map((entry) => entry.id),
    corpus.map((entry) => entry.id),
  );
  if (inputReview.cases.some((entry) => !entry.approved)) throw new Error('input expectations not approved');
  if (reports.length !== 2 || new Set(reports.map((report) => report.split)).size !== 2)
    throw new Error('both splits required');
  const first = reports[0]!;
  for (const report of reports) {
    if (report.schemaVersion !== 'language-benchmark-v2') throw new Error('unexpected report schema');
    if (report.corpusFingerprint !== fingerprint || report.corpusVersion !== corpusVersion)
      throw new Error('unexpected corpus');
    if (!Number.isInteger(report.runs) || report.runs < 2 || report.runs > 5 || report.runs !== first.runs)
      throw new Error('at least two complete equal run sets required');
    if (JSON.stringify(contract(report)) !== JSON.stringify(contract(first)))
      throw new Error('runtime contracts differ');
    if (
      report.knowledgeLanguage !== 'en' ||
      report.setup !== 'separate-writable-fidelity-and-read-only-admission'
    )
      throw new Error('unexpected evaluation setup');
    const expected = corpus.filter((entry) => entry.split === report.split);
    exactIds(
      report.selectedCaseIds,
      expected.map((entry) => entry.id),
    );
    exactIds(
      report.cases.map((entry) => `${entry.id}/${entry.run}`),
      expected.flatMap((entry) =>
        Array.from({ length: report.runs }, (_, index) => `${entry.id}/${index + 1}`),
      ),
    );
    for (const entry of report.cases) {
      // Reports arrive from JSON, not a typed caller. Missing output must not become a
      // present answer through undefined !== null and inflate independently reviewed coverage.
      if (
        entry.queries.some(
          (query) =>
            query.reviewAnswer !== null &&
            (typeof query.reviewAnswer !== 'string' || query.reviewAnswer.trim().length === 0),
        )
      )
        throw new Error('missing or invalid answer review evidence');
      if (typeof entry.availabilityFailure !== 'boolean') throw new Error('missing availability observation');
      if (!ReviewMaterial.safeParse(entry).success)
        throw new Error('missing or malformed retained/retrieval review evidence');
      const source = expected.find((candidate) => candidate.id === entry.id)!;
      if (entry.expectedHold !== (source.hold ?? false)) throw new Error('altered hold expectation');
      exactIds(entry.queries.map(queryKey), matrixKeys());
      if (entry.retainedItems !== entry.reviewKnowledge.length)
        throw new Error('inconsistent retained count');
      if (
        entry.queries.some(
          (query) => !query.reviewRetrieval || query.retainedEvidence !== query.reviewRetrieval.length,
        )
      )
        throw new Error('missing or inconsistent retrieval review evidence');
      const retrievals = new Map<string, string>();
      for (const query of entry.queries) {
        const key = `${query.queryLanguage}/${query.explicitView}`;
        const evidence = JSON.stringify(query.reviewRetrieval);
        if (retrievals.has(key) && retrievals.get(key) !== evidence)
          throw new Error('retrieval cannot differ by answer language');
        retrievals.set(key, evidence);
      }
    }
    separateReviewer(inputReview.reviewer, report);
  }
  const packet = {
    schemaVersion: 'language-review-packet-v1',
    corpusFingerprint: fingerprint,
    inputReviewFingerprint: sha256(JSON.stringify(inputReview)),
    reportFingerprints: reports.map((report) => sha256(JSON.stringify(report))).sort(),
    contract: contract(first),
    instructions:
      'Judge source entailment and useful records, not world truth. English is required for generated knowledge. Answer prose must follow its requested language; original names and citations may remain exact. A null answer is not a useful answer; judge its abstention separately. Read-only admission requires a hold. All qualifications must survive together, including nested attribution, fiction, incompatible alternatives and unknown source-relative time. Runtime verifier agreement is not an independent truth label.',
    cases: reports.flatMap((report) =>
      report.cases.map((entry) => ({
        id: entry.id,
        run: entry.run,
        source: corpus.find((source) => source.id === entry.id)!,
        reviewKnowledge: entry.reviewKnowledge,
        answers: entry.queries.map((query) => ({
          queryLanguage: query.queryLanguage,
          answerLanguage: query.requestedAnswerLanguage,
          explicitView: query.explicitView,
          retrievedEvidence: query.reviewRetrieval,
          answer: query.reviewAnswer,
        })),
      })),
    ),
  };
  return { ...packet, packetFingerprint: sha256(JSON.stringify(packet)) };
}

export const LANGUAGE_GATE_THRESHOLDS = {
  unsafeFactualPromotion: 0,
  acceptedLanguageViolations: 0,
  translationQualificationErrors: 0,
  sourceByteChanges: 0,
  usefulRetentionCoverage: 0.8,
  qualifiedRetrievalCoverage: 0.8,
  usefulQualifiedAnswerCoverage: 0.8,
  availabilityFailureRate: 0.05,
} as const;

/** Fail closed on missing, duplicated, stale, or internally contradictory adjudication. */
export function adjudicateLanguageGate(reports: Report[], inputReview: unknown, rawOutputReview: unknown) {
  const packet = languageReviewPacket(reports, inputReview);
  const review = OutputReview.parse(rawOutputReview);
  if (review.packetFingerprint !== packet.packetFingerprint) throw new Error('stale output review');
  for (const report of reports) separateReviewer(review.reviewer, report);
  exactIds(
    review.cases.map((entry) => `${entry.id}/${entry.run}`),
    packet.cases.map((entry) => `${entry.id}/${entry.run}`),
  );
  const failures: string[] = [];
  if (
    reports.some(
      (report) =>
        report.answerPromptVersion !== ANSWER_PROMPT_VERSION ||
        report.answerVerifierVersion !== ANSWER_VERIFIER_PROMPT_VERSION ||
        report.retentionPromptVersion !== RETAIN_PROMPT_VERSION ||
        report.retentionVerifierVersion !== RETAIN_VERIFIER_VERSION ||
        report.proseProjectionVersion !== PROSE_PROJECTION_VERSION ||
        report.memoryViewVersion !== MEMORY_VIEW_VERSION,
    )
  )
    failures.push('stale_runtime_contract');
  const groups = reports.flatMap((report) =>
    Array.from({ length: report.runs }, (_, index) => {
      const run = index + 1;
      const observations = report.cases.filter((entry) => entry.run === run);
      const useful = observations.filter((entry) => !entry.expectedHold);
      let retained = 0,
        safeHolds = 0,
        usefulAnswers = 0,
        usefulRetrievals = 0,
        justifiedAbstentions = 0;
      let promotions = 0,
        languageErrors = 0,
        qualificationErrors = 0;
      for (const observation of observations) {
        const judgment = review.cases.find((entry) => entry.id === observation.id && entry.run === run)!;
        exactIds(judgment.answers.map(answerKey), matrixKeys());
        if (
          (judgment.retentionUseful && observation.retainedItems === 0) ||
          (judgment.retentionJustifiedHold && observation.retainedItems > 0) ||
          (judgment.retentionUseful && judgment.retentionJustifiedHold)
        )
          throw new Error('inconsistent retention judgment');
        if (judgment.retentionUseful && !observation.expectedHold) retained++;
        if (judgment.retentionJustifiedHold && observation.expectedHold) safeHolds++;
        if (judgment.unsafeFactualPromotion) promotions++;
        if (!judgment.knowledgeLanguageCompliant) languageErrors++;
        if (!judgment.qualificationPreserved) qualificationErrors++;
        const retrievalJudgments = new Map<string, boolean>();
        for (const query of observation.queries) {
          const answer = judgment.answers.find((entry) => answerKey(entry) === queryKey(query))!;
          const present = query.reviewAnswer !== null;
          if (answer.usefulQualifiedRetrieval && query.reviewRetrieval.length === 0)
            throw new Error('inconsistent retrieval judgment');
          if (
            (!present && answer.usefulQualifiedAnswer) ||
            (present && answer.justifiedAbstention) ||
            (present && answer.languageCompliant === null) ||
            (!present && answer.languageCompliant !== null)
          )
            throw new Error('inconsistent answer judgment');
          if (answer.usefulQualifiedAnswer && !observation.expectedHold) usefulAnswers++;
          // Answer language does not rerun recall. Count each query/view retrieval once and
          // require consistent judgments when its evidence appears in both answer rows.
          const retrievalKey = `${query.queryLanguage}/${query.explicitView}`;
          if (retrievalJudgments.has(retrievalKey)) {
            if (retrievalJudgments.get(retrievalKey) !== answer.usefulQualifiedRetrieval)
              throw new Error('contradictory judgments for identical retrieval');
          } else {
            retrievalJudgments.set(retrievalKey, answer.usefulQualifiedRetrieval);
            if (answer.usefulQualifiedRetrieval && !observation.expectedHold) usefulRetrievals++;
          }
          if (answer.justifiedAbstention) justifiedAbstentions++;
          if (answer.unsafeFactualPromotion) promotions++;
          if (answer.languageCompliant === false) languageErrors++;
          if (!answer.qualificationPreserved) qualificationErrors++;
        }
      }
      const metrics = {
        usefulRetentionCoverage: rate(retained, useful.length),
        qualifiedRetrievalCoverage: rate(usefulRetrievals, useful.length * 4),
        usefulQualifiedAnswerCoverage: rate(usefulAnswers, useful.length * 8),
        justifiedAbstentions,
        expectedSafeHolds: rate(safeHolds, observations.filter((entry) => entry.expectedHold).length),
        unsafeFactualPromotion: promotions,
        acceptedLanguageViolations: languageErrors,
        translationQualificationErrors: qualificationErrors,
        sourceByteChanges: observations.filter((entry) => entry.bytesStable !== true).length,
        availabilityFailureRate: rate(
          observations.filter((entry) => entry.availabilityFailure).length,
          observations.length,
        ),
        ordinaryProseFailures: observations.filter((entry) => !entry.ordinaryCorrect).length,
      };
      const prefix = `${report.split}/run-${run}`;
      for (const key of [
        'usefulRetentionCoverage',
        'qualifiedRetrievalCoverage',
        'usefulQualifiedAnswerCoverage',
      ] as const)
        if (metrics[key].rate === null || metrics[key].rate! < LANGUAGE_GATE_THRESHOLDS[key])
          failures.push(`${prefix}:${key}`);
      for (const key of [
        'unsafeFactualPromotion',
        'acceptedLanguageViolations',
        'translationQualificationErrors',
        'sourceByteChanges',
      ] as const)
        if (metrics[key] > LANGUAGE_GATE_THRESHOLDS[key]) failures.push(`${prefix}:${key}`);
      if (
        metrics.availabilityFailureRate.rate === null ||
        metrics.availabilityFailureRate.rate > LANGUAGE_GATE_THRESHOLDS.availabilityFailureRate
      )
        failures.push(`${prefix}:availability`);
      if (metrics.expectedSafeHolds.denominator && metrics.expectedSafeHolds.rate !== 1)
        failures.push(`${prefix}:admission`);
      if (metrics.ordinaryProseFailures > 0) failures.push(`${prefix}:ordinaryProse`);
      return { split: report.split, run, metrics };
    }),
  );
  return {
    schemaVersion: 'language-quality-gate-v1',
    independentlyReviewed: true,
    adjudicationKind: review.reviewer.kind,
    reviewer: review.reviewer.id,
    releaseEligible: failures.length === 0,
    scope:
      review.reviewer.kind === 'model'
        ? 'Frozen invented English/Russian corpus; independent model adjudication is fallible and is not human validation or a general reliability guarantee.'
        : 'Independent human adjudication of a frozen invented English/Russian corpus; not a general reliability guarantee.',
    packetFingerprint: packet.packetFingerprint,
    inputReviewFingerprint: packet.inputReviewFingerprint,
    outputReviewFingerprint: sha256(JSON.stringify(review)),
    thresholds: LANGUAGE_GATE_THRESHOLDS,
    failures,
    groups,
  };
}

function exactIds(actual: string[], expected: string[]) {
  if (
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    actual.some((id) => !expected.includes(id))
  )
    throw new Error('incomplete or duplicate review matrix');
}
function separateReviewer(reviewer: z.infer<typeof Reviewer>, report: Report) {
  if (
    reviewer.kind === 'model' &&
    [report.models.answer, report.models.retention].some(
      (id) => id?.split('/').at(-1) === reviewer.id.split('/').at(-1),
    )
  )
    throw new Error('reviewer must differ from runtime models');
}
function matrixKeys() {
  return ['en', 'ru'].flatMap((query) =>
    ['en', 'ru'].flatMap((answer) => [false, true].map((explicit) => `${query}/${answer}/${explicit}`)),
  );
}
function queryKey(query: { queryLanguage: string; requestedAnswerLanguage: string; explicitView: boolean }) {
  return `${query.queryLanguage}/${query.requestedAnswerLanguage}/${query.explicitView}`;
}
function answerKey(answer: { queryLanguage: string; answerLanguage: string; explicitView: boolean }) {
  return `${answer.queryLanguage}/${answer.answerLanguage}/${answer.explicitView}`;
}
function rate(numerator: number, denominator: number) {
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}
function contract(report: Report) {
  return {
    models: report.models,
    proseProjectionVersion: report.proseProjectionVersion,
    memoryViewVersion: report.memoryViewVersion,
    answerPromptVersion: report.answerPromptVersion,
    answerVerifierVersion: report.answerVerifierVersion,
    retentionPromptVersion: report.retentionPromptVersion,
    retentionVerifierVersion: report.retentionVerifierVersion,
    knowledgeLanguage: report.knowledgeLanguage,
    setup: report.setup,
  };
}
