import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * §7, §8. Facts are pointers into Markdown, so their lifecycle is decided by what
 * happened to the *line*, not by what a model said this time.
 *
 * These run against a stub chat endpoint rather than a real model: the question is
 * whether the indexer draws the right conclusion from a given derivation, which is
 * exactly what a live model makes impossible to assert.
 */

let root: string;
let stateDir: string;
let server: { url: string; close: () => Promise<void>; setFacts: (facts: unknown[]) => void };
let mem: Akno;

/** Minimal OpenAI-compatible chat endpoint returning a scripted derivation. */
async function startStubChat(): Promise<typeof server> {
  const http = await import('node:http');
  let facts: unknown[] = [];
  const instance = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const payload = JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ summary: 'A stub summary.', keywords: ['stub'], facts }),
            },
          },
        ],
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(payload);
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>((resolve) => instance.close(() => resolve())),
    setFacts: (next) => {
      facts = next;
    },
  };
}

async function openMem(): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        // No embedding: these tests are about fact lifecycle, not retrieval.
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        chat: { provider: 'stub', id: 'stub-chat' },
      },
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-facts-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-facts-state-'));
  server = await startStubChat();
  fs.writeFileSync(
    path.join(root, 'lease.md'),
    ['---', 'title: Lease', '---', '', '# Lease', '', '- Rent: 1111 EUR', '- Landlord: Bo Winters', ''].join(
      '\n',
    ),
    'utf8',
  );
  mem = await openMem();
});

afterEach(async () => {
  await mem?.close();
  await server?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('fact lifecycle', () => {
  it('derives a fact and attaches its confidence to the source line', async () => {
    server.setFacts([
      {
        line: 7,
        claim: 'The rent is 1111 EUR per month.',
        subject: 'lease',
        attribute: 'rent',
        value: '1111 EUR',
      },
    ]);
    await mem.index({});

    const page = await mem.read({ slug: 'lease' });
    const line = page.page!.lines.find((entry) => entry.text.includes('1111'));
    expect(line?.confidence).toBeGreaterThan(0.7);
    expect(page.page!.superseded).toBeUndefined();
  });

  /**
   * The regression this guards. §8 notes a fresh derivation may phrase a claim
   * differently. Retiring on id alone made every re-derive flood recall with
   * "was X until today" for values that never changed — and an invented
   * historical claim is worse than none, because a reader cannot tell it from a
   * real one.
   */
  it('does not invent supersession when the deriver only rephrases', async () => {
    server.setFacts([{ line: 7, claim: 'The rent is 1111 EUR per month.' }]);
    await mem.index({});

    // Same file, byte for byte. Only the wording of the claim changed.
    server.setFacts([{ line: 7, claim: 'Rent for the apartment is 1111 EUR monthly.' }]);
    await mem.index({ rederive: true });

    const page = await mem.read({ slug: 'lease' });
    expect(page.page!.superseded).toBeUndefined();
  });

  /**
   * The same failure through a different door: an *empty* derivation. Reading "which
   * source lines are still live" from the incoming facts made zero facts look like every
   * line vanishing at once, so a page that merely became `reference` — or one where a
   * small model returned nothing that pass — retired its whole history as superseded on
   * lines nobody had touched.
   */
  it('does not invent supersession when a derivation comes back empty', async () => {
    server.setFacts([{ line: 7, claim: 'The rent is 1111 EUR per month.' }]);
    await mem.index({});

    // Same file, byte for byte. This pass simply produced no facts.
    server.setFacts([]);
    await mem.index({ rederive: true });

    const page = await mem.read({ slug: 'lease' });
    expect(page.page!.superseded).toBeUndefined();
    // Gone, not retired: nothing was superseded, so there is no history to report. The
    // next pass over the same unchanged line can derive it again.
    expect(page.page!.lines.find((entry) => entry.text.includes('1111'))?.confidence).toBeUndefined();
  });

  it('supersedes when the source line actually changes', async () => {
    server.setFacts([{ line: 7, claim: 'The rent is 1111 EUR per month.' }]);
    await mem.index({});

    const lease = path.join(root, 'lease.md');
    fs.writeFileSync(lease, fs.readFileSync(lease, 'utf8').replace('1111', '2222'), 'utf8');
    server.setFacts([{ line: 7, claim: 'The rent is 2222 EUR per month.' }]);
    await mem.index({});

    const page = await mem.read({ slug: 'lease' });
    // The old value comes back labelled, not as a second current answer.
    expect(page.page!.superseded?.map((entry) => entry.claim)).toEqual(['The rent is 1111 EUR per month.']);
    expect(page.page!.lines.some((entry) => entry.text.includes('2222'))).toBe(true);
  });

  it('drops a fact whose source line is deleted', async () => {
    server.setFacts([{ line: 8, claim: 'The landlord is Bo Winters.' }]);
    await mem.index({});

    const lease = path.join(root, 'lease.md');
    fs.writeFileSync(lease, fs.readFileSync(lease, 'utf8').replace('- Landlord: Bo Winters\n', ''), 'utf8');
    server.setFacts([]);
    await mem.index({});

    const page = await mem.read({ slug: 'lease' });
    // The line is gone, so the claim is superseded rather than silently dropped —
    // a value that existed and stopped existing is history, not a mistake.
    expect(page.page!.superseded?.map((entry) => entry.claim)).toEqual(['The landlord is Bo Winters.']);
  });

  it('refuses a fact pointing at a line the model was never shown', async () => {
    // §2's no-hidden-storage guarantee: a fact whose source line does not say
    // what the fact says can never be correctly re-derived or invalidated.
    server.setFacts([
      { line: 7, claim: 'The rent is 1111 EUR per month.' },
      { line: 999, claim: 'The building has a swimming pool.' },
    ]);
    await mem.index({});

    const page = await mem.read({ slug: 'lease' });
    const claims = page.page!.lines.filter((entry) => entry.confidence !== undefined);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.text).toContain('1111');
  });

  it('does not mine below a reference fence', async () => {
    fs.writeFileSync(
      path.join(root, 'contract.md'),
      [
        '# Contract',
        '',
        'Signed in August.',
        '',
        '<!-- reference -->',
        '',
        'CLAUSE 1. The tenant shall pay 1111.',
        '',
      ].join('\n'),
      'utf8',
    );
    // The model is told about line 7 — but it sits below the fence, so it was
    // never in the input and the fact must be refused.
    server.setFacts([{ line: 7, claim: 'The tenant pays 1111.' }]);
    await mem.index({});

    const page = await mem.read({ slug: 'contract' });
    expect(page.page!.lines.some((entry) => entry.confidence !== undefined && entry.n >= 7)).toBe(false);
  });
});
