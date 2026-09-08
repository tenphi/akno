import { describe, expect, it, vi } from 'vitest';
import { cleanCandidateBatch, runRetain } from './retain.ts';
import type { ModelClient } from '../models/client.ts';

const source = 'Условия silverpine разрешают перевозку для осмотра клапана; замена клапана не предусмотрена.';
const candidate = {
  kind: 'claim',
  text: 'Silverpine terms allow transport for valve inspection, not valve replacement.',
  attribution: { source_role: 'user' },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  support: [{ quote: source }],
  discourse_frame: [{ quote: source }],
};
const dimensions = {
  proposition_supported: true,
  action_arguments_preserved: true,
  qualification_scope_preserved: true,
};

describe('retention semantic verification dimensions', () => {
  it.each(['pass', ...Object.keys(dimensions), 'missing', 'legacy', 'duplicate', 'wrong-id'])(
    'requires every dimension and an exact verdict set without semantic repair: %s',
    async (mode) => {
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.text).toBe(source);
        expect(payload.candidates[0].text).toBe(candidate.text);
        const verdict: Record<string, unknown> = {
          candidate_id: payload.candidates[0].candidate_id,
          ...dimensions,
          reason_code: null,
        };
        if (mode in dimensions) verdict[mode] = false;
        if (mode === 'missing') delete verdict.action_arguments_preserved;
        if (mode === 'legacy') {
          for (const key of Object.keys(dimensions)) delete verdict[key];
          verdict.supported = true;
        }
        if (mode === 'wrong-id') verdict.candidate_id = 'invented-other-candidate';
        return {
          ok: true,
          value: JSON.stringify({ verdicts: mode === 'duplicate' ? [verdict, verdict] : [verdict] }),
          latencyMs: 22,
        };
      });
      const model = {
        available: true,
        chat,
        modelId: 'invented-verifier',
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
      expect(result.candidates).toHaveLength(mode === 'pass' ? 1 : 0);
      if (mode in dimensions) expect(result.held[0]?.hold_stage).toBe('verification');
      if (['missing', 'legacy', 'duplicate', 'wrong-id'].includes(mode))
        expect(result.degradedReason).toBe('retain_verification_failed');
    },
  );
});

const report = 'Bo Winters сказал, что осмотр silverpine включён. Я, Ada Marlow, только передаю его слова.';
const reportCandidate = (chain: { speaker: string; role: string | null }[], text = report) => ({
  kind: 'claim',
  text: 'Ada Marlow relays Bo Winters’s report that silverpine inspection is included.',
  attribution: { source_role: 'external', source_speaker: 'Bo Winters', chain },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  support: [{ quote: text, item_id: 'turn-1111' }],
  discourse_frame: [{ quote: text, item_id: 'turn-1111' }],
});
const options = (text = report) => ({
  sourceItems: [{ item_id: 'turn-1111', role: 'user' as const, speaker: 'Ada Marlow', text }],
  generated: true as const,
});

describe('structured outer recorder and generated inner reporter', () => {
  it.each([
    [],
    [{ speaker: 'Ada Marlow', role: 'user' }],
    [
      { speaker: 'Bo Winters', role: 'external' },
      { speaker: 'Ada Marlow', role: 'user' },
    ],
    [
      { speaker: 'Bo Winters', role: 'external' },
      { speaker: 'Bo Winters', role: 'external' },
    ],
  ])('preserves the inner reporter once when correcting the outer recorder: %j', (chain) => {
    const result = cleanCandidateBatch([reportCandidate(chain)], options());
    expect(result.held).toEqual([]);
    expect(result.candidates[0]?.attribution).toEqual({
      source_role: 'user',
      source_speaker: 'Ada Marlow',
      chain: [{ speaker: 'Bo Winters', role: 'external' }],
    });
    expect(result.candidates[0]?.epistemic.basis).toBe('source_report');
  });

  it('leaves exact caller-provided chains outside generated normalization', () => {
    const result = cleanCandidateBatch([reportCandidate([])], { ...options(), generated: undefined });
    expect(result.candidates[0]?.attribution.chain).toBeUndefined();
  });

  it.each([
    'Bo Winters: a character in the silverpine example.',
    'The silverpine note describes Bo Winters and the inspection agreement.',
  ])('does not promote a displaced name without an actual reporting relation: %s', (text) => {
    const result = cleanCandidateBatch([reportCandidate([], text)], options(text));
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

  it.each([
    [{ speaker: 'Bo Winters', role: null }],
    [
      { speaker: 'Bo Winters', role: null },
      { speaker: 'Bo Winters', role: 'external' },
    ],
  ])('merges an unknown role with one concrete reporter role: %j', (chain) => {
    const result = cleanCandidateBatch([reportCandidate(chain)], options());
    expect(result.held).toEqual([]);
    expect(result.candidates[0]?.attribution.chain).toEqual([{ speaker: 'Bo Winters', role: 'external' }]);
  });

  it('holds a duplicated reporter with conflicting roles rather than choosing a role', () => {
    const result = cleanCandidateBatch(
      [
        reportCandidate([
          { speaker: 'Bo Winters', role: 'external' },
          { speaker: 'BO WINTERS', role: 'assistant' },
        ]),
      ],
      options(),
    );
    expect(result.candidates).toEqual([]);
    expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
  });

  it('holds overflow instead of discarding a nested reporter', () => {
    const text =
      'Bo Winters said that Cora Vale said that Dax Reed said that Etta Moss reported silverpine inspection was included.';
    const chain = ['Cora Vale', 'Dax Reed', 'Etta Moss'].map((speaker) => ({ speaker, role: 'external' }));
    const result = cleanCandidateBatch([reportCandidate(chain, text)], options(text));
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(1);
  });
});
