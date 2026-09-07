import { describe, expect, it } from 'vitest';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';
import { languageReviewPacket, adjudicateLanguageGate } from './language-review.ts';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../ops/answer.ts';
import { RETAIN_PROMPT_VERSION, RETAIN_VERIFIER_VERSION } from '../write/retain.ts';
import { PROSE_PROJECTION_VERSION } from '../kb/prose.ts';
import { MEMORY_VIEW_VERSION } from '../memory/intent.ts';
import { sha256 } from '../store/ids.ts';
import type { runLanguageBench } from './language.ts';

type Report = Awaited<ReturnType<typeof runLanguageBench>>;

/** Synthetic judgments exercise the gate's accounting and integrity, never model quality. */
function fixture() {
  const reviewer = {
    kind: 'model',
    id: 'invented-reviewer',
    independent: true,
    didNotAuthorCorpus: true,
    didNotTuneRuntime: true,
  };
  const fingerprint = sha256(JSON.stringify(LANGUAGE_CORPUS_V3));
  const inputs = {
    schemaVersion: 'language-input-review-v1',
    corpusFingerprint: fingerprint,
    reviewer: { ...reviewer, reviewedWithoutOutputs: true },
    cases: LANGUAGE_CORPUS_V3.map((entry) => ({
      id: entry.id,
      approved: true,
      reason: 'Invented review fixture.',
    })),
  };
  const reports = (['development', 'held-out'] as const).map((split) => ({
    corpusFingerprint: fingerprint,
    corpusVersion: 'language-discourse-v3',
    runs: 2,
    split,
    selectedCaseIds: LANGUAGE_CORPUS_V3.filter((entry) => entry.split === split).map((entry) => entry.id),
    models: { answer: 'invented-runtime', retention: 'invented-runtime' },
    answerPromptVersion: ANSWER_PROMPT_VERSION,
    answerVerifierVersion: ANSWER_VERIFIER_PROMPT_VERSION,
    retentionPromptVersion: RETAIN_PROMPT_VERSION,
    retentionVerifierVersion: RETAIN_VERIFIER_VERSION,
    proseProjectionVersion: PROSE_PROJECTION_VERSION,
    memoryViewVersion: MEMORY_VIEW_VERSION,
    knowledgeLanguage: 'en',
    setup: 'separate-writable-fidelity-and-read-only-admission',
    cases: [1, 2].flatMap((run) =>
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === split).map((entry) => ({
        id: entry.id,
        run,
        expectedHold: entry.hold ?? false,
        retainedItems: entry.hold ? 0 : 1,
        reviewKnowledge: entry.hold ? [] : [{ text: 'An invented qualified memory record.' }],
        availabilityFailure: false,
        bytesStable: true,
        ordinaryCorrect: true,
        queries: ['en', 'ru'].flatMap((queryLanguage) =>
          ['en', 'ru'].flatMap((requestedAnswerLanguage) =>
            [false, true].map((explicitView) => ({
              queryLanguage,
              requestedAnswerLanguage,
              explicitView,
              retainedEvidence: entry.hold ? 0 : 1,
              reviewRetrieval: entry.hold ? [] : [{ text: 'An invented qualified memory record.' }],
              reviewAnswer: entry.hold ? null : 'An invented qualified answer.',
            })),
          ),
        ),
      })),
    ),
  })) as unknown as Report[];
  const packet = languageReviewPacket(reports, inputs);
  const outputs = {
    schemaVersion: 'language-output-review-v1',
    packetFingerprint: packet.packetFingerprint,
    reviewer,
    cases: packet.cases.map((entry) => ({
      id: entry.id,
      run: entry.run,
      retentionUseful: !entry.source.hold,
      retentionJustifiedHold: entry.source.hold ?? false,
      knowledgeLanguageCompliant: true,
      qualificationPreserved: true,
      unsafeFactualPromotion: false,
      reason: 'Invented review fixture.',
      answers: entry.answers.map((answer) => ({
        queryLanguage: answer.queryLanguage,
        answerLanguage: answer.answerLanguage,
        explicitView: answer.explicitView,
        usefulQualifiedAnswer: answer.answer !== null,
        usefulQualifiedRetrieval: answer.retrievedEvidence.length > 0,
        justifiedAbstention: answer.answer === null,
        languageCompliant: answer.answer === null ? null : true,
        qualificationPreserved: true,
        unsafeFactualPromotion: false,
        reason: 'Invented review fixture.',
      })),
    })),
  };
  return { reports, inputs, outputs };
}

describe('independently adjudicated language gate', () => {
  it('accepts complete reviewed coverage with separately counted justified abstentions', () => {
    const { reports, inputs, outputs } = fixture();
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.releaseEligible).toBe(true);
    expect(gate.adjudicationKind).toBe('model');
    expect(gate.groups).toHaveLength(4);
    expect(gate.groups.find((group) => group.split === 'held-out')?.metrics.justifiedAbstentions).toBe(8);
  });

  it('rejects stale or duplicated review entries and runtime model self-adjudication', () => {
    const { reports, inputs, outputs } = fixture();
    expect(() => adjudicateLanguageGate(reports, inputs, { ...outputs, packetFingerprint: 'stale' })).toThrow(
      'stale',
    );
    expect(() =>
      adjudicateLanguageGate(reports, inputs, { ...outputs, cases: [...outputs.cases, outputs.cases[0]] }),
    ).toThrow('duplicate');
    expect(() =>
      adjudicateLanguageGate(reports, inputs, {
        ...outputs,
        reviewer: { ...outputs.reviewer, id: 'invented-runtime' },
      }),
    ).toThrow('differ');
    outputs.cases[0]!.answers[1] = outputs.cases[0]!.answers[0]!;
    expect(() => adjudicateLanguageGate(reports, inputs, outputs)).toThrow('duplicate');
  });

  it('cannot turn abstention or incomplete runs into successful coverage', () => {
    const { reports, inputs, outputs } = fixture();
    const hold = outputs.cases.find((entry) => entry.retentionJustifiedHold)!;
    hold.answers[0]!.usefulQualifiedAnswer = true;
    expect(() => adjudicateLanguageGate(reports, inputs, outputs)).toThrow('inconsistent');
    reports[0]!.cases.pop();
    expect(() => languageReviewPacket(reports, inputs)).toThrow('incomplete');
  });

  it('fails a weak run even when the other runs and runtime verifier are successful', () => {
    const { reports, inputs, outputs } = fixture();
    for (const entry of outputs.cases
      .filter((candidate) => candidate.id.startsWith('v3-dev') && candidate.run === 2)
      .slice(0, 2)) {
      entry.retentionUseful = false;
      for (const answer of entry.answers) answer.usefulQualifiedAnswer = false;
    }
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.releaseEligible).toBe(false);
    expect(gate.failures).toContain('development/run-2:usefulRetentionCoverage');
    expect(gate.failures).toContain('development/run-2:usefulQualifiedAnswerCoverage');
  });

  it('fails any accepted language, qualification, or factual-promotion error', () => {
    const { reports, inputs, outputs } = fixture();
    outputs.cases[0]!.answers[0]!.languageCompliant = false;
    outputs.cases[0]!.qualificationPreserved = false;
    outputs.cases[0]!.unsafeFactualPromotion = true;
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.failures).toContain('development/run-1:acceptedLanguageViolations');
    expect(gate.failures).toContain('development/run-1:translationQualificationErrors');
    expect(gate.failures).toContain('development/run-1:unsafeFactualPromotion');
  });

  it('does not count irrelevant retrieved records as qualified retrieval', () => {
    const { reports, inputs, outputs } = fixture();
    for (const entry of outputs.cases.filter(
      (candidate) => candidate.id.startsWith('v3-dev') && candidate.run === 1,
    ))
      for (const answer of entry.answers) answer.usefulQualifiedRetrieval = false;
    expect(adjudicateLanguageGate(reports, inputs, outputs).failures).toContain(
      'development/run-1:qualifiedRetrievalCoverage',
    );
    reports[0]!.cases[0]!.queries[0]!.reviewRetrieval = [];
    expect(() => languageReviewPacket(reports, inputs)).toThrow('retrieval review evidence');
  });

  it('rejects changed expectations and treats missing byte checks as failures', () => {
    const { reports, inputs, outputs } = fixture();
    reports[0]!.cases[0]!.expectedHold = true;
    expect(() => languageReviewPacket(reports, inputs)).toThrow('altered hold');
    reports[0]!.cases[0]!.expectedHold = false;
    reports[0]!.cases[0]!.bytesStable = null;
    outputs.packetFingerprint = languageReviewPacket(reports, inputs).packetFingerprint;
    expect(adjudicateLanguageGate(reports, inputs, outputs).failures).toContain(
      'development/run-1:sourceByteChanges',
    );
  });

  it('judges each query/view retrieval once regardless of answer language', () => {
    const { reports, inputs, outputs } = fixture();
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.groups[0]!.metrics.qualifiedRetrievalCoverage).toEqual({
      numerator: 20,
      denominator: 20,
      rate: 1,
    });
    outputs.cases[0]!.answers[0]!.usefulQualifiedRetrieval = false;
    expect(() => adjudicateLanguageGate(reports, inputs, outputs)).toThrow('contradictory judgments');
  });
});
