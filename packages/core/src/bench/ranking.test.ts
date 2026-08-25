import { describe, expect, it } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import { RANKING_CORPUS, rankingCorpusCases } from './ranking-corpus.ts';
import { rankingCorpusFingerprint } from './ranking-review.ts';
import { qualityFor, qualificationFor, runRankingBench, validateRankingCorpus } from './ranking.ts';

describe('ranking benchmark metrics', () => {
  const judgments = { grades: [3, 2, 1, 0] as (0 | 1 | 2 | 3)[] };

  it('gives an ideal order perfect graded and direct-answer metrics', () => {
    expect(qualityFor(judgments, [0, 1, 2, 3])).toEqual({
      ndcgAt10: 1,
      mrrAt10: 1,
      successAt1: 1,
      successAt3: 1,
      precisionAt5: 0.5,
      gradeZeroAboveGradeThree: 0,
    });
  });

  it('counts an irrelevant candidate placed above the direct answer', () => {
    const result = qualityFor(judgments, [3, 0, 1, 2]);
    expect(result.ndcgAt10).toBeLessThan(1);
    expect(result.mrrAt10).toBe(0.5);
    expect(result.gradeZeroAboveGradeThree).toBe(1);
  });

  it('validates the frozen, stratified corpus', () => {
    expect(validateRankingCorpus).not.toThrow();
    expect(Object.keys(RANKING_CORPUS.candidates)).toHaveLength(120);
    expect(RANKING_CORPUS.cases).toHaveLength(80);
    expect(rankingCorpusCases('development')).toHaveLength(60);
    expect(rankingCorpusCases('test')).toHaveLength(20);
    expect(rankingCorpusFingerprint()).toBe(
      '9a758cb92065206eeab499ca53199d4c39f9e0287913b2040273c06edd62e05c',
    );
    expect(
      Object.fromEntries(
        rankingCorpusCases('test').map((entry) => [
          entry.category,
          rankingCorpusCases('test').filter((candidate) => candidate.category === entry.category).length,
        ]),
      ),
    ).toEqual({
      exact_entity: 3,
      paraphrased_attribute: 4,
      direct_answer: 3,
      temporal: 3,
      negation: 2,
      ambiguous_identity: 2,
      provenance: 2,
      instruction_bearing: 1,
    });
  });

  it('runs the development fusion baseline without opening a knowledge base', async () => {
    const report = await runRankingBench({} as AknoConfig, { system: 'fusion' });

    expect(report.passed).toBe(true);
    expect(report.development).toBe(true);
    expect(report.releaseEligible).toBe(false);
    expect(report.corpus).toEqual({
      queries: 60,
      sources: 120,
      judgments: 1200,
      categories: 8,
      version: 'invented-ranking-v5',
      fingerprint: rankingCorpusFingerprint(),
    });
    expect(report.split).toBe('development');
    expect(report.byCategory).toHaveLength(8);
    expect(report.quality).toEqual(report.fusionBaseline);
    expect(report.qualification).toBeNull();
  });

  it('keeps fresh negative claims false and grades overlapping cross-fact evidence by meaning', () => {
    const calibrationNegation = RANKING_CORPUS.cases.find(
      (benchCase) => benchCase.id === 'qx100-calibration-code-negation-01',
    );
    expect(calibrationNegation?.query).toContain('the current calibration code is CAL-1111');
    expect(calibrationNegation?.judgments['qx100-calibration-code-direct']).toBe(3);
    expect(calibrationNegation?.judgments['qx100-calibration-code-negative']).toBe(0);
    expect(RANKING_CORPUS.candidates['qx100-calibration-code-direct']?.text).toContain('CAL-2222');

    const meetingDateDirect = RANKING_CORPUS.candidates['blackwater-meeting-date-direct']!;
    const meetingDateSupport = RANKING_CORPUS.candidates['blackwater-meeting-date-support']!;
    const meetingDateMarginal = RANKING_CORPUS.candidates['blackwater-meeting-date-marginal']!;
    expect(meetingDateDirect.text).toContain('Blackwater Bay');
    expect(meetingDateSupport.text).toContain('Blackwater Bay');
    const directGrades = RANKING_CORPUS.cases
      .filter((entry) => entry.id.startsWith('blackwater-meeting-place'))
      .flatMap((benchCase) =>
        benchCase.pool.includes(meetingDateDirect.id) ? [benchCase.judgments[meetingDateDirect.id]] : [],
      );
    expect(directGrades.length).toBeGreaterThan(0);
    expect(directGrades.every((grade) => grade === 3)).toBe(true);
    const supportGrades = RANKING_CORPUS.cases
      .filter((entry) => entry.id.startsWith('blackwater-meeting-place'))
      .flatMap((benchCase) =>
        benchCase.pool.includes(meetingDateSupport.id) ? [benchCase.judgments[meetingDateSupport.id]] : [],
      );
    expect(supportGrades.length).toBeGreaterThan(0);
    expect(supportGrades.every((grade) => grade === 2)).toBe(true);
    const marginalGrades = RANKING_CORPUS.cases
      .filter((entry) => entry.id.startsWith('blackwater-meeting-place'))
      .flatMap((benchCase) =>
        benchCase.pool.includes(meetingDateMarginal.id) ? [benchCase.judgments[meetingDateMarginal.id]] : [],
      );
    expect(marginalGrades.length).toBeGreaterThan(0);
    expect(marginalGrades.every((grade) => grade === 1)).toBe(true);
  });

  it('uses the held-out split only when explicitly selected', async () => {
    const report = await runRankingBench({} as AknoConfig, { system: 'fusion', split: 'test' });

    expect(report.split).toBe('test');
    expect(report.corpus.queries).toBe(20);
    expect(report.corpus.judgments).toBe(400);
    expect(report.byCategory.every((category) => category.queries > 0)).toBe(true);
    expect(report.releaseEligible).toBe(false);
  });

  it('selects a frozen candidate-count slice and records bounded execution settings', async () => {
    const report = await runRankingBench({} as AknoConfig, {
      system: 'fusion',
      candidateCount: 40,
      excerptChars: 400,
      concurrency: 99,
    });

    expect(report.corpus.judgments).toBe(2400);
    expect(report.execution).toMatchObject({ candidateCount: 40, excerptChars: 400, concurrency: 16 });
    expect(report.queries.every((query) => query.order.length === 40)).toBe(true);
  });

  it('reports qualification separately at each relevance grade', () => {
    expect(
      qualificationFor([
        { grade: 3, rejected: false },
        { grade: 3, rejected: true },
        { grade: 2, rejected: false },
        { grade: 2, rejected: true },
        { grade: 1, rejected: false },
        { grade: 1, rejected: true },
        { grade: 0, rejected: false, instructionBearing: true },
        { grade: 0, rejected: true, instructionBearing: true },
      ]),
    ).toEqual({
      answerRetention: 0.5,
      supportRetention: 0.5,
      marginalRetention: 0.5,
      irrelevantRejection: 0.5,
      retainedPrecision: 0.5,
      instructionNegativeRejection: 0.5,
    });
  });
});
