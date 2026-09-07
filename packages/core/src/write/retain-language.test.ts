import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

afterEach(() => vi.unstubAllGlobals());

describe('cross-language retention boundary', () => {
  it.each([false, true])('keeps a direct user denial distinct from a nested report (nested=%s)', (nested) => {
    const source = nested
      ? 'Bo Winters said the Zephyr QX-100 warranty does not cover inspection.'
      : 'The Zephyr QX-100 warranty does not cover inspection.';
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text: nested ? `Ada Marlow recorded that ${source}` : source,
          attribution: {
            source_role: 'user',
            source_speaker: 'Ada Marlow',
            chain: nested ? [{ speaker: 'Bo Winters', role: 'external' }] : [],
          },
          discourse: { commitment: 'asserted', disposition: 'active' },
          epistemic: { basis: 'self_attested' },
          polarity: 'negated',
          support: [{ item_id: 'turn-1111', quote: source }],
          discourse_frame: [{ item_id: 'turn-1111', quote: source }],
          time: null,
        },
      ],
      { sourceItems: [{ item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text: source }] },
    );
    expect(result.held).toEqual([]);
    expect(result.candidates[0]?.epistemic.basis).toBe(nested ? 'source_report' : 'self_attested');
  });

  it.each(['property', 'unanchored', 'anchored'] as const)(
    'distinguishes coverage duration from established schedules (%s)',
    (mode) => {
      const schedule = mode !== 'property';
      const source =
        mode === 'anchored'
          ? 'Zephyr QX-100 inspection is scheduled every six months starting on 2031-04-11.'
          : mode === 'unanchored'
            ? 'Zephyr QX-100 inspection is scheduled every six months, but the start date is unknown.'
            : 'Hypothetically, the Zephyr QX-100 warranty covers inspection during year six.';
      const time =
        mode === 'anchored'
          ? {
              precision: 'day',
              status: 'scheduled',
              relation: 'scheduled',
              start: '2031-04-11',
              recurrence: { frequency: 'monthly', interval: 6 },
            }
          : mode === 'unanchored'
            ? { precision: 'unknown', status: 'scheduled', relation: 'scheduled' }
            : null;
      const result = cleanCandidateBatch(
        [
          {
            kind: schedule ? 'event' : 'claim',
            text: source,
            attribution: { source_role: 'user' },
            discourse: { commitment: schedule ? 'asserted' : 'hypothetical', disposition: 'active' },
            epistemic: { basis: 'self_attested' },
            support: [{ quote: source }],
            discourse_frame: [{ quote: source }],
            time,
          },
        ],
        { sourceText: source },
      );
      expect(result.held).toEqual([]);
      expect(result.candidates[0]?.time).toEqual(time ?? undefined);
    },
  );

  it.each([false, true])(
    'explains an invalid mention timestamp without discarding unknown time (repair=%s)',
    async (repair) => {
      const source =
        'I propose inspecting the Zephyr QX-100 warranty tomorrow; this is not accepted or scheduled.';
      const candidate = {
        text: 'Ada Marlow proposed inspecting the Zephyr QX-100 warranty tomorrow relative to the source, whose reference date is unknown; it remains unaccepted and unscheduled.',
        kind: 'plan',
        subject: 'Zephyr QX-100',
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        discourse: { commitment: 'tentative', disposition: 'proposed' },
        epistemic: { basis: 'self_attested' },
        polarity: 'affirmed',
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
        time: { precision: 'unknown', status: 'tentative', relation: 'scheduled', mentioned_at: 'tomorrow' },
      };
      let calls = 0;
      const chat = vi.fn(async (messages: { content: string }[]) => {
        calls++;
        if (calls === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        if (calls === 2) {
          expect(payload.validation_issues[0]).toMatchObject({
            reason_code: 'time_unresolved',
            reason: expect.stringContaining('time.mentioned_at'),
          });
          expect(payload.validation_issues[0].reason).toContain('Keep the unknown temporal envelope');
          return {
            ok: true,
            value: JSON.stringify({
              candidates: [{ ...candidate, time: repair ? { ...candidate.time, mentioned_at: null } : null }],
            }),
            latencyMs: 22,
          };
        }
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map((c: { candidate_id: string }) => ({
              candidate_id: c.candidate_id,
              supported: true,
              reason_code: null,
            })),
          }),
          latencyMs: 33,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-time-repair',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(result.candidates).toHaveLength(repair ? 1 : 0);
      expect(chat).toHaveBeenCalledTimes(repair ? 3 : 2);
      if (repair)
        expect(result.candidates[0]?.time).toEqual({
          precision: 'unknown',
          status: 'tentative',
          relation: 'scheduled',
        });
    },
  );

  it.each([
    ['For discussion, Bo Winters imagines a fictional Zephyr QX-100 warranty.', false],
    ['Для обсуждения Bo Winters представляет вымышленную гарантию Zephyr QX-100.', false],
    ['Bo Winters said the Zephyr QX-100 warranty might last five years.', true],
    ['Bo Winters сообщил, что гарантия Zephyr QX-100 может действовать пять лет.', true],
    ['According to Bo Winters, the Zephyr QX-100 warranty might last five years.', true],
    ['Со слов Bo Winters, гарантия Zephyr QX-100 может действовать пять лет.', true],
  ])('requires a reporting relation for an inner speaker: %s', (source, valid) => {
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text: 'Ada Marlow recorded a tentative Zephyr QX-100 warranty claim involving Bo Winters.',
          subject: 'Zephyr QX-100',
          attribution: { source_role: 'user', chain: [{ speaker: 'Bo Winters', role: 'external' }] },
          discourse: { commitment: 'tentative', disposition: 'active' },
          epistemic: { basis: 'source_report' },
          support: [{ item_id: 'turn-1111', quote: source }],
          discourse_frame: [{ item_id: 'turn-1111', quote: source }],
        },
      ],
      { sourceItems: [{ item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text: source }] },
    );
    expect(result.candidates).toHaveLength(valid ? 1 : 0);
    if (!valid) expect(result.held[0]?.reason).toContain('explicit reporting relation');
  });

  it.each([
    ['The Zephyr QX-100 warranties exclude damage.', false],
    ['The Zephyr QX-100 warranty excluded damage.', false],
    ['The Zephyr QX-100 warranty is excluding damage.', false],
    ['The Zephyr QX-100 warranties exclude ущерб; гарантии исключают ущерб.', false],
    ['The Zephyr QX-100 warranty applies; гарантии исключали ущерб.', false],
    ['The Zephyr QX-100 warranty does not exclude damage.', true],
    ["The Zephyr QX-100 warranty doesn't exclude damage.", true],
    ['The Zephyr QX-100 warranty never excluded damage.', true],
    ['The Zephyr QX-100 warranty applies; гарантии не исключают ущерб.', true],
  ])('checks exclusion polarity without reversing immediate negation: %s', (text, valid) => {
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
          support: [{ quote: text }],
          discourse_frame: [{ quote: text }],
        },
      ],
      { sourceText: text },
    );
    expect(result.candidates).toHaveLength(valid ? 1 : 0);
    if (!valid) expect(result.held[0]?.reason).toContain('polarity affirmed');
  });

  it.each([false, true])(
    'preserves the outer named source in generated nonfactual prose (named=%s)',
    (named) => {
      const source = 'Bo Winters described a fictional Zephyr QX-100 warranty.';
      const result = cleanCandidateBatch(
        [
          {
            kind: 'claim',
            text: (named ? 'Ada Marlow recorded that ' : '') + source,
            subject: 'Zephyr QX-100',
            attribution: { source_role: 'user' },
            discourse: { commitment: 'hypothetical', disposition: 'active' },
            epistemic: { basis: 'source_report' },
            support: [{ item_id: 'turn-1111', quote: source }],
            discourse_frame: [{ item_id: 'turn-1111', quote: source }],
          },
        ],
        { sourceItems: [{ item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text: source }] },
      );
      expect(result.candidates).toHaveLength(named ? 1 : 0);
      if (!named) expect(result.held[0]?.reason).toContain('outer source speaker');
    },
  );

  it.each(['accepted', 'still-invalid', 'unsupported', 'unavailable', 'duplicate-verdict'] as const)(
    'bounds structural repair and keeps semantic verification authoritative (%s)',
    async (outcome) => {
      const source = 'Suppose the Zephyr QX-100 warranty lasted seven years. This is an assumption.';
      const good = {
        kind: 'claim',
        text: 'Hypothetically, the Zephyr QX-100 warranty lasts seven years.',
        subject: 'Zephyr QX-100',
        attribution: { source_role: 'user' },
        discourse: { commitment: 'hypothetical', disposition: 'active' },
        epistemic: { basis: 'self_attested' },
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      };
      const bad = { ...good, discourse_frame: [{ quote: 'This is an assumption.' }] };
      const events = [{ date: '2031-04-11', summary: 'Ada Marlow completed an invented inspection.' }];
      let calls = 0;
      const chat = vi.fn(async (messages: { content: string }[]) => {
        calls++;
        if (calls === 1)
          return { ok: true, value: JSON.stringify({ candidates: [bad], events }), latencyMs: 11 };
        if (calls === 2) {
          const payload = JSON.parse(messages.at(-1)!.content);
          expect(payload.source.text).toBe(source);
          expect(payload.validation_issues[0].reason_code).toBe('discourse_uncertain');
          if (outcome === 'unavailable')
            return { ok: false, value: null, error: 'invented provider failure', latencyMs: 22 };
          return {
            ok: true,
            value: JSON.stringify({
              candidates: [outcome === 'still-invalid' ? bad : good],
              events: [{ date: '2031-05-22', summary: 'An unsupported replacement event.' }],
            }),
            latencyMs: 22,
          };
        }
        expect(calls).toBe(3);
        const payload = JSON.parse(messages.at(-1)!.content);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates
              .flatMap((candidate: { candidate_id: string }) => ({
                candidate_id: candidate.candidate_id,
                supported: outcome === 'accepted',
                reason_code: outcome === 'accepted' ? null : 'discourse_uncertain',
              }))
              .flatMap((verdict: { candidate_id: string; supported: boolean; reason_code: string | null }) =>
                outcome === 'duplicate-verdict'
                  ? [verdict, { ...verdict, supported: true, reason_code: null }]
                  : [verdict],
              ),
          }),
          latencyMs: 33,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-repair-model',
        chat,
        degradedReason: () => 'derive_failed',
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(result.candidates).toHaveLength(outcome === 'accepted' ? 1 : 0);
      expect(result.modelUsage.repair?.latency_ms).toBe(22);
      if (outcome === 'accepted') expect(result.events).toEqual(events);
      expect(chat).toHaveBeenCalledTimes(
        ['accepted', 'unsupported', 'duplicate-verdict'].includes(outcome) ? 3 : 2,
      );
      if (outcome === 'unsupported') expect(result.held[0]?.hold_stage).toBe('verification');
      if (outcome === 'unavailable') expect(result.degradedReason).toBe('derive_failed');
      if (outcome === 'duplicate-verdict') expect(result.degradedReason).toBe('retain_verification_failed');
    },
  );

  it.each([false, true])(
    'covers adjacent frame sentences without losing original bytes (omission=%s)',
    (omit) => {
      const parts = [
        'Suppose the Zephyr QX-100 warranty lasted seven years.',
        'This is not established.',
        'Repair would be covered in year six.',
      ];
      const source = parts.join(' ');
      const result = cleanCandidateBatch(
        [
          {
            kind: 'claim',
            text: 'Hypothetically, a seven-year Zephyr QX-100 warranty would cover repair in year six.',
            subject: 'Zephyr QX-100',
            attribution: { source_role: 'user' },
            discourse: { commitment: 'hypothetical', disposition: 'active' },
            epistemic: { basis: 'self_attested' },
            support: [{ item_id: 'turn-1111', quote: source }],
            discourse_frame: parts
              .filter((_, index) => !omit || index !== 1)
              .map((quote) => ({ item_id: 'turn-1111', quote })),
          },
        ],
        { sourceItems: [{ item_id: 'turn-1111', role: 'user', text: source }] },
      );
      expect(result.candidates).toHaveLength(omit ? 0 : 1);
      if (omit) expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
      else expect(result.candidates[0]?.support[0]?.quote).toBe(source);
    },
  );

  it.each([
    ['Ada Marlow proposed reviewing the Zephyr QX-100 warranty tomorrow.', false],
    [
      'Ada Marlow proposed reviewing the Zephyr QX-100 warranty at a source-relative time described as tomorrow.',
      false,
    ],
    [
      "Ada Marlow proposed reviewing the Zephyr QX-100 warranty at the source's tomorrow, but the source reference date is unknown.",
      true,
    ],
    [
      'Ada Marlow proposed reviewing the Zephyr QX-100 warranty tomorrow relative to the source, whose reference date is unknown.',
      true,
    ],
  ] as const)('requires both source-relative meaning and an unknown date: %s', (text, accepted) => {
    const source = 'I propose reviewing the Zephyr QX-100 warranty tomorrow.';
    const result = cleanCandidateBatch(
      [
        {
          kind: 'plan',
          text,
          subject: 'Zephyr QX-100',
          attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
          discourse: { commitment: 'tentative', disposition: 'proposed' },
          epistemic: { basis: 'self_attested' },
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
          time: { precision: 'unknown', status: 'tentative', relation: 'scheduled' },
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toHaveLength(accepted ? 1 : 0);
    if (!accepted)
      expect(result.held[0]).toMatchObject({
        reason_code: 'time_unresolved',
        reason: expect.stringContaining('readable prose'),
      });
  });

  it.each(['unknown', 'day'] as const)(
    'keeps an undated proposal but rejects an invented resolved date (%s)',
    (precision) => {
      const source =
        'I propose checking the Zephyr QX-100 warranty next month. No inspection is accepted or scheduled.';
      const result = cleanCandidateBatch(
        [
          {
            kind: 'plan',
            text: 'Ada Marlow proposed checking the Zephyr QX-100 warranty the month after the undated source; the proposal is unaccepted and its calendar date unknown.',
            subject: 'Zephyr QX-100',
            attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
            discourse: { commitment: 'tentative', disposition: 'proposed' },
            epistemic: { basis: 'self_attested' },
            support: [{ quote: source }],
            discourse_frame: [{ quote: source }],
            time: {
              precision,
              status: 'tentative',
              relation: 'scheduled',
              ...(precision === 'day' ? { start: '2031-04-11' } : {}),
            },
          },
        ],
        { sourceText: source },
      );
      expect(result.candidates).toHaveLength(precision === 'unknown' ? 1 : 0);
      if (precision === 'day') expect(result.held[0]?.reason_code).toBe('time_unresolved');
      else
        expect(result.candidates[0]?.time).toEqual({
          precision: 'unknown',
          status: 'tentative',
          relation: 'scheduled',
        });
    },
  );

  it('accepts exact proposition support contained in a larger original counterfactual frame', () => {
    const quote = 'Если бы гарантия Zephyr QX-100 действовала десять лет, замена была бы покрыта.';
    const source = quote + ' Но эта гарантия не была выбрана.';
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text: 'Counterfactually, a ten-year Zephyr QX-100 warranty would have covered replacement.',
          subject: 'Zephyr QX-100',
          attribution: { source_role: 'user' },
          discourse: { commitment: 'counterfactual', disposition: 'active' },
          epistemic: { basis: 'self_attested' },
          polarity: 'affirmed',
          support: [{ quote }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source },
    );
    expect(result.held).toEqual([]);
    expect(result.candidates[0]?.support).toEqual([{ quote }]);
    expect(result.candidates[0]?.discourse_frame).toEqual([{ quote: source }]);
  });

  it('does not borrow a matching discourse frame from another source turn', () => {
    const quote = 'The Zephyr QX-100 warranty might last five years.';
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text: quote,
          subject: 'Zephyr QX-100',
          attribution: { source_role: 'user' },
          discourse: { commitment: 'tentative', disposition: 'active' },
          epistemic: { basis: 'self_attested' },
          support: [{ item_id: 'turn-1111', quote }],
          discourse_frame: [{ item_id: 'turn-2222', quote: quote + ' This is unconfirmed.' }],
        },
      ],
      {
        sourceItems: [
          { item_id: 'turn-1111', role: 'user', text: quote },
          { item_id: 'turn-2222', role: 'user', text: quote + ' This is unconfirmed.' },
        ],
      },
    );
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

  it.each([
    [
      'The Zephyr QX-100 warranty excludes spilled-liquid damage.',
      'The Zephyr QX-100 warranty excludes spilled-liquid damage.',
    ],
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
