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
      folders: { 'memory/**': { role: 'knowledge', remember: 'integrate' } },
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
        model_usage: { extraction: null, verification: null, placement: [] },
      });
      expect(result.sources[0]?.note).toContain('did not truncate');
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
