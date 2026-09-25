import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let mem: Akno | null = null;
const temporary: string[] = [];

afterEach(async () => {
  await mem?.close();
  mem = null;
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

it('keeps each explicit ledger event even when another list item has uncertain prose', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ledger-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ledger-state-'));
  temporary.push(root, stateDir);
  fs.mkdirSync(path.join(root, 'research'));
  fs.writeFileSync(
    path.join(root, 'timeline.md'),
    `---\ntype: timeline\n---\n\n# Timeline\n\n## 2031\n` +
      `- **2031-04-03** | Ada Marlow renewed coverage with Vulpine Mutual.\n` +
      `- **2031-04-02** | Ada Marlow bought a Zephyr QX-100; the merchant category may be inaccurate.\n` +
      `- **2031-04-01** | Ada Marlow moved to Blackwater Bay.\n`,
  );
  fs.writeFileSync(
    path.join(root, 'research', 'possible.md'),
    '# Possible outcomes\n\n## Hypothesis\n\n- **2031-04-04** | Ada Marlow bought another Zephyr QX-100.\n',
  );
  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      create_reserved_paths: false,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
    },
  });
  await mem.index({ structuralOnly: true });

  const result = await mem.timeline({ source: 'event', since: '2031-04-01', until: '2031-04-04' });
  expect(result.results.map((entry) => entry.date)).toEqual(['2031-04-03', '2031-04-02', '2031-04-01']);
  expect(result.results.every((entry) => entry.source === 'timeline')).toBe(true);

  // A released installation already has the ledger on disk. Simulate its stale v4 projection:
  // the upgrade must rebuild the event index without rewriting the user's Markdown.
  await mem.close();
  mem = null;
  const source = fs.readFileSync(path.join(root, 'timeline.md'), 'utf8');
  const stale = new Database(path.join(stateDir, 'akno.db'));
  stale.prepare('DELETE FROM events').run();
  stale.prepare("UPDATE meta SET value = 'prose-v4' WHERE key = 'prose_projection_version'").run();
  stale.close();
  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      create_reserved_paths: false,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
    },
  });
  await mem.index({ structuralOnly: true });
  const repaired = await mem.timeline({ source: 'event', since: '2031-04-01', until: '2031-04-04' });
  expect(repaired.results.map((entry) => entry.date)).toEqual(result.results.map((entry) => entry.date));
  expect(fs.readFileSync(path.join(root, 'timeline.md'), 'utf8')).toBe(source);
});
