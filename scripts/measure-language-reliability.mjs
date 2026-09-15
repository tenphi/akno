#!/usr/bin/env node
/** Focused opt-in measurement through built public operations; results require source review. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { open, loadConfig } from '../packages/core/dist/index.js';
import { proseQualifications, PROSE_PROJECTION_VERSION } from '../packages/core/dist/kb/prose.js';
import { inferMemoryView, MEMORY_VIEW_VERSION } from '../packages/core/dist/memory/intent.js';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../packages/core/dist/ops/answer.js';
import { RETAIN_PROMPT_VERSION, RETAIN_VERIFIER_VERSION } from '../packages/core/dist/write/retain.js';

const { values } = parseArgs({
  options: {
    prepare: { type: 'boolean' },
    live: { type: 'boolean' },
    config: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(
  values.output && Boolean(values.prepare) !== Boolean(values.live),
  'Use --prepare or --live, with a new --output directory. Live also requires --config.',
);
const output = path.resolve(values.output);
assert(!fs.existsSync(output), 'Existing evidence must not be overwritten.');
const repo = fileURLToPath(new URL('..', import.meta.url));
const corpusPath = path.join(repo, 'benchmarks/language/pr73-live-cases.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const write = (name, value) =>
  fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function snapshot(root) {
  const names = fs
    .readdirSync(root, { recursive: true })
    .filter((name) => fs.statSync(path.join(root, name)).isFile())
    .sort();
  return names.map((name) => ({ path: name, sha256: sha(fs.readFileSync(path.join(root, name))) }));
}
function pageLines(result) {
  return result.results.flatMap((entry) => (entry.type === 'page' ? entry.lines : []));
}
const hasFocus = (entry, line) =>
  entry.path === 'ordinary' ? line.n === entry.focusLine : line.memory?.status === 'qualified';
const staticChecks = corpus.cases.map((entry) => {
  const views = Object.fromEntries(
    Object.entries(entry.queries).map(([language, query]) => [language, inferMemoryView(query)]),
  );
  assert(
    Object.values(views).every((view) => view === entry.view),
    `${entry.id}: unexpected query view`,
  );
  const prose = entry.markdown ? proseQualifications(entry.markdown.split('\n')).get(entry.focusLine) : null;
  if (prose) assert.equal(prose.view, entry.view);
  return { id: entry.id, views, prose };
});
const manifest = {
  kind: 'focused-language-reliability',
  corpusVersion: corpus.version,
  createdAt: new Date().toISOString(),
  runtimeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  corpusSha256: sha(fs.readFileSync(corpusPath)),
  builtCoreSha256: sha(JSON.stringify(snapshot(path.join(repo, 'packages/core/dist')))),
  builtProtocolSha256: sha(JSON.stringify(snapshot(path.join(repo, 'packages/protocol/dist')))),
  versions: {
    prose: PROSE_PROJECTION_VERSION,
    view: MEMORY_VIEW_VERSION,
    extraction: RETAIN_PROMPT_VERSION,
    retentionVerification: RETAIN_VERIFIER_VERSION,
    answer: ANSWER_PROMPT_VERSION,
    answerVerification: ANSWER_VERIFIER_PROMPT_VERSION,
  },
  runs: corpus.runs,
  cases: corpus.cases.length,
  targetAnswerCoordinates: corpus.runs * corpus.cases.length * 3 * 2,
  knowledgeLanguage: 'en',
  staticChecks,
  independentlyReviewed: false,
  releaseEligible: false,
};
fs.mkdirSync(output, { recursive: true });
write('cases.json', corpus);
if (values.prepare) {
  write('preparation.json', { ...manifest, liveExecuted: false, modelCalls: 0 });
  console.log(
    JSON.stringify({
      output,
      prepared: true,
      liveExecuted: false,
      coordinates: manifest.targetAnswerCoordinates,
    }),
  );
} else {
  assert(values.config, 'Supply the earlier provider configuration with --config.');
  const preflight = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-preflight-'));
  let configured;
  try {
    configured = loadConfig({
      aknoPath: preflight,
      stateDir: path.join(preflight, 'state'),
      env: { ...process.env, AKNO_CONFIG: path.resolve(values.config), AKNO_ISOLATED: '0' },
    });
    for (const role of ['derive', 'answer']) {
      const model = configured.models[role];
      assert(
        model.enabled && model.provider && model.id === 'gpt-5.6-luna',
        `The earlier ${role} model must resolve to gpt-5.6-luna.`,
      );
    }
  } catch (error) {
    write('preflight-failure.json', {
      ...manifest,
      liveExecuted: false,
      code: error.code ?? error.name,
      reason:
        'The requested earlier provider configuration could not be resolved. No evaluation call started.',
    });
    throw error;
  } finally {
    fs.rmSync(preflight, { recursive: true, force: true });
  }
  const env = Object.fromEntries(
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
    ].map((name) => [name, '']),
  );
  const providers = Object.fromEntries(
    Object.entries(configured.providers).map(([name, provider], index) => {
      const secret = `AKNO_FOCUSED_EVAL_${index}_KEY`;
      if (provider.apiKey) env[secret] = provider.apiKey;
      return [
        name,
        {
          base_url: provider.baseUrl,
          api: provider.api,
          api_key: provider.apiKey ? { env: secret } : null,
          headers: provider.headers,
          max_retries: provider.maxRetries,
        },
      ];
    }),
  );
  const role = (name) => {
    const model = configured.models[name];
    return {
      provider: model.provider?.name,
      id: model.id,
      enabled: model.enabled,
      timeout_ms: model.timeoutMs,
      max_output_tokens: model.maxOutputTokens,
      reasoning_effort: model.reasoningEffort,
      dimensions: model.dimensions,
    };
  };
  const overrides = {
    providers,
    knowledge_language: 'en',
    write_ids: false,
    create_reserved_paths: false,
    index: { summaries: false, facts: false },
    folders: {
      'memory/**': { role: 'knowledge', remember: 'integrate' },
      'authored/**': { role: 'knowledge', remember: 'deny' },
    },
    models: {
      derive: role('derive'),
      answer: role('answer'),
      embedding: role('embedding'),
      expansion: { id: null, enabled: false },
      reranker: { id: null, enabled: false },
      vision: { id: null, enabled: false },
    },
  };
  manifest.models = Object.fromEntries(
    ['derive', 'answer', 'embedding'].map((name) => {
      const model = configured.models[name];
      return [
        name,
        {
          id: model.id,
          enabled: model.enabled,
          api: model.provider?.api,
          timeoutMs: model.timeoutMs,
          maxOutputTokens: model.maxOutputTokens ?? null,
          reasoningEffort: model.reasoningEffort ?? null,
          providerRetries: model.provider?.maxRetries ?? null,
        },
      ];
    }),
  );
  manifest.overrides = [
    'Isolated invented knowledge bases; English knowledge policy.',
    'Index summaries/facts, expansion, reranking and graph expansion disabled to focus the measured path.',
    'Generation, verification and embedding roles inherit the supplied provider configuration.',
  ];
  write('manifest.json', manifest);
  const realFetch = globalThis.fetch;
  let activeOperation = 'initialization';
  let networkRequests = 0;
  globalThis.fetch = async (url, options) => {
    const request = typeof options?.body === 'string' ? JSON.parse(options.body) : {};
    const started = Date.now();
    const receipt = {
      sequence: ++networkRequests,
      operation: activeOperation,
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
  const results = [];
  const completed = [];
  for (let run = 1; run <= corpus.runs; run++) {
    for (const entry of corpus.cases) {
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-focused-language-'));
      const root = path.join(temporary, 'kb');
      const options = {
        aknoPath: root,
        stateDir: path.join(temporary, 'state'),
        env,
        isolated: true,
        actor: 'user',
        overrides,
      };
      const result = {
        id: entry.id,
        path: entry.path,
        sourceLanguage: entry.sourceLanguage,
        run,
        startedAt: new Date().toISOString(),
        retrieval: [],
        answers: [],
        negativeControls: [],
      };
      const progress = (name) => {
        activeOperation = `${entry.id}/run-${run}/${name}`;
        console.log(JSON.stringify({ run, case: entry.id, operation: name }));
      };
      let memory;
      try {
        fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
        fs.mkdirSync(path.join(root, 'authored'));
        fs.writeFileSync(path.join(root, 'memory/equipment.md'), '# Zephyr QX-100\n');
        if (entry.markdown) fs.writeFileSync(path.join(root, 'authored/passage.md'), entry.markdown);
        const original = snapshot(root);
        progress('index');
        memory = await open(options);
        await memory.index({ structuralOnly: true });
        result.indexBytesStable = JSON.stringify(snapshot(root)) === JSON.stringify(original);
        let source;
        if (entry.path === 'retained') {
          source = {
            source_id: `invented:${entry.id}`,
            revision: 'rev-1111',
            input: { items: entry.items },
            retention: {
              mode: 'extract',
              mission:
                'Retain the report about Zephyr QX-100 in the existing memory folder, preserving every source qualification.',
            },
          };
          progress('retain');
          const retained = await memory.retain({ sources: [source] });
          result.retention = {
            status: retained.status,
            degraded: retained.degraded ?? [],
            sources: retained.sources.map((s) => ({
              outcome: s.outcome,
              reason: s.reason_code ?? null,
              knowledgeLanguage: s.knowledge_language,
              modelUsage: s.model_usage,
              candidates: s.candidates.map((c) => ({
                outcome: c.outcome,
                slug: c.slug,
                reason: c.reason_code ?? null,
                holdStage: c.hold_stage ?? null,
                routingReason: c.routing_reason ?? null,
              })),
            })),
          };
        }
        const afterRetention = snapshot(root);
        await memory.close();
        progress('rebuild');
        memory = await open(options);
        await memory.index({ rebuild: true, structuralOnly: true });
        if (source) result.replayOutcome = (await memory.retain({ sources: [source] })).sources[0]?.outcome;
        result.rebuildReplayBytesStable = JSON.stringify(snapshot(root)) === JSON.stringify(afterRetention);
        const folder = entry.path === 'ordinary' ? 'authored' : 'memory';
        const pages = snapshot(root).filter(
          (file) => file.path.startsWith(folder + '/') && file.path.endsWith('.md'),
        );
        result.knowledge = [];
        for (const file of pages) {
          const read = await memory.read({ slug: file.path.slice(0, -3) });
          result.knowledge.push({ slug: file.path.slice(0, -3), lines: read.page?.lines ?? [] });
        }
        for (const [queryLanguage, query] of Object.entries(entry.queries)) {
          progress(`${queryLanguage}:retrieval`);
          const input = { query, filter: { folder }, expand: false, rerank: false, graph: false };
          const inferred = await memory.recall(input);
          const explicit = await memory.recall({ ...input, memory_view: entry.view });
          const context = await memory.context({ profile: 'auto_recall', query, filter: { folder } });
          result.retrieval.push({
            queryLanguage,
            inferredView: inferred.memory_view,
            explicitView: explicit.memory_view,
            inferredFocus: pageLines(inferred).some((line) => hasFocus(entry, line)),
            explicitFocus: pageLines(explicit).some((line) => hasFocus(entry, line)),
            evidence: pageLines(inferred),
            status: inferred.status,
            degraded: inferred.degraded ?? [],
            contextStatus: context.status,
            contextActivation: context.activation,
            contextDegraded: context.degraded ?? [],
            knowledgeLanguage: context.knowledge_language,
          });
          for (const answerLanguage of ['en', 'ru']) {
            progress(`${queryLanguage}/${answerLanguage}:answer`);
            const answer = await memory.answer({
              question: query,
              answer_language: answerLanguage,
              filter: { folder },
              expand: false,
              graph: false,
              include_context: true,
            });
            result.answers.push({
              queryLanguage,
              answerLanguage,
              status: answer.status,
              outcome: answer.outcome,
              reason: answer.reason_code,
              memoryView: answer.memory_view,
              answer: answer.answer,
              context: answer.context,
              citations: answer.citations,
              validation: answer.validation,
              degraded: answer.degraded ?? [],
              modelUsage: answer.model_usage,
            });
          }
          if (entry.view !== 'factual') {
            progress(`${queryLanguage}:factual-control`);
            const negative = await memory.answer({
              question: query,
              answer_language: 'en',
              memory_view: 'factual',
              filter: { folder },
              expand: false,
              graph: false,
              include_context: true,
            });
            result.negativeControls.push({
              queryLanguage,
              answer: negative.answer,
              reason: negative.reason_code,
              context: negative.context,
              memoryView: negative.memory_view,
              degraded: negative.degraded ?? [],
            });
          }
        }
        result.readBytesStable = JSON.stringify(snapshot(root)) === JSON.stringify(afterRetention);
        result.completed = true;
      } catch (error) {
        // Provider error strings can contain endpoints. Keep only the typed failure category.
        result.completed = false;
        result.failure = error.code ?? error.name ?? 'operation_failed';
      } finally {
        await memory?.close();
        fs.rmSync(temporary, { recursive: true, force: true });
      }
      result.finishedAt = new Date().toISOString();
      write(`${entry.id}-run-${run}.json`, result);
      results.push(result);
      completed.push({ id: entry.id, run, completed: result.completed, answers: result.answers.length });
    }
  }
  const answers = results.flatMap((result) => result.answers);
  globalThis.fetch = realFetch;
  write('completion.json', {
    completed,
    attemptedTargetAnswers: answers.length,
    expectedTargetAnswers: manifest.targetAnswerCoordinates,
    nonnullAnswers: answers.filter((answer) => answer.answer !== null).length,
    networkRequests,
    adjudication: 'pending source-based review; nonnull answers are not correctness labels',
    independentlyReviewed: false,
    releaseEligible: false,
  });
  console.log(
    JSON.stringify({ output, completedCaseRuns: completed.length, answerCoordinates: answers.length }),
  );
}
