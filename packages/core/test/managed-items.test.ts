import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import {
  applyManagedItemMoves,
  inspectManagedItems,
  managedItemRepairIssue,
} from '../src/maintenance/managed-items.ts';

describe('managed item inspection', () => {
  it('repairs only empty, legacy, and byte-identical duplicate owned fragments', () => {
    const before = `# Ada Marlow

<!-- akno:item itm_empty source=fixture%3Aone origin=user -->

## Plans

<!-- engram:item itm_first source=fixture%3Atwo origin=user -->
Ada Marlow plans to visit Blackwater Bay.

<!-- akno:item itm_copy source=fixture%3Atwo origin=user -->
Ada Marlow plans to visit Blackwater Bay.

<!-- akno:item itm_first source=fixture%3Athree origin=user -->
Ada Marlow owns a Zephyr QX-100.

<!-- akno:item bad source=fixture%3Afour origin=user -->
Authored context stays intact.
`;

    const result = inspectManagedItems(before);

    expect(result.after).toContain('## Plans');
    expect(result.after).toContain('<!-- akno:item itm_first source=fixture%3Atwo origin=user -->');
    expect(result.after.match(/Ada Marlow plans to visit Blackwater Bay\./g)).toHaveLength(1);
    expect(result.after).toContain('<!-- akno:item itm_first source=fixture%3Athree origin=user -->');
    expect(result.after).toContain('<!-- akno:item bad source=fixture%3Afour origin=user -->');
    expect(result.after).toContain('Authored context stays intact.');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'empty_marker', outcome: 'planned' }),
        expect.objectContaining({ code: 'legacy_marker', outcome: 'planned' }),
        expect.objectContaining({ code: 'duplicate_item', outcome: 'planned' }),
        expect.objectContaining({ code: 'item_conflict', outcome: 'held' }),
        expect.objectContaining({ code: 'malformed_marker', outcome: 'held' }),
      ]),
    );
    expect(managedItemRepairIssue(before, result.after)).toBeNull();
    expect(managedItemRepairIssue(before, result.after.replace('## Plans', '## Other plans'))).toMatch(
      /broader/,
    );
  });

  it('holds fragments whose section boundary is missing, ambiguous, or explicitly unsorted', () => {
    const before = `# Ada Marlow

<!-- akno:item itm_one source=fixture%3Aone origin=user -->
Ada Marlow owns a Zephyr QX-100.

## Unsorted

<!-- akno:item itm_two source=fixture%3Atwo origin=assistant -->
Ada Marlow prefers Blackwater Bay.

## Records

## Records

<!-- akno:item itm_three source=fixture%3Athree origin=user -->
Ada Marlow renewed a Vulpine Mutual policy.
`;
    const result = inspectManagedItems(before);

    expect(result.findings.filter((finding) => finding.code === 'misplaced_item')).toHaveLength(3);
    expect(result.findings.filter((finding) => finding.code === 'valid')).toHaveLength(0);
    expect(result.after).toBe(before);
  });

  it('moves the complete owned block without rewriting surrounding bytes', () => {
    const before = `# Ada Marlow

## Preferences

Authored preference context stays here.

## Equipment

<!-- akno:item itm_move source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.

Authored equipment context stays here.
`;
    const move = {
      itemId: 'itm_move',
      markerLine: 8,
      fromHeading: 'Equipment',
      toHeading: 'Preferences',
    };

    const result = applyManagedItemMoves(before, [move]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain(
      `## Preferences

Authored preference context stays here.

<!-- akno:item itm_move source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.`,
    );
    expect(result.content).toContain('## Equipment\n\n\n\nAuthored equipment context stays here.');
    expect(managedItemRepairIssue(before, result.content, [move])).toBeNull();
    expect(
      managedItemRepairIssue(before, result.content.replace('Authored equipment', 'Changed equipment'), [
        move,
      ]),
    ).toMatch(/broader/);
  });
});

describe('managed items in the dream cycle', () => {
  let root: string;
  let stateDir: string;
  let mem: Akno;
  let server: http.Server;
  let baseUrl: string;
  let curatorCalls = 0;
  let placementCalls = 0;
  let placementDecider: (items: { id: string; current_heading: string | null }[]) => unknown;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-kb-'));
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-state-'));
    curatorCalls = 0;
    placementCalls = 0;
    placementDecider = (items) => ({
      decisions: items.map((item) =>
        item.current_heading
          ? { id: item.id, outcome: 'keep', heading: null }
          : { id: item.id, outcome: 'uncertain', heading: null },
      ),
    });
    server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
          messages?: { role: string; content: string }[];
        };
        const system = body.messages?.[0]?.content ?? '';
        const user = body.messages?.at(-1)?.content ?? '';
        const deriving = system.startsWith('You extract structure from a personal knowledge base page');
        const placing = system.startsWith('You audit the placement of Akno-managed facts');
        if (system.startsWith('You are the independent curator')) curatorCalls += 1;
        if (placing) placementCalls += 1;
        const preferredLine = /^([0-9]+): Ada Marlow prefers the Zephyr QX-100\.$/m.exec(user)?.[1];
        const firstWarrantyLine = /^([0-9]+): The Zephyr QX-100 warranty lasts 1111 days\.$/m.exec(user)?.[1];
        const secondWarrantyLine = /^([0-9]+): The Zephyr QX-100 warranty lasts 2222 days\.$/m.exec(
          user,
        )?.[1];
        const fact = preferredLine
          ? {
              line: Number(preferredLine),
              claim: 'Ada Marlow prefers the Zephyr QX-100.',
              subject: 'Ada Marlow',
              attribute: 'preferred device',
              value: 'Zephyr QX-100',
            }
          : firstWarrantyLine
            ? {
                line: Number(firstWarrantyLine),
                claim: 'The Zephyr QX-100 warranty lasts 1111 days.',
                subject: 'Zephyr QX-100',
                attribute: 'warranty',
                value: '1111 days',
              }
            : secondWarrantyLine
              ? {
                  line: Number(secondWarrantyLine),
                  claim: 'The Zephyr QX-100 warranty lasts 2222 days.',
                  subject: 'Zephyr QX-100',
                  attribute: 'warranty',
                  value: '2222 days',
                }
              : null;
        const placementInput = placing
          ? (JSON.parse(user) as { items: { id: string; current_heading: string | null }[] })
          : null;
        const answer = placing
          ? placementDecider(placementInput?.items ?? [])
          : deriving
            ? {
                summary: 'Invented preference record.',
                keywords: ['invented preference'],
                facts: fact ? [fact] : [],
              }
            : {
                outcome: 'approve',
                reason: 'The exact owned-fragment repair preserves surrounding authored bytes.',
              };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(answer),
                },
              },
            ],
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('stub model server did not start');
    baseUrl = `http://127.0.0.1:${address.port}/v1`;

    fs.mkdirSync(path.join(root, 'people'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'people/ada-marlow.md'),
      `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Preferences

<!-- engram:item itm_first source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.

<!-- akno:item itm_copy source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.

<!-- akno:item itm_empty source=fixture%3Atwo origin=assistant -->

## Authored notes

This sentence is not managed by Akno.
`,
    );
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'user',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: baseUrl } },
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
        },
        maintenance: {
          profile: 'autonomous',
          policies: {
            observe: 'off',
            reflect: 'off',
            hygiene: 'off',
            managed_item: 'auto',
            synthesis: 'off',
            split: 'off',
            extract: 'off',
            merge: 'off',
            contradiction: 'off',
            broken_link: 'off',
            adopt: 'off',
          },
          observe: { enabled: false },
          reflect: { enabled: false },
          conflicts: { enabled: true, verify: false, resolve: false },
          repair: { enabled: false, links: false },
        },
      },
    });
    await mem.index({ structuralOnly: true });
  });

  afterEach(async () => {
    await mem?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    for (const directory of [root, stateDir]) fs.rmSync(directory, { recursive: true, force: true });
  });

  it('repairs owned fragments without requiring whole-page dream authority', async () => {
    const report = await mem.dream({ phase: 'curate' });
    const after = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');

    expect(report.managedItems).toMatchObject({
      eligiblePages: 1,
      inspectedMarkers: 3,
      plannedPages: 1,
      findings: { empty_marker: 1, legacy_marker: 1, duplicate_item: 1 },
      outcomes: { planned: 3, held: 0, suppressed: 0 },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({
        kind: 'managed_item',
        policy: 'auto',
        status: 'applied',
        decision: expect.objectContaining({ actor: 'curator', outcome: 'approve' }),
      }),
    ]);
    expect(report.run.counts.managedItems).toEqual({ planned: 3, held: 0, valid: 0, suppressed: 0 });
    expect(curatorCalls).toBe(1);
    expect(after).not.toContain('engram:item');
    expect(after.match(/Ada Marlow prefers the Zephyr QX-100\./g)).toHaveLength(1);
    expect(after).not.toContain('itm_empty');
    expect(after).toContain('## Authored notes\n\nThis sentence is not managed by Akno.');

    const verified = await mem.dream({ phase: 'curate', dryRun: true });
    expect(verified.managedItems).toMatchObject({
      findings: { source_unavailable: 0, item_conflict: 0, valid: 1 },
      outcomes: { held: 0, valid: 1 },
    });
  });

  it('holds globally duplicated managed ids without changing either page', async () => {
    const first = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

<!-- akno:item itm_same source=fixture%3Aone origin=user -->
Ada Marlow owns a Zephyr QX-100.
`;
    const second = `---
title: Bo Winters
akno:
  management:
    remember: integrate
---

# Bo Winters

## Records

<!-- akno:item itm_same source=fixture%3Atwo origin=user -->
Bo Winters owns a Zephyr QX-100.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), first);
    fs.writeFileSync(path.join(root, 'people/bo-winters.md'), second);
    await mem.index({ structuralOnly: true });

    const report = await mem.dream({ phase: 'curate', dryRun: true });

    expect(report.managedItems).toMatchObject({
      inspectedMarkers: 2,
      plannedPages: 0,
      findings: { item_conflict: 2, valid: 0 },
      outcomes: { planned: 0, held: 2, valid: 0 },
    });
    expect(report.maintenancePlan).toBeNull();
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(first);
    expect(fs.readFileSync(path.join(root, 'people/bo-winters.md'), 'utf8')).toBe(second);
  });

  it('routes a managed fact in the typed conflict set to an item hold', async () => {
    const managed = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Preferences

<!-- akno:item itm_fact source=fixture%3Aone origin=user -->
The Zephyr QX-100 warranty lasts 1111 days.
`;
    const conflicting = `---
title: Bo Winters
---

# Bo Winters

The Zephyr QX-100 warranty lasts 2222 days.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), managed);
    fs.writeFileSync(path.join(root, 'people/bo-winters.md'), conflicting);
    await mem.index({ reindexUnchanged: true });

    const report = await mem.dream({ phase: 'curate', dryRun: true });

    expect(report.conflicts).toEqual([
      expect.objectContaining({ verdict: 'unverified', subject: 'zephyr qx-100' }),
    ]);
    expect(report.managedItems).toMatchObject({
      findings: { item_conflict: 1, valid: 0 },
      outcomes: { held: 1, valid: 0 },
    });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(managed);
  });

  it('qualifies, applies, and then caches an exact same-page placement correction', async () => {
    const before = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Preferences

Authored preference context stays here.

## Equipment

<!-- akno:item itm_move source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.

Authored equipment context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    placementDecider = (items) => ({
      decisions: items.map((item) =>
        item.current_heading === 'Equipment'
          ? { id: item.id, outcome: 'move', heading: 'Preferences' }
          : { id: item.id, outcome: 'keep', heading: null },
      ),
    });

    const report = await mem.dream({ phase: 'curate' });
    const after = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');

    expect(report.managedItems).toMatchObject({
      findings: { misplaced_item: 1, valid: 0 },
      outcomes: { planned: 1, held: 0, valid: 0 },
      placement: { pagesConsidered: 1, classifierCalls: 1, moved: 1 },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({ kind: 'managed_item', status: 'applied' }),
    ]);
    expect(after).toContain(
      `## Preferences

Authored preference context stays here.

<!-- akno:item itm_move source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.`,
    );
    expect(after).toContain('## Equipment\n\n\n\nAuthored equipment context stays here.');
    expect(curatorCalls).toBe(1);
    expect(placementCalls).toBe(1);

    const keep = await mem.dream({ phase: 'curate', dryRun: true });
    expect(keep.managedItems).toMatchObject({
      findings: { valid: 1 },
      placement: { classifierCalls: 1, kept: 1 },
    });
    const cached = await mem.dream({ phase: 'curate', dryRun: true });
    expect(cached.managedItems).toMatchObject({
      findings: { valid: 1 },
      placement: { classifierCalls: 0, cacheHits: 1, kept: 1 },
    });
    expect(placementCalls).toBe(2);
  });

  it('holds and caches an uncertain semantic placement without changing the page', async () => {
    const before = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Preferences

<!-- akno:item itm_uncertain source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.

## Equipment

Authored equipment context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    placementDecider = (items) => ({
      decisions: items.map((item) => ({ id: item.id, outcome: 'uncertain', heading: null })),
    });

    const first = await mem.dream({ phase: 'curate', dryRun: true });
    const second = await mem.dream({ phase: 'curate', dryRun: true });

    expect(first.managedItems).toMatchObject({
      plannedPages: 0,
      findings: { placement_uncertain: 1, valid: 0 },
      outcomes: { planned: 0, held: 1, valid: 0 },
      placement: { classifierCalls: 1, uncertain: 1 },
    });
    expect(second.managedItems.placement).toMatchObject({ classifierCalls: 0, cacheHits: 1 });
    expect(placementCalls).toBe(1);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);
  });

  it('rejects an invented destination and does not cache the invalid classifier response', async () => {
    const before = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Preferences

<!-- akno:item itm_guard source=fixture%3Aone origin=user -->
Ada Marlow prefers the Zephyr QX-100.

## Equipment

Authored equipment context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    placementDecider = (items) => ({
      decisions: items.map((item) => ({
        id: item.id,
        outcome: 'move',
        heading: 'Invented destination',
      })),
    });

    const first = await mem.dream({ phase: 'curate', dryRun: true });
    const second = await mem.dream({ phase: 'curate', dryRun: true });

    expect(first.managedItems).toMatchObject({
      plannedPages: 0,
      findings: { placement_unavailable: 1, valid: 0 },
      outcomes: { held: 1 },
      placement: { classifierCalls: 1, cacheHits: 0, unavailable: 1 },
    });
    expect(second.managedItems.placement).toMatchObject({ classifierCalls: 1, cacheHits: 0 });
    expect(placementCalls).toBe(2);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);
  });
});
