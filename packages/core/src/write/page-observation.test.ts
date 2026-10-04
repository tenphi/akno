import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../open.ts';
import { openStore } from '../store/db.ts';
import { MIGRATIONS } from '../store/migrations.ts';
import { Journal } from './journal.ts';
let dir: string;
let root: string;
let mem: Akno;
const file = 'notes/preferences.md';
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-page-observation-'));
  root = path.join(dir, 'kb');
  fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(root, file), '# Preferences\n\nMorning meetings.\n');
  mem = await open({
    aknoPath: root,
    stateDir: path.join(dir, 'state'),
    isolated: true,
    actor: 'agent',
    overrides: {
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
      folders: { 'notes/**': { role: 'knowledge', remember: 'integrate' } },
    },
  });
  await mem.index({});
});
afterEach(async () => {
  await mem.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
describe('scoped raw page observations', () => {
  it('returns exact editor bytes before reindexing, including deletion and recreation', () => {
    fs.writeFileSync(path.join(root, file), 'External 🌙 correction.\n');
    expect(mem.observePage(file, 0)).toMatchObject({
      content: 'External 🌙 correction.\n',
      transitions: [],
      hasMore: false,
    });
    fs.unlinkSync(path.join(root, file));
    expect(mem.observePage(file, 0).content).toBeNull();
    fs.writeFileSync(path.join(root, file), '');
    expect(mem.observePage(file, 0).content).toBe('');
  });
  it('separates external corrections captured in the next service write from that write', async () => {
    const first = await mem.write({ slug: 'notes/preferences', append: 'Agent note.' });
    const cursor = mem.change(first.change_id!).sequence;
    const external = 'Human correction.\n';
    fs.writeFileSync(path.join(root, file), external);
    const second = await mem.write({ slug: 'notes/preferences', append: 'Another agent note.' });
    const observed = mem.observePage(file, cursor);
    expect(observed.transitions).toEqual([
      {
        sequence: mem.change(second.change_id!).sequence,
        actor: 'agent',
        before: external,
        after: observed.content,
      },
    ]);
  });
  it('orders an undo of an older change after newer commits and preserves who requested it', async () => {
    const first = await mem.write({ slug: 'notes/preferences', append: 'Agent note.' });
    const original = mem.change(first.change_id!);
    const later = await mem.write({ slug: 'notes/other', content: 'Another page.' });
    const cursor = mem.change(later.change_id!).sequence;
    await mem.call('undo', { change_id: first.change_id! }, { actor: 'user' });
    const observation = mem.observePage(file, cursor);
    expect(observation.transitions).toEqual([
      {
        sequence: expect.any(Number),
        actor: 'user',
        before: original.files[0].after,
        after: original.files[0].before,
      },
    ]);
    expect(observation.cursor).toBeGreaterThan(cursor);
    expect(observation.content).toBe(original.files[0].before);
  });
  it('defers raw observations during service writes, then resumes without stale busy state', async () => {
    const write = mem.write({ slug: 'notes/preferences', append: 'New agent note.' });
    expect(() => mem.observePage(file, 0)).toThrow('still committing');
    await write;
    expect(mem.observePage(file, 0).transitions).toHaveLength(1);
    await expect(
      mem.write({ slug: 'notes/preferences', replace: { find: 'absent', with: 'new' } }),
    ).rejects.toBeDefined();
    expect(() => mem.observePage(file, 0)).not.toThrow();
  });
  it('rejects unsafe paths, non-page files, symlinks and invalid cursors', () => {
    for (const relPath of [
      '../private.md',
      '/private.md',
      '.private/file.md',
      'notes/preferences.txt',
      'notes\\preferences.md',
    ]) {
      expect(() => mem.observePage(relPath, 0)).toThrow();
    }
    const outside = path.join(dir, 'private.md');
    fs.writeFileSync(outside, 'Private fixture.');
    fs.symlinkSync(outside, path.join(root, 'notes/link.md'));
    expect(() => mem.observePage('notes/link.md', 0)).toThrow('symbolic links');
    fs.symlinkSync(dir, path.join(root, 'alias'));
    expect(() => mem.observePage('alias/private.md', 0)).toThrow('symbolic links');
    for (const cursor of [-1, 1.2, NaN, Infinity])
      expect(() => mem.observePage(file, cursor)).toThrow('cursor');
  });
  it('paginates long journal history without silently skipping commits', () => {
    const store = openStore({ dbPath: path.join(dir, 'history.db'), embeddingDimensions: 8 });
    try {
      const journal = new Journal(store, root, path.join(dir, 'trash'));
      for (let index = 0; index < 502; index++)
        journal.record({
          actor: 'agent',
          op: 'write',
          summary: 'Invented note.',
          files: [{ relPath: file, action: 'modified', before: String(index), after: String(index + 1) }],
        });
      const first = journal.pageTransitions(file, 0);
      expect(first.hasMore).toBe(true);
      expect(first.transitions).toHaveLength(500);
      const second = journal.pageTransitions(file, first.cursor);
      expect(second.hasMore).toBe(false);
      expect(second.transitions).toHaveLength(2);
      expect(second.transitions[0].before).toBe('500');
    } finally {
      store.close();
    }
  });
  it('upgrades historical journal rows and survives reopening the migrated database', () => {
    const dbPath = path.join(dir, 'legacy.db');
    const legacy = new Database(dbPath);
    for (const migration of MIGRATIONS.slice(0, 39)) legacy.exec(migration);
    legacy
      .prepare(
        "INSERT INTO changes(id, at, actor, op, summary, status, undone_at) VALUES('chg_legacy', '2031-01-01T00:00:00Z', 'agent', 'write', 'Invented.', 'undone', '2031-01-02T00:00:00Z')",
      )
      .run();
    legacy
      .prepare(
        "INSERT INTO change_files(change_id, ord, rel_path, action, before, after) VALUES('chg_legacy', 0, ?, 'modified', 'Before', 'After')",
      )
      .run(file);
    legacy.pragma('user_version = 45');
    legacy.close();
    const store = openStore({ dbPath, embeddingDimensions: 8 });
    expect(new Journal(store, root, path.join(dir, 'trash')).pageTransitions(file, 0).transitions).toEqual([
      { sequence: 1, actor: 'agent', before: 'Before', after: 'After' },
      { sequence: 2, actor: 'unknown', before: 'After', after: 'Before' },
    ]);
    store.close();
    const reopened = openStore({ dbPath, embeddingDimensions: 8 });
    expect(new Journal(reopened, root, path.join(dir, 'trash')).detail('chg_legacy').sequence).toBe(1);
    reopened.close();
  });
});
