import { describe, expect, it } from 'vitest';
import type { Card } from '@akno/protocol';
import { computeCoverage, estimateTokens } from './assemble.js';

function card(overrides: Partial<Card> = {}): Card {
  return {
    slug: 'documents/car-insurance-2026',
    title: 'Car insurance 2026',
    class: 'full',
    summary: 'Vulpine Mutual policy for the household car.',
    score: 0.9,
    lines: [],
    ...overrides,
  };
}

/**
 * §9. Coverage closes the most common hallucination path there is: a page ranks
 * first because it matches half the question, the agent reads it, and confidently
 * invents the other half.
 */
describe('computeCoverage', () => {
  it('reports a concept as covered when its words appear in what came back', () => {
    const coverage = computeCoverage(
      ['car insurance', 'renewal date'],
      [card({ lines: [{ n: 11, text: 'Premium: 33/month' }] })],
    );
    expect(coverage['car insurance']).toBe(true);
    expect(coverage['renewal date']).toBe(false);
  });

  it('is the difference between answering and inventing', () => {
    // The exact §9 example: the policy is found, the renewal date is not. An
    // agent reading this can say "I found the policy but it doesn't give a date".
    const coverage = computeCoverage(
      ['renewal date'],
      [card({ lines: [{ n: 11, text: 'Renews: 2026-11-04' }], summary: 'renewal date on file' })],
    );
    expect(coverage['renewal date']).toBe(true);
  });

  it('requires every content word, not just one', () => {
    const coverage = computeCoverage(
      ['second driver'],
      [card({ lines: [{ n: 3, text: 'The driver is insured.' }] })],
    );
    expect(coverage['second driver']).toBe(false);
  });

  it('survives plurals', () => {
    const coverage = computeCoverage(
      ['appliances'],
      [card({ lines: [{ n: 2, text: 'Replaced the appliance in March.' }] })],
    );
    expect(coverage['appliances']).toBe(true);
  });

  it('searches the summary and breadcrumb, not only the lines', () => {
    const coverage = computeCoverage(
      ['household car'],
      [card({ lines: [], breadcrumb: 'Car insurance 2026 › Policy' })],
    );
    expect(coverage['household car']).toBe(true);
  });
});

describe('estimateTokens', () => {
  it('grows with the content it carries', () => {
    const bare = estimateTokens(card({ summary: null }));
    const full = estimateTokens(
      card({ lines: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, text: 'x'.repeat(80) })) }),
    );
    expect(full).toBeGreaterThan(bare * 3);
  });

  it('charges for structural overhead, so an empty card is not free', () => {
    expect(estimateTokens(card({ summary: null, lines: [] }))).toBeGreaterThan(0);
  });
});
