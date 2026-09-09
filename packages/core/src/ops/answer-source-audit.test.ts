import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ModelClient, strictModeViolations } from '../models/client.ts';
afterEach(() => vi.unstubAllGlobals());
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
const mechanism = () => ({
  source_anchor: 'source-actor',
  answer_anchor: 'answer-actor',
  source_specifics: 'Inspect a loosely inserted connector.',
  answer_specifics: 'Проверить неплотно вставленный разъём.',
  relation: 'preserved',
});
const property = () => ({
  source_anchor: 'source-actor',
  answer_anchor: 'answer-actor',
  source_property: 'Electrical continuity',
  answer_property: 'Непрерывность цепи',
  relation: 'preserved',
});
const audit = () => [
  {
    evidence_id: 'E1',
    source_context: 'Ada proposed checking a loosely inserted connector; the proposal remains unaccepted.',
    actor: part(),
    object_and_operation: mechanism(),
    qualification: part(),
    tested_property: {
      source_anchor: null,
      answer_anchor: null,
      source_property: null,
      answer_property: null,
      relation: 'not_selected',
    },
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
  it.each(['preserved', 'generalized', 'changed', 'omitted', 'not_selected'] as const)(
    'enforces the separate property wire/null shape and verdict for %s',
    (relation) => {
      for (const source_anchor of [null, 'source-actor'])
        for (const answer_anchor of [null, 'answer-actor']) {
          const tested_property = {
            relation,
            source_anchor,
            answer_anchor,
            source_property: source_anchor === null ? null : 'Electrical continuity',
            answer_property: answer_anchor === null ? null : 'Непрерывность цепи',
          };
          const expected =
            relation === 'not_selected'
              ? source_anchor === null && answer_anchor === null
              : relation === 'omitted'
                ? source_anchor !== null && answer_anchor === null
                : answer_anchor !== null && (source_anchor !== null || relation === 'changed');
          const entries = [{ ...audit()[0], tested_property }];
          expect(answerAlignmentSchema(coordinates).safeParse(entries).success).toBe(expected);
          expect(answerAlignmentsSupported(entries, coordinates)).toBe(
            expected && ['preserved', 'not_selected'].includes(relation),
          );
        }
    },
  );

  it('requires bounded independent property descriptions and a selected containing operation', () => {
    for (const tested_property of [
      undefined,
      { ...property(), source_property: undefined },
      { ...property(), answer_property: null },
      { ...property(), source_property: '' },
      { ...property(), source_property: 'x'.repeat(31) },
      { ...property(), answer_property: 'x'.repeat(31) },
      { ...property(), detail: 'Do not strip extra properties.' },
      { ...property(), source_anchor: 'foreign' },
      { ...property(), answer_anchor: 'stale' },
    ])
      expect(answerAlignmentsSupported([{ ...audit()[0], tested_property }], coordinates)).toBe(false);
    const unselectedOperation = {
      source_anchor: null,
      answer_anchor: null,
      source_specifics: null,
      answer_specifics: null,
      relation: 'not_selected',
    };
    expect(
      answerAlignmentSchema(coordinates).safeParse([
        { ...audit()[0], object_and_operation: unselectedOperation, tested_property: property() },
      ]).success,
    ).toBe(false);
  });

  it('preserves the full ordinary-operation allowance while sharing it with an active property', () => {
    for (const size of [50, 51, 80, 81]) {
      const operation = {
        ...mechanism(),
        source_specifics: 'x'.repeat(size),
        answer_specifics: 'x'.repeat(size),
      };
      expect(
        answerAlignmentsSupported([{ ...audit()[0], object_and_operation: operation }], coordinates),
      ).toBe(size <= 80);
      expect(
        answerAlignmentsSupported(
          [{ ...audit()[0], object_and_operation: operation, tested_property: property() }],
          coordinates,
        ),
      ).toBe(size <= 50);
    }
  });

  it('keeps a property local to its contribution when another citation supplies only a qualification', () => {
    const combined: AnswerAuditCoordinates = {
      ...coordinates,
      sources: new Map([
        ...coordinates.sources,
        ['E2', [{ anchor_id: 'other-source', text: 'The inspection has not been agreed.' }]],
      ]),
    };
    const incidental = {
      source_anchor: null,
      answer_anchor: null,
      relation: 'not_selected',
      detail: 'This record contributes only the nonagreement qualification.',
    };
    const qualifier = {
      ...audit()[0],
      evidence_id: 'E2',
      source_context: 'The inspection has not been agreed.',
      actor: incidental,
      object_and_operation: {
        source_anchor: null,
        answer_anchor: null,
        source_specifics: null,
        answer_specifics: null,
        relation: 'not_selected',
      },
      qualification: { ...part(), source_anchor: 'other-source' },
    };
    const entries = [{ ...audit()[0], tested_property: property() }, qualifier];
    expect(answerAlignmentsSupported(entries, combined)).toBe(true);
    for (const tested_property of [
      { ...property(), relation: 'generalized' },
      { ...property(), source_anchor: 'other-source' },
    ])
      expect(answerAlignmentsSupported([{ ...entries[0], tested_property }, qualifier], combined)).toBe(
        false,
      );
  });

  it('accepts immutable coordinates with equivalent translated roles and qualification', () => {
    expect(answerAlignmentsSupported(audit(), coordinates)).toBe(true);
  });

  it.each(['actor', 'object_and_operation', 'qualification'] as const)(
    'holds each negative relation in %s independently of other positive categories',
    (category) => {
      for (const relation of ['generalized', 'changed', 'omitted']) {
        const entries = audit();
        const entry = {
          ...entries[0]![category],
          relation,
          answer_anchor: relation === 'omitted' ? null : 'answer-actor',
          ...(category === 'object_and_operation' && relation === 'omitted'
            ? { answer_specifics: null }
            : {}),
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
      object_and_operation: { ...mechanism(), source_anchor: 'other-source' },
      qualification: { ...part(), source_anchor: 'other-source' },
      tested_property: {
        source_anchor: null,
        answer_anchor: null,
        source_property: null,
        answer_property: null,
        relation: 'not_selected',
      },
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

  it.each(['preserved', 'generalized', 'changed', 'omitted', 'not_selected'] as const)(
    'keeps mechanism descriptions aligned with null coordinates for %s',
    (relation) => {
      for (const source_anchor of [null, 'source-actor'])
        for (const answer_anchor of [null, 'answer-actor']) {
          const comparison = {
            ...mechanism(),
            relation,
            source_anchor,
            answer_anchor,
            source_specifics: source_anchor === null ? null : 'Connector continuity.',
            answer_specifics: answer_anchor === null ? null : 'Electrical continuity.',
          };
          const expected =
            relation === 'not_selected'
              ? answer_anchor === null
              : source_anchor !== null &&
                (relation === 'omitted' ? answer_anchor === null : answer_anchor !== null);
          const entries = [
            {
              ...audit()[0],
              object_and_operation: comparison,
              tested_property: {
                source_anchor: null,
                answer_anchor: null,
                source_property: null,
                answer_property: null,
                relation: 'not_selected',
              },
            },
          ];
          expect(answerAlignmentSchema(coordinates).safeParse(entries).success).toBe(expected);
          expect(answerAlignmentsSupported(entries, coordinates)).toBe(
            expected && ['preserved', 'not_selected'].includes(relation),
          );
        }
    },
  );

  it('requires separate bounded source and answer specifics without a legacy fallback', () => {
    for (const comparison of [
      part(),
      { ...mechanism(), source_specifics: undefined },
      { ...mechanism(), answer_specifics: undefined },
      { ...mechanism(), source_specifics: 'x'.repeat(81) },
      { ...mechanism(), answer_specifics: 'x'.repeat(81) },
      { ...mechanism(), source_specifics: null },
      { ...mechanism(), answer_specifics: null },
      { ...mechanism(), detail: 'Combined comparison is no longer allowed.' },
      { ...mechanism(), relation: 'omitted', answer_anchor: null },
      {
        ...mechanism(),
        relation: 'not_selected',
        source_anchor: null,
        answer_anchor: null,
        answer_specifics: null,
      },
    ])
      expect(
        answerAlignmentSchema(coordinates).safeParse([
          {
            ...audit()[0],
            object_and_operation: comparison,
            tested_property: {
              source_anchor: null,
              answer_anchor: null,
              source_property: null,
              answer_property: null,
              relation: 'not_selected',
            },
          },
        ]).success,
      ).toBe(false);
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
        [
          {
            ...audit()[0],
            actor: incidental,
            object_and_operation: {
              ...mechanism(),
              relation: 'not_selected',
              answer_anchor: null,
              answer_specifics: null,
            },
            qualification: incidental,
            tested_property: {
              source_anchor: null,
              answer_anchor: null,
              source_property: null,
              answer_property: null,
              relation: 'not_selected',
            },
          },
        ],
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

describe('provider-visible alignment branches', () => {
  it.each(
    (['chat_completions', 'responses'] as const).flatMap((api) =>
      (['preserved', 'omitted', 'added', 'not_selected'] as const).map((mode) => [api, mode] as const),
    ),
  )(
    'sends the property/operation dependency and relation/null alternatives through %s (%s)',
    async (api, mode) => {
      let wire: Record<string, any> = {};
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: unknown, init: RequestInit) => {
          const body = JSON.parse(String(init.body));
          wire =
            api === 'chat_completions'
              ? (body.response_format.schema ?? body.response_format.json_schema?.schema)
              : body.text.format.schema;
          const tested_property =
            mode === 'not_selected'
              ? audit()[0]!.tested_property
              : {
                  ...property(),
                  source_anchor: mode === 'added' ? null : 'source-actor',
                  answer_anchor: mode === 'omitted' ? null : 'answer-actor',
                  source_property: mode === 'added' ? null : 'Electrical continuity',
                  answer_property: mode === 'omitted' ? null : 'Непрерывность цепи',
                  relation: mode === 'added' ? 'changed' : mode,
                };
          const value = JSON.stringify({ alignments: [{ ...audit()[0], tested_property }] });
          return new Response(
            JSON.stringify(
              api === 'chat_completions'
                ? { choices: [{ message: { content: value }, finish_reason: 'stop' }] }
                : {
                    status: 'completed',
                    output: [{ type: 'message', content: [{ type: 'output_text', text: value }] }],
                  },
            ),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      );
      const model = new ModelClient({
        role: 'answer',
        id: 'invented-alignment-schema',
        enabled: true,
        requested: true,
        timeoutMs: 1111,
        maxOutputTokens: 1111,
        unavailableReason: null,
        provider: {
          name: 'invented',
          baseUrl: 'https://invented.invalid/v1',
          apiKey: null,
          headers: {},
          maxRetries: 0,
          api,
        },
      });
      const result = await model.chat([{ role: 'user', content: 'Return the invented alignment.' }], {
        schema: z.object({ alignments: answerAlignmentSchema(coordinates) }),
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(strictModeViolations(wire)).toEqual([]);
      expect(JSON.stringify(wire)).not.toMatch(/"(?:oneOf|const)":/u);
      const entryBranches = wire.properties.alignments.items.anyOf;
      expect(entryBranches).toHaveLength(2);
      const incidental = entryBranches[0].properties;
      const active = entryBranches[1].properties;
      for (const entryBranch of entryBranches) {
        expect(entryBranch.additionalProperties).toBe(false);
        expect(new Set(entryBranch.required)).toEqual(new Set(Object.keys(entryBranch.properties)));
      }
      expect(incidental.tested_property.properties.relation.enum).toEqual(['not_selected']);
      expect(active.object_and_operation.anyOf).toHaveLength(2);
      expect(active.object_and_operation.anyOf[0].properties.source_specifics.maxLength).toBe(50);
      expect(active.object_and_operation.anyOf[0].properties.answer_specifics.maxLength).toBe(50);
      expect(active.object_and_operation.anyOf.flatMap((b: any) => b.properties.relation.enum)).toEqual([
        'preserved',
        'generalized',
        'changed',
        'omitted',
      ]);
      expect(active.tested_property.anyOf.flatMap((b: any) => b.properties.relation.enum)).not.toContain(
        'not_selected',
      );
      const branches = active.actor.anyOf;
      expect(branches).toHaveLength(3);
      for (const branch of branches) {
        expect(branch.type).toBe('object');
        expect(branch.additionalProperties).toBe(false);
        expect(Object.keys(branch.properties)).toEqual([
          'source_anchor',
          'answer_anchor',
          'detail',
          'relation',
        ]);
        expect(new Set(branch.required)).toEqual(
          new Set(['source_anchor', 'answer_anchor', 'relation', 'detail']),
        );
      }
      const mechanismBranches = incidental.object_and_operation.anyOf;
      expect(mechanismBranches).toHaveLength(4);
      for (const branch of mechanismBranches) {
        expect(Object.keys(branch.properties)).toEqual([
          'source_anchor',
          'answer_anchor',
          'source_specifics',
          'answer_specifics',
          'relation',
        ]);
        expect(branch.additionalProperties).toBe(false);
        expect(new Set(branch.required)).toEqual(new Set(Object.keys(branch.properties)));
      }
      expect(mechanismBranches[0].properties.source_specifics.maxLength).toBe(80);
      expect(mechanismBranches[0].properties.answer_specifics.maxLength).toBe(80);
      expect(mechanismBranches[1].properties.answer_specifics.type).toBe('null');
      expect(mechanismBranches[3].properties.source_specifics.type).toBe('null');
      const propertyBranches = [...active.tested_property.anyOf, incidental.tested_property];
      expect(propertyBranches).toHaveLength(4);
      for (const branch of propertyBranches) {
        expect(Object.keys(branch.properties)).toEqual([
          'source_anchor',
          'answer_anchor',
          'source_property',
          'answer_property',
          'relation',
        ]);
        expect(branch.additionalProperties).toBe(false);
        expect(new Set(branch.required)).toEqual(new Set(Object.keys(branch.properties)));
      }
      expect(propertyBranches[0].properties.source_property.maxLength).toBe(30);
      expect(propertyBranches[0].properties.answer_property.maxLength).toBe(30);
      expect(propertyBranches[1].properties.answer_property.type).toBe('null');
      expect(propertyBranches[2].properties.source_property.type).toBe('null');
      expect(propertyBranches[2].properties.relation.enum).toEqual(['changed']);
      expect(propertyBranches[3].properties.source_property.type).toBe('null');
      expect(propertyBranches[3].properties.answer_property.type).toBe('null');
      expect(branches[0].properties.source_anchor.enum).toEqual(['source-actor']);
      expect(branches[0].properties.answer_anchor.enum).toEqual(['answer-actor']);
      expect(branches[0].properties.relation.enum).toEqual(['preserved', 'generalized', 'changed']);
      expect(branches[1].properties.answer_anchor.type).toBe('null');
      expect(branches[1].properties.relation.enum).toEqual(['omitted']);
      expect(branches[2].properties.answer_anchor.type).toBe('null');
      expect(branches[2].properties.relation.enum).toEqual(['not_selected']);
      expect(branches[2].properties.source_anchor.anyOf).toEqual([
        { type: 'string', enum: ['source-actor'] },
        { type: 'null' },
      ]);
    },
  );
  it.each(['preserved', 'omitted', 'not_selected'])(
    'rejects extra fields in %s without stripping them',
    (relation) => {
      const entries = audit();
      const actor = {
        ...entries[0]!.actor,
        relation,
        answer_anchor: relation === 'preserved' ? 'answer-actor' : null,
        invented: true,
      };
      expect(answerAlignmentSchema(coordinates).safeParse([{ ...entries[0], actor }]).success).toBe(false);
    },
  );
});
