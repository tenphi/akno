import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RecallOutput } from '@tenphi/akno-protocol';
import { open } from '../open.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('graph-assisted recall', () => {
  it('reaches a page with no query overlap through a qualified lexical seed and two exact links', async () => {
    const { root, stateDir } = graphRecallFixture();
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const input = {
      query: 'Where does the albatross conduit eventually lead?',
      mode: 'lookup' as const,
      depth: 'lines' as const,
      limit: 8,
      expand: false,
    };
    const lexicalOnly = await memory.recall({ ...input, graph: false });
    expect(lexicalOnly.results.map(resultIdentity)).not.toContain('products/zephyr-qx-100');

    const assisted = await memory.recall({ ...input, graph: true });
    RecallOutput.parse(assisted);
    const target = assisted.results.find(
      (result) => result.type === 'page' && result.slug === 'products/zephyr-qx-100',
    );
    expect(target).toMatchObject({
      type: 'page',
      matched_by: ['graph'],
    });
    expect(target?.type === 'page' ? target.lines.map((line) => line.text).join(' ') : '').toContain(
      'opaque marker glimmer',
    );
    const foundPath = target?.graph_paths?.find(
      (entry) => entry.hops === 2 && entry.nodes.every((node) => node.kind === 'page'),
    );
    expect(foundPath?.nodes.map((node) => node.slug)).toEqual([
      'people/ada-marlow',
      'organizations/vulpine-mutual',
      'products/zephyr-qx-100',
    ]);
    expect(foundPath?.relations).toEqual(['links_to', 'links_to']);
    expect(foundPath?.evidence).toEqual([
      expect.objectContaining({ kind: 'page_line', slug: 'people/ada-marlow' }),
      expect.objectContaining({ kind: 'page_line', slug: 'organizations/vulpine-mutual' }),
    ]);
    await memory.close();
  });

  it('applies ordinary recall filters to graph-discovered candidates', async () => {
    const { root, stateDir } = graphRecallFixture();
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const result = await memory.recall({
      query: 'albatross conduit',
      mode: 'lookup',
      expand: false,
      graph: true,
      filter: { folder: 'people' },
    });
    expect(result.results.map(resultIdentity)).toEqual(['people/ada-marlow']);
    await memory.close();
  });

  it('reports an ambiguous exact query name without choosing a lexical page as its graph identity', async () => {
    const root = temporaryDirectory('akno-graph-recall-ambiguous-kb-');
    const stateDir = temporaryDirectory('akno-graph-recall-ambiguous-state-');
    write(
      root,
      'products/zephyr-one.md',
      `---
title: Zephyr One
type: product
akno:
  aliases: [Zephyr]
---

Zephyr warranty alpha record links to [[topics/alpha-marker]].
`,
    );
    write(
      root,
      'products/zephyr-two.md',
      `---
title: Zephyr Two
type: product
akno:
  aliases: [Zephyr]
---

Zephyr warranty beta record links to [[topics/beta-marker]].
`,
    );
    write(root, 'topics/alpha-marker.md', '# Alpha Marker\n\nInvented alpha detail.\n');
    write(root, 'topics/beta-marker.md', '# Beta Marker\n\nInvented beta detail.\n');
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const result = await memory.recall({
      query: 'Zephyr warranty',
      mode: 'lookup',
      expand: false,
      graph: true,
    });
    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('entity_resolution_failed');
    expect(result.results.every((candidate) => !candidate.matched_by?.includes('graph'))).toBe(true);
    expect(result.results.every((candidate) => !candidate.graph_paths?.length)).toBe(true);
    await memory.close();
  });
});

function graphRecallFixture(): { root: string; stateDir: string } {
  const root = temporaryDirectory('akno-graph-recall-kb-');
  const stateDir = temporaryDirectory('akno-graph-recall-state-');
  write(
    root,
    'people/ada-marlow.md',
    `---
title: Ada Marlow
type: person
---

# Ada Marlow

The albatross conduit begins here and points to [[organizations/vulpine-mutual]].
`,
  );
  write(
    root,
    'organizations/vulpine-mutual.md',
    `---
title: Vulpine Mutual
type: organization
---

# Vulpine Mutual

Continue with [[products/zephyr-qx-100]].
`,
  );
  write(
    root,
    'products/zephyr-qx-100.md',
    `---
title: Zephyr QX-100
type: product
---

# Zephyr QX-100

Silver mechanism carries opaque marker glimmer.
`,
  );
  write(root, 'places/blackwater-bay.md', '# Blackwater Bay\n\nAn unrelated invented harbor note.\n');
  return { root, stateDir };
}

function resultIdentity(result: { type: 'page'; slug: string } | { type: 'document'; path: string }): string {
  return result.type === 'page' ? result.slug : result.path;
}

function write(root: string, relPath: string, content: string): void {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

function temporaryDirectory(prefix: string): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(target);
  return target;
}

function openFixture(root: string, stateDir: string) {
  return open({
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
    },
  });
}
