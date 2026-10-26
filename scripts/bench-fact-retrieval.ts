/**
 * Prototype benchmark: today's page cards against the fact arm and the compact fact list.
 *
 * Corpus: `invented-ranking-v5` (development cases only; the held-out split is never read).
 * Two layouts of the same 120 invented sentences:
 *
 * - `separate` — one sentence per file, exactly as the ranking end-to-end track writes it.
 *   Direct answers are orphan documents there, which are never fact-mined.
 * - `packed` — the same sentences as bullets on five subject pages, one `##` section per fact
 *   family plus same-subject distractors, in a fixed shuffled order. Every source is a
 *   knowledge page, so every sentence is eligible for derivation.
 *
 * Systems, all on one index:
 *   cards        recall as it ships (facts: false)
 *   cards+facts  the fact arm fused into chunk ranking; cards show the lines facts matched
 *   facts        format: 'facts' — ranked facts with slug:line plus evidence lines
 *
 * Profiles:
 *   arms         no expansion, no rerank: retrieval arms only
 *   production   expansion and the decisions reranker, as Luna's memory runs today
 *
 * The report holds ids, flags, counts, token estimates and latencies — no corpus text.
 *
 *   node scripts/bench-fact-retrieval.ts --layout packed --profile arms \
 *     --env-file <file holding AKNO_OPENAI_API_KEY> --output /tmp/fact-bench.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { open, type Akno } from '../packages/core/src/index.ts';
import { RANKING_CORPUS, rankingCorpusCases } from '../packages/core/src/bench/ranking-corpus.ts';

const require = createRequire(path.resolve('packages/core/package.json'));
const Database = require('better-sqlite3');

type Layout = 'separate' | 'packed';
type Profile = 'arms' | 'production';
type System = 'cards' | 'cards+facts' | 'facts';
const SYSTEMS: System[] = ['cards', 'cards+facts', 'facts'];
const ROOT = '_akno-fact-benchmark';

type Location =
  { kind: 'page'; slug: string; line: number } | { kind: 'document'; path: string; text: string };

const args = parseArgs(process.argv.slice(2));
const layouts = (args.layout === 'both' ? ['separate', 'packed'] : [args.layout ?? 'packed']) as Layout[];
const profiles = (args.profile === 'both' ? ['arms', 'production'] : [args.profile ?? 'arms']) as Profile[];
type Extraction = 'precise' | 'complete';
const extractions = (
  args.extraction === 'both' ? ['precise', 'complete'] : [args.extraction ?? 'precise']
) as Extraction[];
const concurrency = Number(args.concurrency ?? 4);
if (args['env-file']) loadEnvFile(args['env-file']);

const cases = rankingCorpusCases('development');
const report: Record<string, unknown> = {
  benchmark: 'fact-retrieval-prototype-v1',
  corpus: RANKING_CORPUS.version,
  split: 'development',
  cases: cases.length,
  models: {
    embedding: 'local/text-embedding-qwen3-embedding-0.6b (1024)',
    derive: 'openai/gpt-6-luna',
    expansion: 'openai/gpt-6-luna (reasoning none)',
    reranker: 'openai/gpt-6-luna decisions top_k 10 (reasoning none)',
  },
  token_estimate: 'ceil(chars / 4)',
  fact_ranking: args['fact-ranking'] ?? 'none',
  line_targeting: args['line-targeting'] ?? 'none',
  runs: [] as unknown[],
};

async function main(): Promise<void> {
  for (const layout of layouts)
    for (const extraction of extractions) {
      const kb = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-fact-bench-kb-'));
      const state = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-fact-bench-state-'));
      const locations = layout === 'packed' ? writePacked(kb) : writeSeparate(kb);
      const mem = await openBench(kb, state, extraction);
      try {
        const started = performance.now();
        const indexed = await mem.index({});
        const indexMs = performance.now() - started;
        const shape = corpusShape(mem, locations);
        console.log(
          `\n== ${layout} / ${extraction} extraction: indexed in ${(indexMs / 1000).toFixed(1)}s`,
          JSON.stringify(shape),
        );
        if (indexed.warnings?.length) console.log(`   ${indexed.warnings.length} index warnings`);

        for (const profile of profiles) {
          const perCase = await mapLimit(cases, concurrency, async (benchCase) => {
            const gold = {
              direct: idsWithGrade(benchCase.judgments, 3),
              support: idsWithGrade(benchCase.judgments, 2),
              negative: benchCase.pool.filter(
                (id) => id.endsWith('-negative') && benchCase.judgments[id] === 0,
              ),
              instruction: benchCase.pool.filter((id) => id.startsWith('instruction-')),
            };
            const systems: Record<string, unknown> = {};
            for (const system of SYSTEMS) {
              const t0 = performance.now();
              const output = (await mem.recall({
                query: benchCase.query,
                ...(system === 'cards' ? { facts: false } : {}),
                ...(system === 'cards+facts' ? { facts: true } : {}),
                ...(system === 'facts' ? { format: 'facts' as const } : {}),
                ...(profile === 'arms' ? { expand: false, rerank: false } : { expand: true, rerank: true }),
              })) as RecallLike;
              const latencyMs = performance.now() - t0;
              const seen = visible(output, locations);
              const firstDirect = firstPosition(seen, gold.direct);
              systems[system] = {
                status: output.status,
                direct_visible: firstDirect !== null,
                direct_position: firstDirect,
                support_visible: firstPosition(seen, gold.support) !== null,
                direct_or_support_visible: firstPosition(seen, [...gold.direct, ...gold.support]) !== null,
                gold_source_returned: sourcesReturned(output, locations, gold.direct),
                negative_visible: gold.negative.filter((id) => seen.has(id)).length,
                instruction_visible: gold.instruction.filter((id) => seen.has(id)).length,
                items:
                  system === 'facts'
                    ? (output.facts?.length ?? 0) + (output.evidence?.length ?? 0)
                    : output.results.length,
                facts: output.facts?.length ?? 0,
                tokens_pretty_json: tokens(JSON.stringify(output, null, 2)),
                tokens_compact_json: tokens(JSON.stringify(output)),
                ...(output.text !== undefined ? { tokens_text: tokens(output.text) } : {}),
                budget_used: output.budget_used,
                latency_ms: Math.round(latencyMs),
              };
            }
            return { id: benchCase.id, category: benchCase.category, systems };
          });
          const summary = summarize(perCase as CaseRow[]);
          (report.runs as unknown[]).push({
            layout,
            extraction,
            profile,
            shape,
            index_ms: Math.round(indexMs),
            summary,
            cases: perCase,
          });
          printSummary(`${layout} / ${extraction}`, profile, summary);
        }
      } finally {
        await mem.close();
        fs.rmSync(kb, { recursive: true, force: true });
        fs.rmSync(state, { recursive: true, force: true });
      }
    }

  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nreport: ${args.output}`);
  }
}

// ─── Corpus layouts ───────────────────────────────────────────────────────────

function writeSeparate(kb: string): Map<string, Location> {
  const locations = new Map<string, Location>();
  for (const candidate of Object.values(RANKING_CORPUS.candidates)) {
    if (candidate.sourceKind === 'page') {
      const rel = `${ROOT}/pages/${candidate.id}.md`;
      write(kb, rel, `# Invented evidence\n\n${candidate.text}\n`);
      locations.set(candidate.id, { kind: 'page', slug: rel.replace(/\.md$/, ''), line: 3 });
    } else {
      const rel = `${ROOT}/documents/${candidate.id}.txt`;
      write(kb, rel, `${candidate.text}\n`);
      locations.set(candidate.id, { kind: 'document', path: rel, text: candidate.text });
    }
  }
  return locations;
}

const SUBJECTS: Record<string, { slug: string; title: string; mention: RegExp }> = {
  ada: { slug: 'people/ada-marlow', title: 'Ada Marlow', mention: /Ada Marlow/ },
  bo: { slug: 'people/bo-winters', title: 'Bo Winters', mention: /Bo Winters/ },
  vulpine: { slug: 'insurers/vulpine-mutual', title: 'Vulpine Mutual', mention: /Vulpine/ },
  qx100: { slug: 'products/zephyr-qx-100', title: 'Zephyr QX-100', mention: /Zephyr|QX-100/ },
  blackwater: { slug: 'travel/blackwater-bay', title: 'Blackwater Bay', mention: /Blackwater/ },
};

function writePacked(kb: string): Map<string, Location> {
  const candidates = Object.values(RANKING_CORPUS.candidates);
  const families = new Map<string, string[]>();
  const distractors: string[] = [];
  const instructions: string[] = [];
  for (const candidate of candidates) {
    const family = candidate.id.match(/^(.*)-(direct|support|marginal|negative)$/)?.[1];
    if (family) families.set(family, [...(families.get(family) ?? []), candidate.id]);
    else if (candidate.id.startsWith('instruction-')) instructions.push(candidate.id);
    else distractors.push(candidate.id);
  }

  // Same-subject distractors go round-robin into that subject's sections, so sections vary in
  // length the way real ones do instead of all being exactly four lines.
  const extra = new Map<string, string[]>();
  const subjectFamilies = (subject: string) =>
    [...families.keys()].filter((family) => family.startsWith(`${subject}-`));
  const unplaced: string[] = [];
  const cursor = new Map<string, number>();
  for (const id of distractors) {
    const text = RANKING_CORPUS.candidates[id]!.text;
    const subject = Object.keys(SUBJECTS).find((key) => SUBJECTS[key]!.mention.test(text));
    const targets = subject ? subjectFamilies(subject) : [];
    if (targets.length === 0) {
      unplaced.push(id);
      continue;
    }
    const at = cursor.get(subject!) ?? 0;
    cursor.set(subject!, at + 1);
    const family = targets[at % targets.length]!;
    extra.set(family, [...(extra.get(family) ?? []), id]);
  }

  const locations = new Map<string, Location>();
  for (const [subject, info] of Object.entries(SUBJECTS)) {
    const lines = ['---', `title: ${info.title}`, '---', '', `# ${info.title}`, ''];
    for (const family of subjectFamilies(subject)) {
      lines.push(`## ${heading(family, subject)}`, '');
      for (const id of seededShuffle([...families.get(family)!, ...(extra.get(family) ?? [])], family)) {
        lines.push(`- ${RANKING_CORPUS.candidates[id]!.text}`);
        locations.set(id, { kind: 'page', slug: `${ROOT}/${info.slug}`, line: lines.length });
      }
      lines.push('');
    }
    write(kb, `${ROOT}/${info.slug}.md`, lines.join('\n'));
  }
  const inbox = ['---', 'title: Inbox notes', '---', '', '# Inbox notes', '', '## Unsorted', ''];
  for (const id of [...unplaced, ...instructions]) {
    inbox.push(`- ${RANKING_CORPUS.candidates[id]!.text}`);
    locations.set(id, { kind: 'page', slug: `${ROOT}/inbox/notes`, line: inbox.length });
  }
  write(kb, `${ROOT}/inbox/notes.md`, `${inbox.join('\n')}\n`);
  return locations;
}

function heading(family: string, subject: string): string {
  const words = family.slice(subject.length + 1).split('-');
  return words.map((word, index) => (index === 0 ? word[0]!.toUpperCase() + word.slice(1) : word)).join(' ');
}

function seededShuffle<T>(values: T[], seed: string): T[] {
  let state = [...seed].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261);
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function write(kb: string, rel: string, content: string): void {
  const target = path.join(kb, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

// ─── Akno instance ────────────────────────────────────────────────────────────

async function openBench(kb: string, state: string, extraction: Extraction): Promise<Akno> {
  if (!process.env.AKNO_OPENAI_API_KEY) throw new Error('AKNO_OPENAI_API_KEY is not set (pass --env-file)');
  return open({
    aknoPath: kb,
    stateDir: state,
    isolated: true,
    overrides: {
      akno_path: kb,
      state_dir: state,
      create_reserved_paths: false,
      write_ids: false,
      providers: {
        local: { base_url: 'http://127.0.0.1:8080/v1' },
        openai: {
          base_url: 'https://api.openai.com/v1',
          api: 'responses',
          api_key: { env: 'AKNO_OPENAI_API_KEY' },
        },
      },
      folders: { [`${ROOT}/**`]: { role: 'knowledge', remember: 'deny', rank: 1 } },
      index: { summaries: true, facts: true, fact_extraction: extraction },
      recall: {
        facts: true,
        graph: true,
        expansion: true,
        fact_ranking: args['fact-ranking'] ?? 'none',
        line_targeting: args['line-targeting'] ?? 'none',
      },
      models: {
        embedding: { provider: 'local', id: 'text-embedding-qwen3-embedding-0.6b', dimensions: 1024 },
        reranker: {
          provider: 'openai',
          id: 'gpt-6-luna',
          enabled: true,
          mode: 'decisions',
          exclude_irrelevant: true,
          top_k: 10,
          max_chars: 800,
          timeout_ms: 4000,
          irrelevant_probability_threshold: 0.8,
          max_output_tokens: 256,
          reasoning_effort: 'none',
        },
        derive: { provider: 'openai', id: 'gpt-6-luna', concurrency: 4, timeout_ms: 300000 },
        expansion: { provider: 'openai', id: 'gpt-6-luna', reasoning_effort: 'none' },
        answer: { id: null, enabled: false },
        vision: { id: null, enabled: false },
      },
    } as never,
  });
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface RecallLike {
  status: string;
  results: Array<
    | {
        type: 'page';
        slug: string;
        lines: { n: number; text: string }[];
        documents?: { path?: string; quote?: string }[];
      }
    | { type: 'document'; path: string; quote?: string }
  >;
  facts?: { slug: string; line: number }[];
  evidence?: { ref: string; type: 'page' | 'document'; lines?: { n: number }[]; quote?: string }[];
  text?: string;
  budget_used: number;
}

/** Candidate id → 1-based position of the first output item that shows its sentence. */
function visible(output: RecallLike, locations: Map<string, Location>): Map<string, number> {
  const byLine = new Map<string, string>();
  const documents: { id: string; path: string; text: string }[] = [];
  for (const [id, location] of locations) {
    if (location.kind === 'page') byLine.set(`${location.slug}:${location.line}`, id);
    else documents.push({ id, ...location });
  }
  const seen = new Map<string, number>();
  const mark = (id: string | undefined, position: number) => {
    if (id && !seen.has(id)) seen.set(id, position);
  };
  const quoted = (quote: string | undefined, position: number, where?: string) => {
    if (!quote) return;
    for (const document of documents) {
      if ((!where || where === document.path) && quote.includes(document.text)) mark(document.id, position);
    }
  };

  let position = 0;
  for (const fact of output.facts ?? []) mark(byLine.get(`${fact.slug}:${fact.line}`), ++position);
  for (const item of output.evidence ?? []) {
    position++;
    if (item.type === 'page')
      for (const line of item.lines ?? []) mark(byLine.get(`${item.ref}:${line.n}`), position);
    else quoted(item.quote, position, item.ref);
  }
  for (const result of output.results) {
    position++;
    if (result.type === 'page') {
      for (const line of result.lines) mark(byLine.get(`${result.slug}:${line.n}`), position);
      for (const document of result.documents ?? []) quoted(document.quote, position);
    } else quoted(result.quote, position, result.path);
  }
  return seen;
}

/** Whether the page or document holding a direct answer came back at all, whatever lines it showed. */
function sourcesReturned(output: RecallLike, locations: Map<string, Location>, ids: string[]): boolean {
  const refs = new Set<string>([
    ...output.results.map((result) => (result.type === 'page' ? result.slug : result.path)),
    ...(output.facts ?? []).map((fact) => fact.slug),
    ...(output.evidence ?? []).map((item) => item.ref),
  ]);
  return ids.some((id) => {
    const location = locations.get(id);
    return location ? refs.has(location.kind === 'page' ? location.slug : location.path) : false;
  });
}

function firstPosition(seen: Map<string, number>, ids: string[]): number | null {
  const positions = ids.flatMap((id) => (seen.has(id) ? [seen.get(id)!] : []));
  return positions.length > 0 ? Math.min(...positions) : null;
}

function idsWithGrade(judgments: Record<string, number>, grade: number): string[] {
  return Object.entries(judgments)
    .filter(([, value]) => value === grade)
    .map(([id]) => id);
}

function corpusShape(mem: Akno, locations: Map<string, Location>) {
  const db = new Database(mem.config.dbPath, { readonly: true });
  try {
    const chunks = db.prepare('SELECT text FROM chunks WHERE page_id IS NOT NULL').all() as {
      text: string;
    }[];
    const citable = chunks.map(
      (chunk) =>
        chunk.text.split('\n').filter((line) => line.trim() && !/^#{1,6}\s/.test(line.trim())).length,
    );
    const pageFacts = db
      .prepare(
        `SELECT p.slug, f.line_start, f.claim FROM facts f JOIN pages p ON p.id = f.page_id WHERE f.valid_to IS NULL`,
      )
      .all() as { slug: string; line_start: number; claim: string }[];
    const factAt = new Map(pageFacts.map((fact) => [`${fact.slug}:${fact.line_start}`, fact.claim]));
    const directs = [...locations.entries()].filter(([id]) => id.endsWith('-direct'));
    const pageDirects = directs.filter(([, location]) => location.kind === 'page');
    let withFact = 0;
    let faithful = 0;
    for (const [id, location] of pageDirects) {
      if (location.kind !== 'page') continue;
      const claim = factAt.get(`${location.slug}:${location.line}`);
      if (!claim) continue;
      withFact++;
      // Every number or date in the source sentence must survive the restatement.
      const values = RANKING_CORPUS.candidates[id]!.text.match(/\d[\d:.-]*\d|\d/g) ?? [];
      if (values.every((value) => claim.includes(value))) faithful++;
    }
    const kindCoverage = (kind: string) => {
      const ids = [...locations.entries()].filter(
        ([id, location]) => id.endsWith(`-${kind}`) && location.kind === 'page',
      );
      return `${ids.filter(([, location]) => location.kind === 'page' && factAt.has(`${location.slug}:${location.line}`)).length}/${ids.length}`;
    };
    // A stale sentence turned into a fact must still say it is stale.
    const QUALIFIER =
      /superseded|obsolete|discarded|draft|earlier|previous|original|old|former|outdated|accidental|wrong|mistaken/i;
    let staleFacts = 0;
    let staleKept = 0;
    for (const [id, location] of locations) {
      if (!id.endsWith('-negative') || location.kind !== 'page') continue;
      const claim = factAt.get(`${location.slug}:${location.line}`);
      if (!claim || !QUALIFIER.test(RANKING_CORPUS.candidates[id]!.text)) continue;
      staleFacts++;
      if (QUALIFIER.test(claim)) staleKept++;
    }
    const evaluated = new Set(cases.flatMap((benchCase) => idsWithGrade(benchCase.judgments, 3)));
    const evaluatedWithFact = [...evaluated].filter((id) => {
      const location = locations.get(id);
      return location?.kind === 'page' && factAt.has(`${location.slug}:${location.line}`);
    }).length;
    const vectors = (db.prepare('SELECT count(*) AS c FROM fact_vectors').get() as { c: number }).c;
    return {
      pages: (db.prepare('SELECT count(*) AS c FROM pages').get() as { c: number }).c,
      documents: (db.prepare('SELECT count(*) AS c FROM documents').get() as { c: number }).c,
      page_chunks: chunks.length,
      chunks_over_3_citable_lines: citable.filter((count) => count > 3).length,
      chunks_over_6_citable_lines: citable.filter((count) => count > 6).length,
      facts: pageFacts.length,
      fact_vectors: vectors,
      direct_answers: directs.length,
      direct_answers_on_pages: pageDirects.length,
      direct_answers_with_fact: withFact,
      direct_facts_keeping_every_value: faithful,
      evaluated_direct_answers_with_fact: `${evaluatedWithFact}/${evaluated.size}`,
      support_sentences_with_fact: kindCoverage('support'),
      marginal_sentences_with_fact: kindCoverage('marginal'),
      stale_sentences_with_fact: kindCoverage('negative'),
      stale_facts_keeping_qualifier: `${staleKept}/${staleFacts}`,
    };
  } finally {
    db.close();
  }
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

interface SystemRow {
  direct_visible: boolean;
  direct_position: number | null;
  support_visible: boolean;
  direct_or_support_visible: boolean;
  gold_source_returned: boolean;
  negative_visible: number;
  instruction_visible: number;
  items: number;
  facts: number;
  tokens_pretty_json: number;
  tokens_compact_json: number;
  tokens_text?: number;
  latency_ms: number;
  status: string;
}
interface CaseRow {
  id: string;
  category: string;
  systems: Record<System, SystemRow>;
}

function summarize(rows: CaseRow[]) {
  const out: Record<string, unknown> = {};
  for (const system of SYSTEMS) {
    const values = rows.map((row) => row.systems[system]);
    const byCategory: Record<string, string> = {};
    for (const category of [...new Set(rows.map((row) => row.category))]) {
      const inCategory = rows.filter((row) => row.category === category).map((row) => row.systems[system]);
      byCategory[category] =
        `${inCategory.filter((value) => value.direct_visible).length}/${inCategory.length}`;
    }
    out[system] = {
      direct_visible: rate(values.map((value) => value.direct_visible)),
      direct_at_position_1: rate(values.map((value) => value.direct_position === 1)),
      direct_or_support_visible: rate(values.map((value) => value.direct_or_support_visible)),
      gold_source_returned: rate(values.map((value) => value.gold_source_returned)),
      cases_with_negative_visible: rate(values.map((value) => value.negative_visible > 0)),
      cases_with_instruction_visible: rate(values.map((value) => value.instruction_visible > 0)),
      median_items: median(values.map((value) => value.items)),
      median_tokens_pretty_json: median(values.map((value) => value.tokens_pretty_json)),
      median_tokens_compact_json: median(values.map((value) => value.tokens_compact_json)),
      ...(values.every((value) => value.tokens_text !== undefined)
        ? { median_tokens_text: median(values.map((value) => value.tokens_text!)) }
        : {}),
      latency_p50_ms: percentile(
        values.map((value) => value.latency_ms),
        0.5,
      ),
      latency_p95_ms: percentile(
        values.map((value) => value.latency_ms),
        0.95,
      ),
      statuses: countBy(values.map((value) => value.status)),
      direct_visible_by_category: byCategory,
    };
  }
  return out;
}

function printSummary(layout: string, profile: string, summary: Record<string, unknown>): void {
  console.log(`\n-- ${layout} / ${profile}`);
  const keys = [
    'direct_visible',
    'direct_at_position_1',
    'direct_or_support_visible',
    'gold_source_returned',
    'cases_with_negative_visible',
    'cases_with_instruction_visible',
    'median_items',
    'median_tokens_pretty_json',
    'median_tokens_compact_json',
    'median_tokens_text',
    'latency_p50_ms',
    'latency_p95_ms',
  ];
  console.log(['metric'.padEnd(32), ...SYSTEMS.map((system) => system.padStart(13))].join(''));
  for (const key of keys) {
    console.log(
      [
        key.padEnd(32),
        ...SYSTEMS.map((system) =>
          String((summary[system] as Record<string, unknown>)[key] ?? '—').padStart(13),
        ),
      ].join(''),
    );
  }
  for (const system of SYSTEMS) {
    const entry = summary[system] as Record<string, unknown>;
    console.log(
      `  ${system} statuses ${JSON.stringify(entry.statuses)} by category ${JSON.stringify(entry.direct_visible_by_category)}`,
    );
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function tokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function rate(values: boolean[]): string {
  return `${Math.round((100 * values.filter(Boolean).length) / Math.max(1, values.length))}%`;
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

async function mapLimit<T, R>(values: T[], limit: number, run: (value: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        out[index] = await run(values[index]!);
      }
    }),
  );
  return out;
}

function loadEnvFile(file: string): void {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]!] === undefined)
      process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]!;
    if (key.startsWith('--')) out[key.slice(2)] = argv[i + 1] ?? '';
    i++;
  }
  return out;
}

await main();
