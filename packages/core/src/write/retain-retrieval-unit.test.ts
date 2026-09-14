import { describe, expect, it, vi } from 'vitest';
import { runRetain } from './retain.ts';
import type { ModelClient } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';

const question =
  'Ada Marlow has an open question whether the Zephyr QX-100 warranty includes latch inspections.';
const limit = 'Ada Marlow does not know the answer; this record establishes neither inclusion nor exclusion.';
const independent = 'Ada Marlow inspected the Zephyr QX-100 handle.';
const source = `${question} ${limit} ${independent}`;
const base = {
  kind: 'question',
  subject: 'Zephyr QX-100',
  text: `${question} ${limit}`,
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  discourse: { commitment: 'none', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'affirmed',
  support: [{ quote: `${question} ${limit}` }],
  discourse_frame: [{ quote: `${question} ${limit}` }],
  relations: [],
  time: null,
  page: null,
};

describe('independently retrievable semantic units', () => {
  it.each(['complete', 'split', 'answered'])(
    'keeps source-coupled question limits distinct from independent facts: %s',
    async (mode) => {
      const selected = {
        ...base,
        text:
          mode === 'split'
            ? question
            : mode === 'answered'
              ? 'Ada Marlow confirms that the Zephyr QX-100 warranty includes latch inspections.'
              : base.text,
      };
      const neighbor = {
        ...base,
        kind: 'claim',
        text: independent,
        discourse: { commitment: 'asserted', disposition: 'active' },
        support: [{ quote: independent }],
        discourse_frame: [{ quote: independent }],
      };
      const sibling = {
        ...neighbor,
        text: limit.replace('this record', 'the Zephyr QX-100 record'),
        polarity: 'negated',
        support: [{ quote: limit }],
        discourse_frame: [{ quote: `${question} ${limit}` }],
      };
      const records = mode === 'split' ? [selected, sibling, neighbor] : [selected, neighbor];
      const prompts: string[] = [];
      const chat = vi.fn(async (messages: { content: string }[]) => {
        prompts.push(messages[0]!.content);
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.repair_targets).toBeUndefined();
        expect(payload.source.text).toBe(source);
        return {
          ok: true,
          latencyMs: 11,
          value: JSON.stringify({
            verdicts: payload.candidates.map((candidate: any) => {
              const isSelected = candidate.kind === 'question';
              const proposition = !(isSelected && mode === 'answered');
              const qualification = !(isSelected && mode === 'split');
              return {
                candidate_id: candidate.candidate_id,
                ...frameAuditFields(candidate),
                ...retentionAudit(candidate, proposition, true, qualification),
                source_selected_polarity: candidate.polarity,
                proposition_supported: proposition,
                action_arguments_preserved: true,
                qualification_scope_preserved: qualification,
                reason_code: proposition && qualification ? null : 'discourse_uncertain',
              };
            }),
          }),
        };
      });
      const result = await runRetain(source, {
        available: true,
        modelId: 'invented-retrieval-unit',
        chat,
        reportInvalidResponse: vi.fn(),
        degradedReason: () => null,
      } as unknown as ModelClient);
      expect(chat).toHaveBeenCalledTimes(mode === 'split' ? 3 : 2);
      expect(result.error).toBeNull();
      expect(result.candidates.some((candidate) => candidate.text === independent)).toBe(true);
      expect(result.candidates.some((candidate) => candidate.kind === 'question')).toBe(mode === 'complete');
      if (mode === 'complete') {
        expect(result.held).toEqual([]);
        expect(result.candidates.find((candidate) => candidate.kind === 'question')!.text).toBe(base.text);
      } else expect(result.held.every((held) => held.hold_stage === 'verification')).toBe(true);
      for (const prompt of prompts)
        expect(
          prompt.split('A retained record is one independently retrievable semantic unit:'),
        ).toHaveLength(2);
      expect(prompts[0]).not.toContain("Preserve a source's actual activity when retaining that activity");
      expect(prompts[0]).toContain('Distinguish neutral provenance from an independently asserted activity');
    },
  );
});
