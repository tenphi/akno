import fs from 'node:fs';
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeUrlDestination, cleanupFetch, fetchDocument } from './fetch.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const file of temporary.splice(0)) {
    fs.rmSync(file, { recursive: true, force: true });
  }
});

describe('URL ingest network policy', () => {
  it.each([
    'http://127.0.0.1/invented',
    'http://2130706433/invented',
    'http://10.11.12.13/invented',
    'http://169.254.169.254/invented',
    'http://[::1]/invented',
    'http://[fc00::1111]/invented',
    'http://[::ffff:127.0.0.1]/invented',
  ])('rejects non-public literal destination %s', async (url) => {
    await expect(assertSafeUrlDestination(url)).rejects.toMatchObject({
      code: 'forbidden',
      details: { reason: 'network_destination_denied' },
    });
  });

  it('rejects a hostname when any resolved answer is non-public', async () => {
    await expect(
      assertSafeUrlDestination('https://invented.example/file', {
        resolve: async () => [
          { address: '8.8.8.8', family: 4 },
          { address: '192.168.11.11', family: 4 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('allows an exact trusted internal host while still resolving it', async () => {
    let resolved = 0;
    await expect(
      assertSafeUrlDestination('http://memory.vulpine.test/file', {
        trustedHosts: ['memory.vulpine.test'],
        resolve: async () => {
          resolved++;
          return [{ address: '10.11.12.13', family: 4 }];
        },
      }),
    ).resolves.toBeUndefined();
    expect(resolved).toBe(1);
  });

  it('pins a trusted local download and enforces the byte limit on the stream', async () => {
    const server = await fixtureServer((request, response) => {
      response.writeHead(200, {
        'content-type': 'text/plain',
        'content-disposition': 'attachment; filename="vulpine-note.txt"',
      });
      response.end(request.url === '/large' ? 'x'.repeat(1111) : 'Invented Vulpine note.');
    });
    try {
      const fetched = await fetchDocument({
        url: `http://localhost:${server.port}/note`,
        maxBytes: 2222,
        trustedHosts: ['localhost'],
      });
      temporary.push(fetched.path.slice(0, fetched.path.lastIndexOf('/')));
      expect(fs.readFileSync(fetched.path, 'utf8')).toBe('Invented Vulpine note.');
      expect(fetched.originalName).toBe('vulpine-note.txt');

      await expect(
        fetchDocument({
          url: `${server.origin}/large`,
          maxBytes: 111,
          trustedHosts: ['127.0.0.1'],
        }),
      ).rejects.toMatchObject({ code: 'invalid' });
      await cleanupFetch(fetched);
      temporary.length = 0;
    } finally {
      await server.close();
    }
  });

  it('re-resolves and rejects every redirect target', async () => {
    const server = await fixtureServer((_request, response) => {
      response.writeHead(302, { location: `http://localhost:${server.port}/private-note` });
      response.end();
    });
    try {
      await expect(
        fetchDocument({
          url: `${server.origin}/redirect`,
          maxBytes: 2222,
          trustedHosts: ['127.0.0.1'],
        }),
      ).rejects.toMatchObject({
        code: 'forbidden',
        details: { reason: 'network_destination_denied' },
      });
    } finally {
      await server.close();
    }
  });
});

async function fixtureServer(
  handler: Parameters<typeof http.createServer>[0],
): Promise<{ origin: string; port: number; close(): Promise<void> }> {
  const instance = http.createServer(handler);
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const port = (instance.address() as { port: number }).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    close: async () => {
      instance.closeAllConnections();
      await new Promise<void>((resolve) => instance.close(() => resolve()));
    },
  };
}
