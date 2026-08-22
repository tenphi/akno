import {
  open,
  runBench,
  runLlmRankingProbe,
  runMixedRetrievalBench,
  runRankingBench,
  type Akno,
  type MixedRetrievalBenchReport,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingBenchSystem,
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
  ranking --system <s> Run frozen pools with fusion, native, or llm (default
                      fusion).
    --split <name>    development, test, or all (default development). Test is
                      held out from prompt tuning and must be selected explicitly.
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
    split?: string;
    system?: string;
  }>(argv, {
    iterations: { type: 'string' },
    'retrieval-only': { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
    probe: { type: 'boolean', default: false },
    provider: { type: 'string' },
    model: { type: 'string' },
    reasoning: { type: 'string' },
    split: { type: 'string' },
    system: { type: 'string' },
  });

  if (values.help) {
    line(BENCH_HELP);
    return 0;
  }

  if (positionals[0] === 'ranking') {
    const reasoning = parseReasoningEffort(values.reasoning);
    if (!reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    if (values.probe) {
      const report = await runLlmRankingProbe(config, {
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
          style.grey(
            'This verifies transport, schema, and one safety case; it is not the release benchmark.',
          ),
        );
      }
      return report.passed ? 0 : 1;
    }

    const system = parseRankingSystem(values.system);
    if (!system) {
      fail(`invalid ranking system: ${values.system}`);
      return 2;
    }
    const split = parseRankingSplit(values.split);
    if (!split) {
      fail(`invalid ranking split: ${values.split}`);
      return 2;
    }
    const report = await runRankingBench(config, {
      system,
      split,
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      reasoningEffort: reasoning,
    });
    if (values.json) json(report);
    else renderRanking(report);
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

function parseRankingSystem(value: string | undefined): RankingBenchSystem | null {
  const system = value ?? 'fusion';
  return system === 'fusion' || system === 'native' || system === 'llm' ? system : null;
}

function parseRankingSplit(value: string | undefined): RankingBenchSplit | null {
  const split = value ?? 'development';
  return split === 'development' || split === 'test' || split === 'all' ? split : null;
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

function renderRanking(report: RankingBenchReport): void {
  heading(
    `Ranking ${report.split} corpus — ${report.system}, ${report.corpus.queries} queries, ` +
      `${report.corpus.judgments} judgments over ${report.corpus.sources} invented sources`,
  );
  if (report.model) {
    line(`  model                 ${report.provider}/${report.model}`);
    if (report.reasoningEffort) line(`  reasoning             ${report.reasoningEffort}`);
  }
  line(`  nDCG@10               ${fixed(report.quality.ndcgAt10)}`);
  line(`  delta from fusion     ${signed(report.ndcgDeltaFromFusion)}`);
  line(`  MRR@10                ${fixed(report.quality.mrrAt10)}`);
  line(
    `  success@1 / @3        ${percent(report.quality.successAt1)} / ${percent(report.quality.successAt3)}`,
  );
  line(`  precision@5           ${percent(report.quality.precisionAt5)}`);
  line(`  zero-over-direct      ${fixed(report.quality.gradeZeroAboveGradeThree)}`);
  line(`  valid responses       ${percent(report.validResponseRate)}`);
  line('  category nDCG Δ');
  for (const category of report.byCategory) {
    line(`    ${category.category.padEnd(24)} ${signed(category.ndcgDeltaFromFusion)}`);
  }
  if (report.qualification) {
    line(`  direct answers kept   ${percent(report.qualification.answerRetention)}`);
    line(`  support retained      ${percent(report.qualification.supportRetention)}`);
    line(`  marginal retained     ${percent(report.qualification.marginalRetention)}`);
    line(`  irrelevant rejected   ${percent(report.qualification.irrelevantRejection)}`);
    line(`  retained precision    ${percent(report.qualification.retainedPrecision)}`);
    line(`  injection rejected    ${percent(report.qualification.instructionNegativeRejection)}`);
  }
  if (report.calibration.basis === 'auto') {
    line(`  native threshold      ${report.calibration.threshold ?? 'unavailable'}`);
    line(
      `  observed score bounds ${report.calibration.lowestAnswerScore ?? 'n/a'} answer / ` +
        `${report.calibration.lowestSupportScore ?? 'n/a'} support / ` +
        `${report.calibration.highestIrrelevantScore ?? 'n/a'} irrelevant`,
    );
  }
  if (report.p95LatencyMs > 0) {
    line(
      `  latency p50 / p95     ${Math.round(report.p50LatencyMs)}ms / ${Math.round(report.p95LatencyMs)}ms`,
    );
  }
  for (const failure of report.failures) line(`  ${style.red(failure.queryId)}  ${failure.error}`);
  line(`\n${report.passed ? style.green('development gate passed') : style.red('development gate failed')}`);
  line(
    style.grey(
      report.corpus.independentlyReviewed
        ? 'Release eligibility still requires repeatability and a stored result artifact.'
        : 'The corpus awaits independent review and cannot authorize a preset release.',
    ),
  );
}

function metricValue(value: number, unit: RetrievalBenchResult['unit']): string {
  if (unit === 'ratio') return `${Math.round(value * 100)}%`;
  if (unit === 'milliseconds') return `${value}ms`;
  return String(value);
}

function fixed(value: number): string {
  return value.toFixed(3);
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${fixed(value)}`;
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
