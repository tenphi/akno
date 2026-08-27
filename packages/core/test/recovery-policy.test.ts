import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let root: string;
let stateDir: string;
let mem: Akno;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-policy-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-policy-state-'));
  fs.writeFileSync(path.join(root, 'notes.md'), '# Invented notes\n', 'utf8');
  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
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
      maintenance: { profile: 'autonomous' },
    },
  });
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  await mem?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('automatic recovery policy', () => {
  it('fails auto before planning while leaving audit inspection available', async () => {
    const now = '2031-04-05T12:00:00.000Z';
    const database = new Database(mem.config.dbPath);
    database
      .prepare(
        `INSERT INTO maintenance_recovery_state
          (scope_key, scope, transform, reason_code, consecutive_failures, paused_at,
           last_failure_at, last_run_id, updated_at)
         VALUES ('profile', 'profile', NULL, 'verification_unproven', 1, ?, ?,
                 'run_vulpine_unproven', ?)`,
      )
      .run(now, now, now);
    database.close();

    await expect(mem.dream()).rejects.toMatchObject({
      code: 'conflict',
      details: { maintenance_pause: 'profile', reason: 'verification_unproven' },
    });
    expect(mem.maintenanceStatus()).toMatchObject({
      recovery: {
        automaticApply: 'paused',
        profile: { recoveryCommand: 'akno dream resume --profile' },
      },
      latestRun: { status: 'failed', errorCode: 'conflict' },
    });

    const audit = await mem.dream({ phase: 'housekeeping', mode: 'audit' });
    expect(audit.run.status).toBe('completed');
    expect(mem.maintenanceStatus().recovery.automaticApply).toBe('paused');
    expect(mem.resumeMaintenance({ profile: true }).automaticApply).toBe('available');
  });
});
