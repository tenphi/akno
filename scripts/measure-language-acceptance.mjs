#!/usr/bin/env node
/** Opt-in, incremental live evidence capture over the built frozen language benchmark. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../packages/core/dist/index.js';
import { runLanguageBench } from '../packages/core/dist/bench/language.js';
import { LANGUAGE_CORPUS_V22 } from '../packages/core/dist/bench/language-corpus-v22.js';
import { LANGUAGE_CORPUS_V23 } from '../packages/core/dist/bench/language-corpus-v23.js';

const { values } = parseArgs({
  options: {
    live: { type: 'boolean' },
    corpus: { type: 'string', default: 'v22' },
    config: { type: 'string' },
    output: { type: 'string' },
    split: { type: 'string' },
    runs: { type: 'string', default: '1' },
    case: { type: 'string', multiple: true },
  },
});
assert(
  values.live &&
    values.config &&
    values.output &&
    ['development', 'held-out'].includes(values.split) &&
    /^[1-5]$/.test(values.runs),
  'Use --live --config FILE --output NEW_DIRECTORY --split development|held-out [--runs 1..5] [--case ID].',
);
const output = path.resolve(values.output);
assert(!fs.existsSync(output), 'Existing evidence must not be overwritten.');
const repo = fileURLToPath(new URL('..', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const write = (name, value) =>
  fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function treeHash(root) {
  const files = fs
    .readdirSync(root, { recursive: true })
    .filter((name) => fs.statSync(path.join(root, name)).isFile())
    .sort();
  return sha(JSON.stringify(files.map((name) => [name, sha(fs.readFileSync(path.join(root, name)))])));
}
assert(['v22', 'v23'].includes(values.corpus), 'Corpus must be v22 or v23.');
const corpus = values.corpus === 'v23' ? LANGUAGE_CORPUS_V23 : LANGUAGE_CORPUS_V22;
const selected = corpus.filter(
  (entry) => entry.split === values.split && (!values.case || values.case.includes(entry.id)),
);
assert(
  selected.length && (!values.case || selected.length === values.case.length),
  'Unknown, duplicate or wrong-split case.',
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-acceptance-preflight-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('AKNO_')));
const config = loadConfig({
  isolated: true,
  env,
  aknoPath: temporary,
  stateDir: path.join(temporary, 'state'),
  overrides: JSON.parse(fs.readFileSync(values.config, 'utf8')),
});
fs.rmSync(temporary, { recursive: true, force: true });
for (const name of ['derive', 'answer', 'embedding', 'reranker'])
  assert(config.models[name].id && config.models[name].provider, `Missing ${name} provider.`);
assert(config.models.reranker.enabled, 'Full-retrieval measurement requires an enabled reranker.');
fs.mkdirSync(output, { recursive: true });
const models = Object.fromEntries(
  ['derive', 'answer', 'embedding', 'expansion', 'reranker'].map((name) => {
    const {
      id,
      enabled,
      timeoutMs,
      maxOutputTokens,
      reasoningEffort,
      dimensions,
      rerankerMode,
      topK,
      maxChars,
      excludeIrrelevant,
      scoreOffset,
      provider,
    } = config.models[name];
    return [
      name,
      {
        id,
        enabled,
        timeoutMs,
        maxOutputTokens,
        reasoningEffort,
        dimensions,
        rerankerMode,
        topK,
        maxChars,
        excludeIrrelevant,
        scoreOffset,
        api: provider?.api,
        providerRetries: provider?.maxRetries,
      },
    ];
  }),
);
const runtime = {
  core: treeHash(path.join(repo, 'packages/core/dist')),
  protocol: treeHash(path.join(repo, 'packages/protocol/dist')),
};
write('manifest.json', {
  kind: values.case ? 'selected-case-diagnostic' : 'complete-corpus',
  corpusVersion: values.corpus,
  createdAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceDiffSha256: sha(execFileSync('git', ['diff', 'HEAD', '--', 'packages', 'scripts'], { cwd: repo })),
  runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  runtime,
  corpusFingerprint: sha(JSON.stringify(corpus)),
  split: values.split,
  runs: Number(values.runs),
  selectedCaseIds: selected.map((entry) => entry.id),
  models,
  fullRetrieval: true,
  limitations: [
    values.corpus === 'v22' || values.split === 'development'
      ? 'Previously exposed sources; this is not fresh held-out generalization.'
      : 'Held-out sources frozen before execution; any subsequent tuning makes these exposed diagnostics.',
    'Published text requires independent source-based review.',
    'Summaries/facts and expansion disabled; graph expansion disabled.',
  ],
});
write('sources.json', selected);
const coordinates = Array.from({ length: Number(values.runs) }, (_, i) =>
  selected.map((entry) => `${entry.id}/run-${i + 1}`),
).flat();
let completed = 0;
let sequence = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const request = typeof options?.body === 'string' ? JSON.parse(options.body) : {};
  const started = Date.now();
  const receipt = {
    sequence: ++sequence,
    coordinate: coordinates[completed],
    model: request.model ?? null,
    maxOutputTokens: request.max_output_tokens ?? request.max_tokens ?? null,
  };
  try {
    const response = await realFetch(url, options);
    const body = await response
      .clone()
      .json()
      .catch(() => null);
    Object.assign(receipt, {
      status: response.status,
      latencyMs: Date.now() - started,
      usage: body?.usage ?? null,
    });
    // Only public message text, never reasoning items, request headers, endpoints or credentials.
    const messageText =
      body?.output
        ?.filter((item) => item.type === 'message')
        .flatMap(
          (item) =>
            item.content?.filter((part) => part.type === 'output_text').map((part) => part.text) ?? [],
        ) ?? [];
    if (messageText.length)
      fs.appendFileSync(
        path.join(output, 'provider-message-text.jsonl'),
        JSON.stringify({ sequence: receipt.sequence, coordinate: receipt.coordinate, messageText }) + '\n',
      );
    return response;
  } catch (error) {
    Object.assign(receipt, {
      status: null,
      latencyMs: Date.now() - started,
      failure: error.name ?? 'request_failed',
    });
    throw error;
  } finally {
    fs.appendFileSync(path.join(output, 'network-receipts.jsonl'), JSON.stringify(receipt) + '\n');
  }
};
try {
  const report = await runLanguageBench(config, {
    split: values.split,
    corpus: values.corpus,
    runs: Number(values.runs),
    caseIds: values.case,
    fullRetrieval: true,
    onCaseResult: (result) => {
      write(`${result.id}-run-${result.run}.json`, result);
      completed++;
    },
    onProgress: (id, done, total) => console.log(JSON.stringify({ id, done, total })),
  });
  write('report.json', report);
  write('completion.json', {
    completed,
    expected: coordinates.length,
    networkRequests: sequence,
    builtRuntimeUnchanged:
      runtime.core === treeHash(path.join(repo, 'packages/core/dist')) &&
      runtime.protocol === treeHash(path.join(repo, 'packages/protocol/dist')),
    completedAt: new Date().toISOString(),
  });
  console.log(JSON.stringify({ completed, networkRequests: sequence, metrics: report.metrics }));
} finally {
  globalThis.fetch = realFetch;
}
