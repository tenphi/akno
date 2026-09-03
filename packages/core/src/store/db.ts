import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { AknoError } from '@tenphi/akno-protocol';
import {
  CHANGE_FILE_HASHES_MIGRATION_INDEX,
  CONTEXTUAL_ENTITY_MIGRATION_INDEX,
  CONFLICT_VERDICTS_MIGRATION_INDEX,
  CONFLICT_QUALIFICATION_MIGRATION_INDEX,
  DOCUMENT_AVAILABILITY_MIGRATION_INDEX,
  DOCUMENT_FILE_DATES_MIGRATION_INDEX,
  ENTITY_GRAPH_MIGRATION_INDEX,
  FACT_GRAPH_MIGRATION_INDEX,
  MAINTENANCE_EVIDENCE_MIGRATION_INDEX,
  MAINTENANCE_ACTION_RECEIPTS_MIGRATION_INDEX,
  MAINTENANCE_ITEM_POLICY_MIGRATION_INDEX,
  MAINTENANCE_ITEM_COMPONENT_COUNT_MIGRATION_INDEX,
  MAINTENANCE_ITEM_REVISIONS_MIGRATION_INDEX,
  MAINTENANCE_REVISION_ACTOR_MIGRATION_INDEX,
  MAINTENANCE_RECOVERY_STATE_MIGRATION_INDEX,
  MANAGED_ITEM_PLACEMENT_VERDICTS_MIGRATION_INDEX,
  MANAGED_ITEM_ROUTING_VERDICTS_MIGRATION_INDEX,
  MANAGED_ITEM_SOURCES_MIGRATION_INDEX,
  MAINTENANCE_ITEM_STATUS_CODE_MIGRATION_INDEX,
  MAINTENANCE_PLAN_PAYLOAD_RETENTION_MIGRATION_INDEX,
  MAINTENANCE_PLANS_MIGRATION_INDEX,
  MAINTENANCE_RUNS_MIGRATION_INDEX,
  MANAGED_MEMORY_PROJECTION_MIGRATION_INDEX,
  MIGRATIONS,
  ORPHAN_DOCUMENT_CHUNKS_MIGRATION_INDEX,
  OBSERVATION_PROJECTION_MIGRATION_INDEX,
  PAGE_SOURCE_INTEGRITY_MIGRATION_INDEX,
  RETAIN_AUTOMATIC_MODES_MIGRATION_INDEX,
  RETAIN_SOURCE_LIFETIME_MIGRATION_INDEX,
  RETAIN_RECEIPTS_MIGRATION_INDEX,
  SCHEMA_VERSION,
  SEMANTIC_MERGE_EMBEDDINGS_MIGRATION_INDEX,
  SEMANTIC_MERGE_VERDICTS_MIGRATION_INDEX,
  STRUCTURAL_GRAPH_MIGRATION_INDEX,
  TEMPORAL_ENTRIES_MIGRATION_INDEX,
} from './migrations.ts';
import { openVectorIndex, reconcileDimensions, type VectorIndex } from './vectors.ts';

export interface StoreOptions {
  dbPath: string;
  embeddingDimensions: number;
  /** Open without taking the write lock. A second process gets this. */
  readOnly?: boolean;
}

export interface Store {
  readonly db: Database.Database;
  readonly vectors: VectorIndex;
  readonly vecLoaded: boolean;
  readonly readOnly: boolean;
  /** True when a model change invalidated every vector and a re-embed is owed. */
  readonly needsReembed: boolean;
  transaction<T>(fn: () => T): T;
  meta(key: string): string | null;
  setMeta(key: string, value: string): void;
  close(): void;
}

/**
 * There is no engine cold start — opening a SQLite file is half a
 * millisecond regardless of size, because there is no VM to boot and no server
 * to connect to. What *is* expensive is spawning a process per operation (33ms
 * vs 0.04ms for a long-lived handle), which is why `akno serve` exists and why
 * this function is called once per process rather than once per call.
 */
export function openStore(options: StoreOptions): Store {
  fs.mkdirSync(path.dirname(options.dbPath), { recursive: true });

  // A read-only open of a file that is not there fails with SQLite's "unable to open
  // database file", which reads like a permissions problem on the very first run — when
  // the real answer is that nothing has been indexed yet.
  if ((options.readOnly ?? false) && !fs.existsSync(options.dbPath)) {
    throw new AknoError(
      'unavailable',
      `there is no index at ${options.dbPath} yet — run \`akno index\` first`,
    );
  }

  let db: Database.Database;
  try {
    db = new Database(options.dbPath, { readonly: options.readOnly ?? false });
  } catch (err) {
    throw new AknoError(
      'unavailable',
      `could not open the index at ${options.dbPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // WAL: the watcher indexes while an agent reads, with no lock contention
  // between them. One writer, many readers.
  if (!options.readOnly) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    // Retention of private plan bodies must remove their bytes from freed SQLite cells, not
    // merely make them unreachable through SELECT while they remain recoverable in the file.
    db.pragma('secure_delete = ON');
  }
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  // 64 MB of page cache. The largest knowledge base this is tuned for is under a
  // megabyte of Markdown, so this holds the whole index comfortably.
  db.pragma('cache_size = -64000');

  let vecLoaded = false;
  try {
    sqliteVec.load(db);
    vecLoaded = true;
  } catch {
    // Degrade, never fail. Cosine moves to JS; memory stays available.
    vecLoaded = false;
  }

  if (!options.readOnly) migrate(db);

  const needsReembed = options.readOnly
    ? false
    : reconcileDimensions(db, options.embeddingDimensions, vecLoaded);
  const vectors = openVectorIndex(db, options.embeddingDimensions, vecLoaded);

  const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
  const putMeta = db.prepare(
    'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );

  return {
    db,
    vectors,
    vecLoaded,
    readOnly: options.readOnly ?? false,
    needsReembed,
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    meta(key: string): string | null {
      const row = getMeta.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    setMeta(key: string, value: string): void {
      putMeta.run(key, value);
    },
    close(): void {
      try {
        if (!options.readOnly) db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // A checkpoint failure on close costs nothing — WAL replays on next open.
      }
      db.close();
    },
  };
}

function migrate(db: Database.Database): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  db.transaction(() => {
    if (current === 0) {
      // A new database starts from the compact canonical schema, then receives every
      // durable extension. Its version is the historical schema number below, not 3.
      for (const migration of MIGRATIONS) db.exec(migration);
    } else {
      // Released databases exist with both compact version 1 and historical version 8.
      // Table/column capabilities are unambiguous where an array index is not.
      if (!tableExists(db, 'maintenance_plans')) {
        db.exec(MIGRATIONS[MAINTENANCE_PLANS_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'maintenance_items', 'evidence')) {
        db.exec(MIGRATIONS[MAINTENANCE_EVIDENCE_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'conflict_verdicts')) {
        db.exec(MIGRATIONS[CONFLICT_VERDICTS_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'conflict_verdicts', 'qualification')) {
        db.exec(MIGRATIONS[CONFLICT_QUALIFICATION_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'maintenance_runs')) {
        db.exec(MIGRATIONS[MAINTENANCE_RUNS_MIGRATION_INDEX]!);
      }
      if (columnIsNotNull(db, 'chunks', 'page_id')) {
        db.exec(MIGRATIONS[ORPHAN_DOCUMENT_CHUNKS_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'documents', 'availability')) {
        db.exec(MIGRATIONS[DOCUMENT_AVAILABILITY_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'documents', 'file_modified_at')) {
        db.exec(MIGRATIONS[DOCUMENT_FILE_DATES_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'maintenance_items', 'policy')) {
        db.exec(MIGRATIONS[MAINTENANCE_ITEM_POLICY_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'maintenance_items', 'status_code')) {
        db.exec(MIGRATIONS[MAINTENANCE_ITEM_STATUS_CODE_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'graph_nodes')) {
        db.exec(MIGRATIONS[STRUCTURAL_GRAPH_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'graph_entities')) {
        db.exec(MIGRATIONS[ENTITY_GRAPH_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'graph_fact_status')) {
        db.exec(MIGRATIONS[FACT_GRAPH_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'graph_resolution_verdicts')) {
        db.exec(MIGRATIONS[CONTEXTUAL_ENTITY_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'maintenance_plans', 'payload_pruned_at')) {
        db.exec(MIGRATIONS[MAINTENANCE_PLAN_PAYLOAD_RETENTION_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'retain_receipts')) {
        db.exec(MIGRATIONS[RETAIN_RECEIPTS_MIGRATION_INDEX]!);
      }
      // Kept as a capability check because the retain schema was exercised against local
      // development databases before its first release.
      if (tableExists(db, 'retain_supports') && !columnExists(db, 'retain_supports', 'forgotten_by')) {
        db.exec(
          'ALTER TABLE retain_supports ADD COLUMN forgotten_by TEXT REFERENCES changes(id) ON DELETE SET NULL',
        );
      }
      if (!tableDefinitionIncludes(db, 'retain_receipts', "'extract_automatic'")) {
        db.exec(MIGRATIONS[RETAIN_AUTOMATIC_MODES_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'retain_source_bindings')) {
        db.exec(MIGRATIONS[RETAIN_SOURCE_LIFETIME_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'maintenance_items', 'component_count')) {
        db.exec(MIGRATIONS[MAINTENANCE_ITEM_COMPONENT_COUNT_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'semantic_merge_verdicts')) {
        db.exec(MIGRATIONS[SEMANTIC_MERGE_VERDICTS_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'semantic_merge_embeddings')) {
        db.exec(MIGRATIONS[SEMANTIC_MERGE_EMBEDDINGS_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'managed_item_placement_verdicts')) {
        db.exec(MIGRATIONS[MANAGED_ITEM_PLACEMENT_VERDICTS_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'managed_item_sources')) {
        db.exec(MIGRATIONS[MANAGED_ITEM_SOURCES_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'managed_item_routing_verdicts')) {
        db.exec(MIGRATIONS[MANAGED_ITEM_ROUTING_VERDICTS_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'maintenance_item_revisions')) {
        db.exec(MIGRATIONS[MAINTENANCE_ITEM_REVISIONS_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'maintenance_item_revisions', 'revision_actor')) {
        db.exec(MIGRATIONS[MAINTENANCE_REVISION_ACTOR_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'maintenance_action_receipts')) {
        db.exec(MIGRATIONS[MAINTENANCE_ACTION_RECEIPTS_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'maintenance_recovery_state')) {
        db.exec(MIGRATIONS[MAINTENANCE_RECOVERY_STATE_MIGRATION_INDEX]!);
      }
      if (!columnExists(db, 'change_files', 'after_hash')) {
        db.exec(MIGRATIONS[CHANGE_FILE_HASHES_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'temporal_entries') || !tableExists(db, 'temporal_projection_issues')) {
        db.exec(MIGRATIONS[TEMPORAL_ENTRIES_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'observation_entries')) {
        db.exec(MIGRATIONS[OBSERVATION_PROJECTION_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'managed_memory_entries')) {
        db.exec(MIGRATIONS[MANAGED_MEMORY_PROJECTION_MIGRATION_INDEX]!);
      }
      if (!tableExists(db, 'page_source_integrity')) {
        db.exec(MIGRATIONS[PAGE_SOURCE_INTEGRITY_MIGRATION_INDEX]!);
      }
    }
    if (current < SCHEMA_VERSION) db.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { present: number } | undefined;
  return row?.present === 1;
}

function tableDefinitionIncludes(db: Database.Database, name: string, text: string): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) as
    { sql: string | null } | undefined;
  return row?.sql?.includes(text) ?? false;
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.pragma(`table_info(${JSON.stringify(table)})`) as { name: string }[];
  return rows.some((row) => row.name === column);
}

function columnIsNotNull(db: Database.Database, table: string, column: string): boolean {
  const rows = db.pragma(`table_info(${JSON.stringify(table)})`) as { name: string; notnull: number }[];
  return rows.some((row) => row.name === column && row.notnull === 1);
}

/**
 * Exactly one process may hold the write handle. A second process that
 * finds a live lock opens read-only and *says so*, rather than racing. This is
 * not paranoia: the library being importable makes it genuinely easy to end up
 * with a daemon and a script both reconciling the same directory, and WAL
 * protects the file's integrity, not the correctness of two watchers.
 */
export interface WriteLock {
  readonly acquired: boolean;
  readonly heldByPid: number | null;
  /**
   * Why it was not taken, when it wasn't. "A live process holds it" and "the lock file
   * could not be written" call for different actions, and reporting the second as the
   * first sends the user looking for a process that does not exist.
   */
  readonly failure?: 'held' | 'unwritable';
  release(): void;
}

/**
 * Take the write handle, waiting briefly for a handover.
 *
 * `waitMs` exists because of how a restart actually goes: the supervisor starts the new process
 * while the old one is still closing its database and unlinking its lock. Checking once, at that
 * instant, is how a service comes up read-only — and it then stays that way for its whole life,
 * failing every write with the pid of a process that has since exited. Observed on a real install:
 * hours of `remember` calls refused by a daemon deferring to a ghost.
 *
 * A few seconds covers the handover and costs nothing when the lock is free, which is the normal
 * case. It does not paper over a genuine second Akno — that one is still running when the wait
 * runs out, and is still refused.
 */
export function acquireWriteLock(lockPath: string, waitMs = 0): WriteLock {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  const deadline = Date.now() + waitMs;
  let existing = readLockPid(lockPath);
  while (existing !== null && existing !== process.pid && isProcessAlive(existing) && Date.now() < deadline) {
    sleep(100);
    existing = readLockPid(lockPath);
  }
  if (existing !== null && existing !== process.pid && isProcessAlive(existing)) {
    return { acquired: false, heldByPid: existing, failure: 'held', release: () => {} };
  }

  try {
    // A stale lock from a crashed process is safe to take over — the pid check
    // above already proved nothing is behind it.
    fs.writeFileSync(lockPath, String(process.pid), 'utf8');
  } catch {
    return { acquired: false, heldByPid: null, failure: 'unwritable', release: () => {} };
  }

  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    try {
      if (readLockPid(lockPath) === process.pid) fs.unlinkSync(lockPath);
    } catch {
      // Nothing useful to do; the pid check makes a leftover file harmless.
    }
  };

  return { acquired: true, heldByPid: process.pid, release };
}

/** Blocking, deliberately: this runs before anything is open and there is nothing to yield to. */
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readLockPid(lockPath: string): number | null {
  try {
    const pid = Number(fs.readFileSync(lockPath, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 tests for existence without delivering anything.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
