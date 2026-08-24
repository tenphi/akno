import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * End-to-end over a real knowledge base on disk, with **no models configured**.
 * That is deliberate: the rule is degrade, never fail, and the most important thing
 * to prove is that a knowledge base with no embedding model, no reranker and no
 * model still indexes, still searches, and still says what it lost.
 */

const KB = {
  'index.md': `---
title: Index
---

# Index

What the folders are for. [[home/lease]] and [[people/ada-marlow]].
`,

  'timeline.md': `---
type: timeline
title: Timeline
---

# Timeline

## 2026
- **2026-06-02** | Renewed the apartment lease for another year. [[home/lease]]
- **2026-03-20** | Replaced the dishwasher — Zephyr, five-year warranty. [[home/appliances]]
`,

  'home/lease.md': `---
title: Apartment lease
type: contract
tags: [home, legal]
---

# Apartment lease

## Terms
- Landlord: Bo Winters
- Rent: 1111 EUR per month
- Renews: 2027-06-02

Related: [[people/ada-marlow]]

- **2024-08-05** | Signed the lease.
`,

  'home/appliances.md': `---
title: Appliances
tags: [home]
---

# Appliances

## Dishwasher
Zephyr QX-100, installed 2026-03-20, five-year warranty.
`,

  'people/ada-marlow.md': `---
title: Ada Marlow
type: person
---

# Ada Marlow

Prefers email over calls. Second driver on the car insurance.
`,

  'reference/building-rules.md': `---
title: Building rules
---

# Building rules

<!-- source -->

HOUSE RULES OF THE ASSOCIATION

Article 1. No deliveries after 20:00.
Article 2. Bicycles must be stored in the designated racks.
Article 3. Quiet hours are 22:00 to 07:00 on weekdays.
Article 4. Waste must be separated.
Article 5. The lift may not be used for moving furniture.
Article 6. Balcony plants may not overhang the railing.
Article 7. Subletting requires written consent.
`,

  'templates/page.md': `---
title: Template
---

# {{title}}

Placeholder body that should never be indexed.
`,

  'documents/passport-ada.md': `---
title: Passport (Ada)
type: document
---

# Passport (Ada)

Placeholder identity document, expires 2033.
`,

  // A plain attachment beside its page — the shape an existing knowledge base
  // already has, not the content-addressed one Akno would create.
  'documents/passport-ada.pdf': '%PDF-1.4 fake bytes for the test\n',

  'nested/deep/note.md': `# A deep note

It mentions the dishwasher too.
`,

  'broken.md': `# Broken

This links to [[nowhere/at-all]].
`,
};

let root: string;
let stateDir: string;
let mem: Akno;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-state-'));

  for (const [relPath, content] of Object.entries(KB)) {
    const absPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }

  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      // No models. Every model-backed feature must degrade, not fail.
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
      folders: {
        'reference/**': { role: 'source' },
        'templates/**': { role: 'ignored' },
      },
    },
  });

  await mem.index({});
});

afterAll(async () => {
  await mem?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('index', () => {
  it('indexes every page except the excluded folder', async () => {
    const health = await mem.doctor({ probeModels: false });
    // 10 markdown files, one of which is under templates/**.
    expect(health.counts.pages).toBe(9);
    expect(health.byRole.ignored).toBeUndefined();
    expect(health.byRole.source).toBe(1);
  });

  it('leaves nothing behind for an excluded page', async () => {
    await expect(mem.read({ slug: 'templates/page' })).rejects.toThrow(/no page/);
  });

  it('is a no-op when nothing changed', async () => {
    const report = await mem.index({});
    expect(report.pagesIndexed).toBe(0);
    expect(report.pagesUnchanged).toBe(10);
    expect(report.hashed).toBe(0);
  });

  it('links a plain attachment to the page beside it', async () => {
    const page = await mem.read({ slug: 'documents/passport-ada' });
    expect(page.page?.documents?.[0]?.rel_path).toBe('documents/passport-ada.pdf');
  });

  it('reads a `.txt` beside a document as that document, not as a second one', async () => {
    // Whoever wrote it — Akno or a person with `pdftotext` — a file named after another
    // file is a rendering of it. Indexing it as a document of its own is what would return
    // every phrase in the passport twice.
    fs.writeFileSync(
      path.join(root, 'documents/passport-ada.pdf.txt'),
      'Passport of Ada Marlow, expires 2033.\n',
      'utf8',
    );
    await mem.index({});

    const health = await mem.doctor({ probeModels: false });
    expect(health.counts.renditions).toBe(1);
    expect(health.counts.documents).toBe(1);

    const page = await mem.read({ slug: 'documents/passport-ada' });
    expect(page.page?.documents?.map((entry) => entry.rel_path).sort()).toEqual([
      'documents/passport-ada.pdf',
      'documents/passport-ada.pdf.txt',
    ]);
    // And reading it gets the document it renders.
    const rendition = page.page!.documents!.find((entry) => entry.rel_path.endsWith('.txt'))!;
    expect((await mem.read({ document: rendition.id })).document?.rel_path).toBe(
      'documents/passport-ada.pdf',
    );

    fs.rmSync(path.join(root, 'documents/passport-ada.pdf.txt'));
    await mem.index({});
  });

  it('reports a link that points nowhere', async () => {
    const page = await mem.read({ slug: 'broken' });
    expect(page.page?.broken_links).toEqual(['nowhere/at-all']);
  });

  it('records backlinks in both directions', async () => {
    const ada = await mem.read({ slug: 'people/ada-marlow' });
    expect(ada.page?.backlinks).toContain('home/lease');
    expect(ada.page?.backlinks).toContain('index');
  });
});

describe('recall without any model', () => {
  it('finds a page lexically and reports why it is degraded', async () => {
    const result = await mem.recall({ query: 'dishwasher Zephyr warranty', mode: 'lookup' });
    expect(result.status).toBe('degraded');
    // Absence — and weakness — has a *reason*, not a silent empty result.
    expect(result.degraded).toContain('no_embedding_model');
    expect(result.cards.map((card) => card.slug)).toContain('home/appliances');
  });

  it('returns a line address on every line it quotes', async () => {
    const result = await mem.recall({ query: 'rent per month landlord', mode: 'lookup' });
    const card = result.cards.find((entry) => entry.slug === 'home/lease');
    expect(card).toBeDefined();
    expect(card!.lines.length).toBeGreaterThan(0);
    for (const line of card!.lines) {
      // The address has to be real: the line at that number must be the text.
      const actual = fs.readFileSync(path.join(root, 'home/lease.md'), 'utf8').split('\n')[line.n - 1];
      expect(actual).toBe(line.text);
    }
  });

  it('caps what a reference page contributes unprompted', async () => {
    const result = await mem.recall({
      query: 'deliveries bicycles quiet hours waste lift balcony',
      mode: 'lookup',
    });
    const card = result.cards.find((entry) => entry.slug === 'reference/building-rules');
    expect(card).toBeDefined();
    // The page has seven articles; the quote window defaults to six lines.
    expect(card!.lines.length).toBeLessThanOrEqual(6);
    expect(card!.truncated).toBe(true);
  });

  it('lifts the cap when asked explicitly — class is relevance, not access control', async () => {
    const result = await mem.recall({
      query: 'deliveries bicycles quiet hours waste lift balcony subletting',
      mode: 'lookup',
      depth: 'full',
      include: ['source'],
    });
    const card = result.cards.find((entry) => entry.slug === 'reference/building-rules');
    expect(card!.lines.length).toBeGreaterThan(6);
  });

  it('returns the full body of a reference page from read, every time', async () => {
    const page = await mem.read({ slug: 'reference/building-rules' });
    expect(page.page?.lines.some((line) => line.text.includes('Subletting'))).toBe(true);
  });

  it('proves absence rather than implying it', async () => {
    const result = await mem.recall({ query: 'zzzzz nonexistent unicorn ledger', mode: 'lookup' });
    expect(['empty', 'degraded']).toContain(result.status);
    expect(result.cards).toHaveLength(0);
    // The queries that found nothing are the proof.
    expect(result.searched.length).toBeGreaterThan(0);
    expect(result.note).toBeTruthy();
  });

  it('honours a folder filter', async () => {
    const result = await mem.recall({ query: 'dishwasher', filter: { folder: 'nested' } });
    for (const card of result.cards) expect(card.slug.startsWith('nested/')).toBe(true);
  });

  it('reports coverage in question mode', async () => {
    const result = await mem.recall({ query: 'what is the rent and who is the landlord?', mode: 'question' });
    expect(result.mode).toBe('question');
    expect(result.coverage).toBeDefined();
    expect(Object.keys(result.coverage!).length).toBeGreaterThan(0);
  });

  it('fits a budget, and says when it dropped something', async () => {
    const result = await mem.recall({ query: 'the', mode: 'explore', budget: 120, limit: 20 });
    expect(result.budget_used).toBeLessThanOrEqual(400);
  });
});

describe('timeline', () => {
  it('indexes ledger lines and dated lines on ordinary pages alike', async () => {
    const result = await mem.timeline({ limit: 50 });
    const dates = result.events.map((event) => event.date);
    expect(dates).toContain('2026-06-02');
    // This one is written on home/lease.md, not in the ledger.
    expect(dates).toContain('2024-08-05');
  });

  it('carries the link and the source address', async () => {
    const result = await mem.timeline({ match: 'dishwasher' });
    expect(result.events[0]?.slug).toBe('home/appliances');
    expect(result.events[0]?.source).toBe('timeline');
    expect(result.events[0]?.line).toBeGreaterThan(0);
  });

  it('filters by range', async () => {
    const result = await mem.timeline({ since: '2026-04', until: '2026-12' });
    expect(result.events.map((event) => event.date)).toEqual(['2026-06-02']);
  });

  it('filters by subject in both senses', async () => {
    const linked = await mem.timeline({ subject: 'home/lease' });
    // The ledger line links to it, and the page carries its own dated line.
    expect(linked.events.length).toBe(2);
  });
});

describe('list', () => {
  it('walks folders with deep counts and the governing rule', async () => {
    const result = await mem.list({ kind: 'folders' });
    const reference = result.folders?.find((folder) => folder.path === 'reference');
    expect(reference?.rule?.role).toBe('source');
    const nested = result.folders?.find((folder) => folder.path === 'nested');
    expect(nested?.pages_deep).toBe(1);
  });

  it('filters pages by type and by tag', async () => {
    const byType = await mem.list({ kind: 'pages', type: 'person' });
    expect(byType.pages?.map((page) => page.slug)).toEqual(['people/ada-marlow']);

    const byTag = await mem.list({ kind: 'pages', tag: 'home' });
    expect(byTag.pages?.length).toBe(2);
  });

  it('produces a tree outline', async () => {
    const result = await mem.list({ kind: 'tree', depth: 2 });
    expect(result.tree).toContain('home/');
    expect(result.tree).toContain('nested/');
    expect(result.tree).not.toContain('templates/');
  });
});

describe('context', () => {
  it('assembles pinned pages, timeline and recall against one budget', async () => {
    const result = await mem.context({
      query: 'what is the rent?',
      budget: 4000,
      pinned: ['people/ada-marlow'],
      timeline_days: 100000,
      structure: true,
    });
    expect(result.pinned.map((card) => card.slug)).toEqual(['people/ada-marlow']);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.structure).toBeTruthy();
    expect(result.budget_used).toBeLessThanOrEqual(4000);
    // A pinned page must not be paid for twice.
    expect(result.cards.map((card) => card.slug)).not.toContain('people/ada-marlow');
  });

  it('survives a stale pin', async () => {
    const result = await mem.context({ budget: 2000, pinned: ['gone/missing'], structure: false });
    expect(result.dropped?.cards).toBeGreaterThan(0);
  });

  it('auto-recall injects exact evidence without ambient context or model qualification', async () => {
    const result = await mem.context({
      profile: 'auto_recall',
      query: 'What does Ada Marlow prefer?',
      budget: 240,
      // These broad-context inputs are deliberately ignored by this profile.
      pinned: ['home/lease'],
      timeline_days: 100000,
      structure: true,
    });

    expect(result.profile).toBe('auto_recall');
    expect(result.activation).toMatchObject({
      activated: true,
      basis: 'exact',
      qualification_run: false,
    });
    expect(result.results.map((entry) => (entry.type === 'page' ? entry.slug : entry.path))).toContain(
      'people/ada-marlow',
    );
    expect(result.pinned).toEqual([]);
    expect(result.timeline).toEqual([]);
    expect(result.structure).toBeUndefined();
    expect(result.budget_used).toBeLessThanOrEqual(240);
    expect(result.searched).toEqual(['What does Ada Marlow prefer?']);
    expect(result.cards.every((card) => card.summary === null && card.links === undefined)).toBe(true);
  });

  it('uses bounded recent context only to resolve a local reference', async () => {
    const result = await mem.context({
      profile: 'auto_recall',
      query: 'When does it renew?',
      conversation_context: [
        { role: 'user', content: 'We were discussing the apartment lease.' },
        { role: 'assistant', content: 'I can check the lease terms.' },
      ],
      budget: 240,
    });

    expect(result.activation?.activated).toBe(true);
    expect(result.results.some((entry) => entry.type === 'page' && entry.slug === 'home/lease')).toBe(true);
    // The receipt echoes neither the resolving turns nor the combined internal retrieval query.
    expect(result.searched).toEqual(['When does it renew?']);
  });

  it('returns no speculative auto-recall evidence when relevance is weak', async () => {
    const result = await mem.context({
      profile: 'auto_recall',
      query: 'Draft a cheerful greeting',
      budget: 240,
    });

    expect(result.activation).toMatchObject({ activated: false, basis: 'none', selected: 0 });
    expect(result.results).toEqual([]);
    // This fixture deliberately has no embedding model, so absence is degraded rather than proof of no match.
    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('no_embedding_model');
  });

  it('tries qualification only for a plausible result and abstains when none is calibrated', async () => {
    const result = await mem.context({ profile: 'auto_recall', query: 'rent', budget: 240 });

    expect(result.activation).toMatchObject({
      activated: false,
      basis: 'none',
      qualification_run: true,
    });
    expect(result.results).toEqual([]);
  });

  it('does not treat an exact identity as evidence for an absent attribute', async () => {
    const result = await mem.context({
      profile: 'auto_recall',
      query: 'What is Ada Marlow phone number?',
      budget: 240,
    });

    expect(result.activation).toMatchObject({ activated: false, qualification_run: true });
    expect(result.results).toEqual([]);
  });

  it('treats the auto-recall budget as a hard evidence ceiling', async () => {
    const result = await mem.context({
      profile: 'auto_recall',
      query: 'What does Ada Marlow prefer?',
      budget: 1,
    });

    expect(result.results).toEqual([]);
    expect(result.activation?.activated).toBe(false);
    expect(result.budget_used).toBe(0);
    expect(result.dropped?.cards).toBeGreaterThan(0);
  });

  it('requires a current prompt and bounds recent context for auto-recall', async () => {
    await expect(mem.context({ profile: 'auto_recall', budget: 240 } as never)).rejects.toThrow(
      /invalid input/,
    );
    await expect(
      mem.context({
        profile: 'auto_recall',
        query: 'When does it renew?',
        conversation_context: Array.from({ length: 4 }, () => ({
          role: 'user' as const,
          content: 'x'.repeat(1600),
        })),
        budget: 240,
      }),
    ).rejects.toThrow(/invalid input/);
  });
});

describe('input validation', () => {
  it('rejects an ingest with neither a path nor a url', async () => {
    await expect(mem.ingest({})).rejects.toThrow(/invalid/i);
  });

  it('reports a missing file rather than throwing something opaque', async () => {
    await expect(mem.ingest({ path: '/tmp/definitely-not-here.pdf' })).rejects.toThrow(/no file at/);
  });

  it('fetches only http and https', async () => {
    // `file://` would turn `ingest({url})` into a way to read any path on the machine
    // through an interface that looks like it fetches the web.
    await expect(mem.ingest({ url: 'ftp://example.com/x.pdf' })).rejects.toThrow(/only http and https/);
  });

  it('validates a write input before doing anything', async () => {
    // Two body operations at once is a schema violation and must be caught as
    // `invalid`, not acted on.
    await expect(mem.write({ slug: 'a/b', content: 'x', append: 'y' })).rejects.toThrow(/invalid/i);
  });
});

describe('reconciling a hand edit', () => {
  it('follows a rename by content and keeps the page id', async () => {
    const before = await mem.read({ slug: 'nested/deep/note' });
    const pageId = before.page!.id;

    fs.mkdirSync(path.join(root, 'nested/other'), { recursive: true });
    fs.renameSync(path.join(root, 'nested/deep/note.md'), path.join(root, 'nested/other/renamed.md'));

    const report = await mem.index({});
    expect(report.pagesRenamed).toBe(1);

    const after = await mem.read({ slug: 'nested/other/renamed' });
    // The id survives, which is what keeps facts and journal history attached.
    expect(after.page!.id).toBe(pageId);
    await expect(mem.read({ slug: 'nested/deep/note' })).rejects.toThrow(/no page/);
  });

  it('picks up an edit and retires what is gone', async () => {
    const lease = path.join(root, 'home/lease.md');
    fs.writeFileSync(lease, fs.readFileSync(lease, 'utf8').replace('1111 EUR', '2222 EUR'), 'utf8');

    await mem.index({});
    const result = await mem.recall({ query: 'rent per month', mode: 'lookup' });
    const card = result.cards.find((entry) => entry.slug === 'home/lease');
    expect(card!.lines.some((line) => line.text.includes('2222'))).toBe(true);
    expect(card!.lines.some((line) => line.text.includes('1111'))).toBe(false);
  });

  it('re-reads a page file the index lost the page for', async () => {
    // The state a reorganization can leave: the `pages` row gone, the `files` row intact and
    // pointing at it. The stat fast path then calls the file unchanged forever, so the note
    // is on disk and unreachable — the folder and the index disagreeing, which is the one
    // thing the index may not do.
    const before = await mem.read({ slug: 'home/lease' });
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(path.join(stateDir, 'akno.db'));
    db.prepare('DELETE FROM pages WHERE slug = ?').run('home/lease');
    db.close();

    const report = await mem.index({});
    expect(report.warnings.some((warning) => /nothing indexed for them/.test(warning))).toBe(true);
    expect((await mem.read({ slug: 'home/lease' })).page?.rel_path).toBe(before.page?.rel_path);
  });

  it('keeps a page’s identity when a scoped pass sees the move', async () => {
    // What the watcher runs. A folder renamed in Obsidian arrives as departures and arrivals
    // in one scoped pass, and refusing to look at the departures split the pair: the arrival
    // became a new page, and the original could only be deleted — losing every fact, link and
    // journal entry hanging off its id.
    const before = await mem.read({ slug: 'home/lease' });
    const body = fs.readFileSync(path.join(root, 'home/lease.md'));
    fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
    fs.writeFileSync(path.join(root, 'archive/lease.md'), body);
    fs.rmSync(path.join(root, 'home/lease.md'));

    const report = await mem.index({ only: ['home/lease.md', 'archive/lease.md'] });
    expect(report.pagesRenamed).toBe(1);
    expect(report.pagesRemoved).toBe(0);

    const after = await mem.read({ slug: 'archive/lease' });
    expect(after.page?.id).toBe(before.page?.id);
    await expect(mem.read({ slug: 'home/lease' })).rejects.toThrow(/no page/);
  });

  it('removes a deleted page from the index', async () => {
    fs.rmSync(path.join(root, 'broken.md'));
    const report = await mem.index({});
    expect(report.pagesRemoved).toBe(1);
    await expect(mem.read({ slug: 'broken' })).rejects.toThrow(/no page/);
  });

  it('leaves the knowledge base byte-identical when write_ids is off', async () => {
    // Every file, hashed, before and after — not just the ones this test wrote, and not just
    // their frontmatter. The claim four documents make is that an index pass changes nothing
    // in the folder, and a check that only looks for an injected `id:` in known Markdown
    // cannot see a file appearing, a file vanishing, or a body being rewritten.
    const before = snapshot(root);
    await mem.index({});
    expect(snapshot(root)).toEqual(before);
  });
});

/** Every file under `dir`, relative path to content hash. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (absDir: string, relDir: string): void => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(absDir, entry.name), rel);
      else if (entry.isFile()) {
        out[rel] = createHash('sha256')
          .update(fs.readFileSync(path.join(absDir, entry.name)))
          .digest('hex');
      }
    }
  };
  walk(dir, '');
  return out;
}

describe('rebuilding the index', () => {
  it('reproduces everything from the Markdown alone', async () => {
    const before = await mem.doctor({ probeModels: false });
    await mem.close();

    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(path.join(stateDir, `akno.db${suffix}`), { force: true });
    }

    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: {},
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { id: null },
          expansion: { id: null },
        },
        folders: { 'reference/**': { role: 'source' }, 'templates/**': { role: 'ignored' } },
      },
    });
    await mem.index({});

    const after = await mem.doctor({ probeModels: false });
    // `rm akno.db && akno index` reproduces every chunk, event and link.
    expect(after.counts.pages).toBe(before.counts.pages);
    expect(after.counts.chunks).toBe(before.counts.chunks);
    expect(after.counts.events).toBe(before.counts.events);
    expect(after.counts.links).toBe(before.counts.links);
  });
});

/**
 * Akno owns what a handful of paths *mean*, and the rule for all of them is
 * the same: if one already exists and isn't what Akno expects, leave it
 * completely alone. Warn, point at the config key, refuse to start.
 */
describe('reserved paths', () => {
  let scratch: string;
  let scratchState: string;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-reserved-kb-'));
    scratchState = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-reserved-state-'));
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(scratchState, { recursive: true, force: true });
  });

  const openScratch = (createReserved: boolean) =>
    open({
      aknoPath: scratch,
      stateDir: scratchState,
      isolated: true,
      overrides: {
        akno_path: scratch,
        state_dir: scratchState,
        create_reserved_paths: createReserved,
        providers: {},
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { id: null },
          expansion: { id: null },
        },
      },
    });

  it('refuses to start rather than adopt a timeline.md that means something else', async () => {
    fs.writeFileSync(
      path.join(scratch, 'timeline.md'),
      '# Project timeline\n\nQ1: hire. Q2: ship. Q3: rest.\n',
      'utf8',
    );
    // Appending ledger lines into the middle of someone's project plan is not a
    // recoverable mistake, so this must be a refusal and not a warning.
    await expect(openScratch(true)).rejects.toThrow(/does not look like an event ledger/);
  });

  it('creates a ledger when there is none and it was asked to', async () => {
    const scratchMem = await openScratch(true);
    const written = fs.readFileSync(path.join(scratch, 'timeline.md'), 'utf8');
    expect(written).toMatch(/^#\s*Timeline/m);
    expect(fs.existsSync(path.join(scratch, 'inbox', 'README.md'))).toBe(true);
    await scratchMem.close();
  });

  it('creates nothing at all by default', async () => {
    const scratchMem = await openScratch(false);
    expect(fs.readdirSync(scratch)).toEqual([]);
    await scratchMem.close();
  });

  it('accepts an existing ledger and appends nothing on open', async () => {
    const ledger = '# Timeline\n\n## 2026\n- **2026-01-02** | Something happened.\n';
    fs.writeFileSync(path.join(scratch, 'timeline.md'), ledger, 'utf8');
    const scratchMem = await openScratch(true);
    expect(fs.readFileSync(path.join(scratch, 'timeline.md'), 'utf8')).toBe(ledger);
    await scratchMem.close();
  });
});

/**
 * A rule is config, not content — so changing one has to reach pages whose files
 * have not been touched since. Without that, adding `class: excluded` to a folder and
 * re-indexing reports "everything unchanged" and leaves those pages indexed, searchable
 * and asserted as facts: the config silently doing nothing.
 */
describe('changing a rule', () => {
  let scratch: string;
  let scratchState: string;

  const openWith = (folders: Record<string, unknown>): Promise<Akno> =>
    open({
      aknoPath: scratch,
      stateDir: scratchState,
      isolated: true,
      overrides: {
        akno_path: scratch,
        state_dir: scratchState,
        providers: {},
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { id: null },
          expansion: { id: null },
        },
        folders,
      },
    });

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-rules-kb-'));
    scratchState = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-rules-state-'));
    fs.mkdirSync(path.join(scratch, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'notes.md'), '# Notes\n\nRent is 1111 EUR per month.\n');
    fs.writeFileSync(path.join(scratch, 'logs/monday.md'), '# Monday\n\nA long transcript of talking.\n');
    fs.writeFileSync(
      path.join(scratch, 'logs/declared.md'),
      '---\nakno:\n  role: knowledge\n---\n\n# Declared\n\nThis page states its own role.\n',
    );
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(scratchState, { recursive: true, force: true });
  });

  it('re-indexes pages whose class moved, without the files changing', async () => {
    let handle = await openWith({});
    let report = await handle.index({});
    expect(report.pagesIndexed).toBe(3);
    await handle.close();

    // Nothing on disk changed between these two passes. Only the rule did.
    handle = await openWith({ 'logs/**': { role: 'ignored' } });
    report = await handle.index({});
    expect(report.ignored).toBe(1);
    expect(report.warnings.some((w) => /rules changed/.test(w))).toBe(true);

    const listed = await handle.list({});
    expect(listed.pages?.map((page) => page.slug) ?? []).not.toContain('logs/monday');
    // A class the page declares in its own frontmatter outranks any rule, so this one
    // is not the rule's to move.
    const declared = await handle.read({ slug: 'logs/declared' });
    expect(declared.page?.role).toBe('knowledge');
    await handle.close();
  });

  it('brings a page back when the rule stops excluding it', async () => {
    let handle = await openWith({ 'logs/**': { role: 'ignored' } });
    await handle.index({});
    await handle.close();

    handle = await openWith({ 'logs/**': { role: 'source' } });
    const report = await handle.index({});
    expect(report.ignored).toBe(0);
    const page = await handle.read({ slug: 'logs/monday' });
    expect(page.page?.role).toBe('source');
    // Reference pages are still searchable — the class governs what recall pulls in
    // unprompted, not whether the text is indexed.
    const found = await handle.recall({ query: 'transcript talking', mode: 'lookup' });
    expect(found.cards.map((card) => card.slug)).toContain('logs/monday');
    await handle.close();
  });

  it('reads rules from the knowledge base without indexing the file that holds them', async () => {
    // `akno.json` lives inside the notes, and rules travel with them — but the file
    // is Akno's own configuration, not memory. It was being registered as an attachment
    // of the root, which is how a taxonomy ends up reported by `doctor` as a document whose
    // contents could not be extracted.
    fs.writeFileSync(
      path.join(scratch, 'akno.json'),
      JSON.stringify({ folders: { 'logs/**': { role: 'source' } } }),
    );

    const handle = await openWith({});
    await handle.index({});

    const page = await handle.read({ slug: 'logs/monday' });
    expect(page.page?.role).toBe('source');

    const report = await handle.doctor({ probeModels: false });
    expect(report.counts.documents).toBe(0);
    await handle.close();
  });

  it('costs nothing when the rules have not moved', async () => {
    let handle = await openWith({ 'logs/**': { role: 'source' } });
    await handle.index({});
    await handle.close();

    handle = await openWith({ 'logs/**': { role: 'source' } });
    const report = await handle.index({});
    expect(report.pagesIndexed).toBe(0);
    expect(report.pagesUnchanged).toBe(3);
    expect(report.warnings.some((w) => /rules changed/.test(w))).toBe(false);
    await handle.close();
  });
});
