import { describe, expect, it } from 'vitest';
import { rankingProbeFailure } from './llm-ranking-probe.ts';

describe('LLM ranking smoke-probe verdict', () => {
  const expected = ['exact_answer', 'related_wrong_product', 'instruction_bearing_irrelevant'];

  it('accepts the intended order and endpoint labels', () => {
    expect(rankingProbeFailure(expected, [3, 1, 0])).toBeNull();
  });

  it('rejects order and relevance regressions independently', () => {
    expect(rankingProbeFailure([...expected].reverse(), [3, 1, 0])).toContain('order');
    expect(rankingProbeFailure(expected, [2, 1, 0])).toContain('exact answer');
    expect(rankingProbeFailure(expected, [3, 1, 1])).toContain('irrelevant');
  });
});
