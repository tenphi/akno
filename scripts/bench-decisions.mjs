// Invented development corpus only. No knowledge-base reads or writes; historical held-out cases stay frozen.
import { writeFileSync } from 'node:fs';
import { loadConfig } from '../packages/core/dist/config/load.js';
import { ModelClient } from '../packages/core/dist/models/client.js';
import { allocateLlmRerankIds, rerankWithLlm } from '../packages/core/dist/recall/llm-rerank.js';
import {
  DECISIONS_RERANK_PROMPT_VERSION,
  rerankWithDecisions,
} from '../packages/core/dist/recall/decisions-rerank.js';
import { RANKING_CORPUS, rankingCorpusCases } from '../packages/core/dist/bench/ranking-corpus.js';
import { rankingCorpusFingerprint } from '../packages/core/dist/bench/ranking-review.js';
import { qualityFor, qualificationFor } from '../packages/core/dist/bench/ranking.js';
const config = loadConfig();
const provider = config.providers.openai;
if (!provider?.apiKey) throw new Error('Configure the openai provider before running this benchmark');
const base = {
  ...config.models.reranker,
  provider,
  id: 'gpt-6-luna',
  enabled: true,
  requested: true,
  timeoutMs: 4000,
  reasoningEffort: 'none',
  maxOutputTokens: 500,
  unavailableReason: null,
};
const clients = {
  decisions: new ModelClient({ ...base, rerankerMode: 'decisions' }),
  llm: new ModelClient({ ...base, rerankerMode: 'llm', timeoutMs: 10000 }),
};
const candidateCount = process.env.AKNO_DECISIONS_CANDIDATES === '40' ? 40 : 10;
const reference = process.env.AKNO_DECISIONS_REFERENCE === 'native' ? 'native' : 'llm';
clients.native = new ModelClient(config.models.reranker);
const receipts = [];
const cases = rankingCorpusCases('development');
for (let round = 0; round < 3; round++) {
  for (const [caseIndex, check] of cases.entries()) {
    const pool = check.pool.slice(0, candidateCount);
    const ids = allocateLlmRerankIds(check.query, pool);
    const candidates = pool.map((id, index) => ({
      id: ids[index],
      text: RANKING_CORPUS.candidates[id].text.slice(0, 800),
      sourceKind: RANKING_CORPUS.candidates[id].sourceKind,
      matchedBy: ['lexical'],
    }));
    const systems =
      round > 0 ? ['decisions'] : caseIndex % 2 ? [reference, 'decisions'] : ['decisions', reference];
    for (const system of systems) {
      const result =
        system === 'native'
          ? await clients.native.rerank(
              check.query,
              candidates.map((c) => c.text),
              candidates.length,
            )
          : await (system === 'decisions' ? rerankWithDecisions : rerankWithLlm)(
              clients[system],
              check.query,
              candidates,
            );
      if (system === 'native') result.value?.sort((a, b) => b.score - a.score);
      const grades = pool.map((id) => check.judgments[id]);
      const order = result.value?.map((entry) => entry.index) ?? pool.map((_, i) => i);
      const judgments = pool.map((id, index) => ({
        grade: grades[index],
        instructionBearing: RANKING_CORPUS.candidates[id].instructionBearing,
        rejected:
          result.value?.some(
            (entry) =>
              entry.index === index &&
              (system === 'decisions' ? entry.irrelevantProbability >= 0.8 : entry.relevance === 0),
          ) ?? false,
      }));
      receipts.push({
        caseId: check.id,
        category: check.category,
        system,
        round,
        ok: result.ok,
        failure: result.reason ?? null,
        latencyMs: Math.round(result.latencyMs),
        endpointRequests: result.endpointRequests,
        usage: result.usage,
        order: order.map((i) => pool[i]),
        quality: qualityFor({ grades }, order),
        judgments,
      });
    }
  }
  console.log(`Round ${round + 1}/3 completed (${receipts.length} requests)`);
}
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
const reports = Object.fromEntries(
  ['decisions', reference].map((system) => {
    const rows = receipts.filter((r) => r.system === system);
    return [
      system,
      {
        requests: rows.length,
        valid: rows.filter((r) => r.ok).length,
        p50Ms: quantile(
          rows.map((r) => r.latencyMs),
          0.5,
        ),
        p95Ms: quantile(
          rows.map((r) => r.latencyMs),
          0.95,
        ),
        ndcgAt10: rows.reduce((s, r) => s + r.quality.ndcgAt10, 0) / rows.length,
        successAt1: rows.reduce((s, r) => s + r.quality.successAt1, 0) / rows.length,
        successAt3: rows.reduce((s, r) => s + r.quality.successAt3, 0) / rows.length,
        qualification: system === 'native' ? null : qualificationFor(rows.flatMap((r) => r.judgments)),
      },
    ];
  }),
);
const report = {
  kind: 'decisions-development-comparison',
  promptVersion: DECISIONS_RERANK_PROMPT_VERSION,
  date: new Date().toISOString(),
  model: 'gpt-6-luna',
  corpusFingerprint: rankingCorpusFingerprint(),
  candidateCount,
  excerptChars: 800,
  repetitions: { decisions: 3, [reference]: 1 },
  concurrency: 1,
  reports,
  receipts,
};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
if (
  reports.decisions.valid !== reports.decisions.requests ||
  reports.decisions.qualification.answerRetention !== 1 ||
  reports.decisions.qualification.instructionNegativeRejection !== 1 ||
  reports.decisions.successAt3 !== 1
)
  process.exitCode = 1;
