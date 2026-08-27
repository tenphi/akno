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

    const released = barrier.release().then(() => events.push('release completed'));
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
    await expect(firstRelease).resolves.toBeUndefined();
    await expect(first.release()).resolves.toBeUndefined();

    const second = await coordinator.acquire();
    await expect(coordinator.acquire()).rejects.toThrow('already active');
    await second.release();
  });
});
