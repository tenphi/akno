import fs from 'node:fs';
import http from 'node:http';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import { MAINTENANCE_TRANSFORMS, type ConfigDoc } from '../src/config/schema.ts';
import { frameAuditFields, retentionAudit } from './semantic-audit.ts';

let root: string;
let stateDir: string;
let mem: Akno;
let server: http.Server;
let url: string;
let extraction: (source: string) => unknown[];
let selection: string;
let verified: boolean;
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

it.each(['source', 'boundary', 'purpose', 'destination'])(
  'stales a proposal when its %s changes before apply',
  async (change) => {
    const report = await mem.dream({ phase: 'curate', mode: 'review' });
    const plan = mem.plan(report.maintenancePlan!.id);
    if (change === 'source') put('work/notes.md', '# Corrected\n\nThe inspection was cancelled.\n');
    if (change === 'boundary') put('work/subfolder/timeline.md', '');
    if (change === 'purpose') put('timeline.md', '# Timeline\n\nA different purpose.\n');
    if (change === 'destination') put('work/timeline.md', '# Timeline\n\nEdited while reviewing.\n');
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
    expect(calls.extraction).toBe(0);
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
