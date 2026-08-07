import { open, runBench, type Akno } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, style } from '../output.ts';

const BENCH_HELP = `akno bench [options]

  Run the performance budgets from the spec against the current knowledge base.
  Numbers rot, so these are asserted rather than remembered — CI fails on
  regression.

  Index-path budgets are asserted. Model-path timings are reported but never
  budgeted: a slow local model is not a regression in this code, and a bench that
  fails on somebody's GPU gets ignored within a week.

  --iterations <n>    Samples per measurement (default 12).
  --write             Also measure the restart sweep, which needs the write
                      handle. Skipped otherwise rather than measured wrongly.
  --json`;

export async function benchCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ iterations?: string; write: boolean }>(argv, {
    iterations: { type: 'string' },
    write: { type: 'boolean', default: false },
  });

  if (values.help) {
    line(BENCH_HELP);
    return 0;
  }

  const openOptions = openOptionsFrom(values);
  const mem = await open({ ...openOptions, writable: values.write });

  // "Lexical only" has to mean the model stack is absent, not that we hoped it
  // would go unused. A second handle over the same index with no models
  // configured is the only honest way to measure the index path alone.
  let lexical: Akno | null = null;
  try {
    lexical = await open({
      ...openOptions,
      writable: false,
      overrides: {
        providers: {},
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { id: null },
          expansion: { id: null },
        },
      },
    });
  } catch {
    // Without it the index-path cases report as skipped, with the reason.
  }

  try {
    const report = await runBench(mem, {
      ...(values.iterations ? { iterations: Number(values.iterations) } : {}),
      ...(lexical ? { lexical } : {}),
      ...(values.write ? { writable: mem } : {}),
    });

    if (values.json) {
      json(report);
      return report.passed ? 0 : 1;
    }

    heading(`Bench — ${report.pages} pages, ${report.chunks} chunks`);
    const width = Math.max(...report.results.map((result) => result.name.length));

    for (const result of report.results) {
      if (result.skipped) {
        const label = result.passed ? style.grey('skipped') : style.red('FAIL');
        line(`  ${result.name.padEnd(width)}  ${label}  ${style.grey(result.skipped)}`);
        continue;
      }
      const verdict =
        result.budgetMs === null
          ? style.cyan('measured')
          : result.passed
            ? style.green('pass')
            : style.red('FAIL');
      const budget = result.budgetMs === null ? 'not budgeted' : `budget ${result.budgetMs}ms`;
      line(
        `  ${result.name.padEnd(width)}  ${verdict}  ` +
          `${style.grey(`p50 ${result.p50Ms}ms  p95 ${result.p95Ms}ms  ${budget}`)}`,
      );
    }

    for (const note of report.notes) line(`\n  ${style.grey(note)}`);
    line(`\n${report.passed ? style.green('all asserted budgets met') : style.red('budget regression')}`);
    return report.passed ? 0 : 1;
  } finally {
    await lexical?.close();
    await mem.close();
  }
}
