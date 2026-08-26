import { describe, expect, it } from 'vitest';
import { evaluateMergeDiscoveryScores, type MergeDiscoveryCategory } from './merge-discovery.ts';

type Score = {
  id: string;
  category: MergeDiscoveryCategory;
  expected: 'candidate' | 'keep_separate';
  score: number;
};

describe('merge discovery benchmark', () => {
  it('accepts a clean precision-first separation', () => {
    const report = evaluateMergeDiscoveryScores(
      [
        score('duplicate-a', 'duplicate', 'candidate', 0.91),
        score('duplicate-b', 'near_purpose', 'candidate', 0.88),
        score('duplicate-c', 'near_purpose', 'candidate', 0.86),
        score('scope', 'related_scope', 'keep_separate', 0.8),
        score('template', 'template', 'keep_separate', 0.72),
        score('collision', 'entity_collision', 'keep_separate', 0.74),
      ],
      0.83,
    );

    expect(report.passed).toBe(true);
    expect(report.metrics).toMatchObject({
      candidateRecall: 1,
      candidatePrecision: 1,
      falsePositiveRate: 0,
      relatedScopeRejection: 1,
      templateRejection: 1,
      entityCollisionRejection: 1,
    });
  });

  it('rejects a threshold that promotes a related scoped page', () => {
    const report = evaluateMergeDiscoveryScores(
      [
        score('duplicate-a', 'duplicate', 'candidate', 0.82),
        score('duplicate-b', 'near_purpose', 'candidate', 0.79),
        score('scope', 'related_scope', 'keep_separate', 0.84),
        score('template', 'template', 'keep_separate', 0.7),
        score('collision', 'entity_collision', 'keep_separate', 0.71),
      ],
      0.78,
    );

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain('related_scope_rejection');
    expect(report.blockers).toContain('candidate_precision');
    expect(report.blockers).toContain('score_margin');
  });
});

function score(
  id: string,
  category: MergeDiscoveryCategory,
  expected: Score['expected'],
  value: number,
): Score {
  return { id, category, expected, score: value };
}
