import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { open, type Akno } from '@tenphi/akno-core';
import { indexCommand } from './index-cmd.ts';

const DURABLE_TABLES = [
  'changes',
  'change_files',
  'proposals',
  'maintenance_plans',
  'maintenance_items',
  'maintenance_item_revisions',
  'maintenance_runs',
  'maintenance_action_receipts',
  'maintenance_recovery_state',
  'retain_receipts',
  'retain_supports',
] as const;

let root: string;
let stateDir: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-index-command-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-index-command-state-'));
  fs.writeFileSync(path.join(root, 'notes.md'), '# Invented notes\n\n- Warranty: five years\n', 'utf8');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('index --rebuild', () => {
  it('preserves durable workflow state through the real CLI path', async () => {
    let mem = await openMemory('agent');
    await mem.index({ structuralOnly: true });
    const change = await mem.write({ slug: 'notes', append: '- Product: Zephyr QX-100' });
    await mem.close();

    const database = new DatabaseSync(path.join(stateDir, 'akno.db'));
    seedDurableState(database, change.change_id!);
    const before = durableState(database);
    database.close();

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await expect(
        indexCommand(['--akno-path', root, '--state-dir', stateDir, '--rebuild', '--structural', '--json']),
      ).resolves.toBe(0);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }

    const afterDatabase = new DatabaseSync(path.join(stateDir, 'akno.db'));
    expect(durableState(afterDatabase)).toEqual(before);
    afterDatabase.close();

    mem = await openMemory('agent');
    expect(mem.maintenanceStatus().recovery.automaticApply).toBe('paused');
    expect(mem.proposals().map((proposal) => proposal.id)).toContain('prop_vulpine');
    await mem.undo({ change_id: change.change_id! });
    expect(fs.readFileSync(path.join(root, 'notes.md'), 'utf8')).not.toContain('Zephyr QX-100');
    expect(mem.resumeMaintenance({ profile: true }).automaticApply).toBe('available');
    await mem.close();
  });
});

async function openMemory(actor: 'user' | 'agent'): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor,
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
  });
}

function seedDurableState(database: DatabaseSync, changeId: string): void {
  const now = '2031-08-05T12:00:00.000Z';
  database
    .prepare(
      `INSERT INTO proposals(id, at, kind, reason, subject, payload, nearest, status)
       VALUES ('prop_vulpine', ?, 'route', 'invented route review', 'notes', '{}', '[]', 'pending')`,
    )
    .run(now);
  database
    .prepare(
      `INSERT INTO maintenance_plans
        (id, created_at, updated_at, mode, phase, status, fingerprint, summary)
       VALUES ('plan_vulpine', ?, ?, 'audit', 'housekeeping', 'proposed',
               'fp_plan_vulpine', 'Invented maintenance plan.')`,
    )
    .run(now, now);
  database
    .prepare(
      `INSERT INTO maintenance_items
        (id, plan_id, ord, kind, risk, status, subject, rationale, input_hash,
         operations, checks, decision_actor, decision_outcome, decision_reason,
         decided_at, change_id, verification, updated_at, evidence, policy, status_code)
       VALUES ('item_vulpine', 'plan_vulpine', 0, 'refine', 'low', 'approved', 'notes',
               'Invented rationale.', 'hash_input_vulpine', '[]', '[]', 'user', 'approved',
               'Invented approval.', ?, ?, '{"status":"passed"}', ?, '[]', 'audit', 'ready')`,
    )
    .run(now, changeId, now);
  database
    .prepare(
      `INSERT INTO maintenance_item_revisions
        (item_id, revision, status, input_hash, operations, checks, decision_actor,
         decision_outcome, decision_reason, status_code, decided_at, revised_at,
         revision_reason, revision_actor)
       VALUES ('item_vulpine', 1, 'approved', 'hash_input_vulpine', '[]', '[]', 'user',
               'approved', 'Invented approval.', 'ready', ?, ?, 'Invented correction.', 'human')`,
    )
    .run(now, now);
  database
    .prepare(
      `INSERT INTO maintenance_runs(id, started_at, finished_at, status, receipt, error_code)
       VALUES ('run_vulpine', ?, ?, 'completed', '{"outcome":"invented"}', NULL)`,
    )
    .run(now, now);
  database
    .prepare(
      `INSERT INTO maintenance_action_receipts
        (idempotency_key, action, request_hash, plan_id, item_id, started_at, completed_at)
       VALUES ('key_vulpine', 'decide', 'hash_request_vulpine', 'plan_vulpine',
               'item_vulpine', ?, ?)`,
    )
    .run(now, now);
  database
    .prepare(
      `INSERT INTO maintenance_recovery_state
        (scope_key, scope, transform, reason_code, consecutive_failures, paused_at,
         last_failure_at, last_run_id, updated_at)
       VALUES ('profile', 'profile', NULL, 'verification_unproven', 1, ?, ?, 'run_vulpine', ?)`,
    )
    .run(now, now, now);
  database
    .prepare(
      `INSERT INTO retain_receipts
        (source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint,
         mode, result, change_id, created_at)
       VALUES ('source_vulpine', 'rev_1', 'hash_retain_request', 'hash_retain_source',
               'group_vulpine', 'receipt_vulpine', 'provided_exact', '{}', ?, ?)`,
    )
    .run(changeId, now);
  database
    .prepare(
      `INSERT INTO retain_supports
        (receipt_fingerprint, candidate_id, candidate_fingerprint, proof_group, memory_id,
         slug, selection, source_ref, origin, input_hash, evidence, evidence_hash)
       VALUES ('receipt_vulpine', 'candidate_vulpine', 'fp_candidate_vulpine',
               'proof_vulpine', 'memory_vulpine', 'notes', 'provided', 'source:vulpine',
               'user', 'hash_support_input', 'Invented exact support.', 'hash_evidence')`,
    )
    .run();
}

function durableState(database: DatabaseSync): Record<string, unknown[]> {
  return Object.fromEntries(
    DURABLE_TABLES.map((table) => [table, database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]),
  );
}
