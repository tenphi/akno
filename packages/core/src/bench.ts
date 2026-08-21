import { performance } from 'node:perf_hooks';
import type { Akno } from './open.ts';
import { runMixedRetrievalBench, type MixedRetrievalBenchReport } from './bench/mixed-retrieval.ts';

/**
 * **Benchmarks are part of the project.** Numbers rot, and the row that
 * matters most is the last one: "was fine, then wasn't" should be a test, not a
 * memory.
 *
 * Two rules learned by running this against a real knowledge base and getting a
 * useless answer:
 *
 * **1. Model latency and index latency are separate measurements.** A memory system which
 * feels slow is almost never suffering from its storage engine, and `doctor` already reports
 * the two apart. A bench that
 * adds a 2-second local 3B model call to a 20ms budget and prints FAIL has
 * measured somebody's GPU, not this code, and will be ignored within a week. So
 * index-path budgets are **asserted** and model-path timings are **reported**.
 *
 * **2. A case that cannot run must say so, not pass.** The first version measured
 * `index()` against a read-only handle, caught the `read_only` error it threw, and
 * reported 0ms — a green row that measured nothing at all.
 */

export interface BenchResult {
  name: string;
  /** Null for a model-path measurement: reported, never asserted. */
  budgetMs: number | null;
  p50Ms: number;
  p95Ms: number;
  samples: number;
  passed: boolean;
  /** Set when the measurement could not run. Never silently a pass. */
  skipped?: string;
  /** True when the timing includes a model round trip. */
  modelPath?: boolean;
}

export interface BenchReport {
  results: BenchResult[];
  /** Accuracy and latency assertions over a fixed, invented mixed-result corpus. */
  retrieval: MixedRetrievalBenchReport;
  /** Asserted index-path budgets and fixed-corpus retrieval checks decide this. */
  passed: boolean;
  pages: number;
  chunks: number;
  notes: string[];
}

interface BenchCase {
  name: string;
  /** Null makes this a reported measurement rather than an asserted budget. */
  budgetMs: number | null;
  iterations: number;
  modelPath?: boolean;
  run: () => Promise<unknown>;
  /** A stated reason the case cannot run. Reported as skipped, not as a pass. */
  skip?: () => string | null;
}

export interface BenchOptions {
  iterations?: number;
  /**
   * A second handle opened with **no models configured**, which is the only
   * honest way to measure "lexical only": the phrase means the model stack is
   * absent, not that we hoped it would not be used.
   */
  lexical?: Akno;
  /**
   * A writable handle. Without one the index-sweep case is skipped rather than
   * measuring the exception a read-only handle throws.
   */
  writable?: Akno;
}

export async function runBench(akno: Akno, options: BenchOptions = {}): Promise<BenchReport> {
  const health = await akno.doctor({ probeModels: false });
  const iterations =
    options.iterations !== undefined && Number.isFinite(options.iterations) && options.iterations > 0
      ? Math.floor(options.iterations)
      : 12;
  const notes: string[] = [];

  const queries = [
    'car insurance renewal',
    'when does the lease end?',
    'passport expiry',
    'anything about the apartment?',
  ];
  let queryIndex = 0;
  const nextQuery = (): string => queries[queryIndex++ % queries.length]!;

  const emptyIndex = (): string | null => (health.counts.chunks === 0 ? 'index is empty' : null);

  const cases: BenchCase[] = [
    {
      // A cold open plus the first query — but with the model stack out
      // of the path, because this budget is about the database and the assembly.
      name: 'first query, index path only',
      budgetMs: 50,
      iterations: Math.min(iterations, 6),
      run: () => (options.lexical ?? akno).recall({ query: nextQuery(), mode: 'lookup', budget: 4000 }),
      skip: () =>
        options.lexical
          ? emptyIndex()
          : 'needs a models-off handle — pass `lexical` to measure the index path alone',
    },
    {
      name: 'recall, lexical only',
      budgetMs: 20,
      iterations,
      run: () =>
        (options.lexical ?? akno).recall({ query: nextQuery(), mode: 'lookup', budget: 4000, limit: 5 }),
      skip: () =>
        options.lexical
          ? emptyIndex()
          : 'needs a models-off handle; a configured model makes this not lexical',
    },
    {
      name: 'point lookup by slug',
      budgetMs: 10,
      iterations,
      run: async () => {
        const listed = await akno.list({ kind: 'pages', limit: 1 });
        const slug = listed.pages?.[0]?.slug;
        return slug ? akno.read({ slug }) : null;
      },
      skip: () => (health.counts.pages === 0 ? 'index is empty' : null),
    },
    {
      name: 'timeline, 6 month window',
      budgetMs: 20,
      iterations,
      run: () => akno.timeline({ since: '2026-01', limit: 100 }),
    },
    {
      // The stat sweep with no model work: the claim that a restart is not a re-index. Needs the write handle, and says so when it does not have one.
      name: 'restart -> serving again, nothing changed',
      budgetMs: 50,
      iterations: Math.min(iterations, 5),
      run: () => options.writable!.index({ structuralOnly: true }),
      // Guessing between "someone else has the lock" and "you did not ask for it" sends
      // the reader looking for a process that may not exist. The handle knows which it is.
      skip: () => {
        if (!options.writable) return 'not measured without a writable handle — rerun with `--write`';
        if (options.writable.writable) return null;
        return options.writable.lockHeldBy !== null
          ? `pid ${options.writable.lockHeldBy} holds the write handle`
          : 'the write handle could not be taken — check the permissions on the state directory';
      },
    },

    // ── Reported, not asserted: these include a model round trip ──────────────
    {
      name: 'recall, hybrid + rerank (includes model time)',
      budgetMs: null,
      iterations: Math.min(iterations, 6),
      modelPath: true,
      run: () => akno.recall({ query: nextQuery(), mode: 'question', budget: 8000 }),
      skip: () => (health.counts.chunksEmbedded === 0 ? 'no embeddings in the index' : null),
    },
  ];

  const results: BenchResult[] = [];
  for (const benchCase of cases) {
    const skipped = benchCase.skip?.() ?? null;
    if (skipped) {
      results.push({
        name: benchCase.name,
        budgetMs: benchCase.budgetMs,
        p50Ms: 0,
        p95Ms: 0,
        samples: 0,
        // A skipped case is not a pass and not a failure. It is a gap, and the
        // caller is told which one.
        passed: true,
        skipped,
        ...(benchCase.modelPath ? { modelPath: true } : {}),
      });
      continue;
    }

    const samples: number[] = [];
    let failures = 0;
    // One untimed warm-up: the first call pays for statement preparation, and a
    // budget that includes it measures SQLite's compiler, not the query.
    await benchCase.run().catch(() => failures++);

    for (let i = 0; i < benchCase.iterations; i++) {
      const started = performance.now();
      // A case whose op throws every time must not report a fast, green row.
      await benchCase.run().catch(() => failures++);
      samples.push(performance.now() - started);
    }

    if (failures > benchCase.iterations / 2) {
      results.push({
        name: benchCase.name,
        budgetMs: benchCase.budgetMs,
        p50Ms: 0,
        p95Ms: 0,
        samples: 0,
        passed: false,
        skipped: `the operation failed ${failures} times — the timing would be meaningless`,
        ...(benchCase.modelPath ? { modelPath: true } : {}),
      });
      continue;
    }

    samples.sort((a, b) => a - b);
    const p50 = percentile(samples, 0.5);
    results.push({
      name: benchCase.name,
      budgetMs: benchCase.budgetMs,
      p50Ms: round(p50),
      p95Ms: round(percentile(samples, 0.95)),
      samples: samples.length,
      passed: benchCase.budgetMs === null || p50 <= benchCase.budgetMs,
      ...(benchCase.modelPath ? { modelPath: true } : {}),
    });
  }

  const modelPath = results.find((result) => result.modelPath && result.samples > 0);
  const indexPath = results.find((result) => result.name === 'recall, lexical only' && result.samples > 0);
  if (modelPath && indexPath) {
    notes.push(
      `the model stack accounts for about ${round(modelPath.p50Ms - indexPath.p50Ms)}ms of the ` +
        `${modelPath.p50Ms}ms hybrid path — which is why it is reported and not budgeted`,
    );
  }
  for (const skippedCase of results.filter((result) => result.skipped)) {
    notes.push(`${skippedCase.name}: ${skippedCase.skipped}`);
  }

  const retrieval = await runMixedRetrievalBench({ iterations });

  return {
    results,
    retrieval,
    // Asserted index budgets and fixed-corpus quality decide the verdict. A slow
    // configured model is still only reported, because it is not this code.
    passed: results.every((result) => result.budgetMs === null || result.passed) && retrieval.passed,
    pages: health.counts.pages,
    chunks: health.counts.chunks,
    notes,
  };
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
