import { describe, expect, it } from 'vitest';
import { IndexRevisionCoordinator } from './revision-barrier.ts';

describe('index revision coordinator', () => {
  it('waits for earlier work, holds later work, and drains it before release completes', async () => {
    const coordinator = new IndexRevisionCoordinator();
    const events: string[] = [];
    let finishEarlier: (() => void) | null = null;

    const earlier = coordinator.run(
      () =>
        new Promise<string>((resolve) => {
          events.push('earlier started');
          finishEarlier = () => resolve('earlier result');
        }),
    );
    let barrierAcquired = false;
    const acquiring = coordinator.acquire().then((barrier) => {
      barrierAcquired = true;
      events.push('barrier acquired');
      return barrier;
    });
    const later = coordinator.run(async () => {
      events.push('later ran');
      return 'later result';
    });

    await Promise.resolve();
    expect(barrierAcquired).toBe(false);
    expect(events).toEqual(['earlier started']);

    finishEarlier!();
    expect(await earlier).toBe('earlier result');
    const barrier = await acquiring;
    await Promise.resolve();
    expect(events).toEqual(['earlier started', 'barrier acquired']);

    const released = barrier.release().then((result) => {
      expect(result.invalidated).toBe(false);
      events.push('release completed');
      return result;
    });
    expect(await later).toBe('later result');
    await released;
    expect(events).toEqual(['earlier started', 'barrier acquired', 'later ran', 'release completed']);
  });

  it('releases idempotently and allows a later barrier after queued work fails', async () => {
    const coordinator = new IndexRevisionCoordinator();
    const first = await coordinator.acquire();
    const failed = coordinator.run(() => Promise.reject(new Error('invented indexing failure')));
    const firstRelease = first.release();

    await expect(failed).rejects.toThrow('invented indexing failure');
    await expect(firstRelease).resolves.toEqual({ invalidated: false });
    await expect(first.release()).resolves.toEqual({ invalidated: false });

    const second = await coordinator.acquire();
    await expect(coordinator.acquire()).rejects.toThrow('already active');
    await second.release();
  });

  it('runs foreground work before a planner that is still waiting for its revision', async () => {
    const coordinator = new IndexRevisionCoordinator();
    const events: string[] = [];
    let finishEarlier: (() => void) | null = null;
    const earlier = coordinator.run(
      () =>
        new Promise<void>((resolve) => {
          events.push('earlier');
          finishEarlier = resolve;
        }),
    );
    const acquiring = coordinator.acquire().then((barrier) => {
      events.push('barrier');
      return barrier;
    });
    const foreground = coordinator.runForeground(async () => {
      events.push('foreground');
    });

    await Promise.resolve();
    finishEarlier!();
    await earlier;
    await foreground;
    const barrier = await acquiring;

    expect(events).toEqual(['earlier', 'foreground', 'barrier']);
    expect(barrier.invalidated).toBe(false);
    await expect(barrier.release()).resolves.toEqual({ invalidated: false });
  });

  it('lets foreground work preempt and invalidate an acquired planner barrier', async () => {
    const coordinator = new IndexRevisionCoordinator();
    const barrier = await coordinator.acquire();
    const events: string[] = [];
    const background = coordinator.run(async () => {
      events.push('background');
    });
    const foreground = coordinator.runForeground(async () => {
      events.push('foreground');
      return 'indexed';
    });

    await expect(foreground).resolves.toBe('indexed');
    expect(barrier.invalidated).toBe(true);
    expect(events[0]).toBe('foreground');
    await expect(barrier.release()).resolves.toEqual({ invalidated: true });
    await background;
  });

  it('invalidates an acquired barrier for a foreground mutation without index work', async () => {
    const coordinator = new IndexRevisionCoordinator();
    const barrier = await coordinator.acquire();

    expect(coordinator.invalidateForForeground()).toBe(true);
    expect(barrier.invalidated).toBe(true);
    await expect(barrier.release()).resolves.toEqual({ invalidated: true });
    expect(coordinator.invalidateForForeground()).toBe(false);
  });
});
