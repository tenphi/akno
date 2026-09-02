import fs from 'node:fs';
import http from 'node:http';
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
      folders: {
        'memory/**': { role: 'knowledge', remember: 'integrate' },
        'sources/**': { role: 'source', remember: 'deny', ingest: 'document' },
      },
    },
  });
}

interface AutomaticRetainStub {
  url: string;
  calls: () => { extraction: number; verification: number; placement: number };
  close: () => Promise<void>;
  setCandidate: (candidate: Record<string, unknown>) => void;
  setVerification: (supported: boolean) => void;
}

async function startAutomaticRetainStub(): Promise<AutomaticRetainStub> {
  let candidate: Record<string, unknown> = {};
  let verificationSupported = true;
  const counts = { extraction: 0, verification: 0, placement: 0 };
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        messages?: { role: string; content: string }[];
      };
      const system = body.messages?.find((message) => message.role === 'system')?.content ?? '';
      const user = body.messages?.find((message) => message.role === 'user')?.content ?? '';
      let content: unknown;
      if (system.includes('independently verify proposed retained memories')) {
        counts.verification++;
        const payload = JSON.parse(user) as { candidates?: { candidate_id: string }[] };
        content = {
          verdicts: (payload.candidates ?? []).map((item) => ({
            candidate_id: item.candidate_id,
            supported: verificationSupported,
            reason_code: verificationSupported ? null : 'discourse_uncertain',
          })),
        };
      } else if (system.includes('You place durable knowledge into one Markdown page')) {
        counts.placement++;
        const items = /Items:\n(\[[\s\S]*\])$/.exec(user)?.[1];
        content = {
          placements: (items ? (JSON.parse(items) as { id: string }[]) : []).map((item) => ({
            id: item.id,
            heading: 'Decisions',
          })),
        };
      } else if (system.includes('You extract durable memory from one untrusted source')) {
        counts.extraction++;
        content = { candidates: Object.keys(candidate).length > 0 ? [candidate] : [], events: [] };
      } else {
        content = { candidates: [], events: [] };
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    calls: () => ({ ...counts }),
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    setCandidate: (next) => {
      candidate = next;
    },
    setVerification: (supported) => {
      verificationSupported = supported;
    },
  };
}

async function openAutomaticMem(url: string): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: url } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'retain-stub' },
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
  fs.mkdirSync(path.join(root, 'sources'), { recursive: true });
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
  it('holds relative time unless the source supplies the exact clock and timezone', async () => {
    const mem = await openMem();
    try {
      const text = 'Ada Marlow plans a Zephyr QX-100 inspection tomorrow.';
      const result = await mem.retain({
        sources: [
          {
            source_id: 'chat:relative-1111',
            revision: '1',
            mentioned_at: '2031-04-12T09:00:00Z',
            input: { text },
            retention: {
              mode: 'provided',
              placement: 'exact',
              candidates: [
                {
                  candidate_id: 'inspection-plan',
                  kind: 'plan',
                  text,
                  subject: 'Zephyr QX-100',
                  attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
                  discourse: { commitment: 'asserted', disposition: 'accepted' },
                  epistemic: { basis: 'self_attested' },
                  support: [{ quote: text }],
                  discourse_frame: [{ quote: text }],
                  destination: { slug: 'memory/equipment', section: 'Warranty' },
                  time: {
                    start: '2031-04-13',
                    precision: 'day',
                    relation: 'scheduled',
                    status: 'planned',
                    mentioned_at: '2031-04-12T09:00:00Z',
                    timezone: 'UTC',
                  },
                },
              ],
            },
          },
        ],
      });

      expect(result.sources[0]).toMatchObject({
        outcome: 'held',
        candidates: [{ outcome: 'held', reason_code: 'time_unresolved' }],
      });
    } finally {
      await mem.close();
    }
  });

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

  it('reports a mixed written and held candidate batch as partial', async () => {
    const mem = await openMem();
    try {
      const source = upsert(
        'chat:2222',
        '1',
        'Ada Marlow selected a five-year warranty. Ada Marlow selected a silver service plan.',
      );
      source.retention.candidates.push({
        ...source.retention.candidates[0]!,
        candidate_id: 'service-plan-selection',
        text: 'Ada Marlow selected a silver service plan.',
        subject: 'Zephyr QX-100 service plan',
        support: [{ quote: 'Ada Marlow selected a silver service plan.' }],
        discourse_frame: [{ quote: 'Ada Marlow selected a silver service plan.' }],
        destination: { slug: 'memory/equipment', section: 'Missing section' },
      });

      const result = await mem.retain({ sources: [source] });

      expect(result.outcome).toBe('partial');
      expect(result.sources[0]).toMatchObject({
        outcome: 'ok',
        candidates: [
          { candidate_id: 'warranty-selection', outcome: 'written' },
          {
            candidate_id: 'service-plan-selection',
            outcome: 'held',
            reason_code: 'validation_failed',
          },
        ],
      });
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

  it('retains from an indexed source page but refuses a canonical knowledge page as input', async () => {
    fs.writeFileSync(
      path.join(root, 'sources/zephyr-manual.md'),
      '---\ntitle: Zephyr manual\nakno:\n  role: source\n  management:\n    remember: deny\n---\n\n# Zephyr manual\n\nThe Zephyr QX-100 warranty lasts five years.\n',
      'utf8',
    );
    const mem = await openMem();
    try {
      await mem.index({ structuralOnly: true });
      const source = upsert('manual:1111', '1', 'The Zephyr QX-100 warranty lasts five years.');
      source.input = { page_slug: 'sources/zephyr-manual' } as never;
      source.retention.candidates[0] = {
        ...source.retention.candidates[0]!,
        text: 'The Zephyr QX-100 warranty lasts five years.',
        attribution: { source_role: 'external', source_speaker: 'Vulpine Mutual' },
        epistemic: { basis: 'source_report' },
        support: [{ quote: 'The Zephyr QX-100 warranty lasts five years.' }],
        discourse_frame: [{ quote: 'The Zephyr QX-100 warranty lasts five years.' }],
      };

      const retained = await mem.retain({ sources: [source] });
      expect(retained.sources[0]).toMatchObject({
        outcome: 'ok',
        source: {
          kind: 'page',
          availability: 'available',
          reextractable: true,
          reference: 'sources/zephyr-manual',
        },
      });

      const refused = await mem.retain({
        sources: [
          {
            ...source,
            source_id: 'page:2222',
            input: { page_slug: 'memory/equipment' },
          },
        ],
      });
      expect(refused.status).toBe('unavailable');
      expect(refused.sources[0]).toMatchObject({
        outcome: 'held',
        reason_code: 'validation_failed',
        source: { kind: 'page', availability: 'unavailable' },
      });
    } finally {
      await mem.close();
    }
  });

  it('preserves an inline source and its retained memory in one undoable change', async () => {
    const mem = await openMem();
    try {
      const source = {
        ...upsert('mail:archive-1111', '1'),
        preserve_source: { mode: 'source_page' as const, slug: 'sources/warranty-message' },
      };
      const retained = await mem.retain({ sources: [source] });

      expect(retained.sources[0]).toMatchObject({
        outcome: 'ok',
        source: { kind: 'text', reextractable: true, preserved_slug: 'sources/warranty-message' },
      });
      const archive = fs.readFileSync(path.join(root, 'sources/warranty-message.md'), 'utf8');
      expect(archive).toContain('role: source');
      expect(archive).toContain('remember: deny');
      expect(archive).toContain('Ada Marlow selected a five-year warranty.');
      expect(
        mem
          .changes()[0]
          ?.files.map((file) => file.relPath)
          .sort(),
      ).toEqual(['memory/equipment.md', 'sources/warranty-message.md']);
      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      expect(
        db
          .prepare(
            `SELECT input_kind, input_ref, preserved_slug, availability, reextractable
               FROM retain_source_bindings`,
          )
          .get(),
      ).toEqual({
        input_kind: 'text',
        input_ref: null,
        preserved_slug: 'sources/warranty-message',
        availability: 'available',
        reextractable: 1,
      });
      db.close();

      await mem.undo({ change_id: retained.sources[0]!.change_id! });
      expect(fs.existsSync(path.join(root, 'sources/warranty-message.md'))).toBe(false);
      expect(fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8')).not.toContain('akno:item');
    } finally {
      await mem.close();
    }
  });

  it('refuses to use one page as both a preserved source and a memory destination', async () => {
    const mem = await openMem();
    try {
      const source = {
        ...upsert('mail:archive-2222', '1'),
        preserve_source: { mode: 'source_page' as const, slug: 'sources/warranty-message' },
      };
      source.retention.candidates[0] = {
        ...source.retention.candidates[0]!,
        destination: { slug: 'sources/warranty-message' },
      };

      const retained = await mem.retain({ sources: [source] });

      expect(retained.sources[0]).toMatchObject({
        outcome: 'held',
        reason_code: 'validation_failed',
      });
      expect(fs.existsSync(path.join(root, 'sources/warranty-message.md'))).toBe(false);
    } finally {
      await mem.close();
    }
  });

  it('atomically replaces exact support in a corrected source revision', async () => {
    const mem = await openMem();
    try {
      const original = upsert('mail:correction-1111', '1');
      const first = await mem.retain({ sources: [original] });
      const correctedText = 'Ada Marlow selected a seven-year warranty.';
      const corrected = upsert('mail:correction-1111', '2', correctedText);
      corrected.retention.candidates[0] = {
        ...corrected.retention.candidates[0]!,
        text: correctedText,
        support: [{ quote: correctedText }],
        discourse_frame: [{ quote: correctedText }],
      };
      const result = await mem.retain({
        sources: [
          {
            ...corrected,
            retracts: { target_revision: '1', candidate_ids: ['warranty-selection'] },
          },
        ],
      });

      expect(result.sources[0]).toMatchObject({
        outcome: 'ok',
        candidates: [{ candidate_id: 'warranty-selection', outcome: 'written' }],
      });
      const body = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      expect(body).toContain(correctedText);
      expect(body).not.toContain('five-year warranty');

      await mem.undo({ change_id: result.sources[0]!.change_id! });
      const restored = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      expect(restored).toContain('five-year warranty');
      expect(restored).not.toContain('seven-year warranty');
      expect((await mem.retain({ sources: [original] })).sources[0]?.outcome).toBe('replayed');
      expect(first.sources[0]?.candidates[0]?.memory_id).toBeDefined();
    } finally {
      await mem.close();
    }
  });

  it('keeps earlier support when any compound-correction replacement is held', async () => {
    const mem = await openMem();
    try {
      const original = upsert('mail:correction-2222', '1');
      await mem.retain({ sources: [original] });
      const correctedText = 'Ada Marlow selected a seven-year warranty.';
      const corrected = upsert('mail:correction-2222', '2', correctedText);
      corrected.retention.candidates[0] = {
        ...corrected.retention.candidates[0]!,
        text: correctedText,
        support: [{ quote: correctedText }],
        discourse_frame: [{ quote: correctedText }],
      };
      corrected.retention.candidates.push({
        ...corrected.retention.candidates[0]!,
        candidate_id: 'missing-support',
        text: 'Bo Winters selected a three-year warranty.',
        support: [{ quote: 'This quote is absent from the source.' }],
        discourse_frame: [{ quote: 'This quote is absent from the source.' }],
      });

      const result = await mem.retain({
        sources: [
          {
            ...corrected,
            retracts: { target_revision: '1', candidate_ids: ['warranty-selection'] },
          },
        ],
      });

      expect(result.sources[0]).toMatchObject({
        outcome: 'held',
        reason_code: 'validation_failed',
      });
      const body = fs.readFileSync(path.join(root, 'memory/equipment.md'), 'utf8');
      expect(body).toContain('five-year warranty');
      expect(body).not.toContain('seven-year warranty');
      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      expect(
        db
          .prepare('SELECT COUNT(*) AS count FROM retain_receipts WHERE source_id = ?')
          .get('mail:correction-2222'),
      ).toEqual({ count: 1 });
      db.close();
    } finally {
      await mem.close();
    }
  });

  it('reports missing document references as unavailable rather than empty', async () => {
    const mem = await openMem();
    try {
      const source = upsert('document:missing-1111', '1');
      source.input = { document_id: 'doc_missing_1111' } as never;
      const result = await mem.retain({ sources: [source] });
      expect(result.status).toBe('unavailable');
      expect(result.sources[0]).toMatchObject({
        status: 'unavailable',
        outcome: 'held',
        reason_code: 'source_unavailable',
        source: { kind: 'document', availability: 'unavailable' },
      });
    } finally {
      await mem.close();
    }
  });

  it('retains from indexed document text and reports a missing original as degraded', async () => {
    const sourceText = 'The Zephyr QX-100 warranty lasts five years.';
    const documentPath = path.join(root, 'sources/zephyr-manual.txt');
    fs.writeFileSync(documentPath, sourceText, 'utf8');
    const mem = await openMem();
    try {
      await mem.index({ structuralOnly: true });
      const db = new Database(path.join(stateDir, 'akno.db'), { readonly: true });
      const document = db
        .prepare("SELECT id, rel_path FROM documents WHERE rel_path = 'sources/zephyr-manual.txt'")
        .get() as { id: string; rel_path: string };
      db.close();
      expect(document.id).toBeTruthy();
      fs.unlinkSync(documentPath);
      await mem.index({ structuralOnly: true });
      const retainedExtraction = new Database(path.join(stateDir, 'akno.db'));
      retainedExtraction.prepare('UPDATE documents SET text = ? WHERE id = ?').run(sourceText, document.id);
      retainedExtraction.close();

      const source = upsert('document:manual-2222', '1', sourceText);
      source.input = { document_id: document.id } as never;
      source.retention.candidates[0] = {
        ...source.retention.candidates[0]!,
        text: sourceText,
        attribution: { source_role: 'external', source_speaker: 'Vulpine Mutual' },
        epistemic: { basis: 'source_report' },
        support: [{ quote: sourceText }],
        discourse_frame: [{ quote: sourceText }],
      };
      const retained = await mem.retain({ sources: [source] });

      expect(retained.status).toBe('degraded');
      expect(retained.sources[0]).toMatchObject({
        outcome: 'ok',
        status: 'degraded',
        degraded: expect.arrayContaining(['document_source_missing']),
        source: {
          kind: 'document',
          availability: 'degraded',
          reextractable: true,
          reference: document.id,
        },
      });
    } finally {
      await mem.close();
    }
  });

  it('prunes inactive private evidence after its grace without touching live support', async () => {
    const mem = await openMem();
    try {
      await mem.retain({ sources: [upsert('mail:evidence-1111', '1')] });
      let db = new Database(path.join(stateDir, 'akno.db'));
      db.prepare("UPDATE retain_receipts SET created_at = '2000-01-01T00:00:00.000Z'").run();
      const support = db.prepare('SELECT memory_id FROM retain_supports').get() as { memory_id: string };
      db.close();

      const liveCycle = await mem.dream({ phase: 'housekeeping' });
      expect(liveCycle.retainEvidencePrune?.supports).toBe(0);
      db = new Database(path.join(stateDir, 'akno.db'));
      expect(db.prepare('SELECT length(evidence) AS bytes FROM retain_supports').get()).toMatchObject({
        bytes: expect.any(Number),
      });
      db.close();

      await mem.retain({
        sources: [
          {
            source_id: 'mail:evidence-1111',
            revision: 'retract-1',
            retention: { mode: 'retract', target_revision: '1', reason: 'source_deleted' },
          },
        ],
      });
      db = new Database(path.join(stateDir, 'akno.db'));
      db.prepare("UPDATE retain_receipts SET created_at = '2000-01-01T00:00:00.000Z'").run();
      db.prepare(
        `INSERT INTO maintenance_plans(
           id, created_at, updated_at, mode, phase, status, fingerprint, summary
         ) VALUES ('plan_1111', ?, ?, 'review', 'curate', 'review', 'fp_1111', 'Invented review')`,
      ).run('2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z');
      db.prepare(
        `INSERT INTO maintenance_items(
           id, plan_id, ord, kind, risk, status, subject, rationale, input_hash,
           operations, evidence, updated_at
         ) VALUES ('item_1111', 'plan_1111', 0, 'curate', 'low', 'proposed',
                   'Invented subject', 'Invented rationale', 'hash_1111', ?, '[]', ?)`,
      ).run(
        JSON.stringify([{ op: 'replace_managed', memory_id: support.memory_id }]),
        '2000-01-01T00:00:00.000Z',
      );
      db.close();

      const deferred = await mem.dream({ phase: 'housekeeping' });
      expect(deferred.retainEvidencePrune?.supports).toBe(0);
      db = new Database(path.join(stateDir, 'akno.db'));
      db.prepare("DELETE FROM maintenance_plans WHERE id = 'plan_1111'").run();
      db.close();

      const pruned = await mem.dream({ phase: 'housekeeping' });
      expect(pruned.retainEvidencePrune).toMatchObject({ applied: true, supports: 1 });
      db = new Database(path.join(stateDir, 'akno.db'));
      expect(db.prepare('SELECT evidence, evidence_pruned_at FROM retain_supports').get()).toMatchObject({
        evidence: '',
        evidence_pruned_at: expect.any(String),
      });
      db.close();
    } finally {
      await mem.close();
    }
  });
});

describe('automatic retain', () => {
  it('extracts, independently verifies, places, and replays before another model call', async () => {
    const stub = await startAutomaticRetainStub();
    const sourceText = 'Ada Marlow selected the Zephyr QX-100 warranty for five years.';
    stub.setCandidate({
      text: sourceText,
      subject: 'Zephyr QX-100 warranty',
      page: 'memory/warranty-decisions',
      origin: 'user',
      evidence: sourceText,
      frame: sourceText,
      kind: 'decision',
    });
    const mem = await openAutomaticMem(stub.url);
    try {
      const input = {
        sources: [
          {
            source_id: 'conversation:1111',
            revision: 'turn-1',
            source_kind: 'conversation' as const,
            input: { text: sourceText },
            retention: { mode: 'extract' as const },
          },
        ],
      };
      const first = await mem.retain(input);
      expect(first.sources[0]).toMatchObject({
        outcome: 'ok',
        status: 'ok',
        candidates: [{ outcome: 'written', slug: 'memory/warranty-decisions' }],
        model_usage: {
          extraction: { model: 'retain-stub' },
          verification: { model: 'retain-stub' },
          placement: [{ model: 'retain-stub' }],
        },
      });
      const page = fs.readFileSync(path.join(root, 'memory/warranty-decisions.md'), 'utf8');
      expect(page).toContain('@extracted');
      expect(page).toContain('kind=decision');
      expect(page).toContain('basis=self_attested');
      expect(stub.calls()).toEqual({ extraction: 1, verification: 1, placement: 1 });

      const replay = await mem.retain(input);
      expect(replay.sources[0]?.outcome).toBe('replayed');
      expect(stub.calls()).toEqual({ extraction: 1, verification: 1, placement: 1 });
      expect(fs.readFileSync(path.join(root, 'memory/warranty-decisions.md'), 'utf8')).toBe(page);
    } finally {
      await mem.close();
      await stub.close();
    }
  });

  it('durably holds a verifier disagreement without writing the proposed fact', async () => {
    const stub = await startAutomaticRetainStub();
    const sourceText = 'Ada Marlow considered a ten-year warranty, but no duration was selected.';
    stub.setCandidate({
      text: 'Ada Marlow selected a ten-year warranty.',
      subject: 'Zephyr QX-100 warranty',
      page: 'memory/warranty-decisions',
      origin: 'user',
      evidence: sourceText,
      frame: sourceText,
      kind: 'decision',
    });
    stub.setVerification(false);
    const mem = await openAutomaticMem(stub.url);
    try {
      const input = {
        sources: [
          {
            source_id: 'conversation:2222',
            revision: 'turn-1',
            input: { text: sourceText },
            retention: { mode: 'extract' as const },
          },
        ],
      };
      const result = await mem.retain(input);
      expect(result.sources[0]).toMatchObject({
        outcome: 'held',
        candidates: [{ outcome: 'held', reason_code: 'discourse_uncertain' }],
      });
      expect(fs.existsSync(path.join(root, 'memory/warranty-decisions.md'))).toBe(false);
      const calls = stub.calls();
      expect(calls).toEqual({ extraction: 1, verification: 1, placement: 0 });

      const replay = await mem.retain(input);
      expect(replay.sources[0]?.outcome).toBe('replayed');
      expect(stub.calls()).toEqual(calls);
    } finally {
      await mem.close();
      await stub.close();
    }
  });

  it('places caller-provided semantic candidates automatically without re-extracting them', async () => {
    const stub = await startAutomaticRetainStub();
    const mem = await openAutomaticMem(stub.url);
    try {
      const source = upsert('mail:3333', '1');
      source.retention.placement = 'automatic';
      source.retention.candidates[0]!.destination = { slug: 'memory/warranty-decisions' };
      const result = await mem.retain({ sources: [source] });
      expect(result.sources[0]).toMatchObject({
        outcome: 'ok',
        candidates: [{ outcome: 'written', slug: 'memory/warranty-decisions' }],
      });
      expect(stub.calls()).toEqual({ extraction: 0, verification: 0, placement: 1 });
    } finally {
      await mem.close();
      await stub.close();
    }
  });

  it('holds an oversized complete source instead of truncating discourse for the model', async () => {
    const stub = await startAutomaticRetainStub();
    const mem = await openAutomaticMem(stub.url);
    try {
      const input = {
        sources: [
          {
            source_id: 'conversation:4444',
            revision: 'turn-1',
            input: { text: `Ada Marlow wrote: ${'invented context '.repeat(8_000)}` },
            preserve_source: { mode: 'source_page', slug: 'sources/oversized-conversation' },
            retention: { mode: 'extract' },
          },
        ],
      } as const;
      const result = await mem.retain(input);

      expect(result.sources[0]).toMatchObject({
        outcome: 'held',
        status: 'ok',
        reason_code: 'context_too_large',
        candidates: [],
        source: { kind: 'text', reextractable: false },
        model_usage: { extraction: null, verification: null, placement: [] },
      });
      expect(result.sources[0]?.note).toContain('did not truncate');
      expect(fs.existsSync(path.join(root, 'sources/oversized-conversation.md'))).toBe(false);
      expect(stub.calls()).toEqual({ extraction: 0, verification: 0, placement: 0 });

      const replay = await mem.retain(input);
      expect(replay.sources[0]?.outcome).toBe('replayed');
      expect(replay.sources[0]?.reason_code).toBe('context_too_large');
      expect(stub.calls()).toEqual({ extraction: 0, verification: 0, placement: 0 });
    } finally {
      await mem.close();
      await stub.close();
    }
  });
});
