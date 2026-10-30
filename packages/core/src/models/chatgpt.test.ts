import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHATGPT_CODEX_BASE_URL, codexAuthPath, readChatGptLogin, readResponsesStream } from './chatgpt.ts';
import { ModelClient } from './client.ts';
import { loadConfig } from '../config/load.ts';
import type { ProviderDoc } from '../config/schema.ts';

const temporary: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

function inventedDirectory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-chatgpt-'));
  temporary.push(root);
  return root;
}

/** An invented token shaped like Codex's: only the payload's `exp` is read. */
function inventedToken(expiresInSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  ).toString('base64url');
  return `invented-header.${payload}.invented-signature`;
}

function writeLogin(dir: string, doc: unknown): string {
  const file = path.join(dir, 'auth.json');
  fs.writeFileSync(file, typeof doc === 'string' ? doc : JSON.stringify(doc));
  return file;
}

function signIn(expiresInSeconds = 3600): string {
  const home = inventedDirectory();
  const token = inventedToken(expiresInSeconds);
  writeLogin(home, {
    auth_mode: 'chatgpt',
    tokens: { access_token: token, account_id: 'invented-account' },
  });
  vi.stubEnv('CODEX_HOME', home);
  return token;
}

describe('the Codex login', () => {
  it('lives under CODEX_HOME, or ~/.codex without it', () => {
    expect(codexAuthPath({ CODEX_HOME: '/invented/codex' })).toBe('/invented/codex/auth.json');
    expect(codexAuthPath({})).toBe(path.join(os.homedir(), '.codex', 'auth.json'));
  });

  it('reads a current ChatGPT login', () => {
    const dir = inventedDirectory();
    const token = inventedToken(3600);
    const file = writeLogin(dir, {
      auth_mode: 'chatgpt',
      tokens: { access_token: token, account_id: 'invented-account' },
    });

    expect(readChatGptLogin(file)).toEqual({
      status: 'ok',
      login: { accessToken: token, accountId: 'invented-account' },
    });
  });

  it('names each reason a login cannot be used', () => {
    const dir = inventedDirectory();

    expect(readChatGptLogin(path.join(dir, 'absent.json')).status).toBe('missing');
    expect(readChatGptLogin(writeLogin(dir, '{ not json')).status).toBe('unreadable');
    expect(readChatGptLogin(writeLogin(dir, { auth_mode: 'apikey', tokens: null })).status).toBe(
      'not_chatgpt',
    );
    expect(
      readChatGptLogin(
        writeLogin(dir, {
          auth_mode: 'chatgpt',
          tokens: { access_token: inventedToken(-60), account_id: 'invented-account' },
        }),
      ).status,
    ).toBe('expired');
  });
});

describe('a streamed Responses call', () => {
  const stream = (...events: unknown[]) =>
    new Response(events.map((event) => `event: x\ndata: ${JSON.stringify(event)}\n\n`).join(''));

  it('collapses to the terminal event’s response', async () => {
    const response = { status: 'completed', output: [] };

    await expect(
      readResponsesStream(
        stream(
          { type: 'response.created', response: { status: 'in_progress' } },
          { type: 'response.output_text.delta', delta: 'Invented' },
          { type: 'response.completed', response },
        ),
      ),
    ).resolves.toEqual(response);
  });

  it('reports an error event or a stream cut short as a failed response', async () => {
    await expect(
      readResponsesStream(stream({ type: 'error', message: 'Invented backend failure.' })),
    ).resolves.toEqual({ status: 'failed', error: { message: 'Invented backend failure.' } });
    await expect(
      readResponsesStream(stream({ type: 'response.created', response: { status: 'in_progress' } })),
    ).resolves.toMatchObject({ status: 'failed' });
  });
});

function loadWith(provider: ProviderDoc, models: Record<string, unknown> = {}, env: NodeJS.ProcessEnv = {}) {
  const root = inventedDirectory();
  return loadConfig({
    isolated: true,
    env,
    overrides: {
      akno_path: root,
      state_dir: path.join(root, '.state'),
      providers: {
        subscription: provider,
        metered: { base_url: 'https://models.example.test/v1', api: 'responses' },
      },
      models: {
        embedding: { provider: 'metered', id: 'invented-embedding-model' },
        derive: { provider: 'subscription', id: 'invented-generative-model' },
        ...models,
      },
    },
  });
}

describe('an auth: "chatgpt" provider', () => {
  it('defaults to the Codex backend over Responses and never resolves an API key', () => {
    const config = loadWith({ auth: 'chatgpt' }, {}, { OPENAI_API_KEY: 'sk-invented-key-1111' });

    expect(config.providers.subscription).toMatchObject({
      baseUrl: CHATGPT_CODEX_BASE_URL,
      auth: 'chatgpt',
      apiKey: null,
      api: 'responses',
      apiResolution: 'explicit',
    });
    expect(config.models.derive.enabled).toBe(true);
  });

  it('refuses an API key or another transport rather than ignoring it', () => {
    expect(() => loadWith({ auth: 'chatgpt', api_key: { env: 'INVENTED_KEY' } })).toThrow(/remove api_key/);
    expect(() => loadWith({ auth: 'chatgpt', api: 'chat_completions' })).toThrow(/only the Responses API/);
  });

  it('leaves embeddings and endpoint reranking unavailable with the fix in the reason', () => {
    const config = loadWith(
      { auth: 'chatgpt' },
      {
        embedding: { provider: 'subscription', id: 'invented-embedding-model' },
        reranker: {
          provider: 'subscription',
          id: 'invented-generative-model',
          enabled: true,
          mode: 'decisions',
        },
      },
    );

    for (const role of [config.models.embedding, config.models.reranker]) {
      expect(role).toMatchObject({ enabled: false, requested: true });
      expect(role.unavailableReason).toMatch(/ChatGPT subscription.*point \w+ at an API-key provider/);
    }
  });

  it('can still serve prompted reranking, which is ordinary generation', () => {
    const config = loadWith(
      { auth: 'chatgpt' },
      { reranker: { provider: 'subscription', id: 'invented-generative-model', enabled: true, mode: 'llm' } },
    );

    expect(config.models.reranker).toMatchObject({ enabled: true, unavailableReason: null });
  });
});

describe('the subscription transport', () => {
  interface Seen {
    headers: http.IncomingHttpHeaders;
    body: Record<string, unknown>;
  }

  const completed = (text: string) => ({
    type: 'response.completed',
    response: {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
      usage: { input_tokens: 11, output_tokens: 2, total_tokens: 13 },
    },
  });

  async function serve(
    reply: (request: number) => { status?: number; events?: unknown[]; body?: string },
    run: (client: ModelClient) => Promise<unknown>,
  ): Promise<{ result: unknown; seen: Seen[] }> {
    const seen: Seen[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        seen.push({
          headers: request.headers,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
        });
        const served = reply(seen.length);
        // The backend sends its stream without a content type.
        response.writeHead(served.status ?? 200);
        response.end(
          served.body ?? (served.events ?? []).map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    try {
      const config = loadWith({
        auth: 'chatgpt',
        base_url: `http://127.0.0.1:${port}/codex`,
        max_retries: 0,
      });
      return { result: await run(new ModelClient(config.models.derive)), seen };
    } finally {
      server.close();
      server.closeAllConnections();
    }
  }

  it('streams with the Codex login, statelessly, and without temperature', async () => {
    const token = signIn();
    const { result, seen } = await serve(
      () => ({ events: [{ type: 'response.created' }, completed('ok')] }),
      (client) =>
        client.chat([{ role: 'user', content: 'Describe the invented Zephyr QX-100.' }], {
          maxTokens: 64,
          temperature: 0,
        }),
    );

    expect(result).toMatchObject({ ok: true, value: 'ok', endpointRequests: 1 });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.headers).toMatchObject({
      authorization: `Bearer ${token}`,
      'chatgpt-account-id': 'invented-account',
      originator: 'akno',
      accept: 'text/event-stream',
    });
    expect(seen[0]!.body).toMatchObject({ stream: true, store: false, max_output_tokens: 64 });
    expect(seen[0]!.body).not.toHaveProperty('temperature');
  });

  it('retries a reasoning-exhausted response once, as over the API', async () => {
    signIn();
    const { result, seen } = await serve(
      (request) =>
        request === 1
          ? {
              events: [
                {
                  type: 'response.incomplete',
                  response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
                },
              ],
            }
          : { events: [completed('{"ok":true}')] },
      (client) => client.chat([{ role: 'user', content: 'Return the invented verdict.' }], { maxTokens: 32 }),
    );

    expect(seen.map((request) => request.body.max_output_tokens)).toEqual([32, 4096]);
    expect(result).toMatchObject({ ok: true, value: '{"ok":true}', endpointRequests: 2 });
  });

  it('reports a failure inside the stream with the backend’s message', async () => {
    signIn();
    const { result } = await serve(
      () => ({ events: [{ type: 'error', message: 'Invented plan limit reached.' }] }),
      (client) => client.chat([{ role: 'user', content: 'Invented request.' }]),
    );

    expect(result).toMatchObject({
      ok: false,
      reason: 'request_failed',
      error: 'derive response failed: Invented plan limit reached.',
    });
  });

  it('redacts the access token from a refusal', async () => {
    const token = signIn();
    const { result } = await serve(
      () => ({ status: 400, body: JSON.stringify({ detail: `Invented refusal echoing ${token}` }) }),
      (client) => client.chat([{ role: 'user', content: 'Invented request.' }]),
    );

    expect(result).toMatchObject({ ok: false, reason: 'request_failed' });
    expect((result as { error: string }).error).not.toContain(token);
  });

  it('is unavailable without a usable login, and sends nothing', async () => {
    signIn(-60);
    const { result, seen } = await serve(
      () => ({ events: [completed('ok')] }),
      async (client) => {
        expect(client.available).toBe(false);
        expect(client.unavailableReason).toMatch(/^derive: the ChatGPT login has expired/);
        return client.chat([{ role: 'user', content: 'Invented request.' }]);
      },
    );

    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(seen).toHaveLength(0);
  });
});
