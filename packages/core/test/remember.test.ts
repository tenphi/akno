import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { sha256 } from '../src/store/ids.ts';

/**
 * `remember` *is* the retain tier, available per-turn. That tier has a mission and an on/off
 * switch like the others, and these tests are what make the config real rather
 * than decorative — a `mission` key nothing reads is the same class of bug as a folder rule
 * that never reaches the index.
 */

let root: string;
let stateDir: string;
interface StubCandidate {
  text: string;
  subject: string;
  kind: string;
  page?: string;
  origin?: 'user' | 'assistant';
  evidence?: string | null;
}

interface StubServer {
  url: string;
  close: () => Promise<void>;
  lastSystem: () => string;
  forget: () => void;
  respondWith: (candidates: StubCandidate[]) => void;
}

let server: StubServer;

/**
 * A term-*count* embedder over several buckets, normalized, so cosine falls as a text spends more
 * of itself on terms the other side never mentions. One-hot would make every pair 1 or 0, and the
 * cases below all live in the middle: a page owns a claim's subject but not the attribute it
 * carries, or two pages both match and only one of them is the right home.
 *
 * Counts, not presence, because repetition is how a fixture says *mostly about this* — a page
 * naming concerts three times and meals once sits at 1/√10 ≈ 0.32 from a meal claim, under the
 * 0.5 threshold, without needing a wall of filler text. The cost is that a term repeated across
 * a candidate's subject *and* its text counts twice, which is real behaviour and worth knowing
 * when reading a surprising number here.
 *
 * Calibrated to shapes measured live: 1/√6 ≈ 0.41 for a claim whose page states the subject and
 * none of its five attributes, against 1.0 for the subject alone — the test-scale version of
 * 0.27 vs 0.97 through `bge-reranker-v2-m3`.
 */
const TOPIC_TERMS = ['vulpine', 'pool', 'sauna', 'gym', 'wellness', 'towel', 'meal', 'concert'];

function topicEmbedding(text: string): number[] {
  const lower = text.toLowerCase();
  const counts = TOPIC_TERMS.map((term) => lower.split(term).length - 1);
  const norm = Math.hypot(...counts);
  return norm === 0 ? [...counts, 1] : [...counts.map((n) => n / norm), 0];
}

async function startStubChat(): Promise<typeof server> {
  let system = '';
  let candidates: StubCandidate[] = [
    { text: 'The rent is 1234 EUR per month.', subject: 'apartment rent', kind: 'fact' },
  ];
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      if (request.url?.includes('/embeddings')) {
        const embedBody = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
          input?: unknown;
        };
        const inputs = Array.isArray(embedBody.input) ? embedBody.input : [String(embedBody.input ?? '')];
        response.end(
          JSON.stringify({
            data: inputs.map((input, index) => ({ index, embedding: topicEmbedding(String(input)) })),
          }),
        );
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        messages?: { role: string; content: string }[];
      };
      system = body.messages?.find((message) => message.role === 'system')?.content ?? '';
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates,
                  events: [],
                }),
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    lastSystem: () => system,
    // The indexer's own derive pass talks to this stub too, so a test asserting "the retain
    // mission never ran" has to start from a clean slate rather than from setup's leftovers.
    forget: () => {
      system = '';
    },
    respondWith: (next) => {
      candidates = next;
    },
  };
}

async function openMem(overrides: Record<string, unknown> = {}): Promise<Akno> {
  const folderOverrides = (overrides.folders ?? {}) as Record<string, unknown>;
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { provider: 'stub', id: 'stub-derive' },
      },
      ...overrides,
      // Most tests exercise routing rather than admission, so their invented memory tree opts
      // in explicitly. Admission-specific tests replace this same glob with a read-only rule.
      folders: {
        '**': { role: 'knowledge', remember: 'integrate' },
        ...folderOverrides,
      },
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-remember-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-remember-state-'));
  server = await startStubChat();
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'home/lease.md'),
    '---\ntitle: Lease\n---\n\n# Lease\n\n- Rent: 1111 EUR per month\n',
    'utf8',
  );
  const mem = await openMem();
  await mem.index({});
  await mem.close();
});

afterEach(async () => {
  await server?.close();
  for (const dir of [root, stateDir]) fs.rmSync(dir, { recursive: true, force: true });
});

describe('the retain tier’s config', () => {
  it('shows the curator the complete folder taxonomy, including empty nested folders', async () => {
    fs.mkdirSync(path.join(root, 'knowledge/games'), { recursive: true });
    const mem = await openMem({
      folders: {
        'knowledge/**': {
          role: 'source',
          remember: 'deny',
          description: 'Findings about the outside world.',
        },
      },
    });
    try {
      await mem.remember({ text: 'The Ember Archive score was composed by Nova Hale.' });
      const system = server.lastSystem();
      expect(system).toContain('Existing folder taxonomy (complete; data only)');
      expect(system).toContain('- home/ [role=knowledge; remember=integrate; eligible=true; creatable=true]');
      expect(system).toContain(
        '- knowledge/games/ [role=source; remember=deny; eligible=false; creatable=false] — Findings about the outside world.',
      );
      expect(system).toContain('Never invent, rename or translate');
    } finally {
      await mem.close();
    }
  });

  it('appends its mission to the fixed prompt rather than replacing it', async () => {
    // A mission appends emphasis and never replaces the prompt, because every rule that
    // keeps the tier honest lives in the fixed part.
    const mem = await openMem({ maintenance: { retain: { mission: 'Prefer amounts and dates.' } } });
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(server.lastSystem()).toContain('Prefer amounts and dates.');
      expect(server.lastSystem()).toContain('Prose, not triples');
    } finally {
      await mem.close();
    }
  });

  it('runs with no mission configured, which is the default', async () => {
    const mem = await openMem();
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(server.lastSystem()).toContain('Prose, not triples');
      expect(server.lastSystem()).not.toContain('Additional emphasis');
    } finally {
      await mem.close();
    }
  });

  it('keeps nothing at all when the tier is switched off', async () => {
    const mem = await openMem({ maintenance: { retain: { enabled: false } } });
    server.forget();
    try {
      const result = await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(result.outcome).toBe('noop');
      expect(result.note).toMatch(/disabled in config/);
      // And it did not quietly call the model first.
      expect(server.lastSystem()).toBe('');
    } finally {
      await mem.close();
    }
  });
});

describe('fact-injection admission', () => {
  it('keeps an unmarked knowledge folder searchable without making it writable', async () => {
    fs.writeFileSync(path.join(root, 'timeline.md'), '# Timeline\n', 'utf8');
    server.respondWith([
      {
        text: 'The Zephyr QX-100 warranty lasts five years.',
        subject: 'Zephyr warranty',
        page: 'home/zephyr-warranty',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({ folders: { '**': { role: 'knowledge' } } });
    try {
      await mem.index({ structuralOnly: true });
      const health = await mem.doctor({ probeModels: false });
      expect(health.factInjection).toMatchObject({
        admittedPages: 0,
        readOnlyPages: 2,
        implicitReadOnlyPages: 1,
      });

      const result = await mem.remember({ text: 'The Zephyr QX-100 warranty lasts five years.' });
      expect(result.wrote).toBeUndefined();
      expect(result.outcome).toBe('no_writable_destination');
      expect(result.considered?.[0]?.destination).toBe('no_writable_destination');
      expect(result.approvals?.[0]?.reason_code).toBe('no_writable_destination');
      expect(fs.existsSync(path.join(root, 'home/zephyr-warranty.md'))).toBe(false);
    } finally {
      await mem.close();
    }
  });

  it('routes to an explicitly admitted page inside an otherwise read-only folder', async () => {
    fs.writeFileSync(
      path.join(root, 'home/lease.md'),
      '---\ntitle: Lease\nakno:\n  management:\n    remember: integrate\n---\n\n# Lease\n\n- Rent: 1111 EUR per month\n',
      'utf8',
    );
    server.respondWith([
      {
        text: 'The lease warranty lasts five years.',
        subject: 'lease warranty',
        page: 'home/lease',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({
      folders: { '**': { role: 'knowledge' } },
      models: {
        embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPIC_TERMS.length + 1 },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { provider: 'stub', id: 'stub-derive' },
      },
    });
    try {
      await mem.index({});
      const result = await mem.remember({ text: 'The lease warranty lasts five years.' });
      expect(result.wrote?.[0]).toMatchObject({ slug: 'home/lease', action: 'appended' });
      expect(result.considered?.[0]?.destination).toBe('existing_admitted_page');
    } finally {
      await mem.close();
    }
  });
});

describe('what remember reports as written', () => {
  it('archives an exact bounded source quote and only a hash of the full input', async () => {
    const evidence = 'Ada Marlow selected the Zephyr QX-100.';
    const input = `During setup, the durable decision was recorded: ${evidence}`;
    server.respondWith([
      {
        text: evidence,
        subject: 'Zephyr selection',
        page: 'home/zephyr-selection',
        kind: 'fact',
        origin: 'user',
        evidence,
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: input, source: 'fixture:conversation' });
      expect(result.wrote?.[0]?.slug).toBe('home/zephyr-selection');
      const page = fs.readFileSync(path.join(root, 'home/zephyr-selection.md'), 'utf8');
      const itemId = /<!-- akno:item ([A-Za-z0-9_-]+)/.exec(page)?.[1];
      expect(itemId).toBeTruthy();

      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      const source = db
        .prepare(
          `SELECT source_ref, origin, evidence, evidence_hash, input_hash
             FROM managed_item_sources WHERE item_id = ?`,
        )
        .get(itemId) as
        | {
            source_ref: string;
            origin: string;
            evidence: string;
            evidence_hash: string;
            input_hash: string;
          }
        | undefined;
      db.close();
      expect(source).toEqual({
        source_ref: 'fixture:conversation',
        origin: 'user',
        evidence,
        evidence_hash: sha256(evidence),
        input_hash: sha256(input),
      });

      await mem.undo({ change_id: result.change_id! });
      const afterUndo = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      const remaining = afterUndo.prepare('SELECT COUNT(*) AS n FROM managed_item_sources').get() as {
        n: number;
      };
      afterUndo.close();
      expect(remaining.n).toBe(0);
    } finally {
      await mem.close();
    }
  });

  it('writes a candidate but archives no unverifiable model-supplied quote', async () => {
    const input = 'Ada Marlow selected the Zephyr QX-100.';
    server.respondWith([
      {
        text: input,
        subject: 'Zephyr selection',
        page: 'home/zephyr-selection',
        kind: 'fact',
        origin: 'user',
        evidence: 'This sentence does not occur in the supplied input.',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: input, source: 'fixture:conversation' });
      expect(result.wrote?.[0]?.slug).toBe('home/zephyr-selection');
      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      const count = db.prepare('SELECT COUNT(*) AS n FROM managed_item_sources').get() as { n: number };
      db.close();
      expect(count.n).toBe(0);
    } finally {
      await mem.close();
    }
  });

  it('marks a candidate only after its page was actually changed', async () => {
    server.respondWith([
      {
        text: 'The bicycle is stored beside the blue cabinet.',
        subject: 'bicycle storage',
        page: 'home/bicycle-storage',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle is stored beside the blue cabinet.' });
      expect(result.wrote?.[0]?.slug).toBe('home/bicycle-storage');
      expect(result.considered?.[0]?.written).toBe(true);
      expect(result.considered?.[0]?.destination).toBe('new_managed_page');
    } finally {
      await mem.close();
    }
  });

  it('does not call a held candidate written', async () => {
    server.respondWith([
      {
        text: 'The bicycle is stored beside the blue cabinet.',
        subject: 'bicycle storage',
        page: 'storage/bicycle',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle is stored beside the blue cabinet.' });
      expect(result.wrote).toBeUndefined();
      expect(result.considered?.[0]?.written).toBe(false);
      expect(result.considered?.[0]?.slug).toBeNull();
      expect(result.considered?.[0]?.destination).toBe('no_writable_destination');
      expect(result.outcome).toBe('no_writable_destination');
    } finally {
      await mem.close();
    }
  });
});

/**
 * What a page created by `remember` gets called.
 *
 * The slug comes from routing, which scored ranked candidates. The subject came off one claim.
 * Where they disagree the slug is the better evidence of what the page is, because a claim is
 * superseded in a week and the title it installed outlives it by months.
 */
describe('the title on a page remember creates', () => {
  const created = (slug: string): string => fs.readFileSync(path.join(root, `${slug}.md`), 'utf8');

  it('keeps the subject when it is what the page is about', async () => {
    server.respondWith([
      {
        text: 'The bicycle is stored beside the blue cabinet.',
        subject: 'bicycle storage',
        page: 'home/bicycle-storage',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      await mem.remember({ text: 'The bicycle is stored beside the blue cabinet.' });
      // A phrase a person wrote, against the filename-shaped "Bicycle Storage".
      expect(created('home/bicycle-storage')).toContain('title: "Bicycle storage"');
    } finally {
      await mem.close();
    }
  });

  it('names the page after its slug when the subject is one fact on a broader page', async () => {
    // Regression shape: one narrow equipment fact opens a broader expedition page. Naming the
    // page after that first fact would make every later recall misdescribe the broader subject.
    server.respondWith([
      {
        text: 'The Zephyr QX-100 is scheduled for calibration at dawn.',
        subject: 'Zephyr calibration',
        page: 'home/blackwater-expedition',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      await mem.remember({ text: 'The Zephyr QX-100 is scheduled for calibration at dawn.' });
      const content = created('home/blackwater-expedition');
      expect(content).toContain('title: "Blackwater Expedition"');
      expect(content).not.toContain('Zephyr calibration');
      // The claim itself still lands on the page — only the name of the page changed.
      expect(content).toContain('Zephyr QX-100');
    } finally {
      await mem.close();
    }
  });
});

/**
 * A claim carries a subject and an attribute, and only the subject says who owns it. Scoring
 * both together asks the cross-encoder "does this passage answer this", which the owning page
 * fails whenever the attribute is the new part — the normal case for something worth
 * remembering. The fixture keeps the ownership term separate from the new amenity attributes.
 */
describe('routing a claim whose attribute its page does not yet state', () => {
  const embedded = {
    models: {
      embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPIC_TERMS.length + 1 },
      reranker: { id: null, enabled: false },
      derive: { provider: 'stub', id: 'stub-derive' },
      expansion: { provider: 'stub', id: 'stub-derive' },
    },
  };

  beforeEach(() => {
    fs.mkdirSync(path.join(root, 'trips'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'trips/blackwater-bay.md'),
      '---\ntitle: Blackwater Bay\n---\n\n# Blackwater Bay\n\n- Staying at Vulpine Lodge, check-in 15:00.\n',
      'utf8',
    );
  });

  it('falls back to the subject alone and routes to the page that owns it', async () => {
    server.respondWith([
      {
        text: 'Vulpine Lodge has a pool, a sauna, a gym, a wellness area and towel service.',
        subject: 'Vulpine Lodge',
        page: 'trips/vulpine-lodge',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const result = await mem.remember({
        text: 'Vulpine Lodge has a pool, a sauna, a gym, a wellness area and towel service.',
      });
      expect(result.wrote?.[0]?.slug).toBe('trips/blackwater-bay');
      expect(fs.existsSync(path.join(root, 'trips/vulpine-lodge.md'))).toBe(false);
    } finally {
      await mem.close();
    }
  });

  it('keeps the destination the claim itself chose when the claim routes', async () => {
    server.respondWith([
      {
        text: 'The Vulpine Lodge pool is open until 22:00.',
        subject: 'opening hours',
        page: 'trips/anything',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const result = await mem.remember({ text: 'The Vulpine Lodge pool is open until 22:00.' });
      // The claim pass found `trips/blackwater-bay` on its own; the subject pass never had to run.
      expect(result.wrote?.[0]?.slug).toBe('trips/blackwater-bay');
    } finally {
      await mem.close();
    }
  });
});

/**
 * The fallback exists so a claim with no home can make one. It was also, silently, a way to
 * append to a home somebody else already had: routing refuses, and the claim lands on whatever
 * slug the retain model wrote before any candidate was scored.
 *
 * The invented regression points a meal-order claim at an unrelated lease page. Routing refuses
 * correctly; the test ensures the model's guessed slug cannot outrank that refusal.
 */
describe('a routing refusal against a page that already exists', () => {
  it('asks instead of appending to it', async () => {
    const before = fs.readFileSync(path.join(root, 'home/lease.md'), 'utf8');
    server.respondWith([
      {
        text: 'The meal box order was confirmed for Thursday and Friday.',
        subject: 'meal orders',
        page: 'home/lease',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
      });
      expect(result.wrote).toBeUndefined();
      expect(result.outcome).toBe('requires_approval');
      expect(result.approvals?.[0]?.reason_code).toBe('routing_uncertain');
      expect(result.approvals?.[0]?.reason).toContain('home/lease');
      // The response must not report a claim as kept on a page it was refused.
      expect(result.considered?.[0]?.kept).toBe(false);
      expect(result.considered?.[0]?.slug).toBeNull();
      expect(fs.readFileSync(path.join(root, 'home/lease.md'), 'utf8')).toBe(before);
    } finally {
      await mem.close();
    }
  });

  it('still creates the page when the guess names one that does not exist', async () => {
    server.respondWith([
      {
        text: 'The meal box order was confirmed for Thursday and Friday.',
        subject: 'meal orders',
        page: 'home/meal-orders',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
      });
      expect(result.wrote?.[0]?.slug).toBe('home/meal-orders');
      expect(fs.existsSync(path.join(root, 'home/meal-orders.md'))).toBe(true);
    } finally {
      await mem.close();
    }
  });
});

/**
 * Card order is `score * rank`, and a card's score is the best of its chunks — so the page that
 * *leads* is the page with one strong passage, which is not the page a cross-encoder judges the
 * right home. Routing used to threshold the leader alone, so a leader below the bar sent the
 * whole claim to the retain model's guessed slug with every other candidate unread.
 *
 * Here `rank` puts the weak invented page in front without
 * touching either page's relevance.
 */
describe('routing when the best-ranked page is not the best-judged one', () => {
  const embedded = {
    models: {
      embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPIC_TERMS.length + 1 },
      reranker: { id: null, enabled: false },
      derive: { provider: 'stub', id: 'stub-derive' },
      expansion: { provider: 'stub', id: 'stub-derive' },
    },
    folders: { 'household/subscriptions*': { rank: 0.1 } },
  };

  beforeEach(() => {
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    // Leads on rank, and mostly about concerts: cosine 1/√10 ≈ 0.32, under the 0.5 threshold.
    fs.writeFileSync(
      path.join(root, 'household/concerts.md'),
      '---\ntitle: Concerts\n---\n\n# Concerts\n\n- A concert, another concert, a third concert, and one meal.\n',
      'utf8',
    );
    // The right home, and the reranker would say so: cosine 1.0. Ranked last by config.
    fs.writeFileSync(
      path.join(root, 'household/subscriptions.md'),
      '---\ntitle: Subscriptions\n---\n\n# Subscriptions\n\n- The meal supplier cancelled in August.\n',
      'utf8',
    );
  });

  it('routes to the highest-judged candidate, not the one that happens to rank first', async () => {
    server.respondWith([
      {
        text: 'The meal box order was confirmed, a meal for Thursday and a meal for Friday.',
        subject: 'meal orders',
        page: 'household/concerts',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const result = await mem.remember({
        text: 'The meal box order was confirmed, a meal for Thursday and a meal for Friday.',
      });
      expect(result.wrote?.[0]?.slug).toBe('household/subscriptions');
      // The leader is still a candidate — it just no longer decides for everyone behind it.
      expect(result.wrote?.some((target) => target.slug === 'household/concerts')).toBeFalsy();
    } finally {
      await mem.close();
    }
  });
});

describe('routing when the strongest semantic match is read-only', () => {
  const embedded = {
    models: {
      embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPIC_TERMS.length + 1 },
      reranker: { id: null, enabled: false },
      derive: { provider: 'stub', id: 'stub-derive' },
      expansion: { provider: 'stub', id: 'stub-derive' },
    },
  };

  it('creates a managed page instead of contaminating a weaker writable match', async () => {
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'household/reference.md'),
      [
        '---',
        'title: Meal reference',
        'akno:',
        '  management:',
        '    remember: deny',
        '---',
        '',
        '# Meal reference',
        '',
        'Meal meal meal.',
        '',
      ].join('\n'),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'household/general.md'),
      '# General\n\nMeal planning and concert notes, concert reminders, concert archive.\n',
      'utf8',
    );
    const before = fs.readFileSync(path.join(root, 'household/general.md'), 'utf8');
    server.respondWith([
      {
        text: 'The meal box order was confirmed for Thursday and Friday.',
        subject: 'meal orders',
        page: 'household/meal-orders',
        kind: 'fact',
      },
    ]);

    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const result = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
      });
      expect(result.wrote?.[0]).toMatchObject({ slug: 'household/meal-orders', action: 'created' });
      expect(result.considered?.[0]?.destination).toBe('new_managed_page');
      expect(fs.readFileSync(path.join(root, 'household/general.md'), 'utf8')).toBe(before);
      expect(fs.readFileSync(path.join(root, 'household/meal-orders.md'), 'utf8')).toContain('akno:item');
    } finally {
      await mem.close();
    }
  });

  it('reports the authorization failure without making dry-run proposals', async () => {
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    const referencePath = path.join(root, 'household/reference.md');
    fs.writeFileSync(
      referencePath,
      [
        '---',
        'title: Meal reference',
        'akno:',
        '  management:',
        '    remember: deny',
        '---',
        '',
        '# Meal reference',
        '',
        'Meal meal meal.',
        '',
      ].join('\n'),
      'utf8',
    );
    const before = fs.readFileSync(referencePath, 'utf8');
    server.respondWith([
      {
        text: 'The meal box order was confirmed for Thursday and Friday.',
        subject: 'meal orders',
        page: 'household/reference',
        kind: 'fact',
      },
    ]);

    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const preview = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
        dry_run: true,
      });
      expect(preview).toMatchObject({
        outcome: 'no_writable_destination',
        considered: [{ destination: 'no_writable_destination', kept: false, written: false }],
      });
      expect(preview.approvals).toBeUndefined();
      expect(mem.proposals()).toEqual([]);

      const result = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
      });
      expect(result.outcome).toBe('no_writable_destination');
      expect(result.approvals?.[0]?.reason_code).toBe('no_writable_destination');
      expect(mem.proposals()).toHaveLength(1);
      expect(fs.readFileSync(referencePath, 'utf8')).toBe(before);
    } finally {
      await mem.close();
    }
  });
});

describe('configured remember fallback', () => {
  const configured = {
    maintenance: { retain: { fallback_page: 'memory/inbox' } },
  };

  it('uses an admitted fallback after a read-only semantic match, including in dry-run', async () => {
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
    const referencePath = path.join(root, 'household/reference.md');
    const generalPath = path.join(root, 'household/general.md');
    const fallbackPath = path.join(root, 'memory/inbox.md');
    fs.writeFileSync(
      referencePath,
      '---\ntitle: Meal reference\nakno:\n  management:\n    remember: deny\n---\n\n# Meal reference\n\nMeal meal meal.\n',
      'utf8',
    );
    fs.writeFileSync(
      generalPath,
      '# General\n\nMeal planning and concert notes, concert reminders, concert archive.\n',
      'utf8',
    );
    fs.writeFileSync(
      fallbackPath,
      '---\ntitle: Inbox\nakno:\n  management:\n    remember: integrate\n---\n\n# Inbox\n',
      'utf8',
    );
    const referenceBefore = fs.readFileSync(referencePath, 'utf8');
    const generalBefore = fs.readFileSync(generalPath, 'utf8');
    const fallbackBefore = fs.readFileSync(fallbackPath, 'utf8');
    server.respondWith([
      {
        text: 'The meal box order was confirmed for Thursday and Friday.',
        subject: 'meal orders',
        page: 'household/reference',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({
      ...configured,
      models: {
        embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPIC_TERMS.length + 1 },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { provider: 'stub', id: 'stub-derive' },
      },
    });
    try {
      await mem.index({});
      expect((await mem.doctor({ probeModels: false })).factInjection.fallback).toEqual({
        slug: 'memory/inbox',
        status: 'existing_page',
      });
      const preview = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
        dry_run: true,
      });
      expect(preview).toMatchObject({
        outcome: 'ok',
        fallback: { slug: 'memory/inbox', status: 'used' },
        considered: [{ destination: 'configured_fallback', slug: 'memory/inbox', written: false }],
      });
      expect(preview.approvals).toBeUndefined();
      expect(mem.proposals()).toEqual([]);
      expect(fs.readFileSync(fallbackPath, 'utf8')).toBe(fallbackBefore);

      const result = await mem.remember({
        text: 'The meal box order was confirmed for Thursday and Friday.',
      });
      expect(result).toMatchObject({
        outcome: 'ok',
        fallback: { slug: 'memory/inbox', status: 'used' },
        wrote: [{ slug: 'memory/inbox', action: 'appended' }],
        considered: [{ destination: 'configured_fallback', written: true }],
      });
      expect(fs.readFileSync(referencePath, 'utf8')).toBe(referenceBefore);
      expect(fs.readFileSync(generalPath, 'utf8')).toBe(generalBefore);
    } finally {
      await mem.close();
    }
  });

  it('creates the configured page only inside an explicitly admitted folder', async () => {
    server.respondWith([
      {
        text: 'Ada Marlow prefers brass instruments.',
        subject: 'Ada Marlow preference',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({
      ...configured,
      folders: { 'memory/**': { role: 'knowledge', remember: 'integrate' } },
    });
    try {
      expect((await mem.doctor({ probeModels: false })).factInjection.fallback).toEqual({
        slug: 'memory/inbox',
        status: 'new_page',
      });
      const result = await mem.remember({ text: 'Ada Marlow prefers brass instruments.' });
      expect(result).toMatchObject({
        outcome: 'ok',
        fallback: { slug: 'memory/inbox', status: 'used' },
        wrote: [{ slug: 'memory/inbox', action: 'created' }],
        considered: [{ destination: 'configured_fallback', written: true }],
      });
      const page = fs.readFileSync(path.join(root, 'memory/inbox.md'), 'utf8');
      expect(page).toContain('title: "Inbox"');
      expect(page).not.toContain('title: "Ada Marlow preference"');
      expect(page).toContain('remember: integrate');
    } finally {
      await mem.close();
    }
  });

  it('prefers an ordinary new managed page over the configured fallback', async () => {
    fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
    const fallbackPath = path.join(root, 'memory/inbox.md');
    fs.writeFileSync(
      fallbackPath,
      '---\ntitle: Inbox\nakno:\n  management:\n    remember: integrate\n---\n\n# Inbox\n',
      'utf8',
    );
    const before = fs.readFileSync(fallbackPath, 'utf8');
    server.respondWith([
      {
        text: 'The Zephyr QX-100 warranty lasts five years.',
        subject: 'Zephyr warranty',
        page: 'home/zephyr-warranty',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(configured);
    try {
      await mem.index({ structuralOnly: true });
      const result = await mem.remember({ text: 'The Zephyr QX-100 warranty lasts five years.' });
      expect(result.considered?.[0]?.destination).toBe('new_managed_page');
      expect(result.wrote?.[0]?.slug).toBe('home/zephyr-warranty');
      expect(result.fallback).toBeUndefined();
      expect(fs.readFileSync(fallbackPath, 'utf8')).toBe(before);
    } finally {
      await mem.close();
    }
  });

  it('reports an existing read-only fallback as unavailable', async () => {
    fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
    const fallbackPath = path.join(root, 'memory/inbox.md');
    fs.writeFileSync(
      fallbackPath,
      '---\ntitle: Inbox\nakno:\n  management:\n    remember: deny\n---\n\n# Inbox\n',
      'utf8',
    );
    const before = fs.readFileSync(fallbackPath, 'utf8');
    server.respondWith([
      {
        text: 'Ada Marlow prefers brass instruments.',
        subject: 'Ada Marlow preference',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(configured);
    try {
      await mem.index({ structuralOnly: true });
      const result = await mem.remember({ text: 'Ada Marlow prefers brass instruments.' });
      expect(result).toMatchObject({
        outcome: 'no_writable_destination',
        fallback: {
          slug: 'memory/inbox',
          status: 'unavailable',
          reason: 'existing_page_not_admitted',
        },
        considered: [{ destination: 'no_writable_destination', written: false }],
      });
      expect(result.approvals?.[0]?.reason_code).toBe('no_writable_destination');
      const health = await mem.doctor({ probeModels: false });
      expect(health.factInjection.fallback).toEqual({
        slug: 'memory/inbox',
        status: 'unavailable',
        reason: 'existing_page_not_admitted',
      });
      expect(health.warnings).toContain(
        'the configured remember fallback is unavailable: existing page not admitted',
      );
      expect(fs.readFileSync(fallbackPath, 'utf8')).toBe(before);
    } finally {
      await mem.close();
    }
  });

  it('never overwrites fallback bytes that exist outside the current index', async () => {
    fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
    const fallbackPath = path.join(root, 'memory/inbox.md');
    const before = '# Handwritten inbox\n\nDo not replace this page.\n';
    fs.writeFileSync(fallbackPath, before, 'utf8');
    server.respondWith([
      {
        text: 'Ada Marlow prefers brass instruments.',
        subject: 'Ada Marlow preference',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({
      ...configured,
      folders: { 'memory/**': { role: 'knowledge', remember: 'integrate' } },
    });
    try {
      const result = await mem.remember({ text: 'Ada Marlow prefers brass instruments.' });
      expect(result.fallback).toEqual({
        slug: 'memory/inbox',
        status: 'unavailable',
        reason: 'unindexed_page_exists',
      });
      expect(result.outcome).toBe('no_writable_destination');
      expect(fs.readFileSync(fallbackPath, 'utf8')).toBe(before);
    } finally {
      await mem.close();
    }
  });

  it('rejects a reserved fallback without writing the event ledger', async () => {
    server.respondWith([
      {
        text: 'Ada Marlow prefers brass instruments.',
        subject: 'Ada Marlow preference',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({ maintenance: { retain: { fallback_page: 'timeline' } } });
    try {
      const result = await mem.remember({ text: 'Ada Marlow prefers brass instruments.' });
      expect(result).toMatchObject({
        outcome: 'no_writable_destination',
        fallback: { slug: 'timeline', status: 'unavailable', reason: 'reserved_path' },
      });
      expect(fs.existsSync(path.join(root, 'timeline.md'))).toBe(false);
    } finally {
      await mem.close();
    }
  });

  it('rejects an unsafe configured fallback slug during config loading', async () => {
    await expect(openMem({ maintenance: { retain: { fallback_page: '../outside' } } })).rejects.toThrow(
      /safe page slug/,
    );
  });
});

it('reports a held destination even when another retained claim was written', async () => {
  server.respondWith([
    {
      text: 'The Zephyr QX-100 warranty lasts five years.',
      subject: 'Zephyr warranty',
      page: 'home/zephyr-warranty',
      kind: 'fact',
    },
    {
      text: 'Ada Marlow prefers brass instruments.',
      subject: 'Ada Marlow preference',
      kind: 'fact',
    },
  ]);
  const mem = await openMem();
  try {
    const result = await mem.remember({
      text: 'The warranty and preference were confirmed.',
    });
    expect(result.outcome).toBe('no_writable_destination');
    expect(result.wrote).toEqual([
      expect.objectContaining({ slug: 'home/zephyr-warranty', action: 'created' }),
    ]);
    expect(result.considered).toEqual([
      expect.objectContaining({ destination: 'new_managed_page', written: true }),
      expect.objectContaining({ destination: 'no_writable_destination', written: false }),
    ]);
    expect(result.approvals?.[0]?.reason_code).toBe('no_writable_destination');
  } finally {
    await mem.close();
  }
});

/**
 * `references/` is manually maintained source material and never a destination for a remembered claim.
 * `references/vulpine-account.md` appeared there because no rule
 * declared the folder — an undeclared folder is eligible, and the directory existed, which was
 * the only question creation asked.
 *
 * A declared `remember: deny` is refused before routing ever runs: the catalog marks the folder
 * ineligible, and retain drops a suggested page whose parent is not an eligible folder. That
 * chain is three files apart, so this test is what keeps it joined up — it fails, and creates the
 * page, the moment any link in it stops holding.
 */
describe('a folder that refuses remembered claims', () => {
  it('refuses to create a page there, not just to append to one', async () => {
    fs.mkdirSync(path.join(root, 'references'), { recursive: true });
    server.respondWith([
      {
        text: 'The account was warned for two years of inactivity.',
        subject: 'Vulpine Mutual account inactivity',
        page: 'references/vulpine-account',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({
      folders: { 'references/**': { role: 'knowledge', remember: 'deny' } },
    });
    try {
      const result = await mem.remember({
        text: 'The account was warned for two years of inactivity.',
      });
      expect(result.wrote).toBeUndefined();
      expect(result.outcome).toBe('no_writable_destination');
      expect(result.approvals?.[0]?.reason_code).toBe('no_writable_destination');
      expect(fs.existsSync(path.join(root, 'references/vulpine-account.md'))).toBe(false);
    } finally {
      await mem.close();
    }
  });
});

/**
 * The digest is Akno's job; *what to notice in this text* is the caller's. The mission is how
 * that line is drawn, and the guarantee worth a test is that it stays a line: emphasis added to
 * the standing rules, never a replacement for them.
 */
describe('a caller-supplied mission', () => {
  it('reaches the model as emphasis on top of the standing rules', async () => {
    const mem = await openMem();
    server.forget();
    try {
      await mem.remember({
        text: 'Forwarded from Bo Winters: the membership number is 88-4120.',
        mission: 'Attribute forwarded content to its original author, not the forwarder.',
      });
      const system = server.lastSystem();
      // The caller's words are there...
      expect(system).toContain('Attribute forwarded content to its original author');
      // ...and so are the rules it must not have replaced.
      expect(system).toContain('Prose, not triples');
      expect(system).toContain('Additional emphasis');
    } finally {
      await mem.close();
    }
  });

  it('lets the call override the install-wide mission, being the more specific of the two', async () => {
    // Config states a standing policy; a call states what is true of this text. The narrower
    // claim wins, or a host could never say "this one is a forward".
    const mem = await openMem({ maintenance: { retain: { mission: 'Prefer household logistics.' } } });
    server.forget();
    try {
      await mem.remember({ text: 'Anything at all.', mission: 'Only medical history.' });
      const system = server.lastSystem();
      expect(system).toContain('Only medical history.');
      expect(system).not.toContain('Prefer household logistics.');
    } finally {
      await mem.close();
    }
  });

  it('runs the digest on the cycle’s model when one is configured', async () => {
    // Retain is a maintenance tier, and the tier's output is mostly a function of its model. An
    // install that pointed the nightly cycle at a strong model should not have to say so twice.
    const cycle = await startStubChat();
    const mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'user',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: server.url }, cycle: { base_url: cycle.url } },
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
        },
        maintenance: { model: { provider: 'cycle', id: 'cycle-model' } },
      },
    });
    server.forget();
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(cycle.lastSystem()).toContain('Prose, not triples');
      // And the derive model was not asked to do the cycle's work.
      expect(server.lastSystem()).not.toContain('Prose, not triples');
    } finally {
      await mem.close();
      await cycle.close();
    }
  });
});

/**
 * A held claim has to be answerable, and answering it means naming a page.
 *
 * A `route` proposal exists precisely because nothing scored high enough to choose one, so its
 * payload carries the claim and no destination. Approving it used to replay that payload straight
 * into `write`, which rejected it with "requires a slug" — so the proposal was unanswerable through
 * every door, and an agent telling the user "this needs your approval" was pointing at nothing.
 */
describe('answering a held proposal', () => {
  it('refuses an approval with no destination, and says what is missing', async () => {
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle key lives with the concierge.' });
      expect(result.outcome).toBe('no_writable_destination');
      expect(result.approvals?.[0]?.reason_code).toBe('no_writable_destination');
      const proposal = result.approvals![0]!.proposal_id;

      await expect(mem.approve(proposal)).rejects.toThrow(/no destination — approve it with a page/);
      // Still pending: a refused approval must not consume the proposal.
      expect(mem.proposals().map((row) => row.id)).toContain(proposal);
    } finally {
      await mem.close();
    }
  });

  it('writes the held claim to the page the owner names, creating it when new', async () => {
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle key lives with the concierge.' });
      const proposal = result.approvals![0]!.proposal_id;

      const approved = await mem.approve(proposal, { slug: 'home/bicycle-storage' });
      expect(approved.write?.outcome).toBe('ok');
      expect(approved.write?.wrote?.[0]?.slug).toBe('home/bicycle-storage');

      const body = fs.readFileSync(path.join(root, 'home/bicycle-storage.md'), 'utf8');
      // The stub's retained claim, whatever the input text was. Once, not twice: a
      // create-from-append writes it as the body and nothing else.
      expect(body.match(/The rent is 1234 EUR per month\./g)).toHaveLength(1);
      expect(mem.proposals().map((row) => row.id)).not.toContain(proposal);
    } finally {
      await mem.close();
    }
  });

  it('offers only pages that could actually receive the claim', async () => {
    // `nearest` used to be drawn from every card, including `reference` pages — which routing then
    // refuses to write to. Suggesting one proposes a destination the system would reject, and an
    // agent reading the list announced it as the intended home.
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'evidence/landlord-letter.md'),
      '---\ntitle: Landlord letter\n---\n\n# Landlord letter\n\n- The rent for the apartment is under dispute\n',
      'utf8',
    );
    const mem = await openMem({ folders: { 'evidence/**': { role: 'source', remember: 'deny' } } });
    try {
      await mem.index({});
      const result = await mem.remember({ text: 'The rent is disputed at the apartment.' });
      const nearest = result.approvals?.[0]?.nearest ?? [];
      expect(nearest).not.toContain('evidence/landlord-letter');
    } finally {
      await mem.close();
    }
  });
});
