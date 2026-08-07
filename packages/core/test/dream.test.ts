import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * The maintenance cycle, end to end over a real knowledge base on disk.
 *
 * The chat model is a stub, because every case here is about what the *cycle* does with a
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
      const answer = user.startsWith('Page: ') ? derive(user, byPage) : scripted;
      if (!user.startsWith('Page: ')) lastObserve = user;

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
    });
  });

  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: () => new Promise<void>((resolve) => instance.close(() => resolve())),
    reply: (value) => {
      scripted = value;
    },
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
    '---\ntitle: Manual\nclass: reference\n---\n\n# Manual\n\nService the appliance every 6 months.\n',
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
        chat: { provider: 'stub', id: 'stub-chat' },
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
    expect(second.observations[0]!.action).toBe('unchanged');
    expect(fs.readFileSync(path.join(root, 'observations/home-appliance-servicing.md'), 'utf8')).toBe(first);
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

    server.reply({ conflict: true, current: 'home/kitchen' });
    const report = await mem.dream({ phase: 'conflicts' });

    expect(report.conflicts).toHaveLength(1);
    const conflict = report.conflicts[0]!;
    expect(conflict.verdict).toBe('real');
    expect(conflict.likelyCurrent).toBe('home/kitchen');
    expect(conflict.claims.map((claim) => claim.slug).sort()).toEqual(['home/appliances', 'home/kitchen']);
    // Reported, never repaired: both pages are exactly as they were.
    expect(fs.readFileSync(path.join(root, 'home/kitchen.md'), 'utf8')).toBe(PAGES['home/kitchen.md']);
  });

  it('believes the model when it says two claims do not conflict', async () => {
    server.facts(DISAGREEING);
    await mem.index({ rederive: true });

    server.reply({ conflict: false, current: null });
    const report = await mem.dream({ phase: 'conflicts' });
    expect(report.conflicts[0]!.verdict).toBe('not_a_conflict');
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

  it('says which phase could not run when the chat model is missing', async () => {
    await mem.close();
    mem = await openMem({ providers: {}, models: { chat: { id: null } } });

    const report = await mem.dream({});
    const observe = report.phases.find((phase) => phase.phase === 'observe');
    expect(observe?.ran).toBe(false);
    expect(observe?.skipped).toMatch(/no chat model/);
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
          chat: { provider: 'stub', id: 'stub-chat' },
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
    // Off by default from measurement: on a real base with a small chat model, most of what it
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
