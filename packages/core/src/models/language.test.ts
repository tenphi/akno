import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelClient } from './client.ts';
import { generatedProse } from './language.ts';
import { ConfigDoc } from '../config/schema.ts';

afterEach(() => vi.unstubAllGlobals());

function client(knowledgeLanguage: 'en' | null = 'en') {
  return new ModelClient({
    role: 'derive',
    id: 'invented-language-model',
    provider: {
      name: 'invented',
      baseUrl: 'https://invented.invalid/v1',
      apiKey: null,
      headers: {},
      maxRetries: 0,
    },
    enabled: true,
    requested: true,
    timeoutMs: 1111,
    unavailableReason: null,
    knowledgeLanguage,
  });
}

function responses(values: unknown[]) {
  const requests: { messages: { role: string; content: string }[] }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init.body)));
      const value = values.shift();
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(value) } }],
          usage: { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }),
  );
  return requests;
}

describe('explicit generation language', () => {
  it('supports only an explicit English knowledge target or the legacy unset policy', () => {
    expect(ConfigDoc.safeParse({ knowledge_language: 'en' }).success).toBe(true);
    expect(ConfigDoc.safeParse({ knowledge_language: null }).success).toBe(true);
    expect(ConfigDoc.safeParse({ knowledge_language: 'ru' }).success).toBe(false);
  });

  it('checks generated prose while preserving exact Russian quotations and page references', async () => {
    const output = {
      candidates: [
        {
          text: 'Hypothetically, the warranty lasts five years.',
          subject: 'Zephyr QX-100',
          support: [{ quote: 'Предположим, что гарантия действует пять лет.' }],
          discourse_frame: [{ quote: 'Это только гипотеза.' }],
          destination: { slug: 'оборудование/zephyr', section: 'Гарантия' },
        },
      ],
    };
    const requests = responses([output, { compliant: true }]);
    const result = await client().chat([
      { role: 'user', content: 'Предположим, что гарантия действует пять лет.' },
    ]);
    expect(JSON.parse(result.value!)).toEqual(output);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.messages[0]?.content).toContain('English');
    expect(JSON.parse(requests[1]!.messages[1]!.content)).toEqual({
      language: 'en',
      excerpts: ['Hypothetically, the warranty lasts five years.', 'Zephyr QX-100'],
    });
    expect(result.usage?.totalTokens).toBe(266);
  });

  it.each([
    [{ compliant: false }, 'language_mismatch'],
    [{ other: true }, 'language_check_failed'],
  ])('holds an invalid language result without exposing fallback prose', async (verdict, reason) => {
    const requests = responses([{ summary: 'Гарантия действует пять лет.' }, verdict]);
    const model = client();
    const result = await model.chat([{ role: 'user', content: 'Summarize.' }]);
    expect(result).toMatchObject({ ok: false, value: null, reason });
    expect(model.degradedReason(result)).toBe(reason);
    expect(requests).toHaveLength(2);
  });

  it.each([
    { line: 'Гарантия действовала пять лет.' },
    { decisions: [{ id: 'mem_1111', outcome: 'rewrite', replacement: 'Гарантия действует пять лет.' }] },
  ])('holds wrong-language durable maintenance prose: %j', async (output) => {
    const requests = responses([output, { compliant: false }]);
    const result = await client().chat([{ role: 'user', content: 'Correct the recorded sentence.' }]);
    expect(result).toMatchObject({ ok: false, value: null, reason: 'language_mismatch' });
    expect(JSON.parse(requests[1]!.messages[1]!.content).excerpts).toHaveLength(1);
  });

  it('adds schema-specific prose without suppressing the shared language check', async () => {
    const requests = responses([
      { body: 'Новое утверждение.', after: 'A new sentence.' },
      { compliant: false },
    ]);
    const result = await client().chat([{ role: 'user', content: 'Revise.' }], {
      additionalLanguageProse: () => ['A new sentence.'],
    });
    expect(result).toMatchObject({ ok: false, value: null, reason: 'language_mismatch' });
    expect(JSON.parse(requests[1]!.messages[1]!.content).excerpts).toEqual([
      'Новое утверждение.',
      'A new sentence.',
    ]);
  });

  it('fails closed when schema-specific prose cannot be selected', async () => {
    const requests = responses([{ operations: [{ after: 'Непроверенный текст.' }] }]);
    const result = await client().chat([{ role: 'user', content: 'Revise.' }], {
      additionalLanguageProse: () => {
        throw new Error('invalid operation');
      },
    });
    expect(result).toMatchObject({ ok: false, value: null, reason: 'language_check_failed' });
    expect(requests).toHaveLength(1);
  });

  it('allows source transcription to preserve its original language explicitly', async () => {
    const requests = responses(['Гарантия действует пять лет.']);
    const result = await client().chat([{ role: 'user', content: 'Transcribe exactly.' }], {
      outputLanguage: null,
    });
    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.messages).toEqual([{ role: 'user', content: 'Transcribe exactly.' }]);
  });

  it('honors a Russian answer override without changing the knowledge policy', async () => {
    const requests = responses([{ blocks: [{ text: 'Это только предположение.' }] }, { compliant: true }]);
    const model = client();
    expect((await model.chat([{ role: 'user', content: 'Answer.' }], { outputLanguage: 'ru' })).ok).toBe(
      true,
    );
    expect(requests[0]?.messages[0]?.content).toContain('Russian');
    expect(model.knowledgeLanguage).toBe('en');
  });

  it('adds no call when the owner leaves language unset or output is only a verdict', async () => {
    let requests = responses([{ summary: 'Обычная заметка.' }]);
    expect((await client(null).chat([{ role: 'user', content: 'Summarize.' }])).ok).toBe(true);
    expect(requests).toHaveLength(1);
    requests = responses([{ verdicts: [{ candidate_id: 'c1', supported: true }] }]);
    expect((await client().chat([{ role: 'user', content: 'Verify.' }])).ok).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it('covers generated maintenance and title fields, while exact references remain exempt', () => {
    expect(
      generatedProse({
        summary: 'A summary.',
        patterns: [{ pattern: 'An observed pattern.' }],
        principles: [{ principle: 'A derived principle.' }],
        body: 'A rewritten body.',
        title: 'A new title.',
        attribution: { source_speaker: 'Бo' },
        support: [{ quote: 'Точная цитата.' }],
      }),
    ).toEqual([
      'A summary.',
      'An observed pattern.',
      'A derived principle.',
      'A rewritten body.',
      'A new title.',
    ]);
  });
});
