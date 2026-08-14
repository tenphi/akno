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
    const logged = JSON.parse(fs.readFileSync(report.logPath!, 'utf8').trim()) as {
      curated: { slug: string; action: string }[];
    };
    expect(logged.curated).toMatchObject([{ slug: 'people/ada-marlow', action: 'would-update' }]);

    const unchangedInputs = await mem.dream({ phase: 'curate' });
    expect(unchangedInputs.curated).toEqual([]);
    expect(server.calls()).toBe(2);
  });

  it('rejects a draft that loses a stable item before asking the verifier', async () => {
    server.loseMarker(true);
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues.join(' ')).toMatch(/stable item markers/);
    expect(server.calls()).toBe(1);

    const unchangedInputs = await mem.dream({ phase: 'curate' });
    expect(unchangedInputs.curated).toEqual([]);
    expect(server.calls()).toBe(1);
  });

  it('reconsiders hygiene after body or frontmatter changes', async () => {
    await mem.dream({ phase: 'curate' });
    expect(server.calls()).toBe(2);

    fs.appendFileSync(path.join(root, 'people/ada-marlow.md'), '\nA short personal note.\n');
    await mem.index({ structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated).toHaveLength(1);
    expect(report.curated[0]?.slug).toBe('people/ada-marlow');
    expect(server.calls()).toBe(4);

    const page = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('title: Ada Marlow', 'title: Ada profile'));
    await mem.index({ structuralOnly: true });
    expect((await mem.dream({ phase: 'curate' })).curated).toHaveLength(1);
    expect(server.calls()).toBe(6);
  });

  it('reconsiders synthesis when linked evidence changes', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    const evidence = path.join(root, 'evidence/ada-interview.md');
    fs.writeFileSync(
      evidence,
      `---
title: Ada interview
akno:
  role: source
  about:
    - people/ada-marlow
---

Ada described her work. [[people/ada-marlow]]
`,
    );
    await mem.index({ structuralOnly: true });

    await mem.dream({ phase: 'curate' });
    expect(server.calls()).toBe(2);
    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);

    fs.appendFileSync(evidence, '\nShe later added another detail.\n');
    await mem.index({ structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated).toHaveLength(1);
    expect(report.curated[0]?.mode).toBe('synthesize');
    expect(server.calls()).toBe(4);
  });

  it('reconsiders an accepted preview once when writes are enabled', async () => {
    await mem.dream({ phase: 'curate' });
    expect(server.calls()).toBe(2);
    await mem.close();
    mem = await openMem(true);

    const applied = await mem.dream({ phase: 'curate' });
    expect(applied.curated[0]?.action).toBe('updated');
    expect(applied.curateChangeId).not.toBeNull();
    const callsAfterApply = server.calls();

    const current = await mem.dream({ phase: 'curate' });
    expect(current.curated).toEqual([]);
    expect(server.calls()).toBe(callsAfterApply);
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
      maintenance: { log_changes: true, curate: { enabled: true, write, verify: true } },
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
