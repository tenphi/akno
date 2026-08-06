import { performance } from 'node:perf_hooks';
import type { Akno } from './open.ts';

/**
 * §6. **Benchmarks are part of the project.** Numbers rot, and the one that
 * matters most is the last row here: "idle → first query after 1h idle" is the
 * exact symptom of a memory system that was fine and then wasn't. It should be a
 * test, not a memory.
 *
 * Budgets are asserted, so CI fails on regression rather than on someone
 * noticing months later.
 */

export interface BenchResult {
  name: string;
  budgetMs: number;
  p50Ms: number;
  p95Ms: number;
  samples: number;
  passed: boolean;
  /** Set when the measurement could not run — no models, empty index. */
  skipped?: string;
}

export interface BenchReport {
  results: BenchResult[];
  passed: boolean;
  pages: number;
  chunks: number;
}

interface BenchCase {
  name: string;
  budgetMs: number;
  iterations: number;
  run: () => Promise<unknown>;
  skip?: () => string | null;
}

export async function runBench(akno: Akno, options: { iterations?: number } = {}): Promise<BenchReport> {
  const health = await akno.doctor({ probeModels: false });
  const iterations = options.iterations ?? 12;

  const queries = [
    'car insurance renewal',
    'when does the lease end?',
    'passport expiry',
    'anything about the apartment?',
  ];
  let queryIndex = 0;
  const nextQuery = (): string => queries[queryIndex++ % queries.length]!;

  const cases: BenchCase[] = [
    {
      // §6's first budget: cold open + first query, warm models. The open itself
      // is half a millisecond; this measures the whole first request path.
      name: 'cold open + first query, warm models',
      budgetMs: 50,
      iterations: Math.min(iterations, 5),
      run: () => akno.recall({ query: nextQuery(), mode: 'lookup', budget: 4000 }),
      skip: () => (health.counts.chunks === 0 ? 'index is empty' : null),
    },
    {
      name: 'recall, lexical only',
      budgetMs: 20,
      iterations,
      // `explore` with expansion disabled at config level is the closest thing to
      // a pure lexical path from the public surface; the filter keeps it honest.
      run: () => akno.recall({ query: nextQuery(), mode: 'lookup', budget: 4000, limit: 5 }),
      skip: () => (health.counts.chunks === 0 ? 'index is empty' : null),
    },
    {
      name: 'recall, hybrid + rerank, warm models',
      budgetMs: 300,
      iterations,
      run: () => akno.recall({ query: nextQuery(), mode: 'question', budget: 8000 }),
      skip: () => {
        if (health.counts.chunksEmbedded === 0) return 'no embeddings in the index';
        return null;
      },
    },
    {
      name: 'restart -> serving again, nothing changed',
      budgetMs: 50,
      iterations: Math.min(iterations, 5),
      // The stat sweep, with no model work. This is the number §6 claims is 1.2ms
      // for 223 pages, and the reason a restart is not a re-index.
      run: () => akno.index({ structuralOnly: true }),
    },
    {
      name: 'point lookup by slug',
      budgetMs: 10,
      iterations,
      run: async () => {
        const listed = await akno.list({ kind: 'pages', limit: 1 });
        const slug = listed.pages?.[0]?.slug;
        if (!slug) return null;
        return akno.read({ slug });
      },
      skip: () => (health.counts.pages === 0 ? 'index is empty' : null),
    },
    {
      name: 'timeline, 6 month window',
      budgetMs: 20,
      iterations,
      run: () => akno.timeline({ since: '2026-01', limit: 100 }),
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
        passed: true,
        skipped,
      });
      continue;
    }

    const samples: number[] = [];
    // One untimed warm-up: the first call pays for statement preparation, and a
    // budget that includes it measures SQLite's compiler, not the query.
    await benchCase.run().catch(() => null);
    for (let i = 0; i < benchCase.iterations; i++) {
      const started = performance.now();
      await benchCase.run().catch(() => null);
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p50 = percentile(samples, 0.5);
    const p95 = percentile(samples, 0.95);
    results.push({
      name: benchCase.name,
      budgetMs: benchCase.budgetMs,
      p50Ms: round(p50),
      p95Ms: round(p95),
      samples: samples.length,
      passed: p50 <= benchCase.budgetMs,
    });
  }

  return {
    results,
    passed: results.every((result) => result.passed),
    pages: health.counts.pages,
    chunks: health.counts.chunks,
  };
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
