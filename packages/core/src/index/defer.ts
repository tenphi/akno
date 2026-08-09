import type { Indexer } from './indexer.ts';

/**
 * Deriving the facts on a page that was just written, without making the writer wait for it.
 *
 * A write is finished when the Markdown is on disk. Everything after that — the summary, the
 * keywords, the claims a deriver reads back out of the sentence — is a *reading* of a file that is
 * already correct, and the caller has nothing to do with the answer.
 *
 * It used to be awaited, and on a knowledge base whose deriver is a local model that unloads
 * between calls, that meant a `remember` took eighty-five seconds: sixty of them a model loading to
 * re-read one line the caller had already been told was written. The tool calling it timed out at
 * the client's default sixty, so the write landed and the user was told it had failed.
 *
 * So the structural pass stays synchronous — a page is searchable by its own text immediately, and
 * a link to it resolves — and the model pass runs after the answer goes out. `flush` exists for
 * one-shot commands, which would otherwise exit while it was still going.
 */
export class DeferredDerive {
  readonly #indexer: Indexer;
  readonly #onError: (err: unknown) => void;
  #pending = new Set<string>();
  #running: Promise<void> | null = null;

  constructor(indexer: Indexer, onError: (err: unknown) => void) {
    this.#indexer = indexer;
    this.#onError = onError;
  }

  /**
   * Queue paths for derivation. Returns immediately.
   *
   * Paths queued while a pass is running are picked up by the next one rather than starting a
   * second: two derivers on one page is two model calls for one answer, and on a cold local model
   * that is two minutes.
   */
  schedule(relPaths: string[]): void {
    for (const relPath of relPaths) this.#pending.add(relPath);
    if (this.#pending.size === 0 || this.#running) return;
    this.#running = this.#drain().finally(() => {
      this.#running = null;
    });
  }

  /** Wait for everything queued, including anything queued while draining. */
  async flush(): Promise<void> {
    while (this.#running || this.#pending.size > 0) {
      if (!this.#running) this.schedule([]);
      await this.#running;
    }
  }

  async #drain(): Promise<void> {
    while (this.#pending.size > 0) {
      const batch = [...this.#pending];
      this.#pending.clear();
      try {
        // `only` keeps the structural work to these paths; `modelPaths` is what actually costs.
        await this.#indexer.run({ only: batch, modelPaths: batch, reindexUnchanged: true });
      } catch (err) {
        // A failed derivation loses a summary, not a write. Reported, never thrown at nobody:
        // this runs after the caller has gone.
        this.#onError(err);
      }
    }
  }
}
