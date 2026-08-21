import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { open } from '../src/index.ts';

describe('dream restart recovery', () => {
  it('finalizes an abandoned run as soon as the next writer opens', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-restart-kb-'));
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-restart-state-'));
    const options = {
      aknoPath: root,
      stateDir,
      isolated: true,
      env: {},
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: {},
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { id: null },
          expansion: { id: null },
        },
      },
    } as const;

    let mem: Awaited<ReturnType<typeof open>> | null = await open(options);
    try {
      const completed = await mem.dream({ phase: 'housekeeping' });
      const dbPath = mem.config.dbPath;
      await mem.close();
      mem = null;

      // Recreate the durable state left by a process exit after begin but before finalization.
      const abandoned = {
        ...completed.run,
        finishedAt: null,
        status: 'running',
        phases: [],
        durationMs: null,
        errorCode: null,
      };
      const db = new Database(dbPath);
      db.prepare(
        `UPDATE maintenance_runs
            SET finished_at = NULL, status = 'running', receipt = ?, error_code = NULL
          WHERE id = ?`,
      ).run(JSON.stringify(abandoned), abandoned.id);
      db.close();

      mem = await open(options);
      expect(mem.maintenanceStatus()).toMatchObject({
        activeRuns: 0,
        latestRun: {
          id: completed.run.id,
          status: 'failed',
          errorCode: 'interrupted',
        },
      });
    } finally {
      await mem?.close();
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
