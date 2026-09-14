import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { connect } from '../../packages/client/dist/index.js';

const mode = process.argv[2];
assert(['before', 'after'].includes(mode));
assert.equal(process.version, 'v22.22.0');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-prose-smoke-'));
const kb = path.join(temp, 'kb'), state = path.join(temp, 'state'), socket = path.join(temp, 'akno.sock');
fs.mkdirSync(kb); fs.mkdirSync(state);
const cases = [
  { slug: 'retelling', heading: 'Пересказ', view: 'reports', text: 'The Zephyr QX-100 warranty lasts five years.' },
  { slug: 'assistant', heading: 'Assistant report', view: 'reports', text: 'The Zephyr QX-100 case is silver.' },
  { slug: 'alternatives', heading: 'Предварительные версии', view: 'discussion', text: 'The Zephyr QX-100 noise comes from the hinge.' },
];
for (const c of cases) {
  c.content = `# Zephyr QX-100\n\n## ${c.heading}\n${c.text}\n\n## Recorded details\nThe label is blue.\n`;
  fs.writeFileSync(path.join(kb, c.slug + '.md'), c.content);
}
const output = fs.openSync(path.join(temp, 'service.log'), 'wx');
const service = spawn(process.execPath, ['packages/cli/src/bin.ts', 'serve', '--socket', socket, '--no-watch', '--index-on-start'], {
  cwd: process.cwd(), env: { ...process.env, AKNO_ISOLATED: '1', AKNO_PATH: kb, AKNO_STATE_DIR: state, NO_COLOR: '1' },
  stdio: ['ignore', output, output],
});
let client;
try {
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(socket)) {
    assert(service.exitCode === null, 'Isolated service exited before socket readiness');
    assert(Date.now() < deadline, 'Isolated socket readiness timed out');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  client = await connect({ socket, actor: 'user', strictVersion: true });
  const observations = [];
  for (const c of cases) {
    const result = await client.read({ slug: c.slug });
    const governed = result.page.lines.find(line => line.n === 4);
    const sibling = result.page.lines.find(line => line.n === 7);
    assert.equal(governed.text, c.text);
    assert.equal(sibling.prose.view, 'factual');
    assert.equal(sibling.prose.answer_eligible, true);
    const fixed = governed.prose.view === c.view && governed.prose.answer_eligible === false;
    assert.equal(fixed, mode === 'after');
    assert.equal(fs.readFileSync(path.join(kb, c.slug + '.md'), 'utf8'), c.content);
    observations.push({ slug: c.slug, expectedView: c.view, observed: governed.prose, sibling: sibling.prose, bytesStable: true });
  }
  assert.equal(fs.readdirSync(kb).length, cases.length);
  const result = { mode, testedAt: new Date().toISOString(), node: process.version, transport: 'isolated production Unix-socket service', models: 'disabled by isolated defaults', observations, sourceBytesStable: true };
  fs.writeFileSync(`tmp/akno-comparison/deployed-prose-${mode}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
} finally {
  await client?.close();
  service.kill('SIGTERM');
  await new Promise(resolve => {
    if (service.exitCode !== null) return resolve();
    const timeout = setTimeout(() => { service.kill('SIGKILL'); resolve(); }, 5000);
    service.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
  fs.closeSync(output);
  fs.rmSync(temp, { recursive: true, force: true });
}
