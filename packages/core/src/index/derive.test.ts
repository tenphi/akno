import { describe, expect, it } from 'vitest';
import { scoreConfidence } from './derive.ts';

/**
 * §7, §19. Confidence answers one narrow question: how sure is the deriver that
 * this line states a well-formed, *durable* claim? Not whether the claim is true.
 *
 * §19 leaves how to produce it open, and notes that a model self-reporting
 * certainty is famously badly calibrated — so this is structural, and these tests
 * are the calibration.
 */
describe('scoreConfidence', () => {
  it('scores a flat statement of a value high', () => {
    expect(
      scoreConfidence('- **Premium:** €33/month', 'The car insurance premium is €33 per month.', {
        subject: 'car insurance',
        attribute: 'premium',
      }),
    ).toBeGreaterThan(0.85);
  });

  it('scores a hedged line low', () => {
    const hedged = scoreConfidence(
      'Rent is probably around 1111 a month, not sure',
      'The rent is approximately 1111 per month.',
    );
    const flat = scoreConfidence('Rent is 1111 per month', 'The rent is 1111 per month.');
    expect(hedged).toBeLessThan(flat);
    expect(hedged).toBeLessThan(0.6);
  });

  it('scores a question below a statement', () => {
    expect(
      scoreConfidence('Does the lease renew automatically?', 'The lease renews automatically.'),
    ).toBeLessThan(0.5);
  });

  it('scores an unchecked task low — an intention is not a fact', () => {
    expect(
      scoreConfidence('- [ ] Call the landlord about the rent', 'Call the landlord about the rent.'),
    ).toBeLessThan(0.55);
  });

  /**
   * The regression this guards. A markdown table row and a bold-key line both
   * trip every source-side structural signal — bullet shape, colon, digits — so a
   * deriver that answered with the *label* instead of the claim was scoring 0.86
   * on the single word "Warranty". A claim that is not a sentence cannot be a
   * well-formed claim, however well-formed its source line is.
   */
  it('penalizes a claim that is a fragment rather than a sentence', () => {
    const fragment = scoreConfidence('- **Warranty:** five years', 'Warranty');
    const sentence = scoreConfidence('- **Warranty:** five years', 'The warranty runs for five years.');
    expect(fragment).toBeLessThan(0.55);
    expect(sentence).toBeGreaterThan(0.75);
    expect(sentence - fragment).toBeGreaterThan(0.25);
  });

  it('penalizes a shouted table-header label', () => {
    expect(scoreConfidence('| UTILITIES | 2 | €0.00 | €123.45 |', 'UTILITIES')).toBeLessThan(0.5);
  });

  it('penalizes a two-word fragment even with a rich source line', () => {
    expect(scoreConfidence('**Mar 20–27:** Blackwater Bay', 'Blackwater Bay stay')).toBeLessThan(0.6);
  });

  it('does not penalize a short claim that carries a value', () => {
    // Three words, but it asserts something concrete.
    expect(scoreConfidence('- Rent: 1111 EUR', 'Rent is 1111 EUR')).toBeGreaterThan(0.6);
  });

  it('penalizes a claim far longer than its source — the deriver adding, not restating', () => {
    const inflated = scoreConfidence(
      'Zephyr dishwasher',
      'The household purchased a Zephyr dishwasher in March 2026 with a five-year warranty covering parts and labour.',
    );
    expect(inflated).toBeLessThan(0.6);
  });

  /**
   * §19 leaves confidence open and asks for measurement against a labelled set.
   * These are the shapes that survived the first calibration pass over a real
   * knowledge base and were still scoring high while carrying no subject.
   */
  it('penalizes a claim with no subject', () => {
    // A bare date. The line it came from said what the date was *for*; the claim
    // does not, so it cannot be read on its own.
    expect(scoreConfidence('- Born: 2 February 1970', '2 February 1970')).toBeLessThan(0.6);
    expect(scoreConfidence('- Renews: 2027-06-02', '2027-06-02')).toBeLessThan(0.6);
    // A dropped subject: who or what has specific hours?
    expect(scoreConfidence('The museum has specific hours.', 'has specific hours')).toBeLessThan(0.6);
  });

  it('exempts a Key: value claim, where the key is the subject', () => {
    // These read fine alone, so the short-claim penalty must not bury them.
    expect(scoreConfidence('- Capacity: 2.5 L', 'Capacity: 2.5 L')).toBeGreaterThan(0.7);
    expect(scoreConfidence('- Weight: 350 g', 'Weight: 350 g')).toBeGreaterThan(0.7);
  });

  it('stays inside 0..1 for every input', () => {
    const inputs: [string, string][] = [
      ['', ''],
      ['x', 'y'],
      ['probably maybe unclear tbd todo seems apparently', '?'],
      ['- **A:** 1 2026-01-01 €5 47% 3kg', 'A is one and it costs five euro and weighs three kilograms.'],
    ];
    for (const [source, claim] of inputs) {
      const score = scoreConfidence(source, claim);
      expect(score).toBeGreaterThanOrEqual(0.05);
      expect(score).toBeLessThanOrEqual(0.98);
    }
  });
});
