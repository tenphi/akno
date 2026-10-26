import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * The fact arm searches derived facts on their own, so a hit names the line that answers rather
 * than the section it sits in. The page below puts that line at the bottom of a section longer
 * than a question-mode card window, which is exactly where chunk search alone shows the wrong lines.
 */

let root: string;
let stateDir: string;
let server: { url: string; close: () => Promise<void>; setFacts: (facts: unknown[]) => void };
let mem: Akno;

const PAGE = [
  '---',
  'title: Zephyr QX-100',
  '---',
  '',
  '# Zephyr QX-100',
  '',
  '## Service records',
  '',
  '- The Zephyr QX-100 manual lists every accessory in its appendix.',
  '- Bo Winters keeps the packaging in the hall cupboard.',
  '- The service booklet has a blue cover.',
  '- The handle was replaced once.',
  '- A spare filter is stored beside the boiler.',
  '- The technician recommended annual cleaning.',
  '- Coverage for the Zephyr QX-100 runs until 2031-11-11.',
  '',
];
const ANSWER_LINE = PAGE.findIndex((line) => line.includes('2031-11-11')) + 1;

async function startStubChat(): Promise<typeof server> {
  const http = await import('node:http');
  let facts: unknown[] = [];
  const instance = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const content = JSON.stringify({ summary: 'Service records.', keywords: ['service'], facts });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    setFacts: (next) => {
      facts = next;
    },
  };
}

async function openMem(recallFacts: boolean): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      recall: { expansion: false, graph: false, facts: recallFacts },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { id: null },
      },
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-fact-arm-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-fact-arm-state-'));
  server = await startStubChat();
  server.setFacts([
    {
      line: ANSWER_LINE,
      claim: 'The Zephyr QX-100 warranty expires on 2031-11-11.',
      subject: 'Zephyr QX-100',
      attribute: 'warranty expiry',
      value: '2031-11-11',
    },
  ]);
  fs.writeFileSync(path.join(root, 'zephyr-qx-100.md'), PAGE.join('\n'), 'utf8');
});

afterEach(async () => {
  await mem?.close();
  await server?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function factSearchRows(): number {
  const db = new Database(mem.config.dbPath, { readonly: true });
  try {
    return (db.prepare('SELECT count(*) AS c FROM facts_fts').get() as { c: number }).c;
  } finally {
    db.close();
  }
}

describe('fact retrieval', () => {
  it('keeps the fact search index in step with facts, including page removal', async () => {
    mem = await openMem(true);
    await mem.index({});
    expect(factSearchRows()).toBe(1);

    fs.rmSync(path.join(root, 'zephyr-qx-100.md'));
    await mem.index({});
    expect(factSearchRows()).toBe(0);
  });

  it('leaves recall unchanged while the fact arm is off', async () => {
    mem = await openMem(false);
    await mem.index({});
    const result = await mem.recall({ query: 'When does the warranty expire?' });
    const card = result.results.find((entry) => entry.type === 'page');
    // The forward window from the top of the section cannot reach the answer.
    expect(card?.type === 'page' && card.lines.map((line) => line.n)).not.toContain(ANSWER_LINE);
  });

  it('shows the line a fact matched even when it sits below the card window', async () => {
    mem = await openMem(false);
    await mem.index({});
    const result = await mem.recall({ query: 'When does the warranty expire?', facts: true });
    const card = result.results.find((entry) => entry.type === 'page');
    expect(card?.type === 'page' && card.lines.map((line) => line.n)).toContain(ANSWER_LINE);
    // Cards keep the existing arm vocabulary, which older clients validate exhaustively.
    expect(card?.type === 'page' && card.matched_by).not.toContain('fact');
  });

  it('targets lines without reordering cards, so evidence that has no facts keeps its place', async () => {
    // An orphan document is never fact-mined. Ranking fact-bearing chunks higher would push it down.
    fs.writeFileSync(
      path.join(root, 'warranty-certificate.txt'),
      'Warranty certificate: coverage for the Zephyr QX-100 expires on 2031-11-11.\n',
      'utf8',
    );
    mem = await openMem(false);
    await mem.index({});
    const order = (result: Awaited<ReturnType<Akno['recall']>>) =>
      result.results.map((entry) => (entry.type === 'page' ? entry.slug : entry.path));
    const plain = await mem.recall({ query: 'When does the warranty expire?' });
    const targeted = await mem.recall({ query: 'When does the warranty expire?', facts: true });
    expect(order(plain)).toHaveLength(2);
    expect(order(targeted)).toEqual(order(plain));
  });

  it('returns a compact fact list with source locators', async () => {
    mem = await openMem(false);
    await mem.index({});
    const result = await mem.recall({ query: 'When does the warranty expire?', format: 'facts' });
    expect(result.results).toEqual([]);
    expect(result.facts?.[0]).toMatchObject({
      claim: 'The Zephyr QX-100 warranty expires on 2031-11-11.',
      slug: 'zephyr-qx-100',
      line: ANSWER_LINE,
      matched_by: expect.arrayContaining(['fact']),
    });
    expect(result.text).toContain(`L${ANSWER_LINE} The Zephyr QX-100 warranty expires on 2031-11-11.`);
    // The other lines of the matched card come back as evidence, without repeating the fact's line.
    const evidenceLines = result.evidence?.flatMap((item) => item.lines?.map((line) => line.n) ?? []) ?? [];
    expect(evidenceLines).not.toContain(ANSWER_LINE);
    expect(result.budget_used).toBeLessThan(200);
  });
});
