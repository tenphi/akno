import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * The maintenance cycle, end to end over a real knowledge base on disk.
 *
 * The model is a stub, because every case here is about what the *cycle* does with a
 * given answer — the guardrails, the append-only writing, the re-run safety — and a live
 * model cannot be scripted into returning the answer each case needs. All fixtures are
 * invented (see AGENTS.md).
 */

let root: string;
let stateDir: string;
let mem: Akno;
let server: StubServer;

interface DerivedFact {
  claim: string;
  subject: string;
  attribute: string;
  value: string;
}

interface StubServer {
  url: string;
  close: () => Promise<void>;
  /** What the observe mission and the conflict verifier get back. */
  reply: (value: unknown) => void;
  conflict: (value: unknown) => void;
  conflictCalls: () => number;
  /** Facts the deriver returns for a page, so real facts land on real lines. */
  facts: (byslug: Record<string, DerivedFact[]>) => void;
  /** The last body the observe mission was given, for asserting what it was shown. */
  lastObserveInput: () => string;
}

/**
 * One stub for three different callers — the deriver, the observe mission, the conflict
 * verifier — routed on what each one asks. Facts go through the real derivation path rather
 * than being inserted behind it, so these tests exercise the same rows `observe` reads in
 * production.
 */
async function startStubChat(): Promise<StubServer> {
  let scripted: unknown = {};
  let conflictScripted: unknown = {
    outcome: 'not_a_conflict',
    current: null,
    qualification: null,
    reason: 'The fixtures describe different appliances.',
  };
  let classified = 0;
  let byPage: Record<string, DerivedFact[]> = {};
  let lastObserve = '';

  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        messages?: { role: string; content: string }[];
      };
      const user = body.messages?.at(-1)?.content ?? '';
      const system = body.messages?.[0]?.content ?? '';
      if (system.startsWith('You classify structurally incompatible claims')) classified += 1;
      const answer = user.startsWith('Page: ')
        ? derive(user, byPage)
        : system.startsWith('You classify structurally incompatible claims')
          ? conflictScripted
          : system.startsWith('You are the independent curator for an autonomous memory system')
            ? { outcome: 'approve', reason: 'The sealed contradiction item preserves authored knowledge.' }
            : system.startsWith('A personal knowledge base holds two claims')
              ? { line: 'Before 2002-02-02, the Zephyr QX-100 warranty was 1111 days.' }
              : scripted;
      if (!user.startsWith('Page: ')) lastObserve = user;

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
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
    reply: (value) => {
      scripted = value;
    },
    conflict: (value) => {
      conflictScripted =
        value && typeof value === 'object' && !Array.isArray(value) && !('qualification' in value)
          ? { ...value, qualification: null }
          : value;
    },
    conflictCalls: () => classified,
    facts: (value) => {
      byPage = value;
    },
    lastObserveInput: () => lastObserve,
  };
}

/**
 * The deriver is shown numbered lines and must cite one it was given, so the stub finds
 * a real line for each fact rather than guessing a number.
 */
function derive(user: string, byPage: Record<string, DerivedFact[]>): unknown {
  const slug = /^Page: (.+)$/m.exec(user)?.[1] ?? '';
  const lines = [...user.matchAll(/^(\d+): (.+)$/gm)].map((match) => ({
    line: Number(match[1]),
    text: match[2]!,
  }));

  const facts = (byPage[slug] ?? []).flatMap((fact) => {
    // The line whose words the claim is about, so the fact is anchored where a real
    // derivation would anchor it.
    const anchor = lines.find((entry) => shares(entry.text, fact.value)) ?? lines[0];
    return anchor ? [{ ...fact, line: anchor.line }] : [];
  });

  return { summary: `${slug} in a sentence.`, keywords: [], facts };
}

function shares(text: string, value: string): boolean {
  const words = value
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
  return words.some((word) => text.toLowerCase().includes(word));
}

const PAGES: Record<string, string> = {
  'home/appliances.md':
    '---\ntitle: Appliances\n---\n\n# Appliances\n\nThe dishwasher was repaired in March 2026.\n',
  'home/laundry.md':
    '---\ntitle: Laundry\n---\n\n# Laundry\n\nThe washing machine was serviced in June 2026.\n',
  'home/kitchen.md': '---\ntitle: Kitchen\n---\n\n# Kitchen\n\nThe oven was serviced in September 2026.\n',
  'notes/manual.md':
    '---\ntitle: Manual\nakno:\n  role: source\n---\n\n# Manual\n\nService the appliance every 6 months.\n',
};

/** The default derivation: one fact per page, all about the same subject. */
const SERVICING: Record<string, DerivedFact[]> = {
  'home/appliances': [
    {
      claim: 'The dishwasher was repaired in March 2026.',
      subject: 'appliance servicing',
      attribute: 'serviced',
      value: 'March 2026',
    },
  ],
  'home/laundry': [
    {
      claim: 'The washing machine was serviced in June 2026.',
      subject: 'appliance servicing',
      attribute: 'serviced',
      value: 'June 2026',
    },
  ],
  'home/kitchen': [
    {
      claim: 'The oven was serviced in September 2026.',
      subject: 'appliance servicing',
      attribute: 'serviced',
      value: 'September 2026',
    },
  ],
};

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
      // Observe ships off (see config/default.jsonc); these tests are about what it does when
      // a knowledge base turns it on.
      maintenance: { observe: { enabled: true } },
      ...overrides,
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-dream-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-dream-state-'));
  server = await startStubChat();
  server.facts(SERVICING);

  for (const [relPath, content] of Object.entries(PAGES)) {
    fs.mkdirSync(path.join(root, path.dirname(relPath)), { recursive: true });
    fs.writeFileSync(path.join(root, relPath), content, 'utf8');
  }

  mem = await openMem();
  await mem.index({});
});

afterEach(async () => {
  await mem?.close();
  await server?.close();
  for (const dir of [root, stateDir]) fs.rmSync(dir, { recursive: true, force: true });
});

const PATTERN = 'Household appliances are serviced roughly every three months.';

const OBSERVED = {
  observations: [
    { pattern: PATTERN, evidence: ['home/appliances', 'home/laundry', 'home/kitchen'], confidence: 0.8 },
  ],
};

describe('reflect', () => {
  /**
   * The tier reads the folder it writes into, which is how `principles` came to list itself as its
   * own evidence on a real knowledge base. A conclusion offered as its own support reads, later, as
   * a conclusion with support.
   */
  async function withTwoObservations(): Promise<Akno> {
    await mem.close();
    for (const [name, body] of [
      ['travel-lunch', 'Travel itineraries treat lunch as a scheduled part of the day.'],
      ['banking-review-period', 'Banking review periods cover the full calendar month.'],
      // Three, not two: reflect sits a tier further from the evidence and asks for more of it.
      ['home-servicing', 'Household appliances are serviced on a regular cadence.'],
    ] as const) {
      fs.mkdirSync(path.join(root, 'observations'), { recursive: true });
      fs.writeFileSync(
        path.join(root, `observations/${name}.md`),
        `---\ntitle: ${name}\nderived: true\n---\n\n- 2026-08-08 — ${body}\n`,
        'utf8',
      );
    }
    mem = await openMem({ maintenance: { observe: { enabled: true }, reflect: { enabled: true } } });
    await mem.index({});
    return mem;
  }

  it('is told the principles it already wrote', async () => {
    // Same bug as observe's, one tier up: this appends to a single page every night from
    // observations that rarely change, so without its own previous answers it restates them.
    await withTwoObservations();
    server.reply({
      observations: [
        {
          pattern: 'Recurring activities are managed through explicit structures.',
          evidence: [
            'observations/travel-lunch',
            'observations/banking-review-period',
            'observations/home-servicing',
          ],
          confidence: 0.9,
        },
      ],
    });
    await mem.dream({ phase: 'reflect' });

    server.reply({ observations: [] });
    await mem.dream({ phase: 'reflect' });
    const shown = server.lastObserveInput();
    expect(shown).toContain('Already recorded for this subject');
    expect(shown).toContain('Recurring activities are managed through explicit structures.');
  });

  it('refuses a principle that is only an observation, or a fact, repeated', async () => {
    // A tier above the observations has to say something they do not. Its sources here are page
    // *summaries*, so neither the observation lines nor the knowledge base's own facts are
    // otherwise compared against.
    await withTwoObservations();

    for (const pattern of [
      'Travel itineraries treat lunch as a scheduled part of the day.',
      'The dishwasher was repaired in March 2026.',
    ]) {
      server.reply({
        observations: [
          {
            pattern,
            evidence: [
              'observations/travel-lunch',
              'observations/banking-review-period',
              'observations/home-servicing',
            ],
            confidence: 0.9,
          },
        ],
      });
      const report = await mem.dream({ phase: 'reflect' });
      expect(report.observations, pattern).toHaveLength(0);
      expect(fs.existsSync(path.join(root, 'observations/principles.md')), pattern).toBe(false);
    }
  });

  it('does not read, or cite, the page it writes', async () => {
    await withTwoObservations();

    server.reply({
      observations: [
        {
          pattern: 'Recurring activities are managed through explicit structures.',
          evidence: [
            'observations/travel-lunch',
            'observations/banking-review-period',
            'observations/home-servicing',
            'observations/principles',
          ],
          confidence: 0.9,
        },
      ],
    });
    await mem.dream({ phase: 'reflect' });

    const page = fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8');
    expect(page).toContain('Recurring activities are managed through explicit structures.');
    // Cited by the model anyway — the writer drops it, so neither the frontmatter nor the line
    // points the page at itself.
    expect(page).not.toContain('observations/principles');

    // And it is not offered as a source on the next run either.
    server.reply({ observations: [] });
    await mem.dream({ phase: 'reflect' });
    expect(server.lastObserveInput()).not.toContain('observations/principles');
  });
});

describe('repair', () => {
  async function withBrokenLinks(mode: 'audit' | 'auto' = 'auto'): Promise<void> {
    await mem.close();
    fs.writeFileSync(
      path.join(root, 'home/appliances.md'),
      '---\ntitle: Appliances\nakno:\n  management:\n    dream: hygiene\n---\n\n' +
        'See [[Boiler|heating notes]] and [[nothing-like-this-exists]].\n' +
        'Also [the boiler](boiler.md) and [the web](https://example.com/boiler).\n',
      'utf8',
    );
    fs.mkdirSync(path.join(root, 'home/heating'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'home/heating/furnace.md'),
      '---\ntitle: Heating unit\nakno:\n  aliases:\n    - home/boiler\n---\n\nServiced yearly.\n',
      'utf8',
    );
    mem = await openMem({
      maintenance: {
        observe: { enabled: false },
        curate: { enabled: true, mode, verify: true },
        repair: { enabled: true, links: true },
        conflicts: { enabled: false },
      },
    });
    await mem.index({});
  }

  it('applies exact alias-backed links through a verified low-risk plan', async () => {
    await withBrokenLinks();
    const report = await mem.dream({ phase: 'curate' });

    const page = fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8');
    expect(page).toContain('[[home/heating/furnace|heating notes]]');
    expect(page).toContain('[[nothing-like-this-exists]]');
    expect(page).toContain('[the boiler](heating/furnace.md)');
    expect(page).toContain('https://example.com/boiler');

    const item = mem
      .plan(report.maintenancePlan!.id)
      .items.find((candidate) => candidate.kind === 'broken_link')!;
    expect(item).toMatchObject({
      risk: 'low',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(item.operations).toHaveLength(1);
    expect(item.evidence[0]).toMatchObject({
      targetRelPath: 'home/heating/furnace.md',
      targetHash: expect.any(String),
    });
    expect(report.repaired!.links).toEqual([
      expect.objectContaining({
        brokenTarget: 'home/boiler',
        newTarget: 'home/heating/furnace',
        signal: 'alias',
        action: 'applied',
      }),
    ]);
    expect(report.repaired!.declined.some((entry) => entry.reason.includes('no page'))).toBe(true);

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).toContain(
      '[[Boiler|heating notes]]',
    );
  });

  it('seals proposals without writing in audit mode', async () => {
    await withBrokenLinks('audit');
    const before = fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8');
    const report = await mem.dream({ phase: 'curate' });
    const item = mem
      .plan(report.maintenancePlan!.id)
      .items.find((candidate) => candidate.kind === 'broken_link')!;

    expect(item.status).toBe('proposed');
    expect(report.repaired!.links).toEqual([expect.objectContaining({ action: 'planned' })]);
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).toBe(before);
  });

  it('can audit deterministic link items without a model', async () => {
    await withBrokenLinks('audit');
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      maintenance: {
        observe: { enabled: false },
        curate: { enabled: true, mode: 'audit' },
        repair: { links: true },
        conflicts: { enabled: false },
      },
    });

    const report = await mem.dream({ phase: 'curate' });

    expect(report.maintenancePlan?.items).toEqual([
      expect.objectContaining({ kind: 'broken_link', status: 'proposed' }),
    ]);
    expect(report.repaired!.links).toEqual([expect.objectContaining({ action: 'planned' })]);
  });

  it('makes an approved item stale when its destination changed after planning', async () => {
    await withBrokenLinks('audit');
    const before = fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8');
    const planned = await mem.dream({ phase: 'curate' });
    const plan = mem.plan(planned.maintenancePlan!.id);
    const item = plan.items.find((candidate) => candidate.kind === 'broken_link')!;
    fs.appendFileSync(path.join(root, 'home/heating/furnace.md'), '\nA newer invented note.\n');

    mem.decidePlan(plan.id, item.id, 'approve', 'The exact alias establishes the intended page.');
    const result = await mem.applyPlan(plan.id);

    expect(result.plan.items.find((candidate) => candidate.id === item.id)?.status).toBe('stale');
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).toBe(before);
  });

  it('keeps the legacy repair phase report-only', async () => {
    await withBrokenLinks();
    const before = fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8');
    const report = await mem.dream({ phase: 'repair' });

    expect(report.repaired!.links).toEqual([expect.objectContaining({ action: 'planned' })]);
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).toBe(before);
    expect(report.repairChangeId).toBeNull();
    expect(report.warnings[0]).toContain('report-only');
  });

  it('retains curate outcomes when the compatibility phase follows in a full run', async () => {
    await withBrokenLinks();

    const report = await mem.dream();

    expect(report.repaired!.links).toEqual([expect.objectContaining({ action: 'applied' })]);
    expect(report.phases.find((phase) => phase.phase === 'repair')?.ran).toBe(true);
  });

  it('uses journalled move history when the new name has no textual resemblance', async () => {
    await mem.close();
    fs.writeFileSync(
      path.join(root, 'home/appliances.md'),
      '---\ntitle: Appliances\nakno:\n  management:\n    dream: hygiene\n---\n\nSee [[home/boiler]].\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'home/boiler.md'),
      '---\ntitle: Boiler\n---\n\nInvented fixture.\n',
      'utf8',
    );
    mem = await openMem({
      maintenance: {
        observe: { enabled: false },
        curate: { enabled: true, mode: 'audit' },
        repair: { links: true },
        conflicts: { enabled: false },
      },
    });
    await mem.index({});
    await mem.move({ from: 'home/boiler', to: 'archive/intermediate-heating-note' });
    await mem.move({
      from: 'archive/intermediate-heating-note',
      to: 'archive/zephyr-heating-record',
    });

    const report = await mem.dream({ phase: 'curate' });
    expect(report.repaired!.links).toEqual([
      expect.objectContaining({
        brokenTarget: 'home/boiler',
        newTarget: 'archive/zephyr-heating-record',
        signal: 'move_history',
        action: 'planned',
      }),
    ]);
  });

  it('declines ambiguous exact identities and similarity-only guesses', async () => {
    await mem.close();
    fs.writeFileSync(
      path.join(root, 'home/appliances.md'),
      '---\ntitle: Appliances\nakno:\n  management:\n    dream: hygiene\n---\n\n' +
        'See [[Boiler]] and [[old-zephyr-manual]].\n',
      'utf8',
    );
    for (const relPath of ['home/heating/boiler.md', 'workshop/boiler.md']) {
      fs.mkdirSync(path.join(root, path.dirname(relPath)), { recursive: true });
      fs.writeFileSync(path.join(root, relPath), '---\ntitle: Boiler\n---\n\nInvented fixture.\n', 'utf8');
    }
    fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'archive/2031-old-zephyr-manual-copy.md'),
      '---\ntitle: Archived manual copy\n---\n\nInvented fixture.\n',
      'utf8',
    );
    mem = await openMem({
      maintenance: {
        observe: { enabled: false },
        curate: { enabled: true, mode: 'audit' },
        repair: { links: true },
        conflicts: { enabled: false },
      },
    });
    await mem.index({});

    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan).toBeNull();
    expect(report.repaired!.links).toHaveLength(0);
    expect(report.repaired!.declined.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('share the strongest exact identity signal'),
        expect.stringContaining('similarity-only'),
      ]),
    );
  });
});

describe('observe', () => {
  it('writes a page with its evidence, marked as derived', async () => {
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe' });

    expect(report.observations).toHaveLength(1);
    expect(report.observations[0]!.action).toBe('created');
    // Named after the folder as well as the subject. Grouping on the subject alone joined a
    // bag with a drum kit on a real knowledge base, because a small deriver writes the
    // attribute into `subject` — and one page per folder keeps those apart too.
    expect(report.observations[0]!.slug).toBe('observations/home-appliance-servicing');

    const page = fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8');
    // `derived` and `evidence` are the two keys Akno writes on pages it authors. They
    // are what makes an inference identifiable as one afterwards.
    expect(page).toContain('derived: true');
    expect(page).toContain('- home/appliances');
    expect(page).toContain(PATTERN);
    // Not `- **YYYY-MM-DD** |`, which is read as a timeline event anywhere it appears: an
    // inferred pattern is not something that happened on a date.
    expect(page).not.toMatch(/- \*\*\d{4}-\d{2}-\d{2}\*\* \|/);
    const timeline = await mem.timeline({ limit: 50 });
    expect(timeline.events.some((event) => event.summary.includes('appliances are serviced'))).toBe(false);
  });

  it('is safe to re-run: the same pattern is not written twice', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const first = fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8');

    const second = await mem.dream({ phase: 'observe' });
    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toBe(first);
    // Turned back by the guard, with the reason, rather than written and then reported as
    // unchanged. A repeat means the model was told what it had already recorded and said it again.
    expect(second.observations).toHaveLength(0);
    expect(second.rejected.some((entry) => entry.reason === 'already recorded for this subject')).toBe(true);
  });

  it('tells the model what it already recorded for this subject', async () => {
    // The load-bearing half of the fix. On a real knowledge base nine of fifteen observation pages
    // gained a second line the next night, each a paraphrase of the first from facts that had not
    // changed. No string comparison catches that — "declined in each successive period" and
    // "declined in each recorded period" are the same observation and share almost no rare words —
    // so the model has to be shown its own previous answers and told not to repeat them.
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });

    server.reply({ observations: [] });
    await mem.dream({ phase: 'observe' });

    const shown = server.lastObserveInput();
    expect(shown).toContain('Already recorded for this subject');
    expect(shown).toContain(PATTERN);
    // The citation is stripped: it is noise to the model and it is not part of the claim.
    expect(shown).not.toContain('[[home/appliances]]');
  });

  it('turns back a repeat that is only reworded', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const first = fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8');

    // One word different, which is what the exact-string check let through every night.
    server.reply({
      observations: [
        {
          pattern: 'Household appliances are serviced roughly every three weeks.',
          evidence: ['home/appliances', 'home/laundry'],
          confidence: 0.8,
        },
      ],
    });
    const second = await mem.dream({ phase: 'observe' });

    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toBe(first);
    expect(second.observations).toHaveLength(0);
    expect(second.rejected.some((entry) => entry.reason === 'already recorded for this subject')).toBe(true);
  });

  it('refines by appending, and never deletes what is there', async () => {
    // A changed pattern gets a new dated line. A curator that can delete loses things
    // nobody watched it delete.
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });

    server.reply({
      observations: [
        {
          pattern: 'Household appliances are serviced every four months, in rotation.',
          evidence: ['home/laundry', 'home/kitchen'],
        },
      ],
    });
    const report = await mem.dream({ phase: 'observe' });
    expect(report.observations[0]!.action).toBe('refined');

    const page = fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8');
    expect(page).toContain(PATTERN);
    expect(page).toContain('every four months');
    expect(page.match(/^- \d{4}-\d{2}-\d{2} —/gm)).toHaveLength(2);
  });

  it('never uses a reference page as evidence', async () => {
    // A reference page is somebody else's words. A pattern inferred from a manual is
    // exactly the failure this tier must not have.
    server.facts({
      ...SERVICING,
      'notes/manual': [
        {
          claim: 'Service the appliance every 6 months.',
          subject: 'appliance servicing',
          attribute: 'serviced',
          value: '6 months',
        },
      ],
    });
    await mem.index({ rederive: true });

    server.reply({
      observations: [
        {
          pattern: 'Appliances are serviced quarterly by the household.',
          evidence: ['notes/manual', 'home/laundry'],
        },
      ],
    });

    const report = await mem.dream({ phase: 'observe' });
    // The manual's fact is not in the input, so citing it leaves one usable page — below the
    // floor, and refused with the reason.
    expect(report.observations).toEqual([]);
    expect(report.rejected[0]?.reason).toMatch(/usable source page/);
  });

  it('never feeds an observation back into itself', async () => {
    // An observation is not admissible evidence for another observation. No cascades.
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });

    // The page exists and is indexed now, with a summary and a fact of its own — a derived
    // page is still a page.
    server.facts({
      ...SERVICING,
      'observations/home-appliance-servicing': [
        {
          claim: PATTERN,
          subject: 'appliance servicing',
          attribute: 'serviced',
          value: 'three months',
        },
      ],
    });
    await mem.index({ rederive: true });

    server.reply({ observations: [] });
    await mem.dream({ phase: 'observe' });

    const shown = server.lastObserveInput();
    expect(shown).toContain('home/appliances');
    expect(shown).not.toContain('observations/home-appliance-servicing');
  });

  it('undoes a whole run as one change', async () => {
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe' });
    expect(report.changeId).toBeTruthy();

    await mem.undo({ change_id: report.changeId! });
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });

  it('writes nothing on a dry run', async () => {
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe', dryRun: true });
    expect(report.observations[0]!.action).toBe('created');
    expect(report.changeId).toBeNull();
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });
});

describe('the thorough conflict pass', () => {
  /** Two `full` pages stating a different interval for the same thing. */
  const DISAGREEING = {
    'home/appliances': [
      {
        claim: 'Appliances are serviced every 3 months.',
        subject: 'service interval',
        attribute: 'interval',
        value: '3 months',
      },
    ],
    'home/kitchen': [
      {
        claim: 'Appliances are serviced every 6 months.',
        subject: 'service interval',
        attribute: 'interval',
        value: '6 months',
      },
    ],
  };

  it('finds two pages that disagree, and reports rather than repairs', async () => {
    // What inline checking cannot see: neither page is being written, so nothing compares them.
    server.facts(DISAGREEING);
    await mem.index({ rederive: true });

    server.conflict({
      outcome: 'superseded',
      current: 'home/kitchen',
      reason: 'One claim explicitly identifies the current interval.',
    });
    const report = await mem.dream({ phase: 'conflicts' });

    expect(report.conflicts).toHaveLength(1);
    const conflict = report.conflicts[0]!;
    // Neither fixture says current/as-of, so the deterministic temporal guard downgrades the
    // model's preference instead of rewriting on confidence alone.
    expect(conflict.verdict).toBe('unresolved');
    expect(conflict.likelyCurrent).toBeUndefined();
    expect(conflict.claims.map((claim) => claim.slug).sort()).toEqual(['home/appliances', 'home/kitchen']);
    // Reported, never repaired: both pages are exactly as they were.
    expect(fs.readFileSync(path.join(root, 'home/kitchen.md'), 'utf8')).toBe(PAGES['home/kitchen.md']);
  });

  it('believes the model when it says two claims do not conflict', async () => {
    server.facts(DISAGREEING);
    await mem.index({ rederive: true });

    server.conflict({
      outcome: 'not_a_conflict',
      current: null,
      reason: 'The scopes differ.',
    });
    const report = await mem.dream({ phase: 'conflicts' });
    expect(report.conflicts[0]!.verdict).toBe('not_a_conflict');
  });

  it('caches a typed verdict for unchanged claim bytes', async () => {
    server.facts(DISAGREEING);
    await mem.index({ rederive: true });
    server.conflict({
      outcome: 'unresolved',
      current: null,
      reason: 'The supplied text has no temporal ordering.',
    });

    await mem.dream({ phase: 'conflicts' });
    await mem.dream({ phase: 'conflicts' });

    expect(server.conflictCalls()).toBe(1);
  });

  it('inspects before observe and excludes unresolved claims from inference', async () => {
    server.facts(DISAGREEING);
    await mem.index({ rederive: true });
    server.conflict({
      outcome: 'unresolved',
      current: null,
      reason: 'The supplied text does not establish chronology.',
    });
    server.reply({
      observations: [
        {
          pattern: 'Appliances follow one stable service interval.',
          evidence: ['home/appliances', 'home/kitchen'],
          confidence: 0.9,
        },
      ],
    });

    const report = await mem.dream({ phase: 'observe' });

    expect(report.conflicts[0]?.verdict).toBe('unresolved');
    expect(report.observations).toEqual([]);
    expect(fs.existsSync(path.join(root, 'observations/home-service-interval.md'))).toBe(false);
  });

  it('plans, curates, verifies, converges, and undoes an explicit supersession', async () => {
    await mem.close();
    const oldPage = path.join(root, 'products/zephyr-old.md');
    const currentPage = path.join(root, 'products/zephyr-current.md');
    fs.mkdirSync(path.dirname(oldPage), { recursive: true });
    fs.writeFileSync(
      oldPage,
      `---
title: Zephyr QX-100 old warranty
akno:
  management:
    dream: synthesize
---

# Zephyr QX-100 old warranty

The Zephyr QX-100 warranty is 1111 days.
`,
    );
    fs.writeFileSync(
      currentPage,
      `---
title: Zephyr QX-100 current warranty
akno:
  management:
    dream: synthesize
---

# Zephyr QX-100 current warranty

As of 2002-02-02, the Zephyr QX-100 warranty is 2222 days.
`,
    );
    server.facts({
      'products/zephyr-old': [
        {
          claim: 'The Zephyr QX-100 warranty is 1111 days.',
          subject: 'Zephyr QX-100 warranty',
          attribute: 'duration',
          value: '1111 days',
        },
      ],
      'products/zephyr-current': [
        {
          claim: 'As of 2002-02-02, the Zephyr QX-100 warranty is 2222 days.',
          subject: 'Zephyr QX-100 warranty',
          attribute: 'duration',
          value: '2222 days',
        },
      ],
    });
    server.conflict({
      outcome: 'superseded',
      current: 'products/zephyr-current',
      reason: 'One claim contains an explicit as-of date.',
    });
    mem = await openMem({
      maintenance: {
        observe: { enabled: false },
        curate: { enabled: true, mode: 'auto', verify: true },
      },
    });
    await mem.index({ rederive: true });

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(report.conflicts[0]).toMatchObject({
      verdict: 'superseded',
      likelyCurrent: 'products/zephyr-current',
    });
    expect(item).toMatchObject({
      kind: 'contradiction',
      risk: 'high',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(item.operations).toHaveLength(2);
    expect(fs.readFileSync(oldPage, 'utf8')).toContain(
      'Before 2002-02-02, the Zephyr QX-100 warranty was 1111 days.',
    );
    expect(fs.readFileSync(currentPage, 'utf8')).toContain(
      'As of 2002-02-02, the Zephyr QX-100 warranty is 2222 days.',
    );

    const after = fs.readFileSync(oldPage, 'utf8');
    const repeated = await mem.dream({ phase: 'curate' });
    expect(repeated.maintenancePlan).toBeNull();
    expect(fs.readFileSync(oldPage, 'utf8')).toBe(after);

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(oldPage, 'utf8')).toContain('The Zephyr QX-100 warranty is 1111 days.');
    expect(fs.readFileSync(oldPage, 'utf8')).not.toContain('Before 2002-02-02,');
  });

  it('qualifies a broad claim only from exact sealed scope evidence', async () => {
    await mem.close();
    const broadPage = path.join(root, 'products/zephyr-broad.md');
    const scopedPage = path.join(root, 'products/zephyr-coverage.md');
    fs.mkdirSync(path.dirname(broadPage), { recursive: true });
    fs.writeFileSync(
      broadPage,
      `---
title: Zephyr QX-100 warranty
akno:
  management:
    dream: synthesize
---

# Zephyr QX-100 warranty

The Zephyr QX-100 warranty duration is 1111 days.
`,
    );
    fs.writeFileSync(
      scopedPage,
      `---
title: Zephyr QX-100 coverage terms
akno:
  management:
    dream: synthesize
---

# Zephyr QX-100 coverage terms

The Zephyr QX-100 warranty duration is 2222 days overall, while standard coverage retains 1111 days.
`,
    );
    server.facts({
      'products/zephyr-broad': [
        {
          claim: 'The Zephyr QX-100 warranty duration is 1111 days.',
          subject: 'Zephyr QX-100 warranty',
          attribute: 'duration',
          value: '1111 days',
        },
      ],
      'products/zephyr-coverage': [
        {
          claim:
            'The Zephyr QX-100 warranty duration is 2222 days overall, while standard coverage retains 1111 days.',
          subject: 'Zephyr QX-100 warranty',
          attribute: 'duration',
          value: '2222 days',
        },
      ],
    });
    server.conflict({
      outcome: 'qualified',
      current: null,
      qualification: {
        target: 'products/zephyr-broad:10',
        evidence: 'products/zephyr-coverage:10',
        scope: 'standard coverage',
      },
      reason: 'A distinct claim explicitly states the narrower scope for the broad value.',
    });
    mem = await openMem({ maintenance: { curate: { enabled: true, mode: 'auto', verify: true } } });
    await mem.index({ rederive: true });

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(report.conflicts[0]).toMatchObject({
      verdict: 'qualified',
      qualification: {
        targetSlug: 'products/zephyr-broad',
        evidenceSlug: 'products/zephyr-coverage',
        scope: 'standard coverage',
      },
    });
    expect(item).toMatchObject({
      kind: 'contradiction',
      risk: 'high',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(item.operations).toHaveLength(2);
    expect(fs.readFileSync(broadPage, 'utf8')).toContain(
      'For standard coverage: The Zephyr QX-100 warranty duration is 1111 days.',
    );
    expect(fs.readFileSync(scopedPage, 'utf8')).toContain('while standard coverage retains 1111 days.');

    const after = fs.readFileSync(broadPage, 'utf8');
    const repeated = await mem.dream({ phase: 'curate' });
    expect(repeated.maintenancePlan).toBeNull();
    expect(fs.readFileSync(broadPage, 'utf8')).toBe(after);

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(broadPage, 'utf8')).toContain('The Zephyr QX-100 warranty duration is 1111 days.');
    expect(fs.readFileSync(broadPage, 'utf8')).not.toContain('For standard coverage:');
  });

  it('downgrades qualification when evidence does not contain the target value', async () => {
    server.facts({
      'home/appliances': [
        {
          claim: 'Appliances are serviced every 3 months.',
          subject: 'service interval',
          attribute: 'interval',
          value: '3 months',
        },
      ],
      'home/kitchen': [
        {
          claim: 'For kitchen use, appliances are serviced every 6 months.',
          subject: 'service interval',
          attribute: 'interval',
          value: '6 months',
        },
      ],
    });
    await mem.index({ rederive: true });
    const candidate = await mem.dream({ phase: 'conflicts' });
    const [target, evidence] = candidate.conflicts[0]!.claims;
    server.conflict({
      outcome: 'qualified',
      current: null,
      qualification: {
        target: `${target!.slug}:${target!.line}`,
        evidence: `${evidence!.slug}:${evidence!.line}`,
        scope: 'kitchen use',
      },
      reason: 'The second claim names a scope.',
    });

    // Change one claim byte so the first unverified/classified cache cannot answer this run.
    server.facts({
      'home/appliances': [
        {
          claim: 'Appliances are routinely serviced every 3 months.',
          subject: 'service interval',
          attribute: 'interval',
          value: '3 months',
        },
      ],
      'home/kitchen': [
        {
          claim: 'For kitchen use, appliances are serviced every 6 months.',
          subject: 'service interval',
          attribute: 'interval',
          value: '6 months',
        },
      ],
    });
    await mem.index({ rederive: true });
    const report = await mem.dream({ phase: 'conflicts' });

    expect(report.conflicts[0]!.verdict).toBe('unresolved');
    expect(report.conflicts[0]!.qualification).toBeUndefined();
  });

  it('represents an unresolved conflict without changing either authored claim', async () => {
    await mem.close();
    for (const relPath of ['home/appliances.md', 'home/kitchen.md']) {
      const absolute = path.join(root, relPath);
      fs.writeFileSync(
        absolute,
        fs
          .readFileSync(absolute, 'utf8')
          .replace('title:', 'akno:\n  management:\n    dream: synthesize\ntitle:'),
      );
    }
    server.facts(DISAGREEING);
    server.conflict({
      outcome: 'unresolved',
      current: null,
      reason: 'No temporal evidence selects one value.',
    });
    mem = await openMem({ maintenance: { curate: { enabled: true, mode: 'auto' } } });
    await mem.index({ rederive: true });
    const before = [
      fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8'),
      fs.readFileSync(path.join(root, 'home/kitchen.md'), 'utf8'),
    ];

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;
    const after = [
      fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8'),
      fs.readFileSync(path.join(root, 'home/kitchen.md'), 'utf8'),
    ];

    expect(item).toMatchObject({ kind: 'contradiction', status: 'applied' });
    expect(after.every((page) => page.includes('[!warning] Unresolved memory conflict'))).toBe(true);
    expect(after[0]).toContain('The dishwasher was repaired in March 2026.');
    expect(after[1]).toContain('The oven was serviced in September 2026.');

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).toBe(before[0]);
    expect(fs.readFileSync(path.join(root, 'home/kitchen.md'), 'utf8')).toBe(before[1]);
  });

  it('ignores a reference page disagreeing with a claim', async () => {
    // A manual disagreeing with the household's notes is not a contradiction in the
    // household's memory.
    server.facts({
      'home/appliances': DISAGREEING['home/appliances'],
      'notes/manual': [
        {
          claim: 'Service the appliance every 6 months.',
          subject: 'service interval',
          attribute: 'interval',
          value: '6 months',
        },
      ],
    });
    await mem.index({ rederive: true });

    const report = await mem.dream({ phase: 'conflicts' });
    expect(report.conflicts).toEqual([]);
  });

  it('does not report one page disagreeing with itself', async () => {
    // That is inline's job, and on one page it is usually a list rather than a contradiction.
    server.facts({
      'home/appliances': [
        ...DISAGREEING['home/appliances'],
        {
          claim: 'The kitchen tap is serviced every 6 months.',
          subject: 'service interval',
          attribute: 'interval',
          value: '6 months',
        },
      ],
    });
    await mem.index({ rederive: true });

    const report = await mem.dream({ phase: 'conflicts' });
    expect(report.conflicts).toEqual([]);
  });
});

describe('housekeeping', () => {
  it('reports broken links, orphaned documents and rule drift', async () => {
    fs.writeFileSync(
      path.join(root, 'home/appliances.md'),
      `${PAGES['home/appliances.md']}\nSee [[home/nowhere]].\n`,
      'utf8',
    );
    fs.writeFileSync(path.join(root, 'stray.pdf'), 'not attached to any page');
    await mem.index({});

    const report = await mem.dream({ phase: 'housekeeping' });
    const house = report.housekeeping!;
    expect(house.brokenLinks.map((link) => link.to)).toContain('home/nowhere');
    expect(house.orphanedDocuments.map((entry) => entry.relPath)).toContain('stray.pdf');
    expect(house.counts.brokenLinks).toBeGreaterThan(0);
  });

  it('reports a page whose type contradicts its folder rule', async () => {
    await mem.close();
    mem = await openMem({ folders: { 'home/**': { type: 'appliance' } } });
    fs.writeFileSync(
      path.join(root, 'home/laundry.md'),
      '---\ntitle: Laundry\ntype: chore\n---\n\n# Laundry\n\nServiced in June.\n',
      'utf8',
    );
    await mem.index({});

    const report = await mem.dream({ phase: 'housekeeping' });
    const drift = report.housekeeping!.drift.find((entry) => entry.slug === 'home/laundry');
    expect(drift?.expected).toBe('type: appliance');
    expect(drift?.found).toBe('type: chore');
  });
});

describe('the cycle', () => {
  it('runs every enabled phase, and says why the others did not', async () => {
    server.reply({ observations: [] });
    const report = await mem.dream({});

    const byPhase = new Map(report.phases.map((phase) => [phase.phase, phase]));
    expect(byPhase.get('observe')?.ran).toBe(true);
    expect(byPhase.get('conflicts')?.ran).toBe(true);
    expect(byPhase.get('housekeeping')?.ran).toBe(true);
    // Reflect ships off by default, and a skipped phase says so rather than looking like
    // a phase that found nothing.
    expect(byPhase.get('reflect')?.ran).toBe(false);
    expect(byPhase.get('reflect')?.skipped).toMatch(/off by default/);
  });

  it('says which phase could not run when the cycle has no model', async () => {
    await mem.close();
    mem = await openMem({ providers: {}, models: { derive: { id: null } } });

    const report = await mem.dream({});
    const observe = report.phases.find((phase) => phase.phase === 'observe');
    expect(observe?.ran).toBe(false);
    expect(observe?.skipped).toMatch(/no model for the cycle/);
    // The phases that need no model still run: degrade, never fail.
    expect(report.phases.find((phase) => phase.phase === 'housekeeping')?.ran).toBe(true);
  });

  it('refuses to write from a read-only handle, but will still report', async () => {
    const second = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      writable: false,
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
      },
    });
    try {
      await expect(second.dream({})).rejects.toThrow(/write handle/);
      server.reply({ observations: [] });
      await expect(second.dream({ dryRun: true })).resolves.toBeTruthy();
    } finally {
      await second.close();
    }
  });
});

describe('observe when a knowledge base has not asked for it', () => {
  it('is off, and says so rather than looking like a quiet night', async () => {
    // Off by default from measurement: on a real base with a small model, most of what it
    // produced was not worth keeping, and all of it would have been recalled later as truth.
    await mem.close();
    mem = await openMem({ maintenance: { observe: { enabled: false } } });

    const report = await mem.dream({ phase: 'observe' });
    expect(report.phases[0]!.ran).toBe(false);
    expect(report.phases[0]!.skipped).toMatch(/disabled/);
    expect(report.observations).toEqual([]);
  });
});

/**
 * An attachment nobody's page points at is extracted like any other and then has nowhere
 * to be returned from, because recall returns page cards. `adopt` gives it the page `ingest`
 * would have given it — an orphan is an arrival nobody ran `ingest` on.
 */
describe('adopt', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.writeFileSync(path.join(root, 'household/lease scan.txt'), 'The lease runs to August 2027.\n');
  });

  it('writes a page beside the file, and the document becomes searchable', async () => {
    await mem.index({});
    expect((await mem.doctor({ probeModels: false })).counts.documentsUnsearchable).toBe(1);

    const report = await mem.dream({ phase: 'adopt' });
    expect(report.adopted).toHaveLength(1);
    expect(report.adopted[0]!.action).toBe('created');
    expect(report.adopted[0]!.slug).toBe('household/lease-scan');

    const page = fs.readFileSync(path.join(root, 'household/lease-scan.md'), 'utf8');
    // The title comes from the filename, tidied — nothing invented about a file Akno was not
    // asked to name. The embed is what makes the ownership hold on the next pass.
    expect(page).toContain('title: Lease scan');
    expect(page).toContain('![[lease scan.txt]]');
    // The file itself is untouched: only the inbox moves files, ever.
    expect(fs.existsSync(path.join(root, 'household/lease scan.txt'))).toBe(true);

    // The point of the phase, not just that a page appeared.
    expect((await mem.doctor({ probeModels: false })).counts.documentsUnsearchable).toBe(0);
    const found = await mem.recall({ query: 'lease runs to August 2027', mode: 'lookup' });
    const card = found.cards.find((entry) => entry.slug === 'household/lease-scan');
    expect(card?.documents?.[0]?.quote).toContain('August 2027');
  });

  it('gives the parts of one document a single page', async () => {
    fs.writeFileSync(path.join(root, 'household/permit.txt'), 'Permit page one.\n');
    fs.writeFileSync(path.join(root, 'household/permit-2.txt'), 'Permit page two.\n');
    await mem.index({});

    const report = await mem.dream({ phase: 'adopt' });
    const permit = report.adopted.find((entry) => entry.slug === 'household/permit');
    expect(permit?.files).toEqual(['household/permit.txt', 'household/permit-2.txt']);

    const page = fs.readFileSync(path.join(root, 'household/permit.md'), 'utf8');
    expect(page).toContain('![[permit.txt]]');
    expect(page).toContain('![[permit-2.txt]]');
  });

  it('honours the rule that says this folder wants no pages', async () => {
    // `ingest: "file"` exists for a folder of media where a stub page per file would be noise
    // rather than memory, and this is the behaviour it turns off.
    await mem.close();
    mem = await openMem({ folders: { 'household/**': { ingest: 'file' } } });
    await mem.index({});

    const report = await mem.dream({ phase: 'adopt' });
    expect(report.adopted[0]!.action).toBe('skipped');
    expect(report.adopted[0]!.reason).toMatch(/ingest: file/);
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
  });

  it('leaves someone else’s page alone when one is already there', async () => {
    fs.writeFileSync(path.join(root, 'household/lease-scan.md'), '# Notes\n\nMy own page.\n', 'utf8');
    await mem.index({});

    const report = await mem.dream({ phase: 'adopt' });
    expect(report.adopted[0]!.action).toBe('skipped');
    expect(report.adopted[0]!.reason).toMatch(/already exists/);
    expect(fs.readFileSync(path.join(root, 'household/lease-scan.md'), 'utf8')).toContain('My own page.');
  });

  it('caps how many it writes in one run', async () => {
    // A folder of 500 unowned files should not become 500 pages before anyone has read the
    // first report.
    for (let i = 0; i < 4; i++) {
      fs.writeFileSync(path.join(root, `household/scan-${i}.txt`), `Scan number ${i}.\n`);
    }
    await mem.close();
    mem = await openMem({ maintenance: { adopt: { max_pages: 2 } } });
    await mem.index({});

    const report = await mem.dream({ phase: 'adopt' });
    expect(report.adopted.filter((entry) => entry.action === 'created')).toHaveLength(2);
  });

  it('writes nothing on a dry run', async () => {
    await mem.index({});
    const report = await mem.dream({ phase: 'adopt', dryRun: true });
    expect(report.adopted[0]!.action).toBe('created');
    expect(report.adoptChangeId).toBeNull();
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
  });

  it('is undone as its own change, apart from a night’s observations', async () => {
    await mem.index({});
    const report = await mem.dream({ phase: 'adopt' });
    await mem.undo({ change_id: report.adoptChangeId! });
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'household/lease scan.txt'))).toBe(true);
  });
});

/**
 * The run log is off unless a knowledge base asks for it, and what it is *for* is the part the
 * journal cannot answer: not "a page appeared", but which pattern a guard refused and why.
 */
describe('the run log', () => {
  it('writes nothing at all by default', async () => {
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe' });
    expect(report.observations).toHaveLength(1);
    expect(report.logPath).toBeUndefined();
    expect(fs.existsSync(path.join(stateDir, 'logs/dream.jsonl'))).toBe(false);
  });

  it('records what it applied, and what a guardrail refused', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { observe: { enabled: true }, log_changes: true } });
    await mem.index({});

    // One admissible observation and one the hedge guard must refuse, so the record has to
    // carry both halves — a log that only shows the writes explains nothing.
    server.reply({
      observations: [
        { pattern: PATTERN, evidence: ['home/appliances', 'home/laundry'], confidence: 0.8 },
        {
          pattern: 'The household might perhaps prefer weekends.',
          evidence: ['home/appliances', 'home/laundry'],
          confidence: 0.7,
        },
      ],
    });

    const report = await mem.dream({ phase: 'observe' });
    expect(report.logPath).toBe(path.join(stateDir, 'logs/dream.jsonl'));

    const lines = fs.readFileSync(report.logPath!, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]!);

    expect(record.applied).toHaveLength(1);
    expect(record.applied[0].phase).toBe('observe');
    expect(record.applied[0].relPath).toMatch(/^observations\//);
    // The lines the write added, so the record shows the text without a second lookup.
    expect(record.applied[0].added.join('\n')).toContain(PATTERN);
    expect(record.changeIds).toEqual([report.changeId]);
    expect(record.rejected.map((entry: { reason: string }) => entry.reason)).toContain('hedged language');
    expect(record.dryRun).toBe(false);

    // A second run appends rather than replacing: the point is the history.
    await mem.dream({ phase: 'observe' });
    expect(fs.readFileSync(report.logPath!, 'utf8').trim().split('\n')).toHaveLength(2);
  });

  it('records a dry run as one, so a review of what *would* happen is possible', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { observe: { enabled: true }, log_changes: true } });
    await mem.index({});
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe', dryRun: true });
    const record = JSON.parse(fs.readFileSync(report.logPath!, 'utf8').trim());
    expect(record.dryRun).toBe(true);
    expect(record.applied).toEqual([]);
    expect(record.observations[0].pattern).toBe(PATTERN);
  });
});
