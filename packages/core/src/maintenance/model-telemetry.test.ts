import { describe, expect, it } from 'vitest';
import { DreamModelTelemetry, emptyDreamModelUsage } from './model-telemetry.ts';

describe('dream model telemetry', () => {
  it('aggregates content-free usage across planner and curator stages', () => {
    const telemetry = new DreamModelTelemetry('zephyr-model');
    telemetry.observe('observe', {
      event: 'call',
      role: 'derive',
      modelId: 'zephyr-model',
      ok: true,
      failure: null,
      degradedReason: null,
      latencyMs: 111.4,
      usage: { inputTokens: 111, outputTokens: 22, totalTokens: 133 },
    });
    telemetry.observe('curator', {
      event: 'call',
      role: 'derive',
      modelId: 'zephyr-model',
      ok: false,
      failure: 'timeout',
      degradedReason: 'derive_failed',
      latencyMs: 222.4,
      usage: null,
    });

    expect(telemetry.usage()).toEqual({
      modelId: 'zephyr-model',
      calls: 2,
      successfulCalls: 1,
      failedCalls: 1,
      usageReportedCalls: 1,
      inputTokens: 111,
      outputTokens: 22,
      totalTokens: 133,
      latencyMs: 334,
      stages: [
        {
          stage: 'observe',
          calls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          usageReportedCalls: 1,
          inputTokens: 111,
          outputTokens: 22,
          totalTokens: 133,
          latencyMs: 111,
        },
        {
          stage: 'curator',
          calls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          usageReportedCalls: 0,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          latencyMs: 222,
        },
      ],
    });
    expect(telemetry.degradation()).toEqual([
      { stage: 'curator', reason: 'derive_failed', failure: 'timeout', occurrences: 1 },
    ]);
  });

  it('reclassifies an unusable response without duplicating its call or token receipt', () => {
    const telemetry = new DreamModelTelemetry('zephyr-model');
    telemetry.observe('observe', {
      event: 'call',
      role: 'derive',
      modelId: 'zephyr-model',
      ok: true,
      failure: null,
      degradedReason: null,
      latencyMs: 111.4,
      usage: { inputTokens: 111, outputTokens: 22, totalTokens: 133 },
    });
    telemetry.observe('observe', {
      event: 'semantic_failure',
      role: 'derive',
      modelId: 'zephyr-model',
      failure: 'bad_response',
      degradedReason: 'derive_failed',
    });

    expect(telemetry.usage()).toMatchObject({
      calls: 1,
      successfulCalls: 0,
      failedCalls: 1,
      usageReportedCalls: 1,
      inputTokens: 111,
      outputTokens: 22,
      totalTokens: 133,
      stages: [
        {
          stage: 'observe',
          calls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          totalTokens: 133,
        },
      ],
    });
    expect(telemetry.degradation()).toEqual([
      { stage: 'observe', reason: 'derive_failed', failure: 'bad_response', occurrences: 1 },
    ]);
  });

  it('keeps unavailable capability counts typed without inventing token usage', () => {
    const telemetry = new DreamModelTelemetry(null);
    telemetry.degrade('observe', 'no_derive_model', 'unavailable');
    telemetry.degrade('observe', 'no_derive_model', 'unavailable');

    expect(telemetry.usage()).toEqual(emptyDreamModelUsage(null));
    expect(telemetry.degradation()).toEqual([
      { stage: 'observe', reason: 'no_derive_model', failure: 'unavailable', occurrences: 2 },
    ]);
  });
});
