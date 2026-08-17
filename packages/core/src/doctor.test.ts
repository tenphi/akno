import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { firstNewerThan } from './doctor.ts';

/**
 * The staleness scan behind `doctor`'s "run akno redeploy" warning.
 *
 * Only this half is tested: `staleBuild` reads its own package root and the repo's real build state,
 * so asserting on it would pass or fail with whatever the developer last ran. The scan is where the
 * decisions are.
 */
describe('finding source edited since the last build', () => {
  function tree(files: Record<string, number>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-stale-'));
    for (const [rel, mtimeMs] of Object.entries(files)) {
      const full = path.join(root, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, 'x');
      fs.utimesSync(full, mtimeMs / 1000, mtimeMs / 1000);
    }
    return root;
  }

  const BUILT_AT = 1_700_000_000_000;

  it('says nothing when every file predates the build', () => {
    const root = tree({ 'a.ts': BUILT_AT - 5_000, 'nested/b.ts': BUILT_AT - 5_000 });
    expect(firstNewerThan(root, root, BUILT_AT)).toBeNull();
  });

  it('names a file edited after the build, with a path relative to the package', () => {
    const root = tree({ 'models/client.ts': BUILT_AT + 5_000 });
    expect(firstNewerThan(root, root, BUILT_AT)).toBe(path.join('src', 'models', 'client.ts'));
  });

  it('recurses rather than checking only the top level', () => {
    const root = tree({ 'a.ts': BUILT_AT - 5_000, 'deep/deeper/c.ts': BUILT_AT + 5_000 });
    expect(firstNewerThan(root, root, BUILT_AT)).toBe(path.join('src', 'deep', 'deeper', 'c.ts'));
  });

  // A test file is never emitted, so editing one cannot leave the running service behind — and
  // warning about it would fire on almost every commit, which is how a check gets ignored.
  it('ignores test files', () => {
    const root = tree({ 'client.test.ts': BUILT_AT + 5_000, 'client.ts': BUILT_AT - 5_000 });
    expect(firstNewerThan(root, root, BUILT_AT)).toBeNull();
  });

  it('ignores anything that is not TypeScript', () => {
    const root = tree({ 'notes.md': BUILT_AT + 5_000, 'fixture.json': BUILT_AT + 5_000 });
    expect(firstNewerThan(root, root, BUILT_AT)).toBeNull();
  });

  it('treats a missing directory as nothing to report', () => {
    expect(firstNewerThan('/nonexistent-akno-src', '/nonexistent-akno-src', BUILT_AT)).toBeNull();
  });
});
