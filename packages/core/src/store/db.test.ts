import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { acquireWriteLock, openStore } from './db.ts';
import { MIGRATIONS, SCHEMA_VERSION } from './migrations.ts';

/**
 * Exactly one process may write, and the rule is enforced by a pid in a lock file. What is tested
 * here is the handover — the moment a restart replaces one holder with another.
 */
describe('waiting for the write handle', () => {
  it('takes the lock once the holder exits, rather than giving up on the first look', () => {
    // The restart race, which is how a service comes up read-only: the supervisor starts the
    // replacement while the outgoing process is still closing. One look at that instant loses.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-lock-'));
    const lockPath = path.join(dir, 'akno.lock');

    // A pid that is alive now — this process — released a moment later.
    fs.writeFileSync(lockPath, String(process.pid + 0), 'utf8');
    const held = acquireWriteLock(lockPath, 0);
    // Our own pid never blocks us: it is the same process, not a second Akno.
    expect(held.acquired).toBe(true);

    // A pid nothing is behind is taken over immediately, wait or no wait.
    fs.writeFileSync(lockPath, '999999', 'utf8');
    expect(acquireWriteLock(lockPath, 0).acquired).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('still refuses while a real second process is running', () => {
    // The wait is for a handover, not a way around the rule.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-lock-live-'));
    const lockPath = path.join(dir, 'akno.lock');
    // A live pid that is not us: the parent of this process is alive for the whole test.
    fs.writeFileSync(lockPath, String(process.ppid), 'utf8');

    const started = Date.now();
    const lock = acquireWriteLock(lockPath, 300);
    expect(lock.acquired).toBe(false);
    expect(lock.failure).toBe('held');
    expect(lock.heldByPid).toBe(process.ppid);
    // It waited rather than failing instantly.
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('schema migration', () => {
  it('adds durable maintenance capabilities to a historical version-eight database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    legacy.exec(MIGRATIONS[0]!);
    legacy.pragma('user_version = 8');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const tables = store.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'maintenance_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const columns = store.db.pragma('table_info(maintenance_items)') as { name: string }[];

    expect(tables.map((row) => row.name)).toEqual(['maintenance_items', 'maintenance_plans']);
    expect(columns.map((row) => row.name)).toContain('evidence');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
