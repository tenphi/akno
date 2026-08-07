import fs from 'node:fs';
import path from 'node:path';
import type { AknoConfig } from '../config/schema.ts';
import type { Indexer, IndexReport } from '../index/indexer.ts';

export interface WatcherEvents {
  onIndexed?: (report: IndexReport, changed: string[]) => void;
  /**
   * Files that appeared or changed, after they have been indexed. The inbox hangs off this: a dropped file has to be *acted on*, not merely noticed.
   */
  onArrival?: (changed: string[]) => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * **FSEvents, not polling.** Node's recursive `fs.watch` uses FSEvents on
 * macOS: native, cheap, and it reports renames as renames.
 *
 * But FSEvents coalesces under load and can drop events after a sleep/wake or a
 * large sync, so a **periodic hash sweep is the backstop.** Watching alone is not
 * a correctness guarantee; hashing is. At ~10ms for a typical knowledge base the
 * sweep can run every few minutes and cost nothing.
 */
export class Watcher {
  private watcher: fs.FSWatcher | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private verifyTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pending = new Set<string>();
  private running = false;
  /** Set when a change arrived mid-index; guarantees one more pass after it. */
  private dirty = false;

  readonly #config: AknoConfig;
  readonly #indexer: Indexer;
  readonly #events: WatcherEvents;

  constructor(config: AknoConfig, indexer: Indexer, events: WatcherEvents = {}) {
    this.#config = config;
    this.#indexer = indexer;
    this.#events = events;
  }

  start(): void {
    if (this.watcher) return;

    try {
      this.watcher = fs.watch(
        this.#config.aknoPath,
        { recursive: true, persistent: true },
        (_type, filename) => {
          if (!filename) {
            // A null filename means FSEvents coalesced and cannot say what moved.
            // The only correct response is to treat the whole tree as suspect.
            this.dirty = true;
            this.schedule();
            return;
          }
          const relPath = filename.split(path.sep).join('/');
          if (this.shouldIgnore(relPath)) return;
          this.pending.add(relPath);
          this.schedule();
        },
      );
      this.watcher.on('error', (error) => this.#events.onError?.(error as Error));
    } catch (error) {
      // A watch that cannot be established is not fatal: the sweep below still
      // reconciles, just with more latency.
      this.#events.onError?.(error as Error);
    }

    if (this.#config.watch.sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => {
        this.dirty = true;
        void this.flush();
      }, this.#config.watch.sweepIntervalMs);
      this.sweepTimer.unref();
    }

    if (this.#config.watch.verifyIntervalMs > 0) {
      // The correctness path: a full hash sweep that catches a sync client or a
      // restored backup which preserved mtime across a real content change.
      this.verifyTimer = setInterval(() => {
        void this.flush({ verify: true });
      }, this.#config.watch.verifyIntervalMs);
      this.verifyTimer.unref();
    }
  }

  /**
   * The service reconciles on wake — the gap where a laptop was closed is
   * exactly when the folder gets edited on another device. A host that knows about
   * sleep/wake calls this; the periodic sweep covers the case where nothing does.
   */
  reconcileNow(): Promise<void> {
    this.dirty = true;
    return this.flush({ verify: true });
  }

  async stop(): Promise<void> {
    this.watcher?.close();
    this.watcher = null;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.verifyTimer) clearInterval(this.verifyTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.sweepTimer = this.verifyTimer = this.debounceTimer = null;
  }

  private shouldIgnore(relPath: string): boolean {
    const segments = relPath.split('/');
    if (segments.some((segment) => segment.startsWith('.'))) return true;
    if (segments.some((segment) => this.#config.ignore.includes(segment))) return true;
    // Editors and sync clients write to a temp name then rename. Indexing the
    // temp file wastes a pass and briefly indexes a partial page.
    const base = segments.at(-1) ?? '';
    return /(^~|\.tmp$|\.swp$|\.crdownload$|\.part$|^\.#|~$)/.test(base);
  }

  private schedule(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    // FSEvents coalesces, but an editor still produces a write storm on save.
    this.debounceTimer = setTimeout(() => void this.flush(), this.#config.watch.debounceMs);
  }

  private async flush(options: { verify?: boolean } = {}): Promise<void> {
    if (this.running) {
      // A change that arrived while indexing must not be lost to the guard.
      this.dirty = true;
      return;
    }
    const changed = [...this.pending];
    const wholeTree = this.dirty || options.verify;
    if (changed.length === 0 && !wholeTree) return;

    this.pending.clear();
    this.dirty = false;
    this.running = true;

    try {
      const report = await this.#indexer.run({
        ...(options.verify ? { verify: true } : {}),
        // A targeted pass cannot conclude anything about deletions, so a
        // coalesced or swept run deliberately walks the whole tree.
        ...(wholeTree ? {} : { only: changed }),
      });
      this.#events.onIndexed?.(report, changed);
      // After indexing, so an inbox handler sees a knowledge base that already knows
      // about the file it is about to move.
      if (this.#events.onArrival) await this.#events.onArrival(changed);
    } catch (error) {
      this.#events.onError?.(error as Error);
    } finally {
      this.running = false;
      if (this.dirty || this.pending.size > 0) this.schedule();
    }
  }
}
