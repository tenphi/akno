import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../index.ts';

let root: string;
let stateDir: string;
let mem: Akno;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-policy-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-policy-state-'));
  fs.mkdirSync(path.join(root, 'people'), { recursive: true });
  fs.mkdirSync(path.join(root, 'reference'), { recursive: true });
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'people/ada-marlow.md'),
    synthesizePage('Ada Marlow', 'Invented profile detail.\n'.repeat(800)),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'reference/zephyr-qx-100.md'),
    synthesizePage('Zephyr QX-100', 'Invented reference material.'),
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'home/lease.md'), '# Lease\n\nRent is 1111 EUR.\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'timeline.md'),
    synthesizePage('Timeline', '- **2030-01-02** | Invented event.\n'),
    'utf8',
  );

  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: 'http://127.0.0.1:1111/v1' } },
      models: { derive: { provider: 'stub', id: 'zephyr-model' } },
      folders: { 'reference/**': { role: 'source' } },
      maintenance: {
        profile: 'autonomous',
        curate: { merge_folders: ['people'] },
      },
    },
  });
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  await mem?.close();
  for (const target of [root, stateDir]) fs.rmSync(target, { recursive: true, force: true });
});

describe('path-specific maintenance policy', () => {
  it('separates profile authority from page-owned transformation permission', () => {
    const policy = mem.maintenancePolicy('people/ada-marlow.md');
    const synthesis = transform(policy, 'synthesis');
    const hygiene = transform(policy, 'hygiene');
    const merge = transform(policy, 'merge');

    expect(policy).toMatchObject({
      slug: 'people/ada-marlow',
      state: 'indexed_page',
      profile: 'autonomous',
      runMode: 'auto',
      page: {
        role: 'knowledge',
        roleSource: 'default',
        dream: 'synthesize',
        dreamSource: 'frontmatter',
        reserved: false,
      },
      maintenanceModel: { id: 'zephyr-model', configured: true },
    });
    expect(synthesis).toMatchObject({
      effectivePolicy: 'auto',
      outcome: 'curator_then_apply',
      canInspect: true,
      decision: 'curator',
      automaticApplyPossible: true,
    });
    expect(hygiene).toMatchObject({ outcome: 'ineligible', canInspect: false });
    expect(hygiene.blockers).toContainEqual(
      expect.objectContaining({ code: 'dream_opt_in', message: 'the page must declare dream: hygiene' }),
    );
    expect(merge).toMatchObject({ outcome: 'curator_then_apply', canInspect: true });
  });

  it('shows folder-role, missing-opt-in, reserved-path, and lower-run blockers', () => {
    const source = mem.maintenancePolicy('reference/zephyr-qx-100');
    expect(source.page).toMatchObject({ role: 'source', roleSource: 'folder_rule' });
    expect(transform(source, 'synthesis').blockers).toContainEqual(
      expect.objectContaining({ code: 'role_not_knowledge' }),
    );

    const ownerManaged = mem.maintenancePolicy('home/lease');
    expect(ownerManaged.page).toMatchObject({ dream: 'none', dreamSource: 'default' });
    expect(transform(ownerManaged, 'broken_link').blockers).toContainEqual(
      expect.objectContaining({ code: 'dream_opt_in' }),
    );

    const reserved = mem.maintenancePolicy('timeline.md');
    expect(reserved.page.reserved).toBe(true);
    expect(transform(reserved, 'synthesis').blockers).toContainEqual(
      expect.objectContaining({ code: 'reserved_path' }),
    );

    const audit = mem.maintenancePolicy('people/ada-marlow', 'audit');
    expect(transform(audit, 'synthesis')).toMatchObject({
      effectivePolicy: 'audit',
      outcome: 'audit_only',
      decision: 'none',
      automaticApplyPossible: false,
    });
  });

  it('reports non-pages and paths outside the knowledge base honestly', () => {
    expect(mem.maintenancePolicy('documents/invented.pdf')).toMatchObject({
      slug: 'documents/invented.pdf',
      state: 'non_page',
      exists: false,
    });
    expect(() => mem.maintenancePolicy('../outside.md')).toThrow(/inside the knowledge-base root/);
    expect(() => mem.maintenancePolicy('/outside.md')).toThrow(/relative/);
  });

  it('distinguishes write-budget and model-capability blockers from inspection authority', async () => {
    await mem.close();
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: 'http://127.0.0.1:1111/v1' } },
        models: { derive: { provider: 'stub', id: 'zephyr-model' } },
        maintenance: {
          profile: 'autonomous',
          policies: { hygiene: 'off' },
          curate: { merge_folders: ['people'] },
          limits: { max_high_risk_items: 0 },
        },
      },
    });

    expect(transform(mem.maintenancePolicy('people/ada-marlow'), 'synthesis')).toMatchObject({
      canInspect: true,
      outcome: 'apply_blocked',
      automaticApplyPossible: false,
      applyBlockers: [expect.objectContaining({ code: 'zero_high_risk_budget' })],
    });
    expect(transform(mem.maintenancePolicy('people/ada-marlow'), 'hygiene')).toMatchObject({
      effectivePolicy: 'off',
      outcome: 'off',
      canInspect: false,
    });

    await mem.close();
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: 'http://127.0.0.1:1111/v1' } },
        models: { derive: { provider: 'stub', id: 'zephyr-model', enabled: false } },
        maintenance: {
          profile: 'autonomous',
          curate: { merge_folders: ['people'] },
        },
      },
    });

    const unavailable = mem.maintenancePolicy('people/ada-marlow');
    expect(transform(unavailable, 'synthesis')).toMatchObject({
      outcome: 'ineligible',
      blockers: [expect.objectContaining({ code: 'planner_model_unavailable' })],
    });
    expect(transform(unavailable, 'broken_link')).toMatchObject({
      canInspect: true,
      outcome: 'apply_blocked',
      applyBlockers: [expect.objectContaining({ code: 'curator_model_unavailable' })],
    });
    expect(transform(unavailable, 'contradiction')).toMatchObject({
      canInspect: true,
      outcome: 'apply_blocked',
      applyBlockers: [expect.objectContaining({ code: 'curator_model_unavailable' })],
    });
  });
});

function synthesizePage(title: string, body: string): string {
  return `---\ntitle: ${title}\nakno:\n  management:\n    dream: synthesize\n---\n\n# ${title}\n\n${body}`;
}

function transform(
  policy: ReturnType<Akno['maintenancePolicy']>,
  kind: ReturnType<Akno['maintenancePolicy']>['transformations'][number]['kind'],
) {
  return policy.transformations.find((entry) => entry.kind === kind)!;
}
