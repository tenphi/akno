import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parsePage } from '../kb/page.ts';
import { openStore, type Store } from '../store/db.ts';
import { observationBlock, type ObservationMarker } from './marker.ts';
import {
  liveObservationProofGroups,
  qualifyObservationEntries,
  qualifyObservationLines,
  replaceObservationEntries,
} from './projection.ts';

let directory: string;
let store: Store;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-observation-projection-'));
  store = openStore({ dbPath: path.join(directory, 'akno.db'), embeddingDimensions: 8 });
  addPage('pag_target', 'people/ada-marlow', 'Ada Marlow', 'integrate');
  addPage('pag_one', 'logs/one', 'Log One', 'deny');
  addPage('pag_two', 'logs/two', 'Log Two', 'deny');
  store.db
    .prepare(
      `INSERT INTO graph_entities(
         id, canonical_page, entity_type, label, normalized_label, source_hash, derivation_version
       ) VALUES('ent_11111111', 'pag_target', 'person', 'Ada Marlow', 'ada marlow', 'entity-hash', 'test')`,
    )
    .run();
  addFact('fac_11111111', 'pag_one', 'a'.repeat(64));
  addFact('fac_22222222', 'pag_two', 'b'.repeat(64));
});

afterEach(() => {
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('the observation projection', () => {
  it('rebuilds exact lineage and qualifies only the owned payload line', () => {
    const page = projectedPage();
    expect(replaceObservationEntries(store, 'pag_target', page)).toEqual({ indexed: 1, issues: 0 });
    expect(qualifyObservationEntries(store)).toEqual({ indexed: 1, issues: 0 });

    const payloadLine = page.lines.findIndex((line) => line.startsWith('- **Observation:**')) + page.bodyLine;
    const lines = qualifyObservationLines(
      store,
      'pag_target',
      page.lines.map((text, index) => ({ n: page.bodyLine + index, text })),
    );
    expect(lines.find((line) => line.n === payloadLine)?.observation).toMatchObject({
      status: 'eligible',
      level: 2,
      subject: 'ent_11111111',
      proof_count: 2,
      evidence: [
        { fact: 'fac_11111111', slug: 'logs/one' },
        { fact: 'fac_22222222', slug: 'logs/two' },
      ],
    });

    replaceObservationEntries(store, 'pag_target', page);
    qualifyObservationEntries(store);
    expect(store.db.prepare('SELECT count(*) AS n FROM observation_entries').get()).toEqual({ n: 1 });
    expect(store.db.prepare('SELECT count(*) AS n FROM observation_evidence').get()).toEqual({ n: 2 });
  });

  it('excludes stale lineage and policy drift without rewriting Markdown', () => {
    const page = projectedPage();
    replaceObservationEntries(store, 'pag_target', page);
    qualifyObservationEntries(store);
    store.db.prepare("UPDATE facts SET source_line_hash = ? WHERE id = 'fac_11111111'").run('c'.repeat(64));
    expect(qualifyObservationEntries(store)).toEqual({ indexed: 0, issues: 1 });
    expect(store.db.prepare('SELECT eligible, issue FROM observation_entries').get()).toMatchObject({
      eligible: 0,
      issue: expect.stringContaining('changed'),
    });

    store.db.prepare("UPDATE facts SET source_line_hash = ? WHERE id = 'fac_11111111'").run('a'.repeat(64));
    store.db.prepare("UPDATE pages SET observe_management = 'deny' WHERE id = 'pag_target'").run();
    qualifyObservationEntries(store);
    expect(store.db.prepare('SELECT eligible, issue FROM observation_entries').get()).toEqual({
      eligible: 0,
      issue: 'observe integration is not authorized',
    });
  });

  it('fails closed when current marker-owned bytes changed before re-indexing', () => {
    const page = projectedPage();
    replaceObservationEntries(store, 'pag_target', page);
    qualifyObservationEntries(store);
    const payloadLine = page.lines.findIndex((line) => line.startsWith('- **Observation:**')) + page.bodyLine;
    const current = page.content
      .replace('consistently chooses the quiet route', 'consistently chooses the shaded route')
      .split(/\r?\n/);
    const lines = qualifyObservationLines(
      store,
      'pag_target',
      [{ n: payloadLine, text: current[payloadLine - 1]! }],
      current,
    );
    expect(lines[0]?.observation).toMatchObject({
      status: 'ineligible',
      reason: 'observation payload changed since indexing',
    });

    const shifted = page.content
      .replace('## Observed patterns', 'Authored preface.\n\n## Observed patterns')
      .split(/\r?\n/);
    const shiftedPayload = shifted.findIndex((line) => line.startsWith('- **Observation:**')) + 1;
    const shiftedLines = qualifyObservationLines(
      store,
      'pag_target',
      [{ n: shiftedPayload, text: shifted[shiftedPayload - 1]! }],
      shifted,
    );
    expect(shiftedLines[0]?.observation).toMatchObject({
      status: 'ineligible',
      reason: 'observation marker is not current in the projection',
    });
  });

  it('counts only currently eligible exact lineage as surviving proof', () => {
    expect([...liveObservationProofGroups(store, markerForFixture())].sort()).toEqual([
      'page:pag_one',
      'page:pag_two',
    ]);
    store.db.prepare("UPDATE facts SET valid_to = '2026-08-08' WHERE id = 'fac_11111111'").run();
    expect([...liveObservationProofGroups(store, markerForFixture())]).toEqual(['page:pag_two']);
    store.db.prepare("UPDATE graph_fact_status SET traversable = 0 WHERE fact_id = 'fac_22222222'").run();
    expect([...liveObservationProofGroups(store, markerForFixture())]).toEqual([]);
  });

  it('requalifies against a stricter configured proof floor', () => {
    const page = projectedPage();
    replaceObservationEntries(store, 'pag_target', page);
    expect(qualifyObservationEntries(store, 3)).toEqual({ indexed: 0, issues: 1 });
    expect(store.db.prepare('SELECT eligible, issue FROM observation_entries').get()).toEqual({
      eligible: 0,
      issue: 'insufficient independent proof',
    });
  });

  it('keeps malformed markers visible but marks their payload ineligible', () => {
    const page = parsePage(
      'people/ada-marlow.md',
      '# Ada Marlow\n\n<!-- akno:observation obs_11111111 v=99 -->\n- **Observation:** Invented pattern.\n',
    );
    expect(replaceObservationEntries(store, 'pag_target', page)).toEqual({ indexed: 0, issues: 1 });
    const lines = qualifyObservationLines(store, 'pag_target', [
      { n: 4, text: '- **Observation:** Invented pattern.' },
    ]);
    expect(lines[0]?.observation).toMatchObject({ status: 'ineligible', level: 2 });
  });

  it('fails closed over the next readable line after a detached malformed marker', () => {
    const page = parsePage(
      'people/ada-marlow.md',
      '# Ada Marlow\n\n<!-- akno:observation obs_11111111 v=99 -->\n\n- **Observation:** Invented detached pattern.\n\nAuthored note remains factual.\n',
    );
    expect(replaceObservationEntries(store, 'pag_target', page)).toEqual({ indexed: 0, issues: 1 });
    const lines = qualifyObservationLines(
      store,
      'pag_target',
      page.lines.map((text, index) => ({ n: page.bodyLine + index, text })),
      page.content.split(/\r?\n/),
    );
    expect(lines.find((line) => line.text.includes('detached pattern'))?.observation).toMatchObject({
      status: 'ineligible',
      level: 2,
      reason: 'invalid observation marker',
    });
    const authoredOnly = qualifyObservationLines(
      store,
      'pag_target',
      [{ n: 7, text: 'Authored note remains factual.' }],
      page.content.split(/\r?\n/),
    );
    expect(authoredOnly[0]?.observation).toBeUndefined();
  });

  it('fails closed for every copy of a duplicate stable id', () => {
    const first = projectedPage();
    const second = parsePage(
      'topics/quiet-routes.md',
      `# Quiet routes\n\n${observationBlock(markerForFixture(), 'Ada Marlow consistently chooses the quiet route.', ['logs/one', 'logs/two'])}\n`,
    );
    addPage('pag_duplicate', 'topics/quiet-routes', 'Quiet routes', 'integrate');
    store.db.prepare("UPDATE pages SET about = '[\"people/ada-marlow\"]' WHERE id = 'pag_duplicate'").run();
    replaceObservationEntries(store, 'pag_target', first);
    expect(replaceObservationEntries(store, 'pag_duplicate', second)).toEqual({ indexed: 0, issues: 1 });
    expect(qualifyObservationEntries(store)).toEqual({ indexed: 0, issues: 1 });
    expect(
      store.db.prepare("SELECT eligible, issue FROM observation_entries WHERE id = 'obs_11111111'").get(),
    ).toEqual({
      eligible: 0,
      issue: 'duplicate observation id',
    });
  });

  it('does not let an unknown marker version reuse an eligible stable id', () => {
    replaceObservationEntries(store, 'pag_target', projectedPage());
    const unknown = parsePage(
      'topics/quiet-routes.md',
      '# Quiet routes\n\n<!-- akno:observation obs_11111111 v=99 -->\n- **Observation:** Unknown copy.\n',
    );
    addPage('pag_duplicate', 'topics/quiet-routes', 'Quiet routes', 'integrate');
    replaceObservationEntries(store, 'pag_duplicate', unknown);

    expect(qualifyObservationEntries(store)).toEqual({ indexed: 0, issues: 1 });
    expect(
      store.db.prepare("SELECT eligible, issue FROM observation_entries WHERE id = 'obs_11111111'").get(),
    ).toEqual({ eligible: 0, issue: 'duplicate observation id' });
  });

  it('ignores marker examples inside fenced code', () => {
    const page = parsePage(
      'people/ada-marlow.md',
      `# Ada Marlow\n\n\`\`\`md\n${observationBlock(markerForFixture(), 'An invented example.', ['logs/one', 'logs/two'])}\n\`\`\`\n`,
    );
    expect(replaceObservationEntries(store, 'pag_target', page)).toEqual({ indexed: 0, issues: 0 });
    expect(qualifyObservationEntries(store)).toEqual({ indexed: 0, issues: 0 });
  });

  it('does not project marker-shaped quoted source material', () => {
    const page = parsePage(
      'people/ada-marlow.md',
      `# Ada Marlow\n\n<!-- source -->\n${observationBlock(markerForFixture(), 'A quoted external example.', ['logs/one', 'logs/two'])}\n`,
    );
    expect(replaceObservationEntries(store, 'pag_target', page)).toEqual({ indexed: 0, issues: 0 });
    expect(qualifyObservationEntries(store)).toEqual({ indexed: 0, issues: 0 });
  });
});

function projectedPage() {
  const marker = markerForFixture();
  return parsePage(
    'people/ada-marlow.md',
    `# Ada Marlow\n\n## Observed patterns\n\n${observationBlock(marker, 'Ada Marlow consistently chooses the quiet route.', ['logs/one', 'logs/two'])}\n`,
  );
}

function markerForFixture(): ObservationMarker {
  return {
    id: 'obs_11111111',
    subject: 'ent_11111111',
    disposition: 'active',
    evidence: [
      { factId: 'fac_11111111', sourceLineHash: 'a'.repeat(64), proofGroups: ['page:pag_one'] },
      { factId: 'fac_22222222', sourceLineHash: 'b'.repeat(64), proofGroups: ['page:pag_two'] },
    ],
    proofCount: 2,
  };
}

function addPage(id: string, slug: string, title: string, observe: 'deny' | 'integrate'): void {
  store.db
    .prepare(
      `INSERT INTO pages(
         id, slug, rel_path, title, tags, role, frontmatter, body_hash, body_line,
         line_count, bytes, indexed_at, derived_hash, observe_management
       ) VALUES(?, ?, ?, ?, '[]', 'knowledge', '{}', 'body-hash', 1, 1, 1, ?, 'body-hash', ?)`,
    )
    .run(id, slug, `${slug}.md`, title, new Date().toISOString(), observe);
}

function addFact(id: string, pageId: string, lineHash: string): void {
  store.db
    .prepare(
      `INSERT INTO facts(
         id, page_id, claim, subject, attribute, value, line_start, line_end,
         source_line_hash, confidence, valid_from, first_seen, last_seen
       ) VALUES(?, ?, 'Invented claim.', 'Ada Marlow', 'route', 'quiet', 1, 1, ?, 0.9, '2026-01-01', ?, ?)`,
    )
    .run(id, pageId, lineHash, new Date().toISOString(), new Date().toISOString());
  store.db
    .prepare(
      `INSERT INTO graph_fact_status(
         fact_id, subject_entity, object_entity, subject_resolution, subject_candidates,
         subject_resolution_fingerprint, object_resolution, object_candidates,
         object_resolution_fingerprint, predicate, eligibility, traversable,
         conflict_fingerprint, source_hash, derivation_version
       ) VALUES(?, 'ent_11111111', NULL, 'exact', '["ent_11111111"]', NULL,
                'scalar', '[]', NULL, 'route', 'eligible', 1, NULL, ?, 'test')`,
    )
    .run(id, lineHash);
}
