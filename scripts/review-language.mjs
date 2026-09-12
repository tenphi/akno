import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { languageReviewPacket, adjudicateLanguageGate } from '../packages/core/src/bench/language-review.ts';

const { values } = parseArgs({
  options: {
    report: { type: 'string', multiple: true },
    'input-review': { type: 'string' },
    'output-review': { type: 'string' },
    output: { type: 'string' },
  },
});
if (values.report?.length !== 2 || !values['input-review'] || !values.output) {
  console.error(
    'Usage: node scripts/review-language.mjs --report DEVELOPMENT.json --report HELD_OUT.json --input-review INPUT_REVIEW.json [--output-review OUTPUT_REVIEW.json] --output RESULT.json',
  );
  process.exitCode = 2;
} else {
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const reports = values.report.map(read);
  const inputReview = read(values['input-review']);
  const result = values['output-review']
    ? adjudicateLanguageGate(reports, inputReview, read(values['output-review']))
    : languageReviewPacket(reports, inputReview);
  fs.mkdirSync(path.dirname(values.output), { recursive: true });
  fs.writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n');
  console.log(
    JSON.stringify(
      { output: values.output, releaseEligible: result.releaseEligible, failures: result.failures },
      null,
      2,
    ),
  );
  if ('releaseEligible' in result && !result.releaseEligible) process.exitCode = 1;
}
