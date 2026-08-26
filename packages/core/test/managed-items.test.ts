import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { inspectManagedItems, managedItemRepairIssue } from '../src/maintenance/managed-items.ts';

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
});

describe('managed items in the dream cycle', () => {
  let root: string;
  let stateDir: string;
  let mem: Akno;
  let server: http.Server;
  let baseUrl: string;
  let curatorCalls = 0;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-kb-'));
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-managed-state-'));
    server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
          messages?: { content: string }[];
        };
        if (body.messages?.[0]?.content.startsWith('You are the independent curator')) curatorCalls += 1;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    outcome: 'approve',
                    reason: 'The exact owned-fragment repair preserves surrounding authored bytes.',
                  }),
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
          conflicts: { enabled: false, resolve: false },
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
  });
});
