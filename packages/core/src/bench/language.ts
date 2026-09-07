import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Line, MemoryQualification, MemoryView } from '@tenphi/akno-protocol';
import type { AknoConfig, ConfigDoc } from '../config/schema.ts';
import { RETAIN_PROMPT_VERSION, RETAIN_VERIFIER_VERSION } from '../write/retain.ts';
import { open, type Akno } from '../open.ts';
import { sha256 } from '../store/ids.ts';
import { PROSE_PROJECTION_VERSION } from '../kb/prose.ts';
import { ANSWER_PROMPT_VERSION, ANSWER_VERIFIER_PROMPT_VERSION } from '../ops/answer.ts';
import { LANGUAGE_CORPUS, LANGUAGE_CORPUS_VERSION, type LanguageCase } from './language-corpus.ts';

export interface LanguageBenchOptions {
  split: LanguageCase['split'];
  onProgress?: (id: string, done: number, total: number) => void;
}

/** Runs only invented inputs. Provider permissions/settings come from the caller's configured roles. */
export async function runLanguageBench(config: AknoConfig, options: LanguageBenchOptions) {
  const cases = LANGUAGE_CORPUS.filter((entry) => entry.split === options.split);
  const results: Awaited<ReturnType<typeof runCase>>[] = [];
  for (const entry of cases) {
    results.push(await runCase(config, entry));
    options.onProgress?.(entry.id, results.length, cases.length);
  }
  const available = results.filter((result) => !result.retentionAvailabilityFailure);
  const useful = available.filter((result) => !result.expectedHold);
  const written = useful.filter((result) => result.retainedItems > 0);
  const rate = (numerator: number, denominator: number) => ({
    numerator,
    denominator,
    rate: denominator ? numerator / denominator : null,
  });
  return {
    schemaVersion: 'language-benchmark-v1',
    createdAt: new Date().toISOString(),
    corpusVersion: LANGUAGE_CORPUS_VERSION,
    corpusFingerprint: sha256(JSON.stringify(LANGUAGE_CORPUS)),
    split: options.split,
    knowledgeLanguage: 'en',
    proseProjectionVersion: PROSE_PROJECTION_VERSION,
    answerPromptVersion: ANSWER_PROMPT_VERSION,
    answerVerifierVersion: ANSWER_VERIFIER_PROMPT_VERSION,
    retentionPromptVersion: RETAIN_PROMPT_VERSION,
    retentionVerifierVersion: RETAIN_VERIFIER_VERSION,
    models: {
      retention: config.models.derive.id,
      answer: config.models.answer.id,
      embedding: config.models.embedding.id,
      expansion: config.models.expansion.id,
    },
    indexModelDerivation: false,
    independentlyReviewed: false,
    releaseEligible: false,
    adjudication:
      'pending: inspect review material; verifier agreement and typed expectations are not independent truth labels',
    thresholds: {
      unsafeFactualPromotion: 0,
      acceptedLanguageViolations: 0,
      sourceByteChanges: 0,
      usefulRetentionCoverage: 0.8,
      qualifiedRetrievalCoverage: 0.8,
      availabilityFailureRate: 0.05,
    },
    metrics: {
      availabilityFailures: rate(
        results.filter((result) => result.availabilityFailure).length,
        results.length,
      ),
      answerOperationFailures: rate(
        results
          .flatMap((result) => result.queries)
          .filter((query) => query.answerDegraded.includes('answer_failed')).length,
        results.flatMap((result) => result.queries).length,
      ),
      producedAnswers: rate(
        results.flatMap((result) => result.queries).filter((query) => query.reviewAnswer !== null).length,
        results.flatMap((result) => result.queries).length,
      ),
      languagePolicyRejections: rate(
        results.filter((result) => result.languageRejected).length,
        results.length,
      ),
      acceptedLanguageViolations: { numerator: null, denominator: 0, rate: null },
      translationQualificationErrors: { numerator: null, denominator: 0, rate: null },
      unsafeFactualPromotion: { numerator: null, denominator: 0, rate: null },
      noncanonicalEligibilityFlags: rate(
        available.filter((result) => result.noncanonicalEligibilityFlag).length,
        available.filter((result) => result.nonfactualExpected).length,
      ),
      usefulRetentionCoverage: rate(written.length, useful.length),
      falseHolds: rate(useful.filter((result) => result.retainedItems === 0).length, useful.length),
      expectedSafeHolds: rate(
        available.filter((result) => result.expectedHold && result.retainedItems === 0).length,
        available.filter((result) => result.expectedHold).length,
      ),
      typedSemanticsMatch: rate(written.filter((result) => result.semanticsMatch).length, written.length),
      qualifiedRetrievalCoverage: rate(
        written.filter((result) => result.queries.some((query) => query.retainedEvidence > 0)).length,
        written.length,
      ),
      ordinaryProseQualification: rate(
        results.filter((result) => result.ordinaryCorrect).length,
        results.length,
      ),
      sourceByteChanges: rate(results.filter((result) => !result.bytesStable).length, results.length),
    },
    byLanguage: Object.fromEntries(
      ['en', 'ru', 'mixed'].map((language) => [
        language,
        results.filter((result) => result.language === language).length,
      ]),
    ),
    byScenario: Object.fromEntries(results.map((result) => [result.scenario, 1])),
    cases: results,
  };
}

async function runCase(config: AknoConfig, entry: LanguageCase) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-eval-kb-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-eval-state-'));
  let memory: Akno | null = null;
  const ordinary = `# Zephyr QX-100\n\n${entry.ordinary}\n`;
  fs.mkdirSync(path.join(root, 'memory'));
  fs.mkdirSync(path.join(root, 'authored'));
  fs.writeFileSync(path.join(root, 'memory/equipment.md'), '# Zephyr QX-100\n');
  fs.writeFileSync(path.join(root, 'authored/passage.md'), ordinary);
  const nonfactualExpected = entry.view !== 'factual';
  const base = {
    id: entry.id,
    language: entry.language,
    scenario: entry.scenario,
    expectedHold: entry.hold ?? false,
    nonfactualExpected,
  };
  try {
    const { env, overrides } = benchConfig(config);
    memory = await open({ aknoPath: root, stateDir: state, isolated: true, actor: 'user', env, overrides });
    await memory.index({});
    const input = {
      sources: [
        {
          source_id: `invented:${entry.id}`,
          revision: 'rev-1111',
          input: { items: entry.items },
          retention: {
            mode: 'extract' as const,
            mission:
              'Retain durable knowledge about Zephyr QX-100 in the existing memory folder, preserving all original qualifications.',
          },
        },
      ],
    };
    const retained = await memory.retain(input);
    const slugs = [
      ...new Set(
        retained.sources.flatMap((source) =>
          source.candidates.flatMap((candidate) => (candidate.slug ? [candidate.slug] : [])),
        ),
      ),
    ];
    const beforeRebuild = snapshot(root);
    await memory.close();
    memory = await open({ aknoPath: root, stateDir: state, isolated: true, actor: 'user', env, overrides });
    await memory.index({ rebuild: true });
    const replay = await memory.retain(input);
    const lines: Line[] = [];
    for (const slug of slugs) lines.push(...((await memory.read({ slug })).page?.lines ?? []));
    const memories = lines.flatMap((line) =>
      line.memory?.status === 'qualified' ? [{ text: line.text, qualification: line.memory }] : [],
    );
    const queries = [];
    for (const queryLanguage of ['en', 'ru'] as const) {
      const query = queryFor(entry.view, queryLanguage);
      for (const explicit of [false, true]) {
        const view = explicit ? { memory_view: entry.view } : {};
        const recalled = await memory.recall({
          query,
          filter: { folder: 'memory' },
          expand: true,
          rerank: false,
          graph: false,
          ...view,
        });
        const context = await memory.context({
          profile: 'auto_recall',
          query,
          filter: { folder: 'memory' },
          ...view,
        });
        const answer = await memory.answer({
          question: query,
          answer_language: explicit ? 'ru' : 'en',
          filter: { folder: 'memory' },
          expand: true,
          graph: false,
          include_context: true,
          ...view,
        });
        queries.push({
          queryLanguage,
          explicitView: explicit,
          requestedAnswerLanguage: explicit ? 'ru' : 'en',
          inferredView: recalled.memory_view,
          recallStatus: recalled.status,
          recallDegraded: recalled.degraded ?? [],
          retainedEvidence: recalled.results.flatMap((result) =>
            result.type === 'page' ? result.lines.filter((line) => line.memory?.status === 'qualified') : [],
          ).length,
          contextStatus: context.status,
          contextDegraded: context.degraded ?? [],
          contextActivated: context.activation?.activated ?? false,
          answerOutcome: answer.outcome,
          answerDegraded: answer.degraded ?? [],
          answerModelUsage: answer.model_usage,
          reviewAnswer: answer.answer,
        });
      }
    }
    const ordinaryRead = await memory.read({ slug: 'authored/passage' });
    const q = (ordinaryRead.page?.lines ?? []).flatMap((line) =>
      line.prose &&
      !['heading', 'comment'].includes(line.prose.reason) &&
      !/^\s*(?:`{3,}|~{3,})/.test(line.text)
        ? [line.prose]
        : [],
    );
    const ordinaryInspection = await memory.recall({
      query: 'Zephyr QX-100',
      filter: { folder: 'authored' },
      memory_view: 'all',
      expand: false,
      rerank: false,
      graph: false,
    });
    const source = retained.sources[0];
    const reasons = [
      ...(retained.degraded ?? []),
      ...queries.flatMap((query) => [
        ...query.recallDegraded,
        ...query.contextDegraded,
        ...query.answerDegraded,
      ]),
    ];
    return {
      ...base,
      retentionAvailabilityFailure:
        retained.status === 'unavailable' ||
        (retained.degraded ?? []).some((reason) =>
          [
            'no_derive_model',
            'derive_failed',
            'retain_verification_failed',
            'language_check_failed',
          ].includes(reason),
        ),
      availabilityFailure:
        retained.status === 'unavailable' ||
        reasons.some((reason) =>
          [
            'no_derive_model',
            'derive_failed',
            'retain_verification_failed',
            'language_check_failed',
            'no_answer_model',
            'answer_verification_failed',
            'expansion_failed',
            'embedding_failed',
            'no_embedding_model',
          ].includes(reason),
        ),
      languageRejected: reasons.includes('language_mismatch'),
      retention: {
        status: retained.status,
        outcome: source?.outcome,
        reason: source?.reason_code ?? null,
        candidates: source?.candidates.map((candidate) => ({
          outcome: candidate.outcome,
          reason: candidate.reason_code ?? null,
        })),
        usage: source?.model_usage ?? null,
        degraded: retained.degraded ?? [],
      },
      retainedItems: memories.length,
      noncanonicalEligibilityFlag:
        nonfactualExpected && memories.some((item) => item.qualification.answer_eligible),
      semanticsMatch:
        memories.length > 0 && memories.some((item) => matchesExpectation(item.qualification, entry)),
      ordinaryCorrect:
        q.length > 0 && q.every((qualification) => qualification.answer_eligible === entry.ordinaryFactual),
      ordinaryInspection: { status: ordinaryInspection.status, results: ordinaryInspection.results.length },
      bytesStable:
        beforeRebuild === snapshot(root) &&
        fs.readFileSync(path.join(root, 'authored/passage.md'), 'utf8') === ordinary,
      replayOutcome: replay.sources[0]?.outcome,
      queries,
      reviewKnowledge: memories,
      error: null,
    };
  } catch {
    return {
      ...base,
      retentionAvailabilityFailure: true,
      availabilityFailure: true,
      languageRejected: false,
      retention: null,
      retainedItems: 0,
      noncanonicalEligibilityFlag: false,
      semanticsMatch: false,
      ordinaryCorrect: false,
      bytesStable: fs.readFileSync(path.join(root, 'authored/passage.md'), 'utf8') === ordinary,
      replayOutcome: null,
      queries: [],
      reviewKnowledge: [],
      error: 'evaluation_operation_failed',
    };
  } finally {
    await memory?.close();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(state, { recursive: true, force: true });
  }
}

function matchesExpectation(
  memory: Extract<MemoryQualification, { status: 'qualified' }>,
  entry: LanguageCase,
) {
  return (
    (!entry.commitment || memory.commitment === entry.commitment) &&
    (!entry.disposition || memory.disposition === entry.disposition) &&
    (!entry.basis || memory.basis === entry.basis) &&
    (!entry.polarity || memory.polarity === entry.polarity)
  );
}

function queryFor(view: MemoryView, language: 'en' | 'ru'): string {
  const english = {
    factual: 'What is recorded about Zephyr QX-100?',
    reports: 'What was reported about Zephyr QX-100?',
    discussion: 'What hypothetical scenarios were discussed for Zephyr QX-100?',
    planning: 'What is planned for Zephyr QX-100?',
    history: 'What was rejected or changed for Zephyr QX-100?',
    questions: 'What open questions remain about Zephyr QX-100?',
    all: 'Zephyr QX-100',
  };
  const russian = {
    factual: 'Что известно о Zephyr QX-100?',
    reports: 'Что сообщили по словам Ada Marlow о Zephyr QX-100?',
    discussion: 'Какие гипотезы обсуждались о Zephyr QX-100?',
    planning: 'Какие планы связаны с Zephyr QX-100?',
    history: 'Какие решения отклонены о Zephyr QX-100?',
    questions: 'Какие открытые вопросы остались о Zephyr QX-100?',
    all: 'Zephyr QX-100',
  };
  return (language === 'en' ? english : russian)[view];
}

function snapshot(root: string): string {
  return sha256(
    (fs.readdirSync(root, { recursive: true }) as string[])
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map((file) => file + '\0' + fs.readFileSync(path.join(root, file), 'utf8'))
      .join('\0'),
  );
}

function benchConfig(config: AknoConfig): { env: NodeJS.ProcessEnv; overrides: ConfigDoc } {
  const env = { ...process.env };
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([name, provider], index) => {
      const secret = `AKNO_LANGUAGE_BENCH_${index}_KEY`;
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
  const role = (name: 'derive' | 'answer' | 'embedding' | 'expansion') => {
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
        'memory/**': { role: 'knowledge', remember: 'integrate' },
        'authored/**': { role: 'knowledge', remember: 'deny' },
      },
      models: {
        derive: role('derive'),
        answer: role('answer'),
        embedding: role('embedding'),
        expansion: role('expansion'),
        reranker: { id: null, enabled: false },
        vision: { id: null, enabled: false },
      },
    },
  };
}
