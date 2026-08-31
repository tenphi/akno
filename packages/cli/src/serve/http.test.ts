import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connect } from '@tenphi/akno-client';
import { open, type Akno } from '@tenphi/akno-core';
import { serveHttp, type HttpServer } from './http.ts';

let root: string;
let stateDir: string;
let mem: Akno;
let server: HttpServer;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-http-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-http-state-'));
  fs.writeFileSync(path.join(root, 'index.md'), '# Invented index\n', 'utf8');
  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'agent',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
    },
  });
  await mem.index({ structuralOnly: true });
  server = await serveHttp(mem, '127.0.0.1:0', {
    publicAllow: ['recall', 'read'],
    identities: [
      {
        name: 'vulpine-owner',
        token: 'invented-owner-token-1111',
        actor: 'user',
        allow: ['read', 'write'],
      },
    ],
  });
});

afterEach(async () => {
  await server?.close();
  await mem?.close();
  for (const directory of [root, stateDir]) fs.rmSync(directory, { recursive: true, force: true });
});

describe('the HTTP door', () => {
  it('advertises only public reads and rejects public writes', async () => {
    const client = await connect({ http: server.address });
    try {
      expect(client.hello.ops).toEqual(['recall', 'read']);
      expect(client.hello.writable).toBe(false);
      await expect(
        client.write({ slug: 'private/ada-note', content: 'Invented note.' }),
      ).rejects.toMatchObject({
        code: 'forbidden',
      });
    } finally {
      await client.close();
    }
  });

  it('does not let a programmatic public policy widen loopback beyond reads', async () => {
    await server.close();
    server = await serveHttp(mem, '127.0.0.1:0', { publicAllow: ['read', 'write'] });
    const client = await connect({ http: server.address });
    try {
      expect(client.hello.ops).toEqual(['read']);
      await expect(
        client.write({ slug: 'private/public-write', content: 'Invented note.' }),
      ).rejects.toMatchObject({ code: 'forbidden' });
    } finally {
      await client.close();
    }
  });

  it('maps a bearer credential to a server-owned user actor and operation set', async () => {
    const client = await connect({ http: server.address, token: 'invented-owner-token-1111' });
    try {
      expect(client.hello.ops).toEqual(['read', 'write']);
      expect(client.hello.writable).toBe(true);
      const result = await client.write({ slug: 'private/ada-note', content: 'Invented note.' });
      expect(result.outcome).toBe('ok');
      expect(fs.existsSync(path.join(root, 'private/ada-note.md'))).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('rejects wrong credentials and every client actor override', async () => {
    await expect(connect({ http: server.address, token: 'invented-wrong-token-2222' })).rejects.toMatchObject(
      {
        code: 'forbidden',
      },
    );
    await expect(connect({ http: server.address, actor: 'user' })).rejects.toMatchObject({
      code: 'forbidden',
    });

    const response = await fetch(`http://${server.address}/op/write`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-akno-actor': 'user' },
      body: JSON.stringify({ slug: 'private/forged-note', content: 'Forged.' }),
    });
    expect(response.status).toBe(403);
    expect(fs.existsSync(path.join(root, 'private/forged-note.md'))).toBe(false);
  });

  it('refuses a non-loopback bind without configured authentication', async () => {
    await expect(serveHttp(mem, '0.0.0.0:0')).rejects.toMatchObject({
      code: 'forbidden',
      details: { reason: 'http_auth_required' },
    });
  });

  it('returns a usable bracketed address for an IPv6 loopback bind', async () => {
    await server.close();
    server = await serveHttp(mem, '[::1]:0', { publicAllow: ['read'] });
    expect(server.address).toMatch(/^\[::1\]:\d+$/);

    const client = await connect({ http: server.address });
    try {
      expect(client.hello.ops).toEqual(['read']);
    } finally {
      await client.close();
    }
  });

  it('rejects an empty or non-decimal port', async () => {
    await expect(serveHttp(mem, '127.0.0.1:')).rejects.toMatchObject({ code: 'invalid' });
    await expect(serveHttp(mem, '127.0.0.1:1e3')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('applies the client timeout to the HTTP handshake and returns a typed failure', async () => {
    const stalled = http.createServer(() => {});
    await new Promise<void>((resolve) => stalled.listen(0, '127.0.0.1', resolve));
    const { port } = stalled.address() as { port: number };
    try {
      await expect(connect({ http: `127.0.0.1:${port}`, timeoutMs: 25 })).rejects.toMatchObject({
        code: 'unavailable',
        message: 'Akno HTTP handshake timed out',
      });
    } finally {
      stalled.closeAllConnections();
      await new Promise<void>((resolve) => stalled.close(() => resolve()));
    }
  });
});
