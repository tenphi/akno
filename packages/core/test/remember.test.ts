import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

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
const TOPIC_TERMS = ['leoninum', 'pool', 'sauna', 'gym', 'wellness', 'towel', 'meal', 'concert'];

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
      expect(system).toContain('- home/ [role=knowledge; remember=integrate; eligible=true]');
      expect(system).toContain(
        '- knowledge/games/ [role=source; remember=deny; eligible=false] — Findings about the outside world.',
      );
      expect(system).toMatch(/Never invent, rename or translate a folder/);
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

describe('what remember reports as written', () => {
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
      expect(result.outcome).toBe('requires_approval');
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
    // `travel/2027/japan-trip`, live: a claim about the Shin-Osaka–Hakata Shinkansen was routed
    // to the trip page — correctly — and created it titled "Osaka Fukuoka train". Every recall
    // then reported a three-week trip under the name of the fact that happened to open it.
    server.respondWith([
      {
        text: 'The direct Shinkansen from Shin-Osaka to Hakata takes about 2h30.',
        subject: 'Osaka Fukuoka train',
        page: 'home/japan-trip',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      await mem.remember({ text: 'The direct Shinkansen from Shin-Osaka to Hakata takes about 2h30.' });
      const content = created('home/japan-trip');
      expect(content).toContain('title: "Japan Trip"');
      expect(content).not.toContain('Osaka Fukuoka train');
      // The claim itself still lands on the page — only the name of the page changed.
      expect(content).toContain('Shin-Osaka');
    } finally {
      await mem.close();
    }
  });
});

/**
 * A claim carries a subject and an attribute, and only the subject says who owns it. Scoring
 * both together asks the cross-encoder "does this passage answer this", which the owning page
 * fails whenever the attribute is the new part — the normal case for something worth
 * remembering. Observed live: a hotel's pool went to a new page while the trip page naming that
 * hotel three times sat at 0.27.
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
      path.join(root, 'trips/bonn.md'),
      '---\ntitle: Bonn\n---\n\n# Bonn\n\n- Staying at the Leoninum, check-in 15:00.\n',
      'utf8',
    );
  });

  it('falls back to the subject alone and routes to the page that owns it', async () => {
    server.respondWith([
      {
        text: 'The Leoninum has a pool, a sauna, a gym, a wellness area and towel service.',
        subject: 'Leoninum',
        page: 'trips/leoninum',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const result = await mem.remember({
        text: 'The Leoninum has a pool, a sauna, a gym, a wellness area and towel service.',
      });
      expect(result.wrote?.[0]?.slug).toBe('trips/bonn');
      expect(fs.existsSync(path.join(root, 'trips/leoninum.md'))).toBe(false);
    } finally {
      await mem.close();
    }
  });

  it('keeps the destination the claim itself chose when the claim routes', async () => {
    server.respondWith([
      {
        text: 'The Leoninum pool is open until 22:00.',
        subject: 'opening hours',
        page: 'trips/anything',
        kind: 'fact',
      },
    ]);
    const mem = await openMem(embedded);
    try {
      await mem.index({});
      const result = await mem.remember({ text: 'The Leoninum pool is open until 22:00.' });
      // The claim pass found `trips/bonn` on its own; the subject pass never had to run.
      expect(result.wrote?.[0]?.slug).toBe('trips/bonn');
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
 * Observed 2026-08-16: a meal-box order appended to `household/concerts-2026`, which the reranker
 * scores 0.026 against it. Routing had refused correctly; the guess simply outranked the refusal.
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
 * Observed 2026-08-16: a meal-box order landed on `household/concerts-2026` (reranker 0.026)
 * while `household/subscriptions`, already holding that supplier's cancellation, scored 0.755
 * and was never looked at.
 *
 * Here `rank` does what one strong passage did there — it puts the weak page in front without
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

/**
 * `users/` is Luna's hot memory: per-person standing instructions injected every turn, and never
 * a destination for a remembered claim. `users/google-account.md` appeared there because no rule
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
    fs.mkdirSync(path.join(root, 'users'), { recursive: true });
    server.respondWith([
      {
        text: 'The account was warned for two years of inactivity.',
        subject: 'Google account inactivity',
        page: 'users/google-account',
        kind: 'fact',
      },
    ]);
    const mem = await openMem({ folders: { 'users/**': { role: 'knowledge', remember: 'deny' } } });
    try {
      const result = await mem.remember({
        text: 'The account was warned for two years of inactivity.',
      });
      expect(result.wrote).toBeUndefined();
      expect(result.outcome).toBe('requires_approval');
      expect(fs.existsSync(path.join(root, 'users/google-account.md'))).toBe(false);
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
        text: 'Forwarded from Brannoch: the membership number is 88-4120.',
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
      expect(result.outcome).toBe('requires_approval');
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
