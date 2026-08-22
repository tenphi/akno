import { describe, expect, it } from 'vitest';
import type { AknoConfig } from '../config/schema.ts';
import { qualityFor, qualificationFor, runRankingBench } from './ranking.ts';

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

  it('runs the frozen fusion baseline without opening a knowledge base', async () => {
    const report = await runRankingBench({} as AknoConfig, { system: 'fusion' });

    expect(report.passed).toBe(true);
    expect(report.development).toBe(true);
    expect(report.releaseEligible).toBe(false);
    expect(report.corpus).toEqual({
      queries: 12,
      candidates: 96,
      categories: 8,
      version: 'invented-development-v1',
    });
    expect(report.quality).toEqual(report.fusionBaseline);
    expect(report.qualification).toBeNull();
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
