import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function assertComparisonComplete(completion) {
  assert(Number.isSafeInteger(completion.expected) && completion.expected > 0, 'Empty experiment.');
  assert(completion.runtimeUnchanged, 'A frozen runtime changed during execution.');
  assert.equal(completion.pairs, completion.expected, 'Missing pairs.');
  assert.equal(completion.attemptedPairs, completion.expected, 'Unattempted pairs.');
  assert.equal(completion.failedPairs, 0, 'Failed pairs.');
  assert.equal(completion.unstartedPairs, 0, 'Unstarted pairs.');
  assert.deepEqual(completion.fatalErrors, [], 'Fatal execution errors.');
}

/** A completion receipt cannot establish that its indexed observations are still complete. */
export function validateComparison({ plan, manifest, fixtures, results, completion, receipts }) {
  assertComparisonComplete(completion);
  assert.equal(hash(plan), manifest.planSha256, 'Plan fingerprint mismatch.');
  assert.equal(hash(fixtures), manifest.fixturesSha256, 'Fixture fingerprint mismatch.');
  assert(['offline-downstream-comparison', 'coupled-live-downstream-comparison'].includes(manifest.mode));
  const live = manifest.mode === 'coupled-live-downstream-comparison';
  const runs = live ? plan.runs : 1;
  assert(Number.isSafeInteger(runs) && runs > 0);
  assert(fixtures.length > 0 && new Set(fixtures.map((fixture) => fixture.id)).size === fixtures.length);
  if (live)
    assert.deepEqual(
      fixtures.map((fixture) => ({ id: fixture.id, language: Object.keys(fixture.queries).join(',') })),
      plan.liveCases,
      'Live selection mismatch.',
    );
  assert.equal(completion.expected, fixtures.length * runs, 'Incorrect declared pair count.');
  assert.equal(results.length, completion.expected, 'Result index is incomplete.');
  const coordinates = new Set();
  for (const pair of results) {
    const fixture = fixtures.find((entry) => entry.id === pair.id);
    assert(fixture && Number.isSafeInteger(pair.run) && pair.run >= 1 && pair.run <= runs);
    const coordinate = JSON.stringify([pair.id, pair.run]);
    assert(!coordinates.has(coordinate), 'Duplicate pair.');
    coordinates.add(coordinate);
    assert.deepEqual(Object.keys(pair.arms).sort(), ['baseline', 'candidate']);
    const expectedQueries = Object.entries(fixture.queries).flatMap(([language, query]) =>
      [false, true].map((explicit) => ({ language, query, explicit, expectedView: fixture.view })),
    );
    assert(expectedQueries.length > 0, 'Missing fixture queries.');
    for (const arm of Object.values(pair.arms)) {
      assert(!arm.harnessError, 'Failed arm.');
      assert(Array.isArray(arm.read), 'Missing read snapshot.');
      assert.deepEqual(
        arm.queries.map(({ language, query, explicit, expectedView }) => ({
          language,
          query,
          explicit,
          expectedView,
        })),
        expectedQueries,
        'Missing or changed query coordinates.',
      );
      assert.deepEqual(
        arm.projections.map(({ n, view }) => ({ n, view })),
        fixture.projections ?? [],
        'Missing projection checks.',
      );
      for (const query of arm.queries) {
        assert.deepEqual(
          query.answers.map((answer) => answer.answer_language),
          live ? ['en', 'ru'] : ['en'],
        );
        assert.equal(query.contextView, query.view, 'Context and recall views disagree.');
        for (const answer of query.answers) {
          assert.equal(answer.memory_view, query.view, 'Answer and recall views disagree.');
          assert(answer.answer === null || typeof answer.answer === 'string', 'Missing answer outcome.');
        }
      }
      assert.equal(arm.factualControl.query, Object.values(fixture.queries)[0]);
      assert.equal(arm.factualControl.context.memory_view, 'factual');
      assert.equal(arm.factualControl.answer.memory_view, 'factual');
      assert.equal(arm.factualControl.answer.answer_language, 'en');
      assert(
        arm.factualControl.answer.answer === null || typeof arm.factualControl.answer.answer === 'string',
        'Missing factual answer outcome.',
      );
    }
    if (!live && fixture.path === 'ordinary') assert(pair.upgrade, 'Missing index-upgrade check.');
  }
  assert.equal(receipts.length, completion.requests, 'Incomplete network ledger.');
  if (!live) assert.equal(receipts.length, 0, 'Offline provider requests.');
  assert.deepEqual(
    receipts.map((receipt) => receipt.sequence).sort((a, b) => a - b),
    Array.from({ length: receipts.length }, (_, index) => index + 1),
    'Missing or duplicate network receipts.',
  );
}
