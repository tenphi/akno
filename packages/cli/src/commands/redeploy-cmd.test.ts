import { describe, expect, it } from 'vitest';
import {
  launchdServiceIsRunning,
  redeployPlan,
  redeployWaitPolicy,
  socketWasReplaced,
} from './redeploy-cmd.ts';

/**
 * `redeploy` shells out twice and its interesting part is neither call — it is the decision about
 * whether to make them. Every row here is a way a deploy reports success without having deployed.
 */
const plan = (over: Partial<Parameters<typeof redeployPlan>[0]> = {}) =>
  redeployPlan({ build: true, restart: true, darwin: true, serviceInstalled: true, ...over });

describe('what a redeploy decides to do', () => {
  it('builds and restarts, given a service and a Mac', () => {
    expect(plan()).toEqual({ build: true, restart: true, skipped: null });
  });

  it('restarts without building when asked', () => {
    expect(plan({ build: false })).toEqual({ build: false, restart: true, skipped: null });
  });

  it('says why it did not restart, rather than reporting a plain success', () => {
    // Each of these is a legitimate outcome and none of them is a deploy. A caller that cannot tell
    // "restarted" from "did not restart" will go on to test the old code and trust the result.
    expect(plan({ restart: false }).skipped).toBe('asked');
    expect(plan({ darwin: false }).skipped).toBe('not-darwin');
    expect(plan({ serviceInstalled: false }).skipped).toBe('no-service');
  });

  it('treats a missing service as nothing to do, not as a failure', () => {
    // A checkout that talks to Akno in-process has no launchd agent, and a `launchctl` error
    // about an unfamiliar label is not an improvement on saying so. The build still happened.
    expect(plan({ serviceInstalled: false })).toEqual({ build: true, restart: false, skipped: 'no-service' });
  });

  it('honours an explicit --no-restart even where a service exists', () => {
    expect(plan({ restart: false, serviceInstalled: true }).restart).toBe(false);
  });

  it('does not silently drop the build when the restart cannot happen', () => {
    // The two steps are for different consumers: the build is what a host importing
    // `@tenphi/akno-client` reads, and it is worth doing even where there is no service to bounce.
    for (const over of [{ restart: false }, { darwin: false }, { serviceInstalled: false }]) {
      expect(plan(over).build).toBe(true);
    }
  });
});

describe('redeploy readiness', () => {
  it('keeps the normal thirty-second fast path but allows a bounded live-handoff wait', () => {
    expect(redeployWaitPolicy()).toEqual({ fastMs: 30_000, maximumMs: 180_000 });
  });

  it('treats an explicit timeout as a hard deadline', () => {
    expect(redeployWaitPolicy('7.5')).toEqual({ fastMs: 7_500, maximumMs: 7_500 });
    expect(() => redeployWaitPolicy('not-a-duration')).toThrow(/positive number/);
  });

  it('extends only for a launchd job with a live replacement pid', () => {
    expect(launchdServiceIsRunning(`gui/501/dev.akno = {\n\tstate = running\n\tpid = 4242\n}`)).toBe(true);
    expect(launchdServiceIsRunning(`gui/501/dev.akno = {\n\tstate = waiting\n}`)).toBe(false);
    expect(launchdServiceIsRunning(`gui/501/dev.akno = {\n\tstate = running\n}`)).toBe(false);
  });

  it('does not mistake the pre-restart socket for replacement readiness', () => {
    const previous = { device: 11, inode: 22, changedAtMs: 33 };
    expect(socketWasReplaced(previous, previous)).toBe(false);
    expect(socketWasReplaced(previous, { ...previous, inode: 44 })).toBe(true);
    expect(socketWasReplaced(null, previous)).toBe(true);
    expect(socketWasReplaced(previous, null)).toBe(false);
  });
});
