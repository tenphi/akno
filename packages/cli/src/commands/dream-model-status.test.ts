import { describe, expect, it } from 'vitest';
import {
  dreamAutoEstimateSummary,
  dreamModelDegradationSummary,
  dreamModelUsageSummary,
} from './dream-model-status.ts';

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

  it('labels heuristic curator estimates without presenting them as measured usage', () => {
    expect(
      dreamAutoEstimateSummary({
        status: 'estimated',
        scope: 'initial_curator_pass',
        modelId: 'zephyr-model',
        modelConfigured: true,
        curatorCalls: 2,
        estimatedPromptTokens: 1111,
        maximumOutputTokens: 1200,
        method: 'characters_div_4',
        postApplyRetryIncluded: false,
      }),
    ).toBe('2 initial curator candidates · ~1111 prompt-message tokens · ≤1200 output tokens');
    expect(
      dreamAutoEstimateSummary({
        status: 'no_sealed_plan',
        scope: 'initial_curator_pass',
        modelId: 'zephyr-model',
        modelConfigured: true,
        curatorCalls: null,
        estimatedPromptTokens: null,
        maximumOutputTokens: null,
        method: null,
        postApplyRetryIncluded: false,
      }),
    ).toMatch(/use --mode audit/);
  });
});
