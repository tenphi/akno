#!/usr/bin/env node
/** Opt-in release smoke against built packages; never a semantic benchmark or tuning loop. */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from '../packages/core/dist/open.js';
import { loadConfig } from '../packages/core/dist/config/load.js';
import { ModelClient } from '../packages/core/dist/models/client.js';

assert(
  process.argv.includes('--live'),
  'Explicit --live is required; configured providers receive invented sources.',
);
const outputIndex = process.argv.indexOf('--output');
assert(outputIndex >= 0 && process.argv[outputIndex + 1], 'Provide a new --output JSON path.');
const output = path.resolve(process.argv[outputIndex + 1]);
assert(!fs.existsSync(output), 'Existing evidence must not be overwritten.');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const context = new AsyncLocalStorage();
const realFetch = globalThis.fetch;
const realTransport = ModelClient.prototype.chatTransport;
const captures = new Map();
const wireCaptures = new Map();
const requireCore = createRequire(new URL('../packages/core/dist/open.js', import.meta.url));
const Database = requireCore('better-sqlite3');
const { z } = requireCore('zod');
const checks = [];
const telemetry = [];
const profiles = [];
let operation;
let fault = null;
let completed = false;

function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}
function tree(root) {
  const entries = [];
  function walk(relative) {
    for (const entry of fs
      .readdirSync(path.join(root, relative), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(name);
      else entries.push([name, sha(fs.readFileSync(path.join(root, name)))]);
    }
  }
  walk('');
  return sha(JSON.stringify(entries));
}
function phase(messages) {
  const system = messages[0]?.content ?? '';
  if (system.startsWith('Check the language')) return 'language';
  if (system.startsWith('You extract durable memory')) return 'extraction';
  if (system.startsWith('You answer a question')) return 'generation';
  if (system.startsWith('You independently verify whether drafted answer')) return 'answer-verification';
  if (system.startsWith('When a candidate has frame_spans')) return 'retention-verification';
  return 'retention-verification-or-placement';
}

// Record only request ceilings, never URLs, headers, credentials or provider error strings.
globalThis.fetch = async (url, options) => {
  const call = context.getStore();
  const wireKey = sha(String(url) + '\0' + (options?.body ?? ''));
  if (fault && !call) {
    const saved = wireCaptures.get(wireKey);
    assert(saved, 'Control retrieval must match a previously observed request.');
    return new Response(saved.body, {
      status: saved.status,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (call && typeof options?.body === 'string') {
    const body = JSON.parse(options.body);
    call.wire.push({
      maxOutputTokens: body.max_output_tokens ?? body.max_completion_tokens ?? body.max_tokens ?? null,
      reasoningEffort: body.reasoning?.effort ?? body.reasoning_effort ?? null,
    });
    if (fault?.mode === 'timeout') throw new DOMException('Invented timeout injection', 'TimeoutError');
    if (fault?.mode === 'truncated' && call.phase === 'answer-verification') {
      const content = '{"verdicts":[';
      return Response.json(
        body.input
          ? {
              status: 'completed',
              output: [
                { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: content }] },
              ],
            }
          : { choices: [{ message: { content }, finish_reason: 'length' }] },
      );
    }
  }
  assert(!fault, 'Injected control must not reach a live provider.');
  const response = await realFetch(url, options);
  wireCaptures.set(wireKey, { status: response.status, body: await response.clone().text() });
  return response;
};

ModelClient.prototype.chatTransport = async function (messages, options = {}) {
  const call = {
    operation,
    phase: phase(messages),
    requestedTokens: options.maxTokens ?? null,
    wire: [],
    injected: Boolean(fault),
  };
  const fingerprint = sha(
    JSON.stringify({
      model: this.modelId,
      messages,
      options: {
        ...options,
        schema: options.schema ? z.toJSONSchema(options.schema, { unrepresentable: 'any' }) : null,
      },
    }),
  );
  if (fault?.mode === 'truncated' && call.phase !== 'answer-verification') {
    const saved = captures.get(`${fault.replayOperation}:${fingerprint}`);
    assert(saved, 'Control prefix must exactly match an observed live transport input.');
    telemetry.push({ ...call, replayedPrefix: true, ok: saved.ok, failure: saved.reason ?? null });
    return structuredClone(saved);
  }
  const result = await context.run(call, () => realTransport.call(this, messages, options));
  if (!fault) captures.set(`${operation}:${fingerprint}`, structuredClone(result));
  telemetry.push({
    ...call,
    ok: result.ok,
    failure: result.reason ?? null,
    latencyMs: result.latencyMs,
    endpointRequests: result.endpointRequests ?? null,
    usage: result.usage ?? null,
  });
  return result;
};

const environment = Object.fromEntries(
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
);
const installed = loadConfig();
const providers = {};
const modelConnections = {};
for (const role of ['derive', 'embedding']) {
  const model = installed.models[role];
  assert(model.enabled && model.provider, `Configured ${role} connection is required.`);
  const provider = model.provider;
  const name = `smoke_${role}`;
  const secret = `AKNO_RELEASE_SMOKE_${role.toUpperCase()}_KEY`;
  if (provider.apiKey) environment[secret] = provider.apiKey;
  providers[name] = {
    base_url: provider.baseUrl,
    api: provider.api,
    api_key: provider.apiKey ? { env: secret } : null,
    headers: provider.headers,
    max_retries: 0,
  };
  modelConnections[role] = {
    provider: name,
    id: model.id,
    ...(model.dimensions ? { dimensions: model.dimensions } : {}),
  };
}

const ordinary =
  '# Zephyr QX-100\n\n## Recorded details\nThe Zephyr QX-100 case is silver.\n\n## Assistant report\nThe Zephyr QX-100 handle is blue.\n';
const sources = {
  default:
    'The Zephyr QX-100 warranty lasts five years. This information has not been independently verified.',
  english: 'Гарантия Zephyr QX-100 действует пять лет. Эта информация не проверена независимо.',
};
const report = {
  kind: 'bounded-release-smoke',
  startedAt: new Date().toISOString(),
  runtimeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  defaultConfigSha256: sha(fs.readFileSync('config/default.jsonc')),
  builtCoreSha256: tree('packages/core/dist'),
  builtProtocolSha256: tree('packages/protocol/dist'),
  frozenManifestSha256: sha(fs.readFileSync('benchmarks/language/results/fixed-comparison/manifest.json')),
  scope:
    'Two invented sources, one pass per profile, four explicit-English answer requests. No quality score, generalization claim or semantic retry.',
  overrides: [
    'Configured derive/embedding connection and model identities; answer inherits derive identity.',
    'Isolated paths and invented folder rules; disable summaries/facts to bound unrelated model work.',
    'Explicit answer language en, explicit factual/reports view, expansion/graph/reranking off.',
    'Transport retries disabled to bound this smoke; role token limits, reasoning policy and timeouts use committed defaults.',
  ],
  controls:
    'TimeoutError is injected immediately; it does not measure actual deadline expiry. Truncated verification replays exact-input live prefix outcomes and injects an incomplete JSON verdict; no control calls a provider.',
  profiles,
  telemetry,
  checks,
};

function answerProjection(result) {
  return {
    status: result.status,
    outcome: result.outcome,
    reason: result.reason_code ?? null,
    language: result.answer_language,
    answer: result.answer,
    citations: result.citations,
    validation: result.validation,
    degraded: result.degraded ?? [],
    modelUsage: result.model_usage,
  };
}
function retentionProjection(result) {
  return {
    status: result.status,
    outcome: result.outcome,
    degraded: result.degraded ?? [],
    sources: result.sources.map((source) => ({
      outcome: source.outcome,
      reason: source.reason_code ?? null,
      knowledgeLanguage: source.knowledge_language,
      modelUsage: source.model_usage,
      degraded: source.degraded ?? [],
      candidates: source.candidates.map(({ candidate_id, outcome, slug, reason_code, hold_stage }) => ({
        candidate_id,
        outcome,
        slug,
        reason: reason_code ?? null,
        holdStage: hold_stage ?? null,
      })),
    })),
  };
}
async function run(name, action) {
  operation = name;
  const started = Date.now();
  const value = await action();
  console.log(JSON.stringify({ operation: name, elapsedMs: Date.now() - started }));
  return value;
}

try {
  for (const [label, language] of [
    ['default', null],
    ['english', 'en'],
  ]) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-release-smoke-'));
    const kb = path.join(temporary, 'kb');
    const state = path.join(temporary, 'state');
    fs.mkdirSync(path.join(kb, 'memory'), { recursive: true });
    fs.mkdirSync(path.join(kb, 'authored'));
    fs.writeFileSync(path.join(kb, 'memory/equipment.md'), '# Zephyr QX-100\n');
    fs.writeFileSync(path.join(kb, 'authored/passage.md'), ordinary);
    const base = { isolated: true, aknoPath: kb, stateDir: state, env: environment };
    const defaults = loadConfig(base);
    check(
      `${label}: committed default profile`,
      defaults.knowledgeLanguage === null &&
        defaults.models.answer.maxOutputTokens === 2400 &&
        defaults.models.answer.timeoutMs === 60000 &&
        defaults.models.derive.maxOutputTokens === 2400 &&
        defaults.models.derive.timeoutMs === 120000 &&
        !defaults.models.answer.enabled,
    );
    const overrides = {
      providers,
      models: modelConnections,
      ...(language ? { knowledge_language: language } : {}),
      index: { summaries: false, facts: false },
      folders: {
        'memory/**': { role: 'knowledge', remember: 'integrate' },
        'authored/**': { role: 'knowledge', remember: 'deny' },
      },
    };
    const options = { ...base, overrides, actor: 'user', resolveProviderApis: false };
    let memory;
    try {
      memory = await open(options);
      const config = memory.config;
      const entry = {
        label,
        knowledgeLanguage: config.knowledgeLanguage,
        modelPolicy: Object.fromEntries(
          ['derive', 'answer', 'embedding'].map((role) => {
            const m = config.models[role];
            return [
              role,
              {
                id: m.id,
                maxOutputTokens: m.maxOutputTokens ?? null,
                timeoutMs: m.timeoutMs,
                reasoningEffort: m.reasoningEffort ?? null,
                knowledgeLanguage: m.knowledgeLanguage,
              },
            ];
          }),
        ),
      };
      profiles.push(entry);
      check(
        `${label}: live budgets inherit committed defaults`,
        config.knowledgeLanguage === language &&
          config.models.answer.maxOutputTokens === 2400 &&
          config.models.answer.timeoutMs === 60000 &&
          config.models.derive.maxOutputTokens === 2400 &&
          config.models.derive.timeoutMs === 120000 &&
          config.models.answer.reasoningEffort == null &&
          config.models.derive.reasoningEffort == null,
      );
      const beforeIndex = tree(kb);
      await run(`${label}:index`, () => memory.index({}));
      check(`${label}: index preserves source bytes and file set`, tree(kb) === beforeIndex);
      const read = await memory.read({ slug: 'authored/passage' });
      entry.ordinary = read.page.lines.filter((line) => [4, 7].includes(line.n));
      check(
        `${label}: unconditional Markdown qualification`,
        entry.ordinary[0]?.prose?.view === 'factual' &&
          entry.ordinary[0]?.prose?.answer_eligible === true &&
          entry.ordinary[1]?.prose?.view === 'reports' &&
          entry.ordinary[1]?.prose?.answer_eligible === false,
      );
      const discovered = await memory.context({
        profile: 'auto_recall',
        query: 'Zephyr QX-100 case',
        memory_view: 'factual',
        filter: { folder: 'authored' },
      });
      check(`${label}: discoverable language policy`, discovered.knowledge_language === language);
      const source = {
        source_id: 'invented:release-smoke-report',
        revision: 'rev-1111',
        input: { items: [{ item_id: 'turn-1111', role: 'assistant', text: sources[label] }] },
        retention: {
          mode: 'extract',
          mission:
            'Retain the report about Zephyr QX-100 in the existing memory folder, preserving its original qualifications.',
        },
      };
      const retained = await run(`${label}:retain`, () => memory.retain({ sources: [source] }));
      entry.source = source;
      entry.retention = retentionProjection(retained);
      const slugs = [
        ...new Set(
          retained.sources.flatMap((s) =>
            s.candidates.flatMap((candidate) => (candidate.slug ? [candidate.slug] : [])),
          ),
        ),
      ];
      const snapshot = tree(kb);
      await memory.close();
      memory = await open(options);
      await run(`${label}:rebuild`, () => memory.index({ rebuild: true }));
      const replay = await run(`${label}:replay`, () => memory.retain({ sources: [source] }));
      check(
        `${label}: rebuild/replay preserves bytes`,
        tree(kb) === snapshot && replay.sources[0]?.outcome === 'replayed',
      );
      const lines = (await Promise.all(slugs.map((slug) => memory.read({ slug })))).flatMap(
        (result) => result.page?.lines ?? [],
      );
      entry.knowledge = lines.filter((line) => line.memory?.status === 'qualified');
      check(
        `${label}: generated qualified report retained`,
        entry.knowledge.length > 0 &&
          entry.knowledge.every(
            (line) => line.memory.basis === 'source_report' && !line.memory.answer_eligible,
          ),
      );
      const db = new Database(path.join(state, 'akno.db'), { readonly: true });
      try {
        const supports = db
          .prepare('SELECT evidence, evidence_hash FROM retain_supports WHERE selection = ?')
          .all('extracted');
        entry.sourceArchive = supports;
        check(
          `${label}: exact source quotation survives English generation and rebuild`,
          supports.length > 0 &&
            supports.every(
              (support) =>
                support.evidence.includes(sources[label]) && sha(support.evidence) === support.evidence_hash,
            ),
        );
      } finally {
        db.close();
      }
      const requests = {
        ordinary: {
          question: 'What color is the Zephyr QX-100 case?',
          memory_view: 'factual',
          filter: { folder: 'authored' },
        },
        report: {
          question: 'What unverified report was recorded about the Zephyr QX-100 warranty?',
          memory_view: 'reports',
          filter: { folder: 'memory' },
        },
      };
      entry.answers = {};
      for (const [kind, request] of Object.entries(requests)) {
        const input = {
          ...request,
          answer_language: 'en',
          expand: false,
          graph: false,
          rerank: false,
          include_context: true,
        };
        const answer = await run(`${label}:answer-${kind}`, () => memory.answer(input));
        entry.answers[kind] = answerProjection(answer);
        check(
          `${label}: ${kind} answer published with verification`,
          answer.answer !== null && answer.answer_language === 'en' && answer.validation?.verified_blocks > 0,
        );
        if (kind === 'report') {
          // Same query and current KB make the replayed prefix a transport control, not new evidence.
          fault = { mode: 'truncated', replayOperation: `${label}:answer-report` };
          const failed = await run(`${label}:control-truncated-verification`, () => memory.answer(input));
          fault = null;
          entry.truncatedVerification = answerProjection(failed);
          check(
            `${label}: incomplete audit withheld with typed failure`,
            failed.answer === null &&
              failed.reason_code === 'verification_unavailable' &&
              failed.degraded?.includes('answer_verification_failed'),
          );
        }
      }
      fault = { mode: 'timeout' };
      const timeout = await run(`${label}:control-answer-timeout`, () =>
        memory.answer({
          ...requests.ordinary,
          answer_language: 'en',
          expand: false,
          graph: false,
          rerank: false,
        }),
      );
      const held = await run(`${label}:control-retain-timeout`, () =>
        memory.retain({ sources: [{ ...source, source_id: 'invented:release-smoke-timeout' }] }),
      );
      fault = null;
      entry.answerTimeout = answerProjection(timeout);
      entry.retentionTimeout = retentionProjection(held);
      check(
        `${label}: generation timeout is typed and publishes nothing`,
        timeout.answer === null &&
          timeout.degraded?.includes('answer_failed') &&
          telemetry.some(
            (call) => call.operation === `${label}:control-answer-timeout` && call.failure === 'timeout',
          ),
      );
      check(
        `${label}: extraction timeout is typed and writes no memory`,
        held.degraded?.includes('derive_failed') &&
          !held.sources.some((s) =>
            s.candidates.some((candidate) =>
              ['written', 'support_added', 'duplicate'].includes(candidate.outcome),
            ),
          ) &&
          telemetry.some(
            (call) => call.operation === `${label}:control-retain-timeout` && call.failure === 'timeout',
          ),
      );
      check(`${label}: answers and injected failures preserve all KB bytes`, tree(kb) === snapshot);
      check(
        `${label}: each injected transport fault uses exactly one request`,
        telemetry
          .filter((call) => call.operation.startsWith(`${label}:control-`) && !call.replayedPrefix)
          .every((call) => call.endpointRequests === 1 && call.wire.length === 1),
      );
      const liveCalls = telemetry.filter((call) => call.operation.startsWith(`${label}:`) && !call.injected);
      check(
        `${label}: source verification applies with either language policy`,
        liveCalls.some((call) => call.phase === 'retention-verification' && call.ok),
      );
      check(
        `${label}: wire ceiling reaches 2400 for answer verification`,
        liveCalls.some(
          (call) =>
            call.phase === 'answer-verification' && call.wire.some((wire) => wire.maxOutputTokens === 2400),
        ),
      );
      check(
        `${label}: ordinary generation requests and sends 1024`,
        liveCalls.some(
          (call) =>
            call.operation === `${label}:answer-ordinary` &&
            call.phase === 'generation' &&
            call.requestedTokens === 1024 &&
            call.wire.some((wire) => wire.maxOutputTokens === 1024),
        ),
      );
      check(
        `${label}: all answer/derive wire limits stay within 2400`,
        liveCalls.every((call) =>
          call.wire.every((wire) => wire.maxOutputTokens > 0 && wire.maxOutputTokens <= 2400),
        ),
      );
    } finally {
      fault = null;
      await memory?.close();
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  completed = true;
} catch (error) {
  report.harnessFailure = { stage: operation, kind: error.name };
  console.error('Smoke execution stopped; the partial report is preserved.');
} finally {
  globalThis.fetch = realFetch;
  ModelClient.prototype.chatTransport = realTransport;
  report.finishedAt = new Date().toISOString();
  report.passed = completed && checks.every((item) => item.ok) && profiles.length === 2;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log(
  JSON.stringify({ passed: report.passed, checks: checks.length, failed: checks.filter((item) => !item.ok) }),
);
if (!report.passed) process.exitCode = 1;
