#!/usr/bin/env node
/** Common-input comparison of separately built revisions, with optional coupled live responses. */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { comparisonFixtures, hash } from './language-comparison-fixtures.mjs';
import { coupledTransport } from './language-comparison-transport.mjs';
import { assertComparisonComplete } from './language-comparison-validation.mjs';

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    candidate: { type: 'string' },
    output: { type: 'string' },
    live: { type: 'boolean' },
    config: { type: 'string' },
  },
});
assert(
  values.baseline && values.candidate && values.output,
  'Supply --baseline ROOT --candidate ROOT --output NEW_DIRECTORY [--live --config FILE].',
);
assert(!values.live || values.config, 'Live mode needs a provider configuration.');
const repo = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(values.output);
assert(!fs.existsSync(output), 'Never overwrite completed or partial evidence.');
const plan = JSON.parse(fs.readFileSync(path.join(repo, 'benchmarks/language/pr73-paired-plan.json')));
const fixtures = comparisonFixtures(repo);
const selected = values.live
  ? plan.liveCases.map((item) => {
      const fixture = fixtures.find((entry) => entry.id === item.id);
      assert(fixture && fixture.queries[item.language]);
      return { ...fixture, queries: { [item.language]: fixture.queries[item.language] } };
    })
  : fixtures;
const arms = {};
const tree = (root) =>
  Object.fromEntries(
    fs
      .readdirSync(root, { recursive: true })
      .filter((name) => fs.statSync(path.join(root, name)).isFile())
      .sort()
      .map((name) => [name, hash(fs.readFileSync(path.join(root, name)))]),
  );
for (const name of ['baseline', 'candidate']) {
  const root = path.resolve(values[name]);
  arms[name] = {
    root,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceDiff: hash(execFileSync('git', ['diff', 'HEAD', '--', 'packages'], { cwd: root })),
    core: tree(path.join(root, 'packages/core/dist')),
    protocol: tree(path.join(root, 'packages/protocol/dist')),
    api: await import(pathToFileURL(path.join(root, 'packages/core/dist/index.js'))),
    proseProjectionVersion: (await import(pathToFileURL(path.join(root, 'packages/core/dist/kb/prose.js'))))
      .PROSE_PROJECTION_VERSION,
  };
  const require = createRequire(path.join(root, 'packages/core/package.json'));
  assert.equal(
    fs.realpathSync(require.resolve('@tenphi/akno-protocol')),
    fs.realpathSync(path.join(root, 'packages/protocol/dist/index.js')),
    'Protocol resolved outside its arm.',
  );
}
assert.equal(arms.baseline.head, plan.baseline, 'Wrong declared baseline.');
const differentModules = [
  ...new Set([...Object.keys(arms.baseline.core), ...Object.keys(arms.candidate.core)]),
].filter((file) => file.endsWith('.js') && arms.baseline.core[file] !== arms.candidate.core[file]);
assert(
  differentModules.every(
    (file) => file.startsWith('bench/') || ['kb/prose.js', 'memory/intent.js'].includes(file),
  ),
  'Production scope changed: declare a new experiment before comparing.',
);
assert.deepEqual(arms.baseline.protocol, arms.candidate.protocol);
const overrides = values.live ? JSON.parse(fs.readFileSync(values.config)) : {};
overrides.knowledge_language = 'en';
overrides.write_ids = false;
overrides.create_reserved_paths = false;
overrides.index = { summaries: false, facts: false };
overrides.folders = { '**': { role: 'knowledge', remember: 'deny' } };
overrides.models = {
  ...overrides.models,
  derive: { id: null, enabled: false },
  expansion: { id: null, enabled: false },
  vision: { id: null, enabled: false },
};
if (!values.live)
  for (const role of ['answer', 'embedding', 'reranker'])
    overrides.models[role] = { id: null, enabled: false };
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('AKNO_')));
const preflight = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-paired-config-'));
let models;
try {
  const config = arms.candidate.api.loadConfig({
    isolated: true,
    aknoPath: preflight,
    stateDir: preflight,
    env,
    overrides,
  });
  models = Object.fromEntries(
    ['answer', 'embedding', 'reranker'].map((role) => {
      const model = config.models[role];
      return [
        role,
        {
          id: model.id,
          enabled: model.enabled,
          api: model.provider?.api,
          timeoutMs: model.timeoutMs,
          maxOutputTokens: model.maxOutputTokens,
          reasoningEffort: model.reasoningEffort,
          dimensions: model.dimensions,
          mode: model.rerankerMode,
          topK: model.topK,
          maxChars: model.maxChars,
          excludeIrrelevant: model.excludeIrrelevant,
          retries: model.provider?.maxRetries,
        },
      ];
    }),
  );
  if (values.live) {
    assert.equal(models.answer.id, 'gpt-5.6-luna');
    assert.equal(models.reranker.id, 'gpt-5.6-luna');
    assert.equal(models.answer.reasoningEffort, 'low');
    assert(models.embedding.enabled && models.reranker.enabled);
  }
} finally {
  fs.rmSync(preflight, { recursive: true, force: true });
}
fs.mkdirSync(output, { recursive: true });
const write = (name, value) =>
  fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
write('plan.json', plan);
write('fixtures.json', selected);
write('manifest.json', {
  mode: values.live ? 'coupled-live-downstream-comparison' : 'offline-downstream-comparison',
  createdAt: new Date().toISOString(),
  planSha256: hash(JSON.stringify(plan)),
  fixturesSha256: hash(JSON.stringify(selected)),
  runners: Object.fromEntries(
    [
      'compare-language-reliability.mjs',
      'language-comparison-fixtures.mjs',
      'language-comparison-transport.mjs',
      'language-comparison-validation.mjs',
    ].map((file) => [file, hash(fs.readFileSync(path.join(repo, 'scripts', file)))]),
  ),
  arms: Object.fromEntries(
    Object.entries(arms).map(([name, { head, sourceDiff, core, protocol, proseProjectionVersion }]) => [
      name,
      { head, sourceDiff, core, protocol, proseProjectionVersion },
    ]),
  ),
  differentModules,
  models,
  fixtureFileTime: '2026-01-11T00:00:00Z',
  limitations: [
    'Exposed sources and rehydrated public retained outputs, not original saved KBs. Text, IDs and typed qualifications are checked after indexing; fixture-only receipts and empty links/reporters are shared across arms.',
    'No retention, source archive, replay or overall accuracy claim. Empty and incomplete records are not repaired. Reconstructed markers do not reproduce original provenance-backed answer verification or lineage.',
    'Live identical wire requests share a response only within the same case/repetition/stage. Other requests remain stochastic. Physical usage excludes reused responses.',
  ],
});
const context = new AsyncLocalStorage();
const realFetch = globalThis.fetch;
let sequence = 0;
const coupledFetch = coupledTransport({
  fetch: realFetch,
  coordinate: () => context.getStore(),
  receipt: (receipt) => {
    sequence = Math.max(sequence, receipt.sequence);
    fs.appendFileSync(path.join(output, 'network-receipts.jsonl'), JSON.stringify(receipt) + '\n');
  },
});
globalThis.fetch = (url, options) => {
  assert(values.live, 'Offline mode must never call a provider.');
  return coupledFetch(url, options);
};
const pageLines = (result) => result.results.flatMap((entry) => (entry.type === 'page' ? entry.lines : []));
function evidence(result) {
  return pageLines(result)
    .filter(
      (line) =>
        line.memory?.status === 'qualified' ||
        (line.prose && !['heading', 'comment'].includes(line.prose.reason) && line.text.trim()),
    )
    .map((line) => ({ n: line.n, text: line.text, memory: line.memory ?? null, prose: line.prose ?? null }));
}
const results = [];
let attempted = 0;
async function execute(entry, run, order) {
  attempted++;
  return context.run({ id: entry.id, run, arm: null, stage: null }, async () => {
    const pair = { id: entry.id, run, order, arms: {} };
    const partialPath = path.join(output, `${entry.id.replaceAll('/', '-')}-repeat-${run}.partial.json`);
    const checkpoint = () => fs.writeFileSync(partialPath, JSON.stringify(pair, null, 2) + '\n');
    for (const arm of order) {
      const active = context.getStore();
      active.arm = arm;
      active.stage = 'index';
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-paired-'));
      const kb = path.join(temporary, 'kb');
      fs.mkdirSync(kb);
      fs.writeFileSync(path.join(kb, 'equipment.md'), entry.markdown);
      fs.utimesSync(
        path.join(kb, 'equipment.md'),
        new Date('2026-01-11T00:00:00Z'),
        new Date('2026-01-11T00:00:00Z'),
      );
      const original = tree(kb);
      let memory;
      const result = { queries: [] };
      pair.arms[arm] = result;
      try {
        memory = await arms[arm].api.open({
          isolated: true,
          actor: 'user',
          aknoPath: kb,
          stateDir: path.join(temporary, 'state'),
          env,
          overrides,
        });
        await memory.index({ structuralOnly: !values.live });
        const read = await memory.read({ slug: 'equipment' });
        result.read = read.page.lines;
        result.projections = (entry.projections ?? []).map((expected) => ({
          ...expected,
          actual: read.page.lines.find((line) => line.n === expected.n)?.prose ?? null,
        }));
        checkpoint();
        if (entry.records)
          assert.deepEqual(
            read.page.lines
              .filter((line) => line.memory?.status === 'qualified')
              .map((line) => ({ text: line.text, qualification: line.memory })),
            entry.records,
            'Rehydration changed public records.',
          );
        for (const [language, query] of Object.entries(entry.queries)) {
          for (const explicit of [false, true]) {
            const view = explicit ? { memory_view: entry.view } : {};
            const coordinate = `${language}/${explicit ? 'explicit' : 'inferred'}`;
            active.stage = `${coordinate}/recall`;
            const recalled = await memory.recall({
              query,
              expand: false,
              rerank: !!values.live,
              graph: false,
              ...view,
            });
            active.stage = `${coordinate}/context`;
            const injected = await memory.context({ profile: 'auto_recall', query, ...view });
            const item = {
              language,
              query,
              explicit,
              expectedView: entry.view,
              view: recalled.memory_view,
              recallStatus: recalled.status,
              recallDegraded: recalled.degraded ?? [],
              evidence: evidence(recalled),
              contextView: injected.memory_view,
              contextStatus: injected.status,
              context: evidence(injected),
              contextDegraded: injected.degraded ?? [],
              answers: [],
            };
            result.queries.push(item);
            checkpoint();
            for (const answerLanguage of values.live ? ['en', 'ru'] : ['en']) {
              active.stage = `${coordinate}/answer-${answerLanguage}`;
              const answer = await memory.answer({
                question: query,
                answer_language: answerLanguage,
                expand: false,
                graph: false,
                include_context: true,
                ...view,
              });
              item.answers.push(answer);
              checkpoint();
            }
          }
        }
        active.stage = 'factual-control';
        const factual = await memory.recall({
          query: 'Zephyr QX-100',
          memory_view: 'factual',
          expand: false,
          rerank: false,
          graph: false,
        });
        result.factualEvidence = evidence(factual);
        const factualQuery = Object.values(entry.queries)[0];
        active.stage = 'factual-control/context';
        const factualContext = await memory.context({
          profile: 'auto_recall',
          query: factualQuery,
          memory_view: 'factual',
        });
        active.stage = 'factual-control/answer-en';
        const factualAnswer = await memory.answer({
          question: factualQuery,
          answer_language: 'en',
          memory_view: 'factual',
          expand: false,
          graph: false,
          include_context: true,
        });
        result.factualControl = { query: factualQuery, context: factualContext, answer: factualAnswer };
        // Recall may intentionally return annotated, ineligible inspection material. Only
        // admission to answer evidence or an incorrect factual projection is a promotion.
        result.unsafeFactualProjections = result.projections.filter(
          (item) => item.view !== 'factual' && item.actual?.answer_eligible,
        );
        result.unsafeFactualAnswerLines = [...result.queries.flatMap((item) => item.answers), factualAnswer]
          .filter((answer) => answer.memory_view === 'factual')
          .flatMap((answer) => evidence({ results: answer.context ?? [] }))
          .filter((line) => (line.memory ? !line.memory.answer_eligible : !line.prose.answer_eligible));
        result.unsafeFactualContextLines = evidence(factualContext).filter((line) =>
          line.memory ? !line.memory.answer_eligible : !line.prose.answer_eligible,
        );
        result.bytesStable = JSON.stringify(original) === JSON.stringify(tree(kb));
      } catch (error) {
        result.harnessError = { type: error.name, stage: active.stage };
        checkpoint();
      } finally {
        await memory?.close();
        fs.rmSync(temporary, { recursive: true, force: true });
      }
      checkpoint();
    }
    if (!values.live && entry.path === 'ordinary') {
      pair.upgrade = await upgradeProjection(entry);
      checkpoint();
    }
    write(`${entry.id.replaceAll('/', '-')}-repeat-${run}.json`, pair);
    if (Object.values(pair.arms).every((arm) => !arm.harnessError)) fs.unlinkSync(partialPath);
    results.push(pair);
    console.log(JSON.stringify({ completed: results.length, id: entry.id, run }));
  });
}
async function upgradeProjection(entry) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-paired-upgrade-'));
  const kb = path.join(temporary, 'kb');
  const stateDir = path.join(temporary, 'state');
  fs.mkdirSync(kb);
  fs.writeFileSync(path.join(kb, 'equipment.md'), entry.markdown);
  const original = tree(kb);
  const result = {};
  let memory;
  try {
    for (const arm of ['baseline', 'candidate']) {
      memory = await arms[arm].api.open({
        isolated: true,
        actor: 'user',
        aknoPath: kb,
        stateDir,
        env,
        overrides,
      });
      // Reuse the real base-created index; an ordinary index pass must upgrade stale scope.
      await memory.index({ structuralOnly: true });
      result[arm] = (await memory.read({ slug: 'equipment' })).page.lines;
      await memory.close();
      memory = null;
      const Database = createRequire(path.join(arms[arm].root, 'packages/core/package.json'))(
        'better-sqlite3',
      );
      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      try {
        result[`${arm}Version`] = db
          .prepare("SELECT value FROM meta WHERE key = 'prose_projection_version'")
          .get().value;
        result[`${arm}StoredProjections`] = db
          .prepare('SELECT line, view, eligible FROM prose_entries ORDER BY line')
          .all();
      } finally {
        db.close();
      }
    }
    result.bytesStable = JSON.stringify(original) === JSON.stringify(tree(kb));
    return result;
  } finally {
    await memory?.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
try {
  const jobs = Array.from({ length: values.live ? plan.runs : 1 }, (_, index) =>
    selected.map((entry, i) => ({
      entry,
      run: index + 1,
      order: (i + index) % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
    })),
  ).flat();
  // Two independent case pairs may run concurrently; each pair submits its arms sequentially.
  const queues = [jobs.filter((_, i) => i % 2 === 0), jobs.filter((_, i) => i % 2 === 1)];
  const completed = await Promise.allSettled(
    queues.map(async (queue) => {
      for (const { entry, run, order } of queue) await execute(entry, run, order);
    }),
  );
  const fatalErrors = completed.filter((item) => item.status === 'rejected').map((item) => item.reason);
  results.sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run);
  write('results.json', {
    schemaVersion: 'paired-results-index-v1',
    pairs: results.map((pair) => {
      const file = `${pair.id.replaceAll('/', '-')}-repeat-${pair.run}.json`;
      return { file, sha256: hash(fs.readFileSync(path.join(output, file))) };
    }),
  });
  const unchanged = Object.values(arms).every(
    (arm) =>
      JSON.stringify(arm.core) === JSON.stringify(tree(path.join(arm.root, 'packages/core/dist'))) &&
      JSON.stringify(arm.protocol) === JSON.stringify(tree(path.join(arm.root, 'packages/protocol/dist'))),
  );
  const completion = {
    pairs: results.length,
    expected: jobs.length,
    runtimeUnchanged: unchanged,
    requests: sequence,
    attemptedPairs: attempted,
    failedPairs:
      results.filter((pair) => Object.values(pair.arms).some((arm) => arm.harnessError)).length +
      attempted -
      results.length,
    unstartedPairs: jobs.length - attempted,
    fatalErrors: fatalErrors.map((error) => ({ type: error.name })),
  };
  write('completion.json', completion);
  if (fatalErrors.length) throw fatalErrors[0];
  assertComparisonComplete(completion);
} finally {
  globalThis.fetch = realFetch;
}
