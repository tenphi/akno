import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let root: string;
let stateDir: string;

async function openMem(): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
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
      folders: { 'memory/**': { role: 'knowledge', remember: 'integrate' } },
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-retain-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-retain-state-'));
  fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'memory/equipment.md'),
    '---\ntitle: Equipment\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n---\n\n# Equipment\n\n## Warranty\n',
    'utf8',
  );
  const mem = await openMem();
  await mem.index({ structuralOnly: true });
  await mem.close();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function upsert(sourceId: string, revision: string, text = 'Ada Marlow selected a five-year warranty.') {
  return {
    source_id: sourceId,
    revision,
    source_group: sourceId,
    input: { text },
    retention: {
      mode: 'provided' as const,
      placement: 'exact' as const,
      candidates: [
        {
          candidate_id: 'warranty-selection',
          kind: 'decision' as const,
          text: 'Ada Marlow selected a five-year warranty.',
          subject: 'Zephyr QX-100 warranty',
          attribution: { source_role: 'user' as const, source_speaker: 'Ada Marlow' },
          discourse: { commitment: 'asserted' as const, disposition: 'accepted' as const },
          epistemic: { basis: 'self_attested' as const },
          support: [{ quote: 'Ada Marlow selected a five-year warranty.' }],
          discourse_frame: [{ quote: 'Ada Marlow selected a five-year warranty.' }],
          destination: { slug: 'memory/equipment', section: 'Warranty' },
        },
      ],
    },
  };
}

describe('provided exact retain', () => {
  it('writes v2 memory once and replays without touching bytes or the journal', async () => {
    const mem = await openMem();
    try {
      const first = await mem.retain({ sources: [upsert('chat:1111', '1')] });
      expect(first.sources[0]).toMatchObject({ outcome: 'ok', candidates: [{ outcome: 'written' }] });
      const after = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      expect(after).toContain('akno:item mem_');
      expect(after).toContain('v=2 supports=');
      expect(after).toContain('- Ada Marlow selected a five-year warranty.');
      const changes = mem.changes().length;

      const replay = await mem.retain({ sources: [upsert('chat:1111', '1')] });
      expect(replay.sources[0]?.outcome).toBe('replayed');
      expect(mem.changes()).toHaveLength(changes);
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toBe(after);

      const conflict = await mem.retain({
        sources: [upsert('chat:1111', '1', 'Ada Marlow selected a three-year warranty.')],
      });
      expect(conflict.sources[0]?.outcome).toBe('revision_conflict');
    } finally {
      await mem.close();
    }
  });

  it('adds independent support and retracts only the addressed source', async () => {
    const mem = await openMem();
    try {
      const first = await mem.retain({ sources: [upsert('chat:1111', '1')] });
      const memoryId = first.sources[0]?.candidates[0]?.memory_id;
      const second = await mem.retain({ sources: [upsert('mail:2222', '1')] });
      expect(second.sources[0]?.candidates[0]).toMatchObject({
        outcome: 'support_added',
        memory_id: memoryId,
      });

      const firstRetraction = await mem.retain({
        sources: [
          {
            source_id: 'chat:1111',
            revision: 'retract-1',
            retention: {
              mode: 'retract',
              target_revision: '1',
              reason: 'user_request',
            },
          },
        ],
      });
      expect(firstRetraction.sources[0]?.candidates[0]?.outcome).toBe('retracted');
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toContain(memoryId!);

      await mem.undo({ change_id: firstRetraction.sources[0]!.change_id! });
      const restored = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      expect(restored.match(/@provided/g)).toHaveLength(2);
      const retriedRetraction = await mem.retain({
        sources: [
          {
            source_id: 'chat:1111',
            revision: 'retract-1',
            retention: {
              mode: 'retract',
              target_revision: '1',
              reason: 'user_request',
            },
          },
        ],
      });
      expect(retriedRetraction.sources[0]?.candidates[0]?.outcome).toBe('retracted');

      await mem.retain({
        sources: [
          {
            source_id: 'mail:2222',
            revision: 'retract-1',
            retention: {
              mode: 'retract',
              target_revision: '1',
              reason: 'source_deleted',
            },
          },
        ],
      });
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).not.toContain(memoryId!);
    } finally {
      await mem.close();
    }
  });

  it('dry-runs without creating a receipt', async () => {
    const mem = await openMem();
    try {
      const before = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      const preview = await mem.retain({ sources: [upsert('chat:1111', '1')], dry_run: true });
      expect(preview.sources[0]?.note).toContain('dry run');
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toBe(before);
      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      const count = db.prepare('SELECT COUNT(*) AS n FROM retain_receipts').get() as { n: number };
      db.close();
      expect(count.n).toBe(0);
    } finally {
      await mem.close();
    }
  });

  it('holds an exact placement when its existing section is absent', async () => {
    const mem = await openMem();
    try {
      const source = upsert('chat:1111', '1');
      source.retention.candidates[0]!.destination.section = 'Missing section';
      const result = await mem.retain({ sources: [source] });
      expect(result.sources[0]).toMatchObject({
        outcome: 'held',
        candidates: [{ outcome: 'held', reason: 'exact destination section is absent or ambiguous' }],
      });
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).not.toContain(
        'Missing section',
      );
    } finally {
      await mem.close();
    }
  });

  it('does not resurrect explicitly forgotten memory on source replay', async () => {
    const mem = await openMem();
    try {
      await mem.retain({ sources: [upsert('chat:1111', '1')] });
      const forgotten = await mem.forget({ slug: 'memory/equipment' });

      const replay = await mem.retain({ sources: [upsert('chat:1111', '1')] });
      expect(replay.sources[0]).toMatchObject({
        outcome: 'replayed',
        candidates: [{ outcome: 'retracted' }],
      });
      expect(fs.existsSync(path.join(root, 'memory/equipment.md'))).toBe(false);

      await mem.undo({ change_id: forgotten.change_id! });
      const restoredReplay = await mem.retain({ sources: [upsert('chat:1111', '1')] });
      expect(restoredReplay.sources[0]).toMatchObject({
        outcome: 'replayed',
        candidates: [{ outcome: 'written' }],
      });
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).toContain('v=2 supports=');
    } finally {
      await mem.close();
    }
  });

  it('holds attribution that conflicts with a structured source item', async () => {
    const mem = await openMem();
    try {
      const base = upsert('chat:1111', '1');
      const candidate = base.retention.candidates[0]!;
      const source = {
        ...base,
        input: {
          items: [
            {
              item_id: 'turn-1',
              role: 'assistant' as const,
              speaker: 'Bo Winters',
              text: candidate.text,
            },
          ],
        },
        retention: {
          ...base.retention,
          candidates: [
            {
              ...candidate,
              support: [{ item_id: 'turn-1', quote: candidate.text }],
              discourse_frame: [{ item_id: 'turn-1', quote: candidate.text }],
            },
          ],
        },
      };
      const result = await mem.retain({ sources: [source] });
      expect(result.sources[0]?.candidates[0]).toMatchObject({
        outcome: 'held',
        reason: 'source attribution conflicts with the structured support item role',
      });
    } finally {
      await mem.close();
    }
  });

  it('resolves candidate relations to durable memory ids before writing', async () => {
    const mem = await openMem();
    try {
      const decisionText = 'Ada Marlow selected a five-year warranty.';
      const questionText = 'Which warranty should Ada Marlow select?';
      const base = upsert('chat:1111', '1', `${questionText} ${decisionText}`);
      const decision = {
        ...base.retention.candidates[0]!,
        relations: [
          {
            type: 'answers' as const,
            target: { candidate_id: 'warranty-question' },
            support: [{ quote: decisionText }],
          },
        ],
      };
      const question = {
        candidate_id: 'warranty-question',
        kind: 'question' as const,
        text: questionText,
        subject: 'Zephyr QX-100 warranty',
        attribution: { source_role: 'user' as const, source_speaker: 'Ada Marlow' },
        discourse: { commitment: 'none' as const, disposition: 'resolved' as const },
        epistemic: { basis: 'source_report' as const },
        support: [{ quote: questionText }],
        discourse_frame: [{ quote: questionText }],
        destination: { slug: 'memory/equipment', section: 'Warranty' },
      };
      const source = {
        ...base,
        retention: { ...base.retention, candidates: [decision, question] },
      };
      const result = await mem.retain({ sources: [source] });
      expect(result.sources[0]?.candidates.map((candidate) => candidate.candidate_id)).toEqual([
        'warranty-selection',
        'warranty-question',
      ]);
      const questionId = result.sources[0]?.candidates[1]?.memory_id;
      const body = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      expect(body).toContain(`links=answers:memory%3A${questionId}`);
      expect(body).not.toContain('candidate%3Awarranty-question');
    } finally {
      await mem.close();
    }
  });
});
