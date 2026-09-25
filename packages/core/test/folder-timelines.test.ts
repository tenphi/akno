import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { TimelineOutput, ListOutput, WriteOutput } from '@tenphi/akno-protocol';
import { open, type Akno } from '../src/index.ts';
import {
  managedMemoryBlock,
  renderManagedMemoryPayload,
  type ManagedMemoryMarker,
} from '../src/write/managed-memory.ts';

let root: string;
let stateDir: string;
let mem: Akno;
const ledger = '# Timeline\n\nHistory of this folder.\n\n## 2031\n';
const event = (summary: string, target = '') =>
  `- **2031-04-01** | ${summary}${target ? ` [[${target}]]` : ''}\n`;
function put(file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

async function start(timeline = 'timeline.md') {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'agent',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      create_reserved_paths: false,
      paths: { timeline },
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
      folders: { '**': { role: 'knowledge', remember: 'integrate' } },
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-folder-timelines-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-folder-timeline-state-'));
  put('timeline.md', ledger + event('Ada Marlow completed a repair.', 'home/repairs'));
  put('home/repairs.md', '# Repairs\n\nHousehold repairs.\n');
  put('work/timeline.md', ledger + event('Ada Marlow completed an inspection.', 'people/ada-marlow'));
  put('work/notes.md', '# Work notes\n\nWork activity.\n');
  put(
    'work/project-example/timeline.md',
    ledger + event('Ada Marlow delivered the prototype.', 'people/ada-marlow'),
  );
  put('work/project-example/notes.md', '# Prototype\n\nPrototype development.\n');
  put('cases/example/timeline.md', ledger + event('Vulpine Mutual sent a letter.'));
  put('people/ada-marlow.md', '# Ada Marlow\n\nInvented person.\n');
  mem = await start();
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  await mem?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

it('discovers visible boundaries, defaults to root, and excludes nested and sibling timelines', async () => {
  const discovery = await mem.list({ kind: 'timelines' });
  expect(ListOutput.parse(discovery).timelines?.map((item) => item.slug)).toEqual([
    'timeline',
    'cases/example/timeline',
    'work/project-example/timeline',
    'work/timeline',
  ]);
  expect((await mem.timeline({})).results.map((entry) => entry.timeline)).toEqual(['timeline']);
  const work = await mem.timeline({ timeline: 'work/timeline.md' });
  expect(work.total).toBe(1);
  expect(work.results[0]).toMatchObject({
    source: 'work/timeline',
    timeline: 'work/timeline',
    timeline_basis: 'ledger',
  });
  const combined = await mem.timeline({ timeline: '*' });
  expect(TimelineOutput.parse(combined).total).toBe(4);
  expect(combined.groups.source_kind).toEqual([{ value: 'event', count: 4 }]);
  await expect(mem.timeline({ timeline: 'work/missing' })).rejects.toThrow('unknown timeline');
});

it('routes page-plus-event and page-owned event-only writes to their nearest ledger, with exact undo', async () => {
  const rootBefore = read('timeline.md');
  const workBefore = read('work/timeline.md');
  const nestedBefore = read('work/project-example/timeline.md');
  const result = await mem.write({
    slug: 'work/project-example/notes',
    append: 'Prototype delivered.',
    event: { date: '2031-04-02', summary: 'Prototype delivered.' },
  });
  expect(WriteOutput.parse(result).wrote).toContainEqual(
    expect.objectContaining({
      slug: 'work/project-example/timeline',
      timeline: 'work/project-example/timeline',
      action: 'event',
    }),
  );
  expect(read('timeline.md')).toBe(rootBefore);
  expect(read('work/timeline.md')).toBe(workBefore);
  expect(read('work/project-example/timeline.md')).toContain('2031-04-02');
  await mem.undo({ change_id: result.change_id! });
  expect(read('work/project-example/timeline.md')).toBe(nestedBefore);
  const only = await mem.write({
    slug: 'work/notes',
    event: { date: '2031-04-03', summary: 'Inspection completed.' },
  });
  expect(only.wrote?.[0]).toMatchObject({ slug: 'work/timeline', timeline: 'work/timeline' });
  expect(read('work/notes.md')).toBe('# Work notes\n\nWork activity.\n');
});

it('holds standalone writes until a timeline is selected and rejects an incompatible page selector', async () => {
  const before = read('timeline.md');
  const held = await mem.write({ event: { date: '2031-04-02', summary: 'An inspection happened.' } });
  expect(held).toMatchObject({ outcome: 'requires_approval', hold: { reason: 'timeline_required' } });
  expect(read('timeline.md')).toBe(before);
  const written = await mem.write({
    timeline: 'work/timeline',
    event: { date: '2031-04-02', summary: 'An inspection happened.' },
  });
  expect(written.wrote?.[0]?.timeline).toBe('work/timeline');
  await expect(
    mem.write({
      slug: 'home/repairs',
      append: 'Another repair.',
      timeline: 'work/timeline',
      event: { date: '2031-04-02', summary: 'Another repair.' },
    }),
  ).rejects.toThrow('does not own');
  expect(read('home/repairs.md')).not.toContain('Another repair.');
  await expect(
    mem.write({ timeline: '*', event: { date: '2031-04-02', summary: 'An inspection happened.' } }),
  ).rejects.toThrow('one timeline');
});

it('never treats an existing invalid, conflicted, or read-only timeline as permission to fall back', async () => {
  put('work/timeline.md', '# Unrelated document\n\nNot a ledger.\n');
  const invalid = await mem.timeline({ timeline: 'work/timeline' });
  expect(invalid).toMatchObject({
    status: 'unavailable',
    results: [],
    degraded: ['timeline_boundary_unavailable'],
  });
  expect((await mem.timeline({})).total).toBe(1);
  await expect(
    mem.write({
      slug: 'work/notes',
      append: 'Inspection done.',
      event: { date: '2031-04-03', summary: 'Inspection done.' },
    }),
  ).rejects.toThrow('unavailable or read-only');
  expect(read('work/notes.md')).not.toContain('Inspection done.');
  put('work/timeline.md', '---\nakno:\n  role: source\n---\n' + ledger);
  await expect(
    mem.write({ timeline: 'work/timeline', event: { date: '2031-04-03', summary: 'Inspection done.' } }),
  ).rejects.toThrow('read-only');
  put('work/timeline.md', ledger + '<<<<<<< first\nA\n=======\nB\n>>>>>>> second\n');
  expect(
    (await mem.list({ kind: 'timelines' })).timelines?.find((entry) => entry.slug === 'work/timeline')
      ?.status,
  ).toBe('quarantined');
});

it('does not let ledger prose writes or a symlink declaration bypass protections', async () => {
  await expect(mem.write({ slug: 'work/timeline', append: 'A new fact.' })).rejects.toThrow('event ledger');
  fs.unlinkSync(path.join(root, 'work/timeline.md'));
  fs.symlinkSync(path.join(root, 'timeline.md'), path.join(root, 'work/timeline.md'));
  expect((await mem.timeline({ timeline: 'work/timeline' })).status).toBe('unavailable');
  expect((await mem.timeline({})).total).toBe(1);
});

it('changes inherited membership immediately when a boundary is created or removed, without source rewrites', async () => {
  put('work/subproject/notes.md', '# Subproject\n\n' + event('Ada Marlow tested a prototype.'));
  await mem.index({ structuralOnly: true });
  const before = read('work/subproject/notes.md');
  expect((await mem.timeline({ timeline: 'work/timeline' })).total).toBe(2);
  put('work/subproject/timeline.md', '---\ntype: timeline\n---\n\n# Subproject history\n');
  expect((await mem.timeline({ timeline: 'work/timeline' })).total).toBe(1);
  expect((await mem.timeline({ timeline: 'work/subproject/timeline' })).total).toBe(1);
  await mem.index({ structuralOnly: true });
  expect(read('work/subproject/notes.md')).toBe(before);
  fs.unlinkSync(path.join(root, 'work/subproject/timeline.md'));
  expect((await mem.timeline({ timeline: 'work/timeline' })).total).toBe(2);
});

it('keeps equal authored occurrences available across boundaries and deduplicates within each view after rebuild', async () => {
  const same = event('Ada Marlow completed a check.', 'people/ada-marlow');
  put('work/timeline.md', ledger + same);
  put('work/notes.md', '# Work\n\n' + same);
  put('cases/example/timeline.md', ledger + same);
  await mem.index({ structuralOnly: true });
  expect((await mem.timeline({ timeline: 'work/timeline' })).total).toBe(1);
  expect((await mem.timeline({ timeline: 'cases/example/timeline' })).total).toBe(1);
  const before = await mem.timeline({ timeline: '*', as_of: '2031-05-01T00:00:00Z' });
  await mem.index({ rebuild: true, structuralOnly: true });
  const after = await mem.timeline({ timeline: '*', as_of: '2031-05-01T00:00:00Z' });
  expect(after.results).toEqual(before.results);
});

it('scopes retained states, deadlines, plans and recurrence before the shared expansion budget', async () => {
  put('home/recurrence.md', '# Household\n\n' + memory('mem_home_series', 'scheduled', '2031-04-01', true));
  put(
    'work/retained.md',
    '# Work\n\n' +
      ['valid', 'due', 'scheduled', 'occurred']
        .map((relation, i) =>
          memory(
            `mem_work_${i}`,
            relation as NonNullable<ManagedMemoryMarker['time']>['relation'],
            '2031-04-01',
          ),
        )
        .join('\n\n'),
  );
  await mem.index({ structuralOnly: true });
  const result = await mem.timeline({
    timeline: 'work/timeline',
    since: '2031-04',
    until: '2031-04',
    limit: 10,
  });
  expect(result.truncated).toBeUndefined();
  expect(result.results.every((entry) => entry.timeline === 'work/timeline')).toBe(true);
  expect(new Set(result.results.map((entry) => entry.source_kind))).toEqual(
    new Set(['event', 'state', 'deadline', 'plan']),
  );
});

it('keeps context chronology scoped and previews legacy uncertainty without interpreting links as ownership', async () => {
  put(
    'timeline.md',
    ledger + event('Prototype delivered.', 'work/project-example/notes') + event('Unassigned inspection.'),
  );
  await mem.index({ structuralOnly: true });
  const before = read('timeline.md');
  const preview = await mem.timeline({ migration_preview: true });
  expect(preview.migration).toContainEqual(
    expect.objectContaining({
      source: 'timeline',
      suggested_timeline: 'work/project-example/timeline',
      reason: 'cross_timeline_link',
    }),
  );
  expect(preview.migration).toContainEqual(
    expect.objectContaining({ suggested_timeline: null, reason: 'unlinked_event' }),
  );
  expect(preview.results.every((entry) => entry.timeline === 'timeline')).toBe(true);
  const today = new Date().toISOString().slice(0, 10);
  await mem.write({
    timeline: 'work/timeline',
    event: { date: today, summary: 'Work inspection completed.' },
  });
  await mem.write({ timeline: 'timeline', event: { date: today, summary: 'Household repair completed.' } });
  const result = await mem.context({ timeline: 'work/timeline', timeline_days: 30, structure: false });
  expect(result.timeline.map((entry) => entry.timeline)).toEqual(['work/timeline']);
  expect(read('timeline.md')).toContain(before.trim().split('\n').at(-1)!);
});

it('retains custom default-ledger compatibility and reports page moves in their new timeline', async () => {
  await mem.move({ from: 'home/repairs', to: 'work/repairs' });
  const result = await mem.write({
    slug: 'work/repairs',
    event: { date: '2031-04-04', summary: 'Repair reviewed.' },
  });
  expect(result.wrote?.[0]?.timeline).toBe('work/timeline');
  await mem.close();
  put('meta/history.markdown', ledger + event('Ada Marlow completed a household repair.'));
  mem = await start('meta/history.markdown');
  await mem.index({ structuralOnly: true });
  const custom = await mem.timeline({});
  expect(custom.selected_timelines).toEqual(['meta/history']);
  expect(custom.results.every((entry) => entry.timeline === 'meta/history')).toBe(true);
  expect(
    (await mem.list({ kind: 'timelines' })).timelines?.find((item) => item.slug === 'work/timeline'),
  ).toBeDefined();
});

function memory(
  id: string,
  relation: NonNullable<ManagedMemoryMarker['time']>['relation'],
  date: string,
  recurring = false,
) {
  const marker: ManagedMemoryMarker = {
    id,
    supports: [
      {
        receipt: 'aaaaaaaaaaaa',
        candidate: 'bbbbbbbbbbbb',
        proofGroup: 'cccccccccccc',
        selection: 'provided',
      },
    ],
    kind: relation === 'occurred' ? 'event' : relation === 'valid' ? 'claim' : 'plan',
    subject: 'unresolved',
    sourceRole: 'user',
    reporters: [],
    commitment: 'asserted',
    disposition: relation === 'occurred' || relation === 'valid' ? 'active' : 'accepted',
    polarity: 'affirmed',
    basis: 'self_attested',
    evidence: [],
    links: [],
    time: {
      relation,
      precision: 'day',
      status: relation === 'occurred' || relation === 'valid' ? 'actual' : 'planned',
      start: date,
      ...(recurring ? { recurrence: { frequency: 'daily' as const } } : {}),
    },
  };
  const text =
    relation === 'occurred'
      ? 'Ada Marlow inspected the Zephyr QX-100.'
      : relation === 'valid'
        ? 'Ada Marlow uses the Zephyr QX-100.'
        : 'Ada Marlow plans to inspect the Zephyr QX-100.';
  return managedMemoryBlock(marker, renderManagedMemoryPayload(text, marker));
}

it('keeps a broken symlink or directory declaration fenced off', async () => {
  fs.unlinkSync(path.join(root, 'work/timeline.md'));
  fs.symlinkSync(path.join(root, 'missing.md'), path.join(root, 'work/timeline.md'));
  expect((await mem.timeline({ timeline: 'work/timeline' })).status).toBe('unavailable');
  fs.unlinkSync(path.join(root, 'work/timeline.md'));
  fs.mkdirSync(path.join(root, 'work/timeline.md'));
  expect((await mem.timeline({ timeline: 'work/timeline' })).status).toBe('unavailable');
  expect((await mem.timeline({})).total).toBe(1);
});

it('previews both page and ledger destinations and undoes a ledger correction plus event', async () => {
  const before = read('work/timeline.md');
  const preview = await mem.write({
    slug: 'work/notes',
    append: 'Prototype checked.',
    dry_run: true,
    event: { date: '2031-04-03', summary: 'Prototype checked.' },
  });
  expect(preview.wrote?.map((item) => [item.slug, item.timeline])).toEqual([
    ['work/notes', 'work/timeline'],
    ['work/timeline', 'work/timeline'],
  ]);
  expect(read('work/timeline.md')).toBe(before);
  const result = await mem.write({
    slug: 'work/timeline',
    replace: { find: 'History of this folder.', with: 'Zephyr prototype history.' },
    event: { date: '2031-04-03', summary: 'Prototype checked.' },
  });
  await mem.undo({ change_id: result.change_id! });
  expect(read('work/timeline.md')).toBe(before);
});
