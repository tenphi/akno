import { describe, expect, it, vi } from 'vitest';
import { cleanCandidateBatch, runRetain } from './retain.ts';
import type { ModelClient } from '../models/client.ts';
import { retentionAudit } from '../../test/semantic-audit.ts';
import { hasReportUncertainty } from '../memory/report-uncertainty.ts';

const report =
  'According to Ada Marlow, Bo Winters says the Zephyr QX-100 terms permit a regulator inspection.';
const source = `${report} Ada Marlow has not read the service terms and has no independent confirmation of the report.`;
const coordinated = 'Ada Marlow has not read the service terms or independently confirmed the report.';
const continued =
  'Ada Marlow has not examined the contract or confirmed this assumption, and this remains a possible contract condition rather than an established requirement.';
const clarified =
  "Ada Marlow has not read the service terms or independently confirmed this report, and she clarifies that these are Bo Winters's words in her retelling rather than a condition she verified.";
const personalList =
  'Ada Marlow only conveys this account and has not read the agreement, independently checked the account, or herself checked this reported meaning.';
const personally =
  "She has not read the agreement, independently checked Bo Winters's account, or personally verified this meaning.";
const checked = 'Ada Marlow has not read the agreement or independently checked this account.';
const relayTail =
  'Ada has not read the agreement or independently checked Bo’s account and only passes on that meaning without checking it herself.';
const repeatedCheck =
  'Ada Marlow is only passing on this meaning, has not read the agreement, and has not independently checked Bo Winters’s account.';
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
    [personally, true],
    [`Ada Marlow is only passing on this meaning; ${personally.replace('She', 'she')}`, true],
    [personally.replace('She has', 'I have'), true],
    [personally.replace('She has', 'We have'), true],
    [personally.replace('She has', 'They have'), true],
    [personally.replace('She has', 'Ada Marlow has'), true],
    [personally.replace('She has', 'Ada has'), true],
    [personally.replace('She has', 'The assistant has'), true],
    [personally.replace('verified this meaning', 'confirmed it'), true],
    [personally.replace('verified this meaning', 'checked this reported meaning'), true],
    [personally.replace('has not read', 'has read'), false],
    [personally.replace('or personally', 'or has personally'), false],
    [personally.replace('or personally', 'or Bo Winters personally'), false],
    [personally.replace('this meaning', 'the device'), false],
    [personally.replace('verified this meaning', 'replaced this meaning'), false],
    [personally.replace('verified this meaning', 'described this meaning'), false],
    ...['reportedly', 'allegedly', 'publicly', 'personally independently'].map(
      (adverb) => [personally.replace('personally', adverb), false] as const,
    ),
    ...['If ', 'Example: ', 'Ada Marlow asked whether ', 'Ada Marlow denied ', 'It is false that '].map(
      (prefix) => [prefix + personally, false] as const,
    ),
    ...['«»', '“”', '‘’', '""', "''", '``'].map(
      ([open, close]) => [`${open}${personally}${close}`, false] as const,
    ),
    ...[
      ', but she later confirmed it.',
      '; but she later confirmed it.',
      '; and this is false.',
      ' and she confirmed it.',
    ].map((ending) => [personally.slice(0, -1) + ending, false] as const),
    [personally.replace('verified this meaning', 'verified'), false],
  ])('binds the literal personal-check adverb to its closed negative list: %s', (qualification, accepted) => {
    const result = cleanCandidateBatch([record(qualification)], { sourceText: source, generated: true });
    expect(result.candidates).toHaveLength(accepted ? 1 : 0);
    if (!accepted) expect(result.held[0]?.reason).toContain('not recognized in a closed readable clause');
  });

  it('does not treat a source newline as horizontal predicate coordination', () => {
    // Generated records normalize whitespace before cleaning; the source helper sees original bytes.
    expect(hasReportUncertainty(personally.replace('or personally', 'or\npersonally'))).toBe(false);
  });

  it.each(
    [false, true].flatMap((repair) =>
      (
        [
          'preserved',
          'wrong-actor',
          'wrong-report-object',
          'generic-source',
          'retracted-source',
          'retracted-candidate',
        ] as const
      ).map((mode) => [repair, mode] as const),
    ),
  )('verifies personal-check semantics after at most one repair (%s / %s)', async (repair, mode) => {
    const personalLimit = personally.replace('She', 'Ada Marlow');
    const retractedLimit = personalLimit.slice(0, -1) + '; she later verified this meaning.';
    const original =
      mode === 'generic-source'
        ? source
        : `${report} ${mode === 'retracted-source' ? retractedLimit : personalLimit}`;
    const qualification =
      mode === 'wrong-actor'
        ? personally.replace('She', 'Bo Winters')
        : mode === 'wrong-report-object'
          ? personalLimit.replace("checked Bo Winters's", "checked Ada Marlow's")
          : mode === 'retracted-candidate'
            ? retractedLimit
            : personalLimit;
    const candidate = record(qualification, original);
    const supported = mode === 'preserved';
    const chat = vi.fn(async (messages: { content: string }[]) => {
      const call = chat.mock.calls.length;
      if (call === 1)
        return {
          ok: true,
          value: JSON.stringify({ candidates: [repair ? record('', original) : candidate] }),
          latencyMs: 11,
        };
      const payload = JSON.parse(messages.at(-1)!.content);
      if (repair && call === 2) {
        expect(payload.repair_targets).toHaveLength(1);
        expect(payload.repair_targets[0].candidate_index).toBe(0);
        return {
          ok: true,
          value: JSON.stringify({ repairs: [{ candidate_index: 0, candidate }] }),
          latencyMs: 11,
        };
      }
      expect(payload.source.text).toBe(original);
      expect(payload.candidates[0].text).toBe(candidate.text);
      return {
        ok: true,
        value: JSON.stringify({
          verdicts: [
            {
              candidate_id: payload.candidates[0].candidate_id,
              source_selected_polarity: 'affirmed',
              ...retentionAudit(payload.candidates[0], supported, true, true),
              proposition_supported: supported,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: supported ? null : 'discourse_uncertain',
            },
          ],
        }),
        latencyMs: 11,
      };
    });
    const model = {
      available: true,
      modelId: 'invented-personal-check',
      chat,
      degradedReason: () => null,
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;
    const result = await runRetain(original, model);
    expect(chat).toHaveBeenCalledTimes(repair ? 3 : 2);
    expect(result.candidates).toHaveLength(supported ? 1 : 0);
    if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
  });

  it.each([
    [coordinated, true],
    [relayTail, true],
    [relayTail.replace('Bo’s', 'Bo Winters’s').replace(' and only', ', and only'), true],
    [relayTail.replace('Ada has', 'Ada Marlow has'), true],
    [relayTail.replace('Ada has', 'She has'), true],
    [relayTail.replace('Ada has', 'She has').replace('herself', 'himself'), false],
    [relayTail.replace('Ada has', 'I have').replace('herself', 'himself'), false],
    [relayTail.replace('has not read', 'has read'), false],
    [relayTail.replace('Bo’s account', 'the device'), false],
    [relayTail.replace('and only', 'and Bo only'), false],
    [relayTail.replace('that meaning', 'that device'), false],
    [relayTail.replace('without checking', 'after checking'), false],
    [relayTail.replace('herself.', 'herself, but she then confirmed it.'), false],
    [relayTail.replace('herself.', 'herself; but this is false.'), false],
    [relayTail.replace('herself.', 'herself; and this is false.'), false],
    [`If ${relayTail}`, false],
    [`Example: ${relayTail}`, false],
    [`It is false that ${relayTail}`, false],
    [`Ada Marlow asked whether ${relayTail}`, false],
    ...['«»', '“”', '‘’', '""', "''", '``'].map(
      ([open, close]) => [`${open}${relayTail}${close}`, false] as const,
    ),
    [checked, true],
    [`The report says ${checked}`, true],
    [`Ada Marlow denied she has not read the agreement or independently checked this account.`, false],
    [`It is false that ${checked}`, false],
    [`Ada Marlow asked whether she has not read the agreement or independently checked this account.`, false],
    [`The note does not say ${checked}`, false],
    [`Ada Marlow asked: ${checked}`, false],
    [`Ada Marlow falsely has not read the agreement or independently checked this account.`, false],
    [repeatedCheck, true],
    [checked.replace(' or independently', ', and has not independently'), true],
    [checked.replace(' or independently', ', and has independently'), false],
    [checked.replace(' or independently', ', and Bo Winters has independently'), false],
    [checked.replace('this account', 'the device'), false],
    [checked.replace('this account', 'this assumption'), false],
    [checked.replace('the agreement', 'the report'), false],
    [checked.replace(' or independently', '; independently'), false],
    [checked.replace(' or independently', '\nindependently'), false],
    [checked.replace('.', ', but she checked it.'), false],
    [checked.replace('has not read', 'has read'), false],
    [repeatedCheck.replace('has not independently checked', 'has independently checked'), false],
    [repeatedCheck.replace('and has not', 'and Bo Winters has not'), false],
    [`If ${checked}`, false],
    [`Example: ${checked}`, false],
    ...['«»', '“”', '‘’', '""', "''", '``'].map(
      ([open, close]) => [`Example: ${open}${repeatedCheck}${close}`, false] as const,
    ),
    [personalList, true],
    [personalList.replace('herself checked this reported meaning', 'herself confirmed it'), true],
    [personalList.replace('Ada Marlow only conveys this account and', 'She'), true],
    [
      personalList.replace('Ada Marlow only conveys this account and', 'She').replace('herself', 'himself'),
      false,
    ],
    [personalList.replace('Ada Marlow only conveys this account and', 'They'), false],
    [personalList.replace('or herself', 'but she herself has'), false],
    [personalList.replace('or herself', 'or Bo Winters'), false],
    [personalList.replace('has not read', 'has read'), false],
    [personalList.replace('reported meaning', 'device'), false],
    [personalList.replace(', independently', '; independently'), false],
    [personalList.replace('.', ', but she has confirmed it.'), false],
    ...['«»', '“”', '‘’', '""', "''", '``'].map(
      ([open, close]) => [`Example: ${open}${personalList}${close}`, false] as const,
    ),
    [clarified, true],
    [clarified.replace(' in her retelling', ''), true],
    [
      clarified
        .replace('Ada Marlow has', 'The assistant has')
        .replace('she clarifies', 'the assistant clarifies'),
      true,
    ],
    [clarified.replace('has not read', 'has read'), false],
    [clarified.replace('she clarifies', 'Bo Winters clarifies'), false],
    [clarified.replace('she clarifies', 'she later confirms'), false],
    [
      clarified.replace(
        "Bo Winters's words in her retelling rather than a condition she verified",
        "Bo Winters's verified terms",
      ),
      false,
    ],
    [clarified.replace('.', ', but she later confirmed it.'), false],
    [clarified.replace('and she clarifies that these are', 'and she discusses'), false],
    ...['"', '“', '‘', "'", '\x60'].map((open) => {
      const close = open === '“' ? '”' : open === '‘' ? '’' : open;
      return [`The manual gives this example: ${open}${clarified}${close}`, false] as const;
    }),
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
    if (!accepted) expect(result.held[0]?.reason).toContain('not recognized in a closed readable clause');
  });

  it('uses the same recognition for source and generated prose', () => {
    const original = `${report} ${coordinated}`;
    const missing = cleanCandidateBatch([record('', original)], { sourceText: original, generated: true });
    expect(missing.candidates).toHaveLength(0);
    expect(missing.held[0]?.reason).toContain('not recognized in a closed readable clause');
    expect(
      cleanCandidateBatch([record(coordinated, original)], { sourceText: original, generated: true })
        .candidates,
    ).toHaveLength(1);
  });

  it.each(
    [coordinated, continued, clarified, personalList, checked, repeatedCheck, relayTail].flatMap(
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
          expect(input.repair_targets[0].validation_issues[0].reason).toContain(
            'not recognized in a closed readable clause',
          );
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
            verdicts: input.candidates.map(
              (c: { polarity: 'affirmed' | 'negated'; candidate_id: string }) => ({
                candidate_id: c.candidate_id,
                source_selected_polarity: c.polarity,
                ...retentionAudit(c, supported, true, true),
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
