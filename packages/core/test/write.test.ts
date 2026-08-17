import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { readJsoncFile } from '../src/config/jsonc.ts';

/**
 * The write path end to end, on a real knowledge base on disk, with
 * **no models configured**.
 *
 * That last part is the interesting constraint: gating, conflict detection, the
 * ledger, the journal and undo must all work with the whole model stack absent.
 * Inline conflict detection is cheap and structural precisely so it does not
 * need a model, and the first implementation failed that — it joined a structural
 * attribute against a model-assigned one and silently never matched.
 */

const KB: Record<string, string> = {
  'timeline.md': ['# Timeline', '', '## 2026', '- **2026-03-20** | Something earlier.', ''].join('\n'),
  'home/lease.md': [
    '---',
    'title: Apartment lease',
    'type: contract',
    '---',
    '',
    '# Apartment lease',
    '',
    '- Rent: 1111 EUR',
    '- Term: 12 months',
    '',
  ].join('\n'),
  'home/appliances.md': '# Appliances\n\n- Dishwasher: Zephyr QX-100\n',
  'people/ada-marlow.md': '---\ntitle: Ada Marlow\ntype: person\n---\n\n# Ada Marlow\n\nPrefers email.\n',
};

let root: string;
let stateDir: string;

async function openAs(actor: 'user' | 'agent'): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor,
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
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-write-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-write-state-'));
  for (const [relPath, content] of Object.entries(KB)) {
    fs.mkdirSync(path.dirname(path.join(root, relPath)), { recursive: true });
    fs.writeFileSync(path.join(root, relPath), content, 'utf8');
  }
  const mem = await openAs('agent');
  await mem.index({});
  await mem.close();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

const read = (relPath: string): string => fs.readFileSync(path.join(root, relPath), 'utf8');

describe('write', () => {
  it('creates a page with a heading and its own frontmatter', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({
      slug: 'home/wifi',
      content: '- SSID: Attic\n- Devices: 11',
      title: 'Wifi',
      type: 'note',
      tags: ['home'],
    });
    expect(result.outcome).toBe('ok');
    const content = read('home/wifi.md');
    expect(content).toContain('title: Wifi');
    expect(content).toContain('type: note');
    expect(content).toContain('tags: [home]');
    expect(content).toContain('# Wifi');
    expect(content).toContain('- SSID: Attic');
    await mem.close();
  });

  it('does not add a second heading when the content already has one', async () => {
    const mem = await openAs('agent');
    await mem.write({ slug: 'home/notes', content: '# My own heading\n\nBody.' });
    expect(read('home/notes.md').match(/^#\s/gm)).toHaveLength(1);
    await mem.close();
  });

  it('indexes what it writes — the write and the index must not disagree', async () => {
    // The first implementation recorded the new hash in `files` *before* indexing,
    // so the stat fast path concluded "unchanged" and the page never reached the
    // index. It existed on disk and was invisible to recall.
    const mem = await openAs('agent');
    await mem.write({ slug: 'home/wifi', content: 'Attic network.' });
    const page = await mem.read({ slug: 'home/wifi' });
    expect(page.page?.slug).toBe('home/wifi');
    const found = await mem.recall({ query: 'attic network', mode: 'lookup' });
    expect(found.cards.map((card) => card.slug)).toContain('home/wifi');
    await mem.close();
  });

  it('appends without merging into the previous line', async () => {
    const mem = await openAs('agent');
    await mem.write({ slug: 'home/lease', append: '- Deposit: 2222 EUR' });
    expect(read('home/lease.md')).toContain('- Term: 12 months\n\n- Deposit: 2222 EUR');
    await mem.close();
  });

  it('leaves frontmatter byte for byte', async () => {
    const mem = await openAs('agent');
    await mem.write({ slug: 'home/lease', append: '- Deposit: 2222 EUR' });
    expect(read('home/lease.md').startsWith('---\ntitle: Apartment lease\ntype: contract\n---\n')).toBe(true);
    await mem.close();
  });

  it('adopts a frontmatter block sent with the content instead of nesting a second one', async () => {
    // The round trip that produced two blocks on `travel/2027/japan-trip`: `read` returns the
    // file including its frontmatter, so a revised page comes back carrying one. It is also
    // the only way a caller can state `role`, `management` or `temporal` at all.
    const mem = await openAs('agent');
    const result = await mem.write({
      slug: 'home/lease',
      content:
        '---\ntitle: Apartment lease\nakno:\n  role: knowledge\n---\n\n# Apartment lease\n\n- Rent: 1111 EUR\n',
    });
    expect(result.outcome).toBe('ok');
    const content = read('home/lease.md');
    expect(content.match(/^---$/gm)).toHaveLength(2);
    expect(content).toContain('role: knowledge');
    // `type: contract` was on the page and not in what came back — allowed, and reported.
    expect(result.note).toMatch(/dropping `type`/);
    const page = await mem.read({ slug: 'home/lease' });
    expect(page.page?.role).toBe('knowledge');
    await mem.close();
  });

  it('keeps a caller-declared block verbatim on a page it is creating', async () => {
    const mem = await openAs('agent');
    await mem.write({
      slug: 'home/japan-trip',
      content:
        '---\ntitle: "Japan Trip 2027"\nakno:\n  role: knowledge\n  temporal:\n    kind: event\n    until: 2027-06-08\n---\n\n# Japan Trip 2027\n\nOsaka, then Fukuoka.\n',
      title: 'Ignored in favour of the block',
    });
    const content = read('home/japan-trip.md');
    expect(content.match(/^---$/gm)).toHaveLength(2);
    expect(content).toContain('title: "Japan Trip 2027"');
    expect(content).not.toContain('Ignored in favour');
    expect(content.match(/^#\s/gm)).toHaveLength(1);
    await mem.close();
  });

  it('reports a noop rather than journalling a change that changed nothing', async () => {
    const mem = await openAs('agent');
    const first = await mem.write({ slug: 'home/lease', content: 'Same body.' });
    const second = await mem.write({ slug: 'home/lease', content: 'Same body.' });
    expect(first.outcome).toBe('ok');
    expect(second.outcome).toBe('noop');
    expect(mem.changes().filter((change) => change.op === 'write')).toHaveLength(1);
    await mem.close();
  });

  it('touches nothing on a dry run', async () => {
    const mem = await openAs('agent');
    const before = read('home/lease.md');
    const result = await mem.write({ slug: 'home/lease', append: '- X: 1', dry_run: true });
    expect(result.outcome).toBe('ok');
    expect(read('home/lease.md')).toBe(before);
    expect(mem.changes()).toHaveLength(0);
    await mem.close();
  });

  it('refuses a slug that would escape the knowledge base', async () => {
    const mem = await openAs('agent');
    for (const slug of ['../outside', '/etc/passwd', 'a/../../b', '~/x']) {
      await expect(mem.write({ slug, content: 'x' })).rejects.toThrow();
    }
    await mem.close();
  });
});

/**
 * Bias toward numbers, dates and identifiers, where conflicts are real and
 * detectable. **When uncertain, write — do not block.**
 */
describe('conflict detection', () => {
  it('flags two different values for the same attribute, before writing', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'home/lease', append: '- Rent: 2222 EUR' });
    expect(result.outcome).toBe('conflict');
    expect(result.conflict?.existing).toBe('- Rent: 1111 EUR');
    expect(result.conflict?.line).toBe(8);
    // Nothing was written.
    expect(read('home/lease.md')).not.toContain('2222');
    await mem.close();
  });

  it('works with no model at all — that is what "cheap" means', async () => {
    const mem = await openAs('agent');
    const health = await mem.doctor({ probeModels: false });
    expect(health.models.find((role) => role.role === 'derive')?.available).toBe(false);
    expect((await mem.write({ slug: 'home/lease', append: '- Rent: 2222 EUR' })).outcome).toBe('conflict');
    await mem.close();
  });

  it('proceeds when the caller resolves that exact conflict', async () => {
    const mem = await openAs('agent');
    const blocked = await mem.write({ slug: 'home/lease', append: '- Rent: 2222 EUR' });
    const result = await mem.write({
      slug: 'home/lease',
      append: '- Rent: 2222 EUR',
      resolve_conflict: blocked.conflict!.token,
    });
    expect(result.outcome).toBe('ok');
    expect(read('home/lease.md')).toContain('- Rent: 2222 EUR');
    await mem.close();
  });

  it('does not accept a token for a different conflict', async () => {
    // A plain boolean override would wave through whatever conflict turned up next,
    // which is the same as not checking.
    const mem = await openAs('agent');
    const blocked = await mem.write({ slug: 'home/lease', append: '- Rent: 2222 EUR' });
    const other = await mem.write({
      slug: 'home/lease',
      append: '- Term: 24 months',
      resolve_conflict: blocked.conflict!.token,
    });
    expect(other.outcome).toBe('conflict');
    expect(other.conflict?.subject).toBe('term');
    await mem.close();
  });

  it('does not flag the same value written a different way', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'home/lease', append: '- Rent: 1111 EUR per month' });
    expect(result.outcome).toBe('ok');
    await mem.close();
  });

  it('does not flag free prose — when uncertain, write', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({
      slug: 'home/lease',
      append: 'The landlord mentioned the building might be resurfaced.',
    });
    expect(result.outcome).toBe('ok');
    await mem.close();
  });
});

/**
 * **A folder must be described before a page can appear in it — and describing it asks
 * nobody.**
 *
 * This replaced an approval, and the difference is what these assert. Nothing files a
 * proposal, nothing waits on the owner, and the refusal tells the caller what to do rather
 * than who to wait for. The old arrangement taught an agent that a new folder might be
 * declined, and an agent that believes that appends its claims to whatever page already
 * exists instead.
 */
describe('declaring a folder', () => {
  it('refuses a page in an undeclared top-level folder, and asks nobody', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'medical/allergy-test', content: 'Clear.' });
    expect(result.outcome).toBe('requires_folder');
    expect(result.requires_folder?.folder).toBe('medical');
    expect(fs.existsSync(path.join(root, 'medical'))).toBe(false);
    // No proposal row, because there is no question for a person in it.
    expect(mem.proposals()).toHaveLength(0);
    await mem.close();
  });

  it('says what to do next, rather than who to wait for', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'medical/allergy-test', content: 'Clear.' });
    expect(result.note).toMatch(/`folder`/);
    // The words that would send an agent to wait for somebody. Saying "nothing waits on
    // approval" is the opposite of them and is allowed to appear.
    expect(result.note).not.toMatch(/ask the user|akno approve|proposal/i);
    await mem.close();
  });

  it('lets the write through once the folder is declared, in the same session', async () => {
    // The flow this whole change exists for: refused, declared, written — no restart, no
    // human, no second turn.
    const mem = await openAs('agent');
    expect((await mem.write({ slug: 'medical/allergy-test', content: 'Clear.' })).outcome).toBe(
      'requires_folder',
    );

    const declared = await mem.folder({
      path: 'medical',
      description: 'Test results, prescriptions and appointments for this household.',
    });
    expect(declared.outcome).toBe('ok');
    expect(declared.glob).toBe('medical/**');

    const written = await mem.write({ slug: 'medical/allergy-test', content: 'Tested clear.' });
    expect(written.outcome).toBe('ok');
    expect(read('medical/allergy-test.md')).toContain('Tested clear.');
    await mem.close();
  });

  it('writes the rule into akno.json, where the taxonomy travels with the notes', async () => {
    const mem = await openAs('agent');
    await mem.folder({
      path: 'research',
      description: 'Findings about the world.',
      role: 'source',
      remember: 'deny',
    });
    // Read the way Akno reads it: the file is JSONC, and it is written with comments on
    // purpose — a plain JSON.parse failing here is the format working.
    const rules = readJsoncFile<{ folders: Record<string, { description: string }> }>(
      path.join(root, 'akno.json'),
    )!;
    expect(rules.folders['research/**']!.description).toBe('Findings about the world.');
    await mem.close();
  });

  it('takes a second declaration of the same folder as a noop, not an error', async () => {
    // Two agents reaching the same conclusion about where research goes is the system working.
    const mem = await openAs('agent');
    await mem.folder({ path: 'research', description: 'Findings about the world.' });
    const again = await mem.folder({ path: 'research', description: 'Something else entirely.' });
    expect(again.outcome).toBe('noop');
    expect((again.rule as { description: string }).description).toBe('Findings about the world.');
    await mem.close();
  });

  it('refuses to redefine one of Akno’s own paths', async () => {
    const mem = await openAs('agent');
    await expect(mem.folder({ path: 'timeline', description: 'Events.' })).rejects.toThrow(/own paths/);
    await mem.close();
  });

  it('does not ask about a subfolder of a folder that exists', async () => {
    const mem = await openAs('agent');
    expect((await mem.write({ slug: 'home/utilities/water', content: 'x' })).outcome).toBe('ok');
    await mem.close();
  });

  it('never asks the user', async () => {
    const mem = await openAs('user');
    expect((await mem.write({ slug: 'medical/allergy-test', content: 'Clear.' })).outcome).toBe('ok');
    await mem.close();
  });

  it('offers folders that already exist, so a new one is a choice', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'medical/lease-related', content: 'x' });
    expect(result.requires_folder!.nearest.length).toBeGreaterThan(0);
    await mem.close();
  });

  it('surfaces a declared but empty folder in the structure, so it can be found', async () => {
    // Structure used to be derived from pages alone, which made a folder invisible to the
    // caller that had just created it — and invisible is indistinguishable from absent.
    const mem = await openAs('agent');
    await mem.folder({ path: 'medical', description: 'Test results and appointments.' });
    const listed = await mem.list({ kind: 'folders' });
    const medical = listed.folders!.find((folder) => folder.path === 'medical');
    expect(medical?.declared).toBe(true);
    expect(medical?.rule?.description).toBe('Test results and appointments.');
    await mem.close();
  });

  it('surfaces and honours an empty folder the user created directly', async () => {
    // An empty directory has no page row, but it is still an explicit taxonomy decision by the
    // owner. Treating it as absent made agents invent a parallel folder or ask to create it again.
    fs.mkdirSync(path.join(root, 'archives'));
    fs.mkdirSync(path.join(root, 'home', 'records'));
    const mem = await openAs('agent');

    const listed = await mem.list({ kind: 'folders' });
    expect(listed.folders?.some((folder) => folder.path === 'archives')).toBe(true);
    const nested = await mem.list({ kind: 'folders', folder: 'home' });
    expect(nested.folders?.some((folder) => folder.path === 'home/records')).toBe(true);
    expect((await mem.list({ kind: 'tree', depth: 2 })).tree).toContain('records/ (0)');
    expect(
      (await mem.write({ slug: 'archives/first-record', content: 'The archive begins here.' })).outcome,
    ).toBe('ok');
    await mem.close();
  });
});

/** The ledger is a shape, not a page you may write prose onto. */
describe('the ledger', () => {
  it('refuses an append, whoever is asking', async () => {
    const mem = await openAs('agent');
    await expect(mem.write({ slug: 'timeline', append: 'The complaint remains open.' })).rejects.toThrow(
      /event ledger/,
    );
    expect(read('timeline.md')).not.toContain('The complaint remains open.');
    await mem.close();
  });

  it('refuses the user too — this is a shape rule, not a permission', async () => {
    const mem = await openAs('user');
    await expect(mem.write({ slug: 'timeline', content: '# Timeline\n' })).rejects.toThrow(/event ledger/);
    await mem.close();
  });

  it('takes the same fact as an event, placed under its year', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ event: { date: '2026-08-11', summary: 'The complaint stayed open.' } });
    expect(result.outcome).toBe('ok');
    expect(read('timeline.md')).toContain('- **2026-08-11** | The complaint stayed open.');
    await mem.close();
  });
});

/** Page and ledger line land in one change. */
describe('events', () => {
  it('writes a page and its ledger line in one change', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({
      slug: 'home/appliances',
      append: '- Warranty: 5 years',
      event: { date: '2026-08-06', summary: 'Bought a dishwasher.' },
    });
    expect(result.wrote?.map((target) => target.action)).toEqual(['appended', 'event']);
    // One change, both files — there is no way to get a ledger line whose detail
    // page was never written.
    const change = mem.changes()[0]!;
    expect(change.files.map((file) => file.relPath).sort()).toEqual(['home/appliances.md', 'timeline.md']);
    await mem.close();
  });

  it('accepts an event with no page behind it', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ event: { date: '2026-08-05', summary: 'Back from a trip.' } });
    expect(result.outcome).toBe('ok');
    expect(read('timeline.md')).toContain('- **2026-08-05** | Back from a trip.');
    // Still addressable, so it obeys the same provenance rule as everything else.
    expect(result.wrote![0]!.line).toBeGreaterThan(0);
    await mem.close();
  });

  it('makes the event findable through the timeline op', async () => {
    const mem = await openAs('agent');
    await mem.write({ event: { date: '2026-08-05', summary: 'Back from a trip.' } });
    const found = await mem.timeline({ match: 'Back from' });
    expect(found.events[0]?.date).toBe('2026-08-05');
    expect(found.events[0]?.source).toBe('timeline');
    await mem.close();
  });
});

/** Both operate on Markdown. Neither touches a fact directly. */
describe('forget', () => {
  it('trashes a page and keeps it recoverable', async () => {
    const mem = await openAs('agent');
    const result = await mem.forget({ slug: 'home/appliances' });
    expect(fs.existsSync(path.join(root, 'home/appliances.md'))).toBe(false);
    expect(fs.existsSync(result.trashed!)).toBe(true);
    await expect(mem.read({ slug: 'home/appliances' })).rejects.toThrow(/no page/);
    await mem.close();
  });

  it('restores a trashed page exactly, on undo', async () => {
    const mem = await openAs('agent');
    const before = read('home/appliances.md');
    const result = await mem.forget({ slug: 'home/appliances' });
    await mem.undo({ change_id: result.change_id! });
    expect(read('home/appliances.md')).toBe(before);
    expect((await mem.read({ slug: 'home/appliances' })).page?.slug).toBe('home/appliances');
    await mem.close();
  });

  it('says so when the index has a page whose file is gone', async () => {
    const mem = await openAs('agent');
    fs.rmSync(path.join(root, 'home/appliances.md'));
    await expect(mem.forget({ slug: 'home/appliances' })).rejects.toThrow(/file is gone/);
    await mem.close();
  });
});

describe('undo', () => {
  it('reverses a write to the exact prior bytes', async () => {
    const mem = await openAs('agent');
    const before = read('home/lease.md');
    const result = await mem.write({ slug: 'home/lease', append: '- Deposit: 2222 EUR' });
    await mem.undo({ change_id: result.change_id! });
    expect(read('home/lease.md')).toBe(before);
    await mem.close();
  });

  it('reverses page and ledger together, or neither', async () => {
    const mem = await openAs('agent');
    const ledgerBefore = read('timeline.md');
    const pageBefore = read('home/appliances.md');
    const result = await mem.write({
      slug: 'home/appliances',
      append: '- Warranty: 5 years',
      event: { date: '2026-08-06', summary: 'Bought a dishwasher.' },
    });
    await mem.undo({ change_id: result.change_id! });
    expect(read('timeline.md')).toBe(ledgerBefore);
    expect(read('home/appliances.md')).toBe(pageBefore);
    await mem.close();
  });

  it('removes a created page and leaves no stale index row', async () => {
    // Deleting the `files` row directly would hide the deletion from the
    // reconciler, leaving a `pages` row pointing at a file that is gone.
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'home/wifi', content: 'Attic.' });
    await mem.undo({ change_id: result.change_id! });
    expect(fs.existsSync(path.join(root, 'home/wifi.md'))).toBe(false);
    await expect(mem.read({ slug: 'home/wifi' })).rejects.toThrow(/no page/);
    await mem.close();
  });

  it('says which files it put back and which it deleted', async () => {
    // Two opposite events. A page that no longer exists reported as "restored" tells the
    // caller a file is there when it is not — and after an undo, that is exactly the thing
    // they are about to act on.
    const mem = await openAs('agent');

    const created = await mem.write({ slug: 'home/wifi', content: 'Attic.' });
    const undoneCreate = await mem.undo({ change_id: created.change_id! });
    expect(undoneCreate.removed).toEqual(['home/wifi.md']);
    expect(undoneCreate.restored).toBeUndefined();

    const appended = await mem.write({ slug: 'home/lease', append: '- Deposit: 2222 EUR' });
    const undoneAppend = await mem.undo({ change_id: appended.change_id! });
    expect(undoneAppend.restored).toEqual(['home/lease.md']);
    expect(undoneAppend.removed).toBeUndefined();

    await mem.close();
  });

  it('refuses to undo twice', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'home/lease', append: '- X: 1' });
    await mem.undo({ change_id: result.change_id! });
    await expect(mem.undo({ change_id: result.change_id! })).rejects.toThrow(/already been undone/);
    await mem.close();
  });

  it('lists changes newest first, even within one millisecond', async () => {
    // Wall clock cannot order two changes in the same millisecond; the list has to.
    const mem = await openAs('agent');
    const first = await mem.write({ slug: 'home/lease', append: '- A: 1' });
    const second = await mem.write({ slug: 'home/lease', append: '- B: 2' });
    const listed = mem.changes();
    expect(listed[0]!.id).toBe(second.change_id);
    expect(listed[1]!.id).toBe(first.change_id);
    await mem.close();
  });

  it('survives a full rebuild of every other table', async () => {
    // Only the journal is irreplaceable. It records the previous bytes, not a
    // pointer to them, so undo works after the index is thrown away.
    const mem = await openAs('agent');
    const before = read('home/lease.md');
    const result = await mem.write({ slug: 'home/lease', append: '- Deposit: 2222 EUR' });
    await mem.close();

    const reopened = await openAs('agent');
    await reopened.undo({ change_id: result.change_id! });
    expect(read('home/lease.md')).toBe(before);
    await reopened.close();
  });
});

describe('move', () => {
  it('relocates a page and keeps its id, so facts and history stay attached', async () => {
    const mem = await openAs('agent');
    const id = (await mem.read({ slug: 'home/appliances' })).page!.id;
    const result = await mem.move({ from: 'home/appliances', to: 'home/kitchen/appliances' });
    expect(result.outcome).toBe('ok');
    expect((await mem.read({ slug: 'home/kitchen/appliances' })).page!.id).toBe(id);
    expect(fs.existsSync(path.join(root, 'home/appliances.md'))).toBe(false);
    await mem.close();
  });

  it('reports inbound links rather than rewriting other pages', async () => {
    const mem = await openAs('user');
    await mem.write({ slug: 'home/index', content: 'See [[home/appliances]].' });
    const result = await mem.move({ from: 'home/appliances', to: 'archive/appliances' });
    expect(result.broken_inbound).toContain('home/index');
    // The other page is untouched — editing it is a bigger change than was asked.
    expect(read('home/index.md')).toContain('[[home/appliances]]');
    await mem.close();
  });

  it('refuses to move onto an existing page', async () => {
    const mem = await openAs('agent');
    await expect(mem.move({ from: 'home/lease', to: 'home/appliances' })).rejects.toThrow(/already exists/);
    await mem.close();
  });

  it('asks for a declaration before moving into an undeclared folder', async () => {
    // Moving a page into `legal/` creates `legal/` just as surely as writing one there, so
    // it owes the same sentence.
    const mem = await openAs('agent');
    const result = await mem.move({ from: 'home/lease', to: 'legal/lease' });
    expect(result.outcome).toBe('requires_folder');
    expect(result.requires_folder?.folder).toBe('legal');
    expect(fs.existsSync(path.join(root, 'home/lease.md'))).toBe(true);
    await mem.close();
  });

  it('is reversible', async () => {
    const mem = await openAs('agent');
    const before = read('home/appliances.md');
    const result = await mem.move({ from: 'home/appliances', to: 'home/kitchen/appliances' });
    await mem.undo({ change_id: result.change_id! });
    expect(read('home/appliances.md')).toBe(before);
    expect(fs.existsSync(path.join(root, 'home/kitchen/appliances.md'))).toBe(false);
    await mem.close();
  });
});

describe('remember without a derive model', () => {
  it('reports degraded rather than silently keeping nothing', async () => {
    // No derive model means no `remember`. "Nothing was kept" and "the curator
    // could not run" are different answers and must not look the same.
    const mem = await openAs('agent');
    const result = await mem.remember({ text: 'The rent went up to 2222 EUR.' });
    expect(result.status).toBe('degraded');
    expect(result.outcome).toBe('noop');
    expect(result.degraded).toContain('no_derive_model');
    await mem.close();
  });
});

describe('a link stops being broken when its page appears', () => {
  it('re-resolves links on a scoped index, not only a full one', async () => {
    // Every `write` re-indexes scoped, and link resolution used to be skipped on that path — so a
    // page created to satisfy a link left the link marked broken until the next full pass. The file
    // was right and the index disagreed with it.
    // As the user: an agent creating a new top-level folder is gated, and this test is about links.
    const mem = await openAs('user');
    await mem.write({ slug: 'notes/hub', content: 'See [[notes/spoke]].' });
    let hub = await mem.read({ slug: 'notes/hub' });
    expect(hub.page!.broken_links).toContain('notes/spoke');

    await mem.write({ slug: 'notes/spoke', content: 'Here.' });

    hub = await mem.read({ slug: 'notes/hub' });
    expect(hub.page!.broken_links ?? []).not.toContain('notes/spoke');
    expect(hub.page!.links).toContain('notes/spoke');
  });
});

/**
 * A rendition — `<file>.txt` beside the file it renders — is a document row like any other,
 * which is the point: `move` and `forget` find it through the page that owns it, with no
 * second mechanism that could disagree with the first about where a file went.
 */
describe('a document with its text beside it', () => {
  const HASH = '3f8c1a2b';
  const PDF = `home/lease-${HASH}.pdf`;
  const TXT = `home/lease-${HASH}.txt`;

  beforeEach(() => {
    fs.writeFileSync(path.join(root, PDF), Buffer.from('%PDF-1.4 not a readable one'));
    fs.writeFileSync(
      path.join(root, TXT),
      `# Extracted text of lease-${HASH}.pdf\n# 1 page.\n# Written by Akno.\n\nClause seven.\n`,
      'utf8',
    );
  });

  it('belongs to the same page as the file it renders', async () => {
    const mem = await openAs('agent');
    await mem.index({});
    const page = await mem.read({ slug: 'home/lease' });
    // Both files listed, so somebody reading the page can see the text is already there.
    expect(page.page?.documents?.map((entry) => entry.rel_path).sort()).toEqual([PDF, TXT]);
    await mem.close();
  });

  it('follows the file it renders when the page moves', async () => {
    const mem = await openAs('agent');
    await mem.index({});
    await mem.move({ from: 'home/lease', to: 'home/kitchen/lease' });

    expect(fs.existsSync(path.join(root, `home/kitchen/lease-${HASH}.pdf`))).toBe(true);
    // Named after the file it renders, so it lands beside it rather than keeping a stem
    // that now names nothing.
    expect(fs.existsSync(path.join(root, `home/kitchen/lease-${HASH}.txt`))).toBe(true);
    expect(fs.existsSync(path.join(root, TXT))).toBe(false);
    await mem.close();
  });

  it('goes into the trash with the document it renders', async () => {
    const mem = await openAs('user');
    await mem.index({});
    const documents = (await mem.read({ slug: 'home/lease' })).page!.documents!;
    const pdf = documents.find((entry) => entry.rel_path === PDF)!;

    await mem.forget({ document: pdf.id });
    // Leaving it behind would leave the whole of a forgotten contract in the folder, still
    // readable and still found by anything that searches the files themselves.
    expect(fs.existsSync(path.join(root, PDF))).toBe(false);
    expect(fs.existsSync(path.join(root, TXT))).toBe(false);
    await mem.close();
  });

  it('survives an undo of the move', async () => {
    // The move journalled the old path with nothing in `before` and the new path as created,
    // and reversing that deleted the new file and restored nothing — undoing a move ate the
    // attachment. A page carries its text in `before`; a PDF has none to carry.
    const mem = await openAs('agent');
    await mem.index({});
    const bytes = fs.readFileSync(path.join(root, PDF));

    const result = await mem.move({ from: 'home/lease', to: 'home/kitchen/lease' });
    await mem.undo({ change_id: result.change_id! });

    expect(fs.existsSync(path.join(root, PDF))).toBe(true);
    expect(fs.readFileSync(path.join(root, PDF))).toEqual(bytes);
    expect(read(TXT)).toContain('Clause seven.');
    expect(fs.existsSync(path.join(root, `home/kitchen/lease-${HASH}.pdf`))).toBe(false);
    await mem.close();
  });

  it('comes back with it on undo', async () => {
    const mem = await openAs('user');
    await mem.index({});
    const documents = (await mem.read({ slug: 'home/lease' })).page!.documents!;
    const pdf = documents.find((entry) => entry.rel_path === PDF)!;

    const forgotten = await mem.forget({ document: pdf.id });
    await mem.undo({ change_id: forgotten.change_id! });
    expect(fs.existsSync(path.join(root, PDF))).toBe(true);
    expect(read(TXT)).toContain('Clause seven.');
    await mem.close();
  });
});
