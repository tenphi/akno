import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  attachRankingEndToEndEvidence,
  attachRankingLatencyEvidence,
  attachRankingReviewEvidence,
  completeMergeDiscoveryReview,
  completeRankingReview,
  createMergeDiscoveryReviewPacket,
  createRankingReviewPacket,
  markAnswerBenchPersisted,
  markAutoRecallAnswerBenchPersisted,
  markAutoRecallBenchPersisted,
  markMergeDiscoveryBenchPersisted,
  markRankingMatrixPersisted,
  open,
  refreshRankingMatrixReport,
  rebaseRankingReviewPacket,
  runAnswerBench,
  runAutoRecallAnswerBench,
  runAutoRecallBench,
  runEntityResolutionBench,
  runGraphBench,
  runMergeDiscoveryBench,
  runBench,
  runLlmRankingProbe,
  runMixedRetrievalBench,
  runRankingBench,
  runRankingEndToEnd,
  runRankingLatencyBench,
  runRankingMatrix,
  RANKING_MATRIX_VARIANT_IDS,
  type Akno,
  type AnswerBenchReport,
  type AutoRecallAnswerBenchReport,
  type AutoRecallBenchReport,
  type EntityResolutionBenchReport,
  type GraphBenchReport,
  type MergeDiscoveryBenchReport,
  type MergeDiscoveryReviewEvidence,
  type MixedRetrievalBenchReport,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingBenchSystem,
  type RankingCandidateCount,
  type RankingExcerptChars,
  type RankingEndToEndReport,
  type RankingLatencyReport,
  type RankingMatrixReport,
  type RankingMatrixVariantId,
  type RankingReviewEvidence,
  type RankingReviewPacket,
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
  merge               Measure embedding-only and embedding-plus-classifier
                      near-purpose discovery against related scopes, templates,
                      and similar entities. Development is default; use
                      --split test --runs 5 for the frozen held-out gate.
  merge review        Export the model-output-free held-out review packet with
                      --output. Complete it before any held-out model run.
  answer              Run the invented answer corpus through production retrieval,
                      generation, and support verification. Development is default;
                      use --split test --runs 5 for the frozen held-out gate.
  auto-recall         Run invented prompts through the production precision-first
                      context profile. Development is default; use --split test
                      --runs 5 for the frozen held-out injection gate.
  auto-recall-answer  Compare the same invented host-model turns with and without
                      production auto-recall evidence. Development is default;
                      use --split test --runs 5 for the held-out quality gate.
  ranking --system <s> Run frozen pools with fusion, native, or llm (default
                      fusion).
  ranking --matrix    Run fusion, optional native, Luna none at 10/20/40, and
                      Luna low at 20 candidates with repeated stability checks.
    --variant <id>    Restrict a matrix to one repeated LLM variant. This creates
                      development evidence and intentionally cannot select a release preset.
  ranking --track end-to-end
                      Index the invented corpus, measure candidate-window recall,
                      then run reranking and assembly over the same derived index.
  ranking --track latency
                      Measure the selected ranker's cold negotiation, warm
                      single-flight UX, and warm loaded latency separately.
  ranking review      Export the model-output-free corpus review packet with
                      --output, or attach a completed packet with --input and
                      --matrix-artifact. Combine --input from a prior review with
                      --output to carry forward only exact unchanged passes.
    --split <name>    development, test, or all (default development). Test is
                      held out from prompt tuning and must be selected explicitly.
    --candidates <n>  10, 20, or 40 for a single-system run (default 20).
    --excerpt-chars <n> 400, 800, or 1600 (default 800).
    --concurrency <n> Simultaneous cases, 1..16 (answer caps at 8; single
                      ranking defaults 1, matrix 4). Latency remains per case.
    --runs <n>        Answer/auto-recall-answer repetitions or repetitions per LLM
                      matrix variant, 1..10 (development 1, held-out/matrix 5).
    --skip-native     Omit the optional native reference from a matrix.
    --matrix-artifact <path>
                      Use its selected configuration and atomically attach
                      end-to-end or latency evidence to that matrix artifact.
    --input <path>    Completed corpus review packet for a held-out merge run,
                      ranking review attachment, or held-out ranking run.
    --output <path>   Atomically persist the content-safe result artifact.
    --provider <name> Configured provider. Ranking defaults to openai; merge uses
                      the maintenance role; answer and auto-recall-answer use the
                      answer role; auto-recall uses reranker.
    --model <id>      Generative model. Ranking and merge default to gpt-5.6-luna;
                      answer and auto-recall-answer use the answer role;
                      auto-recall uses reranker.
    --embedding-provider <name>
                      Embedding provider for end-to-end ranking or answer recall.
    --embedding-model <id>
                      Embedding model for end-to-end ranking or answer recall.
    --embedding-dimensions <n>
                      Stored vector dimensions for that embedding model.
    --reasoning <v>   none, low, medium, high, xhigh, or max. Ranking and merge
                      default to none; answer inherits its configured role.
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
    variant?: string;
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
    input?: string;
  }>(argv, {
    iterations: { type: 'string' },
    'retrieval-only': { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
    probe: { type: 'boolean', default: false },
    matrix: { type: 'boolean', default: false },
    variant: { type: 'string' },
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
    input: { type: 'string' },
  });

  if (values.help) {
    line(BENCH_HELP);
    return 0;
  }
  if (values.input && !['ranking', 'merge'].includes(positionals[0] ?? '')) {
    fail('--input is only valid for ranking or merge');
    return 2;
  }

  if (positionals[0] === 'answer') {
    if (positionals.length > 1) {
      fail(`unknown answer bench argument: ${positionals[1]}`);
      return 2;
    }
    if (
      values['retrieval-only'] ||
      values.write ||
      values.probe ||
      values.matrix ||
      values.variant ||
      values['skip-native'] ||
      values.track ||
      values['matrix-artifact'] ||
      values.system ||
      values.candidates ||
      values['excerpt-chars'] ||
      values.iterations ||
      (values.split && !['development', 'test'].includes(values.split))
    ) {
      fail(
        'answer bench accepts development/test split, runs, provider/model, embedding, reasoning, concurrency, output, and json options',
      );
      return 2;
    }
    const reasoning = values.reasoning ? parseReasoningEffort(values.reasoning) : undefined;
    if (values.reasoning && !reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const split = (values.split ?? 'development') as 'development' | 'test';
    const runs = parseBoundedInteger(values.runs ?? (split === 'test' ? '5' : '1'), 1, 10, 'runs');
    const concurrency = parseBoundedInteger(values.concurrency ?? '2', 1, 8, 'concurrency');
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    const embeddingDimensions = parseBoundedInteger(
      values['embedding-dimensions'] ?? String(config.models.embedding.dimensions ?? 1_536),
      1,
      65_536,
      'embedding dimensions',
    );
    if (runs === null || concurrency === null || embeddingDimensions === null) return 2;
    let report = await runAnswerBench(config, {
      split,
      runs,
      concurrency,
      ...(values['embedding-provider'] ? { embeddingProvider: values['embedding-provider'] } : {}),
      ...(values['embedding-model'] ? { embeddingModel: values['embedding-model'] } : {}),
      embeddingDimensions,
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      ...(reasoning ? { reasoningEffort: reasoning } : {}),
      ...(!values.json
        ? {
            onProgress: ({ run, runs: totalRuns, done, total }) => {
              if (done === 1 || done === total)
                line(`  answer run ${run}/${totalRuns}  ${done}/${total} cases`);
            },
          }
        : {}),
    });
    let artifactPath: string | null = null;
    if (values.output) {
      report = markAnswerBenchPersisted(report);
      artifactPath = await writeJsonArtifact(values.output, report);
    }
    if (values.json) json(report);
    else renderAnswerBench(report, artifactPath);
    return report.passed ? 0 : 1;
  }

  if (positionals[0] === 'auto-recall') {
    if (positionals.length > 1) {
      fail(`unknown auto-recall bench argument: ${positionals[1]}`);
      return 2;
    }
    if (
      values['retrieval-only'] ||
      values.write ||
      values.probe ||
      values.matrix ||
      values.variant ||
      values['skip-native'] ||
      values.track ||
      values['matrix-artifact'] ||
      values.system ||
      values.candidates ||
      values['excerpt-chars'] ||
      values.iterations ||
      (values.split && !['development', 'test'].includes(values.split))
    ) {
      fail(
        'auto-recall bench accepts development/test split, runs, provider/model, embedding, reasoning, concurrency, output, and json options',
      );
      return 2;
    }
    const reasoning = values.reasoning ? parseReasoningEffort(values.reasoning) : undefined;
    if (values.reasoning && !reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const split = (values.split ?? 'development') as 'development' | 'test';
    const runs = parseBoundedInteger(values.runs ?? (split === 'test' ? '5' : '1'), 1, 10, 'runs');
    const concurrency = parseBoundedInteger(values.concurrency ?? '2', 1, 8, 'concurrency');
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    const embeddingDimensions = parseBoundedInteger(
      values['embedding-dimensions'] ?? String(config.models.embedding.dimensions ?? 1_536),
      1,
      65_536,
      'embedding dimensions',
    );
    if (runs === null || concurrency === null || embeddingDimensions === null) return 2;
    let report = await runAutoRecallBench(config, {
      split,
      runs,
      concurrency,
      ...(values['embedding-provider'] ? { embeddingProvider: values['embedding-provider'] } : {}),
      ...(values['embedding-model'] ? { embeddingModel: values['embedding-model'] } : {}),
      embeddingDimensions,
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      ...(reasoning ? { reasoningEffort: reasoning } : {}),
      ...(!values.json
        ? {
            onProgress: ({ run, runs: totalRuns, done, total }) => {
              if (done === 1 || done === total)
                line(`  auto-recall run ${run}/${totalRuns}  ${done}/${total} cases`);
            },
          }
        : {}),
    });
    let artifactPath: string | null = null;
    if (values.output) {
      report = markAutoRecallBenchPersisted(report);
      artifactPath = await writeJsonArtifact(values.output, report);
    }
    if (values.json) json(report);
    else renderAutoRecallBench(report, artifactPath);
    return report.passed ? 0 : 1;
  }

  if (positionals[0] === 'auto-recall-answer') {
    if (positionals.length > 1) {
      fail(`unknown auto-recall-answer bench argument: ${positionals[1]}`);
      return 2;
    }
    if (
      values['retrieval-only'] ||
      values.write ||
      values.probe ||
      values.matrix ||
      values.variant ||
      values['skip-native'] ||
      values.track ||
      values['matrix-artifact'] ||
      values.system ||
      values.candidates ||
      values['excerpt-chars'] ||
      values.iterations ||
      (values.split && !['development', 'test'].includes(values.split))
    ) {
      fail(
        'auto-recall-answer bench accepts development/test split, runs, provider/model, embedding, reasoning, concurrency, output, and json options',
      );
      return 2;
    }
    const reasoning = values.reasoning ? parseReasoningEffort(values.reasoning) : undefined;
    if (values.reasoning && !reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const split = (values.split ?? 'development') as 'development' | 'test';
    const runs = parseBoundedInteger(values.runs ?? (split === 'test' ? '5' : '1'), 1, 10, 'runs');
    const concurrency = parseBoundedInteger(values.concurrency ?? '2', 1, 8, 'concurrency');
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    const embeddingDimensions = parseBoundedInteger(
      values['embedding-dimensions'] ?? String(config.models.embedding.dimensions ?? 1_536),
      1,
      65_536,
      'embedding dimensions',
    );
    if (runs === null || concurrency === null || embeddingDimensions === null) return 2;
    let report = await runAutoRecallAnswerBench(config, {
      split,
      runs,
      concurrency,
      ...(values['embedding-provider'] ? { embeddingProvider: values['embedding-provider'] } : {}),
      ...(values['embedding-model'] ? { embeddingModel: values['embedding-model'] } : {}),
      embeddingDimensions,
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      ...(reasoning ? { reasoningEffort: reasoning } : {}),
      ...(!values.json
        ? {
            onProgress: ({ run, runs: totalRuns, done, total }) => {
              if (done === 1 || done === total)
                line(`  auto-recall-answer run ${run}/${totalRuns}  ${done}/${total} cases`);
            },
          }
        : {}),
    });
    let artifactPath: string | null = null;
    if (values.output) {
      report = markAutoRecallAnswerBenchPersisted(report);
      artifactPath = await writeJsonArtifact(values.output, report);
    }
    if (values.json) json(report);
    else renderAutoRecallAnswerBench(report, artifactPath);
    return report.passed ? 0 : 1;
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
      values.variant ||
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

  if (positionals[0] === 'merge') {
    if (positionals[1] === 'review') {
      if (positionals.length > 2) {
        fail(`unknown merge review argument: ${positionals[2]}`);
        return 2;
      }
      if (
        values.input ||
        values['retrieval-only'] ||
        values.write ||
        values.probe ||
        values.matrix ||
        values.variant ||
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
        values.runs ||
        values.iterations
      ) {
        fail('merge review accepts only --output and --json');
        return 2;
      }
      if (!values.output) {
        fail('merge review requires --output');
        return 2;
      }
      const packet = createMergeDiscoveryReviewPacket();
      const artifactPath = await writeJsonArtifact(values.output, packet);
      if (values.json) json(packet);
      else {
        heading('Semantic merge discovery corpus review');
        line(`  sources     ${packet.corpus.sources}`);
        line(`  cases       ${packet.corpus.cases}`);
        line(`  fingerprint ${packet.corpus.fingerprint}`);
        line(`  packet      ${artifactPath}`);
        line(style.grey('Review it independently before running the held-out model gate.'));
      }
      return 0;
    }
    if (positionals.length > 1) {
      fail(`unknown merge bench argument: ${positionals[1]}`);
      return 2;
    }
    if (
      values['retrieval-only'] ||
      values.write ||
      values.probe ||
      values.matrix ||
      values.variant ||
      values['skip-native'] ||
      values.track ||
      values['matrix-artifact'] ||
      values['embedding-dimensions'] ||
      values.system ||
      values.candidates ||
      values['excerpt-chars'] ||
      values.concurrency ||
      values.iterations
    ) {
      fail(
        'merge bench accepts development/test split, runs, review input, embedding and classifier model choices, output, and json options',
      );
      return 2;
    }
    if (values.split && !['development', 'test'].includes(values.split)) {
      fail(`invalid merge split: ${values.split}`);
      return 2;
    }
    const split = (values.split ?? 'development') as 'development' | 'test';
    const runs = parseBoundedInteger(values.runs ?? (split === 'test' ? '5' : '1'), 1, 10, 'runs');
    if (runs === null) return 2;
    if (split === 'test' && !values.input) {
      fail('held-out merge bench requires a completed review packet via --input');
      return 2;
    }
    if (split === 'test' && !values.output) {
      fail('held-out merge bench requires --output so release evidence is persisted');
      return 2;
    }
    if (split === 'development' && values.input) {
      fail('--input is only valid for the held-out merge split');
      return 2;
    }
    const reasoning = values.reasoning ? parseReasoningEffort(values.reasoning) : undefined;
    if (values.reasoning && !reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    let review: MergeDiscoveryReviewEvidence | undefined;
    if (values.input) {
      try {
        review = completeMergeDiscoveryReview(await readJsonArtifact(values.input));
      } catch (error) {
        fail(error instanceof Error ? error.message : 'invalid merge discovery review packet');
        return 2;
      }
    }
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    let report = await runMergeDiscoveryBench(config, {
      split,
      runs,
      ...(review ? { review } : {}),
      ...(values['embedding-provider'] ? { embeddingProvider: values['embedding-provider'] } : {}),
      ...(values['embedding-model'] ? { embeddingModel: values['embedding-model'] } : {}),
      ...(values.provider ? { provider: values.provider } : {}),
      ...(values.model ? { model: values.model } : {}),
      ...(reasoning ? { reasoningEffort: reasoning } : {}),
      ...(!values.json
        ? {
            onProgress: ({ run, runs: totalRuns }: { run: number; runs: number }) =>
              line(`  merge classifier run ${run}/${totalRuns}`),
          }
        : {}),
    });
    let artifactPath: string | null = null;
    if (values.output) {
      report = markMergeDiscoveryBenchPersisted(report);
      artifactPath = await writeJsonArtifact(values.output, report);
    }
    if (values.json) json(report);
    else renderMergeDiscoveryBench(report, artifactPath);
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
    if (positionals[1] === 'review') {
      if (positionals.length > 2) {
        fail(`unknown ranking review argument: ${positionals[2]}`);
        return 2;
      }
      if (
        values['retrieval-only'] ||
        values.write ||
        values.probe ||
        values.matrix ||
        values.variant ||
        values['skip-native'] ||
        values.track ||
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
        values.runs ||
        values.iterations
      ) {
        fail('ranking review accepts only --output, or --input with --matrix-artifact, plus --json');
        return 2;
      }
      if (values.input) {
        if (values.output && !values['matrix-artifact']) {
          try {
            const packet = rebaseRankingReviewPacket(await readJsonArtifact(values.input));
            const artifactPath = await writeJsonArtifact(values.output, packet);
            if (values.json) json(packet);
            else renderRankingReviewPacket(packet, artifactPath);
            return 0;
          } catch (error) {
            fail(error instanceof Error ? error.message : 'ranking review rebase failed');
            return 2;
          }
        }
        if (!values['matrix-artifact'] || values.output) {
          fail(
            'ranking review --input requires either --output for a corrected packet or --matrix-artifact for attachment',
          );
          return 2;
        }
        try {
          const packet = await readJsonArtifact(values.input);
          const evidence = completeRankingReview(packet);
          let matrix = refreshRankingMatrixReport(await readRankingMatrixArtifact(values['matrix-artifact']));
          matrix = attachRankingReviewEvidence(matrix, evidence);
          const matrixPath = await writeJsonArtifact(values['matrix-artifact'], matrix);
          if (values.json) json(evidence);
          else renderRankingReviewEvidence(evidence, matrixPath, matrix);
          return 0;
        } catch (error) {
          fail(error instanceof Error ? error.message : 'ranking review validation failed');
          return 2;
        }
      }
      if (!values.output || values['matrix-artifact']) {
        fail('exporting a ranking review requires --output and does not accept --matrix-artifact');
        return 2;
      }
      const packet = createRankingReviewPacket();
      const artifactPath = await writeJsonArtifact(values.output, packet);
      if (values.json) json(packet);
      else renderRankingReviewPacket(packet, artifactPath);
      return 0;
    }
    if (positionals.length > 1) {
      fail(`unknown ranking bench argument: ${positionals[1]}`);
      return 2;
    }
    if (values.input && (values.track || values.probe)) {
      fail('--input unlocks held-out matrix or single-system runs; tracks use a reviewed matrix instead');
      return 2;
    }
    let heldOutReview: RankingReviewEvidence | null = null;
    if (values.input) {
      try {
        heldOutReview = completeRankingReview(await readJsonArtifact(values.input));
      } catch (error) {
        fail(error instanceof Error ? error.message : 'ranking review validation failed');
        return 2;
      }
    }
    const reasoning = parseReasoningEffort(values.reasoning);
    if (!reasoning) {
      fail(`invalid reasoning effort: ${values.reasoning}`);
      return 2;
    }
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    if (values.track) {
      if (values.track !== 'end-to-end' && values.track !== 'latency') {
        fail(`invalid ranking track: ${values.track}`);
        return 2;
      }
      if (values.track === 'latency') {
        if (
          values.matrix ||
          values.variant ||
          values.probe ||
          values.system ||
          values.runs ||
          values['skip-native'] ||
          values['embedding-provider'] ||
          values['embedding-model'] ||
          values['embedding-dimensions'] ||
          values.split ||
          values.candidates ||
          values['excerpt-chars'] ||
          values.provider ||
          values.model ||
          values.reasoning
        ) {
          fail(
            'ranking latency uses the matrix selection and accepts only --matrix-artifact, --concurrency, --output, and --json',
          );
          return 2;
        }
        if (!values['matrix-artifact']) {
          fail('ranking latency requires --matrix-artifact');
          return 2;
        }
        let matrix = refreshRankingMatrixReport(await readRankingMatrixArtifact(values['matrix-artifact']));
        if (!matrix.selection) {
          fail('the matrix artifact has no selected configuration');
          return 2;
        }
        if (matrix.split !== 'development' && !hasIndependentRankingReview(matrix)) {
          fail('held-out ranking tracks require a matrix with an accepted independent review receipt');
          return 2;
        }
        const selected = matrix.variants.find((variant) => variant.id === matrix.selection!.variantId);
        if (
          !selected ||
          !selected.provider ||
          !selected.model ||
          !selected.reasoningEffort ||
          !selected.promptVersion ||
          !selected.schemaVersion
        ) {
          fail('the selected matrix variant has no complete LLM configuration');
          return 2;
        }
        const loadConcurrency = parseBoundedInteger(
          values.concurrency ?? String(Math.max(2, matrix.concurrency)),
          2,
          16,
          'concurrency',
        );
        if (loadConcurrency === null) return 2;
        const report = await runRankingLatencyBench(config, {
          split: matrix.split,
          candidateCount: selected.candidateCount,
          excerptChars: selected.excerptChars,
          loadConcurrency,
          provider: selected.provider,
          model: selected.model,
          reasoningEffort: selected.reasoningEffort,
          ...(!values.json
            ? {
                onProgress: ({ profile, concurrency }) =>
                  line(`  ${profile} profile  concurrency ${concurrency}`),
              }
            : {}),
        });
        let artifactPath: string | null = null;
        if (values.output) artifactPath = await writeJsonArtifact(values.output, report);
        matrix = attachRankingLatencyEvidence(matrix, report);
        const matrixPath = await writeJsonArtifact(values['matrix-artifact'], matrix);
        if (values.json) json(report);
        else renderRankingLatency(report, artifactPath, matrixPath, matrix);
        return report.passed ? 0 : 1;
      }
      if (
        values.matrix ||
        values.variant ||
        values.probe ||
        values.system ||
        values.runs ||
        values['skip-native']
      ) {
        fail(
          '--track cannot be combined with --matrix, --variant, --probe, --system, --runs, or --skip-native',
        );
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
      if (split !== 'development' && (!matrix || !hasIndependentRankingReview(matrix))) {
        fail('held-out ranking tracks require a reviewed --matrix-artifact');
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
      const selectedVariantId = parseRankingMatrixVariant(values.variant);
      if (
        !split ||
        !excerptChars ||
        concurrency === null ||
        runs === null ||
        (values.variant && !selectedVariantId)
      )
        return 2;
      if (selectedVariantId && split !== 'development') {
        fail('--variant is development-only; use the complete pre-declared matrix for held-out evidence');
        return 2;
      }
      if (split !== 'development' && !heldOutReview) {
        fail('held-out ranking requires --input with an approved independent review packet');
        return 2;
      }
      if (split === 'development' && heldOutReview) {
        fail('--input is only accepted when a ranking run reads the held-out split');
        return 2;
      }
      let report = await runRankingMatrix(config, {
        split,
        excerptChars,
        ...(values.provider ? { provider: values.provider } : {}),
        ...(values.model ? { model: values.model } : {}),
        ...(values.concurrency ? { concurrency } : {}),
        ...(values.runs ? { runs } : {}),
        ...(values['skip-native'] ? { includeNative: false } : {}),
        ...(selectedVariantId ? { variants: [selectedVariantId] } : {}),
        ...(!values.json
          ? {
              onProgress: ({
                variant: id,
                run,
                runs: total,
              }: {
                variant: string;
                run: number;
                runs: number;
              }) => line(`  ${id}  run ${run}/${total}`),
            }
          : {}),
      });
      if (heldOutReview) report = attachRankingReviewEvidence(report, heldOutReview);
      let artifactPath: string | null = null;
      if (values.output) {
        report = markRankingMatrixPersisted(report);
        artifactPath = await writeJsonArtifact(values.output, report);
      }
      if (values.json) json(report);
      else renderRankingMatrix(report, artifactPath);
      return report.variants
        .filter((entry) => entry.system === 'llm')
        .every((entry) => entry.comparisonEligible)
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
    if (split !== 'development' && !heldOutReview) {
      fail('held-out ranking requires --input with an approved independent review packet');
      return 2;
    }
    if (split === 'development' && heldOutReview) {
      fail('--input is only accepted when a ranking run reads the held-out split');
      return 2;
    }
    if (
      values.output ||
      values.variant ||
      values.runs ||
      values['skip-native'] ||
      values['matrix-artifact']
    ) {
      fail('--output, --variant, --runs, --skip-native, and --matrix-artifact require --matrix or --track');
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

function parseRankingMatrixVariant(value: string | undefined): RankingMatrixVariantId | null {
  if (value === undefined) return null;
  if (RANKING_MATRIX_VARIANT_IDS.includes(value as RankingMatrixVariantId)) {
    return value as RankingMatrixVariantId;
  }
  fail(`invalid ranking matrix variant: ${value} (expected ${RANKING_MATRIX_VARIANT_IDS.join(', ')})`);
  return null;
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
  if (report.execution.requests > 0) {
    line(
      `  endpoint requests     ${report.execution.endpointRequests} ` +
        `(${report.execution.extraEndpointRequests} beyond ${report.execution.requests} logical calls)`,
    );
  }
  const tokenUsage = report.execution.tokenUsage;
  if (tokenUsage) {
    line(
      `  provider tokens       ${tokenUsage.inputTokens ?? 'n/a'} input / ` +
        `${tokenUsage.outputTokens ?? 'n/a'} output on ` +
        `${tokenUsage.reportedQueries}/${report.execution.requests} calls`,
    );
    if (tokenUsage.cachedInputTokens !== null || tokenUsage.reasoningOutputTokens !== null) {
      line(
        `  token details        ${tokenUsage.cachedInputTokens ?? 'n/a'} cached input / ` +
          `${tokenUsage.reasoningOutputTokens ?? 'n/a'} reasoning output`,
      );
    }
  }
  for (const failure of report.failures) line(`  ${style.red(failure.queryId)}  ${failure.error}`);
  line(`\n${report.passed ? style.green('development gate passed') : style.red('development gate failed')}`);
  line(style.grey('Single-system results are tuning evidence; review receipts attach only to a matrix.'));
}

function renderRankingReviewPacket(packet: RankingReviewPacket, artifactPath: string): void {
  heading('Ranking corpus review — independent handoff packet');
  line(`  corpus       ${packet.corpus.version}`);
  line(`  fingerprint  ${packet.corpus.fingerprint}`);
  line(
    `  scope        ${packet.corpus.sources} sources, ${packet.corpus.queries} queries, ` +
      `${packet.corpus.judgments} judgments`,
  );
  line(`  packet       ${artifactPath}`);
  line('\n  Reviewer workflow');
  packet.instructions.forEach((instruction, index) => line(`    ${index + 1}. ${instruction}`));
  line(
    style.grey(
      'The packet contains corpus content and grades, but no prompt, model response, score, or benchmark outcome.',
    ),
  );
}

function renderRankingReviewEvidence(
  evidence: RankingReviewEvidence,
  matrixPath: string,
  matrix: RankingMatrixReport,
): void {
  heading('Ranking corpus review — receipt attached');
  line(`  reviewer     ${evidence.reviewerKind}`);
  line(`  reviewed     ${evidence.reviewedAt}`);
  line(`  coverage     ${evidence.sourceReviews} sources, ${evidence.caseReviews} cases`);
  line(`  corpus       ${evidence.corpusFingerprint}`);
  line(`  receipt      ${evidence.receiptFingerprint}`);
  line(`  matrix       ${matrixPath}`);
  if (matrix.releaseGate.blockers.length > 0) {
    line(`  release blockers  ${matrix.releaseGate.blockers.join(', ')}`);
  }
  line(`\n${style.green('independent review receipt accepted')}`);
}

function hasIndependentRankingReview(matrix: RankingMatrixReport): boolean {
  return matrix.releaseGate.checks.some((check) => check.id === 'independent_review' && check.passed);
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

function renderAnswerBench(report: AnswerBenchReport, artifactPath: string | null): void {
  heading(
    `Grounded answers — ${report.split}, ${report.corpus.cases} cases across ` +
      `${report.corpus.categories} categories, ${report.stability.requestedRuns} run(s)`,
  );
  line(`  answer model          ${report.answerModel.provider}/${report.answerModel.model}`);
  line(`  reasoning             ${report.answerModel.reasoningEffort ?? 'provider default'}`);
  line(`  embedding              ${report.embedding.provider}/${report.embedding.model}`);
  line(`  execution              ${percent(report.metrics.executionRate)}`);
  line(`  expected outcomes      ${percent(report.metrics.outcomeAccuracy)}`);
  line(`  expected facts         ${percent(report.metrics.expectedFactAccuracy)}`);
  line(
    `  citation precision    ${percent(report.metrics.citationPrecision)} / recall ${percent(report.metrics.citationRecall)}`,
  );
  line(`  retrieval recall       ${percent(report.metrics.retrievalRecall)}`);
  line(`  abstention accuracy    ${percent(report.metrics.abstentionAccuracy)}`);
  line(`  privacy leak rate      ${percent(report.metrics.privacyLeakRate)}`);
  line(`  degraded rate          ${percent(report.metrics.degradedRate)}`);
  line(`  verifier failure rate  ${percent(report.metrics.verificationFailureRate)}`);
  line(
    `  case stability        ${
      report.stability.stableCaseRate === null ? 'n/a (one run)' : percent(report.stability.stableCaseRate)
    }`,
  );
  line(`  minimum run pass rate ${percent(report.stability.minimumRunPassRate)}`);
  line(
    `  latency p50 / p95     ${Math.round(report.execution.p50LatencyMs)}ms / ` +
      `${Math.round(report.execution.p95LatencyMs)}ms ` +
      style.grey(`(gate ≤ ${report.thresholds.p95LatencyMs}ms)`),
  );
  line(
    `  provider usage        ${report.execution.providerTotalTokens} tokens across ` +
      `${report.execution.usageReportedCalls}/${report.execution.modelCalls} reported calls`,
  );
  if (report.runs.length > 1) {
    for (const run of report.runs) {
      line(
        `  run ${String(run.run).padEnd(2)}                ${run.casesPassed}/${run.casesTotal} passed, ` +
          `p95 ${Math.round(run.p95LatencyMs)}ms`,
      );
    }
  }
  for (const benchCase of report.cases) {
    const verdict = benchCase.passed ? style.green('pass') : style.red('FAIL');
    line(
      `  ${benchCase.id.padEnd(36)} ${verdict}  ` +
        style.grey(`${benchCase.status ?? 'not run'}/${benchCase.outcome ?? benchCase.error ?? 'unknown'}`),
    );
  }
  if (report.stability.flakyCaseIds.length > 0) {
    line(`  flaky cases            ${report.stability.flakyCaseIds.join(', ')}`);
  }
  if (artifactPath) line(`  artifact               ${artifactPath}`);
  if (report.blockers.length > 0) line(`  blockers               ${report.blockers.join(', ')}`);
  line(
    `\n${report.passed ? style.green(`${report.split} quality gate passed`) : style.red(`${report.split} quality gate failed`)}`,
  );
  line(
    report.releaseEligible
      ? style.green('Stored held-out evidence satisfies every release gate.')
      : style.grey(`Release remains blocked by: ${report.releaseBlockers.join(', ')}.`),
  );
}

function renderAutoRecallBench(report: AutoRecallBenchReport, artifactPath: string | null): void {
  heading(
    `Auto-recall — ${report.split}, ${report.corpus.cases} cases across ` +
      `${report.corpus.categories} categories, ${report.stability.requestedRuns} run(s)`,
  );
  line(`  qualifier               ${report.qualifier.provider}/${report.qualifier.model}`);
  line(`  mode / reasoning        ${report.qualifier.mode}/${report.qualifier.reasoningEffort ?? 'default'}`);
  line(`  embedding               ${report.embedding.provider}/${report.embedding.model}`);
  line(`  execution               ${percent(report.metrics.executionRate)}`);
  line(
    `  activation precision   ${percent(report.metrics.activationPrecision)} / recall ${percent(report.metrics.activationRecall)}`,
  );
  line(`  activation accuracy    ${percent(report.metrics.activationAccuracy)}`);
  line(
    `  source precision       ${percent(report.metrics.sourcePrecision)} / recall ${percent(report.metrics.sourceRecall)}`,
  );
  line(`  irrelevant injection   ${percent(report.metrics.irrelevantInjectionRate)}`);
  line(`  qualification policy   ${percent(report.metrics.qualificationAccuracy)}`);
  line(`  exact locators          ${percent(report.metrics.locatorAccuracy)}`);
  line(`  evidence isolation      ${percent(report.metrics.evidenceIsolation)}`);
  line(`  hard-budget compliance  ${percent(report.metrics.budgetCompliance)}`);
  line(`  degraded rate           ${percent(report.metrics.degradedRate)}`);
  line(
    `  qualifier activation   ${percent(report.execution.qualificationRate)} ` +
      style.grey(`(gate ≤ ${percent(report.thresholds.maximumQualificationRate)})`),
  );
  line(
    `  latency p50 / p95      ${Math.round(report.execution.p50LatencyMs)}ms / ` +
      `${Math.round(report.execution.p95LatencyMs)}ms ` +
      style.grey(`(gate ≤ ${report.thresholds.p95LatencyMs}ms)`),
  );
  line(
    `  provider usage         ${report.execution.providerTotalTokens} tokens across ` +
      `${report.execution.usageReportedCalls}/${report.execution.qualificationCalls} reported calls`,
  );
  line(
    `  case stability         ${
      report.stability.stableCaseRate === null ? 'n/a (one run)' : percent(report.stability.stableCaseRate)
    }`,
  );
  line(`  minimum run pass rate  ${percent(report.stability.minimumRunPassRate)}`);
  for (const benchCase of report.cases) {
    const verdict = benchCase.passed ? style.green('pass') : style.red('FAIL');
    const outcome = benchCase.activated ? `activated/${benchCase.activationBasis}` : 'empty';
    line(
      `  ${benchCase.id.padEnd(40)} ${verdict}  ` +
        style.grey(`${outcome}; ${benchCase.selectedCount} selected; q=${benchCase.qualificationRun}`),
    );
  }
  if (report.stability.flakyCaseIds.length > 0) {
    line(`  flaky cases             ${report.stability.flakyCaseIds.join(', ')}`);
  }
  if (artifactPath) line(`  artifact                ${artifactPath}`);
  if (report.blockers.length > 0) line(`  blockers                ${report.blockers.join(', ')}`);
  line(
    `\n${report.passed ? style.green(`${report.split} injection gate passed`) : style.red(`${report.split} injection gate failed`)}`,
  );
  line(
    report.releaseEligible
      ? style.green('Stored held-out evidence satisfies every release gate.')
      : style.grey(`Release remains blocked by: ${report.releaseBlockers.join(', ')}.`),
  );
}

function renderAutoRecallAnswerBench(report: AutoRecallAnswerBenchReport, artifactPath: string | null): void {
  heading(
    `Auto-recall host answers — ${report.split}, ${report.corpus.cases} paired cases across ` +
      `${report.corpus.categories} categories, ${report.stability.requestedRuns} run(s)`,
  );
  line(`  host model                    ${report.hostModel.provider}/${report.hostModel.model}`);
  line(`  reasoning                     ${report.hostModel.reasoningEffort ?? 'provider default'}`);
  line(`  qualifier                     ${report.qualifier.provider}/${report.qualifier.model}`);
  line(`  embedding                     ${report.embedding.provider}/${report.embedding.model}`);
  line(`  execution                     ${percent(report.metrics.executionRate)}`);
  line(`  context activation            ${percent(report.metrics.activationAccuracy)}`);
  line(`  evidence fact coverage        ${percent(report.metrics.evidenceFactAccuracy)}`);
  line(`  answers with memory           ${percent(report.metrics.withMemoryAccuracy)}`);
  line(`  facts with memory             ${percent(report.metrics.withMemoryFactAccuracy)}`);
  line(`  abstention with memory        ${percent(report.metrics.withMemoryAbstentionAccuracy)}`);
  line(`  abstention without memory     ${percent(report.metrics.withoutMemoryAbstentionAccuracy)}`);
  line(`  pairwise improvement          ${percent(report.metrics.pairwiseImprovementRate)}`);
  line(`  unsupported claim rate        ${percent(report.metrics.unsupportedClaimRate)}`);
  line(`  forbidden-memory leak rate    ${percent(report.metrics.forbiddenLeakRate)}`);
  line(
    `  context latency p50 / p95     ${Math.round(report.execution.p50ContextLatencyMs)}ms / ` +
      `${Math.round(report.execution.p95ContextLatencyMs)}ms`,
  );
  line(
    `  on total latency p50 / p95    ${Math.round(report.execution.p50OnTotalLatencyMs)}ms / ` +
      `${Math.round(report.execution.p95OnTotalLatencyMs)}ms`,
  );
  line(
    `  incremental p95               ${Math.round(report.execution.p95IncrementalLatencyMs)}ms ` +
      style.grey(`(gate ≤ ${report.thresholds.incrementalP95LatencyMs}ms)`),
  );
  line(
    `  host provider usage           ${report.execution.hostProviderTotalTokens} tokens across ` +
      `${report.execution.hostUsageReportedCalls}/${report.execution.hostModelCalls} reported calls`,
  );
  line(
    `  qualifier provider usage      ${report.execution.qualificationProviderTotalTokens} tokens across ` +
      `${report.execution.qualificationUsageReportedCalls}/${report.execution.qualificationCalls} reported calls`,
  );
  line(
    `  case stability                ${
      report.stability.stableCaseRate === null ? 'n/a (one run)' : percent(report.stability.stableCaseRate)
    }`,
  );
  for (const benchCase of report.cases) {
    const verdict = benchCase.passed ? style.green('pass') : style.red('FAIL');
    const memory = benchCase.contextActivated ? `${benchCase.evidenceCount} evidence` : 'empty';
    const answer = benchCase.withMemory.answered ? 'answered' : 'abstained';
    line(`  ${benchCase.id.padEnd(40)} ${verdict}  ${style.grey(`${memory}; on=${answer}`)}`);
  }
  if (report.stability.flakyCaseIds.length > 0) {
    line(`  flaky cases                    ${report.stability.flakyCaseIds.join(', ')}`);
  }
  if (artifactPath) line(`  artifact                       ${artifactPath}`);
  if (report.blockers.length > 0) line(`  blockers                       ${report.blockers.join(', ')}`);
  line(
    `\n${report.passed ? style.green(`${report.split} host-answer gate passed`) : style.red(`${report.split} host-answer gate failed`)}`,
  );
  line(
    report.releaseEligible
      ? style.green('Stored held-out evidence satisfies every release gate.')
      : style.grey(`Release remains blocked by: ${report.releaseBlockers.join(', ')}.`),
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

function renderMergeDiscoveryBench(report: MergeDiscoveryBenchReport, artifactPath: string | null): void {
  heading(
    `Semantic merge discovery — ${report.split}, ${report.corpus.pages} invented pages, ` +
      `${report.corpus.cases} declared pairs, ${report.stability.requestedRuns} run(s)`,
  );
  line(`  corpus reviewed                ${report.corpus.independentlyReviewed ? 'yes' : 'no'}`);
  line(`  embedding                     ${report.embedding.provider}/${report.embedding.model}`);
  line(`  embedding-only threshold      ${report.embeddingOnly.threshold.toFixed(4)}`);
  line(`  embedding-only recall         ${percent(report.embeddingOnly.metrics.candidateRecall)}`);
  line(`  embedding-only precision      ${percent(report.embeddingOnly.metrics.candidatePrecision)}`);
  line(`  embedding-only margin         ${report.embeddingOnly.metrics.scoreMargin.toFixed(4)}`);
  line(`  embedding latency             ${Math.round(report.embeddingLatencyMs)}ms`);
  for (const bench of report.embeddingOnly.cases) {
    const verdict = bench.passed ? style.green('pass') : style.red('FAIL');
    line(
      `  ${bench.id.padEnd(32)} ${verdict}  ${bench.score.toFixed(4)}  ` +
        style.grey(`${bench.expected}; ${bench.selected ? 'selected' : 'separate'}`),
    );
  }
  if (report.classifier) {
    line(`\n  classifier                    ${report.classifier.provider}/${report.classifier.model}`);
    line(`  classifier reasoning          ${report.classifier.reasoningEffort}`);
    line(`  prefilter threshold           ${report.classifier.prefilterThreshold.toFixed(4)}`);
    line(`  classifier calls              ${report.classifier.calls}`);
    line(`  final candidate recall        ${percent(report.classifier.metrics.candidateRecall)}`);
    line(`  final candidate precision     ${percent(report.classifier.metrics.candidatePrecision)}`);
    line(`  final false positives         ${percent(report.classifier.metrics.falsePositiveRate)}`);
    line(`  related-scope rejection       ${percent(report.classifier.metrics.relatedScopeRejection)}`);
    line(`  template rejection            ${percent(report.classifier.metrics.templateRejection)}`);
    line(`  entity-collision rejection    ${percent(report.classifier.metrics.entityCollisionRejection)}`);
    for (const bench of report.classifier.cases) {
      const verdict = bench.passed ? style.green('pass') : style.red('FAIL');
      line(
        `  ${bench.id.padEnd(32)} ${verdict}  ` +
          style.grey(
            `${bench.prefiltered ? (bench.outcome ?? 'invalid') : 'prefiltered'}; ${Math.round(bench.latencyMs)}ms`,
          ),
      );
    }
  }
  line(
    `  classifier stability          ${
      report.stability.stableCaseRate === null ? 'n/a (one run)' : percent(report.stability.stableCaseRate)
    }`,
  );
  line(`  passing runs                  ${report.stability.passingRuns}/${report.stability.requestedRuns}`);
  if (report.stability.flakyCaseIds.length > 0) {
    line(`  flaky cases                   ${report.stability.flakyCaseIds.join(', ')}`);
  }
  if (artifactPath) line(`  artifact                      ${artifactPath}`);
  if (report.blockers.length > 0) line(`  blockers                      ${report.blockers.join(', ')}`);
  line(
    `\n${report.passed ? style.green(`${report.split} quality gate passed`) : style.red(`${report.split} quality gate failed`)}`,
  );
  line(
    report.releaseEligible
      ? style.green('Stored held-out evidence satisfies every semantic-discovery release gate.')
      : style.grey(`Release remains blocked by: ${report.releaseBlockers.join(', ')}.`),
  );
}

function renderRankingMatrix(report: RankingMatrixReport, artifactPath: string | null): void {
  const targeted = report.targetedVariants !== null;
  heading(
    `${targeted ? 'Targeted ranking evidence' : 'Ranking matrix'} — ${report.split}, ` +
      `${report.requestedRuns} repeated runs, concurrency ${report.concurrency}`,
  );
  for (const variant of report.variants) {
    const stability = variant.medianTop3Overlap === null ? 'n/a' : percent(variant.medianTop3Overlap);
    line(
      `  ${variant.id.padEnd(16)} ${variant.comparisonEligible ? style.green('measured') : style.red('UNAVAILABLE')}  ` +
        `nDCG ${fixed(variant.quality.ndcgAt10)}  Δ ${signed(variant.ndcgDeltaFromFusion)}  ` +
        `top3 ${stability}  p95 ${Math.round(variant.p95LatencyMs)}ms`,
    );
    const usage = variant.execution.tokenUsage;
    if (usage?.reportedQueries) {
      const averageInput =
        usage.inputTokens === null ? 'n/a' : String(Math.round(usage.inputTokens / usage.reportedQueries));
      const averageOutput =
        usage.outputTokens === null ? 'n/a' : String(Math.round(usage.outputTokens / usage.reportedQueries));
      line(
        `  ${''.padEnd(16)} ${averageInput}/${averageOutput} input/output tokens per reported query; ` +
          `${variant.execution.endpointRequests} endpoint requests ` +
          `(${variant.execution.extraEndpointRequests} extra)`,
      );
    }
  }
  if (report.selection) {
    line(
      `\n  selected  ${report.selection.variantId}: ${report.selection.candidateCount} candidates, ` +
        `${report.selection.reasoningEffort} reasoning`,
    );
    line(`  ${style.grey(report.selection.rationale)}`);
  }
  if (report.reviewEvidence) {
    line(
      `  reviewed  ${report.reviewEvidence.reviewerKind} at ${report.reviewEvidence.reviewedAt}; ` +
        `${report.reviewEvidence.receiptFingerprint.slice(0, 12)}…`,
    );
  }
  if (artifactPath) line(`  artifact  ${artifactPath}`);
  if (!targeted && report.releaseGate.blockers.length > 0) {
    line(`  release blockers  ${report.releaseGate.blockers.join(', ')}`);
  }
  const measurementsComplete = report.variants
    .filter((variant) => variant.system === 'llm')
    .every((variant) => variant.comparisonEligible);
  line(
    `\n${measurementsComplete ? style.green(`${targeted ? 'targeted' : 'matrix'} measurements complete`) : style.red(`${targeted ? 'targeted' : 'matrix'} measurements incomplete`)}`,
  );
  if (targeted) {
    line(style.grey('Targeted evidence measures one contract; it cannot select or release a preset.'));
    return;
  }
  line(
    report.releaseEligible
      ? style.green('Stored held-out evidence satisfies every release gate.')
      : style.grey('The preset remains blocked until every release gate is evidenced.'),
  );
}

function renderRankingLatency(
  report: RankingLatencyReport,
  artifactPath: string | null,
  matrixPath: string,
  matrix: RankingMatrixReport,
): void {
  heading(
    `Ranking latency — ${report.split}, ${report.candidateCount} candidates, ` +
      `${report.reasoningEffort} reasoning`,
  );
  for (const [label, profile] of [
    ['interactive', report.interactive],
    ['loaded', report.loaded],
  ] as const) {
    line(`  ${label.padEnd(12)} concurrency ${profile.concurrency}`);
    line(
      `    cold       ${Math.round(profile.cold.p50LatencyMs)}ms; ` +
        `${profile.cold.endpointRequests} endpoint request(s)`,
    );
    line(
      `    warm p50/p95/max  ${Math.round(profile.warm.p50LatencyMs)} / ` +
        `${Math.round(profile.warm.p95LatencyMs)} / ${Math.round(profile.warm.maxLatencyMs)}ms; ` +
        `${percent(profile.warm.validResponseRate)} valid; ` +
        `${profile.warm.extraEndpointRequests} extra endpoint requests`,
    );
  }
  line(`  UX gate      warm single-flight p95 ≤ ${report.thresholds.interactiveP95LatencyMs}ms`);
  if (artifactPath) line(`  artifact     ${artifactPath}`);
  line(`  matrix       ${matrixPath}`);
  if (report.blockers.length > 0) line(`  blockers     ${report.blockers.join(', ')}`);
  if (matrix.releaseGate.blockers.length > 0) {
    line(`  release blockers  ${matrix.releaseGate.blockers.join(', ')}`);
  }
  line(`\n${report.passed ? style.green('latency evidence passed') : style.red('latency evidence failed')}`);
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
      ` (${report.embedding.dimensions}d)${report.embedding.available ? '' : ' [unavailable]'}`,
  );
  line(`  embedded chunks        ${report.embedding.embeddedChunks}/${report.embedding.totalChunks}`);
  line(
    `  reranker               ${report.reranker.provider ?? 'unavailable'}/${report.reranker.model ?? 'unavailable'} ` +
      `(${report.reranker.reasoningEffort ?? 'none'})${report.reranker.available ? '' : ' [unavailable]'}`,
  );
  if (report.embedding.available) {
    line(
      `  retrieval / judged     ${report.retrievalPoolCount} / ${report.candidateCount} ` +
        `(${report.candidateSelectionVersion})`,
    );
    line(`  fusion-pool recall     ${percent(report.fusionPool.directAnswerRecall)}`);
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
  line(style.grey(rankingEndToEndEvidenceNote(report.split)));
}

export function rankingEndToEndEvidenceNote(split: RankingBenchSplit): string {
  return split === 'test'
    ? 'Held-out evidence is final; preserve this result instead of rerunning or using it as tuning input.'
    : 'Development evidence cannot substitute for independent review or a held-out run.';
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

async function readJsonArtifact(target: string): Promise<unknown> {
  return JSON.parse(await fsp.readFile(path.resolve(target), 'utf8')) as unknown;
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
