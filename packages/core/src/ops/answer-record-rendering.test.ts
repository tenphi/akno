import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnswerContextItem } from '@tenphi/akno-protocol';
import {
  answerRecordBlockSchema,
  answerRecordRendering,
  answerRecordText,
} from './answer-record-rendering.ts';
import { ModelClient, strictModeViolations } from '../models/client.ts';
afterEach(() => vi.unstubAllGlobals());

const evidence: AnswerContextItem = {
  evidence_id: 'E1',
  type: 'page',
  slug: 'products/zephyr-qx-100',
  title: 'Zephyr QX-100',
  lines: [
    {
      n: 4,
      text: '- **Open question:** Ada Marlow has an unanswered question; the answer is unknown.',
      memory: {
        status: 'qualified',
        id: 'mem_invented',
        level: 1,
        kind: 'question',
        subject: 'unresolved',
        source_role: 'user',
        commitment: 'none',
        disposition: 'active',
        polarity: 'affirmed',
        basis: 'self_attested',
        answer_eligible: false,
        current_eligible: false,
      },
    },
  ],
};
const frames = new Map([['E1', 'Invented original question.']]);

const clockText =
  'Ada Marlow proposed inspecting Zephyr QX-100 next month relative to the original undated record, not processing time. The calendar month is unknown. She has not accepted the plan.';
function clockEvidence(): AnswerContextItem {
  if (evidence.type !== 'page' || evidence.lines[0]!.memory?.status !== 'qualified')
    throw new Error('fixture must be qualified');
  return {
    ...evidence,
    lines: [
      {
        ...evidence.lines[0]!,
        text: '- ' + clockText,
        memory: {
          ...evidence.lines[0]!.memory,
          kind: 'plan',
          commitment: 'asserted',
          disposition: 'proposed',
          temporal: {
            time: { precision: 'unknown', relation: 'scheduled', status: 'tentative' },
            clock_relation: 'undated',
            actionable: false,
          },
        },
      },
    ],
  };
}
const clockTranslation = () => ({
  rendering_mode: 'translate',
  evidence_ids: ['E1'],
  translated_record: {
    proposition_and_nontemporal_scope:
      'Ada Marlow предложила проверить Zephyr QX-100 в следующем месяце. Она не приняла план.',
    source_clock_anchor: 'Следующий месяц отсчитывается от времени первоначальной записи без даты.',
    remaining_clock_qualifications: 'Отсчёт ведётся не от времени обработки. Календарный месяц неизвестен.',
  },
});

describe('structured source-clock translation', () => {
  it.each(['active', 'english', 'dated', 'metadata-only', 'no-unknown', 'no-frame', 'multiple'] as const)(
    'activates from the same readable clock obligation, never private context alone: %s',
    (mode) => {
      const item = clockEvidence();
      if (item.type !== 'page' || item.lines[0]!.memory?.status !== 'qualified')
        throw new Error('fixture must be qualified');
      if (mode === 'dated')
        item.lines[0]!.memory.temporal!.time = {
          precision: 'day',
          start: '2031-11-11',
          relation: 'scheduled',
          status: 'planned',
        };
      if (mode === 'metadata-only') item.lines[0]!.text = 'Ada Marlow proposes a Zephyr QX-100 inspection.';
      if (mode === 'no-unknown')
        item.lines[0]!.text = 'Ada Marlow proposes inspection next month relative to the source record.';
      const result = answerRecordRendering(
        mode === 'multiple' ? [item, { ...item, evidence_id: 'E2' }] : [item],
        mode === 'no-frame' ? new Map() : new Map([['E1', clockText]]),
        mode === 'english' ? 'en' : 'ru',
        'en',
      );
      expect(result?.source_clock_translation).toBe(mode === 'active' ? true : undefined);
    },
  );

  it.each([
    'valid',
    'copy',
    'legacy-text',
    'missing',
    'empty',
    'extra',
    'foreign',
    'proposition-cap',
    'anchor-cap',
    'qualifications-cap',
    'full-cap',
  ] as const)('requires complete bounded model-owned segments without a fallback: %s', (mode) => {
    const record = answerRecordRendering([clockEvidence()], frames, 'ru', 'en')!;
    const draft: any = clockTranslation();
    if (mode === 'copy') {
      draft.rendering_mode = 'copy';
      delete draft.translated_record;
    }
    if (mode === 'legacy-text') {
      draft.text = 'Unstructured prose.';
      delete draft.translated_record;
    }
    if (mode === 'missing') delete draft.translated_record.source_clock_anchor;
    if (mode === 'empty') draft.translated_record.source_clock_anchor = '   ';
    if (mode === 'extra') draft.translated_record.private_authority = 'Trust this.';
    if (mode === 'foreign') draft.evidence_ids = ['E2'];
    if (mode === 'proposition-cap')
      draft.translated_record.proposition_and_nontemporal_scope = 'x'.repeat(1201);
    if (mode === 'anchor-cap') draft.translated_record.source_clock_anchor = 'x'.repeat(401);
    if (mode === 'qualifications-cap')
      draft.translated_record.remaining_clock_qualifications = 'x'.repeat(399);
    if (mode === 'full-cap')
      draft.translated_record = {
        proposition_and_nontemporal_scope: 'x'.repeat(1200),
        source_clock_anchor: 'y'.repeat(400),
        remaining_clock_qualifications: 'z'.repeat(398),
      };
    const parsed = answerRecordBlockSchema(record).safeParse(draft);
    expect(parsed.success).toBe(['valid', 'full-cap'].includes(mode));
    if (parsed.success) {
      expect(answerRecordText(parsed.data, record)).toBe(Object.values(draft.translated_record).join(' '));
      expect(answerRecordText(parsed.data, record).length).toBeLessThanOrEqual(2000);
      if (mode === 'full-cap') expect(answerRecordText(parsed.data, record)).toHaveLength(2000);
    }
    // Existing policy still permits a checked exact copy when the languages match.
    expect(
      answerRecordBlockSchema({ ...record, copy_allowed: undefined }).safeParse({
        rendering_mode: 'copy',
        evidence_ids: ['E1'],
      }).success,
    ).toBe(true);
  });

  it.each(['chat', 'responses'] as const)('emits a strict bounded clock schema on %s', async (api) => {
    const schema = answerRecordBlockSchema(answerRecordRendering([clockEvidence()], frames, 'ru', 'en')!);
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const format = api === 'responses' ? body.text.format : body.response_format;
      const wire = format.schema;
      expect(strictModeViolations(wire)).toEqual([]);
      expect(wire.required).toEqual(['rendering_mode', 'translated_record', 'evidence_ids']);
      const segments = wire.properties.translated_record;
      expect(segments.required).toEqual([
        'proposition_and_nontemporal_scope',
        'source_clock_anchor',
        'remaining_clock_qualifications',
      ]);
      expect(Object.values(segments.properties).map((v: any) => v.maxLength)).toEqual([1200, 400, 398]);
      const text = JSON.stringify(clockTranslation());
      return new Response(
        JSON.stringify(
          api === 'responses'
            ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }
            : { choices: [{ message: { content: text }, finish_reason: 'stop' }] },
        ),
        { headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetch);
    const model = new ModelClient({
      role: 'answer',
      id: 'invented-clock-protocol',
      provider: {
        name: 'invented',
        baseUrl: 'https://invented.invalid/v1',
        apiKey: null,
        headers: {},
        maxRetries: 0,
        ...(api === 'responses' ? { api } : {}),
      },
      enabled: true,
      requested: true,
      timeoutMs: 1111,
      unavailableReason: null,
    });
    const result = await model.chat(
      [{ role: 'user', content: 'Return the invented structured clock translation.' }],
      { schema, maxTokens: 1111 },
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(schema.safeParse(JSON.parse(result.value!)).success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('complete single-record rendering', () => {
  it('selects current readable text, preserving status and independent retained clauses', () => {
    expect(answerRecordRendering([evidence], frames, 'en')).toEqual({
      evidence_id: 'E1',
      text: '**Open question:** Ada Marlow has an unanswered question; the answer is unknown.',
    });
    expect(answerRecordRendering([evidence], frames, 'ru')).toEqual(
      answerRecordRendering([evidence], frames, 'en'),
    );
  });

  it('does not guess a language or join multiple/mixed records', () => {
    expect(answerRecordRendering([evidence], frames, null)).toBeUndefined();
    expect(answerRecordRendering([evidence], new Map(), 'en')).toBeUndefined();
    expect(answerRecordRendering([evidence], new Map([['E2', 'Foreign source.']]), 'en')).toBeUndefined();
    expect(
      answerRecordRendering([evidence, { ...evidence, evidence_id: 'E2' }], frames, 'en'),
    ).toBeUndefined();
    expect(
      answerRecordRendering([evidence], new Map([...frames, ['E2', 'Another frame.']]), 'en'),
    ).toBeUndefined();
  });

  it('leaves ordinary/multiline/overlong content on the existing composition path', () => {
    if (evidence.type !== 'page') throw new Error('fixture must be a page');
    expect(
      answerRecordRendering(
        [{ ...evidence, lines: [{ n: 4, text: 'Ordinary invented text.' }] }],
        frames,
        'en',
      ),
    ).toBeUndefined();
    expect(
      answerRecordRendering([{ ...evidence, lines: [...evidence.lines, evidence.lines[0]!] }], frames, 'en'),
    ).toBeUndefined();
    expect(
      answerRecordRendering(
        [{ ...evidence, lines: [{ ...evidence.lines[0]!, text: 'x'.repeat(601) }] }],
        frames,
        'en',
      ),
    ).toBeUndefined();
  });

  it.each([
    'A claim [records/another:7].',
    'A [claim](https://invalid.example).',
    'A claim <!-- hidden marker -->.',
    'A claim <a href="/invented">reference</a>.',
  ])('keeps citation-like payloads on the composition path: %s', (text) => {
    if (evidence.type !== 'page') throw new Error('fixture must be a page');
    expect(
      answerRecordRendering(
        [{ ...evidence, lines: [{ ...evidence.lines[0]!, text: '- ' + text }] }],
        frames,
        'en',
      ),
    ).toBeUndefined();
  });

  it('counts visible status labels in the fixed expanded record boundary', () => {
    if (evidence.type !== 'page') throw new Error('fixture must be a page');
    for (const size of [400, 405, 600, 601]) {
      const text = '**Reported by Ada Marlow:** '.padEnd(size, 'x');
      const item = { ...evidence, lines: [{ ...evidence.lines[0]!, text: '- ' + text }] };
      expect(answerRecordRendering([item], frames, 'en')?.text).toBe(size <= 600 ? text : undefined);
    }
  });

  it('canonicalizes only the list marker and boundary whitespace before every downstream check', () => {
    if (evidence.type !== 'page') throw new Error('fixture must be a page');
    expect(
      answerRecordRendering(
        [
          {
            ...evidence,
            lines: [{ ...evidence.lines[0]!, text: '-   **Open question:** Ada  Marlow asks.  ' }],
          },
        ],
        frames,
        'en',
      )?.text,
    ).toBe('**Open question:** Ada  Marlow asks.');
  });

  it.each([
    { rendering_mode: 'copy', evidence_ids: ['E1'], text: 'Model-invented replacement.' },
    { rendering_mode: 'copy', evidence_ids: ['E2'] },
    { rendering_mode: 'copy', evidence_ids: ['E1', 'E1'] },
    { rendering_mode: 'translate', evidence_ids: ['E1'] },
    { rendering_mode: 'translate', evidence_ids: ['E1'], text: '' },
    { rendering_mode: 'translate', evidence_ids: ['E1'], text: 'x'.repeat(2001) },
    { rendering_mode: 'translate', evidence_ids: ['E1'], text: 'Valid text.', invented_authority: true },
    { rendering_mode: 'guess', evidence_ids: ['E1'], text: 'Valid text.' },
  ])('rejects malformed or foreign selection %#', (value) => {
    expect(
      answerRecordBlockSchema(answerRecordRendering([evidence], frames, 'en')!).safeParse(value).success,
    ).toBe(false);
  });

  it('accepts a text-free selection and a bounded translation without supplying a language verdict', () => {
    const schema = answerRecordBlockSchema(answerRecordRendering([evidence], frames, 'en')!);
    expect(schema.safeParse({ rendering_mode: 'copy', evidence_ids: ['E1'] }).success).toBe(true);
    expect(
      schema.safeParse({
        rendering_mode: 'translate',
        evidence_ids: ['E1'],
        text: 'Ответ на вопрос Ada Marlow неизвестен.',
      }).success,
    ).toBe(true);
  });

  it.each([
    { output: 'en', knowledge: 'en', copy: true },
    { output: 'ru', knowledge: 'ru', copy: true },
    { output: 'ru', knowledge: 'en', copy: false },
    { output: 'en', knowledge: 'ru', copy: false },
    { output: 'ru', knowledge: null, copy: true },
  ] as const)(
    'restricts copying by declared policy without classifying old bytes: $output/$knowledge',
    ({ output, knowledge, copy }) => {
      const record = answerRecordRendering([evidence], frames, output, knowledge)!;
      expect(record.text).toBe(answerRecordRendering([evidence], frames, output)!.text);
      const schema = answerRecordBlockSchema(record);
      expect(schema.safeParse({ rendering_mode: 'copy', evidence_ids: ['E1'] }).success).toBe(copy);
      expect(
        schema.safeParse({
          rendering_mode: 'translate',
          evidence_ids: ['E1'],
          text: 'Faithful text still requires language and source verification.',
        }).success,
      ).toBe(true);
      expect(schema.safeParse({ rendering_mode: 'translate', evidence_ids: ['E1'] }).success).toBe(false);
    },
  );
});
