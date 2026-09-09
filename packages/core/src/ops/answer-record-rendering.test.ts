import { describe, expect, it } from 'vitest';
import type { AnswerContextItem } from '@tenphi/akno-protocol';
import { answerRecordBlockSchema, answerRecordRendering } from './answer-record-rendering.ts';

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
});
