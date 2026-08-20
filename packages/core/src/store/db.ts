import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { AknoError } from '@tenphi/akno-protocol';
import { MIGRATIONS } from './migrations.ts';
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
  if (current >= MIGRATIONS.length) return;
  db.transaction(() => {
    for (let i = current; i < MIGRATIONS.length; i++) {
      db.exec(MIGRATIONS[i]!);
    }
    db.pragma(`user_version = ${MIGRATIONS.length}`);
  })();
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
