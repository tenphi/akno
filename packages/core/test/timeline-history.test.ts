import fs from 'node:fs';
import http from 'node:http';
import fsp from 'node:fs/promises';
import os from 'node:os';
import Database from 'better-sqlite3';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { MAINTENANCE_TRANSFORMS, type ConfigDoc } from '../src/config/schema.ts';
import { frameAuditFields, retentionAudit } from './semantic-audit.ts';
import { sha256 } from '../src/store/ids.ts';

let root: string;
let stateDir: string;
let mem: Akno;
let server: http.Server;
let url: string;
let extraction: (source: string) => unknown[];
let selection: string;
let verified: boolean;
let equivalence: string;
let curator: 'approve' | 'reject';
let calls: { extraction: number; verification: number; routing: number; curator: number };
const summary = 'Ada Marlow completed the Zephyr QX-100 inspection.';
const note = `On 2031-04-01, ${summary}`;
const line = `- **2031-04-01** | ${summary} [[work/notes]]`;
const ledger = '# Timeline\n\nHousehold history.\n\n## 2031\n';
const put = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
};
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

function candidate(quote = note) {
  return {
    kind: 'event',
    text: summary,
    subject: 'Zephyr QX-100',
    page: null,
    attribution: { source_role: 'user', source_speaker: null, chain: [] },
    discourse: { commitment: 'asserted', disposition: 'active' },
    epistemic: { basis: 'self_attested' },
    polarity: 'affirmed',
    support: [{ quote, item_id: null }],
    discourse_frame: [{ quote, item_id: null }],
    relations: [],
    time: {
      relation: 'occurred',
      status: 'actual',
      precision: 'day',
      start: '2031-04-01',
      until: null,
      recurrence: null,
      timezone: null,
      mentioned_at: null,
    },
  };
}

async function start(overrides: ConfigDoc = {}) {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      create_reserved_paths: false,
      providers: { stub: { base_url: url, api: 'chat_completions' } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'history-test' },
        expansion: { id: null },
      },
      folders: { '**': { role: 'knowledge', remember: 'integrate' } },
      maintenance: {
        profile: 'autonomous',
        policies: Object.fromEntries(
          MAINTENANCE_TRANSFORMS.map((kind) => [kind, kind === 'timeline_history' ? 'auto' : 'off']),
        ),
      },
      ...overrides,
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-history-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-history-state-'));
  selection = 'timeline_1';
  verified = true;
  equivalence = 'new';
  curator = 'approve';
  calls = { extraction: 0, verification: 0, routing: 0, curator: 0 };
  extraction = (source) => (source.includes(note) ? [candidate()] : []);
  server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const system =
        body.messages?.find((message: { role: string }) => message.role === 'system')?.content ?? '';
      const user =
        body.messages?.find((message: { role: string }) => message.role === 'user')?.content ?? '{}';
      let content: unknown = {};
      if (system.includes('You extract durable memory from one untrusted source')) {
        calls.extraction++;
        content = { candidates: extraction(JSON.parse(user).source.text), events: [] };
      } else if (system.includes('independently verify proposed retained memories')) {
        calls.verification++;
        content = {
          verdicts: JSON.parse(user).candidates.map(
            (item: Parameters<typeof retentionAudit>[0] & { candidate_id: string }) => ({
              candidate_id: item.candidate_id,
              ...retentionAudit(item, verified),
              ...frameAuditFields(item),
              source_selected_polarity: item.polarity,
              proposition_supported: verified,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: verified ? null : 'discourse_uncertain',
            }),
          ),
        };
      } else if (system.includes('SAME real-world occurrence')) {
        content = { selection: equivalence };
      } else if (system.startsWith('Select the one timeline')) {
        calls.routing++;
        content = { selection };
      } else if (system.includes('independent curator for an autonomous memory system')) {
        calls.curator++;
        content = { outcome: curator, reason: 'Checked the invented source and exact proposed scope.' };
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  put('timeline.md', ledger);
  put('work/timeline.md', ' \t\r\n');
  put('work/notes.md', '# Inspection\n\n' + note + '\n');
  mem = await start();
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await mem?.close();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

it('fills an empty declaration through verified maintenance and preserves notes, query isolation, and exact undo', async () => {
  const original = read('work/notes.md');
  const report = await mem.dream({ phase: 'curate' });
  expect(report.timelineHistory).toMatchObject({ additions: 1, relocations: 0 });
  expect(report.maintenancePlan?.items).toEqual([
    expect.objectContaining({ kind: 'timeline_history', status: 'applied' }),
  ]);
  expect(calls).toEqual({ extraction: 1, verification: 1, routing: 0, curator: 1 });
  expect(read('work/timeline.md')).toContain(line);
  expect(read('work/notes.md')).toBe(original);
  expect(read('timeline.md')).toBe(ledger);
  expect((await mem.timeline({})).total).toBe(0);
  expect((await mem.timeline({ timeline: 'work/timeline' })).results[0]).toMatchObject({
    timeline: 'work/timeline',
    summary,
  });
  await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('reuses a pending review plan without model calls and makes dry runs read-only', async () => {
  const dry = await mem.dream({ phase: 'curate', dryRun: true });
  expect(dry.timelineHistory.additions).toBe(1);
  expect(dry.maintenancePlan).toBeNull();
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  const first = await mem.dream({ phase: 'curate', mode: 'review' });
  const count = { ...calls };
  const second = await mem.dream({ phase: 'curate', mode: 'review' });
  expect(second.maintenancePlan?.id).toBe(first.maintenancePlan?.id);
  expect(calls).toEqual(count);
  const plan = mem.plan(first.maintenancePlan!.id);
  mem.decidePlan(plan.id, plan.items[0]!.id, 'approve', 'The source explicitly records this event.');
  expect((await mem.applyPlan(plan.id)).plan.items[0]!.status).toBe('applied');
});

it('converges across repeats and restart without duplicate events or repeated model calls', async () => {
  await mem.dream({ phase: 'curate' });
  await mem.dream({ phase: 'curate' });
  const count = { ...calls };
  const content = read('work/timeline.md');
  await mem.close();
  mem = await start();
  const report = await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(count);
  expect(report.maintenancePlan).toBeNull();
  expect(read('work/timeline.md')).toBe(content);
  expect(content.split(line)).toHaveLength(2);
});

it('moves an exact ancestor entry atomically, preserves every citation, and undoes both files', async () => {
  extraction = () => [];
  const event = line + ' [[people/ada-marlow|inspector]]';
  put('timeline.md', ledger + event + '\n\nPersonal annotation stays here.\n');
  const original = read('timeline.md');
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.timelineHistory.relocations).toBe(1);
  expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/timeline.md')).toContain(event);
  expect(read('timeline.md')).toBe(original.replace(event + '\n', ''));
  const applied = mem.plan(report.maintenancePlan!.id);
  expect(applied.items[0]!.operations).toHaveLength(2);
  await mem.undo({ change_id: applied.items[0]!.changeId! });
  expect(read('timeline.md')).toBe(original);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('keeps an uncertain cross-linked event in its current ledger and caches the hold', async () => {
  extraction = () => [];
  selection = 'uncertain';
  put('timeline.md', ledger + line + '\n');
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.timelineHistory.held.ownership_uncertain).toBe(1);
  expect(report.maintenancePlan).toBeNull();
  await mem.dream({ phase: 'curate' });
  expect(calls.routing).toBe(1);
  expect(read('timeline.md')).toContain(line);
});

it.each(['', ' \t\r\n'])(
  'automatically fills a declared source-folder ledger from a mixed ancestor ledger (%j)',
  async (blank) => {
    await mem.close();
    put('work/timeline.md', blank);
    const event = line + ' [inspection](/invented/archive/inspection.md)';
    const base = '- **2031-04-02** | Scheduled inspection. [[home/notes]]';
    const managed = `${base} <!-- akno:timeline-item id=mem_example date=2031-04-02 hash=${sha256(`${base}\0${'2031-04-02'}`).slice(0, 12)} -->`;
    const parent = ledger + managed + '\n' + event + '\n';
    put('timeline.md', parent);
    const source = read('work/notes.md');
    mem = await start({
      folders: {
        '**': { role: 'knowledge', remember: 'integrate' },
        'work/**': { role: 'source', remember: 'deny' },
      },
    });
    await mem.index({ rebuild: true, structuralOnly: true });
    expect(read('work/timeline.md')).toBe(blank);
    const report = await mem.dream({ phase: 'curate' });
    expect(report.timelineHistory).toMatchObject({ relocations: 1, additions: 0 });
    expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
    expect(calls).toMatchObject({ extraction: 0, routing: 1, curator: 1 });
    expect(read('work/timeline.md')).toContain(event);
    expect(read('timeline.md')).toBe(parent.replace(event + '\n', ''));
    expect(read('work/notes.md')).toBe(source);
    expect((await mem.timeline({ timeline: 'work/timeline' })).results).toContainEqual(
      expect.objectContaining({ type: 'event', source: 'work/timeline' }),
    );
    const count = { ...calls };
    await mem.close();
    mem = await start({
      folders: {
        '**': { role: 'knowledge', remember: 'integrate' },
        'work/**': { role: 'source', remember: 'deny' },
      },
    });
    await mem.dream({ phase: 'curate' });
    expect(calls).toEqual({
      ...count,
      extraction: count.extraction + 1,
      verification: count.verification + 1,
    });
    await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
    expect(read('work/timeline.md')).toBe(blank);
    expect(read('timeline.md')).toBe(parent);
    expect(read('work/notes.md')).toBe(source);
  },
);

it('extracts permitted knowledge while leaving the enclosing source policy intact', async () => {
  await mem.close();
  const content = `---\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n---\n\n# Inspection\n\n${note}\n`;
  put('work/notes.md', content);
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  await mem.index({ rebuild: true, structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.timelineHistory.additions).toBe(1);
  expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/timeline.md')).toContain(line);
  expect(read('work/notes.md')).toBe(content);
});

it('lets the independent curator reject a proposed move without changing history or repeating it', async () => {
  extraction = () => [];
  curator = 'reject';
  put('timeline.md', ledger + line + '\n');
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan?.items[0]?.status).toBe('rejected');
  const count = { ...calls };
  await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(count);
  expect(read('timeline.md')).toContain(line);
});

it.each(['timeline.md', 'work/timeline.md'])(
  'holds a malformed generated reference in %s before transferring history',
  async (target) => {
    extraction = () => [];
    put('timeline.md', ledger + line + '\n');
    put(
      target,
      (read(target).trim() ? read(target) : ledger) + '<!-- akno:timeline-item id=mem_example -->\n',
    );
    const parent = read('timeline.md');
    const child = read('work/timeline.md');
    await mem.index({ structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan).toBeNull();
    expect(report.timelineHistory.held.source_ineligible).toBe(1);
    expect(calls.routing).toBe(0);
    expect(read('timeline.md')).toBe(parent);
    expect(read('work/timeline.md')).toBe(child);
  },
);

it.each(['source', 'boundary', 'purpose', 'destination', 'ledger-policy'])(
  'stales a proposal when its %s changes before apply',
  async (change) => {
    const report = await mem.dream({ phase: 'curate', mode: 'review' });
    const plan = mem.plan(report.maintenancePlan!.id);
    if (change === 'source') put('work/notes.md', '# Corrected\n\nThe inspection was cancelled.\n');
    if (change === 'boundary') put('work/subfolder/timeline.md', '');
    if (change === 'purpose') put('timeline.md', '# Timeline\n\nA different purpose.\n');
    if (change === 'destination') put('work/timeline.md', '# Timeline\n\nEdited while reviewing.\n');
    if (change === 'ledger-policy')
      put(
        'work/timeline.md',
        '---\ntype: timeline\nakno:\n  management:\n    remember: deny\n---\n\n# Timeline\n',
      );
    const before = read('work/timeline.md');
    mem.decidePlan(plan.id, plan.items[0]!.id, 'approve', 'Reviewed earlier source.');
    expect((await mem.applyPlan(plan.id)).plan.items[0]!.status).toBe('stale');
    expect(read('work/timeline.md')).toBe(before);
  },
);

it('will not broaden a sealed proposal into arbitrary ledger edits', async () => {
  const report = await mem.dream({ phase: 'curate', mode: 'review' });
  const plan = mem.plan(report.maintenancePlan!.id);
  await expect(
    mem.revisePlan(plan.id, plan.items[0]!.id, { after: '# Rewritten history\n' }),
  ).rejects.toThrow();
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('uses the nearest nested declaration and handles a configured default path', async () => {
  await mem.close();
  fs.renameSync(path.join(root, 'timeline.md'), path.join(root, 'history.md'));
  put('work/subproject/timeline.md', '');
  fs.renameSync(path.join(root, 'work/notes.md'), path.join(root, 'work/subproject/notes.md'));
  mem = await start({ paths: { timeline: 'history.md' } });
  await mem.index({ rebuild: true, structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/subproject/timeline.md')).toContain('[[work/subproject/notes]]');
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(read('history.md')).toBe(ledger);
});

it.each(['readonly', 'source-role', 'managed', 'document', 'symlink'])(
  'holds %s inputs without extracting unqualified history',
  async (kind) => {
    await mem.close();
    const overrides: ConfigDoc = {};
    if (kind === 'readonly')
      overrides.folders = {
        '**': { role: 'knowledge', remember: 'integrate' },
        'work/timeline': { remember: 'deny' },
      };
    if (kind === 'source-role') put('work/notes.md', '---\nakno:\n  role: source\n---\n\n' + note);
    if (kind === 'managed') put('work/notes.md', '# Note\n\n<!-- akno:item existing -->\n' + note);
    if (kind === 'document') put('work/notes.md', '# Note\n\n<!-- source -->\n' + note);
    if (kind === 'symlink') {
      fs.unlinkSync(path.join(root, 'work/notes.md'));
      fs.symlinkSync(path.join(root, 'timeline.md'), path.join(root, 'work/notes.md'));
    }
    mem = await start(overrides);
    await mem.index({ rebuild: true, structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan).toBeNull();
    expect(read('work/timeline.md')).toBe(' \t\r\n');
    expect(calls.extraction).toBe(kind === 'source-role' ? 1 : 0);
  },
);

it('holds failed verification and typed model unavailability without writes', async () => {
  verified = false;
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan).toBeNull();
  expect(report.timelineHistory.held.unqualified_event).toBe(1);
  await mem.close();
  mem = await start({ models: { derive: { id: null } } });
  const unavailable = await mem.dream({ phase: 'curate' });
  expect(unavailable.timelineHistory.held.model_unavailable).toBe(1);
  expect(unavailable.degraded.length).toBeGreaterThan(0);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('does not turn plans, reports, partial dates, or unverified legacy events into actual events', async () => {
  const base = candidate();
  extraction = () => [
    {
      ...base,
      kind: 'plan',
      discourse: { commitment: 'asserted', disposition: 'accepted' },
      time: { ...base.time, relation: 'scheduled', status: 'planned' },
    },
    {
      ...base,
      epistemic: { basis: 'source_report' },
      attribution: { source_role: 'external', source_speaker: 'Vulpine Mutual', chain: [] },
    },
    { ...base, time: { ...base.time, start: '2031-04', precision: 'month' } },
  ];
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan).toBeNull();
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('honors an off policy and the shared apply budget', async () => {
  await mem.close();
  mem = await start({ maintenance: { profile: 'audit', policies: { timeline_history: 'off' } } });
  expect((await mem.dream({ phase: 'curate' })).timelineHistory.inspected).toBe(0);
  expect(calls.extraction).toBe(0);
  await mem.close();
  mem = await start({ maintenance: { profile: 'autonomous', limits: { max_files_changed: 0 } } });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan?.items.find((item) => item.kind === 'timeline_history')).toMatchObject({
    statusCode: 'budget_exhausted',
  });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('replans unfinished work when the run policy changes instead of suppressing it as scanned', async () => {
  const review = await mem.dream({ phase: 'curate', mode: 'review' });
  expect(review.maintenancePlan?.items[0]?.status).toBe('proposed');
  const automatic = await mem.dream({ phase: 'curate' });
  expect(automatic.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/timeline.md')).toContain(line);
});

it('rolls back the first ledger if the second write fails, then retries after restart', async () => {
  extraction = () => [];
  put('timeline.md', ledger + line + '\n');
  await mem.index({ structuralOnly: true });
  const original = read('timeline.md');
  const report = await mem.dream({ phase: 'curate', mode: 'review' });
  const plan = mem.plan(report.maintenancePlan!.id);
  mem.decidePlan(plan.id, plan.items[0]!.id, 'approve', 'Exact verified transfer.');
  const rename = fsp.rename;
  let failed = false;
  vi.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
    if (!failed && String(to) === path.join(root, 'work/timeline.md')) {
      failed = true;
      throw new Error('Invented destination write failure');
    }
    return rename(from, to);
  });
  const blocked = await mem.applyPlan(plan.id);
  expect(blocked.plan.items[0]?.status).toBe('blocked');
  expect(read('timeline.md')).toBe(original);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  vi.restoreAllMocks();
  await mem.close();
  mem = await start();
  mem.decidePlan(plan.id, plan.items[0]!.id, 'approve', 'Destination is writable again.');
  const retried = await mem.applyPlan(plan.id, { idempotencyKey: 'history-retry' });
  expect(retried.plan.items[0]?.status).toBe('applied');
  const replay = await mem.applyPlan(plan.id, { idempotencyKey: 'history-retry' });
  expect(replay.replayed).toBe(true);
  expect(read('work/timeline.md').split(line)).toHaveLength(2);
});

it('preserves CRLF source bytes and retains distinct citation lines already present at the destination', async () => {
  extraction = () => [];
  const parent = ledger.replaceAll('\n', '\r\n') + line + '\r\n\r\nAuthored annotation.\r\n';
  put('timeline.md', parent);
  put('work/timeline.md', ledger + line.replace('[[work/notes]]', '[[work/another-note]]') + '\n');
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('timeline.md')).toBe(parent.replace(line + '\r\n', ''));
  expect(read('work/timeline.md')).toContain(line + '\r\n');
  expect(read('work/timeline.md')).toContain('[[work/another-note]]');
});

it.each(['continuation', 'fence', 'duplicate'])(
  'holds a %s event structure instead of removing only part of it',
  async (kind) => {
    extraction = () => [];
    const content =
      ledger +
      (kind === 'fence' ? '```md\n' : '') +
      line +
      '\n' +
      (kind === 'continuation'
        ? '  This qualifier belongs to the event.\n'
        : kind === 'duplicate'
          ? line + '\n'
          : '```\n');
    put('timeline.md', content);
    await mem.index({ structuralOnly: true });
    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan).toBeNull();
    expect(read('timeline.md')).toBe(content);
    expect(calls.routing).toBe(0);
  },
);

it('keeps oversized evidence out of the curator prompt without truncating or writing it', async () => {
  put('work/notes.md', '# Inspection\n\n' + note + '\n\n' + 'Unrelated invented context. '.repeat(3500));
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.timelineHistory.held.limit).toBeGreaterThan(0);
  expect(report.maintenancePlan).toBeNull();
  expect(calls.curator).toBe(0);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it.each([
  '[inspection](attachments/inspection.pdf)',
  '[inspection][receipt]',
  '[^receipt]',
  '<a href="attachments/inspection.pdf">inspection</a>',
])('holds context-dependent citation %s instead of changing its meaning', async (citation) => {
  extraction = () => [];
  const content = ledger + line + ' ' + citation + '\n';
  put('timeline.md', content);
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan).toBeNull();
  expect(report.timelineHistory.held.source_ineligible).toBe(1);
  expect(read('timeline.md')).toBe(content);
});

it('continues a bounded source after the first candidate is rejected', async () => {
  const nextNote = 'On 2031-04-02, Ada Marlow completed the Zephyr QX-100 repair.';
  put('work/notes.md', '# Inspection\n\n' + note + '\n\n' + nextNote + '\n');
  extraction = () => [
    candidate(),
    {
      ...candidate(nextNote),
      text: 'Ada Marlow completed the Zephyr QX-100 repair.',
      time: { ...candidate().time, start: '2031-04-02' },
    },
  ];
  await mem.close();
  mem = await start({ maintenance: { profile: 'autonomous', curate: { max_timeline_events: 1 } } });
  await mem.index({ structuralOnly: true });
  curator = 'reject';
  const firstResult = await mem.dream({ phase: 'curate' });
  expect(firstResult.maintenancePlan?.items[0]?.status).toBe('rejected');
  curator = 'approve';
  const second = await mem.dream({ phase: 'curate' });
  expect(second.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/timeline.md')).toContain('Ada Marlow completed the Zephyr QX-100 repair.');
  expect(read('work/timeline.md')).not.toContain(summary);
});

const notice = 'Vulpine Mutual states that the Zephyr QX-100 inspection is scheduled for 8 April 2031.';
function sourceCandidate(quote = notice, date = '2031-04-08', speaker = 'Vulpine Mutual') {
  return {
    ...candidate(quote),
    text: `${speaker} states that the Zephyr QX-100 inspection is scheduled for ${date}.`,
    attribution: { source_role: 'external', source_speaker: speaker, chain: [] },
    epistemic: { basis: 'source_report' },
    time: { ...candidate().time, relation: 'scheduled', status: 'scheduled', start: date },
  };
}
async function sourceSetup(config: ConfigDoc = {}) {
  await mem.close();
  put('work/notes.md', '# Notice\n\n' + notice + '\n');
  extraction = (source) => (source.includes(notice) ? [sourceCandidate()] : []);
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
    ...config,
  });
  await mem.index({ structuralOnly: true });
}

it('curates source evidence into a qualified canonical companion and ledger, with receipts and exact undo', async () => {
  await sourceSetup();
  const before = read('work/notes.md');
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan?.items[0]).toMatchObject({ kind: 'timeline_history', status: 'applied' });
  expect(read('work/timeline.md')).toContain('reported by Vulpine Mutual');
  expect(read('work/timeline.md')).toContain('2031-04-08');
  expect(read('work/timeline-memories.md')).toContain('Reported by Vulpine Mutual · Scheduled:');
  expect(read('work/timeline-memories.md')).toContain('[[work/notes]]');
  expect(read('work/notes.md')).toBe(before);
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
  expect((await mem.timeline({ source: 'plan' })).total).toBe(0);
  await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
  expect(read('work/notes.md')).toBe(before);
});

it('skips successfully curated unchanged sources across repeats, rebuild and restart', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate' });
  const original = read('work/timeline.md');
  const count = { ...calls };
  await mem.dream({ phase: 'curate' });
  await mem.index({ rebuild: true, structuralOnly: true });
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(count);
  expect(read('work/timeline.md')).toBe(original);
});

it('consolidates copied assertions with citations without duplicate ledger lines', async () => {
  await sourceSetup();
  put('work/copy.md', '# Notice\n\n' + notice + '\n');
  await mem.index({ structuralOnly: true });
  await mem.dream({ phase: 'curate' });
  await mem.dream({ phase: 'curate' });
  expect(read('work/timeline.md').match(/akno:timeline-item id=/gu) ?? []).toHaveLength(1);
  const detail = read('work/timeline-memories.md');
  expect(detail).toContain('[[work/copy]]');
  expect(detail).toContain('[[work/notes]]');
  expect(detail.match(/akno:item mem_/gu) ?? []).toHaveLength(1);
});

it('preserves conflicting date assertions and their distinct speakers', async () => {
  await sourceSetup();
  const other = 'Bo Winters states that the Zephyr QX-100 inspection is scheduled for 9 April 2031.';
  put('work/other.md', '# Notice\n\n' + other + '\n');
  extraction = (source) =>
    source.includes(other) ? [sourceCandidate(other, '2031-04-09', 'Bo Winters')] : [sourceCandidate()];
  await mem.index({ structuralOnly: true });
  await mem.dream({ phase: 'curate' });
  await mem.dream({ phase: 'curate' });
  const timeline = read('work/timeline.md');
  expect(timeline).toContain('2031-04-08');
  expect(timeline).toContain('2031-04-09');
  expect(timeline).toContain('reported by Vulpine Mutual');
  expect(timeline).toContain('reported by Bo Winters');
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(2);
});

it('stales a sealed source retention plan when the source changes before apply', async () => {
  await sourceSetup();
  const result = await mem.dream({ phase: 'curate', mode: 'review' });
  const plan = mem.plan(result.maintenancePlan!.id);
  put('work/notes.md', '# Corrected notice\n\nThe inspection date is unknown.\n');
  mem.decidePlan(plan.id, plan.items[0]!.id, 'approve', 'Reviewed the earlier invented notice.');
  expect((await mem.applyPlan(plan.id)).plan.items[0]!.status).toBe('stale');
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
});

it('curates readable source documents without altering them or processing their rendition twice', async () => {
  await sourceSetup();
  fs.unlinkSync(path.join(root, 'work/notes.md'));
  put('work/notice.txt', notice);
  await mem.index();
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/notice.txt')).toBe(notice);
  expect(read('work/timeline-memories.md')).toContain('[Source](notice.txt)');
  expect(read('work/timeline.md')).toContain('2031-04-08');
  const count = { ...calls };
  await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(count);
});

it.each(['companion', 'pattern-deny', 'ledger', 'symlink', 'collision'])(
  'respects the %s fence without source or ledger changes',
  async (kind) => {
    const folders: NonNullable<ConfigDoc['folders']> = {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    };
    if (kind === 'companion') folders['work/timeline-memories'] = { remember: 'deny' };
    if (kind === 'pattern-deny') folders['**/timeline-memories'] = { remember: 'deny' };
    if (kind === 'ledger') folders['work/timeline'] = { remember: 'deny' };
    if (kind === 'symlink')
      fs.symlinkSync(path.join(root, 'timeline.md'), path.join(root, 'work/timeline-memories.md'));
    if (kind === 'collision') put('work/timeline-memories.md', '# My notes\n\nPrivate authored page.\n');
    await sourceSetup({ folders });
    const before = read('work/notes.md');
    expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
    expect(read('work/timeline.md')).toBe(' \t\r\n');
    expect(read('work/notes.md')).toBe(before);
  },
);

it('keeps source dry runs free of progress, receipts and canonical writes', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate', dryRun: true });
  const count = calls.extraction;
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect(calls.extraction).toBe(count + 1);
});

it('continues a bounded cached source without re-extracting already verified candidates', async () => {
  await sourceSetup({ maintenance: { profile: 'autonomous', curate: { max_timeline_events: 1 } } });
  const later = 'Vulpine Mutual states that the Zephyr QX-100 repair is scheduled for 9 April 2031.';
  put('work/notes.md', '# Notices\n\n' + notice + '\n\n' + later + '\n');
  extraction = () => [
    sourceCandidate(),
    {
      ...sourceCandidate(later, '2031-04-09'),
      text: 'Vulpine Mutual states that the Zephyr QX-100 repair is scheduled for 2031-04-09.',
    },
  ];
  await mem.index({ structuralOnly: true });
  await mem.dream({ phase: 'curate' });
  expect(calls.extraction).toBe(1);
  await mem.dream({ phase: 'curate' });
  expect(calls.extraction).toBe(1);
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(2);
});

it('continues other facts in a source after the curator rejects one bounded batch', async () => {
  await sourceSetup({ maintenance: { profile: 'autonomous', curate: { max_timeline_events: 1 } } });
  const later = 'Vulpine Mutual states that the Zephyr QX-100 repair is scheduled for 9 April 2031.';
  put('work/notes.md', '# Notices\n\n' + notice + '\n\n' + later + '\n');
  extraction = () => [
    sourceCandidate(),
    {
      ...sourceCandidate(later, '2031-04-09'),
      text: 'Vulpine Mutual states that the Zephyr QX-100 repair is scheduled for 2031-04-09.',
    },
  ];
  await mem.index({ structuralOnly: true });
  curator = 'reject';
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('rejected');
  curator = 'approve';
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect(calls.extraction).toBe(1);
  expect(read('work/timeline.md')).not.toContain('2031-04-08');
  expect(read('work/timeline.md')).toContain('2031-04-09');
});

it('processes a corrected source revision without silently retracting an omitted assertion', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate' });
  const corrected = 'Vulpine Mutual states that the Zephyr QX-100 inspection is scheduled for 9 April 2031.';
  put('work/notes.md', '# Changed notice\n\n' + corrected + '\n');
  extraction = () => [sourceCandidate(corrected, '2031-04-09')];
  await mem.index({ structuralOnly: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/timeline.md')).toContain('2031-04-08');
  expect(read('work/timeline.md')).toContain('2031-04-09');
});

it('requires equivalence before merging paraphrases and preserves both source citations', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate' });
  const relay = 'A forwarded copy of the notice: ' + notice;
  put('work/relay.md', '# Forward\n\n' + relay + '\n');
  extraction = (source) =>
    source.includes(relay)
      ? [
          {
            ...sourceCandidate(notice),
            text: 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
          },
        ]
      : [sourceCandidate()];
  equivalence = 'event_1';
  await mem.index({ structuralOnly: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect(read('work/timeline.md').match(/akno:timeline-item id=/gu) ?? []).toHaveLength(1);
  const detail = read('work/timeline-memories.md');
  expect(detail).toContain('[[work/relay]]');
  expect(detail).toContain('[[work/notes]]');
  const supports = detail.match(/supports=([^ ]+)/u)![1]!.split(',');
  expect(supports).toHaveLength(2);
  expect(new Set(supports.map((item) => item.split('@')[2])).size).toBe(1);
});

it.each(['new', 'uncertain'])(
  'keeps same-day assertion identity %s separate or held without destructive merging',
  async (outcome) => {
    await sourceSetup();
    await mem.dream({ phase: 'curate' });
    const other = 'Vulpine Mutual states a second Zephyr QX-100 inspection is scheduled for 8 April 2031.';
    put('work/other.md', '# Notice\n\n' + other + '\n');
    extraction = (source) =>
      source.includes(other)
        ? [
            {
              ...sourceCandidate(other),
              text: 'Vulpine Mutual states a second Zephyr QX-100 inspection is scheduled for 2031-04-08.',
            },
          ]
        : [sourceCandidate()];
    equivalence = outcome;
    await mem.index({ structuralOnly: true });
    await mem.dream({ phase: 'curate' });
    expect(read('work/timeline.md').match(/akno:timeline-item id=/gu) ?? []).toHaveLength(
      outcome === 'new' ? 2 : 1,
    );
    if (outcome === 'uncertain') expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  },
);

it('makes a partial source hold visible and continues another eligible file', async () => {
  await sourceSetup({ maintenance: { profile: 'autonomous', curate: { max_pages: 1 } } });
  put('work/a-held.md', '# Incomplete notice\n\nVulpine Mutual describes an inspection without its date.\n');
  extraction = (source) =>
    source.includes(notice)
      ? [sourceCandidate()]
      : [{ ...sourceCandidate(source), support: [{ quote: 'An absent quote', item_id: null }] }];
  await mem.index({ structuralOnly: true });
  const first = await mem.dream({ phase: 'curate' });
  expect(first.maintenancePlan).toBeNull();
  expect(first.timelineHistory.held.unqualified_event).toBeGreaterThan(0);
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
});

it('does not re-extract successful facts while a partial source waits for retry', async () => {
  await sourceSetup();
  extraction = (source) => [
    sourceCandidate(),
    {
      ...sourceCandidate(source),
      text: 'Vulpine Mutual scheduled a second Zephyr QX-100 inspection for 2031-04-09.',
      support: [{ quote: 'Absent evidence', item_id: null }],
    },
  ];
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  const count = { ...calls };
  const repeat = await mem.dream({ phase: 'curate' });
  expect(repeat.maintenancePlan).toBeNull();
  expect(repeat.timelineHistory.held.unqualified_event).toBeGreaterThan(0);
  expect(calls).toEqual(count);
  expect(read('work/timeline.md').match(/akno:timeline-item id=/gu) ?? []).toHaveLength(1);
});

it('respects basename ignore policies on previously indexed source revisions', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate' });
  const before = read('work/timeline.md');
  await mem.close();
  put('work/notes.md', '# Changed notice\n\n' + notice + '\nAdditional context.\n');
  mem = await start({
    ignore: ['notes.md'],
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  const count = { ...calls };
  const result = await mem.dream({ phase: 'curate' });
  expect(result.maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
  expect(read('work/timeline.md')).toBe(before);
});

it('keeps an owner-undone source transfer undone on the next curation', async () => {
  await sourceSetup();
  const result = await mem.dream({ phase: 'curate' });
  await mem.undo({ change_id: result.maintenancePlan!.items[0]!.changeId! });
  const count = { ...calls };
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('preserves explicit date disagreements across cached source batches', async () => {
  await sourceSetup({ maintenance: { profile: 'autonomous', curate: { max_timeline_events: 1 } } });
  const contrary =
    'Vulpine Mutual also states that the Zephyr QX-100 inspection is scheduled for 9 April 2031, contradicting the earlier date.';
  put('work/notes.md', '# Notices\n\n' + notice + '\n\n' + contrary + '\n');
  extraction = () => [
    sourceCandidate(),
    {
      ...sourceCandidate(contrary, '2031-04-09'),
      relations: [
        { type: 'contradicts', target_candidate: 0, support: [{ quote: contrary, item_id: null }] },
      ],
    },
  ];
  await mem.index({ structuralOnly: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect(calls.extraction).toBe(1);
  expect(read('work/timeline.md')).toContain('2031-04-08');
  expect(read('work/timeline.md')).toContain('2031-04-09');
  expect(read('work/timeline-memories.md')).toMatch(/links=contradicts:memory%3Amem_/u);
});

it('recovers a partial ledger and companion application after restart', async () => {
  await sourceSetup();
  const result = await mem.dream({ phase: 'curate', mode: 'review' });
  const plan = mem.plan(result.maintenancePlan!.id);
  const item = plan.items[0]!;
  mem.decidePlan(plan.id, item.id, 'approve', 'Exercise invented source transfer recovery.');
  const db = new Database(mem.config.dbPath);
  db.prepare("UPDATE maintenance_items SET status = 'applying', policy = 'auto' WHERE id = ?").run(item.id);
  db.prepare("UPDATE maintenance_plans SET mode = 'auto' WHERE id = ?").run(plan.id);
  db.close();
  const first = item.operations[0]!;
  if (!('after' in first)) throw new Error('Unexpected source transfer operation');
  put(first.relPath, first.after);
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  const recovered = await mem.dream({ phase: 'curate' });
  expect(recovered.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(calls.extraction).toBe(1);
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
  const count = { ...calls };
  await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(count);
  await mem.undo({ change_id: recovered.maintenancePlan!.items[0]!.changeId! });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
});

it('adds support to an existing canonical item outside the companion instead of duplicating it', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate' });
  put('work/canonical.md', read('work/timeline-memories.md'));
  fs.unlinkSync(path.join(root, 'work/timeline-memories.md'));
  put('work/copy.md', '# Forwarded notice\n\n' + notice + '\n');
  await mem.index({ structuralOnly: true });
  const result = await mem.dream({ phase: 'curate' });
  expect(result.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(result.timelineHistory.additions).toBe(0);
  expect(read('work/canonical.md')).toContain('[[work/copy]]');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
  expect(read('work/timeline.md').match(/akno:timeline-item id=/gu) ?? []).toHaveLength(1);
});

it('never places a physical default-ledger companion inside another timeline scope', async () => {
  put('work/default.md', '# Timeline\n\nGeneral chronology.\n');
  put('notice.md', '---\nakno:\n  role: source\n---\n\n# Notice\n\n' + notice + '\n');
  await sourceSetup({ paths: { timeline: 'work/default.md' } });
  const before = read('work/default.md');
  const result = await mem.dream({ phase: 'curate' });
  expect(result.timelineHistory.held.destination_unavailable).toBeGreaterThan(0);
  expect(read('work/default.md')).toBe(before);
  expect(fs.existsSync(path.join(root, 'work/default-memories.md'))).toBe(false);
  expect(read('work/timeline.md')).toContain('2031-04-08');
});

it('completes a partial-source retry even when the verified wording changes candidate identities', async () => {
  await sourceSetup();
  extraction = (source) => [
    sourceCandidate(),
    {
      ...sourceCandidate(source),
      text: 'Vulpine Mutual scheduled a second Zephyr QX-100 inspection for 2031-04-09.',
      support: [{ quote: 'Absent evidence', item_id: null }],
    },
  ];
  await mem.dream({ phase: 'curate' });
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(Date.now() + 31 * 60_000);
    extraction = () => [
      {
        ...sourceCandidate(),
        text: 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
      },
    ];
    equivalence = 'event_1';
    const retried = await mem.dream({ phase: 'curate' });
    expect(retried.maintenancePlan?.items[0]?.status).toBe('applied');
    const count = { ...calls };
    const repeat = await mem.dream({ phase: 'curate' });
    expect(repeat.maintenancePlan).toBeNull();
    expect(repeat.timelineHistory.cached).toBeGreaterThan(0);
    expect(calls).toEqual(count);
    expect(read('work/timeline.md').match(/akno:timeline-item id=/gu) ?? []).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});
