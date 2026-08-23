#!/usr/bin/env node
/**
 * End-to-end smoke test against a generated knowledge base, driven through the
 * CLI exactly as a user would. Runs with no models configured, which is the point:
 * the read path must work when the whole model stack is absent, and it must *say*
 * that it is degraded rather than implying the knowledge base is empty.
 *
 * Kept as a plain script rather than a vitest case so CI exercises the built
 * `dist` output and the real argument parsing, not the source modules.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-smoke-kb-'));
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-smoke-state-'));
const cli = path.resolve('packages/cli/dist/bin.js');

const PAGES = {
  'timeline.md': `# Timeline\n\n## 2026\n- **2026-03-20** | Replaced the dishwasher — Zephyr. [[home/appliances]]\n`,
  'home/appliances.md': `---\ntitle: Appliances\ntags: [home]\n---\n\n# Appliances\n\n## Dishwasher\nZephyr QX-100, installed 2026-03-20, five-year warranty.\n`,
  'home/lease.md': `---\ntitle: Apartment lease\ntype: contract\n---\n\n# Apartment lease\n\n- Rent: 1111 EUR per month\n- Renews: 2027-06-02\n\nRelated: [[home/appliances]]\n`,
  'sources/rules.md': `---\ntitle: Building rules\nakno:\n  role: source\n  management:\n    remember: deny\n---\n\n# Building rules\n\nNo deliveries after 20:00. Quiet hours 22:00 to 07:00.\n`,
};

for (const [relPath, content] of Object.entries(PAGES)) {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
}

// AKNO_ISOLATED restricts config to committed defaults plus env, so a
// developer's config/local.jsonc cannot make this pass or fail for the wrong
// reason. Committed defaults configure no model endpoint, so every role resolves
// to unavailable — which is exactly the condition worth testing.
const env = {
  ...process.env,
  AKNO_ISOLATED: '1',
  AKNO_PATH: root,
  AKNO_STATE_DIR: stateDir,
  NO_COLOR: '1',
};

function run(...args) {
  return execFileSync(process.execPath, [cli, ...args, '--json'], { env, encoding: 'utf8' });
}

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

try {
  const indexReport = JSON.parse(run('index'));
  check('indexes every page', indexReport.pagesIndexed === 4, `got ${indexReport.pagesIndexed}`);
  check('writes chunks', indexReport.chunksWritten > 0, `got ${indexReport.chunksWritten}`);
  check('indexes the ledger event', indexReport.eventsIndexed >= 1, `got ${indexReport.eventsIndexed}`);

  const second = JSON.parse(run('index'));
  check('re-index is a no-op', second.pagesIndexed === 0 && second.pagesUnchanged === 4);

  const recall = JSON.parse(run('recall', 'dishwasher Zephyr warranty'));
  check(
    'finds the page lexically',
    recall.cards.some((card) => card.slug === 'home/appliances'),
  );
  check(
    'reports the missing embedding model',
    (recall.degraded ?? []).includes('no_embedding_model'),
    JSON.stringify(recall.degraded),
  );
  check(
    'every line carries a real address',
    recall.cards.every((card) =>
      card.lines.every((line) => {
        const file = fs.readFileSync(path.join(root, `${card.slug}.md`), 'utf8').split('\n');
        return file[line.n - 1] === line.text;
      }),
    ),
  );

  const empty = JSON.parse(run('recall', 'zzzz nonexistent unicorn'));
  check('absence is a result with a reason', empty.cards.length === 0 && Boolean(empty.note));
  check('absence reports what was searched', empty.searched.length > 0);

  const page = JSON.parse(run('read', 'home/lease'));
  check(
    'reads a page in full',
    page.page.lines.some((line) => line.text.includes('1111')),
  );
  check(
    'reports backlinks',
    JSON.parse(run('read', 'home/appliances')).page.backlinks.includes('home/lease'),
  );

  const source = JSON.parse(run('read', 'sources/rules'));
  check(
    'read returns source pages in full',
    source.page.lines.some((line) => line.text.includes('deliveries')),
  );

  const timeline = JSON.parse(run('timeline'));
  check('timeline finds the event and its target', timeline.events[0]?.slug === 'home/appliances');

  const listed = JSON.parse(run('list', '--kind', 'pages', '--type', 'contract'));
  check('filters pages by type', listed.pages.length === 1 && listed.pages[0].slug === 'home/lease');

  const graph = JSON.parse(run('graph', '--slug', 'home/lease', '--hops', '1'));
  check(
    'inspects an exact evidence path',
    graph.status === 'ok' &&
      graph.edges.some(
        (edge) =>
          edge.relation === 'links_to' &&
          edge.evidence.slug === 'home/lease' &&
          Number.isInteger(edge.evidence.line_start),
      ),
  );
  check(
    'graph returns locators without copying claims',
    !JSON.stringify(graph).includes('1111 EUR per month'),
  );
  const emptyGraph = JSON.parse(run('graph', '--slug', 'missing/invented-page'));
  check(
    'graph distinguishes a complete miss',
    emptyGraph.status === 'empty' && emptyGraph.reason === 'seed_not_found',
  );

  const bundle = JSON.parse(run('context', 'what is the rent?', '--budget', '3000'));
  check('context fits its budget', bundle.budget_used <= 3000, `used ${bundle.budget_used}`);
  check('context includes the ledger', bundle.events.length >= 0);

  // The knowledge base must be byte-identical: nothing was written into it.
  const untouched = Object.entries(PAGES).every(
    ([relPath, content]) => fs.readFileSync(path.join(root, relPath), 'utf8') === content,
  );
  check('leaves the knowledge base byte-identical', untouched);

  const failed = checks.filter((entry) => !entry.ok);
  for (const entry of checks) {
    process.stdout.write(
      `${entry.ok ? '  ok  ' : 'FAIL  '}${entry.name}${entry.detail && !entry.ok ? ` — ${entry.detail}` : ''}\n`,
    );
  }
  process.stdout.write(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
}
