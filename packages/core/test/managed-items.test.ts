import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import {
  applyManagedItemTransfer,
  applyManagedItemMoves,
  inspectManagedItems,
  managedItemOperationsIssue,
  managedItemRepairIssue,
} from '../src/maintenance/managed-items.ts';
import { managedSectionHeading } from '../src/maintenance/managed-item-routing.ts';
import { sha256 } from '../src/store/ids.ts';

describe('managed item inspection', () => {
  it('derives only short plain section headings from fact attributes', () => {
    expect(managedSectionHeading('warranty')).toMatchObject({ heading: 'Warranty' });
    expect(managedSectionHeading('Notes')).toBeNull();
    expect(managedSectionHeading('warranty\n## Override')).toBeNull();
    expect(managedSectionHeading('**warranty**')).toBeNull();
  });

  it('repairs only empty and byte-identical duplicate owned fragments', () => {
    const before = `# Ada Marlow

<!-- akno:item itm_empty v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->

## Plans

<!-- akno:item itm_first v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow plans to visit Blackwater Bay.

<!-- akno:item itm_copy v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow plans to visit Blackwater Bay.

<!-- akno:item itm_first v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow owns a Zephyr QX-100.

<!-- akno:item bad v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Authored context stays intact.
`;

    const result = inspectManagedItems(before);

    expect(result.after).toContain('## Plans');
    expect(result.after).toContain(
      '<!-- akno:item itm_first v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->',
    );
    expect(result.after.match(/Ada Marlow plans to visit Blackwater Bay\./g)).toHaveLength(1);
    expect(result.after).toContain(
      '<!-- akno:item itm_first v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->',
    );
    expect(result.after).toContain(
      '<!-- akno:item bad v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->',
    );
    expect(result.after).toContain('Authored context stays intact.');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'empty_marker', outcome: 'planned' }),
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

<!-- akno:item itm_one v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow owns a Zephyr QX-100.

## Unsorted

<!-- akno:item itm_two v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=assistant reports=0 commitment=asserted disposition=active polarity=affirmed basis=source_report -->
Ada Marlow prefers Blackwater Bay.

## Records

## Records

<!-- akno:item itm_three v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

<!-- akno:item itm_move v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

<!-- akno:item itm_move v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

  it('creates one bounded section and moves the exact owned block into it', () => {
    const before = `# Ada Marlow

## Records

<!-- akno:item itm_section v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.

Authored record context stays here.
`;
    const move = {
      itemId: 'itm_section',
      markerLine: 5,
      fromHeading: 'Records',
      toHeading: 'Warranty',
      createHeading: true,
      headingSource: 'warranty',
    };

    const result = applyManagedItemMoves(before, [move]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain('## Records\n\n\n\nAuthored record context stays here.');
    expect(result.content).toContain(
      `## Warranty

<!-- akno:item itm_section v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.`,
    );
    expect(managedItemRepairIssue(before, result.content, [move])).toBeNull();
    expect(
      managedItemRepairIssue(before, result.content.replace('## Warranty', '## Service'), [move]),
    ).toMatch(/broader/);
    expect(managedItemRepairIssue(before, result.content, [{ ...move, headingSource: 'service' }])).toMatch(
      /broader/,
    );
  });

  it('moves one complete owned block between two sealed pages', () => {
    const source = `# Ada Marlow

## Records

<!-- akno:item itm_route v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.

Authored profile context stays here.
`;
    const destination = `# Zephyr QX-100

## Warranty

Authored warranty context stays here.

## Preferences

<!-- akno:item itm_existing v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.
`;
    const transfer = {
      itemId: 'itm_route',
      markerLine: 5,
      fromHeading: 'Records',
      sourceRelPath: 'people/ada-marlow.md',
      destinationRelPath: 'equipment/zephyr-qx-100.md',
      destinationSlug: 'equipment/zephyr-qx-100',
      destinationHeading: 'Warranty',
    };

    const result = applyManagedItemTransfer(source, destination, transfer);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toContain('Authored profile context stays here.');
    expect(result.source).not.toContain('itm_route');
    expect(result.destination).toContain(
      `## Warranty

Authored warranty context stays here.

<!-- akno:item itm_route v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.`,
    );
    expect(
      managedItemOperationsIssue(
        [
          { relPath: transfer.sourceRelPath, before: source, after: result.source },
          { relPath: transfer.destinationRelPath, before: destination, after: result.destination },
        ],
        [],
        [],
        [transfer],
      ),
    ).toBeNull();
    expect(
      managedItemOperationsIssue(
        [
          { relPath: transfer.sourceRelPath, before: source, after: result.source },
          {
            relPath: transfer.destinationRelPath,
            before: destination,
            after: result.destination.replace('Authored warranty', 'Changed warranty'),
          },
        ],
        [],
        [],
        [transfer],
      ),
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
  let routingCalls = 0;
  let sourceCalls = 0;
  let placementDecider: (
    items: { id: string; current_heading: string | null; creatable_h2_heading: string | null }[],
  ) => unknown;
  let sourceDecider: (
    items: { id: string; current_sentence: string; retained_source_quote: string }[],
  ) => unknown;
  let routingDecider: (input: {
    item: {
      id: string;
      sentence: string;
      subject: string;
      attribute: string;
      current_heading: string | null;
    };
    current_page_without_item: { title: string; headings: string[]; markdown_excerpt: string };
    candidate_pages: {
      id: string;
      title: string;
      headings: string[];
      creatable_h2_heading: string | null;
    }[];
  }) => unknown;
  let routingInputs: Parameters<typeof routingDecider>[0][];

  function archiveSource(
    itemId: string,
    sourceRef: string,
    origin: 'user' | 'assistant' | 'unknown',
    evidence: string,
    input = evidence,
  ): void {
    const db = new Database(path.join(stateDir, 'akno.db'));
    db.prepare(
      `INSERT INTO managed_item_sources(
         item_id, source_ref, origin, evidence, evidence_hash, input_hash, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(itemId, sourceRef, origin, evidence, sha256(evidence), sha256(input), new Date().toISOString());
    db.close();
  }

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-kb-'));
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-state-'));
    curatorCalls = 0;
    placementCalls = 0;
    routingCalls = 0;
    routingInputs = [];
    sourceCalls = 0;
    placementDecider = (items) => ({
      decisions: items.map((item) =>
        item.current_heading
          ? { id: item.id, outcome: 'keep', heading: null, heading_mode: null }
          : { id: item.id, outcome: 'uncertain', heading: null, heading_mode: null },
      ),
    });
    sourceDecider = (items) => ({
      decisions: items.map((item) => ({ id: item.id, outcome: 'supported', replacement: null })),
    });
    routingDecider = () => ({ outcome: 'keep', target_id: null, heading: null, heading_mode: null });
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
        const routing = system.startsWith(
          'You audit which existing knowledge page owns one Akno-managed sentence',
        );
        const sourcing = system.startsWith('You verify Akno-generated memory sentences');
        if (system.startsWith('You are the independent curator')) curatorCalls += 1;
        if (placing) placementCalls += 1;
        if (routing) routingCalls += 1;
        if (sourcing) sourceCalls += 1;
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
          ? (JSON.parse(user) as { items: Parameters<typeof placementDecider>[0] })
          : null;
        const sourceInput = sourcing
          ? (JSON.parse(user) as {
              items: { id: string; current_sentence: string; retained_source_quote: string }[];
            })
          : null;
        const routingInput = routing ? (JSON.parse(user) as Parameters<typeof routingDecider>[0]) : null;
        if (routingInput) routingInputs.push(routingInput);
        const answer = routing
          ? routingDecider(routingInput!)
          : sourcing
            ? sourceDecider(sourceInput?.items ?? [])
            : placing
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

<!-- akno:item itm_first v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.

<!-- akno:item itm_copy v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.

<!-- akno:item itm_empty v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=assistant reports=0 commitment=asserted disposition=active polarity=affirmed basis=source_report -->

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
            rule_drift: 'off',
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
    archiveSource('itm_first', 'fixture:one', 'user', 'Ada Marlow prefers the Zephyr QX-100.');
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
      findings: { empty_marker: 1, duplicate_item: 1, source_unavailable: 1 },
      outcomes: { planned: 2, held: 1, valid: 0, suppressed: 0 },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({
        kind: 'managed_item',
        policy: 'auto',
        status: 'applied',
        decision: expect.objectContaining({ actor: 'curator', outcome: 'approve' }),
      }),
    ]);
    expect(report.run.counts.managedItems).toEqual({ planned: 2, held: 1, valid: 0, suppressed: 0 });
    expect(curatorCalls).toBe(1);
    expect(after.match(/Ada Marlow prefers the Zephyr QX-100\./g)).toHaveLength(1);
    expect(after).not.toContain('itm_empty');
    expect(after).toContain('## Authored notes\n\nThis sentence is not managed by Akno.');

    const verified = await mem.dream({ phase: 'curate', dryRun: true });
    expect(verified.managedItems).toMatchObject({
      findings: { source_unavailable: 0, item_conflict: 0, valid: 1 },
      outcomes: { held: 0, valid: 1 },
    });
  });

  it('qualifies and applies one atomic cross-page managed-item move', async () => {
    const source = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

<!-- akno:item itm_route v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.

Authored profile context stays here.
`;
    const destination = `---
title: Zephyr QX-100
akno:
  management:
    remember: integrate
---

# Zephyr QX-100

This page holds Zephyr QX-100 warranty records and equipment documentation.

## Warranty

Authored warranty context stays here.

## Preferences

<!-- akno:item itm_existing v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.
`;
    fs.mkdirSync(path.join(root, 'equipment'), { recursive: true });
    fs.mkdirSync(path.join(root, 'references'), { recursive: true });
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), source);
    fs.writeFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), destination);
    fs.writeFileSync(
      path.join(root, 'references/zephyr-qx-100.md'),
      '# Zephyr QX-100 reference\n\n## Warranty\n\nZephyr QX-100 warranty reference material.\n',
    );
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_route', 'fixture:route', 'user', 'The Zephyr QX-100 warranty lasts 1111 days.');
    archiveSource('itm_existing', 'fixture:existing', 'user', 'Ada Marlow prefers the Zephyr QX-100.');
    routingDecider = (input) => {
      const target = input.candidate_pages.find((candidate) => candidate.title === 'Zephyr QX-100');
      return target
        ? { outcome: 'move', target_id: target.id, heading: 'Warranty', heading_mode: 'existing' }
        : { outcome: 'keep', target_id: null, heading: null, heading_mode: null };
    };

    const report = await mem.dream({ phase: 'curate' });
    const sourceAfter = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    const destinationAfter = fs.readFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), 'utf8');

    expect(report.managedItems).toMatchObject({
      plannedPages: 1,
      findings: { misrouted_item: 1, routing_deferred: 1, valid: 0 },
      outcomes: { planned: 1, held: 1, valid: 0 },
      routing: { classifierCalls: 2, cacheHits: 0, moved: 1, deferred: 1, unavailable: 0 },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({
        kind: 'managed_item',
        risk: 'medium',
        status: 'applied',
        verification: expect.objectContaining({ status: 'passed' }),
      }),
    ]);
    expect(sourceAfter).toContain('Authored profile context stays here.');
    expect(sourceAfter).not.toContain('itm_route');
    expect(destinationAfter).toContain(
      `## Warranty

Authored warranty context stays here.

<!-- akno:item itm_route v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.

## Preferences`,
    );
    expect(mem.changes()).toEqual([
      expect.objectContaining({
        op: 'maintenance',
        files: expect.arrayContaining([
          expect.objectContaining({ relPath: 'people/ada-marlow.md' }),
          expect.objectContaining({ relPath: 'equipment/zephyr-qx-100.md' }),
        ]),
      }),
    ]);
    expect(curatorCalls).toBe(1);
    expect(routingCalls).toBe(2);
    expect(
      routingInputs.every((input) =>
        input.candidate_pages.every((candidate) => candidate.title !== 'Zephyr QX-100 reference'),
      ),
    ).toBe(true);
    expect(
      routingInputs.find((input) => input.item.id === 'itm_route')!.current_page_without_item
        .markdown_excerpt,
    ).not.toContain('itm_route');

    await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(source);
    expect(fs.readFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), 'utf8')).toBe(destination);
  });

  it('creates one bounded section while routing to an existing admitted page', async () => {
    const source = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

<!-- akno:item itm_route_section v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.
`;
    const destination = `---
title: Zephyr QX-100
akno:
  management:
    remember: integrate
---

# Zephyr QX-100

This page holds Zephyr QX-100 equipment and warranty documentation.
`;
    fs.mkdirSync(path.join(root, 'equipment'), { recursive: true });
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), source);
    fs.writeFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), destination);
    await mem.index({ reindexUnchanged: true });
    archiveSource(
      'itm_route_section',
      'fixture:route',
      'user',
      'The Zephyr QX-100 warranty lasts 1111 days.',
    );
    routingDecider = (input) => {
      const target = input.candidate_pages.find((candidate) => candidate.title === 'Zephyr QX-100');
      return target
        ? {
            outcome: 'move',
            target_id: target.id,
            heading: target.creatable_h2_heading,
            heading_mode: 'create',
          }
        : { outcome: 'keep', target_id: null, heading: null, heading_mode: null };
    };

    const preview = await mem.dream({ phase: 'curate', dryRun: true });
    expect(preview.managedItems.routing).toMatchObject({
      classifierCalls: 1,
      cacheHits: 0,
      moved: 1,
      sectionsCreated: 1,
    });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(source);
    expect(fs.readFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), 'utf8')).toBe(destination);

    const report = await mem.dream({ phase: 'curate' });
    const sourceAfter = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    const destinationAfter = fs.readFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), 'utf8');

    expect(report.managedItems).toMatchObject({
      findings: { misrouted_item: 1, valid: 0 },
      outcomes: { planned: 1, held: 0, valid: 0 },
      routing: {
        classifierCalls: 0,
        cacheHits: 1,
        moved: 1,
        sectionsCreated: 1,
        unavailable: 0,
      },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({ kind: 'managed_item', risk: 'medium', status: 'applied' }),
    ]);
    expect(sourceAfter).not.toContain('itm_route_section');
    expect(destinationAfter).toContain(
      `## Warranty

<!-- akno:item itm_route_section v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.`,
    );

    await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(source);
    expect(fs.readFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), 'utf8')).toBe(destination);
  });

  it('rejects and does not cache an invented cross-page destination heading', async () => {
    const source = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

<!-- akno:item itm_route_guard v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.
`;
    const destination = `---
title: Zephyr QX-100
akno:
  management:
    remember: integrate
---

# Zephyr QX-100

This page holds Zephyr QX-100 warranty records and equipment documentation.

## Warranty

Authored warranty context stays here.
`;
    fs.mkdirSync(path.join(root, 'equipment'), { recursive: true });
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), source);
    fs.writeFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), destination);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_route_guard', 'fixture:route', 'user', 'The Zephyr QX-100 warranty lasts 1111 days.');
    routingDecider = (input) => ({
      outcome: 'move',
      target_id: input.candidate_pages[0]?.id ?? 'candidate_1',
      heading: 'Invented destination',
      heading_mode: 'create',
    });

    const first = await mem.dream({ phase: 'curate', dryRun: true });
    const second = await mem.dream({ phase: 'curate', dryRun: true });

    expect(first.managedItems).toMatchObject({
      plannedPages: 0,
      findings: { routing_unavailable: 1, misrouted_item: 0, valid: 0 },
      outcomes: { planned: 0, held: 1, valid: 0 },
      routing: { classifierCalls: 1, cacheHits: 0, moved: 0, unavailable: 1 },
    });
    expect(second.managedItems.routing).toMatchObject({ classifierCalls: 1, cacheHits: 0 });
    expect(routingCalls).toBe(2);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(source);
    expect(fs.readFileSync(path.join(root, 'equipment/zephyr-qx-100.md'), 'utf8')).toBe(destination);
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

<!-- akno:item itm_same v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

<!-- akno:item itm_same v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

<!-- akno:item itm_fact v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

<!-- akno:item itm_move v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.

Authored equipment context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_move', 'fixture:one', 'user', 'Ada Marlow prefers the Zephyr QX-100.');
    placementDecider = (items) => ({
      decisions: items.map((item) =>
        item.current_heading === 'Equipment'
          ? { id: item.id, outcome: 'move', heading: 'Preferences', heading_mode: 'existing' }
          : { id: item.id, outcome: 'keep', heading: null, heading_mode: null },
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

<!-- akno:item itm_move v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
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

  it('creates one attribute-grounded section on the current admitted page', async () => {
    const before = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

<!-- akno:item itm_section v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.

Authored record context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_section', 'fixture:one', 'user', 'The Zephyr QX-100 warranty lasts 1111 days.');
    placementDecider = (items) => ({
      decisions: items.map((item) => ({
        id: item.id,
        outcome: 'move',
        heading: item.creatable_h2_heading,
        heading_mode: 'create',
      })),
    });

    const preview = await mem.dream({ phase: 'curate', dryRun: true });
    expect(preview.managedItems).toMatchObject({
      findings: { section_created: 1 },
      placement: { classifierCalls: 1, cacheHits: 0, sectionsCreated: 1 },
    });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);

    const report = await mem.dream({ phase: 'curate' });
    const after = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');

    expect(report.managedItems).toMatchObject({
      findings: { section_created: 1, valid: 0 },
      outcomes: { planned: 1, held: 0, valid: 0 },
      placement: { classifierCalls: 0, cacheHits: 1, moved: 1, sectionsCreated: 1 },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({ kind: 'managed_item', risk: 'medium', status: 'applied' }),
    ]);
    expect(after).toContain('Authored record context stays here.');
    expect(after).toContain(
      `## Warranty

<!-- akno:item itm_section v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.`,
    );
    expect(curatorCalls).toBe(1);
    expect(placementCalls).toBe(1);

    await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);
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

<!-- akno:item itm_uncertain v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.

## Equipment

Authored equipment context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_uncertain', 'fixture:one', 'user', 'Ada Marlow prefers the Zephyr QX-100.');
    placementDecider = (items) => ({
      decisions: items.map((item) => ({
        id: item.id,
        outcome: 'uncertain',
        heading: null,
        heading_mode: null,
      })),
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

<!-- akno:item itm_guard v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
Ada Marlow prefers the Zephyr QX-100.

## Equipment

Authored equipment context stays here.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_guard', 'fixture:one', 'user', 'Ada Marlow prefers the Zephyr QX-100.');
    placementDecider = (items) => ({
      decisions: items.map((item) => ({
        id: item.id,
        outcome: 'move',
        heading: 'Invented destination',
        heading_mode: 'create',
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

  it('corrects only an owned payload grounded in its exact retained source quote', async () => {
    const before = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

Authored context stays here.

<!-- akno:item itm_correct v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.
`;
    const evidence = 'The Zephyr QX-100 warranty lasts 2222 days.';
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_correct', 'fixture:one', 'user', evidence);
    sourceDecider = (items) => ({
      decisions: items.map((item) =>
        item.current_sentence.includes('1111')
          ? {
              id: item.id,
              outcome: 'rewrite',
              replacement: 'The Zephyr QX-100 warranty lasts 2222 days.',
            }
          : { id: item.id, outcome: 'supported', replacement: null },
      ),
    });

    const report = await mem.dream({ phase: 'curate' });
    const after = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');

    expect(report.managedItems).toMatchObject({
      findings: { wording_corrected: 1, valid: 0 },
      outcomes: { planned: 1, held: 0, valid: 0 },
      source: { classifierCalls: 1, corrected: 1, unavailable: 0 },
    });
    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({ kind: 'managed_item', status: 'applied' }),
    ]);
    expect(after).toContain('Authored context stays here.');
    expect(after).toContain(evidence);
    expect(after).not.toContain('1111 days');
    expect(curatorCalls).toBe(1);

    const supported = await mem.dream({ phase: 'curate', dryRun: true });
    expect(supported.managedItems).toMatchObject({
      findings: { valid: 1 },
      source: { classifierCalls: 1, supported: 1 },
    });
    const cached = await mem.dream({ phase: 'curate', dryRun: true });
    expect(cached.managedItems.source).toMatchObject({ classifierCalls: 0, cacheHits: 1, supported: 1 });
    expect(sourceCalls).toBe(2);
  });

  it('rejects an ungrounded source rewrite and does not cache it', async () => {
    const before = `---
title: Ada Marlow
akno:
  management:
    remember: integrate
---

# Ada Marlow

## Records

<!-- akno:item itm_reject v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@extracted level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->
The Zephyr QX-100 warranty lasts 1111 days.
`;
    fs.writeFileSync(path.join(root, 'people/ada-marlow.md'), before);
    await mem.index({ reindexUnchanged: true });
    archiveSource('itm_reject', 'fixture:one', 'user', 'The Zephyr QX-100 warranty lasts 2222 days.');
    sourceDecider = (items) => ({
      decisions: items.map((item) => ({
        id: item.id,
        outcome: 'rewrite',
        replacement: 'The Zephyr QX-100 warranty lasts 3333 days.',
      })),
    });

    const first = await mem.dream({ phase: 'curate', dryRun: true });
    const second = await mem.dream({ phase: 'curate', dryRun: true });

    expect(first.managedItems).toMatchObject({
      plannedPages: 0,
      findings: { source_unavailable: 1, valid: 0 },
      outcomes: { planned: 0, held: 1 },
      source: { classifierCalls: 1, cacheHits: 0, unavailable: 1 },
    });
    expect(second.managedItems.source).toMatchObject({ classifierCalls: 1, cacheHits: 0 });
    expect(sourceCalls).toBe(2);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(before);
  });
});
