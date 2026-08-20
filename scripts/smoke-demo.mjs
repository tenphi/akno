#!/usr/bin/env node
/**
 * The shipped example is documentation that runs, so it gets a test.
 *
 * `examples/demo-brain` is the first thing anyone points Akno at, and it is the one file set in
 * the repo where a mistake is invisible to every other check: the build compiles, the suite passes,
 * and the example is still wrong. Both bugs found while writing it were this shape — six event
 * lines in a format the indexer does not match (`- 2031-01-14 —` rather than `- **2031-01-14** |`),
 * and a relative Markdown link out of the folder, which indexes as a broken link inside it.
 *
 * Indexed with no models configured, into a temp state dir, against a **copy** — so this also
 * asserts the thing the example promises about itself: Akno leaves the folder byte-identical.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source = path.resolve('examples/demo-brain');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-demo-kb-'));
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-demo-state-'));
const cli = path.resolve('packages/cli/dist/bin.js');

fs.cpSync(source, root, { recursive: true });
const before = fingerprint(root);

const env = {
  ...process.env,
  AKNO_ISOLATED: '1',
  AKNO_PATH: root,
  AKNO_STATE_DIR: stateDir,
  NO_COLOR: '1',
};

/**
 * `doctor` exits 1 whenever it has a warning, and with no models configured it always has one —
 * "16 of 16 chunks are not embedded". That is the correct exit code for a person at a terminal and
 * the wrong one to treat as a failure here, so the status is ignored and the JSON is read.
 */
function run(...args) {
  try {
    return execFileSync(process.execPath, [cli, ...args, '--json'], { env, encoding: 'utf8' });
  } catch (err) {
    if (typeof err.stdout === 'string' && err.stdout.trim().startsWith('{')) return err.stdout;
    throw err;
  }
}

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

try {
  const pages = fs.readdirSync(source, { recursive: true }).filter((f) => String(f).endsWith('.md')).length;

  const report = JSON.parse(run('index'));
  check('indexes every page', report.pagesIndexed === pages, `${report.pagesIndexed} of ${pages}`);

  // The whole point of the ledger format. One missed asterisk and every event silently vanishes.
  check('indexes the dated lines', report.eventsIndexed >= 10, `got ${report.eventsIndexed}`);

  const doctor = JSON.parse(run('doctor'));
  check(
    'no broken wikilinks',
    doctor.counts.brokenLinks === 0,
    `${doctor.counts.brokenLinks} broken — a link points outside the folder or at a page that is not there`,
  );
  check('every page indexed', doctor.counts.pages === pages, `${doctor.counts.pages} of ${pages}`);
  // `sources/**` is declared `role: source` in the example's own akno.json. If that stops being
  // true the example silently loses the one thing it demonstrates about quotable material.
  check('the rules file is in force', doctor.byRole?.source === 1, JSON.stringify(doctor.byRole));

  // akno.json is configuration that lives inside the knowledge base, and must not be a memory.
  const list = JSON.parse(run('list', '--kind', 'pages', '--limit', '100'));
  check(
    'does not index its own rules file',
    !JSON.stringify(list).includes('akno.json'),
    'akno.json was indexed as a page',
  );

  check('re-index is a no-op', JSON.parse(run('index')).pagesIndexed === 0, 'a second pass re-indexed pages');

  const after = fingerprint(root);
  const touched = [...after.keys()].filter((f) => before.get(f) !== after.get(f));
  const added = [...after.keys()].filter((f) => !before.has(f));
  const removed = [...before.keys()].filter((f) => !after.has(f));
  check(
    'leaves the example byte-identical',
    touched.length === 0 && added.length === 0 && removed.length === 0,
    `changed ${touched.join(', ')} added ${added.join(', ')} removed ${removed.join(', ')}`,
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks)
  process.stdout.write(`  ${c.ok ? 'ok ' : 'FAIL'}  ${c.name}${c.ok ? '' : `  — ${c.detail}`}\n`);
process.stdout.write(`\n${checks.length - failed.length}/${checks.length} passed\n`);
process.exitCode = failed.length === 0 ? 0 : 1;

function fingerprint(dir) {
  const out = new Map();
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const abs = path.join(entry.parentPath, entry.name);
    out.set(path.relative(dir, abs), crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
  }
  return out;
}
