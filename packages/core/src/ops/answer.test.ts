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
  write(
    'products/zephyr-qx-100.md',
    '# Zephyr QX-100\n\nThe silverpine warranty marker says the warranty lasts five years.\n',
  );
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
        lines: [{ n: 3, text: 'The silverpine warranty marker says the warranty lasts five years.' }],
      },
    ]);
    expect(modelRequests).toHaveLength(2);
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
    expect(result.citations).toEqual([
      { id: 'E1', type: 'page', slug: 'products/zephyr-qx-100', lines: [3] },
    ]);
  });

  it('accepts an explicit exclusion as support for equivalent negative wording', async () => {
    write(
      'coverage/cormorant-exclusions.md',
      '# Cormorant exclusions\n\nThe cormorant marker says coverage excludes volcanic-ash damage.\n',
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
