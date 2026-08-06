import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * §11, end to end. Extraction is real — the macOS Swift helper actually runs, over a
 * PDF built in the test — while naming runs against a stub chat endpoint, because
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

async function startStubChat(): Promise<typeof server> {
  let reply: Record<string, unknown> = {};
  const instance = http.createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: () => new Promise<void>((resolve) => instance.close(() => resolve())),
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
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        chat: { provider: 'stub', id: 'stub-chat' },
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
    // §11's order: text layer first. A real layer is exact; OCR of the same page is a
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
    // §11: a name someone chose carries intent no model can reconstruct.
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
    // §11: `<page-basename>-<sha8>.<ext>`. Unique by construction, so several files
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
    // §5's fence: the writeup above is a claim, the document text below is evidence.
    expect(page).toContain('<!-- reference -->');
  });

  it('makes the extracted text searchable through the index', async () => {
    // §11: a stored PDF is searchable by its own content, not just by prose someone
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
 * §2's cite-or-stay-quiet, applied to provenance. A vision model's *description* of a
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
          chat: { provider: 'stub', id: 'stub-chat' },
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
    // §11: an unrouted file sits visibly where you dropped it. An inbox with three
    // things in it is a to-do list; a misfiled document is a lost one.
    server.reply({ ...NAMED, summary: 'Entirely unrelated subject matter.', folder: null });
    const result = await mem.ingest({
      path: drop('IMG_4830.pdf', makePdf('Entirely unrelated subject matter, nothing to do with anything.')),
    });
    expect(result.outcome).toBe('requires_approval');
    expect(result.approval?.proposal_id).toBeTruthy();
    expect(fs.readdirSync(root).sort()).toEqual(['home']);
  });

  it('honours an explicit folder without second-guessing it', async () => {
    const result = await mem.ingest({
      path: drop('IMG_4831.pdf', makePdf('Nothing related to anything already here.')),
      folder: 'home',
    });
    expect(result.outcome).toBe('ok');
    expect(result.slug?.startsWith('home/')).toBe(true);
  });

  it('gates a new top-level folder for an agent, exactly as a write would', async () => {
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
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          chat: { provider: 'stub', id: 'stub-chat' },
        },
      },
    });

    const result = await mem.ingest({
      path: drop('IMG_4832.pdf', makePdf('Warranty certificate for the Zephyr QX-100.')),
      folder: 'warranties',
    });
    expect(result.outcome).toBe('requires_approval');
    expect(fs.existsSync(path.join(root, 'warranties'))).toBe(false);
  });
});
