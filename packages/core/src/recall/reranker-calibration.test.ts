import { describe, expect, it } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import type { Store } from '../store/db.ts';
import { conservativeBoundary, nativeRerankerCalibration } from './reranker-calibration.ts';

describe('native reranker automatic calibration', () => {
  it('places the boundary between invented negative and weak-positive anchors', () => {
    const boundary = conservativeBoundary([
      { score: 8, relevant: true },
      { score: 1, relevant: true },
      { score: -1, relevant: false },
      { score: -11, relevant: false },
    ]);
    expect(boundary).toEqual({ scoreOffset: 0, falsePositiveRate: 0 });
  });

  it('retains an overlapping hard negative instead of rejecting a positive anchor', () => {
    const boundary = conservativeBoundary([
      { score: 1.2, relevant: true },
      { score: 0.2, relevant: true },
      { score: 0.4, relevant: false },
      { score: -0.4, relevant: false },
      { score: -0.8, relevant: false },
    ]);
    expect(boundary?.scoreOffset).toBeCloseTo(-0.1);
    expect(boundary?.falsePositiveRate).toBeCloseTo(1 / 3);
  });

  it('refuses an unusable boundary instead of guessing', () => {
    expect(
      conservativeBoundary([
        { score: 0, relevant: true },
        { score: 1, relevant: false },
      ]),
    ).toBeNull();
  });

  it('persists a content-safe calibration and reuses it for the same endpoint', async () => {
    const meta = new Map<string, string>();
    const store = {
      readOnly: false,
      meta: (key: string) => meta.get(key) ?? null,
      setMeta: (key: string, value: string) => meta.set(key, value),
    } as unknown as Store;
    let calls = 0;
    const model = {
      endpointFingerprint: 'invented-endpoint-fingerprint',
      rerank: async () => {
        calls++;
        return {
          ok: true,
          value: [
            { index: 0, score: 8 },
            { index: 1, score: 1 },
            { index: 2, score: -1 },
            { index: 3, score: -11 },
          ],
          latencyMs: 1,
        };
      },
    } as unknown as ModelClient;
    const at = new Date('2027-01-02T03:04:05.000Z');
    const first = await nativeRerankerCalibration(store, model, at);
    expect(first).toMatchObject({ ok: true, value: { scoreOffset: 0 } });
    expect(calls).toBe(3);

    const cachedOnly = {
      endpointFingerprint: 'invented-endpoint-fingerprint',
      rerank: async () => {
        throw new Error('cache was not used');
      },
    } as unknown as ModelClient;
    const second = await nativeRerankerCalibration(store, cachedOnly, at);
    expect(second).toMatchObject({ ok: true, value: { scoreOffset: 0 }, latencyMs: 0 });
  });
});
