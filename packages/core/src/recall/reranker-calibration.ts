import type { ModelClient, ModelOutcome } from '../models/client.ts';
import type { Store } from '../store/db.ts';

export const RERANKER_CALIBRATION_VERSION = 'invented-anchors-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CalibrationCase {
  query: string;
  documents: string[];
  /** Related evidence stays positive: auto-calibration is allowed to remove grade 0, not grade 1. */
  relevant: boolean[];
}

const CALIBRATION_CASES: CalibrationCase[] = [
  {
    query: 'How long is the Zephyr QX-100 warranty?',
    documents: [
      'The Zephyr QX-100 warranty lasts five years.',
      'The Zephyr QX-100 manual covers setup and servicing.',
      'The Zephyr QX-200 warranty lasts two years.',
      'The route to Blackwater Bay uses the northern ferry.',
    ],
    relevant: [true, true, false, false],
  },
  {
    query: "Which company issued Ada Marlow's policy?",
    documents: [
      "Ada Marlow's policy was issued by Vulpine Mutual.",
      'Ada Marlow keeps policy renewal notes.',
      "Bo Winters's policy was issued by Vulpine Mutual.",
      'The Zephyr QX-100 is stored near Blackwater Bay.',
    ],
    relevant: [true, true, false, false],
  },
  {
    query: 'What is the current Vulpine Mutual renewal amount?',
    documents: [
      'The current Vulpine Mutual renewal amount is 1111 EUR.',
      'The Vulpine Mutual renewal notice is filed with the policy.',
      'A superseded Vulpine Mutual notice listed 2222 EUR.',
      'Ada Marlow tested the Zephyr QX-100 at Blackwater Bay.',
    ],
    relevant: [true, true, false, false],
  },
];

export interface NativeRerankerCalibration {
  scoreOffset: number;
  falsePositiveRate: number;
  positiveCount: number;
  negativeCount: number;
  calibratedAt: string;
  version: string;
}

export interface CalibrationSample {
  score: number;
  relevant: boolean;
}

const running = new WeakMap<ModelClient, Promise<ModelOutcome<NativeRerankerCalibration>>>();

/**
 * Finds a conservative native-score boundary from wholly invented anchors and caches it in derived state.
 * Every labelled positive, including merely related evidence, must stay above the boundary. Hard negatives
 * that overlap those positives are retained rather than trading false rejection for a prettier probe score.
 */
export async function nativeRerankerCalibration(
  store: Store,
  model: ModelClient,
  now = new Date(),
): Promise<ModelOutcome<NativeRerankerCalibration>> {
  const fingerprint = model.endpointFingerprint;
  if (!fingerprint) return failure('reranker endpoint has no stable model identity');
  const key = `reranker_calibration:${RERANKER_CALIBRATION_VERSION}:${fingerprint}`;
  const cached = readCached(store.meta(key), now);
  if (cached) return { ok: true, value: cached, latencyMs: 0 };

  const active = running.get(model);
  if (active) return active;
  const task = calibrate(model, now).then((result) => {
    if (result.ok && result.value && !store.readOnly) store.setMeta(key, JSON.stringify(result.value));
    return result;
  });
  running.set(model, task);
  try {
    return await task;
  } finally {
    running.delete(model);
  }
}

async function calibrate(model: ModelClient, now: Date): Promise<ModelOutcome<NativeRerankerCalibration>> {
  const started = performance.now();
  const samples: CalibrationSample[] = [];
  for (const calibrationCase of CALIBRATION_CASES) {
    const result = await model.rerank(
      calibrationCase.query,
      calibrationCase.documents,
      calibrationCase.documents.length,
    );
    if (!result.ok || !result.value) return { ...result, value: null };
    const scores = completeScores(result.value, calibrationCase.documents.length);
    if (!scores) return failure('native reranker calibration returned an incomplete permutation', started);
    scores.forEach((score, index) => samples.push({ score, relevant: calibrationCase.relevant[index]! }));
  }

  const boundary = conservativeBoundary(samples);
  if (!boundary) {
    return failure('native reranker could not separate invented relevant and irrelevant anchors', started);
  }
  return {
    ok: true,
    value: {
      scoreOffset: boundary.scoreOffset,
      falsePositiveRate: boundary.falsePositiveRate,
      positiveCount: samples.filter((sample) => sample.relevant).length,
      negativeCount: samples.filter((sample) => !sample.relevant).length,
      calibratedAt: now.toISOString(),
      version: RERANKER_CALIBRATION_VERSION,
    },
    latencyMs: performance.now() - started,
  };
}

/** Selects the highest useful boundary that rejects no labelled positive anchor. */
export function conservativeBoundary(
  samples: CalibrationSample[],
): Pick<NativeRerankerCalibration, 'scoreOffset' | 'falsePositiveRate'> | null {
  const positives = samples.filter((sample) => sample.relevant).map((sample) => sample.score);
  const negatives = samples.filter((sample) => !sample.relevant).map((sample) => sample.score);
  if (positives.length === 0 || negatives.length === 0) return null;
  const minPositive = Math.min(...positives);
  const rejectedNegatives = negatives.filter((score) => score < minPositive);
  if (rejectedNegatives.length === 0) return null;
  const strongestRejectedNegative = Math.max(...rejectedNegatives);
  const scoreOffset = midpoint(strongestRejectedNegative, minPositive);
  const falsePositiveRate = negatives.filter((score) => score >= scoreOffset).length / negatives.length;
  // A boundary that cannot reject even half the known negatives is too ambiguous to apply automatically.
  if (falsePositiveRate > 0.5) return null;
  return { scoreOffset, falsePositiveRate };
}

function completeScores(entries: { index: number; score: number }[], count: number): number[] | null {
  if (entries.length !== count) return null;
  const scores = new Array<number>(count);
  for (const entry of entries) {
    if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= count) return null;
    if (!Number.isFinite(entry.score) || scores[entry.index] !== undefined) return null;
    scores[entry.index] = entry.score;
  }
  for (let index = 0; index < count; index++) {
    if (scores[index] === undefined) return null;
  }
  return scores;
}

function readCached(raw: string | null, now: Date): NativeRerankerCalibration | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as NativeRerankerCalibration;
    const age = now.getTime() - Date.parse(value.calibratedAt);
    if (
      value.version !== RERANKER_CALIBRATION_VERSION ||
      !Number.isFinite(value.scoreOffset) ||
      !Number.isFinite(value.falsePositiveRate) ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > MAX_AGE_MS
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function midpoint(a: number, b: number): number {
  return a + (b - a) / 2;
}

function failure(error: string, started: number | null = null): ModelOutcome<NativeRerankerCalibration> {
  return {
    ok: false,
    value: null,
    reason: 'bad_response',
    error,
    latencyMs: started === null ? 0 : performance.now() - started,
  };
}
