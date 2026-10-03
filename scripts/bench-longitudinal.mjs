import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../packages/core/dist/index.js';
import { runLongitudinal } from './longitudinal-runtime.mjs';
import {
  longitudinalInputReview,
  adjudicateLongitudinal,
} from '../packages/core/src/bench/longitudinal-review.ts';
const { values } = parseArgs({
  options: {
    live: { type: 'boolean' },
    split: { type: 'string', default: 'development' },
    runs: { type: 'string', default: '2' },
    output: { type: 'string' },
    review: { type: 'string' },
    judgments: { type: 'string' },
    'freeze-inputs': { type: 'boolean' },
  },
});
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
if (values['freeze-inputs']) {
  write(values.output ?? 'bench-results/longitudinal-input-review.json', longitudinalInputReview());
} else if (values.review && values.judgments) {
  const report = adjudicateLongitudinal(
    JSON.parse(fs.readFileSync(values.review, 'utf8')),
    JSON.parse(fs.readFileSync(values.judgments, 'utf8')),
  );
  write(values.output ?? 'bench-results/longitudinal-report.json', report);
  console.log(JSON.stringify({ groups: report.groups }, null, 2));
} else if (values.live && ['development', 'held-out'].includes(values.split) && /^[1-5]$/.test(values.runs)) {
  const output = values.output ?? `bench-results/longitudinal-${values.split}-packet.json`;
  const review = path.join(path.dirname(output), 'longitudinal-input-review.json');
  if (
    !fs.existsSync(review) ||
    JSON.stringify(JSON.parse(fs.readFileSync(review, 'utf8'))) !== JSON.stringify(longitudinalInputReview())
  )
    throw new Error('Freeze and review inputs before running live providers.');
  const packet = await runLongitudinal(loadConfig(), {
    split: values.split,
    runs: Number(values.runs),
    onProgress: (message) => console.error(message),
  });
  write(output, packet);
  console.log(JSON.stringify({ output, checkpoints: packet.checkpoints.length }));
} else {
  console.error(
    'Usage: pnpm bench:longitudinal --freeze-inputs | --live --split development|held-out --runs 1..5 [--output bench-results/packet.json] | --review PACKET --judgments REVIEW [--output REPORT]\nLive runs send only invented corpus inputs to configured providers. Private review packets are not publication artifacts.',
  );
  process.exitCode = 2;
}
