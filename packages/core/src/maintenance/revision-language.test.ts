import { describe, expect, it } from 'vitest';
import type { CreateOperation, ReplaceOperation } from './plans.ts';
import { revisionLanguageProse } from './revision-language.ts';

const authored = 'Гарантия Zephyr QX-100 действует пять лет.\n';
const replace = (relPath: string, before: string, after = before): ReplaceOperation => ({
  type: 'replace',
  relPath,
  before,
  after,
  beforeHash: '1111',
  afterHash: '2222',
});
const create = (relPath: string): CreateOperation => ({
  type: 'create',
  relPath,
  after: '',
  afterHash: '2222',
});
const response = (rel_path: string, after: string) => ({ operations: [{ rel_path, after }] });

describe('curator revision language boundary', () => {
  it('checks new prose while preserving exact authored Russian and reordered lines', () => {
    const before = `# Zephyr QX-100\n${authored}`;
    expect(
      revisionLanguageProse(response('product.md', `${authored}# Zephyr QX-100\nNew prose.\n`), [
        replace('product.md', before),
      ]),
    ).toEqual(['New prose.\n']);
  });

  it('permits a single exact transfer between authorized paths and checks extra copies', () => {
    const original = [replace('product.md', authored), create('details.md')];
    expect(
      revisionLanguageProse(
        {
          operations: [
            { rel_path: 'product.md', after: '' },
            { rel_path: 'details.md', after: authored },
          ],
        },
        original,
      ),
    ).toEqual([]);
    expect(
      revisionLanguageProse(
        {
          operations: [
            { rel_path: 'product.md', after: authored },
            { rel_path: 'details.md', after: authored },
          ],
        },
        original,
      ),
    ).toEqual([authored]);
    // Omitting the unchanged first operation must not make its retained copy disappear.
    expect(revisionLanguageProse(response('details.md', authored), original)).toEqual([authored]);
  });

  it('does not use a previously generated after-state as original-language authority', () => {
    expect(
      revisionLanguageProse(response('product.md', authored), [replace('product.md', '', authored)]),
    ).toEqual([authored]);
  });

  it.each([authored.replace('пять', 'шесть'), authored.replace('\n', '\r\n'), authored.trimEnd()])(
    'checks modified bytes rather than normalizing them as preserved source: %s',
    (after) => {
      expect(revisionLanguageProse(response('product.md', after), [replace('product.md', authored)])).toEqual(
        [after],
      );
    },
  );

  it('checks complete creates when no original prose exists', () => {
    expect(revisionLanguageProse(response('product.md', authored), [create('product.md')])).toEqual([
      authored,
    ]);
  });

  it.each([
    'malformed',
    {},
    { operations: [] },
    response('unknown.md', authored),
    { operations: [{ after: authored }] },
    { operations: [{ rel_path: 'product.md', after: null }] },
    {
      operations: [
        { rel_path: 'product.md', after: authored },
        { rel_path: 'product.md', after: authored },
      ],
    },
  ])('refuses an invalid selector input instead of silently skipping after fields: %j', (value) => {
    expect(() => revisionLanguageProse(value, [replace('product.md', authored)])).toThrow();
  });
});
