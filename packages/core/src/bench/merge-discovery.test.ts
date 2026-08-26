import { describe, expect, it } from 'vitest';
import {
  evaluateMergeDiscoveryScores,
  evaluateMergeDiscoveryStability,
  markMergeDiscoveryBenchPersisted,
  runMergeDiscoveryBench,
  type MergeDiscoveryBenchReport,
  type MergeDiscoveryCategory,
  type MergeDiscoveryClassifierReport,
} from './merge-discovery.ts';
import { mergeDiscoveryCorpus } from './merge-discovery-corpus.ts';

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

  it('reports a classifier decision that changes between repeated runs', () => {
    const cases = mergeDiscoveryCorpus('test').cases.slice(0, 2);
    const first = classifierRun(1, ['same_subject', 'same_subject']);
    const second = classifierRun(2, ['keep_separate', 'same_subject']);

    expect(evaluateMergeDiscoveryStability([first, second], cases, 2)).toEqual({
      requestedRuns: 2,
      completedRuns: 2,
      passingRuns: 1,
      stableCaseRate: 0.5,
      flakyCaseIds: [cases[0]!.id],
    });
  });

  it('refuses to start the held-out model path without independent review evidence', async () => {
    await expect(runMergeDiscoveryBench({} as never, { split: 'test', runs: 5 })).rejects.toThrow(
      'requires an approved review packet',
    );
  });

  it('requires persisted reviewed held-out evidence and five runs for release', () => {
    const report = {
      split: 'test',
      blockers: [],
      corpus: { independentlyReviewed: true },
      stability: { requestedRuns: 5 },
      artifactPersisted: false,
      releaseEligible: false,
      releaseBlockers: [],
    } as unknown as MergeDiscoveryBenchReport;

    expect(markMergeDiscoveryBenchPersisted(report)).toMatchObject({
      artifactPersisted: true,
      releaseEligible: true,
      releaseBlockers: [],
    });
    expect(
      markMergeDiscoveryBenchPersisted({
        ...report,
        split: 'development',
      }).releaseBlockers,
    ).toContain('held_out_split');
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

function classifierRun(
  run: number,
  decisions: Array<'same_subject' | 'keep_separate'>,
): MergeDiscoveryClassifierReport {
  const cases = mergeDiscoveryCorpus('test').cases.slice(0, 2);
  const reports = cases.map((benchCase, index) => ({
    id: benchCase.id,
    category: benchCase.category,
    expected: benchCase.expected,
    score: 0.9,
    prefiltered: true,
    outcome: decisions[index]!,
    valid: true,
    passed: decisions[index] === 'same_subject',
    latencyMs: 11,
  }));
  return {
    run,
    provider: 'invented',
    model: 'invented',
    reasoningEffort: 'none',
    promptVersion: 'invented',
    prefilterThreshold: 0.68,
    calls: reports.length,
    metrics: {
      validResponseRate: 1,
      candidateRecall: reports.filter((report) => report.outcome === 'same_subject').length / reports.length,
      candidatePrecision: 1,
      falsePositiveRate: 0,
      relatedScopeRejection: 1,
      templateRejection: 1,
      entityCollisionRejection: 1,
    },
    cases: reports,
    passed: reports.every((report) => report.passed),
    blockers: reports.every((report) => report.passed) ? [] : ['candidate_recall'],
  };
}
