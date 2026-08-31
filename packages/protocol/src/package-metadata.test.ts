import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('runtime package metadata', () => {
  it.each([
    ['@tenphi/akno-core', 'core'],
    ['@tenphi/akno', 'cli'],
  ])('permits darwin and linux for %s', (_publishedName, packageName) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(import.meta.dirname, `../../${packageName}/package.json`), 'utf8'),
    ) as { os?: string[] };

    expect(manifest.os).toEqual(['darwin', 'linux']);
  });
});
