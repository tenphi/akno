import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { open, MAINTENANCE_TRANSFORMS } from '../packages/core/dist/index.js';
import { serveSocket } from '../packages/cli/dist/serve/socket.js';
import { connect } from '../packages/client/dist/index.js';
import { ModelClient } from '../packages/core/dist/models/client.js';
import { RETAIN_PROMPT_VERSION, RETAIN_VERIFIER_VERSION } from '../packages/core/dist/write/retain.js';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../packages/core/dist/ops/answer.js';
import { LONGITUDINAL_CORPUS } from '../packages/core/src/bench/longitudinal-corpus.ts';
import {
  longitudinalFingerprint as fingerprint,
  longitudinalInputReview,
} from '../packages/core/src/bench/longitudinal-review.ts';
const Database = createRequire(new URL('../packages/core/package.json', import.meta.url))('better-sqlite3');
const accounting = new AsyncLocalStorage();
let activeRun = false;
const nesting = new AsyncLocalStorage();

/** Observe completed model calls without replacing requests, prompts or provider outcomes. */
function observeModels() {
  const originals = new Map();
  for (const method of ['chat', 'embed', 'rerank']) {
    const original = ModelClient.prototype[method];
    if (!original) continue;
    originals.set(method, original);
    ModelClient.prototype[method] = async function (...args) {
      const receipt = accounting.getStore();
      if (!receipt || nesting.getStore()) return original.apply(this, args);
      return nesting.run(true, async () => {
        const outcome = await original.apply(this, args);
        receipt.push({
          ok: outcome.ok,
          usage: outcome.usage ?? null,
          latencyMs: outcome.latencyMs,
          completedAt: performance.now(),
        });
        return outcome;
      });
    };
  }
  return () => {
    for (const [method, original] of originals) ModelClient.prototype[method] = original;
  };
}

function configuration(config, arm) {
  const env = {}; // Private host AKNO_* folder/model overrides must never leak into the fixture.
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([name, provider], index) => {
      const secret = `AKNO_LONGITUDINAL_${index}_KEY`;
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
    const model = config.models[name];
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
  return {
    env,
    overrides: {
      providers,
      knowledge_language: 'en',
      write_ids: false,
      create_reserved_paths: false,
      index: { summaries: false, facts: false },
      folders: {
        '**': { role: 'knowledge', remember: 'integrate' },
        'work/**': { role: 'source', remember: 'deny' },
        'memory/**': { role: 'knowledge', remember: 'integrate' },
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
            arm === 'maintained' && ['timeline_history', 'observe', 'reflect'].includes(transform)
              ? 'auto'
              : 'off',
          ]),
        ),
        limits: { max_items: 12, max_files_changed: 12, max_bytes_written: 65536, max_high_risk_items: 0 },
        curate: { max_pages: 3, max_timeline_events: 6 },
        observe: { enabled: true, max_subjects: 2 },
        reflect: { enabled: true },
        conflicts: { enabled: false },
      },
    },
  };
}

export async function runLongitudinal(config, { split, runs, onProgress = () => {} }) {
  if (activeRun) throw new Error('A longitudinal run is already active in this process.');
  activeRun = true;
  const restore = observeModels();
  try {
    const checkpoints = [];
    const contract = {
      runtime: 'built-core-socket-built-client',
      policies: 'timeline_history_observe_reflect_auto_other_off',
      indexFacts: false,
      indexSummaries: false,
      expansion: false,
      reranker: false,
      maintenanceCyclesPerCheckpoint: 3,
      maxSourcePagesPerCycle: 3,
      maxTimelineItemsPerCycle: 6,
      retrievalBudget: 6000,
      answerOutputTokens: 2400,
      sourceLanguage: 'en',
      knowledgeLanguage: 'en',
      measurement: 'socket-scoped-drained-index-v2',
      seeds: null,
      cost: null,
      modelSubstitution: null,
      sourceClock: 'explicit_mentioned_at',
      worldClock: 'timeline_as_of_only',
      prompts: {
        extraction: RETAIN_PROMPT_VERSION,
        verifier: RETAIN_VERIFIER_VERSION,
        answer: ANSWER_PROMPT_VERSION,
        answerVerifier: ANSWER_VERIFIER_PROMPT_VERSION,
      },
      models: Object.fromEntries(
        ['derive', 'answer', 'embedding'].map((name) => {
          const role = config.models[name];
          return [
            name,
            {
              id: role.id,
              providerFingerprint: fingerprint({ api: role.provider?.api, baseUrl: role.provider?.baseUrl }),
              enabled: role.enabled,
              timeoutMs: role.timeoutMs,
              maxOutputTokens: role.maxOutputTokens,
              reasoningEffort: role.reasoningEffort,
              dimensions: role.dimensions,
              maxRetries: role.provider?.maxRetries,
            },
          ];
        }),
      ),
      artifacts: Object.fromEntries(
        [
          'core/dist/write/retain.js',
          'core/dist/maintenance/timeline-sources.js',
          'core/dist/maintenance/timeline-assertions.js',
          'core/dist/open.js',
          'cli/dist/serve/socket.js',
          'client/dist/index.js',
        ].map((file) => [
          file,
          fingerprint(fs.readFileSync(new URL(`../packages/${file}`, import.meta.url), 'utf8')),
        ]),
      ),
    };
    for (const episode of LONGITUDINAL_CORPUS.filter((entry) => entry.split === split)) {
      for (let run = 1; run <= runs; run++) {
        for (const arm of ['extract-only', 'maintained']) {
          onProgress(`${episode.id}/${arm}/${run}: starting`);
          checkpoints.push(...(await runEpisode(config, episode, arm, run, onProgress)));
        }
      }
    }
    return {
      version: 'longitudinal-packet-v2',
      corpusFingerprint: fingerprint(LONGITUDINAL_CORPUS),
      inputReviewFingerprint: fingerprint(longitudinalInputReview()),
      split,
      runs,
      contract,
      checkpoints,
    };
  } finally {
    restore();
    activeRun = false;
  }
}

async function runEpisode(config, episode, arm, run, onProgress) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-longitudinal-'));
  const brain = path.join(temp, 'brain'),
    state = path.join(temp, 'state');
  const socket = path.join('/tmp', `akno-long-${process.pid}.sock`);
  fs.mkdirSync(path.join(brain, 'work'), { recursive: true });
  fs.mkdirSync(path.join(brain, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(brain, 'timeline.md'), '');
  fs.writeFileSync(path.join(brain, 'work/timeline.md'), '');
  fs.writeFileSync(path.join(brain, 'memory/timeline.md'), '');
  fs.writeFileSync(path.join(brain, 'memory/equipment.md'), '# Zephyr QX-100\n');
  const options = {
    aknoPath: brain,
    stateDir: state,
    isolated: true,
    actor: 'user',
    ...configuration(config, arm),
  };
  let memory, service, client;
  const originals = new Map(),
    inputs = new Map(),
    receipts = new Map();
  const result = [];
  const observations = new Map();
  let currentCalls;
  let operations;
  const operation = async (stage, callback) => {
    const calls = [];
    const started = performance.now();
    let failed = false;
    try {
      currentCalls = calls;
      return await accounting.run(calls, callback);
    } catch {
      failed = true;
      return null;
    } finally {
      const metric = { stage, latencyMs: performance.now() - started, failed };
      observations.set(metric, { calls, finishedAt: performance.now() });
      operations.push(metric);
      currentCalls = null;
    }
  };
  async function start() {
    memory = await open(options);
    // Socket callbacks have their own async context. Enter accounting at the server
    // boundary, preserving every original operation, argument and authority check.
    const observed = new Proxy(memory, {
      get(target, property) {
        const value = target[property];
        if (!['call', 'index', 'dream'].includes(property)) return value;
        return (...args) => accounting.run(currentCalls ?? [], () => value.apply(target, args));
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
  const sourceId = (name) => `invented:${episode.id}:${name}`;
  async function retain(
    name,
    text,
    { revision = 'rev-1111', group = name, role = 'external', retracts } = {},
  ) {
    const source = {
      source_id: sourceId(name),
      source_group: sourceId(group),
      revision,
      source_kind: 'note',
      mentioned_at: episode.sourceClock,
      timezone: 'UTC',
      input: { items: [{ item_id: `${name}-${revision}`, role, text }] },
      retention: {
        mode: 'extract',
        mission:
          'Retain durable knowledge about Zephyr QX-100 in the existing memory folder. Preserve attribution, uncertainty and temporal qualification; do not infer completion.',
      },
      ...(retracts ? { retracts } : {}),
    };
    inputs.set(name, source);
    const response = await operation(`retain:${name}`, () => client.retain({ sources: [source] }));
    receipts.set(name, response?.sources?.[0]);
  }
  async function retract(name) {
    const source = inputs.get(name);
    if (!source) return;
    await operation(`retract:${name}`, () =>
      client.retain({
        sources: [
          {
            source_id: source.source_id,
            revision: 'retract-2222',
            retention: { mode: 'retract', target_revision: source.revision, reason: 'source_corrected' },
          },
        ],
      }),
    );
  }
  const file = (name, text) => {
    const rel = `work/${name}.md`,
      bytes = `# Notice\n\n${text}\n`;
    fs.writeFileSync(path.join(brain, rel), bytes);
    originals.set(rel, bytes);
  };
  async function folderInput(name, text) {
    file(name, text);
    await operation('index-source', () => client.command('index', { structuralOnly: true }));
    if (arm === 'extract-only') await retain(name, text);
  }
  const inventory = () => {
    const db = new Database(path.join(state, 'akno.db'), { readonly: true });
    try {
      const supports = db
        .prepare(
          'SELECT memory_id, proof_group, evidence, evidence_hash FROM retain_supports WHERE retracted_by IS NULL AND forgotten_by IS NULL ORDER BY receipt_fingerprint, candidate_id',
        )
        .all();
      return {
        memories: new Set(supports.map((row) => row.memory_id)).size,
        activeSupports: supports.length,
        proofGroups: new Set(supports.map((row) => row.proof_group)).size,
        observations: 0,
        validSupportHashes: supports.every((row) => fingerprintRaw(row.evidence) === row.evidence_hash),
        sourceBytesUnchanged: [...originals].every(
          ([rel, bytes]) =>
            fs.existsSync(path.join(brain, rel)) && fs.readFileSync(path.join(brain, rel), 'utf8') === bytes,
        ),
        supportFingerprint: fingerprint(supports),
      };
    } finally {
      db.close();
    }
  };
  try {
    operations = [];
    await start();
    await operation('index-setup', () => client.command('index', { structuralOnly: true }));
    for (const step of episode.steps) {
      if (result.length) operations = [];
      const key = `${episode.id}/${arm}/${run}/${step.id}`;
      onProgress(key);
      const before = inventory();
      if (episode.track === 'folder') {
        if (step.action === 'initial') await folderInput('notice', episode.sources.initial);
        if (step.action === 'copies') {
          await folderInput('copy', episode.sources.copy);
          await folderInput('alternative', episode.sources.conflict);
          await folderInput('distinct', episode.sources.distinct);
        }
        if (step.action === 'folder-update') await folderInput('update', episode.sources.correct);
      } else {
        if (step.action === 'initial') {
          await retain('notice', episode.sources.initial);
          await retain('speculation', episode.sources.speculation, { role: 'assistant' });
        }
        if (step.action === 'copies') {
          await retain('copy', episode.sources.copy, { group: 'notice' });
          await retain('assistant-summary', episode.sources.speculation, {
            group: 'speculation',
            role: 'assistant',
          });
        }
        if (step.action === 'conflict') await retain('alternative', episode.sources.conflict);
        if (step.action === 'correct') {
          const candidates =
            receipts
              .get('notice')
              ?.candidates.filter((candidate) =>
                ['written', 'duplicate', 'support_added'].includes(candidate.outcome),
              )
              .map((candidate) => candidate.candidate_id) ?? [];
          await retain('notice', episode.sources.correct, {
            revision: 'rev-2222',
            retracts: candidates.length
              ? { target_revision: 'rev-1111', candidate_ids: candidates }
              : undefined,
          });
        }
        if (step.action === 'retract') {
          await retract('alternative');
          await retract('copy');
          await retract('assistant-summary');
        }
        if (step.action === 'seed') {
          const source = {
            source_id: sourceId('seed'),
            revision: 'rev-1111',
            source_kind: 'note',
            mentioned_at: episode.sourceClock,
            input: { text: episode.sources.seed },
            retention: {
              mode: 'provided',
              placement: 'exact',
              knowledge_language: 'en',
              candidates: [
                {
                  candidate_id: 'seed-1111',
                  kind: 'claim',
                  text: 'The Zephyr QX-100 warranty lasts five years.',
                  subject: 'Zephyr QX-100',
                  attribution: { source_role: 'external', source_speaker: 'Ada Marlow' },
                  discourse: { commitment: 'asserted', disposition: 'active' },
                  epistemic: { basis: 'source_report' },
                  polarity: 'affirmed',
                  support: [{ quote: episode.sources.seed }],
                  discourse_frame: [{ quote: episode.sources.seed }],
                  destination: { slug: 'memory/equipment' },
                },
              ],
            },
          };
          inputs.set('seed', source);
          const response = await operation('provided-seeded-contamination', () =>
            client.retain({ sources: [source] }),
          );
          receipts.set('seed', response?.sources?.[0]);
        }
        if (step.action === 'recover') {
          await retract('seed');
          await retain('seed', episode.sources.recover, { revision: 'rev-2222' });
        }
      }
      if (step.action === 'replay' && episode.track === 'retention') {
        await operation('replay-reordered', () => client.retain({ sources: [...inputs.values()].reverse() }));
      }
      if (step.action === 'restart' || step.action === 'recover') {
        await operation('restart', async () => {
          await stop();
          await start();
        });
        await operation('rebuild', () => client.command('index', { rebuild: true }));
      }
      const maintenance = [];
      if (arm === 'maintained') {
        for (let cycle = 0; cycle < 3; cycle++) {
          const report = await operation(`dream:${cycle + 1}`, () => client.command('dream', {}));
          if (report)
            maintenance.push({
              phases: report.phases.map((phase) => ({ phase: phase.phase, ran: phase.ran })),
              observations: report.observations.length,
              curated: report.curated.length,
              applied: report.maintenancePlans
                .flatMap((plan) => plan.items)
                .filter((item) => item.status === 'applied').length,
              held: report.maintenancePlans
                .flatMap((plan) => plan.items)
                .filter((item) => item.status === 'held').length,
              rejected: report.rejected.length,
              durationMs: report.durationMs,
            });
        }
      }
      await operation('drain-and-reopen', async () => {
        await stop();
        await start();
      });
      await operation('index-ready', () => client.command('index', {}));
      const canonical = [];
      for (const rel of fs
        .readdirSync(brain, { recursive: true })
        .filter((name) => name.endsWith('.md') && !originals.has(name))) {
        const response = await operation('read', () => client.read({ slug: rel.slice(0, -3) }));
        canonical.push(
          ...(response?.page?.lines ?? [])
            .filter((line) => line.memory || line.observation)
            .map((line) => ({
              text: line.text,
              ...(line.memory ? { memory: line.memory } : {}),
              ...(line.observation ? { observation: line.observation } : {}),
            })),
        );
      }
      const timeline = await operation('timeline', () =>
        client.timeline({ timeline: '*', source: 'all', as_of: step.asOf, timezone: 'UTC', limit: 200 }),
      );
      const recall = await operation('recall', () =>
        client.recall({
          query: 'Zephyr QX-100',
          memory_view: 'all',
          filter: { folder: episode.track === 'folder' && arm === 'maintained' ? 'work' : 'memory' },
          expand: false,
          rerank: false,
          graph: false,
          budget: 6000,
        }),
      );
      const context = await operation('context', () =>
        client.context({
          profile: 'auto_recall',
          query: 'Zephyr QX-100',
          memory_view: 'all',
          filter: { folder: episode.track === 'folder' && arm === 'maintained' ? 'work' : 'memory' },
          budget: 6000,
        }),
      );
      const answer = step.answer
        ? await operation('answer', () =>
            client.answer({
              question: episode.question,
              answer_language: 'en',
              memory_view: 'all',
              filter: { folder: episode.track === 'folder' && arm === 'maintained' ? 'work' : 'memory' },
              expand: false,
              graph: false,
              include_context: true,
              max_answer_tokens: 2400,
            }),
          )
        : null;
      const after = inventory();
      const cached = ['replay', 'restart'].includes(step.action);
      const replayStable = cached
        ? before.supportFingerprint === after.supportFingerprint && before.memories === after.memories
        : null;
      result.push({
        key,
        episode: episode.id,
        arm,
        run,
        step: step.id,
        memory: canonical,
        timeline: timeline ?? { results: [], status: 'unavailable' },
        recall: recall ?? { results: [], status: 'unavailable' },
        context: context ?? { results: [], pinned: [], timeline: [], status: 'unavailable' },
        answer: step.answer
          ? (answer ?? { answer: null, outcome: 'not_answered', status: 'unavailable' })
          : null,
        inventory: {
          memories: after.memories,
          activeSupports: after.activeSupports,
          proofGroups: after.proofGroups,
          observations: canonical.filter((line) => line.observation?.status === 'eligible').length,
          validSupportHashes: after.validSupportHashes,
          sourceBytesUnchanged: after.sourceBytesUnchanged,
          replayStable,
          cachedMaintenanceCalls: cached ? 0 : null,
        },
        operations,
        maintenance,
      });
    }
    await stop();
    for (const [metric, { calls, finishedAt }] of observations) {
      const sum = (key) =>
        calls.length
          ? calls.every((call) => call.usage?.[key] != null)
            ? calls.reduce((total, call) => total + call.usage[key], 0)
            : null
          : 0;
      Object.assign(metric, {
        calls: calls.length,
        failures: calls.filter((call) => !call.ok).length,
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
        totalTokens: sum('totalTokens'),
        callsWithoutUsage: calls.filter((call) => !call.usage).length,
        backgroundCalls: calls.filter((call) => call.completedAt > finishedAt).length,
        modelLatencyMs: calls.reduce((total, call) => total + (call.latencyMs ?? 0), 0),
      });
    }
    for (const checkpoint of result)
      if (checkpoint.inventory.cachedMaintenanceCalls !== null)
        checkpoint.inventory.cachedMaintenanceCalls = checkpoint.operations
          .filter((metric) => metric.stage.startsWith('dream:'))
          .reduce((total, metric) => total + metric.calls, 0);
    if (
      config.models.derive.enabled &&
      config.models.derive.id &&
      !result.some((checkpoint) => checkpoint.operations.some((metric) => metric.calls > 0))
    )
      throw new Error('Model accounting failed: configured extraction recorded no calls.');
    return result;
  } finally {
    await stop();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function fingerprintRaw(value) {
  // Evidence hashes use source bytes; the report fingerprint uses JSON serialization.
  return createRequire(import.meta.url)('node:crypto')
    .createHash('sha256')
    .update(value)
    .digest('hex');
}
