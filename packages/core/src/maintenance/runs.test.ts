import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import type { AknoContext } from '../context.ts';
import { openStore } from '../store/db.ts';
import {
  activeDreamRuns,
  beginDreamRun,
  failDreamRun,
  latestDreamRun,
  recoverInterruptedDreamRuns,
} from './runs.ts';

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

  it('refuses a concurrent invocation with the active run identity', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-busy-kb-'));
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-busy-state-'));
    const config = loadConfig({ aknoPath: root, stateDir, isolated: true, env: {} });
    const store = openStore({ dbPath: config.dbPath, embeddingDimensions: 8 });
    const ctx = { config, store, writable: true } as AknoContext;
    const started = beginDreamRun(ctx, {
      requestedPhase: 'housekeeping',
      requestedPhases: ['housekeeping'],
      mode: 'legacy',
      dryRun: false,
      modelId: null,
    });

    try {
      let error: unknown;
      try {
        beginDreamRun(ctx, {
          requestedPhase: 'curate',
          requestedPhases: ['curate'],
          mode: 'auto',
          dryRun: false,
          modelId: 'zephyr-model',
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(AknoError);
      expect(error).toMatchObject({
        code: 'busy',
        details: { run_id: started.id, started_at: started.startedAt },
      });
      expect(activeDreamRuns(ctx)).toBe(1);
    } finally {
      failDreamRun(ctx, started, new AknoError('interrupted', 'Invented test cleanup.'), 1, []);
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it('finalizes an abandoned predecessor before allowing the next run', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-kb-'));
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-state-'));
    const config = loadConfig({ aknoPath: root, stateDir, isolated: true, env: {} });
    const store = openStore({ dbPath: config.dbPath, embeddingDimensions: 8 });
    const ctx = { config, store, writable: true } as AknoContext;
    const abandoned = beginDreamRun(ctx, {
      requestedPhase: 'curate',
      requestedPhases: ['curate'],
      mode: 'auto',
      dryRun: false,
      modelId: 'zephyr-model',
    });

    try {
      // Finish once to release this process's ownership, then restore the durable start record.
      // That is the exact state a new process observes after its predecessor disappears.
      failDreamRun(ctx, abandoned, new AknoError('internal', 'Invented predecessor exit.'), 1, []);
      store.db
        .prepare(
          `UPDATE maintenance_runs
              SET finished_at = NULL, status = 'running', receipt = ?, error_code = NULL
            WHERE id = ?`,
        )
        .run(JSON.stringify(abandoned), abandoned.id);

      const recovered = recoverInterruptedDreamRuns(ctx);
      expect(recovered).toHaveLength(1);
      expect(recovered[0]).toMatchObject({
        id: abandoned.id,
        status: 'failed',
        errorCode: 'interrupted',
      });
      expect(recovered[0]!.finishedAt).not.toBeNull();
      expect(activeDreamRuns(ctx)).toBe(0);
      expect(latestDreamRun(ctx)).toEqual(recovered[0]);

      const next = beginDreamRun(ctx, {
        requestedPhase: 'housekeeping',
        requestedPhases: ['housekeeping'],
        mode: 'legacy',
        dryRun: false,
        modelId: null,
      });
      expect(next.id).not.toBe(abandoned.id);
      failDreamRun(ctx, next, new AknoError('interrupted', 'Invented test cleanup.'), 1, []);
    } finally {
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
