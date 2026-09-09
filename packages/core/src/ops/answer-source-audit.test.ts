import { describe, expect, it } from 'vitest';
import {
  answerAlignmentsSupported,
  answerAlignmentSchema,
  answerAuditAnchors,
  answerReadingSchema,
  type AnswerAuditCoordinates,
} from './answer-source-audit.ts';

const frame = 'Ada Marlow proposed inspecting a loosely inserted connector; the proposal is unaccepted.';
const answer = 'Ada Marlow предложила проверить неплотно вставленный разъём; предложение не принято.';
const coordinates: AnswerAuditCoordinates = {
  sources: new Map([['E1', [{ anchor_id: 'source-actor', text: frame }]]]),
  answer: [{ anchor_id: 'answer-actor', text: answer }],
};
const part = () => ({
  source_anchor: 'source-actor',
  answer_anchor: 'answer-actor',
  relation: 'preserved',
  detail: 'The source-supported selected meaning is preserved in the whole block.',
});
const audit = () => [
  {
    evidence_id: 'E1',
    source_context: 'Ada proposed checking a loosely inserted connector; the proposal remains unaccepted.',
    actor: part(),
    object_and_mechanism: part(),
    qualification: part(),
  },
];

describe('immutable source and answer coordinates', () => {
  it.each([
    'Ada Marlow reports a defect. She has not confirmed it.\n',
    'Условия неизвестны; вопрос остаётся открытым. 🦊\n…\nA clarification follows.',
    'x; '.repeat(300),
    '🦊'.repeat(400),
    ' \n\t',
  ])('preserves every byte while bounding sentence/clause references', (text) => {
    const anchors = answerAuditAnchors(text, 'E1');
    expect(anchors.map((a) => a.text).join('')).toBe(text);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.length).toBeLessThanOrEqual(24);
    expect(new Set(anchors.map((a) => a.anchor_id)).size).toBe(anchors.length);
    expect(anchors).toEqual(answerAuditAnchors(text, 'E1'));
  });

  it('keeps mixed-sentence clauses separately locatable without deciding their meaning', () => {
    expect(answerAuditAnchors('A clause; another clause.', 'E1').map((a) => a.text)).toEqual([
      'A clause;',
      ' another clause.',
    ]);
  });

  it('binds coordinates to the exact content and owning record or block', () => {
    const initial = answerAuditAnchors(frame, 'E1').map((a) => a.anchor_id);
    for (const ids of [
      answerAuditAnchors(frame + ' ', 'E1'),
      answerAuditAnchors(frame, 'E2'),
      answerAuditAnchors(frame, 'B1'),
      answerAuditAnchors(frame, 'B2'),
    ])
      expect(ids.every((a) => !initial.includes(a.anchor_id))).toBe(true);
  });
});

describe('private original-source answer audits', () => {
  it('accepts immutable coordinates with equivalent translated roles and qualification', () => {
    expect(answerAlignmentsSupported(audit(), coordinates)).toBe(true);
  });

  it.each(['actor', 'object_and_mechanism', 'qualification'] as const)(
    'holds each negative relation in %s independently of other positive categories',
    (category) => {
      for (const relation of ['generalized', 'changed', 'omitted']) {
        const entries = audit();
        const entry = {
          ...entries[0]![category],
          relation,
          answer_anchor: relation === 'omitted' ? null : 'answer-actor',
        };
        const value = [{ ...entries[0], [category]: entry }];
        expect(answerAlignmentSchema(coordinates).safeParse(value).success).toBe(true);
        expect(answerAlignmentsSupported(value, coordinates)).toBe(false);
      }
    },
  );

  it.each(['source_anchor', 'answer_anchor'] as const)('rejects a foreign or unknown %s', (field) => {
    const entries = audit();
    entries[0]!.actor[field] = 'foreign';
    expect(answerAlignmentsSupported(entries, coordinates)).toBe(false);
  });

  it('rejects a known source reference borrowed from another cited record', () => {
    const combined: AnswerAuditCoordinates = {
      ...coordinates,
      sources: new Map([
        ...coordinates.sources,
        ['E2', [{ anchor_id: 'other-source', text: 'Bo Winters proposed a different action.' }]],
      ]),
    };
    const entries = audit();
    entries[0]!.actor.source_anchor = 'other-source';
    const second = {
      ...entries[0],
      evidence_id: 'E2',
      actor: { ...part(), source_anchor: 'other-source' },
      object_and_mechanism: { ...part(), source_anchor: 'other-source' },
      qualification: { ...part(), source_anchor: 'other-source' },
    };
    expect(answerAlignmentSchema(combined).safeParse([...entries, second]).success).toBe(true);
    expect(answerAlignmentsSupported([...entries, second], combined)).toBe(false);
  });

  it.each(['missing', 'duplicate', 'foreign'] as const)('rejects %s evidence coverage', (kind) => {
    const entries = audit();
    if (kind === 'missing') entries.pop();
    if (kind === 'duplicate') entries.push(entries[0]!);
    if (kind === 'foreign') entries[0]!.evidence_id = 'E2';
    expect(answerAlignmentsSupported(entries, coordinates)).toBe(false);
  });

  it('requires complete bounded source context before comparison', () => {
    for (const source_context of [undefined, '', 'x'.repeat(241)])
      expect(answerAlignmentsSupported([{ ...audit()[0], source_context }], coordinates)).toBe(false);
  });

  it.each(['preserved', 'generalized', 'changed', 'omitted', 'not_selected'] as const)(
    'enforces reference/null consistency for %s',
    (relation) => {
      for (const source_anchor of [null, 'source-actor'])
        for (const answer_anchor of [null, 'answer-actor']) {
          const expected =
            relation === 'not_selected'
              ? answer_anchor === null
              : source_anchor !== null &&
                (relation === 'omitted' ? answer_anchor === null : answer_anchor !== null);
          const entries = [{ ...audit()[0], actor: { ...part(), relation, source_anchor, answer_anchor } }];
          expect(answerAlignmentSchema(coordinates).safeParse(entries).success).toBe(expected);
        }
    },
  );

  it('allows unselected incidental content without accepting an entirely unselected citation', () => {
    const incidental = {
      source_anchor: 'source-actor',
      answer_anchor: null,
      relation: 'not_selected',
      detail: 'An independent source detail is not selected.',
    };
    expect(answerAlignmentsSupported([{ ...audit()[0], actor: incidental }], coordinates)).toBe(true);
    expect(
      answerAlignmentsSupported(
        [{ ...audit()[0], actor: incidental, object_and_mechanism: incidental, qualification: incidental }],
        coordinates,
      ),
    ).toBe(false);
  });
  const readings = [
    { evidence_id: 'E1', selected_meaning: 'A proposed inspection.', clarification_or_ambiguity: null },
  ];
  it('requires every framed record reading once, including before an empty draft', () => {
    const schema = answerReadingSchema(['E1', 'E2']);
    expect(schema.safeParse([...readings, { ...readings[0], evidence_id: 'E2' }]).success).toBe(true);
    expect(schema.safeParse(readings).success).toBe(false);
    expect(schema.safeParse([...readings, ...readings]).success).toBe(false);
    expect(schema.safeParse([...readings, { ...readings[0], evidence_id: 'E3' }]).success).toBe(false);
    expect(
      schema.safeParse([
        { ...readings[0], selected_meaning: 'x'.repeat(321) },
        { ...readings[0], evidence_id: 'E2' },
      ]).success,
    ).toBe(false);
  });
});
