import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load.ts';
import type { AknoContext } from '../context.ts';
import { openStore, type Store } from '../store/db.ts';
import {
  assertProfileAutomaticApplyAvailable,
  configWithMaintenanceRecovery,
  maintenanceRecoveryStatus,
  recordMaintenanceRecovery,
  resumeMaintenanceRecovery,
} from './recovery.ts';
import type { DreamRunVerificationReceipt } from './run-verification.ts';

let root: string;
let stateDir: string;
let store: Store;
let ctx: AknoContext;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-recovery-state-'));
  const config = loadConfig({
    aknoPath: root,
    stateDir,
    isolated: true,
    env: {},
    overrides: {
      maintenance: {
        profile: 'autonomous',
        policies: { merge: 'auto', hygiene: 'auto' },
      },
    },
  });
  store = openStore({ dbPath: config.dbPath, embeddingDimensions: 8 });
  ctx = { config, store, writable: true } as AknoContext;
});

afterEach(() => {
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('persistent maintenance recovery', () => {
  it('counts each rolled-back item once and pauses only its transformation at three', () => {
    const planId = insertPlan('pln_vulpine_rollbacks');
    for (let index = 1; index <= 3; index++) {
      insertItem(planId, `itm_vulpine_${index}`, 'merge', 'verification_failed', 'rolled_back', index);
    }

    const first = recordMaintenanceRecovery(ctx, {
      runId: 'run_vulpine_first',
      mode: 'auto',
      planIds: [planId],
      verification: null,
    });
    expect(first).toMatchObject({
      automaticApply: 'partially_paused',
      profile: null,
      transforms: [
        {
          transform: 'merge',
          consecutiveFailures: 3,
          pausedAt: expect.any(String),
          recoveryCommand: 'akno dream resume --transform merge',
        },
      ],
    });

    const repeated = recordMaintenanceRecovery(ctx, {
      runId: 'run_vulpine_repeated',
      mode: 'auto',
      planIds: [planId],
      verification: null,
    });
    expect(repeated.transforms[0]?.consecutiveFailures).toBe(3);
    const effective = configWithMaintenanceRecovery(ctx.config, repeated, 'auto');
    expect(effective.maintenance.policies.merge).toBe('off');
    expect(effective.maintenance.policies.hygiene).toBe('auto');

    const resumed = resumeMaintenanceRecovery(ctx, { transform: 'merge' });
    expect(resumed).toEqual({ automaticApply: 'available', profile: null, transforms: [] });
  });

  it('clears an unpaused rollback streak after a verified success', () => {
    const failedPlan = insertPlan('pln_vulpine_failed');
    insertItem(failedPlan, 'itm_vulpine_failed', 'hygiene', 'verification_failed', 'rolled_back', 1);
    expect(
      recordMaintenanceRecovery(ctx, {
        runId: 'run_vulpine_failed',
        mode: 'auto',
        planIds: [failedPlan],
        verification: null,
      }).transforms[0],
    ).toMatchObject({ transform: 'hygiene', consecutiveFailures: 1, pausedAt: null });

    const passedPlan = insertPlan('pln_vulpine_passed');
    insertItem(passedPlan, 'itm_vulpine_passed', 'hygiene', 'applied', 'passed', 1);
    expect(
      recordMaintenanceRecovery(ctx, {
        runId: 'run_vulpine_passed',
        mode: 'auto',
        planIds: [passedPlan],
        verification: null,
      }),
    ).toEqual({ automaticApply: 'available', profile: null, transforms: [] });
  });

  it('pauses the profile when journaled state cannot be proven and requires explicit resume', () => {
    const status = recordMaintenanceRecovery(ctx, {
      runId: 'run_vulpine_unproven',
      mode: 'auto',
      planIds: [],
      verification: verificationWith('missing_change_id'),
    });

    expect(status).toMatchObject({
      automaticApply: 'paused',
      profile: {
        reason: 'journal_receipt_missing',
        pausedAt: expect.any(String),
        recoveryCommand: 'akno dream resume --profile',
      },
    });
    expect(() => assertProfileAutomaticApplyAvailable(status, 'auto')).toThrowError(
      expect.objectContaining({ code: 'conflict' }),
    );
    expect(() => assertProfileAutomaticApplyAvailable(status, 'review')).not.toThrow();
    expect(maintenanceRecoveryStatus(ctx)).toEqual(status);
    expect(
      recordMaintenanceRecovery(ctx, {
        runId: 'run_vulpine_unproven',
        mode: 'auto',
        planIds: [],
        verification: verificationWith('missing_change_id'),
      }).profile?.consecutiveFailures,
    ).toBe(1);
    expect(resumeMaintenanceRecovery(ctx, { profile: true })).toEqual({
      automaticApply: 'available',
      profile: null,
      transforms: [],
    });
  });
});

function insertPlan(id: string): string {
  const now = '2031-04-05T12:00:00.000Z';
  store.db
    .prepare(
      `INSERT INTO maintenance_plans
        (id, created_at, updated_at, mode, phase, status, fingerprint, summary)
       VALUES (?, ?, ?, 'auto', 'curate', 'failed', ?, 'Invented recovery plan')`,
    )
    .run(id, now, now, `fingerprint-${id}`);
  return id;
}

function insertItem(
  planId: string,
  id: string,
  kind: 'hygiene' | 'merge',
  status: 'applied' | 'verification_failed',
  verification: 'passed' | 'rolled_back',
  order: number,
): void {
  const now = '2031-04-05T12:00:00.000Z';
  store.db
    .prepare(
      `INSERT INTO maintenance_items
        (id, plan_id, ord, kind, risk, status, subject, rationale, input_hash,
         operations, verification, updated_at, policy)
       VALUES (?, ?, ?, ?, 'low', ?, 'people/ada-marlow', 'Invented recovery fixture', ?,
               '[]', ?, ?, 'auto')`,
    )
    .run(
      id,
      planId,
      order,
      kind,
      status,
      `input-${id}`,
      JSON.stringify({ status: verification, detail: 'Invented verification outcome.', at: now }),
      now,
    );
}

function verificationWith(
  code: DreamRunVerificationReceipt['issues'][number]['code'],
): DreamRunVerificationReceipt {
  return {
    status: 'failed',
    checkedAt: '2031-04-05T12:00:00.000Z',
    plans: 1,
    appliedItems: 1,
    affectedFiles: 1,
    unattributedFiles: 0,
    checks: {
      appliedItems: 'failed',
      affectedPaths: 'passed',
      wholeSnapshot: 'passed',
      budget: 'passed',
      modelUsage: 'passed',
    },
    issues: [{ code, count: 1 }],
  };
}
