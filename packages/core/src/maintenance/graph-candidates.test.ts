import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { open } from '../open.ts';
import { openStore } from '../store/db.ts';
import { rebuildEvidenceGraph } from '../index/graph.ts';
import { discoverGraphMaintenanceCandidates } from './graph-candidates.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('graph maintenance discovery', () => {
  it('reports identity collisions, unresolved authored subjects, and traversal hubs without operations', async () => {
    const root = temporaryDirectory('akno-graph-maintenance-kb-');
    const stateDir = temporaryDirectory('akno-graph-maintenance-state-');
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

An invented product record.
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

A distinct invented product record.
`,
    );
    write(root, 'concepts/hub.md', '# Warranty Index\n\nAn invented index page.\n');
    write(
      root,
      'notes/review.md',
      `---
title: Review Note
akno:
  about: [Zephyr, Missing Fixture]
---

# Review Note

An invented review note.
`,
    );
    for (let index = 1; index <= 50; index++) {
      write(
        root,
        `notes/hub-reference-${index}.md`,
        `# Hub Reference ${index}\n\nAn invented reference to [[concepts/hub]].\n`,
      );
    }

    const memory = await open({
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
    await memory.index({ structuralOnly: true });
    await memory.close();
    const store = openStore({
      dbPath: path.join(stateDir, 'akno.db'),
      embeddingDimensions: 1024,
    });

    const first = discoverGraphMaintenanceCandidates(store);
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'identity_collision',
          subject: 'zephyr',
          related: ['products/zephyr-one', 'products/zephyr-two'],
          occurrences: 1,
        }),
        expect.objectContaining({
          kind: 'unresolved_about',
          subject: 'notes/review',
          related: ['Missing Fixture'],
        }),
        expect.objectContaining({
          kind: 'traversal_hub',
          subject: 'concepts/hub',
          occurrences: 51,
        }),
      ]),
    );
    expect(first.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.fingerprint))).toBe(true);
    expect(first.every((candidate) => !('operations' in candidate))).toBe(true);

    rebuildEvidenceGraph(store);
    expect(discoverGraphMaintenanceCandidates(store)).toEqual(first);
    store.close();
  });
});

function temporaryDirectory(prefix: string): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(target);
  return target;
}

function write(root: string, relPath: string, content: string): void {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}
