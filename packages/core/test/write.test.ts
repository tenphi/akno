import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * §8, §5, §10. The write path end to end, on a real knowledge base on disk, with
 * **no models configured**.
 *
 * That last part is the interesting constraint: gating, conflict detection, the
 * ledger, the journal and undo must all work with the whole model stack absent.
 * §8 says inline conflict detection is cheap and structural precisely so it does not
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
      models: { embedding: { id: null }, reranker: { id: null, enabled: false }, chat: { id: null } },
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
 * §8. Bias toward numbers, dates and identifiers, where conflicts are real and
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

  it('works with no chat model at all — that is what "cheap" means', async () => {
    const mem = await openAs('agent');
    const health = await mem.doctor({ probeModels: false });
    expect(health.models.find((role) => role.role === 'chat')?.available).toBe(false);
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

  it('does not flag free prose — §8: when uncertain, write', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({
      slug: 'home/lease',
      append: 'The landlord mentioned the building might be resurfaced.',
    });
    expect(result.outcome).toBe('ok');
    await mem.close();
  });
});

/** §5. New folders are gated for agents. The user is never gated. */
describe('gating', () => {
  it('gates a new top-level folder for an agent', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'medical/allergy-test', content: 'Clear.' });
    expect(result.outcome).toBe('requires_approval');
    expect(result.approval?.reason).toContain('medical');
    expect(fs.existsSync(path.join(root, 'medical'))).toBe(false);
    await mem.close();
  });

  it('does not gate a subfolder of a folder that exists', async () => {
    const mem = await openAs('agent');
    expect((await mem.write({ slug: 'home/utilities/water', content: 'x' })).outcome).toBe('ok');
    await mem.close();
  });

  it('never gates the user', async () => {
    const mem = await openAs('user');
    expect((await mem.write({ slug: 'medical/allergy-test', content: 'Clear.' })).outcome).toBe('ok');
    await mem.close();
  });

  it('offers somewhere the claim could go instead', async () => {
    const mem = await openAs('agent');
    const result = await mem.write({ slug: 'medical/lease-related', content: 'x' });
    expect(result.approval!.nearest.length).toBeGreaterThan(0);
    await mem.close();
  });

  it('reuses one proposal for repeated writes to the same new folder', async () => {
    // Ten writes into a new folder should give the user one thing to decide.
    const mem = await openAs('agent');
    const first = await mem.write({ slug: 'medical/a', content: 'x' });
    const second = await mem.write({ slug: 'medical/b', content: 'y' });
    expect(second.approval!.proposal_id).toBe(first.approval!.proposal_id);
    expect(mem.proposals()).toHaveLength(1);
    await mem.close();
  });

  it('completes the held write on approval, without the caller repeating it', async () => {
    const mem = await openAs('agent');
    const blocked = await mem.write({ slug: 'medical/allergy-test', content: 'Tested clear.' });
    const approved = await mem.approve(blocked.approval!.proposal_id);
    expect(approved.write?.outcome).toBe('ok');
    expect(read('medical/allergy-test.md')).toContain('Tested clear.');
    await mem.close();
  });

  it('remembers a refusal, so the agent stops re-asking', async () => {
    const mem = await openAs('agent');
    const blocked = await mem.write({ slug: 'medical/a', content: 'x' });
    await mem.decline(blocked.approval!.proposal_id);

    const again = await mem.write({ slug: 'medical/b', content: 'y' });
    expect(again.outcome).toBe('requires_approval');
    expect(again.approval!.reason).toMatch(/declined before/);
    expect(again.note).toMatch(/do not ask the user again/);
    await mem.close();
  });
});

/** §10. Page and ledger line land in one change. */
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

/** §8. Both operate on Markdown. Neither touches a fact directly. */
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
    // §2: only the journal is irreplaceable. It records the previous bytes, not a
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

  it('gates a move into a new top-level folder', async () => {
    const mem = await openAs('agent');
    const result = await mem.move({ from: 'home/lease', to: 'legal/lease' });
    expect(result.outcome).toBe('requires_approval');
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

describe('remember without a chat model', () => {
  it('reports degraded rather than silently keeping nothing', async () => {
    // §14: no chat model means no `remember`. "Nothing was kept" and "the curator
    // could not run" are different answers and must not look the same.
    const mem = await openAs('agent');
    const result = await mem.remember({ text: 'The rent went up to 2222 EUR.' });
    expect(result.status).toBe('degraded');
    expect(result.outcome).toBe('noop');
    expect(result.degraded).toContain('no_chat_model');
    await mem.close();
  });
});
