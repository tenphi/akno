import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha256=text=>createHash('sha256').update(text).digest('hex');
export function bindRuntime(open){
async function runCase(
  config            ,
  entry              ,
  corpus 
          
          
          
          
          
          
          
          
          
           
           
           
           
           
           
           
           
           
           
           
           
           ,
  run        ,
) {
  const v2 = corpus !== 'v1' ? (entry                  ) : null;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-eval-kb-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-eval-state-'));
  let memory              = null;
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
            mode: 'extract'         ,
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
    const lines         = [];
    for (const slug of slugs) lines.push(...((await memory.read({ slug })).page?.lines ?? []));
    const memories = lines.flatMap((line) =>
      line.memory?.status === 'qualified' ? [{ text: line.text, qualification: line.memory }] : [],
    );
    const queries = [];
    for (const queryLanguage of ['en', 'ru']         ) {
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
        for (const answerLanguage of ['en', 'ru']         ) {
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

function counts(values                               )                         {
  const result                         = {};
  for (const value of values) if (value) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function matchesExpectation(
  memory                                                       ,
  entry              ,
) {
  return (
    (!entry.commitment || memory.commitment === entry.commitment) &&
    (!entry.disposition || memory.disposition === entry.disposition) &&
    (!entry.basis || memory.basis === entry.basis) &&
    (!entry.polarity || memory.polarity === entry.polarity)
  );
}

function queryFor(view            , language             )         {
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

function snapshot(root        )         {
  return sha256(
    (fs.readdirSync(root, { recursive: true })            )
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map((file) => file + '\0' + fs.readFileSync(path.join(root, file), 'utf8'))
      .join('\0'),
  );
}

function benchConfig(config            )                                                   {
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
  const role = (name                                                 ) => {
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

return runCase;
}
