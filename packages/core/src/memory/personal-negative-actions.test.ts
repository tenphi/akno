import { describe, expect, it } from 'vitest';
import { personalNegativeActionsSupported as supported } from './personal-negative-actions.ts';

describe('independent personal negative actions', () => {
  const sources = [
    'Ada Marlow has not adopted the proposal as a plan or arranged a meeting.',
    'Ada Marlow proposed a review. She has not adopted the proposal as a plan. She has not arranged a meeting.',
    'Я, Ada Marlow, не приняла это как план и не назначала встречу.',
  ];

  it.each([
    ['Ada Marlow has not adopted the proposal as a plan or arranged a meeting.', true],
    ['Она не приняла это как план и не назначала встречу.', true],
    ['The proposal has not been adopted by her as a plan; the meeting has not been arranged by her.', true],
    ['План не был принят ею, и встреча не была назначена ею.', true],
    ['Предложение не принято как план ею.', true],
    ['Ею предложение не принято как план; ею встреча не назначена.', true],
    ['Ею описано предложение. Предложение не принято как план.', false],
    ['Не принятым в качестве плана Ada Marlow.', true],
    ['Не принятым в качестве плана, ею обсуждалось предложение.', false],
    ['Не принятым в качестве плана и ею обсуждалось предложение.', false],
    ['Не принятым ею как план, без организации ею встречи.', true],
    ['Her non-adoption of the plan and her non-arrangement of a meeting remain recorded.', true],
    ['The proposal had not been adopted as a plan or used to arrange a meeting.', false],
    ['Не принятым в качестве плана и не сопровождаемым организацией встречи.', false],
    ['План не был принят, и встреча не была назначена.', false],
    ['Не принятым ею как план, без организации встречи.', false],
    ['Не утверждённым планом и без назначенной встречи.', false],
    ['She has not adopted the proposal as a plan; no meeting has been arranged.', false],
    ['The proposal has not been adopted as a plan; she has not arranged a meeting.', false],
    ['She has not adopted the proposal as a plan. The proposal has not been adopted as a plan.', false],
    ['She has not arranged a meeting. No meeting has been arranged.', false],
    ['The proposal has not been adopted as a plan, according to Ada Marlow.', false],
    ['No meeting has been arranged, according to Ada Marlow.', false],
    ['Ada Marlow has not adopted the proposal as a plan.', true],
    ['Ada Marlow made a proposal.', true],
  ] as const)('checks each emitted negative-action clause: %s', (text, expected) => {
    for (const source of sources) expect(supported(text, source), source).toBe(expected);
  });

  it('does not let a source-anonymous meeting exempt personal adoption', () => {
    const source = 'Ada Marlow has not adopted the proposal as a plan. No meeting has been arranged.';
    expect(
      supported('She has not adopted the proposal as a plan; no meeting has been arranged.', source),
    ).toBe(true);
    expect(
      supported('The proposal has not been adopted as a plan; no meeting has been arranged.', source),
    ).toBe(false);
  });

  it('does not let a source-anonymous plan exempt personal arrangement', () => {
    const source = 'The proposal has not been adopted as a plan. Ada Marlow has not arranged a meeting.';
    expect(
      supported('The proposal has not been adopted as a plan; she has not arranged a meeting.', source),
    ).toBe(true);
    expect(
      supported('The proposal has not been adopted as a plan; no meeting has been arranged.', source),
    ).toBe(false);
  });

  it.each([
    'The proposal has not been adopted as a plan by Ada Marlow. The meeting has not been arranged by Ada Marlow.',
    'План не был принят Ada Marlow. Встреча не была назначена Ada Marlow.',
  ])('recognizes a personal passive source: %s', (source) => {
    expect(
      supported('The proposal has not been adopted as a plan; no meeting has been arranged.', source),
    ).toBe(false);
  });

  it('does not borrow a passive actor from another action', () => {
    expect(
      supported(
        'The proposal has not been adopted by her as a plan or used to arrange a meeting.',
        sources[0]!,
      ),
    ).toBe(false);
    expect(
      supported(
        'No meeting has been arranged and the proposal has not been adopted by her as a plan.',
        sources[0]!,
      ),
    ).toBe(false);
  });

  it('leaves actor identity, omissions and unrelated actions with the mandatory verifier', () => {
    expect(
      supported(
        'The silverpine proposal has not been adopted as a plan.',
        'Ada Marlow has not adopted the silverpine proposal as a plan. The amberfin proposal has not been adopted as a plan.',
      ),
    ).toBe(true);
    expect(
      supported(
        'Ada Marlow has not adopted the proposal as a plan or arranged a meeting.',
        'Bo Winters has not adopted the proposal as a plan; Ada Marlow has not arranged a meeting.',
      ),
    ).toBe(true);
    expect(
      supported(
        'No meeting has been arranged.',
        'Ada Marlow has adopted the proposal as a plan and arranged a meeting.',
      ),
    ).toBe(true);
    expect(supported('No meeting has been arranged.', 'Ada Marlow has not ordered a cable.')).toBe(true);
    expect(
      supported('No meeting has been arranged.', 'Ada Marlow quoted "She has not arranged a meeting."'),
    ).toBe(true);
  });
});
