import { describe, expect, it, vi } from 'vitest';

import { DeferredDerive } from './defer.ts';
import type { Indexer } from './indexer.ts';

/**
 * A write is finished when the Markdown is on disk. Deriving facts from it is a reading of a file
 * that is already correct — and awaiting it put a cold local model, a minute to load, inside every
 * `remember`, past the timeout of the tool that called it.
 */
function fakeIndexer(onRun: (paths: string[]) => Promise<void>): { indexer: Indexer; runs: string[][] } {
  const runs: string[][] = [];
  const indexer = {
    run: async (options: { only?: string[] }) => {
      runs.push(options.only ?? []);
      await onRun(options.only ?? []);
      return {} as never;
    },
  } as unknown as Indexer;
  return { indexer, runs };
}

describe('deriving after the answer has gone out', () => {
  it('returns before the derivation runs', async () => {
    let released: (() => void) | undefined;
    const { indexer, runs } = fakeIndexer(() => new Promise<void>((resolve) => (released = resolve)));
    const derive = new DeferredDerive(indexer, () => {});

    derive.schedule(['a.md']);
    // The caller is already gone by here; the pass is still going.
    expect(runs).toEqual([['a.md']]);

    released!();
    await derive.flush();
  });

  it('folds work queued mid-pass into the next one rather than starting a second', async () => {
    // Two derivers on one page is two model calls for one answer — two minutes, on a model that
    // loads cold.
    let released: (() => void) | undefined;
    let first = true;
    const { indexer, runs } = fakeIndexer(() => {
      if (!first) return Promise.resolve();
      first = false;
      return new Promise<void>((resolve) => (released = resolve));
    });
    const derive = new DeferredDerive(indexer, () => {});

    derive.schedule(['a.md']);
    derive.schedule(['b.md']);
    derive.schedule(['c.md']);
    expect(runs).toHaveLength(1);

    released!();
    await derive.flush();
    expect(runs).toEqual([['a.md'], ['b.md', 'c.md']]);
  });

  it('reports a failed derivation instead of throwing at nobody', async () => {
    // It runs after the caller has returned, so an unhandled rejection here would take the process
    // down for a lost summary.
    const onError = vi.fn();
    const { indexer } = fakeIndexer(() => Promise.reject(new Error('the deriver is unavailable')));
    const derive = new DeferredDerive(indexer, onError);

    derive.schedule(['a.md']);
    await derive.flush();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('flush waits for everything, including what was queued while draining', async () => {
    const { indexer, runs } = fakeIndexer(async () => {});
    const derive = new DeferredDerive(indexer, () => {});
    derive.schedule(['a.md']);
    await derive.flush();
    expect(runs.flat()).toEqual(['a.md']);
  });
});
