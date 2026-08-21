import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * Ingest, end to end. Extraction is real — the macOS Swift helper actually runs, over a
 * PDF built in the test — while naming runs against a stub model endpoint, because
 * every assertion here is about what `ingest` *does* with a given name, and a live
 * model cannot be scripted into returning the case you need.
 *
 * All fixtures are invented (see AGENTS.md). The PDF is generated, not borrowed.
 */

let root: string;
let stateDir: string;
let inbox: string;
let server: {
  url: string;
  close: () => Promise<void>;
  reply: (value: Record<string, unknown>) => void;
};
let mem: Akno;

/** A one-page PDF with a real text layer, so PDFKit has something to read. */
function makePdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, '\\$1');
  const stream = `BT /F1 12 Tf 40 750 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/**
 * A deterministic "topic" embedder: one-hot over a few keyword buckets, so a query and a
 * page about the same subject score a cosine of 1 and anything else 0.
 *
 * Routing thresholds `relevance`, which means these tests need *some* real relevance to
 * exist — with no embedding model nothing has any, nothing can clear the threshold, and a
 * test that a file gets filed would be asserting on a code path that cannot run. A live
 * model cannot be scripted into producing the case under test, and real cosine values are
 * model-dependent, so the signal is faked and the decision made from it is real.
 */
const TOPICS = ['warranty', 'dishwasher', 'water', 'invoice'];

function stubEmbedding(text: string): number[] {
  const lower = text.toLowerCase();
  const vector = Array.from({ length: TOPICS.length + 1 }, () => 0);
  const hit = TOPICS.findIndex((topic) => lower.includes(topic));
  vector[hit === -1 ? TOPICS.length : hit] = 1;
  return vector;
}

async function startStubChat(): Promise<typeof server> {
  let reply: Record<string, unknown> = {};
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      if (request.url?.includes('/embeddings')) {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { input?: unknown };
        const inputs = Array.isArray(body.input) ? body.input : [String(body.input ?? '')];
        response.end(
          JSON.stringify({
            data: inputs.map((input, index) => ({
              index,
              embedding: stubEmbedding(String(input)),
            })),
          }),
        );
        return;
      }
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    reply: (value) => {
      reply = value;
    },
  };
}

const NAMED = {
  title: 'Zephyr appliance warranty',
  slug: 'warranty-zephyr-qx100-2026-03',
  summary: 'Five-year warranty for the Zephyr QX-100, registered March 2026.',
  type: 'warranty',
  folder: null,
  confidence: 0.92,
};

/**
 * A named document about a subject nothing in this knowledge base mentions, so no folder
 * can clear `route_threshold` and routing has to refuse.
 */
const UNPLACEABLE = {
  title: 'Meridian water statement 2026',
  slug: 'water-statement-2026',
  summary: 'Annual water statement, 214.60 EUR due 12 September 2026.',
  type: 'statement',
  folder: null,
  confidence: 0.9,
};

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ingest-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ingest-state-'));
  inbox = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-ingest-drop-'));
  server = await startStubChat();
  server.reply(NAMED);

  // A folder with a page in it, so routing has somewhere real to land and the gate
  // has an existing folder to compare against.
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'home/appliances.md'),
    '---\ntitle: Appliances\n---\n\n# Appliances\n\nThe Zephyr QX-100 dishwasher, five-year warranty.\n',
    'utf8',
  );

  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPICS.length + 1 },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { provider: 'stub', id: 'stub-derive' },
      },
    },
  });
  await mem.index({});
});

afterEach(async () => {
  await mem?.close();
  await server?.close();
  for (const dir of [root, stateDir, inbox]) fs.rmSync(dir, { recursive: true, force: true });
});

function drop(name: string, content: Buffer | string): string {
  const absPath = path.join(inbox, name);
  fs.writeFileSync(absPath, content);
  return absPath;
}

describe('extraction', () => {
  it('reads a PDF text layer without OCR', async () => {
    const source = drop('document(3).pdf', makePdf('Warranty certificate for the Zephyr QX-100 dishwasher.'));
    const result = await mem.ingest({ path: source, folder: 'home' });
    expect(result.outcome).toBe('ok');
    // The order: text layer first. A real layer is exact; OCR of the same page is a
    // guess that happens to be usually right.
    expect(result.ocr).toBe(false);
    expect(result.page_count).toBe(1);
  });

  it('reads a plain text file', async () => {
    const source = drop(
      'untitled.txt',
      'Warranty certificate for the Zephyr QX-100, five years from March 2026.',
    );
    const result = await mem.ingest({ path: source, folder: 'home' });
    expect(result.outcome).toBe('ok');
    expect(result.ocr).toBe(false);
  });

  it('leaves a file it cannot extract where it is', async () => {
    // Not a failure — a *result*, and the caller is told which guard fired.
    const source = drop('mystery.bin', Buffer.from([0, 1, 2, 3, 4]));
    const result = await mem.ingest({ path: source });
    expect(result.outcome).toBe('skipped');
    expect(result.note).toMatch(/no extractor|nothing could be extracted/i);
    expect(fs.existsSync(source)).toBe(true);
  });

  it('refuses an executable rather than filing it as a memory', async () => {
    const source = drop('installer.dmg', Buffer.from('not really a dmg'));
    await expect(mem.ingest({ path: source })).rejects.toThrow(/not ingested/);
  });

  it('refuses a file over the configured size', async () => {
    const source = drop('big.txt', 'x'.repeat(40 * 1_048_576));
    const result = await mem.ingest({ path: source, folder: 'home' });
    expect(result.outcome).toBe('skipped');
    expect(result.note).toMatch(/over the configured limit/);
  });
});

describe('naming', () => {
  it('names a badly-named file from its contents', async () => {
    const source = drop('IMG_4821.pdf', makePdf('Warranty certificate for the Zephyr QX-100 dishwasher.'));
    const result = await mem.ingest({ path: source, folder: 'home' });
    expect(result.slug).toBe('home/warranty-zephyr-qx100-2026-03');
    expect(result.renamed_from).toBe('IMG_4821.pdf');
  });

  it('leaves a good name alone', async () => {
    // A name someone chose carries intent no model can reconstruct.
    const source = drop('zephyr-warranty-2026.pdf', makePdf('Warranty certificate for the Zephyr QX-100.'));
    const result = await mem.ingest({ path: source, folder: 'home' });
    expect(result.renamed_from).toBeUndefined();
  });

  it('does not rename on low confidence', async () => {
    server.reply({ ...NAMED, confidence: 0.2 });
    const source = drop('IMG_4822.pdf', makePdf('Some barely legible text that could be anything at all.'));
    const result = await mem.ingest({ path: source, folder: 'home' });
    expect(result.outcome).toBe('skipped');
    expect(result.note).toMatch(/confidence/);
    expect(fs.existsSync(source)).toBe(true);
    // Nothing was created, so nothing has to be undone.
    expect(mem.changes()).toHaveLength(0);
  });

  it('treats a missing confidence as no confidence', async () => {
    // A model that forgets the field must not thereby get permission to rename.
    server.reply({ title: 'X', slug: 'some-slug', summary: 'y' });
    const source = drop('IMG_4823.pdf', makePdf('Warranty certificate for the Zephyr QX-100.'));
    expect((await mem.ingest({ path: source, folder: 'home' })).outcome).toBe('skipped');
  });

  it('refuses a slug that tries to be a path', async () => {
    server.reply({ ...NAMED, slug: '../../escape' });
    const source = drop('IMG_4824.pdf', makePdf('Warranty certificate for the Zephyr QX-100.'));
    const result = await mem.ingest({ path: source, folder: 'home' });
    // `cleanSlug` reduces it to a basename, so nothing lands outside the folder.
    expect(result.slug?.startsWith('home/')).toBe(true);
    expect(result.slug).not.toContain('..');
  });
});

describe('storage', () => {
  it('content-addresses the stored file off its page basename', async () => {
    const source = drop('IMG_4825.pdf', makePdf('Warranty certificate for the Zephyr QX-100.'));
    const result = await mem.ingest({ path: source, folder: 'home' });
    // `<page-basename>-<sha8>.<ext>`. Unique by construction, so several files
    // can sit on one page and `label` is a description rather than a disambiguator.
    expect(result.rel_path).toMatch(/^home\/warranty-zephyr-qx100-2026-03-[0-9a-f]{8}\.pdf$/);
    expect(fs.existsSync(path.join(root, result.rel_path!))).toBe(true);
  });

  it('stores the bytes unchanged', async () => {
    const bytes = makePdf('Warranty certificate for the Zephyr QX-100.');
    const result = await mem.ingest({ path: drop('IMG_4826.pdf', bytes), folder: 'home' });
    expect(fs.readFileSync(path.join(root, result.rel_path!))).toEqual(bytes);
  });

  it('writes a page that embeds the file and carries the summary', async () => {
    const result = await mem.ingest({
      path: drop('IMG_4827.pdf', makePdf('Warranty certificate for the Zephyr QX-100.')),
      folder: 'home',
    });
    const page = fs.readFileSync(path.join(root, `${result.slug}.md`), 'utf8');
    expect(page).toContain('title: Zephyr appliance warranty');
    expect(page).toContain('type: warranty');
    expect(page).toContain(NAMED.summary);
    expect(page).toContain(`![[${path.basename(result.rel_path!)}]]`);
    // What a person would have written: what it is, and where the thing itself lives. The
    // document's own text is indexed against the document, invalidated by the file hash —
    // which a page body cannot honour — so it is not copied in here.
    expect(page).not.toContain('Warranty certificate for the Zephyr QX-100.');
  });

  it('makes the extracted text searchable through the index', async () => {
    // A stored PDF is searchable by its own content, not just by prose someone
    // typed about it.
    await mem.ingest({
      path: drop('IMG_4828.pdf', makePdf('Serial number QX100-8842 registered under a five-year plan.')),
      folder: 'home',
    });
    const found = await mem.recall({ query: 'QX100-8842 serial', mode: 'lookup' });
    expect(found.cards.some((card) => card.slug.includes('warranty-zephyr'))).toBe(true);
  });

  it('is a no-op on the same bytes, and says where they already live', async () => {
    const bytes = makePdf('Warranty certificate for the Zephyr QX-100.');
    const first = await mem.ingest({ path: drop('a.pdf', bytes), folder: 'home' });
    const second = await mem.ingest({ path: drop('b.pdf', bytes), folder: 'home' });
    expect(second.outcome).toBe('duplicate');
    expect(second.rel_path).toBe(first.rel_path);
    expect(mem.changes()).toHaveLength(1);
  });

  it('does not collide two different documents that want one slug', async () => {
    await mem.ingest({ path: drop('one.pdf', makePdf('First warranty document text.')), folder: 'home' });
    const second = await mem.ingest({
      path: drop('two.pdf', makePdf('Second, different warranty document text.')),
      folder: 'home',
    });
    expect(second.outcome).toBe('ok');
    expect(second.slug).not.toBe('home/warranty-zephyr-qx100-2026-03');
  });

  it('is reversible', async () => {
    const result = await mem.ingest({
      path: drop('IMG_4829.pdf', makePdf('Warranty certificate for the Zephyr QX-100.')),
      folder: 'home',
    });
    await mem.undo({ change_id: result.change_id! });
    expect(fs.existsSync(path.join(root, result.rel_path!))).toBe(false);
    expect(fs.existsSync(path.join(root, `${result.slug}.md`))).toBe(false);
    await expect(mem.read({ slug: result.slug! })).rejects.toThrow(/no page/);
    // The source is untouched either way — ingest copies, it does not move.
    expect(fs.existsSync(path.join(inbox, 'IMG_4829.pdf'))).toBe(true);
  });
});

/**
 * Cite or stay quiet, applied to provenance. A vision model's *description* of a
 * photograph is not a transcription of text found in it, and reporting the two the same
 * way is a false claim about where the words came from. The first version printed
 * "text from: the text layer" for a model-described image.
 */
describe('provenance', () => {
  /** A 1x1 PNG with no text in it at all, so OCR must come back empty. */
  const BLANK_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );

  it('labels OCR text as OCR', async () => {
    const result = await mem.ingest({
      path: drop('IMG_5001.pdf', makePdf('Warranty certificate for the Zephyr QX-100.')),
      folder: 'home',
    });
    expect(result.text_from).toBe('text-layer');
  });

  it('labels a plain file as read directly', async () => {
    const result = await mem.ingest({
      path: drop('notes.txt', 'Warranty for the Zephyr QX-100, five years from March 2026.'),
      folder: 'home',
    });
    expect(result.text_from).toBe('plain');
  });

  it("labels a vision description as a description, never as the document's text", async () => {
    await mem.close();
    // The stub answers both roles. What matters is that a *described* image is
    // reported and written as described, not as transcribed.
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'user',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: server.url } },
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
          vision: { provider: 'stub', id: 'stub-vision', enabled: true },
        },
      },
    });

    const result = await mem.ingest({ path: drop('IMG_5002.png', BLANK_PNG), folder: 'home' });
    expect(result.text_from).toBe('vision');
    expect(result.ocr).toBe(false);

    const page = fs.readFileSync(path.join(root, `${result.slug}.md`), 'utf8');
    expect(page).toContain("a model's description of the image, not text found in it");
    expect(page).not.toContain('recognised by OCR');
  });

  it('says nothing could be extracted rather than implying empty content', async () => {
    const result = await mem.ingest({ path: drop('mystery.xyz', Buffer.from([9, 9, 9])) });
    expect(result.text_from).toBe('none');
    expect(result.outcome).toBe('skipped');
  });
});

describe('routing and gating', () => {
  it('leaves a file where it is when nothing scores high enough', async () => {
    // An unrouted file sits visibly where you dropped it. An inbox with three
    // things in it is a to-do list; a misfiled document is a lost one.
    server.reply(UNPLACEABLE);
    const result = await mem.ingest({
      path: drop('IMG_4830.pdf', makePdf('Entirely unrelated subject matter, nothing to do with anything.')),
    });
    expect(result.outcome).toBe('requires_approval');
    expect(result.approval?.proposal_id).toBeTruthy();
    expect(fs.readdirSync(root).sort()).toEqual(['home']);

    // Placement proposals hold an ingest source, not a page write. Answering one must replay the
    // ingest with the chosen folder and clear the proposal.
    const approved = await mem.approve(result.approval!.proposal_id, { slug: 'home' });
    expect(approved.ingest?.outcome).toBe('ok');
    expect(approved.ingest?.slug?.startsWith('home/')).toBe(true);
    expect(mem.proposals().map((proposal) => proposal.id)).not.toContain(result.approval!.proposal_id);
  });

  it('honours an explicit folder without second-guessing it', async () => {
    const result = await mem.ingest({
      path: drop('IMG_4831.pdf', makePdf('Nothing related to anything already here.')),
      folder: 'home',
    });
    expect(result.outcome).toBe('ok');
    expect(result.slug?.startsWith('home/')).toBe(true);
  });

  it('asks for a declaration of a new top-level folder, exactly as a write would', async () => {
    await mem.close();
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'agent',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: server.url } },
        models: {
          embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPICS.length + 1 },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
        },
      },
    });

    const result = await mem.ingest({
      path: drop('IMG_4832.pdf', makePdf('Warranty certificate for the Zephyr QX-100.')),
      folder: 'warranties',
    });
    expect(result.outcome).toBe('requires_folder');
    expect(result.requires_folder?.folder).toBe('warranties');
    // The file stays where it was dropped. Nobody is asked; the caller says what
    // `warranties/` is for and ingests it again.
    expect(fs.existsSync(path.join(root, 'warranties'))).toBe(false);
  });
});

/**
 * `ingest` pulls from a file, a folder, or a URL. The folder walk is one level deep
 * on purpose — a recursive pass over a folder pointed at by mistake is a thousand model
 * calls and a knowledge base full of pages nobody asked for.
 */
describe('a folder', () => {
  it('gives every file its own verdict', async () => {
    drop('one.pdf', makePdf('First warranty document, distinct text here.'));
    drop('two.txt', 'Second document, also about a Zephyr QX-100 warranty.');
    drop('three.bin', Buffer.from([1, 2, 3]));

    const result = await mem.ingest({ path: inbox, folder: 'home' });
    expect(result.batch).toHaveLength(3);
    // Two filing themselves and one skipped is not one outcome, and collapsing it
    // would lose the one.
    expect(result.batch!.filter((entry) => entry.outcome === 'ok')).toHaveLength(2);
    expect(result.batch!.find((entry) => entry.source === 'three.bin')?.outcome).toBe('skipped');
  });

  it('does not walk into subfolders', async () => {
    fs.mkdirSync(path.join(inbox, 'deeper'));
    fs.writeFileSync(path.join(inbox, 'deeper', 'buried.txt'), 'A document buried one level down.');
    drop('surface.txt', 'A document about the Zephyr QX-100 warranty at the surface.');

    const result = await mem.ingest({ path: inbox, folder: 'home' });
    expect(result.batch!.map((entry) => entry.source)).toEqual(['surface.txt']);
  });

  it('reports what it did not look at rather than implying that was all', async () => {
    for (let i = 0; i < 4; i++) drop(`doc-${i}.txt`, `Distinct warranty document number ${i} for a Zephyr.`);
    const result = await mem.ingest({ path: inbox, folder: 'home', limit: 2 });
    expect(result.batch).toHaveLength(2);
    expect(result.note).toMatch(/2 more were not looked at/);
  });

  it('keeps going when one file in the folder fails', async () => {
    drop('installer.dmg', Buffer.from('blocked by rule'));
    drop('good.txt', 'A perfectly readable document about a Zephyr QX-100 warranty.');
    const result = await mem.ingest({ path: inbox, folder: 'home' });
    expect(result.batch!.find((entry) => entry.source === 'installer.dmg')?.outcome).toBe('error');
    expect(result.batch!.find((entry) => entry.source === 'good.txt')?.outcome).toBe('ok');
  });

  it('says so when the folder is empty', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-empty-'));
    const result = await mem.ingest({ path: empty, folder: 'home' });
    expect(result.outcome).toBe('skipped');
    expect(result.note).toMatch(/holds no files/);
    fs.rmSync(empty, { recursive: true, force: true });
  });
});

describe('a URL', () => {
  /** A local server, so the suite never reaches the network. */
  async function serve(handler: (request: http.IncomingMessage, response: http.ServerResponse) => void) {
    const instance = http.createServer(handler);
    await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const { port } = instance.address() as { port: number };
    return {
      origin: `http://127.0.0.1:${port}`,
      close: async () => {
        instance.close();
        instance.closeAllConnections();
      },
    };
  }

  it('fetches, extracts and files it', async () => {
    const bytes = makePdf('Warranty certificate for the Zephyr QX-100, fetched over http.');
    const fixture = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/pdf' });
      response.end(bytes);
    });
    try {
      const result = await mem.ingest({ url: `${fixture.origin}/download`, folder: 'home' });
      expect(result.outcome).toBe('ok');
      expect(result.text_from).toBe('text-layer');
      // Where it came from is the question a downloaded document cannot otherwise answer.
      const page = fs.readFileSync(path.join(root, `${result.slug}.md`), 'utf8');
      expect(page).toContain(`source_url: ${fixture.origin}/download`);
    } finally {
      await fixture.close();
    }
  });

  it('takes the filename from Content-Disposition when there is one', async () => {
    const fixture = await serve((_request, response) => {
      response.writeHead(200, {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="zephyr-warranty-2026.pdf"',
      });
      response.end(makePdf('Warranty certificate for the Zephyr QX-100.'));
    });
    try {
      // A name that carries information is kept, even when it came from a server.
      const result = await mem.ingest({ url: `${fixture.origin}/x`, folder: 'home' });
      expect(result.renamed_from).toBeUndefined();
    } finally {
      await fixture.close();
    }
  });

  it('refuses a filename that tries to escape the temp directory', async () => {
    const fixture = await serve((_request, response) => {
      response.writeHead(200, {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="../../../etc/passwd"',
      });
      response.end(makePdf('Warranty certificate for the Zephyr QX-100.'));
    });
    try {
      // A server chooses this header, so it is untrusted input that becomes a filename.
      const result = await mem.ingest({ url: `${fixture.origin}/x`, folder: 'home' });
      expect(result.outcome).toBe('ok');
      expect(result.rel_path).not.toContain('..');
      expect(fs.existsSync('/etc/passwd.pdf')).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it('enforces the size cap on the bytes that arrive', async () => {
    const fixture = await serve((_request, response) => {
      // Chunked, with no Content-Length at all — so there is nothing to trust and the
      // cap has to hold against the stream itself. (Node's own server would truncate a
      // body that exceeded a declared Content-Length, so declaring one would test Node.)
      response.writeHead(200, { 'content-type': 'text/plain' });
      for (let i = 0; i < 40; i++) response.write('x'.repeat(1_048_576));
      response.end();
    });
    try {
      await expect(mem.ingest({ url: `${fixture.origin}/big`, folder: 'home' })).rejects.toThrow(
        /larger than the configured limit/,
      );
    } finally {
      await fixture.close();
    }
  });

  it('reports an http error rather than filing an error page', async () => {
    const fixture = await serve((_request, response) => {
      response.writeHead(404);
      response.end('nope');
    });
    try {
      await expect(mem.ingest({ url: `${fixture.origin}/missing`, folder: 'home' })).rejects.toThrow(/404/);
    } finally {
      await fixture.close();
    }
  });

  it('refuses a scheme that is not http or https', async () => {
    await expect(mem.ingest({ url: 'file:///etc/passwd' })).rejects.toThrow(/only http and https/);
  });
});

describe('the inbox', () => {
  /** Drops a file into the knowledge base's own inbox folder, where it files itself. */
  function dropInInbox(name: string, content: Buffer | string): string {
    const absPath = path.join(root, 'inbox', name);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content);
    return absPath;
  }

  it('extracts, names, routes and moves a dropped file out', async () => {
    // The stub names a folder that exists, which is what lets routing land without an
    // embedding model. Without one there is no `relevance` to threshold, and refusing to
    // route is the correct behaviour — see the next test.
    server.reply({ ...NAMED, folder: 'home' });
    const source = dropInInbox('Scan 2026-08-06 at 14.22.pdf', makePdf('Warranty for the Zephyr QX-100.'));

    const result = await mem.inbox();

    expect(result.filed).toEqual([
      { source: 'inbox/Scan 2026-08-06 at 14.22.pdf', slug: 'home/warranty-zephyr-qx100-2026-03' },
    ]);
    // Moved, not copied. The inbox is the one place Akno relocates a file, and a file
    // left behind would be filed again on the next pass.
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.existsSync(path.join(root, 'home/warranty-zephyr-qx100-2026-03.md'))).toBe(true);
    expect(
      fs.readdirSync(path.join(root, 'home')).some((name) => /^warranty-.*-[0-9a-f]{8}\.pdf$/.test(name)),
    ).toBe(true);
  });

  it('does not let the namer overrule a refusal', async () => {
    // The regression this guards, found on a real knowledge base: below the threshold,
    // routing fell through to whatever folder the model had suggested. The
    // best-scoring folder was `receipts/` at 0.383 against a threshold of 0.5 — the
    // refusal was right — and the fallback then filed a water bill into an employment
    // folder, overriding the refusal with a signal weaker than the rejected one.
    //
    // There is no embedding model here, so nothing has a relevance and nothing can clear
    // the threshold. A suggestion pointing at a folder that exists must still not win.
    server.reply({ ...UNPLACEABLE, folder: 'home' });
    const source = dropInInbox('unclear.pdf', makePdf('An annual water statement for the property.'));

    const result = await mem.inbox();

    expect(result.filed).toEqual([]);
    expect(result.waiting).toHaveLength(1);
    expect(fs.existsSync(source)).toBe(true);
    expect(fs.existsSync(path.join(root, 'home/water-statement-2026.md'))).toBe(false);
  });

  it('leaves an unroutable file in the inbox with a proposal', async () => {
    // Below the threshold it stays in the inbox. An inbox with three things in it is
    // a to-do list; a misfiled document is a lost one.
    server.reply(UNPLACEABLE);
    const source = dropInInbox('unclear.pdf', makePdf('An annual water statement for the property.'));

    const result = await mem.inbox();

    expect(result.filed).toEqual([]);
    expect(result.waiting).toHaveLength(1);
    expect(result.waiting[0]!.proposalId).toMatch(/^prop_/);
    expect(fs.existsSync(source)).toBe(true);
  });

  it('reconsiders what is still waiting on the next pass', async () => {
    server.reply(UNPLACEABLE);
    const source = dropInInbox('unclear.pdf', makePdf('Warranty for the Zephyr QX-100 dishwasher.'));
    expect((await mem.inbox()).waiting).toHaveLength(1);

    // Nothing was consumed, so the same file is still a candidate — that is what makes the
    // inbox a to-do list rather than a queue that loses things.
    server.reply({ ...NAMED, folder: 'home' });
    const second = await mem.inbox();
    expect(second.filed).toHaveLength(1);
    expect(fs.existsSync(source)).toBe(false);
  });

  it('does not treat a Markdown page in the inbox as an arrival', async () => {
    // Startup puts a README there, and someone may well write a note about what they dropped.
    dropInInbox('README.md', '# Inbox\n\nDrop anything here.\n');
    const result = await mem.inbox();
    expect(result.filed).toEqual([]);
    expect(result.skipped).toEqual([
      { source: 'inbox/README.md', reason: 'a Markdown page, not a dropped document' },
    ]);
  });

  it('treats any folder carrying route: true as an inbox', async () => {
    // `route: true` is what makes a folder an inbox — not its name. A knowledge base that
    // calls it `dropbox/` gets the same behaviour.
    const other = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'user',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: server.url } },
        models: {
          embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPICS.length + 1 },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
        },
        folders: { 'dropbox/**': { ingest: 'auto', route: true } },
      },
    });
    try {
      server.reply({ ...NAMED, folder: 'home' });
      fs.mkdirSync(path.join(root, 'dropbox'), { recursive: true });
      fs.writeFileSync(path.join(root, 'dropbox/thing.pdf'), makePdf('Warranty for the Zephyr QX-100.'));

      // Both are walked: declaring `dropbox/` must not quietly stop `inbox/` from being an
      // inbox, since startup creates it with a README promising exactly this behaviour.
      fs.mkdirSync(path.join(root, 'inbox'), { recursive: true });
      fs.writeFileSync(path.join(root, 'inbox/note.md'), '# A note\n');

      const result = await other.inbox();
      expect(result.filed.map((entry) => entry.source)).toEqual(['dropbox/thing.pdf']);
      expect(result.skipped.map((entry) => entry.source)).toEqual(['inbox/note.md']);
    } finally {
      await other.close();
    }
  });

  it('reports nothing when there is no inbox on disk', async () => {
    const result = await mem.inbox();
    expect(result).toEqual({ filed: [], waiting: [], skipped: [] });
  });
});

describe('attachments on write', () => {
  it('stores, embeds and extracts a document the caller attaches', async () => {
    const source = drop(
      'receipt.txt',
      'Dishwasher repair, 4 August 2026, 180 euro, Meridian Appliance Care.',
    );

    const result = await mem.write({
      slug: 'home/dishwasher-repair',
      title: 'Dishwasher repair',
      content: 'The Zephyr QX-100 was repaired on 4 August 2026.',
      documents: [{ path: source, label: 'The invoice' }],
    });

    expect(result.outcome).toBe('ok');
    expect(result.wrote?.some((target) => target.action === 'attached')).toBe(true);
    // Content-addressed off the page basename, so several documents can sit on one page
    // and `label` stays a description rather than a disambiguator.
    const stored = result.documents![0]!;
    expect(stored.rel_path).toMatch(/^home\/dishwasher-repair-[0-9a-f]{8}\.txt$/);
    expect(stored.text_from).toBe('plain');
    expect(fs.existsSync(path.join(root, stored.rel_path))).toBe(true);
    // Copied, not moved: a file handed to `write` was not dropped in an inbox.
    expect(fs.existsSync(source)).toBe(true);

    const page = fs.readFileSync(path.join(root, 'home/dishwasher-repair.md'), 'utf8');
    expect(page).toContain(`![[${path.basename(stored.rel_path)}]]`);
  });

  it('makes the attached text searchable by its own content', async () => {
    // The promise, and the reason the text is indexed at all: search reads chunks, and
    // chunks come from Markdown. Text kept only in the `documents` row is unreachable.
    const source = drop('policy.txt', 'The Meridian bicycle policy excludes theft from an unlocked shed.');
    await mem.write({
      slug: 'home/bicycle',
      title: 'Bicycle',
      content: 'A city bike, insured.',
      documents: [{ path: source }],
    });

    const found = await mem.recall({ query: 'unlocked shed', mode: 'lookup' });
    expect(found.cards.map((card) => card.slug)).toContain('home/bicycle');
  });

  it('leaves the page the caller wrote alone apart from the embed', async () => {
    // Akno writes one thing into a page it did not author: the embed that says the file
    // is there (plus its provenance). Pasting the document's text in as well put a copy in
    // the user's Markdown that no later change to the file could ever correct.
    const source = drop('policy.txt', 'Excludes theft from an unlocked shed.');
    await mem.write({
      slug: 'home/bicycle',
      title: 'Bicycle',
      content: 'A city bike, insured.',
      documents: [{ path: source }],
    });

    const page = fs.readFileSync(path.join(root, 'home/bicycle.md'), 'utf8');
    expect(page).toContain('A city bike, insured.');
    expect(page).toContain('![[');
    expect(page).not.toContain('unlocked shed');
    expect(page).not.toContain('<!-- reference -->');
  });

  it('quotes the matching document text on the card, attributed to the document', async () => {
    const source = drop('policy.txt', 'Excludes theft from an unlocked shed.');
    const written = await mem.write({
      slug: 'home/bicycle',
      title: 'Bicycle',
      content: 'A city bike, insured.',
      documents: [{ path: source }],
    });

    const found = await mem.recall({ query: 'unlocked shed', mode: 'lookup' });
    const card = found.cards.find((entry) => entry.slug === 'home/bicycle');
    const document = card?.documents?.find((entry) => entry.rel_path === written.documents![0]!.rel_path);
    expect(document?.quote).toContain('unlocked shed');
    // Never as a line of the Markdown page: the page has no such line, and a citation
    // pointing at the wrong line is worse than no citation.
    expect(card?.lines.some((line) => line.text.includes('unlocked shed'))).toBe(false);
  });

  it('adds a second attachment without disturbing the first', async () => {
    const first = drop('one.txt', 'The first document mentions a warranty.');
    const one = await mem.write({
      slug: 'home/two-files',
      title: 'Two files',
      content: 'Two documents belong here.',
      documents: [{ path: first }],
    });

    const second = drop('two.txt', 'The second document mentions a service visit.');
    const two = await mem.write({
      slug: 'home/two-files',
      append: 'And a second one arrived.',
      documents: [{ path: second }],
    });

    const page = fs.readFileSync(path.join(root, 'home/two-files.md'), 'utf8');
    expect(page).toContain(`![[${path.basename(one.documents![0]!.rel_path)}]]`);
    expect(page).toContain(`![[${path.basename(two.documents![0]!.rel_path)}]]`);
    expect(page).toContain('And a second one arrived.');
    // Both are searchable by their own contents, as two separate documents on one page.
    const found = await mem.recall({ query: 'service visit', mode: 'lookup' });
    const card = found.cards.find((entry) => entry.slug === 'home/two-files');
    expect(card?.documents?.some((entry) => entry.quote?.includes('service visit'))).toBe(true);
  });

  it('refuses to attach a file that is not there', async () => {
    await expect(
      mem.write({
        slug: 'home/missing-attachment',
        content: 'Nothing to see.',
        documents: [{ path: path.join(inbox, 'does-not-exist.pdf') }],
      }),
    ).rejects.toThrow(/no file to attach/);
  });

  it('is undone whole: the page, the stored file and the text together', async () => {
    const source = drop('receipt.txt', 'Dishwasher repair, 180 euro.');
    const written = await mem.write({
      slug: 'home/undo-me',
      title: 'Undo me',
      content: 'A page with an attachment.',
      documents: [{ path: source }],
    });
    const stored = written.documents![0]!.rel_path;

    await mem.undo({ change_id: written.change_id! });

    expect(fs.existsSync(path.join(root, 'home/undo-me.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, stored))).toBe(false);
  });
});

/**
 * A scanner that produced `passport.pdf` and `passport-2.pdf` produced one document in
 * two files. Two documents would mean two pages, two summaries, two half-answers — and a
 * "page 2" that is really page 5 of the passport.
 */
describe('a document in several files', () => {
  beforeEach(() => {
    // A page and two files that belong to it, placed by hand rather than by ingest.
    fs.writeFileSync(
      path.join(root, 'home/lease.md'),
      '---\ntitle: Lease\n---\n\n# Lease\n\nThe apartment lease.\n\n![[lease-2.pdf]]\n',
      'utf8',
    );
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf('LEASE AGREEMENT clause one, the rent.'));
    fs.writeFileSync(
      path.join(root, 'home/lease-2.pdf'),
      makePdf('Clause seven, the deposit is returned within thirty days.'),
    );
  });

  it('reads both parts as one document, with page numbers running through', async () => {
    await mem.index({});

    const found = await mem.recall({ query: 'deposit returned within thirty days', mode: 'lookup' });
    const card = found.cards.find((entry) => entry.slug === 'home/lease');
    const document = card?.documents?.find((entry) => entry.quote);

    // One entry for the document, not one per file.
    expect(card?.documents).toHaveLength(1);
    expect(document?.parts).toBe(2);
    expect(document?.rel_path).toBe('home/lease.pdf');
    expect(document?.pages).toBe(2);
    // The match is on the second file's only page, which is page 2 of the document.
    expect(document?.matched_page).toBe(2);
    expect(document?.quote).toContain('thirty days');
  });

  it('returns the whole document when either part is read', async () => {
    await mem.index({});
    const card = (await mem.recall({ query: 'clause one the rent', mode: 'lookup' })).cards.find(
      (entry) => entry.slug === 'home/lease',
    );
    const id = card!.documents![0]!.id;

    const read = await mem.read({ document: id });
    expect(read.document?.text).toContain('clause one');
    expect(read.document?.text).toContain('thirty days');
    expect(read.document?.page_count).toBe(2);
    expect(read.document?.note).toBeUndefined();
    expect(read.note).toContain('2 files, read as one document');
  });

  it('gives the document one summary rather than one per file', async () => {
    server.reply({ summary: 'An apartment lease: rent, and a deposit returned within thirty days.' });
    await mem.index({});

    const card = (await mem.recall({ query: 'deposit returned', mode: 'lookup' })).cards.find(
      (entry) => entry.slug === 'home/lease',
    );
    expect(card?.documents?.[0]?.summary).toBe(
      'An apartment lease: rent, and a deposit returned within thirty days.',
    );
  });

  it('summarizes the document once, and retries later if it could not', async () => {
    // A summary is invalidated by not having one, not by the file's hash. A model that was
    // down — or that failed to answer in JSON — must be retried on a later pass rather than
    // waiting for the bytes on disk to change, which for a scan is never.
    server.reply({});
    const first = await mem.index({});
    expect(first.documentsExtracted).toBe(2);
    expect(first.documentsSummarized).toBe(0);
    expect(first.warnings.some((warning) => /could not summarize/.test(warning))).toBe(true);

    server.reply({ summary: 'An apartment lease: rent, and a deposit returned within thirty days.' });
    const second = await mem.index({});
    // Nothing on disk changed, so nothing was re-extracted — and the summary still arrived.
    expect(second.documentsExtracted).toBe(0);
    expect(second.documentsSummarized).toBe(1);

    const card = (await mem.recall({ query: 'deposit returned', mode: 'lookup' })).cards.find(
      (entry) => entry.slug === 'home/lease',
    );
    expect(card?.documents?.[0]?.summary).toContain('thirty days');
  });

  it('does not group two people’s files that happen to share a name', async () => {
    // Same basename, different folders. Welding these together would put one person's
    // permit inside the other's document.
    fs.mkdirSync(path.join(root, 'ada'), { recursive: true });
    fs.mkdirSync(path.join(root, 'bo'), { recursive: true });
    for (const who of ['ada', 'bo']) {
      fs.writeFileSync(
        path.join(root, `${who}/permit.md`),
        `---\ntitle: ${who} permit\n---\n\n# Permit\n\nA residence permit.\n`,
        'utf8',
      );
      fs.writeFileSync(path.join(root, `${who}/permit.pdf`), makePdf(`Residence permit for ${who}.`));
      fs.writeFileSync(path.join(root, `${who}/permit-2.pdf`), makePdf(`Second page for ${who}.`));
    }
    await mem.index({});

    for (const who of ['ada', 'bo']) {
      const card = (await mem.recall({ query: `second page for ${who}`, mode: 'lookup' })).cards.find(
        (entry) => entry.slug === `${who}/permit`,
      );
      expect(card?.documents).toHaveLength(1);
      expect(card?.documents?.[0]?.rel_path).toBe(`${who}/permit.pdf`);
      expect(card?.documents?.[0]?.parts).toBe(2);
    }
  });
});

/**
 * The text, written beside the file it came from.
 *
 * The point is a reader that is not Akno: the text of a stored contract has always been
 * in the index, and has never been anywhere a `grep`, an editor or an agent holding a
 * folder could reach it. What these assert is that putting it there costs nothing —
 * no second document, no second summary, no second hit for the same words.
 */
describe('a text rendition', () => {
  const LEASE = 'LEASE AGREEMENT. Clause one, the rent. Clause seven, deposit returned in thirty days.';

  /** The same knowledge base, reopened with the feature on. */
  async function withRenditions(ingest: Record<string, unknown> = {}): Promise<Akno> {
    await mem.close();
    mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'user',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: server.url } },
        models: {
          embedding: { provider: 'stub', id: 'stub-embed', dimensions: TOPICS.length + 1 },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
        },
        ingest: { text_rendition: true, text_rendition_min_chars: 0, ...ingest },
      },
    });
    return mem;
  }

  function page(name: string, embed: string): void {
    fs.writeFileSync(
      path.join(root, `home/${name}.md`),
      `---\ntitle: ${name}\n---\n\n# ${name}\n\nA document.\n\n![[${embed}]]\n`,
      'utf8',
    );
  }

  it('writes the extracted text beside the file, verbatim under a header', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));

    const report = await (await withRenditions()).index({});
    expect(report.renditionsWritten).toBe(1);

    const written = fs.readFileSync(path.join(root, 'home/lease.txt'), 'utf8');
    // Provenance first: text read off a scan is a good guess, not a transcript, and a file
    // that does not say which it is invites being quoted as the latter.
    expect(written).toContain('# Extracted text of lease.pdf');
    expect(written).toContain("read from the file's own text layer");
    expect(written).toContain('deposit returned in thirty days');

    // Byte for byte what `read` returns. Two texts for one document that can disagree is
    // the whole failure this design exists to avoid.
    const card = (await mem.recall({ query: 'deposit returned', mode: 'lookup' })).cards.find(
      (entry) => entry.slug === 'home/lease',
    );
    const stored = (await mem.read({ document: card!.documents![0]!.id })).document!.text!;
    expect(written.endsWith(`${stored}\n`)).toBe(true);
  });

  it('is the same document, not a second one', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    await (await withRenditions()).index({});
    // A second pass, so the rendition is on disk before the scan that has to classify it.
    const second = await mem.index({});

    // Not extracted, not summarized, not chunked — the text is the PDF's and is already
    // indexed against it. Extracting it again would index the same words twice.
    expect(second.documentsExtracted).toBe(0);
    expect(second.documentsSummarized).toBe(0);

    const health = await mem.doctor();
    expect(health.counts.documents).toBe(1);
    expect(health.counts.renditions).toBe(1);
    // And not counted as an attachment with nothing readable in it, which is what a
    // document with no text of its own would otherwise look like.
    expect(health.counts.documentsExtracted).toBe(1);
    expect(health.warnings.some((warning) => /no readable text/.test(warning))).toBe(false);
  });

  it('returns one hit for a phrase, not two', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    const first = await (await withRenditions()).index({});
    const second = await mem.index({});
    // The chunk count did not move when the rendition arrived. Every phrase in the contract
    // returning two hits against one budget is the failure this design exists to avoid.
    expect(second.chunksWritten).toBe(0);
    expect(first.chunksWritten).toBeGreaterThan(0);

    const found = await mem.recall({ query: 'deposit returned', mode: 'lookup' });
    const cards = found.cards.filter((entry) => entry.slug === 'home/lease');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.documents).toHaveLength(1);
    expect(cards[0]?.documents?.[0]?.rel_path).toBe('home/lease.pdf');
  });

  it('reading the rendition returns the document it renders', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    await (await withRenditions()).index({});
    await mem.index({});

    // Naming the `.txt` is naming the contract. Answering from the copy would make which of
    // the two you happened to reach for matter.
    const read = await mem.read({ document: 'home/lease.txt' });
    expect(read.document?.rel_path).toBe('home/lease.pdf');
    expect(read.document?.text).toContain('deposit returned in thirty days');
    expect(read.note).toBeUndefined();
  });

  it('keeps a surviving rendition attached when the original goes missing', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    await (await withRenditions()).index({});
    await mem.index({});

    fs.rmSync(path.join(root, 'home/lease.pdf'));
    await mem.index({});

    const read = await mem.read({ document: 'home/lease.txt' });
    expect(read.status).toBe('degraded');
    expect(read.degraded).toContain('document_source_missing');
    expect(read.document?.rel_path).toBe('home/lease.pdf');
    expect(read.document?.text).toContain('deposit returned in thirty days');
    expect(read.document?.availability).toMatchObject({
      status: 'degraded',
      available_from: ['indexed_text', 'rendition'],
      missing_originals: ['home/lease.pdf'],
      available_renditions: ['home/lease.txt'],
    });
  });

  it('adopts a text file somebody extracted themselves', async () => {
    // The real case: `pdftotext contract.pdf > contract.txt`, run before Akno existed. It
    // was indexed as a document of its own, so every phrase in the contract came back twice.
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    fs.writeFileSync(path.join(root, 'home/lease.txt'), `${LEASE}\n`, 'utf8');

    await (await withRenditions()).index({});
    const second = await mem.index({});
    expect(second.documentsExtracted).toBe(0);

    const health = await mem.doctor();
    expect(health.counts.documents).toBe(1);
    // One file, not two: Akno's rendition has the same name as theirs, so theirs *is* it.
    expect(health.counts.renditions).toBe(1);
    expect(fs.existsSync(path.join(root, 'home/lease.pdf.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'home/lease.txt'), 'utf8')).toBe(`${LEASE}\n`);

    // Its chunks are gone: the words belong to the PDF and are indexed there.
    const found = await mem.recall({ query: 'deposit returned', mode: 'lookup' });
    expect(found.cards.filter((entry) => entry.slug === 'home/lease')).toHaveLength(1);
    expect((await mem.read({ document: 'home/lease.txt' })).document?.rel_path).toBe('home/lease.pdf');
  });

  it('notices a text file that became a rendition after it was indexed', async () => {
    // The file did not change; what changed is that its PDF arrived. Nothing re-examines an
    // unchanged file, so without a reconciliation pass it keeps its own chunks forever.
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.txt'), `${LEASE}\n`, 'utf8');
    const alone = await (await withRenditions()).index({});
    expect(alone.documentsExtracted).toBe(1);

    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    const arrived = await mem.index({});
    expect(arrived.warnings.some((warning) => /changed between being a document/.test(warning))).toBe(true);
    // A second pass, because the `.pdf.txt` written by the first one is not on disk until
    // after that pass has finished scanning.
    await mem.index({});

    const health = await mem.doctor();
    expect(health.counts.documents).toBe(1);
    expect(health.counts.renditions).toBe(1);
    expect((await mem.read({ document: 'home/lease.txt' })).document?.rel_path).toBe('home/lease.pdf');
  });

  it('does not copy a file that is already text', async () => {
    page('notes', 'notes.txt');
    fs.writeFileSync(path.join(root, 'home/notes.txt'), `${LEASE}\n`, 'utf8');
    const report = await (await withRenditions()).index({});
    expect(report.renditionsWritten).toBe(0);
    expect(fs.existsSync(path.join(root, 'home/notes.txt.txt'))).toBe(false);
  });

  it('writes nothing when two documents would want the same name', async () => {
    // `scan.jpg` and `scan.pdf` in one folder both want `scan.txt`, and a file two documents
    // claim belongs to neither of them.
    page('scan', 'scan.pdf');
    fs.writeFileSync(path.join(root, 'home/scan.pdf'), makePdf(LEASE));
    fs.writeFileSync(path.join(root, 'home/scan.jpg'), makePdf(`${LEASE} A second reading of it.`));

    const report = await (await withRenditions()).index({});
    expect(report.renditionsWritten).toBe(0);
    expect(fs.existsSync(path.join(root, 'home/scan.txt'))).toBe(false);
    expect(report.warnings.some((warning) => /would not read back as the text of/.test(warning))).toBe(true);
  });

  it('works on a scoped pass, which is the only kind the watcher runs', async () => {
    // The watcher indexes `{ only: [...] }`. This query joins `pages`, which has a
    // `rel_path` column too, so an unqualified name in the scope clause fails on exactly the
    // path a full index never takes — silently, in a log nobody reads.
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    await (await withRenditions()).index({});
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(`${LEASE} Amended.`));

    const report = await mem.index({ only: ['home/lease.pdf'] });
    expect(report.warnings).toEqual([]);
    expect(report.renditionsWritten).toBe(1);
    expect(fs.readFileSync(path.join(root, 'home/lease.txt'), 'utf8')).toContain('Amended.');
  });

  it('leaves a short document to the page beside it', async () => {
    page('receipt', 'receipt.pdf');
    fs.writeFileSync(path.join(root, 'home/receipt.pdf'), makePdf('Paid 4.20 EUR.'));
    const report = await (await withRenditions({ text_rendition_min_chars: 1000 })).index({});
    expect(report.renditionsWritten).toBe(0);
    expect(fs.existsSync(path.join(root, 'home/receipt.txt'))).toBe(false);
    // Declining is recorded, so a photograph is not reconsidered on every pass forever.
    expect((await mem.index({})).renditionsWritten).toBe(0);
  });

  it('never overwrites one that was edited by hand', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    const target = path.join(root, 'home/lease.txt');
    // Somebody fixed three OCR mistakes in it. Silently reverting that is not recoverable.
    fs.writeFileSync(target, 'Corrected by hand.\n', 'utf8');

    await (await withRenditions()).index({});
    expect(fs.readFileSync(target, 'utf8')).toBe('Corrected by hand.\n');
  });

  it('writes nothing at all unless it is asked to', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    const report = await mem.index({});
    expect(report.renditionsWritten).toBe(0);
    expect(fs.existsSync(path.join(root, 'home/lease.txt'))).toBe(false);
  });

  it('rewrites when the file changes, and converges when it does not', async () => {
    page('lease', 'lease.pdf');
    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf(LEASE));
    await (await withRenditions()).index({});

    const second = await mem.index({});
    expect(second.renditionsWritten).toBe(0);

    fs.writeFileSync(path.join(root, 'home/lease.pdf'), makePdf('Replaced: the rent is now 1500 EUR.'));
    const third = await mem.index({});
    expect(third.renditionsWritten).toBe(1);
    expect(fs.readFileSync(path.join(root, 'home/lease.txt'), 'utf8')).toContain('1500 EUR');
  });
});
