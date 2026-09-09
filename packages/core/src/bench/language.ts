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
import { LANGUAGE_CORPUS_V2, type LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';
import { LANGUAGE_CORPUS_V7 } from './language-corpus-v7.ts';
import { LANGUAGE_CORPUS_V8 } from './language-corpus-v8.ts';
import { LANGUAGE_CORPUS_V9 } from './language-corpus-v9.ts';
import { LANGUAGE_CORPUS_V10 } from './language-corpus-v10.ts';
import { LANGUAGE_CORPUS_V11 } from './language-corpus-v11.ts';
import { LANGUAGE_CORPUS_V12 } from './language-corpus-v12.ts';
import { LANGUAGE_CORPUS_V13 } from './language-corpus-v13.ts';
import { LANGUAGE_CORPUS_V14 } from './language-corpus-v14.ts';
import { LANGUAGE_CORPUS_V15 } from './language-corpus-v15.ts';
import { LANGUAGE_CORPUS_V16 } from './language-corpus-v16.ts';
import { LANGUAGE_CORPUS_V17 } from './language-corpus-v17.ts';
import { LANGUAGE_CORPUS_V18 } from './language-corpus-v18.ts';
import { LANGUAGE_CORPUS_V19 } from './language-corpus-v19.ts';
import { LANGUAGE_CORPUS_V20 } from './language-corpus-v20.ts';
import { LANGUAGE_CORPUS_V6 } from './language-corpus-v6.ts';
import { LANGUAGE_CORPUS_V5 } from './language-corpus-v5.ts';
import { LANGUAGE_CORPUS_V4 } from './language-corpus-v4.ts';
import { languageGateThresholds } from './language-review.ts';
import { MEMORY_VIEW_VERSION } from '../memory/intent.ts';
import { LANGUAGE_CORPUS, LANGUAGE_CORPUS_VERSION, type LanguageCase } from './language-corpus.ts';

export interface LanguageBenchOptions {
  split: LanguageCase['split'];
  corpus?:
    | 'v1'
    | 'v2'
    | 'v3'
    | 'v4'
    | 'v5'
    | 'v6'
    | 'v7'
    | 'v8'
    | 'v9'
    | 'v10'
    | 'v11'
    | 'v12'
    | 'v13'
    | 'v14'
    | 'v15'
    | 'v16'
    | 'v17'
    | 'v18'
    | 'v19'
    | 'v20';
  runs?: number;
  caseIds?: string[];
  onProgress?: (id: string, done: number, total: number) => void;
}

/** Runs only invented inputs. Provider permissions/settings come from the caller's configured roles. */
export async function runLanguageBench(config: AknoConfig, options: LanguageBenchOptions) {
  const corpus = options.corpus ?? 'v2';
  const runs = options.runs ?? 1;
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error('runs must be between 1 and 5');
  const entries =
    corpus === 'v1'
      ? LANGUAGE_CORPUS
      : corpus === 'v2'
        ? LANGUAGE_CORPUS_V2
        : corpus === 'v3'
          ? LANGUAGE_CORPUS_V3
          : corpus === 'v4'
            ? LANGUAGE_CORPUS_V4
            : corpus === 'v5'
              ? LANGUAGE_CORPUS_V5
              : corpus === 'v6'
                ? LANGUAGE_CORPUS_V6
                : corpus === 'v7'
                  ? LANGUAGE_CORPUS_V7
                  : corpus === 'v8'
                    ? LANGUAGE_CORPUS_V8
                    : corpus === 'v9'
                      ? LANGUAGE_CORPUS_V9
                      : corpus === 'v10'
                        ? LANGUAGE_CORPUS_V10
                        : corpus === 'v11'
                          ? LANGUAGE_CORPUS_V11
                          : corpus === 'v12'
                            ? LANGUAGE_CORPUS_V12
                            : corpus === 'v13'
                              ? LANGUAGE_CORPUS_V13
                              : corpus === 'v14'
                                ? LANGUAGE_CORPUS_V14
                                : corpus === 'v15'
                                  ? LANGUAGE_CORPUS_V15
                                  : corpus === 'v16'
                                    ? LANGUAGE_CORPUS_V16
                                    : corpus === 'v17'
                                      ? LANGUAGE_CORPUS_V17
                                      : corpus === 'v18'
                                        ? LANGUAGE_CORPUS_V18
                                        : corpus === 'v19'
                                          ? LANGUAGE_CORPUS_V19
                                          : LANGUAGE_CORPUS_V20;
  const split = entries.filter((entry) => entry.split === options.split);
  if (options.caseIds?.some((id) => !split.some((entry) => entry.id === id)))
    throw new Error('unknown case id in selected split');
  const cases = split.filter((entry) => !options.caseIds || options.caseIds.includes(entry.id));
  if (!cases.length) throw new Error('no cases selected');
  const results: Awaited<ReturnType<typeof runCase>>[] = [];
  for (let run = 1; run <= runs; run++)
    for (const entry of cases) {
      results.push(await runCase(config, entry, corpus, run));
      options.onProgress?.(`${entry.id} run ${run}`, results.length, cases.length * runs);
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
    schemaVersion: 'language-benchmark-v2',
    createdAt: new Date().toISOString(),
    corpusVersion: corpus === 'v1' ? LANGUAGE_CORPUS_VERSION : `language-discourse-${corpus}`,
    corpusFingerprint: sha256(JSON.stringify(entries)),
    selectedCaseIds: cases.map((entry) => entry.id),
    runs,
    setup:
      corpus === 'v1'
        ? 'legacy-read-only-source-before-retain'
        : 'separate-writable-fidelity-and-read-only-admission',
    queryMatrix: ['query_language', 'answer_language', 'explicit_view'],
    split: options.split,
    knowledgeLanguage: 'en',
    proseProjectionVersion: PROSE_PROJECTION_VERSION,
    memoryViewVersion: MEMORY_VIEW_VERSION,
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
    modelOutputTokenLimits: {
      answer: config.models.answer.maxOutputTokens ?? null,
      retention: config.models.derive.maxOutputTokens ?? null,
    },
    indexModelDerivation: false,
    independentlyReviewed: false,
    releaseEligible: false,
    adjudication:
      'pending: inspect review material; verifier agreement and typed expectations are not independent truth labels',
    thresholds: languageGateThresholds(`language-discourse-${corpus}`),
    metrics: {
      availabilityFailures: rate(
        results.filter((result) => result.availabilityFailure).length,
        results.length,
      ),
      answerOperationFailures: rate(
        results
          .flatMap((result) => result.queries)
          .filter((query) =>
            [
              'generation_unavailable',
              'generation_failed',
              'invalid_draft',
              'verification_unavailable',
            ].includes(query.answerReason ?? ''),
          ).length,
        results.flatMap((result) => result.queries).length,
      ),
      producedAnswers: rate(
        results.flatMap((result) => result.queries).filter((query) => query.reviewAnswer !== null).length,
        results.flatMap((result) => result.queries).length,
      ),
      producedAnswersOverRetained: rate(
        written.flatMap((result) => result.queries).filter((query) => query.reviewAnswer !== null).length,
        written.flatMap((result) => result.queries).length,
      ),
      answerReasons: counts(results.flatMap((result) => result.queries).map((query) => query.answerReason)),
      routingReasons: counts(
        results.flatMap(
          (result) => result.retention?.candidates?.map((candidate) => candidate.routingReason) ?? [],
        ),
      ),
      holdStages: counts(
        results.flatMap(
          (result) => result.retention?.candidates?.map((candidate) => candidate.holdStage) ?? [],
        ),
      ),
      independentlyJudgedQualifiedAnswers: { numerator: null, denominator: 0, rate: null },
      independentlyJustifiedAbstentions: { numerator: null, denominator: 0, rate: null },
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
      expectedRetentionMisses: rate(
        useful.filter((result) => result.retainedItems === 0).length,
        useful.length,
      ),
      falseHolds:
        corpus === 'v1'
          ? rate(useful.filter((result) => result.retainedItems === 0).length, useful.length)
          : { numerator: null, denominator: 0, rate: null },
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
      sourceByteChanges: rate(
        results.filter((result) => result.bytesStable === false).length,
        results.filter((result) => result.bytesStable !== null).length,
      ),
    },
    byLanguage: Object.fromEntries(
      ['en', 'ru', 'mixed'].map((language) => [
        language,
        results.filter((result) => result.language === language).length,
      ]),
    ),
    byScenario: counts(results.map((result) => result.scenario)),
    cases: results,
  };
}

async function runCase(
  config: AknoConfig,
  entry: LanguageCase,
  corpus:
    | 'v1'
    | 'v2'
    | 'v3'
    | 'v4'
    | 'v5'
    | 'v6'
    | 'v7'
    | 'v8'
    | 'v9'
    | 'v10'
    | 'v11'
    | 'v12'
    | 'v13'
    | 'v14'
    | 'v15'
    | 'v16'
    | 'v17'
    | 'v18'
    | 'v19'
    | 'v20',
  run: number,
) {
  const v2 = corpus !== 'v1' ? (entry as LanguageCaseV2) : null;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-eval-kb-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-eval-state-'));
  let memory: Akno | null = null;
  const ordinary = `# Zephyr QX-100\n\n${entry.ordinary}\n`;
  fs.mkdirSync(path.join(root, 'memory'));
  fs.mkdirSync(path.join(root, 'authored'));
  fs.writeFileSync(path.join(root, 'memory/equipment.md'), '# Zephyr QX-100\n');
  if (!v2) fs.writeFileSync(path.join(root, 'authored/passage.md'), ordinary);
  const nonfactualExpected = entry.view !== 'factual';
  const base = {
    id: entry.id,
    run,
    admission: v2?.admission ?? 'legacy-mixed',
    reviewExpectation: v2?.reviewExpectation ?? null,
    language: entry.language,
    scenario: entry.scenario,
    expectedHold: entry.hold ?? false,
    nonfactualExpected,
  };
  try {
    const { env, overrides } = benchConfig(config);
    if (v2?.admission === 'read-only') overrides.folders = { '**': { role: 'knowledge', remember: 'deny' } };
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
    const beforeRetention = snapshot(root);
    const retained = await memory.retain(input);
    const admissionBytesStable = v2?.admission !== 'read-only' || beforeRetention === snapshot(root);
    const slugs = [
      ...new Set(
        retained.sources.flatMap((source) =>
          source.candidates.flatMap((candidate) => (candidate.slug ? [candidate.slug] : [])),
        ),
      ),
    ];
    // Ordinary authored text must not compete for placement in the writable-fidelity experiment.
    if (v2) fs.writeFileSync(path.join(root, 'authored/passage.md'), ordinary);
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
      const query = v2?.queries[queryLanguage] ?? queryFor(entry.view, queryLanguage);
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
        for (const answerLanguage of ['en', 'ru'] as const) {
          const answer = await memory.answer({
            question: query,
            answer_language: answerLanguage,
            filter: { folder: 'memory' },
            expand: true,
            graph: false,
            include_context: true,
            ...view,
          });
          queries.push({
            queryLanguage,
            explicitView: explicit,
            requestedAnswerLanguage: answerLanguage,
            inferredView: recalled.memory_view,
            recallStatus: recalled.status,
            recallDegraded: recalled.degraded ?? [],
            retainedEvidence: recalled.results.flatMap((result) =>
              result.type === 'page'
                ? result.lines.filter((line) => line.memory?.status === 'qualified')
                : [],
            ).length,
            reviewRetrieval: recalled.results.flatMap((result) =>
              result.type === 'page'
                ? result.lines.flatMap((line) =>
                    line.memory?.status === 'qualified'
                      ? [{ text: line.text, qualification: line.memory }]
                      : [],
                  )
                : [],
            ),
            contextStatus: context.status,
            contextDegraded: context.degraded ?? [],
            contextActivated: context.activation?.activated ?? false,
            contextActivation: context.activation ?? null,
            answerOutcome: answer.outcome,
            answerReason: answer.reason_code ?? null,
            answerValidation: answer.validation ?? null,
            answerDegraded: answer.degraded ?? [],
            answerModelUsage: answer.model_usage,
            reviewAnswer: answer.answer,
          });
        }
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
            'answer_failed',
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
          holdStage: candidate.hold_stage ?? null,
          routingReason: candidate.routing_reason ?? null,
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
        admissionBytesStable &&
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
      bytesStable: null,
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

function counts(values: (string | null | undefined)[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) if (value) result[value] = (result[value] ?? 0) + 1;
  return result;
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
