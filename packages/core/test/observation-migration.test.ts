import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let root: string;
let stateDir: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-observation-migration-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-observation-migration-state-'));
  for (const folder of ['people', 'logs', 'observations'])
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'people/ada-marlow.md'),
    '---\ntitle: Ada Marlow\nakno:\n  management:\n    observe: integrate\n---\n\n# Ada Marlow\n\nAuthored profile.\n',
  );
  fs.writeFileSync(path.join(root, 'logs/one.md'), '# One\n\nAda Marlow chose the quiet route in spring.\n');
  fs.writeFileSync(path.join(root, 'logs/two.md'), '# Two\n\nAda Marlow chose the quiet route in autumn.\n');
  fs.writeFileSync(
    path.join(root, 'observations/legacy.md'),
    '---\ntitle: Legacy patterns\nderived: true\nevidence: [logs/one, logs/two]\n---\n\n# Legacy patterns\n\n- 2026-08-01 — Ada Marlow consistently chooses the quiet route. [[logs/one]] [[logs/two]]\n\nAuthored migration note remains.\n',
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

it('moves one unambiguous legacy observation atomically and undoably', async () => {
  const mem = await openMem();
  try {
    await mem.index({ structuralOnly: true });
    seedFacts();
    await mem.index({ structuralOnly: true });
    const targetBefore = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    const legacyBefore = fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8');

    expect(await mem.migrateObservations({ dryRun: true })).toMatchObject({
      status: 'ok',
      migrated: 1,
      held: 0,
      dryRun: true,
    });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(targetBefore);

    const report = await mem.migrateObservations();
    expect(report).toMatchObject({ status: 'ok', migrated: 1, held: 0 });
    expect(report.changeIds).toHaveLength(1);
    const targetAfter = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');
    expect(targetAfter.startsWith(targetBefore)).toBe(true);
    expect(targetAfter).toContain('akno:observation obs_');
    expect(targetAfter).toContain('**Observation:**');
    const legacyAfter = fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8');
    expect(legacyAfter).not.toContain('consistently chooses');
    expect(legacyAfter).toContain('Authored migration note remains.');

    await mem.undo({ change_id: report.changeIds[0]! });
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(targetBefore);
    expect(fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8')).toBe(legacyBefore);
  } finally {
    await mem.close();
  }
});

it('holds a page citation that could name more than one current fact', async () => {
  const mem = await openMem();
  try {
    await mem.index({ structuralOnly: true });
    seedFacts(true);
    await mem.index({ structuralOnly: true });
    const before = fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8');
    expect(await mem.migrateObservations()).toMatchObject({ status: 'partial', migrated: 0, held: 1 });
    expect(fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8')).toBe(before);
  } finally {
    await mem.close();
  }
});

it('removes a repeated legacy line without rewriting an identical co-located block', async () => {
  const mem = await openMem();
  try {
    await mem.index({ structuralOnly: true });
    seedFacts();
    await mem.index({ structuralOnly: true });
    const legacyBefore = fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8');
    expect(await mem.migrateObservations()).toMatchObject({ status: 'ok', migrated: 1, held: 0 });
    const targetWithObservation = fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8');

    fs.writeFileSync(path.join(root, 'observations/legacy.md'), legacyBefore);
    await mem.index({ structuralOnly: true });
    const report = await mem.migrateObservations();

    expect(report).toMatchObject({ status: 'ok', migrated: 1, held: 0 });
    expect(report.changedPaths).toEqual(['observations/legacy.md']);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(targetWithObservation);
    await mem.undo({ change_id: report.changeIds[0]! });
    expect(fs.readFileSync(path.join(root, 'observations/legacy.md'), 'utf8')).toBe(legacyBefore);
    expect(fs.readFileSync(path.join(root, 'people/ada-marlow.md'), 'utf8')).toBe(targetWithObservation);
  } finally {
    await mem.close();
  }
});

async function openMem(): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
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

function seedFacts(extra = false): void {
  const db = new Database(path.join(stateDir, 'akno.db'));
  db.prepare("UPDATE pages SET derived_hash = body_hash WHERE slug IN ('logs/one', 'logs/two')").run();
  const pages = db.prepare("SELECT id, slug FROM pages WHERE slug IN ('logs/one', 'logs/two')").all() as {
    id: string;
    slug: string;
  }[];
  const insert = db.prepare(
    `INSERT INTO facts(
       id, page_id, claim, subject, attribute, value, line_start, line_end,
       source_line_hash, confidence, valid_from, first_seen, last_seen
     ) VALUES(?, ?, ?, 'Ada Marlow', 'route', 'quiet', 3, 3, ?, 0.9, '2026-01-01', ?, ?)`,
  );
  for (const [index, page] of pages.entries()) {
    const line = fs.readFileSync(path.join(root, `${page.slug}.md`), 'utf8').split('\n')[2]!;
    insert.run(
      `fac_${index + 1}1111111`,
      page.id,
      line,
      hash(line.trim()),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
  if (extra) {
    const page = pages.find((entry) => entry.slug === 'logs/one')!;
    insert.run(
      'fac_31111111',
      page.id,
      'Ada Marlow also selected a shaded trail.',
      hash('Ada Marlow also selected a shaded trail.'),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
  db.close();
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
