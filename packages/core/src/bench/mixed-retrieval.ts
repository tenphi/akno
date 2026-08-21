import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { RecallOutput } from '@tenphi/akno-protocol';
import { open, type Akno } from '../open.ts';

export type RetrievalBenchComparison = 'at_least' | 'at_most';
export type RetrievalBenchUnit = 'ratio' | 'milliseconds' | 'count';

export interface RetrievalBenchResult {
  name: string;
  value: number;
  target: number;
  comparison: RetrievalBenchComparison;
  unit: RetrievalBenchUnit;
  passed: boolean;
  detail: string;
}

export interface MixedRetrievalBenchReport {
  results: RetrievalBenchResult[];
  passed: boolean;
  corpus: {
    pages: number;
    ownedDocuments: number;
    orphanDocuments: number;
    queries: number;
    orphanK: number;
    pageK: number;
  };
}

export interface MixedRetrievalBenchOptions {
  iterations?: number;
  latencyBudgetMs?: number;
}

const K = 3;
const PAGE_K = 2;
const FIXTURES: Record<string, string> = {
  'people/ada-marlow.md': `# Ada Marlow

The northern lantern archive uses the albatross key for cataloguing.
`,
  'organisations/vulpine-mutual.md': `# Vulpine Mutual

The southern lantern archive lists Vulpine Mutual under the foxglove index.
`,
  'products/zephyr-qx-100.md': `# Zephyr QX-100

Calibration notes for the Zephyr QX-100 use invented benchmark markers.
`,
  'records/vulpine-policy.md': `# Vulpine Mutual policy

The attached record is the canonical coverage evidence.

![[vulpine-policy.txt]]
`,
  'records/vulpine-policy.txt':
    'Silverpine coverage marker 1111 confirms the invented Vulpine Mutual policy record.\n',
  'inbox/zephyr-service.txt':
    'Amberlark service code belongs to the invented Zephyr QX-100 maintenance record.\n',
  'inbox/blackwater-route.txt': 'Copperfin route marker points to the invented archive at Blackwater Bay.\n',
  'inbox/vulpine-renewal.txt': 'Willowstamp renewal marker belongs to the invented Vulpine Mutual notice.\n',
  'inbox/northern-lantern-source.txt':
    'The northern lantern archive source uses the invented kestrel register.\n',
  'inbox/northern-lantern-catalogue.txt':
    'The northern lantern archive catalogue uses the invented osprey register.\n',
  'inbox/southern-lantern-source.txt':
    'The southern lantern archive source uses the invented heron register.\n',
  'inbox/southern-lantern-catalogue.txt':
    'The southern lantern archive catalogue uses the invented tern register.\n',
};

const ORPHAN_CASES = [
  { query: 'amberlark service code', path: 'inbox/zephyr-service.txt' },
  { query: 'copperfin route marker', path: 'inbox/blackwater-route.txt' },
  { query: 'willowstamp renewal marker', path: 'inbox/vulpine-renewal.txt' },
];
const PAGE_CASES = [
  { query: 'northern lantern archive', slug: 'people/ada-marlow' },
  { query: 'southern lantern archive', slug: 'organisations/vulpine-mutual' },
];
const OWNED_CASE = {
  query: 'silverpine',
  slug: 'records/vulpine-policy',
  path: 'records/vulpine-policy.txt',
};

/**
 * A fixed, invented corpus measures retrieval quality independently of the user's
 * knowledge base. The model stack is intentionally absent: optional capabilities
 * must report degradation while lexical mixed recall stays correct.
 */
export async function runMixedRetrievalBench(
  options: MixedRetrievalBenchOptions = {},
): Promise<MixedRetrievalBenchReport> {
  const iterations = normalizedIterations(options.iterations ?? 12);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-mixed-bench-kb-'));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-mixed-bench-state-'));
  const corpus = {
    pages: Object.keys(FIXTURES).filter((file) => file.endsWith('.md')).length,
    ownedDocuments: 1,
    orphanDocuments: 7,
    queries: ORPHAN_CASES.length + PAGE_CASES.length + 1,
    orphanK: K,
    pageK: PAGE_K,
  };
  let mem: Akno | null = null;

  try {
    writeFixtures(root);
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: {},
        models: {
          embedding: { id: null, dimensions: 8 },
          reranker: { id: null, enabled: false },
          derive: { id: null },
          expansion: { id: null },
          vision: { id: null, enabled: false },
        },
      },
    });
    await mem.index({});

    const orphanRuns: RecallOutput[] = [];
    let orphanHits = 0;
    let honestDegradedHits = 0;
    for (const benchCase of ORPHAN_CASES) {
      const result = await mem.recall({
        query: benchCase.query,
        mode: 'lookup',
        limit: K,
        budget: 1200,
      });
      orphanRuns.push(result);
      const found = result.results.some(
        (candidate) => candidate.type === 'document' && candidate.path === benchCase.path,
      );
      if (found) orphanHits++;
      if (
        found &&
        result.status === 'degraded' &&
        result.degraded?.includes('no_embedding_model') &&
        result.degraded.includes('no_expansion_model')
      ) {
        honestDegradedHits++;
      }
    }

    const owned = await mem.recall({
      query: OWNED_CASE.query,
      mode: 'lookup',
      limit: K,
      budget: 1200,
    });
    const duplicate = duplicateRate(owned, OWNED_CASE.slug, OWNED_CASE.path);

    let pageOnlyHits = 0;
    let mixedPageHits = 0;
    let mixedDocumentCases = 0;
    for (const benchCase of PAGE_CASES) {
      const pageOnly = await mem.recall({
        query: benchCase.query,
        mode: 'lookup',
        limit: PAGE_K,
        budget: 1200,
        filter: { source: 'page' },
      });
      const mixed = await mem.recall({
        query: benchCase.query,
        mode: 'lookup',
        limit: PAGE_K,
        budget: 1200,
      });
      if (hasPage(pageOnly, benchCase.slug)) pageOnlyHits++;
      if (hasPage(mixed, benchCase.slug)) mixedPageHits++;
      if (mixed.results.some((candidate) => candidate.type === 'document')) mixedDocumentCases++;
    }
    const pageOnlyRecall = pageOnlyHits / PAGE_CASES.length;
    const mixedPageRecall = mixedPageHits / PAGE_CASES.length;
    const allCasesMixed = mixedDocumentCases === PAGE_CASES.length;

    const latency = await mixedLatency(mem, iterations);
    const results = [
      metric({
        name: `orphan recall@${K}`,
        value: orphanHits / ORPHAN_CASES.length,
        target: 1,
        comparison: 'at_least',
        unit: 'ratio',
        detail: `${orphanHits}/${ORPHAN_CASES.length} orphan queries returned the expected document`,
      }),
      metric({
        name: 'duplicate document result rate',
        value: duplicate.rate,
        target: 0,
        comparison: 'at_most',
        unit: 'ratio',
        detail: duplicate.detail,
      }),
      metric({
        name: `page recall@${PAGE_K}, page-only baseline`,
        value: pageOnlyRecall,
        target: 1,
        comparison: 'at_least',
        unit: 'ratio',
        detail: `${pageOnlyHits}/${PAGE_CASES.length} expected pages returned`,
      }),
      metric({
        name: 'page recall change after mixed assembly',
        value: allCasesMixed ? mixedPageRecall - pageOnlyRecall : -1,
        target: 0,
        comparison: 'at_least',
        unit: 'ratio',
        detail:
          `page-only ${percent(pageOnlyRecall)}, mixed ${percent(mixedPageRecall)}; ` +
          `${mixedDocumentCases}/${PAGE_CASES.length} cases also returned document evidence`,
      }),
      metric({
        name: 'lexical recall with model degradation',
        value: honestDegradedHits / ORPHAN_CASES.length,
        target: 1,
        comparison: 'at_least',
        unit: 'ratio',
        detail: `${honestDegradedHits}/${ORPHAN_CASES.length} hits remained visible with typed model degradation`,
      }),
      metric({
        name: 'mixed assembly + budget fit, p50',
        value: latency,
        target: options.latencyBudgetMs ?? 20,
        comparison: 'at_most',
        unit: 'milliseconds',
        detail: `${iterations} samples after one warm-up`,
      }),
    ];

    return { results, passed: results.every((result) => result.passed), corpus };
  } catch (error) {
    const results = [
      metric({
        name: 'mixed retrieval benchmark execution',
        value: 1,
        target: 0,
        comparison: 'at_most',
        unit: 'count',
        detail: error instanceof Error ? error.message : String(error),
      }),
    ];
    return { results, passed: false, corpus };
  } finally {
    if (mem) await mem.close().catch(() => undefined);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
}

function writeFixtures(root: string): void {
  for (const [relPath, content] of Object.entries(FIXTURES)) {
    const target = path.join(root, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

function duplicateRate(
  result: RecallOutput,
  expectedSlug: string,
  expectedPath: string,
): { rate: number; detail: string } {
  const ownedPaths = new Set(
    result.results.flatMap((candidate) =>
      candidate.type === 'page'
        ? (candidate.documents ?? []).flatMap((document) => (document.rel_path ? [document.rel_path] : []))
        : [],
    ),
  );
  const standalonePaths = new Set(
    result.results.flatMap((candidate) => (candidate.type === 'document' ? [candidate.path] : [])),
  );
  const expectedPage = result.results.some(
    (candidate) =>
      candidate.type === 'page' &&
      candidate.slug === expectedSlug &&
      candidate.documents?.some((document) => document.rel_path === expectedPath),
  );
  const duplicates = [...standalonePaths].filter((documentPath) => ownedPaths.has(documentPath));
  const identities = new Set([...ownedPaths, ...standalonePaths]);
  const rate = expectedPage ? duplicates.length / Math.max(1, identities.size) : 1;
  return {
    rate,
    detail: expectedPage
      ? `${duplicates.length}/${identities.size} document identities appeared both owned and standalone`
      : 'the expected owned-document page was not returned',
  };
}

function hasPage(result: RecallOutput, expectedSlug: string): boolean {
  return result.results.some((candidate) => candidate.type === 'page' && candidate.slug === expectedSlug);
}

async function mixedLatency(mem: Akno, iterations: number): Promise<number> {
  const count = normalizedIterations(iterations);
  const run = (): Promise<RecallOutput> =>
    mem.recall({
      query: PAGE_CASES[0]!.query,
      mode: 'lookup',
      expand: false,
      limit: PAGE_K,
      budget: 400,
    });
  const warmup = await run();
  if (
    !warmup.results.some((candidate) => candidate.type === 'page') ||
    !warmup.results.some((candidate) => candidate.type === 'document') ||
    warmup.budget_used > 400
  ) {
    throw new Error('the latency case did not assemble both result types inside its shared budget');
  }
  const samples: number[] = [];
  for (let index = 0; index < count; index++) {
    const started = performance.now();
    await run();
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  return round(samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.5))]!);
}

function normalizedIterations(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 12;
}

function metric(input: Omit<RetrievalBenchResult, 'passed'>): RetrievalBenchResult {
  const passed = input.comparison === 'at_least' ? input.value >= input.target : input.value <= input.target;
  return { ...input, value: round(input.value), passed };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
