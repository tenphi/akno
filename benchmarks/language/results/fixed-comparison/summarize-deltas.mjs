import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = path.resolve('tmp/akno-comparison');
const read = f => JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'));
const sha = f => createHash('sha256').update(fs.readFileSync(path.join(base, f))).digest('hex');
const mode = process.argv[2] ?? 'comparison';
assert(['comparison', 'integration'].includes(mode));
const modes = mode === 'integration' ? ['comparison', 'integration'] : ['comparison'];
const corpus = read('corpus.json');
const output = { mode, corpusFingerprint: corpus.corpusFingerprint, scoreHashes: {}, cases: [] };
for (const current of modes) output.scoreHashes[current] = sha(current + '-final.json');
for (const entry of corpus.cases.filter(c => c.source.admission === 'writable')) {
  const row = { id: entry.source.id, block: entry.block, arms: {} };
  for (const current of modes) {
    const prefix = current === 'integration' ? 'integration/' : '';
    const mapping = read(prefix + 'blind-map.json');
    for (const [label, candidate] of Object.entries(mapping)) {
      const runs = [];
      for (const run of [1, 2]) {
        const packet = read(prefix + `packet-v2-${entry.block}-${run}.json`).cases.find(c => c.id === entry.source.id).observations.find(o => o.candidate === candidate);
        const grade = read(prefix + `grade-${entry.block}-${run}-final.json`).cases.find(c => c.id === entry.source.id).observations.find(o => o.candidate === candidate);
        const answers = packet.queries.map(q => grade.answers.find(a => a.id === q.answer));
        assert.equal(answers.length, 8);
        runs.push({ run, completeRetention: grade.retention.complete,
          retainedError: [grade.retention.sourceEntailed, grade.retention.qualificationsPreserved, grade.retention.correctLanguage].includes(false) || grade.retention.unsafePromotion,
          usefulAnswers: answers.filter(a => a.useful).length,
          acceptedErrors: answers.filter(a => [a.sourceEntailed, a.qualificationsPreserved, a.correctLanguage].includes(false) || a.unsafePromotion).length });
      }
      row.arms[label] = { runs, usefulAnswers: runs.reduce((n, r) => n + r.usefulAnswers, 0), acceptedErrors: runs.reduce((n, r) => n + r.acceptedErrors, 0), retainedErrors: runs.filter(r => r.retainedError).length };
    }
  }
  if (mode === 'integration') row.deltaFromV77 = row.arms.Integration.usefulAnswers - row.arms.V77.usefulAnswers;
  output.cases.push(row);
}
fs.writeFileSync(path.join(base, mode + '-case-deltas.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(output, null, 2));
