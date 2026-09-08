import { describe, expect, it } from 'vitest';
import { LANGUAGE_CORPUS_V11 } from './language-corpus-v11.ts';
import { LANGUAGE_CORPUS_V12 } from './language-corpus-v12.ts';
import { LANGUAGE_CORPUS_V13 } from './language-corpus-v13.ts';
import { LANGUAGE_CORPUS_V14 } from './language-corpus-v14.ts';
import { LANGUAGE_CORPUS_V15 } from './language-corpus-v15.ts';
import { LANGUAGE_CORPUS_V10 } from './language-corpus-v10.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';
import { languageReviewPacket, adjudicateLanguageGate, languageGateThresholds } from './language-review.ts';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../ops/answer.ts';
import { RETAIN_PROMPT_VERSION, RETAIN_VERIFIER_VERSION } from '../write/retain.ts';
import { PROSE_PROJECTION_VERSION } from '../kb/prose.ts';
import { MEMORY_VIEW_VERSION } from '../memory/intent.ts';
import { sha256 } from '../store/ids.ts';
import type { runLanguageBench } from './language.ts';

type Report = Awaited<ReturnType<typeof runLanguageBench>>;

/** Synthetic judgments exercise the gate's accounting and integrity, never model quality. */
function fixture(version: 'v3' | 'v10' | 'v11' | 'v12' | 'v13' | 'v14' | 'v15' = 'v3') {
  const corpus =
    version === 'v3'
      ? LANGUAGE_CORPUS_V3
      : version === 'v10'
        ? LANGUAGE_CORPUS_V10
        : version === 'v11'
          ? LANGUAGE_CORPUS_V11
          : version === 'v12'
            ? LANGUAGE_CORPUS_V12
            : version === 'v13'
              ? LANGUAGE_CORPUS_V13
              : version === 'v14'
                ? LANGUAGE_CORPUS_V14
                : LANGUAGE_CORPUS_V15;
  const evidence = {
    text: 'An invented qualified memory record.',
    qualification: {
      status: 'qualified',
      id: 'mem_1111',
      level: 1,
      kind: 'claim',
      subject: 'unresolved',
      source_role: 'user',
      commitment: 'hypothetical',
      disposition: 'active',
      polarity: 'affirmed',
      basis: 'self_attested',
      answer_eligible: false,
      current_eligible: false,
    },
  };
  const reviewer = {
    kind: 'model',
    id: 'invented-reviewer',
    independent: true,
    didNotAuthorCorpus: true,
    didNotTuneRuntime: true,
  };
  const fingerprint = sha256(JSON.stringify(corpus));
  const inputs = {
    schemaVersion: 'language-input-review-v1',
    corpusFingerprint: fingerprint,
    reviewer: { ...reviewer, reviewedWithoutOutputs: true },
    cases: corpus.map((entry) => ({
      id: entry.id,
      approved: true,
      reason: 'Invented review fixture.',
    })),
  };
  const reports = (['development', 'held-out'] as const).map((split) => ({
    schemaVersion: 'language-benchmark-v2',
    corpusFingerprint: fingerprint,
    corpusVersion: `language-discourse-${version}`,
    runs: 2,
    split,
    selectedCaseIds: corpus.filter((entry) => entry.split === split).map((entry) => entry.id),
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
      corpus
        .filter((entry) => entry.split === split)
        .map((entry) => ({
          id: entry.id,
          language: entry.language,
          scenario: entry.scenario,
          run,
          expectedHold: entry.hold ?? false,
          retainedItems: entry.hold ? 0 : 1,
          reviewKnowledge: entry.hold ? [] : [evidence],
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
                reviewRetrieval: entry.hold ? [] : [evidence],
                reviewAnswer: entry.hold ? null : 'An invented qualified answer.',
              })),
            ),
          ),
        })),
    ),
  })) as unknown as Report[];
  const packet = languageReviewPacket(reports, inputs);
  const outputs = {
    schemaVersion: ['v13', 'v14', 'v15'].includes(version)
      ? 'language-output-review-v2'
      : 'language-output-review-v1',
    packetFingerprint: packet.packetFingerprint,
    reviewer,
    cases: packet.cases.map((entry) => ({
      id: entry.id,
      run: entry.run,
      retentionUseful: !entry.source.hold,
      retentionJustifiedHold: entry.source.hold ?? false,
      ...(['v13', 'v14', 'v15'].includes(version) ? { retainedSourceEntailed: true } : {}),
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
        ...(['v13', 'v14', 'v15'].includes(version)
          ? { sourceEntailed: answer.answer === null ? null : true }
          : {}),
        qualificationPreserved: true,
        unsafeFactualPromotion: false,
        reason: 'Invented review fixture.',
      })),
    })),
  };
  return { reports, inputs, outputs };
}

describe('independently adjudicated language gate', () => {
  it.each([8, 9])('enforces the declared 90% boundary in every broader-corpus run (%s misses)', (misses) => {
    const { reports, inputs, outputs } = fixture('v10');
    const held = reports.find((report) => report.split === 'held-out')!;
    const ids = new Set(
      held.cases.filter((entry) => entry.run === 1 && !entry.expectedHold).map((entry) => entry.id),
    );
    outputs.cases
      .filter((entry) => entry.run === 1 && ids.has(entry.id))
      .flatMap((entry) => entry.answers)
      .slice(0, misses)
      .forEach((answer) => {
        answer.usefulQualifiedAnswer = false;
      });
    held.thresholds = { ...languageGateThresholds(held.corpusVersion), usefulQualifiedAnswerCoverage: 0 };
    outputs.packetFingerprint = languageReviewPacket(reports, inputs).packetFingerprint;
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.thresholds.usefulQualifiedAnswerCoverage).toBe(0.9);
    expect(gate.releaseEligible).toBe(misses === 8);
    expect(gate.failures).toEqual(misses === 8 ? [] : ['held-out/run-1:usefulQualifiedAnswerCoverage']);
    const group = gate.groups.find((entry) => entry.split === 'held-out' && entry.run === 1)!;
    expect(group.metrics.usefulQualifiedAnswerCoverage).toEqual({
      numerator: 80 - misses,
      denominator: 80,
      rate: (80 - misses) / 80,
    });
    for (const dimension of [
      'bySourceLanguage',
      'byScenario',
      'byQueryLanguage',
      'byAnswerLanguage',
    ] as const) {
      const rows = Object.values(group.breakdowns![dimension]);
      expect(rows.reduce((sum, row) => sum + row.usefulQualifiedAnswerCoverage.numerator, 0)).toBe(
        80 - misses,
      );
      expect(rows.reduce((sum, row) => sum + row.usefulQualifiedAnswerCoverage.denominator, 0)).toBe(80);
    }
  });

  it.each(['v11', 'v12', 'v13', 'v14', 'v15'] as const)(
    'keeps the stronger gate and complete breakdowns for fresh corpus %s',
    (version) => {
      const { reports, inputs, outputs } = fixture(version);
      const gate = adjudicateLanguageGate(reports, inputs, outputs);
      expect(gate.releaseEligible).toBe(true);
      expect(gate.thresholds.usefulQualifiedAnswerCoverage).toBe(0.9);
      expect(gate.groups.every((group) => Object.keys(group.breakdowns!.byAnswerLanguage).length === 2)).toBe(
        true,
      );
    },
  );

  it('fails qualified but source-unsupported output even when coverage remains above its thresholds', () => {
    const { reports, inputs, outputs } = fixture('v13');
    outputs.cases[0]!.retentionUseful = false;
    outputs.cases[0]!.retainedSourceEntailed = false;
    outputs.cases[0]!.answers[0]!.usefulQualifiedAnswer = false;
    outputs.cases[0]!.answers[0]!.sourceEntailed = false;
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.schemaVersion).toBe('language-quality-gate-v2');
    expect(gate.releaseEligible).toBe(false);
    expect(gate.failures).toEqual([
      'development/run-1:unsupportedRetainedOutputs',
      'development/run-1:unsupportedNonnullAnswers',
    ]);
    expect(gate.groups[0]!.metrics.usefulQualifiedAnswerCoverage.rate).toBe(79 / 80);
    expect(gate.groups[0]!.metrics.translationQualificationErrors).toBe(0);
  });

  it('records a failed precision gate for a useful mixed retained set', () => {
    const { reports, inputs, outputs } = fixture('v13');
    const observation = reports[0]!.cases[0]!;
    observation.retainedItems = 2;
    observation.reviewKnowledge.push({
      ...observation.reviewKnowledge[0]!,
      text: 'An additional unsupported invented record.',
    });
    outputs.packetFingerprint = languageReviewPacket(reports, inputs).packetFingerprint;
    outputs.cases[0]!.retainedSourceEntailed = false;
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.releaseEligible).toBe(false);
    expect(gate.failures).toEqual(['development/run-1:unsupportedRetainedOutputs']);
    expect(gate.groups[0]!.metrics.unsupportedRetainedOutputs).toBe(1);
    expect(gate.groups[0]!.metrics.usefulRetentionCoverage.rate).toBe(1);
  });

  it('allows focused source-entailed answers and distinguishes nulls from unsupported assertions', () => {
    const { reports, inputs, outputs } = fixture('v13');
    expect(outputs.cases.some((c) => c.answers.some((a) => a.sourceEntailed === null))).toBe(true);
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(gate.releaseEligible).toBe(true);
    expect(gate.thresholds.unsupportedRetainedOutputs).toBe(0);
    expect(gate.thresholds.unsupportedNonnullAnswers).toBe(0);
    expect(gate.groups.every((g) => g.metrics.unsupportedNonnullAnswers === 0)).toBe(true);
  });

  it.each([
    'missing-retained',
    'missing-answer',
    'spoofed-retained',
    'spoofed-answer',
    'null-present',
    'false-absent',
    'false-empty',
    'legacy-schema',
  ])('fails closed on invalid source-entailment adjudication: %s', (mode) => {
    const { reports, inputs, outputs } = fixture('v13');
    const first = outputs.cases[0]!;
    const empty = outputs.cases.find((c) => c.retentionJustifiedHold)!;
    if (mode === 'missing-retained') delete first.retainedSourceEntailed;
    if (mode === 'missing-answer') delete first.answers[0]!.sourceEntailed;
    if (mode === 'spoofed-retained') Object.assign(first, { retainedSourceEntailed: 'true' });
    if (mode === 'spoofed-answer') Object.assign(first.answers[0]!, { sourceEntailed: 'true' });
    if (mode === 'null-present') first.answers[0]!.sourceEntailed = null;
    if (mode === 'false-absent') empty.answers[0]!.sourceEntailed = false;
    if (mode === 'false-empty') empty.retainedSourceEntailed = false;
    if (mode === 'legacy-schema') outputs.schemaVersion = 'language-output-review-v1';
    expect(() => adjudicateLanguageGate(reports, inputs, outputs)).toThrow();
  });

  it.each(['v14', 'v15'] as const)(
    'keeps the source-entailment schema and zero thresholds for %s',
    (version) => {
      const { reports, inputs, outputs } = fixture(version);
      outputs.cases[0]!.answers[0]!.usefulQualifiedAnswer = false;
      outputs.cases[0]!.answers[0]!.sourceEntailed = false;
      const gate = adjudicateLanguageGate(reports, inputs, outputs);
      expect(gate.schemaVersion).toBe('language-quality-gate-v2');
      expect(gate.thresholds.unsupportedNonnullAnswers).toBe(0);
      expect(gate.thresholds.usefulQualifiedAnswerCoverage).toBe(0.9);
      expect(gate.failures).toEqual(['development/run-1:unsupportedNonnullAnswers']);
      outputs.schemaVersion = 'language-output-review-v1';
      expect(() => adjudicateLanguageGate(reports, inputs, outputs)).toThrow();
    },
  );

  it('leaves historical review schemas and policy unchanged', () => {
    const { reports, inputs, outputs } = fixture('v12');
    const packet = languageReviewPacket(reports, inputs);
    const gate = adjudicateLanguageGate(reports, inputs, outputs);
    expect(packet.schemaVersion).toBe('language-review-packet-v1');
    expect(gate.schemaVersion).toBe('language-quality-gate-v1');
    expect(gate.thresholds).not.toHaveProperty('unsupportedRetainedOutputs');
    expect(gate.groups[0]!.metrics).not.toHaveProperty('unsupportedNonnullAnswers');
  });

  it('preserves the original policy for historical corpora', () => {
    expect(languageGateThresholds('language-discourse-v9').usefulQualifiedAnswerCoverage).toBe(0.8);
    const { reports, inputs, outputs } = fixture();
    expect(adjudicateLanguageGate(reports, inputs, outputs).thresholds.usefulQualifiedAnswerCoverage).toBe(
      0.8,
    );
  });

  it('binds broader-corpus breakdown dimensions to frozen sources', () => {
    const { reports, inputs } = fixture('v10');
    reports[0]!.cases[0]!.language = 'mixed';
    reports[0]!.cases[0]!.scenario = 'invented-altered-scenario';
    expect(() => languageReviewPacket(reports, inputs)).toThrow('source dimensions');
  });

  it.each([
    { reviewRetrieval: 'x', retainedEvidence: 1 },
    { reviewRetrieval: {}, retainedEvidence: undefined },
    { reviewRetrieval: [] },
    { reviewRetrieval: [{ text: 'An invented record without qualification.' }], retainedEvidence: 1 },
  ])('rejects malformed raw retrieval evidence: %s', (value) => {
    const { reports, inputs } = fixture();
    Object.assign(reports[0]!.cases[0]!.queries[0]!, { retainedEvidence: undefined }, value);
    expect(() => languageReviewPacket(JSON.parse(JSON.stringify(reports)), inputs)).toThrow(
      'review evidence',
    );
  });

  it('rejects malformed retained knowledge before exposing it to a reviewer', () => {
    const { reports, inputs } = fixture();
    Object.assign(reports[0]!.cases[0]!, { reviewKnowledge: 'x', retainedItems: 1 });
    expect(() => languageReviewPacket(reports, inputs)).toThrow('review evidence');
  });

  it.each([undefined, '', '  ', false, 11, {}])(
    'rejects missing or malformed raw answer output: %s',
    (value) => {
      const { reports, inputs, outputs } = fixture();
      const query = reports[0]!.cases[0]!.queries[0]!;
      Object.assign(query, { reviewAnswer: value });
      const rawReports = JSON.parse(JSON.stringify(reports));
      expect(() => languageReviewPacket(rawReports, inputs)).toThrow('answer review evidence');
      expect(() => adjudicateLanguageGate(rawReports, inputs, outputs)).toThrow('answer review evidence');
    },
  );

  it('rejects unknown report versions and missing availability observations', () => {
    const { reports, inputs } = fixture();
    Object.assign(reports[0]!, { schemaVersion: 'unknown' });
    expect(() => languageReviewPacket(reports, inputs)).toThrow('report schema');
    Object.assign(reports[0]!, { schemaVersion: 'language-benchmark-v2' });
    Object.assign(reports[0]!.cases[0]!, { availabilityFailure: undefined });
    expect(() => languageReviewPacket(reports, inputs)).toThrow('availability observation');
  });

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
