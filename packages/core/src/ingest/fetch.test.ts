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
    'http://[100::1111]/invented',
    'http://[100:0:0:1::1111]/invented',
    'http://[fec0::1111]/invented',
    'http://[3fff::1111]/invented',
    'http://[5f00::1111]/invented',
    'http://[::ffff:127.0.0.1]/invented',
    'http://[::ffff:0:7f00:1]/invented',
    // An arbitrary IPv6 address containing `ffff` is not an IPv4-mapped address. It must still
    // be checked against its real prefix instead of only against its final 32 bits.
    'http://[fc00::ffff:0808:0808]/invented',
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

  it('allows one exact trusted internal origin while still resolving it', async () => {
    let resolved = 0;
    await expect(
      assertSafeUrlDestination('http://memory.vulpine.test:8111/file', {
        trustedOrigins: ['http://memory.vulpine.test:8111'],
        resolve: async () => {
          resolved++;
          return [{ address: '10.11.12.13', family: 4 }];
        },
      }),
    ).resolves.toBeUndefined();
    expect(resolved).toBe(1);

    for (const url of ['http://memory.vulpine.test:8222/file', 'https://memory.vulpine.test:8111/file']) {
      await expect(
        assertSafeUrlDestination(url, {
          trustedOrigins: ['http://memory.vulpine.test:8111'],
          resolve: async () => [{ address: '10.11.12.13', family: 4 }],
        }),
      ).rejects.toMatchObject({ code: 'forbidden' });
    }
    await expect(
      assertSafeUrlDestination('http://memory.vulpine.test:8111/file', {
        trustedOrigins: ['http://memory.vulpine.test:8111/private-path'],
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
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
        trustedOrigins: [`http://localhost:${server.port}`],
      });
      temporary.push(fetched.path.slice(0, fetched.path.lastIndexOf('/')));
      expect(fs.readFileSync(fetched.path, 'utf8')).toBe('Invented Vulpine note.');
      expect(fetched.originalName).toBe('vulpine-note.txt');

      await expect(
        fetchDocument({
          url: `${server.origin}/large`,
          maxBytes: 111,
          trustedOrigins: [server.origin],
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
          trustedOrigins: [server.origin],
        }),
      ).rejects.toMatchObject({
        code: 'forbidden',
        details: { reason: 'network_destination_denied' },
      });
    } finally {
      await server.close();
    }
  });

  it('turns a broken response stream into a typed error without exposing its destination', async () => {
    const server = await fixtureServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('Invented partial bytes.');
      setImmediate(() => response.destroy());
    });
    try {
      const failure = await fetchDocument({
        url: `${server.origin}/broken`,
        maxBytes: 2222,
        trustedOrigins: [server.origin],
      }).catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: 'unavailable' });
      expect(String((failure as Error).message)).not.toContain('127.0.0.1');
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
