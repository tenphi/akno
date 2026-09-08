import { semanticAudit } from '../../test/semantic-audit.ts';
import Database from 'better-sqlite3';
import { retentionSourceFrames } from '../memory/retention-source-frame.ts';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnswerOutput, type AnswerContextItem } from '@tenphi/akno-protocol';
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
  it.each([true, false])(
    'keeps an original retention frame private and honors its semantic verdict: %s',
    async (supported) => {
      const frame = await seedSourceFrame();
      await useAnswerModel({
        generation: {
          blocks: [
            {
              text: 'The open silverpine question is whether the warranty includes return delivery. It remains unresolved whether the warranty covers or excludes that delivery.',
              evidence_ids: ['E1'],
            },
          ],
          missing_concepts: [],
        },
        verification: {
          verdicts: [
            {
              ...verdict('B1', supported),
              excerpt_selection: { selected_by_retained_excerpt: true, unselected_content: null },
            },
          ],
        },
      });
      const before = treeFingerprint();
      const result = await memory.answer({
        question: 'Which open silverpine question remains?',
        memory_view: 'questions',
        include_context: true,
        expand: false,
        graph: false,
      });
      expect(result.answer !== null).toBe(supported);
      expect(modelRequests).toHaveLength(2);
      const payloads = modelRequests.map((request) =>
        JSON.parse((request.messages as { content: string }[]).at(-1)!.content),
      );
      expect(payloads[0].evidence[0].retention_source_frame).toBe(frame);
      expect(payloads[1].blocks[0].cited_evidence[0].retention_source_frame).toBe(frame);
      expect(result.budget_used.evidence_tokens).toBeGreaterThan(Math.ceil(frame.length / 4));
      expect(JSON.stringify(result)).not.toContain('amberfin');
      expect(JSON.stringify(result)).not.toContain('retention_source_frame');
      expect(result.context?.[0]?.type).toBe('page');
      if (supported)
        expect(result.citations).toEqual([
          { id: 'E1', type: 'page', slug: 'products/zephyr-qx-100', lines: [4] },
        ]);
      expect(treeFingerprint()).toBe(before);
    },
  );

  it.each([
    undefined,
    {
      selected_by_retained_excerpt: false,
      unselected_content: 'The unrelated amberfin phrase is absent from the retained excerpt.',
    },
    { selected_by_retained_excerpt: true, unselected_content: 'An unselected clause remains.' },
    { selected_by_retained_excerpt: false, unselected_content: null },
  ])('requires an independent, consistent retained-excerpt selection verdict: %j', async (selection) => {
    await seedSourceFrame();
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'The open silverpine question is whether the warranty covers return delivery; its answer remains unknown. The source also contains an unrelated amberfin phrase.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: {
        verdicts: [{ ...verdict('B1', true), ...(selection ? { excerpt_selection: selection } : {}) }],
      },
    });
    const result = await memory.answer({
      question: 'Which open silverpine question remains?',
      memory_view: 'questions',
      expand: false,
      graph: false,
    });
    expect(modelRequests).toHaveLength(2);
    expect(result.answer).toBeNull();
    expect(result.citations).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('amberfin');
  });

  it.each([
    'valid',
    'valid-crlf',
    'moved',
    'moved-file',
    'missing',
    'retracted',
    'forgotten',
    'pruned',
    'hash',
    'oversized',
    'empty',
    'candidate',
    'proof',
    'receipt',
    'identity',
    'provided-mode',
    'source-hash',
    'provided',
    'multiple',
    'stale-payload',
    'whitespace',
    'line-endings',
    'stale-marker',
    'duplicate-id',
  ])('binds optional retention context to the exact live source support: %s', async (mutation) => {
    const frame = await seedSourceFrame();
    const original = path.join(root, 'products/zephyr-qx-100.md');
    if (mutation === 'moved-file') fs.renameSync(original, path.join(root, 'products/invented-new-home.md'));
    if (mutation === 'valid-crlf')
      fs.writeFileSync(original, fs.readFileSync(original, 'utf8').replaceAll('\n', '\r\n'));
    if (['moved-file', 'valid-crlf'].includes(mutation)) await memory.index({ verify: true });
    const recalled = await memory.recall({
      query: 'silverpine open question',
      memory_view: 'questions',
      expand: false,
      graph: false,
    });
    const result = recalled.results.find((entry) => entry.type === 'page')!;
    if (result.type !== 'page') throw new Error('missing invented page');
    const evidence: AnswerContextItem = {
      ...result,
      evidence_id: 'E1',
      lines: result.lines.filter((line) => line.memory?.status === 'qualified'),
    };
    expect(evidence.lines).toHaveLength(1);
    const db = new Database(path.join(stateDir, 'akno.db'));
    try {
      db.exec(`INSERT INTO retain_receipts(source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint, mode, result, created_at)
        SELECT 'invented-retraction', revision, request_hash, source_hash, source_group, 'eeeeeeeeeeee', 'retract', '{}', created_at FROM retain_receipts LIMIT 1;
        INSERT INTO changes(id, at, actor, op, summary) VALUES ('forgotten', '2026-01-01', 'user', 'forget', 'Invented retirement');`);
      const mutations: Record<string, string> = {
        moved: "UPDATE retain_supports SET slug = 'archive/invented-original-home'",
        missing: 'DELETE FROM retain_supports',
        retracted: "UPDATE retain_supports SET retracted_by = 'eeeeeeeeeeee'",
        forgotten: "UPDATE retain_supports SET forgotten_by = 'forgotten'",
        pruned: "UPDATE retain_supports SET evidence_pruned_at = '2026-01-01'",
        hash: "UPDATE retain_supports SET evidence_hash = 'invalid'",
        oversized: "UPDATE retain_supports SET evidence = printf('%1201s', 'x')",
        empty: "UPDATE retain_supports SET evidence = ''",
        candidate: "UPDATE retain_supports SET candidate_fingerprint = 'eeeeeeeeeeee'",
        proof: "UPDATE retain_supports SET proof_group = 'eeeeeeeeeeee'",
        receipt: "UPDATE retain_supports SET receipt_fingerprint = 'eeeeeeeeeeee'",
        identity: "UPDATE retain_supports SET memory_id = 'mem_different'",
        'provided-mode':
          "UPDATE retain_receipts SET mode = 'provided_exact' WHERE source_id = 'invented-source'",
        'source-hash': "UPDATE retain_supports SET input_hash = 'mismatched'",
      };
      if (mutations[mutation]) db.exec(mutations[mutation]);
      const file = path.join(root, `${result.slug}.md`);
      let content = fs.readFileSync(file, 'utf8');
      if (mutation === 'provided') content = content.replace('@extracted ', '@provided ');
      if (mutation === 'multiple')
        content = content.replace(
          '@extracted ',
          '@extracted,dddddddddddd@eeeeeeeeeeee@ffffffffffff@extracted ',
        );
      if (mutation === 'whitespace') content = content.replace('return delivery', 'return delivery ');
      if (mutation === 'line-endings') content = content.replaceAll('\n', '\r\n');
      if (mutation === 'stale-payload') content = content.replace('return delivery', 'sensor repair');
      if (mutation === 'stale-marker') content = content.replace('source-role=user', 'source-role=unknown');
      if (mutation === 'duplicate-id') write('products/duplicate.md', content);
      fs.writeFileSync(file, content);
      if (['provided', 'multiple', 'duplicate-id'].includes(mutation)) await memory.index({ verify: true });
      const frames = retentionSourceFrames(db, root, [evidence]);
      expect(frames.get('E1')).toBe(
        ['valid', 'valid-crlf', 'moved', 'moved-file'].includes(mutation) ? frame : undefined,
      );
    } finally {
      db.close();
    }
  });

  it('caps complete optional source frames in evidence order without clipping their qualification', async () => {
    await seedSourceFrame();
    const recalled = await memory.recall({
      query: 'silverpine open question',
      memory_view: 'questions',
      expand: false,
      graph: false,
    });
    const result = recalled.results.find((entry) => entry.type === 'page')!;
    if (result.type !== 'page') throw new Error('missing invented page');
    const evidence = Array.from({ length: 6 }, (_, i): AnswerContextItem => ({
      ...result,
      evidence_id: `E${i + 1}`,
      lines: result.lines.filter((line) => line.memory?.status === 'qualified'),
    }));
    const db = new Database(path.join(stateDir, 'akno.db'));
    try {
      const frame = 'An invented bounded quote. '.padEnd(1_200, 'x');
      db.prepare('UPDATE retain_supports SET evidence = ?, evidence_hash = ?').run(frame, sha256(frame));
      const frames = retentionSourceFrames(db, root, evidence);
      expect([...frames.keys()]).toEqual(['E1', 'E2', 'E3', 'E4']);
      expect([...frames.values()]).toEqual([frame, frame, frame, frame]);
    } finally {
      db.close();
    }
  });

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

  it.each([true, false])(
    'keeps unverified missing claims out of public notes (answer: %s)',
    async (hasAnswer) => {
      const fabricated = 'В источнике подтверждена бесплатная замена всех деталей.';
      await useAnswerModel({
        generation: {
          blocks: hasAnswer ? [{ text: 'The warranty lasts 5 years.', evidence_ids: ['E1'] }] : [],
          missing_concepts: [fabricated],
        },
        verification: { verdicts: [verdict('B1', true)] },
      });
      const result = await memory.answer({
        question: 'What does the silverpine warranty marker say?',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      AnswerOutput.parse(result);
      expect(result.outcome).toBe(hasAnswer ? 'partial' : 'not_answered');
      expect(result.note).toBe(
        hasAnswer
          ? 'memory evidence did not cover every requested detail'
          : 'memory evidence did not resolve every requested detail',
      );
      expect(result.answer).toBe(hasAnswer ? 'The warranty lasts 5 years. [products/zephyr-qx-100:3]' : null);
      expect(result.citations).toHaveLength(hasAnswer ? 1 : 0);
      expect(result.related_page_slugs).toContain('products/zephyr-qx-100');
      expect(JSON.stringify(result)).not.toContain(fabricated);
      expect(modelRequests).toHaveLength(hasAnswer ? 2 : 1);
    },
  );

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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      'tentative',
      'self_attested',
      'Ada Marlow tentatively believes that the silverpine warranty requires inspection.',
      'The silverpine warranty requires inspection for unsupported devices.',
      false,
      'discourse',
    ],
    [
      'tentative',
      'self_attested',
      'Ada Marlow is keeping competing, equally unsupported hypotheses about the silverpine warranty: a valve fault or a loose cable; neither is confirmed.',
      'Ada Marlow discussed a valve fault and a loose cable as competing, equally unsupported hypotheses about the silverpine warranty. Neither explanation is confirmed.',
      true,
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
      'The assistant recorded Bo Winters’s unverified report about silverpine inspection coverage.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      "The assistant recorded Bo Winters's tentative, unverified report about silverpine inspection coverage.",
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'Bo Winters’s unverified report concerns silverpine inspection coverage.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      "The assistant recorded a device's unverified report about silverpine inspection coverage.",
      false,
      'attribution',
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
      'semantic_support',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim from Bo Winters about silverpine inspection coverage.',
      'The assistant recorded the tentative, unverified report from Bo Winters about silverpine inspection coverage.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant recorded an unverified report from Bo Winters about silverpine valve inspection rather than replacement.',
      'Ассистент записал со слов Bo Winters неподтверждённое сообщение о проверке клапана silverpine, а не о его замене; подтверждения этому нет.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'The assistant tentatively suggested a silverpine inspection requirement; this remains unverified.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'The assistant gave a tentative, unverified report of a silverpine inspection requirement.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Ассистент сообщил непроверенный отчёт о требовании проверки silverpine.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'The assistant recorded, as a tentative unverified report, the silverpine inspection requirement.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'The assistant tentatively and as an unverified report interpreted that silverpine inspection is required.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Tentatively and as an unverified report, silverpine inspection is required.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Ассистент сообщил о возможном требовании проверки silverpine без проверки этого сообщения.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Предварительный непроверенный отчёт assistant: проверка silverpine включена.',
      true,
      'discourse',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Непроверенное сообщение ассистента о возможном требовании проверки silverpine.',
      true,
      'discourse',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Предварительный непроверенный отчёт об ассистенте: проверка silverpine включена.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Непроверенный отчёт об устройстве silverpine. Ассистент рядом.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Отчёт assistant: проверка silverpine включена.',
      false,
      'discourse',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Bo Winters reported a tentative unverified silverpine inspection requirement. The assistant is nearby.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Bo Winters сообщил предварительное непроверенное требование проверки silverpine. Ассистент рядом.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'The assistant stood nearby while Bo Winters reported a tentative unverified silverpine inspection requirement.',
      false,
      'attribution',
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified silverpine inspection requirement.',
      'Ассистент стоял рядом, а Bo Winters сообщил непроверенное предположение о проверке silverpine.',
      false,
      'attribution',
    ],
    [
      'counterfactual',
      'self_attested',
      'Ada Marlow described a counterfactual where silverpine valve repair would be covered, after rejecting the offer.',
      'Ada Marlow описала контрфактический вариант с покрытием ремонта клапана silverpine; она отклонила предложение, а не приняла его.',
      true,
    ],
    [
      'hypothetical',
      'self_attested',
      'Ada Marlow described a fictional silverpine example where Bo Winters is a participant rather than a real source.',
      'Ada Marlow обсуждала вымышленный пример silverpine, где Bo Winters — участник примера, а не реальный источник сообщения.',
      true,
    ],
    [
      'tentative',
      'source_report',
      'The assistant reported an unverified claim that silverpine inspection is included but valve replacement is not included.',
      'The assistant reported an unverified claim that silverpine inspection is not included.',
      false,
      'semantic_support',
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
        verification: { verdicts: [verdict('B1', rejectionReason !== 'semantic_support')] },
      });
      const result = await memory.answer({
        question: 'What was discussed about the silverpine warranty?',
        memory_view: 'all',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(result.reason_code).toBe(
        accepted
          ? 'answered'
          : rejectionReason === 'semantic_support'
            ? 'verification_rejected'
            : 'draft_rejected',
      );
      expect(result.validation).toMatchObject({
        generated_blocks: 1,
        passed_guards: accepted || rejectionReason === 'semantic_support' ? 1 : 0,
        verified_blocks: accepted ? 1 : rejectionReason === 'semantic_support' ? 0 : null,
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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

  it.each([
    [
      'The open question concerns silverpine return delivery. It remains unresolved whether the warranty covers delivery, the warranty excludes repairs.',
      false,
    ],
    [
      'The open question concerns silverpine return delivery. It remains unresolved whether the warranty covers or excludes that delivery.',
      true,
    ],
    [
      'The open question is about silverpine return delivery. It is unknown whether the warranty covers or excludes it.',
      true,
    ],
    [
      'It remains unresolved whether the silverpine warranty covers delivery. The warranty excludes delivery.',
      false,
    ],
    [
      'It remains unresolved whether the silverpine warranty covers delivery, but it excludes repairs.',
      false,
    ],
    ['It remains unresolved whether the silverpine warranty covers delivery; it excludes repairs.', false],
    ['It remains unresolved whether the silverpine warranty covers delivery and it excludes repairs.', false],
    [
      'The open question is whether the silverpine warranty includes return delivery. Whether that delivery is covered or excluded has not been established.',
      true,
    ],
    [
      'Открытый вопрос о доставке silverpine: остаётся неустановленным, предусматривает ли гарантия доставку или исключает её.',
      true,
    ],
    [
      'Открытый вопрос о доставке silverpine: не установлено, включает ли гарантия доставку или исключает её.',
      true,
    ],
    [
      'The open question is whether silverpine delivery is covered or excluded has not been established. The warranty excludes delivery.',
      false,
    ],
    [
      'Whether silverpine delivery is covered or excluded has not been established, but the warranty excludes delivery. The question remains open.',
      false,
    ],
    [
      'The open question is whether the silverpine warranty covers delivery, but the warranty excludes repairs has not been established.',
      false,
    ],
    [
      'Открытый вопрос silverpine: остаётся неустановленным, покрыта ли доставка или исключена. Гарантия исключает доставку.',
      false,
    ],
    [
      'Открытый вопрос silverpine: остаётся неустановленным, покрыта ли доставка, но гарантия исключает ремонт.',
      false,
    ],
    [
      'Открытый вопрос silverpine: не установлено, включает ли гарантия доставку, а ремонт она исключает.',
      false,
    ],
  ] as const)(
    'separates unresolved question alternatives from asserted exclusions: %s',
    async (text, accepted) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\n<!-- akno:item mem_scoped_question v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=question subject=unresolved source-role=user reports=0 commitment=none disposition=active polarity=affirmed basis=self_attested -->\n- **Open question:** The open question is whether the silverpine warranty includes return delivery; neither coverage nor exclusion is established.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', true)] },
      });
      const result = await memory.answer({
        question: 'Which open silverpine question remains?',
        memory_view: 'questions',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(modelRequests).toHaveLength(accepted ? 2 : 1);
      if (!accepted) expect(result.validation?.rejection_counts).toEqual({ protected_value: 1 });
    },
  );

  it.each([true, false])(
    'does not split an unresolved question at a conjunction inside a word: %s',
    async (supported) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\n<!-- akno:item mem_command v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=question subject=unresolved source-role=user reports=0 commitment=none disposition=active polarity=affirmed basis=self_attested -->\n- **Open question:** The open question is whether the silverpine command includes telemetry; the answer remains unknown.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: {
          blocks: [
            {
              text: 'The open question concerns the silverpine command. It remains unresolved whether the command includes or does not include telemetry.',
              evidence_ids: ['E1'],
            },
          ],
          missing_concepts: [],
        },
        verification: { verdicts: [verdict('B1', supported)] },
      });
      const result = await memory.answer({
        question: 'Which open silverpine question remains?',
        memory_view: 'questions',
        expand: false,
        graph: false,
      });
      expect(modelRequests).toHaveLength(2);
      expect(result.answer !== null).toBe(supported);
    },
  );

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
        verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
        verification: { verdicts: [verdict('B1', true)] },
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

  it.each([
    ['The original source does not mention silverpine valve repair.', false],
    ['The original record says nothing about silverpine valve repair.', false],
    ['The source contains no information about silverpine valve repair.', false],
    ['Silverpine valve repair is not stated in the original source.', false],
    ['Silverpine valve repair was not described in the original note.', false],
    ['Исходная запись не описывает ремонт клапана silverpine.', false],
    ['The silverpine agreement says nothing about electrical faults.', true],
    ['The original note does not mention silverpine electrical faults.', true],
    ['The silverpine return-shipping question remains unanswered.', true],
  ] as const)('does not infer whole-source absence from retrieved evidence: %s', async (text, explicit) => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n' + (explicit ? text : 'The silverpine warranty covers inspection.') + '\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'What silverpine details are recorded?',
      filter: { source: 'page' },
      memory_view: 'all',
      expand: false,
      graph: false,
    });
    expect(result.answer === null, JSON.stringify(result)).toBe(!explicit);
    expect(modelRequests).toHaveLength(explicit ? 2 : 1);
    if (!explicit) expect(result.validation?.rejection_counts).toEqual({ discourse: 1 });
  });

  it.each([
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт assistant касается проверки silverpine.',
      accepted: false,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента касается проверки silverpine.',
      accepted: true,
    },
    {
      language: 'en',
      text: 'According to ассистент, the silverpine inspection requirement is unverified.',
      accepted: false,
    },
    {
      language: 'en',
      text: 'According to the assistant, the silverpine inspection requirement is unverified.',
      accepted: true,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт Assistant Meridian касается проверки silverpine.',
      speaker: 'Assistant Meridian',
      accepted: true,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента содержит точную цитату «assistant reported a silverpine requirement».',
      accepted: true,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента содержит точный код `assistant reported a silverpine requirement`.',
      accepted: true,
    },
    {
      language: 'ru',
      text: 'По словам «assistant», требование проверки silverpine остаётся неподтверждённым.',
      accepted: false,
    },
    {
      language: 'ru',
      text: 'По словам `assistant`, требование проверки silverpine остаётся неподтверждённым.',
      accepted: false,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента содержит точный термин `assistant`.',
      accepted: true,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента содержит идентификатор assistant_helper.',
      accepted: true,
    },
    {
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента содержит цитату «assistant reported an invented shipment».',
      accepted: false,
    },
    {
      text: 'Предварительный неподтверждённый отчёт assistant касается проверки silverpine.',
      accepted: true,
    },
    {
      knowledgeLanguage: 'en',
      text: 'According to ассистент, the silverpine inspection requirement is unverified.',
      accepted: false,
    },
    {
      knowledgeLanguage: 'en',
      language: 'ru',
      text: 'Предварительный неподтверждённый отчёт ассистента касается проверки silverpine.',
      accepted: true,
    },
  ] as const)(
    'enforces localized generic attribution while preserving exact references: $text',
    async (entry) => {
      const speaker = 'speaker' in entry ? entry.speaker : 'assistant';
      write(
        'products/zephyr-qx-100.md',
        `# Zephyr QX-100\n\n<!-- akno:item mem_role_language v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=assistant speaker=${encodeURIComponent(speaker)} reports=0 commitment=tentative disposition=active polarity=affirmed basis=source_report -->\n- **Reported by ${speaker} · Tentative:** ${speaker} gave an unverified silverpine inspection report containing the exact phrase "assistant reported a silverpine requirement" and identifier assistant_helper.\n`,
      );
      await memory.index({ verify: true });
      // Deliberately approve the model language check: this regression covers the independent floor.
      await useAnswerModel({
        generation: { blocks: [{ text: entry.text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', true)] },
        ...('knowledgeLanguage' in entry ? { knowledgeLanguage: entry.knowledgeLanguage } : {}),
      });
      const language = 'language' in entry ? entry.language : undefined;
      const result = await memory.answer({
        question: 'What silverpine report did the assistant give?',
        ...(language ? { answer_language: language } : {}),
        memory_view: 'reports',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(entry.accepted);
      const verifications = modelRequests.filter((body) =>
        (body.messages as Array<{ role: string; content: string }>).some(
          (message) => message.role === 'system' && message.content.includes('independently verify'),
        ),
      );
      expect(verifications).toHaveLength(entry.accepted ? 1 : 0);
      if (!entry.accepted) expect(result.validation?.rejection_counts).toEqual({ language: 1 });
    },
  );

  it.each([
    [
      'The assistant relayed an unverified report that Bo Winters declined the silverpine offer.',
      'The assistant recorded that Bo Winters rejected the silverpine offer; the report remains unverified.',
    ],
    [
      'The assistant relayed an unverified report that Bo Winters made no arrangement for silverpine shipment.',
      'The assistant recorded that Bo Winters did not arrange silverpine shipment; the report remains unverified.',
    ],
    [
      'The assistant relayed an unverified report that a silverpine inspection hypothesis is not confirmed.',
      'The assistant recorded that the silverpine inspection hypothesis remains unconfirmed.',
    ],
  ])('admits a bounded finite report complement: %s', async (source, text) => {
    write(
      'products/zephyr-qx-100.md',
      `# Zephyr QX-100\n\n<!-- akno:item mem_complement v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=assistant speaker=assistant reports=0 commitment=tentative disposition=active polarity=affirmed basis=source_report -->\n- **Reported by assistant · Tentative:** ${source}\n`,
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'What silverpine report did the assistant give?',
      memory_view: 'reports',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer, JSON.stringify(result)).not.toBeNull();
    expect(modelRequests).toHaveLength(2);
  });

  it.each([
    [
      'The assistant gave a tentative, preliminary, and unverified report of a silverpine inspection requirement.',
      true,
    ],
    [
      'The assistant tentatively and without verification reported a silverpine inspection requirement.',
      true,
    ],
    ['Ассистент предварительно и непроверенно сообщил о требовании проверки silverpine.', true],
    ['The assistant tentatively and unconfirmedly reported a silverpine inspection requirement.', true],
    ['The assistant tentatively and unverifiedly reported a silverpine inspection requirement.', true],
    [
      'The assistant tentatively and provisionally reported an unverified silverpine inspection requirement.',
      true,
    ],
    [
      'The assistant cautiously and tentatively reported an unverified silverpine inspection requirement.',
      true,
    ],
    [
      'The assistant allegedly never reported a tentative unverified silverpine inspection requirement.',
      false,
    ],
    [
      'The assistant provisionally gave a device to Bo Winters, who reported an unverified silverpine inspection requirement.',
      false,
    ],
    ['The assistant Family tentatively reported an unverified silverpine inspection requirement.', false],
    ['The assistant family tentatively reported an unverified silverpine inspection requirement.', false],
    ['The assistant assembly tentatively reported an unverified silverpine inspection requirement.', false],
    ['The assistant friendly tentatively reported an unverified silverpine inspection requirement.', false],
    [
      'Bo Winters tentatively and provisionally reported an unverified silverpine inspection requirement while the assistant stood nearby.',
      false,
    ],
    [
      'The assistant stood nearby while Bo Winters tentatively and unverifiedly reported a silverpine inspection requirement.',
      false,
    ],
    ['Ассистент предварительно и неподтверждённо сообщил о требовании проверки silverpine.', true],
    ['По предварительному сообщению ассистента, проверка silverpine может требоваться.', true],
    ['По неподтверждённому сообщению ассистента, проверка silverpine может требоваться.', true],
    ['По непроверенному сообщению ассистента: проверка silverpine может требоваться.', true],
    [
      'По предварительному сообщению ассистента, проверка silverpine может требоваться. Ассистент не изучал условия и не подтвердил сообщение.',
      true,
    ],
    [
      'По предварительному сообщению Bo Winters, проверка silverpine может требоваться. Ассистент стоял рядом.',
      false,
    ],
    [
      'Bo Winters изучал предварительное сообщение. Ассистент стоял рядом; проверка silverpine может требоваться.',
      false,
    ],
    ['По предварительному сообщению. Ассистент стоял рядом; проверка silverpine может требоваться.', false],
    ['По предварительному сообщению ассистента. Проверка silverpine может требоваться.', false],

    [
      'The assistant stood nearby while Bo Winters tentatively and unconfirmedly reported a silverpine inspection requirement.',
      false,
    ],
    [
      'Ассистент стоял рядом, а Bo Winters предварительно и неподтверждённо сообщил о требовании проверки silverpine.',
      false,
    ],
    ['The assistant provided an unverified report that silverpine inspection might be required.', true],
    ["The assistant's preliminary, tentative and unverified report concerns silverpine inspection.", true],
    [
      'The assistant gave a device to Bo Winters, who reported an unverified silverpine inspection requirement.',
      false,
    ],
    [
      'The assistant provided an unverified device; Bo Winters reported a silverpine inspection requirement.',
      false,
    ],
    ['Bo Winters described the assistant in an unverified report about silverpine inspection.', false],
    [
      'The assistant recorded that device. An unverified report exists. The silverpine warranty covers inspection.',
      false,
    ],
    [
      'The assistant recorded that device while Bo Winters reported an unverified silverpine inspection requirement.',
      false,
    ],
  ] as const)('binds qualified report wording to its actual outer source: %s', async (text, accepted) => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_adverbs v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=assistant speaker=assistant reports=0 commitment=tentative disposition=active polarity=affirmed basis=source_report -->\n- **Reported by assistant · Tentative:** The assistant reported an unverified silverpine inspection requirement.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'What silverpine report did the assistant give?',
      memory_view: 'reports',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
    expect(modelRequests).toHaveLength(accepted ? 2 : 1);
    if (!accepted) expect(result.validation?.rejection_counts).toEqual({ attribution: 1 });
  });

  it.each([
    [
      'Ada Marlow обсуждала две пока не доказанные гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      true,
    ],
    [
      'Ada Marlow обсуждала две недоказанные гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      true,
    ],
    [
      'Ada Marlow обсуждала версии silverpine: ослабленный клапан и изношенный кабель. Эти версии пока не доказаны.',
      true,
    ],
    ['Ada Marlow considered two unproven hypotheses about silverpine: a loose valve and a worn cable.', true],
    [
      'Ada Marlow considered silverpine hypotheses of a loose valve and a worn cable; the hypotheses are not yet proven.',
      true,
    ],
    [
      'Ada Marlow обсуждала две доказанные гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      false,
    ],
    [
      'Ada Marlow обсуждала две вполне доказанные гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      false,
    ],
    [
      'Ada Marlow обсуждала не только доказанные гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      false,
    ],
    [
      'Ada Marlow обсуждала гипотезы silverpine: ослабленный клапан и изношенный кабель. Получение устройства не доказано.',
      false,
    ],
    [
      'Ada Marlow discussed silverpine hypotheses of a loose valve and a worn cable. The delivery is unproven.',
      false,
    ],
    [
      'Ada Marlow обсуждала две не подтверждённые гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      true,
    ],
    [
      'Ada Marlow considered two competing preliminary hypotheses about silverpine: a loose valve and a worn cable. Neither had supporting evidence.',
      true,
    ],
    [
      'Ada Marlow обсуждала две версии silverpine: ослабленный клапан и изношенный кабель. Эти версии пока не подтверждены.',
      true,
    ],
    [
      'Ada Marlow обсуждала две подтверждённые гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      false,
    ],
    [
      'Ada Marlow обсуждала не только подтверждённые гипотезы silverpine: ослабленный клапан и изношенный кабель.',
      false,
    ],
    [
      'Ada Marlow обсуждала гипотезы silverpine: ослабленный клапан и изношенный кабель. Она не подтверждает получение устройства.',
      false,
    ],
    [
      'Ada Marlow обсуждала гипотезы silverpine: ослабленный клапан и изношенный кабель. Получение устройства не подтверждено.',
      false,
    ],
    [
      'Ada Marlow used a preliminary silverpine inspection to establish a loose valve and a worn cable as causes.',
      false,
    ],
    [
      'Ada Marlow described the silverpine hypotheses of a loose valve and a worn cable; the hypotheses remain preliminary.',
      true,
    ],
  ] as const)('keeps uncertainty attached to a qualified explanation: %s', async (text, accepted) => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_spaced v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=tentative disposition=active polarity=affirmed basis=self_attested -->\n- **Tentative:** Ada Marlow recorded two unconfirmed silverpine explanations: a loose valve and a worn cable; neither has evidence or is established.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'Which silverpine hypotheses did Ada Marlow discuss?',
      memory_view: 'discussion',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
    expect(modelRequests).toHaveLength(accepted ? 2 : 1);
    if (!accepted) expect(result.validation?.rejection_counts).toEqual({ discourse: 1 });
  });

  it('still rejects a semantically unsupported unproven-hypothesis draft after the grammar floor', async () => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_unproven v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=tentative disposition=active polarity=affirmed basis=self_attested -->\n- **Tentative:** Ada Marlow considers two unconfirmed silverpine explanations: a loose valve and a worn cable.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow рассматривает две пока не доказанные гипотезы silverpine: сломанный клапан и сгоревший кабель.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [verdict('B1', false)] },
    });
    const result = await memory.answer({
      question: 'Which silverpine hypotheses did Ada Marlow consider?',
      memory_view: 'discussion',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer).toBeNull();
    expect(result.reason_code).toBe('verification_rejected');
    expect(result.validation?.rejection_counts).toEqual({ semantic_support: 1 });
    expect(modelRequests).toHaveLength(2);
  });

  it.each([
    ['Запись не определяет, покрывается ли ремонтом по гарантии ремонт двигателя silverpine.', false, true],
    ['Запись не определяет, покрывается ли гарантией ремонт двигателя silverpine.', true, true],
    ['Запись не определяет, покрывается ли гарантией ремонт двигателя silverpine.', false, false],
  ] as const)(
    'checks covered-repair roles before mandatory semantic verification: %s',
    async (text, accepted, semanticSupport) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\nThe record does not settle whether silverpine motor repair is covered by the warranty.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', semanticSupport)] },
      });
      const result = await memory.answer({
        question: 'Is silverpine motor repair covered?',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(modelRequests).toHaveLength(accepted || !semanticSupport ? 2 : 1);
      if (!accepted) expect(result.validation?.rejection_counts).toEqual({ semantic_support: 1 });
    },
  );

  it.each([
    ['Ada Marlow has not chosen a cause.', true],
    ['She has not chosen a cause.', true],
    ['No cause has been chosen by Ada Marlow.', true],
    ['No cause has been chosen by her.', true],
    ['No cause has been chosen by anyone.', false],
    ['No cause has been chosen by us.', false],
    ['No cause has been chosen by them.', false],
    ['No cause has been chosen by Ada Marlow and Bo Winters.', false],
    ['No cause has been chosen by her and Bo Winters.', false],
    ['No cause has been chosen by Ada Marlow, Bo Winters.', false],
    ['No cause has been chosen.', false],
    ['A cause has not yet been selected.', false],
    ['Neither explanation has been selected.', false],
    ['Neither explanation selected.', false],
    ['Neither explanation has been selected by Ada Marlow.', true],
    ['Ни одна не выбрана.', false],
    ['Ни одна не выбрана Ada Marlow.', true],
    ['Ada Marlow has not chosen a cause. No cause has been chosen.', false],
    ['Причину она не выбрала.', true],
    ['Она не выбрала причину.', true],
    ['Причина не выбрана Ada Marlow.', true],
    ['Причина не выбрана ею.', true],
    ['Причина не выбрана никем.', false],
    ['Причина не выбрана нами.', false],
    ['Причина не выбрана ими.', false],
    ['Причина не выбрана Ada Marlow и Bo Winters.', false],
    ['Причина не выбрана ею и Bo Winters.', false],
    ['Причина не выбрана.', false],
    ['Причина пока не выбрана.', false],
    ['Причину ещё не выбрали.', false],
    ['По её словам, причину ещё не выбрали.', false],
    ['Причину она не выбрала. Причину ещё не выбрали.', false],
  ] as const)(
    'keeps personal cause nonselection from becoming an unassigned state: %s',
    async (choice, accepted) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\n<!-- akno:item mem_choice_agency v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=tentative disposition=active polarity=affirmed basis=self_attested -->\n- **Tentative:** Ada Marlow considers two tentative silverpine hypotheses, a loose valve and a worn cable, and has not chosen a cause.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: {
          blocks: [
            {
              text: `Ada Marlow considers two tentative silverpine hypotheses, a loose valve and a worn cable. ${choice}`,
              evidence_ids: ['E1'],
            },
          ],
          missing_concepts: [],
        },
        verification: { verdicts: [verdict('B1', true)] },
      });
      const result = await memory.answer({
        question: 'Which tentative silverpine hypotheses did Ada Marlow consider?',
        memory_view: 'discussion',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(modelRequests).toHaveLength(accepted ? 2 : 1);
      if (!accepted) expect(result.validation?.rejection_counts).toEqual({ attribution: 1 });
    },
  );

  it.each([
    ['According to Ada Marlow, the proposal was to review the silverpine warranty exceptions.', false, true],
    ['По словам Ada Marlow, было предложено проверить исключения из гарантии silverpine.', false, true],
    ['Ada Marlow proposed reviewing the silverpine warranty exceptions.', true, true],
    ['Ada Marlow предложила проверить исключения из гарантии silverpine.', true, true],
    ['Ada Marlow proposed reviewing the silverpine warranty exceptions.', false, false],
  ] as const)(
    'requires proposer agency before still-mandatory semantic verification: %s',
    async (text, accepted, semanticSupport) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\n<!-- akno:item mem_proposal_agency v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=plan subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=asserted disposition=proposed polarity=affirmed basis=self_attested -->\n- **Proposal:** Ada Marlow proposed reviewing the silverpine warranty exceptions; the proposal remains unaccepted.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', semanticSupport)] },
      });
      const result = await memory.answer({
        question: 'Which silverpine warranty proposal did Ada Marlow make?',
        memory_view: 'planning',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(modelRequests).toHaveLength(accepted || !semanticSupport ? 2 : 1);
      if (!accepted && semanticSupport)
        expect(result.validation?.rejection_counts).toEqual({ attribution: 1 });
    },
  );

  it.each(['assistant', 'Assistant Meridian'])(
    'projects generic display labels without changing source names or verifier evidence: %s',
    async (speaker) => {
      write(
        'products/zephyr-qx-100.md',
        `# Zephyr QX-100\n\n<!-- akno:item mem_display v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=assistant speaker=${encodeURIComponent(speaker)} reports=0 commitment=tentative disposition=active polarity=affirmed basis=source_report -->\n- **Reported by ${speaker} · Tentative:** ${speaker} reported an unverified silverpine inspection requirement for Zephyr QX-100.\n`,
      );
      await memory.index({ verify: true });
      const label = speaker === 'assistant' ? 'ассистента' : speaker;
      await useAnswerModel({
        generation: {
          blocks: [
            {
              text: `Предварительный неподтверждённый отчёт ${label} касается проверки Zephyr QX-100.`,
              evidence_ids: ['E1'],
            },
          ],
          missing_concepts: [],
        },
        verification: { verdicts: [verdict('B1', true)] },
      });
      const result = await memory.answer({
        question: 'What silverpine report did the assistant give?',
        answer_language: 'ru',
        memory_view: 'reports',
        include_context: true,
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer).not.toBeNull();
      const userInput = (request: Record<string, unknown>) =>
        JSON.parse(
          (request.messages as Array<{ role: string; content: string }>).find(
            (message) => message.role === 'user',
          )!.content,
        );
      const generation = userInput(modelRequests[0]!);
      const excerpt = generation.evidence[0].excerpt as string;
      const qualification = JSON.parse(excerpt.match(/Memory qualification: (.+)/u)![1]!);
      expect(qualification.source_role).toBe('assistant');
      expect(qualification).toMatchObject({
        kind: 'claim',
        commitment: 'tentative',
        disposition: 'active',
        display_labels: {
          kind: 'утверждение',
          commitment: 'предварительный статус',
          disposition: 'активная запись',
        },
      });
      if (speaker === 'assistant') {
        expect(qualification).not.toHaveProperty('source_speaker');
        expect(qualification.source_label).toBe('ассистент');
      } else {
        expect(qualification.source_speaker).toBe(speaker);
        expect(qualification).not.toHaveProperty('source_label');
      }
      expect(excerpt).toContain(`${speaker} reported an unverified`);
      const language = userInput(modelRequests[1]!);
      expect(language.supplied_references).toContainEqual({ kind: 'title', text: 'Zephyr QX-100' });
      expect(language.supplied_references).not.toContainEqual({ kind: 'name', text: 'assistant' });
      if (speaker !== 'assistant')
        expect(language.supplied_references).toContainEqual({ kind: 'name', text: speaker });
      expect(JSON.stringify(userInput(modelRequests[2]!))).toContain(`"source_speaker":"${speaker}"`);
      expect(JSON.stringify(result.context)).toContain(`"source_speaker":"${speaker}"`);
      expect(JSON.stringify(userInput(modelRequests[2]!))).not.toContain('display_labels');
      expect(JSON.stringify(result.context)).not.toContain('display_labels');
    },
  );

  it('presents a tentative plan without changing its kind to an assumption', async () => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_plan_display v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=plan subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=tentative disposition=proposed polarity=affirmed basis=self_attested -->\n- **Tentative · Proposal:** Ada Marlow tentatively proposed a silverpine inspection; the plan has not been accepted.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow предварительно предложила проверку silverpine; план не принят.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'Which silverpine plan was proposed?',
      answer_language: 'ru',
      memory_view: 'discussion',
      include_context: true,
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer, JSON.stringify(result)).not.toBeNull();
    const generation = JSON.parse(
      (modelRequests[0]!.messages as Array<{ role: string; content: string }>).find((m) => m.role === 'user')!
        .content,
    );
    const qualification = JSON.parse(generation.evidence[0].excerpt.match(/Memory qualification: (.+)/u)[1]);
    expect(qualification).toMatchObject({
      kind: 'plan',
      commitment: 'tentative',
      disposition: 'proposed',
      display_labels: { kind: 'план', commitment: 'предварительный статус', disposition: 'предложено' },
    });
    expect(JSON.stringify(modelRequests[2])).not.toContain('display_labels');
    expect(JSON.stringify(result.context)).not.toContain('display_labels');
    expect(JSON.stringify(result.context)).toContain('"kind":"plan"');
  });

  it('localizes tentative timing separately from asserted proposal commitment', async () => {
    const marker = temporalMarker('mem_time_display', {
      kind: 'plan',
      speaker: 'Ada Marlow',
      disposition: 'proposed',
      time: { relation: 'scheduled', status: 'tentative', precision: 'unknown' },
    });
    write(
      'memory/silverpine.md',
      '# Silverpine inspection\n\n' +
        managedMemoryBlock(
          marker,
          renderManagedMemoryPayload(
            'Ada Marlow proposes a silverpine inspection with tentative timing; no calendar date is known and no plan is accepted.',
            marker,
          ),
        ),
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow предлагает проверку silverpine с предварительным сроком; календарная дата неизвестна, план не принят.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'What silverpine inspection is proposed?',
      answer_language: 'ru',
      memory_view: 'planning',
      include_context: true,
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer, JSON.stringify(result)).not.toBeNull();
    const input = (index: number) =>
      JSON.parse(
        (modelRequests[index]!.messages as Array<{ role: string; content: string }>).find(
          (m) => m.role === 'user',
        )!.content,
      );
    const qualification = JSON.parse(input(0).evidence[0].excerpt.match(/Memory qualification: (.+)/u)[1]);
    expect(qualification).toMatchObject({
      commitment: 'asserted',
      disposition: 'proposed',
      temporal: { time: { status: 'tentative', precision: 'unknown' } },
      display_labels: {
        commitment: 'заявлено',
        disposition: 'предложено',
        temporal_status: 'предварительный срок',
      },
    });
    for (const original of [input(2), result.context]) {
      expect(JSON.stringify(original)).not.toContain('display_labels');
      expect(JSON.stringify(original)).toContain('tentative');
      expect(JSON.stringify(original)).toContain('asserted');
    }
  });

  it.each([
    [
      'Неподтверждённое сообщение, переданное Ada Marlow со слов Bo Winters, касается проверки silverpine.',
      true,
    ],
    ['Неподтверждённый отчёт переданный Ada Marlow касается проверки silverpine.', true],
    ['Неподтверждённое утверждение, переданное Ada Marlow, касается проверки silverpine.', true],
    [
      'Неподтверждённое сообщение, переданное для Ada Marlow со слов Bo Winters, касается проверки silverpine.',
      false,
    ],
    [
      'Неподтверждённое сообщение, переданное Bo Winters, касается проверки silverpine; Ada Marlow находится рядом.',
      false,
    ],
    [
      'Устройство, переданное Ada Marlow, касается проверки silverpine; Bo Winters сообщил неподтверждённые сведения.',
      false,
    ],
    ['Неподтверждённое сообщение о переданном Ada Marlow устройстве касается проверки silverpine.', false],
    ['Неподтверждённое сообщение, переданное Ada Marlow’s device, касается проверки silverpine.', false],
    ['Ada Marlow relayed Bo Winters’s unverified assertion about silverpine inspection.', true],
    ['Ada Marlow relays Bo Winters’s unverified assertion about silverpine inspection.', true],
    ['Ada Marlow is relaying Bo Winters’s unverified assertion about silverpine inspection.', true],
    ['Ada Marlow relayed an unverified report about silverpine inspection.', true],
    ['The unverified report attributed to Ada Marlow concerns silverpine inspection.', true],
    ['Ada Marlow’s unverified assertion concerns silverpine inspection.', true],
    [
      'Ada Marlow relayed a device to Bo Winters, who stated an unverified silverpine inspection requirement.',
      false,
    ],
    [
      'Ada Marlow is relaying a device; Bo Winters has an unverified assertion about silverpine inspection.',
      false,
    ],
    ['Bo Winters relayed an unverified silverpine inspection report while Ada Marlow stood nearby.', false],
    [
      'The unverified report attributed to Bo Winters concerns silverpine inspection; Ada Marlow stood nearby.',
      false,
    ],
    ['The unverified report attributed to Ada Marlow’s device concerns silverpine inspection.', false],
    [
      'The unverified report attributed to Bo Winters’ device concerns silverpine inspection.',
      false,
      'Bo Winters',
    ],
    [
      "The unverified report attributed to Bo Winters' device concerns silverpine inspection.",
      false,
      'Bo Winters',
    ],
    ['The unverified report attributed to Bo Winters concerns silverpine inspection.', true, 'Bo Winters'],
  ] as const)(
    'binds relay and attributed-assertion constructions to the reporter: %s',
    async (text, accepted, speaker = 'Ada Marlow') => {
      write(
        'products/zephyr-qx-100.md',
        `# Zephyr QX-100\n\n<!-- akno:item mem_relay v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user speaker=${encodeURIComponent(speaker)} reports=0 commitment=asserted disposition=active polarity=affirmed basis=source_report -->\n- **Reported by ${speaker}:** ${speaker} relayed ${speaker === 'Ada Marlow' ? 'Bo Winters' : 'Ada Marlow'}’s unverified assertion about silverpine inspection.\n`,
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', true)] },
      });
      const result = await memory.answer({
        question: `What silverpine report did ${speaker} relay?`,
        memory_view: 'reports',
        filter: { source: 'page' },
        expand: false,
        graph: false,
      });
      expect(result.answer !== null, JSON.stringify(result)).toBe(accepted);
      expect(modelRequests).toHaveLength(accepted ? 2 : 1);
      if (!accepted) expect(result.validation?.rejection_counts).toEqual({ attribution: 1 });
    },
  );

  it('keeps internal user-provenance labels in verification and public evidence, outside generation', async () => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_direct v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=asserted disposition=active polarity=negated basis=self_attested -->\n- Ada Marlow states that the silverpine warranty excludes paint damage.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: 'Ada Marlow states that the silverpine warranty excludes paint damage.',
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'Does the silverpine warranty cover paint damage?',
      include_context: true,
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer).not.toBeNull();
    expect(JSON.stringify(modelRequests[0])).not.toContain('self_attested');
    expect(JSON.stringify(modelRequests[0])).toContain('source_speaker');
    expect(JSON.stringify(modelRequests[1])).toContain('self_attested');
    expect(JSON.stringify(result.context)).toContain('self_attested');
  });

  it('removes a block whose invented exact value does not occur in its citation', async () => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts 8 years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [verdict('B1', true)] },
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

  it('does not use recorded-question wording to bypass a wrong-recorder verdict', async () => {
    write(
      'products/zephyr-qx-100.md',
      '# Zephyr QX-100\n\n<!-- akno:item mem_question v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=question subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=none disposition=active polarity=affirmed basis=self_attested -->\n- **Open question:** Ada Marlow has an unanswered question about silverpine warranty coverage.\n',
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: {
        blocks: [
          {
            text: "Bo Winters recorded Ada Marlow's open question about silverpine warranty coverage.",
            evidence_ids: ['E1'],
          },
        ],
        missing_concepts: [],
      },
      verification: { verdicts: [verdict('B1', true, false, true)] },
    });
    const result = await memory.answer({
      question: 'Which silverpine coverage question remains open?',
      memory_view: 'questions',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });
    expect(result.answer).toBeNull();
    expect(result.validation).toMatchObject({
      passed_guards: 1,
      verified_blocks: 0,
      rejection_counts: { semantic_support: 1 },
    });
    expect(modelRequests).toHaveLength(2);
  });

  it('verifies a maximum answer batch once per block and sums all call usage', async () => {
    const seen: string[] = [];
    await useAnswerModel({
      generation: {
        blocks: Array.from({ length: 12 }, () => ({
          text: 'The warranty lasts five years.',
          evidence_ids: ['E1'],
        })),
        missing_concepts: [],
      },
      verification: (body: { messages: { content: string }[] }) => {
        const { blocks } = JSON.parse(body.messages.at(-1)!.content);
        expect(blocks).toHaveLength(1);
        const id = blocks[0].block_id;
        seen.push(id);
        return { verdicts: [verdict(id, id !== 'B1')] };
      },
    });
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      expand: false,
      graph: false,
    });
    expect(seen).toEqual(Array.from({ length: 12 }, (_, index) => `B${index + 1}`));
    expect(modelRequests).toHaveLength(13);
    expect(result.validation).toMatchObject({ generated_blocks: 12, verified_blocks: 11 });
    expect(result.model_usage?.verification).toMatchObject({
      input_tokens: 222 * 12,
      output_tokens: 33 * 12,
      total_tokens: 255 * 12,
    });
    expect(result.degraded).not.toContain('answer_verification_failed');
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
      verification: (body: { messages: { content: string }[] }) => {
        const { blocks } = JSON.parse(body.messages.at(-1)!.content);
        return {
          verdicts: blocks.map((block: { block_id: string }) =>
            verdict(block.block_id, block.block_id === 'B1'),
          ),
        };
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

  it.each([
    ['Silverpine terms allow transport for valve inspection.', true],
    ['Silverpine terms allow transport of the valve.', false],
    ['Условия silverpine допускают перевозку для проверки клапана.', true],
    ['Условия silverpine допускают перевозку клапана.', false],
    ['Silverpine terms allow data collection for valve inspection.', false],
  ] as const)(
    'requires action-role verification independently of topic and qualification: %s',
    async (text, rolesPreserved) => {
      write(
        'products/zephyr-qx-100.md',
        '# Zephyr QX-100\n\nSilverpine terms allow transport for valve inspection.\n',
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', true, rolesPreserved, true)] },
      });
      const result = await memory.answer({
        question: 'What do the silverpine terms allow?',
        expand: false,
        graph: false,
      });
      expect(result.reason_code).toBe(rolesPreserved ? 'answered' : 'verification_rejected');
      expect(modelRequests).toHaveLength(2);
      if (!rolesPreserved) {
        expect(result.answer).toBeNull();
        expect(result.validation?.rejection_counts).toEqual({ semantic_support: 1 });
      }
    },
  );

  it.each([
    verdict('B1', true, true, false),
    { block_id: 'B1', proposition_supported: true, qualification_scope_preserved: true },
    { block_id: 'B1', supported: true },
    { ...verdict('B1', true), comparison: undefined },
    { ...verdict('B1', false), mismatches: [] },
    { ...verdict('B1', true), mismatches: semanticAudit(false).mismatches },
  ])('never accepts a negative or missing verification dimension: %j', async (decision) => {
    await useAnswerModel({
      generation: {
        blocks: [{ text: 'The warranty lasts five years.', evidence_ids: ['E1'] }],
        missing_concepts: [],
      },
      verification: { verdicts: [decision] },
    });
    const result = await memory.answer({
      question: 'How long is the silverpine warranty?',
      expand: false,
      graph: false,
    });
    expect(result.answer).toBeNull();
    expect(modelRequests).toHaveLength(2);
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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
      verification: { verdicts: [verdict('B1', true)] },
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

  it.each([
    ['rejected', 'Ada Marlow rejected the offer to inspect the silverpine valve.', true],
    ['rejected', 'Ada Marlow did not accept the offer to inspect the silverpine valve.', true],
    ['rejected', 'Ada Marlow did not choose the silverpine valve inspection.', true],
    ['rejected', 'Ada Marlow did not enroll in the silverpine valve inspection.', true],
    ['rejected', 'Ada Marlow отказалась от проверки клапана silverpine.', true],
    ['rejected', 'Ada Marlow has not yet chosen a silverpine valve inspection.', false],
    ['rejected', 'Ada Marlow не приняла предложение проверить клапан silverpine.', true],
    ['rejected', 'Ada Marlow отвергла предложение проверить клапан silverpine.', true],
    ['cancelled', 'Ada Marlow cancelled the silverpine valve inspection.', true],
    ['completed', 'Ada Marlow completed the silverpine valve inspection.', true],
    ['superseded', 'Ada Marlow recorded a superseded silverpine valve inspection.', true],
    ['rejected', 'Ada Marlow will inspect the silverpine valve.', false],
    ['cancelled', 'Ada Marlow plans to inspect the silverpine valve.', false],
    ['completed', 'Ada Marlow plans to inspect the silverpine valve.', false],
    ['superseded', 'Ada Marlow plans to inspect the silverpine valve.', false],
  ] as const)(
    'keeps plan lifecycle status without redundant planning words: %s %s',
    async (disposition, text, accepted) => {
      const marker = temporalMarker('mem_closed_plan', {
        kind: 'plan',
        disposition,
        speaker: 'Ada Marlow',
        time: { start: '2031-04-18', precision: 'day', relation: 'scheduled', status: 'planned' },
      });
      write(
        'plans/closed.md',
        '# Silverpine inspection history\n\n' +
          managedMemoryBlock(
            marker,
            renderManagedMemoryPayload(
              `Ada Marlow recorded the ${disposition} silverpine valve inspection originally planned for 2031-04-18; it is no longer an actionable plan.`,
              marker,
            ),
          ),
      );
      await memory.index({ verify: true });
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', true)] },
      });
      const result = await memory.answer({
        question: 'What is recorded in the silverpine valve inspection history?',
        memory_view: 'history',
        filter: { folder: 'plans' },
        expand: false,
        graph: false,
      });
      expect(result.reason_code, JSON.stringify(result)).toBe(accepted ? 'answered' : 'draft_rejected');
      expect(modelRequests).toHaveLength(accepted ? 2 : 1);
      if (!accepted) expect(result.validation?.rejection_counts).toEqual({ discourse: 1 });
    },
  );

  it.each([
    [
      'Ada Marlow предложила проверить смету silverpine на следующей неделе, то есть на неделе после исходной записи без известной календарной даты.',
      true,
    ],
    [
      'Ada Marlow proposed reviewing the silverpine estimate next week. The calendar date is unknown because the source was undated.',
      true,
    ],
    [
      'Ada Marlow предложила проверить смету silverpine на следующей неделе; календарная дата неизвестна, поскольку исходная запись не датирована.',
      true,
    ],
    [
      'Ada Marlow proposed reviewing the silverpine estimate next week relative to the undated original note.',
      true,
    ],
    [
      'Ada Marlow proposed reviewing the silverpine estimate at a source-relative time whose calendar date is unknown.',
      true,
    ],
    [
      'Ada Marlow предложила проверить смету silverpine на следующей неделе относительно исходной недатированной записи.',
      true,
    ],
    ['Ada Marlow proposed reviewing the silverpine estimate next week; the calendar date is unknown.', false],
    [
      'Ada Marlow предложила проверить смету silverpine на следующей неделе; календарная дата неизвестна.',
      false,
    ],
    ['Ada Marlow proposed reviewing the silverpine estimate next week relative to the original note.', false],
    ['Ada Marlow proposed reviewing the silverpine estimate; the calendar date is unknown.', false],
    [
      'Ada Marlow proposed reviewing the silverpine estimate next week relative to the original note; the device cannot be recovered.',
      false,
    ],
  ] as const)('preserves the source-relative unknown clock: %s', async (text, accepted) => {
    const marker = temporalMarker('mem_unknown_source_clock', {
      kind: 'plan',
      disposition: 'proposed',
      commitment: 'tentative',
      speaker: 'Ada Marlow',
      time: { precision: 'unknown', relation: 'scheduled', status: 'tentative' },
    });
    write(
      'plans/estimate.md',
      '# Silverpine estimate\n\n' +
        managedMemoryBlock(
          marker,
          renderManagedMemoryPayload(
            'Ada Marlow proposes reviewing the silverpine estimate next week, relative to the undated original note; the calendar date is unknown.',
            marker,
          ),
        ),
    );
    await memory.index({ verify: true });
    await useAnswerModel({
      generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
      verification: { verdicts: [verdict('B1', true)] },
    });
    const result = await memory.answer({
      question: 'What silverpine estimate review was proposed?',
      memory_view: 'planning',
      filter: { folder: 'plans' },
      expand: false,
      graph: false,
    });
    expect(result.reason_code, JSON.stringify(result)).toBe(accepted ? 'answered' : 'draft_rejected');
    expect(modelRequests).toHaveLength(accepted ? 2 : 1);
    if (!accepted) expect(result.validation?.rejection_counts).toEqual({ discourse: 1 });
    else {
      const messages = modelRequests[1]!.messages as Array<{ content: string }>;
      const verification = JSON.parse(messages.at(-1)!.content);
      expect(verification.blocks[0].required_records[0].temporal.time).toMatchObject({
        precision: 'unknown',
        status: 'tentative',
      });
    }
  });

  it.each([
    ['Ada Marlow proposes reviewing the silverpine estimate; the calendar date is unknown.', true],
    [
      'Ada Marlow proposes reviewing the silverpine estimate next week, relative to the undated original note; the calendar date is unknown.',
      false,
    ],
    [
      'Ada Marlow proposes reviewing the silverpine estimate next week, relative to the undated original note; the calendar date is unknown.',
      false,
      'Ada Marlow предложила изменить смету silverpine на следующей неделе, то есть на неделе после исходной записи без известной календарной даты.',
    ],
  ] as const)(
    'keeps source-clock activation narrow and preserves semantic rejection: %s',
    async (source, supported, alternative?: string) => {
      const marker = temporalMarker('mem_clock_activation', {
        kind: 'plan',
        disposition: 'proposed',
        commitment: 'tentative',
        speaker: 'Ada Marlow',
        time: { precision: 'unknown', relation: 'scheduled', status: 'tentative' },
      });
      write(
        'plans/estimate.md',
        '# Silverpine estimate\n\n' + managedMemoryBlock(marker, renderManagedMemoryPayload(source, marker)),
      );
      await memory.index({ verify: true });
      const text =
        alternative ??
        (supported
          ? 'Ada Marlow proposed reviewing the silverpine estimate; its calendar date is unknown.'
          : 'Ada Marlow proposed reviewing the silverpine estimate next week relative to the undated original note.');
      await useAnswerModel({
        generation: { blocks: [{ text, evidence_ids: ['E1'] }], missing_concepts: [] },
        verification: { verdicts: [verdict('B1', supported)] },
      });
      const result = await memory.answer({
        question: 'What silverpine estimate review was proposed?',
        memory_view: 'planning',
        filter: { folder: 'plans' },
        expand: false,
        graph: false,
      });
      expect(result.reason_code, JSON.stringify(result)).toBe(
        supported ? 'answered' : 'verification_rejected',
      );
      expect(modelRequests).toHaveLength(2);
    },
  );

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

async function seedSourceFrame(): Promise<string> {
  write(
    'products/zephyr-qx-100.md',
    '# Zephyr QX-100\n\n<!-- akno:item mem_frame v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=question subject=unresolved source-role=user reports=0 commitment=none disposition=active polarity=affirmed basis=self_attested -->\n- **Open question:** The open silverpine question is whether the warranty covers return delivery; its answer remains unknown.\n',
  );
  await memory.index({ verify: true });
  const frame =
    'Открытый вопрос silverpine: покрывает ли гарантия обратную доставку? Ответ неизвестен. An unrelated amberfin phrase is not part of the selected record.';
  const db = new Database(path.join(stateDir, 'akno.db'));
  try {
    db.prepare(
      `INSERT INTO retain_receipts(source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint, mode, result, change_id, created_at)
      VALUES ('invented-source', 'v1', ?, ?, 'invented-group', 'aaaaaaaaaaaa', 'extract_automatic', '{}', NULL, '2026-01-01')`,
    ).run(sha256(frame), sha256(frame));
    db.prepare(
      `INSERT INTO retain_supports(receipt_fingerprint, candidate_id, candidate_fingerprint, proof_group, memory_id, slug, selection, source_ref, origin, input_hash, evidence, evidence_hash, retracted_by, forgotten_by)
      VALUES ('aaaaaaaaaaaa', 'candidate', 'bbbbbbbbbbbb', 'cccccccccccc', 'mem_frame', 'products/zephyr-qx-100', 'extracted', 'invented-source', 'user', ?, ?, ?, NULL, NULL)`,
    ).run(sha256(frame), frame, sha256(frame));
  } finally {
    db.close();
  }
  return frame;
}

function verdict(
  block_id: string,
  proposition_supported: boolean,
  action_arguments_preserved = true,
  qualification_scope_preserved = true,
) {
  return {
    block_id,
    ...semanticAudit(proposition_supported, action_arguments_preserved, qualification_scope_preserved),
    proposition_supported,
    action_arguments_preserved,
    qualification_scope_preserved,
  };
}

async function useAnswerModel(script: {
  generation: unknown;
  verification: unknown;
  reportUsage?: boolean;
  knowledgeLanguage?: 'en';
}): Promise<void> {
  await memory.close();
  modelServer = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      modelRequests.push(body);
      const system = (body.messages as Array<{ role: string; content: string }>)
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n');
      const verifying = system.includes('independently verify');
      const configured = system.startsWith('Check the language of generated prose')
        ? { compliant: true }
        : verifying
          ? script.verification
          : script.generation;
      const content = typeof configured === 'function' ? configured(body) : configured;
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
      knowledge_language: script.knowledgeLanguage ?? null,
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
