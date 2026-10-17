import { describe, expect, it, vi } from 'vitest';
import type { ProvidedRetainCandidate } from '@tenphi/akno-protocol';
import type { ModelClient } from '../models/client.ts';
import { decidingSupport } from './deciding-support.ts';

const oldText = 'Ada Marlow booked journey JRN-1111 for 2035-04-11; the single 1111 EUR payment is complete.';
const nextText =
  'Ada Marlow corrected journey JRN-1111 to 2035-04-22 instead of 2035-04-11; the payment is unchanged and departure has not occurred.';
const attribution = { source_role: 'user' as const, source_speaker: 'Ada Marlow' };
const earlier = [{ memoryId: 'mem_old', text: oldText, evidence: oldText, attribution }];
const candidate: ProvidedRetainCandidate = {
  candidate_id: 'correction-2222',
  text: nextText,
  kind: 'claim',
  subject: 'journey JRN-1111',
  attribution,
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  support: [{ quote: nextText }],
  discourse_frame: [{ quote: nextText }],
};
const selection = { withdrawals: [{ earlier_id: 'old_0', deciding_id: 'new_0', deciding_quote: nextText }] };
const valid = {
  earlier_id: 'old_0',
  deciding_id: 'new_0',
  same_assertion_and_authority: true,
  explicit_withdrawal: true,
  deciding_representation_preserves_meaning: true,
  deciding_status: 'withdrawal',
  comparison: {
    earlier_assertion: oldText,
    deciding_assertion: nextText,
    withdrawn_scope: 'The earlier date for the same journey.',
    authority: 'Ada Marlow corrects her own record.',
  },
  mismatches: [] as string[],
};
function stub(responses: unknown[]) {
  const chat = vi.fn(async () => ({ ok: true, value: JSON.stringify(responses.shift()), latencyMs: 1 }));
  return {
    chat,
    model: { available: true, modelId: 'invented-decision-model', chat } as unknown as ModelClient,
  };
}

describe('deciding support authority', () => {
  it('requires an independent supported withdrawal and exposes both call receipts', async () => {
    const { model, chat } = stub([selection, { verdicts: [valid] }]);
    expect(await decidingSupport(model, earlier, [candidate])).toMatchObject({
      superseded: ['mem_old'],
      pending: [],
      receipts: [{ model: 'invented-decision-model' }, { model: 'invented-decision-model' }],
    });
    expect(chat).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(chat.mock.calls)).toContain(oldText);
  });
  it.each([
    { verdicts: [{ ...valid, deciding_status: 'unresolved', explicit_withdrawal: false }] },
    { verdicts: [{ ...valid, mismatches: ['identity'] }] },
    { verdicts: [] },
    { verdicts: [valid, valid] },
    { verdicts: [{ ...valid, deciding_status: 'unrelated' }] },
  ])('holds uncertainty without promoting a deciding relationship: %j', async (verification) => {
    const { model } = stub([selection, verification]);
    expect(await decidingSupport(model, earlier, [candidate])).toMatchObject({
      superseded: [],
      pending: [{ earlierMemory: 'mem_old', decidingCandidate: 'correction-2222' }],
      degraded: 'deciding_relation_unavailable',
    });
  });
  it('does not turn an independent rejection of the nomination into replacement authority', async () => {
    const { model } = stub([
      selection,
      {
        verdicts: [
          {
            ...valid,
            deciding_status: 'unrelated',
            same_assertion_and_authority: false,
            explicit_withdrawal: false,
          },
        ],
      },
    ]);
    expect(await decidingSupport(model, earlier, [candidate])).toMatchObject({ superseded: [], pending: [] });
  });
  it('cannot use another speaker to override an earlier assertion', async () => {
    const { model, chat } = stub([selection]);
    expect(
      await decidingSupport(model, earlier, [
        { ...candidate, attribution: { ...attribution, source_speaker: 'Bo Winters' } },
      ]),
    ).toMatchObject({ superseded: [] });
    expect(chat).toHaveBeenCalledTimes(1);
  });
  it('uses unadmitted source intent only to hold earlier meaning, never as accepted replacement evidence', async () => {
    const { model } = stub([selection, { verdicts: [valid] }]);
    expect(
      await decidingSupport(
        model,
        earlier,
        [],
        [{ candidate_id: candidate.candidate_id, text: nextText, attribution }],
      ),
    ).toMatchObject({
      superseded: [],
      pending: [{ earlierMemory: 'mem_old', decidingCandidate: candidate.candidate_id }],
      degraded: 'deciding_relation_unavailable',
    });
  });
  it('does not accept a deciding quotation absent from the exact source frame', async () => {
    const { model, chat } = stub([
      { withdrawals: [{ ...selection.withdrawals[0], deciding_quote: 'Absent deciding evidence.' }] },
    ]);
    expect(await decidingSupport(model, earlier, [candidate])).toMatchObject({
      superseded: [],
      pending: [{ earlierMemory: 'mem_old', decidingCandidate: 'correction-2222' }],
      degraded: 'deciding_relation_unavailable',
    });
    expect(chat).toHaveBeenCalledTimes(1);
  });

  describe('a long correlated source', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => {
        const text = `Ada Marlow chose locker ${1000 + i} at Blackwater Bay.`;
        return { memoryId: `mem_${i}`, text, evidence: text, attribution };
      });
    type Payload = { earlier: { id: string; text: string }[]; admitted: { id: string }[] };
    const payloadOf = (call: unknown) =>
      JSON.parse((call as [{ content: string }[]])[0][1]!.content) as Payload;

    it('compares every earlier record in bounded batches instead of holding the whole group', async () => {
      const chat = vi.fn(async () => ({
        ok: true,
        value: JSON.stringify({ withdrawals: [] }),
        latencyMs: 1,
      }));
      const model = { available: true, modelId: 'invented-decision-model', chat } as unknown as ModelClient;
      const result = await decidingSupport(model, many(40), [candidate], undefined, 2);
      expect(result).toEqual({ superseded: [], pending: [], receipts: expect.any(Array) });
      const batches = chat.mock.calls.map(payloadOf);
      expect(batches.map((batch) => batch.earlier.length)).toEqual([16, 16, 8]);
      expect(batches.flatMap((batch) => batch.earlier.map((item) => item.text))).toEqual(
        many(40).map((item) => item.text),
      );
      expect(result.receipts).toHaveLength(3);
    });

    it('maps a withdrawal nominated in a later batch to its own earlier record', async () => {
      const earlierRecords = [...many(20), { ...earlier[0]!, memoryId: 'mem_journey' }];
      const chat = vi.fn(async (messages: { role: string; content: string }[]) => {
        const payload = JSON.parse(messages[1]!.content) as Payload;
        const old = payload.earlier.find((item) => item.text === oldText);
        const verifying = messages[0]!.content.includes('Independently verify');
        const value = !old
          ? { withdrawals: [] }
          : verifying
            ? { verdicts: [{ ...valid, earlier_id: old.id }] }
            : { withdrawals: [{ ...selection.withdrawals[0], earlier_id: old.id }] };
        return { ok: true, value: JSON.stringify(value), latencyMs: 1 };
      });
      const model = { available: true, modelId: 'invented-decision-model', chat } as unknown as ModelClient;
      expect(await decidingSupport(model, earlierRecords, [candidate])).toMatchObject({
        superseded: ['mem_journey'],
        pending: [],
      });
      expect(chat).toHaveBeenCalledTimes(3);
    });

    it('holds only the record that cannot fit any comparison', async () => {
      const oversized = { ...many(1)[0]!, memoryId: 'mem_oversized', evidence: 'Locker note. '.repeat(3000) };
      const chat = vi.fn(async () => ({
        ok: true,
        value: JSON.stringify({ withdrawals: [] }),
        latencyMs: 1,
      }));
      const model = { available: true, modelId: 'invented-decision-model', chat } as unknown as ModelClient;
      expect(await decidingSupport(model, [...many(3), oversized, ...many(5).slice(3)], [candidate])).toEqual(
        {
          superseded: [],
          receipts: expect.any(Array),
          pending: [{ earlierMemory: 'mem_oversized', decidingCandidate: 'correction-2222' }],
          degraded: 'deciding_relation_unavailable',
        },
      );
      expect(chat.mock.calls.map(payloadOf).map((batch) => batch.earlier.length)).toEqual([3, 2]);
    });

    it('splits incoming records that would crowd earlier records out of a comparison', async () => {
      const chat = vi.fn(async () => ({
        ok: true,
        value: JSON.stringify({ withdrawals: [] }),
        latencyMs: 1,
      }));
      const model = { available: true, modelId: 'invented-decision-model', chat } as unknown as ModelClient;
      const intents = Array.from({ length: 3 }, (_, i) => ({
        candidate_id: `source-intent-${i}`,
        text: `Bo Winters wrote about locker ${2000 + i}. `.repeat(250),
        attribution,
      }));
      expect(await decidingSupport(model, many(4), [], intents)).toMatchObject({
        superseded: [],
        pending: [],
      });
      const batches = chat.mock.calls.map(payloadOf);
      expect(batches.map((batch) => batch.admitted.length)).toEqual([1, 1, 1]);
      expect(batches.every((batch) => JSON.stringify(batch).length <= 32000)).toBe(true);
    });
  });
});
