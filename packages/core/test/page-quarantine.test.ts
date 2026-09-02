import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

const temporary: string[] = [];
let current: Akno | null = null;

afterEach(async () => {
  await current?.close();
  current = null;
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

async function memory(
  pages: Record<string, string>,
  conflictPathPatterns: string[] = [],
  folders: Record<string, { role: 'knowledge' | 'source' | 'ignored'; remember?: 'deny' | 'integrate' }> = {},
  writeIds = false,
): Promise<{ mem: Akno; root: string; stateDir: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-quarantine-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-quarantine-state-'));
  temporary.push(root, stateDir);
  for (const [relPath, content] of Object.entries(pages)) {
    const absolute = path.join(root, relPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
  }
  const mem = await open({
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
      index: { conflict_path_patterns: conflictPathPatterns },
      folders,
      write_ids: writeIds,
    },
  });
  current = mem;
  return { mem, root, stateDir };
}

function page(id: string, body: string): string {
  return `---\nid: ${id}\ntitle: Ada Marlow\n---\n\n# Ada Marlow\n\n${body}\n`;
}

describe('pre-index Markdown quarantine', () => {
  it('makes an established page inert without changing its bytes, then restores the same identity', async () => {
    const initial = page('page-ada-1111', '## Preferences\n\nKeeps a Zephyr QX-100 at Blackwater Bay.');
    const { mem, root, stateDir } = await memory(
      {
        'people/ada-marlow.md': initial,
        'people/ada-marlow-11111111.txt': 'Invented attachment text.',
      },
      [],
      { 'people/**': { role: 'knowledge', remember: 'integrate' } },
    );
    await mem.index({ structuralOnly: true });
    const id = (await mem.read({ slug: 'people/ada-marlow' })).page!.id;

    const conflicted = page(
      'page-ada-1111',
      '<<<<<<< local\nKeeps a Zephyr QX-100.\n=======\nKeeps a Zephyr QX-200.\n>>>>>>> remote',
    );
    const absolute = path.join(root, 'people/ada-marlow.md');
    fs.writeFileSync(absolute, conflicted, 'utf8');
    const report = await mem.index({ structuralOnly: true, only: ['people/ada-marlow.md'] });

    expect(report.quarantine).toMatchObject({
      candidates: 1,
      byReason: { inline_merge_conflict: 1 },
    });
    expect(fs.readFileSync(absolute, 'utf8')).toBe(conflicted);
    const quarantinedRead = await mem.read({ slug: 'people/ada-marlow' });
    expect(quarantinedRead).toMatchObject({
      status: 'degraded',
      degraded: ['source_conflict'],
    });
    expect(quarantinedRead.page).toBeUndefined();
    const index = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    expect(
      index
        .prepare(
          `SELECT
             (SELECT count(*) FROM chunks WHERE page_id = ?) AS chunks,
             (SELECT count(*) FROM facts WHERE page_id = ?) AS facts,
             (SELECT count(*) FROM events WHERE source_page = ?) AS events,
             (SELECT count(*) FROM temporal_entries WHERE source_page = ?) AS temporal,
             (SELECT count(*) FROM observation_entries WHERE source_page = ?) AS observations,
             (SELECT count(*) FROM managed_memory_entries WHERE source_page = ?) AS memories,
             (SELECT count(*) FROM graph_nodes WHERE kind = 'page' AND source_id = ?) AS graph_pages`,
        )
        .get(id, id, id, id, id, id, id),
    ).toEqual({ chunks: 0, facts: 0, events: 0, temporal: 0, observations: 0, memories: 0, graph_pages: 0 });
    index.close();
    const recalled = await mem.recall({ query: 'Zephyr QX-200' });
    expect(recalled.status).toBe('degraded');
    expect(recalled.degraded).toContain('source_conflict');
    expect(recalled.results).toHaveLength(0);
    const context = await mem.context({
      pinned: ['people/ada-marlow'],
      structure: false,
      timeline_days: 0,
    });
    expect(context.status).toBe('degraded');
    expect(context.degraded).toContain('source_conflict');
    const graph = await mem.graph({ slug: 'people/ada-marlow' });
    expect(graph.status).toBe('degraded');
    expect(graph.degraded).toContain('source_conflict');
    const unrelatedGraph = await mem.graph({ query: 'Bo Winters' });
    expect(unrelatedGraph.status).toBe('degraded');
    expect(unrelatedGraph.degraded).toContain('source_conflict');
    await expect(
      mem.move({ from: 'people/ada-marlow', to: 'people/ada-marlow-archive' }),
    ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'source_conflict' } });
    await expect(mem.forget({ slug: 'people/ada-marlow' })).rejects.toMatchObject({
      code: 'conflict',
      details: { reason: 'source_conflict' },
    });
    await expect(
      mem.write({ slug: 'people/ada-marlow', append: 'Owns another item.' }),
    ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'source_conflict' } });
    const retained = await mem.retain({
      sources: [
        {
          source_id: 'chat:quarantine-1111',
          revision: '1',
          input: { text: 'Ada Marlow prefers tea.' },
          retention: {
            mode: 'provided',
            placement: 'exact',
            candidates: [
              {
                candidate_id: 'tea-preference',
                kind: 'preference',
                text: 'Ada Marlow prefers tea.',
                subject: 'Ada Marlow',
                attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
                discourse: { commitment: 'asserted', disposition: 'active' },
                epistemic: { basis: 'self_attested' },
                support: [{ quote: 'Ada Marlow prefers tea.' }],
                discourse_frame: [{ quote: 'Ada Marlow prefers tea.' }],
                destination: { slug: 'people/ada-marlow', section: 'Preferences' },
              },
            ],
          },
        },
      ],
    });
    expect(retained.sources[0]).toMatchObject({
      outcome: 'held',
      candidates: [expect.objectContaining({ outcome: 'held' })],
    });
    expect(fs.readFileSync(absolute, 'utf8')).toBe(conflicted);
    expect((await mem.list({ kind: 'pages' })).pages).toEqual([]);

    fs.writeFileSync(absolute, initial.replace('Blackwater Bay', 'Blackwater Harbour'), 'utf8');
    const repaired = await mem.index({ structuralOnly: true, only: ['people/ada-marlow.md'] });
    expect(repaired.quarantine.candidates).toBe(0);
    const restored = await mem.read({ slug: 'people/ada-marlow' });
    expect(restored.status).toBe('ok');
    expect(restored.page?.id).toBe(id);
    expect(restored.page?.lines.some((line) => line.text.includes('Blackwater Harbour'))).toBe(true);

    const markerBlock = '<<<<<<< local\nTea\n=======\nCoffee\n>>>>>>> remote';
    await expect(
      mem.write({ slug: 'people/conflict-example', content: `# Conflict example\n\n${markerBlock}\n` }),
    ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'source_conflict' } });
    const literal = await mem.write({
      slug: 'people/conflict-example',
      content: `# Conflict example\n\n\`\`\`text\n${markerBlock}\n\`\`\`\n`,
    });
    expect(literal.outcome).toBe('ok');
    expect((await mem.read({ slug: 'people/conflict-example' })).status).toBe('ok');
  });

  it('quarantines owner-configured sync-copy paths before parsing and exposes paths only on request', async () => {
    const relPath = 'Archive/Café/Conflict-1111.md';
    const content = '---\nthis: [is: not valid YAML\n---\nprivate fixture body\n';
    const { mem, root } = await memory({ [relPath]: content }, ['archive\\**\\CONFLICT-*.MD']);
    const report = await mem.index({ structuralOnly: true });
    expect(report.quarantine.byReason.sync_conflict_path).toBe(1);
    expect(fs.readFileSync(path.join(root, relPath), 'utf8')).toBe(content);

    const ordinary = await mem.doctor({ probeModels: false });
    expect(ordinary.quarantine).not.toHaveProperty('details');
    expect(JSON.stringify(ordinary.quarantine)).not.toContain(relPath);
    const privateReport = await mem.doctor({ probeModels: false, quarantineDetails: true });
    expect(privateReport.quarantine.details).toEqual([
      expect.objectContaining({ relPath, reasons: ['sync_conflict_path'] }),
    ]);
    await expect(
      mem.write({ slug: 'Archive/Café/Conflict-1111', content: '# Replacement\n' }),
    ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'source_conflict' } });
    expect(fs.readFileSync(path.join(root, relPath), 'utf8')).toBe(content);
  });

  it('keeps a quarantined timeline out of unified time and event writes', async () => {
    const content = '# Timeline\n\n- **2031-04-12** | Ada Marlow visited Blackwater Bay.\n';
    const { mem, root } = await memory({ 'timeline.md': content }, ['timeline.md']);
    const report = await mem.index({ structuralOnly: true });
    expect(report.quarantine.byReason.sync_conflict_path).toBe(1);

    const timeline = await mem.timeline({ source: 'event' });
    expect(timeline.status).toBe('degraded');
    expect(timeline.degraded).toContain('source_conflict');
    expect(timeline.results).toEqual([]);
    await expect(
      mem.write({ event: { date: '2031-04-13', summary: 'Ada Marlow returned home.' } }),
    ).rejects.toMatchObject({ code: 'conflict', details: { reason: 'source_conflict' } });
    expect(fs.readFileSync(path.join(root, 'timeline.md'), 'utf8')).toBe(content);
  });

  it('quarantines every duplicate stable-id candidate without a scan-order winner', async () => {
    const left = page('page-shared-2222', 'Ada Marlow prefers tea.');
    const right = page('page-shared-2222', 'Ada Marlow prefers coffee.');
    const { mem, root, stateDir } = await memory({
      'people/ada-marlow.md': left,
      'people/ada-copy.md': right,
    });
    const first = await mem.index({ structuralOnly: true });
    expect(first.quarantine).toMatchObject({
      candidates: 2,
      byReason: { duplicate_page_id_different_bytes: 2 },
    });
    expect((await mem.list({ kind: 'pages' })).pages).toEqual([]);
    expect(await mem.read({ slug: 'people/ada-marlow' })).toMatchObject({
      status: 'degraded',
      degraded: ['source_conflict'],
    });
    expect(await mem.read({ id: 'page-shared-2222' })).toMatchObject({
      status: 'degraded',
      degraded: ['source_conflict'],
    });
    expect(await mem.graph({ slug: 'people/ada-copy' })).toMatchObject({
      status: 'degraded',
      degraded: expect.arrayContaining(['source_conflict']),
    });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(left);
    expect(fs.readFileSync(path.join(root, 'people/ada-copy.md'), 'utf8')).toBe(right);

    await mem.close();
    current = null;
    const reopened = await open({
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
    current = reopened;
    const rebuilt = await reopened.index({ structuralOnly: true, rebuild: true });
    expect(rebuilt.quarantine.byReason.duplicate_page_id_different_bytes).toBe(2);

    fs.rmSync(path.join(root, 'people/ada-copy.md'));
    const repaired = await reopened.index({ structuralOnly: true, only: ['people/ada-copy.md'] });
    expect(repaired.quarantine.candidates).toBe(0);
    expect((await reopened.read({ slug: 'people/ada-marlow' })).status).toBe('ok');
  });

  it('preserves an established identity when a later file collides, then indexes both after repair', async () => {
    const established = page('page-shared-4444', 'Ada Marlow prefers tea.');
    const collision = page('page-shared-4444', 'Bo Winters prefers coffee.');
    const { mem, root } = await memory({ 'people/ada-marlow.md': established });
    await mem.index({ structuralOnly: true });
    const establishedId = (await mem.read({ slug: 'people/ada-marlow' })).page!.id;

    fs.writeFileSync(path.join(root, 'people/bo-winters.md'), collision, 'utf8');
    const conflicted = await mem.index({ structuralOnly: true, only: ['people/bo-winters.md'] });
    expect(conflicted.quarantine.byReason.duplicate_page_id_different_bytes).toBe(2);
    expect(await mem.read({ slug: 'people/ada-marlow' })).toMatchObject({
      status: 'degraded',
      degraded: ['source_conflict'],
    });
    expect(await mem.read({ slug: 'people/bo-winters' })).toMatchObject({
      status: 'degraded',
      degraded: ['source_conflict'],
    });

    fs.writeFileSync(
      path.join(root, 'people/bo-winters.md'),
      page('page-bo-5555', 'Bo Winters prefers coffee.'),
      'utf8',
    );
    const repaired = await mem.index({ structuralOnly: true, only: ['people/bo-winters.md'] });
    expect(repaired.quarantine.candidates).toBe(0);
    expect((await mem.read({ slug: 'people/ada-marlow' })).page?.id).toBe(establishedId);
    expect((await mem.read({ slug: 'people/bo-winters' })).page?.id).toBe('page-bo-5555');
  });

  it('quarantines identical duplicate ids but ignores non-indexed template identities', async () => {
    const canonical = page('page-shared-3333', 'Vulpine Mutual offers a five-year warranty.');
    const { mem, root } = await memory(
      {
        'people/ada-marlow.md': canonical,
        'people/ada-copy.md': canonical,
        'templates/ada.md': canonical,
        'templates/conflicted.md':
          '# Literal template\n\n<<<<<<< local\nTea\n=======\nCoffee\n>>>>>>> remote\n',
      },
      [],
      { 'templates/**': { role: 'ignored' } },
    );
    const report = await mem.index({ structuralOnly: true });
    expect(report.quarantine).toMatchObject({
      candidates: 2,
      byReason: { duplicate_page_id_same_bytes: 2 },
    });
    const details = await mem.doctor({ probeModels: false, quarantineDetails: true });
    expect(details.quarantine.details?.map((entry) => entry.relPath).sort()).toEqual([
      'people/ada-copy.md',
      'people/ada-marlow.md',
    ]);

    fs.rmSync(path.join(root, 'people/ada-copy.md'));
    await mem.index({ structuralOnly: true, only: ['people/ada-copy.md'] });
    expect((await mem.list({ kind: 'pages' })).pages?.map((entry) => entry.slug)).toEqual([
      'people/ada-marlow',
    ]);
  });

  it('classifies a copy of an Akno-written identity from the post-write bytes', async () => {
    const { mem, root } = await memory(
      { 'people/ada-marlow.md': '# Ada Marlow\n\nPrefers tea.\n' },
      [],
      {},
      true,
    );
    await mem.index({ structuralOnly: true });
    const canonical = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    expect(canonical).toContain('id:');
    fs.writeFileSync(path.join(root, 'people/ada-copy.md'), canonical, 'utf8');

    const report = await mem.index({ structuralOnly: true, only: ['people/ada-copy.md'] });
    expect(report.quarantine.byReason.duplicate_page_id_same_bytes).toBe(2);
    expect(report.quarantine.byReason.duplicate_page_id_different_bytes).toBe(0);
  });
});
