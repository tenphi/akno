import assert from 'node:assert/strict';
import os from 'node:os';
import { loadConfig } from '../packages/core/dist/index.js';
import { runLifecycle, lifecycleHash } from './longitudinal-lifecycle-runtime.mjs';
import { adjudicateLifecycle } from '../packages/core/src/bench/longitudinal-lifecycle-review.ts';
const clock = Date;
const config = loadConfig({
  isolated: true,
  aknoPath: os.tmpdir(),
  env: {},
  overrides: {
    models: {
      derive: { id: null, enabled: false },
      answer: { id: null, enabled: false },
      embedding: { id: null, enabled: false },
    },
  },
});
for (const split of ['development', 'held-out']) {
  const packet = await runLifecycle(config, { split, runs: 1 });
  assert.equal(Date, clock);
  assert.equal(packet.checkpoints.length, 34);
  assert(
    packet.checkpoints.every(
      (row) =>
        row.after.sourceBytesUnchanged &&
        row.operations.every((operation) => !operation.failed && operation.calls === 0),
    ),
  );
  const review = {
    version: 'lifecycle-review-v1',
    packetFingerprint: lifecycleHash(packet),
    reviewer: { id: 'deterministic-smoke', sourceBased: true, independent: false },
    checkpoints: packet.checkpoints.map((row) => ({
      key: row.key,
      recovery: [],
      stages: Object.fromEntries(
        ['memory', 'recall', 'context', 'answer'].map((stage) => [
          stage,
          {
            covered: [],
            errors: [],
            triage: ['unknown'],
            outcome:
              stage === 'answer' && !row.answer
                ? 'not_measured'
                : stage !== 'memory' &&
                    (!row[stage] ||
                      row[stage].status === 'unavailable' ||
                      [
                        'verification_unavailable',
                        'generation_unavailable',
                        'generation_failed',
                        'evidence_unavailable',
                      ].includes(row[stage].reason_code))
                  ? 'unavailable'
                  : 'false_hold',
          },
        ]),
      ),
    })),
  };
  const report = adjudicateLifecycle(packet, review);
  assert(report.groups.every((group) => !group.passed && !group.gates.usefulCoverage));
  const stale = structuredClone(review);
  stale.packetFingerprint = 'stale';
  assert.throws(() => adjudicateLifecycle(packet, stale), /fingerprint/);
  const missing = structuredClone(review);
  missing.checkpoints.pop();
  assert.throws(() => adjudicateLifecycle(packet, missing), /every unique/);
  const omitted = structuredClone(review);
  const checkpoint = omitted.checkpoints.find((row) => row.stages.answer.outcome === 'not_measured');
  checkpoint.stages.answer.covered = ['bounded-patterns'];
  assert.throws(() => adjudicateLifecycle(packet, omitted));
  const unsafe = structuredClone(packet);
  unsafe.contract.privateEndpoint = 'invented-secret';
  assert.throws(() => adjudicateLifecycle(unsafe, { ...review, packetFingerprint: lifecycleHash(unsafe) }));
}
console.log(
  'lifecycle smoke: compiled isolated socket, fixed/restored clocks, complete matrix and failing always-abstain controls',
);
