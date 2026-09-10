import { describe, expect, it, vi } from 'vitest';
import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { ModelClient } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import { fictionalCaseSubjectIdentifier } from './fictional-case-identity.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

const intro =
  'Я, Ada Marlow, предлагаю обсудить вымышленный случай про Zephyr QX-100. Это пока предложение обсудить; реального договора мы здесь не заключаем.';
const englishIntro = 'Ada Marlow proposes discussing an invented case about Zephyr QX-100.';
const promise =
  'In the invented case, Vulpine Mutual promises the fictional Bo Winters free hinge-pin replacements during the first eleven days of ownership. That promise exists only inside this made-up case.';
const readable =
  "In Ada Marlow's invented case, Vulpine Mutual promises fictional Bo Winters free hinge-pin replacements during the first eleven days of ownership. This promise exists only within the made-up case.";
const items = (texts = [intro, promise]): RetainSourceItem[] =>
  texts.map((text, index) => ({
    item_id: 'turn-' + (index + 1) * 1111,
    role: 'user',
    speaker: 'Ada Marlow',
    text,
  }));
const spans = (sourceItems: RetainSourceItem[]) =>
  sourceItems.map(({ item_id, text: quote }) => ({ item_id, quote }));
const record = (sourceItems = items()) => ({
  kind: 'claim',
  subject: "Vulpine Mutual's fictional promise to Bo Winters",
  text: readable,
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  discourse: { commitment: 'hypothetical', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'affirmed',
  time: null,
  support: spans(sourceItems.slice(-1)),
  discourse_frame: spans(sourceItems),
});

describe('source-owned fictional-case identity witness', () => {
  it.each([intro, englishIntro, 'Ada Marlow предлагает обсудить придуманный пример о Zephyr QX-100.'])(
    'requires a uniquely attached identity absent from either readable field: %s',
    (introduction) => {
      const sourceItems = items([introduction, promise]);
      for (const [inText, inSubject] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ]) {
        const candidate = record(sourceItems);
        if (inText) candidate.text = readable.replace('invented case', 'invented case about Zephyr QX-100');
        if (inSubject) candidate.subject += ' for Zephyr QX-100';
        const result = cleanCandidateBatch([candidate], { sourceItems, generated: true });
        expect(result.candidates.length).toBe(inText && inSubject ? 1 : 0);
        if (!inText || !inSubject) expect(result.held[0]?.reason).toContain('subject identifier');
        expect(cleanCandidateBatch([candidate], { sourceItems }).candidates).toHaveLength(1);
      }
    },
  );

  it('also catches a null subject without manufacturing candidate content', () => {
    const sourceItems = items();
    const candidate = { ...record(sourceItems), subject: null };
    const original = structuredClone(candidate);
    expect(cleanCandidateBatch([candidate], { sourceItems, generated: true }).held[0]?.reason).toContain(
      'subject identifier',
    );
    expect(candidate).toEqual(original);
  });

  it('uses actual source order and works with exact spans in unstructured text', () => {
    const sourceItems = items();
    const frame = spans(sourceItems).reverse();
    expect(fictionalCaseSubjectIdentifier(spans(sourceItems.slice(1)), frame, { sourceItems })).toBe(
      'qx-100',
    );
    expect(
      fictionalCaseSubjectIdentifier(spans(sourceItems.slice(1)), frame, {
        sourceItems: [...sourceItems].reverse(),
      }),
    ).toBeUndefined();
    const sourceText = englishIntro + ' ' + promise;
    expect(
      fictionalCaseSubjectIdentifier([{ quote: promise }], [{ quote: englishIntro }, { quote: promise }], {
        sourceText,
      }),
    ).toBe('qx-100');
  });

  it.each([
    [
      'two cases',
      englishIntro + ' Ada Marlow proposes discussing a fictional case about Zephyr QX-200.',
      promise,
    ],
    ['two identical introductions', englishIntro + ' ' + englishIntro, promise],
    ['two identifiers', englishIntro.replace('Zephyr QX-100', 'Zephyr QX-100 QX-200'), promise],
    ['another case', englishIntro, promise.replace('the invented case', 'another invented case')],
    ['generic pronoun', englishIntro, promise.replace('In the invented case', 'In it')],
    ['generic case', englishIntro, promise.replace('In the invented case', 'In a case')],
    ['question', englishIntro.replace('.', '?'), promise],
    ['question support', englishIntro, promise.replace('ownership.', 'ownership?')],
    ['denial', englishIntro.replace('proposes', 'does not propose'), promise],
    ['different structured actor', englishIntro.replace('Ada Marlow', 'Bo Winters'), promise],
    ['three-part apparent actor', englishIntro.replace('Ada Marlow', 'Ada Rowan Marlow'), promise],
    ['retraction', englishIntro + ' But that proposal is withdrawn.', promise],
    ['following retraction', englishIntro, promise + ' Но это неверно.'],
    ['example prefix', 'Example: ' + englishIntro, promise],
    ['conditional prefix', 'If ' + englishIntro, promise],
    ['uncertain prefix', 'Perhaps ' + englishIntro, promise],
    ...[
      'Probably',
      'Presumably',
      'Likely',
      'Conceivably',
      'Purportedly',
      'Supposedly',
      'Reportedly',
      'Allegedly',
      'When',
      'While',
      'Although',
      'Вероятно',
      'Предположительно',
      'Хотя',
      'Пока',
    ].map((prefix) => ['scope prefix', prefix + ' ' + englishIntro, promise]),
    ['semicolon prefix', 'Not; ' + englishIntro, promise],
    ...['«»', '“”', '‘’', '""', "''", '``'].flatMap(([open, close]) => [
      ['quoted introduction', open + englishIntro + close, promise],
      ['quoted support', englishIntro, open + promise + close],
    ]),
  ])('does not derive attachment from %s', (_label, introduction, selected) => {
    const sourceItems = items([introduction!, selected!]);
    const candidate = record(sourceItems);
    expect(
      fictionalCaseSubjectIdentifier(candidate.support, candidate.discourse_frame, { sourceItems }),
    ).toBeUndefined();
    expect(cleanCandidateBatch([candidate], { sourceItems, generated: true }).candidates).toHaveLength(1);
  });

  it('does not borrow an omitted introduction from a sibling or hide a competing omitted case', () => {
    const sourceItems = items();
    const candidate = record(sourceItems);
    candidate.discourse_frame = [...candidate.support];
    expect(
      fictionalCaseSubjectIdentifier(candidate.support, candidate.discourse_frame, { sourceItems }),
    ).toBeUndefined();
    const extra = {
      ...sourceItems[0]!,
      item_id: 'turn-3333',
      text: englishIntro.replace('QX-100', 'QX-200'),
    };
    expect(
      fictionalCaseSubjectIdentifier(candidate.support, spans(sourceItems), {
        sourceItems: [extra, ...sourceItems],
      }),
    ).toBeUndefined();
    expect(
      fictionalCaseSubjectIdentifier(candidate.support, spans(sourceItems), {
        sourceItems: [sourceItems[0]!, ...sourceItems],
      }),
    ).toBeUndefined();
  });

  it.each([true, false])(
    'keeps the single repair subordinate to full original-source semantics: %s',
    async (supported) => {
      const sourceItems = items();
      const original = record(sourceItems);
      const repaired = {
        ...original,
        text: readable.replace('invented case', 'invented case about Zephyr QX-100'),
        subject: 'Zephyr QX-100 fictional promise',
      };
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [original] }), latencyMs: 11 };
        const payload = JSON.parse(messages.at(-1)!.content);
        expect(payload.source.items).toEqual(sourceItems);
        if (chat.mock.calls.length === 2) {
          expect(payload.repair_targets).toHaveLength(1);
          expect(payload.repair_targets[0].candidate_index).toBe(0);
          expect(payload.repair_targets[0].source_identifier_context.identifiers).toEqual([
            {
              identifier: 'qx-100',
              occurrence_count: 1,
              source_span_count: 1,
              spans: [{ item_id: sourceItems[0]!.item_id, quote: intro }],
              omitted_spans: 0,
            },
          ]);
          return {
            ok: true,
            value: JSON.stringify({ repairs: [{ candidate_index: 0, candidate: repaired }] }),
            latencyMs: 11,
          };
        }
        expect(payload.candidates[0].text).toBe(repaired.text);
        expect(payload.candidates[0].frame_spans).toHaveLength(2);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: payload.candidates.map((candidate: any) => ({
              candidate_id: candidate.candidate_id,
              source_selected_polarity: candidate.polarity,
              ...frameAuditFields(candidate),
              ...retentionAudit(candidate, supported, true, true),
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
        modelId: 'invented-fiction-attachment',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain('', model, { sourceItems });
      expect(chat).toHaveBeenCalledTimes(3);
      expect(result.candidates).toHaveLength(supported ? 1 : 0);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
      expect(original.text).toBe(readable);
    },
  );
});
