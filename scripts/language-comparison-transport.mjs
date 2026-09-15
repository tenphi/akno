import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Coupling is scoped to a single coordinate/repetition/stage and exact provider request. */
export function coupledTransport({ fetch: physicalFetch, coordinate, receipt: record }) {
  const cache = new Map();
  const occurrences = new Map();
  let sequence = 0;
  return async (url, options) => {
    const active = coordinate();
    assert(active, 'Unattributed provider call.');
    assert(typeof url === 'string' || url instanceof URL, 'Use a URL and explicit request options.');
    const body = typeof options?.body === 'string' ? JSON.parse(options.body) : {};
    // Provider identity/auth participate in matching but never enter public receipts.
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([String(url), options?.method, [...new Headers(options?.headers)], options?.body]),
      )
      .digest('hex');
    const coordinateKey = [active.id, active.run, active.stage, fingerprint];
    const armKey = JSON.stringify([...coordinateKey, active.arm]);
    const occurrence = (occurrences.get(armKey) ?? 0) + 1;
    occurrences.set(armKey, occurrence);
    // Repeated calls and retries in one arm must remain real calls. Couple only the
    // corresponding occurrence in the other arm, including when the first call failed.
    const key = JSON.stringify([...coordinateKey, occurrence]);
    const prior = cache.get(key);
    const receipt = {
      sequence: ++sequence,
      id: active.id,
      run: active.run,
      arm: active.arm,
      stage: active.stage,
      requestSha256: fingerprint,
      model: body.model,
      occurrence,
      reusedFrom: prior?.sequence ?? null,
    };
    const started = Date.now();
    try {
      options?.signal?.throwIfAborted();
      let response = prior?.response;
      if (!response) {
        response = physicalFetch(url, options).then(async (value) => ({
          status: value.status,
          headers: [...value.headers],
          text: await value.text(),
        }));
        cache.set(key, { sequence: receipt.sequence, response });
      }
      const saved = await response;
      receipt.status = saved.status;
      if (!prior) {
        let payload;
        try {
          payload = JSON.parse(saved.text);
        } catch {
          /* Preserve non-JSON provider failures. */
        }
        receipt.usage = payload?.usage ?? null;
      }
      return new Response(saved.text, { status: saved.status, headers: saved.headers });
    } catch (error) {
      receipt.failure = error.name;
      throw error;
    } finally {
      receipt.latencyMs = Date.now() - started;
      record(receipt);
    }
  };
}
