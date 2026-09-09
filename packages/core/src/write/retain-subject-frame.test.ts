import { describe, expect, it, vi } from 'vitest';
import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';
import { frameAuditFields, semanticAudit } from '../../test/semantic-audit.ts';

const sourceItems: RetainSourceItem[] = [
  {
    item_id: 'turn-1111',
    role: 'user',
    speaker: 'Ada Marlow',
    text: 'Ada Marlow proposes discussing a fictional example about Zephyr QX-100.',
  },
  {
    item_id: 'turn-2222',
    role: 'user',
    speaker: 'Ada Marlow',
    text: 'In that example, Vulpine Mutual promises Bo Winters free filter replacement. The promise belongs only to the fiction.',
  },
];
const text =
  "In Ada Marlow's fictional example about Zephyr QX-100, Vulpine Mutual promises Bo Winters free filter replacement; the promise belongs only to the fiction.";
const record = (readable: boolean, antecedent: boolean, subject = 'Zephyr QX-100') => ({
  kind: 'claim',
  subject,
  text: readable ? text : text.replace(' about Zephyr QX-100', ''),
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  discourse: { commitment: 'hypothetical', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'affirmed',
  time: null,
  support: [{ item_id: 'turn-2222', quote: sourceItems[1]!.text }],
  discourse_frame: (antecedent ? sourceItems : sourceItems.slice(1)).map(({ item_id, text: quote }) => ({
    item_id,
    quote,
  })),
});

describe('generated subject identity across source items', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'requires the claimed source identifier in prose and deciding frame (%s, %s)',
    (readable, antecedent) => {
      const candidate = record(readable!, antecedent!);
      const result = cleanCandidateBatch([candidate], { sourceItems, generated: true });
      expect(result.candidates).toHaveLength(readable && antecedent ? 1 : 0);
      if (!readable || !antecedent) expect(result.held[0]?.reason).toContain('subject identifier');
      // This completeness policy does not rewrite or reinterpret exact caller-provided candidates.
      expect(cleanCandidateBatch([candidate], { sourceItems }).candidates).toHaveLength(1);
    },
  );

  it('does not infer a subject merely from an identifier elsewhere in the source', () => {
    const candidate = record(false, false, 'fictional filter replacement');
    expect(cleanCandidateBatch([candidate], { sourceItems, generated: true }).candidates).toHaveLength(1);
    expect(candidate.text).not.toContain('QX-100');
  });

  it('does not mistake another identifier or its prefix for this claimed subject', () => {
    const candidate = record(false, false, 'Zephyr QX-1000');
    expect(cleanCandidateBatch([candidate], { sourceItems, generated: true }).candidates).toHaveLength(1);
  });

  it.each([true, false])(
    'a repaired antecedent still requires full source semantics: %s',
    async (supported) => {
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [record(false, false)] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.items).toEqual(sourceItems);
        if (chat.mock.calls.length === 2) {
          expect(payload.validation_issues[0].reason).toContain('subject identifier');
          return {
            ok: true,
            value: JSON.stringify({ repairs: [{ candidate_index: 0, candidate: record(true, true) }] }),
            latencyMs: 11,
          };
        }
        expect(payload.repair_obligations).toHaveLength(1);
        expect(payload.candidates[0].text).toBe(text);
        expect(payload.candidates[0].frame_spans).toHaveLength(2);
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
        modelId: 'invented-subject-frame',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain('', model, { sourceItems });
      expect(chat).toHaveBeenCalledTimes(3);
      expect(result.candidates).toHaveLength(supported ? 1 : 0);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );
});
