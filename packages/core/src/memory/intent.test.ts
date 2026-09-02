import { describe, expect, it } from 'vitest';
import { inferMemoryView, memoryEligibleForView, type MemorySemantics } from './intent.ts';

const factual: MemorySemantics = {
  kind: 'claim',
  commitment: 'asserted',
  disposition: 'active',
  basis: 'self_attested',
  answerEligible: true,
};

describe('memory-view inference', () => {
  it.each([
    ['What did Bo Winters report about the warranty?', 'reports'],
    ['Which open questions remain about calibration?', 'questions'],
    ['What hypothetical scenario was discussed?', 'discussion'],
    ['Show the decision history for the contract.', 'history'],
    ['What is the planned inspection schedule?', 'planning'],
    ['How long is the warranty?', 'factual'],
  ] as const)('infers %s as %s', (query, view) => {
    expect(inferMemoryView(query)).toBe(view);
  });

  it('broadens an otherwise ambiguous explore request without broadening lookup', () => {
    expect(inferMemoryView('Zephyr QX-100', 'lookup')).toBe('factual');
    expect(inferMemoryView('Zephyr QX-100', 'explore')).toBe('all');
  });
});

describe('memory-view eligibility', () => {
  it('keeps canonical facts narrow and exposes noncanonical memory only in its own view', () => {
    const report = { ...factual, basis: 'source_report' as const, answerEligible: false };
    const proposal = {
      ...factual,
      kind: 'plan' as const,
      disposition: 'proposed' as const,
      answerEligible: false,
    };
    const question = {
      ...factual,
      kind: 'question' as const,
      commitment: 'none' as const,
      answerEligible: false,
    };
    const hypothetical = {
      ...factual,
      commitment: 'hypothetical' as const,
      answerEligible: false,
    };

    expect(memoryEligibleForView(factual, 'factual')).toBe(true);
    expect(memoryEligibleForView(report, 'factual')).toBe(false);
    expect(memoryEligibleForView(report, 'reports')).toBe(true);
    expect(memoryEligibleForView(proposal, 'planning')).toBe(true);
    expect(memoryEligibleForView(proposal, 'discussion')).toBe(true);
    expect(memoryEligibleForView(question, 'questions')).toBe(true);
    expect(memoryEligibleForView(hypothetical, 'discussion')).toBe(true);
    expect(memoryEligibleForView(hypothetical, 'all')).toBe(true);
  });
});
