#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hash } from './language-comparison-fixtures.mjs';
import { validateComparison } from './language-comparison-validation.mjs';

const root = path.resolve(process.argv[2] ?? '');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name)));
const resultIndex = read('results.json');
assert.equal(resultIndex.schemaVersion, 'paired-results-index-v1');
const results = resultIndex.pairs.map(({ file, sha256 }) => {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(hash(bytes), sha256);
  return JSON.parse(bytes);
});
const fixtures = read('fixtures.json');
const manifest = read('manifest.json');
const completion = read('completion.json');
const receiptsPath = path.join(root, 'network-receipts.jsonl');
const receipts = fs.existsSync(receiptsPath)
  ? fs.readFileSync(receiptsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
  : [];
validateComparison({ plan: read('plan.json'), manifest, fixtures, results, completion, receipts });
const evidence = (answer) =>
  (answer.context ?? [])
    .flatMap((item) => (item.type === 'page' ? item.lines : []))
    .filter((line) => line.memory || line.prose);
const counts = {};
for (const arm of ['baseline', 'candidate']) {
  const queries = results.flatMap((pair) => pair.arms[arm].queries);
  const answers = queries.flatMap((query) => query.answers);
  const projections = results.flatMap((pair) => pair.arms[arm].projections);
  counts[arm] = {
    correctInferredViews: queries.filter((query) => !query.explicit && query.view === query.expectedView)
      .length,
    inferredViews: queries.filter((query) => !query.explicit).length,
    correctExplicitViews: queries.filter((query) => query.explicit && query.view === query.expectedView)
      .length,
    explicitViews: queries.filter((query) => query.explicit).length,
    correctProjections: projections.filter(
      (item) => item.actual?.view === item.view && item.actual.answer_eligible === (item.view === 'factual'),
    ).length,
    projections: projections.length,
    answersWithEligibleEvidence: answers.filter((answer) => evidence(answer).length > 0).length,
    answerOperations: answers.length,
    publishedAnswers: answers.filter((answer) => answer.answer !== null).length,
    automaticContexts: queries.filter((query) => query.context.length > 0).length,
    unsafeFactualProjections: results.flatMap((pair) => pair.arms[arm].unsafeFactualProjections).length,
    unsafeFactualAnswerLines: results.flatMap((pair) => pair.arms[arm].unsafeFactualAnswerLines).length,
    unsafeFactualContextLines: results.flatMap((pair) => pair.arms[arm].unsafeFactualContextLines).length,
    factualAnswerControls: results.length,
    bytesStable: results.filter((pair) => pair.arms[arm].bytesStable).length,
    reasons: Object.fromEntries(
      [...new Set(answers.map((answer) => answer.reason_code))].map((reason) => [
        reason,
        answers.filter((answer) => answer.reason_code === reason).length,
      ]),
    ),
  };
}
const regressions = [];
let projectionUpgrades = 0;
let retainedExplicitControls = 0;
let retainedExplicitEqual = 0;
const differences = [];
for (const pair of results) {
  const fixture = fixtures.find((entry) => entry.id === pair.id);
  const before = pair.arms.baseline;
  const after = pair.arms.candidate;
  if (pair.upgrade) {
    assert.equal(pair.upgrade.baselineVersion, manifest.arms.baseline.proseProjectionVersion ?? 'prose-v2');
    assert.equal(pair.upgrade.candidateVersion, manifest.arms.candidate.proseProjectionVersion ?? 'prose-v3');
    assert.deepEqual(pair.upgrade.candidate, after.read);
    assert(pair.upgrade.bytesStable);
    for (const expected of fixture.projections)
      assert.equal(
        pair.upgrade.candidateStoredProjections.find((item) => item.line === expected.n)?.view,
        expected.view,
      );
    projectionUpgrades++;
  }
  assert.equal(before.queries.length, after.queries.length);
  for (let index = 0; index < before.queries.length; index++) {
    const b = before.queries[index],
      a = after.queries[index];
    assert.equal(a.query, b.query);
    assert.equal(a.explicit, b.explicit);
    const coordinate = `${pair.id}/repeat-${pair.run}/${a.language}/${a.explicit ? 'explicit' : 'inferred'}`;
    if (b.view === b.expectedView && a.view !== a.expectedView)
      regressions.push({ coordinate, kind: 'view' });
    for (let answerIndex = 0; answerIndex < b.answers.length; answerIndex++) {
      const oldEvidence = evidence(b.answers[answerIndex]);
      const newEvidence = evidence(a.answers[answerIndex]);
      const same = JSON.stringify(oldEvidence) === JSON.stringify(newEvidence);
      if (fixture.path === 'retained' && a.explicit) {
        retainedExplicitControls++;
        if (same) retainedExplicitEqual++;
        else regressions.push({ coordinate, kind: 'retained-explicit-evidence', answerIndex });
      }
      // Wrong old views may intentionally lose irrelevant facts or inspection-only material.
      if (b.view === b.expectedView && oldEvidence.length > 0 && newEvidence.length === 0)
        regressions.push({ coordinate, kind: 'eligible-evidence-lost', answerIndex });
      if (!same || a.view !== b.view)
        differences.push({
          coordinate,
          answerIndex,
          views: [b.view, a.view],
          eligibleLines: [oldEvidence.length, newEvidence.length],
          reasons: [b.answers[answerIndex].reason_code, a.answers[answerIndex].reason_code],
        });
    }
  }
}
const physical = receipts.filter((item) => item.reusedFrom === null);
const sourceBySequence = new Map(receipts.map((item) => [item.sequence, item]));
for (const receipt of receipts.filter((item) => item.reusedFrom !== null)) {
  const source = sourceBySequence.get(receipt.reusedFrom);
  assert(source && source.reusedFrom === null);
  assert.notEqual(receipt.arm, source.arm);
  for (const field of ['id', 'run', 'stage', 'requestSha256', 'occurrence', 'model', 'status', 'failure'])
    assert.equal(receipt[field], source[field], `Invalid coupled response: ${field}`);
}
const summary = {
  kind: manifest.mode,
  manifestSha256: hash(fs.readFileSync(path.join(root, 'manifest.json'))),
  pairs: results.length,
  counts,
  retainedExplicitControls,
  retainedExplicitEqual,
  projectionUpgrades,
  regressions,
  differences,
  network: {
    logicalRequests: receipts.length,
    physicalRequests: physical.length,
    coupledResponses: receipts.length - physical.length,
    failedPhysicalRequests: physical.filter((item) => item.status !== 200).length,
    usageByModel: Object.fromEntries(
      [...new Set(physical.map((item) => item.model))].map((model) => [
        model,
        physical
          .filter((item) => item.model === model)
          .reduce((sum, item) => sum + (item.usage?.total_tokens ?? 0), 0),
      ]),
    ),
  },
  deterministicAcceptance:
    manifest.mode === 'offline-downstream-comparison' &&
    regressions.length === 0 &&
    counts.candidate.correctInferredViews === counts.candidate.inferredViews &&
    counts.candidate.correctExplicitViews === counts.candidate.explicitViews &&
    counts.candidate.correctProjections === counts.candidate.projections &&
    counts.candidate.unsafeFactualAnswerLines === 0 &&
    counts.candidate.unsafeFactualContextLines === 0 &&
    counts.candidate.unsafeFactualProjections === 0 &&
    counts.candidate.bytesStable === results.length,
  endToEndAcceptance: 'not measured here; prior full gate remains failed',
  liveSemanticReview:
    manifest.mode === 'coupled-live-downstream-comparison' ? 'required separately' : 'not applicable',
};
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...summary, differences: differences.length }, null, 2));
