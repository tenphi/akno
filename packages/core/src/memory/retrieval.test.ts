import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../open.ts';
import {
  managedMemoryBlock,
  renderManagedMemoryPayload,
  type ManagedMemoryMarker,
} from '../write/managed-memory.ts';

let root: string;
let stateDir: string;
let memory: Akno;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-memory-view-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-memory-view-state-'));
  const entries: [ManagedMemoryMarker, string][] = [
    [marker('mem_fact'), 'The Zephyr QX-100 warranty lasts five years.'],
    [
      marker('mem_report', {
        sourceRole: 'external',
        speaker: 'Bo Winters',
        basis: 'source_report',
      }),
      'Bo Winters reported that the lantern warranty lasts eight years.',
    ],
    [
      marker('mem_plan', { kind: 'plan', disposition: 'proposed' }),
      'Ada Marlow proposed a copperfin observatory inspection.',
    ],
    [
      marker('mem_history', { kind: 'decision', disposition: 'rejected' }),
      'Ada Marlow rejected the ember contract option.',
    ],
    [
      marker('mem_question', { kind: 'question', commitment: 'none' }),
      'Whether the violet calibration needs a second pass remains open.',
    ],
    [
      marker('mem_discussion', { commitment: 'hypothetical' }),
      'An amber coastal route was discussed as a hypothetical scenario.',
    ],
  ];
  write(
    'memory/invented.md',
    [
      '# Invented retained memory',
      '',
      ...entries.flatMap(([entry, text]) => [
        managedMemoryBlock(entry, renderManagedMemoryPayload(text, entry)),
        '',
      ]),
    ].join('\n'),
  );
  memory = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null },
        derive: { id: null },
        expansion: { id: null },
        vision: { id: null, enabled: false },
      },
    },
  });
  await memory.index({ structuralOnly: true });
});

afterEach(async () => {
  await memory?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('intent-aware retained-memory retrieval', () => {
  it.each([
    ['What did Bo Winters report about the lantern warranty?', 'reports', 'lantern warranty'],
    ['What is the planned copperfin observatory inspection?', 'planning', 'copperfin observatory'],
    ['Show the decision history for the ember contract.', 'history', 'ember contract'],
    ['Which open question remains about violet calibration?', 'questions', 'violet calibration'],
    ['Show the hypothetical amber coastal route scenario.', 'discussion', 'amber coastal route'],
  ] as const)('selects the %s query view before candidate budgeting', async (query, view, text) => {
    const result = await memory.recall({ query, expand: false, graph: false, rerank: false });

    expect(result.memory_view).toBe(view);
    expect(JSON.stringify(result.results)).toContain(text);
    expect(pageMemory(result)?.status).toBe('qualified');
  });

  it('keeps factual lookup canonical without losing a relevant proposal as context', async () => {
    const canonical = await memory.recall({
      query: 'Zephyr QX-100 warranty five years',
      expand: false,
      graph: false,
      rerank: false,
    });
    expect(canonical.memory_view).toBe('factual');
    expect(JSON.stringify(canonical.results)).toContain('five years');
    expect(JSON.stringify(canonical.results)).not.toContain('copperfin observatory');

    const contextual = await memory.recall({
      query: 'copperfin observatory inspection',
      expand: false,
      graph: false,
      rerank: false,
    });
    expect(contextual.status).not.toBe('empty');
    expect(contextual.memory_view).toBe('factual');
    expect(JSON.stringify(contextual.results)).toContain('copperfin observatory');
    expect(contextual.note).toContain('not eligible for the factual view');
    expect(pageMemory(contextual)).toMatchObject({ status: 'qualified', answer_eligible: false });
  });

  it('honors an explicit view over inferred planning language', async () => {
    const result = await memory.recall({
      query: 'planned copperfin observatory inspection',
      memory_view: 'factual',
      expand: false,
      graph: false,
      rerank: false,
    });

    expect(result.memory_view).toBe('factual');
    expect(result.note).toContain('not eligible for the factual view');
  });

  it('keeps malformed managed memory contextual and makes the partial projection explicit', async () => {
    write(
      'memory/malformed.md',
      [
        '# Invented malformed memory',
        '',
        '<!-- akno:item mem_bad v=2 invented-invalid-marker -->',
        '- A chartreuse propeller record has unavailable semantics.',
        '',
      ].join('\n'),
    );
    await memory.index({ verify: true, structuralOnly: true });

    const result = await memory.recall({
      query: 'chartreuse propeller record',
      expand: false,
      graph: false,
      rerank: false,
    });

    expect(result.status).toBe('degraded');
    expect(result.degraded).toContain('partial_memory_index');
    expect(result.note).toContain('not eligible for the factual view');
    expect(pageMemory(result)).toEqual({ status: 'unavailable', id: 'mem_bad', answer_eligible: false });
  });

  it('fails every same-page copy of a duplicate memory id closed', async () => {
    const duplicate = marker('mem_duplicate');
    write(
      'memory/duplicate.md',
      [
        '# Invented duplicate memory',
        '',
        managedMemoryBlock(
          duplicate,
          renderManagedMemoryPayload('The indigo propeller uses setting one.', duplicate),
        ),
        '',
        managedMemoryBlock(
          duplicate,
          renderManagedMemoryPayload('The indigo propeller uses setting two.', duplicate),
        ),
        '',
      ].join('\n'),
    );
    await memory.index({ verify: true, structuralOnly: true });

    const result = await memory.recall({
      query: 'indigo propeller setting',
      expand: false,
      graph: false,
      rerank: false,
    });

    expect(result.degraded).toContain('partial_memory_index');
    const qualifications = result.results.flatMap((entry) =>
      entry.type === 'page' ? entry.lines.flatMap((line) => (line.memory ? [line.memory] : [])) : [],
    );
    expect(qualifications).not.toHaveLength(0);
    expect(qualifications.every((entry) => entry.status === 'unavailable')).toBe(true);
  });

  it('uses the selected view for automatic context injection', async () => {
    const planning = await memory.context({
      profile: 'auto_recall',
      query: 'Ada Marlow proposed a copperfin observatory inspection.',
      memory_view: 'planning',
      budget: 1200,
    });
    expect(planning.memory_view).toBe('planning');
    expect(JSON.stringify(planning.results)).toContain('copperfin observatory');

    const factual = await memory.context({
      profile: 'auto_recall',
      query: 'copperfin observatory inspection',
      budget: 1200,
    });
    expect(factual.memory_view).toBe('factual');
    expect(JSON.stringify(factual.results)).not.toContain('copperfin observatory');
  });
});

function pageMemory(result: Awaited<ReturnType<Akno['recall']>>) {
  const page = result.results.find((entry) => entry.type === 'page');
  return page?.type === 'page' ? page.lines.find((line) => line.memory)?.memory : undefined;
}

function marker(id: string, overrides: Partial<ManagedMemoryMarker> = {}): ManagedMemoryMarker {
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

function write(relPath: string, content: string): void {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}
