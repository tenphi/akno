import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../packages/core/src/config/load.ts';
import { runLanguageBench } from '../packages/core/src/bench/language.ts';

const { values } = parseArgs({
  options: {
    live: { type: 'boolean' },
    split: { type: 'string', default: 'development' },
    output: { type: 'string' },
    corpus: { type: 'string', default: 'v2' },
    runs: { type: 'string', default: '1' },
    case: { type: 'string', multiple: true },
  },
});
if (
  !values.live ||
  !['development', 'held-out'].includes(values.split) ||
  !['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'].includes(values.corpus) ||
  !/^[1-5]$/.test(values.runs)
) {
  console.error(
    'Usage: pnpm bench:language --live --split development|held-out [--corpus v1|v2|v3|v4|v5|v6|v7|v8] [--runs 1..5] [--case ID] [--output bench-results/language.json]\nThis opt-in run sends only the frozen invented corpus to your configured model providers.',
  );
  process.exitCode = 2;
} else {
  const report = await runLanguageBench(loadConfig(), {
    split: values.split,
    corpus: values.corpus,
    runs: Number(values.runs),
    caseIds: values.case,
    onProgress: (id, done, total) => console.error(`${done}/${total}: ${id}`),
  });
  const output = values.output ?? `bench-results/language-${values.split}.json`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({ output, metrics: report.metrics, adjudication: report.adjudication }, null, 2),
  );
}
