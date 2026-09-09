import { semanticAudit } from '../../test/semantic-audit.ts';
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
  it.each([
    'pass',
    ...Object.keys(dimensions),
    'missing',
    'legacy',
    'duplicate',
    'wrong-id',
    'missing-comparison',
    'false-without-mismatch',
    'true-with-mismatch',
    'accepted-with-hold-reason',
    'duplicate-mismatch',
  ])('requires every dimension and an exact verdict set without semantic repair: %s', async (mode) => {
    const chat = vi.fn(async (messages: { content: string }[]) => {
      if (chat.mock.calls.length === 1)
        return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
      const payload = JSON.parse(messages.at(-1)!.content);
      expect(payload.source.text).toBe(source);
      expect(payload.candidates[0].text).toBe(candidate.text);
      const verdict: Record<string, unknown> = {
        candidate_id: payload.candidates[0].candidate_id,
        ...semanticAudit(
          mode !== 'proposition_supported',
          mode !== 'action_arguments_preserved',
          mode !== 'qualification_scope_preserved',
        ),
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
      if (mode === 'missing-comparison') delete verdict.comparison;
      if (mode === 'false-without-mismatch') verdict.proposition_supported = false;
      if (mode === 'true-with-mismatch') verdict.mismatches = semanticAudit(false).mismatches;
      if (mode === 'accepted-with-hold-reason') verdict.reason_code = 'source_unavailable';
      if (mode === 'duplicate-mismatch') {
        verdict.proposition_supported = false;
        verdict.mismatches = [...semanticAudit(false).mismatches, ...semanticAudit(false).mismatches];
      }
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
    if (
      [
        'missing',
        'legacy',
        'duplicate',
        'wrong-id',
        'missing-comparison',
        'false-without-mismatch',
        'true-with-mismatch',
        'accepted-with-hold-reason',
        'duplicate-mismatch',
      ].includes(mode)
    )
      expect(result.degradedReason).toBe('retain_verification_failed');
  });
});

describe('bounded first-pass retention verification', () => {
  it.each([true, false])(
    'checks all fifty candidates once and preserves usage availability (%s)',
    async (usageKnown) => {
      const records = Array.from({ length: 50 }, (_, index) => {
        const text = `Ada Marlow states that the silverpine inspection marker is code-${index}.`;
        return {
          ...candidate,
          text,
          subject: 'silverpine',
          support: [{ quote: text }],
          discourse_frame: [{ quote: text }],
        };
      });
      const completeSource = records.map((record) => record.text).join(' ');
      const seen: string[] = [];
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.text).toBe(completeSource);
        expect(payload.candidates).toHaveLength(2);
        expect(payload.related_candidates).toHaveLength(48);
        const verdicts = payload.candidates.map((record: { candidate_id: string }) => {
          seen.push(record.candidate_id);
          return { candidate_id: record.candidate_id, ...semanticAudit(), ...dimensions, reason_code: null };
        });
        return {
          ok: true,
          value: JSON.stringify({ verdicts }),
          latencyMs: 22,
          ...(usageKnown ? { usage: { inputTokens: 111, outputTokens: 22, totalTokens: 133 } } : {}),
        };
      });
      const model = {
        available: true,
        chat,
        modelId: 'invented-verifier',
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(completeSource, model);
      expect(result.candidates).toHaveLength(50);
      expect(chat).toHaveBeenCalledTimes(26);
      expect(seen).toHaveLength(50);
      expect(new Set(seen).size).toBe(50);
      expect(result.modelUsage.verification).toMatchObject({
        latency_ms: 22 * 25,
        input_tokens: usageKnown ? 111 * 25 : null,
        output_tokens: usageKnown ? 22 * 25 : null,
        total_tokens: usageKnown ? 133 * 25 : null,
      });
    },
  );

  it('holds cross-batch and transitive dependents of a semantically rejected target', async () => {
    const texts = [
      'The silverpine inspection conclusion supersedes the earlier recommendation.',
      'The silverpine inspection recommendation supersedes the initial proposal.',
      'The silverpine initial proposal calls for an inspection.',
    ];
    const completeSource = texts.join(' ');
    const records = texts.map((text, index) => ({
      ...candidate,
      text,
      subject: 'silverpine',
      support: [{ quote: text }],
      discourse_frame: [{ quote: completeSource }],
      relations:
        index < 2 ? [{ type: 'supersedes', target_candidate: index + 1, support: [{ quote: text }] }] : [],
    }));
    const checkedIds: string[] = [];
    const chat = vi.fn(async (messages: { content: string }[]) => {
      if (chat.mock.calls.length === 1)
        return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
      const payload = JSON.parse(messages.at(-1)!.content);
      return {
        ok: true,
        latencyMs: 22,
        value: JSON.stringify({
          verdicts: payload.candidates.map((record: { candidate_id: string; text: string }) => {
            checkedIds.push(record.candidate_id);
            const supported = record.text !== texts[2];
            return {
              candidate_id: record.candidate_id,
              ...semanticAudit(supported),
              ...dimensions,
              proposition_supported: supported,
              reason_code: supported ? null : 'discourse_uncertain',
            };
          }),
        }),
      };
    });
    const model = {
      available: true,
      chat,
      modelId: 'invented-verifier',
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;
    const result = await runRetain(completeSource, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(checkedIds).toHaveLength(3);
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(3);
    expect(result.held.every((held) => held.hold_stage === 'verification')).toBe(true);
    expect(result.degradedReason).toBeNull();
  });
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

describe('record-local tentative scope in retention verification', () => {
  const items = [
    {
      item_id: 'turn-1111',
      role: 'user' as const,
      speaker: 'Ada Marlow',
      text: 'I, Ada Marlow, am discussing two competing preliminary hypotheses about the silverpine fault: a slipping drive belt or a jammed cooling fan.',
    },
    {
      item_id: 'turn-2222',
      role: 'user' as const,
      speaker: 'Ada Marlow',
      text: 'Neither hypothesis has supporting evidence, and I have not selected a cause.',
    },
  ];
  const completeSource = items.map((item) => item.text).join('\n');
  const record = {
    kind: 'claim',
    subject: 'silverpine',
    text: 'Ada Marlow is discussing two competing preliminary hypotheses about the silverpine fault: a slipping drive belt or a jammed cooling fan; neither hypothesis has supporting evidence, and Ada Marlow has not selected a cause.',
    attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
    discourse: { commitment: 'tentative', disposition: 'active' },
    epistemic: { basis: 'self_attested' },
    polarity: 'affirmed',
    support: items.map((item) => ({ quote: item.text, item_id: item.item_id })),
    discourse_frame: items.map((item) => ({ quote: item.text, item_id: item.item_id })),
  };

  it('keeps the asserted embedded-hypothesis tuple outside factual admission', () => {
    const checked = cleanCandidateBatch(
      [{ ...record, discourse: { commitment: 'asserted', disposition: 'active' } }],
      { sourceItems: items, generated: true },
    );
    expect(checked.candidates).toEqual([]);
    expect(checked.held[0]?.reason_code).toBe('noncanonical_without_context');
  });

  it.each(['pass', 'proposition_supported', 'action_arguments_preserved', 'qualification_scope_preserved'])(
    'carries scoped label definitions without bypassing any source-verdict dimension: %s',
    async (mode) => {
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [record] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.items).toEqual(items);
        expect(payload).not.toHaveProperty('repair_targets');
        const verifyingRecord = payload.candidates[0];
        expect(verifyingRecord.text).toBe(record.text);
        expect(verifyingRecord.discourse).toEqual(record.discourse);
        expect(verifyingRecord.record_scope.join(' ')).toContain(
          'supplied source and candidate explicitly couple',
        );
        expect(verifyingRecord.record_scope.join(' ')).toContain(
          'Otherwise tentative qualifies the proposition normally',
        );
        expect(verifyingRecord.frame_spans.map((span: { quote: string }) => span.quote)).toEqual(
          items.map((item) => item.text),
        );
        return {
          ok: true,
          latencyMs: 22,
          value: JSON.stringify({
            verdicts: [
              {
                candidate_id: verifyingRecord.candidate_id,
                span_audit: verifyingRecord.frame_spans.map((span: { frame_id: string }) => ({
                  frame_id: span.frame_id,
                  interpretation:
                    'This span supplies part of the coupled preliminary hypotheses, their evidence limit and personal nonselection.',
                  relationship: 'restatement',
                })),
                ...semanticAudit(
                  mode !== 'proposition_supported',
                  mode !== 'action_arguments_preserved',
                  mode !== 'qualification_scope_preserved',
                ),
                proposition_supported: mode !== 'proposition_supported',
                action_arguments_preserved: mode !== 'action_arguments_preserved',
                qualification_scope_preserved: mode !== 'qualification_scope_preserved',
                reason_code: null,
              },
            ],
          }),
        };
      });
      const model = {
        available: true,
        chat,
        modelId: 'invented-scope-verifier',
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(completeSource, model, { sourceItems: items });
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
      expect(result.candidates).toHaveLength(mode === 'pass' ? 1 : 0);
      expect(JSON.stringify(result.candidates)).not.toContain('record_scope');
      if (mode !== 'pass') expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );
});
