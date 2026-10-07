import { describe, expect, it, vi } from 'vitest';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import type { ModelClient } from '../models/client.ts';
import { runRetain } from './retain.ts';

const source =
  'Journey JRN-3333 to Blackwater Bay is booked for 2037-04-11. Its single 1111 EUR payment was completed.';

describe('retained predicate and time attachment', () => {
  it.each([
    'undated-payment',
    'dated-payment',
    'scheduled',
    'occurred',
    'missing-audit',
    'unbound',
    'incomplete',
  ])('independently checks date attachment and occurrence status: %s', async (mode) => {
    const dated = mode === 'dated-payment';
    const journey = mode === 'scheduled' || mode === 'occurred';
    const text = journey
      ? `Journey JRN-3333 to Blackwater Bay ${mode === 'occurred' ? 'occurred on' : 'is booked for'} 2037-04-11.`
      : `Journey JRN-3333's single 1111 EUR payment was completed${dated ? ' on 2037-04-11' : ''}.`;
    const candidate = {
      kind: journey ? 'event' : 'claim',
      text,
      subject: 'journey JRN-3333',
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
      discourse: { commitment: 'asserted', disposition: 'active' },
      epistemic: { basis: 'self_attested' },
      support: [{ quote: source }],
      discourse_frame: [{ quote: source }],
      ...(journey
        ? {
            time: {
              precision: 'day',
              start: '2037-04-11',
              status: mode === 'occurred' ? 'actual' : 'scheduled',
              relation: mode === 'occurred' ? 'occurred' : 'scheduled',
            },
          }
        : {}),
    };
    const chat = vi.fn(async (messages: { content: string }[]) => {
      if (chat.mock.calls.length === 1)
        return { ok: true, latencyMs: 11, value: JSON.stringify({ candidates: [candidate] }) };
      const payload = JSON.parse(messages.at(-1)!.content);
      const selected = payload.candidates[0];
      const audit = {
        comparisons: [
          {
            source: {
              frame_id: mode === 'unbound' ? 'F99' : 'F1',
              predicate: journey ? 'Booked journey' : 'Completed single payment',
              timing: journey ? '2037-04-11' : null,
              status: journey ? 'scheduled' : 'completed',
              time_relation: journey ? 'scheduled' : 'occurred',
            },
            candidate: {
              predicate: journey ? 'Journey' : 'Completed single payment',
              timing: journey || dated ? '2037-04-11' : null,
              status: mode === 'occurred' ? 'occurred' : journey ? 'scheduled' : 'completed',
              time_relation: mode === 'occurred' ? 'occurred' : journey ? 'scheduled' : 'occurred',
            },
            // Even a positive relation and three broad booleans cannot supply a missing date.
            relation: mode === 'occurred' ? 'changed' : 'preserved',
          },
        ],
        complete: mode !== 'incomplete',
      };
      const verdict: Record<string, unknown> = {
        candidate_id: selected.candidate_id,
        ...frameAuditFields(selected),
        ...retentionAudit(selected),
        source_selected_polarity: 'affirmed',
        proposition_supported: true,
        action_arguments_preserved: true,
        qualification_scope_preserved: true,
        predicate_time_audit: audit,
        reason_code: null,
      };
      if (mode === 'missing-audit') delete verdict.predicate_time_audit;
      return { ok: true, latencyMs: 11, value: JSON.stringify({ verdicts: [verdict] }) };
    });
    const result = await runRetain(source, {
      available: true,
      modelId: 'invented-time-auditor',
      chat,
      reportInvalidResponse: vi.fn(),
      degradedReason: () => null,
    } as unknown as ModelClient);
    expect(result.candidates).toHaveLength(['undated-payment', 'scheduled'].includes(mode) ? 1 : 0);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.modelUsage.repair).toBeUndefined();
    if (['missing-audit', 'unbound'].includes(mode))
      expect(result.degradedReason).toBe('retain_verification_failed');
    else if (!['undated-payment', 'scheduled'].includes(mode))
      expect(result.held[0]).toMatchObject({
        reason_code: 'discourse_uncertain',
        hold_stage: 'verification',
      });
  });
});
