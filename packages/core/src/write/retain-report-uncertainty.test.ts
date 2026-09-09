import { describe, expect, it, vi } from 'vitest';
import { cleanCandidateBatch, runRetain } from './retain.ts';
import type { ModelClient } from '../models/client.ts';
import { semanticAudit } from '../../test/semantic-audit.ts';

const report =
  'According to Ada Marlow, Bo Winters says the Zephyr QX-100 terms permit a regulator inspection.';
const source = `${report} Ada Marlow has not read the service terms and has no independent confirmation of the report.`;
const coordinated = 'Ada Marlow has not read the service terms or independently confirmed the report.';
const continued =
  'Ada Marlow has not examined the contract or confirmed this assumption, and this remains a possible contract condition rather than an established requirement.';
const record = (qualification: string, original = source) => ({
  kind: 'claim',
  subject: 'Zephyr QX-100',
  text: `${report} ${qualification}`,
  attribution: {
    source_role: 'user',
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' }],
  },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: [{ quote: original }],
  discourse_frame: [{ quote: original }],
});

describe('shared negation in readable report uncertainty', () => {
  it.each([
    [coordinated, true],
    [
      'The AI assistant has not examined the contract or confirmed this assumption, and this is a possible contract condition rather than an established requirement.',
      true,
    ],
    [
      'The assistant has not read the terms or verified the report, and this remains a possible contractual term.',
      true,
    ],
    [
      'Ada Marlow has not reviewed the agreement or confirmed this assumption, so it remains a possible interpretation.',
      true,
    ],
    [
      'The assistant has not examined the contract or confirmed this assumption, and Bo Winters confirmed it.',
      false,
    ],
    [
      'The assistant has not examined the contract or confirmed this assumption, and this is a confirmed contract condition.',
      false,
    ],
    [
      'The assistant has not examined the contract or confirmed this assumption, but this is an established requirement.',
      false,
    ],
    [
      'The assistant has not examined the contract or confirmed this assumption, and this is a possible condition, but she later confirmed it.',
      false,
    ],

    [
      'Ada Marlow has not read the service terms or independently confirmed the report, so it is not a condition she has verified.',
      true,
    ],
    ['Ada Marlow has not examined the contract or verified the report.', true],
    ['I, Ada Marlow, have not seen the agreement or independently verified this message.', true],
    ['Ada Marlow had not reviewed the terms or confirmed the report.', true],
    [
      'Ada Marlow has not read the terms, independently confirmed the report, or verified this as a condition.',
      true,
    ],
    ['Ada Marlow has not examined the contract, confirmed the report, or verified it as a condition.', true],
    ['Ada Marlow has no independent confirmation of the report.', true],
    ['Ada Marlow says this is an unconfirmed report.', true],
    ['Ada Marlow has not read the contract, but she independently confirmed the report.', false],
    ['Ada Marlow has not read the terms; Bo Winters verified the report.', false],
    ['Ada Marlow has not read the agreement, and Bo Winters confirmed the report.', false],
    ['Ada Marlow has not read the contract, then independently confirmed the report.', false],
    ['Ada Marlow has not read the contract, but has confirmed the report.', false],
    ['Ada Marlow has not read the contract and did verify the report.', false],
    ['Ada Marlow has not read the contract, independently confirmed the report.', false],
    ['Ada Marlow has read the contract or independently confirmed the report.', false],
    [
      'Ada Marlow has not read the contract or independently confirmed the report and then verified it.',
      false,
    ],
    [
      'Ada Marlow has not read the contract or independently confirmed the report, but she later confirmed it.',
      false,
    ],
    [
      'Ada Marlow has not read the contract or independently confirmed the report, so she then confirmed the report.',
      false,
    ],
    [
      'Ada Marlow has not read the contract or independently confirmed the report, therefore she verified it.',
      false,
    ],
    [
      'Ada Marlow has not read the contract or independently confirmed the report, so it is not a condition she has verified, but she confirmed it.',
      false,
    ],
  ])('recognizes a closed negated list without borrowing another clause: %s', (qualification, accepted) => {
    const result = cleanCandidateBatch([record(qualification)], { sourceText: source, generated: true });
    expect(result.candidates).toHaveLength(accepted ? 1 : 0);
    if (!accepted) expect(result.held[0]?.reason).toContain('explicitly lacks confirmation');
  });

  it('uses the same recognition for source and generated prose', () => {
    const original = `${report} ${coordinated}`;
    const missing = cleanCandidateBatch([record('', original)], { sourceText: original, generated: true });
    expect(missing.candidates).toHaveLength(0);
    expect(missing.held[0]?.reason).toContain('explicitly lacks confirmation');
    expect(
      cleanCandidateBatch([record(coordinated, original)], { sourceText: original, generated: true })
        .candidates,
    ).toHaveLength(1);
  });

  it.each(
    [coordinated, continued].flatMap(
      (qualification) =>
        [
          [false, true, qualification],
          [false, false, qualification],
          [true, true, qualification],
          [true, false, qualification],
        ] as const,
    ),
  )(
    'still requires semantics with at most one repair (repair=%s supported=%s)',
    async (repair, supported, qualification) => {
      const chat = vi.fn(async (messages: { content: string }[]) => {
        const call = chat.mock.calls.length;
        if (call === 1)
          return {
            ok: true,
            value: JSON.stringify({ candidates: [record(repair ? '' : qualification)] }),
            latencyMs: 11,
          };
        const input = JSON.parse(messages.at(-1)!.content);
        if (repair && call === 2) {
          expect(input.validation_issues[0].reason).toContain('explicitly lacks confirmation');
          return {
            ok: true,
            value: JSON.stringify({ repairs: [{ candidate_index: 0, candidate: record(qualification) }] }),
            latencyMs: 11,
          };
        }
        expect(input.source.text).toBe(source);
        expect(input.candidates[0].text).toContain(qualification);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: input.candidates.map((c: { candidate_id: string }) => ({
              candidate_id: c.candidate_id,
              ...semanticAudit(supported, true, true),
              proposition_supported: supported,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: supported ? null : 'discourse_uncertain',
            })),
          }),
          latencyMs: 11,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-report-uncertainty',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(repair ? 3 : 2);
      expect(result.candidates).toHaveLength(supported ? 1 : 0);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it('does not repeat a repair that still omits readable uncertainty', async () => {
    const chat = vi.fn(async () => ({
      ok: true,
      value: JSON.stringify(
        chat.mock.calls.length === 1
          ? { candidates: [record('')] }
          : { repairs: [{ candidate_index: 0, candidate: record('') }] },
      ),
      latencyMs: 11,
    }));
    const model = {
      available: true,
      modelId: 'invented-report-uncertainty',
      chat,
      degradedReason: () => null,
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.candidates).toHaveLength(0);
    expect(result.held[0]?.hold_stage).toBe('validation');
  });
});
