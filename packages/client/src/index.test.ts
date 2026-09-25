import { describe, expect, it } from 'vitest';
import { connect, defaultSocketPath, PROTOCOL_VERSION } from './index.ts';
import http from 'node:http';

describe('defaultSocketPath', () => {
  it('uses the same Linux runtime default as the service configuration', () => {
    expect(
      defaultSocketPath({
        platform: 'linux',
        homeDir: '/home/invented',
        env: { XDG_RUNTIME_DIR: '/invented/run' },
      }),
    ).toBe('/invented/run/akno/akno.sock');
  });

  it('keeps AKNO_SOCKET above the platform default', () => {
    expect(
      defaultSocketPath({
        platform: 'linux',
        homeDir: '/home/invented',
        env: { AKNO_SOCKET: '/invented/override.sock', XDG_RUNTIME_DIR: '/invented/run' },
      }),
    ).toBe('/invented/override.sock');
  });
});

it('refuses scoped operations before an older HTTP service can ignore their selectors', async () => {
  let operations = 0;
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/hello')
      response.end(
        JSON.stringify({
          hello: 'akno',
          protocol: PROTOCOL_VERSION,
          version: '0.13.6',
          writable: true,
          akno_path: '/invented/knowledge',
          ops: ['timeline', 'context', 'list', 'write'],
        }),
      );
    else {
      operations++;
      response.end(JSON.stringify({ ok: true, result: {} }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const client = await connect({ http: `http://127.0.0.1:${address.port}` });
  try {
    await expect(client.timeline({ timeline: 'work/timeline' })).rejects.toMatchObject({
      code: 'not_implemented',
      details: { feature: 'folder_timelines' },
    });
    await expect(client.context({ timeline: 'work/timeline' })).rejects.toMatchObject({
      code: 'not_implemented',
    });
    await expect(client.list({ kind: 'timelines' })).rejects.toMatchObject({ code: 'not_implemented' });
    await expect(
      client.write({
        timeline: 'work/timeline',
        event: { date: '2031-04-01', summary: 'Prototype delivered.' },
      }),
    ).rejects.toMatchObject({ code: 'not_implemented' });
    expect(operations).toBe(0);
    await client.timeline({ since: '2031-04' });
    expect(operations).toBe(1);
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
