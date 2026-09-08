import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnswerOutput } from '@tenphi/akno-protocol';
import { open, type Akno } from '../open.ts';
import { sha256 } from '../store/ids.ts';
import {
  managedMemoryBlock,
  renderManagedMemoryPayload,
  type ManagedMemoryMarker,
} from '../write/managed-memory.ts';

let root: string;
let stateDir: string;
let memory: Akno;
let modelServer: http.Server | null;
let modelRequests: Record<string, unknown>[];

beforeEach(async () => {
  modelServer = null;
  modelRequests = [];
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-answer-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-answer-state-'));
  write('products/zephyr-qx-100.md', '# Zephyr QX-100\n\nThe silverpine warranty lasts five years.\n');
  write(
    'inbox/copperfin-record.txt',
    'The copperfin orphan marker belongs to an invented standalone record.\n',
  );
  memory = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { provider: 'missing', id: 'invented-reranker', enabled: true },
        derive: { id: null },
        expansion: { id: null },
        vision: { id: null, enabled: false },
      },
    },
  });
  await memory.index({ verify: true });
});

afterEach(async () => {
  await memory?.close();
  if (modelServer) {
    modelServer.closeAllConnections();
    await new Promise<void>((resolve) => modelServer!.close(() => resolve()));
  }
  for (const target of [root, stateDir]) fs.rmSync(target, { recursive: true, force: true });
});

describe('grounded answer discovery surface', () => {
  it('returns ordered related identities and typed model degradation without evidence text or writes', async () => {
    const before = treeFingerprint();
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });

    AnswerOutput.parse(result);
    expect(result).toMatchObject({
      status: 'degraded',
      outcome: 'not_answered',
      answer: null,
      citations: [],
      related_page_slugs: ['products/zephyr-qx-100'],
      related_documents: [],
      budget_used: { evidence_tokens: 0, answer_tokens: 0 },
      model_usage: { generation: null, verification: null },
      reason_code: 'generation_unavailable',
    });
    expect(result.degraded).toContain('no_answer_model');
    expect(result.degraded).not.toContain('no_reranker');
    expect(JSON.stringify(result)).not.toContain('lasts five years');
    expect(treeFingerprint()).toBe(before);
    expect(memory.changes()).toEqual([]);
  });

  it('preserves a complete empty recall as not-found instead of blaming the answer model', async () => {
    const result = await memory.answer({
      question: 'What is recorded in the missing invented folder?',
      filter: { folder: 'missing-fixture' },
      expand: false,
      graph: false,
    });

    expect(result).toMatchObject({
      status: 'empty',
      outcome: 'not_found',
      reason_code: 'no_results',
      answer: null,
      related_page_slugs: [],
      related_documents: [],
    });
    expect(result.degraded).toBeUndefined();
  });

  it('makes the slower qualified retrieval path explicit', async () => {
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
      rerank: true,
    });

    expect(result.degraded).toContain('no_reranker');
    expect(result.degraded).toContain('no_answer_model');
  });

  it('represents an orphan document by compact id without leaking its path or quote', async () => {
    const result = await memory.answer({
      question: 'Find the copperfin orphan marker.',
      filter: { ownership: 'orphan' },
      expand: false,
      graph: false,
    });
    const serialized = JSON.stringify(result);

    expect(result.related_page_slugs).toEqual([]);
    expect(result.related_documents).toHaveLength(1);
    expect(result.related_documents[0]!.id).toMatch(/^doc_/);
    expect(serialized).not.toContain('inbox/copperfin-record.txt');
    expect(serialized).not.toContain('belongs to an invented standalone record');
  });

  it('generates cited blocks and returns their already-retrieved evidence only when requested', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts 5 years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const before = treeFingerprint();
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
      include_context: true,
    });

    AnswerOutput.parse(result);
    expect(result.answer).toBe('The warranty lasts 5 years. [products/zephyr-qx-100:3]');
    expect(result.citations).toEqual([
      { id: 'E1', type: 'page', slug: 'products/zephyr-qx-100', lines: [3] },
    ]);
    expect(result.context).toEqual([
      {
        evidence_id: 'E1',
        type: 'page',
        slug: 'products/zephyr-qx-100',
        title: 'Zephyr QX-100',
        lines: [
          {
            n: 3,
            text: 'The silverpine warranty lasts five years.',
            prose: expect.objectContaining({ status: 'qualified', view: 'factual', answer_eligible: true }),
          },
        ],
      },
    ]);
    expect(modelRequests).toHaveLength(2);
    const verifierMessages = modelRequests[1]!.messages as { content: string }[];
    expect(JSON.parse(verifierMessages.at(-1)!.content)).toMatchObject({
      question: expect.any(String),
      memory_view: 'factual',
    });
    expect(result.model_usage).toEqual({
      generation: {
        model: 'invented-answer-model',
        latency_ms: expect.any(Number),
        input_tokens: 111,
        output_tokens: 22,
        total_tokens: 133,
      },
      verification: {
        model: 'invented-answer-model',
        latency_ms: expect.any(Number),
        input_tokens: 222,
        output_tokens: 33,
        total_tokens: 255,
      },
    });
    expect(JSON.stringify(modelRequests)).not.toContain('products/zephyr-qx-100');
    expect(treeFingerprint()).toBe(before);
    expect(memory.changes()).toEqual([]);
  });

  it.each([
    ['Hypothetically, the silverpine warranty lasts five years.', true],
    ['Предположительно, гарантия silverpine действует пять лет.', true],
    ['The silverpine warranty lasts five years.', false],
  ])('preserves ordinary heading scope in generated answers: %s', async (text, accepted) => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n## Hypothetical warranty\nThe silverpine warranty lasts five years.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What hypothetical silverpine warranty was discussed?',
      memory_view: 'discussion',
      filter: { source: 'page' },
      expand: false,
      graph: false,
      include_context: true,
    });
    expect(result.answer !== null).toBe(accepted);
    if (accepted) {
      expect(result.citations[0]).toMatchObject({ lines: [1, 3, 4] });
      expect(JSON.stringify(modelRequests)).toContain('Hypothetical warranty');
    } else {
      expect(result.model_usage.verification).toBeNull();
    }
  });

  it('describes a managed hypothesis to the model without an unrelated factual eligibility veto', async () => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_hypothesis v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=hypothetical disposition=active polarity=affirmed basis=self_attested -->\n- **Hypothetical:** The silverpine warranty could last five years.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The hypothetical silverpine warranty lasts five years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What hypothetical silverpine warranty was discussed?',
      memory_view: 'discussion',
      expand: false,
      graph: false,
    });
    expect(result.answer).toContain('hypothetical');
    const messages = modelRequests[0]!.messages as { content: string }[];
    const user = JSON.parse(messages.at(-1)!.content);
    expect(user.memory_view).toBe('discussion');
    expect(user.evidence[0].excerpt).toContain('hypothetical');
    expect(user.evidence[0].excerpt).not.toContain('answer_eligible');
    expect(user.evidence[0].excerpt).not.toContain('current_eligible');
    expect(user.evidence[0].excerpt).not.toContain('unresolved');
    expect(user.evidence[0].excerpt).not.toContain('level');
  });

  it.each([
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant recorded an unverified report from Bo Winters about silverpine inspection coverage.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'Bo Winters reportedly told the assistant about silverpine inspection coverage, which remains unverified.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant has a file. An unverified report exists. The silverpine warranty covers inspection.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty requires inspection.',
      'Ada Marlow stated that the silverpine inspection requirement remains unestablished.',
      true,
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty requires inspection.',
      'Ada Marlow сообщила, что требование проверки silverpine пока не установлено.',
      true,
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty requires inspection.',
      'Ada Marlow stated that the silverpine warranty does not require inspection, but this remains unestablished.',
      false,
      'protected_value',
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow hypothetically assumes that the silverpine warranty requires inspection.',
      'Ada Marlow discussed the hypothetical inspection requirement, not as an established obligation.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow hypothetically assumes that the silverpine warranty requires inspection.',
      'Ada Marlow discussed the hypothetical inspection requirement, not a confirmed obligation.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow hypothetically assumes that the silverpine warranty requires inspection.',
      'Ada Marlow высказала гипотезу о проверке silverpine без установления этого как факта, а не как установленное требование.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified belief that the silverpine warranty covers inspection.',
      'Ассистент сообщил предварительное мнение о проверке silverpine, пока без подтверждения.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow hypothetically assumes that the silverpine warranty requires inspection.',
      'Ada Marlow discussed a hypothetical warranty that does not require inspection; this was not an established obligation.',
      false,
      'protected_value',
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow discussed the unestablished assumption that the silverpine warranty requires inspection.',
      'For discussion, Ada Marlow was assuming the silverpine warranty requires inspection.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow discussed the unestablished assumption that the silverpine warranty requires inspection.',
      'Ada Marlow discussed assumptions about the silverpine warranty requiring inspection.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described an unrealized counterfactual: had she chosen the silverpine warranty extension, repairs in year seven would have been covered rather than the selected coverage.',
      'Ada Marlow described the unrealized counterfactual where repairs in year seven would have been covered. This was not the coverage she selected.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described an unrealized counterfactual: had she chosen the silverpine warranty extension, repairs in year seven would have been covered rather than the selected coverage.',
      'Ada Marlow описала нереализованный контрфактический сценарий с ремонтом на седьмом году. Это не было покрытием, которое она выбрала.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described an unrealized counterfactual: had she chosen the silverpine warranty extension, repairs in year seven would have been covered rather than the selected coverage.',
      'Ada Marlow described the unrealized counterfactual of silverpine repairs in year seven. She did not select that coverage.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described an unrealized counterfactual: had she chosen the silverpine warranty extension, repairs in year seven would have been covered rather than the selected coverage.',
      'Ada Marlow описала контрфактический сценарий silverpine с ремонтом на седьмом году. Этот сценарий не был реализован, расширенная гарантия не была выбрана.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described an unrealized counterfactual: had she chosen the silverpine warranty extension, repairs in year seven would have been covered rather than the selected coverage.',
      'Ada Marlow described the unrealized counterfactual where repairs in year seven would not have been covered. This was not the coverage she selected.',
      false,
      'protected_value',
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow discussed two unestablished hypotheses about the silverpine warranty: annual and biennial inspections.',
      'Ada Marlow обсуждала две гипотезы silverpine; ни одна не была признана установленной.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow discussed a fictional silverpine warranty lasting twenty years.',
      'Ada Marlow discussed a fictional twenty-year silverpine warranty, explicitly stated not to be a real warranty.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow discussed a fictional silverpine warranty lasting twenty years.',
      'Ada Marlow обсуждала вымышленную гарантию silverpine на двадцать лет; она не является реальной гарантией.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow assumed for discussion that the silverpine warranty requires seasonal inspection; this is unestablished.',
      'Ada Marlow предположила для обсуждения, что гарантия silverpine требует сезонной проверки; это не установлено как фактическое обязательство.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported what Bo Winters said about a five-year silverpine warranty, but has not verified his words.',
      'Ассистент сообщил со слов Bo Winters о гарантии silverpine на пять лет, но не проверял его слова; сообщение предварительное.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described an unrealized alternative where a silverpine warranty would have lasted seven years.',
      'Ada Marlow described a counterfactual seven-year silverpine warranty, not as an actual event.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'The hypothesis that the Zephyr QX-100 warranty lasts seven years is unestablished.',
      'The hypothetical warranty for Zephyr QX-100: seven years. The evidence does not establish whether it is correct.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant suspects that the silverpine warranty lasts five years, but has no confirmation.',
      'Ассистент предположил, что гарантия silverpine длится пять лет, но подтверждения этому нет.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant suspects that the silverpine warranty lasts five years, but has no confirmation.',
      'Ассистент предположил, но не подтвердил, что гарантия silverpine длится пять лет.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'The hypothesis that the silverpine warranty lasts seven years is unestablished.',
      'Гипотеза о гарантии silverpine на семь лет не установлена как факт.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'The hypothetical silverpine warranty lasts seven years.',
      'The hypothetical silverpine warranty lasts seven years; this is not an assertion about actual coverage.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'The hypothetical silverpine warranty lasts seven years.',
      'Гипотеза о гарантии silverpine на семь лет — не утверждение о фактическом покрытии.',
      true,
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty lasts six years.',
      'Ada Marlow высказала предварительное мнение, что гарантия silverpine длится шесть лет.',
      true,
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty may last six years, but she is not confident.',
      'Ada Marlow tentatively believed that the silverpine warranty may last six years, but she was not confident.',
      true,
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty may last six years, but she is not confident.',
      'Ada Marlow предположила, что гарантия silverpine может длиться шесть лет; она не была в этом уверена.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported that the silverpine warranty lasts five years, but this is an unverified answer.',
      'Ассистент предположил, что гарантия silverpine длится пять лет; этот ответ не проверен.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported that the silverpine warranty lasts five years, but this is an unverified answer.',
      'The assistant reported that the silverpine warranty lasts five years.',
      false,
    ],
    [
      'hypothetical',
      'source_report',
      'The assistant described an invented example where the silverpine warranty lasts eleven years.',
      'The assistant described a hypothetical silverpine warranty lasting eleven years.',
      false,
    ],
    [
      'hypothetical',
      'source_report',
      'The assistant described an invented example where the silverpine warranty lasts eleven years.',
      'В вымышленном примере, приведённом ассистентом, гарантия silverpine длится одиннадцать лет.',
      true,
    ],
    [
      'hypothetical',
      'source_report',
      'The assistant described a fictional silverpine warranty lasting eleven years.',
      'The assistant described a fictional silverpine warranty lasting eleven years; this is not a real warranty record.',
      true,
    ],
    [
      'hypothetical',
      'source_report',
      'The assistant described a fictional silverpine warranty lasting eleven years.',
      'Ассистент описал вымышленную гарантию silverpine на одиннадцать лет; это не реальная гарантия.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant recorded a tentative, unverified report from Bo Winters about silverpine inspection coverage.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant tentatively recorded that Bo Winters told her about silverpine inspection coverage; this remains unverified.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'Ассистент записал со слов Bo Winters неподтверждённое сообщение о покрытии проверки silverpine.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant recorded a file. An unverified report exists. The silverpine warranty covers inspection.',
      false,
      'attribution',
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine на третьем году. Точная календарная дата, к которой относится третий год, не указана.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine на третьем году. Опорная дата третьего года не указана.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine на третьем году. Дата, от которой отсчитывается третий год, не указана.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine на третьем году. Опорная дата для третьего года не указана.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine на третьем году. The reference date is not specified.',
      true,
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий: ремонт silverpine на третьем году не покрыт. Опорная дата третьего года не указана.',
      false,
      'protected_value',
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered; the reference date for the third year is unspecified.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine. Опорная дата упомянута, но ремонт не предусмотрен.',
      false,
      'protected_value',
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described the counterfactual where silverpine repairs in year three would be covered.',
      'Ada Marlow описала контрфактический сценарий ремонта silverpine. Опорная дата третьего года не указана.',
      false,
      'protected_value',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant recorded the tentative, unverified report from Bo Winters about silverpine inspection coverage.',
      true,
    ],
  ] as const)(
    'preserves compound qualifications across languages: %s %s %s',
    async (commitment, basis, source, text, accepted, rejectionReason = 'discourse') => {
      write(
        'products/zephyr-qx-100.md',
        `# Zephyr QX-100\n\n<!-- akno:item mem_compound v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=${basis === 'source_report' ? 'assistant' : 'user'} ${basis === 'source_report' ? 'speaker=assistant ' : ''}reports=0 commitment=${commitment} disposition=active polarity=affirmed basis=${basis} -->\n- **${basis === 'source_report' ? 'Reported by assistant · ' : ''}${commitment === 'tentative' ? 'Tentative' : commitment === 'counterfactual' ? 'Counterfactual' : 'Hypothetical'}:** ${source}\n`,
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [{ block_id: 'B1', supported: true }] },
      });
      const result = await memory.answer({
        question: 'What was discussed about the silverpine warranty?',
        memory_view: 'all',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(result.reason_code).toBe(accepted ? 'answered' : 'draft_rejected');
      expect(result.validation).toMatchObject({
        generated_blocks: 1,
        passed_guards: accepted ? 1 : 0,
        verified_blocks: accepted ? 1 : null,
      });
      if (!accepted) expect(result.validation?.rejection_counts).toEqual({ [rejectionReason]: 1 });
      AnswerOutput.parse(result);
    },
  );

  it('still rejects negation introduced into an affirmative source', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'Гарантия silverpine не действует пять лет.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What is the silverpine warranty?',
      expand: false,
      graph: false,
    });
    expect(result).toMatchObject({
      answer: null,
      reason_code: 'draft_rejected',
      validation: { rejection_counts: { protected_value: 1 } },
    });
    expect(modelRequests).toHaveLength(1);
  });

  it('does not license a new predicate negation just because its source is fictional', async () => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_fiction v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=hypothetical disposition=active polarity=affirmed basis=self_attested -->\n- **Hypothetical:** A fictional silverpine warranty covers sensor repair.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'In this fictional scenario, the silverpine warranty does not cover sensor repair.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What fictional silverpine coverage was discussed?',
      memory_view: 'discussion',
      expand: false,
      graph: false,
    });
    expect(result.answer).toBeNull();
    expect(result.validation?.rejection_counts).toEqual({ protected_value: 1 });
    expect(modelRequests).toHaveLength(1);
  });

  it.each([
    'Ada Marlow оставила открытым вопрос о ремонте датчика по гарантии silverpine; ответ пока не определён.',
    'Ada Marlow recorded that it remains open and undetermined whether the silverpine warranty covers sensor repair.',
  ])('preserves an undetermined open question without denying its predicate: %s', async (text) => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_undetermined v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=question subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=none disposition=active polarity=affirmed basis=self_attested -->\n- **Open question:** Ada Marlow left open whether the silverpine warranty covers sensor repair; the answer remains to be determined.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text,
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What open silverpine warranty question remains?',
      memory_view: 'questions',
      expand: false,
      graph: false,
    });
    expect(result.reason_code).toBe('answered');
    const messages = modelRequests[1]!.messages as { content: string }[];
    expect(JSON.parse(messages.at(-1)!.content)).toMatchObject({
      question: 'What open silverpine warranty question remains?',
      memory_view: 'questions',
    });
  });

  it.each(['unknown', 'unestablished', 'unverified', 'not confirmed'])(
    'does not treat epistemic uncertainty as predicate negation: %s',
    async (uncertainty) => {
      write(
        'products/zephyr-qx-100.md',
        `# Zephyr QX-100\n\n<!-- akno:item mem_question v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=question subject=unresolved source-role=user reports=0 commitment=none disposition=active polarity=affirmed basis=self_attested -->\n- **Open question:** The open question is whether the silverpine warranty covers sensor repair; the answer is ${uncertainty}.\n`,
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: {
          blocks: [
            {
              text: 'The open question tentatively suggests that the silverpine warranty does not cover sensor repair.',
              evidence_ids: ['E1'],
            },
          ],
          missing_concepts: [],
        },
        verification: { verdicts: [{ block_id: 'B1', supported: true }] },
      });
      const result = await memory.answer({
        question: 'What open silverpine warranty question remains?',
        memory_view: 'questions',
        expand: false,
        graph: false,
      });
      expect(result.answer).toBeNull();
      expect(result.validation?.rejection_counts).toEqual({ protected_value: 1 });
      expect(modelRequests).toHaveLength(1);
    },
  );

  it.each(['assume', 'assumes', 'assuming'])('preserves an unlabeled assumption using %s', async (word) => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n## Discussion\n' +
        (word === 'assume'
          ? 'For discussion, Ada Marlow asks us to assume'
          : word === 'assuming'
            ? 'Ada Marlow is assuming'
            : 'Ada Marlow assumes') +
        ' for discussion that the silverpine warranty requires inspection.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow discussed a hypothetical silverpine inspection requirement, not an established obligation.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What was assumed about the silverpine warranty?',
      memory_view: 'discussion',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.reason_code, JSON.stringify(result)).toBe('answered');
  });

  it.each([
    ['The silverpine warranty covers sensor repair.', 'attribution'],
    ['Ada Marlow reported that the silverpine warranty covers sensor repair.', 'discourse'],
  ])(
    'keeps qualification guards when a citation includes unrelated factual text: %s',
    async (text, rejection) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\nThe silverpine warranty document has a green cover.\n<!-- akno:item mem_mixed v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=tentative disposition=active polarity=affirmed basis=source_report -->\n- **Reported by Ada Marlow · Tentative:** Ada Marlow reported that the silverpine warranty might cover sensor repair.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1', 'E2'] }], missing_concepts: [] },
        verification: { verdicts: [{ block_id: 'B1', supported: true }] },
      });
      const result = await memory.answer({
        question: 'What silverpine warranty document and sensor repair details are recorded?',
        memory_view: 'all',
        expand: false,
        graph: false,
      });
      expect(JSON.stringify(modelRequests)).toContain('green cover');
      expect(result.answer).toBeNull();
      expect(result.validation?.rejection_counts).toEqual({ [rejection]: 1 });
      expect(modelRequests).toHaveLength(1);
    },
  );

  it('removes a block whose invented exact value does not occur in its citation', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts 8 years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });

    expect(result).toMatchObject({ status: 'degraded', outcome: 'not_answered', answer: null });
    expect(result.degraded).not.toContain('answer_failed');
    expect(result.citations).toEqual([]);
    expect(result.context).toBeUndefined();
    expect(modelRequests).toHaveLength(1);
    expect(result.model_usage.generation?.total_tokens).toBe(133);
    expect(result.model_usage.verification).toBeNull();
  });

  it('withholds semantically unsupported prose without reporting verification failure', async () => {
    await useAnswerModel({
      generation: {
        blocks: [
          { text: 'The warranty lasts five years.', evidence_ids: ['E1'] },
          { text: 'Replacement shipping is included.', evidence_ids: ['E1'] },
        ],
        missing_concepts: [],
      },
      verification: {
        verdicts: [
          { block_id: 'B1', supported: true },
          { block_id: 'B2', supported: false },
        ],
      },
    });
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });

    expect(result).toMatchObject({
      status: 'degraded',
      outcome: 'partial',
      answer: 'The warranty lasts five years. [products/zephyr-qx-100:3]',
    });
    expect(result.degraded).not.toContain('answer_failed');
    expect(result.degraded).not.toContain('answer_verification_failed');
    expect(result.answer).not.toContain('shipping');
    expect(result.reason_code).toBe('answered');
    expect(result.validation).toEqual({
      generated_blocks: 2,
      passed_guards: 2,
      verified_blocks: 1,
      rejection_counts: { semantic_support: 1 },
    });
    expect(result.citations).toEqual([
      { id: 'E1', type: 'page', slug: 'products/zephyr-qx-100', lines: [3] },
    ]);
  });

  it('accepts an explicit exclusion as support for equivalent negative wording', async () => {
    write(
      'coverage/cormorant-exclusions.md',
      '# Cormorant exclusions\n\nThe cormorant coverage excludes volcanic-ash damage.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'Coverage does not include volcanic-ash damage.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    const result = await memory.answer({
      question: 'Does the cormorant coverage include volcanic-ash damage?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });

    expect(result).toMatchObject({
      status: 'degraded',
      outcome: 'partial',
      answer: 'Coverage does not include volcanic-ash damage. [coverage/cormorant-exclusions:3]',
    });
    expect(result.degraded).toContain('partial_index');
    expect(modelRequests).toHaveLength(2);
  });

  it('fails closed when independent verification returns an invalid verdict', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts five years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [] },
    });
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });

    expect(result).toMatchObject({ status: 'degraded', outcome: 'not_answered', answer: null });
    expect(result.degraded).toContain('answer_verification_failed');
    expect(result.citations).toEqual([]);
    expect(result.model_usage.verification?.total_tokens).toBe(255);
  });

  it('doctor exercises the production generation and verification contracts on invented evidence', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts five years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });

    const report = await memory.doctor();
    const answerRole = report.models.find((role) => role.role === 'answer');
    expect(answerRole).toMatchObject({
      available: true,
      latencyMs: expect.any(Number),
      checks: {
        generation: {
          status: 'ok',
          usage: { inputTokens: 111, outputTokens: 22, totalTokens: 133 },
          error: null,
        },
        verification: {
          status: 'ok',
          usage: { inputTokens: 222, outputTokens: 33, totalTokens: 255 },
          error: null,
        },
      },
    });
    expect(modelRequests).toHaveLength(2);
  });

  it('leaves provider token counts null when a compatible endpoint omits usage', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts five years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
      reportUsage: false,
    });

    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.model_usage.generation).toMatchObject({
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
    });
    expect(result.model_usage.verification).toMatchObject({
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
    });
  });

  it('returns report qualification from recall but never offers the report as factual answer evidence', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The lantern warranty lasts eight years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    write(
      'reports/lantern.md',
      [
        '# Lantern report',
        '',
        '<!-- akno:item mem_report v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=external speaker=Bo%20Winters reports=0 commitment=asserted disposition=active polarity=affirmed basis=source_report -->',
        '- **Reported by Bo Winters:** Bo Winters said the lantern warranty lasts eight years.',
        '',
      ].join('\n'),
    );
    await memory.index({ verify: true });

    const recalled = await memory.recall({
      query: 'lantern warranty eight years',
      filter: { folder: 'reports' },
      expand: false,
      graph: false,
      rerank: false,
    });
    const report = recalled.results.find((result) => result.type === 'page');
    expect(report?.type === 'page' ? report.lines[0]?.memory : undefined).toMatchObject({
      status: 'qualified',
      kind: 'claim',
      source_role: 'external',
      source_speaker: 'Bo Winters',
      basis: 'source_report',
      answer_eligible: false,
    });

    const result = await memory.answer({
      question: 'How long is the lantern warranty?',
      filter: { folder: 'reports' },
      expand: false,
      graph: false,
      include_context: true,
    });

    expect(result).toMatchObject({
      outcome: 'not_answered',
      answer: null,
      context: [],
      citations: [],
      related_page_slugs: ['reports/lantern'],
      model_usage: { generation: null, verification: null },
    });
    expect(result.note).toContain('explicitly noncanonical');
    expect(modelRequests).toHaveLength(0);
  });

  it('answers an explicit report question only with source attribution preserved', async () => {
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Bo Winters reported that the lantern warranty lasts eight years.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    writeReportMemory();
    await memory.index({ verify: true });

    const result = await memory.answer({
      question: 'What did Bo Winters report about the lantern warranty?',
      filter: { folder: 'reports' },
      expand: false,
      graph: false,
      include_context: true,
    });

    expect(result.memory_view).toBe('reports');
    expect(result.outcome).toBe('partial');
    expect(result.answer).toContain('Bo Winters reported');
    expect(result.context?.[0]).toMatchObject({
      type: 'page',
      slug: 'reports/lantern',
      lines: [
        expect.objectContaining({
          memory: expect.objectContaining({ basis: 'source_report', source_speaker: 'Bo Winters' }),
        }),
      ],
    });
  });

  it('rejects an unattributed answer derived only from a retained report', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The lantern warranty lasts eight years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    writeReportMemory();
    await memory.index({ verify: true });

    const result = await memory.answer({
      question: 'What did Bo Winters report about the lantern warranty?',
      filter: { folder: 'reports' },
      expand: false,
      graph: false,
    });

    expect(result.memory_view).toBe('reports');
    expect(result.outcome).toBe('not_answered');
    expect(result.answer).toBeNull();
    expect(modelRequests).toHaveLength(1);
  });

  it('rejects a proposal restated as an unqualified future fact', async () => {
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow will inspect the Zephyr QX-100 at Blackwater Bay.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    writePlanMemory();
    await memory.index({ verify: true });

    const result = await memory.answer({
      question: 'What inspection plan was proposed for Ada Marlow?',
      memory_view: 'planning',
      filter: { folder: 'plans' },
      expand: false,
      graph: false,
    });

    expect(result.outcome).toBe('not_answered');
    expect(result.answer).toBeNull();
    expect(modelRequests).toHaveLength(1);
  });

  it('allows a proposal answer that preserves its status', async () => {
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow proposed inspecting the Zephyr QX-100 at Blackwater Bay.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [{ block_id: 'B1', supported: true }] },
    });
    writePlanMemory();
    await memory.index({ verify: true });

    const result = await memory.answer({
      question: 'What inspection plan was proposed for Ada Marlow?',
      memory_view: 'planning',
      filter: { folder: 'plans' },
      expand: false,
      graph: false,
    });

    expect(result.answer).toContain('proposed');
    expect(modelRequests).toHaveLength(2);
  });

  it('uses the reader clock to separate expired state, factual history, and actionable future work', async () => {
    const expired = temporalMarker('mem_expired', {
      time: {
        start: '2001-01-01',
        until: '2001-12-31',
        precision: 'day',
        relation: 'valid',
        status: 'actual',
      },
    });
    const planned = temporalMarker('mem_planned', {
      kind: 'plan',
      disposition: 'accepted',
      time: {
        start: '2031-04-20',
        precision: 'day',
        relation: 'scheduled',
        status: 'planned',
      },
    });
    const cancelled = temporalMarker('mem_cancelled', {
      kind: 'plan',
      disposition: 'cancelled',
      time: {
        start: '2031-04-18',
        precision: 'day',
        relation: 'scheduled',
        status: 'planned',
      },
    });
    write(
      'memory/temporal-answer.md',
      [
        '# Temporal answer memory',
        '',
        managedMemoryBlock(
          expired,
          renderManagedMemoryPayload('Ada Marlow currently evaluates the Zephyr QX-100.', expired),
        ),
        '',
        managedMemoryBlock(
          planned,
          renderManagedMemoryPayload('Ada Marlow plans a Zephyr QX-100 inspection.', planned),
        ),
        '',
        managedMemoryBlock(
          cancelled,
          renderManagedMemoryPayload('Ada Marlow cancelled the Blackwater Bay inspection.', cancelled),
        ),
        '',
      ].join('\n'),
    );
    await memory.index({ verify: true });

    const autoCurrent = await memory.context({
      profile: 'auto_recall',
      query: 'Ada Marlow currently evaluates the Zephyr QX-100.',
      filter: { folder: 'memory' },
      budget: 1200,
    });
    expect(JSON.stringify(autoCurrent.results)).not.toContain('currently evaluates');

    const autoFuture = await memory.context({
      profile: 'auto_recall',
      query: 'Ada Marlow plans a Zephyr QX-100 inspection.',
      filter: { folder: 'memory' },
      budget: 1200,
    });
    expect(autoFuture.results[0]).toMatchObject({
      type: 'page',
      lines: [expect.objectContaining({ text: expect.stringContaining('plans a Zephyr') })],
    });
    expect(JSON.stringify(autoFuture.results)).not.toContain('currently evaluates');

    const current = await memory.answer({
      question: 'What is Ada Marlow currently evaluating?',
      filter: { folder: 'memory' },
      expand: false,
      graph: false,
      include_context: true,
    });
    expect(current.context).toEqual([]);
    expect(current.note).toContain('world-time interval is not current');

    const future = await memory.answer({
      question: 'What inspection is planned next for Ada Marlow?',
      filter: { folder: 'memory' },
      expand: false,
      graph: false,
      include_context: true,
    });
    expect(future.context?.[0]).toMatchObject({
      type: 'page',
      slug: 'memory/temporal-answer',
      lines: expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('plans a Zephyr') }),
      ]),
    });

    const generic = await memory.answer({
      question: 'What does the Zephyr inspection record say?',
      filter: { folder: 'memory' },
      expand: false,
      graph: false,
      include_context: true,
    });
    expect(JSON.stringify(generic.context)).not.toContain('plans a Zephyr');

    const historical = await memory.answer({
      question: 'Which Blackwater Bay inspection was cancelled?',
      filter: { folder: 'memory' },
      expand: false,
      graph: false,
      include_context: true,
    });
    expect(historical.context?.[0]).toMatchObject({
      type: 'page',
      lines: expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('cancelled the Blackwater Bay') }),
      ]),
    });
  });
});

function temporalMarker(
  id: string,
  overrides: Partial<ManagedMemoryMarker> & Pick<ManagedMemoryMarker, 'time'>,
): ManagedMemoryMarker {
  return {
    id,
    supports: [
      {
        receipt: 'aaaaaaaaaaaa',
        candidate: 'bbbbbbbbbbbb',
        proofGroup: 'cccccccccccc',
        selection: 'provided',
      },
    ],
    kind: 'claim',
    subject: 'unresolved',
    sourceRole: 'user',
    reporters: [],
    commitment: 'asserted',
    disposition: 'active',
    polarity: 'affirmed',
    basis: 'self_attested',
    evidence: [],
    links: [],
    ...overrides,
  };
}

async function useAnswerModel(script: {
  generation: unknown;
  verification: unknown;
  reportUsage?: boolean;
}): Promise<void> {
  await memory.close();
  modelServer = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      modelRequests.push(body);
      const system = String((body.messages as Array<{ content?: unknown }> | undefined)?.[0]?.content ?? '');
      const verifying = system.includes('independently verify');
      const content = verifying ? script.verification : script.generation;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
          ...(script.reportUsage === false
            ? {}
            : {
                usage: verifying
                  ? { prompt_tokens: 222, completion_tokens: 33, total_tokens: 255 }
                  : { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
              }),
        }),
      );
    });
  });
  await new Promise<void>((resolve) => modelServer!.listen(0, '127.0.0.1', resolve));
  const { port } = modelServer.address() as { port: number };
  memory = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: `http://127.0.0.1:${port}/v1`, max_retries: 0 } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
        answer: { provider: 'stub', id: 'invented-answer-model', reasoning_effort: 'none' },
        vision: { id: null, enabled: false },
      },
    },
  });
}

function write(relPath: string, content: string): void {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

function writeReportMemory(): void {
  write(
    'reports/lantern.md',
    [
      '# Lantern report',
      '',
      '<!-- akno:item mem_report v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=external speaker=Bo%20Winters reports=0 commitment=asserted disposition=active polarity=affirmed basis=source_report -->',
      '- **Reported by Bo Winters:** Bo Winters said the lantern warranty lasts eight years.',
      '',
    ].join('\n'),
  );
}

function writePlanMemory(): void {
  write(
    'plans/inspection.md',
    [
      '# Inspection plan',
      '',
      '<!-- akno:item mem_plan v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=plan subject=unresolved source-role=user reports=0 commitment=asserted disposition=proposed polarity=affirmed basis=self_attested -->',
      '- **Proposal:** Ada Marlow proposed inspecting the Zephyr QX-100 at Blackwater Bay.',
      '',
    ].join('\n'),
  );
}

function treeFingerprint(): string {
  const files = listFiles();
  return sha256(JSON.stringify(files.map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))])));
}

function listFiles(rel = ''): string[] {
  return fs
    .readdirSync(path.join(root, rel), { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.posix.join(rel, entry.name);
      return entry.isDirectory() ? listFiles(child) : [child];
    })
    .sort();
}
