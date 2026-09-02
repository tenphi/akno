import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { ProviderRequestError, requestConfiguredProvider } from './provider-request.ts';

describe('configured-provider redirects', () => {
  it.each([307, 308])('follows a relative same-origin %s with the original POST', async (status) => {
    const received: {
      path: string;
      method: string;
      body: string;
      authorization?: string;
      custom?: string;
    }[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        received.push({
          path: request.url ?? '',
          method: request.method ?? '',
          body: Buffer.concat(chunks).toString('utf8'),
          authorization: request.headers.authorization,
          custom: request.headers['x-invented-provider'] as string | undefined,
        });
        if (request.url === '/v1/models') {
          response.writeHead(status, { location: './relocated' });
          response.end();
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{}');
      });
    });
    await listen(server);
    const baseUrl = address(server, '/v1');

    try {
      const { response, requests } = await requestConfiguredProvider(baseUrl, `${baseUrl}/models`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer sk-invented-fixture-key',
          'x-invented-provider': 'invented-header-value',
        },
        body: '{"model":"invented-model"}',
      });

      expect(response.status).toBe(200);
      expect(requests).toBe(2);
      expect(received).toEqual([
        {
          path: '/v1/models',
          method: 'POST',
          body: '{"model":"invented-model"}',
          authorization: 'Bearer sk-invented-fixture-key',
          custom: 'invented-header-value',
        },
        {
          path: '/v1/relocated',
          method: 'POST',
          body: '{"model":"invented-model"}',
          authorization: 'Bearer sk-invented-fixture-key',
          custom: 'invented-header-value',
        },
      ]);
    } finally {
      close(server);
    }
  });

  it.each([301, 302, 303])('refuses same-origin %s rather than rewriting the model POST', async (status) => {
    let requests = 0;
    const server = http.createServer((request, response) => {
      requests += 1;
      request.resume();
      response.writeHead(status, { location: '/v1/rewritten' });
      response.end();
    });
    await listen(server);
    const baseUrl = address(server, '/v1');

    try {
      await expect(
        requestConfiguredProvider(baseUrl, `${baseUrl}/models`, { method: 'POST', body: '{}' }),
      ).rejects.toThrow(`provider returned ${status}`);
      expect(requests).toBe(1);
    } finally {
      close(server);
    }
  });

  it('refuses a cross-origin target before credentials, headers, or body reach it', async () => {
    let targetRequests = 0;
    const target = http.createServer((request, response) => {
      targetRequests += 1;
      request.resume();
      response.end('{}');
    });
    await listen(target);
    const destination = address(target, '/outside/private-page');
    const origin = http.createServer((request, response) => {
      request.resume();
      response.writeHead(307, { location: destination });
      response.end();
    });
    await listen(origin);
    const baseUrl = address(origin, '/v1');
    const secret = 'sk-invented-fixture-key';
    const privateBody = 'invented private source text';

    try {
      let failure: ProviderRequestError | null = null;
      try {
        await requestConfiguredProvider(baseUrl, `${baseUrl}/models`, {
          method: 'POST',
          headers: { authorization: `Bearer ${secret}`, 'x-invented-provider': 'invented-header-value' },
          body: privateBody,
        });
      } catch (error) {
        failure = error as ProviderRequestError;
      }
      expect(failure).toBeInstanceOf(ProviderRequestError);
      expect(failure?.message).toBe('provider redirected outside its configured origin');
      expect(failure?.message).not.toContain(secret);
      expect(failure?.message).not.toContain(privateBody);
      expect(failure?.message).not.toContain('/outside/private-page');
      expect(targetRequests).toBe(0);
    } finally {
      close(origin);
      close(target);
    }
  });

  it('refuses loops, excessive chains, and invalid destinations with bounded diagnostics', async () => {
    const paths: string[] = [];
    const server = http.createServer((request, response) => {
      const current = request.url ?? '';
      paths.push(current);
      request.resume();
      if (current === '/loop-a') response.writeHead(307, { location: '/loop-b' });
      else if (current === '/loop-b') response.writeHead(308, { location: '/loop-a' });
      else if (current.startsWith('/limit-')) {
        const step = Number(current.slice('/limit-'.length));
        response.writeHead(307, { location: `/limit-${step + 1}` });
      } else if (current === '/missing') response.writeHead(307);
      else if (current === '/malformed') response.writeHead(307, { location: 'http://[' });
      else if (current === '/unsupported') response.writeHead(307, { location: 'file:///invented' });
      else response.writeHead(307, { location: 'http://invented:password@127.0.0.1/credentialed' });
      response.end();
    });
    await listen(server);
    const baseUrl = address(server, '');

    try {
      await expect(post(baseUrl, '/loop-a')).rejects.toThrow('provider redirect loop was refused');
      await expect(post(baseUrl, '/limit-0', 2)).rejects.toThrow('provider redirect limit was exceeded');
      await expect(post(baseUrl, '/missing')).rejects.toThrow('provider redirect omitted its destination');
      await expect(post(baseUrl, '/malformed')).rejects.toThrow('provider redirect destination is malformed');
      await expect(post(baseUrl, '/unsupported')).rejects.toThrow(
        'provider redirect destination is unsupported',
      );
      await expect(post(baseUrl, '/credentialed')).rejects.toThrow(
        'provider redirect destination is unsupported',
      );
      expect(paths.filter((entry) => entry.startsWith('/limit-'))).toEqual([
        '/limit-0',
        '/limit-1',
        '/limit-2',
      ]);
    } finally {
      close(server);
    }
  });
});

async function post(baseUrl: string, endpoint: string, maxRedirects?: number): Promise<unknown> {
  return requestConfiguredProvider(
    baseUrl,
    `${baseUrl}${endpoint}`,
    { method: 'POST', body: '{}' },
    maxRedirects,
  );
}

async function listen(server: http.Server): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function address(server: http.Server, suffix: string): string {
  const { port } = server.address() as { port: number };
  return `http://127.0.0.1:${port}${suffix}`;
}

function close(server: http.Server): void {
  server.close();
  server.closeAllConnections();
}
