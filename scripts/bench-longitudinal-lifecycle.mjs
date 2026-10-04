import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../packages/core/dist/index.js';
import { runLifecycle, lifecycleInputReview, lifecycleHash } from './longitudinal-lifecycle-runtime.mjs';
import { adjudicateLifecycle } from '../packages/core/src/bench/longitudinal-lifecycle-review.ts';
const { values } = parseArgs({
  options: {
    live: { type: 'boolean' },
    'freeze-inputs': { type: 'boolean' },
    split: { type: 'string', default: 'development' },
    runs: { type: 'string', default: '2' },
    'derive-model': { type: 'string' },
    output: { type: 'string' },
    review: { type: 'string' },
    judgments: { type: 'string' },
  },
});
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
if (values['freeze-inputs'])
  write(values.output ?? 'bench-results/lifecycle/input-review.json', lifecycleInputReview());
else if (values.review && values.judgments) {
  write(
    values.output ?? 'bench-results/lifecycle/report.json',
    adjudicateLifecycle(
      JSON.parse(fs.readFileSync(values.review, 'utf8')),
      JSON.parse(fs.readFileSync(values.judgments, 'utf8')),
    ),
  );
} else if (values.live && ['development', 'held-out'].includes(values.split) && /^[1-5]$/.test(values.runs)) {
  const output = values.output ?? `bench-results/lifecycle/${values.split}-packet.json`;
  const frozen = path.join(path.dirname(output), 'input-review.json');
  if (
    !fs.existsSync(frozen) ||
    lifecycleHash(JSON.parse(fs.readFileSync(frozen, 'utf8'))) !== lifecycleHash(lifecycleInputReview())
  )
    throw new Error('Freeze and source-review this version before model egress.');
  const config = loadConfig();
  const packet = await runLifecycle(config, {
    split: values.split,
    runs: Number(values.runs),
    deriveId: values['derive-model'] ?? config.models.derive.id,
    onProgress: (key) => console.error(key),
  });
  write(output, packet);
  console.log(JSON.stringify({ output, checkpoints: packet.checkpoints.length }));
} else {
  console.error(
    'Usage: pnpm bench:longitudinal:lifecycle --freeze-inputs | --live --split development|held-out --runs 1..5 [--derive-model ID] [--output FILE] | --review PACKET --judgments REVIEW [--output REPORT]',
  );
  process.exitCode = 2;
}
