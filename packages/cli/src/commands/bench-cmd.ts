import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, style } from '../output.ts';
import { open } from '@akno/core';

const BENCH_HELP = `akno bench [options]

  Run the performance budgets from the spec against the current knowledge base.
  Numbers rot, so these are asserted rather than remembered — CI fails on
  regression.

  --iterations <n>    Samples per measurement (default 12).
  --json`;

export async function benchCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ iterations?: string }>(argv, { iterations: { type: 'string' } });

  if (values.help) {
    line(BENCH_HELP);
    return 0;
  }

  const { runBench } = await import('@akno/core');
  const mem = await open({ ...openOptionsFrom(values), writable: false });
  try {
    const report = await runBench(mem, {
      ...(values.iterations ? { iterations: Number(values.iterations) } : {}),
    });

    if (values.json) {
      json(report);
      return report.passed ? 0 : 1;
    }

    heading(`Bench — ${report.pages} pages, ${report.chunks} chunks`);
    const width = Math.max(...report.results.map((r) => r.name.length));
    for (const result of report.results) {
      if (result.skipped) {
        line(`  ${result.name.padEnd(width)}  ${style.grey(`skipped — ${result.skipped}`)}`);
        continue;
      }
      const verdict = result.passed ? style.green('pass') : style.red('FAIL');
      line(
        `  ${result.name.padEnd(width)}  ${verdict}  ` +
          `${style.grey(`p50 ${result.p50Ms}ms  p95 ${result.p95Ms}ms  budget ${result.budgetMs}ms`)}`,
      );
    }
    line(`\n${report.passed ? style.green('all budgets met') : style.red('budget regression')}`);
    return report.passed ? 0 : 1;
  } finally {
    await mem.close();
  }
}
