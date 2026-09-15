import { describe, expect, it } from 'vitest';
import { coupledTransport } from '../../../scripts/language-comparison-transport.mjs';

describe('paired measurement response coupling', () => {
  it('pairs request occurrences without suppressing retries or repeated calls within one arm', async () => {
    let calls = 0;
    let arm = 'baseline';
    const fetch = coupledTransport({
      fetch: async () => new Response(JSON.stringify({ draw: ++calls })),
      coordinate: () => ({ id: 'invented', run: 1, stage: 'answer', arm }),
      receipt: () => {},
    });
    for (const next of ['baseline', 'candidate']) {
      arm = next;
      for (const draw of [1, 2])
        expect(await (await fetch('https://invented.invalid', { body: '{}' })).json()).toEqual({ draw });
    }
    expect(calls).toBe(2);
  });

  it('reuses exact requests across arms but separates repetitions, stages, sources and wire changes', async () => {
    let calls = 0;
    let active = { id: 'invented', run: 1, stage: 'answer-en', arm: 'baseline' };
    const receipts: Record<string, unknown>[] = [];
    const fetch = coupledTransport({
      fetch: async () => new Response(JSON.stringify({ draw: ++calls, usage: { total_tokens: 1111 } })),
      coordinate: () => active,
      receipt: (value: Record<string, unknown>) => receipts.push(value),
    });
    const url = 'https://invented.invalid/v1/responses';
    const options = {
      method: 'POST',
      headers: { authorization: 'invented-fixture-token' },
      body: JSON.stringify({ model: 'invented-model', input: 'The case is silver.' }),
    };
    expect(await (await fetch(url, options)).json()).toMatchObject({ draw: 1 });
    active = { ...active, arm: 'candidate' };
    expect(await (await fetch(url, options)).json()).toMatchObject({ draw: 1 });
    expect(receipts[1]).toMatchObject({ reusedFrom: 1, arm: 'candidate' });
    expect(receipts[1]).not.toHaveProperty('usage');
    for (const change of [{ run: 2 }, { stage: 'verify-en' }, { id: 'another-invented' }]) {
      active = { ...active, ...change };
      await fetch(url, options);
    }
    await fetch(url, { ...options, body: options.body.replace('silver', 'blue') });
    await fetch(url, { ...options, headers: { authorization: 'another-invented-token' } });
    await fetch(url.replace('/v1/', '/v2/'), options);
    expect(calls).toBe(7);
    expect(receipts.filter((item) => item.usage).length).toBe(7);
    expect(JSON.stringify(receipts)).not.toContain('invented-fixture-token');
    expect(JSON.stringify(receipts)).not.toContain('https://');
  });

  it('preserves HTTP and transport failures across arms without converting them into success', async () => {
    for (const networkFailure of [false, true]) {
      let calls = 0;
      const receipts: Record<string, unknown>[] = [];
      const fetch = coupledTransport({
        fetch: async () => {
          calls++;
          if (networkFailure) throw new TypeError('invented failure');
          return new Response('invented unavailable', { status: 503 });
        },
        coordinate: () => ({
          id: 'invented',
          run: 1,
          stage: 'answer',
          arm: calls ? 'candidate' : 'baseline',
        }),
        receipt: (value: Record<string, unknown>) => receipts.push(value),
      });
      for (let arm = 0; arm < 2; arm++) {
        const result = fetch('https://invented.invalid', { body: '{}' });
        if (networkFailure) await expect(result).rejects.toThrow(TypeError);
        else {
          const response = await result;
          expect(response.status).toBe(503);
          expect(await response.text()).toBe('invented unavailable');
        }
      }
      expect(calls).toBe(1);
      expect(receipts[1]).toMatchObject({ reusedFrom: 1 });
    }
  });
});
