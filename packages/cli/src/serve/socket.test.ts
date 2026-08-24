import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connect } from '@tenphi/akno-client';
import { AknoError, open, type Akno } from '@tenphi/akno-core';
import { serveSocket } from './socket.ts';
import { runMaintenance } from '../ops-handle.ts';

/**
 * **The library is the product**: one op registry, three transports over it, so the doors
 * cannot drift into different behaviour. This is the socket — the default door, where
 * filesystem permissions are the auth.
 *
 * The property that matters most here is the one that has no other test: with a service
 * running, it is the **only** process holding the write handle, so anything that writes has to
 * work *through* it. Ops did. Maintenance did not, and the nightly cycle would have failed
 * every night with "another process holds the write handle".
 */

let root: string;
let stateDir: string;
let mem: Akno;
let server: { path: string; close: () => Promise<void> };

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-door-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-door-state-'));
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'home/lease.md'),
    '---\ntitle: Lease\n---\n\n# Lease\n\n- Rent: 1111 EUR per month\n',
    'utf8',
  );

  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
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
  await mem.index({});
  server = await serveSocket(mem, path.join(stateDir, 'akno.sock'));
});

afterEach(async () => {
  await server?.close();
  await mem?.close();
  for (const dir of [root, stateDir]) fs.rmSync(dir, { recursive: true, force: true });
});

describe('the socket door', () => {
  it('announces what it can do before the first request', async () => {
    const client = await connect({ socket: server.path });
    try {
      expect(client.hello.hello).toBe('akno');
      expect(client.hello.writable).toBe(true);
      expect(client.hello.ops).toContain('recall');
      expect(client.hello.ops).toContain('answer');
      expect(client.hello.ops).toContain('write');
      // Advertised separately from the ops: the ops are what an agent calls about memory, these are
      // what an operator asks of the process — including gates, journal reads, and maintenance plans,
      // which are deliberately *not* ops so an agent cannot approve its own proposal.
      expect(client.hello.commands).toEqual([
        'index',
        'inbox',
        'dream',
        'approve',
        'decline',
        'changes',
        'proposals',
        'plan',
      ]);
    } finally {
      await client.close();
    }
  });

  it('runs compact answer discovery through the generated client surface', async () => {
    const client = await connect({ socket: server.path });
    try {
      const result = await client.answer({
        question: 'What is the invented monthly rent?',
        expand: false,
        graph: false,
      });
      expect(result).toMatchObject({
        status: 'degraded',
        outcome: 'not_answered',
        answer: null,
        related_page_slugs: ['home/lease'],
      });
      expect(result.degraded).toContain('no_answer_model');
      expect(JSON.stringify(result)).not.toContain('1111 EUR');
    } finally {
      await client.close();
    }
  });

  it('runs an op that writes, from a client holding no write handle', async () => {
    const client = await connect({ socket: server.path });
    try {
      const result = await client.write({ slug: 'home/lease', append: '- Deposit: 2222 EUR' });
      expect(result.outcome).toBe('ok');
      expect(fs.readFileSync(path.join(root, 'home/lease.md'), 'utf8')).toContain('2222 EUR');
    } finally {
      await client.close();
    }
  });

  it('runs maintenance through the writer', async () => {
    const client = await connect({ socket: server.path });
    try {
      // The whole point: this process cannot take the write handle, and does not need to.
      const report = (await client.command('index', { structuralOnly: true })) as {
        pagesUnchanged: number;
      };
      expect(report.pagesUnchanged).toBeGreaterThan(0);

      const dream = (await client.command('dream', { phase: 'housekeeping' })) as {
        housekeeping: { counts: { brokenLinks: number } } | null;
      };
      expect(dream.housekeeping?.counts.brokenLinks).toBe(0);

      const inbox = (await client.command('inbox', {})) as { filed: unknown[] };
      expect(inbox.filed).toEqual([]);

      const plans = (await client.command('plan', { action: 'list' })) as unknown[];
      expect(plans).toEqual([]);
      const status = (await client.command('plan', { action: 'status' })) as { active: number };
      expect(status.active).toBe(0);
    } finally {
      await client.close();
    }
  });

  it('preserves a busy lifecycle response instead of retrying it in-process', async () => {
    const originalDream = mem.dream;
    mem.dream = async () => {
      throw new AknoError('busy', 'dream run run_example is already active', {
        run_id: 'run_example',
        started_at: '2030-01-02T03:04:00.000Z',
      });
    };
    let fellBack = false;

    try {
      await expect(
        runMaintenance(
          'dream',
          { phase: 'housekeeping' },
          { json: true },
          { aknoPath: root, stateDir },
          async () => {
            fellBack = true;
            throw new Error('the busy response was incorrectly retried');
          },
        ),
      ).rejects.toMatchObject({
        code: 'busy',
        details: { run_id: 'run_example' },
      });
      expect(fellBack).toBe(false);
    } finally {
      mem.dream = originalDream;
    }
  });

  it('refuses a command it does not have', async () => {
    const client = await connect({ socket: server.path });
    try {
      await expect(client.command('reindex-everything')).rejects.toThrow(/does not accept/);
    } finally {
      await client.close();
    }
  });

  it('refuses an op the door was not given', async () => {
    // Trust is a parameter, not a property of the transport — the same code with different
    // permissions, rather than a second code path that grows its own bugs.
    const restricted = await serveSocket(mem, path.join(stateDir, 'read-only.sock'), {
      allow: ['recall', 'read'],
    });
    const client = await connect({ socket: restricted.path });
    try {
      expect(client.hello.ops).toEqual(['recall', 'read']);
      await expect(client.write({ slug: 'home/lease', append: '- No.' })).rejects.toThrow(/not allowed/);
    } finally {
      await client.close();
      await restricted.close();
    }
  });

  it('refuses to open a socket whose path macOS cannot hold', async () => {
    // The bind silently truncates past 104 bytes and the chmod then fails with a bare ENOENT
    // stack trace — which is what a deep `state_dir` produced.
    const tooLong = path.join(stateDir, 'x'.repeat(120), 'akno.sock');
    await expect(serveSocket(mem, tooLong)).rejects.toThrow(/macOS allows 104/);
  });
});
