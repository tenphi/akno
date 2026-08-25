import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './load.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('knowledge-base rules filename', () => {
  it('loads commented rules from akno.jsonc', () => {
    const root = inventedDirectory();
    fs.writeFileSync(
      path.join(root, 'akno.jsonc'),
      `{
  // Invented reference material remains searchable but is not mined for facts.
  "folders": { "references/**": { "role": "source" } },
}
`,
      'utf8',
    );

    const config = loadConfig({ isolated: true, overrides: { akno_path: root } });

    expect(config.rules).toEqual(
      expect.arrayContaining([expect.objectContaining({ glob: 'references/**', role: 'source' })]),
    );
    expect(config.sources).toContain(path.join(root, 'akno.jsonc'));
  });

  it('rejects the old extension with an exact rename instruction', () => {
    const root = inventedDirectory();
    fs.writeFileSync(path.join(root, 'akno.json'), '{"folders":{}}\n', 'utf8');

    expect(() => loadConfig({ isolated: true, overrides: { akno_path: root } })).toThrow(
      `knowledge-base rules now use akno.jsonc; rename ${path.join(root, 'akno.json')} before starting Akno`,
    );
  });

  it('refuses to choose when both extensions exist', () => {
    const root = inventedDirectory();
    fs.writeFileSync(path.join(root, 'akno.json'), '{"folders":{}}\n', 'utf8');
    fs.writeFileSync(path.join(root, 'akno.jsonc'), '{"folders":{}}\n', 'utf8');

    expect(() => loadConfig({ isolated: true, overrides: { akno_path: root } })).toThrow(
      `both akno.json and akno.jsonc exist in ${root}; merge or remove the old file`,
    );
  });
});

function inventedDirectory(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-rules-filename-'));
  temporary.push(target);
  return target;
}
