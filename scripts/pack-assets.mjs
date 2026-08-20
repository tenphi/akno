/**
 * Stage the files a published tarball needs but the repo keeps in one place.
 *
 * Run from each package's `prepack`, with the package directory as the cwd. Two things get
 * copied, both for the same reason: they are authored once at the repo root, and a tarball
 * without them is broken in a way `pnpm build` and `pnpm test` cannot see.
 *
 *  - **LICENSE**, into every package. npm includes it automatically *if it is there*, and a
 *    package page with no license is the first thing anyone checks.
 *  - **config/default.jsonc**, into `@tenphi/akno-core` only. `loadConfig` falls back to a copy
 *    beside `dist` when there is no repo root to walk up to, which is every installed copy.
 *    Without it an installed Akno throws `committed defaults are missing`.
 *
 * Both destinations are gitignored: they are build output that happens to be a copy.
 */
import fs from 'node:fs';
import path from 'node:path';

const packageDir = process.cwd();
const repoRoot = path.resolve(import.meta.dirname, '..');

if (packageDir === repoRoot) {
  throw new Error('run this from a package directory, not the repo root');
}

const name = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).name;

copy('LICENSE', 'LICENSE');
if (name === '@tenphi/akno-core') {
  fs.mkdirSync(path.join(packageDir, 'config'), { recursive: true });
  copy(path.join('config', 'default.jsonc'), path.join('config', 'default.jsonc'));
}

function copy(from, to) {
  const source = path.join(repoRoot, from);
  if (!fs.existsSync(source)) throw new Error(`missing ${source}`);
  fs.copyFileSync(source, path.join(packageDir, to));
  process.stdout.write(`staged ${to} for ${name}\n`);
}
