import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { insertObservationBlock, observationBlock } from '../src/observations/marker.ts';
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
  answer: (generation: unknown, verification: unknown) => void;
  conflictCalls: () => number;
  /** Facts the deriver returns for a page, so real facts land on real lines. */
  facts: (byslug: Record<string, DerivedFact[]>) => void;
  /** The last body the observe mission was given, for asserting what it was shown. */
  lastObserveInput: () => string;
  requestKinds: () => ('observe' | 'reflect' | 'curator')[];
  onCurator: (hook: () => void) => void;
  onReflect: (hook: () => void | Promise<void>) => void;
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
  let answerScripted: { generation: unknown; verification: unknown } | null = null;
  let classified = 0;
  let byPage: Record<string, DerivedFact[]> = {};
  let lastObserve = '';
  const requestKinds: ('observe' | 'reflect' | 'curator')[] = [];
  let curatorHook: (() => void) | null = null;
  let reflectHook: (() => void | Promise<void>) | null = null;

  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', async () => {
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
        if (kind === 'reflect') await reflectHook?.();
        lastObserve = user;
      } else if (system.startsWith('You are the independent curator for an autonomous memory system')) {
        requestKinds.push('curator');
        curatorHook?.();
      }
      const answer = user.startsWith('Page: ')
        ? derive(user, byPage)
        : system.startsWith('You independently verify whether drafted answer blocks')
          ? (answerScripted?.verification ?? { verdicts: [] })
          : system.startsWith('You answer a factual question using only supplied memory evidence')
            ? (answerScripted?.generation ?? { blocks: [], missing_concepts: [] })
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
    answer: (generation, verification) => {
      answerScripted = { generation, verification };
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
  'topics/appliance-servicing.md':
    '---\ntitle: Appliance servicing\nakno:\n  management:\n    observe: integrate\n---\n\n# Appliance servicing\n\nAuthored overview.\n',
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
    rule_drift: 'off',
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
        answer: { provider: 'stub', id: 'stub-answer', reasoning_effort: 'none' },
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

const OBSERVE_TARGET = 'topics/appliance-servicing.md';
const REFLECTION_OBSERVATION_IDS = ['obs_reflect_1111', 'obs_reflect_2222', 'obs_reflect_3333'] as const;

function observationIds(body: string): string[] {
  return [...body.matchAll(/<!-- akno:observation (obs_[A-Za-z0-9_-]+) /g)].map((match) => match[1]!);
}

/** Seed three valid L2 observations through the same projection reflection reads. */
async function seedIndexedReflectionObservations(
  placement: 'target' | 'separate' | 'mixed' = 'target',
): Promise<void> {
  const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
  const rows = db
    .prepare(
      `SELECT f.id, f.source_line_hash, f.page_id, p.slug, g.subject_entity
         FROM facts f JOIN pages p ON p.id = f.page_id
         JOIN graph_fact_status g ON g.fact_id = f.id
        WHERE f.valid_to IS NULL AND g.eligibility = 'eligible'
          AND g.subject_entity = (
            SELECT e.id FROM graph_entities e JOIN pages cp ON cp.id = e.canonical_page
             WHERE cp.slug = 'topics/appliance-servicing'
          )
        ORDER BY p.slug`,
    )
    .all() as {
    id: string;
    source_line_hash: string;
    page_id: string;
    slug: string;
    subject_entity: string;
  }[];
  db.close();
  expect(rows).toHaveLength(3);

  const patterns = [
    'Service visits follow a repeatable household cadence.',
    'Maintenance rotates among household appliances.',
    'Completed service work is recorded across seasons.',
  ];
  for (let index = 0; index < REFLECTION_OBSERVATION_IDS.length; index++) {
    const evidenceRows = [rows[index]!, rows[(index + 1) % rows.length]!];
    const block = observationBlock(
      {
        id: REFLECTION_OBSERVATION_IDS[index]!,
        subject: rows[0]!.subject_entity,
        disposition: 'active',
        evidence: evidenceRows.map((row) => ({
          factId: row.id,
          sourceLineHash: row.source_line_hash,
          proofGroups: [`page:${row.page_id}`],
        })),
        proofCount: 2,
      },
      patterns[index]!,
      evidenceRows.map((row) => row.slug),
    );
    if (placement === 'target' || (placement === 'mixed' && index === 0)) {
      const target = path.join(root, OBSERVE_TARGET);
      const inserted = insertObservationBlock(fs.readFileSync(target, 'utf8'), block);
      if (inserted === null) throw new Error('reflection fixture target has ambiguous observation sections');
      fs.writeFileSync(target, inserted, 'utf8');
      continue;
    }
    const slug = `reflection-support-${index + 1}`;
    fs.writeFileSync(
      path.join(root, `topics/${slug}.md`),
      `---\ntitle: Reflection support ${index + 1}\nakno:\n  about: [topics/appliance-servicing]\n  management:\n    observe: integrate\n---\n\n# Reflection support ${index + 1}\n\n${block}\n`,
      'utf8',
    );
  }
  await mem.index({ structuralOnly: true });
}

describe('reflect', () => {
  const PRINCIPLE = 'Recurring activities are managed through explicit structures.';
  const REFLECTED = {
    observations: [
      {
        pattern: PRINCIPLE,
        evidence: [...REFLECTION_OBSERVATION_IDS],
        confidence: 0.9,
      },
    ],
  };

  /**
   * The tier reads the folder it writes into, which is how `principles` came to list itself as its
   * own evidence on a real knowledge base. A conclusion offered as its own support reads, later, as
   * a conclusion with support.
   */
  async function withIndexedObservations(maintenance: Record<string, unknown> = {}): Promise<Akno> {
    await mem.close();
    mem = await openMem({
      maintenance: { observe: { enabled: true }, reflect: { enabled: true }, ...maintenance },
    });
    await mem.index({});
    await seedIndexedReflectionObservations();
    return mem;
  }

  it('is told the principles it already wrote', async () => {
    // Same bug as observe's, one tier up: this appends to a single page every night from
    // observations that rarely change, so without its own previous answers it restates them.
    await withIndexedObservations();
    server.reply({
      observations: [
        {
          pattern: 'Recurring activities are managed through explicit structures.',
          evidence: [...REFLECTION_OBSERVATION_IDS],
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
    await withIndexedObservations();

    for (const pattern of [
      'Service visits follow a repeatable household cadence.',
      'The dishwasher was repaired in March 2026.',
    ]) {
      server.reply({
        observations: [
          {
            pattern,
            evidence: [...REFLECTION_OBSERVATION_IDS],
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
    await withIndexedObservations();

    server.reply({
      observations: [
        {
          pattern: 'Recurring activities are managed through explicit structures.',
          evidence: [...REFLECTION_OBSERVATION_IDS, 'observations/principles'],
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
    await withIndexedObservations({ profile: 'autonomous' });
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
    await withIndexedObservations({ profile: 'review' });
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
    await withIndexedObservations({ profile: 'review' });
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
    await withIndexedObservations({ profile: 'review' });
    server.reply(REFLECTED);

    const report = await mem.dream({ phase: 'reflect' });
    const item = report.maintenancePlan!.items[0]!;
    fs.appendFileSync(
      path.join(root, OBSERVE_TARGET),
      '\nAn invented authored note changed the sealed source page.\n',
    );
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'approve', 'Approved before evidence changed.');

    const applied = await mem.applyPlan(report.maintenancePlan!.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.existsSync(path.join(root, 'observations/principles.md'))).toBe(false);
  });

  it('uses a separate curator and shared budget for autonomous reflection', async () => {
    await withIndexedObservations({ profile: 'autonomous' });
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
    await withIndexedObservations({ profile: 'autonomous', limits: { max_items: 0 } });
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
          rule_drift: 'off',
          adopt: 'off',
        },
        observe: { enabled: true },
        reflect: { enabled: true },
        ...(limits ? { limits } : {}),
        conflicts: { enabled: false },
      },
    });
    await mem.index({});
    await seedIndexedReflectionObservations(seedObserveTarget ? 'mixed' : 'separate');
  }

  it('seals every inference plan before the first curator decision or write', async () => {
    await withInferencePolicies();
    const principle = 'Recurring activities are managed through explicit structures.';
    server.reply(OBSERVED);
    server.reflection({
      observations: [
        {
          pattern: principle,
          evidence: [...REFLECTION_OBSERVATION_IDS],
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
          evidence: [...REFLECTION_OBSERVATION_IDS],
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
          evidence: [...REFLECTION_OBSERVATION_IDS],
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
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toContain(PATTERN);
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
          evidence: [...REFLECTION_OBSERVATION_IDS],
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
        path.join(root, OBSERVE_TARGET),
        '\n- 2026-08-10 — An invented external process changed this page during planning.\n',
      );
    });

    const first = await mem.dream();
    const observation = first.maintenancePlans.find((plan) => plan.phase === 'observe')!;

    expect(server.requestKinds()).toEqual(['observe', 'reflect']);
    expect(first.run.status).toBe('failed');
    expect(first.verification).toMatchObject({
      status: 'failed',
      unattributedFiles: 1,
      checks: { wholeSnapshot: 'failed' },
      issues: [{ code: 'unattributed_file_change', count: 1 }],
    });
    expect(observation.status).toBe('failed');
    expect(observation.items[0]).toMatchObject({
      status: 'stale',
      statusCode: 'snapshot_drift',
      decision: null,
    });
    expect(observation.items[0]!.statusReason).not.toContain('observations/');
    const afterFirst = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    expect(afterFirst).toContain('invented external process');
    expect(afterFirst).not.toContain(PATTERN);

    const beforeSecond = server.requestKinds().length;
    const second = await mem.dream();
    const replanned = second.maintenancePlans.find((plan) => plan.phase === 'observe')!;

    expect(replanned.id).not.toBe(observation.id);
    expect(replanned.items[0]).toMatchObject({ status: 'applied', statusCode: null });
    expect(server.requestKinds().slice(beforeSecond)).toEqual(['observe', 'reflect', 'curator']);
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toContain(PATTERN);
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
    expect(report.run.status).toBe('failed');
    expect(report.verification).toMatchObject({
      status: 'failed',
      unattributedFiles: 1,
      checks: { wholeSnapshot: 'failed' },
      issues: [{ code: 'unattributed_file_change', count: 1 }],
    });
    expect(observation.items[0]).toMatchObject({
      status: 'stale',
      statusCode: 'snapshot_drift',
      decision: null,
    });
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).not.toContain(PATTERN);
  });

  it('holds a concurrent index pass until every planner seals, then drains it before curation', async () => {
    await withInferencePolicies();
    server.reply(OBSERVED);
    server.reflection({ observations: [] });
    let indexSettled = false;
    let settledDuringPlanning: boolean | null = null;
    let settledAtCurator: boolean | null = null;
    let queuedIndex: Promise<unknown> | null = null;
    server.onReflect(() => {
      fs.appendFileSync(
        path.join(root, 'notes/manual.md'),
        '\nAn invented external annotation arrived during the planner wave.\n',
      );
      queuedIndex = mem.index({ structuralOnly: true }).then((result) => {
        indexSettled = true;
        return result;
      });
      queueMicrotask(() => {
        settledDuringPlanning = indexSettled;
      });
    });
    server.onCurator(() => {
      settledAtCurator = indexSettled;
    });

    const report = await mem.dream();
    await queuedIndex;

    expect(settledDuringPlanning).toBe(false);
    expect(settledAtCurator).toBe(true);
    expect(report.maintenancePlans.find((plan) => plan.phase === 'observe')!.items[0]).toMatchObject({
      status: 'applied',
    });
    expect(report.verification).toMatchObject({
      status: 'failed',
      unattributedFiles: 1,
      checks: { wholeSnapshot: 'failed' },
      issues: [{ code: 'unattributed_file_change', count: 1 }],
    });
    expect(fs.readFileSync(path.join(root, 'notes/manual.md'), 'utf8')).toContain(
      'invented external annotation',
    );
  });

  it('lets a foreground write preempt planning and aborts before curator or apply', async () => {
    await withInferencePolicies();
    server.reply(OBSERVED);
    server.reflection({ observations: [] });
    let foregroundFinished = false;
    let foregroundOutcome: string | null = null;
    server.onReflect(async () => {
      const result = await mem.write({
        slug: 'home/foreground-note',
        content: '# Foreground note\n\nAn invented note arrived while maintenance was planning.',
      });
      foregroundOutcome = result.outcome;
      foregroundFinished = true;
    });

    await expect(mem.dream()).rejects.toMatchObject({
      code: 'conflict',
      message: expect.stringContaining('foreground memory write'),
      details: { retryable: true },
    });

    expect(foregroundFinished).toBe(true);
    expect(foregroundOutcome).toBe('ok');
    expect(server.requestKinds()).toEqual(['observe', 'reflect']);
    expect(
      (await mem.read({ slug: 'home/foreground-note' })).page?.lines.map((line) => line.text).join('\n'),
    ).toContain('invented note arrived');
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).not.toContain(PATTERN);
  });

  it('attributes sealed writes while reporting an unrelated concurrent edit without replacing it', async () => {
    server.reply(OBSERVED);
    server.onCurator(() => {
      fs.appendFileSync(
        path.join(root, 'notes/manual.md'),
        '\nAn invented external annotation arrived during curation.\n',
      );
    });

    const report = await mem.dream({ phase: 'observe' });

    expect(report.maintenancePlan!.items[0]).toMatchObject({ status: 'applied' });
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toContain(PATTERN);
    expect(fs.readFileSync(path.join(root, 'notes/manual.md'), 'utf8')).toContain(
      'invented external annotation',
    );
    expect(report.verification).toMatchObject({
      status: 'failed',
      appliedItems: 1,
      affectedFiles: 1,
      unattributedFiles: 1,
      checks: {
        appliedItems: 'passed',
        affectedPaths: 'passed',
        wholeSnapshot: 'failed',
      },
      issues: [{ code: 'unattributed_file_change', count: 1 }],
    });
    expect(report.run.status).toBe('failed');
    expect(JSON.stringify(report.run.verification)).not.toContain('notes/manual');
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
          rule_drift: 'off',
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

    const housekeepingReport = await mem.dream({ phase: 'housekeeping' });
    const covered = housekeepingReport.housekeeping!.brokenLinks.find(
      (entry) => entry.from === 'home/appliances' && entry.to === 'home/boiler',
    );
    expect(covered?.plan).toMatchObject({
      planId: report.maintenancePlan!.id,
      itemId: item.id,
      kind: 'broken_link',
      policy: 'audit',
      status: 'proposed',
    });
    expect(housekeepingReport.housekeeping!.planBacked.brokenLinks).toBe(1);
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

    const housekeepingReport = await mem.dream({ phase: 'housekeeping' });
    const uncovered = housekeepingReport.housekeeping!.brokenLinks.find(
      (entry) => entry.from === 'home/appliances' && entry.to === 'home/boiler',
    );
    expect(uncovered?.plan).toBeNull();
    expect(housekeepingReport.housekeeping!.planBacked.brokenLinks).toBe(0);
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

  it('verifies only the work resumed from a plan used by an earlier run', async () => {
    await withBrokenLinks('auto', {
      max_items: 1,
      max_files_changed: 10,
      max_bytes_written: 10_000,
      max_high_risk_items: 2,
    });
    fs.mkdirSync(path.join(root, 'products/manuals'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'products/zephyr.md'),
      '---\ntitle: Zephyr QX-100\nakno:\n  management:\n    dream: hygiene\n---\n\n' +
        'See [[products/zephyr-support|support notes]].\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'products/manuals/zephyr-support.md'),
      '---\ntitle: Zephyr support\nakno:\n  aliases:\n    - products/zephyr-support\n---\n\n' +
        'Invented support reference.\n',
      'utf8',
    );
    await mem.index({});

    const first = await mem.dream({ phase: 'curate' });
    const firstPlan = mem.plan(first.maintenancePlan!.id);
    const firstApplied = firstPlan.items.find((item) => item.status === 'applied')!;
    const deferred = firstPlan.items.find((item) => item.statusCode === 'budget_exhausted')!;

    expect(firstApplied.changeId).toBeTruthy();
    expect(deferred).toMatchObject({ status: 'proposed', changeId: null });
    expect(first.run.changeIds).toEqual([firstApplied.changeId]);

    const previouslyChangedPath = firstApplied.operations[0]!.relPath;
    fs.appendFileSync(
      path.join(root, previouslyChangedPath),
      '\nAn invented annotation added after the first maintenance run.\n',
      'utf8',
    );
    await mem.index({});

    const second = await mem.dream({ phase: 'curate' });
    const resumed = mem.plan(firstPlan.id);
    const resumedItem = resumed.items.find((item) => item.id === deferred.id)!;

    expect(resumedItem).toMatchObject({ status: 'applied', verification: { status: 'passed' } });
    expect(second.verification).toMatchObject({
      status: 'passed',
      appliedItems: 1,
      affectedFiles: 1,
      checks: { appliedItems: 'passed', affectedPaths: 'passed', wholeSnapshot: 'passed' },
      issues: [],
    });
    expect(second.run.changeIds).toEqual([resumedItem.changeId]);
    expect(second.run.changeIds).not.toContain(firstApplied.changeId);
    expect(second.run.budget).toMatchObject({
      used: { items: 1, filesChanged: 1, highRiskItems: 0 },
      deferredItems: 0,
    });
    expect(fs.readFileSync(path.join(root, previouslyChangedPath), 'utf8')).toContain(
      'An invented annotation added after the first maintenance run.',
    );
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
  it('co-locates a qualified L2 block without changing authored bytes', async () => {
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe' });

    expect(report.observations).toHaveLength(1);
    expect(report.observations[0]!.action).toBe('created');
    expect(report.observations[0]!.slug).toBe('topics/appliance-servicing');

    const page = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    expect(page.startsWith(before)).toBe(true);
    expect(page).toContain('## Observed patterns');
    expect(page).toContain('akno:observation');
    expect(page).toContain('v=1 level=2');
    expect(page).toContain('- **Observation:**');
    expect(page).toContain('Evidence: [[home/appliances]]');
    expect(page).toContain(PATTERN);

    const read = await mem.read({ slug: 'topics/appliance-servicing' });
    expect(read.page?.lines.find((line) => line.text.includes(PATTERN))?.observation).toMatchObject({
      status: 'eligible',
      level: 2,
      disposition: 'active',
      proof_count: 3,
    });
    const timeline = await mem.timeline({ limit: 50 });
    expect(
      timeline.results.some(
        (event) => event.type === 'event' && event.summary.includes('appliances are serviced'),
      ),
    ).toBe(false);
  });

  it('answers from an observation as one item while citing every current leaf fact', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const [observationId] = observationIds(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8'));
    server.answer(
      {
        blocks: [{ text: PATTERN, evidence_ids: ['E2'] }],
        missing_concepts: [],
      },
      { verdicts: [{ block_id: 'B1', supported: true }] },
    );

    const result = await mem.answer({
      question: 'What pattern is observed in household appliance servicing?',
      filter: { folder: 'topics' },
      expand: false,
      graph: false,
      include_context: true,
    });
    const observation = result.context?.find((entry) => entry.type === 'observation');

    expect(observation).toMatchObject({
      evidence_id: 'E2',
      type: 'observation',
      observation_id: observationId,
      text: expect.stringContaining(PATTERN),
    });
    expect(
      observation?.type === 'observation' ? observation.evidence.map((leaf) => leaf.slug).sort() : [],
    ).toEqual(['home/appliances', 'home/kitchen', 'home/laundry']);
    expect(result.citations).toEqual([
      {
        id: 'E2',
        type: 'observation',
        observation_id: observationId,
        evidence: expect.arrayContaining([
          expect.objectContaining({ slug: 'home/appliances', fact: expect.any(String), line: 7 }),
          expect.objectContaining({ slug: 'home/laundry', fact: expect.any(String), line: 7 }),
          expect.objectContaining({ slug: 'home/kitchen', fact: expect.any(String), line: 7 }),
        ]),
      },
    ]);
    expect(result.answer).toContain('[home/appliances:7]');
    expect(result.answer).toContain('[home/laundry:7]');
    expect(result.answer).toContain('[home/kitchen:7]');
  });

  it('withholds the whole answer observation when a leaf changed before re-indexing', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const leafPath = path.join(root, 'home/appliances.md');
    fs.writeFileSync(
      leafPath,
      fs.readFileSync(leafPath, 'utf8').replace('repaired in March', 'repaired in October'),
    );
    server.answer({ blocks: [], missing_concepts: ['current observation support'] }, { verdicts: [] });

    const result = await mem.answer({
      question: 'What pattern is observed in household appliance servicing?',
      filter: { folder: 'topics' },
      expand: false,
      graph: false,
      include_context: true,
    });

    expect(result.context?.some((entry) => entry.type === 'observation')).toBe(false);
    expect(result.citations).toEqual([]);
  });

  it('projects observation lineage into the graph with leaf-source evidence', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });

    const graph = await mem.graph({
      slug: 'topics/appliance-servicing',
      relations: ['canonical_record', 'has_attribute', 'derived_from'],
      max_hops: 3,
    });
    const lineage = graph.edges.filter((edge) => edge.relation === 'derived_from');

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'observation', observation: expect.any(String) }),
      ]),
    );
    expect(lineage).toHaveLength(3);
    expect(lineage.map((edge) => edge.evidence.slug).sort()).toEqual([
      'home/appliances',
      'home/kitchen',
      'home/laundry',
    ]);
    expect(
      lineage.every((edge) => edge.evidence.kind === 'fact_line' && edge.evidence.line_start === 7),
    ).toBe(true);
  });

  it('is safe to re-run: the same pattern is not written twice', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const first = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');

    const second = await mem.dream({ phase: 'observe' });
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(first);
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
    const first = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');

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

    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(first);
    expect(second.observations).toHaveLength(0);
    expect(second.rejected.some((entry) => entry.reason === 'already recorded for this subject')).toBe(true);
  });

  it('refines only the owned block and preserves the surrounding page', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const first = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    const [id] = observationIds(first);
    expect(id).toBeTruthy();

    server.reply({
      observations: [
        {
          pattern: 'Household appliances are serviced every four months, in rotation.',
          evidence: ['home/laundry', 'home/kitchen'],
          outcome: 'refine',
          target_id: id,
        },
      ],
    });
    const report = await mem.dream({ phase: 'observe' });
    expect(report.observations[0]!.action).toBe('refined');

    const page = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    expect(page).toContain(PAGES[OBSERVE_TARGET]!.trimEnd());
    expect(page).not.toContain(PATTERN);
    expect(page).toContain('every four months');
    expect(observationIds(page)).toEqual([id]);
  });

  it('reinforces a stable observation id with newly independent evidence', async () => {
    server.reply({
      observations: [
        {
          pattern: PATTERN,
          evidence: ['home/appliances', 'home/laundry'],
          confidence: 0.8,
        },
      ],
    });
    await mem.dream({ phase: 'observe' });
    const first = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    const [id] = observationIds(first);

    server.reply({
      observations: [
        {
          pattern: PATTERN,
          evidence: ['home/laundry', 'home/kitchen'],
          confidence: 0.9,
          outcome: 'reinforce',
          target_id: id,
        },
      ],
    });
    const report = await mem.dream({ phase: 'observe' });
    const page = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');

    expect(report.observations[0]).toMatchObject({ action: 'reinforced', pattern: PATTERN });
    expect(observationIds(page)).toEqual([id]);
    expect(page).toContain('proofs=3');
    expect(page).toContain('[[home/kitchen]]');
  });

  it('splits one owned observation while retaining its superseded lineage', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const first = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    const [id] = observationIds(first);

    server.reply({
      observations: [
        {
          pattern: 'Kitchen appliances follow a seasonal service cadence.',
          split_pattern: 'Laundry appliances follow a separate service cadence.',
          evidence: ['home/appliances', 'home/laundry', 'home/kitchen'],
          confidence: 0.9,
          outcome: 'split',
          target_id: id,
        },
      ],
    });
    const report = await mem.dream({ phase: 'observe' });
    const page = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    const read = await mem.read({ slug: 'topics/appliance-servicing' });

    expect(report.observations[0]).toMatchObject({ action: 'split' });
    expect(observationIds(page)).toHaveLength(3);
    expect(page).toContain(`${id} v=1 level=2`);
    expect(page).toContain('disposition=superseded');
    expect(page).toContain('Kitchen appliances follow a seasonal service cadence.');
    expect(page).toContain('Laundry appliances follow a separate service cadence.');
    expect(read.page?.lines.filter((line) => line.observation?.status === 'eligible')).toHaveLength(2);
  });

  it('weakens invalid lineage through a verified, reversible plan', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const active = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    server.facts({ 'home/appliances': SERVICING['home/appliances']! });
    await mem.index({ rederive: true });
    server.reply({ observations: [] });

    const report = await mem.dream({ phase: 'observe' });
    const weakened = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');

    expect(report.observations[0]).toMatchObject({ action: 'weakened', pattern: PATTERN });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      status: 'applied',
      verification: { status: 'passed' },
    });
    expect(weakened).toContain('disposition=weakened');
    expect((await mem.read({ slug: 'topics/appliance-servicing' })).page?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observation: expect.objectContaining({ status: 'ineligible', disposition: 'weakened' }),
        }),
      ]),
    );

    await mem.undo({ change_id: report.changeId! });
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(active);
  });

  it('retracts unsupported lineage through a verified plan', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    server.facts({});
    await mem.index({ rederive: true });
    server.reply({ observations: [] });

    const report = await mem.dream({ phase: 'observe' });
    const page = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');

    expect(report.observations[0]).toMatchObject({ action: 'retracted', pattern: PATTERN });
    expect(report.maintenancePlan!.items[0]).toMatchObject({
      status: 'applied',
      verification: { status: 'passed' },
    });
    expect(page).toContain('disposition=retracted');
  });

  it('marks a reviewed weaken plan stale when its last support disappears before apply', async () => {
    server.reply(OBSERVED);
    await mem.dream({ phase: 'observe' });
    const active = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');

    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    server.facts({ 'home/appliances': SERVICING['home/appliances']! });
    await mem.index({ rederive: true });
    server.reply({ observations: [] });
    const planned = await mem.dream({ phase: 'observe' });
    const plan = mem.plan(planned.maintenancePlan!.id);
    const item = plan.items[0]!;
    expect(item.evidence[0]?.observationOutcome).toBe('weaken');

    server.facts({});
    await mem.index({ rederive: true });
    mem.decidePlan(plan.id, item.id, 'approve', 'Approved while one proof remained.');
    const applied = await mem.applyPlan(plan.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(active);
  });

  it('does not write where observation integration is denied', async () => {
    const target = path.join(root, OBSERVE_TARGET);
    const before = fs.readFileSync(target, 'utf8').replace('observe: integrate', 'observe: deny');
    fs.writeFileSync(target, before, 'utf8');
    await mem.index({ structuralOnly: true });
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe' });

    expect(fs.readFileSync(target, 'utf8')).toBe(before);
    expect(report.observations).toHaveLength(0);
    expect(server.requestKinds()).not.toContain('observe');
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

    // Even if a deriver proposes the visible L2 payload as a fact, the owned marker boundary
    // prevents the observation from becoming evidence for another observation.
    server.facts({
      ...SERVICING,
      'topics/appliance-servicing': [
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
    expect(shown).not.toContain(`[topics/appliance-servicing] ${PATTERN}`);
    const read = await mem.read({ slug: 'topics/appliance-servicing' });
    expect(read.page?.lines.find((line) => line.text.includes(PATTERN))?.fact).toBeUndefined();
  });

  it('undoes a whole run as one change', async () => {
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe' });
    expect(report.changeId).toBeTruthy();

    await mem.undo({ change_id: report.changeId! });
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
  });

  it('writes nothing on a dry run', async () => {
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    server.reply(OBSERVED);
    const report = await mem.dream({ phase: 'observe', dryRun: true });
    expect(report.observations[0]!.action).toBe('would-create');
    expect(report.autoEstimate).toMatchObject({
      status: 'no_sealed_plan',
      curatorCalls: null,
      estimatedPromptTokens: null,
    });
    expect(report.changeId).toBeNull();
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
  });

  it('seals an exact audit plan without writing or making a decision', async () => {
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
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
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
  });

  it('seals observations for human review under the review profile', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    await mem.index({});
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
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
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
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
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toContain(PATTERN);
  });

  it('does not resubmit an unchanged human-rejected observation', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    await mem.index({});
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    server.reply(OBSERVED);

    const first = await mem.dream({ phase: 'observe' });
    const item = first.maintenancePlan!.items[0]!;
    mem.decidePlan(first.maintenancePlan!.id, item.id, 'reject', 'This invented pattern is not useful.');

    const repeated = await mem.dream({ phase: 'observe' });

    expect(repeated.maintenancePlan).toBeNull();
    expect(repeated.observations[0]).toMatchObject({ action: 'rejected' });
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
  });

  it('refuses an approved observation when sealed evidence changes before apply', async () => {
    await mem.close();
    mem = await openMem({ maintenance: { profile: 'review', observe: { enabled: true } } });
    await mem.index({});
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    server.reply(OBSERVED);

    const report = await mem.dream({ phase: 'observe' });
    const item = report.maintenancePlan!.items[0]!;
    fs.appendFileSync(path.join(root, 'home/appliances.md'), '\nAn invented later note.\n');
    mem.decidePlan(report.maintenancePlan!.id, item.id, 'approve', 'Approved before evidence changed.');

    const applied = await mem.applyPlan(report.maintenancePlan!.id);

    expect(applied.plan.items[0]).toMatchObject({ status: 'stale' });
    expect(applied.files).toEqual([]);
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
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
    const firstPage = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    expect(firstPage).toContain(PATTERN);
    const [id] = observationIds(firstPage);

    server.reply({
      observations: [
        {
          pattern: 'Household appliances are serviced every four months, in rotation.',
          evidence: ['home/laundry', 'home/kitchen'],
          confidence: 0.8,
          outcome: 'refine',
          target_id: id,
        },
      ],
    });
    const refined = await mem.dream({ phase: 'observe' });
    const page = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
    expect(refined.observations[0]).toMatchObject({ action: 'refined' });
    expect(page).not.toContain(PATTERN);
    expect(page).toContain('every four months');
    expect(observationIds(page)).toEqual([id]);
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
    const before = fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8');
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
    expect(fs.readFileSync(path.join(root, OBSERVE_TARGET), 'utf8')).toBe(before);
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
    server.onCurator(() => {
      // The post-apply derivation reads the rewritten sentence. A changed fingerprint must be
      // classified again rather than inheriting the pre-write verdict by page identity.
      server.facts({
        'products/zephyr-old': [
          {
            claim: 'Before 2002-02-02, the Zephyr QX-100 warranty was 1111 days.',
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
    expect(report.conflictRefresh).toMatchObject({
      status: 'passed',
      changedFiles: 2,
      knowledgePages: 2,
      currentPages: 2,
      stalePages: 0,
    });
    expect(server.conflictCalls()).toBe(2);

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
    mem = await openMem({
      folders: { 'home/**': { type: 'appliance' } },
      maintenance: { policies: { rule_drift: 'audit' } },
    });
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
    expect(drift?.field).toBe('type');
    expect(drift?.plan).toBeNull();
    expect(drift?.repair).toMatchObject({ status: 'ready', code: 'exact_type' });
    expect(report.housekeeping!.ruleRepairs.ready).toBe(1);
  });

  it('explains when exact rule repair is disabled by policy', async () => {
    await mem.close();
    mem = await openMem({
      folders: { 'home/**': { type: 'appliance' } },
      maintenance: { policies: { rule_drift: 'off' } },
    });
    fs.writeFileSync(
      path.join(root, 'home/laundry.md'),
      '---\ntitle: Laundry\ntype: chore\n---\n\n# Laundry\n',
      'utf8',
    );
    await mem.index({});

    const report = await mem.dream({ phase: 'housekeeping' });
    expect(report.housekeeping!.drift.find((entry) => entry.slug === 'home/laundry')?.repair).toMatchObject({
      status: 'held',
      code: 'policy_off',
    });
  });

  it('explains why slug-pattern drift remains report-only', async () => {
    await mem.close();
    mem = await openMem({
      folders: { 'drafts/**': { slug_pattern: '^[a-z]+$' } },
      maintenance: { policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'drafts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'drafts/bo-winters.md'), '# Bo Winters\n', 'utf8');
    await mem.index({});

    const report = await mem.dream({ phase: 'housekeeping' });
    expect(
      report.housekeeping!.drift.find((entry) => entry.slug === 'drafts/bo-winters')?.repair,
    ).toMatchObject({ status: 'report_only', code: 'slug_has_no_exact_repair' });
  });

  it('seals exact type drift in audit mode and marks housekeeping coverage', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: { 'home/**': { type: 'appliance' } },
      maintenance: {
        profile: 'audit',
        policies: { rule_drift: 'audit' },
        observe: { enabled: false },
        conflicts: { enabled: false },
      },
    });
    const before =
      '---\ntitle: Laundry\ntype: chore # preserve\nunknown: [one, two]\n---\n\n# Laundry\n\nServiced in June.\n';
    fs.writeFileSync(path.join(root, 'home/laundry.md'), before, 'utf8');
    await mem.index({});

    const report = await mem.dream({ phase: 'curate' });
    const item = mem.plan(report.maintenancePlan!.id).items.find((entry) => entry.kind === 'rule_drift')!;
    expect(item).toMatchObject({ policy: 'audit', risk: 'medium', status: 'proposed' });
    expect(item.operations).toMatchObject([
      {
        type: 'replace',
        relPath: 'home/laundry.md',
        after: before.replace('type: chore', 'type: "appliance"'),
      },
    ]);
    expect(item.evidence).toEqual([
      expect.objectContaining({
        type: 'rule',
        source: 'home/**',
        ruleGlob: 'home/**',
        expectedType: 'appliance',
        foundType: 'chore',
      }),
    ]);
    expect(fs.readFileSync(path.join(root, 'home/laundry.md'), 'utf8')).toBe(before);
    await expect(
      mem.revisePlan(report.maintenancePlan!.id, item.id, {
        after: `${item.operations[0]!.type === 'replace' ? item.operations[0]!.after : ''}\nExtra text.\n`,
      }),
    ).rejects.toThrow(/beyond the existing top-level type scalar/);

    const housekeepingReport = await mem.dream({ phase: 'housekeeping' });
    const drift = housekeepingReport.housekeeping!.drift.find((entry) => entry.slug === 'home/laundry');
    expect(drift?.plan).toMatchObject({
      planId: report.maintenancePlan!.id,
      itemId: item.id,
      kind: 'rule_drift',
      policy: 'audit',
      status: 'proposed',
    });
    expect(drift?.repair).toMatchObject({ status: 'plan_backed', code: 'sealed_plan' });
    expect(housekeepingReport.housekeeping!.planBacked.drift).toBe(1);
    expect(housekeepingReport.housekeeping!.ruleRepairs.planBacked).toBe(1);
  });

  it('autonomously applies and verifies one exact type correction without page-wide dream authority', async () => {
    await mem.close();
    mem = await openMem({
      folders: { 'home/**': { type: 'appliance' } },
      maintenance: {
        profile: 'autonomous',
        policies: {
          observe: 'off',
          reflect: 'off',
          hygiene: 'off',
          managed_item: 'off',
          synthesis: 'off',
          split: 'off',
          extract: 'off',
          merge: 'off',
          contradiction: 'off',
          broken_link: 'off',
          rule_drift: 'auto',
          adopt: 'off',
        },
        observe: { enabled: false },
        conflicts: { enabled: false },
      },
    });
    const before = '---\ntitle: Laundry\ntype: chore\n---\n\n# Laundry\n\nServiced in June.\n';
    fs.writeFileSync(path.join(root, 'home/laundry.md'), before, 'utf8');
    await mem.index({});

    const report = await mem.dream({ phase: 'curate' });
    const item = report.maintenancePlan!.items.find((entry) => entry.kind === 'rule_drift')!;
    expect(item).toMatchObject({
      policy: 'auto',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    expect(server.requestKinds()).toContain('curator');
    expect(fs.readFileSync(path.join(root, 'home/laundry.md'), 'utf8')).toBe(
      before.replace('type: chore', 'type: "appliance"'),
    );

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(path.join(root, 'home/laundry.md'), 'utf8')).toBe(before);
  });

  it('relocates an over-deep page only to an explicit rule destination and preserves identity and links', async () => {
    await mem.close();
    mem = await openMem({
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
      },
      maintenance: {
        profile: 'autonomous',
        policies: {
          observe: 'off',
          reflect: 'off',
          hygiene: 'off',
          managed_item: 'off',
          synthesis: 'off',
          split: 'off',
          extract: 'off',
          merge: 'off',
          contradiction: 'off',
          broken_link: 'off',
          rule_drift: 'auto',
          adopt: 'off',
        },
        observe: { enabled: false },
        conflicts: { enabled: false },
      },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    const before = '---\ntitle: Ada Marlow\n---\n\n# Ada Marlow\n\nSee [[home/appliances]].\n';
    fs.writeFileSync(path.join(root, 'notes/old/ada-marlow.md'), before, 'utf8');
    fs.writeFileSync(
      path.join(root, 'home/index.md'),
      '---\ntitle: Home\nakno:\n  about: [notes/old/ada-marlow]\n---\n\nSee [[notes/old/ada-marlow#Details|Ada]] and [profile](notes/old/ada-marlow.md#Details "Ada profile").\n',
      'utf8',
    );
    await mem.index({});
    const pageId = (await mem.read({ slug: 'notes/old/ada-marlow' })).page!.id;

    const report = await mem.dream({ phase: 'curate' });
    const item = report.maintenancePlan!.items.find((entry) => entry.kind === 'rule_drift')!;
    expect(item).toMatchObject({
      policy: 'auto',
      risk: 'high',
      status: 'applied',
      decision: { actor: 'curator', outcome: 'approve' },
      verification: { status: 'passed' },
    });
    const stored = mem.plan(report.maintenancePlan!.id).items.find((entry) => entry.id === item.id)!;
    expect(stored.operations.map((operation) => [operation.type, operation.relPath])).toEqual([
      ['create', 'archive/ada-marlow.md'],
      ['replace', 'home/index.md'],
      ['delete', 'notes/old/ada-marlow.md'],
    ]);
    expect(stored.evidence).toEqual([
      expect.objectContaining({
        type: 'rule',
        ruleField: 'max_depth',
        ruleGlob: 'notes/**',
        maxDepth: 1,
        relocateTo: 'archive',
        destinationSlug: 'archive/ada-marlow',
        referenceRewrites: [
          {
            slug: 'home/index',
            relPath: 'home/index.md',
            about: true,
            links: true,
          },
        ],
      }),
    ]);
    expect(fs.existsSync(path.join(root, 'notes/old/ada-marlow.md'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'archive/ada-marlow.md'), 'utf8')).toBe(before);
    expect((await mem.read({ slug: 'archive/ada-marlow' })).page!.id).toBe(pageId);
    expect(fs.readFileSync(path.join(root, 'home/index.md'), 'utf8')).toContain(
      '[[archive/ada-marlow#Details|Ada]]',
    );
    expect(fs.readFileSync(path.join(root, 'home/index.md'), 'utf8')).toContain(
      '[profile](archive/ada-marlow.md#Details "Ada profile")',
    );
    expect((await mem.read({ slug: 'home/index' })).page!.about).toEqual(['archive/ada-marlow']);

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(path.join(root, 'notes/old/ada-marlow.md'), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(root, 'archive/ada-marlow.md'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'home/index.md'), 'utf8')).toContain(
      '[[notes/old/ada-marlow#Details|Ada]]',
    );
    expect((await mem.read({ slug: 'home/index' })).page!.about).toEqual(['notes/old/ada-marlow']);
  });

  it('relocates owned documents and renditions atomically with an over-deep page', async () => {
    await mem.close();
    mem = await openMem({
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
      },
      maintenance: {
        profile: 'autonomous',
        policies: {
          observe: 'off',
          reflect: 'off',
          hygiene: 'off',
          managed_item: 'off',
          synthesis: 'off',
          split: 'off',
          extract: 'off',
          merge: 'off',
          contradiction: 'off',
          broken_link: 'off',
          rule_drift: 'auto',
          adopt: 'off',
        },
        observe: { enabled: false },
        conflicts: { enabled: false },
      },
    });
    const hash = '3f8c1a2b';
    const sourcePage = 'notes/old/ada-marlow.md';
    const sourcePdf = `notes/old/ada-marlow-${hash}.pdf`;
    const sourceText = `${sourcePdf}.txt`;
    const destinationPdf = `archive/ada-marlow-${hash}.pdf`;
    const destinationText = `${destinationPdf}.txt`;
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    fs.writeFileSync(path.join(root, sourcePage), `# Ada Marlow\n\n![[ada-marlow-${hash}.pdf]]\n`, 'utf8');
    const pdfBytes = Buffer.from('%PDF-1.4 invented fixture');
    fs.writeFileSync(path.join(root, sourcePdf), pdfBytes);
    fs.writeFileSync(
      path.join(root, sourceText),
      `# Extracted text of ada-marlow-${hash}.pdf\n# 1 page.\n# Written by Akno.\n\nInvented warranty evidence.\n`,
      'utf8',
    );
    await mem.index({});
    const before = (await mem.read({ slug: 'notes/old/ada-marlow' })).page!;
    const documentIds = new Map(before.documents!.map((document) => [document.rel_path, document.id]));

    const report = await mem.dream({ phase: 'curate' });
    const item = report.maintenancePlan!.items.find((entry) => entry.kind === 'rule_drift')!;
    expect(item).toMatchObject({ status: 'applied', verification: { status: 'passed' } });
    const stored = mem.plan(report.maintenancePlan!.id).items.find((entry) => entry.id === item.id)!;
    expect(stored.operations.map((operation) => [operation.type, operation.relPath])).toEqual([
      ['create', 'archive/ada-marlow.md'],
      ['move', sourcePdf],
      ['move', sourceText],
      ['delete', sourcePage],
    ]);
    expect(stored.operations.filter((operation) => operation.type === 'move')).toEqual([
      expect.objectContaining({ toRelPath: destinationPdf }),
      expect.objectContaining({ toRelPath: destinationText, rendersAfter: destinationPdf }),
    ]);
    expect(fs.readFileSync(path.join(root, destinationPdf))).toEqual(pdfBytes);
    expect(fs.existsSync(path.join(root, sourcePdf))).toBe(false);
    const after = (await mem.read({ slug: 'archive/ada-marlow' })).page!;
    expect(after.documents?.map((document) => [document.rel_path, document.id]).sort()).toEqual(
      [
        [destinationPdf, documentIds.get(sourcePdf)],
        [destinationText, documentIds.get(sourceText)],
      ].sort(),
    );

    await mem.undo({ change_id: item.changeId! });
    expect(fs.readFileSync(path.join(root, sourcePdf))).toEqual(pdfBytes);
    expect(fs.existsSync(path.join(root, destinationPdf))).toBe(false);
    const restored = (await mem.read({ slug: 'notes/old/ada-marlow' })).page!;
    expect(restored.documents?.map((document) => [document.rel_path, document.id]).sort()).toEqual(
      [
        [sourcePdf, documentIds.get(sourcePdf)],
        [sourceText, documentIds.get(sourceText)],
      ].sort(),
    );
  });

  it('holds attachment-aware relocation when an owned document changed after indexing', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
      },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'notes/old/bo-winters.md'),
      '# Bo Winters\n\n![[bo-winters-3f8c1a2b.txt]]\n',
      'utf8',
    );
    const documentPath = path.join(root, 'notes/old/bo-winters-3f8c1a2b.txt');
    fs.writeFileSync(documentPath, 'Invented warranty evidence.\n', 'utf8');
    await mem.index({});
    fs.writeFileSync(documentPath, 'Changed invented warranty evidence.\n', 'utf8');

    const curate = await mem.dream({ phase: 'curate' });
    expect(curate.maintenancePlans.flatMap((plan) => plan.items)).not.toContainEqual(
      expect.objectContaining({ kind: 'rule_drift', subject: 'notes/old/bo-winters' }),
    );
    const housekeeping = await mem.dream({ phase: 'housekeeping' });
    expect(
      housekeeping.housekeeping!.drift.find((entry) => entry.slug === 'notes/old/bo-winters')?.repair,
    ).toMatchObject({ status: 'held', code: 'document_changed' });
  });

  it('keeps max-depth drift report-only when no exact relocation folder is declared', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: { 'notes/**': { max_depth: 1 } },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    fs.writeFileSync(path.join(root, 'notes/old/bo-winters.md'), '# Bo Winters\n', 'utf8');
    await mem.index({});

    const curate = await mem.dream({ phase: 'curate' });
    expect(curate.maintenancePlans.flatMap((plan) => plan.items)).not.toContainEqual(
      expect.objectContaining({ kind: 'rule_drift', subject: 'notes/old/bo-winters' }),
    );
    const housekeeping = await mem.dream({ phase: 'housekeeping' });
    expect(
      housekeeping.housekeeping!.drift.find((entry) => entry.slug === 'notes/old/bo-winters'),
    ).toMatchObject({
      field: 'max_depth',
      plan: null,
      repair: { status: 'report_only', code: 'relocation_not_declared' },
    });
    expect(housekeeping.housekeeping!.ruleRepairs.reportOnly).toBe(1);
  });

  it('preserves relative page, self, and owned-document links while relocating', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
      },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    const sourcePath = 'notes/old/bo-winters.md';
    const documentPath = 'notes/old/bo-winters-3f8c1a2b.txt';
    const before =
      '# Bo Winters\n\nSee [warranty](../warranty.md), [[notes/old/bo-winters#Details|this page]], and ![evidence](bo-winters-3f8c1a2b.txt).\n';
    fs.writeFileSync(path.join(root, sourcePath), before, 'utf8');
    fs.writeFileSync(path.join(root, documentPath), 'Invented warranty evidence.\n', 'utf8');
    await mem.index({});
    const pageId = (await mem.read({ slug: 'notes/old/bo-winters' })).page!.id;

    const report = await mem.dream({ phase: 'curate' });
    const item = report.maintenancePlan!.items.find((entry) => entry.kind === 'rule_drift')!;
    const stored = mem.plan(report.maintenancePlan!.id).items.find((entry) => entry.id === item.id)!;
    expect(stored.evidence).toEqual([
      expect.objectContaining({
        sourceReferencesRewritten: true,
        sourcePageId: pageId,
      }),
    ]);
    const destination = stored.operations.find(
      (operation) => operation.type === 'create' && operation.relPath === 'archive/bo-winters.md',
    );
    expect(destination).toMatchObject({ type: 'create' });
    expect(destination?.type === 'create' ? destination.after : '').toBe(
      before
        .replace('../warranty.md', 'notes/warranty.md')
        .replace('[[notes/old/bo-winters#Details|this page]]', '[[archive/bo-winters#Details|this page]]'),
    );
    mem.decidePlan(
      report.maintenancePlan!.id,
      item.id,
      'approve',
      'The invented references retain their exact targets.',
    );
    const applied = await mem.applyPlan(report.maintenancePlan!.id);
    expect(applied.plan.items.find((entry) => entry.id === item.id)).toMatchObject({
      status: 'applied',
      verification: { status: 'passed' },
    });
    expect((await mem.read({ slug: 'archive/bo-winters' })).page!.id).toBe(pageId);
    expect(fs.existsSync(path.join(root, 'archive/bo-winters-3f8c1a2b.txt'))).toBe(true);

    const changeId = applied.plan.items.find((entry) => entry.id === item.id)!.changeId!;
    await mem.undo({ change_id: changeId });
    expect(fs.readFileSync(path.join(root, sourcePath), 'utf8')).toBe(before);
    expect((await mem.read({ slug: 'notes/old/bo-winters' })).page!.id).toBe(pageId);
    expect(fs.existsSync(path.join(root, documentPath))).toBe(true);
  });

  it('keeps relocation held for a relative local file the page does not own', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
      },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    const before = '# Bo Winters\n\nSee [shared evidence](evidence.txt).\n';
    fs.writeFileSync(path.join(root, 'notes/old/bo-winters.md'), before, 'utf8');
    fs.writeFileSync(path.join(root, 'notes/old/evidence.txt'), 'Invented shared evidence.\n', 'utf8');
    await mem.index({});

    const curate = await mem.dream({ phase: 'curate' });
    expect(curate.maintenancePlans.flatMap((plan) => plan.items)).not.toContainEqual(
      expect.objectContaining({ kind: 'rule_drift', subject: 'notes/old/bo-winters' }),
    );
    const housekeeping = await mem.dream({ phase: 'housekeeping' });
    expect(
      housekeeping.housekeeping!.drift.find((entry) => entry.slug === 'notes/old/bo-winters')?.repair,
    ).toMatchObject({ status: 'held', code: 'location_dependent_reference' });
    expect(fs.readFileSync(path.join(root, 'notes/old/bo-winters.md'), 'utf8')).toBe(before);
  });

  it('keeps relocation held when reference material has an incoming about relationship', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
        'manuals/**': { role: 'source' },
      },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    fs.mkdirSync(path.join(root, 'manuals'), { recursive: true });
    fs.writeFileSync(path.join(root, 'notes/old/bo-winters.md'), '# Bo Winters\n', 'utf8');
    const manual =
      '---\ntitle: Zephyr QX-100\nakno:\n  about:\n    - notes/old/bo-winters\n---\n\n# Manual\n';
    fs.writeFileSync(path.join(root, 'manuals/zephyr-qx-100.md'), manual, 'utf8');
    await mem.index({});

    const curate = await mem.dream({ phase: 'curate' });
    expect(curate.maintenancePlans.flatMap((plan) => plan.items)).not.toContainEqual(
      expect.objectContaining({ kind: 'rule_drift', subject: 'notes/old/bo-winters' }),
    );
    const housekeeping = await mem.dream({ phase: 'housekeeping' });
    expect(
      housekeeping.housekeeping!.drift.find((entry) => entry.slug === 'notes/old/bo-winters')?.repair,
    ).toMatchObject({ status: 'held', code: 'reference_about' });
    expect(fs.readFileSync(path.join(root, 'manuals/zephyr-qx-100.md'), 'utf8')).toBe(manual);
  });

  it('keeps relocation held when an incoming about relationship is inherited from folder policy', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: {
        'notes/**': { max_depth: 1, relocate_to: 'archive' },
        'archive/**': { role: 'knowledge' },
        'home/**': { about: ['notes/old/bo-winters'] },
      },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'notes/old'), { recursive: true });
    fs.writeFileSync(path.join(root, 'notes/old/bo-winters.md'), '# Bo Winters\n', 'utf8');
    const home = '---\ntitle: Invented Home\n---\n\n# Invented Home\n';
    fs.writeFileSync(path.join(root, 'home/index.md'), home, 'utf8');
    await mem.index({});

    const housekeeping = await mem.dream({ phase: 'housekeeping' });
    expect(
      housekeeping.housekeeping!.drift.find((entry) => entry.slug === 'notes/old/bo-winters')?.repair,
    ).toMatchObject({ status: 'held', code: 'about_unrewritable' });
    expect(fs.readFileSync(path.join(root, 'home/index.md'), 'utf8')).toBe(home);
  });

  it('never plans type correction for reference material', async () => {
    await mem.close();
    mem = await openMem({
      models: { derive: { id: null } },
      folders: { 'manuals/**': { role: 'source', type: 'manual' } },
      maintenance: { profile: 'audit', policies: { rule_drift: 'audit' } },
    });
    fs.mkdirSync(path.join(root, 'manuals'), { recursive: true });
    const before = '---\ntitle: Zephyr QX-100\ntype: note\n---\n\n# Manual\n';
    fs.writeFileSync(path.join(root, 'manuals/zephyr-qx-100.md'), before, 'utf8');
    await mem.index({});

    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlans.flatMap((plan) => plan.items)).not.toContainEqual(
      expect.objectContaining({ kind: 'rule_drift' }),
    );
    expect(fs.readFileSync(path.join(root, 'manuals/zephyr-qx-100.md'), 'utf8')).toBe(before);
    const housekeepingReport = await mem.dream({ phase: 'housekeeping' });
    expect(
      housekeepingReport.housekeeping!.drift.find((entry) => entry.slug === 'manuals/zephyr-qx-100'),
    ).toMatchObject({
      plan: null,
      repair: { status: 'held', code: 'role_not_knowledge' },
    });
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
      plannerVersion: 'dream-lifecycle-v2',
    });
    expect(first.verification).toEqual({
      status: 'passed',
      checkedAt: expect.any(String),
      plans: 0,
      appliedItems: 0,
      affectedFiles: 0,
      unattributedFiles: 0,
      checks: {
        appliedItems: 'not_applicable',
        affectedPaths: 'not_applicable',
        wholeSnapshot: 'passed',
        budget: 'passed',
        modelUsage: 'passed',
      },
      issues: [],
    });
    expect(first.run.verification).toEqual(first.verification);
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
    expect(before.results.filter((entry) => entry.type === 'page')).toHaveLength(0);
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
    expect(page).toContain('title: "Lease scan"');
    expect(page).toContain('![[lease scan.txt]]');
    // The file itself is untouched: only the inbox moves files, ever.
    expect(fs.existsSync(path.join(root, 'household/lease scan.txt'))).toBe(true);

    // The point of the phase, not just that a page appeared.
    expect((await mem.doctor({ probeModels: false })).counts.documentsUnsearchable).toBe(0);
    const found = await mem.recall({ query: 'lease runs to August 2027', mode: 'lookup' });
    const card = found.results.find(
      (entry) => entry.type === 'page' && entry.slug === 'household/lease-scan',
    );
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

    const housekeepingReport = await mem.dream({ phase: 'housekeeping' });
    const orphan = housekeepingReport.housekeeping!.orphanedDocuments.find(
      (entry) => entry.relPath === 'household/lease scan.txt',
    );
    expect(orphan?.plan).toMatchObject({
      planId: report.maintenancePlan!.id,
      itemId: report.maintenancePlan!.items[0]!.id,
      kind: 'adopt',
      policy: 'audit',
      status: 'proposed',
    });
    expect(housekeepingReport.housekeeping!.planBacked.orphanedDocuments).toBe(1);
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
    expect(report.autoEstimate).toMatchObject({ status: 'not_configured', curatorCalls: null });
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
    expect(record.applied[0].relPath).toBe(OBSERVE_TARGET);
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
