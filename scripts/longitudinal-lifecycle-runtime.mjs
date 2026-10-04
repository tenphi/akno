import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { open, MAINTENANCE_TRANSFORMS } from '../packages/core/dist/index.js';
import { serveSocket } from '../packages/cli/dist/serve/socket.js';
import { connect } from '../packages/client/dist/index.js';
import { ModelClient } from '../packages/core/dist/models/client.js';
import { observationBlock, insertObservationBlock } from '../packages/core/dist/observations/marker.js';
import { proofGroupsForFact } from '../packages/core/dist/observations/projection.js';
import {
  LIFECYCLE_CORPUS,
  LIFECYCLE_CORPUS_VERSION,
  LIFECYCLE_GATES,
} from '../packages/core/src/bench/longitudinal-lifecycle-corpus.ts';
import {
  INFERENCE_CORPUS,
  INFERENCE_CORPUS_VERSION,
} from '../packages/core/src/bench/longitudinal-inference-corpus.ts';
const Database = createRequire(new URL('../packages/core/package.json', import.meta.url))('better-sqlite3');
export const lifecycleHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const accounting = new AsyncLocalStorage();
const nesting = new AsyncLocalStorage();
const indexControl = new AsyncLocalStorage();
let active = false;

function observeModels() {
  const originals = new Map();
  for (const method of ['chat', 'embed', 'rerank']) {
    const original = ModelClient.prototype[method];
    originals.set(method, original);
    ModelClient.prototype[method] = async function (...args) {
      const calls = accounting.getStore();
      const control = indexControl.getStore();
      if (
        method === 'chat' &&
        control &&
        args[0]?.[0]?.content.startsWith('You extract structure from a personal knowledge base page.')
      ) {
        const user = args[0].find((message) => message.role === 'user')?.content ?? '';
        const slug = /^Page: (.+)$/m.exec(user)?.[1];
        const fact = (Array.isArray(control) ? control : control.facts).find((entry) => entry.slug === slug);
        if (fact || !control.leafOnly) {
          const line = fact
            ? [...user.matchAll(/^(\d+): (.+)$/gm)].find(
                (match) => match[2].startsWith(fact.subject) && /before|after/.test(match[2]),
              )
            : null;
          const value = {
            summary: '',
            keywords: [],
            facts: line
              ? [
                  {
                    line: Number(line[1]),
                    claim: line[2],
                    subject: fact.subject,
                    attribute: 'preparation timing',
                    value: /after operation/.test(line[2])
                      ? 'after operation'
                      : /before operation/.test(line[2])
                        ? 'before operation'
                        : /before departure/.test(line[2])
                          ? 'before departure'
                          : 'before assembly',
                  },
                ]
              : [],
          };
          calls?.push({ scripted: true, completedAt: performance.now() });
          return { ok: true, value: JSON.stringify(value), latencyMs: 0, endpointRequests: 0 };
        }
      }
      if (!calls || nesting.getStore()) return original.apply(this, args);
      return nesting.run(true, async () => {
        const result = await original.apply(this, args);
        calls.push({
          ok: result.ok,
          failure: result.reason ?? null,
          usage: result.usage ?? null,
          latencyMs: result.latencyMs,
          endpointRequests: result.endpointRequests ?? null,
          completedAt: performance.now(),
        });
        return result;
      });
    };
  }
  return () => {
    for (const [method, original] of originals) ModelClient.prototype[method] = original;
  };
}

function fixtureConfiguration(config, arm, track, deriveId, kind) {
  const env = {};
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([name, provider], index) => {
      const key = `AKNO_LIFECYCLE_${index}_KEY`;
      if (provider.apiKey) env[key] = provider.apiKey;
      return [
        name,
        {
          base_url: provider.baseUrl,
          api: provider.api,
          headers: provider.headers,
          api_key: provider.apiKey ? { env: key } : null,
          max_retries: provider.maxRetries,
        },
      ];
    }),
  );
  const role = (name) => {
    const model = config.models[name];
    return {
      provider: model.provider?.name,
      id: name === 'derive' ? deriveId : model.id,
      enabled: model.enabled,
      timeout_ms: model.timeoutMs,
      max_output_tokens: model.maxOutputTokens,
      reasoning_effort: model.reasoningEffort,
      dimensions: model.dimensions,
    };
  };
  return {
    env,
    overrides: {
      providers,
      knowledge_language: 'en',
      write_ids: false,
      create_reserved_paths: false,
      index: { facts: track === 'inference', summaries: false },
      folders: {
        '**': { role: 'knowledge', remember: 'integrate' },
        'copies/**': { role: 'source', remember: 'deny' },
        ...(['inference-authorized', 'inference-leaf-control'].includes(kind)
          ? { 'observations/**': { role: 'inference', remember: 'integrate' } }
          : {}),
      },
      models: {
        derive: role('derive'),
        answer: role('answer'),
        embedding: role('embedding'),
        expansion: { id: null, enabled: false },
        reranker: { id: null, enabled: false },
        vision: { id: null, enabled: false },
      },
      maintenance: {
        profile: 'autonomous',
        log_changes: false,
        notifications: 'off',
        policies: Object.fromEntries(
          MAINTENANCE_TRANSFORMS.map((transform) => [
            transform,
            arm === 'maintained' &&
            (track === 'inference'
              ? ['observe', 'reflect']
              : track === 'overview'
                ? ['synthesis']
                : []
            ).includes(transform)
              ? 'auto'
              : 'off',
          ]),
        ),
        limits: {
          max_items: 12,
          max_files_changed: 12,
          max_bytes_written: 65536,
          max_high_risk_items: kind === 'overview-authorized' ? 12 : 0,
        },
        observe: { enabled: true, max_subjects: 3, min_evidence: 2 },
        reflect: { enabled: true },
        curate: { max_pages: 3 },
        conflicts: { enabled: false },
      },
    },
  };
}

export function lifecycleInputReview(kind = 'lifecycle') {
  const { corpus, version } = experiment(kind);
  return {
    version,
    corpusFingerprint: lifecycleHash(corpus),
    reviewer: { id: 'Codex', sourceBased: true, independent: false, beforeOutputs: true },
    limitations: [
      'author_review_not_independent',
      'coupled_derive_role_substitution',
      'two_repeats_descriptive_only',
      'seeded_valid_L2_control_is_not_natural_generation',
      'unsupported_hypothesis_scenario_features_not_implemented',
    ],
    gates: LIFECYCLE_GATES,
  };
}

function experiment(kind) {
  if (kind === 'discourse')
    return {
      corpus: LIFECYCLE_CORPUS.filter((episode) => episode.track === 'discourse'),
      version: 'longitudinal-discourse-v1',
    };
  if (kind === 'inference-leaf-control')
    return {
      corpus: INFERENCE_CORPUS,
      version: 'longitudinal-inference-leaf-control-v1',
    };
  if (kind === 'overview-authorized')
    return {
      corpus: LIFECYCLE_CORPUS.filter((episode) => episode.track === 'overview'),
      version: 'longitudinal-overview-authorized-v1',
    };
  if (kind === 'inference-authorized')
    return {
      corpus: INFERENCE_CORPUS,
      version: 'longitudinal-inference-authorized-v1',
    };
  return {
    corpus: kind === 'lifecycle' ? LIFECYCLE_CORPUS : INFERENCE_CORPUS,
    version:
      kind === 'inference-control'
        ? 'longitudinal-inference-control-v1'
        : kind === 'inference'
          ? INFERENCE_CORPUS_VERSION
          : LIFECYCLE_CORPUS_VERSION,
  };
}

export async function runLifecycle(
  config,
  { split, runs = 2, deriveId = config.models.derive.id, corpus: kind = 'lifecycle', onProgress = () => {} },
) {
  if (active) throw new Error('One lifecycle run per process.');
  active = true;
  const restoreModels = observeModels();
  try {
    const { corpus, version } = experiment(kind);
    const checkpoints = [];
    for (const episode of corpus.filter((entry) => entry.split === split)) {
      for (let run = 1; run <= runs; run++)
        for (const arm of ['extract-only', 'maintained'])
          checkpoints.push(
            ...(await indexControl.run(
              kind === 'inference-leaf-control'
                ? { facts: episode.facts, leafOnly: true }
                : ['inference-control', 'inference-authorized'].includes(kind)
                  ? episode.facts
                  : null,
              () => runEpisode(config, episode, arm, run, deriveId, onProgress, kind),
            )),
          );
    }
    return {
      version,
      corpusFingerprint: lifecycleHash(corpus),
      inputReviewFingerprint: lifecycleHash(lifecycleInputReview(kind)),
      split,
      runs,
      contract: {
        runtime: 'built-core-socket-built-client',
        measurement: 'socket-scoped-drained-index-v2',
        modelSubstitution:
          'derive_only_couples_fact_extraction_retention_verification_observe_scope_reflect_curator',
        retrievalBudget: 6000,
        answerOutputTokens: 2400,
        cycles: 3,
        maxItems: 12,
        maxFiles: 12,
        maxBytes: 65536,
        maxHighRiskItems: kind === 'overview-authorized' ? 12 : 0,
        facts: 'inference_only',
        summaries: false,
        expansion: false,
        reranker: false,
        clock: 'fixture_process_Date_fixed_source_clock_explicit_when_available',
        seed: null,
        cost: null,
        indexMode:
          kind === 'inference-leaf-control'
            ? 'scripted_source_leaves'
            : ['inference-control', 'inference-authorized'].includes(kind)
              ? 'scripted_positive_control'
              : 'live',
        inferenceNamespace: ['inference-authorized', 'inference-leaf-control'].includes(kind)
          ? 'observations'
          : null,
        models: Object.fromEntries(
          ['derive', 'answer', 'embedding'].map((name) => {
            const model = config.models[name];
            return [
              name,
              {
                id: name === 'derive' ? deriveId : model.id,
                providerFingerprint: lifecycleHash({
                  api: model.provider?.api,
                  baseUrl: model.provider?.baseUrl,
                }),
                enabled: model.enabled,
                timeoutMs: model.timeoutMs,
                maxOutputTokens: model.maxOutputTokens ?? null,
                reasoningEffort: model.reasoningEffort ?? null,
                dimensions: model.dimensions ?? null,
                maxRetries: model.provider?.maxRetries ?? null,
              },
            ];
          }),
        ),
        artifacts: Object.fromEntries(
          [
            'core/dist/write/retain.js',
            'core/dist/maintenance/dream.js',
            'core/dist/maintenance/observe.js',
            'core/dist/maintenance/observation-scope.js',
            'core/dist/maintenance/curate.js',
            'core/dist/maintenance/overview.js',
            'core/dist/observations/projection.js',
            'core/dist/ops/answer.js',
            'core/dist/open.js',
            'cli/dist/serve/socket.js',
            'client/dist/index.js',
          ].map((file) => [
            file,
            lifecycleHash(fs.readFileSync(new URL(`../packages/${file}`, import.meta.url), 'utf8')),
          ]),
        ),
      },
      checkpoints,
    };
  } finally {
    restoreModels();
    active = false;
  }
}

async function runEpisode(config, episode, arm, run, deriveId, onProgress, kind) {
  const factsControl = indexControl.getStore();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-lifecycle-'));
  const brain = path.join(temp, 'brain'),
    state = path.join(temp, 'state');
  const socket = path.join('/tmp', `akno-life-${process.pid}.sock`);
  fs.mkdirSync(brain);
  const originals = new Map();
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(brain, rel)), { recursive: true });
    fs.writeFileSync(path.join(brain, rel), text);
    originals.set(rel, text);
  };
  for (const [rel, text] of Object.entries(episode.files)) write(rel, text);
  // This process owns only temporary fixtures. A fixed wall clock reaches real overview
  // selection, generation, verification and answers; durations still use performance.now.
  const RealDate = globalThis.Date;
  let clock = episode.clock;
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return RealDate.parse(clock);
    }
  };
  const options = {
    aknoPath: brain,
    stateDir: state,
    isolated: true,
    actor: 'user',
    ...fixtureConfiguration(config, arm, episode.track, deriveId, kind),
  };
  let memory,
    service,
    client,
    currentCalls,
    operations = [];
  const metrics = new Map(),
    sources = new Map(),
    results = [];
  const operation = async (stage, callback) => {
    const calls = [],
      started = performance.now();
    let failed = false;
    try {
      currentCalls = calls;
      return await accounting.run(calls, callback);
    } catch {
      failed = true;
      return null;
    } finally {
      const metric = { stage, latencyMs: performance.now() - started, failed };
      operations.push(metric);
      metrics.set(metric, { calls, finishedAt: performance.now() });
      currentCalls = null;
    }
  };
  async function start() {
    memory = await open(options);
    const observed = new Proxy(memory, {
      get(target, property) {
        const value = target[property];
        return ['call', 'index', 'dream'].includes(property)
          ? (...args) =>
              indexControl.run(factsControl, () =>
                accounting.run(currentCalls ?? [], () => value.apply(target, args)),
              )
          : value;
      },
    });
    service = await serveSocket(observed, socket);
    client = await connect({ socket, actor: 'user', timeoutMs: 1800000 });
  }
  async function stop() {
    await client?.close();
    client = null;
    await service?.close();
    service = null;
    await memory?.close();
    memory = null;
  }
  const dbRead = (callback) => {
    const db = new Database(path.join(state, 'akno.db'), { readonly: true });
    try {
      return callback(db);
    } finally {
      db.close();
    }
  };
  const stateSnapshot = () =>
    dbRead((db) => ({
      observations: db
        .prepare(
          'SELECT id, source_slug, payload, eligible, issue, proof_count FROM observation_entries ORDER BY id',
        )
        .all(),
      facts: db
        .prepare(
          'SELECT f.id, f.claim, p.slug, g.eligibility, g.traversable FROM facts f JOIN pages p ON p.id=f.page_id LEFT JOIN graph_fact_status g ON g.fact_id=f.id WHERE f.valid_to IS NULL ORDER BY f.id',
        )
        .all(),
      supports: db
        .prepare(
          'SELECT memory_id, proof_group, evidence_hash FROM retain_supports WHERE retracted_by IS NULL AND forgotten_by IS NULL ORDER BY memory_id, proof_group, evidence_hash',
        )
        .all(),
      sourceBytesUnchanged: [...originals].every(
        ([rel, text]) =>
          fs.existsSync(path.join(brain, rel)) && fs.readFileSync(path.join(brain, rel), 'utf8') === text,
      ),
    }));
  async function retain(id, revision = 'rev-1111', retracts) {
    const fixture = episode.sources.find((source) => source.id === id);
    const source = {
      source_id: `invented:${episode.id}:${id === 'decision' ? 'scope' : id === 'correction' ? 'booking' : id}`,
      source_group: `invented:${episode.id}:${fixture.group}`,
      revision,
      source_kind: 'conversation',
      ...(id === 'scope' || id === 'decision' ? {} : { mentioned_at: episode.clock, timezone: 'UTC' }),
      input: { items: fixture.items },
      retention: {
        mode: 'extract',
        mission:
          'Retain durable supported English knowledge, preserve document scope, unresolved actor and time, proposals and later deciding turns. Place specific journey instructions on the specifically identified journey page and equipment information on the existing equipment page. Never infer actual departure.',
      },
      ...(retracts ? { retracts } : {}),
    };
    sources.set(id, source);
    return await operation(`retain:${id}`, () => client.retain({ sources: [source] }));
  }
  const retainedCandidateIds = (receipt) =>
    receipt?.sources?.[0]?.candidates
      .filter((candidate) => ['written', 'support_added', 'duplicate'].includes(candidate.outcome))
      .map((candidate) => candidate.candidate_id) ?? [];
  let scopeReceipt, bookingReceipt;
  async function seedDependencies() {
    const controls = dbRead((db) => {
      const store = { db };
      return [1, 2, 3].map((group) => {
        const rows = db
          .prepare(
            `SELECT f.id, f.claim, f.source_line_hash, f.page_id, f.item_id, p.slug, g.subject_entity
          FROM facts f JOIN pages p ON p.id=f.page_id JOIN graph_fact_status g ON g.fact_id=f.id
          WHERE f.valid_to IS NULL AND g.eligibility='eligible' AND g.traversable=1 AND p.slug IN (?, ?) ORDER BY p.slug, f.id`,
          )
          .all(`records/preparation-${group}-1`, `records/preparation-${group}-2`);
        const chosen = [1, 2].map((occurrence) =>
          rows.find((row) => row.slug === `records/preparation-${group}-${occurrence}`),
        );
        if (chosen.some((row) => !row) || new Set(chosen.map((row) => row.subject_entity)).size !== 1)
          return null;
        return {
          group,
          subject: chosen[0].subject_entity,
          evidence: chosen.map((row) => ({
            factId: row.id,
            sourceLineHash: row.source_line_hash,
            proofGroups: [...proofGroupsForFact(store, row.id, row.page_id, row.item_id)].sort(),
          })),
          slugs: chosen.map((row) => row.slug),
        };
      });
    });
    if (controls.some((control) => !control)) return { status: 'not_admitted', seeded: 0 };
    for (const control of controls) {
      const rel = `topics/preparation-${control.group}.md`;
      const block = observationBlock(
        {
          id: `obs_seeded_${control.group}1111111`,
          subject: control.subject,
          disposition: 'active',
          evidence: control.evidence,
          proofCount: new Set(control.evidence.flatMap((row) => row.proofGroups)).size,
        },
        episode.facts.find((fact) => fact.slug === control.slugs[0]).pattern,
        control.slugs,
      );
      const content = insertObservationBlock(fs.readFileSync(path.join(brain, rel), 'utf8'), block);
      if (content === null) throw new Error('Seeded control target has ambiguous sections.');
      fs.writeFileSync(path.join(brain, rel), content);
    }
    return { status: 'seeded_valid_lineage', seeded: 3 };
  }
  try {
    await start();
    await operation('index-setup', () => client.command('index', {}));
    for (const step of episode.steps) {
      if (results.length) operations = [];
      const key = `${episode.id}/${arm}/${run}/${step.id}`;
      onProgress(key);
      const before = stateSnapshot(),
        receipts = [],
        maintenance = [];
      let control = null;
      if (episode.track === 'discourse') {
        if (step.id === 'scope-and-unresolved-reference') {
          scopeReceipt = await retain('scope');
          receipts.push(scopeReceipt);
        }
        if (step.id === 'later-deciding-turn') {
          const ids = retainedCandidateIds(scopeReceipt);
          receipts.push(
            await retain(
              'decision',
              'rev-2222',
              ids.length ? { target_revision: 'rev-1111', candidate_ids: ids } : undefined,
            ),
          );
        }
        if (step.id === 'correlated-confirmation') {
          bookingReceipt = await retain('booking');
          receipts.push(bookingReceipt, await retain('copy'));
        }
        if (step.id === 'unchanged-reordered')
          receipts.push(
            await operation('retain:replay', () =>
              client.retain({
                sources: [...sources.values()]
                  .filter((source) => source.revision === 'rev-2222' || !source.source_id.endsWith(':scope'))
                  .reverse(),
              }),
            ),
          );
        if (step.id === 'departure-correction') {
          const ids = retainedCandidateIds(bookingReceipt);
          receipts.push(
            await retain(
              'correction',
              'rev-2222',
              ids.length ? { target_revision: 'rev-1111', candidate_ids: ids } : undefined,
            ),
          );
        }
        if (step.id === 'retraction-restart')
          for (const id of ['booking', 'copy', 'correction']) {
            const source = sources.get(id);
            receipts.push(
              await operation(`retract:${id}`, () =>
                client.retain({
                  sources: [
                    {
                      source_id: source.source_id,
                      revision: `retract-${id}-3333`,
                      retention: {
                        mode: 'retract',
                        target_revision: source.revision,
                        reason: 'source_corrected',
                      },
                    },
                  ],
                }),
              ),
            );
          }
      }
      if (episode.track === 'inference') {
        if (step.id === 'seeded-valid-dependency-control') control = await seedDependencies();
        if (step.id === 'leaf-correction') {
          const fact = episode.facts[0];
          const rel = `${fact.slug}.md`;
          write(rel, originals.get(rel).replace(/before operation/g, 'after operation'));
        }
        if (step.id === 'last-leaves-retracted')
          for (const fact of episode.facts) {
            const rel = `${fact.slug}.md`;
            write(
              rel,
              originals
                .get(rel)
                .split('\n')
                .filter((line) => !line.includes(`${episode.clock.slice(0, 4)}-`))
                .join('\n'),
            );
          }
      }
      if (episode.track === 'overview') {
        if (step.id === 'new-unlinked-qualified-member') {
          const year = episode.clock.slice(0, 4);
          write(
            `journeys/${year}/silvermarsh.md`,
            `---\ntitle: Silvermarsh\ntype: trip\nakno:\n  temporal:\n    kind: event\n    start: '${year}-04-22'\n    until: '${year}-04-22'\n    timezone: UTC\n---\n\n# Silvermarsh\n\nDeparture scheduled for ${year}-04-22.\n\n## Optional\nAn extra excursion is only an unselected proposal; no excursion or departure is confirmed as completed.\n`,
          );
        }
        if (step.id === 'clock-crosses-departures') clock = episode.lateClock;
        if (step.id === 'restart-rebuild') clock = episode.lateClock;
      }
      await operation('index-inputs', () => client.command('index', {}));
      if (['restart-rebuild', 'retraction-restart'].includes(step.id)) {
        await operation('restart', async () => {
          await stop();
          await start();
        });
        await operation('rebuild', () => client.command('index', { rebuild: true }));
      }
      if (arm === 'maintained')
        for (let cycle = 1; cycle <= 3; cycle++) {
          const report = await operation(`dream:${cycle}`, () => client.command('dream', {}));
          if (report) maintenance.push(report);
        }
      await operation('drain-and-reopen', async () => {
        await stop();
        await start();
      });
      await operation('index-ready', () => client.command('index', {}));
      const pages = [];
      for (const rel of fs.readdirSync(brain, { recursive: true }).filter((entry) => entry.endsWith('.md'))) {
        const response = await operation('read', () => client.read({ slug: rel.slice(0, -3) }));
        if (response?.page) pages.push({ slug: rel.slice(0, -3), ...response.page });
      }
      const recall = await operation('recall', () =>
        client.recall({
          query: episode.query,
          memory_view: 'all',
          expand: false,
          rerank: false,
          graph: true,
          budget: 6000,
        }),
      );
      const context = await operation('context', () =>
        client.context({ profile: 'auto_recall', query: episode.query, memory_view: 'all', budget: 6000 }),
      );
      const answer = step.answer
        ? await operation('answer', () =>
            client.answer({
              question: episode.question,
              answer_language: 'en',
              memory_view: 'all',
              expand: false,
              graph: true,
              include_context: true,
              max_answer_tokens: 2400,
            }),
          )
        : null;
      const after = stateSnapshot();
      // Topic and overview pages are authorized maintenance targets; source leaves and
      // declared input changes are checked against their current exact expected bytes.
      after.sourceBytesUnchanged = [...originals]
        .filter(
          ([rel]) =>
            !rel.startsWith('topics/') && rel !== 'journeys/overview.md' && episode.track !== 'discourse',
        )
        .every(([rel, text]) => fs.readFileSync(path.join(brain, rel), 'utf8') === text);
      results.push({
        key,
        episode: episode.id,
        arm,
        run,
        step: step.id,
        clock,
        seeded: step.seeded,
        control,
        pages,
        recall,
        context,
        answer,
        receipts,
        maintenance,
        before,
        after,
        operations,
      });
    }
    await stop();
    for (const [metric, { calls: recorded, finishedAt }] of metrics) {
      const calls = recorded.filter((call) => !call.scripted);
      const sum = (key) =>
        !calls.length
          ? 0
          : calls.every((call) => call.usage?.[key] != null)
            ? calls.reduce((total, call) => total + call.usage[key], 0)
            : null;
      Object.assign(metric, {
        calls: calls.length,
        scriptedIndexCalls: recorded.filter((call) => call.scripted).length,
        failures: calls.filter((call) => !call.ok).length,
        callsWithoutUsage: calls.filter((call) => !call.usage).length,
        backgroundCalls: calls.filter((call) => call.completedAt > finishedAt).length,
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
        totalTokens: sum('totalTokens'),
        modelLatencyMs: calls.reduce((total, call) => total + (call.latencyMs ?? 0), 0),
        endpointRequests: calls.every((call) => call.endpointRequests !== null)
          ? calls.reduce((total, call) => total + call.endpointRequests, 0)
          : null,
      });
    }
    return results;
  } finally {
    try {
      await stop();
    } finally {
      globalThis.Date = RealDate;
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}
