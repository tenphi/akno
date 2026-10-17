import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../packages/core/src/config/load.ts';
import { ModelClient } from '../packages/core/src/models/client.ts';
import { runRetain } from '../packages/core/src/write/retain.ts';
import { LANGUAGE_CORPUS_V23 } from '../packages/core/src/bench/language-corpus-v23.ts';
import { LONGITUDINAL_CORPUS } from '../packages/core/src/bench/longitudinal-corpus.ts';
import { LIFECYCLE_CORPUS } from '../packages/core/src/bench/longitudinal-lifecycle-corpus.ts';
import { GOLD as BENCH_GOLD } from './retain-variants-gold.mjs';
import { DENSE } from './retain-variants-dense.mjs';

// zod is a dependency of core, not of the workspace root; load core's own ESM instance.
const { z } = await import(new URL('../packages/core/node_modules/zod/index.js', import.meta.url).href);

/**
 * Retention-only comparison of automatic-retention variants over the invented sources of the
 * language, longitudinal and lifecycle benchmarks. It calls runRetain directly, so placement,
 * routing and apply are outside its scope. Each arm runs its revision pass after first-pass
 * verification, so one run yields both the variant without revision and the variant with it,
 * paired on identical extractions.
 */
const GOLD = {
  ...BENCH_GOLD,
  ...Object.fromEntries(DENSE.map(({ id, units, traps }) => [`dense:${id}`, { units, traps }])),
};

const ARMS = {
  single: { extractionMode: 'single' },
  recall: { extractionMode: 'recall_first' },
};

const folder = (pathName, options = {}) => ({
  path: pathName,
  role: 'knowledge',
  remember: 'integrate',
  creatable: true,
  admittedPages: [],
  eligible: true,
  ...options,
});

function sources() {
  const out = [];
  const memory = [
    folder('memory', { admittedPages: ['memory/equipment'], description: 'Zephyr QX-100 equipment memory' }),
  ];
  for (const entry of LANGUAGE_CORPUS_V23)
    out.push({
      id: `language:${entry.id}`,
      bench: 'language',
      split: entry.split,
      items: entry.items,
      options: {
        mission:
          'Retain durable knowledge about Zephyr QX-100 in the existing memory folder, preserving all original qualifications.',
        folders:
          entry.admission === 'read-only'
            ? [folder('memory', { remember: 'deny', creatable: false, eligible: false })]
            : memory,
        sourceId: `invented:${entry.id}`,
        revision: 'rev-1111',
      },
    });
  const longitudinalMission =
    'Retain durable knowledge about Zephyr QX-100 in the existing memory folder. Preserve attribution, uncertainty and temporal qualification; do not infer completion.';
  for (const episode of LONGITUDINAL_CORPUS) {
    const names =
      episode.track === 'retention'
        ? [
            ['notice', episode.sources.initial, 'rev-1111', 'external'],
            ['speculation', episode.sources.speculation, 'rev-1111', 'assistant'],
            ['copy', episode.sources.copy, 'rev-1111', 'external'],
            ['alternative', episode.sources.conflict, 'rev-1111', 'external'],
            ['correction', episode.sources.correct, 'rev-2222', 'external'],
            ['recover', episode.sources.recover, 'rev-2222', 'external'],
          ]
        : [['distinct', episode.sources.distinct, 'rev-1111', 'external']];
    for (const [name, text, revision, role] of names)
      out.push({
        id: `longitudinal:${episode.split}:${name}`,
        bench: 'longitudinal',
        split: episode.split,
        items: [{ item_id: `${name}-${revision}`, role, text }],
        options: {
          mission: longitudinalMission,
          mentionedAt: episode.sourceClock,
          timezone: 'UTC',
          folders: memory,
          sourceId: `invented:${episode.id}:${name}`,
          revision,
        },
      });
  }
  for (const episode of LIFECYCLE_CORPUS.filter((entry) => entry.track === 'discourse')) {
    const year = episode.split === 'held-out' ? 2037 : 2035;
    const trip = episode.split === 'held-out' ? 'jrn-3333' : 'jrn-1111';
    for (const source of episode.sources)
      out.push({
        id: `lifecycle:${episode.split}:${source.id}`,
        bench: 'lifecycle',
        split: episode.split,
        items: source.items,
        options: {
          mission:
            'Retain durable supported English knowledge, preserve document scope, unresolved actor and time, proposals and later deciding turns. Place specific journey instructions on the specifically identified journey page and equipment information on the existing equipment page. Never infer actual departure.',
          ...(['scope', 'decision'].includes(source.id)
            ? {}
            : { mentionedAt: episode.clock, timezone: 'UTC' }),
          folders: [
            ...memory,
            folder(`journeys/${year}`, {
              admittedPages: [`journeys/${year}/overview`, `journeys/${year}/${trip}`],
              description: `Journeys in ${year}`,
            }),
          ],
          sourceId: `invented:${episode.id}:${source.id}`,
          revision: source.id === 'decision' || source.id === 'correction' ? 'rev-2222' : 'rev-1111',
        },
      });
  }
  const personal = ['people', 'insurance', 'travel', 'health'].map((name) => folder(name));
  for (const entry of DENSE)
    out.push({
      id: `dense:${entry.id}`,
      bench: 'dense',
      split: 'supplementary',
      ...(entry.items ? { items: entry.items } : { text: entry.text }),
      options: {
        mission: null,
        mentionedAt: entry.clock,
        timezone: 'UTC',
        folders: [...memory, ...personal],
        sourceId: `invented:dense:${entry.id}`,
        revision: 'rev-1111',
      },
    });
  for (const source of out) if (!GOLD[source.id]) throw new Error(`missing gold notes for ${source.id}`);
  return out;
}

/** Mirrors ops/retain.ts retentionModel: the maintenance role when configured, else derive.
 * Knowledge language is English, as in the language benchmark, so generated prose is checked. */
function retentionClient(config) {
  const role = { ...(config.maintenance.model ?? config.models.derive), knowledgeLanguage: 'en' };
  const timeoutMs = config.maintenance.retain.modelTimeoutMs;
  return { role, client: new ModelClient(timeoutMs ? { ...role, timeoutMs } : role) };
}

function callKind(system) {
  if (system.startsWith('You enumerate the propositions')) return 'inventory';
  if (system.includes('Revision task. An independent verifier held')) return 'revision';
  if (system.includes('You independently verify proposed retained memories')) return 'verification';
  if (system.includes('repair_targets')) return 'repair';
  if (system.startsWith('You are an independent reviewer auditing')) return 'judge';
  return 'extraction';
}

/** Records every request payload and response so held drafts and revisions can be audited. */
function recording(client) {
  const calls = [];
  const proxy = new Proxy(client, {
    get(target, property) {
      if (property === 'chat')
        return async (messages, options) => {
          const system = messages
            .filter((m) => m.role === 'system')
            .map((m) => m.content)
            .join('\n');
          const user = messages.at(-1).content;
          const outcome = await target.chat(messages, options);
          let request = null,
            response = null;
          try {
            request = JSON.parse(user);
          } catch {
            request = user;
          }
          try {
            response = outcome.value ? JSON.parse(outcome.value) : null;
          } catch {
            response = outcome.value;
          }
          calls.push({
            kind: callKind(system),
            ok: outcome.ok,
            reason: outcome.reason ?? null,
            latencyMs: Math.round(outcome.latencyMs),
            usage: outcome.usage ?? null,
            request,
            response,
          });
          return outcome;
        };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { proxy, calls };
}

async function pool(items, width, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

async function runArms(values) {
  const config = loadConfig();
  const { role, client } = retentionClient(config);
  if (role.id !== 'gpt-6-luna')
    throw new Error(`retention role is ${role.id}; live verification requires gpt-6-luna`);
  const retain = config.maintenance.retain;
  const arms = values.arms.split(',');
  const selected = sources()
    .filter((source) => values.split === 'all' || source.split === values.split)
    .filter((source) => !values.source?.length || values.source.includes(source.id))
    .filter((source) => !values.bench || values.bench.split(',').includes(source.bench));
  const work = [];
  for (let run = 1; run <= Number(values.runs); run++)
    for (const arm of arms) for (const source of selected) work.push({ run, arm, source });
  const started = new Date().toISOString();
  const results = await pool(work, Number(values.concurrency), async ({ run, arm, source }, index) => {
    const { proxy, calls } = recording(client);
    const t0 = performance.now();
    const { mission, ...sourceOptions } = source.options;
    const result = await runRetain(source.text ?? source.items.map((item) => item.text).join('\n'), proxy, {
      ...sourceOptions,
      ...(mission ? { mission } : {}),
      ...(source.items ? { sourceItems: source.items } : {}),
      ...(retain.generationMaxOutputTokens
        ? { generationMaxOutputTokens: retain.generationMaxOutputTokens }
        : {}),
      ...(retain.verificationConcurrency ? { verificationConcurrency: retain.verificationConcurrency } : {}),
      verificationFailureScope: retain.verificationFailureScope ?? 'source',
      verificationRetry: true,
      verificationRevision: true,
      ...ARMS[arm],
    });
    const wallMs = Math.round(performance.now() - t0);
    if (values.output)
      fs.appendFileSync(
        `${values.output}.jsonl`,
        JSON.stringify({
          run,
          arm,
          source: source.id,
          bench: source.bench,
          split: source.split,
          wallMs,
          result,
          calls,
        }) + '\n',
      );
    console.error(
      `${index + 1}/${work.length} run${run} ${arm} ${source.id}: ${result.candidates.length} written, ${result.held.length} held, ${(wallMs / 1000).toFixed(0)}s${result.error ? ` error=${result.error}` : ''}`,
    );
    return { run, arm, source: source.id, bench: source.bench, split: source.split, wallMs, result, calls };
  });
  return {
    kind: 'retain-variants-packet',
    createdAt: started,
    completedAt: new Date().toISOString(),
    model: role.id,
    settings: {
      timeoutMs: retain.modelTimeoutMs ?? role.timeoutMs,
      generationMaxOutputTokens: retain.generationMaxOutputTokens ?? null,
      verificationConcurrency: retain.verificationConcurrency ?? 1,
      verificationFailureScope: retain.verificationFailureScope ?? 'source',
      knowledgeLanguage: 'en',
      concurrency: Number(values.concurrency),
    },
    results,
  };
}

/** Every draft the verifier saw, keyed by candidate id, from the recorded first-pass payloads. */
function verifiedDrafts(calls) {
  const drafts = new Map();
  for (const call of calls)
    if (call.kind === 'verification' && call.request?.candidates)
      for (const candidate of call.request.candidates)
        if (!drafts.has(candidate.candidate_id)) drafts.set(candidate.candidate_id, candidate);
  return drafts;
}

const labelsOf = (candidate) => ({
  kind: candidate.kind,
  commitment: candidate.discourse?.commitment,
  disposition: candidate.discourse?.disposition,
  polarity: candidate.polarity,
  basis: candidate.epistemic?.basis,
  source_role: candidate.attribution?.source_role,
  source_speaker: candidate.attribution?.source_speaker ?? null,
  time: candidate.time ?? null,
});

/** Written records for each paired variant of one arm run: none of the later passes, the
 * invalid-verdict retry (R), the feedback revision (A), or both. A revision of a retry-rejected
 * candidate exists only when the retry ran, so it belongs to the combined variant alone. */
export function variantRecords(entry) {
  const retried = new Set(
    (entry.result.retry?.candidates ?? []).filter((c) => c.outcome === 'accepted').map((c) => c.candidate_id),
  );
  const retryTargets = new Set((entry.result.retry?.candidates ?? []).map((c) => c.candidate_id));
  const revised = new Set(
    ((entry.result.feedbackRevision ?? entry.result.revision)?.candidates ?? [])
      .filter((c) => c.outcome === 'accepted')
      .map((c) => c.candidate_id),
  );
  const drafts = verifiedDrafts(entry.calls);
  const all = entry.result.candidates.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    text: candidate.text,
    labels: labelsOf(candidate),
    via: retried.has(candidate.candidate_id)
      ? 'retry'
      : revised.has(candidate.candidate_id)
        ? retryTargets.has(candidate.candidate_id)
          ? 'retry+revision'
          : 'revision'
        : 'first_pass',
    original_text: revised.has(candidate.candidate_id) ? drafts.get(candidate.candidate_id)?.text : undefined,
  }));
  return {
    base: all.filter((record) => record.via === 'first_pass'),
    retry: all.filter((record) => ['first_pass', 'retry'].includes(record.via)),
    revision: all.filter((record) => ['first_pass', 'revision'].includes(record.via)),
    both: all,
  };
}

/** Packets are complete JSON files, or the per-source JSONL a run appends while in progress. */
function readEntries(files) {
  return files.flatMap((file) =>
    file.endsWith('.jsonl')
      ? fs
          .readFileSync(file, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : JSON.parse(fs.readFileSync(file, 'utf8')).results,
  );
}

const JUDGE_SYSTEM = `You are an independent reviewer auditing records that an automatic memory system
retained from one invented source. You receive the complete source, a reviewer's gold notes (units the
source supports and traps that make a record wrong), and retained records with typed labels. Judge each
record against the source itself; the gold notes guide coverage and name known traps but never replace
reading the source. Judge every record independently of the others.

For each record decide:
- supported: every proposition in the text follows from the source with the same actors, objects,
  quantities, polarity and time. Nothing is invented, strengthened, generalized or resolved that the
  source leaves open (for example an unknown actor or date, or an unconfirmed completion).
- qualified: every material qualification that governs the record's proposition in the source is in the
  text: speaker and reporter layers, hypothetical, fictional or counterfactual status, proposal, rejection
  or acceptance status, explicit verification limits attached to that proposition, corrective contrasts,
  conditions, and unknown or source-relative time. Omitting a separate neighboring fact is fine.
- labels_ok: the typed labels fit the record's proposition under these conventions. kind is claim,
  decision, preference, plan, event or question. A question has commitment none. An explicit proposal or
  offer is kind plan, commitment asserted and disposition proposed, even when its timing is unknown or it
  is unaccepted; an actor's undertaking is accepted; a rejected or declined offer keeps kind plan,
  disposition rejected and polarity affirmed. Competing unconfirmed hypotheses and an assistant's guess are
  tentative. A fictional or assumed scenario is hypothetical; a consequence of an antecedent the source says
  is false is counterfactual. Polarity is negated only for a directly denied property or action, including
  an exclusion; otherwise affirmed. basis is self_attested for the speaker's own assertion (including a
  denial) and source_report for relayed, assistant or external claims. A time object must not invent a
  date, a resolved reference date, or completion. A supplied reference_clock is source context: its
  mentioned_at and timezone may appear in time labels.
- durable: the record is knowledge worth keeping beyond this one exchange. Discussed hypotheses, fictional
  examples, open questions, unaccepted or rejected proposals and qualified reports about the subject are
  worth keeping. A one-task command, pleasantry, transient live reading or interaction management is not.
- covers: ids of gold units whose meaning this record fully states with their governing qualifications.
  Partial statement does not count. A record may cover several units.
- trap: the gold trap the record falls into, quoted, or null.
- note: a short rationale naming any defect.
Reply with JSON only.`;

const JUDGE_SCHEMA = z.object({
  records: z.array(
    z.object({
      record_id: z.string(),
      supported: z.boolean(),
      qualified: z.boolean(),
      labels_ok: z.boolean(),
      durable: z.boolean(),
      covers: z.array(z.string()),
      trap: z.string().nullable(),
      note: z.string(),
    }),
  ),
});

const recordKey = (sourceId, record) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify([sourceId, record.text, record.labels]))
    .digest('hex')
    .slice(0, 16);

async function judge(values) {
  const config = loadConfig();
  const role = config.models.derive;
  if (role.id !== 'gpt-6-luna')
    throw new Error(`judge role is ${role.id}; live verification requires gpt-6-luna`);
  const client = new ModelClient({ ...role, timeoutMs: 600_000 });
  const entries = readEntries(values.input);
  const existing =
    values.output && fs.existsSync(values.output)
      ? JSON.parse(fs.readFileSync(values.output, 'utf8'))
      : { judgments: {} };
  const bySource = new Map();
  const items = new Map(
    sources().map((source) => [source.id, source.items ? { items: source.items } : { text: source.text }]),
  );
  const clocks = new Map(
    sources().map((source) => [
      source.id,
      source.options.mentionedAt
        ? { mentioned_at: source.options.mentionedAt, timezone: source.options.timezone ?? null }
        : null,
    ]),
  );
  for (const entry of entries)
    for (const record of variantRecords(entry).both) {
      const key = recordKey(entry.source, record);
      if (existing.judgments[key]) continue;
      const list = bySource.get(entry.source) ?? new Map();
      list.set(key, record);
      bySource.set(entry.source, list);
    }
  const tasks = [];
  for (const [sourceId, records] of bySource) {
    const list = [...records.entries()];
    for (let start = 0; start < list.length; start += 8)
      tasks.push({ sourceId, records: list.slice(start, start + 8) });
  }
  console.error(
    `judging ${tasks.reduce((sum, task) => sum + task.records.length, 0)} records in ${tasks.length} calls`,
  );
  const { proxy, calls } = recording(client);
  await pool(tasks, Number(values.concurrency), async ({ sourceId, records }) => {
    const gold = GOLD[sourceId];
    const outcome = await proxy.chat(
      [
        { role: 'system', content: JUDGE_SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            source: items.get(sourceId),
            reference_clock: clocks.get(sourceId),
            gold_units: gold.units.map(({ id, meaning }) => ({ id, meaning })),
            gold_traps: gold.traps,
            records: records.map(([key, record]) => ({
              record_id: key,
              text: record.text,
              labels: record.labels,
            })),
          }),
        },
      ],
      { schema: JUDGE_SCHEMA, maxTokens: 16_384 },
    );
    const parsed = outcome.ok && outcome.value ? JUDGE_SCHEMA.safeParse(JSON.parse(outcome.value)) : null;
    if (!parsed?.success) {
      console.error(`judge failed for ${sourceId}: ${outcome.error ?? 'invalid response'}`);
      return;
    }
    const valid = new Set(gold.units.map((u) => u.id));
    for (const verdict of parsed.data.records) {
      const record = records.find(([key]) => key === verdict.record_id);
      if (!record) continue;
      existing.judgments[verdict.record_id] = {
        source: sourceId,
        text: record[1].text,
        ...verdict,
        covers: verdict.covers.filter((id) => valid.has(id)),
      };
    }
    console.error(`judged ${sourceId}: ${records.length}`);
  });
  existing.judgeUsage = [
    ...(existing.judgeUsage ?? []),
    ...calls.map(({ latencyMs, usage, ok }) => ({ latencyMs, usage, ok })),
  ];
  return existing;
}

const VARIANT_NAMES = {
  'single:base': 'baseline',
  'single:retry': 'R (retry invalid verdict)',
  'single:revision': 'A (feedback revision)',
  'single:both': 'R+A',
  'recall:base': 'B (recall-first)',
  'recall:retry': 'B+R',
  'recall:revision': 'B+A',
  'recall:both': 'B+R+A',
};

const sumUsage = (receipts, key) => receipts.reduce((total, receipt) => total + (receipt?.[key] ?? 0), 0);

/** Calls each variant would have made: later passes are excluded when the variant lacks them. */
function variantReceipts(entry, variant) {
  const usage = entry.result.modelUsage;
  const receipts = [usage.inventory, usage.extraction, usage.repair, usage.verification];
  if (variant === 'retry' || variant === 'both') receipts.push(usage.retry);
  if (variant === 'revision' || variant === 'both') receipts.push(usage.revision, usage.reverification);
  return receipts.filter(Boolean);
}

function report(values) {
  const entries = readEntries(values.input);
  const judgments = JSON.parse(fs.readFileSync(values.judgments, 'utf8')).judgments;
  const rows = {};
  const missing = new Set();
  for (const entry of entries) {
    const gold = GOLD[entry.source];
    const required = gold.units.filter((u) => u.required).map((u) => u.id);
    const optional = gold.units.filter((u) => !u.required).map((u) => u.id);
    const records = variantRecords(entry);
    const extraction = entry.calls.find((call) => call.kind === 'extraction');
    const extracted = Array.isArray(extraction?.response?.candidates)
      ? extraction.response.candidates.length
      : 0;
    for (const variant of ['base', 'retry', 'revision', 'both']) {
      const key = `${entry.arm}:${variant}`;
      const row = (rows[key] ??= {
        variant: VARIANT_NAMES[key],
        sourceRuns: 0,
        extracted: 0,
        written: 0,
        judged: 0,
        faithful: 0,
        unsupported: 0,
        unqualified: 0,
        labelErrors: 0,
        nondurable: 0,
        trapHits: 0,
        required: 0,
        requiredCovered: 0,
        optionalCovered: 0,
        heldValidation: 0,
        heldVerificationRejected: 0,
        heldVerificationFailed: 0,
        heldOther: 0,
        errors: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        modelLatencyMs: 0,
        byBench: {},
        unfaithfulRecords: [],
      });
      const bench = (row.byBench[entry.bench] ??= {
        sourceRuns: 0,
        written: 0,
        faithful: 0,
        required: 0,
        requiredCovered: 0,
      });
      row.sourceRuns += 1;
      bench.sourceRuns += 1;
      row.extracted += extracted;
      if (entry.result.error) row.errors += 1;
      const written = records[variant];
      row.written += written.length;
      bench.written += written.length;
      // Rescued records are held in a variant that lacks the pass that rescued them.
      // Without the retry pass, every retry target keeps its first, failed verification.
      const retryTargets = new Set((entry.result.retry?.candidates ?? []).map((c) => c.candidate_id));
      const withoutRetry = variant === 'base' || variant === 'revision';
      for (const held of entry.result.held) {
        if (held.hold_stage === 'validation') row.heldValidation += 1;
        else if (held.verification?.outcome === 'failed' || (withoutRetry && retryTargets.has(held.candidate_id)))
          row.heldVerificationFailed += 1;
        else if (held.hold_stage === 'verification') row.heldVerificationRejected += 1;
        else row.heldOther += 1;
      }
      for (const record of records.both.filter((r) => !written.includes(r))) {
        if (record.via === 'retry' || (withoutRetry && retryTargets.has(record.candidate_id)))
          row.heldVerificationFailed += 1;
        else row.heldVerificationRejected += 1;
      }
      const covered = new Set();
      for (const record of written) {
        const verdict = judgments[recordKey(entry.source, record)];
        if (!verdict) {
          missing.add(recordKey(entry.source, record));
          continue;
        }
        row.judged += 1;
        const faithful = verdict.supported && verdict.qualified && verdict.labels_ok;
        if (faithful) {
          row.faithful += 1;
          bench.faithful += 1;
          for (const id of verdict.covers) covered.add(id);
        } else
          row.unfaithfulRecords.push({
            source: entry.source,
            run: entry.run,
            via: record.via,
            text: record.text,
            note: verdict.note,
          });
        if (!verdict.supported) row.unsupported += 1;
        if (!verdict.qualified) row.unqualified += 1;
        if (!verdict.labels_ok) row.labelErrors += 1;
        if (!verdict.durable) row.nondurable += 1;
        if (verdict.trap) row.trapHits += 1;
      }
      row.required += required.length;
      bench.required += required.length;
      const hits = required.filter((id) => covered.has(id)).length;
      row.requiredCovered += hits;
      bench.requiredCovered += hits;
      row.optionalCovered += optional.filter((id) => covered.has(id)).length;
      const receipts = variantReceipts(entry, variant);
      row.calls += receipts.length;
      row.inputTokens += sumUsage(receipts, 'input_tokens');
      row.outputTokens += sumUsage(receipts, 'output_tokens');
      row.reasoningTokens += sumUsage(receipts, 'reasoning_output_tokens');
      row.modelLatencyMs += sumUsage(receipts, 'latency_ms');
    }
  }
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const summary = Object.values(rows).map((row) => ({
    variant: row.variant,
    sourceRuns: row.sourceRuns,
    extracted: row.extracted,
    written: row.written,
    writtenPerSource: Math.round((100 * row.written) / row.sourceRuns) / 100,
    heldValidation: row.heldValidation,
    heldVerificationRejected: row.heldVerificationRejected,
    heldVerificationFailed: row.heldVerificationFailed,
    heldOther: row.heldOther,
    faithfulPrecisionPct: pct(row.faithful, row.judged),
    unfaithful: row.judged - row.faithful,
    unsupported: row.unsupported,
    unqualified: row.unqualified,
    labelErrors: row.labelErrors,
    nondurableAdmitted: row.nondurable,
    requiredRecallPct: pct(row.requiredCovered, row.required),
    requiredCovered: `${row.requiredCovered}/${row.required}`,
    optionalCovered: row.optionalCovered,
    perSource: {
      tokens: Math.round((row.inputTokens + row.outputTokens) / row.sourceRuns),
      inputTokens: Math.round(row.inputTokens / row.sourceRuns),
      outputTokens: Math.round(row.outputTokens / row.sourceRuns),
      reasoningTokens: Math.round(row.reasoningTokens / row.sourceRuns),
      calls: Math.round((100 * row.calls) / row.sourceRuns) / 100,
      modelSeconds: Math.round(row.modelLatencyMs / row.sourceRuns / 100) / 10,
    },
    byBench: Object.fromEntries(
      Object.entries(row.byBench).map(([name, bench]) => [
        name,
        {
          written: bench.written,
          faithfulPct: pct(bench.faithful, bench.written),
          recallPct: pct(bench.requiredCovered, bench.required),
        },
      ]),
    ),
    errors: row.errors,
    unfaithfulRecords: row.unfaithfulRecords,
  }));
  return { missingJudgments: missing.size, summary };
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    arms: { type: 'string', default: 'single,recall' },
    runs: { type: 'string', default: '1' },
    split: { type: 'string', default: 'all' },
    source: { type: 'string', multiple: true },
    bench: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    input: { type: 'string', multiple: true },
    output: { type: 'string' },
    judgments: { type: 'string' },
  },
});
const command = positionals[0];
if (command === 'sources')
  console.log(
    JSON.stringify(
      sources().map(({ id, split }) => ({ id, split })),
      null,
      1,
    ),
  );
else if (command === 'run') {
  const packet = await runArms(values);
  write(values.output ?? `bench-results/retain-variants/packet-${Date.now()}.json`, packet);
} else if (command === 'report') {
  const result = report(values);
  if (values.output) write(values.output, result);
  console.log(
    JSON.stringify(
      result.summary.map(({ unfaithfulRecords, ...row }) => row),
      null,
      1,
    ),
  );
  if (result.missingJudgments) console.error(`${result.missingJudgments} records lack judgments`);
} else if (command === 'judge') {
  write(values.output ?? 'bench-results/retain-variants/judgments.json', await judge(values));
} else {
  console.error(
    'Usage: node scripts/bench-retain-variants.mjs sources | run [--arms single,recall] [--runs N] [--split all|development|held-out] [--source ID] [--concurrency 4] [--output FILE] | judge --input PACKET... [--output FILE]',
  );
  process.exitCode = 2;
}
