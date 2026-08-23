import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { open } from '../open.ts';
import { normalizeEntityName, resolveExactEntity } from './graph.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('structural evidence graph', () => {
  it('indexes exact page, document, and event relationships and removes stale evidence', async () => {
    const root = fixtureCorpus();
    const stateDir = temporaryDirectory('akno-graph-state-');
    let memory = await openFixture(root, stateDir);
    const report = await memory.index({ structuralOnly: true });
    await memory.close();

    expect(report).toMatchObject({
      graphNodes: 8,
      graphEdges: 9,
      graphEntities: 3,
      graphMentions: 2,
      graphAmbiguousMentions: 0,
      graphUnresolvedMentions: 0,
    });

    let db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    const edges = graphEdges(db);
    expect(edges.map(edgeSignature)).toEqual([
      'document:people/ada-marlow.txt -owns_document-> page:people/ada-marlow',
      'entity:organizations/vulpine-mutual -canonical_record:other-> page:organizations/vulpine-mutual',
      'entity:people/ada-marlow -canonical_record:other-> page:people/ada-marlow',
      'entity:products/zephyr-qx-100 -canonical_record:other-> page:products/zephyr-qx-100',
      'page:people/ada-marlow -about-> entity:organizations/vulpine-mutual',
      'page:people/ada-marlow -links_to:wikilink-> page:products/zephyr-qx-100',
      'page:people/ada-marlow -mentions:wikilink-> entity:products/zephyr-qx-100',
      'page:people/ada-marlow -participates_in:source-> event:event',
      'page:products/zephyr-qx-100 -participates_in:target-> event:event',
    ]);
    expect(edges.every((edge) => /^[a-f0-9]{64}$/.test(edge.source_hash))).toBe(true);
    expect(edges.find((edge) => edge.relation === 'links_to')).toMatchObject({
      source_kind: 'page_line',
      line_start: 9,
      line_end: 9,
      source_field: 'wikilink',
      resolution: 'exact',
      confidence: 1,
    });
    expect(edges.some((edge) => edge.to_identity === 'missing/no-record')).toBe(false);
    db.close();

    fs.writeFileSync(
      path.join(root, 'people/ada-marlow.md'),
      `---\ntitle: Ada Marlow\n---\n\n# Ada Marlow\n\nNo structural relationships remain.\n`,
    );
    memory = await openFixture(root, stateDir);
    const changed = await memory.index({ structuralOnly: true, verify: true });
    await memory.close();

    expect(changed).toMatchObject({
      graphNodes: 7,
      graphEdges: 4,
      graphEntities: 3,
      graphMentions: 0,
      graphAmbiguousMentions: 0,
      graphUnresolvedMentions: 0,
    });
    db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    expect(graphEdges(db).map(edgeSignature)).toEqual([
      'document:people/ada-marlow.txt -owns_document-> page:people/ada-marlow',
      'entity:organizations/vulpine-mutual -canonical_record:other-> page:organizations/vulpine-mutual',
      'entity:people/ada-marlow -canonical_record:other-> page:people/ada-marlow',
      'entity:products/zephyr-qx-100 -canonical_record:other-> page:products/zephyr-qx-100',
    ]);
    expect(db.prepare("SELECT count(*) AS count FROM graph_nodes WHERE kind = 'event'").get()).toEqual({
      count: 0,
    });
    db.close();
  });

  it('rebuilds equivalent structural paths from the same source tree', async () => {
    const root = fixtureCorpus();
    const firstState = temporaryDirectory('akno-graph-first-');
    const secondState = temporaryDirectory('akno-graph-second-');

    const first = await openFixture(root, firstState);
    await first.index({ structuralOnly: true });
    await first.close();
    const second = await openFixture(root, secondState);
    await second.index({ structuralOnly: true });
    await second.close();

    const firstDb = new Database(path.join(firstState, 'akno.db'), { readonly: true });
    const secondDb = new Database(path.join(secondState, 'akno.db'), { readonly: true });
    expect(graphEdges(firstDb).map(edgeSignature)).toEqual(graphEdges(secondDb).map(edgeSignature));
    firstDb.close();
    secondDb.close();
  });

  it('keeps an entity id with its canonical page across a file move', async () => {
    const root = temporaryDirectory('akno-entity-move-kb-');
    const stateDir = temporaryDirectory('akno-entity-move-state-');
    write(
      root,
      'projects/blackwater-design.md',
      `---
title: Blackwater Design
type: concept
---

# Blackwater Design

An invented design record.
`,
    );
    let memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });
    await memory.close();

    let db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    const before = db
      .prepare(
        `SELECT e.id, e.entity_type
           FROM graph_entities e
           JOIN pages p ON p.id = e.canonical_page
          WHERE p.slug = 'projects/blackwater-design'`,
      )
      .get() as { id: string; entity_type: string };
    expect(before.entity_type).toBe('concept');
    db.close();

    fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
    fs.renameSync(
      path.join(root, 'projects/blackwater-design.md'),
      path.join(root, 'archive/blackwater-design.md'),
    );
    memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true, verify: true });
    await memory.close();

    db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    const after = db
      .prepare(
        `SELECT e.id, p.slug
           FROM graph_entities e
           JOIN pages p ON p.id = e.canonical_page`,
      )
      .get() as { id: string; slug: string };
    expect(after).toEqual({ id: before.id, slug: 'archive/blackwater-design' });
    expect(resolveExactEntity(db, 'archive/blackwater-design')).toMatchObject({
      status: 'resolved',
      entityId: before.id,
      signal: 'canonical_slug',
    });
    expect(resolveExactEntity(db, 'projects/blackwater-design')).toMatchObject({ status: 'unresolved' });
    db.close();
  });

  it('resolves declared identities exactly and abstains when aliases are ambiguous', async () => {
    expect(normalizeEntityName('ＡＤＡ—Marlow')).toBe('ada marlow');
    const root = entityFixtureCorpus();
    const stateDir = temporaryDirectory('akno-entity-state-');
    let memory = await openFixture(root, stateDir);
    const report = await memory.index({ structuralOnly: true });
    await memory.close();

    expect(report).toMatchObject({
      graphEntities: 3,
      graphMentions: 4,
      graphAmbiguousMentions: 1,
      graphUnresolvedMentions: 1,
    });

    let db = new Database(path.join(stateDir, 'akno.db'));
    const entityIds = Object.fromEntries(
      (
        db
          .prepare(
            `SELECT p.slug, e.id
               FROM graph_entities e
               JOIN pages p ON p.id = e.canonical_page`,
          )
          .all() as { slug: string; id: string }[]
      ).map((row) => [row.slug, row.id]),
    );
    expect(resolveExactEntity(db, '/PEOPLE/ADA-MARLOW.md#Profile')).toEqual({
      status: 'resolved',
      normalized: 'people ada marlow',
      entityId: entityIds['people/ada-marlow'],
      candidates: [entityIds['people/ada-marlow']],
      signal: 'canonical_slug',
    });
    expect(resolveExactEntity(db, 'A. MARLOW')).toMatchObject({
      status: 'resolved',
      entityId: entityIds['people/ada-marlow'],
      signal: 'alias',
    });
    expect(resolveExactEntity(db, 'Ada Marlow')).toMatchObject({
      status: 'resolved',
      entityId: entityIds['people/ada-marlow'],
      signal: 'title',
    });
    const ambiguous = resolveExactEntity(db, 'Zephyr');
    expect(ambiguous).toMatchObject({ status: 'ambiguous', signal: 'alias' });
    expect(ambiguous.candidates).toEqual(
      expect.arrayContaining([entityIds['products/zephyr-one'], entityIds['products/zephyr-two']]),
    );
    expect(resolveExactEntity(db, 'Missing Subject')).toEqual({
      status: 'unresolved',
      normalized: 'missing subject',
      candidates: [],
    });

    const mentions = db
      .prepare(
        `SELECT mention, resolution, signal, candidates
           FROM graph_mentions
          ORDER BY mention`,
      )
      .all() as { mention: string; resolution: string; signal: string | null; candidates: string }[];
    expect(mentions).toEqual([
      {
        mention: 'A. MARLOW',
        resolution: 'exact',
        signal: 'alias',
        candidates: JSON.stringify([entityIds['people/ada-marlow']]),
      },
      { mention: 'Missing Subject', resolution: 'unresolved', signal: null, candidates: '[]' },
      {
        mention: 'Zephyr',
        resolution: 'ambiguous',
        signal: 'alias',
        candidates: JSON.stringify(ambiguous.candidates),
      },
      {
        mention: 'people/ada-marlow',
        resolution: 'exact',
        signal: 'canonical_slug',
        candidates: JSON.stringify([entityIds['people/ada-marlow']]),
      },
    ]);
    expect(db.prepare("SELECT count(*) AS count FROM graph_edges WHERE relation = 'about'").get()).toEqual({
      count: 1,
    });
    db.close();

    fs.writeFileSync(
      path.join(root, 'people/ada-marlow.md'),
      `---\ntitle: Ada Marlow\ntype: person\n---\n\n# Ada Marlow\n\nInvented profile.\n`,
    );
    memory = await openFixture(root, stateDir);
    const changed = await memory.index({ structuralOnly: true, verify: true });
    await memory.close();

    expect(changed).toMatchObject({
      graphMentions: 4,
      graphAmbiguousMentions: 1,
      graphUnresolvedMentions: 2,
    });
    db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    expect(db.prepare("SELECT count(*) AS count FROM graph_edges WHERE relation = 'about'").get()).toEqual({
      count: 0,
    });
    expect(resolveExactEntity(db, 'A. MARLOW')).toEqual({
      status: 'unresolved',
      normalized: 'a marlow',
      candidates: [],
    });
    db.close();
  });
});

interface EdgeRow {
  relation: string;
  predicate: string | null;
  source_kind: string;
  line_start: number | null;
  line_end: number | null;
  source_field: string | null;
  source_hash: string;
  resolution: string;
  confidence: number;
  from_kind: string;
  from_identity: string;
  to_kind: string;
  to_identity: string;
}

function graphEdges(db: Database.Database): EdgeRow[] {
  return db
    .prepare(
      `SELECT e.relation, e.predicate, e.source_kind, e.line_start, e.line_end,
              e.source_field, e.source_hash, e.resolution, e.confidence,
              source.kind AS from_kind,
              CASE source.kind
                WHEN 'page' THEN source_page.slug
                WHEN 'document' THEN source_document.rel_path
                WHEN 'entity' THEN source_entity_page.slug
                ELSE 'event'
              END AS from_identity,
              target.kind AS to_kind,
              CASE target.kind
                WHEN 'page' THEN target_page.slug
                WHEN 'document' THEN target_document.rel_path
                WHEN 'entity' THEN target_entity_page.slug
                ELSE 'event'
              END AS to_identity
         FROM graph_edges e
         JOIN graph_nodes source ON source.id = e.from_node
         JOIN graph_nodes target ON target.id = e.to_node
         LEFT JOIN pages source_page ON source.kind = 'page' AND source_page.id = source.source_id
         LEFT JOIN documents source_document
                ON source.kind = 'document' AND source_document.id = source.source_id
         LEFT JOIN graph_entities source_entity
                ON source.kind = 'entity' AND source_entity.id = source.source_id
         LEFT JOIN pages source_entity_page ON source_entity_page.id = source_entity.canonical_page
         LEFT JOIN pages target_page ON target.kind = 'page' AND target_page.id = target.source_id
         LEFT JOIN documents target_document
                ON target.kind = 'document' AND target_document.id = target.source_id
         LEFT JOIN graph_entities target_entity
                ON target.kind = 'entity' AND target_entity.id = target.source_id
         LEFT JOIN pages target_entity_page ON target_entity_page.id = target_entity.canonical_page
        ORDER BY from_kind, from_identity, e.relation, e.predicate, to_kind, to_identity`,
    )
    .all() as EdgeRow[];
}

function edgeSignature(edge: EdgeRow): string {
  const predicate = edge.predicate ? `:${edge.predicate}` : '';
  return `${edge.from_kind}:${edge.from_identity} -${edge.relation}${predicate}-> ${edge.to_kind}:${edge.to_identity}`;
}

function fixtureCorpus(): string {
  const root = temporaryDirectory('akno-graph-kb-');
  write(
    root,
    'people/ada-marlow.md',
    `---
title: Ada Marlow
akno:
  about: [organizations/vulpine-mutual]
---

# Ada Marlow

Uses [[products/zephyr-qx-100]] and references [[missing/no-record]].

- **2031-04-05** | Reviewed the warranty. [[products/zephyr-qx-100]]
`,
  );
  write(root, 'organizations/vulpine-mutual.md', '# Vulpine Mutual\n\nAn invented organization.\n');
  write(root, 'products/zephyr-qx-100.md', '# Zephyr QX-100\n\nAn invented product.\n');
  write(root, 'people/ada-marlow.txt', 'Invented attachment evidence.\n');
  return root;
}

function entityFixtureCorpus(): string {
  const root = temporaryDirectory('akno-entity-kb-');
  write(
    root,
    'people/ada-marlow.md',
    `---
title: Ada Marlow
type: person
akno:
  aliases: [A. Marlow]
---

# Ada Marlow

Invented profile.
`,
  );
  write(
    root,
    'products/zephyr-one.md',
    `---
title: Zephyr One
type: product
akno:
  aliases: [Zephyr]
---

# Zephyr One
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

# Zephyr Two
`,
  );
  write(
    root,
    'sources/research-note.md',
    `---
title: Invented Research Note
akno:
  role: source
  about: [A. MARLOW, Zephyr, Missing Subject]
---

# Invented Research Note

See [[people/ada-marlow]].
`,
  );
  return root;
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
