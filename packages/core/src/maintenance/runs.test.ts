import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import type { AknoContext } from '../context.ts';
import { openStore } from '../store/db.ts';
import { activeDreamRuns, beginDreamRun, failDreamRun, latestDreamRun } from './runs.ts';

describe('durable dream runs', () => {
  it('records a typed failure without storing its private message', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-run-kb-'));
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-run-state-'));
    const config = loadConfig({ aknoPath: root, stateDir, isolated: true, env: {} });
    const store = openStore({ dbPath: config.dbPath, embeddingDimensions: 8 });
    const ctx = { config, store, writable: true } as AknoContext;

    try {
      const started = beginDreamRun(ctx, {
        requestedPhase: 'housekeeping',
        requestedPhases: ['housekeeping'],
        mode: 'legacy',
        dryRun: false,
        modelId: null,
      });
      expect(activeDreamRuns(ctx)).toBe(1);

      const finished = failDreamRun(
        ctx,
        started,
        new AknoError('unavailable', 'Private Vulpine Mutual details must not be retained.'),
        111,
        [{ phase: 'housekeeping', ran: false, skipped: 'private failure detail', durationMs: 11 }],
      );

      expect(activeDreamRuns(ctx)).toBe(0);
      expect(finished).toMatchObject({ status: 'failed', errorCode: 'unavailable', durationMs: 111 });
      const stored = latestDreamRun(ctx)!;
      expect(stored).toEqual(finished);
      expect(JSON.stringify(stored)).not.toContain('Vulpine Mutual');
      expect(JSON.stringify(stored)).not.toContain('private failure detail');
    } finally {
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
