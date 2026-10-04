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
});
