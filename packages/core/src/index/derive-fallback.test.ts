import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelClient } from '../models/client.ts';
import { derivePage } from './derive.ts';
import { parsePage } from '../kb/page.ts';

/**
 * When the full derivation cannot be had, the summary still can.
 *
 * The fallback asks for a summary alone at 400 tokens where the full request asks for a summary,
 * keywords and every fact at 2400 — so it is exactly the case that survives a slow model. It used
 * to be reachable only from unparseable JSON, which meant a **timeout lost the summary too**, and a
 * timeout is the likelier of the two failures on a local model. Measured on a real 222-page
 * knowledge base: six pages timed out and every one was left with no summary at all.
 */

let server: { url: string; close: () => Promise<void>; mode: (next: Mode) => void; calls: () => number };
type Mode = 'hang' | 'garbage' | 'ok';

async function startStub(): Promise<typeof server> {
  let mode: Mode = 'ok';
  let calls = 0;
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { max_tokens?: number };
      calls += 1;
      // The fallback is the request that asks for less; the full one is the first.
      const isFallback = (body.max_tokens ?? 0) <= 400;
      const reply = (content: string): void => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ message: { content } }] }));
      };

      if (!isFallback && mode === 'hang') return; // never answers → the client's deadline fires
      if (!isFallback && mode === 'garbage') return reply('{ "summary": "cut off mid');
      reply(
        isFallback
          ? JSON.stringify({ summary: 'Recovered on its own.', keywords: ['recovered'] })
          : JSON.stringify({ summary: 'Full derivation.', keywords: ['full'], facts: [] }),
      );
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    mode: (next) => {
      mode = next;
    },
    calls: () => calls,
  };
}

function client(url: string): ModelClient {
  return new ModelClient({
    role: 'derive',
    provider: { name: 'stub', baseUrl: url, apiKey: null, headers: {}, maxRetries: 0 },
    id: 'stub',
    enabled: true,
    requested: true,
    // Short, so a hung endpoint fails this test in a second rather than in two minutes.
    timeoutMs: 700,
    unavailableReason: null,
  });
}

const PAGE = parsePage(
  'home/lease.md',
  '---\ntitle: Lease\n---\n\n# Lease\n\n- Rent: 1450 EUR per month\n- Landlord: Grimwald Property BV\n',
);

beforeEach(async () => {
  server = await startStub();
});

afterEach(async () => {
  await server.close();
});

describe('derivation that cannot complete', () => {
  it('recovers the summary when the full request times out', async () => {
    server.mode('hang');
    const derived = await derivePage(PAGE, client(server.url), { summaries: true, facts: true });

    expect(derived.error).toBeNull();
    expect(derived.summary).toBe('Recovered on its own.');
    expect(derived.facts).toEqual([]);
    // Says which failure it was, because the fixes differ: a timeout wants a longer deadline or a
    // faster model, unparseable output wants a shorter page.
    expect(derived.partial).toMatch(/timed out/);
    expect(server.calls()).toBe(2);
  });

  it('recovers the summary when the full request answers unparseable JSON', async () => {
    server.mode('garbage');
    const derived = await derivePage(PAGE, client(server.url), { summaries: true, facts: true });

    expect(derived.error).toBeNull();
    expect(derived.summary).toBe('Recovered on its own.');
    expect(derived.partial).toMatch(/too long/);
  });

  it('does not call twice when the endpoint is not configured at all', async () => {
    // `unavailable` cannot be retried into success, and a second failure per page would double the
    // cost of a sweep that is already failing.
    const unavailable = new ModelClient({
      role: 'derive',
      provider: null,
      id: null,
      enabled: false,
      requested: true,
      timeoutMs: 700,
      unavailableReason: 'no model id configured',
    });
    const derived = await derivePage(PAGE, unavailable, { summaries: true, facts: true });
    expect(derived.summary).toBeNull();
    expect(derived.error).toMatch(/no model id configured/);
    expect(server.calls()).toBe(0);
  });

  it('leaves a working derivation alone', async () => {
    server.mode('ok');
    const derived = await derivePage(PAGE, client(server.url), { summaries: true, facts: true });
    expect(derived.summary).toBe('Full derivation.');
    expect(derived.partial).toBeUndefined();
    expect(server.calls()).toBe(1);
  });
});
