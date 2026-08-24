import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  attachRankingEndToEndEvidence,
  markRankingMatrixPersisted,
  open,
  refreshRankingMatrixReport,
  runEntityResolutionBench,
  runGraphBench,
  runBench,
  runLlmRankingProbe,
  runMixedRetrievalBench,
  runRankingBench,
  runRankingEndToEnd,
  runRankingMatrix,
  type Akno,
  type EntityResolutionBenchReport,
  type GraphBenchReport,
  type MixedRetrievalBenchReport,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingBenchSystem,
  type RankingCandidateCount,
  type RankingExcerptChars,
  type RankingEndToEndReport,
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
  entities            Run the invented select-or-abstain release gate for
                      contextual entity resolution. Never opens the knowledge base.
  graph               Run the frozen, model-free held-out graph release gate.
                      Never opens the knowledge base or configured models.
  ranking --system <s> Run frozen pools with fusion, native, or llm (default
                      fusion).
  ranking --matrix    Run fusion, optional native, Luna none at 10/20/40, and
                      Luna low at 20 candidates with repeated stability checks.
  ranking --track end-to-end
                      Index the invented corpus, measure candidate-window recall,
                      then run reranking and assembly over the same derived index.
    --split <name>    development, test, or all (default development). Test is
                      held out from prompt tuning and must be selected explicitly.
    --candidates <n>  10, 20, or 40 for a single-system run (default 20).
    --excerpt-chars <n> 400, 800, or 1600 (default 800).
    --concurrency <n> Simultaneous model requests, 1..16 (single default 1,
                      matrix default 4). Latency remains per request.
    --runs <n>        Repetitions per LLM matrix variant, 1..10 (default 5).
    --skip-native     Omit the optional native reference from a matrix.
    --matrix-artifact <path>
                      Use its selected configuration and atomically attach
                      end-to-end evidence to that matrix artifact.
    --output <path>   Atomically persist the content-safe result artifact.
    --provider <name> Configured provider (default openai).
    --model <id>      Generative model (default gpt-5.6-luna).
    --embedding-provider <name>
                      Embedding provider for end-to-end recall.
    --embedding-model <id>
                      Embedding model for end-to-end recall.
    --embedding-dimensions <n>
                      Stored vector dimensions for that embedding model.
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
    track?: string;
    'matrix-artifact'?: string;
    provider?: string;
    model?: string;
    'embedding-provider'?: string;
    'embedding-model'?: string;
    'embedding-dimensions'?: string;
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
    track: { type: 'string' },
    'matrix-artifact': { type: 'string' },
    provider: { type: 'string' },
    model: { type: 'string' },
    'embedding-provider': { type: 'string' },
    'embedding-model': { type: 'string' },
    'embedding-dimensions': { type: 'string' },
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

  if (positionals[0] === 'graph') {
    if (positionals.length > 1) {
      fail(`unknown graph bench argument: ${positionals[1]}`);
      return 2;
    }
    if (
      values['retrieval-only'] ||
      values.write ||
      values.probe ||
      values.matrix ||
      values['skip-native'] ||
      values.track ||
      values['matrix-artifact'] ||
      values.provider ||
      values.model ||
      values['embedding-provider'] ||
      values['embedding-model'] ||
      values['embedding-dimensions'] ||
      values.reasoning ||
      values.split ||
      values.system ||
      values.candidates ||
      values['excerpt-chars'] ||
      values.concurrency ||
      values.runs
    ) {
      fail('graph bench is one frozen test split and accepts only --iterations, --output, and --json');
      return 2;
    }
    const report = await runGraphBench({
      ...(values.iterations ? { iterations: Number(values.iterations) } : {}),
    });
    let artifactPath: string | null = null;
    if (values.output) artifactPath = await writeJsonArtifact(values.output, report);
    if (values.json) json(report);
    else renderGraphBench(report, artifactPath);
    return report.passed ? 0 : 1;
  }

  if (positionals[0] === 'entities') {
    const reasoning = parseReasoningEffort(values.reasoning);
    if (!reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    if (positionals.length > 1) {
      fail(`unknown entities bench argument: ${positionals[1]}`);
      return 2;
    }
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    const report = await runEntityResolutionBench(config, {
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      reasoningEffort: reasoning,
    });
    let artifactPath: string | null = null;
    if (values.output) artifactPath = await writeJsonArtifact(values.output, report);
    if (values.json) json(report);
    else renderEntityResolution(report, artifactPath);
    return report.passed ? 0 : 1;
  }

  if (positionals[0] === 'ranking') {
    const reasoning = parseReasoningEffort(values.reasoning);
    if (!reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    if (values.track) {
      if (values.track !== 'end-to-end') {
        fail(`invalid ranking track: ${values.track}`);
        return 2;
      }
      if (values.matrix || values.probe || values.system || values.runs || values['skip-native']) {
        fail('--track cannot be combined with --matrix, --probe, --system, --runs, or --skip-native');
        return 2;
      }
      let matrix: RankingMatrixReport | null = null;
      if (values['matrix-artifact']) {
        matrix = refreshRankingMatrixReport(await readRankingMatrixArtifact(values['matrix-artifact']));
        if (!matrix.selection) {
          fail('the matrix artifact has no selected configuration');
          return 2;
        }
        if (values.split && values.split !== matrix.split) {
          fail(`--split ${values.split} does not match the matrix split ${matrix.split}`);
          return 2;
        }
      }
      const selection = matrix?.selection ?? null;
      const selectedVariant = selection
        ? (matrix!.variants.find((variant) => variant.id === selection.variantId) ?? null)
        : null;
      const split = parseRankingSplit(values.split ?? matrix?.split);
      const candidateCount = parseCandidateCount(
        values.candidates ?? (selection ? String(selection.candidateCount) : undefined),
      );
      const excerptChars = parseExcerptChars(
        values['excerpt-chars'] ?? (selectedVariant ? String(selectedVariant.excerptChars) : undefined),
      );
      const concurrency = parseBoundedInteger(values.concurrency, 1, 16, 'concurrency');
      const openAiPreset = selectedVariant?.provider === 'openai';
      const embeddingDimensions = parseBoundedInteger(
        values['embedding-dimensions'] ??
          (openAiPreset ? '1536' : String(config.models.embedding.dimensions ?? 1024)),
        1,
        65_536,
        'embedding dimensions',
      );
      if (
        !split ||
        !candidateCount ||
        !excerptChars ||
        concurrency === null ||
        embeddingDimensions === null
      ) {
        return 2;
      }
      if (selection && values.candidates && candidateCount !== selection.candidateCount) {
        fail('--candidates does not match the matrix selection');
        return 2;
      }
      if (selectedVariant && values['excerpt-chars'] && excerptChars !== selectedVariant.excerptChars) {
        fail('--excerpt-chars does not match the matrix selection');
        return 2;
      }
      if (selection && values.reasoning && reasoning !== selection.reasoningEffort) {
        fail('--reasoning does not match the matrix selection');
        return 2;
      }
      if (selectedVariant && values.provider && values.provider !== selectedVariant.provider) {
        fail('--provider does not match the matrix selection');
        return 2;
      }
      if (selectedVariant && values.model && values.model !== selectedVariant.model) {
        fail('--model does not match the matrix selection');
        return 2;
      }
      const report = await runRankingEndToEnd(config, {
        split,
        candidateCount,
        excerptChars,
        ...(values.concurrency ? { concurrency } : {}),
        embeddingProvider:
          values['embedding-provider'] ??
          (openAiPreset ? 'openai' : (config.models.embedding.provider?.name ?? 'local')),
        embeddingModel:
          values['embedding-model'] ??
          (openAiPreset ? 'text-embedding-3-small' : (config.models.embedding.id ?? undefined)),
        embeddingDimensions,
        provider: values.provider ?? selectedVariant?.provider ?? 'openai',
        model: values.model ?? selectedVariant?.model ?? 'gpt-5.6-luna',
        reasoningEffort: values.reasoning ? reasoning : (selection?.reasoningEffort ?? reasoning),
        ...(!values.json ? { onProgress: renderRankingEndToEndProgress() } : {}),
      });
      let artifactPath: string | null = null;
      if (values.output) artifactPath = await writeJsonArtifact(values.output, report);
      let matrixPath: string | null = null;
      if (matrix && values['matrix-artifact']) {
        matrix = attachRankingEndToEndEvidence(matrix, report);
        matrixPath = await writeJsonArtifact(values['matrix-artifact'], matrix);
      }
      if (values.json) json(report);
      else renderRankingEndToEnd(report, artifactPath, matrixPath, matrix);
      return report.passed ? 0 : 1;
    }
    if (values.matrix) {
      if (
        values.probe ||
        values.system ||
        values.candidates ||
        values.reasoning ||
        values['matrix-artifact']
      ) {
        fail(
          '--matrix cannot be combined with --probe, --system, --candidates, --reasoning, or --matrix-artifact',
        );
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
        artifactPath = await writeJsonArtifact(values.output, report);
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
    if (values.output || values.runs || values['skip-native'] || values['matrix-artifact']) {
      fail('--output, --runs, --skip-native, and --matrix-artifact require --matrix or --track');
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

function renderEntityResolution(report: EntityResolutionBenchReport, artifactPath: string | null): void {
  heading(`Entity resolution — ${report.provider}/${report.model}, invented corpus`);
  line(`  reasoning                    ${report.reasoningEffort}`);
  line(`  valid responses              ${percent(report.metrics.validResponseRate)}`);
  line(`  clear-case recall            ${percent(report.metrics.clearRecall)}`);
  line(`  selection precision          ${percent(report.metrics.selectionPrecision)}`);
  line(`  indistinguishable abstention ${percent(report.metrics.indistinguishableAbstention)}`);
  line(`  adversarial abstention       ${percent(report.metrics.adversarialAbstention)}`);
  line(`  expected outcomes            ${percent(report.metrics.expectedOutcomeAccuracy)}`);
  for (const bench of report.cases) {
    const verdict = bench.passed ? style.green('pass') : style.red('FAIL');
    line(
      `  ${bench.id.padEnd(34)} ${verdict}  ` +
        style.grey(`expected ${bench.expected ?? 'abstain'}, got ${bench.selected ?? 'abstain'}`),
    );
    if (bench.error) line(`    ${style.red(bench.error)}`);
  }
  if (artifactPath) line(`  artifact  ${artifactPath}`);
  if (report.blockers.length > 0) line(`  blockers  ${report.blockers.join(', ')}`);
  line(
    `\n${report.passed ? style.green('entity-resolution gate passed') : style.red('entity-resolution gate failed')}`,
  );
}

function renderGraphBench(report: GraphBenchReport, artifactPath: string | null): void {
  heading(
    `Graph release gate — frozen ${report.split} corpus, ${report.corpus.pages} invented pages, ` +
      `${report.corpus.cases} cases`,
  );
  line(`  expected outcomes            ${percent(report.metrics.expectedOutcomeAccuracy)}`);
  line(`  exact identity               ${percent(report.metrics.identityAccuracy)}`);
  line(`  ambiguous abstention         ${percent(report.metrics.ambiguousAbstention)}`);
  line(`  traversable provenance       ${percent(report.metrics.provenanceAccuracy)}`);
  line(`  bounded path recall          ${percent(report.metrics.pathRecall)}`);
  line(`  graph-only false positives   ${percent(report.metrics.graphOnlyFalsePositiveRate)}`);
  line(`  maintenance discovery        ${percent(report.metrics.maintenanceRecall)}`);
  line(
    `  graph latency p50 / p95      ${Math.round(report.metrics.p50LatencyMs)}ms / ` +
      `${Math.round(report.metrics.p95LatencyMs)}ms`,
  );
  line(`  mixed retrieval regression   ${report.metrics.mixedRetrievalPassed ? 'none' : style.red('FAIL')}`);
  for (const bench of report.cases) {
    const verdict = bench.passed ? style.green('pass') : style.red('FAIL');
    line(`  ${bench.id.padEnd(36)} ${verdict}  ${style.grey(bench.detail)}`);
  }
  if (artifactPath) line(`  artifact  ${artifactPath}`);
  if (report.blockers.length > 0) line(`  blockers  ${report.blockers.join(', ')}`);
  line(
    `\n${report.passed ? style.green('graph release gate passed') : style.red('graph release gate failed')}`,
  );
  if (!report.corpus.independentlyReviewed) {
    line(style.grey('The corpus is held out from user data but still awaits independent corpus review.'));
  }
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

function renderRankingEndToEnd(
  report: RankingEndToEndReport,
  artifactPath: string | null,
  matrixPath: string | null,
  matrix: RankingMatrixReport | null,
): void {
  heading(
    `Ranking end-to-end — ${report.split}, ${report.corpus.queries} queries, ` +
      `${report.candidateCount}-candidate window`,
  );
  line(
    `  embedding              ${report.embedding.provider ?? 'unavailable'}/${report.embedding.model ?? 'unavailable'}` +
      `${report.embedding.available ? '' : ' [unavailable]'}`,
  );
  line(`  embedded chunks        ${report.embedding.embeddedChunks}/${report.embedding.totalChunks}`);
  line(
    `  reranker               ${report.reranker.provider ?? 'unavailable'}/${report.reranker.model ?? 'unavailable'} ` +
      `(${report.reranker.reasoningEffort ?? 'none'})${report.reranker.available ? '' : ' [unavailable]'}`,
  );
  if (report.embedding.available) {
    line(`  candidate answer recall ${percent(report.candidateGeneration.directAnswerRecall)}`);
    line(`  ranked answer recall    ${percent(report.rankedRecall.directAnswerRecall)}`);
    line(
      `  ranked success@1 / @3  ${percent(report.rankedRecall.successAt1)} / ${percent(report.rankedRecall.successAt3)}`,
    );
    line(`  ranked MRR@10           ${fixed(report.rankedRecall.mrrAt10)}`);
    line(
      `  candidate p50 / p95     ${Math.round(report.candidateGeneration.p50LatencyMs)}ms / ` +
        `${Math.round(report.candidateGeneration.p95LatencyMs)}ms`,
    );
    line(
      `  ranked p50 / p95        ${Math.round(report.rankedRecall.p50LatencyMs)}ms / ` +
        `${Math.round(report.rankedRecall.p95LatencyMs)}ms`,
    );
    line(`  rerank fallback rate    ${percent(report.rerankFallbackRate)}`);
  } else {
    line('  recall                  not run — a complete embedding index is required');
  }
  line(
    `  degraded queries        ${report.candidateGeneration.degradedQueries} candidate / ` +
      `${report.rankedRecall.degradedQueries} ranked`,
  );
  const candidateMisses = report.queries.filter((query) => query.candidateRank === null);
  const rankedMisses = report.queries.filter((query) => query.rankedRank === null);
  if (report.embedding.available && candidateMisses.length > 0) {
    line(
      `  candidate misses        ${candidateMisses
        .slice(0, 5)
        .map((query) => query.queryId)
        .join(', ')}`,
    );
  }
  if (report.embedding.available && rankedMisses.length > 0) {
    line(
      `  ranked misses           ${rankedMisses
        .slice(0, 5)
        .map((query) => query.queryId)
        .join(', ')}`,
    );
  }
  if (artifactPath) line(`  artifact                ${artifactPath}`);
  if (matrixPath) line(`  matrix updated           ${matrixPath}`);
  if (matrix && matrix.releaseGate.blockers.length > 0) {
    line(`  release blockers        ${matrix.releaseGate.blockers.join(', ')}`);
  }
  line(
    `\n${report.passed ? style.green('end-to-end recall gate passed') : style.red('end-to-end recall gate failed')}`,
  );
  line(style.grey('Development evidence cannot substitute for independent review or a held-out run.'));
}

function renderRankingEndToEndProgress(): (progress: {
  phase: 'index' | 'candidate_generation' | 'ranked_recall';
  done: number;
  total: number;
}) => void {
  return (progress) => {
    if (progress.done !== 0 && progress.done !== progress.total) return;
    const label = progress.phase.replaceAll('_', ' ');
    line(`  ${label}  ${progress.done}/${progress.total}`);
  };
}

async function readRankingMatrixArtifact(target: string): Promise<RankingMatrixReport> {
  const absolute = path.resolve(target);
  const parsed = JSON.parse(await fsp.readFile(absolute, 'utf8')) as Partial<RankingMatrixReport>;
  if (parsed.kind !== 'ranking_matrix' || !Array.isArray(parsed.variants)) {
    throw new Error(`${absolute} is not a ranking matrix artifact`);
  }
  return parsed as RankingMatrixReport;
}

async function writeJsonArtifact(target: string, report: unknown): Promise<string> {
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
