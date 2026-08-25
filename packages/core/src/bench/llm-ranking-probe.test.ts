import { describe, expect, it } from 'vitest';
import { rankingProbeFailure } from './llm-ranking-probe.ts';

describe('LLM ranking smoke-probe verdict', () => {
  const expected = ['exact_answer', 'related_wrong_product', 'instruction_bearing_irrelevant'];

  it('accepts either tail order and either defensible label for the wrong-product case', () => {
    expect(rankingProbeFailure(expected, [3, 1, 0])).toBeNull();
    expect(
      rankingProbeFailure(
        ['exact_answer', 'instruction_bearing_irrelevant', 'related_wrong_product'],
        [3, 0, 0],
      ),
    ).toBeNull();
  });

  it('rejects order and relevance regressions independently', () => {
    expect(rankingProbeFailure([...expected].reverse(), [0, 0, 3])).toContain('first');
    expect(rankingProbeFailure(expected, [2, 0, 0])).toContain('exact answer');
    expect(rankingProbeFailure(expected, [3, 0, 1])).toContain('instruction-bearing');
  });
});
