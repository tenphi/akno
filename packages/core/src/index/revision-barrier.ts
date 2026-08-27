export interface IndexRevisionBarrier {
  /** True once foreground work has broken this planner's fixed revision. */
  readonly invalidated: boolean;
  /** Release the fixed read revision, then wait for every index pass queued behind it. */
  release(): Promise<{ invalidated: boolean }>;
}

interface ActiveBarrierState {
  invalidated: boolean;
  releasing: boolean;
  released: Promise<{ invalidated: boolean }> | null;
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
  #activeBarrierState: ActiveBarrierState | null = null;

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.#enqueue(work, 'ordinary');
  }

  /**
   * Run structural work needed to finish a foreground memory mutation.
   *
   * If the dream already owns a planner revision, the user's write wins: the lane unlocks,
   * this work moves ahead of background reconciliation, and the barrier becomes invalid. The
   * dream observes that typed state at its next phase boundary and applies nothing.
   */
  runForeground<T>(work: () => Promise<T>): Promise<T> {
    return this.#enqueue(work, 'foreground');
  }

  /** Invalidate an acquired barrier for a foreground policy mutation that needs no index pass. */
  invalidateForForeground(): boolean {
    if (!this.#barrierReserved) return false;
    // A queued barrier has not captured its snapshot yet, so the completed mutation will simply
    // be part of that boundary. Only an already-acquired revision needs invalidation.
    if (this.#queue.some((entry) => entry.kind === 'barrier')) return false;
    if (!this.#activeBarrierState || this.#activeBarrierState.releasing) return false;
    this.#activeBarrierState.invalidated = true;
    this.#barrierHeld = false;
    this.#drain();
    return true;
  }

  #enqueue<T>(work: () => Promise<T>, priority: 'ordinary' | 'foreground'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry = {
        kind: 'work',
        work,
        resolve: (value) => resolve(value as T),
        reject,
      };

      if (priority === 'foreground' && this.#barrierReserved) {
        const queuedBarrier = this.#queue.findIndex((candidate) => candidate.kind === 'barrier');
        if (queuedBarrier >= 0) {
          // The dream has not acquired its revision yet. Put the write before that boundary so
          // its completed structural state becomes part of the refreshed planner snapshot.
          this.#queue.splice(queuedBarrier, 0, entry);
        } else if (this.#activeBarrierState && !this.#activeBarrierState.releasing) {
          this.#activeBarrierState.invalidated = true;
          this.#barrierHeld = false;
          this.#queue.unshift(entry);
        } else {
          this.#queue.push(entry);
        }
      } else {
        this.#queue.push(entry);
      }
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
      const state: ActiveBarrierState = { invalidated: false, releasing: false, released: null };
      this.#activeBarrierState = state;
      this.#barrierHeld = true;
      entry.resolve(this.#activeBarrier(state));
      return;
    }
    if (entry.kind === 'checkpoint') {
      this.#barrierReserved = false;
      this.#activeBarrierState = null;
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

  #activeBarrier(state: ActiveBarrierState): IndexRevisionBarrier {
    return {
      get invalidated() {
        return state.invalidated;
      },
      release: () => {
        if (state.released) return state.released;
        state.releasing = true;
        if (state.invalidated) {
          // Foreground work already unlocked the lane. The dream is aborting, so it should not
          // wait for unrelated reconciliation that arrived after its revision was lost.
          this.#barrierReserved = false;
          this.#activeBarrierState = null;
          state.released = Promise.resolve({ invalidated: true });
          this.#drain();
          return state.released;
        }
        state.released = new Promise<{ invalidated: boolean }>((resolve) => {
          // The marker is appended before the lane is unlocked, so it waits for work queued
          // during planning but not for unrelated work that arrives after release.
          this.#queue.push({ kind: 'checkpoint', resolve: () => resolve({ invalidated: false }) });
          this.#barrierHeld = false;
          this.#drain();
        });
        return state.released;
      },
    };
  }
}
