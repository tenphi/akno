import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

afterEach(() => vi.unstubAllGlobals());

describe('cross-language retention boundary', () => {
  it.each([
    [
      'This is a fictional example: the Zephyr QX-100 warranty lasts five years.',
      'The Zephyr QX-100 warranty lasts five years.',
    ],
    [
      'The Zephyr QX-100 warranty does not include frost damage.',
      'The Zephyr QX-100 warranty does not include frost damage.',
    ],
  ])('holds unsupported canonical metadata before semantic verification: %s', (source, text) => {
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text,
          subject: 'Zephyr QX-100',
          attribution: { source_role: 'user' },
          discourse: { commitment: 'asserted', disposition: 'active' },
          epistemic: { basis: 'self_attested' },
          polarity: 'affirmed',
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'discourse_uncertain' })]);
  });

  it.each([
    [
      'Гарантия Zephyr QX-100 действует пять лет.',
      'The Zephyr QX-100 warranty lasts five years.',
      'asserted',
      'affirmed',
    ],
    [
      'Предположим, что гарантия Zephyr QX-100 действует пять лет.',
      'Hypothetically, the Zephyr QX-100 warranty lasts five years.',
      'hypothetical',
      'affirmed',
    ],
    [
      'Гарантия Zephyr QX-100 не покрывает повреждения от мороза.',
      'The Zephyr QX-100 warranty does not cover frost damage.',
      'asserted',
      'negated',
    ],
  ])(
    'keeps original support and verifies English prose against the complete source: %s',
    async (source, text, commitment, polarity) => {
      const requests: { messages: { content: string }[] }[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          const body = JSON.parse(String(init.body));
          requests.push(body);
          const system = body.messages
            .filter((message: { role: string }) => message.role === 'system')
            .map((message: { content: string }) => message.content)
            .join('\n');
          const user = JSON.parse(body.messages.at(-1).content);
          const output = system.startsWith('Check the language')
            ? { compliant: true }
            : system.includes('independently verify proposed retained memories')
              ? {
                  verdicts: user.candidates.map((candidate: { candidate_id: string }) => ({
                    candidate_id: candidate.candidate_id,
                    supported: true,
                    reason_code: null,
                  })),
                }
              : {
                  candidates: [
                    {
                      kind: 'claim',
                      text,
                      subject: 'Zephyr QX-100',
                      attribution: { source_role: 'user' },
                      discourse: { commitment, disposition: 'active' },
                      epistemic: { basis: 'self_attested' },
                      polarity,
                      support: [{ quote: source }],
                      discourse_frame: [{ quote: source }],
                      time: null,
                      page: null,
                      relations: [],
                    },
                  ],
                };
          return new Response(
            JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      );
      const model = new ModelClient({
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
        knowledgeLanguage: 'en',
      });
      const result = await runRetain(source, model, {
        sourceId: 'invented:cross-language',
        revision: 'rev-1111',
      });
      expect(result.held).toEqual([]);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]).toMatchObject({
        text,
        polarity,
        discourse: { commitment },
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      });
      const verification = requests.find((request) =>
        request.messages.some((message) =>
          message.content.includes('independently verify proposed retained memories'),
        ),
      );
      expect(verification).toBeDefined();
      expect(verification!.messages.at(-1)!.content).toContain(source);
    },
  );
});
