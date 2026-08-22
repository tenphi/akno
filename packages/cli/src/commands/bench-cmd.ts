import {
  open,
  runBench,
  runLlmRankingProbe,
  runMixedRetrievalBench,
  type Akno,
  type MixedRetrievalBenchReport,
  type RetrievalBenchResult,
} from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { fail, heading, json, line, style } from '../output.ts';

const BENCH_HELP = `akno bench [options]

  Run performance budgets against the current knowledge base, plus retrieval
  quality assertions against a fixed corpus of invented pages and documents.
  Numbers rot, so these are asserted rather than remembered.

  Index-path budgets are asserted. Model-path timings are reported but never
  budgeted: a slow local model is not a regression in this code, and a bench that
  fails on somebody's GPU gets ignored within a week.

  --iterations <n>    Samples per measurement (default 12).
  --retrieval-only    Run only the invented mixed-retrieval corpus. Does not
                      open or query the configured knowledge base.
  ranking --probe     Send one invented three-candidate smoke probe to a live
                      generative endpoint. This is not the ranking release gate.
    --provider <name> Configured provider (default openai).
    --model <id>      Generative model (default gpt-5.6-luna).
    --reasoning <v>   none, low, medium, high, xhigh, or max (default none).
  --write             Also measure the restart sweep, which needs the write
                      handle. Skipped otherwise rather than measured wrongly.
  --json`;

export async function benchCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    iterations?: string;
    'retrieval-only': boolean;
    write: boolean;
    probe: boolean;
    provider?: string;
    model?: string;
    reasoning?: string;
  }>(argv, {
    iterations: { type: 'string' },
    'retrieval-only': { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
    probe: { type: 'boolean', default: false },
    provider: { type: 'string' },
    model: { type: 'string' },
    reasoning: { type: 'string' },
  });

  if (values.help) {
    line(BENCH_HELP);
    return 0;
  }

  if (positionals[0] === 'ranking') {
    if (!values.probe) {
      fail('ranking benchmark corpus is not implemented yet; use --probe for the invented live smoke check');
      return 2;
    }
    const reasoning = parseReasoningEffort(values.reasoning);
    if (!reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const { loadConfig } = await import('@tenphi/akno-core');
    const report = await runLlmRankingProbe(loadConfig(openOptionsFrom(values)), {
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      reasoningEffort: reasoning,
    });
    if (values.json) json(report);
    else {
      heading('LLM ranking — invented live smoke probe');
      line(`  provider    ${report.provider}`);
      line(`  model       ${report.model}`);
      line(`  reasoning   ${report.reasoningEffort}`);
      line(`  latency     ${Math.round(report.latencyMs)}ms`);
      line(`  order       ${report.order.join(' → ') || 'none'}`);
      line(`  relevance   ${report.relevance.join(', ') || 'none'}`);
      line(`\n${report.passed ? style.green('probe passed') : style.red(report.error ?? 'probe failed')}`);
      line(
        style.grey('This verifies transport, schema, and one safety case; it is not the release benchmark.'),
      );
    }
    return report.passed ? 0 : 1;
  }

  if (positionals.length > 0) {
    fail(`unknown bench target: ${positionals[0]}`);
    return 2;
  }

  if (values['retrieval-only']) {
    const retrieval = await runMixedRetrievalBench({
      ...(values.iterations ? { iterations: Number(values.iterations) } : {}),
    });
    if (values.json) json({ passed: retrieval.passed, retrieval });
    else {
      renderRetrieval(retrieval);
      line(
        `\n${retrieval.passed ? style.green('all retrieval assertions met') : style.red('retrieval regression')}`,
      );
    }
    return retrieval.passed ? 0 : 1;
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

    renderRetrieval(report.retrieval);

    for (const note of report.notes) line(`\n  ${style.grey(note)}`);
    line(`\n${report.passed ? style.green('all asserted budgets met') : style.red('budget regression')}`);
    return report.passed ? 0 : 1;
  } finally {
    await lexical?.close();
    await mem.close();
  }
}

function parseReasoningEffort(
  value: string | undefined,
): 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null {
  const effort = value ?? 'none';
  return effort === 'none' ||
    effort === 'low' ||
    effort === 'medium' ||
    effort === 'high' ||
    effort === 'xhigh' ||
    effort === 'max'
    ? effort
    : null;
}

function renderRetrieval(report: MixedRetrievalBenchReport): void {
  heading(
    `Mixed retrieval — invented corpus, ${report.corpus.pages} pages, ` +
      `${report.corpus.orphanDocuments} orphan documents`,
  );
  const width = Math.max(...report.results.map((result) => result.name.length));
  for (const result of report.results) {
    const verdict = result.passed ? style.green('pass') : style.red('FAIL');
    line(
      `  ${result.name.padEnd(width)}  ${verdict}  ` +
        style.grey(
          `${metricValue(result.value, result.unit)} ` +
            `(${result.comparison === 'at_least' ? '≥' : '≤'} ${metricValue(result.target, result.unit)}); ` +
            result.detail,
        ),
    );
  }
}

function metricValue(value: number, unit: RetrievalBenchResult['unit']): string {
  if (unit === 'ratio') return `${Math.round(value * 100)}%`;
  if (unit === 'milliseconds') return `${value}ms`;
  return String(value);
}
