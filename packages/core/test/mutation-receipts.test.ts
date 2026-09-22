import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

const KB: Record<string, string> = {
  'timeline.md': '# Timeline\n\n## 2026\n',
  'home/appliances.md': '# Appliances\n\n- Dishwasher: Zephyr QX-100\n',
  'people/ada-marlow.md': '# Ada Marlow\n\nAda Marlow prefers email.\n',
};

let root: string;
let stateDir: string;

async function openAs(actor: 'user' | 'agent' = 'agent'): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor,
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
}

async function openWithDerive(baseUrl: string): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'agent',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { fixture: { base_url: baseUrl } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { provider: 'fixture', id: 'fixture-derive' },
        expansion: { id: null },
      },
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-mutation-receipts-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-mutation-receipts-state-'));
  for (const [relPath, content] of Object.entries(KB)) {
    fs.mkdirSync(path.dirname(path.join(root, relPath)), { recursive: true });
    fs.writeFileSync(path.join(root, relPath), content, 'utf8');
  }
  const memory = await openAs();
  await memory.index({});
  await memory.close();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('replay-safe mutations', () => {
  it('returns the original write result without applying an identical request twice', async () => {
    const memory = await openAs();
    const request = {
      slug: 'home/bo-winters',
      content: '# Bo Winters\n\nBo Winters owns a Zephyr QX-100.',
      idempotency_key: 'write-bo-winters-1',
    };

    const first = await memory.write(request);
    const second = await memory.write({
      idempotency_key: request.idempotency_key,
      content: request.content,
      slug: request.slug,
      dry_run: false,
    });

    expect(second).toEqual({ ...first, replayed: true });
    expect(memory.changes().filter((change) => change.op === 'write')).toHaveLength(1);
    expect(fs.readFileSync(path.join(root, 'home/bo-winters.md'), 'utf8')).toContain(
      'Bo Winters owns a Zephyr QX-100.',
    );
    await memory.close();
  });

  it('scopes keys by actor and operation, and rejects a changed request in either scope', async () => {
    const memory = await openAs();
    const key = 'shared-actor-key';

    const agent = await memory.call(
      'write',
      { slug: 'home/appliances', append: '- Warranty: 2028', idempotency_key: key },
      { actor: 'agent' },
    );
    const user = await memory.call(
      'write',
      { slug: 'home/appliances', append: '- Owner: Ada Marlow', idempotency_key: key },
      { actor: 'user' },
    );
    const folder = await memory.call(
      'folder',
      { path: 'claims', description: 'Invented claims.', idempotency_key: key },
      { actor: 'agent' },
    );

    expect(agent.change_id).not.toBe(user.change_id);
    expect(folder.change_id).toEqual(expect.any(String));
    await expect(
      memory.call(
        'write',
        { slug: 'home/appliances', append: '- Warranty: 2029', idempotency_key: key },
        { actor: 'agent' },
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).not.toContain('2029');
    await memory.close();
  });

  it('replays folder, move, and forget results with their original change ids', async () => {
    const memory = await openAs();

    const folderRequest = {
      path: 'research',
      description: 'Invented research about Vulpine Mutual.',
      idempotency_key: 'folder-research-1',
    };
    const folder = await memory.folder(folderRequest);
    expect(await memory.folder(folderRequest)).toEqual({ ...folder, replayed: true });

    const moveRequest = {
      from: 'home/appliances',
      to: 'home/zephyr-appliances',
      idempotency_key: 'move-zephyr-1',
    };
    const moved = await memory.move(moveRequest);
    expect(await memory.move(moveRequest)).toEqual({ ...moved, replayed: true });

    const forgetRequest = { slug: 'people/ada-marlow', idempotency_key: 'forget-ada-1' };
    const forgotten = await memory.forget(forgetRequest);
    expect(await memory.forget(forgetRequest)).toEqual({ ...forgotten, replayed: true });

    expect(
      memory.changes().filter((change) => ['folder', 'move', 'forget'].includes(change.op)),
    ).toHaveLength(3);
    await memory.close();
  });

  it('persists stable dry-run and no-op results without creating journal changes', async () => {
    const memory = await openAs();
    const dryRun = {
      slug: 'home/dry-run',
      content: 'Blackwater Bay is an invented place.',
      dry_run: true,
      idempotency_key: 'dry-run-1',
    };
    const firstDryRun = await memory.write(dryRun);
    expect(await memory.write(dryRun)).toEqual({ ...firstDryRun, replayed: true });

    const writeNoop = {
      slug: 'home/appliances',
      content: '# Appliances\n\n- Dishwasher: Zephyr QX-100\n',
      idempotency_key: 'write-noop-1',
    };
    const firstWriteNoop = await memory.write(writeNoop);
    expect(firstWriteNoop.outcome).toBe('noop');
    expect(await memory.write(writeNoop)).toEqual({ ...firstWriteNoop, replayed: true });

    const sameMove = {
      from: 'home/appliances',
      to: 'home/appliances.md',
      idempotency_key: 'same-move-1',
    };
    const firstMove = await memory.move(sameMove);
    expect(await memory.move(sameMove)).toEqual({ ...firstMove, replayed: true });

    expect(memory.changes()).toHaveLength(0);
    await memory.close();
  });

  it('replays the existing rule for a keyed folder no-op without storing its description', async () => {
    const memory = await openAs();
    await memory.folder({ path: 'sources', description: 'Invented source material.' });
    const before = memory.changes().length;
    const request = {
      path: 'sources',
      description: 'A different request that must not replace the existing declaration.',
      idempotency_key: 'folder-noop-1',
    };

    const first = await memory.folder(request);
    expect(first).toMatchObject({ outcome: 'noop', rule: { description: 'Invented source material.' } });
    expect(await memory.folder(request)).toEqual({ ...first, replayed: true });
    expect(memory.changes()).toHaveLength(before);
    await memory.close();
  });

  it('lets a retry proceed after a precondition result becomes satisfiable', async () => {
    const memory = await openAs();
    const request = {
      slug: 'cases/vulpine-mutual',
      content: 'Vulpine Mutual offered 2222 EUR.',
      idempotency_key: 'precondition-retry-1',
    };

    expect(await memory.write(request)).toMatchObject({ outcome: 'requires_folder' });
    await memory.folder({ path: 'cases', description: 'Invented insurance cases.' });
    const retried = await memory.write(request);
    expect(retried).toMatchObject({ outcome: 'ok' });
    expect(retried).not.toHaveProperty('replayed');
    await memory.close();
  });

  it('releases a key when attachment preflight fails before any file changes', async () => {
    const memory = await openAs();
    const attachment = path.join(root, 'invented-zephyr-manual.txt');
    const request = {
      slug: 'home/zephyr-manual',
      content: 'Zephyr QX-100 manual.',
      documents: [{ path: attachment }],
      idempotency_key: 'attachment-preflight-1',
    };

    await expect(memory.write(request)).rejects.toMatchObject({ code: 'not_found' });
    expect(fs.existsSync(path.join(root, 'home/zephyr-manual.md'))).toBe(false);
    fs.writeFileSync(attachment, 'Invented manual contents.', 'utf8');
    expect(await memory.write(request)).toMatchObject({ outcome: 'ok' });
    await memory.close();
  });

  it('allows at most one concurrent caller to use a key', async () => {
    const memory = await openAs();
    const request = {
      slug: 'home/concurrent',
      content: 'Ada Marlow visited Blackwater Bay.',
      idempotency_key: 'concurrent-write-1',
    };
    const results = await Promise.allSettled([memory.write(request), memory.write(request)]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: { code: 'busy' } });
    expect(memory.changes().filter((change) => change.op === 'write')).toHaveLength(1);
    await memory.close();
  });

  it('replays after restart and survives a full index rebuild', async () => {
    let memory = await openAs();
    const request = {
      slug: 'home/restart',
      content: 'Bo Winters paid 1111 EUR.',
      idempotency_key: 'restart-write-1',
    };
    const first = await memory.write(request);
    await memory.close();

    memory = await openAs();
    await memory.index({ rebuild: true });
    expect(await memory.write(request)).toEqual({ ...first, replayed: true });
    expect(memory.changes().filter((change) => change.op === 'write')).toHaveLength(1);
    await memory.close();
  });

  it('does not schedule another model call when a completed request is replayed', async () => {
    let calls = 0;
    const server = http.createServer((_request, response) => {
      calls++;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ summary: 'Invented summary.', keywords: [], facts: [] }),
              },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    const request = {
      slug: 'home/model-count',
      content: 'Bo Winters owns a Zephyr QX-100.',
      idempotency_key: 'model-count-write-1',
    };

    let memory: Akno | null = null;
    try {
      memory = await openWithDerive(`http://127.0.0.1:${port}/v1`);
      const first = await memory.write(request);
      await memory.close();
      memory = null;
      const callsAfterFirst = calls;
      expect(callsAfterFirst).toBeGreaterThan(0);

      memory = await openWithDerive(`http://127.0.0.1:${port}/v1`);
      expect(await memory.write(request)).toEqual({ ...first, replayed: true });
      await memory.close();
      memory = null;
      expect(calls).toBe(callsAfterFirst);
    } finally {
      await memory?.close();
      server.close();
      server.closeAllConnections();
    }
  });

  it('surfaces a journalled-but-unfinished request as interrupted after restart', async () => {
    let memory = await openAs();
    const request = {
      slug: 'home/interrupted',
      content: 'Ada Marlow tested the Zephyr QX-100.',
      idempotency_key: 'interrupted-write-1',
    };
    const first = await memory.write(request);
    await memory.close();

    const db = new Database(memory.config.dbPath);
    db.prepare(
      `UPDATE mutation_receipts
          SET state = 'committed', result = NULL, completed_at = NULL
        WHERE idempotency_key = ?`,
    ).run(request.idempotency_key);
    db.close();

    memory = await openAs();
    await expect(memory.write(request)).rejects.toMatchObject({
      code: 'interrupted',
      details: { change_id: first.change_id, state: 'interrupted' },
    });
    expect(memory.changes().filter((change) => change.op === 'write')).toHaveLength(1);
    await memory.close();
  });

  it('discards a reservation that provably never reached the mutation boundary', async () => {
    let memory = await openAs();
    const request = {
      slug: 'home/reserved',
      content: 'A dry-run note about Vulpine Mutual.',
      dry_run: true,
      idempotency_key: 'reserved-write-1',
    };
    await memory.write(request);
    await memory.close();

    const db = new Database(memory.config.dbPath);
    db.prepare(
      `UPDATE mutation_receipts
          SET state = 'reserved', result = NULL, completed_at = NULL, change_id = NULL
        WHERE idempotency_key = ?`,
    ).run(request.idempotency_key);
    db.close();

    memory = await openAs();
    const retried = await memory.write(request);
    expect(retried).toMatchObject({ outcome: 'ok' });
    expect(retried).not.toHaveProperty('replayed');
    await memory.close();
  });

  it('stores hashes and bounded locators, not request or removed content', async () => {
    const memory = await openAs();
    await memory.folder({
      path: 'evidence',
      description: 'Sensitive invented evidence about Vulpine Mutual.',
      idempotency_key: 'private-folder-1',
    });
    await memory.forget({ slug: 'people/ada-marlow', idempotency_key: 'private-forget-1' });

    const db = new Database(memory.config.dbPath, { readonly: true });
    const rows = db
      .prepare('SELECT request_hash, result FROM mutation_receipts ORDER BY operation')
      .all() as { request_hash: string; result: string }[];
    db.close();
    const persisted = JSON.stringify(rows);

    expect(rows.every((row) => /^[a-f0-9]{64}$/.test(row.request_hash))).toBe(true);
    expect(rows.every((row) => Buffer.byteLength(row.result) <= 64 * 1024)).toBe(true);
    expect(persisted).not.toContain('Sensitive invented evidence');
    expect(persisted).not.toContain('Ada Marlow prefers email');
    await memory.close();
  });

  it('leaves calls without a key unchanged and repeatable', async () => {
    const memory = await openAs();
    const first = await memory.write({ slug: 'home/appliances', append: '- Price: 1111 EUR' });
    const second = await memory.write({ slug: 'home/appliances', append: '- Price: 1111 EUR' });

    expect(first.change_id).not.toBe(second.change_id);
    const db = new Database(memory.config.dbPath, { readonly: true });
    expect(
      (db.prepare('SELECT count(*) AS count FROM mutation_receipts').get() as { count: number }).count,
    ).toBe(0);
    db.close();
    await memory.close();
  });
});
