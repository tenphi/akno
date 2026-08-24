import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnswerOutput } from '@tenphi/akno-protocol';
import { open, type Akno } from '../open.ts';
import { sha256 } from '../store/ids.ts';

let root: string;
let stateDir: string;
let memory: Akno;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-answer-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-answer-state-'));
  write(
    'products/zephyr-qx-100.md',
    '# Zephyr QX-100\n\nThe silverpine warranty marker says the warranty lasts five years.\n',
  );
  write(
    'inbox/copperfin-record.txt',
    'The copperfin orphan marker belongs to an invented standalone record.\n',
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
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
        vision: { id: null, enabled: false },
      },
    },
  });
  await memory.index({ verify: true });
});

afterEach(async () => {
  await memory?.close();
  for (const target of [root, stateDir]) fs.rmSync(target, { recursive: true, force: true });
});

describe('grounded answer discovery surface', () => {
  it('returns ordered related identities and typed model degradation without evidence text or writes', async () => {
    const before = treeFingerprint();
    const result = await memory.answer({
      question: 'What does the silverpine warranty marker say?',
      filter: { source: 'page' },
      expand: false,
      graph: false,
    });

    AnswerOutput.parse(result);
    expect(result).toMatchObject({
      status: 'degraded',
      outcome: 'not_answered',
      answer: null,
      citations: [],
      related_page_slugs: ['products/zephyr-qx-100'],
      related_documents: [],
      budget_used: { evidence_tokens: 0, answer_tokens: 0 },
    });
    expect(result.degraded).toContain('no_answer_model');
    expect(JSON.stringify(result)).not.toContain('lasts five years');
    expect(treeFingerprint()).toBe(before);
    expect(memory.changes()).toEqual([]);
  });

  it('preserves a complete empty recall as not-found instead of blaming the answer model', async () => {
    const result = await memory.answer({
      question: 'What is recorded in the missing invented folder?',
      filter: { folder: 'missing-fixture' },
      expand: false,
      graph: false,
    });

    expect(result).toMatchObject({
      status: 'empty',
      outcome: 'not_found',
      answer: null,
      related_page_slugs: [],
      related_documents: [],
    });
    expect(result.degraded).toBeUndefined();
  });

  it('represents an orphan document by compact id without leaking its path or quote', async () => {
    const result = await memory.answer({
      question: 'Find the copperfin orphan marker.',
      filter: { ownership: 'orphan' },
      expand: false,
      graph: false,
    });
    const serialized = JSON.stringify(result);

    expect(result.related_page_slugs).toEqual([]);
    expect(result.related_documents).toHaveLength(1);
    expect(result.related_documents[0]!.id).toMatch(/^doc_/);
    expect(serialized).not.toContain('inbox/copperfin-record.txt');
    expect(serialized).not.toContain('belongs to an invented standalone record');
  });
});

function write(relPath: string, content: string): void {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

function treeFingerprint(): string {
  const files = listFiles();
  return sha256(JSON.stringify(files.map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))])));
}

function listFiles(rel = ''): string[] {
  return fs
    .readdirSync(path.join(root, rel), { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.posix.join(rel, entry.name);
      return entry.isDirectory() ? listFiles(child) : [child];
    })
    .sort();
}
