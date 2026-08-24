import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { SCHEMA_VERSION } from '../src/store/migrations.ts';

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
  reflection: (value: unknown) => void;
  conflict: (value: unknown) => void;
  conflictCalls: () => number;
  /** Facts the deriver returns for a page, so real facts land on real lines. */
  facts: (byslug: Record<string, DerivedFact[]>) => void;
  /** The last body the observe mission was given, for asserting what it was shown. */
  lastObserveInput: () => string;
  requestKinds: () => ('observe' | 'reflect' | 'curator')[];
  onCurator: (hook: () => void) => void;
  onReflect: (hook: () => void) => void;
}

/**
 * One stub for three different callers — the deriver, the observe mission, the conflict
 * verifier — routed on what each one asks. Facts go through the real derivation path rather
 * than being inserted behind it, so these tests exercise the same rows `observe` reads in
 * production.
 */
async function startStubChat(): Promise<StubServer> {
  let scripted: unknown = {};
  let reflectionScripted: unknown | null = null;
  let conflictScripted: unknown = {
    outcome: 'not_a_conflict',
    current: null,
    qualification: null,
    reason: 'The fixtures describe different appliances.',
  };
  let classified = 0;
  let byPage: Record<string, DerivedFact[]> = {};
  let lastObserve = '';
  const requestKinds: ('observe' | 'reflect' | 'curator')[] = [];
  let curatorHook: (() => void) | null = null;
  let reflectHook: (() => void) | null = null;

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
      const observeRequest = system.startsWith(
        'You look for stable patterns across facts already recorded in a personal knowledge base.',
      );
      if (observeRequest) {
        const kind = user.startsWith('Subject: decision principles') ? 'reflect' : 'observe';
        requestKinds.push(kind);
        if (kind === 'reflect') reflectHook?.();
        lastObserve = user;
      } else if (system.startsWith('You are the independent curator for an autonomous memory system')) {
        requestKinds.push('curator');
        curatorHook?.();
      }
      const answer = user.startsWith('Page: ')
        ? derive(user, byPage)
        : system.startsWith('You classify structurally incompatible claims')
          ? conflictScripted
          : system.startsWith('You are the independent curator for an autonomous memory system')
            ? {
                outcome: 'approve',
                reason: 'The sealed contradiction item preserves authored knowledge.',
              }
            : system.startsWith('A personal knowledge base holds two claims')
              ? { line: 'Before 2002-02-02, the Zephyr QX-100 warranty was 1111 days.' }
              : observeRequest &&
                  user.startsWith('Subject: decision principles') &&
                  reflectionScripted !== null
                ? reflectionScripted
                : scripted;

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(answer) } }],
          usage: { prompt_tokens: 111, completion_tokens: 22, total_tokens: 133 },
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
    reply: (value) => {
      scripted = value;
    },
    reflection: (value) => {
      reflectionScripted = value;
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
    requestKinds: () => [...requestKinds],
    onCurator: (hook) => {
      curatorHook = hook;
    },
    onReflect: (hook) => {
      reflectHook = hook;
    },
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
  const requestedMaintenance =
    overrides.maintenance && typeof overrides.maintenance === 'object'
      ? (overrides.maintenance as Record<string, unknown>)
      : null;
  const legacyFixturePolicies = {
    observe: 'auto',
    reflect: 'auto',
    hygiene: 'off',
    synthesis: 'off',
    split: 'off',
    extract: 'off',
    merge: 'off',
    contradiction: 'off',
    broken_link: 'off',
    adopt: 'auto',
  } as const;
  const maintenance = requestedMaintenance?.profile
    ? requestedMaintenance
    : {
        profile: 'autonomous',
        ...requestedMaintenance,
        policies: {
          ...legacyFixturePolicies,
          ...(requestedMaintenance?.policies as Record<string, unknown> | undefined),
        },
        observe: {
          enabled: true,
          ...(requestedMaintenance?.observe as Record<string, unknown> | undefined),
        },
      };
  const { maintenance: _maintenance, ...otherOverrides } = overrides;
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
      maintenance,
      ...otherOverrides,
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
  const PRINCIPLE = 'Recurring activities are managed through explicit structures.';
  const REFLECTED = {
    observations: [
      {
        pattern: PRINCIPLE,
        evidence: [
          'observations/travel-lunch',
          'observations/banking-review-period',
          'observations/home-servicing',
        ],
        confidence: 0.9,
      },
    ],
  };

  /**
   * The tier reads the folder it writes into, which is how `principles` came to list itself as its
   * own evidence on a real knowledge base. A conclusion offered as its own support reads, later, as
   * a conclusion with support.
   */
  async function withTwoObservations(maintenance: Record<string, unknown> = {}): Promise<Akno> {
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
    mem = await openMem({
      maintenance: { observe: { enabled: true }, reflect: { enabled: true }, ...maintenance },
    });
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

  it('seals an exact reflection audit plan without writing or deciding', async () => {
    await withTwoObservations({ profile: 'autonomous' });
    server.reply(REFLECTED);

    const report = await mem.dream({ phase: 'reflect', mode: 'audit' });

    expect(report.observations[0]).toMatchObject({ action: 'would-create', pattern: PRINCIPLE });
    expect(report.maintenancePlan).toMatchObject({ phase: 'reflect', mode: 'audit', status: 'ready' });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      kind: 'reflect',
      policy: 'audit',
      status: 'proposed',
      decision: null,
    });
    expect(mem.maintenanceDiff(report.maintenancePlan!.id)).toContain(PRINCIPLE);
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);
  });

  it('seals reflection for human review and applies an approved principle', async () => {
    await withTwoObservations({ profile: 'review' });
    server.reply(REFLECTED);

    const report = await mem.dream({ phase: 'reflect' });

    expect(report.maintenancePlan).toMatchObject({ phase: 'reflect', status: 'awaiting_review' });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      kind: 'reflect',
      policy: 'review',
      status: 'proposed',
    });
    expect(mem.maintenanceStatus().authority).toMatchObject({ reflect: 'review' });
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);

    const item = report.maintenancePlan!.items[0]!;
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'approve', 'The invented principle is useful.');
    const applied = await mem.applyPlan(report.maintenancePlan!.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'applied', verification: { status: 'passed' } });
    expect(fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8')).toContain(PRINCIPLE);
  });

  it('does not resubmit an unchanged rejected principle', async () => {
    await withTwoObservations({ profile: 'review' });
    server.reply(REFLECTED);

    const first = await mem.dream({ phase: 'reflect' });
    const item = first.maintenancePlan!.items[0]!;
    mem.decidePlan(first.maintenancePlan!.id, item.id, 'reject', 'This invented principle is too broad.');

    const repeated = await mem.dream({ phase: 'reflect' });

    expect(repeated.maintenancePlan).toBeNull();
    expect(repeated.observations[0]).toMatchObject({ action: 'rejected', pattern: PRINCIPLE });
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);
  });

  it('refuses an approved reflection after sealed observation evidence changes', async () => {
    await withTwoObservations({ profile: 'review' });
    server.reply(REFLECTED);

    const report = await mem.dream({ phase: 'reflect' });
    const item = report.maintenancePlan!.items[0]!;
    fs.appendFileSync(
      path.join(root, 'observations/travel-lunch.md'),
      '\n- 2026-08-09 — Lunch plans now use an invented rotating schedule.\n',
    );
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'approve', 'Approved before evidence changed.');

    const applied = await mem.applyPlan(report.maintenancePlan!.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);
  });

  it('uses a separate curator and shared budget for autonomous reflection', async () => {
    await withTwoObservations({ profile: 'autonomous' });
    server.reply(REFLECTED);

    const report = await mem.dream({ phase: 'reflect' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(report.observations[0]).toMatchObject({ action: 'created', pattern: PRINCIPLE });
    expect(item).toMatchObject({
      kind: 'reflect',
      policy: 'auto',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(report.budget.used).toMatchObject({ items: 1, filesChanged: 1, highRiskItems: 0 });
    expect(fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8')).toContain(PRINCIPLE);
  });

  it('defers an approved autonomous reflection when its shared run budget is exhausted', async () => {
    await withTwoObservations({ profile: 'autonomous', limits: { max_items: 0 } });
    server.reply(REFLECTED);

    const report = await mem.dream({ phase: 'reflect' });

    expect(report.run).toMatchObject({
      status: 'partially_completed',
      budget: { used: { items: 0, filesChanged: 0 }, deferredItems: 1 },
    });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      kind: 'reflect',
      status: 'proposed',
      statusCode: 'budget_exhausted',
      decision: null,
    });
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);
  });
});

describe('the full-run planning barrier', () => {
  async function withInferencePolicies(
    limits?: { max_items: number },
    seedObserveTarget = false,
  ): Promise<void> {
    await mem.close();
    fs.mkdirSync(path.join(root, 'observations'), { recursive: true });
    for (const [name, body] of [
      ['travel-lunch', 'Travel itineraries treat lunch as a scheduled part of the day.'],
      ['banking-review-period', 'Banking review periods cover the full calendar month.'],
      ['home-servicing', 'Household appliances are serviced on a regular cadence.'],
      ...(seedObserveTarget
        ? ([
            ['home-appliance-servicing', 'Household maintenance is recorded after each completed service.'],
          ] as const)
        : []),
    ] as const) {
      fs.writeFileSync(
        path.join(root, `observations/${name}.md`),
        `---\ntitle: ${name}\nderived: true\n---\n\n- 2026-08-08 — ${body}\n`,
        'utf8',
      );
    }
    mem = await openMem({
      maintenance: {
        profile: 'autonomous',
        policies: {
          observe: 'auto',
          reflect: 'auto',
          hygiene: 'off',
          synthesis: 'off',
          split: 'off',
          extract: 'off',
          merge: 'off',
          contradiction: 'off',
          broken_link: 'off',
          adopt: 'off',
        },
        observe: { enabled: true },
        reflect: { enabled: true },
        ...(limits ? { limits } : {}),
        conflicts: { enabled: false },
      },
    });
    await mem.index({});
  }

  it('seals every inference plan before the first curator decision or write', async () => {
    await withInferencePolicies();
    const principle = 'Recurring activities are managed through explicit structures.';
    server.reply(OBSERVED);
    server.reflection({
      observations: [
        {
          pattern: principle,
          evidence: [
            'observations/travel-lunch',
            'observations/banking-review-period',
            'observations/home-servicing',
          ],
          confidence: 0.9,
        },
      ],
    });

    const report = await mem.dream();

    expect(server.requestKinds()).toEqual(['observe', 'reflect', 'curator', 'curator']);
    expect(report.maintenancePlans.map((plan) => plan.phase)).toEqual(['observe', 'reflect']);
    expect(report.maintenancePlans.every((plan) => plan.status === 'completed')).toBe(true);
    expect(report.maintenancePlans.flatMap((plan) => plan.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'observe', status: 'applied' }),
        expect.objectContaining({ kind: 'reflect', status: 'applied' }),
      ]),
    );
    expect(report.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern: PATTERN, action: 'created' }),
        expect.objectContaining({ pattern: principle, action: 'created' }),
      ]),
    );
    expect(report.budget.used).toMatchObject({ items: 2, filesChanged: 2, highRiskItems: 0 });
    expect(fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8')).toContain(principle);
  });

  it('resumes a plan deferred by the shared post-planning budget without replanning it', async () => {
    await withInferencePolicies({ max_items: 1 });
    const principle = 'Recurring activities are managed through explicit structures.';
    server.reply(OBSERVED);
    server.reflection({
      observations: [
        {
          pattern: principle,
          evidence: [
            'observations/travel-lunch',
            'observations/banking-review-period',
            'observations/home-servicing',
          ],
          confidence: 0.9,
        },
      ],
    });

    const first = await mem.dream();
    const reflection = first.maintenancePlans.find((plan) => plan.phase === 'reflect')!;

    expect(first.run).toMatchObject({
      status: 'partially_completed',
      budget: { used: { items: 1 }, deferredItems: 1 },
    });
    expect(reflection.items[0]).toMatchObject({
      status: 'proposed',
      statusCode: 'budget_exhausted',
      decision: null,
    });
    expect(server.requestKinds()).toEqual(['observe', 'reflect', 'curator', 'curator']);
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);

    const beforeSecond = server.requestKinds().length;
    server.reply({ observations: [] });
    const second = await mem.dream();
    const resumed = second.maintenancePlans.find((plan) => plan.id === reflection.id)!;

    expect(server.requestKinds().slice(beforeSecond)).toEqual(['observe', 'curator']);
    expect(resumed.items[0]).toMatchObject({ status: 'applied', statusCode: null });
    expect(second.run.budget).toMatchObject({ used: { items: 1 }, deferredItems: 0 });
    expect(fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8')).toContain(principle);
  });

  it('replans a dependency-deferred phase once from the post-apply index', async () => {
    await withInferencePolicies(undefined, true);
    const principle = 'Maintenance records support deliberate household planning.';
    server.reply(OBSERVED);
    server.reflection({
      observations: [
        {
          pattern: principle,
          evidence: [
            'observations/home-appliance-servicing',
            'observations/travel-lunch',
            'observations/banking-review-period',
          ],
          confidence: 0.9,
        },
      ],
    });

    const report = await mem.dream();
    const reflections = report.maintenancePlans.filter((plan) => plan.phase === 'reflect');
    const [deferred, replanned] = reflections;

    expect(server.requestKinds()).toEqual(['observe', 'reflect', 'curator', 'reflect', 'curator']);
    expect(report.run.status).toBe('completed');
    expect(reflections).toHaveLength(2);
    expect(deferred).toMatchObject({ status: 'superseded' });
    expect(deferred!.items[0]).toMatchObject({
      status: 'blocked',
      statusCode: 'dependency_conflict',
      decision: null,
    });
    expect(deferred!.items[0]!.statusReason).not.toContain('observations/');
    expect(replanned!.id).not.toBe(deferred!.id);
    expect(replanned).toMatchObject({ status: 'completed' });
    expect(replanned!.items[0]).toMatchObject({ status: 'applied', statusCode: null });
    expect(report.budget.used).toMatchObject({ items: 2, filesChanged: 2 });
    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toContain(
      PATTERN,
    );
    expect(fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8')).toContain(principle);
  });

  it('keeps a same-run dependency retry within the shared budget and resumes it later', async () => {
    await withInferencePolicies({ max_items: 1 }, true);
    const principle = 'Maintenance records support deliberate household planning.';
    server.reply(OBSERVED);
    server.reflection({
      observations: [
        {
          pattern: principle,
          evidence: [
            'observations/home-appliance-servicing',
            'observations/travel-lunch',
            'observations/banking-review-period',
          ],
          confidence: 0.9,
        },
      ],
    });

    const first = await mem.dream();
    const reflections = first.maintenancePlans.filter((plan) => plan.phase === 'reflect');
    const retry = reflections[1]!;

    expect(reflections[0]).toMatchObject({ status: 'superseded' });
    expect(retry.items[0]).toMatchObject({
      status: 'proposed',
      statusCode: 'budget_exhausted',
      decision: null,
    });
    expect(first.run).toMatchObject({
      status: 'partially_completed',
      budget: { used: { items: 1 }, deferredItems: 1 },
    });
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);

    const beforeSecond = server.requestKinds().length;
    server.reply({ observations: [] });
    const second = await mem.dream();
    const resumed = second.maintenancePlans.find((plan) => plan.id === retry.id)!;

    expect(resumed.items[0]).toMatchObject({ status: 'applied', statusCode: null });
    expect(server.requestKinds().slice(beforeSecond)).toEqual(['observe', 'curator']);
    expect(fs.readFileSync(path.join(root, 'observations/principles.md'), 'utf8')).toContain(principle);
  });

  it('rechecks a sealed operation input before the first curator call and replans next run', async () => {
    await withInferencePolicies(undefined, true);
    server.reply(OBSERVED);
    server.reflection({ observations: [] });
    let changed = false;
    server.onReflect(() => {
      if (changed) return;
      changed = true;
      fs.appendFileSync(
        path.join(root, 'observations/home-appliance-servicing.md'),
        '\n- 2026-08-10 — An invented external process changed this page during planning.\n',
      );
    });

    const first = await mem.dream();
    const observation = first.maintenancePlans.find((plan) => plan.phase === 'observe')!;

    expect(server.requestKinds()).toEqual(['observe', 'reflect']);
    expect(first.run.status).toBe('partially_completed');
    expect(observation.status).toBe('failed');
    expect(observation.items[0]).toMatchObject({
      status: 'stale',
      statusCode: 'snapshot_drift',
      decision: null,
    });
    expect(observation.items[0]!.statusReason).not.toContain('observations/');
    const afterFirst = fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8');
    expect(afterFirst).toContain('invented external process');
    expect(afterFirst).not.toContain(PATTERN);

    const beforeSecond = server.requestKinds().length;
    const second = await mem.dream();
    const replanned = second.maintenancePlans.find((plan) => plan.phase === 'observe')!;

    expect(replanned.id).not.toBe(observation.id);
    expect(replanned.items[0]).toMatchObject({ status: 'applied', statusCode: null });
    expect(server.requestKinds().slice(beforeSecond)).toEqual(['observe', 'reflect', 'curator']);
    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toContain(
      PATTERN,
    );
  });

  it('rechecks sealed inference evidence before the first curator call', async () => {
    await withInferencePolicies();
    server.reply(OBSERVED);
    server.reflection({ observations: [] });
    server.onReflect(() => {
      fs.appendFileSync(
        path.join(root, 'home/appliances.md'),
        '\nAn invented external note arrived during planning.\n',
      );
    });

    const report = await mem.dream();
    const observation = report.maintenancePlans.find((plan) => plan.phase === 'observe')!;

    expect(server.requestKinds()).toEqual(['observe', 'reflect']);
    expect(report.run.status).toBe('partially_completed');
    expect(observation.items[0]).toMatchObject({
      status: 'stale',
      statusCode: 'snapshot_drift',
      decision: null,
    });
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });
});

describe('repair', () => {
  async function withBrokenLinks(
    mode: 'audit' | 'auto' = 'auto',
    limits?: {
      max_items?: number;
      max_files_changed?: number;
      max_bytes_written?: number;
      max_high_risk_items?: number;
    },
  ): Promise<void> {
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
        profile: 'autonomous',
        policies: {
          observe: 'off',
          reflect: 'off',
          hygiene: mode,
          synthesis: mode,
          split: mode,
          extract: mode,
          merge: mode,
          contradiction: mode,
          broken_link: mode,
          adopt: 'auto',
        },
        ...(limits ? { limits } : {}),
        observe: { enabled: false },
        curate: { verify: true },
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
    expect(page).toContain('[the boiler](./heating/furnace.md)');
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
        profile: 'audit',
        observe: { enabled: false },
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

  it('reports both curate and adopt plans from one full run', async () => {
    await withBrokenLinks('audit');
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'household/coverage note.txt'),
      'Vulpine Mutual coverage renews in 2031.\n',
    );
    await mem.index({});

    const report = await mem.dream({});

    expect(report.maintenancePlans.map((plan) => plan.phase)).toEqual(['curate', 'adopt']);
    expect(report.run.maintenancePlanIds).toEqual(report.maintenancePlans.map((plan) => plan.id));
    expect(report.maintenancePlan?.phase).toBe('adopt');
    expect(report.adopted).toContainEqual(
      expect.objectContaining({ slug: 'household/coverage-note', action: 'created' }),
    );
  });

  it('seals curation and adoption before their first full-run curator call', async () => {
    await withBrokenLinks();
    await mem.close();
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'household/vulpine note.txt'),
      'Vulpine Mutual coverage is an invented fixture.\n',
    );
    mem = await openMem({
      maintenance: {
        profile: 'autonomous',
        policies: {
          observe: 'off',
          reflect: 'off',
          hygiene: 'off',
          synthesis: 'off',
          split: 'off',
          extract: 'off',
          merge: 'off',
          contradiction: 'off',
          broken_link: 'auto',
          adopt: 'auto',
        },
        observe: { enabled: false },
        reflect: { enabled: false },
        curate: { verify: true },
        repair: { enabled: true, links: true },
        conflicts: { enabled: false },
      },
    });
    await mem.index({});

    const curatorSnapshots: { phases: string[]; sourceUnchanged: boolean; adoptionAbsent: boolean }[] = [];
    server.onCurator(() => {
      curatorSnapshots.push({
        phases: mem.plans().map((plan) => plan.phase),
        sourceUnchanged: fs
          .readFileSync(path.join(root, 'home/appliances.md'), 'utf8')
          .includes('[[Boiler|heating notes]]'),
        adoptionAbsent: !fs.existsSync(path.join(root, 'household/vulpine-note.md')),
      });
    });

    const report = await mem.dream();

    expect(curatorSnapshots[0]).toMatchObject({
      phases: expect.arrayContaining(['curate', 'adopt']),
      sourceUnchanged: true,
      adoptionAbsent: true,
    });
    expect(report.maintenancePlans.map((plan) => plan.phase)).toEqual(['curate', 'adopt']);
    expect(
      report.maintenancePlans.flatMap((plan) => plan.items).every((item) => item.status === 'applied'),
    ).toBe(true);
    expect(fs.readFileSync(path.join(root, 'home/appliances.md'), 'utf8')).toContain(
      '[[home/heating/furnace|heating notes]]',
    );
    expect(fs.existsSync(path.join(root, 'household/vulpine-note.md'))).toBe(true);
  });

  it('shares one item budget across curate and adopt, then resumes deferred work next run', async () => {
    await withBrokenLinks('auto', {
      max_items: 1,
      max_files_changed: 10,
      max_bytes_written: 10_000,
      max_high_risk_items: 2,
    });
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'household/vulpine note.txt'),
      'Vulpine Mutual coverage is an invented fixture.\n',
    );
    await mem.index({});

    const first = await mem.dream({});
    const curate = first.maintenancePlans.find((plan) => plan.phase === 'curate')!;
    const adopt = first.maintenancePlans.find((plan) => plan.phase === 'adopt')!;

    expect(curate.items.find((item) => item.kind === 'broken_link')).toMatchObject({ status: 'applied' });
    expect(adopt.items[0]).toMatchObject({
      status: 'proposed',
      statusCode: 'budget_exhausted',
      decision: null,
    });
    expect(first.run).toMatchObject({
      status: 'partially_completed',
      budget: {
        used: { items: 1, filesChanged: 1, highRiskItems: 0 },
        deferredItems: 1,
      },
    });
    expect(fs.existsSync(path.join(root, 'household/vulpine-note.md'))).toBe(false);
    expect(mem.maintenanceStatus()).toMatchObject({ awaitingHuman: 0, budgetDeferred: 1 });

    const second = await mem.dream({});
    const resumed = second.maintenancePlans.find((plan) => plan.id === adopt.id)!;

    expect(resumed).toMatchObject({ status: 'completed' });
    expect(resumed.items[0]).toMatchObject({ status: 'applied', statusCode: null });
    expect(second.run.budget).toMatchObject({
      used: { items: 1, filesChanged: 1, highRiskItems: 0 },
      deferredItems: 0,
    });
    expect(fs.existsSync(path.join(root, 'household/vulpine-note.md'))).toBe(true);
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
        profile: 'audit',
        observe: { enabled: false },
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
        profile: 'audit',
        observe: { enabled: false },
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
    expect(report.observations[0]!.action).toBe('would-create');
    expect(report.changeId).toBeNull();
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });

  it('seals an exact audit plan without writing or making a decision', async () => {
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe', mode: 'audit' });

    expect(report.observations[0]).toMatchObject({ action: 'would-create' });
    expect(report.maintenancePlan).toMatchObject({ phase: 'observe', mode: 'audit', status: 'ready' });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      kind: 'observe',
      policy: 'audit',
      status: 'proposed',
      decision: null,
    });
    expect(mem.maintenanceDiff(report.maintenancePlan!.id)).toContain(PATTERN);
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });

  it('seals observations for human review under the review profile', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    await mem.index({});
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe' });

    expect(report.run).toMatchObject({ profile: 'review', mode: 'review' });
    expect(report.observations[0]).toMatchObject({ action: 'would-create' });
    expect(report.maintenancePlan).toMatchObject({ phase: 'observe', status: 'awaiting_review' });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      kind: 'observe',
      policy: 'review',
      status: 'proposed',
    });
    expect(report.changeId).toBeNull();
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
    expect(mem.maintenanceStatus().authority).toMatchObject({
      profile: 'review',
      mode: 'review',
      inference: 'preview',
      observe: 'review',
      automaticKnowledgeBaseWrites: false,
    });

    const item = report.maintenancePlan!.items[0]!;
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'approve', 'The invented pattern is well supported.');
    const applied = await mem.applyPlan(report.maintenancePlan!.id);
    expect(applied.plan.items[0]).toMatchObject({ status: 'applied', verification: { status: 'passed' } });
    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toContain(
      PATTERN,
    );
  });

  it('does not resubmit an unchanged human-rejected observation', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    await mem.index({});
    server.reply(OBSERVED);

    const first = await mem.dream({ phase: 'observe' });
    const item = first.maintenancePlan!.items[0]!;
    mem.decidePlan(first.maintenancePlan!.id, item.id, 'reject', 'This invented pattern is not useful.');

    const repeated = await mem.dream({ phase: 'observe' });

    expect(repeated.maintenancePlan).toBeNull();
    expect(repeated.observations[0]).toMatchObject({ action: 'rejected' });
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });

  it('refuses an approved observation when sealed evidence changes before apply', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    await mem.index({});
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe' });
    const item = report.maintenancePlan!.items[0]!;
    fs.appendFileSync(path.join(root, 'home/appliances.md'), '\nAn invented later note.\n');
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'approve', 'Approved before evidence changed.');

    const applied = await mem.applyPlan(report.maintenancePlan!.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.existsSync(path.join(root, 'observations/home-appliance-servicing.md'))).toBe(false);
  });

  it('uses a separate curator and verified plan apply under the autonomous profile', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'autonomous', observe: { enabled: true } } });
    await mem.index({});
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe' });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;

    expect(report.run).toMatchObject({ profile: 'autonomous', mode: 'auto', status: 'completed' });
    expect(report.observations[0]).toMatchObject({ action: 'created' });
    expect(item).toMatchObject({
      kind: 'observe',
      policy: 'auto',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(report.budget.used).toMatchObject({ items: 1, filesChanged: 1, highRiskItems: 0 });
    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toContain(
      PATTERN,
    );

    server.reply({
      observations: [
        {
          pattern: 'Household appliances are serviced every four months, in rotation.',
          evidence: ['home/laundry', 'home/kitchen'],
          confidence: 0.8,
        },
      ],
    });
    const refined = await mem.dream({ phase: 'observe' });
    const page = fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8');
    expect(refined.observations[0]).toMatchObject({ action: 'refined' });
    expect(page).toContain(PATTERN);
    expect(page).toContain('every four months');
    expect(page.match(/^- \d{4}-\d{2}-\d{2} —/gm)).toHaveLength(2);
  });

  it('defers an approved autonomous observation before writing when the run budget is zero', async () => {
    await mem.close();
    mem = await openMem({
      maintenance: {
        profile: 'autonomous',
        observe: { enabled: true },
        limits: { max_items: 0 },
      },
    });
    await mem.index({});
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe' });

    expect(report.run).toMatchObject({
      status: 'partially_completed',
      budget: { used: { items: 0, filesChanged: 0 }, deferredItems: 1 },
    });
    expect(report.observations[0]).toMatchObject({ action: 'would-create' });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      status: 'proposed',
      statusCode: 'budget_exhausted',
      decision: null,
    });
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
        profile: 'autonomous',
        observe: { enabled: false },
        curate: { verify: true },
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
    mem = await openMem({ maintenance: { profile: 'autonomous', curate: { verify: true } } });
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
    mem = await openMem({ maintenance: { profile: 'autonomous' } });
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

  it('includes graph findings as read-only housekeeping candidates', async () => {
    fs.writeFileSync(
      path.join(root, 'home/zephyr-one.md'),
      '---\ntitle: Zephyr One\nakno:\n  aliases: [Zephyr]\n---\n\n# Zephyr One\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'home/zephyr-two.md'),
      '---\ntitle: Zephyr Two\nakno:\n  aliases: [Zephyr]\n---\n\n# Zephyr Two\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'home/graph-review.md'),
      '---\ntitle: Graph Review\nakno:\n  about: [Zephyr, Missing Fixture]\n---\n\n# Graph Review\n',
      'utf8',
    );
    await mem.index({ structuralOnly: true, verify: true });

    const report = await mem.dream({ phase: 'housekeeping' });
    const candidates = report.housekeeping!.graphCandidates;

    expect(report.housekeeping!.counts.graphCandidates).toBeGreaterThanOrEqual(2);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'identity_collision', subject: 'zephyr' }),
        expect.objectContaining({
          kind: 'unresolved_about',
          subject: 'home/graph-review',
          related: ['Missing Fixture'],
        }),
      ]),
    );
    expect(report.maintenancePlans).toEqual([]);
    expect(report.run.maintenancePlanIds).toEqual([]);
  });
});

describe('the cycle', () => {
  it('persists a content-safe receipt tied to the indexed state at run start', async () => {
    await mem.index({ structuralOnly: true });
    const first = await mem.dream({ phase: 'housekeeping' });

    expect(first.run).toMatchObject({
      status: 'completed',
      mode: 'auto',
      requestedPhase: 'housekeeping',
      persisted: true,
      maintenancePlanIds: [],
      maintenancePlanId: null,
      errorCode: null,
    });
    expect(first.run.id).toMatch(/^run_[a-f0-9]{8}$/);
    expect(first.run.finishedAt).not.toBeNull();
    expect(first.run.snapshot).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      requestedPhases: ['housekeeping'],
      plannerVersion: 'dream-lifecycle-v1',
    });
    expect(first.run.snapshot.indexedFiles).toBeGreaterThan(0);
    expect(first.run.snapshot.indexRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(mem.maintenanceStatus().latestRun).toEqual(first.run);

    fs.appendFileSync(path.join(root, 'home/appliances.md'), '\nAn invented service note.\n', 'utf8');
    await mem.index({ structuralOnly: true });
    const second = await mem.dream({ phase: 'housekeeping' });

    expect(second.run.id).not.toBe(first.run.id);
    expect(second.run.snapshot.knowledgeBaseFingerprint).not.toBe(
      first.run.snapshot.knowledgeBaseFingerprint,
    );
    expect(first.run.snapshot.knowledgeBaseFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(mem.maintenanceStatus({ last: 2 }).runs).toEqual([second.run, first.run]);
    expect(mem.maintenanceStatus({ runId: first.run.id }).runs).toEqual([first.run]);
  });

  it('persists exact provider-reported model usage by stage', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { conflicts: { enabled: false } } });
    server.reply({ observations: [] });

    const report = await mem.dream({ phase: 'observe', mode: 'audit' });

    expect(report.modelUsage).toMatchObject({
      modelId: 'stub-derive',
      calls: 1,
      successfulCalls: 1,
      failedCalls: 0,
      usageReportedCalls: 1,
      inputTokens: 111,
      outputTokens: 22,
      totalTokens: 133,
      stages: [{ stage: 'observe', calls: 1, totalTokens: 133 }],
    });
    expect(report.degraded).toEqual([]);
    expect(report.run.modelUsage).toEqual(report.modelUsage);
    expect(mem.maintenanceStatus({ runId: report.run.id }).runs[0]?.modelUsage).toEqual(report.modelUsage);
  });

  it('persists a malformed planner reply as one billed but semantically failed call', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { conflicts: { enabled: false } } });
    server.reply({ result: [] });

    const report = await mem.dream({ phase: 'observe', mode: 'audit' });

    expect(report.modelUsage).toMatchObject({
      modelId: 'stub-derive',
      calls: 1,
      successfulCalls: 0,
      failedCalls: 1,
      usageReportedCalls: 1,
      inputTokens: 111,
      outputTokens: 22,
      totalTokens: 133,
      stages: [
        {
          stage: 'observe',
          calls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          totalTokens: 133,
        },
      ],
    });
    expect(report.degraded).toEqual([
      { stage: 'observe', reason: 'derive_failed', failure: 'bad_response', occurrences: 1 },
    ]);
    expect(mem.maintenanceStatus({ runId: report.run.id }).runs[0]).toMatchObject({
      modelUsage: report.modelUsage,
      degraded: report.degraded,
    });
  });

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
    expect(report.degraded).toContainEqual({
      stage: 'observe',
      reason: 'no_derive_model',
      failure: 'unavailable',
      occurrences: 1,
    });
    expect(report.run.degraded).toEqual(report.degraded);
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

/** An orphan is immediately searchable; `adopt` adds organization, not visibility. */
describe('adopt', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(root, 'household'), { recursive: true });
    fs.writeFileSync(path.join(root, 'household/lease scan.txt'), 'The lease runs to August 2027.\n');
  });

  it('adopts only the document card the caller selected', async () => {
    fs.writeFileSync(
      path.join(root, 'household/warranty card.txt'),
      'The Zephyr QX-100 warranty lasts 1111 days.\n',
    );
    await mem.index({});

    const recalled = await mem.recall({ query: 'lease scan.txt', mode: 'lookup', expand: false });
    const card = recalled.results.find((entry) => entry.type === 'document');
    expect(card?.suggested_actions).toEqual([{ op: 'adopt', args: { documentId: card.id } }]);

    const result = await mem.adopt(card!.suggested_actions![0]!.args);

    expect(result).toMatchObject({
      status: 'ok',
      outcome: 'created',
      document_id: card!.id,
      slug: 'household/lease-scan',
      rel_path: 'household/lease-scan.md',
      plan: { mode: 'auto', status: 'completed', item_status: 'applied' },
    });
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'household/warranty-card.md'))).toBe(false);
    const other = await mem.recall({
      query: 'Zephyr QX-100 warranty 1111 days',
      mode: 'lookup',
      expand: false,
      filter: { ownership: 'orphan' },
    });
    expect(other.results.some((entry) => entry.type === 'document')).toBe(true);
  });

  it('uses audit mode for a selected document without writing it', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'audit' } });
    await mem.index({});
    const recalled = await mem.recall({ query: 'lease scan.txt', mode: 'lookup', expand: false });
    const card = recalled.results.find((entry) => entry.type === 'document');

    const result = await mem.adopt({ documentId: card!.id });

    expect(result).toMatchObject({
      outcome: 'planned',
      plan: { mode: 'audit', status: 'ready', item_status: 'proposed' },
    });
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
    expect(mem.maintenanceDiff(result.plan!.id)).toContain('--- /dev/null\n+++ b/household/lease-scan.md');
  });

  it('keeps a selected review item stale-safe while it waits for a human', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review' } });
    await mem.index({});
    const recalled = await mem.recall({ query: 'lease scan.txt', mode: 'lookup', expand: false });
    const card = recalled.results.find((entry) => entry.type === 'document');
    const result = await mem.adopt({ documentId: card!.id });
    expect(result).toMatchObject({
      outcome: 'requires_review',
      plan: { mode: 'review', status: 'awaiting_review', item_status: 'proposed' },
    });

    fs.appendFileSync(path.join(root, 'household/lease scan.txt'), 'A newer invented clause.\n');
    mem.decidePlan(result.plan!.id, result.plan!.item_id, 'approve', 'The proposed scope is correct.');
    const applied = await mem.applyPlan(result.plan!.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
  });

  it('turns a standalone document result into an owned page result without losing evidence', async () => {
    await mem.index({});
    expect((await mem.doctor({ probeModels: false })).counts.documentsUnsearchable).toBe(0);

    const before = await mem.recall({ query: 'lease scan.txt', mode: 'lookup', expand: false });
    const standalone = before.results.find((entry) => entry.type === 'document');
    expect(standalone).toMatchObject({
      type: 'document',
      path: 'household/lease scan.txt',
      ownership: { status: 'orphan' },
      source: { kind: 'original_text', via: 'plain' },
    });
    expect(before.cards).toHaveLength(0);
    const read = await mem.read({ document: standalone!.id });
    expect(read.document?.text).toContain('August 2027');
    const bundle = await mem.context({
      query: 'lease runs to August 2027',
      budget: 2000,
      timeline_days: 0,
      structure: false,
    });
    expect(bundle.results.some((entry) => entry.type === 'document')).toBe(true);

    const report = await mem.dream({ phase: 'adopt' });
    expect(report.adopted).toHaveLength(1);
    expect(report.adopted[0]!.action).toBe('created');
    expect(report.adopted[0]!.slug).toBe('household/lease-scan');
    expect(report.maintenancePlan).toMatchObject({
      mode: 'auto',
      phase: 'adopt',
      status: 'completed',
    });
    expect(report.maintenancePlan?.items[0]).toMatchObject({
      kind: 'adopt',
      risk: 'low',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;
    expect(item.operations).toMatchObject([{ type: 'create', relPath: 'household/lease-scan.md' }]);
    expect(item.evidence.find((entry) => entry.type === 'snapshot')?.fingerprint).toBe(
      report.run.snapshot.indexRevision,
    );
    expect(item.evidence.filter((entry) => entry.type === 'document')).toHaveLength(1);

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
    expect(found.results.filter((entry) => entry.type === 'document')).toHaveLength(0);
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

  it('keeps both result types in a mixed budget and applies source filters before ranking', async () => {
    fs.writeFileSync(
      path.join(root, 'household/service card.txt'),
      'Service the appliance every 6 months.\n',
    );
    await mem.index({});

    const mixed = await mem.recall({
      query: 'service the appliance every 6 months',
      mode: 'lookup',
      expand: false,
      limit: 2,
    });
    expect(new Set(mixed.results.map((entry) => entry.type))).toEqual(new Set(['page', 'document']));

    const documents = await mem.recall({
      query: 'service the appliance every 6 months',
      mode: 'lookup',
      expand: false,
      filter: { source: 'document' },
    });
    expect(documents.results.every((entry) => entry.type === 'document')).toBe(true);

    const roleFiltered = await mem.recall({
      query: 'service the appliance every 6 months',
      mode: 'lookup',
      expand: false,
      filter: { role: 'source' },
    });
    expect(roleFiltered.results.every((entry) => entry.type === 'page')).toBe(true);
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
    const found = await mem.recall({
      query: 'lease runs to August 2027',
      mode: 'lookup',
      expand: false,
      filter: { ownership: 'orphan' },
    });
    expect(found.results).toHaveLength(1);
    expect(found.results[0]?.type).toBe('document');
    if (found.results[0]?.type === 'document') {
      expect(found.results[0].suggested_actions).toBeUndefined();
    }
  });

  it('leaves someone else’s page alone when one is already there', async () => {
    fs.writeFileSync(path.join(root, 'household/lease-scan.md'), '# Notes\n\nMy own page.\n', 'utf8');
    await mem.index({});

    const recalled = await mem.recall({ query: 'lease scan.txt', mode: 'lookup', expand: false });
    const card = recalled.results.find((entry) => entry.type === 'document');
    const result = await mem.adopt({ documentId: card!.id });

    expect(result).toMatchObject({
      outcome: 'blocked',
      plan: { mode: 'auto', status: 'failed', item_status: 'blocked' },
    });
    expect(result.reason).toMatch(/already exists/);
    const item = mem.plan(result.plan!.id).items[0]!;
    expect(item.checks).toContainEqual(
      expect.objectContaining({ name: 'target page did not exist at planning time', status: 'failed' }),
    );
    const repeated = await mem.adopt({ documentId: card!.id });
    expect(repeated.plan?.id).toBe(result.plan!.id);
    expect(fs.readFileSync(path.join(root, 'household/lease-scan.md'), 'utf8')).toContain('My own page.');
    const stillOrphaned = await mem.recall({
      query: 'lease runs to August 2027',
      mode: 'lookup',
      expand: false,
      filter: { ownership: 'orphan' },
    });
    expect(stillOrphaned.results.some((entry) => entry.type === 'document')).toBe(true);
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
    expect(report.adopted[0]!.action).toBe('planned');
    expect(report.adoptChangeId).toBeNull();
    expect(report.maintenancePlan).toBeNull();
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
  });

  it('persists an audit plan without writing', async () => {
    await mem.index({});
    const report = await mem.dream({ phase: 'adopt', mode: 'audit' });

    expect(report.adopted[0]).toMatchObject({ action: 'planned', slug: 'household/lease-scan' });
    expect(report.maintenancePlan).toMatchObject({ mode: 'audit', phase: 'adopt', status: 'ready' });
    expect(report.maintenancePlan?.items[0]).toMatchObject({ kind: 'adopt', status: 'proposed' });
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
    expect(mem.maintenanceDiff(report.maintenancePlan!.id)).toContain(
      '--- /dev/null\n+++ b/household/lease-scan.md',
    );
  });

  it('can audit adoption without a model', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      maintenance: { profile: 'audit' },
    });
    await mem.index({});

    const report = await mem.dream({ phase: 'adopt' });

    expect(report.maintenancePlan).toMatchObject({ mode: 'audit', phase: 'adopt', status: 'ready' });
    expect(report.adopted[0]).toMatchObject({ action: 'planned' });
  });

  it('keeps review separate from apply and verifies document ownership', async () => {
    await mem.index({});
    const report = await mem.dream({ phase: 'adopt', mode: 'review' });
    const plan = mem.plan(report.maintenancePlan!.id);
    const item = plan.items[0]!;

    expect(report.adopted[0]!.action).toBe('planned');
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
    mem.decidePlan(plan.id, item.id, 'approve', 'The deterministic filing page is correctly scoped.');
    const applied = await mem.applyPlan(plan.id);

    expect(applied.plan.items[0]).toMatchObject({
      status: 'applied',
      verification: { status: 'passed' },
    });
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(true);
    expect((await mem.doctor({ probeModels: false })).counts.documentsUnsearchable).toBe(0);
  });

  it('makes an approved adoption stale when the source bytes changed after planning', async () => {
    await mem.index({});
    const report = await mem.dream({ phase: 'adopt', mode: 'review' });
    const plan = mem.plan(report.maintenancePlan!.id);
    const item = plan.items[0]!;
    fs.appendFileSync(path.join(root, 'household/lease scan.txt'), 'A newer invented clause.\n');

    mem.decidePlan(plan.id, item.id, 'approve', 'Approved before the source changed.');
    const applied = await mem.applyPlan(plan.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.existsSync(path.join(root, 'household/lease-scan.md'))).toBe(false);
  });

  it('does not resubmit an unchanged human-rejected adoption', async () => {
    await mem.index({});
    const report = await mem.dream({ phase: 'adopt', mode: 'review' });
    const item = report.maintenancePlan!.items[0]!;
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'reject', 'This document should remain unfiled.');

    const repeated = await mem.dream({ phase: 'adopt', mode: 'review' });

    expect(repeated.maintenancePlan).toBeNull();
    expect(repeated.adopted[0]).toMatchObject({ action: 'rejected' });
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
    expect(report.modelUsage).toMatchObject({ failedCalls: 0 });
    expect(report.degraded).toEqual([]);
    expect(record.modelUsage).toEqual(report.modelUsage);
    expect(record.degraded).toEqual(report.degraded);

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
