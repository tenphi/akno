import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { open, type Akno } from '../src/open.ts';
import { sha256 } from '../src/store/ids.ts';

let root: string;
let state: string;
let memory: Akno;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-prose-language-kb-'));
  state = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-prose-language-state-'));
  fs.mkdirSync(path.join(root, 'memory'));
});
afterEach(async () => {
  await memory?.close();
  vi.unstubAllGlobals();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(state, { recursive: true, force: true });
});

async function start(language: 'en' | null = 'en', model = false) {
  return open({
    aknoPath: root,
    stateDir: state,
    isolated: true,
    actor: 'user',
    overrides: {
      knowledge_language: language,
      providers: model ? { invented: { base_url: 'https://invented.invalid/v1', max_retries: 0 } } : {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: model ? { provider: 'invented', id: 'invented-model' } : { id: null },
        answer: { id: null },
        expansion: { id: null },
        vision: { id: null, enabled: false },
      },
      folders: { 'memory/**': { role: 'knowledge', remember: 'integrate' } },
    },
  });
}

const claim = 'The Zephyr QX-100 warranty lasts five years.';
function request(language?: 'en' | 'ru') {
  return {
    sources: [
      {
        source_id: 'invented:language-policy',
        revision: 'rev-1111',
        input: { text: claim },
        retention: {
          mode: 'provided',
          placement: 'exact',
          ...(language ? { knowledge_language: language } : {}),
          candidates: [
            {
              candidate_id: 'warranty',
              kind: 'claim',
              text: claim,
              subject: 'Zephyr QX-100',
              attribution: { source_role: 'user' },
              discourse: { commitment: 'asserted', disposition: 'active' },
              epistemic: { basis: 'self_attested' },
              support: [{ quote: claim }],
              discourse_frame: [{ quote: claim }],
              destination: { slug: 'memory/equipment' },
            },
          ],
        },
      },
    ],
  };
}

describe('language and ordinary prose through production operations', () => {
  it('preserves original bytes through indexing, restart, rebuild and qualified inspection', async () => {
    const content =
      '# Zephyr QX-100\n\n## Гипотеза о гарантии\nЗамена покрывается гарантией.\n\n## Recorded details\nThe case is silver.\n';
    fs.writeFileSync(path.join(root, 'memory/equipment.md'), content);
    memory = await start();
    await memory.index({ structuralOnly: true });
    const read = await memory.read({ slug: 'memory/equipment', from_line: 4, to_line: 4 });
    expect(read.page?.lines).toHaveLength(1);
    expect(read.page?.lines.find((line) => line.n === 4)).toMatchObject({
      text: 'Замена покрывается гарантией.',
      prose: { view: 'discussion', answer_eligible: false },
    });
    const discussion = await memory.recall({
      query: 'Zephyr гипотеза',
      memory_view: 'discussion',
      expand: false,
      rerank: false,
      graph: false,
    });
    expect(
      discussion.results.some(
        (result) => result.type === 'page' && result.lines.some((line) => line.prose?.view === 'discussion'),
      ),
    ).toBe(true);
    const context = await memory.context({
      profile: 'auto_recall',
      query: 'Zephyr warranty',
      memory_view: 'factual',
    });
    expect(context.knowledge_language).toBe('en');
    expect(
      context.results.every(
        (result) =>
          result.type !== 'page' || result.lines.every((line) => line.prose?.answer_eligible !== false),
      ),
    ).toBe(true);
    await memory.close();
    memory = await start();
    await memory.index({ rebuild: true, structuralOnly: true });
    expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toBe(content);
    expect(fs.readdirSync(path.join(root, 'memory'))).toEqual(['equipment.md']);
    expect(
      (await memory.read({ slug: 'memory/equipment' })).page?.lines.find((line) => line.n === 4)?.prose?.view,
    ).toBe('discussion');
  });

  it('invalidates facts and summaries when an editor changes only the enclosing heading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init.body));
        const check = body.messages.some((message: { content: string }) =>
          message.content.startsWith('Check the language'),
        );
        const value = check
          ? { compliant: true }
          : {
              summary: claim,
              keywords: ['warranty'],
              facts: [
                { line: 3, claim, subject: 'Zephyr QX-100', attribute: 'warranty', value: 'five years' },
              ],
            };
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), {
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const target = path.join(root, 'memory/equipment.md');
    fs.writeFileSync(target, `# Warranty\n\n${claim}\n`);
    fs.mkdirSync(path.join(root, 'products'));
    fs.writeFileSync(
      path.join(root, 'products/zephyr.md'),
      '---\ntitle: Zephyr QX-100\ntype: product\n---\n',
    );
    memory = await start('en', true);
    await memory.index({});
    expect(
      (await memory.read({ slug: 'memory/equipment' })).page?.lines.find((line) => line.n === 3)?.fact,
    ).toBeDefined();
    const beforeGraph = await memory.graph({ query: 'Zephyr QX-100', max_hops: 2 });
    expect(beforeGraph.edges.some((edge) => edge.evidence.kind === 'fact_line')).toBe(true);
    fs.writeFileSync(target, `# Hypothetical warranty\n\n${claim}\n`);
    const live = await memory.read({ slug: 'memory/equipment' });
    expect(live.page?.lines.find((line) => line.n === 3)).toMatchObject({
      prose: { answer_eligible: false },
    });
    expect(live.page?.lines.find((line) => line.n === 3)?.fact).toBeUndefined();
    expect(live.page?.summary).toBeNull();
    const afterGraph = await memory.graph({ query: 'Zephyr QX-100', max_hops: 2 });
    expect(afterGraph.edges.some((edge) => edge.evidence.kind === 'fact_line')).toBe(false);
    expect(afterGraph.degraded).toContain('partial_graph_index');
    await memory.index({ verify: true, structuralOnly: true });
    const db = new Database(path.join(state, 'akno.db'), { readonly: true });
    try {
      expect(db.prepare('SELECT count(*) AS n FROM facts').get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT summary FROM pages WHERE slug = 'memory/equipment'").get()).toEqual({
        summary: null,
      });
      expect(db.prepare('SELECT count(*) AS n FROM prose_entries').get()).toEqual({ n: 1 });
    } finally {
      db.close();
    }
  });

  it('reports unresolved oversized discourse as degradation while retaining the original text', async () => {
    const content = ['# Scenario', ...Array.from({ length: 14 }, () => claim)].join('\n');
    fs.writeFileSync(path.join(root, 'memory/equipment.md'), content);
    memory = await start();
    await memory.index({ structuralOnly: true });
    const result = await memory.read({ slug: 'memory/equipment' });
    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('prose_discourse_unresolved');
    expect(result.page?.lines.find((line) => line.n === 2)?.prose).toMatchObject({
      status: 'unresolved',
      source_hash: sha256(content),
      answer_eligible: false,
    });
    const answer = await memory.answer({ question: 'Zephyr QX-100 warranty', expand: false, graph: false });
    expect(answer.outcome).toBe('not_answered');
    expect(answer.answer).toBeNull();
  });

  it('requires caller attestation without guessing language, translating or calling a model', async () => {
    fs.writeFileSync(path.join(root, 'memory/equipment.md'), '# Equipment\n');
    const fetch = vi.fn(() => {
      throw new Error('exact provided retention must remain model-free');
    });
    vi.stubGlobal('fetch', fetch);
    memory = await start();
    await memory.index({ structuralOnly: true });
    expect((await memory.retain(request())).sources[0]).toMatchObject({
      outcome: 'held',
      reason_code: 'language_policy_required',
    });
    expect((await memory.retain(request('ru'))).sources[0]).toMatchObject({
      outcome: 'held',
      reason_code: 'language_mismatch',
    });
    const written = await memory.retain(request('en'));
    expect(written.sources[0]).toMatchObject({ outcome: 'ok', knowledge_language: 'en' });
    expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toContain(claim);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the old policy and outcome on replay after the owner changes configuration', async () => {
    fs.writeFileSync(path.join(root, 'memory/equipment.md'), '# Equipment\n');
    memory = await start(null);
    await memory.index({ structuralOnly: true });
    const first = await memory.retain(request());
    expect(first.sources[0]).toMatchObject({ outcome: 'ok', knowledge_language: null });
    const before = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
    await memory.close();
    memory = await start('en');
    await memory.index({ rebuild: true, structuralOnly: true });
    expect((await memory.retain(request())).sources[0]).toMatchObject({
      outcome: 'replayed',
      knowledge_language: null,
    });
    expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toBe(before);
  });
});
