import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import { retentionAudit } from '../../test/semantic-audit.ts';
import { runRetain } from './retain.ts';

type Polarity = 'affirmed' | 'negated';
const denial = 'Ada Marlow has not arranged shipment of her Zephyr QX-100.';
const positive = 'Ada Marlow arranged inspection of her Zephyr QX-100.';
function candidate(text: string, polarity: Polarity) {
  return {
    text,
    subject: 'Zephyr QX-100',
    kind: 'claim',
    attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
    discourse: { commitment: 'asserted', disposition: 'active' },
    epistemic: { basis: 'self_attested' },
    polarity,
    support: [{ quote: text }],
    discourse_frame: [{ quote: text }],
  };
}

// These source decisions are explicit fixture expectations, independent of submitted metadata.
// The stub tests the server's enforcement, not whether a model can classify these meanings.
const scopes = [
  { name: 'personal nonaction', record: candidate(denial, 'negated'), sourcePolarity: 'negated' },
  {
    name: 'positive report with personal negatives and contrast',
    record: {
      ...candidate(
        'According to Ada Marlow, Bo Winters says Zephyr QX-100 terms permit spring measurement, not replacement. Ada Marlow has not read the terms or independently checked the report.',
        'affirmed',
      ),
      attribution: {
        source_role: 'user',
        source_speaker: 'Ada Marlow',
        chain: [{ speaker: 'Bo Winters', role: 'external' }],
      },
      epistemic: { basis: 'source_report' },
    },
    sourcePolarity: 'affirmed',
  },
  {
    name: 'embedded report denial',
    record: {
      ...candidate(
        'According to Ada Marlow, Bo Winters says the Zephyr QX-100 crate was not dispatched.',
        'negated',
      ),
      attribution: {
        source_role: 'user',
        source_speaker: 'Ada Marlow',
        chain: [{ speaker: 'Bo Winters', role: 'external' }],
      },
      epistemic: { basis: 'source_report' },
    },
    sourcePolarity: 'negated',
  },
  {
    name: 'fictional positive predicate',
    record: {
      ...candidate(
        'In Ada Marlow’s fictional example, Vulpine Mutual promises a free Zephyr QX-100 inspection. This is not a real contract.',
        'affirmed',
      ),
      discourse: { commitment: 'hypothetical', disposition: 'active' },
    },
    sourcePolarity: 'affirmed',
  },
  {
    name: 'counterfactual positive predicate with nonoccurrence',
    record: {
      ...candidate(
        'In Ada Marlow’s counterfactual, if she had purchased the optional Zephyr QX-100 extension, inspection would have been covered. She did not purchase it; this does not establish actual coverage.',
        'affirmed',
      ),
      discourse: { commitment: 'counterfactual', disposition: 'active' },
    },
    sourcePolarity: 'affirmed',
  },
  {
    name: 'rejected positive plan',
    record: {
      ...candidate(
        'Ada Marlow rejected the proposed Zephyr QX-100 inspection plan; it is not an active obligation.',
        'affirmed',
      ),
      kind: 'plan',
      discourse: { commitment: 'asserted', disposition: 'rejected' },
    },
    sourcePolarity: 'affirmed',
  },
  {
    name: 'question existence with unresolved embedded answers',
    record: {
      ...candidate(
        'Ada Marlow has an open question whether the Zephyr QX-100 crate was dispatched. Neither answer is established.',
        'affirmed',
      ),
      kind: 'question',
      discourse: { commitment: 'none', disposition: 'active' },
    },
    sourcePolarity: 'affirmed',
  },
] as const;

describe('independent retention source-polarity comparison', () => {
  it.each(scopes)(
    'keeps governing scope separate from incidental negation: $name',
    async ({ record, sourcePolarity }) => {
      for (const matching of [true, false]) {
        const submitted = {
          ...record,
          polarity: matching ? sourcePolarity : sourcePolarity === 'affirmed' ? 'negated' : 'affirmed',
        };
        const chat = vi.fn(async (messages: { content: string }[], options: any) => {
          if (chat.mock.calls.length === 1)
            return { ok: true, value: JSON.stringify({ candidates: [submitted] }), latencyMs: 11 };
          const payload = JSON.parse(messages.at(-1)!.content);
          expect(payload.source.text).toBe(record.text);
          expect(payload.candidates[0].polarity).toBe(submitted.polarity);
          expect(payload.candidates[0].discourse_frame[0].quote).toBe(record.text);
          expect(messages[0]!.content).toContain('value to compare, never evidence');
          expect(options.maxTokens).toBe(2224);
          return {
            ok: true,
            latencyMs: 22,
            value: JSON.stringify({
              verdicts: [
                {
                  candidate_id: payload.candidates[0].candidate_id,
                  source_selected_polarity: sourcePolarity,
                  ...retentionAudit(payload.candidates[0], true, true, true, sourcePolarity),
                  proposition_supported: true,
                  action_arguments_preserved: true,
                  qualification_scope_preserved: true,
                  reason_code: null,
                },
              ],
            }),
          };
        });
        const model = {
          available: true,
          modelId: 'invented-polarity-verifier',
          chat,
          reportInvalidResponse: vi.fn(),
        } as unknown as ModelClient;
        const result = await runRetain(record.text, model);
        expect(chat).toHaveBeenCalledTimes(2);
        expect(result.modelUsage.repair).toBeUndefined();
        expect(result.degradedReason).toBeNull();
        expect(model.reportInvalidResponse).not.toHaveBeenCalled();
        expect(result.candidates).toHaveLength(matching ? 1 : 0);
        if (!matching)
          expect(result.held).toEqual([
            expect.objectContaining({ hold_stage: 'verification', reason_code: 'discourse_uncertain' }),
          ]);
      }
    },
  );

  it.each([
    'match',
    'first-mismatch',
    'swapped-polarities',
    'semantic-negative',
    'missing',
    'invalid',
    'duplicate-id',
    'foreign-id',
    'truncated',
    'trailing',
  ] as const)(
    'keeps opposite source decisions candidate-local and atomic failures unavailable: %s',
    async (mode) => {
      const records = [candidate(denial, 'negated'), candidate(positive, 'affirmed')];
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        const verdicts: Record<string, unknown>[] = payload.candidates.map(
          (item: { candidate_id: string; polarity: string }, index: number) => {
            const supported = !(mode === 'semantic-negative' && index === 0);
            return {
              candidate_id: item.candidate_id,
              source_selected_polarity: index === 0 ? 'negated' : 'affirmed',
              ...retentionAudit(item, supported),
              proposition_supported: supported,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: null,
            };
          },
        );
        if (mode === 'first-mismatch') verdicts[0]!.source_selected_polarity = 'affirmed';
        if (mode === 'swapped-polarities')
          [verdicts[0]!.source_selected_polarity, verdicts[1]!.source_selected_polarity] = [
            'affirmed',
            'negated',
          ];
        if (mode === 'first-mismatch' || mode === 'swapped-polarities')
          for (const [index, verdict] of verdicts.entries())
            verdict.polarity_evidence = retentionAudit(
              payload.candidates[index],
              true,
              true,
              true,
              String(verdict.source_selected_polarity),
            ).polarity_evidence;
        if (mode === 'missing') delete verdicts[1]!.source_selected_polarity;
        if (mode === 'invalid') verdicts[1]!.source_selected_polarity = 'unknown';
        if (mode === 'duplicate-id') verdicts[1]!.candidate_id = verdicts[0]!.candidate_id;
        if (mode === 'foreign-id') verdicts[1]!.candidate_id = 'invented-foreign';
        const value = JSON.stringify({ verdicts });
        return {
          ok: true,
          latencyMs: 22,
          value:
            mode === 'truncated' ? value.slice(0, -1) : mode === 'trailing' ? value + ' trailing' : value,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-polarity-verifier',
        chat,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(`${denial} ${positive}`, model);
      const malformed = [
        'missing',
        'invalid',
        'duplicate-id',
        'foreign-id',
        'truncated',
        'trailing',
      ].includes(mode);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
      expect(result.degradedReason).toBe(malformed ? 'retain_verification_failed' : null);
      expect(result.candidates.map((item) => item.text)).toEqual(
        mode === 'match'
          ? [denial, positive]
          : ['first-mismatch', 'semantic-negative'].includes(mode)
            ? [positive]
            : [],
      );
      expect(model.reportInvalidResponse).toHaveBeenCalledTimes(malformed ? 1 : 0);
      if (!malformed && mode !== 'match')
        expect(
          result.held.every(
            (item) => item.hold_stage === 'verification' && item.reason_code === 'discourse_uncertain',
          ),
        ).toBe(true);
    },
  );
});
