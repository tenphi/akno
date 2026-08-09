import { describe, expect, it } from 'vitest';

import { saysTheSame } from './words.ts';

/**
 * The comparison two callers rely on to avoid writing one thing twice. Its threshold is the whole
 * design: too low merges things that differ, too high lets paraphrases through.
 */
describe('saying the same thing in different words', () => {
  it('sees through who is being talked about', () => {
    // The real pair. An assistant wrote one, then the other, for one evening.
    expect(
      saysTheSame(
        'They watched "Wicked: For Good" in the evening.',
        'The user watched "Wicked: For Good" in the evening.',
      ),
    ).toBe(true);
  });

  it('keeps events that share a subject but not an outcome', () => {
    expect(saysTheSame('The flight to Rome departed on time.', 'The flight to Rome landed early.')).toBe(
      false,
    );
    expect(saysTheSame('Paid the rent.', 'Paid the electricity bill.')).toBe(false);
  });

  it('ignores citations, which are addresses rather than content', () => {
    expect(
      saysTheSame(
        'Booked the overnight ferry to Harlingen. [[travel/2026]]',
        'Booked the overnight ferry to Harlingen.',
      ),
    ).toBe(true);
  });

  it('refuses to call two empty sentences equal', () => {
    // Otherwise a line of punctuation suppresses every write that follows it.
    expect(saysTheSame('...', '!!!')).toBe(false);
  });
});
