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
    const conflictCache = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conflict_verdicts'")
      .get() as { name: string } | undefined;
    const conflictColumns = store.db.pragma('table_info(conflict_verdicts)') as { name: string }[];

    expect(tables.map((row) => row.name)).toEqual([
      'maintenance_items',
      'maintenance_plans',
      'maintenance_runs',
    ]);
    expect(columns.map((row) => row.name)).toContain('evidence');
    expect(conflictCache?.name).toBe('conflict_verdicts');
    expect(conflictColumns.map((row) => row.name)).toContain('qualification');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds qualification evidence to a version-eleven conflict cache', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-conflict-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 4)) legacy.exec(migration);
    legacy.pragma('user_version = 11');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(conflict_verdicts)') as { name: string }[];

    expect(columns.map((row) => row.name)).toContain('qualification');
    expect(
      store.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'maintenance_runs'")
        .get(),
    ).toBeDefined();
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds lifecycle receipts to a version-twelve database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-run-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 5)) legacy.exec(migration);
    legacy.pragma('user_version = 12');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const table = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'maintenance_runs'")
      .get() as { name: string } | undefined;

    expect(table?.name).toBe('maintenance_runs');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('preserves page chunks while allowing a document chunk without a page', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-orphan-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 6)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO pages(id, slug, rel_path, title, role, frontmatter, body_hash, indexed_at)
         VALUES('page-ada', 'people/ada-marlow', 'people/ada-marlow.md', 'Ada Marlow',
                'knowledge', '{}', 'hash-page', '2026-08-01T00:00:00Z')`,
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO documents(id, rel_path, sha256, indexed_at, group_key)
         VALUES('doc-zephyr', 'documents/zephyr-qx-100.txt', 'hash-document',
                '2026-08-01T00:00:00Z', 'documents/zephyr-qx-100.txt')`,
      )
      .run();
    const inserted = legacy
      .prepare(
        `INSERT INTO chunks(page_id, ord, text, line_start, line_end)
         VALUES('page-ada', 0, 'Ada keeps the manual.', 1, 1)`,
      )
      .run();
    legacy
      .prepare('INSERT INTO chunks_fts(rowid, text, heading_path) VALUES(?, ?, ?)')
      .run(inserted.lastInsertRowid, 'Ada keeps the manual.', '');
    legacy.pragma('user_version = 13');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    expect(store.db.prepare('SELECT text FROM chunks WHERE id = ?').get(inserted.lastInsertRowid)).toEqual({
      text: 'Ada keeps the manual.',
    });
    expect(
      store.db
        .prepare(
          `INSERT INTO chunks(page_id, document_id, ord, kind, text, line_start, line_end)
           VALUES(NULL, 'doc-zephyr', 0, 'source', 'Zephyr warranty.', 0, 0)`,
        )
        .run().changes,
    ).toBe(1);
    expect(store.db.prepare("SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH 'Ada'").all()).toHaveLength(
      1,
    );

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds durable availability without losing an indexed document', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-availability-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 7)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO documents(id, rel_path, sha256, text, indexed_at, group_key)
         VALUES('doc-zephyr', 'documents/zephyr-qx-100.txt', 'hash-document',
                'Zephyr QX-100 warranty: five years.', '2026-08-01T00:00:00Z',
                'documents/zephyr-qx-100.txt')`,
      )
      .run();
    legacy.pragma('user_version = 14');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(documents)') as { name: string }[];
    const document = store.db
      .prepare('SELECT text, availability, missing_since FROM documents WHERE id = ?')
      .get('doc-zephyr');

    expect(columns.map((row) => row.name)).toEqual(expect.arrayContaining(['availability', 'missing_since']));
    expect(document).toEqual({
      text: 'Zephyr QX-100 warranty: five years.',
      availability: 'available',
      missing_since: null,
    });
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('backfills last-modified document evidence from a version-fifteen file row', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-document-date-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 8)) legacy.exec(migration);
    const modifiedNs = String(BigInt(Date.UTC(2031, 3, 5, 12)) * 1_000_000n);
    legacy
      .prepare(
        `INSERT INTO files(rel_path, size, mtime_ns, sha256, kind, indexed_at)
         VALUES('documents/vulpine-record.bin', 4, ?, 'hash-file', 'attachment',
                '2031-04-05T12:00:00Z')`,
      )
      .run(modifiedNs);
    legacy
      .prepare(
        `INSERT INTO documents(id, rel_path, sha256, indexed_at, group_key)
         VALUES('doc-vulpine', 'documents/vulpine-record.bin', 'hash-file',
                '2031-04-05T12:00:00Z', 'documents/vulpine-record.bin')`,
      )
      .run();
    legacy.pragma('user_version = 15');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const document = store.db
      .prepare('SELECT file_created_at, file_modified_at FROM documents WHERE id = ?')
      .get('doc-vulpine') as { file_created_at: string | null; file_modified_at: string | null };
    expect(document.file_created_at).toBeNull();
    expect(document.file_modified_at).toMatch(/^2031-04-05/);
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
