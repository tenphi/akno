import assert from 'node:assert/strict';
import os from 'node:os';
import http from 'node:http';
import { loadConfig } from '../packages/core/dist/index.js';
import { runLongitudinal } from './longitudinal-runtime.mjs';
import {
  adjudicateLongitudinal,
  longitudinalFingerprint as hash,
} from '../packages/core/src/bench/longitudinal-review.ts';
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
  const packet = await runLongitudinal(config, { split, runs: 1 });
  assert.equal(packet.checkpoints.length, 26);
  assert(
    packet.checkpoints.every(
      (checkpoint) => checkpoint.inventory.sourceBytesUnchanged && checkpoint.inventory.validSupportHashes,
    ),
  );
  assert(
    packet.checkpoints.every((checkpoint) =>
      checkpoint.operations.every((operation) => !operation.failed && operation.calls === 0),
    ),
  );
  const review = {
    version: 'longitudinal-review-v1',
    packetFingerprint: hash(packet),
    reviewer: { kind: 'agent', id: 'deterministic-smoke', sourceBased: true, independent: false },
    checkpoints: packet.checkpoints.map((checkpoint) => ({
      key: checkpoint.key,
      stages: Object.fromEntries(
        ['memory', 'timeline', 'recall', 'context', 'answer'].map((stage) => [
          stage,
          {
            covered: [],
            errors: [],
            abstention:
              stage === 'answer'
                ? checkpoint.answer
                  ? checkpoint.answer.status === 'unavailable' ||
                    [
                      'evidence_unavailable',
                      'generation_unavailable',
                      'generation_failed',
                      'verification_unavailable',
                    ].includes(checkpoint.answer.reason_code)
                    ? 'unavailable'
                    : 'unjustified'
                  : 'not_measured'
                : checkpoint[stage]?.status === 'unavailable'
                  ? 'unavailable'
                  : 'unjustified',
          },
        ]),
      ),
    })),
  };
  const report = adjudicateLongitudinal(packet, review);
  assert(report.groups.every((group) => !group.passed));
}
console.log(
  'longitudinal smoke: compiled socket/client, complete coordinates and non-passing no-model controls',
);

// A no-model control cannot expose lost async context across the socket. Count actual
// invented provider requests so zero accounting can never silently pass again.
let requests = 0;
const provider = http.createServer((request, response) => {
  request.resume();
  request.on('end', () => {
    requests++;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        status: 'completed',
        usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 },
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify({ candidates: [], events: [] }) }],
          },
        ],
      }),
    );
  });
});
await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
try {
  const stub = loadConfig({
    isolated: true,
    aknoPath: os.tmpdir(),
    env: {},
    overrides: {
      providers: {
        invented: {
          api: 'responses',
          base_url: `http://127.0.0.1:${provider.address().port}/v1`,
          max_retries: 0,
        },
      },
      models: {
        derive: { provider: 'invented', id: 'invented-empty-extractor', enabled: true },
        answer: { provider: 'invented', id: 'invented-empty-answer', enabled: true },
        embedding: { id: null, enabled: false },
      },
    },
  });
  const packet = await runLongitudinal(stub, { split: 'development', runs: 1 });
  const measured = packet.checkpoints.flatMap((checkpoint) => checkpoint.operations);
  assert(requests > 0);
  assert.equal(
    measured.reduce((total, operation) => total + operation.calls, 0),
    requests,
  );
  assert.equal(
    measured.reduce((total, operation) => total + operation.totalTokens, 0),
    requests * 33,
  );
  assert(
    measured
      .filter((operation) => operation.stage === 'retain:notice')
      .some((operation) => operation.calls > 0),
  );
  assert(
    measured.filter((operation) => operation.stage === 'read').every((operation) => operation.calls === 0),
  );
  console.log(
    'longitudinal accounting: real stub HTTP requests match socket-scoped calls and reported usage',
  );
} finally {
  provider.closeAllConnections();
  await new Promise((resolve) => provider.close(resolve));
}
