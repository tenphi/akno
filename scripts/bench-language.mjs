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
    'answer-output-tokens': { type: 'string' },
  },
});
if (
  !values.live ||
  !['development', 'held-out'].includes(values.split) ||
  ![
    'v1',
    'v2',
    'v3',
    'v4',
    'v5',
    'v6',
    'v7',
    'v8',
    'v9',
    'v10',
    'v11',
    'v12',
    'v13',
    'v14',
    'v15',
    'v16',
    'v17',
    'v18',
    'v19',
    'v20',
    'v21',
    'v22',
  ].includes(values.corpus) ||
  !/^[1-5]$/.test(values.runs) ||
  (values['answer-output-tokens'] !== undefined &&
    (!/^[1-9][0-9]*$/.test(values['answer-output-tokens']) || Number(values['answer-output-tokens']) > 8192))
) {
  console.error(
    'Usage: pnpm bench:language --live --split development|held-out [--corpus v1|v2|v3|v4|v5|v6|v7|v8|v9|v10|v11|v12|v13|v14|v15|v16|v17|v18|v19|v20|v21|v22] [--runs 1..5] [--case ID] [--answer-output-tokens 1..8192] [--output bench-results/language.json]\nThis opt-in run sends only the frozen invented corpus to your configured model providers.',
  );
  process.exitCode = 2;
} else {
  // An explicit isolated trial setting must not rewrite the user's service configuration.
  const config = loadConfig(
    values['answer-output-tokens'] === undefined
      ? {}
      : {
          overrides: { models: { answer: { max_output_tokens: Number(values['answer-output-tokens']) } } },
        },
  );
  const report = await runLanguageBench(config, {
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
