import { describe, expect, it } from 'vitest';
import { redeployPlan } from './redeploy-cmd.ts';

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
    // `@akno/client` reads, and it is worth doing even where there is no service to bounce.
    for (const over of [{ restart: false }, { darwin: false }, { serviceInstalled: false }]) {
      expect(plan(over).build).toBe(true);
    }
  });
});
