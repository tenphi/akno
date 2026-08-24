import type { DegradedReason } from '@tenphi/akno-protocol';
import type { ModelCallObservation, ModelFailure } from '../models/client.ts';
import type { DreamPhase } from './dream.ts';

export type DreamModelStage = DreamPhase | 'curator';

export interface DreamModelStageUsage {
  stage: DreamModelStage;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  usageReportedCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
}

export interface DreamModelUsageReceipt {
  modelId: string | null;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  usageReportedCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  stages: DreamModelStageUsage[];
}

export interface DreamModelDegradation {
  stage: DreamModelStage;
  reason: DegradedReason;
  failure: ModelFailure | null;
  occurrences: number;
}

interface MutableUsage {
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  usageReportedCalls: number;
  inputTokens: number;
  inputReported: boolean;
  outputTokens: number;
  outputReported: boolean;
  totalTokens: number;
  totalReported: boolean;
  latencyMs: number;
}

/** Exact provider receipts and typed capability failures for one dream invocation. */
export class DreamModelTelemetry {
  readonly #modelId: string | null;
  readonly #total = mutableUsage();
  readonly #stages = new Map<DreamModelStage, MutableUsage>();
  readonly #degraded = new Map<string, DreamModelDegradation>();

  constructor(modelId: string | null) {
    this.#modelId = modelId;
  }

  observe(stage: DreamModelStage, observation: ModelCallObservation): void {
    addObservation(this.#total, observation);
    const stageUsage = this.#stages.get(stage) ?? mutableUsage();
    addObservation(stageUsage, observation);
    this.#stages.set(stage, stageUsage);
    if (observation.degradedReason) {
      this.degrade(stage, observation.degradedReason, observation.failure);
    }
  }

  /** Record a capability that was needed but could not be called. */
  degrade(stage: DreamModelStage, reason: DegradedReason, failure: ModelFailure | null = null): void {
    const key = `${stage}\0${reason}\0${failure ?? ''}`;
    const current = this.#degraded.get(key);
    if (current) current.occurrences += 1;
    else this.#degraded.set(key, { stage, reason, failure, occurrences: 1 });
  }

  usage(): DreamModelUsageReceipt {
    return {
      modelId: this.#modelId,
      ...usageReceipt(this.#total),
      stages: [...this.#stages].map(([stage, usage]) => ({ stage, ...usageReceipt(usage) })),
    };
  }

  degradation(): DreamModelDegradation[] {
    return [...this.#degraded.values()].map((entry) => ({ ...entry }));
  }
}

export function emptyDreamModelUsage(modelId: string | null): DreamModelUsageReceipt {
  return { modelId, ...usageReceipt(mutableUsage()), stages: [] };
}

function mutableUsage(): MutableUsage {
  return {
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    usageReportedCalls: 0,
    inputTokens: 0,
    inputReported: false,
    outputTokens: 0,
    outputReported: false,
    totalTokens: 0,
    totalReported: false,
    latencyMs: 0,
  };
}

function addObservation(usage: MutableUsage, observation: ModelCallObservation): void {
  usage.calls += 1;
  if (observation.ok) usage.successfulCalls += 1;
  else usage.failedCalls += 1;
  usage.latencyMs += observation.latencyMs;
  if (!observation.usage) return;
  usage.usageReportedCalls += 1;
  if (observation.usage.inputTokens !== null) {
    usage.inputTokens += observation.usage.inputTokens;
    usage.inputReported = true;
  }
  if (observation.usage.outputTokens !== null) {
    usage.outputTokens += observation.usage.outputTokens;
    usage.outputReported = true;
  }
  if (observation.usage.totalTokens !== null) {
    usage.totalTokens += observation.usage.totalTokens;
    usage.totalReported = true;
  }
}

function usageReceipt(usage: MutableUsage): Omit<DreamModelStageUsage, 'stage'> {
  return {
    calls: usage.calls,
    successfulCalls: usage.successfulCalls,
    failedCalls: usage.failedCalls,
    usageReportedCalls: usage.usageReportedCalls,
    inputTokens: usage.inputReported ? usage.inputTokens : null,
    outputTokens: usage.outputReported ? usage.outputTokens : null,
    totalTokens: usage.totalReported ? usage.totalTokens : null,
    latencyMs: Math.round(usage.latencyMs),
  };
}
