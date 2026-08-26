import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigDoc } from './schema.ts';
import { loadConfig } from './load.ts';
import { open } from '../open.ts';
import { ModelClient } from '../models/client.ts';
import { PROVIDER_API_CACHE_FILE, resolveAutoProviderApis } from '../models/provider-api.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('provider generative transport', () => {
  it('keeps existing OpenAI-compatible providers on Chat Completions', () => {
    const config = configWithProvider({ base_url: 'http://127.0.0.1:41111/v1' });

    expect(config.providers.invented?.api).toBe('chat_completions');
  });

  it('resolves an explicit Responses provider without changing its dedicated endpoints', () => {
    const config = configWithProvider({
      base_url: 'https://models.example.test/v1',
      api: 'responses',
    });

    expect(config.providers.invented).toMatchObject({
      baseUrl: 'https://models.example.test/v1',
      api: 'responses',
    });
    expect(config.models.embedding.provider).toBe(config.providers.invented);
  });

  it('rejects an unknown transport instead of guessing at runtime', () => {
    expect(
      ConfigDoc.safeParse({
        providers: { invented: { base_url: 'https://models.example.test/v1', api: 'invented_api' } },
      }).success,
    ).toBe(false);
  });

  it('keeps an uncached auto provider unavailable for generation without sending a request', async () => {
    const config = configWithProvider({
      base_url: 'http://127.0.0.1:41111/v1',
      api: 'auto',
    });

    expect(config.providers.invented).toMatchObject({
      api: 'auto',
      configuredApi: 'auto',
      apiResolution: 'unresolved',
    });
    expect(new ModelClient(config.models.embedding).available).toBe(true);
    const outcome = await new ModelClient(config.models.derive).chat([
      { role: 'user', content: 'Describe the invented Zephyr QX-100.' },
    ]);
    expect(outcome).toMatchObject({ ok: false, reason: 'unavailable', endpointRequests: 0 });
  });

  it('prefers Responses, persists the content-free result, and reuses it on reload', async () => {
    const paths: string[] = [];
    let responsesAvailable = true;
    const server = http.createServer((request, response) => {
      paths.push(request.url ?? '');
      request.resume();
      if (request.url === '/v1/responses' && !responsesAvailable) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'invented route removed' } }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify(
          request.url === '/v1/responses' ? { output: [] } : { choices: [{ message: { content: 'OK' } }] },
        ),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    const root = inventedDirectory();
    const provider = {
      base_url: `http://127.0.0.1:${port}/v1`,
      api_key: { env: 'INVENTED_PROVIDER_KEY' },
      api: 'auto' as const,
    };

    try {
      const config = loadProviderConfig(root, provider, {
        INVENTED_PROVIDER_KEY: 'sk-invented-fixture-key',
      });
      const report = await resolveAutoProviderApis(config, { timeoutMs: 2_000 });

      expect(report[0]).toMatchObject({ resolved: 'responses', source: 'probed', error: null });
      expect(paths).toEqual(['/v1/responses']);
      const cachePath = path.join(root, '.state', PROVIDER_API_CACHE_FILE);
      expect(fs.statSync(cachePath).mode & 0o777).toBe(0o600);
      const cacheBody = fs.readFileSync(cachePath, 'utf8');
      expect(cacheBody).not.toContain('sk-invented-fixture-key');
      expect(cacheBody).not.toContain(`127.0.0.1:${port}`);

      const reloaded = loadProviderConfig(root, provider, {
        INVENTED_PROVIDER_KEY: 'sk-invented-fixture-key',
      });
      expect(reloaded.providers.invented).toMatchObject({
        api: 'responses',
        configuredApi: 'auto',
        apiResolution: 'cached',
      });

      paths.length = 0;
      responsesAvailable = false;
      const refreshed = await resolveAutoProviderApis(reloaded, { timeoutMs: 2_000, refresh: true });
      expect(refreshed[0]).toMatchObject({ resolved: 'chat_completions', source: 'probed' });
      expect(paths).toEqual(['/v1/responses', '/v1/chat/completions']);

      const changedModel = loadProviderConfig(
        root,
        provider,
        { INVENTED_PROVIDER_KEY: 'sk-invented-fixture-key' },
        'invented-second-model',
      );
      expect(changedModel.providers.invented).toMatchObject({
        api: 'auto',
        apiResolution: 'unresolved',
      });
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });

  it('tries Chat Completions only after an absent Responses route', async () => {
    const paths: string[] = [];
    const server = http.createServer((request, response) => {
      paths.push(request.url ?? '');
      request.resume();
      if (request.url === '/v1/responses') {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'invented route is unavailable' } }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    try {
      const config = configWithProvider({
        base_url: `http://127.0.0.1:${port}/v1`,
        api: 'auto',
      });
      const report = await resolveAutoProviderApis(config, { timeoutMs: 2_000 });

      expect(report[0]).toMatchObject({ resolved: 'chat_completions', source: 'probed' });
      expect(paths).toEqual(['/v1/responses', '/v1/chat/completions']);
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });

  it('does not reinterpret authentication or server failures as transport evidence', async () => {
    const paths: string[] = [];
    const server = http.createServer((request, response) => {
      paths.push(request.url ?? '');
      request.resume();
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'invented credential rejected' } }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    try {
      const config = configWithProvider({
        base_url: `http://127.0.0.1:${port}/v1`,
        api: 'auto',
      });
      const report = await resolveAutoProviderApis(config, { timeoutMs: 2_000 });

      expect(report[0]).toMatchObject({ resolved: null, source: 'deferred' });
      expect(report[0]?.error).toContain('returned 401');
      expect(paths).toEqual(['/v1/responses']);

      const reloaded = loadProviderConfig(path.dirname(config.stateDir), {
        base_url: `http://127.0.0.1:${port}/v1`,
        api: 'auto',
      });
      expect(reloaded.providers.invented?.apiResolution).toBe('deferred');
      const deferred = await resolveAutoProviderApis(reloaded, { timeoutMs: 2_000 });
      expect(deferred[0]).toMatchObject({ resolved: null, source: 'deferred' });
      expect(paths).toEqual(['/v1/responses']);
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });

  it('does not select or fall through after a malformed successful envelope', async () => {
    const paths: string[] = [];
    const server = http.createServer((request, response) => {
      paths.push(request.url ?? '');
      request.resume();
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ invented: 'wrong transport envelope' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    try {
      const config = configWithProvider({
        base_url: `http://127.0.0.1:${port}/v1`,
        api: 'auto',
      });
      const report = await resolveAutoProviderApis(config, { timeoutMs: 2_000 });

      expect(report[0]).toMatchObject({ resolved: null, source: 'deferred' });
      expect(report[0]?.error).toContain('without a valid transport envelope');
      expect(paths).toEqual(['/v1/responses']);
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });

  it('keeps the explicit no-probe open path network-free', async () => {
    let requests = 0;
    const server = http.createServer((request, response) => {
      requests += 1;
      request.resume();
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ output: [] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    const root = inventedDirectory();
    const stateDir = path.join(root, '.state');

    try {
      const memory = await open({
        isolated: true,
        env: {},
        resolveProviderApis: false,
        overrides: {
          akno_path: root,
          state_dir: stateDir,
          providers: {
            invented: { base_url: `http://127.0.0.1:${port}/v1`, api: 'auto' },
          },
          models: { derive: { provider: 'invented', id: 'invented-generative-model' } },
        },
      });
      try {
        expect(memory.config.providers.invented).toMatchObject({
          api: 'auto',
          apiResolution: 'unresolved',
        });
        expect(requests).toBe(0);
        expect(fs.existsSync(path.join(stateDir, PROVIDER_API_CACHE_FILE))).toBe(false);
      } finally {
        await memory.close();
      }
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });
});

function configWithProvider(provider: { base_url: string; api?: 'auto' | 'chat_completions' | 'responses' }) {
  return loadProviderConfig(inventedDirectory(), provider);
}

function loadProviderConfig(
  root: string,
  provider: {
    base_url: string;
    api_key?: { env: string };
    api?: 'auto' | 'chat_completions' | 'responses';
  },
  env: NodeJS.ProcessEnv = {},
  generativeModel = 'invented-generative-model',
) {
  return loadConfig({
    isolated: true,
    env,
    overrides: {
      akno_path: root,
      state_dir: path.join(root, '.state'),
      providers: { invented: provider },
      models: {
        embedding: { provider: 'invented', id: 'invented-embedding-model' },
        derive: { provider: 'invented', id: generativeModel },
      },
    },
  });
}

function inventedDirectory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-provider-api-'));
  temporary.push(root);
  return root;
}
