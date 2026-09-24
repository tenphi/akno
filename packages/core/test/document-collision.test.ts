import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { open } from '../src/index.ts';

it('indexes two separate attachments with identical bytes and keeps both ids stable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-duplicate-docs-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-duplicate-docs-state-'));
  fs.mkdirSync(path.join(root, 'records'));
  for (const name of ['first', 'second']) {
    fs.writeFileSync(path.join(root, `records/${name}.md`), `# ${name}\n`);
    fs.writeFileSync(path.join(root, `records/${name}.pdf`), '%PDF-1.4 identical fixture bytes\n');
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

  try {
    await memory.index({ structuralOnly: true });
    const first = (await memory.read({ slug: 'records/first' })).page!.documents![0]!;
    const second = (await memory.read({ slug: 'records/second' })).page!.documents![0]!;
    expect(first.id).not.toBe(second.id);
    expect(first.rel_path).toBe('records/first.pdf');
    expect(second.rel_path).toBe('records/second.pdf');

    await memory.index({ structuralOnly: true, verify: true });
    expect((await memory.read({ slug: 'records/first' })).page!.documents![0]!.id).toBe(first.id);
    expect((await memory.read({ slug: 'records/second' })).page!.documents![0]!.id).toBe(second.id);
  } finally {
    await memory.close();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});
