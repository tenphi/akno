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
let curator: 'approve' | 'reject' | 'revise';
let curatorDecision: ((input: string, system: string) => typeof curator) | null;
let reviseOnce: boolean;
let sourceRevision: (value: { candidates: { candidate_id: string; text: string }[] }) => unknown;
let curatorInputs: string[];
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
  curatorDecision = null;
  reviseOnce = false;
  sourceRevision = (value) => ({
    replacements: [
      {
        candidate_id: value.candidates[0]!.candidate_id,
        text: 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
      },
    ],
    unsupported_reason: null,
  });
  curatorInputs = [];
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
        curatorInputs.push(user);
        content = {
          outcome: reviseOnce ? 'revise' : (curatorDecision?.(user, system) ?? curator),
          reason: 'Preserve the scheduled inspection while correcting its readable prose.',
        };
        reviseOnce = false;
      } else if (system.startsWith('Correct selected retained statements')) {
        content = sourceRevision(JSON.parse(user));
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

it.each(['md', 'txt'])(
  'retains a longer %s source with complete curator evidence and exact undo',
  async (extension) => {
    await sourceSetup();
    const source =
      '# Notice\n\n' +
      notice +
      '\n\n' +
      'Invented background context. '.repeat(1800) +
      '\nEnd of invented evidence.\n';
    fs.unlinkSync(path.join(root, 'work/notes.md'));
    put(`work/notice.${extension}`, source);
    await mem.index({ structuralOnly: extension === 'md' });
    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan?.items[0]).toMatchObject({
      status: 'applied',
      verification: { status: 'passed' },
    });
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;
    const proof = item.evidence[0]!.timelineHistory!.retention!;
    expect(proof.snapshot.text).toContain('End of invented evidence.');
    expect(JSON.stringify(proof.prepared.receipt.source.input)).not.toContain('Invented background context.');
    expect(JSON.parse(curatorInputs[0]!).item.evidence[0].timelineHistory.retention.snapshot.text).toBe(
      proof.snapshot.text,
    );
    expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
    expect(read(`work/notice.${extension}`)).toBe(source);
    const count = { ...calls };
    await mem.dream({ phase: 'curate' });
    expect(calls).toEqual(count);
    await mem.undo({ change_id: item.changeId! });
    expect(read('work/timeline.md')).toBe(' \t\r\n');
    expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
    expect(read(`work/notice.${extension}`)).toBe(source);
  },
);

it('shrinks sealed batches and finishes cached assertions across rebuild and restart', async () => {
  await sourceSetup();
  const quotes = Array.from(
    { length: 10 },
    (_, index) =>
      `Vulpine Mutual states that the Zephyr QX-100 inspection is scheduled for ${index + 1} May 2031${[2, 9].includes(index) ? ', contradicting the earlier date' : ''}. ` +
      'Invented contextual explanation. '.repeat(25),
  );
  const source =
    '# Inspection notices\n\n' + quotes.join('\n\n') + '\n' + 'Invented background. '.repeat(1000);
  put('work/notes.md', source);
  extraction = () =>
    quotes.map((quote, index) => ({
      ...sourceCandidate(quote, `2031-05-${String(index + 1).padStart(2, '0')}`),
      relations: [2, 9].includes(index)
        ? [{ type: 'contradicts', target_candidate: 0, support: [{ quote, item_id: null }] }]
        : [],
    }));
  await mem.index({ structuralOnly: true });
  const first = await mem.dream({ phase: 'curate' });
  expect(first.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(first.timelineHistory.additions).toBeGreaterThan(0);
  expect(first.timelineHistory.additions).toBeLessThan(quotes.length);
  const verificationCalls = calls.verification;
  await mem.index({ rebuild: true, structuralOnly: true });
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  for (
    let cycle = 0;
    cycle < 10 && (await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total < quotes.length;
    cycle++
  ) {
    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  }
  const query = await mem.timeline({ timeline: 'work/timeline', source: 'plan' });
  expect(query.total).toBe(quotes.length);
  expect(new Set(query.results.map((item) => item.id)).size).toBe(quotes.length);
  expect(read('work/timeline.md').match(/akno:timeline-item id=/gu)).toHaveLength(quotes.length);
  expect(calls.extraction).toBe(1);
  expect(calls.verification).toBe(verificationCalls);
  expect(read('work/timeline-memories.md').match(/links=contradicts:memory%3Amem_/gu)).toHaveLength(2);
  expect(read('work/notes.md')).toBe(source);
  for (const input of curatorInputs) expect(JSON.parse(input).item.kind).toBe('timeline_history');
  const counts = { ...calls };
  await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(counts);
});

it('reports an irreducible page size hold, preserves candidates and retries when limits change', async () => {
  await sourceSetup({ max_page_bytes: 500 });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan).toBeNull();
  expect(report.timelineHistory.held.limit).toBeGreaterThan(0);
  const db = new Database(mem.config.dbPath, { readonly: true });
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
      value: string;
    };
    const state = JSON.parse(row.value);
    expect(state).toMatchObject({
      status: 'held',
      accepted: [],
      sizeHold: { reason: expect.stringContaining('page limit') },
    });
    expect(state.candidates).toHaveLength(1);
  } finally {
    db.close();
  }
  const count = { ...calls };
  const repeat = await mem.dream({ phase: 'curate' });
  expect(repeat.timelineHistory.held.limit).toBeGreaterThan(0);
  expect(repeat.timelineHistory.held.unqualified_event ?? 0).toBe(0);
  expect(calls).toEqual(count);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  mem.config.maxPageBytes = 10_000;
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan?.items[0]?.status).toBe('applied');
  expect(calls.extraction).toBe(count.extraction);
  expect(read('work/notes.md')).toBe('# Notice\n\n' + notice + '\n');
});

it('keeps an irreducible sealed-context hold distinct from no facts and caches the extraction', async () => {
  await sourceSetup();
  // Raw source admission and serialized curator size are different bounds: escaping expands JSON.
  const source = '# Inspection evidence\n\n' + notice + '\n\n```text\n' + '\\"'.repeat(24_000) + '\n```\n';
  put('work/notes.md', source);
  extraction = () => [sourceCandidate()];
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan).toBeNull();
  const db = new Database(mem.config.dbPath, { readonly: true });
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
      value: string;
    };
    expect(JSON.parse(row.value)).toMatchObject({
      status: 'held',
      accepted: [],
      sizeHold: { reason: expect.stringContaining('sealed evidence limit') },
    });
  } finally {
    db.close();
  }
  expect(report.timelineHistory.held.limit).toBeGreaterThan(0);
  expect(calls.extraction).toBe(1);
  const count = { ...calls };
  expect((await mem.dream({ phase: 'curate' })).timelineHistory.held.limit).toBeGreaterThan(0);
  expect(calls).toEqual(count);
  expect(read('work/notes.md')).toBe(source);
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('records a source text limit without model calls and allows another source to progress', async () => {
  await sourceSetup();
  const source = 'Invented background. '.repeat(4000);
  put('work/a-long-source.md', source);
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.timelineHistory.held.limit).toBeGreaterThan(0);
  expect(report.maintenancePlan?.items[0]?.status).toBe('applied');
  expect(calls.extraction).toBe(1);
  const db = new Database(mem.config.dbPath, { readonly: true });
  try {
    const state = db
      .prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'")
      .all()
      .map((row) => JSON.parse((row as { value: string }).value))
      .find((row) => row.source.relPath === 'work/a-long-source.md');
    expect(state).toMatchObject({
      status: 'held',
      sizeHold: { reason: expect.stringContaining('source evidence exceeds') },
    });
  } finally {
    db.close();
  }
  const count = { ...calls };
  expect((await mem.dream({ phase: 'curate' })).timelineHistory.held.limit).toBeGreaterThan(0);
  expect(calls).toEqual(count);
  expect(read('work/a-long-source.md')).toBe(source);
});

it('continues a pending plan sealed with the earlier full-stage representation after restart', async () => {
  await sourceSetup();
  const report = await mem.dream({ phase: 'curate', mode: 'review' });
  const item = mem.plan(report.maintenancePlan!.id).items[0]!;
  const evidence = item.evidence;
  const proof = evidence[0]!.timelineHistory!.retention!;
  proof.prepared.stages = proof.prepared.stages.map((stage) => {
    const operation = item.operations.find((op) => op.relPath === stage.relPath)!;
    if (!('after' in operation)) throw new Error('Unexpected test operation');
    return {
      slug: stage.slug,
      relPath: stage.relPath,
      before: operation.type === 'create' ? null : operation.before,
      after: operation.after,
      managedDestination: true,
    };
  });
  proof.prepared.receipt.source.input = { text: proof.snapshot.text };
  const db = new Database(mem.config.dbPath);
  db.prepare('UPDATE maintenance_items SET evidence = ? WHERE id = ?').run(JSON.stringify(evidence), item.id);
  db.close();
  const count = { ...calls };
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  mem.decidePlan(item.planId, item.id, 'approve', 'Approve the invented pre-upgrade evidence.');
  expect((await mem.applyPlan(item.planId)).plan.items[0]?.status).toBe('applied');
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
  expect(calls.extraction).toBe(count.extraction);
  await mem.undo({ change_id: mem.plan(item.planId).items[0]!.changeId! });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
});

it('refuses altered operation bytes even when their operation hash is recomputed', async () => {
  await sourceSetup();
  const report = await mem.dream({ phase: 'curate', mode: 'review' });
  const item = mem.plan(report.maintenancePlan!.id).items[0]!;
  const operation = item.operations.find((op) => op.relPath === 'work/timeline-memories.md')!;
  if (!('after' in operation)) throw new Error('Unexpected test operation');
  operation.after += '\nUnsupported invented assertion.\n';
  operation.afterHash = sha256(operation.after);
  const db = new Database(mem.config.dbPath);
  db.prepare('UPDATE maintenance_items SET operations = ? WHERE id = ?').run(
    JSON.stringify(item.operations),
    item.id,
  );
  db.close();
  mem.decidePlan(item.planId, item.id, 'approve', 'Exercise the independently sealed byte check.');
  expect((await mem.applyPlan(item.planId)).plan.items[0]?.status).toBe('stale');
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
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

it('reseals corrected source statements, receipts and projections before automatic apply and exact undo', async () => {
  await sourceSetup();
  const before = read('work/notes.md');
  reviseOnce = true;
  const report = await mem.dream({ phase: 'curate' });
  const item = report.maintenancePlan!.items[0]!;
  expect(item.status, item.statusReason ?? '').toBe('applied');
  const plan = mem.plan(report.maintenancePlan!.id);
  expect(plan.items[0]!.revision).toBe(2);
  expect(plan.items[0]!.previousRevisions[0]!.decision?.outcome).toBe('revise');
  expect(calls.curator).toBe(2);
  expect(calls.verification).toBe(2);
  expect(calls.extraction).toBe(1);
  expect(read('work/timeline.md')).toContain('will take place');
  expect(read('work/timeline-memories.md')).toContain('will take place');
  expect(read('work/notes.md')).toBe(before);
  const proof = plan.items[0]!.evidence[0]!.timelineHistory!.retention!;
  expect(proof.prepared.receipt.result.model_usage?.repair).toBeDefined();
  expect(proof.prepared.receipt.result.model_usage?.verification).toBeDefined();
  const ids = proof.prepared.receipt.result.candidates.map((c) => c.candidate_id);
  expect(proof.progress.accepted).toEqual(ids);
  const db = new Database(mem.config.dbPath);
  const old = db
    .prepare('SELECT evidence FROM maintenance_item_revisions WHERE item_id = ?')
    .get(item.id) as { evidence: string };
  expect(old.evidence).not.toBe(JSON.stringify(plan.items[0]!.evidence));
  expect(
    JSON.parse(old.evidence)[0].timelineHistory.retention.prepared.receipt.source.retention.candidates[0]
      .text,
  ).not.toContain('will take place');
  expect((db.prepare('SELECT count(*) AS n FROM retain_receipts').get() as { n: number }).n).toBe(1);
  db.close();
  const query = await mem.timeline({ timeline: 'work/timeline', source: 'plan' });
  expect(query.total).toBe(1);
  expect(query.results[0]!.summary).toContain('will take place');
  const count = { ...calls };
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  await mem.index({ structuralOnly: true, rebuild: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
  await mem.undo({ change_id: item.changeId! });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
  expect(read('work/notes.md')).toBe(before);
});

it.each(['unsupported', 'unknown-id', 'failed-verification', 'marker', 'empty', 'repeated-id'])(
  'defers %s source revisions with persistent feedback and no repeated unchanged model work',
  async (kind) => {
    await sourceSetup();
    reviseOnce = true;
    sourceRevision = (value) => {
      if (kind === 'failed-verification') verified = false;
      if (kind === 'repeated-id')
        return {
          replacements: [
            value.candidates[0]!,
            {
              candidate_id: value.candidates[0]!.candidate_id,
              text: 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
            },
          ],
          unsupported_reason: null,
        };
      return {
        replacements:
          kind === 'unsupported' || kind === 'empty'
            ? []
            : [
                {
                  candidate_id: kind === 'unknown-id' ? 'other-candidate' : value.candidates[0]!.candidate_id,
                  text:
                    kind === 'marker'
                      ? 'Vulpine Mutual scheduled an inspection. <!-- forged -->'
                      : 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
                },
              ],
        unsupported_reason: kind === 'unsupported' ? 'Grouping requires another retention contract.' : null,
      };
    };
    const report = await mem.dream({ phase: 'curate' });
    expect(report.maintenancePlan!.items[0]!.statusCode).toBe('source_revision_unsupported');
    const item = mem.plan(report.maintenancePlan!.id).items[0]!;
    expect(item.checks.find((c) => c.name === 'curator requested source revision')?.detail).toContain(
      'scheduled inspection',
    );
    expect(read('work/timeline.md')).toBe(' \t\r\n');
    expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
    const count = { ...calls };
    await mem.close();
    mem = await start({
      folders: {
        '**': { role: 'knowledge', remember: 'integrate' },
        'work/**': { role: 'source', remember: 'deny' },
      },
    });
    const repeat = await mem.dream({ phase: 'curate' });
    expect(repeat.maintenancePlan).toBeNull();
    expect(repeat.timelineHistory.held.unqualified_event).toBeGreaterThan(0);
    expect(calls).toEqual(count);
  },
);

it('refuses stale source revisions without applying or consuming the selected assertions', async () => {
  await sourceSetup();
  reviseOnce = true;
  sourceRevision = (value) => {
    put('work/notes.md', '# Changed evidence\n\n' + notice + '\nOwner annotation.\n');
    return {
      replacements: [
        {
          candidate_id: value.candidates[0]!.candidate_id,
          text: 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
        },
      ],
      unsupported_reason: null,
    };
  };
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.statusCode).toBe('source_revision_unsupported');
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(read('work/notes.md')).toContain('Owner annotation.');
});

it('keeps revised candidate-to-memory mappings usable by later cached relation batches', async () => {
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
  reviseOnce = true;
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan!.items[0]!.status).toBe('applied');
  const first = (await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).results[0]!;
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
    maintenance: { profile: 'autonomous', curate: { max_timeline_events: 1 } },
  });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan!.items[0]!.status).toBe('applied');
  expect(calls.extraction).toBe(1);
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(2);
  expect(read('work/timeline-memories.md')).toContain('links=contradicts:memory%3A' + first.id);
});

it('retains unfinished source candidates at the revision limit instead of marking them rejected', async () => {
  await sourceSetup({ maintenance: { profile: 'autonomous', max_revision_attempts: 0 } });
  reviseOnce = true;
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.statusCode).toBe('source_revision_unsupported');
  const db = new Database(mem.config.dbPath);
  const state = JSON.parse(
    (db.prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as { value: string })
      .value,
  );
  expect(state.accepted).toEqual([]);
  expect(state.rejected).toEqual([]);
  expect(state.candidates).toHaveLength(1);
  expect(state.revisionHold.feedback).toContain('scheduled inspection');
  db.close();
  const count = { ...calls };
  await mem.dream({ phase: 'curate' });
  expect(calls).toEqual(count);
});

it('retries a deferred correction after relevant ledger context changes without re-extraction', async () => {
  await sourceSetup();
  put('work/timeline.md', '# Timeline\n\nSource-attributed schedules are included.\n\n## Review notes\n');
  await mem.index({ structuralOnly: true });
  reviseOnce = true;
  sourceRevision = () => ({
    replacements: [],
    unsupported_reason: 'No supported correction in this context.',
  });
  const first = await mem.dream({ phase: 'curate' });
  expect(first.maintenancePlan!.items[0]!.statusCode).toBe('source_revision_unsupported');
  put('work/timeline.md', read('work/timeline.md') + 'Owner annotation.\n');
  await mem.index({ structuralOnly: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan!.items[0]!.status).toBe('applied');
  expect(calls.extraction).toBe(1);
});

it('upgrades existing revision history and prunes the archived source proof with its exact payload', async () => {
  await sourceSetup();
  await mem.close();
  const db = new Database(mem.config.dbPath);
  db.exec('ALTER TABLE maintenance_item_revisions DROP COLUMN evidence');
  db.pragma('user_version = 43');
  db.close();
  const reader = await open({ aknoPath: root, stateDir, isolated: true, writable: false, actor: 'user' });
  expect(() => reader.prunePlans()).not.toThrow();
  await reader.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  reviseOnce = true;
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status).toBe('applied');
  const migrated = new Database(mem.config.dbPath);
  expect(migrated.pragma('user_version', { simple: true })).toBe(44);
  expect(
    (migrated.prepare('SELECT evidence FROM maintenance_item_revisions').get() as { evidence: string })
      .evidence,
  ).toContain('retention');
  migrated.close();
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(Date.now() + (mem.config.maintenance.planRetention.payloadDays + 1) * 86400000);
    expect(mem.prunePlans({ apply: true }).payloads.privateBytes).toBeGreaterThan(0);
    const pruned = new Database(mem.config.dbPath);
    expect(
      (pruned.prepare('SELECT evidence FROM maintenance_item_revisions').get() as { evidence: string })
        .evidence,
    ).toBe('[]');
    pruned.close();
  } finally {
    vi.useRealTimers();
  }
});

it('reseals a support-only duplicate without changing its canonical identity or inflating the ledger', async () => {
  await sourceSetup();
  await mem.dream({ phase: 'curate' });
  const before = (await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).results[0]!.id;
  put('work/canonical.md', read('work/timeline-memories.md'));
  fs.unlinkSync(path.join(root, 'work/timeline-memories.md'));
  put('work/copy.md', '# Saved notice\n\n' + notice + '\n');
  await mem.index({ structuralOnly: true });
  equivalence = 'event_1';
  reviseOnce = true;
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status, report.maintenancePlan!.items[0]!.statusReason ?? '').toBe(
    'applied',
  );
  expect(report.timelineHistory.additions).toBe(0);
  const query = await mem.timeline({ timeline: 'work/timeline', source: 'plan' });
  expect(query.total).toBe(1);
  expect(query.results[0]!.id).toBe(before);
  expect(read('work/timeline.md').match(/akno:timeline-item id=/g)).toHaveLength(1);
  expect(read('work/canonical.md')).toContain('[[work/copy]]');
  expect(read('work/canonical.md')).toContain('[[work/notes]]');
  const proof = mem.plan(report.maintenancePlan!.id).items[0]!.evidence[0]!.timelineHistory!.retention!;
  expect(proof.prepared.receipt.result.candidates[0]!.outcome).toBe('support_added');
  expect(proof.prepared.receipt.result.candidates[0]!.memory_id).toBe(before);
});

it('does not finalize revised receipts or source progress when the atomic write fails', async () => {
  await sourceSetup();
  reviseOnce = true;
  vi.spyOn(fsp, 'rename').mockRejectedValueOnce(new Error('Invented atomic write failure'));
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status).not.toBe('applied');
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
  const db = new Database(mem.config.dbPath);
  expect((db.prepare('SELECT count(*) AS n FROM retain_receipts').get() as { n: number }).n).toBe(0);
  const state = JSON.parse(
    (db.prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as { value: string })
      .value,
  );
  expect(state.accepted).toEqual([]);
  expect(state.status).not.toBe('complete');
  db.close();
});

it('recovers an interrupted revised source plan without new model calls and finalizes its receipt once', async () => {
  await sourceSetup();
  vi.spyOn(fsp, 'rename').mockRejectedValueOnce(new Error('Invented interrupted write'));
  reviseOnce = true;
  const report = await mem.dream({ phase: 'curate' });
  const item = mem.plan(report.maintenancePlan!.id).items[0]!;
  expect(item.status).not.toBe('applied');
  expect(calls.curator).toBe(2);
  expect(item.revision).toBe(2);
  const db = new Database(mem.config.dbPath);
  db.prepare("UPDATE maintenance_items SET status = 'applying', status_code = NULL WHERE id = ?").run(
    item.id,
  );
  db.prepare("UPDATE maintenance_plans SET status = 'applying' WHERE id = ?").run(report.maintenancePlan!.id);
  db.close();
  const first = item.operations[0]!;
  if (!('after' in first)) throw new Error('Unexpected revised source operation');
  put(first.relPath, first.after);
  const count = { ...calls };
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  const recovered = await mem.dream({ phase: 'curate' });
  expect(recovered.maintenancePlan!.items[0]!.status).toBe('applied');
  expect(calls).toEqual(count);
  expect(read('work/timeline.md')).toContain('will take place');
  const receipts = new Database(mem.config.dbPath);
  expect((receipts.prepare('SELECT count(*) AS n FROM retain_receipts').get() as { n: number }).n).toBe(1);
  receipts.close();
  await mem.undo({ change_id: recovered.maintenancePlan!.items[0]!.changeId! });
  expect(read('work/timeline.md')).toBe(' \t\r\n');
  expect(fs.existsSync(path.join(root, 'work/timeline-memories.md'))).toBe(false);
});

it('revises only admitted candidates while preserving placement-held assertions for continuation', async () => {
  await sourceSetup();
  const other = 'Vulpine Mutual states that a second Zephyr QX-100 inspection is scheduled for 8 April 2031.';
  put('work/notes.md', '# Notices\n\n' + notice + '\n\n' + other + '\n');
  extraction = () => [
    sourceCandidate(),
    {
      ...sourceCandidate(other),
      text: 'Vulpine Mutual states a second Zephyr QX-100 inspection is scheduled for 2031-04-08.',
    },
  ];
  equivalence = 'uncertain';
  reviseOnce = true;
  sourceRevision = (value) => {
    expect(value.candidates).toHaveLength(1);
    return {
      replacements: [
        {
          candidate_id: value.candidates[0]!.candidate_id,
          text: 'Vulpine Mutual states the Zephyr QX-100 inspection will take place on 2031-04-08.',
        },
      ],
      unsupported_reason: null,
    };
  };
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status, report.maintenancePlan!.items[0]!.statusReason ?? '').toBe(
    'applied',
  );
  const db = new Database(mem.config.dbPath);
  const state = JSON.parse(
    (db.prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as { value: string })
      .value,
  );
  expect(state.accepted).toHaveLength(1);
  expect(state.candidates).toHaveLength(1);
  expect(state.candidates[0].text).toContain('second');
  expect(state.status).toBe('extracted');
  db.close();
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
});

const validityNotice =
  'Vulpine Mutual states the Zephyr QX-100 service agreement applies from 2031-04-01 through 2033-03-31.';
const occurrencePurpose = 'Household occurrences only. Past events use a single date.';
const validityPurpose = 'Reported service terms and correspondence. Preserve attributed validity periods.';

async function validitySetup() {
  await sourceSetup();
  put('timeline.md', `# Timeline\n\n${occurrencePurpose}\n`);
  put('work/timeline.md', `# Timeline\n\n${validityPurpose}\n`);
  put('work/notes.md', `# Service terms\n\n${validityNotice}\n`);
  extraction = () => [
    {
      ...sourceCandidate(validityNotice),
      kind: 'claim',
      text: validityNotice,
      time: {
        ...candidate().time,
        relation: 'valid',
        start: '2031-04-01',
        until: '2033-03-31',
      },
    },
  ];
  await mem.index({ structuralOnly: true });
}

it('scopes source curator authority to its ledger and retains an attributed validity range without an occurrence', async () => {
  await validitySetup();
  const before = read('work/notes.md');
  curatorDecision = (input, system) => {
    const proof = JSON.parse(input).item.evidence[0].timelineHistory;
    return !input.includes(occurrencePurpose) &&
      proof.source_retention_contract?.representation === 'qualified_retained_temporal_items' &&
      system.includes('not an occurred')
      ? 'approve'
      : 'reject';
  };
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status).toBe('applied');
  const decision = JSON.parse(curatorInputs[0]!).item.evidence[0].timelineHistory;
  expect(decision.catalog.map((t: { slug: string }) => t.slug)).toEqual(['work/timeline']);
  expect(decision.catalog[0].description).toBe(validityPurpose);
  expect(decision.other_boundaries).toEqual([
    expect.objectContaining({ slug: 'timeline', folder: '', default: true, writable: true }),
  ]);
  expect(decision.other_boundaries[0]).not.toHaveProperty('description');
  expect(decision.other_boundaries[0]).not.toHaveProperty('title');
  const sealed = mem.plan(report.maintenancePlan!.id).items[0]!.evidence[0]!.timelineHistory!;
  expect(sealed.catalog.find((t) => t.slug === 'timeline')!.description).toBe(occurrencePurpose);
  expect(decision.source_retention_contract.selected_candidate_ids).toEqual(
    sealed.retention!.prepared.receipt.result.candidates.map((c) => c.candidate_id),
  );
  expect(read('work/timeline.md')).toContain(
    '**2031-04-01 – 2033-03-31** | *Valid · claim · reported by Vulpine Mutual*',
  );
  const query = await mem.timeline({ timeline: 'work/timeline', source: 'state' });
  expect(query.results).toEqual([
    expect.objectContaining({
      origin: 'retained',
      kind: 'claim',
      source_kind: 'state',
      relation: 'valid',
      start: '2031-04-01',
      until: '2033-03-31',
      temporal_status: 'actual',
    }),
  ]);
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'event' })).total).toBe(0);
  expect(read('work/notes.md')).toBe(before);
  expect(read('timeline.md')).toBe(`# Timeline\n\n${occurrencePurpose}\n`);
  const count = { ...calls };
  await mem.close();
  mem = await start({
    folders: {
      '**': { role: 'knowledge', remember: 'integrate' },
      'work/**': { role: 'source', remember: 'deny' },
    },
  });
  await mem.index({ rebuild: true, structuralOnly: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
  await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
  expect(read('work/timeline.md')).toBe(`# Timeline\n\n${validityPurpose}\n`);
  expect(read('work/notes.md')).toBe(before);
});

it('preserves the selected ledger purpose and lets the curator refuse an out-of-scope validity assertion', async () => {
  await validitySetup();
  put('work/timeline.md', `# Timeline\n\n${occurrencePurpose}\n`);
  await mem.index({ structuralOnly: true });
  curatorDecision = (input) =>
    JSON.parse(input).item.evidence[0].timelineHistory.catalog[0].description === occurrencePurpose
      ? 'reject'
      : 'approve';
  const before = read('work/timeline.md');
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan!.items[0]!.status).toBe('rejected');
  expect(read('work/timeline.md')).toBe(before);
  const count = { ...calls };
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
});

it('keeps authored history decisions on their original event-transfer contract', async () => {
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status).toBe('applied');
  const proof = JSON.parse(curatorInputs[0]!).item.evidence[0].timelineHistory;
  expect(proof.catalog).toHaveLength(2);
  expect(proof).not.toHaveProperty('source_retention_contract');
  expect(proof).not.toHaveProperty('other_boundaries');
});

it.each(['cached', 'legacy'])(
  'reconsiders %s negative source decisions once after a curator contract change',
  async (kind) => {
    await validitySetup();
    curator = 'reject';
    const first = await mem.dream({ phase: 'curate' });
    expect(first.maintenancePlan!.items[0]!.status).toBe('rejected');
    const db = new Database(mem.config.dbPath);
    const row = db.prepare("SELECT key,value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
      key: string;
      value: string;
    };
    const state = JSON.parse(row.value);
    expect(state.candidates).toHaveLength(1);
    state.curatorContract = 'prior-invented-contract';
    if (kind === 'legacy') {
      delete state.candidates;
      delete state.curatorContract;
      delete state.ownerRejected;
      delete state.itemId;
    }
    db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(JSON.stringify(state), row.key);
    db.close();
    const count = { ...calls };
    curator = 'approve';
    const next = await mem.dream({ phase: 'curate' });
    expect(next.maintenancePlan!.items[0]!.status).toBe('applied');
    expect(calls.extraction).toBe(count.extraction + (kind === 'legacy' ? 1 : 0));
    expect(calls.curator).toBe(count.curator + 1);
    expect((await mem.timeline({ timeline: 'work/timeline', source: 'state' })).total).toBe(1);
    const after = { ...calls };
    expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
    expect(calls).toEqual(after);
  },
);

it('gives a changed negative decision one bounded pass before the unprocessed source backlog', async () => {
  await validitySetup();
  curator = 'reject';
  await mem.dream({ phase: 'curate' });
  const db = new Database(mem.config.dbPath);
  const row = db.prepare("SELECT key,value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
    key: string;
    value: string;
  };
  const state = JSON.parse(row.value);
  state.curatorContract = 'prior-invented-contract';
  db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(JSON.stringify(state), row.key);
  db.close();
  put('work/aaa-unprocessed.md', '# Background\n\nNo temporal assertion.\n');
  await mem.index({ structuralOnly: true });
  mem.config.maintenance.curate.maxPages = 1;
  const count = { ...calls };
  curator = 'approve';
  const retry = await mem.dream({ phase: 'curate' });
  expect(retry.maintenancePlan!.items[0]!.status).toBe('applied');
  expect(calls.extraction).toBe(count.extraction);
  expect(calls.curator).toBe(count.curator + 1);
  extraction = () => [];
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls.extraction).toBe(count.extraction + 1);
});

it('a new source decision contract cannot revive an owner-undone successful transfer', async () => {
  await validitySetup();
  const report = await mem.dream({ phase: 'curate' });
  await mem.undo({ change_id: report.maintenancePlan!.items[0]!.changeId! });
  const db = new Database(mem.config.dbPath);
  const row = db.prepare("SELECT key,value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
    key: string;
    value: string;
  };
  const state = JSON.parse(row.value);
  state.curatorContract = 'prior-invented-contract';
  state.rejected = ['invented-rejected-id'];
  db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(JSON.stringify(state), row.key);
  db.close();
  const count = { ...calls };
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
  expect(read('work/timeline.md')).toBe(`# Timeline\n\n${validityPurpose}\n`);
});

it.each(['tracked', 'legacy'])(
  'preserves %s human source rejections when the curator contract changes',
  async (kind) => {
    await validitySetup();
    const report = await mem.dream({ phase: 'curate', mode: 'review' });
    const plan = mem.plan(report.maintenancePlan!.id);
    mem.decidePlan(plan.id, plan.items[0]!.id, 'reject', 'This assertion does not belong in my timeline.');
    const db = new Database(mem.config.dbPath);
    const row = db.prepare("SELECT key,value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
      key: string;
      value: string;
    };
    const state = JSON.parse(row.value);
    expect(state.ownerRejected).toHaveLength(1);
    state.curatorContract = 'prior-invented-contract';
    if (kind === 'legacy') {
      delete state.ownerRejected;
      delete state.curatorContract;
      delete state.itemId;
    }
    db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(JSON.stringify(state), row.key);
    db.close();
    const count = { ...calls };
    expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
    expect(calls).toEqual(count);
    expect(read('work/timeline.md')).toBe(`# Timeline\n\n${validityPurpose}\n`);
  },
);

it('source rejection consumes only admitted candidates and preserves placement-held assertions', async () => {
  await sourceSetup();
  const other = 'Vulpine Mutual states that a second Zephyr QX-100 inspection is scheduled for 8 April 2031.';
  put('work/notes.md', `# Notices\n\n${notice}\n\n${other}\n`);
  extraction = () => [
    sourceCandidate(),
    {
      ...sourceCandidate(other),
      text: 'Vulpine Mutual states a second Zephyr QX-100 inspection is scheduled for 2031-04-08.',
    },
  ];
  equivalence = 'uncertain';
  curator = 'reject';
  await mem.index({ structuralOnly: true });
  const report = await mem.dream({ phase: 'curate' });
  expect(report.maintenancePlan!.items[0]!.status).toBe('rejected');
  const db = new Database(mem.config.dbPath);
  const state = JSON.parse(
    (db.prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as { value: string })
      .value,
  );
  db.close();
  expect(state.rejected).toHaveLength(1);
  expect(state.accepted).toEqual([]);
  expect(state.candidates).toHaveLength(2);
  expect(state.status).toBe('extracted');
  const count = { ...calls };
  curator = 'approve';
  const next = await mem.dream({ phase: 'curate' });
  expect(next.maintenancePlan!.items[0]!.status).toBe('applied');
  expect(calls.extraction).toBe(count.extraction);
  expect(read('work/timeline.md')).toContain('second');
  expect((await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).total).toBe(1);
});

it('reconsidering a legacy partial source preserves its already admitted memory identities', async () => {
  await sourceSetup({
    maintenance: {
      profile: 'autonomous',
      policies: Object.fromEntries(
        MAINTENANCE_TRANSFORMS.map((k) => [k, k === 'timeline_history' ? 'auto' : 'off']),
      ),
      curate: { max_timeline_events: 1 },
    },
  });
  const other = 'Vulpine Mutual states that the Zephyr QX-100 repair is scheduled for 9 April 2031.';
  put('work/notes.md', `# Notices\n\n${notice}\n\n${other}\n`);
  extraction = () => [
    sourceCandidate(),
    {
      ...sourceCandidate(other, '2031-04-09'),
      text: 'Vulpine Mutual states the Zephyr QX-100 repair is scheduled for 2031-04-09.',
    },
  ];
  await mem.index({ structuralOnly: true });
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan!.items[0]!.status).toBe('applied');
  const original = (await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).results[0]!.id;
  curator = 'reject';
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan!.items[0]!.status).toBe('rejected');
  const db = new Database(mem.config.dbPath);
  const row = db.prepare("SELECT key,value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
    key: string;
    value: string;
  };
  const state = JSON.parse(row.value);
  expect(state.accepted).toHaveLength(1);
  delete state.candidates;
  delete state.curatorContract;
  delete state.ownerRejected;
  db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(JSON.stringify(state), row.key);
  db.close();
  curator = 'approve';
  const count = { ...calls };
  const retry = await mem.dream({ phase: 'curate' });
  expect(retry.maintenancePlan).not.toBeNull();
  expect(retry.maintenancePlan!.items[0]!.status).toBe('applied');
  expect(calls.extraction).toBe(count.extraction + 1);
  const ids = (await mem.timeline({ timeline: 'work/timeline', source: 'plan' })).results.map((r) => r.id);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
  expect(ids).toContain(original);
  const after = { ...calls };
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(after);
});

it('does not reopen a legacy source rejection when its original decision actor is unavailable', async () => {
  await validitySetup();
  curator = 'reject';
  await mem.dream({ phase: 'curate' });
  const db = new Database(mem.config.dbPath);
  const row = db.prepare("SELECT key,value FROM meta WHERE key LIKE 'timeline-source:v1:%'").get() as {
    key: string;
    value: string;
  };
  const state = JSON.parse(row.value);
  delete state.itemId;
  delete state.curatorContract;
  delete state.ownerRejected;
  db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(JSON.stringify(state), row.key);
  db.prepare("UPDATE maintenance_items SET decision_actor = NULL WHERE decision_outcome = 'reject'").run();
  db.close();
  const count = { ...calls };
  curator = 'approve';
  expect((await mem.dream({ phase: 'curate' })).maintenancePlan).toBeNull();
  expect(calls).toEqual(count);
});

it('refuses a sealed source plan when the selected ledger purpose changes before apply', async () => {
  await validitySetup();
  const report = await mem.dream({ phase: 'curate', mode: 'review' });
  const plan = mem.plan(report.maintenancePlan!.id);
  put('work/timeline.md', `# Timeline\n\n${occurrencePurpose}\n`);
  await mem.index({ structuralOnly: true });
  mem.decidePlan(plan.id, plan.items[0]!.id, 'approve', 'Reviewed earlier service terms.');
  expect((await mem.applyPlan(plan.id)).plan.items[0]!.status).toBe('stale');
  expect(read('work/timeline.md')).toBe(`# Timeline\n\n${occurrencePurpose}\n`);
  expect(read('work/notes.md')).toBe(`# Service terms\n\n${validityNotice}\n`);
});
