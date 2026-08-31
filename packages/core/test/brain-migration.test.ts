import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let root: string;
let stateDir: string;

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
      folders: { 'memory/**': { role: 'knowledge', remember: 'integrate' } },
    },
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-brain-migration-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-brain-migration-state-'));
  fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'memory/equipment.md'),
    '# Equipment\n\n## Warranty\n\n<!-- akno:item itm_1111 source=fixture%3Aconversation origin=assistant -->\nThe Zephyr QX-100 warranty lasts five years.\n',
    'utf8',
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

it('previews, explicitly migrates, and undoes the brain schema change', async () => {
  const mem = await openMem();
  try {
    await mem.index({ structuralOnly: true });
    const seeded = new Database(path.join(stateDir, 'akno.db'));
    const evidence = 'The Zephyr QX-100 warranty lasts five years.';
    seeded
      .prepare(
        `INSERT INTO managed_item_sources(
           item_id, source_ref, origin, evidence, evidence_hash, input_hash, created_at
         ) VALUES ('itm_1111', 'fixture:conversation', 'assistant', ?, ?, 'input_1111', ?)`,
      )
      .run(evidence, hash(evidence), new Date().toISOString());
    seeded.close();
    const before = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
    const preview = await mem.migrateBrain({ dryRun: true });
    expect(preview).toMatchObject({ migrated: 1, held: 0, dryRun: true });
    expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toBe(before);

    const applied = await mem.migrateBrain();
    expect(applied).toMatchObject({ status: 'ok', migrated: 1, held: 0 });
    const after = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
    expect(after).toContain('v=2 supports=');
    expect(after).toContain('**Reported by the assistant:**');
    expect(await mem.migrateBrain()).toMatchObject({ status: 'noop', migrated: 0 });

    const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    const receipt = db.prepare('SELECT mode FROM retain_receipts').get() as { mode: string };
    db.close();
    expect(receipt.mode).toBe('migration');

    await mem.undo({ change_id: applied.changeId! });
    expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toBe(before);
    const afterUndo = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    const count = afterUndo.prepare('SELECT COUNT(*) AS n FROM retain_receipts').get() as { n: number };
    const archive = afterUndo
      .prepare('SELECT evidence FROM managed_item_sources WHERE item_id = ?')
      .get('itm_1111') as { evidence: string };
    afterUndo.close();
    expect(count.n).toBe(0);
    expect(archive.evidence).toBe(evidence);
  } finally {
    await mem.close();
  }
});

it('holds every occurrence of a duplicate legacy item id', async () => {
  fs.writeFileSync(
    path.join(root, 'memory/duplicate.md'),
    '# Duplicate\n\n<!-- akno:item itm_1111 source=fixture%3Asecond origin=user -->\nAda Marlow selected a five-year warranty.\n',
    'utf8',
  );
  const mem = await openMem();
  try {
    await mem.index({ structuralOnly: true });
    const originals = ['memory/equipment.md', 'memory/duplicate.md'].map((relPath) =>
      fs.readFileSync(path.join(root, relPath), 'utf8'),
    );
    const report = await mem.migrateBrain();
    expect(report).toMatchObject({ status: 'partial', legacyMarkers: 2, migrated: 0, held: 2 });
    expect(
      ['memory/equipment.md', 'memory/duplicate.md'].map((relPath) =>
        fs.readFileSync(path.join(root, relPath), 'utf8'),
      ),
    ).toEqual(originals);
  } finally {
    await mem.close();
  }
});

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
