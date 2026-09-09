import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RetainSourceItem } from '@tenphi/akno-protocol';
import { ModelClient } from '../models/client.ts';
import { semanticAudit, frameAuditFields } from '../../test/semantic-audit.ts';
import { runRetain } from './retain.ts';
import { retentionFrameAudit } from './retention-frame-audit.ts';

afterEach(() => vi.unstubAllGlobals());

const items: RetainSourceItem[] = [
  {
    item_id: 'turn-1111',
    role: 'user',
    speaker: 'Ada Marlow',
    text: 'Bo Winters says the Zephyr QX-100 terms permit dial adjustment.',
  },
  {
    item_id: 'turn-2222',
    role: 'user',
    speaker: 'Ada Marlow',
    text: 'I mean adjustment of the regulator, not its replacement. I have not examined the terms or confirmed his report.',
  },
];
const frame = items.map((item) => ({ item_id: item.item_id, quote: item.text }));
const record = {
  subject: 'Zephyr QX-100',
  kind: 'claim',
  text: "Ada Marlow relays Bo Winters's unverified report that Zephyr QX-100 terms permit regulator adjustment, not replacement; she has not examined the terms or confirmed the report.",
  attribution: {
    source_role: 'user',
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' }],
  },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: frame,
  discourse_frame: frame,
};

describe('required retention frame accounting', () => {
  it.each([
    'complete',
    'reversed-order',
    'semantic-negative',
    'missing',
    'duplicate',
    'foreign',
    'extra',
    'partial',
    'empty-meaning',
    'unknown-relationship',
    'truncated',
    'missing-root-closer',
    'missing-container-closers',
    'trailing-content',
  ])('requires the exact source-span set before accepting semantic judgments: %s', async (mode) => {
    const chat = vi.fn(async (messages: { content: string }[]) => {
      if (chat.mock.calls.length === 1)
        return { ok: true, value: JSON.stringify({ candidates: [record] }), latencyMs: 11 };
      const payload = JSON.parse(messages.at(-1)!.content);
      expect(payload.source.items).toEqual(items);
      expect(payload.candidates[0].frame_spans).toEqual(
        frame.map((span, i) => ({ frame_id: `F${i + 1}`, ...span })),
      );
      const verdict: Record<string, unknown> = {
        candidate_id: payload.candidates[0].candidate_id,
        source_selected_polarity: 'affirmed',
        span_audit: [
          {
            frame_id: 'F1',
            interpretation: 'Bo reports permitted adjustment; the object is clarified in the second span.',
            relationship: 'restatement',
          },
          {
            frame_id: 'F2',
            interpretation:
              'The narrator clarifies regulator adjustment rather than replacement and her personal lack of examination or confirmation.',
            relationship: 'clarification',
          },
        ],
        ...semanticAudit(true, true, mode !== 'semantic-negative'),
        proposition_supported: true,
        action_arguments_preserved: true,
        qualification_scope_preserved: mode !== 'semantic-negative',
        reason_code: null,
      };
      const audit = verdict.span_audit as {
        frame_id: string;
        interpretation: string;
        relationship: string;
      }[];
      if (mode === 'reversed-order') audit.reverse();
      if (mode === 'missing') delete verdict.span_audit;
      if (mode === 'duplicate') audit[1]!.frame_id = 'F1';
      if (mode === 'foreign') audit[1]!.frame_id = 'F99';
      if (mode === 'extra') audit.push(audit[0]!);
      if (mode === 'partial') audit.pop();
      if (mode === 'empty-meaning') audit[0]!.interpretation = ' ';
      if (mode === 'unknown-relationship') audit[0]!.relationship = 'approved';
      let value = JSON.stringify({ verdicts: [verdict] });
      if (mode === 'truncated') value = '{"verdicts":[';
      if (mode === 'missing-root-closer') value = value.slice(0, -1);
      if (mode === 'missing-container-closers') value = value.slice(0, -2);
      if (mode === 'trailing-content') value += ' incomplete response';
      return { ok: true, value, latencyMs: 22 };
    });
    const model = {
      available: true,
      chat,
      modelId: 'invented-span-verifier',
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;
    const result = await runRetain('', model, { sourceItems: items });
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.modelUsage.repair).toBeUndefined();
    expect(result.candidates).toHaveLength(['complete', 'reversed-order'].includes(mode) ? 1 : 0);
    if (mode === 'semantic-negative') {
      expect(result.held[0]?.hold_stage).toBe('verification');
      expect(result.degradedReason).toBeNull();
    } else if (!['complete', 'reversed-order'].includes(mode)) {
      expect(result.degradedReason).toBe('retain_verification_failed');
      expect(model.reportInvalidResponse).toHaveBeenCalledOnce();
    }
  });

  it('binds repaired and admitted candidates to their own frames and exact original obligation', async () => {
    const denialItems: RetainSourceItem[] = [
      {
        item_id: 'turn-3333',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Ada Marlow states that no shipment of Zephyr QX-100 has been arranged.',
      },
      {
        item_id: 'turn-4444',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The shipment statement concerns the same device.',
      },
    ];
    const denialFrame = denialItems.map((item) => ({ item_id: item.item_id, quote: item.text }));
    const original = {
      ...record,
      text: denialItems[0]!.text,
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
      epistemic: { basis: 'self_attested' },
      support: denialFrame,
      discourse_frame: denialFrame,
    };
    const chat = vi.fn(async (messages: { content: string }[]) => {
      const payload = JSON.parse(messages.at(-1)!.content);
      if (chat.mock.calls.length === 1)
        return { ok: true, latencyMs: 11, value: JSON.stringify({ candidates: [record, original] }) };
      if (chat.mock.calls.length === 2) {
        expect(payload.repair_targets).toHaveLength(1);
        expect(payload.repair_targets[0].validation_issues).toHaveLength(1);
        expect(payload.repair_targets[0].candidate_index).toBe(1);
        return {
          ok: true,
          latencyMs: 22,
          value: JSON.stringify({
            repairs: [{ candidate_index: 1, candidate: { ...original, polarity: 'negated' } }],
          }),
        };
      }
      expect(payload.source.items).toEqual([...items, ...denialItems]);
      expect(payload.candidates).toHaveLength(2);
      expect(payload.repair_obligations).toEqual([
        { candidate_id: payload.candidates[1].candidate_id, original },
      ]);
      expect(payload.candidates.map((candidate: { frame_spans: unknown }) => candidate.frame_spans)).toEqual(
        [frame, denialFrame].map((spans) =>
          spans.map((span, index) => ({ frame_id: `F${index + 1}`, ...span })),
        ),
      );
      expect(payload.candidates[0].text).toBe(record.text);
      return {
        ok: true,
        latencyMs: 33,
        value: JSON.stringify({
          verdicts: payload.candidates.map(
            (candidate: {
              polarity: 'affirmed' | 'negated';
              candidate_id: string;
              frame_spans?: { frame_id: string }[];
            }) => ({
              candidate_id: candidate.candidate_id,
              source_selected_polarity: candidate.polarity,
              ...frameAuditFields(candidate),
              ...semanticAudit(),
              proposition_supported: true,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: null,
            }),
          ),
        }),
      };
    });
    const model = {
      available: true,
      chat,
      modelId: 'invented-repair-audit',
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;
    const result = await runRetain('', model, { sourceItems: [...items, ...denialItems] });
    expect(result.candidates).toHaveLength(2);
    expect(result.held).toEqual([]);
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it('sends the required schema through ModelClient and fails closed at a smaller configured ceiling', async () => {
    const requests: Record<string, any>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        requests.push(body);
        const extraction = requests.length === 1;
        if (!extraction) {
          const schema = JSON.stringify(body.response_format);
          expect(schema).toContain('span_audit');
          expect(schema).toContain('F1');
          expect(schema).toContain('F2');
          expect(body.max_tokens ?? body.max_completion_tokens).toBe(1111);
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: extraction ? JSON.stringify({ candidates: [record] }) : '{"verdicts":[' },
                finish_reason: extraction ? 'stop' : 'length',
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    const model = new ModelClient({
      role: 'derive',
      id: 'invented-capped-verifier',
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
      maxOutputTokens: 1111,
      unavailableReason: null,
    });
    const result = await runRetain('', model, { sourceItems: items });
    expect(requests).toHaveLength(2);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
  });

  it('keeps identical quote bytes in different source items as distinct frame coordinates', () => {
    const quote = 'The invented inspection remains unconfirmed.';
    const audit = retentionFrameAudit([
      { item_id: 'turn-1111', quote },
      { item_id: 'turn-2222', quote },
    ])!;
    expect(audit.spans).toEqual([
      { frame_id: 'F1', item_id: 'turn-1111', quote },
      { frame_id: 'F2', item_id: 'turn-2222', quote },
    ]);
    expect(retentionFrameAudit([{ quote }])).toBeNull();
  });

  it.each([
    [16, 16],
    [16, 1],
    [1, 1],
  ])(
    'budgets the exact audited frame count for a two-candidate first pass: %i and %i',
    async (first, second) => {
      const sizes = [first, second];
      const sourceItems: RetainSourceItem[] = [];
      const records = sizes.map((size, group) => {
        const spans = Array.from({ length: size }, (_, i) => {
          const item_id = `invented-${group}-${i}`;
          const text = `The Zephyr QX-100 inspection label is marker-${group}-${i}.`;
          sourceItems.push({ item_id, role: 'user', speaker: 'Ada Marlow', text });
          return { item_id, quote: text };
        });
        return {
          ...record,
          text: spans[0]!.quote,
          attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
          epistemic: { basis: 'self_attested' },
          support: [spans[0]],
          discourse_frame: spans,
        };
      });
      const chat = vi.fn(async (messages: { content: string }[], options: { maxTokens?: number }) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.candidates).toHaveLength(2);
        expect(options.maxTokens).toBe(
          1_024 + 2 * 1_200 + sizes.filter((n) => n > 1).reduce((sum, n) => sum + n, 0) * 160,
        );
        return {
          ok: true,
          latencyMs: 22,
          value: JSON.stringify({
            verdicts: payload.candidates.map(
              (candidate: {
                polarity: 'affirmed' | 'negated';
                candidate_id: string;
                frame_spans?: { frame_id: string }[];
              }) => ({
                candidate_id: candidate.candidate_id,
                source_selected_polarity: candidate.polarity,
                ...frameAuditFields(candidate),
                ...semanticAudit(),
                proposition_supported: true,
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: null,
              }),
            ),
          }),
        };
      });
      const model = {
        available: true,
        chat,
        modelId: 'invented-budget-verifier',
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain('', model, { sourceItems });
      expect(result.candidates).toHaveLength(2);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.verification).toMatchObject({
        input_tokens: null,
        output_tokens: null,
        latency_ms: 22,
      });
    },
  );

  it.each(['inconsistent', 'consistent-negative', 'clipped-summary-negative'] as const)(
    'keeps the atomic semantic contract with a nullable negative reason: %s',
    async (mode) => {
      const otherItems: RetainSourceItem[] = [
        {
          item_id: 'turn-3333',
          role: 'user',
          speaker: 'Ada Marlow',
          text: 'Ada Marlow states that Zephyr QX-100 has a blue dial.',
        },
        {
          item_id: 'turn-4444',
          role: 'user',
          speaker: 'Ada Marlow',
          text: 'The dial statement concerns the same device.',
        },
      ];
      const other = {
        ...record,
        text: otherItems[0]!.text,
        attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
        epistemic: { basis: 'self_attested' },
        support: [{ item_id: otherItems[0]!.item_id, quote: otherItems[0]!.text }],
        discourse_frame: otherItems.map(({ item_id, text: quote }) => ({ item_id, quote })),
      };
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [record, other] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.items).toEqual([...items, ...otherItems]);
        expect(messages[0]!.content).toContain('A detail absent from your summary is not thereby absent');
        return {
          ok: true,
          latencyMs: 11,
          value: JSON.stringify({
            verdicts: payload.candidates.map(
              (
                candidate: {
                  polarity: 'affirmed' | 'negated';
                  candidate_id: string;
                  frame_spans: { frame_id: string }[];
                },
                i: number,
              ) => ({
                candidate_id: candidate.candidate_id,
                source_selected_polarity: candidate.polarity,
                span_audit: candidate.frame_spans.map(({ frame_id }) => ({
                  frame_id,
                  interpretation:
                    i === 1 && mode !== 'consistent-negative'
                      ? 'An incomplete audit summary ends not an-'
                      : 'The source specifies this device and the statement belongs to its named speaker.',
                  relationship: 'restatement',
                })),
                ...semanticAudit(true, true, i === 0),
                proposition_supported: i === 0 || mode !== 'inconsistent',
                action_arguments_preserved: true,
                qualification_scope_preserved: i === 0,
                reason_code: null,
              }),
            ),
          }),
        };
      });
      const model = {
        available: true,
        modelId: 'invented-atomic-verifier',
        chat,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain('', model, { sourceItems: [...items, ...otherItems] });
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
      expect(result.candidates).toHaveLength(mode === 'inconsistent' ? 0 : 1);
      expect(result.degradedReason).toBe(mode === 'inconsistent' ? 'retain_verification_failed' : null);
      if (mode !== 'inconsistent') expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
    },
  );
});
