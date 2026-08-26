import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  open,
  type Akno,
  type MaintenanceMode,
  type MaintenancePolicy,
  type MaintenanceProfile,
  type MaintenanceTransform,
} from '../src/index.ts';
import { linkIssuesForTesting } from '../src/maintenance/curate.ts';

let root: string;
let stateDir: string;
let mem: Akno;
let server: {
  url: string;
  close: () => Promise<void>;
  calls: () => number;
  curatorCalls: () => number;
  loseMarker: (value: boolean) => void;
  changeNumber: (value: boolean) => void;
  echoDraft: (value: boolean) => void;
  exactDraft: (value: boolean) => void;
  synthesisDraft: (value: boolean) => void;
  crossPageDraft: (value: boolean) => void;
  cosmeticDraft: (value: boolean) => void;
  splitDraft: (value: boolean) => void;
  extractDraft: (value: boolean) => void;
  mergeDraft: (value: boolean) => void;
  lossyMergeDraft: (value: boolean) => void;
  invalidExtractionHeading: (value: boolean) => void;
  invalidExtractionTarget: (value: boolean) => void;
  userMessages: () => string[];
};

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-curate-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-curate-state-'));
  server = await startStub();
  fs.mkdirSync(path.join(root, 'people'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'people/ada-marlow.md'),
    `---
title: Ada Marlow
akno:
  management:
    dream: hygiene
---

# Ada Marlow

## Details

<!-- akno:item itm_ada source=conversation origin=user -->
Ada Marlow lives at 111 Example Street.
`,
  );
  mem = await openMem(false);
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  await mem?.close();
  await server?.close();
  for (const directory of [root, stateDir]) fs.rmSync(directory, { recursive: true, force: true });
});

describe('curate', () => {
  it('uses a draft and verifier but keeps scheduled writes in preview mode', async () => {
    const before = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated).toMatchObject([
      { slug: 'people/ada-marlow', mode: 'hygiene', action: 'would-update', issues: [] },
    ]);
    expect(server.calls()).toBe(2);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);
    expect(report.curateChangeId).toBeNull();
    const logged = JSON.parse(fs.readFileSync(report.logPath!, 'utf8').trim()) as {
      curated: { slug: string; action: string }[];
    };
    expect(logged.curated).toMatchObject([{ slug: 'people/ada-marlow', action: 'would-update' }]);

    const unchangedInputs = await mem.dream({ phase: 'curate' });
    expect(unchangedInputs.maintenancePlan?.id).toBe(report.maintenancePlan?.id);
    expect(unchangedInputs.curated).toHaveLength(1);
    expect(server.calls()).toBe(2);
  });

  it('rejects a draft that loses a stable item before asking the verifier', async () => {
    server.loseMarker(true);
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues.join(' ')).toMatch(/stable item markers/);
    expect(server.calls()).toBe(1);

    const unchangedInputs = await mem.dream({ phase: 'curate' });
    expect(unchangedInputs.curated).toEqual([]);
    expect(server.calls()).toBe(1);
  });

  it('logs a missing value with its source context', async () => {
    server.changeNumber(true);
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues).toContain('numeric/date/value tokens missing from rewrite: "111"');
    expect(report.curated[0]?.issues.join('\n')).toContain('Ada Marlow lives at 111 Example Street.');
    expect(server.calls()).toBe(1);
  });

  it('reconsiders hygiene after body or frontmatter changes', async () => {
    const initial = await mem.dream({ phase: 'curate' });
    expect(server.calls()).toBe(2);
    mem.decidePlan(
      initial.maintenancePlan!.id,
      initial.maintenancePlan!.items[0]!.id,
      'reject',
      'Fixture reset.',
    );

    fs.appendFileSync(path.join(root, 'people/ada-marlow.md'), '\nA short personal note.\n');
    await mem.index({ structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated).toHaveLength(1);
    expect(report.curated[0]?.slug).toBe('people/ada-marlow');
    expect(server.calls()).toBe(4);
    mem.decidePlan(
      report.maintenancePlan!.id,
      report.maintenancePlan!.items[0]!.id,
      'reject',
      'Fixture reset.',
    );

    const page = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('title: Ada Marlow', 'title: Ada profile'));
    await mem.index({ structuralOnly: true });
    expect((await mem.dream({ phase: 'curate' })).curated).toHaveLength(1);
    expect(server.calls()).toBe(6);
  });

  it('reconsiders synthesis when linked evidence changes', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    const evidence = path.join(root, 'evidence/ada-interview.md');
    fs.writeFileSync(
      evidence,
      `---
title: Ada interview
akno:
  role: source
  about:
    - people/ada-marlow
---

Ada described her work. [[people/ada-marlow]]
`,
    );
    await mem.index({ structuralOnly: true });

    const initial = await mem.dream({ phase: 'curate' });
    expect(server.calls()).toBe(1);
    expect(initial.maintenancePlan).toBeNull();
    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);

    fs.appendFileSync(evidence, '\nShe later added another detail.\n');
    await mem.index({ structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated).toHaveLength(1);
    expect(report.curated[0]?.mode).toBe('synthesize');
    expect(server.calls()).toBe(2);
  });

  it('reconsiders an accepted preview once when writes are enabled', async () => {
    await mem.dream({ phase: 'curate' });
    expect(server.calls()).toBe(2);
    await mem.close();
    mem = await openMem(true);

    const applied = await mem.dream({ phase: 'curate' });
    expect(applied.curated[0]?.action).toBe('updated');
    expect(applied.curateChangeId).toBeNull();
    expect(applied.maintenancePlan?.items[0]?.changeId).not.toBeNull();
    const callsAfterApply = server.calls();

    const current = await mem.dream({ phase: 'curate' });
    expect(current.curated).toEqual([]);
    expect(server.calls()).toBe(callsAfterApply);
  });

  it('marks a bounded event, archives it once, and ignores weak later link churn', async () => {
    const eventSlug = 'events/2001-04-10-12-blackwater-bay';
    fs.mkdirSync(path.join(root, 'events'), { recursive: true });
    fs.mkdirSync(path.join(root, 'guides'), { recursive: true });
    fs.writeFileSync(
      path.join(root, `${eventSlug}.md`),
      `---
title: Blackwater Bay gathering
akno:
  management:
    dream: synthesize
---

# Blackwater Bay gathering

The trip was planned for April 10–12, 2001. [[guides/blackwater-bay]]
`,
    );
    fs.writeFileSync(
      path.join(root, 'guides/blackwater-bay.md'),
      '# Blackwater Bay guide\n\nBring a coat.\n',
    );
    server.echoDraft(true);
    await mem.close();
    mem = await openMem(true);
    await mem.index({ structuralOnly: true });

    const first = await mem.dream({ phase: 'curate' });
    const marked = first.curated.find((entry) => entry.slug === eventSlug);
    expect(marked).toMatchObject({
      action: 'updated',
      temporal: { source: 'inferred', state: 'past', until: '2001-04-12', archival: true },
    });
    const markedBody = fs.readFileSync(path.join(root, `${eventSlug}.md`), 'utf8');
    expect(markedBody).toContain('until: "2001-04-12"');
    expect(markedBody).toContain('---\n\n# Blackwater Bay gathering');
    expect(server.userMessages().some((message) => message.includes('Temporal state: past'))).toBe(true);

    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);

    fs.appendFileSync(path.join(root, 'guides/blackwater-bay.md'), '\nThe ferry terminal moved.\n');
    await mem.index({ structuralOnly: true });
    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);

    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'evidence/harbor-diary.md'),
      `---
title: Harbor diary
akno:
  role: source
  about:
    - ${eventSlug}
---

The gathering ended with a confirmed ferry ride.
`,
    );
    await mem.index({ structuralOnly: true });
    const reconsidered = await mem.dream({ phase: 'curate' });
    expect(reconsidered.curated.find((entry) => entry.slug === eventSlug)).toMatchObject({
      action: 'unchanged',
      temporal: { source: 'declared', state: 'past', archival: true },
    });
  });
});

describe('plan-backed hygiene', () => {
  beforeEach(async () => {
    await mem.close();
    mem = await openMem(false, undefined, { profile: 'autonomous' });
    await mem.index({ structuralOnly: true });
  });

  it('persists an audit plan without changing the knowledge base', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');

    const report = await mem.dream({ phase: 'curate', mode: 'audit' });
    const plan = report.maintenancePlan!;

    expect(plan).toMatchObject({ mode: 'audit', phase: 'curate', status: 'ready' });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ status: 'proposed', subject: 'people/ada-marlow' });
    expect(report.autoEstimate).toMatchObject({
      status: 'estimated',
      scope: 'initial_curator_pass',
      modelId: 'stub',
      modelConfigured: true,
      curatorCalls: 1,
      maximumOutputTokens: 600,
      method: 'characters_div_4',
      postApplyRetryIncluded: false,
    });
    expect(report.autoEstimate?.estimatedPromptTokens).toBeGreaterThan(0);
    expect(report.run.autoEstimate).toEqual(report.autoEstimate);
    expect(mem.maintenanceStatus({ runId: report.run.id }).runs[0]?.autoEstimate).toEqual(
      report.autoEstimate,
    );
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(mem.maintenanceDiff(plan.id)).toContain('--- a/people/ada-marlow.md');

    const callsAfterPlanning = server.calls();
    const repeated = await mem.dream({ phase: 'curate', mode: 'audit' });
    expect(repeated.maintenancePlan?.id).toBe(plan.id);
    expect(server.calls()).toBe(callsAfterPlanning);

    await mem.close();
    mem = await openMem(false);
    expect(mem.plan(plan.id)).toMatchObject({ id: plan.id, status: 'ready' });
    expect(mem.maintenanceStatus()).toMatchObject({ active: 1, awaitingHuman: 0, budgetDeferred: 0 });
    expect(mem.maintenanceStatus({ pending: true }).pendingPlans).toEqual([
      expect.objectContaining({ id: plan.id, status: 'ready' }),
    ]);
  });

  it('filters the plan queue and safely supersedes unapplied work', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;

    expect(mem.plans(20, ['awaiting_review'])).toEqual([
      expect.objectContaining({ id: planned.id, status: 'awaiting_review' }),
    ]);
    expect(mem.plans(20, ['ready'])).toEqual([]);

    mem.decidePlan(planned.id, planned.items[0]!.id, 'approve', 'The exact hygiene diff is safe.');
    const superseded = mem.supersedePlan(planned.id, '  A newer invented review\nreplaced this plan.  ');

    expect(superseded).toMatchObject({
      id: planned.id,
      status: 'superseded',
      error: 'Superseded by user: A newer invented review replaced this plan.',
    });
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(mem.plans(20, ['awaiting_review', 'approved'])).toEqual([]);
    expect(mem.plans(20, ['superseded'])).toEqual([
      expect.objectContaining({ id: planned.id, status: 'superseded' }),
    ]);
    expect(mem.maintenanceStatus({ pending: true })).toMatchObject({
      active: 0,
      awaitingHuman: 0,
      pendingPlans: [],
    });
    expect(mem.supersedePlan(planned.id, 'A later reason is ignored.').error).toBe(superseded.error);
    expect(() =>
      mem.decidePlan(planned.id, planned.items[0]!.id, 'reject', 'This must stay retired.'),
    ).toThrow(/superseded/);
    await expect(mem.applyPlan(planned.id)).rejects.toThrow(/superseded/);
  });

  it('prunes terminal plan payloads before their compact receipts and never touches active work', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const databasePath = path.join(stateDir, 'akno.db');
    const oldReceipt = new Date(Date.now() - 181 * 86_400_000).toISOString();
    const oldPayload = new Date(Date.now() - 31 * 86_400_000).toISOString();

    let db = new Database(databasePath);
    db.prepare('UPDATE maintenance_plans SET updated_at = ? WHERE id = ?').run(oldReceipt, planned.id);
    db.close();
    expect(mem.prunePlans()).toMatchObject({
      applied: false,
      payloads: { plans: 0, items: 0, privateBytes: 0 },
      receipts: { plans: 0, items: 0 },
    });

    mem.supersedePlan(planned.id, 'A newer invented review replaced this plan.');
    db = new Database(databasePath);
    db.prepare('UPDATE maintenance_plans SET updated_at = ? WHERE id = ?').run(oldPayload, planned.id);
    db.close();

    const preview = mem.prunePlans();
    expect(preview).toMatchObject({
      applied: false,
      retention: { payloadDays: 30, receiptDays: 180 },
      payloads: { plans: 1, items: 1 },
      receipts: { plans: 0, items: 0 },
    });
    expect(preview.payloads.privateBytes).toBeGreaterThan(0);

    const pruned = mem.prunePlans({ apply: true });
    expect(pruned).toMatchObject({ applied: true, payloads: { plans: 1, items: 1 } });
    expect(mem.plan(planned.id)).toMatchObject({
      status: 'superseded',
      payloadPrunedAt: expect.any(String),
      items: [expect.objectContaining({ operations: [], evidence: [] })],
    });
    expect(() => mem.maintenanceDiff(planned.id)).toThrow(/private payload.*pruned/);
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(mem.prunePlans()).toMatchObject({
      payloads: { plans: 0, items: 0, privateBytes: 0 },
      receipts: { plans: 0, items: 0 },
    });

    db = new Database(databasePath);
    db.prepare('UPDATE maintenance_plans SET updated_at = ? WHERE id = ?').run(oldReceipt, planned.id);
    db.close();
    expect(mem.prunePlans()).toMatchObject({ receipts: { plans: 1, items: 1 } });
    expect(mem.prunePlans({ apply: true })).toMatchObject({
      applied: true,
      receipts: { plans: 1, items: 1 },
    });
    expect(() => mem.plan(planned.id)).toThrow(/no maintenance plan/);
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
  });

  it('retains failed plans that still carry verification recovery state', async () => {
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const oldReceipt = new Date(Date.now() - 181 * 86_400_000).toISOString();
    const db = new Database(path.join(stateDir, 'akno.db'));
    db.prepare("UPDATE maintenance_plans SET status = 'failed', updated_at = ? WHERE id = ?").run(
      oldReceipt,
      planned.id,
    );
    db.prepare(
      "UPDATE maintenance_items SET status = 'verification_failed', updated_at = ? WHERE plan_id = ?",
    ).run(oldReceipt, planned.id);
    db.close();

    expect(mem.prunePlans({ apply: true })).toMatchObject({
      payloads: { plans: 0, items: 0, privateBytes: 0 },
      receipts: { plans: 0, items: 0 },
    });
    expect(mem.plan(planned.id)).toMatchObject({
      status: 'failed',
      payloadPrunedAt: null,
      items: [expect.objectContaining({ status: 'verification_failed' })],
    });
  });

  it('keeps human review separate from apply and leaves an undoable change', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;

    const decided = mem.decidePlan(planned.id, item.id, 'approve', 'The exact hygiene diff is safe.');
    expect(decided).toMatchObject({ status: 'approved' });
    expect(fs.readFileSync(page, 'utf8')).toBe(before);

    const applied = await mem.applyPlan(planned.id);
    expect(applied.plan).toMatchObject({ status: 'completed' });
    expect(applied.plan.items[0]).toMatchObject({ status: 'applied' });
    expect(fs.readFileSync(page, 'utf8')).not.toBe(before);

    const changeId = applied.plan.items[0]!.changeId!;
    await mem.undo({ change_id: changeId });
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(() => mem.supersedePlan(planned.id)).toThrow(/completed/);
  });

  it('refuses an approved item when its source changed after planning', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    fs.appendFileSync(page, '\nA newer note from Ada Marlow.\n');
    const newer = fs.readFileSync(page, 'utf8');

    mem.decidePlan(planned.id, item.id, 'approve', 'Approved before the newer edit arrived.');
    const result = await mem.applyPlan(planned.id);

    expect(result.plan).toMatchObject({ status: 'failed' });
    expect(result.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(fs.readFileSync(page, 'utf8')).toBe(newer);
    expect(result.files).toEqual([]);
  });

  it('does not regenerate a human-rejected plan for unchanged input', async () => {
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    mem.decidePlan(planned.id, planned.items[0]!.id, 'reject', 'Leave the existing wording as written.');
    const calls = server.calls();

    const next = await mem.dream({ phase: 'curate', mode: 'review' });

    expect(next.maintenancePlan).toBeNull();
    expect(next.curated).toEqual([]);
    expect(server.calls()).toBe(calls);
  });

  it('uses an independent curator in auto mode', async () => {
    const report = await mem.dream({ phase: 'curate', mode: 'auto' });

    expect(report.maintenancePlan).toMatchObject({ mode: 'auto', status: 'completed' });
    expect(report.maintenancePlan?.items[0]).toMatchObject({
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(report.curated[0]?.action).toBe('updated');
    expect(server.calls()).toBe(3);
    expect(server.curatorCalls()).toBe(1);
  });

  it('enforces configured plan retention at the end of a writable dream run', async () => {
    await mem.close();
    mem = await openMem(true, undefined, {
      profile: 'autonomous',
      planRetention: { payload_days: 0, receipt_days: 180 },
    });

    const report = await mem.dream({ phase: 'curate', mode: 'auto' });
    const planId = report.maintenancePlan!.id;

    expect(report.planPrune).toMatchObject({
      applied: true,
      payloads: { plans: 1, items: 1 },
      receipts: { plans: 0, items: 0 },
    });
    expect(report.maintenancePlan?.payloadPrunedAt).toEqual(expect.any(String));
    expect(mem.plan(planId)).toMatchObject({
      status: 'completed',
      payloadPrunedAt: expect.any(String),
      items: [expect.objectContaining({ operations: [], evidence: [] })],
    });
  });

  it('lowers every autonomous class to audit for an audit invocation', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    await mem.close();
    mem = await openMem(false, undefined, { profile: 'autonomous' });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate', mode: 'audit' });

    expect(report.maintenancePlan).toMatchObject({ mode: 'audit', status: 'ready' });
    expect(report.maintenancePlan?.items[0]).toMatchObject({ policy: 'audit', status: 'proposed' });
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(server.curatorCalls()).toBe(0);
  });

  it('applies only auto items while review items remain proposed in the same plan', async () => {
    const hygienePage = path.join(root, 'people/ada-marlow.md');
    const hygieneBefore = fs.readFileSync(hygienePage, 'utf8');
    fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'notes/zephyr-dashboard.md'),
      '---\ntitle: Zephyr dashboard\nakno:\n  management:\n    dream: hygiene\n---\n\n' +
        'See [[products/zephyr-manual]].\n',
    );
    fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'archive/zephyr-qx-100.md'),
      '---\ntitle: Zephyr QX-100\nakno:\n  aliases:\n    - products/zephyr-manual\n---\n\nInvented manual notes.\n',
    );
    await mem.close();
    mem = await openMem(false, undefined, {
      profile: 'autonomous',
      policies: {
        hygiene: 'review',
        synthesis: 'off',
        split: 'off',
        extract: 'off',
        merge: 'off',
        contradiction: 'off',
        broken_link: 'auto',
      },
    });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });
    const plan = mem.plan(report.maintenancePlan!.id);
    const hygiene = plan.items.find((item) => item.kind === 'hygiene')!;
    const link = plan.items.find((item) => item.kind === 'broken_link')!;

    expect(plan).toMatchObject({ mode: 'auto', status: 'awaiting_review' });
    expect(hygiene).toMatchObject({ policy: 'review', status: 'proposed', decision: null });
    expect(link).toMatchObject({
      policy: 'auto',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
    });
    expect(fs.readFileSync(hygienePage, 'utf8')).toBe(hygieneBefore);
    expect(fs.readFileSync(path.join(root, 'notes/zephyr-dashboard.md'), 'utf8')).toContain(
      '[[archive/zephyr-qx-100]]',
    );
    expect(server.curatorCalls()).toBe(1);
  });

  it('does not inspect curation classes whose policies are all off', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    await mem.close();
    mem = await openMem(false, undefined, {
      profile: 'autonomous',
      policies: {
        hygiene: 'off',
        synthesis: 'off',
        split: 'off',
        extract: 'off',
        merge: 'off',
        contradiction: 'off',
        broken_link: 'off',
        adopt: 'off',
      },
    });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated).toEqual([]);
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(server.calls()).toBe(0);
  });

  it('rejects cosmetic-only synthesis and caches that completed input', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    server.cosmeticDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto');
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated).toMatchObject([
      {
        slug: 'people/ada-marlow',
        action: 'rejected',
        issues: ['synthesis rewrite is cosmetic or organizational; no material knowledge was added'],
      },
    ]);
    expect(server.calls()).toBe(1);
    expect(server.curatorCalls()).toBe(0);

    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);
    expect(server.calls()).toBe(1);
  });

  it('caches unchanged plan-backed candidates instead of resampling them', async () => {
    server.exactDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto');
    await mem.index({ structuralOnly: true });

    const first = await mem.dream({ phase: 'curate' });
    expect(first.maintenancePlan).toBeNull();
    expect(first.curated).toMatchObject([{ slug: 'people/ada-marlow', action: 'unchanged' }]);
    expect(server.calls()).toBe(1);

    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);
    expect(server.calls()).toBe(1);
  });

  it('uses configured auto mode inside the complete scheduled cycle', async () => {
    await mem.close();
    mem = await openMem(false, 'auto');

    const report = await mem.dream();

    expect(report.phases.map((phase) => phase.phase)).toEqual([
      'conflicts',
      'observe',
      'reflect',
      'curate',
      'adopt',
      'repair',
      'housekeeping',
    ]);
    expect(report.maintenancePlan).toMatchObject({ mode: 'auto', status: 'completed' });
    expect(report.maintenancePlan?.items[0]).toMatchObject({
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
    });
    expect(report.curated[0]?.action).toBe('updated');
  });

  it('applies synthesis and its child page as one plan item and one undo', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    const before = fs.readFileSync(canonical, 'utf8');
    server.splitDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', { allowSplits: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });
    const plan = mem.plan(report.maintenancePlan!.id);
    const item = plan.items[0]!;
    const child = path.join(root, 'people/ada-marlow/history.md');

    expect(item).toMatchObject({ kind: 'split', risk: 'medium', status: 'applied' });
    expect(item.operations.map((operation) => operation.type)).toEqual(['replace', 'create']);
    expect(mem.maintenanceDiff(plan.id)).toContain('--- /dev/null');
    expect(fs.readFileSync(canonical, 'utf8')).toContain('[[people/ada-marlow/history]]');
    expect(fs.readFileSync(child, 'utf8')).toContain('Ada Marlow lives at 111 Example Street.');
    expect(mem.changes(1)[0]).toMatchObject({
      id: item.changeId,
      op: 'maintenance',
      files: [
        { relPath: 'people/ada-marlow.md', action: 'modified' },
        { relPath: 'people/ada-marlow/history.md', action: 'created' },
      ],
    });

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(canonical, 'utf8')).toBe(before);
    expect(fs.existsSync(child)).toBe(false);
  });

  it('atomically extracts a reusable subject into an independent page and converges', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(canonical, extractionSource());
    fs.mkdirSync(path.join(root, 'topics'), { recursive: true });
    const before = fs.readFileSync(canonical, 'utf8');
    server.extractDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', { allowExtracts: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;
    const extracted = path.join(root, 'topics/zephyr-qx-100.md');

    expect(report.curated[0]).toMatchObject({
      action: 'updated',
      splits: [],
      extractions: ['topics/zephyr-qx-100'],
    });
    expect(item).toMatchObject({ kind: 'extract', risk: 'medium', status: 'applied' });
    expect(item.operations.map((operation) => operation.type)).toEqual(['replace', 'create']);
    expect(fs.readFileSync(canonical, 'utf8')).toContain(
      '<!-- akno:extract target="topics/zephyr-qx-100" -->',
    );
    expect(fs.readFileSync(canonical, 'utf8')).toContain('[[topics/zephyr-qx-100]]');
    const extractedBody = fs.readFileSync(extracted, 'utf8');
    expect(extractedBody).toContain('Ada Marlow keeps the Zephyr QX-100 near Blackwater Bay.');
    expect(extractedBody).toContain('Extracted from [[people/ada-marlow]].');
    expect(extractedBody).not.toContain('about:');
    expect(
      server
        .userMessages()
        .some(
          (message) =>
            message.includes('"extracts"') && message.includes('Extracted from [[people/ada-marlow]].'),
        ),
    ).toBe(true);
    expect(mem.changes(1)[0]).toMatchObject({
      id: item.changeId,
      op: 'maintenance',
      files: [
        { relPath: 'people/ada-marlow.md', action: 'modified' },
        { relPath: 'topics/zephyr-qx-100.md', action: 'created' },
      ],
    });

    const calls = server.calls();
    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);
    expect(server.calls()).toBe(calls);

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(canonical, 'utf8')).toBe(before);
    expect(fs.existsSync(extracted)).toBe(false);
  });

  it('rejects an extraction that does not select an exact eligible source heading', async () => {
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), extractionSource());
    fs.mkdirSync(path.join(root, 'topics'), { recursive: true });
    server.extractDraft(true);
    server.invalidExtractionHeading(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowExtracts: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues.join(' ')).toMatch(
      /source_heading is not one exact eligible source section/,
    );
    expect(server.calls()).toBe(1);
  });

  it('rejects an extraction outside the supplied folder taxonomy', async () => {
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), extractionSource());
    fs.mkdirSync(path.join(root, 'topics'), { recursive: true });
    server.extractDraft(true);
    server.invalidExtractionTarget(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowExtracts: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues.join(' ')).toMatch(/not an allowed knowledge folder/);
    expect(server.calls()).toBe(1);
  });

  it('rejects moving a heading that an incoming link addresses', async () => {
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), extractionSource());
    fs.mkdirSync(path.join(root, 'topics'), { recursive: true });
    fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'notes/equipment-reference.md'),
      '# Equipment reference\n\nSee [[people/ada-marlow#Equipment]].\n',
    );
    server.extractDraft(true);
    await mem.close();
    mem = await openMem(false, undefined, { allowExtracts: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.curated[0]?.action).toBe('rejected');
    expect(report.curated[0]?.issues).toContain(
      'an incoming link targets a heading that the extraction would move',
    );
    expect(server.calls()).toBe(1);
  });

  it('makes the whole extraction stale when its destination appears before apply', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(canonical, extractionSource());
    fs.mkdirSync(path.join(root, 'topics'), { recursive: true });
    const before = fs.readFileSync(canonical, 'utf8');
    server.extractDraft(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowExtracts: true });
    await mem.index({ structuralOnly: true });

    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = planned.items[0]!;
    const target = path.join(root, 'topics/zephyr-qx-100.md');
    fs.writeFileSync(target, '# A separately authored topic\n');
    mem.decidePlan(planned.id, item.id, 'approve', 'Apply only if the destination remains available.');

    const result = await mem.applyPlan(planned.id);

    expect(result.plan.items[0]).toMatchObject({ kind: 'extract', status: 'stale' });
    expect(fs.readFileSync(canonical, 'utf8')).toBe(before);
    expect(fs.readFileSync(target, 'utf8')).toBe('# A separately authored topic\n');
    expect(result.files).toEqual([]);
  });

  it('atomically merges an exact-alias duplicate, rewrites inbound links, and converges', async () => {
    const paths = writeMergeFixture();
    const before = Object.fromEntries(
      Object.entries(paths).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]),
    );
    server.mergeDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', { allowMerges: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(report.curated).toMatchObject([
      {
        slug: 'people/ada-marlow',
        action: 'updated',
        merges: ['people/ada-field-notes'],
        issues: [],
      },
    ]);
    expect(item).toMatchObject({ kind: 'merge', risk: 'high', status: 'applied' });
    expect(item.operations.map((operation) => operation.type)).toEqual(['replace', 'replace', 'delete']);
    expect(item.evidence).toContainEqual(
      expect.objectContaining({
        type: 'page',
        source: 'people/ada-field-notes',
        relationship: 'identity',
      }),
    );
    expect(mem.maintenanceDiff(item.planId)).toContain('+++ /dev/null');
    const canonical = fs.readFileSync(paths.canonical, 'utf8');
    expect(canonical).toContain('- people/ada-field-notes');
    expect(canonical).toContain('- "Ada field notes"');
    expect(canonical).toContain('Ada Marlow tests the Zephyr QX-100 at Blackwater Bay.');
    expect(fs.existsSync(paths.duplicate)).toBe(false);
    expect(fs.readFileSync(paths.inbound, 'utf8')).toContain(
      '[[people/ada-marlow#Equipment|Ada’s equipment notes]]',
    );
    expect(mem.changes(1)[0]).toMatchObject({
      id: item.changeId,
      op: 'maintenance',
      files: [
        { relPath: 'people/ada-marlow.md', action: 'modified' },
        { relPath: 'people/bo-winters.md', action: 'modified' },
        { relPath: 'people/ada-field-notes.md', action: 'deleted' },
      ],
    });

    const calls = server.calls();
    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);
    expect(server.calls()).toBe(calls);

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(paths.canonical, 'utf8')).toBe(before.canonical);
    expect(fs.readFileSync(paths.duplicate, 'utf8')).toBe(before.duplicate);
    expect(fs.readFileSync(paths.inbound, 'utf8')).toBe(before.inbound);
  });

  it('discovers an identity-backed merge from exact graph subjects without an authored alias', async () => {
    const paths = writeGraphSubjectMergeFixture();
    server.mergeDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', {
      allowMerges: true,
      policies: {
        hygiene: 'off',
        synthesis: 'off',
        split: 'off',
        extract: 'off',
        merge: 'auto',
      },
    });
    await mem.index({ structuralOnly: true });
    seedGraphSubjectFacts(mem.config.dbPath, 'people/ada-marlow-notes');
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(report.curated).toMatchObject([
      {
        slug: 'people/ada-marlow',
        action: 'updated',
        merges: ['people/ada-marlow-notes'],
        issues: [],
      },
    ]);
    expect(item).toMatchObject({ kind: 'merge', risk: 'high', status: 'applied' });
    expect(item.evidence).toContainEqual(
      expect.objectContaining({
        source: 'people/ada-marlow-notes',
        relationship: 'identity',
        details: [expect.stringMatching(/2 distinct current attributes resolved exactly/)],
      }),
    );
    expect(fs.readFileSync(paths.canonical, 'utf8')).toContain(
      'Ada Marlow calibrates the Zephyr QX-100 at Blackwater Bay.',
    );
    expect(fs.existsSync(paths.duplicate)).toBe(false);
    expect(server.curatorCalls()).toBe(1);
  });

  it('does not treat one exact graph attribute as merge identity', async () => {
    writeGraphSubjectMergeFixture();
    await mem.close();
    mem = await openMem(false, 'auto', {
      allowMerges: true,
      policies: {
        hygiene: 'off',
        synthesis: 'off',
        split: 'off',
        extract: 'off',
        merge: 'auto',
      },
    });
    await mem.index({ structuralOnly: true });
    seedGraphSubjectFacts(mem.config.dbPath, 'people/ada-marlow-notes', 1);
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated).toEqual([]);
    expect(server.calls()).toBe(0);
  });

  it('does not use exact graph attributes when the candidate title omits part of the identity', async () => {
    writeGraphSubjectMergeFixture('Ada field notes');
    await mem.close();
    mem = await openMem(false, 'auto', {
      allowMerges: true,
      policies: {
        hygiene: 'off',
        synthesis: 'off',
        split: 'off',
        extract: 'off',
        merge: 'auto',
      },
    });
    await mem.index({ structuralOnly: true });
    seedGraphSubjectFacts(mem.config.dbPath, 'people/ada-marlow-notes');
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated).toEqual([]);
    expect(server.calls()).toBe(0);
  });

  it('refuses a merge when an inbound page does not permit synthesis writes', async () => {
    const paths = writeMergeFixture();
    fs.writeFileSync(
      paths.inbound,
      '# Bo Winters\n\nSee [[people/ada-field-notes#Equipment|Ada’s equipment notes]].\n',
    );
    server.mergeDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', { allowMerges: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated).toMatchObject([
      {
        slug: 'people/ada-marlow',
        action: 'rejected',
        merges: ['people/ada-field-notes'],
      },
    ]);
    expect(report.curated[0]?.issues.join(' ')).toMatch(/not opted in to synthesis link updates/);
    expect(server.calls()).toBe(0);
    expect(fs.existsSync(paths.duplicate)).toBe(true);

    expect((await mem.dream({ phase: 'curate' })).curated).toEqual([]);
    expect(server.calls()).toBe(0);
  });

  it('rejects a merge draft that drops one unique authored line before verification', async () => {
    const paths = writeMergeFixture();
    server.mergeDraft(true);
    server.lossyMergeDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', { allowMerges: true });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan).toBeNull();
    expect(report.curated[0]).toMatchObject({
      slug: 'people/ada-marlow',
      action: 'rejected',
      merges: ['people/ada-field-notes'],
    });
    expect(report.curated[0]?.issues.join(' ')).toMatch(/preserve every unique authored line/);
    expect(server.calls()).toBe(1);
    expect(fs.existsSync(paths.duplicate)).toBe(true);
  });

  it('makes the whole merge stale when the duplicate changes before apply', async () => {
    const paths = writeMergeFixture();
    const canonicalBefore = fs.readFileSync(paths.canonical, 'utf8');
    const inboundBefore = fs.readFileSync(paths.inbound, 'utf8');
    server.mergeDraft(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowMerges: true });
    await mem.index({ structuralOnly: true });

    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = planned.items[0]!;
    fs.appendFileSync(paths.duplicate, '\nA newer invented calibration note.\n');
    const duplicateNewer = fs.readFileSync(paths.duplicate, 'utf8');
    mem.decidePlan(planned.id, item.id, 'approve', 'Apply only if every merge input remains unchanged.');

    const result = await mem.applyPlan(planned.id);

    expect(result.plan.items[0]).toMatchObject({ kind: 'merge', status: 'stale' });
    expect(result.files).toEqual([]);
    expect(fs.readFileSync(paths.canonical, 'utf8')).toBe(canonicalBefore);
    expect(fs.readFileSync(paths.inbound, 'utf8')).toBe(inboundBefore);
    expect(fs.readFileSync(paths.duplicate, 'utf8')).toBe(duplicateNewer);
  });

  it('seals linked evidence into a high-risk synthesis decision', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'evidence/ada-interview.md'),
      `---
title: Ada interview
akno:
  role: source
  about:
    - people/ada-marlow
---

An invented interview record.
`,
    );
    server.synthesisDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto');
    await mem.index({ structuralOnly: true });
    const db = new Database(mem.config.dbPath);
    db.prepare('UPDATE pages SET summary = ? WHERE slug = ?').run(
      'Ada Marlow maintains a brass compass collection.',
      'evidence/ada-interview',
    );
    db.close();

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(item).toMatchObject({ kind: 'synthesis', risk: 'high', status: 'applied' });
    expect(item.operations).toHaveLength(1);
    expect(item.evidence).toContainEqual(
      expect.objectContaining({
        type: 'page',
        source: 'evidence/ada-interview',
        relationship: 'about',
        details: ['Ada Marlow maintains a brass compass collection.'],
      }),
    );
    expect(fs.readFileSync(canonical, 'utf8')).toContain('brass compass collection');
    expect(server.curatorCalls()).toBe(1);
    expect(
      server
        .userMessages()
        .some(
          (message) =>
            message.includes('"item"') &&
            message.includes('Ada Marlow maintains a brass compass collection.'),
        ),
    ).toBe(true);
  });

  it('makes synthesis stale when linked evidence bytes change before apply', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    const evidence = path.join(root, 'evidence/ada-interview.md');
    fs.writeFileSync(
      evidence,
      `---
title: Ada interview
akno:
  role: source
  about:
    - people/ada-marlow
---

An invented interview record.
`,
    );
    server.synthesisDraft(true);
    await mem.close();
    mem = await openMem(false, 'review');
    await mem.index({ structuralOnly: true });
    const db = new Database(mem.config.dbPath);
    db.prepare('UPDATE pages SET summary = ? WHERE slug = ?').run(
      'Ada Marlow maintains a brass compass collection.',
      'evidence/ada-interview',
    );
    db.close();
    const before = fs.readFileSync(canonical, 'utf8');
    const planned = (await mem.dream({ phase: 'curate' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    fs.appendFileSync(evidence, '\nAn invented correction arrived after planning.\n');

    mem.decidePlan(planned.id, item.id, 'approve', 'Apply only against unchanged linked evidence.');
    const result = await mem.applyPlan(planned.id);

    expect(item.evidence).toContainEqual(
      expect.objectContaining({
        source: 'evidence/ada-interview',
        sourceRelPath: 'evidence/ada-interview.md',
        sourceHash: expect.any(String),
      }),
    );
    expect(result.plan.items[0]).toMatchObject({ kind: 'synthesis', status: 'stale' });
    expect(result.files).toEqual([]);
    expect(fs.readFileSync(canonical, 'utf8')).toBe(before);
  });

  it('composes reciprocal synthesis drafts into one exact atomic item', async () => {
    const paths = writeCompositionFixture();
    const before = {
      ada: fs.readFileSync(paths.ada, 'utf8'),
      bo: fs.readFileSync(paths.bo, 'utf8'),
    };
    server.crossPageDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto');
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });
    const plan = mem.plan(report.maintenancePlan!.id);
    const item = plan.items[0]!;

    expect(plan).toMatchObject({
      status: 'completed',
      summary: 'curate: 2 transformations in 1 atomic item',
    });
    expect(plan.items).toHaveLength(1);
    expect(item).toMatchObject({
      kind: 'synthesis',
      status: 'applied',
      componentCount: 2,
      verification: { status: 'passed' },
    });
    expect(item.operations).toHaveLength(2);
    expect(item.evidence.filter((entry) => entry.type === 'component')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'people/ada-marlow', fingerprint: expect.any(String) }),
        expect.objectContaining({ source: 'people/bo-winters', fingerprint: expect.any(String) }),
      ]),
    );
    expect(report.curated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'people/ada-marlow', action: 'updated' }),
        expect.objectContaining({ slug: 'people/bo-winters', action: 'updated' }),
      ]),
    );
    expect(report.budget.used).toMatchObject({ items: 2, filesChanged: 2, highRiskItems: 2 });
    expect(server.curatorCalls()).toBe(1);
    expect(fs.readFileSync(paths.ada, 'utf8')).toContain('Bo Winters files');
    expect(fs.readFileSync(paths.bo, 'utf8')).toContain('Ada Marlow calibrates');

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(paths.ada, 'utf8')).toBe(before.ada);
    expect(fs.readFileSync(paths.bo, 'utf8')).toBe(before.bo);
  });

  it('caches rejection for every component of a composed item', async () => {
    const paths = writeCompositionFixture();
    const before = {
      ada: fs.readFileSync(paths.ada, 'utf8'),
      bo: fs.readFileSync(paths.bo, 'utf8'),
    };
    server.crossPageDraft(true);
    await mem.close();
    mem = await openMem(false, 'review');
    await mem.index({ structuralOnly: true });

    const first = await mem.dream({ phase: 'curate' });
    const item = mem.plan(first.maintenancePlan!.id).items[0]!;
    expect(item.componentCount).toBe(2);
    mem.decidePlan(first.maintenancePlan!.id, item.id, 'reject', 'The invented composition is too broad.');
    const calls = server.calls();

    const repeated = await mem.dream({ phase: 'curate' });

    expect(repeated.maintenancePlan).toBeNull();
    expect(server.calls()).toBe(calls);
    expect(fs.readFileSync(paths.ada, 'utf8')).toBe(before.ada);
    expect(fs.readFileSync(paths.bo, 'utf8')).toBe(before.bo);
  });

  it('reserves composed risk and item budgets without partially writing', async () => {
    const paths = writeCompositionFixture();
    const before = {
      ada: fs.readFileSync(paths.ada, 'utf8'),
      bo: fs.readFileSync(paths.bo, 'utf8'),
    };
    server.crossPageDraft(true);
    await mem.close();
    mem = await openMem(false, 'auto', { limits: { max_high_risk_items: 1 } });
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.run).toMatchObject({
      status: 'partially_completed',
      budget: { used: { items: 0, filesChanged: 0, highRiskItems: 0 }, deferredItems: 1 },
    });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      status: 'proposed',
      statusCode: 'budget_exhausted',
      componentCount: 2,
    });
    expect(fs.readFileSync(paths.ada, 'utf8')).toBe(before.ada);
    expect(fs.readFileSync(paths.bo, 'utf8')).toBe(before.bo);
  });

  it('restores and reapplies an interrupted partial composition as one item', async () => {
    const paths = writeCompositionFixture();
    const before = {
      ada: fs.readFileSync(paths.ada, 'utf8'),
      bo: fs.readFileSync(paths.bo, 'utf8'),
    };
    server.crossPageDraft(true);
    await mem.close();
    mem = await openMem(false, 'review');
    await mem.index({ structuralOnly: true });

    const planned = (await mem.dream({ phase: 'curate' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    mem.decidePlan(planned.id, item.id, 'approve', 'Exercise exact composition crash recovery.');
    const db = new Database(mem.config.dbPath);
    db.prepare("UPDATE maintenance_items SET status = 'applying', policy = 'auto' WHERE id = ?").run(item.id);
    db.prepare("UPDATE maintenance_plans SET mode = 'auto' WHERE id = ?").run(planned.id);
    db.close();
    const first = item.operations[0]!;
    if (first.type === 'delete') throw new Error('invented composition unexpectedly deletes');
    fs.writeFileSync(path.join(root, first.relPath), first.after);
    await mem.close();
    mem = await openMem(false, 'auto');

    const recovered = await mem.dream({ phase: 'curate' });
    const recoveredItem = recovered.maintenancePlan!.items[0]!;

    expect(recoveredItem).toMatchObject({
      status: 'applied',
      componentCount: 2,
      verification: { status: 'passed' },
    });
    expect(fs.readFileSync(paths.ada, 'utf8')).toContain('Bo Winters files');
    expect(fs.readFileSync(paths.bo, 'utf8')).toContain('Ada Marlow calibrates');
    expect(mem.changes().filter((change) => change.op === 'maintenance')).toHaveLength(1);

    await mem.undo({ change_id: recoveredItem.changeId! });
    expect(fs.readFileSync(paths.ada, 'utf8')).toBe(before.ada);
    expect(fs.readFileSync(paths.bo, 'utf8')).toBe(before.bo);
  });

  it('makes a whole split item stale when its child target appears before apply', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    const before = fs.readFileSync(canonical, 'utf8');
    server.splitDraft(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowSplits: true });
    await mem.index({ structuralOnly: true });

    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    const child = path.join(root, 'people/ada-marlow/history.md');
    fs.mkdirSync(path.dirname(child), { recursive: true });
    fs.writeFileSync(child, '# A separately authored history\n');
    mem.decidePlan(planned.id, item.id, 'approve', 'Apply only if every planned path is still available.');

    const result = await mem.applyPlan(planned.id);

    expect(result.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(fs.readFileSync(canonical, 'utf8')).toBe(before);
    expect(fs.readFileSync(child, 'utf8')).toBe('# A separately authored history\n');
    expect(result.files).toEqual([]);
  });

  it('lets autonomous dream recover an interrupted exact write after restart', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    mem.decidePlan(planned.id, item.id, 'approve', 'The hygiene edit is safe.');

    const db = new Database(mem.config.dbPath);
    db.prepare("UPDATE maintenance_items SET status = 'applying', policy = 'auto' WHERE id = ?").run(item.id);
    db.prepare("UPDATE maintenance_plans SET mode = 'auto' WHERE id = ?").run(planned.id);
    db.close();
    fs.writeFileSync(page, item.operations[0]!.after);
    await mem.close();
    mem = await openMem(false, 'auto');

    const recovered = await mem.dream({ phase: 'curate', mode: 'auto' });
    expect(recovered.maintenancePlan).toMatchObject({ status: 'completed' });
    expect(recovered.maintenancePlan?.items[0]).toMatchObject({
      status: 'applied',
      verification: { status: 'passed' },
    });
    expect(mem.changes().filter((change) => change.op === 'maintenance')).toHaveLength(1);

    await mem.undo({ change_id: recovered.maintenancePlan!.items[0]!.changeId! });
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
  });

  it('restores and reapplies an interrupted partial split as one item', async () => {
    const canonical = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(
      canonical,
      fs.readFileSync(canonical, 'utf8').replace('dream: hygiene', 'dream: synthesize'),
    );
    const before = fs.readFileSync(canonical, 'utf8');
    server.splitDraft(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowSplits: true });
    await mem.index({ structuralOnly: true });

    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    mem.decidePlan(planned.id, item.id, 'approve', 'The complete split is safe.');
    const db = new Database(mem.config.dbPath);
    db.prepare("UPDATE maintenance_items SET status = 'applying', policy = 'auto' WHERE id = ?").run(item.id);
    db.prepare("UPDATE maintenance_plans SET mode = 'auto' WHERE id = ?").run(planned.id);
    db.close();
    fs.writeFileSync(canonical, item.operations[0]!.after);
    await mem.close();
    mem = await openMem(false, 'auto', { allowSplits: true });

    const recovered = await mem.dream({ phase: 'curate' });
    const child = path.join(root, 'people/ada-marlow/history.md');

    expect(recovered.maintenancePlan).toMatchObject({ status: 'completed' });
    expect(recovered.maintenancePlan?.items[0]).toMatchObject({ status: 'applied' });
    expect(fs.readFileSync(canonical, 'utf8')).toContain('[[people/ada-marlow/history]]');
    expect(fs.existsSync(child)).toBe(true);
    expect(mem.changes().filter((change) => change.op === 'maintenance')).toHaveLength(1);

    await mem.undo({ change_id: recovered.maintenancePlan!.items[0]!.changeId! });
    expect(fs.readFileSync(canonical, 'utf8')).toBe(before);
    expect(fs.existsSync(child)).toBe(false);
  });

  it('recovers a fully written merge that was interrupted before journalling', async () => {
    const paths = writeMergeFixture();
    const before = Object.fromEntries(
      Object.entries(paths).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]),
    );
    server.mergeDraft(true);
    await mem.close();
    mem = await openMem(false, 'review', { allowMerges: true });
    await mem.index({ structuralOnly: true });

    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    mem.decidePlan(planned.id, item.id, 'approve', 'Exercise exact merge crash recovery.');
    const db = new Database(mem.config.dbPath);
    db.prepare("UPDATE maintenance_items SET status = 'applying', policy = 'auto' WHERE id = ?").run(item.id);
    db.prepare("UPDATE maintenance_plans SET mode = 'auto' WHERE id = ?").run(planned.id);
    db.close();
    for (const operation of item.operations) {
      const target = path.join(root, operation.relPath);
      if (operation.type === 'delete') fs.rmSync(target);
      else fs.writeFileSync(target, operation.after);
    }
    await mem.close();
    mem = await openMem(false, 'auto', { allowMerges: true });

    const recovered = await mem.dream({ phase: 'curate' });

    expect(recovered.maintenancePlan).toMatchObject({ status: 'completed' });
    expect(recovered.maintenancePlan?.items[0]).toMatchObject({
      kind: 'merge',
      status: 'applied',
      verification: { status: 'passed' },
    });
    expect(mem.changes().filter((change) => change.op === 'maintenance')).toHaveLength(1);
    expect(fs.existsSync(paths.duplicate)).toBe(false);

    await mem.undo({ change_id: recovered.maintenancePlan!.items[0]!.changeId! });
    expect(fs.readFileSync(paths.canonical, 'utf8')).toBe(before.canonical);
    expect(fs.readFileSync(paths.duplicate, 'utf8')).toBe(before.duplicate);
    expect(fs.readFileSync(paths.inbound, 'utf8')).toBe(before.inbound);
  });

  it('rolls a journaled write back when post-apply verification fails', async () => {
    const page = path.join(root, 'people/ada-marlow.md');
    const before = fs.readFileSync(page, 'utf8');
    const planned = (await mem.dream({ phase: 'curate', mode: 'review' })).maintenancePlan!;
    const item = mem.plan(planned.id).items[0]!;
    await mem.close();
    mem = await openMem(false, undefined, { folders: { 'people/**': { role: 'ignored' } } });

    mem.decidePlan(planned.id, item.id, 'approve', 'Exercise the post-write verifier.');
    const result = await mem.applyPlan(planned.id);

    expect(result.plan.items[0]).toMatchObject({
      status: 'verification_failed',
      verification: { status: 'rolled_back' },
    });
    expect(fs.readFileSync(page, 'utf8')).toBe(before);
    expect(mem.changes(1)[0]).toMatchObject({ status: 'undone' });
  });
});

describe('curation link integrity', () => {
  it('preserves supplied targets and allows resolvable wikilinks', () => {
    const before = '[Source](https://example.test/original)\n[[travel/rome]]\n';
    const after = `${before}See [[people/ada-marlow]].\n`;
    expect(linkIssuesForTesting(before, after, 'wiki/rome', ['travel/rome', 'people/ada-marlow'])).toEqual(
      [],
    );
  });

  it('rejects changed URLs, new relative paths and unresolved wikilinks', () => {
    const issues = linkIssuesForTesting(
      '[Source](https://example.test/original)\n',
      '[Source](https://example.test/invented)\n[Trip](../../travel/rome)\n[[missing/page]]\n',
      'wiki/sightseeings/rome/place',
      [],
    );
    expect(issues.join('\n')).toMatch(/existing Markdown link target was removed or changed/);
    expect(issues.join('\n')).toMatch(/new external URL was invented/);
    expect(issues.join('\n')).toMatch(/new internal Markdown link target is not allowed/);
    expect(issues.join('\n')).toMatch(/new wikilink does not resolve/);
  });
});

async function openMem(
  write: boolean,
  mode?: MaintenanceMode,
  options: {
    allowSplits?: boolean;
    allowExtracts?: boolean;
    allowMerges?: boolean;
    folders?: Record<string, { role: 'ignored' }>;
    profile?: MaintenanceProfile;
    policies?: Partial<Record<MaintenanceTransform, MaintenancePolicy>>;
    limits?: {
      max_items?: number;
      max_files_changed?: number;
      max_bytes_written?: number;
      max_high_risk_items?: number;
    };
    planRetention?: { payload_days?: number; receipt_days?: number };
  } = {},
): Promise<Akno> {
  const profile =
    options.profile ??
    (mode === 'auto'
      ? 'autonomous'
      : mode === 'audit' || mode === 'review'
        ? mode
        : write
          ? 'autonomous'
          : 'audit');
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'agent',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        expansion: { id: null },
        derive: { provider: 'stub', id: 'stub' },
      },
      maintenance: {
        profile,
        ...(options.policies ? { policies: options.policies } : {}),
        ...(options.limits ? { limits: options.limits } : {}),
        ...(options.planRetention ? { plan_retention: options.planRetention } : {}),
        log_changes: true,
        curate: {
          verify: true,
          ...(options.allowSplits ? { split_after_bytes: 1, split_section_bytes: 1 } : {}),
          ...(options.allowExtracts ? { extract_after_bytes: 1, extract_section_bytes: 1 } : {}),
          ...(options.allowMerges ? { max_merges: 2, merge_folders: ['people'] } : {}),
        },
      },
      ...(options.folders ? { folders: options.folders } : {}),
    },
  });
}

async function startStub(): Promise<typeof server> {
  let calls = 0;
  let curatorCalls = 0;
  let drop = false;
  let changeNumber = false;
  let echoDraft = false;
  let exactDraft = false;
  let synthesisDraft = false;
  let crossPageDraft = false;
  let cosmeticDraft = false;
  let splitDraft = false;
  let extractDraft = false;
  let mergeDraft = false;
  let lossyMergeDraft = false;
  let invalidExtractionHeading = false;
  let invalidExtractionTarget = false;
  const userMessages: string[] = [];
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        messages?: { role: string; content: string }[];
      };
      const system = body.messages?.find((message) => message.role === 'system')?.content ?? '';
      const user = body.messages?.find((message) => message.role === 'user')?.content ?? '';
      userMessages.push(user);
      if (
        system.includes('Markdown page hygienist') ||
        system.includes('synthesize one canonical') ||
        system.includes('merge two Markdown pages') ||
        system.includes('verify an automatic Markdown rewrite') ||
        system.includes('independent curator')
      ) {
        calls++;
      }
      if (system.includes('independent curator')) curatorCalls++;
      const content = system.includes('independent curator')
        ? JSON.stringify({
            outcome: 'approve',
            reason: 'The rewrite is conservative and preserves knowledge.',
          })
        : system.includes('verify an automatic Markdown rewrite')
          ? JSON.stringify({ ok: true, issues: [] })
          : mergeDraft && system.includes('merge two Markdown pages')
            ? mergeDraftResponse(user, lossyMergeDraft)
            : extractDraft && system.includes('synthesize one canonical')
              ? extractionDraftResponse(invalidExtractionHeading, invalidExtractionTarget)
              : splitDraft && system.includes('synthesize one canonical')
                ? JSON.stringify({
                    body: '# Ada Marlow\n\n## Overview\n\nAda’s history is maintained in [[people/ada-marlow/history]].\n',
                    splits: [
                      {
                        suffix: 'history',
                        title: 'Ada Marlow history',
                        body: '# Ada Marlow history\n\n<!-- akno:item itm_ada source=conversation origin=user -->\nAda Marlow lives at 111 Example Street.\n',
                      },
                    ],
                    extracts: [],
                    temporal: false,
                  })
                : cosmeticDraft && system.includes('synthesize one canonical')
                  ? JSON.stringify({
                      body: currentBody(user)
                        .replace(/^\n(?=#)/, '')
                        .replace('## Details', '## History and details'),
                      splits: [],
                      extracts: [],
                      temporal: false,
                    })
                  : crossPageDraft && system.includes('synthesize one canonical')
                    ? crossPageDraftResponse(user)
                    : synthesisDraft && system.includes('synthesize one canonical')
                      ? JSON.stringify({
                          body: '# Ada Marlow\n\n## Details\n\n<!-- akno:item itm_ada source=conversation origin=user -->\nAda Marlow lives at 111 Example Street.\n\n## Interests\n\nAda Marlow maintains a brass compass collection. [[evidence/ada-interview]]\n',
                          splits: [],
                          extracts: [],
                          temporal: false,
                        })
                      : exactDraft
                        ? JSON.stringify({
                            body: currentBody(user),
                            splits: [],
                            extracts: [],
                            temporal: false,
                          })
                        : echoDraft
                          ? JSON.stringify({
                              body: currentBody(user).replace(/^\n(?=#)/, ''),
                              splits: [],
                              extracts: [],
                              temporal: false,
                            })
                          : JSON.stringify({
                              body:
                                '# Ada Marlow\n\n## Details\n\n' +
                                (drop ? '' : '<!-- akno:item itm_ada source=conversation origin=user -->\n') +
                                `Ada Marlow lives at ${changeNumber ? '112' : '111'} Example Street.\n`,
                            });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address();
  if (!address || typeof address === 'string') throw new Error('stub did not bind');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    calls: () => calls,
    curatorCalls: () => curatorCalls,
    loseMarker: (value) => {
      drop = value;
    },
    changeNumber: (value) => {
      changeNumber = value;
    },
    echoDraft: (value) => {
      echoDraft = value;
    },
    exactDraft: (value) => {
      exactDraft = value;
    },
    synthesisDraft: (value) => {
      synthesisDraft = value;
    },
    crossPageDraft: (value) => {
      crossPageDraft = value;
    },
    cosmeticDraft: (value) => {
      cosmeticDraft = value;
    },
    splitDraft: (value) => {
      splitDraft = value;
    },
    extractDraft: (value) => {
      extractDraft = value;
    },
    mergeDraft: (value) => {
      mergeDraft = value;
    },
    lossyMergeDraft: (value) => {
      lossyMergeDraft = value;
    },
    invalidExtractionHeading: (value) => {
      invalidExtractionHeading = value;
    },
    invalidExtractionTarget: (value) => {
      invalidExtractionTarget = value;
    },
    userMessages: () => [...userMessages],
  };
}

function writeMergeFixture(): { canonical: string; duplicate: string; inbound: string } {
  const canonical = path.join(root, 'people/ada-marlow.md');
  const duplicate = path.join(root, 'people/ada-field-notes.md');
  const inbound = path.join(root, 'people/bo-winters.md');
  fs.writeFileSync(
    canonical,
    `---
title: Ada Marlow
akno:
  aliases:
    - people/ada-field-notes
  management:
    dream: synthesize
---

# Ada Marlow

## Details

<!-- akno:item itm_ada source=conversation origin=user -->
Ada Marlow lives at 111 Example Street.
`,
  );
  fs.writeFileSync(
    duplicate,
    `---
title: Ada field notes
akno:
  management:
    dream: synthesize
---

# Ada field notes

## Equipment

<!-- akno:item itm_zephyr source=conversation origin=user -->
Ada Marlow tests the Zephyr QX-100 at Blackwater Bay.
`,
  );
  fs.writeFileSync(
    inbound,
    `---
title: Bo Winters
akno:
  management:
    dream: synthesize
---

# Bo Winters

See [[people/ada-field-notes#Equipment|Ada’s equipment notes]].
`,
  );
  return { canonical, duplicate, inbound };
}

function writeGraphSubjectMergeFixture(duplicateTitle = 'Ada Marlow field notes'): {
  canonical: string;
  duplicate: string;
} {
  const canonical = path.join(root, 'people/ada-marlow.md');
  const duplicate = path.join(root, 'people/ada-marlow-notes.md');
  fs.writeFileSync(
    canonical,
    `---
title: Ada Marlow
akno:
  management:
    dream: synthesize
---

# Ada Marlow

Ada Marlow keeps an equipment record.
`,
  );
  fs.writeFileSync(
    duplicate,
    `---
title: ${duplicateTitle}
akno:
  management:
    dream: synthesize
---

# ${duplicateTitle}

Ada Marlow calibrates the Zephyr QX-100 at Blackwater Bay.
Ada Marlow records a five-year warranty.
`,
  );
  return { canonical, duplicate };
}

function seedGraphSubjectFacts(databasePath: string, slug: string, count = 2): void {
  const db = new Database(databasePath);
  const page = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug) as { id: string };
  const now = new Date().toISOString();
  const facts = [
    {
      id: 'fac_graph_subject_equipment',
      claim: 'Ada Marlow calibrates the Zephyr QX-100 at Blackwater Bay.',
      attribute: 'equipment',
      value: 'Zephyr QX-100',
      line: 11,
      hash: 'invented-equipment-line-hash',
    },
    {
      id: 'fac_graph_subject_warranty',
      claim: 'Ada Marlow records a five-year warranty.',
      attribute: 'warranty',
      value: 'five years',
      line: 12,
      hash: 'invented-warranty-line-hash',
    },
  ];
  const insert = db.prepare(
    `INSERT INTO facts(
       id, page_id, claim, subject, attribute, value, line_start, line_end,
       source_line_hash, confidence, valid_from, valid_to, first_seen, last_seen, item_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
  );
  for (const fact of facts.slice(0, count)) {
    insert.run(
      fact.id,
      page.id,
      fact.claim,
      'Ada Marlow',
      fact.attribute,
      fact.value,
      fact.line,
      fact.line,
      fact.hash,
      0.9,
      now,
      now,
    );
  }
  db.close();
}

function writeCompositionFixture(): { ada: string; bo: string } {
  const ada = path.join(root, 'people/ada-marlow.md');
  const bo = path.join(root, 'people/bo-winters.md');
  fs.writeFileSync(
    ada,
    `---
title: Ada Marlow
akno:
  management:
    dream: synthesize
---

# Ada Marlow

<!-- akno:item itm_ada source=conversation origin=user -->
Ada Marlow calibrates a brass compass at Blackwater Bay before maintaining the Zephyr QX-100 checklist. See [[people/bo-winters]].
`,
  );
  fs.writeFileSync(
    bo,
    `---
title: Bo Winters
akno:
  management:
    dream: synthesize
---

# Bo Winters

<!-- akno:item itm_bo source=conversation origin=user -->
Bo Winters files a five-year warranty note after reviewing the Zephyr QX-100 checklist. See [[people/ada-marlow]].
`,
  );
  return { ada, bo };
}

function extractionSource(): string {
  return `---
title: Ada Marlow
akno:
  management:
    dream: synthesize
---

# Ada Marlow

## Details

<!-- akno:item itm_ada source=conversation origin=user -->
Ada Marlow lives at 111 Example Street.

## Equipment

<!-- akno:item itm_zephyr source=conversation origin=user -->
Ada Marlow keeps the Zephyr QX-100 near Blackwater Bay.
- **Warranty:** five years
`;
}

function extractionDraftResponse(invalidHeading: boolean, invalidTarget: boolean): string {
  const target = invalidTarget ? 'archive/zephyr-qx-100' : 'topics/zephyr-qx-100';
  const bridge = `See [[${target}]] for Ada Marlow's equipment notes.`;
  return JSON.stringify({
    // Extraction content comes from the selected source section, never from model-authored bytes.
    body: '# Model draft that Akno must not use for an extraction.\n',
    splits: [],
    extracts: [
      {
        slug: target,
        title: 'Zephyr QX-100 notes',
        source_heading: invalidHeading ? '## Missing field manual' : '## Equipment',
        bridge,
      },
    ],
    temporal: false,
  });
}

function currentBody(user: string): string {
  const marker = '\n\nCurrent body:\n';
  const start = user.indexOf(marker);
  if (start < 0) return '';
  const body = user.slice(start + marker.length);
  const cuts = ['\n\nEvidence graph:\n', '\n\nUnresolved conflicts:\n']
    .map((suffix) => body.indexOf(suffix))
    .filter((index) => index >= 0);
  return cuts.length ? body.slice(0, Math.min(...cuts)) : body;
}

function crossPageDraftResponse(user: string): string {
  const current = currentBody(user).trimEnd();
  const addition = user.includes('Slug: people/ada-marlow')
    ? 'Bo Winters files a five-year warranty note after reviewing the Zephyr QX-100 checklist.'
    : 'Ada Marlow calibrates a brass compass at Blackwater Bay before maintaining the Zephyr QX-100 checklist.';
  return JSON.stringify({
    body: `${current}\n\n## Shared checklist\n\n${addition}\n`,
    splits: [],
    extracts: [],
    temporal: false,
  });
}

function mergeDraftResponse(user: string, lossy: boolean): string {
  const canonicalMarker = '\n\nCanonical body:\n';
  const duplicateMarker = '\n\nPrepared duplicate body:\n';
  const canonicalStart = user.indexOf(canonicalMarker);
  const duplicateStart = user.indexOf(duplicateMarker);
  if (canonicalStart < 0 || duplicateStart < 0) return JSON.stringify({ body: '' });
  const canonical = user.slice(canonicalStart + canonicalMarker.length, duplicateStart).trimEnd();
  const duplicate = user
    .slice(duplicateStart + duplicateMarker.length)
    .trim()
    .replace(lossy ? 'Ada Marlow tests the Zephyr QX-100 at Blackwater Bay.' : /$^/, '');
  return JSON.stringify({ body: `${canonical}\n\n${duplicate}\n` });
}
