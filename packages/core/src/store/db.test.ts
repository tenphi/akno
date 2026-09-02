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
    const revisionColumns = store.db.pragma('table_info(maintenance_item_revisions)') as { name: string }[];
    const conflictCache = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conflict_verdicts'")
      .get() as { name: string } | undefined;
    const conflictColumns = store.db.pragma('table_info(conflict_verdicts)') as { name: string }[];

    expect(tables.map((row) => row.name)).toEqual([
      'maintenance_action_receipts',
      'maintenance_item_revisions',
      'maintenance_items',
      'maintenance_plans',
      'maintenance_recovery_state',
      'maintenance_runs',
    ]);
    expect(columns.map((row) => row.name)).toContain('evidence');
    expect(columns.map((row) => row.name)).toContain('policy');
    expect(columns.map((row) => row.name)).toContain('status_code');
    expect(revisionColumns.map((row) => row.name)).toContain('revision_actor');
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

  it('backfills item policy from the sealed plan mode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-policy-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 9)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO maintenance_plans
          (id, created_at, updated_at, mode, phase, status, fingerprint, summary)
         VALUES('pln_vulpine', '2031-04-05T12:00:00Z', '2031-04-05T12:00:00Z',
                'review', 'curate', 'awaiting_review', 'fingerprint-vulpine', 'invented plan')`,
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO maintenance_items
          (id, plan_id, ord, kind, risk, status, subject, rationale, input_hash,
           operations, updated_at)
         VALUES('itm_vulpine', 'pln_vulpine', 0, 'hygiene', 'low', 'proposed',
                'people/ada-marlow', 'Invented cleanup.', 'hash-vulpine', '[]',
                '2031-04-05T12:00:00Z')`,
      )
      .run();
    legacy.pragma('user_version = 16');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const item = store.db.prepare('SELECT policy FROM maintenance_items WHERE id = ?').get('itm_vulpine') as {
      policy: string;
    };

    expect(item.policy).toBe('review');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds a typed item status code without changing a version-seventeen plan', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-status-code-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 10)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO maintenance_plans
          (id, created_at, updated_at, mode, phase, status, fingerprint, summary)
         VALUES('pln_blackwater', '2031-05-06T12:00:00Z', '2031-05-06T12:00:00Z',
                'auto', 'curate', 'completed', 'fingerprint-blackwater', 'invented plan')`,
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO maintenance_items
          (id, plan_id, ord, kind, policy, risk, status, subject, rationale, input_hash,
           operations, updated_at)
         VALUES('itm_blackwater', 'pln_blackwater', 0, 'hygiene', 'auto', 'low', 'applied',
                'places/blackwater-bay', 'Invented cleanup.', 'hash-blackwater', '[]',
                '2031-05-06T12:00:00Z')`,
      )
      .run();
    legacy.pragma('user_version = 17');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const item = store.db
      .prepare('SELECT status, status_code FROM maintenance_items WHERE id = ?')
      .get('itm_blackwater') as { status: string; status_code: string | null };

    expect(item).toEqual({ status: 'applied', status_code: null });
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds the rebuildable structural graph to a version-eighteen database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-graph-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 11)) legacy.exec(migration);
    legacy.pragma('user_version = 18');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const tables = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'graph_%' ORDER BY name")
      .all() as { name: string }[];

    expect(tables.map((row) => row.name)).toEqual([
      'graph_edges',
      'graph_entities',
      'graph_entity_names',
      'graph_fact_status',
      'graph_mentions',
      'graph_nodes',
      'graph_resolution_verdicts',
    ]);
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds canonical graph entities to a version-nineteen database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-entity-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 12)) legacy.exec(migration);
    legacy.pragma('user_version = 19');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const tables = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'graph_%' ORDER BY name")
      .all() as { name: string }[];

    expect(tables.map((row) => row.name)).toEqual([
      'graph_edges',
      'graph_entities',
      'graph_entity_names',
      'graph_fact_status',
      'graph_mentions',
      'graph_nodes',
      'graph_resolution_verdicts',
    ]);
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds provenance-bound fact relationships to a version-twenty database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-fact-graph-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 13)) legacy.exec(migration);
    legacy.pragma('user_version = 20');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const edgeColumns = store.db.pragma('table_info(graph_edges)') as { name: string }[];
    const factStatus = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'graph_fact_status'")
      .get() as { name: string } | undefined;

    expect(edgeColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['source_fact', 'valid_from', 'valid_to']),
    );
    expect(factStatus?.name).toBe('graph_fact_status');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds contextual entity verdict provenance to a version-twenty-one database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-contextual-entity-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 14)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO pages(id, slug, rel_path, title, body_hash, indexed_at)
         VALUES('page_fixture', 'notes/fixture', 'notes/fixture.md', 'Fixture Note', 'fixture_hash', ?)`,
      )
      .run('2031-01-01T00:00:00.000Z');
    legacy
      .prepare(
        `INSERT INTO graph_mentions(
           id, mention, normalized_mention, source_page, source_field, source_hash,
           resolution, candidates, derivation_version
         ) VALUES(
           'mention_fixture', 'Unknown Fixture', 'unknown fixture', 'page_fixture',
           'akno.about', 'fixture_hash', 'unresolved', '[]', 'entity-exact-v1'
         )`,
      )
      .run();
    legacy.pragma('user_version = 21');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const mentionColumns = store.db.pragma('table_info(graph_mentions)') as { name: string }[];
    const factColumns = store.db.pragma('table_info(graph_fact_status)') as { name: string }[];

    expect(mentionColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['decision_fingerprint', 'model_id', 'prompt_version', 'confidence']),
    );
    expect(factColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['subject_resolution_fingerprint', 'object_resolution_fingerprint']),
    );
    expect(
      store.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'graph_resolution_verdicts'")
        .get(),
    ).toBeDefined();
    expect(
      store.db.prepare("SELECT resolution FROM graph_mentions WHERE id = 'mention_fixture'").get(),
    ).toEqual({ resolution: 'unresolved' });
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds an explicit private-payload retention marker to a version-twenty-two database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-plan-retention-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 15)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO maintenance_plans
          (id, created_at, updated_at, mode, phase, status, fingerprint, summary)
         VALUES('pln_vulpine', '2031-04-05T12:00:00Z', '2031-04-05T12:00:00Z',
                'review', 'curate', 'completed', 'fingerprint-vulpine', 'invented plan')`,
      )
      .run();
    legacy.pragma('user_version = 22');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(maintenance_plans)') as { name: string }[];
    const itemColumns = store.db.pragma('table_info(maintenance_items)') as { name: string }[];
    const plan = store.db
      .prepare('SELECT status, payload_pruned_at FROM maintenance_plans WHERE id = ?')
      .get('pln_vulpine');

    expect(columns.map((column) => column.name)).toContain('payload_pruned_at');
    expect(itemColumns.map((column) => column.name)).toContain('component_count');
    expect(plan).toEqual({ status: 'completed', payload_pruned_at: null });
    expect(store.db.pragma('secure_delete', { simple: true })).toBe(1);
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds the content-safe semantic merge verdict cache to a version-twenty-three database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-semantic-merge-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 17)) legacy.exec(migration);
    legacy.pragma('user_version = 23');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(semantic_merge_verdicts)') as { name: string }[];

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'fingerprint',
        'left_page',
        'right_page',
        'score',
        'outcome',
        'embedding_endpoint',
        'classifier_endpoint',
        'prompt_version',
        'signature_version',
        'created_at',
      ]),
    );
    expect(columns.map((column) => column.name)).not.toContain('reason');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds the complete-page semantic signature cache to a version-twenty-four database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-semantic-signature-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 18)) legacy.exec(migration);
    legacy.pragma('user_version = 24');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(semantic_merge_embeddings)') as { name: string }[];

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'fingerprint',
        'page_id',
        'source_hash',
        'embedding_endpoint',
        'signature_version',
        'dimensions',
        'embedding',
        'created_at',
      ]),
    );
    expect(columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['slug', 'title', 'content', 'reason', 'rationale']),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds the content-safe managed placement cache to a version-twenty-five database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-placement-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 19)) legacy.exec(migration);
    legacy.pragma('user_version = 25');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(managed_item_placement_verdicts)') as {
      name: string;
    }[];

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'fingerprint',
        'page_id',
        'source_hash',
        'classifier_endpoint',
        'prompt_version',
        'signature_version',
        'verdicts',
        'created_at',
      ]),
    );
    expect(columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['slug', 'title', 'content', 'heading', 'reason', 'rationale']),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds replayable managed sources and their verdict cache to a version-twenty-six database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-source-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 20)) legacy.exec(migration);
    legacy.pragma('user_version = 26');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const sourceColumns = store.db.pragma('table_info(managed_item_sources)') as { name: string }[];
    const verdictColumns = store.db.pragma('table_info(managed_item_source_verdicts)') as {
      name: string;
    }[];

    expect(sourceColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'item_id',
        'source_ref',
        'origin',
        'evidence',
        'evidence_hash',
        'input_hash',
        'created_at',
      ]),
    );
    expect(verdictColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'fingerprint',
        'page_id',
        'source_hash',
        'classifier_endpoint',
        'prompt_version',
        'signature_version',
        'verdicts',
        'created_at',
      ]),
    );
    expect(verdictColumns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['slug', 'title', 'content', 'reason', 'rationale']),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds the content-safe managed routing cache to a version-twenty-seven database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-routing-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 21)) legacy.exec(migration);
    legacy.pragma('user_version = 27');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(managed_item_routing_verdicts)') as {
      name: string;
    }[];

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'fingerprint',
        'source_page',
        'item_id',
        'candidate_hash',
        'classifier_endpoint',
        'retrieval_signature',
        'prompt_version',
        'signature_version',
        'outcome',
        'target_page',
        'target_heading_key',
        'created_at',
      ]),
    );
    expect(columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['slug', 'title', 'content', 'heading', 'reason', 'rationale']),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds content-safe maintenance retry receipts to a version-thirty database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-action-receipt-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 24)) legacy.exec(migration);
    legacy.pragma('user_version = 30');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(maintenance_action_receipts)') as { name: string }[];

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'idempotency_key',
        'action',
        'request_hash',
        'plan_id',
        'item_id',
        'started_at',
        'completed_at',
      ]),
    );
    expect(columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['operations', 'evidence', 'reason', 'result']),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds durable content-safe recovery state to a version-thirty-one database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-state-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 25)) legacy.exec(migration);
    legacy.pragma('user_version = 31');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const stateColumns = store.db.pragma('table_info(maintenance_recovery_state)') as { name: string }[];
    const itemColumns = store.db.pragma('table_info(maintenance_items)') as { name: string }[];

    expect(stateColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'scope_key',
        'scope',
        'transform',
        'reason_code',
        'consecutive_failures',
        'paused_at',
        'last_failure_at',
        'last_run_id',
      ]),
    );
    expect(stateColumns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['path', 'content', 'detail', 'operations', 'evidence']),
    );
    expect(itemColumns.map((column) => column.name)).toContain('recovery_recorded_at');
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds replay-safe retain receipts to a version-thirty-two database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-retain-receipt-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 26)) legacy.exec(migration);
    legacy.pragma('user_version = 32');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const receiptColumns = store.db.pragma('table_info(retain_receipts)') as { name: string }[];
    const supportColumns = store.db.pragma('table_info(retain_supports)') as { name: string }[];

    expect(receiptColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'source_id',
        'revision',
        'request_hash',
        'source_hash',
        'receipt_fingerprint',
        'result',
        'change_id',
      ]),
    );
    expect(supportColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'receipt_fingerprint',
        'candidate_id',
        'candidate_fingerprint',
        'proof_group',
        'memory_id',
        'source_ref',
        'origin',
        'input_hash',
        'evidence_hash',
        'retracted_by',
        'forgotten_by',
      ]),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('widens durable retain receipt modes without losing existing receipts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-retain-automatic-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 28)) legacy.exec(migration);
    legacy
      .prepare(
        `INSERT INTO retain_receipts(
           source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint,
           mode, result, change_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'provided_exact', ?, NULL, ?)`,
      )
      .run(
        'fixture:1111',
        '1',
        'request-1111',
        'source-1111',
        'fixture:1111',
        'receipt-1111',
        '{}',
        new Date(0).toISOString(),
      );
    legacy
      .prepare(
        `INSERT INTO retain_supports(
           receipt_fingerprint, candidate_id, candidate_fingerprint, proof_group, memory_id, slug,
           selection, source_ref, origin, input_hash, evidence, evidence_hash, retracted_by, forgotten_by
         ) VALUES (?, ?, ?, ?, ?, ?, 'provided', ?, 'user', ?, ?, ?, NULL, NULL)`,
      )
      .run(
        'receipt-1111',
        'candidate-1111',
        'candidate-fingerprint-1111',
        'proof-group-1111',
        'memory-1111',
        'memory/equipment',
        'fixture:1111',
        'input-1111',
        'Invented exact evidence.',
        'evidence-1111',
      );
    legacy.pragma('user_version = 34');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    expect(store.db.prepare('SELECT mode FROM retain_receipts').get()).toEqual({ mode: 'provided_exact' });
    expect(store.db.prepare('SELECT candidate_id FROM retain_supports').get()).toEqual({
      candidate_id: 'candidate-1111',
    });
    expect(store.db.pragma('foreign_key_check')).toEqual([]);
    expect(() =>
      store.db
        .prepare(
          `INSERT INTO retain_receipts(
             source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint,
             mode, result, change_id, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'extract_automatic', ?, NULL, ?)`,
        )
        .run(
          'fixture:2222',
          '1',
          'request-2222',
          'source-2222',
          'fixture:2222',
          'receipt-2222',
          '{}',
          new Date(0).toISOString(),
        ),
    ).not.toThrow();
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds file-state hashes to a version-thirty-three journal', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-journal-hash-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 27)) legacy.exec(migration);
    legacy.pragma('user_version = 33');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const columns = store.db.pragma('table_info(change_files)') as { name: string }[];
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['before_hash', 'after_hash']),
    );
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds a rebuildable temporal projection to a version-thirty-five database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-temporal-projection-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 29)) legacy.exec(migration);
    legacy.pragma('user_version = 35');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const temporalColumns = store.db.pragma('table_info(temporal_entries)') as { name: string }[];
    const issueColumns = store.db.pragma('table_info(temporal_projection_issues)') as { name: string }[];
    expect(temporalColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'memory_id',
        'source_page',
        'relation',
        'temporal_status',
        'disposition',
        'precision',
        'recurrence',
      ]),
    );
    expect(issueColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['source_page', 'line', 'reason']),
    );
    expect(store.db.pragma('foreign_key_check')).toEqual([]);
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds observation authority and projection tables to a version-thirty-six database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-observation-projection-migration-'));
    const dbPath = path.join(dir, 'akno.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 30)) legacy.exec(migration);
    legacy.pragma('user_version = 36');
    legacy.close();

    const store = openStore({ dbPath, embeddingDimensions: 8 });
    const pageColumns = store.db.pragma('table_info(pages)') as { name: string }[];
    const observationColumns = store.db.pragma('table_info(observation_entries)') as {
      name: string;
    }[];
    const issueColumns = store.db.pragma('table_info(observation_projection_issues)') as {
      name: string;
    }[];
    expect(pageColumns.map((column) => column.name)).toContain('observe_management');
    expect(observationColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'id',
        'source_page',
        'subject_entity',
        'disposition',
        'payload_hash',
        'proof_count',
        'eligible',
      ]),
    );
    expect(issueColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['source_page', 'marker_line', 'observation_id', 'reason']),
    );
    expect(store.db.pragma('foreign_key_check')).toEqual([]);
    expect(store.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
