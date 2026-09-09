import { describe, expect, it } from 'vitest';
import { answerAlignmentsSupported, answerReadingSchema } from './answer-source-audit.ts';

const frame = 'Ada Marlow proposed inspecting a loosely inserted connector; the proposal is unaccepted.';
const answer = 'Ada Marlow предложила проверить неплотно вставленный разъём; предложение не принято.';
const frames = new Map([['E1', frame]]);
const audit = () => [
  {
    evidence_id: 'E1',
    actor: {
      source_quote: 'Ada Marlow proposed',
      answer_quote: 'Ada Marlow предложила',
      relation: 'preserved',
      detail: 'The named proposer remains the proposer.',
    },
    object_and_mechanism: {
      source_quote: 'loosely inserted connector',
      answer_quote: 'неплотно вставленный разъём',
      relation: 'preserved',
      detail: 'Insertion and loose seating remain explicit.',
    },
    qualification: {
      source_quote: 'the proposal is unaccepted',
      answer_quote: 'предложение не принято',
      relation: 'preserved',
      detail: 'The proposal remains unaccepted.',
    },
  },
];

describe('private original-source answer audits', () => {
  it('accepts exact anchors for equivalent translated roles, mechanism and qualification', () => {
    expect(answerAlignmentsSupported(audit(), frames, answer)).toBe(true);
  });

  it.each(['actor', 'object_and_mechanism', 'qualification'] as const)(
    'holds a changed %s even if the other comparisons are preserved',
    (category) => {
      const entries = audit();
      entries[0]![category].relation = 'changed';
      expect(answerAlignmentsSupported(entries, frames, answer)).toBe(false);
    },
  );

  it('holds omitted action agency instead of borrowing an outer reporter', () => {
    const entries = audit();
    const withoutActor =
      'По словам Ada Marlow, было предложено проверить неплотно вставленный разъём; предложение не принято.';
    expect(
      answerAlignmentsSupported(
        [
          {
            ...entries[0],
            actor: {
              source_quote: 'Ada Marlow proposed',
              answer_quote: null,
              relation: 'omitted',
              detail: 'The answer names a reporter but no proposer.',
            },
          },
        ],
        frames,
        withoutActor,
      ),
    ).toBe(false);
  });

  it('holds a material entailed generalization of the mechanism', () => {
    const entries = audit();
    entries[0]!.object_and_mechanism.relation = 'generalized';
    entries[0]!.object_and_mechanism.answer_quote = 'неправильно установленный разъём';
    expect(
      answerAlignmentsSupported(
        entries,
        frames,
        answer.replace('неплотно вставленный', 'неправильно установленный'),
      ),
    ).toBe(false);
  });

  it('rejects a faithful quote absent from the actual answer', () => {
    expect(
      answerAlignmentsSupported(
        audit(),
        frames,
        answer.replace('неплотно вставленный', 'неправильно установленный'),
      ),
    ).toBe(false);
  });

  it('rejects quotes from another record or generation reading', () => {
    const entries = audit();
    entries[0]!.actor.source_quote = 'Bo Winters proposed';
    expect(answerAlignmentsSupported(entries, frames, answer)).toBe(false);
  });

  it.each(['missing', 'duplicate', 'foreign'] as const)('rejects %s alignment coordinates', (kind) => {
    const entries = audit();
    if (kind === 'missing') entries.pop();
    if (kind === 'duplicate') entries.push(entries[0]!);
    if (kind === 'foreign') entries[0]!.evidence_id = 'E2';
    expect(answerAlignmentsSupported(entries, frames, answer)).toBe(false);
  });

  it('allows an incidental category to remain unselected beside a selected comparison', () => {
    const entry = {
      source_quote: 'An incidental invented detail.',
      answer_quote: null,
      relation: 'not_selected',
      detail: 'The retained proposition does not select this detail.',
    };
    const entries = [{ ...audit()[0], actor: entry }];
    const incidental = new Map([['E1', frame + ' An incidental invented detail.']]);
    expect(answerAlignmentsSupported(entries, incidental, answer)).toBe(true);
    expect(
      answerAlignmentsSupported(
        [{ ...entries[0], actor: { ...entry, answer_quote: 'An incidental invented detail.' } }],
        incidental,
        answer + ' An incidental invented detail.',
      ),
    ).toBe(false);
    expect(
      answerAlignmentsSupported(
        [{ evidence_id: 'E1', actor: entry, object_and_mechanism: entry, qualification: entry }],
        incidental,
        answer,
      ),
    ).toBe(false);
  });

  it('requires a selected source and answer anchor for a preserved comparison', () => {
    const entries = audit();
    expect(
      answerAlignmentsSupported(
        [{ ...entries[0], actor: { ...entries[0]!.actor, source_quote: null } }],
        frames,
        answer,
      ),
    ).toBe(false);
    expect(
      answerAlignmentsSupported(
        [{ ...entries[0], actor: { ...entries[0]!.actor, answer_quote: null } }],
        frames,
        answer,
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
