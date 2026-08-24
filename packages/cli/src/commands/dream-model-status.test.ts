import { describe, expect, it } from 'vitest';
import { dreamModelDegradationSummary, dreamModelUsageSummary } from './dream-model-status.ts';

describe('dream model status formatting', () => {
  it('distinguishes reported usage from calls whose endpoint omitted it', () => {
    expect(
      dreamModelUsageSummary({
        modelId: 'zephyr-model',
        calls: 2,
        successfulCalls: 2,
        failedCalls: 0,
        usageReportedCalls: 1,
        inputTokens: 111,
        outputTokens: 22,
        totalTokens: 133,
        latencyMs: 333,
        stages: [],
      }),
    ).toBe('2 calls · 133 reported tokens · usage on 1/2 calls · 333ms model latency');
  });

  it('formats typed degradation without human-readable provider errors', () => {
    expect(
      dreamModelDegradationSummary([
        { stage: 'observe', reason: 'no_derive_model', failure: 'unavailable', occurrences: 1 },
        { stage: 'curator', reason: 'derive_failed', failure: 'timeout', occurrences: 2 },
      ]),
    ).toBe('observe: no_derive_model/unavailable, curator: derive_failed/timeout (2×)');
    expect(dreamModelDegradationSummary([])).toBeNull();
  });
});
