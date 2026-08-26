import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * Facts are pointers into Markdown, so their lifecycle is decided by what
 * happened to the *line*, not by what a model said this time.
 *
 * These run against a stub endpoint rather than a real model: the question is
 * whether the indexer draws the right conclusion from a given derivation, which is
 * exactly what a live model makes impossible to assert.
 */

let root: string;
let stateDir: string;
let server: {
  url: string;
  close: () => Promise<void>;
  setFacts: (facts: unknown[]) => void;
  /** Break the full structured call only, leaving the summary-only fallback working. */
  setBreakFacts: (broken: boolean) => void;
};
let mem: Akno;

/** Minimal OpenAI-compatible chat endpoint returning a scripted derivation. */
async function startStubChat(): Promise<typeof server> {
  const http = await import('node:http');
  let facts: unknown[] = [];
  let breakFacts = false;
  const instance = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      // The full derivation asks for 2400 tokens, the summary-only fallback for 400. Telling them
      // apart is what lets a test produce a *partial* derivation — the failure where the facts half
      // is lost and the summary survives.
      const asked = JSON.parse(body) as { max_tokens?: number; max_completion_tokens?: number };
      const isFallback = (asked.max_tokens ?? asked.max_completion_tokens ?? 0) <= 400;
      const content =
        breakFacts && !isFallback
          ? '{ "summary": "cut off mid'
          : isFallback
            ? JSON.stringify({ summary: 'Recovered on its own.', keywords: ['recovered'] })
            : JSON.stringify({ summary: 'A stub summary.', keywords: ['stub'], facts });
      const payload = JSON.stringify({ choices: [{ message: { content } }] });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(payload);
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
    setBreakFacts: (broken) => {
      breakFacts = broken;
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
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { provider: 'stub', id: 'stub-derive' },
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
    const indexed = await mem.index({});

    // The graph pass follows derivation, so a fact produced now is not one index cycle behind.
    expect(indexed).toMatchObject({ graphFacts: 1, graphFactEdges: 1, graphNonTraversableFacts: 0 });

    const page = await mem.read({ slug: 'lease' });
    const line = page.page!.lines.find((entry) => entry.text.includes('1111'));
    expect(line?.confidence).toBeGreaterThan(0.7);
    expect(page.page!.superseded).toBeUndefined();
  });

  /**
   * The regression this guards: a fresh derivation may phrase a claim
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

  /**
   * A derivation that loses only its facts half must not be recorded as a derivation.
   *
   * It used to be. The partial fell through to the success branch, which did two permanent things:
   * `replaceFacts` with an empty list *deleted* every fact on the page — a claim whose source line
   * is still there and which this pass did not repeat is a rephrasing, and rephrasings are deleted
   * — and then `derived_hash` was stamped, so the page read as derived and no later pass ever
   * offered it again. One flaky call and a page's facts were gone, with no superseded rows to show
   * they had existed.
   *
   * Seen for real on 2026-08-17: `people/ada-marlow`, `timeline` and
   * `shopping/zephyr-qx-100` lost every fact to a token-parameter race a retry would have
   * fixed, and nothing would ever have retried them.
   */
  it('keeps the facts and stays pending when only the facts half of a derivation fails', async () => {
    server.setFacts([{ line: 7, claim: 'The rent is 1111 EUR per month.' }]);
    await mem.index({});

    const lease = path.join(root, 'lease.md');
    // A new line, so the page needs deriving again — while the line the fact points at is untouched,
    // which is what made deletion rather than supersession the old outcome.
    fs.appendFileSync(lease, '- Deposit: 2222 EUR\n', 'utf8');
    server.setBreakFacts(true);
    await mem.index({});

    const afterFailure = await mem.read({ slug: 'lease' });
    // Still stored for retry, but no longer attached to a current line or exposed as current
    // history. A stale fact can be recovered; it must not describe bytes it predates.
    expect(afterFailure.page!.lines.find((entry) => entry.text.includes('1111'))?.confidence).toBeUndefined();
    expect(afterFailure.page!.superseded).toBeUndefined();
    const db = new Database(mem.config.dbPath, { readonly: true });
    expect(db.prepare("SELECT count(*) AS count FROM facts WHERE claim LIKE '%1111%'").get()).toEqual({
      count: 1,
    });
    db.close();
    // The summary is the half that *was* recovered, so it is kept.
    expect(afterFailure.page!.summary).toBe('Recovered on its own.');

    // And the page is still pending, so a plain pass — no `rederive` — picks it up once the endpoint
    // recovers. This is the assertion that the hash was never stamped.
    server.setBreakFacts(false);
    server.setFacts([
      { line: 7, claim: 'The rent is 1111 EUR per month.' },
      { line: 9, claim: 'The deposit is 2222 EUR.' },
    ]);
    await mem.index({});

    const recovered = await mem.read({ slug: 'lease' });
    expect(recovered.page!.lines.find((entry) => entry.text.includes('2222'))?.confidence).toBeDefined();
    expect(recovered.page!.summary).toBe('A stub summary.');
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
    // The no-hidden-storage guarantee: a fact whose source line does not say
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

  it('does not mine below a source fence', async () => {
    fs.writeFileSync(
      path.join(root, 'contract.md'),
      [
        '# Contract',
        '',
        'Signed in August.',
        '',
        '<!-- source -->',
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
