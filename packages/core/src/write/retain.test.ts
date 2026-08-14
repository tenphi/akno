import { describe, expect, it } from 'vitest';
import { cleanCandidates } from './retain.ts';

/**
 * The guards under the retain prompt. They exist because a prompt is a suggestion: a small
 * model told to drop speculation keeps "travel insurance should be considered" anyway. But a
 * guard that is too eager is worse than none, because what it drops is dropped in silence —
 * nothing reports a candidate that never became a write.
 */
const candidate = (text: string, extra: Record<string, unknown> = {}): unknown => ({
  text,
  subject: 'a subject',
  ...extra,
});

const texts = (value: unknown[]): string[] => cleanCandidates(value).map((entry) => entry.text);

describe('what survives the retain guards', () => {
  it('keeps an ordinary claim about the household', () => {
    expect(texts([candidate('The rent is 1450 EUR per month.')])).toHaveLength(1);
  });

  it('keeps a finding phrased with a verb nobody put on a list', () => {
    // The whole reason the verb whitelist was replaced. Every one of these states a fact and
    // none contains `is`, `has`, `costs` or any of the other forty words that used to be the
    // entire test — so every one was dropped, in silence, on the research turns that produced
    // them.
    expect(
      texts([
        candidate('The Vision framework OCRs a scanned page in roughly 0.6 seconds.'),
        candidate('Dutch tenancy law caps an annual rent increase at the liberalised rate.'),
        candidate('Bun installs workspace dependencies faster than pnpm on this repo.'),
      ]),
    ).toHaveLength(3);
  });

  it('still drops a topic with no claim in it', () => {
    expect(texts([candidate('hotel bill from the Rome trip')])).toEqual([]);
  });

  it('still drops speculation, however confidently phrased', () => {
    expect(
      texts([
        candidate('Travel insurance should be considered before the next trip.'),
        candidate('They will probably switch banks at some point.'),
      ]),
    ).toEqual([]);
  });

  it('drops an instruction, which is not a claim about anything', () => {
    // "Book the hotel before June" on a page reads back a year later as something the
    // household decided, which is a different statement from the one that was made.
    expect(texts([candidate('Book the hotel before June.')])).toEqual([]);
  });

  it('drops a fragment too short to be read on the page it lands on', () => {
    expect(texts([candidate('Rent is high')])).toEqual([]);
  });

  it('deduplicates claims that differ only in case', () => {
    expect(
      texts([candidate('The rent is 1450 EUR per month.'), candidate('The RENT is 1450 EUR per month.')]),
    ).toHaveLength(1);
  });
});

/**
 * The suggested slug: used only when nothing existing holds the claim, so it is the name a
 * *new* page gets. A model naming a filename is the one thing here that touches the
 * filesystem, so it is cleaned rather than trusted.
 */
describe('the suggested page', () => {
  const pageFor = (raw: unknown, folders?: string[]): string | undefined =>
    cleanCandidates([candidate('The rent is 1450 EUR per month.', { page: raw })], { folders })[0]?.page;

  it('takes a well-formed slug as given', () => {
    expect(pageFor('household/rent')).toBe('household/rent');
  });

  it('normalises the shapes a model actually returns', () => {
    expect(pageFor('Household/Rent Increase.md')).toBe('household/rent-increase');
    expect(pageFor('research/  OCR   benchmarks ')).toBe('research/ocr-benchmarks');
  });

  it('refuses a path that would escape the knowledge base', () => {
    expect(pageFor('../../etc/passwd')).toBe('etc/passwd');
    expect(pageFor('/etc/passwd')).toBe('etc/passwd');
  });

  it('drops a bare name rather than putting a page at the root', () => {
    // A page at the root of the knowledge base is almost never what was meant, and is the
    // hardest kind of mess to tidy up afterwards. Without a folder, routing asks instead.
    expect(pageFor('rent')).toBeUndefined();
  });

  it('drops a suggestion that cleans down to nothing', () => {
    expect(pageFor('///')).toBeUndefined();
    expect(pageFor('!!!')).toBeUndefined();
  });

  it('accepts only an exact existing folder when the taxonomy is supplied', () => {
    const folders = ['home', 'knowledge/games'];
    expect(pageFor('knowledge/games/ember-archive', folders)).toBe('knowledge/games/ember-archive');
    expect(pageFor('games/ember-archive', folders)).toBeUndefined();
    expect(pageFor('knowledge/games/rpg/ember-archive', folders)).toBeUndefined();
  });
});
