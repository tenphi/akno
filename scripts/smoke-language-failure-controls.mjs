#!/usr/bin/env node
/** Zero-egress supplement for the release smoke; scripted prefixes establish no live quality result. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { open } from '../packages/core/dist/open.js';
import { ModelClient } from '../packages/core/dist/models/client.js';

const output = process.argv[2];
assert(output && !fs.existsSync(output), 'Provide a new output path.');
const runner = fs.readFileSync(new URL('./smoke-language-release.mjs', import.meta.url), 'utf8');
// Exercise the actual corrected helper without running the opt-in live entrypoint.
const helper = runner.slice(
  runner.indexOf('function phase('),
  runner.indexOf('// Record only request ceilings'),
);
const phase = vm.runInNewContext(`(${helper.trim()})`);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const checks = [];
for (const [prefix, expected] of [
  ['You extract durable memory', 'extraction'],
  ['You answer a question', 'generation'],
  ['You independently verify whether drafted answer', 'answer-verification'],
  ['When a candidate has frame_spans', 'retention-verification'],
]) {
  const actual = phase([
    { role: 'system', content: 'Invented language instruction' },
    { role: 'system', content: prefix },
  ]);
  checks.push({ name: `prepended language policy preserves ${expected} stage`, ok: actual === expected });
}

const realFetch = globalThis.fetch;
const realTransport = ModelClient.prototype.chatTransport;
const profiles = [];
let active;
let injected = 0;
let foreignRequests = 0;
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://invented.invalid/v1/chat/completions') {
    foreignRequests++;
    throw new Error('Unrecognized egress attempt blocked.');
  }
  const body = JSON.parse(options.body);
  assert.equal(phase(body.messages), 'answer-verification');
  injected++;
  active.wireTokens.push(body.max_tokens ?? body.max_completion_tokens);
  return Response.json({ choices: [{ message: { content: '{"verdicts":[' }, finish_reason: 'length' }] });
};
ModelClient.prototype.chatTransport = async function (messages, options) {
  const stage = phase(messages);
  active.stages.push(stage);
  if (stage === 'answer-verification') return realTransport.call(this, messages, options);
  let value;
  if (stage === 'generation') {
    value = {
      blocks: [{ text: 'The Zephyr QX-100 case is silver.', evidence_ids: ['E1'] }],
      missing_concepts: [],
    };
  } else {
    assert.equal(stage, 'language');
    const payload = JSON.parse(messages.at(-1).content);
    value = {
      hint_roles: (payload.review_hints ?? []).map((hint) => ({
        hint_id: hint.hint_id,
        classification: hint.occurrences[0].allowed_roles.find((role) =>
          hint.occurrences.every((occurrence) => occurrence.allowed_roles.includes(role)),
        ),
      })),
      prose_result: { status: 'compliant', counterexample: null },
    };
  }
  return { ok: true, value: JSON.stringify(value), latencyMs: 0, endpointRequests: 0 };
};
try {
  for (const language of [null, 'en']) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-release-control-'));
    const kb = path.join(temp, 'kb');
    fs.mkdirSync(kb);
    const content = '# Zephyr QX-100\n\nThe Zephyr QX-100 case is silver.\n';
    fs.writeFileSync(path.join(kb, 'equipment.md'), content);
    active = { language, stages: [], wireTokens: [] };
    profiles.push(active);
    let memory;
    try {
      memory = await open({
        isolated: true,
        aknoPath: kb,
        stateDir: path.join(temp, 'state'),
        actor: 'user',
        resolveProviderApis: false,
        env: Object.fromEntries(
          [
            'AKNO_PATH',
            'AKNO_STATE_DIR',
            'AKNO_SOCKET',
            'AKNO_HTTP',
            'AKNO_WRITE_IDS',
            'AKNO_MODEL_BASE_URL',
            'AKNO_EMBEDDING_MODEL',
            'AKNO_DERIVE_MODEL',
            'AKNO_EXPANSION_MODEL',
            'AKNO_ANSWER_MODEL',
          ].map((key) => [key, '']),
        ),
        overrides: {
          knowledge_language: language,
          providers: {
            invented: { base_url: 'https://invented.invalid/v1', api: 'chat_completions', max_retries: 0 },
          },
          models: { answer: { provider: 'invented', id: 'invented-model' } },
        },
      });
      await memory.index({ structuralOnly: true });
      const result = await memory.answer({
        question: 'What color is the Zephyr QX-100 case?',
        answer_language: 'en',
        memory_view: 'factual',
        expand: false,
        graph: false,
        rerank: false,
      });
      active.result = {
        status: result.status,
        outcome: result.outcome,
        answer: result.answer,
        reason: result.reason_code,
        validation: result.validation,
        degraded: result.degraded,
      };
      active.answerRole = {
        maxOutputTokens: memory.config.models.answer.maxOutputTokens,
        timeoutMs: memory.config.models.answer.timeoutMs,
      };
      checks.push({
        name: `${language ?? 'null'}: malformed generic answer audit withheld`,
        ok:
          result.answer === null &&
          result.reason_code === 'verification_unavailable' &&
          result.degraded.includes('answer_verification_failed') &&
          active.wireTokens.length === 1,
      });
      checks.push({
        name: `${language ?? 'null'}: source bytes and file set unchanged`,
        ok:
          fs.readFileSync(path.join(kb, 'equipment.md'), 'utf8') === content &&
          fs.readdirSync(kb).length === 1,
      });
    } finally {
      await memory?.close();
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
} finally {
  globalThis.fetch = realFetch;
  ModelClient.prototype.chatTransport = realTransport;
}
checks.push({
  name: 'two injected requests and zero external requests',
  ok: injected === 2 && foreignRequests === 0,
});
const result = {
  kind: 'zero-egress-generic-answer-verification-controls',
  testedAt: new Date().toISOString(),
  runnerSha256: sha(runner),
  controlRunnerSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  injectedRequests: injected,
  externalRequests: 0,
  blockedForeignAttempts: foreignRequests,
  profiles,
  checks,
  passed: checks.every((check) => check.ok),
  scope:
    'Scripted generation and language-check prefixes; real built answer verifier parses incomplete injected JSON. Ordinary factual evidence, not a retained-report-specific injection or live-model quality measurement.',
};
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: result.passed, checks }));
if (!result.passed) process.exitCode = 1;
