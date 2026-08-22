import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  markRankingMatrixPersisted,
  open,
  runBench,
  runLlmRankingProbe,
  runMixedRetrievalBench,
  runRankingBench,
  runRankingMatrix,
  type Akno,
  type MixedRetrievalBenchReport,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingBenchSystem,
  type RankingCandidateCount,
  type RankingExcerptChars,
  type RankingMatrixReport,
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
  ranking --matrix    Run fusion, optional native, Luna none at 10/20/40, and
                      Luna low at 20 candidates with repeated stability checks.
    --split <name>    development, test, or all (default development). Test is
                      held out from prompt tuning and must be selected explicitly.
    --candidates <n>  10, 20, or 40 for a single-system run (default 20).
    --excerpt-chars <n> 400, 800, or 1600 (default 800).
    --concurrency <n> Simultaneous model requests, 1..16 (single default 1,
                      matrix default 4). Latency remains per request.
    --runs <n>        Repetitions per LLM matrix variant, 1..10 (default 5).
    --skip-native     Omit the optional native reference from a matrix.
    --output <path>   Atomically persist the content-safe matrix artifact.
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
    matrix: boolean;
    'skip-native': boolean;
    provider?: string;
    model?: string;
    reasoning?: string;
    split?: string;
    system?: string;
    candidates?: string;
    'excerpt-chars'?: string;
    concurrency?: string;
    runs?: string;
    output?: string;
  }>(argv, {
    iterations: { type: 'string' },
    'retrieval-only': { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
    probe: { type: 'boolean', default: false },
    matrix: { type: 'boolean', default: false },
    'skip-native': { type: 'boolean', default: false },
    provider: { type: 'string' },
    model: { type: 'string' },
    reasoning: { type: 'string' },
    split: { type: 'string' },
    system: { type: 'string' },
    candidates: { type: 'string' },
    'excerpt-chars': { type: 'string' },
    concurrency: { type: 'string' },
    runs: { type: 'string' },
    output: { type: 'string' },
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
    if (values.matrix) {
      if (values.probe || values.system || values.candidates || values.reasoning) {
        fail('--matrix cannot be combined with --probe, --system, --candidates, or --reasoning');
        return 2;
      }
      const split = parseRankingSplit(values.split);
      const excerptChars = parseExcerptChars(values['excerpt-chars']);
      const concurrency = parseBoundedInteger(values.concurrency, 1, 16, 'concurrency');
      const runs = parseBoundedInteger(values.runs, 1, 10, 'runs');
      if (!split || !excerptChars || concurrency === null || runs === null) return 2;
      let report = await runRankingMatrix(config, {
        split,
        excerptChars,
        ...(values.provider ? { provider: values.provider } : {}),
        ...(values.model ? { model: values.model } : {}),
        ...(values.concurrency ? { concurrency } : {}),
        ...(values.runs ? { runs } : {}),
        ...(values['skip-native'] ? { includeNative: false } : {}),
        ...(!values.json
          ? {
              onProgress: ({ variant, run, runs: total }: { variant: string; run: number; runs: number }) =>
                line(`  ${variant}  run ${run}/${total}`),
            }
          : {}),
      });
      let artifactPath: string | null = null;
      if (values.output) {
        report = markRankingMatrixPersisted(report);
        artifactPath = await writeRankingArtifact(values.output, report);
      }
      if (values.json) json(report);
      else renderRankingMatrix(report, artifactPath);
      return report.variants
        .filter((variant) => variant.system === 'llm')
        .every((variant) => variant.comparisonEligible)
        ? 0
        : 1;
    }
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
    const candidateCount = parseCandidateCount(values.candidates);
    const excerptChars = parseExcerptChars(values['excerpt-chars']);
    const concurrency = parseBoundedInteger(values.concurrency, 1, 16, 'concurrency');
    if (!candidateCount || !excerptChars || concurrency === null) return 2;
    if (values.output || values.runs || values['skip-native']) {
      fail('--output, --runs, and --skip-native require --matrix');
      return 2;
    }
    const report = await runRankingBench(config, {
      system,
      split,
      candidateCount,
      excerptChars,
      ...(values.concurrency ? { concurrency } : {}),
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

function parseCandidateCount(value: string | undefined): RankingCandidateCount | null {
  const count = Number(value ?? 20);
  if (count === 10 || count === 20 || count === 40) return count;
  fail(`invalid candidate count: ${value}`);
  return null;
}

function parseExcerptChars(value: string | undefined): RankingExcerptChars | null {
  const chars = Number(value ?? 800);
  if (chars === 400 || chars === 800 || chars === 1600) return chars;
  fail(`invalid excerpt length: ${value}`);
  return null;
}

function parseBoundedInteger(
  value: string | undefined,
  minimum: number,
  maximum: number,
  label: string,
): number | null {
  if (value === undefined) return minimum;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum) return parsed;
  fail(`invalid ${label}: ${value} (expected ${minimum}..${maximum})`);
  return null;
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

function renderRankingMatrix(report: RankingMatrixReport, artifactPath: string | null): void {
  heading(
    `Ranking matrix — ${report.split}, ${report.requestedRuns} repeated runs, concurrency ${report.concurrency}`,
  );
  for (const variant of report.variants) {
    const stability = variant.medianTop3Overlap === null ? 'n/a' : percent(variant.medianTop3Overlap);
    line(
      `  ${variant.id.padEnd(16)} ${variant.comparisonEligible ? style.green('measured') : style.red('UNAVAILABLE')}  ` +
        `nDCG ${fixed(variant.quality.ndcgAt10)}  Δ ${signed(variant.ndcgDeltaFromFusion)}  ` +
        `top3 ${stability}  p95 ${Math.round(variant.p95LatencyMs)}ms`,
    );
  }
  if (report.selection) {
    line(
      `\n  selected  ${report.selection.variantId}: ${report.selection.candidateCount} candidates, ` +
        `${report.selection.reasoningEffort} reasoning`,
    );
    line(`  ${style.grey(report.selection.rationale)}`);
  }
  if (artifactPath) line(`  artifact  ${artifactPath}`);
  if (report.releaseGate.blockers.length > 0) {
    line(`  release blockers  ${report.releaseGate.blockers.join(', ')}`);
  }
  const measurementsComplete = report.variants
    .filter((variant) => variant.system === 'llm')
    .every((variant) => variant.comparisonEligible);
  line(
    `\n${measurementsComplete ? style.green('matrix measurements complete') : style.red('matrix measurements incomplete')}`,
  );
  line(
    report.releaseEligible
      ? style.green('Stored held-out evidence satisfies every release gate.')
      : style.grey('The preset remains blocked until every release gate is evidenced.'),
  );
}

async function writeRankingArtifact(target: string, report: RankingMatrixReport): Promise<string> {
  const absolute = path.resolve(target);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fsp.writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fsp.rename(temporary, absolute);
  } catch (error) {
    await fsp.unlink(temporary).catch(() => undefined);
    throw error;
  }
  return absolute;
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
