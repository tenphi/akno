import { semanticAudit, frameAuditFields } from '../../test/semantic-audit.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

afterEach(() => vi.unstubAllGlobals());

const repairBatch = (candidates: unknown[]) => ({
  repairs: candidates.map((candidate, candidate_index) => ({ candidate_index, candidate })),
});

describe('cross-language retention boundary', () => {
  it.each([
    ['According to Ada Marlow, the proposal was to review the warranty exceptions.', false],
    ['Ada Marlow proposed reviewing the warranty exceptions.', true],
  ])('keeps an explicit proposer in generated retention: %s', (text, accepted) => {
    const source = 'Ada Marlow предложила проверить исключения из гарантии.';
    const candidate = {
      kind: 'plan',
      text,
      subject: 'Zephyr QX-100',
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
      discourse: { commitment: 'asserted', disposition: 'proposed' },
      epistemic: { basis: 'self_attested' },
      polarity: 'affirmed',
      support: [{ quote: source }],
      discourse_frame: [{ quote: source }],
    };
    const result = cleanCandidateBatch([candidate], { sourceText: source, generated: true });
    expect(result.candidates).toHaveLength(accepted ? 1 : 0);
    if (!accepted) expect(result.held[0]?.reason).toContain('source-named proposer');
    expect(cleanCandidateBatch([candidate], { sourceText: source }).candidates).toHaveLength(1);
  });

  it.each([
    ['Ada Marlow considers two tentative explanations; neither explanation selected.', false],
    ['Ada Marlow considers two tentative explanations; she has selected neither explanation.', true],
  ])('preserves personal nonselection before persistence: %s', (text, accepted) => {
    const source = 'Я, Ada Marlow, рассматриваю две версии; ни одну причину я не выбрала.';
    const candidate = {
      kind: 'claim',
      text,
      subject: 'Zephyr QX-100',
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
      discourse: { commitment: 'tentative', disposition: 'active' },
      epistemic: { basis: 'self_attested' },
      polarity: 'affirmed',
      support: [{ quote: source }],
      discourse_frame: [{ quote: source }],
    };
    const result = cleanCandidateBatch([candidate], { sourceText: source, generated: true });
    expect(result.candidates).toHaveLength(accepted ? 1 : 0);
    if (!accepted) expect(result.held[0]?.reason).toContain('personal nonselector');
    expect(cleanCandidateBatch([candidate], { sourceText: source }).candidates).toHaveLength(1);
  });

  it.each([true, false])(
    'verifies the complete original source after separating an independent denial frame: %s',
    async (supported) => {
      const denial = 'No handover of Zephyr QX-100 has been booked.';
      const source = denial + ' The offered shipment was rejected, not accepted.';
      const candidate = {
        kind: 'claim',
        text: denial,
        subject: 'Zephyr QX-100',
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        discourse: { commitment: 'asserted', disposition: 'active' },
        epistemic: { basis: 'self_attested' },
        polarity: 'negated',
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
        time: null,
      };
      const chat = vi.fn(async (messages: { content: string }[]) => {
        const call = chat.mock.calls.length;
        if (call === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        if (call === 2) {
          expect(payload.validation_issues[0].reason).toContain('rejection scope');
          return {
            ok: true,
            value: JSON.stringify(
              repairBatch([
                { ...candidate, support: [{ quote: denial }], discourse_frame: [{ quote: denial }] },
              ]),
            ),
            latencyMs: 22,
          };
        }
        expect(payload.source.text).toBe(source);
        expect(payload.repair_obligations).toHaveLength(1);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map((c: { candidate_id: string }) => ({
              candidate_id: c.candidate_id,
              ...semanticAudit(supported, true, true),
              proposition_supported: supported,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: supported ? null : 'discourse_uncertain',
            })),
          }),
          latencyMs: 33,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-denial-scope',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(3);
      expect(result.candidates).toHaveLength(supported ? 1 : 0);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([
    ['No shipment of Zephyr QX-100 has been arranged.', 'affirmed', true, false],
    ['No shipment of Zephyr QX-100 has been arranged.', undefined, true, false],
    ['No shipment of Zephyr QX-100 has been arranged.', null, true, false],
    ['No shipment of Zephyr QX-100 has been arranged.', 'negative', true, false],
    ['Ada Marlow states that no shipment of Zephyr QX-100 has been arranged.', 'affirmed', true, false],
    ['Ada Marlow recorded that no Zephyr QX-100 inspection was completed.', 'affirmed', true, false],
    [
      'No Zephyr QX-100 shipment has been arranged, but service terms permit inspection.',
      'affirmed',
      true,
      false,
    ],
    ['Ada Marlow states that no shipment of Zephyr QX-100 has been arranged.', 'negated', true, true],
    ['Ada Marlow states that no shipment of Zephyr QX-100 has been arranged.', 'affirmed', false, true],
    [
      'Ada Marlow states that no more than five Zephyr QX-100 inspections were recorded.',
      'affirmed',
      true,
      true,
    ],
    ['No less than five Zephyr QX-100 inspections were recorded.', 'affirmed', true, true],
    ['No doubt the Zephyr QX-100 service is available.', 'affirmed', true, true],
    ['Ada Marlow states that no question the Zephyr QX-100 service is available.', 'affirmed', true, true],
    ['No wonder the Zephyr QX-100 service is available.', 'affirmed', true, true],
    ['No matter who owns Zephyr QX-100, the service is available.', 'affirmed', true, true],
    ['No sooner had Zephyr QX-100 arrived than inspection began.', 'affirmed', true, true],
    ['No end of Zephyr QX-100 inspections have been completed.', 'affirmed', true, true],
    ['No later than the stated deadline, Zephyr QX-100 inspections were recorded.', 'affirmed', true, true],
    [
      'Ada Marlow states that Zephyr QX-100 inspection is available; no shipment has been arranged.',
      'affirmed',
      true,
      true,
    ],
  ] as const)(
    'holds only the leading generated negative proposition (%s)',
    (text, polarity, generated, accepted) => {
      const result = cleanCandidateBatch(
        [
          {
            kind: 'claim',
            text,
            subject: 'Zephyr QX-100',
            attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
            discourse: { commitment: 'asserted', disposition: 'active' },
            epistemic: { basis: 'self_attested' },
            polarity,
            support: [{ quote: text }],
            discourse_frame: [{ quote: text }],
          },
        ],
        { sourceText: text, generated },
      );
      expect(result.candidates).toHaveLength(accepted ? 1 : 0);
      if (!accepted) expect(result.held[0]?.reason).toContain('leading negative proposition');
    },
  );

  it.each([
    [
      'claim',
      'hypothetical',
      'active',
      'Ada Marlow described hypothetical Zephyr QX-100 repair coverage; no actual agreement is established.',
    ],
    [
      'plan',
      'asserted',
      'rejected',
      'Ada Marlow rejected the Zephyr QX-100 shipment proposal; no shipment has been arranged.',
    ],
  ])(
    'keeps a qualified positive proposition separate from an adjacent negative (%s/%s)',
    (kind, commitment, disposition, text) => {
      const result = cleanCandidateBatch(
        [
          {
            kind,
            text,
            subject: 'Zephyr QX-100',
            attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
            discourse: { commitment, disposition },
            epistemic: { basis: 'self_attested' },
            polarity: 'affirmed',
            support: [{ quote: text }],
            discourse_frame: [{ quote: text }],
          },
        ],
        { sourceText: text, generated: true },
      );
      expect(result.candidates).toHaveLength(1);
    },
  );

  it.each(['accepted', 'unchanged', 'unsupported'] as const)(
    'requires a negative-clause repair to pass full verification (%s)',
    async (outcome) => {
      const source = 'Ada Marlow states that no shipment of Zephyr QX-100 has been arranged.';
      const candidate = {
        kind: 'claim',
        text: source,
        subject: 'Zephyr QX-100',
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        discourse: { commitment: 'asserted', disposition: 'active' },
        epistemic: { basis: 'self_attested' },
        polarity: 'affirmed',
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      };
      const chat = vi.fn(
        async (messages: { content: string }[], options: { languageReferences?: unknown[] }) => {
          const call = chat.mock.calls.length;
          if (call <= 2) expect(options.languageReferences).toEqual([{ kind: 'identifier', text: 'QX-100' }]);
          if (call === 1)
            return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
          const payload = JSON.parse(messages.at(-1)!.content);
          if (call === 2) {
            expect(payload.validation_issues[0].reason).toContain('leading negative proposition');
            return {
              ok: true,
              value: JSON.stringify(
                repairBatch([{ ...candidate, polarity: outcome === 'unchanged' ? 'affirmed' : 'negated' }]),
              ),
              latencyMs: 22,
            };
          }
          expect(payload.candidates[0].text).toBe(source);
          expect(payload.candidates[0].polarity).toBe('negated');
          return {
            ok: true,
            value: JSON.stringify({
              verdicts: payload.candidates.map((c: { candidate_id: string }) => ({
                candidate_id: c.candidate_id,
                ...semanticAudit(outcome === 'accepted', true, true),
                proposition_supported: outcome === 'accepted',
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: outcome === 'accepted' ? null : 'discourse_uncertain',
              })),
            }),
            latencyMs: 33,
          };
        },
      );
      const model = {
        available: true,
        modelId: 'invented-denial-repair',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(result.candidates).toHaveLength(outcome === 'accepted' ? 1 : 0);
      expect(chat).toHaveBeenCalledTimes(outcome === 'unchanged' ? 2 : 3);
      if (outcome === 'unsupported') expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed discussing a fictional example in which the Zephyr QX-100 warranty covers repairs.',
      true,
      true,
      false,
    ],
    [
      'claim',
      'active',
      'asserted',
      'Ada Marlow described an invented story where the Zephyr QX-100 warranty covers repairs.',
      true,
      true,
      false,
    ],
    [
      'claim',
      'active',
      'hypothetical',
      'Ada Marlow described a fictional example in which the Zephyr QX-100 warranty covers repairs.',
      true,
      true,
      true,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed discussing a fictional example about Zephyr QX-100.',
      true,
      true,
      true,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed inspecting Zephyr QX-100, where the control button is located.',
      true,
      true,
      true,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed a fictional example. The Zephyr QX-100 is where the story ends.',
      true,
      true,
      true,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed discussing a fictional example in which the Zephyr QX-100 warranty covers repairs.',
      false,
      true,
      true,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed discussing a fictional example in which the Zephyr QX-100 warranty covers repairs.',
      true,
      false,
      true,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed обсуждение в вымышленном примере, где гарантия Zephyr QX-100 покрывает ремонт.',
      true,
      true,
      false,
    ],
    [
      'plan',
      'proposed',
      'asserted',
      'Ada Marlow proposed вымышленную историю, в которой гарантия Zephyr QX-100 покрывает ремонт.',
      true,
      true,
      false,
    ],
  ])(
    'separates introduced fiction from its discussion plan (%s/%s/%s: %s)',
    (kind, disposition, commitment, text, fictionalFrame, generated, accepted) => {
      const source = fictionalFrame
        ? 'Ada Marlow proposed discussing a fictional example about Zephyr QX-100.'
        : 'Ada Marlow proposed discussing the Zephyr QX-100 warranty.';
      const result = cleanCandidateBatch(
        [
          {
            kind,
            text,
            subject: 'Zephyr QX-100',
            attribution: { source_role: 'user' },
            discourse: { commitment, disposition },
            epistemic: { basis: 'self_attested' },
            support: [{ quote: source }],
            discourse_frame: [{ quote: source }],
          },
        ],
        { sourceText: source, generated },
      );
      expect(result.candidates).toHaveLength(accepted ? 1 : 0);
      if (!accepted) expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
    },
  );

  it('allows a real discussion plan whose relative clause identifies the fictional artifact', () => {
    const source =
      'Ada Marlow proposed discussing a fictional story that Bo Winters wrote about Zephyr QX-100.';
    const result = cleanCandidateBatch(
      [
        {
          kind: 'plan',
          text: source,
          subject: 'Zephyr QX-100',
          attribution: { source_role: 'user' },
          discourse: { commitment: 'asserted', disposition: 'proposed' },
          epistemic: { basis: 'self_attested' },
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source, generated: true },
    );
    expect(result.candidates).toHaveLength(1);
  });

  it.each(['still-asserted', 'verified', 'unsupported'] as const)(
    'keeps introduced-fiction repair subject to structural and semantic checks (%s)',
    async (outcome) => {
      const source =
        'Ada Marlow proposed discussing a fictional example in which the Zephyr QX-100 warranty covers repairs.';
      const candidate = {
        kind: 'plan',
        text: source,
        subject: 'Zephyr QX-100',
        attribution: { source_role: 'user' },
        discourse: { commitment: 'asserted', disposition: 'proposed' },
        epistemic: { basis: 'self_attested' },
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      };
      const repaired =
        outcome === 'still-asserted'
          ? { ...candidate, text: source.replace('example in which', 'story where') }
          : { ...candidate, kind: 'claim', discourse: { commitment: 'hypothetical', disposition: 'active' } };
      const chat = vi.fn(async (messages: { content: string }[]) => {
        const call = chat.mock.calls.length;
        if (call === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        if (call === 2) {
          expect(payload.validation_issues[0].reason).toContain('introduced fictional proposition');
          return { ok: true, value: JSON.stringify(repairBatch([repaired])), latencyMs: 22 };
        }
        expect(payload.candidates[0].discourse.commitment).toBe('hypothetical');
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map((c: { candidate_id: string }) => ({
              candidate_id: c.candidate_id,
              ...semanticAudit(outcome === 'verified', true, true),
              proposition_supported: outcome === 'verified',
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: outcome === 'verified' ? null : 'discourse_uncertain',
            })),
          }),
          latencyMs: 33,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-fiction-repair',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(result.candidates).toHaveLength(outcome === 'verified' ? 1 : 0);
      expect(chat).toHaveBeenCalledTimes(outcome === 'still-asserted' ? 2 : 3);
      if (outcome === 'unsupported') expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([true, false])(
    'completes generated frames while keeping semantic verification authoritative (%s)',
    async (supported) => {
      const sentences = [
        'I declined the optional Zephyr QX-100 warranty.',
        'Had I chosen it, inspection during year six would have been covered.',
        'That is an unrealized alternative, and I did not choose that warranty.',
      ];
      const source = sentences.join(' ');
      const decision = {
        kind: 'decision',
        text: 'Ada Marlow declined the optional Zephyr QX-100 warranty.',
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        discourse: { commitment: 'asserted', disposition: 'rejected' },
        epistemic: { basis: 'self_attested' },
        support: [{ quote: source }],
        discourse_frame: [{ quote: sentences[0] }, { quote: sentences[2] }],
      };
      const counterfactual = {
        ...decision,
        kind: 'claim',
        text: 'Ada Marlow described the unrealized counterfactual that inspection during year six would have been covered had she chosen the Zephyr QX-100 warranty.',
        discourse: { commitment: 'counterfactual', disposition: 'active' },
        discourse_frame: [{ quote: source }],
      };
      // Exact provided candidates retain their strict, model-free span contract.
      const strict = cleanCandidateBatch([decision, counterfactual], { sourceText: source });
      expect(strict.candidates).toHaveLength(1);
      expect(strict.held[0]?.reason_code).toBe('discourse_uncertain');
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return {
            ok: true,
            value: JSON.stringify({ candidates: [decision, counterfactual] }),
            latencyMs: 11,
          };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.candidates).toHaveLength(2);
        expect(payload.candidates[0].text).toBe(decision.text);
        expect(payload.candidates[0].discourse_frame).toEqual([
          ...decision.discourse_frame,
          { quote: source },
        ]);
        expect(payload.candidates[1].discourse_frame).toEqual(counterfactual.discourse_frame);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map(
              (c: { candidate_id: string; frame_spans?: { frame_id: string }[] }, i: number) => ({
                candidate_id: c.candidate_id,
                ...frameAuditFields(c),
                ...semanticAudit(i === 0 ? supported : true, true, true),
                proposition_supported: i === 0 ? supported : true,
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: i === 0 && !supported ? 'discourse_uncertain' : null,
              }),
            ),
          }),
          latencyMs: 22,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-frame-verifier',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
      expect(result.candidates).toHaveLength(supported ? 2 : 1);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([false, true])('holds excessive context without truncation or legacy fallback (%s)', (legacy) => {
    const spans = Array.from({ length: 17 }, (_, i) => ({
      quote: `Invented context sentence number ${i + 1}.`,
    }));
    const source = spans.map((s) => s.quote).join(' ');
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text: 'The Zephyr QX-100 warranty covers inspection.',
          support: [spans[0]],
          discourse_frame: spans,
          ...(legacy ? { evidence: spans[0]!.quote, frame: spans[0]!.quote } : {}),
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('source_unavailable');
  });

  it('holds generated completion that would exceed the frame cap', async () => {
    const spans = Array.from({ length: 17 }, (_, i) => ({ quote: `Invented context sentence ${i + 1}.` }));
    const source = spans.map((span) => span.quote).join(' ');
    const candidate = {
      kind: 'claim',
      text: 'The Zephyr QX-100 warranty covers inspection.',
      support: [spans[16]],
      discourse_frame: spans.slice(0, 16),
    };
    const chat = vi.fn(async (messages: { content: string }[]) => {
      if (chat.mock.calls.length === 2) {
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.validation_issues[0].reason_code).toBe('discourse_uncertain');
        return { ok: true, value: JSON.stringify(repairBatch([candidate])), latencyMs: 11 };
      }
      return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
    });
    const model = {
      available: true,
      modelId: 'invented-frame-verifier',
      chat,
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;
    const result = await runRetain(source, model);
    expect(result.candidates).toEqual([]);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

  it.each([
    ['Ada Marlow confirmed the hypothesis that silverpine requires inspection.', 'claim', 'active', true],
    ['The silverpine inspection hypothesis was confirmed by Ada Marlow.', 'claim', 'active', true],
    ['Ada Marlow decided to document the hypothesis in the silverpine record.', 'decision', 'accepted', true],
    ['The formerly unsupported silverpine hypothesis was confirmed.', 'claim', 'active', true],
    ['Ada Marlow confirmed the competing silverpine hypothesis was wrong.', 'claim', 'active', true],
    ['Ada Marlow rejected the competing silverpine hypothesis.', 'decision', 'accepted', true],
    ['The unsupported silverpine hypothesis was not confirmed.', 'claim', 'active', false],
    ['The unsupported silverpine hypothesis might have been confirmed.', 'claim', 'active', false],
    ['The silverpine inspection hypothesis remains unconfirmed.', 'claim', 'active', false],
    ['Ada Marlow hypothesizes that silverpine requires inspection.', 'claim', 'active', false],
    ['Ada Marlow hypothesised that silverpine requires inspection.', 'claim', 'active', false],
  ] as const)(
    'separates unresolved hypotheses from established statements about them: %s',
    (source, kind, disposition, accepted) => {
      const result = cleanCandidateBatch(
        [
          {
            kind,
            text: source,
            discourse: { commitment: 'asserted', disposition },
            attribution: { source_role: 'user' },
            epistemic: { basis: 'self_attested' },
            support: [{ quote: source }],
            discourse_frame: [{ quote: source }],
          },
        ],
        { sourceText: source },
      );
      expect(result.candidates).toHaveLength(accepted ? 1 : 0);
    },
  );

  it.each(['hypothesis', 'hypotheses'])(
    'holds an asserted %s while accepting faithful uncertain metadata',
    (noun) => {
      const source = `Ada Marlow is keeping the unconfirmed ${noun} that silverpine requires inspection.`;
      const candidate = {
        kind: 'claim',
        text: source,
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        epistemic: { basis: 'self_attested' },
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      };
      for (const commitment of ['asserted', 'tentative', 'hypothetical']) {
        const result = cleanCandidateBatch(
          [{ ...candidate, discourse: { commitment, disposition: 'active' } }],
          { sourceText: source },
        );
        expect(result.candidates).toHaveLength(commitment === 'asserted' ? 0 : 1);
        if (commitment === 'asserted')
          expect(result.held[0]?.reason_code).toBe('noncanonical_without_context');
      }
      // Removing uncertainty from generated prose must not hide it in the exact source frame.
      const flattened = cleanCandidateBatch(
        [
          {
            ...candidate,
            text: 'The silverpine warranty requires inspection.',
            discourse: { commitment: 'asserted', disposition: 'active' },
          },
        ],
        { sourceText: source },
      );
      expect(flattened.candidates).toEqual([]);
      expect(flattened.held[0]?.reason_code).toBe('discourse_uncertain');
    },
  );

  it.each([
    'This is unverified.',
    'This is not independently verified.',
    'This has not been independently confirmed.',
    '',
  ])('preserves explicit lack of report verification in readable prose (%s)', (qualification) => {
    const preserved = qualification !== '';
    const source = 'Bo Winters reported silverpine inspection coverage. There is no confirmation.';
    const text = `Ada Marlow recorded that Bo Winters reported silverpine inspection coverage. ${qualification}`;
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text,
          attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
          discourse: { commitment: 'asserted', disposition: 'active' },
          epistemic: { basis: 'source_report' },
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toHaveLength(preserved ? 1 : 0);
    if (!preserved) expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

  it.each([
    'I have not confirmed it.',
    'It was not confirmed.',
    'It has not been independently confirmed.',
    'Я не подтвердила это.',
    'Это не было подтверждено.',
  ])('holds an omitted explicit lack of confirmation: %s', (qualification) => {
    const report = 'Bo Winters reported silverpine inspection coverage.';
    const source = `${report} ${qualification}`;
    const result = cleanCandidateBatch(
      [
        {
          kind: 'claim',
          text: `Ada Marlow recorded that ${report}`,
          attribution: { source_role: 'user' },
          discourse: { commitment: 'asserted', disposition: 'active' },
          epistemic: { basis: 'source_report' },
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

  it.each([
    ['question', 'tentative', 'active', 'commitment must be none'],
    ['question', 'asserted', 'active', 'commitment must be none'],
    ['decision', 'asserted', 'resolved', 'disposition must be accepted, rejected, superseded'],
  ])('reports precise structural repair guidance for %s/%s/%s', (kind, commitment, disposition, reason) => {
    const source = 'Ada Marlow recorded a question about silverpine inspection.';
    const result = cleanCandidateBatch(
      [
        {
          kind,
          text: source,
          discourse: { commitment, disposition },
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
    expect(result.held[0]?.reason).toContain(reason);
  });

  it.each(['rejected', 'cancelled', 'completed'])(
    'preserves plan disposition %s instead of normalizing it to a proposal',
    (disposition) => {
      const source = `Ada Marlow recorded the ${disposition} plan for silverpine inspection.`;
      const result = cleanCandidateBatch(
        [
          {
            kind: 'plan',
            text: source,
            discourse: { commitment: 'asserted', disposition },
            attribution: { source_role: 'user' },
            support: [{ quote: source }],
            discourse_frame: [{ quote: source }],
          },
        ],
        { sourceText: source },
      );
      expect(result.candidates[0]?.discourse.disposition).toBe(disposition);
    },
  );

  it.each([
    { commitment: 'invented-invalid', disposition: 'proposed' },
    { commitment: 'asserted', disposition: 'active' },
  ])('holds invalid explicit plan semantics instead of silently changing status (%s)', (discourse) => {
    const source = 'Ada Marlow discussed a silverpine inspection proposal.';
    const result = cleanCandidateBatch(
      [
        {
          kind: 'plan',
          text: source,
          discourse,
          support: [{ quote: source }],
          discourse_frame: [{ quote: source }],
        },
      ],
      { sourceText: source },
    );
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

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

  it.each([
    ['Zephyr QX-100', 'The Zephyr QX-100 warranty covers inspection.', true],
    ['Zephyr QX-100', 'The warranty covers inspection.', false],
    ['Zephyr QX-100', 'The Zephyr QX-1000 warranty covers inspection.', false],
    ['Zephyr QX-1000', 'The warranty covers inspection.', true],
  ])(
    'keeps source-supported subject identifiers in generated readable prose: %s %s',
    (subject, text, accepted) => {
      const source = 'The Zephyr QX-100 warranty covers inspection.';
      const candidate = {
        kind: 'claim',
        subject,
        text,
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      };
      const result = cleanCandidateBatch([candidate], { sourceText: source, generated: true });
      expect(result.candidates).toHaveLength(accepted ? 1 : 0);
      if (!accepted) expect(result.held[0]?.reason).toContain('subject identifier');
      expect(cleanCandidateBatch([candidate], { sourceText: source }).candidates).toHaveLength(1);
    },
  );

  it.each([
    ['The silverpine service provides pickup for inspection.', null, true],
    ['The silverpine pickup is scheduled for inspection.', null, false],
    ['The silverpine pickup is already booked for inspection.', null, false],
    ['The silverpine pickup is not scheduled for inspection.', null, true],
    ['No handover of the silverpine device has been booked.', null, true, 'negated'],
    ['Ada Marlow states that no appointment has been booked.', null, true],
    ['The offer was declined, and no handover of Zephyr QX-100 has been booked.', null, true],
    ['No handover has been booked; the inspection is scheduled.', null, false, 'negated'],
    ['The inspection is scheduled, but no handover has been booked.', null, false],
    ['No appointment was delayed, and the inspection is scheduled.', null, false, 'negated'],
    ['No appointment with Ada Marlow has been booked.', null, true, 'negated'],
    ['No appointment with Ada Marlow remains although the handover is booked.', null, false, 'negated'],
    ['No appointment with Ada Marlow remains while the handover is booked.', null, false, 'negated'],
    ['No appointment with Ada Marlow remains whereas the handover is booked.', null, false, 'negated'],
    ['No appointment with Ada Marlow remains because the handover is booked.', null, false, 'negated'],
    ['No appointment with Ada Marlow confirms the handover is booked.', null, false, 'negated'],
    ['No fewer than two inspections are scheduled.', null, false],
    ['No doubt the inspection is scheduled.', null, false],
    [
      'The silverpine pickup was scheduled for 2031-04-11.',
      { start: '2031-04-11', precision: 'day', relation: 'scheduled', status: 'scheduled' },
      true,
    ],
    [
      'The silverpine pickup is scheduled, but its date is unknown.',
      { precision: 'unknown', relation: 'scheduled', status: 'scheduled' },
      true,
    ],
    [
      'The silverpine pickup is scheduled for inspection.',
      { start: '2031-04-11', precision: 'day', relation: 'occurred', status: 'actual' },
      false,
    ],
  ] as const)(
    'requires generated schedule prose to agree with its time envelope: %s',
    (text, time, accepted, polarity = 'affirmed') => {
      const candidate = {
        kind: 'claim',
        text,
        polarity,
        discourse: { commitment: 'asserted', disposition: 'active' },
        attribution: { source_role: 'user' },
        support: [{ quote: text }],
        discourse_frame: [{ quote: text }],
        time,
      };
      const result = cleanCandidateBatch([candidate], { sourceText: text, generated: true });
      expect(result.candidates).toHaveLength(accepted ? 1 : 0);
      if (!accepted) expect(result.held[0]?.reason_code).toBe('time_unresolved');
      // Exact caller input does not opt into the automatic representation check.
      expect(cleanCandidateBatch([candidate], { sourceText: text }).candidates).toHaveLength(1);
    },
  );

  it.each([false, true])(
    'repairs a generated schedule inconsistency without treating the repair as evidence (%s)',
    async (supported) => {
      const source = 'Для silverpine предусмотрен забор на осмотр.';
      const bad = {
        kind: 'claim',
        text: 'The silverpine pickup is scheduled for inspection.',
        attribution: { source_role: 'user' },
        discourse: { commitment: 'asserted', disposition: 'active' },
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
        time: null,
      };
      const corrected = { ...bad, text: 'The silverpine service provides pickup for inspection.' };
      const invented = { ...bad, time: { precision: 'unknown', relation: 'scheduled', status: 'scheduled' } };
      const chat = vi.fn(async (messages: { content: string }[]) => {
        const payload = JSON.parse(messages.at(-1)!.content);
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [bad] }), latencyMs: 11 };
        if (chat.mock.calls.length === 2) {
          expect(payload.validation_issues[0].reason_code).toBe('time_unresolved');
          expect(payload.source.text).toBe(source);
          return {
            ok: true,
            value: JSON.stringify(repairBatch([supported ? corrected : invented])),
            latencyMs: 11,
          };
        }
        expect(payload.source.text).toBe(source);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map((c: { candidate_id: string }) => ({
              candidate_id: c.candidate_id,
              ...semanticAudit(supported, true, true),
              proposition_supported: supported,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: supported ? null : 'time_unresolved',
            })),
          }),
          latencyMs: 11,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-schedule-checker',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(3);
      expect(result.candidates).toHaveLength(supported ? 1 : 0);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([false, true])(
    'keeps open inclusion/exclusion alternatives without answering the question (%s)',
    async (answersItself) => {
      const source =
        'Ada Marlow has an open silverpine question: whether a crate is provided or excluded. No answer is recorded.';
      const candidate = {
        kind: 'question',
        text: answersItself
          ? 'Ada Marlow’s silverpine crate question is answered: a crate is excluded.'
          : 'Ada Marlow has an open silverpine question about a crate, making no claim either that it is provided or excluded.',
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        discourse: { commitment: 'none', disposition: 'active' },
        polarity: 'affirmed',
        support: [{ quote: source }],
        discourse_frame: [{ quote: source }],
      };
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.text).toBe(source);
        expect(payload.candidates[0].discourse.commitment).toBe('none');
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: [
              {
                candidate_id: payload.candidates[0].candidate_id,
                ...semanticAudit(!answersItself, true, true),
                proposition_supported: !answersItself,
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: answersItself ? 'discourse_uncertain' : null,
              },
            ],
          }),
          latencyMs: 11,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-question-checker',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.candidates).toHaveLength(answersItself ? 0 : 1);
      if (answersItself) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

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
            value: JSON.stringify(
              repairBatch([
                { ...candidate, time: repair ? { ...candidate.time, mentioned_at: null } : null },
              ]),
            ),
            latencyMs: 22,
          };
        }
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map((c: { candidate_id: string }) => ({
              candidate_id: c.candidate_id,
              ...semanticAudit(true, true, true),
              proposition_supported: true,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
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
      const bad = { ...good, discourse: { commitment: 'asserted', disposition: 'active' } };
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
            value: JSON.stringify(repairBatch([outcome === 'still-invalid' ? bad : good])),
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
                ...semanticAudit(outcome === 'accepted', true, true),
                proposition_supported: outcome === 'accepted',
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: outcome === 'accepted' ? null : 'discourse_uncertain',
              }))
              .flatMap(
                (verdict: {
                  candidate_id: string;
                  proposition_supported: boolean;
                  action_arguments_preserved: boolean;
                  qualification_scope_preserved: boolean;
                  reason_code: string | null;
                }) =>
                  outcome === 'duplicate-verdict'
                    ? [
                        verdict,
                        {
                          ...verdict,
                          ...semanticAudit(true, true, true),
                          proposition_supported: true,
                          action_arguments_preserved: true,
                          qualification_scope_preserved: true,
                          reason_code: null,
                        },
                      ]
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
    [
      'Ada Marlow proposed reviewing the Zephyr QX-100 warranty tomorrow relative to the original recording, whose reference date is unknown.',
      true,
    ],
    ['Ada Marlow proposed reviewing silverpine tomorrow relative to the undated original note.', true],
    [
      'Ada Marlow proposed reviewing silverpine tomorrow relative to the moment of the original record; the calendar date cannot be recovered.',
      true,
    ],
    [
      'Ada Marlow proposed reviewing silverpine tomorrow relative to the moment of inspection; the calendar date is unknown.',
      false,
    ],
    ['Ada Marlow proposed reviewing silverpine tomorrow; the original note is undated.', false],
    [
      'Ada Marlow proposed reviewing silverpine tomorrow relative to the original note; calendar dates cannot be recovered.',
      true,
    ],
    [
      'Ada Marlow proposed reviewing silverpine tomorrow relative to the original recording; its date could not be determined.',
      true,
    ],
    [
      'Ada Marlow proposed reviewing silverpine tomorrow relative to the original note; the device cannot be recovered.',
      false,
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
                    ...semanticAudit(true, true, true),
                    proposition_supported: true,
                    action_arguments_preserved: true,
                    qualification_scope_preserved: true,
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
