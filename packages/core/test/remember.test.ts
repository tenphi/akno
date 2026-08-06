import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * §8, §13. `remember` *is* the retain tier, available per-turn. §13 gives that tier a mission
 * and an on/off switch like the others, and these tests are what make the config real rather
 * than decorative — a `mission` key nothing reads is the same class of bug as a folder rule
 * that never reaches the index.
 */

let root: string;
let stateDir: string;
let server: { url: string; close: () => Promise<void>; lastSystem: () => string; forget: () => void };

async function startStubChat(): Promise<typeof server> {
  let system = '';
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        messages?: { role: string; content: string }[];
      };
      system = body.messages?.find((message) => message.role === 'system')?.content ?? '';
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    { text: 'The rent is 1234 EUR per month.', subject: 'apartment rent', kind: 'fact' },
                  ],
                  events: [],
                }),
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: () => new Promise<void>((resolve) => instance.close(() => resolve())),
    lastSystem: () => system,
    // The indexer's own derive pass talks to this stub too, so a test asserting "the retain
    // mission never ran" has to start from a clean slate rather than from setup's leftovers.
    forget: () => {
      system = '';
    },
  };
}

async function openMem(overrides: Record<string, unknown> = {}): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        chat: { provider: 'stub', id: 'stub-chat' },
      },
      ...overrides,
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-remember-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-remember-state-'));
  server = await startStubChat();
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'home/lease.md'),
    '---\ntitle: Lease\n---\n\n# Lease\n\n- Rent: 1111 EUR per month\n',
    'utf8',
  );
  const mem = await openMem();
  await mem.index({});
  await mem.close();
});

afterEach(async () => {
  await server?.close();
  for (const dir of [root, stateDir]) fs.rmSync(dir, { recursive: true, force: true });
});

describe('the retain tier’s config', () => {
  it('appends its mission to the fixed prompt rather than replacing it', async () => {
    // §13: a mission appends emphasis and never replaces the prompt, because every rule that
    // keeps the tier honest lives in the fixed part.
    const mem = await openMem({ maintenance: { retain: { mission: 'Prefer amounts and dates.' } } });
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(server.lastSystem()).toContain('Prefer amounts and dates.');
      expect(server.lastSystem()).toContain('Prose, not triples');
    } finally {
      await mem.close();
    }
  });

  it('runs with no mission configured, which is the default', async () => {
    const mem = await openMem();
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(server.lastSystem()).toContain('Prose, not triples');
      expect(server.lastSystem()).not.toContain('Additional emphasis');
    } finally {
      await mem.close();
    }
  });

  it('keeps nothing at all when the tier is switched off', async () => {
    const mem = await openMem({ maintenance: { retain: { enabled: false } } });
    server.forget();
    try {
      const result = await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(result.outcome).toBe('noop');
      expect(result.note).toMatch(/disabled in config/);
      // And it did not quietly call the model first.
      expect(server.lastSystem()).toBe('');
    } finally {
      await mem.close();
    }
  });
});
