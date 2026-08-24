import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { open } from '../open.ts';
import { CONFLICT_PROMPT_VERSION, findCrossPageConflictsInStore } from '../maintenance/conflicts.ts';
import { openStore } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';
import type { ModelClient } from '../models/client.ts';
import { resolveContextualEntityMentions } from './entity-resolution.ts';
import { normalizeEntityName, rebuildEvidenceGraph, resolveExactEntity } from './graph.ts';

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

  it('projects a cached contextual choice with provenance and reuses it without another model call', async () => {
    const root = contextualEntityFixtureCorpus();
    const stateDir = temporaryDirectory('akno-contextual-entity-state-');
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });
    await memory.close();

    const store = openStore({ dbPath: path.join(stateDir, 'akno.db'), embeddingDimensions: 1024 });
    let calls = 0;
    const model = {
      available: true,
      modelId: 'fixture-resolver',
      unavailableReason: null,
      chat: async (messages: { content: string }[]) => {
        calls++;
        const payload = JSON.parse(messages[1]!.content) as {
          candidates: { candidate_id: string; label: string }[];
        };
        return {
          ok: true,
          value: JSON.stringify({
            order: payload.candidates.map((candidate) => ({
              id: candidate.candidate_id,
              grade: candidate.label === 'Zephyr One' ? 3 : 0,
            })),
            rationale: 'distinguishing_evidence',
          }),
          latencyMs: 7,
        };
      },
    } as unknown as ModelClient;

    const first = await resolveContextualEntityMentions(store, model, {
      maxCandidates: 8,
      maxMentions: 20,
    });
    expect(first).toMatchObject({ considered: 1, resolved: 1, abstained: 0, cached: 0, failed: 0 });
    rebuildEvidenceGraph(store, { contextualModelId: 'fixture-resolver' });

    const mention = store.db
      .prepare(
        `SELECT resolution, confidence, decision_fingerprint, model_id, prompt_version
           FROM graph_mentions WHERE mention = 'Zephyr'`,
      )
      .get() as Record<string, unknown>;
    expect(mention).toMatchObject({
      resolution: 'contextual',
      confidence: 0.85,
      model_id: 'fixture-resolver',
    });
    expect(mention.decision_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(mention.prompt_version).toBe('entity-context-v1');
    expect(
      store.db.prepare("SELECT resolution, confidence FROM graph_edges WHERE relation = 'about'").get(),
    ).toEqual({ resolution: 'contextual', confidence: 0.85 });

    const second = await resolveContextualEntityMentions(store, model, {
      maxCandidates: 8,
      maxMentions: 20,
    });
    expect(second).toMatchObject({ considered: 0, resolved: 0, cached: 0, failed: 0 });
    expect(calls).toBe(1);
    store.close();

    fs.writeFileSync(
      path.join(root, 'products/zephyr-one.md'),
      `---
title: Zephyr One
type: product
akno:
  aliases: [Zephyr]
---

# Zephyr One

The invented warranty now lasts seven years.
`,
    );
    const changedMemory = await openFixture(root, stateDir);
    await changedMemory.index({ structuralOnly: true, verify: true });
    await changedMemory.close();
    const changedStore = openStore({
      dbPath: path.join(stateDir, 'akno.db'),
      embeddingDimensions: 1024,
    });
    const changed = await resolveContextualEntityMentions(changedStore, model, {
      maxCandidates: 8,
      maxMentions: 20,
    });
    expect(changed).toMatchObject({ considered: 1, resolved: 1, cached: 0, failed: 0 });
    expect(calls).toBe(2);
    expect(changedStore.db.prepare('SELECT count(*) AS count FROM graph_resolution_verdicts').get()).toEqual({
      count: 2,
    });
    changedStore.close();
  });

  it('marks fact edges contextual when an ambiguous fact subject is uniquely resolved', async () => {
    const root = contextualEntityFixtureCorpus();
    const stateDir = temporaryDirectory('akno-contextual-fact-state-');
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });
    await memory.close();

    const store = openStore({ dbPath: path.join(stateDir, 'akno.db'), embeddingDimensions: 1024 });
    const note = store.db.prepare("SELECT id FROM pages WHERE slug = 'notes/warranty'").get() as {
      id: string;
    };
    store.db.prepare("UPDATE pages SET about = '[]' WHERE id = ?").run(note.id);
    insertFact(store.db, {
      id: 'fac_contextual_warranty',
      slug: 'notes/warranty',
      line: 8,
      claim: 'Zephyr One has the five-year warranty.',
      subject: 'Zephyr',
      attribute: 'Warranty',
      value: 'five years',
    });
    rebuildEvidenceGraph(store);
    const model = {
      available: true,
      modelId: 'fixture-resolver',
      unavailableReason: null,
      chat: async (messages: { content: string }[]) => {
        const payload = JSON.parse(messages[1]!.content) as {
          candidates: { candidate_id: string; label: string }[];
        };
        return {
          ok: true,
          value: JSON.stringify({
            order: payload.candidates.map((candidate) => ({
              id: candidate.candidate_id,
              grade: candidate.label === 'Zephyr One' ? 3 : 0,
            })),
            rationale: 'distinguishing_evidence',
          }),
          latencyMs: 7,
        };
      },
    } as unknown as ModelClient;
    const resolution = await resolveContextualEntityMentions(store, model, {
      maxCandidates: 8,
      maxMentions: 20,
    });
    expect(resolution.resolved).toBe(1);
    rebuildEvidenceGraph(store, { contextualModelId: 'fixture-resolver' });

    expect(
      store.db
        .prepare(
          `SELECT subject_resolution, subject_resolution_fingerprint, traversable
             FROM graph_fact_status WHERE fact_id = 'fac_contextual_warranty'`,
        )
        .get(),
    ).toMatchObject({ subject_resolution: 'contextual', traversable: 1 });
    expect(
      store.db
        .prepare(
          `SELECT resolution, confidence FROM graph_edges
            WHERE source_fact = 'fac_contextual_warranty' AND relation = 'has_attribute'`,
        )
        .get(),
    ).toEqual({ resolution: 'contextual', confidence: 0.85 });
    store.close();
  });

  it('projects only exact, current, conflict-eligible facts into traversable relationships', async () => {
    const root = factFixtureCorpus();
    const stateDir = temporaryDirectory('akno-fact-graph-state-');
    const memory = await openFixture(root, stateDir);
    await memory.index({ structuralOnly: true });
    await memory.close();

    const store = openStore({ dbPath: path.join(stateDir, 'akno.db'), embeddingDimensions: 1024 });
    insertFact(store.db, {
      id: 'fac_employer',
      slug: 'people/ada-marlow',
      line: 10,
      claim: 'Ada Marlow works with Vulpine Mutual.',
      subject: 'ADA',
      attribute: 'Works With',
      value: 'Vulpine Mutual',
    });
    insertFact(store.db, {
      id: 'fac_scalar',
      slug: 'people/ada-marlow',
      line: 11,
      claim: 'Ada Marlow has a five year warranty.',
      subject: 'Ada',
      attribute: 'Warranty Period',
      value: 'five years',
    });
    insertFact(store.db, {
      id: 'fac_low',
      slug: 'people/ada-marlow',
      line: 12,
      claim: 'Ada Marlow might be at Blackwater Bay.',
      subject: 'Ada',
      attribute: 'Location',
      value: 'Blackwater Bay',
      confidence: 0.4,
    });
    insertFact(store.db, {
      id: 'fac_history',
      slug: 'people/ada-marlow',
      line: 13,
      claim: 'Ada Marlow was at Blackwater Bay.',
      subject: 'Ada',
      attribute: 'Previous Location',
      value: 'Blackwater Bay',
      validTo: '2030-05-01',
    });
    insertFact(store.db, {
      id: 'fac_ambiguous',
      slug: 'people/ada-marlow',
      line: 14,
      claim: 'Zephyr belongs to Ada Marlow.',
      subject: 'Zephyr',
      attribute: 'Owner',
      value: 'Ada',
    });
    insertFact(store.db, {
      id: 'fac_unresolved',
      slug: 'people/ada-marlow',
      line: 15,
      claim: 'Bo Winters has an invented record.',
      subject: 'Bo Winters',
      attribute: 'Status',
      value: 'recorded',
    });
    insertFact(store.db, {
      id: 'fac_status_a',
      slug: 'people/ada-marlow',
      line: 16,
      claim: 'Ada Marlow has status code 1111.',
      subject: 'Ada',
      attribute: 'Status',
      value: '1111',
    });
    insertFact(store.db, {
      id: 'fac_tier_a',
      slug: 'people/ada-marlow',
      line: 17,
      claim: 'Ada Marlow has tier code 3333.',
      subject: 'Ada',
      attribute: 'Tier',
      value: '3333',
    });
    insertFact(store.db, {
      id: 'fac_status_b',
      slug: 'notes/ada-status',
      line: 8,
      claim: 'Ada Marlow has status code 2222.',
      subject: 'Ada',
      attribute: 'Status',
      value: '2222',
    });
    insertFact(store.db, {
      id: 'fac_tier_b',
      slug: 'notes/ada-status',
      line: 9,
      claim: 'Ada Marlow has tier code 4444.',
      subject: 'Ada',
      attribute: 'Tier',
      value: '4444',
    });

    const candidates = findCrossPageConflictsInStore(store, Number.MAX_SAFE_INTEGER);
    const tier = candidates.find((candidate) => candidate.attribute === 'tier')!;
    expect(tier).toBeDefined();
    store.db
      .prepare(
        `INSERT INTO conflict_verdicts(
           fingerprint, model_id, prompt_version, verdict, current_slug,
           qualification, reason, updated_at
         ) VALUES(?, ?, ?, 'not_a_conflict', NULL, NULL, 'different scopes', ?)`,
      )
      .run(tier.fingerprint, 'fixture-derive', CONFLICT_PROMPT_VERSION, '2031-01-01T00:00:00.000Z');

    const report = rebuildEvidenceGraph(store, { conflictModelId: 'fixture-derive' });
    expect(report).toMatchObject({
      facts: 10,
      factEdges: 7,
      nonTraversableFacts: 6,
      ambiguousMentions: 1,
      unresolvedMentions: 1,
    });

    const statuses = store.db
      .prepare(
        `SELECT fact_id, subject_resolution, object_resolution, predicate,
                eligibility, traversable, conflict_fingerprint
           FROM graph_fact_status
          ORDER BY fact_id`,
      )
      .all() as FactStatusRow[];
    expect(statuses.find((row) => row.fact_id === 'fac_employer')).toMatchObject({
      subject_resolution: 'exact',
      object_resolution: 'exact',
      predicate: 'works_with',
      eligibility: 'eligible',
      traversable: 1,
    });
    expect(statuses.find((row) => row.fact_id === 'fac_scalar')).toMatchObject({
      object_resolution: 'scalar',
      eligibility: 'eligible',
      traversable: 1,
    });
    expect(statuses.find((row) => row.fact_id === 'fac_ambiguous')).toMatchObject({
      subject_resolution: 'ambiguous',
      eligibility: 'eligible',
      traversable: 0,
    });
    expect(statuses.find((row) => row.fact_id === 'fac_unresolved')).toMatchObject({
      subject_resolution: 'unresolved',
      traversable: 0,
    });
    expect(statuses.find((row) => row.fact_id === 'fac_low')).toMatchObject({
      eligibility: 'low_confidence',
      traversable: 0,
    });
    expect(statuses.find((row) => row.fact_id === 'fac_history')).toMatchObject({
      eligibility: 'superseded',
      traversable: 0,
    });
    expect(statuses.filter((row) => row.fact_id.startsWith('fac_status_'))).toEqual([
      expect.objectContaining({ eligibility: 'conflict_unverified', traversable: 0 }),
      expect.objectContaining({ eligibility: 'conflict_unverified', traversable: 0 }),
    ]);
    expect(statuses.filter((row) => row.fact_id.startsWith('fac_tier_'))).toEqual([
      expect.objectContaining({ eligibility: 'eligible', traversable: 1 }),
      expect.objectContaining({ eligibility: 'eligible', traversable: 1 }),
    ]);
    expect(statuses.filter((row) => row.conflict_fingerprint !== null)).toHaveLength(4);

    const factEdges = store.db
      .prepare(
        `SELECT relation, predicate, source_fact, source_hash, derivation,
                resolution, confidence, valid_from, valid_to
           FROM graph_edges
          WHERE derivation = 'fact'
          ORDER BY source_fact, relation`,
      )
      .all() as FactEdgeRow[];
    expect(factEdges.map((edge) => `${edge.source_fact}:${edge.relation}`)).toEqual([
      'fac_employer:has_attribute',
      'fac_employer:related_entity',
      'fac_history:has_attribute',
      'fac_history:related_entity',
      'fac_scalar:has_attribute',
      'fac_tier_a:has_attribute',
      'fac_tier_b:has_attribute',
    ]);
    expect(factEdges.every((edge) => edge.derivation === 'fact' && edge.resolution === 'exact')).toBe(true);
    expect(factEdges.every((edge) => /^[a-f0-9]{64}$/.test(edge.source_hash))).toBe(true);
    expect(factEdges.filter((edge) => edge.source_fact === 'fac_history')).toEqual([
      expect.objectContaining({ valid_to: '2030-05-01' }),
      expect.objectContaining({ valid_to: '2030-05-01' }),
    ]);

    const otherModel = rebuildEvidenceGraph(store, { conflictModelId: 'different-derive' });
    expect(otherModel).toMatchObject({ factEdges: 5, nonTraversableFacts: 8 });
    expect(
      store.db.prepare("SELECT eligibility FROM graph_fact_status WHERE fact_id = 'fac_tier_a'").get(),
    ).toEqual({ eligibility: 'conflict_unverified' });

    const status = candidates.find((candidate) => candidate.attribute === 'status')!;
    store.db
      .prepare(
        `INSERT INTO conflict_verdicts(
           fingerprint, model_id, prompt_version, verdict, current_slug,
           qualification, reason, updated_at
         ) VALUES(?, ?, ?, 'unresolved', NULL, NULL, 'insufficient evidence', ?)`,
      )
      .run(status.fingerprint, 'fixture-derive', CONFLICT_PROMPT_VERSION, '2031-01-01T00:00:00.000Z');
    const unresolved = rebuildEvidenceGraph(store, { conflictModelId: 'fixture-derive' });
    expect(unresolved).toMatchObject({ factEdges: 7, nonTraversableFacts: 6 });
    expect(
      store.db.prepare("SELECT eligibility FROM graph_fact_status WHERE fact_id = 'fac_status_a'").get(),
    ).toEqual({ eligibility: 'conflict_unresolved' });

    store.db
      .prepare(
        `UPDATE facts
            SET claim = ?, value = ?, source_line_hash = ?
          WHERE id = 'fac_tier_b'`,
      )
      .run('Ada Marlow has tier code 5555.', '5555', sha256('Ada Marlow has tier code 5555.'));
    const changed = rebuildEvidenceGraph(store, { conflictModelId: 'fixture-derive' });
    expect(changed).toMatchObject({ factEdges: 5, nonTraversableFacts: 8 });
    expect(
      store.db.prepare("SELECT eligibility FROM graph_fact_status WHERE fact_id = 'fac_tier_a'").get(),
    ).toEqual({ eligibility: 'conflict_unverified' });
    expect(
      store.db.prepare("SELECT count(*) AS count FROM graph_edges WHERE source_fact LIKE 'fac_tier_%'").get(),
    ).toEqual({ count: 0 });
    store.close();
  });
});

interface FactStatusRow {
  fact_id: string;
  subject_resolution: string;
  object_resolution: string;
  predicate: string | null;
  eligibility: string;
  traversable: number;
  conflict_fingerprint: string | null;
}

interface FactEdgeRow {
  relation: string;
  predicate: string | null;
  source_fact: string;
  source_hash: string;
  derivation: string;
  resolution: string;
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
}

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

function contextualEntityFixtureCorpus(): string {
  const root = temporaryDirectory('akno-contextual-entity-kb-');
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

The invented warranty lasts five years.
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

The invented warranty lasts two years.
`,
  );
  write(
    root,
    'notes/warranty.md',
    `---
title: Warranty Note
akno:
  about: [Zephyr]
---

# Warranty Note

The five-year warranty belongs to Zephyr One.
`,
  );
  return root;
}

function factFixtureCorpus(): string {
  const root = temporaryDirectory('akno-fact-graph-kb-');
  write(
    root,
    'people/ada-marlow.md',
    `---
title: Ada Marlow
type: person
akno:
  aliases: [Ada]
---

# Ada Marlow

- Works with Vulpine Mutual.
- Warranty period is five years.
- Location may be Blackwater Bay.
- Previous location was Blackwater Bay.
- Zephyr belongs to Ada Marlow.
- Bo Winters has an invented record.
- Status code is 1111.
- Tier code is 3333.
`,
  );
  write(
    root,
    'notes/ada-status.md',
    `---
title: Ada Status Note
---

# Ada Status Note

- Status code is 2222.
- Tier code is 4444.
`,
  );
  write(root, 'organizations/vulpine-mutual.md', '# Vulpine Mutual\n\nAn invented organization.\n');
  write(root, 'places/blackwater-bay.md', '# Blackwater Bay\n\nAn invented place.\n');
  write(
    root,
    'products/zephyr-one.md',
    `---
title: Zephyr One
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
akno:
  aliases: [Zephyr]
---

# Zephyr Two
`,
  );
  return root;
}

function insertFact(
  db: Database.Database,
  input: {
    id: string;
    slug: string;
    line: number;
    claim: string;
    subject: string;
    attribute: string;
    value: string;
    confidence?: number;
    validTo?: string;
  },
): void {
  const page = db.prepare('SELECT id FROM pages WHERE slug = ?').get(input.slug) as { id: string };
  db.prepare(
    `INSERT INTO facts(
       id, page_id, claim, subject, attribute, value, line_start, line_end,
       source_line_hash, confidence, valid_from, valid_to, first_seen, last_seen
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2029-01-01', ?, ?, ?)`,
  ).run(
    input.id,
    page.id,
    input.claim,
    input.subject,
    input.attribute,
    input.value,
    input.line,
    input.line,
    sha256(input.claim),
    input.confidence ?? 0.9,
    input.validTo ?? null,
    '2029-01-01T00:00:00.000Z',
    '2031-01-01T00:00:00.000Z',
  );
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
