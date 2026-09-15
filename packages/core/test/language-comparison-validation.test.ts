import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertComparisonComplete,
  validateComparison,
} from '../../../scripts/language-comparison-validation.mjs';

function completeRun() {
  const plan = { runs: 2 };
  const fixtures = [{ id: 'invented', path: 'retained', view: 'factual', queries: { en: 'Case color?' } }];
  const answer = { answer: null, answer_language: 'en', memory_view: 'factual' };
  const arm = {
    read: [],
    projections: [],
    queries: [false, true].map((explicit) => ({
      language: 'en',
      query: 'Case color?',
      explicit,
      expectedView: 'factual',
      view: 'factual',
      contextView: 'factual',
      answers: [structuredClone(answer)],
    })),
    factualControl: { query: 'Case color?', context: { memory_view: 'factual' }, answer },
  };
  const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return {
    plan,
    fixtures,
    manifest: {
      mode: 'offline-downstream-comparison',
      planSha256: fingerprint(plan),
      fixturesSha256: fingerprint(fixtures),
    },
    completion: {
      expected: 1,
      pairs: 1,
      attemptedPairs: 1,
      failedPairs: 0,
      unstartedPairs: 0,
      fatalErrors: [],
      runtimeUnchanged: true,
      requests: 0,
    },
    results: [
      { id: 'invented', run: 1, arms: { baseline: structuredClone(arm), candidate: structuredClone(arm) } },
    ],
    receipts: [] as { sequence: number }[],
  };
}

describe('paired comparison completeness', () => {
  it('accepts a complete fixed grid, including recorded null outcomes', () => {
    expect(() => validateComparison(completeRun())).not.toThrow();
  });

  it('rejects an empty index even when the receipt still declares a complete run', () => {
    const run = completeRun();
    run.results = [];
    expect(() => validateComparison(run)).toThrow('Result index is incomplete');
  });

  it.each(['query', 'answer', 'language', 'view', 'factual', 'fixture'])(
    'rejects missing or changed %s observations instead of shrinking the denominator',
    (kind) => {
      const run = completeRun();
      const arm = run.results[0]!.arms.candidate;
      if (kind === 'query') arm.queries.pop();
      if (kind === 'answer') arm.queries[0]!.answers.pop();
      if (kind === 'language') arm.queries[0]!.answers[0]!.answer_language = 'ru';
      if (kind === 'view') arm.queries[0]!.answers[0]!.memory_view = 'reports';
      if (kind === 'factual') arm.factualControl.answer.memory_view = 'reports';
      if (kind === 'fixture') run.fixtures[0]!.queries.en = 'Different question?';
      expect(() => validateComparison(run)).toThrow();
    },
  );

  it('rejects duplicate pairs even when the pair count is correct', () => {
    const run = completeRun();
    run.fixtures.push({ ...run.fixtures[0]!, id: 'another-invented' });
    run.manifest.fixturesSha256 = createHash('sha256').update(JSON.stringify(run.fixtures)).digest('hex');
    run.completion.expected = run.completion.pairs = run.completion.attemptedPairs = 2;
    run.results.push(structuredClone(run.results[0]!));
    expect(() => validateComparison(run)).toThrow('Duplicate pair');
  });

  it('rejects a truncated network ledger', () => {
    const run = completeRun();
    run.completion.requests = 1;
    expect(() => validateComparison(run)).toThrow('Incomplete network ledger');
  });

  it('rejects a missing factual outcome rather than treating it as an executed control', () => {
    const run = completeRun();
    Reflect.deleteProperty(run.results[0]!.arms.candidate.factualControl.answer, 'answer');
    expect(() => validateComparison(run)).toThrow('Missing factual answer outcome');
  });

  it('rejects a missing source-read snapshot', () => {
    const run = completeRun();
    Reflect.deleteProperty(run.results[0]!.arms.candidate, 'read');
    expect(() => validateComparison(run)).toThrow('Missing read snapshot');
  });

  it('makes a completed-but-failed pair fail the runner completion check', () => {
    const run = completeRun();
    run.completion.failedPairs = 1;
    expect(() => assertComparisonComplete(run.completion)).toThrow('Failed pairs');
  });
});
