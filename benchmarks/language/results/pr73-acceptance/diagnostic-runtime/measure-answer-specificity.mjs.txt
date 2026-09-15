#!/usr/bin/env node
/** Compare verifier revisions on identical frozen public drafts; this is not an end-to-end gate. */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../packages/core/dist/index.js';
import { ModelClient } from '../packages/core/dist/models/client.js';

const { values } = parseArgs({
  options: {
    live: { type: 'boolean' },
    config: { type: 'string' },
    output: { type: 'string' },
    variant: { type: 'string', multiple: true },
  },
});
assert(values.live && values.config && values.output, 'Use --live --config FILE --output NEW_DIRECTORY.');
const repo = fileURLToPath(new URL('..', import.meta.url));
const base = path.join(repo, 'benchmarks/language/results/pr73-acceptance');
const output = path.resolve(values.output);
assert(!fs.existsSync(output), 'Existing evidence must not be overwritten.');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const write = (name, value) =>
  fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const packet = JSON.parse(fs.readFileSync(path.join(base, 'diagnostic-public-first.json')));
const review = JSON.parse(fs.readFileSync(path.join(base, 'diagnostic-review-first.json')));
assert.equal(packet.packetFingerprint, review.packetFingerprint);
const rows = packet.cases.flatMap((entry) =>
  entry.answers.map((answer) => {
    assert(
      answer.answer !== null && entry.sourceArchive.supports.length === 1,
      'This comparison requires one stored frame and a published draft.',
    );
    const page = answer.contextEvidence.find(
      (result) => result.type === 'page' && result.lines.some((line) => line.memory?.status === 'qualified'),
    );
    assert(page, 'Missing original evidence.');
    const judgment = review.cases
      .find((item) => item.id === entry.id && item.run === entry.run)
      .answers.find(
        (item) =>
          item.queryLanguage === answer.queryLanguage &&
          item.answerLanguage === answer.answerLanguage &&
          item.explicitView === answer.explicitView,
      );
    return {
      id: `${entry.id}/${answer.queryLanguage}/${answer.answerLanguage}/${answer.explicitView}`,
      question: entry.source.queries[answer.queryLanguage],
      memoryView: entry.source.view,
      // Rendering appends citation links after verification; reproduce the draft before that suffix.
      draft: answer.answer.replace(/\s*\[memory\/equipment:\d+(?:-\d+)?\]/gu, ''),
      evidence: [{ ...page, evidence_id: 'E1' }],
      sourceFrame: entry.sourceArchive.supports[0].evidence,
      expectedSupported: judgment.sourceEntailed,
    };
  }),
);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-specificity-profile-'));
const config = loadConfig({
  isolated: true,
  aknoPath: temporary,
  stateDir: path.join(temporary, 'state'),
  overrides: JSON.parse(fs.readFileSync(values.config, 'utf8')),
});
fs.rmSync(temporary, { recursive: true, force: true });
assert(config.models.answer.id && config.models.answer.provider, 'Missing answer provider.');
const originalRoot = path.join(repo, 'packages/core/dist/ops');
const moduleText = (file) => fs.readFileSync(file, 'utf8');
const availableVariants = {
  before: {
    answer: moduleText(path.join(base, 'diagnostic-runtime/ops-answer.js.txt')),
    audit: moduleText(path.join(base, 'diagnostic-runtime/ops-answer-source-audit.js.txt')),
  },
  candidate: {
    answer: moduleText(path.join(originalRoot, 'answer.js')),
    audit: moduleText(path.join(originalRoot, 'answer-source-audit.js')),
  },
};
assert(
  !values.variant || values.variant.every((name) => ['before', 'candidate'].includes(name)),
  'Unknown verifier variant.',
);
const variants = Object.fromEntries(
  Object.entries(availableVariants).filter(([name]) => !values.variant || values.variant.includes(name)),
);
// Expose the private verifier only in temporary benchmark modules. Production exports stay intact.
const resolveImports = (text) =>
  text.replace(
    /from (['"])(\.[^'"]+)\1/gu,
    (_match, quote, specifier) =>
      'from ' + quote + pathToFileURL(path.resolve(originalRoot, specifier)).href + quote,
  );
const verifiers = {};
const temporaryModules = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-specificity-modules-'));
try {
  fs.symlinkSync(
    path.join(repo, 'packages/core/node_modules'),
    path.join(temporaryModules, 'node_modules'),
    'dir',
  );
  for (const [name, sources] of Object.entries(variants)) {
    const auditPath = path.join(temporaryModules, name + '-audit.mjs');
    fs.writeFileSync(auditPath, resolveImports(sources.audit));
    const answer = resolveImports(
      sources.answer.replace(
        /from (['"])\.\/answer-source-audit\.js\1/u,
        () => `from '${pathToFileURL(auditPath).href}'`,
      ),
    );
    const answerPath = path.join(temporaryModules, name + '-answer.mjs');
    fs.writeFileSync(answerPath, answer + '\nexport { verifyDraftSupport };\n');
    verifiers[name] = (await import(pathToFileURL(answerPath).href)).verifyDraftSupport;
  }
} finally {
  fs.rmSync(temporaryModules, { recursive: true, force: true });
}
fs.mkdirSync(output, { recursive: true });
write('inputs.json', rows);
const role = config.models.answer;
write('manifest.json', {
  kind: 'frozen-draft-verifier-comparison',
  createdAt: new Date().toISOString(),
  packetFingerprint: packet.packetFingerprint,
  reviewerFingerprint: sha(JSON.stringify(review)),
  runnerSha256: sha(moduleText(fileURLToPath(import.meta.url))),
  modules: Object.fromEntries(
    Object.entries(variants).map(([name, source]) => [
      name,
      { answer: sha(source.answer), audit: sha(source.audit) },
    ]),
  ),
  model: {
    id: role.id,
    api: role.provider.api,
    reasoningEffort: role.reasoningEffort,
    maxOutputTokens: role.maxOutputTokens,
    timeoutMs: role.timeoutMs,
    providerRetries: role.provider.maxRetries,
  },
  cases: rows.length,
  variants: Object.keys(variants),
  concurrency: 4,
  limitations: [
    'Exposed fixed drafts; no new generation or retention is measured.',
    'Reference labels come from independent review; runtime judgments remain fallible.',
    'Each draft is submitted once to each verifier; failed coordinates are not selectively retried.',
  ],
});
for (const [name, source] of Object.entries(variants))
  for (const [part, text] of Object.entries(source))
    fs.writeFileSync(path.join(output, `${name}-${part}.js.txt`), text, { flag: 'wx' });
const storage = new AsyncLocalStorage();
const realFetch = globalThis.fetch;
let sequence = 0;
globalThis.fetch = async (url, options) => {
  const receipt = { sequence: ++sequence, ...storage.getStore() };
  const started = Date.now();
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
    const text =
      body?.output
        ?.filter((item) => item.type === 'message')
        .flatMap((item) =>
          item.content.filter((part) => part.type === 'output_text').map((part) => part.text),
        ) ?? [];
    if (text.length)
      fs.appendFileSync(
        path.join(output, 'provider-message-text.jsonl'),
        JSON.stringify({ sequence: receipt.sequence, ...storage.getStore(), text }) + '\n',
      );
    return response;
  } catch (error) {
    Object.assign(receipt, { status: null, latencyMs: Date.now() - started, failure: error.name });
    throw error;
  } finally {
    fs.appendFileSync(path.join(output, 'network-receipts.jsonl'), JSON.stringify(receipt) + '\n');
  }
};
const jobs = rows.flatMap((row) => Object.keys(variants).map((variant) => ({ row, variant })));
const results = [];
let next = 0;
try {
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      const model = new ModelClient(role);
      while (next < jobs.length) {
        const index = next++;
        const { row, variant } = jobs[index];
        const result = await storage.run({ id: row.id, variant }, () =>
          verifiers[variant](
            model,
            [{ text: row.draft, evidence_ids: ['E1'] }],
            row.evidence,
            row.question,
            row.memoryView,
            new Map([['E1', row.sourceFrame]]),
            true,
          ),
        );
        const observation = {
          index,
          id: row.id,
          variant,
          expectedSupported: row.expectedSupported,
          available: result.ok,
          accepted: result.ok && result.blocks.length > 0,
          outcome: {
            ok: result.outcome.ok,
            reason: result.outcome.reason ?? null,
            latencyMs: result.outcome.latencyMs,
            usage: result.outcome.usage ?? null,
          },
        };
        write(`result-${String(index + 1).padStart(2, '0')}.json`, observation);
        results.push(observation);
        console.log(
          JSON.stringify({
            done: results.length,
            total: jobs.length,
            id: row.id,
            variant,
            accepted: observation.accepted,
            available: observation.available,
          }),
        );
      }
    }),
  );
  write('summary.json', {
    results: results.sort((a, b) => a.index - b.index),
    groups: Object.fromEntries(
      Object.keys(variants).map((variant) => {
        const group = results.filter((result) => result.variant === variant);
        return [
          variant,
          {
            total: group.length,
            expectedSupported: group.filter((r) => r.expectedSupported).length,
            correctAccepted: group.filter((r) => r.expectedSupported && r.accepted).length,
            wrongAccepted: group.filter((r) => !r.expectedSupported && r.accepted).length,
            falseHolds: group.filter((r) => r.expectedSupported && r.available && !r.accepted).length,
            unavailable: group.filter((r) => !r.available).length,
          },
        ];
      }),
    ),
  });
} finally {
  globalThis.fetch = realFetch;
}
