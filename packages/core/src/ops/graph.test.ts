import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GraphOutput } from '@tenphi/akno-protocol';
import { rebuildEvidenceGraph } from '../index/graph.ts';
import { open } from '../open.ts';
import { openStore } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('graph operation', () => {
  it('returns exact bounded paths and locators without copying evidence text', async () => {
    const { root, stateDir } = graphFixture();
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const result = await memory.graph({ slug: 'people/ada-marlow', max_hops: 2 });
    GraphOutput.parse(result);
    expect(result.status).toBe('ok');
    expect(result.seeds).toHaveLength(1);
    expect(result.nodes.find((node) => node.id === result.seeds[0]!.node)).toMatchObject({
      kind: 'page',
      slug: 'people/ada-marlow',
      label: 'Ada Marlow',
    });
    expect(result.paths.some((entry) => entry.hops === 2)).toBe(true);
    expect(result.edges.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining(['canonical_record', 'about', 'links_to', 'mentions']),
    );
    expect(result.edges.find((edge) => edge.relation === 'links_to')?.evidence).toMatchObject({
      kind: 'page_line',
      slug: 'people/ada-marlow',
      line_start: 10,
      field: 'wikilink',
    });
    expect(JSON.stringify(result)).not.toContain('private invented evidence sentence');
    await memory.close();
  });

  it('finds exact entity phrases in a longer query and obeys direction and relation filters', async () => {
    const { root, stateDir } = graphFixture();
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const query = await memory.graph({
      query: 'What is recorded about the Zephyr QX-100 warranty?',
      max_hops: 1,
    });
    expect(query.status).toBe('ok');
    expect(query.nodes.find((node) => node.id === query.seeds[0]!.node)).toMatchObject({
      kind: 'entity',
      slug: 'products/zephyr-qx-100',
    });

    const incoming = await memory.graph({
      query: 'Zephyr QX-100',
      direction: 'in',
      relations: ['mentions'],
      max_hops: 1,
    });
    expect(incoming.paths).toHaveLength(1);
    expect(incoming.edges[0]).toMatchObject({ relation: 'mentions' });

    const outgoing = await memory.graph({
      query: 'Zephyr QX-100',
      direction: 'out',
      relations: ['mentions'],
    });
    expect(outgoing).toMatchObject({ status: 'empty', reason: 'no_paths', paths: [] });
    await memory.close();
  });

  it('returns ambiguous exact names as candidates instead of choosing one', async () => {
    const root = temporaryDirectory('akno-graph-ambiguous-kb-');
    const stateDir = temporaryDirectory('akno-graph-ambiguous-state-');
    write(
      root,
      'products/zephyr-one.md',
      '---\ntitle: Zephyr One\ntype: product\nakno:\n  aliases: [Zephyr]\n---\n\nInvented one.\n',
    );
    write(
      root,
      'products/zephyr-two.md',
      '---\ntitle: Zephyr Two\ntype: product\nakno:\n  aliases: [Zephyr]\n---\n\nInvented two.\n',
    );
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const result = await memory.graph({ query: 'Zephyr warranty' });
    expect(result).toMatchObject({
      status: 'degraded',
      degraded: ['entity_resolution_failed'],
      reason: 'seed_not_found',
      seeds: [],
      paths: [],
    });
    expect(result.ambiguities).toHaveLength(1);
    expect(result.ambiguities[0]!.candidates.map((candidate) => candidate.slug).sort()).toEqual([
      'products/zephyr-one',
      'products/zephyr-two',
    ]);
    await memory.close();
  });

  it('makes hub fan-out truncation explicit', async () => {
    const root = temporaryDirectory('akno-graph-hub-kb-');
    const stateDir = temporaryDirectory('akno-graph-hub-state-');
    const links: string[] = [];
    for (let index = 0; index < 60; index++) {
      const slug = `topics/invented-topic-${String(index).padStart(3, '0')}`;
      links.push(`[[${slug}]]`);
      write(root, `${slug}.md`, `# Invented Topic ${String(index).padStart(3, '0')}\n`);
    }
    write(
      root,
      'sources/invented-hub.md',
      `---\ntitle: Invented Hub\nakno:\n  role: source\n---\n\n${links.join('\n')}\n`,
    );
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const result = await memory.graph({ slug: 'sources/invented-hub', max_hops: 1, limit: 100 });
    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('graph_traversal_limited');
    expect(result.truncated).toBe(true);
    expect(result.paths).toHaveLength(50);
    await memory.close();
  });

  it('excludes superseded facts by default and labels them when history is requested', async () => {
    const { root, stateDir } = graphFixture();
    let memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });
    await memory.close();

    const store = openStore({ dbPath: path.join(stateDir, 'akno.db'), embeddingDimensions: 1024 });
    const page = store.db.prepare("SELECT id FROM pages WHERE slug = 'people/ada-marlow'").get() as {
      id: string;
    };
    store.db.prepare('UPDATE pages SET derived_hash = body_hash WHERE id = ?').run(page.id);
    const claim = 'Ada Marlow previously worked with Vulpine Mutual.';
    store.db
      .prepare(
        `INSERT INTO facts(
           id, page_id, claim, subject, attribute, value, line_start, line_end,
           source_line_hash, confidence, valid_from, valid_to, first_seen, last_seen
         ) VALUES('fac_invented_history', ?, ?, 'Ada Marlow', 'Worked with', 'Vulpine Mutual',
                  11, 11, ?, 0.9, '2028-01-01', '2029-01-01', ?, ?)`,
      )
      .run(page.id, claim, sha256(claim), '2028-01-01T00:00:00.000Z', '2029-01-01T00:00:00.000Z');
    rebuildEvidenceGraph(store);
    store.close();

    memory = await openFixture(root, stateDir);
    const current = await memory.graph({
      query: 'Ada Marlow',
      relations: ['related_entity'],
      max_hops: 1,
    });
    expect(current.paths).toHaveLength(0);

    const historical = await memory.graph({
      query: 'Ada Marlow',
      relations: ['related_entity'],
      max_hops: 1,
      include_history: true,
    });
    expect(historical.status).toBe('ok');
    expect(historical.edges).toEqual([
      expect.objectContaining({
        relation: 'related_entity',
        predicate: 'worked_with',
        historical: true,
        valid_to: '2029-01-01',
      }),
    ]);
    await memory.close();
  });

  it('distinguishes a complete miss from a partially rebuilt graph', async () => {
    const { root, stateDir } = graphFixture();
    let memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });

    const missing = await memory.graph({ slug: 'people/no-invented-record' });
    expect(missing).toMatchObject({ status: 'empty', reason: 'seed_not_found' });
    await memory.close();

    const store = openStore({ dbPath: path.join(stateDir, 'akno.db'), embeddingDimensions: 1024 });
    store.db
      .prepare("DELETE FROM graph_nodes WHERE id = (SELECT id FROM graph_nodes WHERE kind = 'page' LIMIT 1)")
      .run();
    store.close();

    memory = await openFixture(root, stateDir);
    const partial = await memory.graph({ slug: 'people/no-invented-record' });
    expect(partial.status).toBe('degraded');
    expect(partial.degraded).toContain('partial_graph_index');
    await memory.close();
  });
});

function graphFixture(): { root: string; stateDir: string } {
  const root = temporaryDirectory('akno-graph-op-kb-');
  const stateDir = temporaryDirectory('akno-graph-op-state-');
  write(
    root,
    'people/ada-marlow.md',
    `---
title: Ada Marlow
type: person
akno:
  about: [organizations/vulpine-mutual]
---

# Ada Marlow

Private invented evidence sentence. See [[products/zephyr-qx-100]].
`,
  );
  write(root, 'organizations/vulpine-mutual.md', '# Vulpine Mutual\n\nInvented organization.\n');
  write(root, 'products/zephyr-qx-100.md', '# Zephyr QX-100\n\nInvented product.\n');
  return { root, stateDir };
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
