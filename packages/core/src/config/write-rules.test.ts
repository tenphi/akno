import { describe, expect, it } from 'vitest';
import { addFolderRule } from './write-rules.ts';
import { readJsoncFile } from './jsonc.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * `akno.json` lives inside the user's own folder, under their own git history, full of
 * comments explaining why each rule is what it is. Every assertion here is about the same
 * promise: **adding a rule changes one place in the file and nothing else.**
 *
 * Parsing and re-stringifying would pass a "the JSON is correct" test and fail every one of
 * these, which is why they are written against the text rather than against the parsed object.
 */

const entry = {
  glob: 'research/**',
  rule: {
    description: 'Findings about the world, not claims about this household.',
    role: 'source' as const,
    remember: 'deny' as const,
  },
};

/** Round-trips the result through the reader the rest of Akno uses. */
function parse(text: string): { folders?: Record<string, unknown> } {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'akno-rules-')), 'akno.json');
  fs.writeFileSync(file, text);
  return readJsoncFile<{ folders?: Record<string, unknown> }>(file)!;
}

describe('adding a folder rule', () => {
  it('leaves every comment where it was', () => {
    const before = [
      '{',
      '  // Rules for this knowledge base.',
      '  "folders": {',
      '    // Chat transcripts: what was *said*, including options dropped.',
      '    "conversations/**": { "role": "source" }',
      '  }',
      '}',
      '',
    ].join('\n');

    const after = addFolderRule(before, entry);
    expect(after).toContain('// Rules for this knowledge base.');
    expect(after).toContain('// Chat transcripts: what was *said*, including options dropped.');
    expect(after).toContain('"conversations/**": { "role": "source" }');
    expect(parse(after).folders).toHaveProperty(['research/**']);
  });

  it('adds the comma the previous rule was missing', () => {
    const after = addFolderRule('{\n  "folders": {\n    "wiki/**": { "role": "source" }\n  }\n}\n', entry);
    expect(after).toContain('"wiki/**": { "role": "source" },');
    expect(parse(after).folders).toHaveProperty(['wiki/**']);
  });

  it('does not add a second comma when the block already ends in one', () => {
    const after = addFolderRule('{\n  "folders": {\n    "wiki/**": { "role": "source" },\n  }\n}\n', entry);
    expect(after).not.toContain(',,');
    expect(parse(after).folders).toHaveProperty(['research/**']);
  });

  it('keeps a trailing comment attached to the rule it was written under', () => {
    // The case that makes reading the file backwards wrong: scanned in reverse, the `}` inside
    // this comment reads as the end of a rule and the comma lands inside the prose.
    const before = [
      '{',
      '  "folders": {',
      '    "wiki/**": { "role": "source" }',
      '    // Everything above is evidence, never mined for facts. Do not add a } here.',
      '  }',
      '}',
      '',
    ].join('\n');

    const after = addFolderRule(before, entry);
    const lines = after.split('\n');
    expect(lines[2]).toBe('    "wiki/**": { "role": "source" },');
    expect(lines[3]).toBe('    // Everything above is evidence, never mined for facts. Do not add a } here.');
    expect(parse(after).folders).toHaveProperty(['research/**']);
  });

  it('fills an empty block without leaving a dangling comma', () => {
    const after = addFolderRule('{\n  "folders": {\n  }\n}\n', entry);
    expect(after).not.toContain('{,');
    expect(Object.keys(parse(after).folders!)).toEqual(['research/**']);
  });

  it('opens a line for a block written closed on one', () => {
    const after = addFolderRule('{\n  "folders": {}\n}\n', entry);
    expect(Object.keys(parse(after).folders!)).toEqual(['research/**']);
  });

  it('creates a commented file when there is none yet', () => {
    const after = addFolderRule(null, entry);
    expect(after).toContain('// Rules for this knowledge base.');
    expect(after).toContain('source     searchable evidence');
    expect(Object.keys(parse(after).folders!)).toEqual(['research/**']);
  });

  it('finds the right block when another key holds a nested `folders`', () => {
    const before = [
      '{',
      '  "maintenance": { "observe": { "folders": { "ignored": true } } },',
      '  "folders": {',
      '    "wiki/**": { "role": "source" }',
      '  }',
      '}',
      '',
    ].join('\n');

    const parsed = parse(addFolderRule(before, entry));
    expect(Object.keys(parsed.folders!)).toEqual(['wiki/**', 'research/**']);
  });

  it('is not fooled by a brace inside a string value', () => {
    const before = [
      '{',
      '  "folders": {',
      '    "notes/**": { "slug_pattern": "^{name}-[0-9]{4}$" }',
      '  }',
      '}',
      '',
    ].join('\n');

    const parsed = parse(addFolderRule(before, entry));
    expect(Object.keys(parsed.folders!)).toEqual(['notes/**', 'research/**']);
  });

  it('refuses a file with no folders block rather than inventing one', () => {
    expect(() => addFolderRule('{\n  "gate": "none"\n}\n', entry)).toThrow(/folders/);
  });

  it('writes the description as a field, so a caller can read it back', () => {
    const rule = parse(addFolderRule(null, entry)).folders!['research/**'] as { description: string };
    expect(rule.description).toBe('Findings about the world, not claims about this household.');
  });

  it('adds rules one after another without breaking the file', () => {
    let text = addFolderRule(null, entry);
    text = addFolderRule(text, { glob: 'learning/**', rule: { description: 'Things being learned.' } });
    text = addFolderRule(text, {
      glob: 'receipts/**',
      rule: { description: 'Bills and statements.', ingest: 'auto' },
    });
    expect(Object.keys(parse(text).folders!)).toEqual(['research/**', 'learning/**', 'receipts/**']);
  });
});
