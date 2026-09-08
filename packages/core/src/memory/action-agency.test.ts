import { describe, expect, it } from 'vitest';
import { causeNonselectionAgencySupported } from './action-agency.ts';

describe('personal nonselection across retention and answers', () => {
  const sources = [
    'Ada Marlow considers two tentative explanations and has not chosen a cause.',
    'Ada Marlow considers two tentative explanations and has selected neither explanation.',
    'Я, Ada Marlow, рассматриваю две версии; ни одну причину я не выбрала.',
  ];

  it.each([
    ['Ada Marlow has selected neither explanation.', true],
    ['She has selected neither explanation.', true],
    ['Neither explanation has been selected by Ada Marlow.', true],
    ['Neither explanation was selected by her.', true],
    ['Neither explanation selected.', false],
    ['Neither explanation has been selected.', false],
    ['Neither has been selected.', false],
    ['Neither explanation has been selected by anyone.', false],
    ['Neither explanation has been selected by Ada Marlow and Bo Winters.', false],
    ['Ada Marlow has selected neither explanation; neither explanation selected.', false],
    ['Ada Marlow ни одну причину не выбрала.', true],
    ['Ни одна не выбрана Ada Marlow.', true],
    ['Ни одна не выбрана ею.', true],
    ['Ни одна не выбрана.', false],
    ['Ни одна гипотеза пока не выбрана.', false],
    ['Ни одну пока не выбрали.', false],
    ['Ни одна не выбрана ими.', false],
    ['Ни одна не выбрана Ada Marlow и Bo Winters.', false],
  ] as const)('preserves the actor independently of a considering clause: %s', (choice, supported) => {
    for (const source of sources) {
      expect(
        causeNonselectionAgencySupported('Ada Marlow considers tentative explanations. ' + choice, source),
        source,
      ).toBe(supported);
    }
  });

  it.each([
    [
      'Neither explanation has been selected for publication.',
      'Ada Marlow has not chosen a cause. Neither explanation has been selected for publication.',
    ],
    ['No cause has been chosen by the committee.', 'The committee has not chosen a cause.'],
    ['Причина не выбрана комитетом.', 'Комитет не выбрал причину.'],
  ])('defers independently supported or collective choice scope to verification: %s', (text, source) => {
    expect(causeNonselectionAgencySupported(text, source)).toBe(true);
  });

  it('does not treat an explicitly attributed source passive as an unassigned-source exemption', () => {
    expect(
      causeNonselectionAgencySupported(
        'Neither explanation has been selected.',
        'Neither explanation has been selected by Ada Marlow.',
      ),
    ).toBe(false);
  });

  it('does not invent a personal nonselector when the source only records an unassigned state', () => {
    expect(
      causeNonselectionAgencySupported('Neither explanation selected.', 'Neither explanation selected.'),
    ).toBe(true);
  });
});
