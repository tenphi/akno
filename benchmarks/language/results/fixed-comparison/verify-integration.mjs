import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { candidateProof } from './freeze.mjs';
import { loadConfig } from '../../packages/core/src/config/load.ts';

// One final candidate, using the comparison's unchanged worker, cases, settings and two runs.
const base = path.resolve('tmp/akno-comparison');
const destination = path.join(base, 'integration');
const read = file => JSON.parse(fs.readFileSync(path.join(base, file), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex');
const write = (file, value) => fs.writeFileSync(path.join(base, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const mode = process.argv[2];
assert(['control', 'freeze', 'live'].includes(mode));
assert.equal(process.version, 'v22.22.0');
const original = read('declaration.json');
const originalApproval = read('preflight.json');
const corpus = read('corpus.json');
const candidate = read('integration/candidate.json');
assert.equal(corpus.corpusFingerprint, original.corpusFingerprint);
assert.equal(hash('corpus.json'), original.corpusFileSha256);
assert.equal(hash('source-first-obligations.json'), original.sourceObligationsSha256);
for (const [file, field] of [['worker.mjs', 'workerSha256'], ['common-case.mjs', 'commonSha256'], ['freeze.mjs', 'freezeSha256']]) {
  assert.equal(hash(file), originalApproval[field]);
}
const config = loadConfig();
const policy = Object.fromEntries(['derive', 'answer', 'embedding', 'expansion'].map(role => {
  const model = config.models[role];
  return [role, { id: model.id, enabled: model.enabled, maxOutputTokens: model.maxOutputTokens ?? null, timeoutMs: model.timeoutMs, reasoningEffort: model.reasoningEffort ?? null }];
}));
assert.deepEqual(policy, original.modelPolicy);
const proof = candidateProof(candidate);
if (mode === 'freeze') {
  const control = read('integration/control/completed.json');
  assert.deepEqual(control.candidate, proof);
  assert.equal(control.results.length, 1);
  assert.equal(control.results[0].networkAttempts, 0);
  write('integration/declaration.json', {
    createdAt: new Date().toISOString(), candidate: proof,
    corpusFingerprint: corpus.corpusFingerprint, corpusFileSha256: hash('corpus.json'),
    sourceObligationsSha256: hash('source-first-obligations.json'), modelPolicy: policy,
    runnerSha256: hash('verify-integration.mjs'), workerSha256: hash('worker.mjs'),
    commonSha256: hash('common-case.mjs'), freezeSha256: hash('freeze.mjs'),
    postvalidatorSha256: hash('postvalidate.mjs'), publicValidatorSha256: hash('validate-public.mjs'),
    scorerSha256: hash('score.mjs'), packetFormatterSha256: hash('packet.mjs'), gradeAssemblerSha256: hash('assemble-grades.mjs'),
    controlSha256: hash('integration/control/completed.json'),
    gradingContractSha256: hash('grading-contract.json'),
    design: 'One frozen integration, all 22 comparison cases twice, eight language/view coordinates, no selective retries. Same source-first grading with complete public record metadata; report the original 80% and later 90% targets separately.',
    selection: original.selection,
  });
  console.log(JSON.stringify({ frozen: true, candidate: proof }));
} else {
  if (mode === 'live') {
    // Independent review binds the exact runner and frozen candidate before any provider call.
    const declaration = read('integration/declaration.json');
    const approval = read('integration/preflight.json');
    assert.equal(approval.approved, true);
    assert.equal(approval.declarationSha256, hash('integration/declaration.json'));
    const selection = read('integration/selection.json');
    assert.equal(selection.action, 'evaluate-one-integration');
    assert.equal(selection.candidateCommit, proof.commit);
    assert.equal(selection.comparisonSha256, hash('comparison-final.json'));
    assert.equal(selection.postvalidationSha256, hash('comparison-postvalidation.json'));
    assert.equal(approval.selectionSha256, hash('integration/selection.json'));
    assert.deepEqual(declaration.candidate, proof);
    assert.deepEqual(declaration.modelPolicy, policy);
    for (const [file, field] of [['verify-integration.mjs', 'runnerSha256'], ['worker.mjs', 'workerSha256'], ['common-case.mjs', 'commonSha256'], ['freeze.mjs', 'freezeSha256'], ['grading-contract.json', 'gradingContractSha256']]) assert.equal(hash(file), declaration[field]);
    for (const [file, field] of [['postvalidate.mjs', 'postvalidatorSha256'], ['validate-public.mjs', 'publicValidatorSha256'], ['score.mjs', 'scorerSha256'], ['packet.mjs', 'packetFormatterSha256'], ['assemble-grades.mjs', 'gradeAssemblerSha256']]) assert.equal(hash(file), declaration[field]);
    write('integration/live-started.json', { startedAt: new Date().toISOString(), declarationSha256: hash('integration/declaration.json'), approvalSha256: hash('integration/preflight.json') });
  } else {
    for (const role of ['derive', 'answer', 'embedding', 'expansion']) config.models[role] = { ...config.models[role], enabled: false };
  }
  const modeRoot = path.join(destination, mode);
  assert(!fs.existsSync(modeRoot));
  fs.mkdirSync(modeRoot);
  const log = fs.openSync(path.join(modeRoot, 'worker.log'), 'wx');
  const worker = fork(path.join(base, 'worker.mjs'), [], { cwd: process.cwd(), stdio: ['ignore', log, log, 'ipc'] });
  const request = message => new Promise((resolve, reject) => {
    const onMessage = response => { worker.removeListener('exit', onExit); response.type === 'worker-failure' ? reject(new Error(JSON.stringify(response))) : resolve(response); };
    const onExit = (code, signal) => { worker.removeListener('message', onMessage); reject(new Error(`Worker exited ${code}/${signal}`)); };
    worker.once('message', onMessage); worker.once('exit', onExit); worker.send(message);
  });
  try {
    const ready = await request({ type: 'initialize', root: candidate.root, destination: path.join(modeRoot, candidate.label), config, control: mode === 'control' });
    assert.equal(ready.type, 'ready');
    const entries = mode === 'control' ? [corpus.cases.find(c => c.source.admission === 'writable')] : corpus.cases;
    const runs = mode === 'control' ? 1 : 2;
    const results = [];
    for (let run = 1; run <= runs; run++) for (const entry of entries) {
      const response = await request({ type: 'case', ...entry, run });
      assert.equal(response.type, 'case-result');
      results.push(response.receipt);
      if (mode === 'control') {
        assert.equal(response.receipt.networkAttempts, 0);
        assert.equal(response.receipt.result.queries.length, 8);
        assert.equal(response.receipt.result.bytesStable, true);
        assert.equal(response.receipt.result.availabilityFailure, true);
      }
      console.log(JSON.stringify({ candidate: candidate.label, mode, caseId: entry.source.id, block: entry.block, run, completed: results.length, total: entries.length * runs, elapsedMs: response.receipt.elapsedMs, queries: response.receipt.result.queries.length }));
    }
    await request({ type: 'close' });
    assert.deepEqual(candidateProof(candidate), proof);
    write(`integration/${mode}/completed.json`, { completedAt: new Date().toISOString(), candidate: proof, corpusFingerprint: corpus.corpusFingerprint, modelPolicy: policy, results });
    console.log(JSON.stringify({ mode, completed: true, cases: results.length }));
  } finally {
    if (worker.connected) worker.disconnect();
  }
}
