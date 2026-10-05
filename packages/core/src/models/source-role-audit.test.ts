import { describe, expect, it } from 'vitest';
import { exactSourceName, sourceRolesSupported, type SourceRoleBinding } from './source-role-audit.ts';

const source = 'Bo Winters reports that inspection of Zephyr QX-100 is complete.';
const bindings: SourceRoleBinding[] = [
  {
    id: 'E1_P1_R1',
    predicate_id: 'E1_P1',
    source: { name: 'Bo Winters', role: 'reporter', excerpt: source },
  },
];

describe('source-only named roles', () => {
  it.each([
    'faithful',
    'absent-name',
    'unbound-anchor',
    'other-name',
    'duplicate-id',
    'missing-role',
    'unknown-id',
    'wrong-role',
  ])('does not let broad approval supply an absent named role: %s', (mode) => {
    const candidate =
      mode === 'absent-name'
        ? 'Inspection of Zephyr QX-100 is complete.'
        : mode === 'other-name'
          ? source.replace('Bo Winters', 'Bo Wintersson')
          : source;
    const role = {
      source_role_id: mode === 'unknown-id' ? 'E1_P1_R99' : 'E1_P1_R1',
      candidate_anchors: [mode === 'unbound-anchor' ? 'B2' : 'B1'],
      candidate_role: mode === 'wrong-role' ? 'actor' : 'reporter',
      relation: 'preserved',
    };
    const audit = { roles: mode === 'missing-role' ? [] : mode === 'duplicate-id' ? [role, role] : [role] };
    expect(
      sourceRolesSupported(audit, bindings, [{ anchor_id: 'B1', text: candidate }], new Set(['E1_P1']), true),
    ).toBe(mode === 'faithful');
  });

  it('allows a focused answer to omit only roles of predicates it did not select', () => {
    const audit = {
      roles: [
        {
          source_role_id: 'E1_P1_R1',
          candidate_anchors: null,
          candidate_role: null,
          relation: 'not_selected',
        },
      ],
    };
    const answer = [{ anchor_id: 'B1', text: 'An independent record.' }];
    expect(sourceRolesSupported(audit, bindings, answer, new Set(), false)).toBe(true);
    expect(sourceRolesSupported(audit, bindings, answer, new Set(['E1_P1']), false)).toBe(false);
    expect(sourceRolesSupported(audit, bindings, answer, new Set(), true)).toBe(false);
  });

  it.each(['consecutive', 'reversed', 'nonconsecutive', 'duplicate'])(
    'keeps a name spanning segment boundaries without assembling a new one: %s',
    (mode) => {
      const answer = [
        { anchor_id: 'B1', text: '**Bo ' },
        { anchor_id: 'B2', text: 'Winters** reports completion.' },
        { anchor_id: 'B3', text: 'An independent clause.' },
      ];
      const ids =
        mode === 'reversed'
          ? ['B2', 'B1']
          : mode === 'nonconsecutive'
            ? ['B1', 'B3']
            : mode === 'duplicate'
              ? ['B1', 'B1']
              : ['B1', 'B2'];
      const value = {
        roles: [
          {
            source_role_id: 'E1_P1_R1',
            candidate_anchors: ids,
            candidate_role: 'reporter',
            relation: 'preserved',
          },
        ],
      };
      expect(sourceRolesSupported(value, bindings, answer, new Set(['E1_P1']), true)).toBe(
        mode === 'consecutive',
      );
    },
  );

  it.each([
    ['Bo Winters', true],
    ["Bo Winters's report", true],
    ['Bo Wintersson', false],
    ['Bo Winters-Junior', false],
    ['XBo Winters', false],
  ])('keeps source names at exact boundaries: %s', (text, present) => {
    expect(exactSourceName(text as string, 'Bo Winters')).toBe(present);
  });
});
