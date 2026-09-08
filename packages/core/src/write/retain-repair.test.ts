import { semanticAudit } from '../../test/semantic-audit.ts';
import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

const report =
  'Ada Marlow recorded that Bo Winters said silverpine inspection might be included, not replacement. This report is unverified.';
const minor = 'Ada Marlow has not arranged shipment of silverpine.';
const source = `${report} ${minor}`;
const good = {
  text: minor,
  subject: 'silverpine',
  kind: 'claim',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'negated',
  support: [{ quote: minor }],
  discourse_frame: [{ quote: minor }],
};
const fixed = {
  ...good,
  text: 'Ada Marlow relays Bo Winters’s unverified report that silverpine inspection might be included, not replacement.',
  attribution: {
    source_role: 'user',
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' }],
  },
  discourse: { commitment: 'tentative', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: [{ quote: report }],
  discourse_frame: [{ quote: report }],
};
const bad = { ...fixed, text: 'Bo Winters says silverpine inspection is included.' };

function modelFor(extracted: unknown[], repair: unknown, verify = true) {
  const chat = vi.fn(async (messages: { content: string }[]) => {
    const call = chat.mock.calls.length;
    if (call === 1)
      return {
        ok: true,
        value: JSON.stringify({
          candidates: extracted,
          events: [{ date: '2031-04-11', summary: 'Ada Marlow completed an invented inspection.' }],
        }),
        latencyMs: 11,
      };
    if (call === 2) {
      if (repair === 'unavailable')
        return { ok: false, value: null, error: 'invented repair outage', latencyMs: 22 };
      return { ok: true, value: repair === 'malformed' ? '{oops' : JSON.stringify(repair), latencyMs: 22 };
    }
    expect(call).toBe(3);
    const payload = JSON.parse(messages.at(-1)!.content);
    return {
      ok: true,
      value: JSON.stringify({
        verdicts: payload.candidates.map((c: { candidate_id: string; text: string }) => ({
          candidate_id: c.candidate_id,
          ...semanticAudit(verify || c.text === minor, true, true),
          proposition_supported: verify || c.text === minor,
          action_arguments_preserved: true,
          qualification_scope_preserved: true,
          reason_code: null,
        })),
      }),
      latencyMs: 33,
    };
  });
  return {
    model: {
      available: true,
      modelId: 'invented-repair-model',
      chat,
      degradedReason: () => 'derive_failed',
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient,
    chat,
  };
}

describe('one transactional structural repair', () => {
  it.each([true, false])(
    'repairs the deciding report while preserving the admitted minor record (verified=%s)',
    async (verify) => {
      const { model, chat } = modelFor(
        [bad, good],
        { repairs: [{ candidate_index: 0, candidate: fixed }] },
        verify,
      );
      const original = cleanCandidateBatch([bad, good], { sourceText: source, generated: true }).candidates;
      expect(original).toHaveLength(1);
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(3);
      const request = JSON.parse(chat.mock.calls[1]![0].at(-1)!.content);
      expect(request.admitted_positions).toEqual([1]);
      const verificationRequest = JSON.parse(chat.mock.calls[2]![0].at(-1)!.content);
      expect(verificationRequest.repair_obligations).toEqual([
        {
          candidate_id: verificationRequest.candidates.find(
            (candidate: { text: string }) => candidate.text === fixed.text,
          ).candidate_id,
          original: bad,
        },
      ]);
      expect(
        request.validation_issues.map((entry: { candidate_index: number }) => entry.candidate_index),
      ).toEqual([0]);
      expect(result.candidates.find((candidate) => candidate.text === minor)).toEqual(original[0]);
      expect(result.candidates).toHaveLength(verify ? 2 : 1);
      expect(result.modelUsage.repair?.latency_ms).toBe(22);
      expect(result.degradedReason).toBeNull();
      expect(result.events).toEqual([
        { date: '2031-04-11', summary: 'Ada Marlow completed an invented inspection.' },
      ]);
      if (!verify) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([
    'unavailable',
    'malformed',
    {
      repairs: [
        { candidate_index: 0, candidate: fixed },
        { candidate_index: 0, candidate: fixed },
      ],
    },
    { repairs: [{ candidate_index: 2, candidate: fixed }] },
    { repairs: [{ candidate_index: 1, candidate: fixed }] },
    { repairs: [{ candidate_index: 0.5, candidate: fixed }] },
    { repairs: [{ candidate_index: 0, candidate: good }] },
    {
      repairs: [{ candidate_index: 0, candidate: fixed }],
      events: [{ date: '2031-05-22', summary: 'An unauthorized event.' }],
    },
  ])('preserves and verifies admitted records after an invalid repair: %j', async (repair) => {
    const { model, chat } = modelFor([bad, good], repair);
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(result.candidates).toEqual(
      cleanCandidateBatch([bad, good], { sourceText: source, generated: true }).candidates,
    );
    expect(result.held).toHaveLength(1);
    expect(result.held[0]?.hold_stage).toBe('validation');
    expect(result.error).toBeNull();
    expect(result.degradedReason).toBe('derive_failed');
  });

  it('keeps omitted failed positions held and still verifies admitted records', async () => {
    const { model, chat } = modelFor([bad, good], { repairs: [] });
    const result = await runRetain(source, model);
    expect(result.candidates).toHaveLength(1);
    expect(result.held).toHaveLength(1);
    expect(result.degradedReason).toBeNull();
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it('uses the same position transaction for an all-held batch', async () => {
    const { model, chat } = modelFor([bad], { repairs: [{ candidate_index: 0, candidate: fixed }] });
    const result = await runRetain(source, model);
    expect(result.candidates).toHaveLength(1);
    expect(result.held).toEqual([]);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(JSON.parse(chat.mock.calls[1]![0].at(-1)!.content).admitted_positions).toEqual([]);
  });

  it('rejects two failed positions repaired into one duplicate proposition', async () => {
    const brokenMinor = { ...good, text: 'Shipment unarranged.' };
    const { model, chat } = modelFor([bad, brokenMinor], {
      repairs: [
        { candidate_index: 0, candidate: fixed },
        { candidate_index: 1, candidate: fixed },
      ],
    });
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(2);
    expect(result.degradedReason).toBe('derive_failed');
    expect(result.error).toContain('lost an original position');
  });

  it.each([1, 0, 2])('keeps original relation indices after a repair (target=%s)', async (target) => {
    const old = 'Ada Marlow states that the silverpine warranty lasts five years.';
    const replacement = 'Bo Winters states that the silverpine warranty lasts seven years.';
    const conflict = 'These assertions contradict each other.';
    const fullSource = `${old} ${replacement} ${conflict}`;
    const admitted = {
      ...good,
      text: old,
      polarity: 'affirmed',
      support: [{ quote: old }],
      discourse_frame: [{ quote: old }],
    };
    const repaired = {
      ...fixed,
      text: replacement,
      attribution: { source_role: 'external', source_speaker: 'Bo Winters' },
      discourse: { commitment: 'asserted', disposition: 'active' },
      support: [{ quote: replacement }],
      discourse_frame: [{ quote: fullSource }],
      relations: [{ type: 'contradicts', target_candidate: target, support: [{ quote: conflict }] }],
    };
    const broken = { ...repaired, text: 'silverpine warranty' };
    const { model, chat } = modelFor([broken, admitted], {
      repairs: [{ candidate_index: 0, candidate: repaired }],
    });
    const result = await runRetain(fullSource, model);
    const kept = result.candidates.find((candidate) => candidate.text === old)!;
    expect(kept).toBeDefined();
    expect(result.candidates).toHaveLength(target === 1 ? 2 : 1);
    if (target === 1)
      expect(result.candidates[0]?.relations[0]?.target).toEqual({ candidate_id: kept.candidate_id });
    else expect(result.held).toHaveLength(1);
    expect(chat).toHaveBeenCalledTimes(3);
  });
});
