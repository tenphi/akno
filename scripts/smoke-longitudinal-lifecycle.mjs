import assert from 'node:assert/strict';
import os from 'node:os';
import http from 'node:http';
import { loadConfig } from '../packages/core/dist/index.js';
import { runLifecycle, lifecycleHash, lifecycleInputReview } from './longitudinal-lifecycle-runtime.mjs';
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
  const unreviewed = structuredClone(packet);
  unreviewed.inputReviewFingerprint = 'unreviewed';
  assert.throws(
    () => adjudicateLifecycle(unreviewed, { ...review, packetFingerprint: lifecycleHash(unreviewed) }),
    /input-review/,
  );
  const reordered = structuredClone(packet);
  [reordered.checkpoints[0], reordered.checkpoints[1]] = [reordered.checkpoints[1], reordered.checkpoints[0]];
  assert.throws(
    () => adjudicateLifecycle(reordered, { ...review, packetFingerprint: lifecycleHash(reordered) }),
    /order/,
  );
  const inventedRecovery = structuredClone(review);
  inventedRecovery.checkpoints[0].recovery = [{ errorId: 'never-observed', event: 'recovered', cycles: 0 }];
  assert.throws(() => adjudicateLifecycle(packet, inventedRecovery), /observed error/);
  const unauthorized = structuredClone(packet);
  unauthorized.contract.maxHighRiskItems = 12;
  assert.throws(
    () => adjudicateLifecycle(unauthorized, { ...review, packetFingerprint: lifecycleHash(unauthorized) }),
    /relabel/,
  );
  const hiddenAvailability = structuredClone(review);
  hiddenAvailability.checkpoints[0].stages.memory.outcome = 'unavailable';
  assert.throws(() => adjudicateLifecycle(packet, hiddenAvailability), /relabeled unavailable/);
  const hiddenIndexControl = structuredClone(packet);
  hiddenIndexControl.checkpoints[0].operations[0].scriptedIndexCalls = 1;
  assert.throws(
    () =>
      adjudicateLifecycle(hiddenIndexControl, {
        ...review,
        packetFingerprint: lifecycleHash(hiddenIndexControl),
      }),
    /relabeled as live/,
  );
  const privateReceipt = structuredClone(packet);
  privateReceipt.checkpoints
    .find((row) => row.maintenance.length)
    .maintenance[0].maintenancePlans.push({
      items: [{ kind: 'observe', status: 'blocked', statusCode: 'invented private body' }],
    });
  assert.throws(() =>
    adjudicateLifecycle(privateReceipt, { ...review, packetFingerprint: lifecycleHash(privateReceipt) }),
  );
  const discourseInputs = lifecycleInputReview('discourse');
  const discourse = {
    ...packet,
    version: discourseInputs.version,
    corpusFingerprint: discourseInputs.corpusFingerprint,
    inputReviewFingerprint: lifecycleHash(discourseInputs),
    checkpoints: packet.checkpoints.filter((row) => row.episode.endsWith('-discourse')),
  };
  assert.equal(discourse.checkpoints.length, 12);
  const keys = new Set(discourse.checkpoints.map((row) => row.key));
  const focused = adjudicateLifecycle(discourse, {
    ...review,
    packetFingerprint: lifecycleHash(discourse),
    checkpoints: review.checkpoints.filter((row) => keys.has(row.key)),
  });
  assert(focused.groups.every((group) => !group.passed && !group.gates.usefulCoverage));
}
console.log(
  'lifecycle smoke: compiled isolated socket, fixed/restored clocks, complete matrix and failing always-abstain controls',
);

// A fixed derivation must admit real L2 lineage without masquerading as provider usage.
let requests = 0;
let liveNonleafIndexRequests = 0;
const provider = http.createServer((request, response) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    requests++;
    const input = JSON.parse(body).input;
    const content = typeof input === 'string' ? input : JSON.stringify(input);
    if (content.includes('You extract structure from a personal knowledge base page.')) {
      assert(!/Page: records\/preparation-/.test(content));
      liveNonleafIndexRequests++;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        status: 'completed',
        usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 },
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ observations: [] }) }] },
        ],
      }),
    );
  });
});
await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
try {
  const controlled = loadConfig({
    isolated: true,
    aknoPath: os.tmpdir(),
    env: {},
    overrides: {
      providers: {
        invented: {
          base_url: `http://127.0.0.1:${provider.address().port}/v1`,
          api: 'responses',
          max_retries: 0,
        },
      },
      models: {
        derive: { provider: 'invented', id: 'invented-model', enabled: true },
        answer: { enabled: false, id: null },
        embedding: { enabled: false, id: null },
      },
    },
  });
  for (const corpus of ['inference-control', 'inference-leaf-control']) {
    const beforeRequests = requests;
    const beforeNonleafRequests = liveNonleafIndexRequests;
    const packet = await runLifecycle(controlled, {
      split: 'development',
      runs: 1,
      corpus,
    });
    assert.equal(Date, clock);
    assert(
      packet.checkpoints
        .filter((row) => row.control)
        .every(
          (row) =>
            row.control.seeded === 3 &&
            row.after.observations.filter((observation) => observation.eligible === 1).length === 3,
        ),
    );
    assert(
      packet.checkpoints
        .filter((row) => row.step === 'last-leaves-retracted' || row.step === 'restart-rebuild')
        .every((row) => row.after.observations.every((observation) => observation.eligible === 0)),
    );
    const operations = packet.checkpoints.flatMap((row) => row.operations);
    assert(operations.some((operation) => operation.scriptedIndexCalls > 0));
    assert.equal(
      operations.reduce((sum, operation) => sum + operation.calls, 0),
      requests - beforeRequests,
    );
    assert.equal(
      operations.reduce((sum, operation) => sum + operation.totalTokens, 0),
      (requests - beforeRequests) * 33,
    );
    assert.equal(
      packet.contract.indexMode,
      corpus === 'inference-control' ? 'scripted_positive_control' : 'scripted_source_leaves',
    );
    assert.equal(liveNonleafIndexRequests > beforeNonleafRequests, corpus === 'inference-leaf-control');
  }
  console.log(
    'lifecycle positive control: admitted leaf lineage, retraction/rebuild exclusion and exact separation of scripted derivation from provider calls',
  );
} finally {
  provider.closeAllConnections();
  await new Promise((resolve) => provider.close(resolve));
}
