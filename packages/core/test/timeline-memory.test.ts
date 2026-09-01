import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TimelineOutput } from '@tenphi/akno-protocol';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';
import {
  managedMemoryBlock,
  renderManagedMemoryPayload,
  type ManagedMemoryMarker,
} from '../src/write/managed-memory.ts';

let root: string;
let stateDir: string;
let mem: Akno;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-timeline-memory-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-timeline-memory-state-'));
  fs.writeFileSync(
    path.join(root, 'memory.md'),
    `# Temporal memory\n\n${[
      block(
        marker('mem_event', {
          kind: 'event',
          disposition: 'active',
          time: { precision: 'day', relation: 'occurred', status: 'actual', start: '2031-04-01' },
        }),
        'Ada Marlow inspected the Zephyr QX-100.',
      ),
      block(
        marker('mem_state', {
          time: {
            precision: 'month',
            relation: 'valid',
            status: 'actual',
            start: '2031-04',
            until: '2031-05',
          },
        }),
        'Ada Marlow uses the Zephyr QX-100 during the evaluation period.',
      ),
      block(
        marker('mem_due', {
          kind: 'plan',
          disposition: 'accepted',
          time: {
            precision: 'day',
            relation: 'due',
            status: 'planned',
            start: '2031-04-10',
            recurrence: { frequency: 'weekly', until: '2031-04-24' },
          },
        }),
        'Ada Marlow plans to check the Zephyr QX-100 warranty.',
      ),
      block(
        marker('mem_cancelled', {
          kind: 'plan',
          disposition: 'cancelled',
          time: { precision: 'day', relation: 'scheduled', status: 'planned', start: '2031-04-20' },
        }),
        'Ada Marlow cancelled the Blackwater Bay inspection.',
      ),
    ].join('\n\n')}\n`,
    'utf8',
  );
  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      create_reserved_paths: false,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
    },
  });
  await mem.index({ structuralOnly: true });
});

afterEach(async () => {
  await mem?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('retained temporal memory timeline', () => {
  it('rejects impossible calendar range prefixes', async () => {
    await expect(mem.timeline({ since: '2031-02-29' })).rejects.toThrow('invalid input for timeline');
  });

  it('unifies events, states, plans, and deadlines under an explicit clock', async () => {
    const result = await mem.timeline({
      as_of: '2031-04-12T10:00:00+02:00',
      timezone: 'Europe/Amsterdam',
      order: 'oldest',
    });
    expect(result.status).toBe('ok');
    expect(result.clock).toEqual({
      as_of: '2031-04-12T08:00:00.000Z',
      timezone: 'Europe/Amsterdam',
      local_date: '2031-04-12',
    });
    expect(result.results.map((entry) => entry.source_kind)).toEqual(['event', 'state', 'deadline', 'plan']);
    expect(result.results.find((entry) => entry.id === 'mem_state')).toMatchObject({
      type: 'memory',
      precision: 'month',
      clock_relation: 'current_period',
    });
    expect(result.results.find((entry) => entry.id === 'mem_due')).toMatchObject({
      clock_relation: 'overdue',
      actionable: true,
    });
    expect(() => TimelineOutput.parse(result)).not.toThrow();
  });

  it('keeps inactive history visible but excludes it from the actionable view', async () => {
    const history = await mem.timeline({
      as_of: '2031-04-12T10:00:00+02:00',
      scope: 'future',
      view: 'history',
    });
    expect(history.results.some((entry) => entry.id === 'mem_cancelled')).toBe(true);
    const actionable = await mem.timeline({
      as_of: '2031-04-12T10:00:00+02:00',
      scope: 'future',
      view: 'actionable',
    });
    expect(actionable.results.some((entry) => entry.id === 'mem_cancelled')).toBe(false);
    expect(actionable.results.some((entry) => entry.memory_id === 'mem_due')).toBe(true);
  });

  it('admits visibly qualified inactive work only when auto-recall asks for its history', async () => {
    const result = await mem.context({
      profile: 'auto_recall',
      query: 'Which Blackwater Bay inspection was cancelled?',
      budget: 1200,
    });
    expect(JSON.stringify(result.results)).toContain('cancelled the Blackwater Bay inspection');
  });

  it('expands recurrence only inside the requested range and preserves the series identity', async () => {
    const result = await mem.timeline({
      source: 'deadline',
      since: '2031-04-01',
      until: '2031-04-30',
      order: 'oldest',
    });
    expect(result.results.map((entry) => entry.start)).toEqual(['2031-04-10', '2031-04-17', '2031-04-24']);
    expect(result.results.every((entry) => entry.type === 'memory' && entry.memory_id === 'mem_due')).toBe(
      true,
    );
  });

  it('rebuilds the same retained temporal projection from Markdown', async () => {
    const before = await mem.timeline({ as_of: '2031-04-12T10:00:00+02:00', order: 'oldest' });
    await mem.index({ rebuild: true, structuralOnly: true });
    const after = await mem.timeline({ as_of: '2031-04-12T10:00:00+02:00', order: 'oldest' });
    expect(after.results).toEqual(before.results);
  });

  it('removes an unsafe unscoped fact left by older temporal derivation rules', async () => {
    const database = new Database(path.join(stateDir, 'akno.db'));
    const page = database.prepare("SELECT id FROM pages WHERE slug = 'memory'").get() as { id: string };
    database
      .prepare(
        `INSERT INTO facts(
           id, page_id, claim, subject, attribute, value, line_start, line_end,
           source_line_hash, confidence, first_seen, last_seen, item_id
         ) VALUES('fac_unsafe_temporal', ?, ?, 'Ada Marlow', 'Uses', 'Zephyr QX-100',
                  7, 7, 'dddddddddddd', 0.9, ?, ?, 'mem_state')`,
      )
      .run(
        page.id,
        'Ada Marlow uses the Zephyr QX-100 during the evaluation period.',
        '2031-04-01T00:00:00.000Z',
        '2031-04-01T00:00:00.000Z',
      );
    database.close();

    fs.appendFileSync(path.join(root, 'memory.md'), '\n');
    await mem.index({ structuralOnly: true, verify: true });

    const checked = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
    expect(checked.prepare("SELECT 1 FROM facts WHERE id = 'fac_unsafe_temporal'").get()).toBeUndefined();
    checked.close();
  });

  it('reports malformed temporal markers as degraded instead of empty', async () => {
    fs.appendFileSync(
      path.join(root, 'memory.md'),
      '\n<!-- akno:item mem_broken v=2 relation=valid temporal=actual precision=day start=2031-04-12 -->\n- Invented malformed memory.\n',
    );
    await mem.index({ structuralOnly: true });
    const result = await mem.timeline({ source: 'state', match: 'does not exist' });
    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('partial_temporal_index');
  });

  it('holds duplicate temporal memory identities instead of returning ambiguous entries', async () => {
    const duplicate = marker('mem_due', {
      kind: 'plan',
      disposition: 'accepted',
      time: { precision: 'day', relation: 'due', status: 'planned', start: '2031-04-30' },
    });
    fs.writeFileSync(
      path.join(root, 'duplicate.md'),
      `# Duplicate\n\n${block(duplicate, 'Ada Marlow plans a duplicate warranty check.')}\n`,
      'utf8',
    );
    await mem.index({ structuralOnly: true });

    const result = await mem.timeline({ source: 'deadline', match: 'warranty' });
    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('partial_temporal_index');
    expect(result.results.some((entry) => entry.type === 'memory' && entry.memory_id === 'mem_due')).toBe(
      false,
    );
  });

  it('shares the recurrence expansion bound across series', async () => {
    const series = ['mem_series_a', 'mem_series_b'].map((id) =>
      block(
        marker(id, {
          kind: 'plan',
          disposition: 'accepted',
          time: {
            precision: 'day',
            relation: 'scheduled',
            status: 'planned',
            start: '2031-04-01',
            recurrence: { frequency: 'daily' },
          },
        }),
        `Ada Marlow plans invented series ${id === 'mem_series_a' ? 'alpha' : 'beta'}.`,
      ),
    );
    fs.writeFileSync(path.join(root, 'series.md'), `# Series\n\n${series.join('\n\n')}\n`, 'utf8');
    await mem.index({ structuralOnly: true });

    const result = await mem.timeline({
      source: 'plan',
      since: '2031-05-01',
      until: '2031-05-31',
      limit: 2,
    });
    expect(result.status).toBe('degraded');
    expect(result.truncated).toBe(true);
    expect(result.results).toHaveLength(2);
  });
});

function marker(
  id: string,
  overrides: Partial<ManagedMemoryMarker> & Pick<ManagedMemoryMarker, 'time'>,
): ManagedMemoryMarker {
  return {
    id,
    supports: [
      {
        receipt: 'aaaaaaaaaaaa',
        candidate: 'bbbbbbbbbbbb',
        proofGroup: 'cccccccccccc',
        selection: 'provided',
      },
    ],
    kind: 'claim',
    subject: 'unresolved',
    sourceRole: 'user',
    reporters: [],
    commitment: 'asserted',
    disposition: 'active',
    polarity: 'affirmed',
    basis: 'self_attested',
    evidence: [],
    links: [],
    ...overrides,
  };
}

function block(markerValue: ManagedMemoryMarker, text: string): string {
  return managedMemoryBlock(markerValue, renderManagedMemoryPayload(text, markerValue));
}
