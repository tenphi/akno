export interface IndexRevisionBarrier {
  /** Release the fixed read revision, then wait for every index pass queued behind it. */
  release(): Promise<void>;
}

type QueueEntry =
  | {
      kind: 'work';
      work: () => Promise<unknown>;
      resolve: (value: unknown) => void;
      reject: (error: unknown) => void;
    }
  | {
      kind: 'barrier';
      resolve: (barrier: IndexRevisionBarrier) => void;
    }
  | { kind: 'checkpoint'; resolve: () => void };

/**
 * One serialized lane for index mutations, with a bounded read barrier for dream planning.
 *
 * The barrier is a queue position, not a timer: it waits for an earlier pass to finish, prevents
 * later passes from starting, and drains exactly the work accumulated behind it on release.
 */
export class IndexRevisionCoordinator {
  #queue: QueueEntry[] = [];
  #workRunning = false;
  #barrierHeld = false;
  #barrierReserved = false;

  run<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#queue.push({
        kind: 'work',
        work,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.#drain();
    });
  }

  acquire(): Promise<IndexRevisionBarrier> {
    if (this.#barrierReserved) {
      return Promise.reject(new Error('an index revision barrier is already active'));
    }
    this.#barrierReserved = true;
    return new Promise<IndexRevisionBarrier>((resolve) => {
      this.#queue.push({ kind: 'barrier', resolve });
      this.#drain();
    });
  }

  #drain(): void {
    if (this.#workRunning || this.#barrierHeld) return;
    const entry = this.#queue.shift();
    if (!entry) return;

    if (entry.kind === 'barrier') {
      this.#barrierHeld = true;
      entry.resolve(this.#activeBarrier());
      return;
    }
    if (entry.kind === 'checkpoint') {
      this.#barrierReserved = false;
      entry.resolve();
      this.#drain();
      return;
    }

    this.#workRunning = true;
    void Promise.resolve()
      .then(entry.work)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        this.#workRunning = false;
        this.#drain();
      });
  }

  #activeBarrier(): IndexRevisionBarrier {
    let released: Promise<void> | null = null;
    return {
      release: () => {
        if (released) return released;
        released = new Promise<void>((resolve) => {
          // The marker is appended before the lane is unlocked, so it waits for work queued
          // during planning but not for unrelated work that arrives after release.
          this.#queue.push({ kind: 'checkpoint', resolve });
          this.#barrierHeld = false;
          this.#drain();
        });
        return released;
      },
    };
  }
}
