import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelFallbackWarning } from '@tenphi/akno-protocol';
import { ModelClient, type ModelCallObservation } from './client.ts';
import { collectModelFallbacks, onModelFallback, reportModelFallback } from './fallback-notices.ts';
import { loadConfig } from '../config/load.ts';
import type { ProviderDoc } from '../config/schema.ts';
import { open } from '../open.ts';

const temporary: string[] = [];
const closers: (() => void)[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const close of closers.splice(0)) close();
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

function inventedDirectory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-fallback-'));
  temporary.push(root);
  return root;
}

/** Codex's auth file with an invented token; only the payload's `exp` is read. */
function signIn(expiresInSeconds: number): void {
  const home = inventedDirectory();
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = `invented-header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.invented-signature`;
  fs.writeFileSync(
    path.join(home, 'auth.json'),
    JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: token, account_id: 'invented-account' } }),
  );
  vi.stubEnv('CODEX_HOME', home);
}

interface Served {
  status?: number;
  body?: string;
  delayMs?: number;
}

/** A local endpoint that records how often it was called and answers as `reply` says. */
async function endpoint(
  reply: (request: number) => Served,
): Promise<{ url: string; requests: () => number }> {
  let requests = 0;
  const server = http.createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      const served = reply(++requests);
      setTimeout(() => {
        response.writeHead(served.status ?? 200, { 'content-type': 'application/json' });
        response.end(served.body ?? '');
      }, served.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => {
    server.close();
    server.closeAllConnections();
  });
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}/v1`, requests: () => requests };
}

const message = (text: string) =>
  JSON.stringify({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  });
const streamed = (text: string) =>
  `data: ${JSON.stringify({ type: 'response.completed', response: JSON.parse(message(text)) })}\n\n`;

function providers(subscription: string, metered: string, subscriptionDoc: Partial<ProviderDoc> = {}) {
  return {
    subscription: {
      auth: 'chatgpt' as const,
      base_url: subscription,
      max_retries: 0,
      fallback: 'metered',
      ...subscriptionDoc,
    },
    metered: { base_url: metered, api: 'responses' as const, max_retries: 0 },
  };
}

function deriveClient(
  subscription: string,
  metered: string,
  observer: ((observation: ModelCallObservation) => void) | null = null,
): ModelClient {
  const root = inventedDirectory();
  const config = loadConfig({
    isolated: true,
    env: {},
    overrides: {
      akno_path: root,
      state_dir: path.join(root, '.state'),
      providers: providers(subscription, metered),
      models: { derive: { provider: 'subscription', id: 'invented-generative-model' } },
    },
  });
  return new ModelClient(config.models.derive, observer);
}

const ask = (client: ModelClient, options: { timeoutMs?: number } = {}) =>
  collectModelFallbacks(() =>
    client.chat([{ role: 'user', content: 'Describe the invented Zephyr QX-100.' }], options),
  );

describe('a fallback provider', () => {
  it('is accepted only on a subscription provider, and only naming another kind', () => {
    const root = inventedDirectory();
    const load = (docs: Record<string, ProviderDoc>) =>
      loadConfig({ isolated: true, env: {}, overrides: { akno_path: root, providers: docs } });

    expect(
      load(providers('https://sub.example.test/codex', 'https://api.example.test/v1')).providers.subscription
        ?.fallback?.name,
    ).toBe('metered');
    expect(() => load({ metered: { base_url: 'https://api.example.test/v1', fallback: 'other' } })).toThrow(
      /only for auth "chatgpt"/,
    );
    expect(() =>
      load(
        providers('https://sub.example.test/codex', 'https://api.example.test/v1', { fallback: 'absent' }),
      ),
    ).toThrow(/must name a configured provider/);
    expect(() =>
      load({
        subscription: { auth: 'chatgpt', fallback: 'second' },
        second: { auth: 'chatgpt' },
      }),
    ).toThrow(/must name a configured provider/);
  });

  it('serves the call when the login is unusable, and says so', async () => {
    signIn(-60);
    const subscription = await endpoint(() => ({ body: streamed('subscription') }));
    const metered = await endpoint(() => ({ body: message('metered') }));
    const client = deriveClient(subscription.url, metered.url);

    expect(client.available).toBe(true);
    expect(client.unavailableReason).toBeNull();
    expect(client.fallbackNotice).toMatch(/^derive: the ChatGPT login has expired.*provider "metered"$/);

    const { value, warnings } = await ask(client);
    expect(value).toMatchObject({ ok: true, value: 'metered' });
    expect(subscription.requests()).toBe(0);
    expect(metered.requests()).toBe(1);
    expect(warnings).toEqual([
      {
        type: 'model_fallback',
        role: 'derive',
        provider: 'subscription',
        fallback_provider: 'metered',
        reason: 'login_unavailable',
        message: expect.stringMatching(
          /^derive used provider "metered" because provider "subscription" has no usable login: the ChatGPT login has expired/,
        ),
      },
    ]);
  });

  it('serves the call after a usage limit, observing only the call that answered', async () => {
    signIn(3600);
    const subscription = await endpoint(() => ({ status: 429, body: '{"detail":"Invented usage limit."}' }));
    const metered = await endpoint(() => ({ body: message('metered') }));
    const observations: ModelCallObservation[] = [];
    const client = deriveClient(subscription.url, metered.url, (observation) =>
      observations.push(observation),
    );

    const { value, warnings } = await ask(client);

    expect(value).toMatchObject({ ok: true, value: 'metered', endpointRequests: 2 });
    expect(warnings.map((warning) => warning.reason)).toEqual(['rate_limited']);
    // A failed attempt the fallback answered must not read as a degraded stage.
    expect(observations).toMatchObject([{ event: 'call', ok: true }]);
  });

  it('leaves a successful subscription call alone', async () => {
    signIn(3600);
    const subscription = await endpoint(() => ({ body: streamed('subscription') }));
    const metered = await endpoint(() => ({ body: message('metered') }));

    const { value, warnings } = await ask(deriveClient(subscription.url, metered.url));

    expect(value).toMatchObject({ ok: true, value: 'subscription' });
    expect(metered.requests()).toBe(0);
    expect(warnings).toEqual([]);
  });

  it('keeps an answer that broke its contract, which is the model, not an outage', async () => {
    signIn(3600);
    const subscription = await endpoint(() => ({
      body: `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [] } })}\n\n`,
    }));
    const metered = await endpoint(() => ({ body: message('metered') }));

    const { value, warnings } = await ask(deriveClient(subscription.url, metered.url));

    expect(value).toMatchObject({ ok: false, reason: 'bad_response' });
    expect(metered.requests()).toBe(0);
    expect(warnings).toEqual([]);
  });

  it('does not outlast a caller deadline the subscription already spent', async () => {
    signIn(3600);
    const subscription = await endpoint(() => ({ body: streamed('late'), delayMs: 400 }));
    const metered = await endpoint(() => ({ body: message('metered') }));

    const { value, warnings } = await ask(deriveClient(subscription.url, metered.url), { timeoutMs: 150 });

    expect(value).toMatchObject({ ok: false, reason: 'timeout' });
    expect(metered.requests()).toBe(0);
    expect(warnings).toEqual([]);
  });
});

describe('fallback warnings', () => {
  const warning = (role: string): ModelFallbackWarning => ({
    type: 'model_fallback',
    role,
    provider: 'subscription',
    fallback_provider: 'metered',
    reason: 'timeout',
    message: `${role} used provider "metered"`,
  });

  it('collect once per role and reason, pass up to an enclosing scope, and reach listeners', async () => {
    const heard: string[] = [];
    const stop = onModelFallback((reported) => heard.push(reported.role));
    try {
      const outer = await collectModelFallbacks(async () => {
        const inner = await collectModelFallbacks(async () => {
          reportModelFallback(warning('derive'));
          reportModelFallback(warning('derive'));
        });
        expect(inner.warnings).toHaveLength(1);
        reportModelFallback(warning('expansion'));
      });
      expect(outer.warnings.map((reported) => reported.role)).toEqual(['derive', 'expansion']);
      expect(heard).toEqual(['derive', 'derive', 'expansion']);
    } finally {
      stop();
    }
  });

  it('reach the caller of an op whose model call fell back', async () => {
    signIn(-60);
    const subscription = await endpoint(() => ({ body: streamed('{}') }));
    const metered = await endpoint(() => ({
      body: message('{"queries":["Zephyr QX-100 warranty"],"concepts":["warranty"]}'),
    }));
    const root = inventedDirectory();
    fs.writeFileSync(
      path.join(root, 'zephyr.md'),
      '# Zephyr QX-100\n\nThe invented warranty lasts five years.\n',
    );
    const memory = await open({
      isolated: true,
      env: {},
      writable: true,
      overrides: {
        akno_path: root,
        state_dir: path.join(root, '.state'),
        providers: providers(subscription.url, metered.url),
        models: {
          embedding: { enabled: false },
          derive: { enabled: false },
          expansion: { provider: 'subscription', id: 'invented-generative-model' },
        },
      },
    });
    try {
      await memory.index();
      const result = await memory.recall({ query: 'how long is the Zephyr warranty' });

      expect(metered.requests()).toBeGreaterThan(0);
      expect(result.warnings).toEqual([
        expect.objectContaining({ type: 'model_fallback', role: 'expansion', reason: 'login_unavailable' }),
      ]);
    } finally {
      await memory.close();
    }
  });
});
