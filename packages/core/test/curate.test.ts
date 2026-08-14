import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let root: string;
let stateDir: string;
let mem: Akno;
let server: {
  url: string;
  close: () => Promise<void>;
  calls: () => number;
  loseMarker: (value: boolean) => void;
};

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-curate-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-curate-state-'));
  server = await startStub();
  fs.mkdirSync(path.join(root, 'people'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'people/ada-marlow.md'),
    `---
title: Ada Marlow
akno:
  management:
    dream: hygiene
---

# Ada Marlow

## Details

<!-- akno:item itm_ada source=conversation origin=user -->
Ada Marlow lives at 111 Example Street.
`,
  );
  mem = await openMem(false);
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  await mem?.close();
  await server?.close();
  for (const directory of [root, stateDir]) fs.rmSync(directory, { recursive: true, force: true });
});

describe('curate', () => {
  it('uses a draft and verifier but keeps scheduled writes in preview mode', async () => {
    const before = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated).toMatchObject([
      { slug: 'people/ada-marlow', mode: 'hygiene', action: 'would-update', issues: [] },
    ]);
    expect(server.calls()).toBe(2);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);
    expect(report.curateChangeId).toBeNull();
  });

  it('rejects a draft that loses a stable item before asking the verifier', async () => {
    server.loseMarker(true);
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues.join(' ')).toMatch(/stable item markers/);
    expect(server.calls()).toBe(1);
  });
});

async function openMem(write: boolean): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'agent',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        expansion: { id: null },
        derive: { provider: 'stub', id: 'stub' },
      },
      maintenance: { curate: { enabled: true, write, verify: true } },
    },
  });
}

async function startStub(): Promise<typeof server> {
  let calls = 0;
  let drop = false;
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      calls++;
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        messages?: { role: string; content: string }[];
      };
      const system = body.messages?.find((message) => message.role === 'system')?.content ?? '';
      const content = system.includes('verify an automatic Markdown rewrite')
        ? JSON.stringify({ ok: true, issues: [] })
        : JSON.stringify({
            body:
              '# Ada Marlow\n\n## Details\n\n' +
              (drop ? '' : '<!-- akno:item itm_ada source=conversation origin=user -->\n') +
              'Ada Marlow lives at 111 Example Street.\n',
          });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address();
  if (!address || typeof address === 'string') throw new Error('stub did not bind');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    calls: () => calls,
    loseMarker: (value) => {
      drop = value;
    },
  };
}
