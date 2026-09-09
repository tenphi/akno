import { describe, expect, it, vi } from 'vitest';
import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { ModelClient } from '../models/client.ts';
import { runRetain } from './retain.ts';
import { frameAuditFields, semanticAudit } from '../../test/semantic-audit.ts';

const sourceItems: RetainSourceItem[] = [
  {
    item_id: 'turn-1111',
    role: 'user',
    speaker: 'Ada Marlow',
    text: 'Ada Marlow declined an offer to send Zephyr QX-100 for inspection.',
  },
  {
    item_id: 'turn-2222',
    role: 'user',
    speaker: 'Ada Marlow',
    text: 'No handover of the device has been booked. The offered shipment was rejected, not accepted.',
  },
];
const candidate = {
  kind: 'claim',
  subject: 'Zephyr QX-100',
  text: 'Ada Marlow states that no handover of Zephyr QX-100, referred to as “the device,” has been booked.',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'negated',
  time: null,
  support: [{ item_id: 'turn-2222', quote: 'No handover of the device has been booked.' }],
  discourse_frame: [
    { item_id: 'turn-2222', quote: 'No handover of the device has been booked.' },
    { item_id: 'turn-1111', quote: sourceItems[0]!.text },
  ],
};

describe('a negative booking subject with a quoted noun alias', () => {
  it.each([true, false])(
    'preserves all original source context and requires semantics: %s',
    async (supported) => {
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.items).toEqual(sourceItems);
        expect(payload.candidates[0].text).toBe(candidate.text);
        expect(payload.candidates[0].time).toBeUndefined();
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map(
              (c: { candidate_id: string; frame_spans: { frame_id: string }[] }) => ({
                candidate_id: c.candidate_id,
                ...frameAuditFields(c),
                ...semanticAudit(supported, true, true),
                proposition_supported: supported,
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: supported ? null : 'discourse_uncertain',
              }),
            ),
          }),
          latencyMs: 11,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-booking-alias',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain('', model, { sourceItems });
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
      expect(result.candidates).toHaveLength(supported ? 1 : 0);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );
});
