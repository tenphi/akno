import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractionCapabilities } from './extract.ts';
import {
  createLinuxDocumentExtractor,
  createNodeLinuxCommandRunner,
  linuxExtractionCapabilities,
  type LinuxCommandRunner,
} from './linux-extractor.ts';
import { toLegacyExtraction } from './extract.ts';

const REQUEST = {
  absPath: '/invented/warranty.pdf',
  maxBytes: 10_000,
  maxOcrPages: 4,
};

function runner(outputs: Record<string, string>): LinuxCommandRunner {
  return {
    available: vi.fn(async () => true),
    makeTempDir: vi.fn(async () => '/tmp/akno-invented'),
    readText: vi.fn(async (file) => {
      throw new Error(`unexpected read: ${file}`);
    }),
    removeTempDir: vi.fn(async () => undefined),
    run: vi.fn(async (command, args) => {
      const key = `${command} ${args.join(' ')}`;
      const stdout = outputs[key];
      if (stdout === undefined) throw new Error(`unexpected command: ${key}`);
      return { stdout };
    }),
  };
}

async function writeGeneratedPdf(file: string): Promise<void> {
  const content = 'BT /F1 24 Tf 72 720 Td (Warranty five years with transferable coverage) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await fsp.writeFile(file, pdf);
}

describe('Linux document extractor', () => {
  it('smokes generated PDF, OCR, and office fixtures through installed native tools', async () => {
    const commands = createNodeLinuxCommandRunner();
    const capabilities = await linuxExtractionCapabilities(commands);
    const required = ['libreoffice', 'pdfinfo', 'pdftotext', 'pdftoppm', 'tesseract'] as const;
    if (required.some((tool) => !capabilities[tool])) return;

    const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'akno-linux-smoke-'));
    try {
      const pdf = path.join(directory, 'warranty.pdf');
      await writeGeneratedPdf(pdf);
      const backend = createLinuxDocumentExtractor(commands);
      const textLayer = await backend.extract({ ...REQUEST, absPath: pdf });
      expect(textLayer.text).toContain('Warranty five years');
      expect(textLayer.text_from).toBe('text-layer');

      const imagePrefix = path.join(directory, 'warranty-image');
      await commands.run('pdftoppm', [
        '-f',
        '1',
        '-l',
        '1',
        '-singlefile',
        '-png',
        '-r',
        '300',
        pdf,
        imagePrefix,
      ]);
      const image = await backend.extract({ ...REQUEST, absPath: `${imagePrefix}.png` });
      expect(image.text).toMatch(/Warranty\s+five\s+years/i);
      expect(image.text_from).toBe('ocr');

      const rtf = path.join(directory, 'warranty.rtf');
      await fsp.writeFile(rtf, String.raw`{\rtf1\ansi Warranty: five years}`);
      const office = await backend.extract({ ...REQUEST, absPath: rtf });
      expect(office.text).toContain('Warranty: five years');
      expect(office.provenance.tool).toBe('libreoffice');
    } finally {
      await fsp.rm(directory, { force: true, recursive: true });
    }
  });

  it('reports each native capability and actionable missing-tool guidance', async () => {
    const commands = runner({});
    commands.available = vi.fn(async (command) => command !== 'tesseract');

    await expect(linuxExtractionCapabilities(commands)).resolves.toEqual({
      backend: 'linux-native',
      libreoffice: true,
      pdfinfo: true,
      pdftotext: true,
      pdftoppm: true,
      tesseract: false,
      note: 'OCR is unavailable: install tesseract. PDF text-layer extraction remains available.',
    });
  });

  it('exposes Linux tools through the shared doctor capability report', async () => {
    const commands = runner({});
    commands.available = vi.fn(async (command) => command !== 'tesseract');

    await expect(extractionCapabilities('linux', commands)).resolves.toEqual({
      backend: 'linux-native',
      libreoffice: true,
      swift: false,
      textutil: false,
      pdfinfo: true,
      pdftotext: true,
      pdftoppm: true,
      tesseract: false,
      note: 'OCR is unavailable: install tesseract. PDF text-layer extraction remains available.',
    });
  });

  it('runs tools without a shell and manages a private raster directory', async () => {
    const commands = createNodeLinuxCommandRunner();

    expect(await commands.available(process.execPath)).toBe(true);
    expect(await commands.available('akno-invented-missing-tool')).toBe(false);
    await expect(commands.run(process.execPath, ['-e', 'process.stdout.write("ready")'])).resolves.toEqual({
      stdout: 'ready',
    });

    const directory = await commands.makeTempDir();
    expect(fs.statSync(directory).isDirectory()).toBe(true);
    await commands.removeTempDir(directory);
    expect(fs.existsSync(directory)).toBe(false);
  });

  it('forces timed-out native tools to stop even when they ignore SIGTERM', async () => {
    const execute = vi.fn(async () => ({ stdout: 'ready', stderr: '' }));
    const commands = createNodeLinuxCommandRunner(execute);

    await expect(commands.run(process.execPath, ['--version'])).resolves.toEqual({ stdout: 'ready' });
    expect(execute).toHaveBeenCalledWith(
      process.execPath,
      ['--version'],
      expect.objectContaining({ timeout: 300_000, killSignal: 'SIGKILL' }),
    );
  });

  it('extracts a PDF text layer with page locators through Poppler', async () => {
    const commands = runner({
      'pdfinfo /invented/warranty.pdf': 'Pages:           2\n',
      'pdftotext -layout /invented/warranty.pdf -':
        'Warranty: five years with transferable coverage.\fCoverage applies throughout Blackwater Bay.\f',
    });

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result).toEqual({
      text: 'Warranty: five years with transferable coverage.\n\nCoverage applies throughout Blackwater Bay.',
      pages: {
        count: 2,
        sections: [
          { page: 1, text: 'Warranty: five years with transferable coverage.' },
          { page: 2, text: 'Coverage applies throughout Blackwater Bay.' },
        ],
      },
      ocr: false,
      confidence: null,
      provenance: { backend: 'linux-native', tool: 'pdftotext' },
      text_from: 'text-layer',
      degradation: null,
    });
    expect(commands.run).toHaveBeenCalledWith('pdftotext', ['-layout', '/invented/warranty.pdf', '-']);
  });

  it('OCRs sparse pages in a mixed PDF without replacing usable text-layer pages', async () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t96\tCoverage',
      '5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t94\tBlackwater Bay',
    ].join('\n');
    const commands = runner({
      'pdfinfo /invented/warranty.pdf': 'Pages: 2\n',
      'pdftotext -layout /invented/warranty.pdf -': 'Warranty: five years with transferable coverage.\f2\f',
      'pdftoppm -f 2 -l 2 -singlefile -png -r 300 /invented/warranty.pdf /tmp/akno-invented/page-2': '',
      'tesseract /tmp/akno-invented/page-2.png stdout tsv': tsv,
    });

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result).toEqual({
      text: 'Warranty: five years with transferable coverage.\n\nCoverage Blackwater Bay',
      pages: {
        count: 2,
        sections: [
          { page: 1, text: 'Warranty: five years with transferable coverage.' },
          { page: 2, text: 'Coverage Blackwater Bay' },
        ],
      },
      ocr: true,
      confidence: 0.95,
      provenance: { backend: 'linux-native', tool: 'tesseract' },
      text_from: 'ocr',
      degradation: null,
    });
    expect(commands.run).not.toHaveBeenCalledWith('pdftoppm', expect.arrayContaining(['-f', '1']));
  });

  it.each(['.doc', '.docx', '.odt', '.rtf'])(
    'converts %s office documents with LibreOffice',
    async (extension) => {
      const commands = runner({
        [`libreoffice -env:UserInstallation=file:///tmp/akno-invented/profile --headless --convert-to txt:Text --outdir /tmp/akno-invented /invented/warranty${extension}`]:
          'convert complete',
      });
      commands.readText = vi.fn(async () => 'Warranty: five years\n');

      const result = await createLinuxDocumentExtractor(commands).extract({
        ...REQUEST,
        absPath: `/invented/warranty${extension}`,
      });

      expect(result).toEqual({
        text: 'Warranty: five years',
        pages: null,
        ocr: false,
        confidence: null,
        provenance: { backend: 'linux-native', tool: 'libreoffice' },
        text_from: 'libreoffice',
        degradation: null,
      });
      expect(toLegacyExtraction(result).via).toBe('libreoffice');
      expect(commands.readText).toHaveBeenCalledWith('/tmp/akno-invented/warranty.txt');
      expect(commands.removeTempDir).toHaveBeenCalledWith('/tmp/akno-invented');
    },
  );

  it('reports missing LibreOffice without creating a conversion directory', async () => {
    const commands = runner({});
    commands.available = vi.fn(async (command) => command !== 'libreoffice');

    const result = await createLinuxDocumentExtractor(commands).extract({
      ...REQUEST,
      absPath: '/invented/warranty.docx',
    });

    expect(result.degradation).toEqual({
      kind: 'missing-dependency',
      message: 'Office extraction requires libreoffice: libreoffice',
      tools: ['libreoffice'],
    });
    expect(commands.makeTempDir).not.toHaveBeenCalled();
  });

  it('cleans conversion files and returns degradation when LibreOffice fails', async () => {
    const commands = runner({});
    commands.run = vi.fn(async () => {
      throw new Error('conversion rejected');
    });

    const result = await createLinuxDocumentExtractor(commands).extract({
      ...REQUEST,
      absPath: '/invented/warranty.docx',
    });

    expect(result.degradation).toEqual({
      kind: 'extraction-failed',
      message: 'libreoffice could not read the file: conversion rejected',
    });
    expect(result.provenance).toEqual({ backend: 'linux-native', tool: 'libreoffice' });
    expect(commands.removeTempDir).toHaveBeenCalledWith('/tmp/akno-invented');
  });

  it('returns typed degradation when Poppler cannot inspect a PDF', async () => {
    const commands = runner({});
    commands.run = vi.fn(async (command) => {
      if (command === 'pdfinfo') throw new Error('invalid PDF');
      return { stdout: '' };
    });

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result.degradation).toEqual({
      kind: 'extraction-failed',
      message: 'pdfinfo could not inspect the PDF: invalid PDF',
    });
    expect(result.provenance).toEqual({ backend: 'linux-native', tool: 'pdfinfo' });
  });

  it('reports missing Poppler dependencies without attempting extraction', async () => {
    const commands = runner({});
    commands.available = vi.fn(async (command) => command === 'tesseract');

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result).toEqual({
      text: '',
      pages: null,
      ocr: false,
      confidence: null,
      provenance: { backend: 'linux-native', tool: null },
      text_from: 'none',
      degradation: {
        kind: 'missing-dependency',
        message: 'PDF extraction requires Poppler tools: pdfinfo, pdftotext',
        tools: ['pdfinfo', 'pdftotext'],
      },
    });
    expect(commands.run).not.toHaveBeenCalled();
  });

  it('reports missing Tesseract for images without running a command', async () => {
    const commands = runner({});
    commands.available = vi.fn(async () => false);

    const result = await createLinuxDocumentExtractor(commands).extract({
      ...REQUEST,
      absPath: '/invented/label.png',
    });

    expect(result.degradation).toEqual({
      kind: 'missing-dependency',
      message: 'Image OCR requires tesseract: tesseract',
      tools: ['tesseract'],
    });
    expect(commands.run).not.toHaveBeenCalled();
  });

  it('OCRs an image directly with Tesseract', async () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t96\tZephyr',
      '5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t94\tQX-100',
    ].join('\n');
    const commands = runner({ 'tesseract /invented/label.png stdout tsv': tsv });

    const result = await createLinuxDocumentExtractor(commands).extract({
      ...REQUEST,
      absPath: '/invented/label.png',
    });

    expect(result).toEqual({
      text: 'Zephyr QX-100',
      pages: { count: 1, sections: [{ page: 1, text: 'Zephyr QX-100' }] },
      ocr: true,
      confidence: 0.95,
      provenance: { backend: 'linux-native', tool: 'tesseract' },
      text_from: 'ocr',
      degradation: null,
    });
  });

  it('returns typed degradation instead of throwing when Tesseract fails', async () => {
    const commands = runner({});
    commands.run = vi.fn(async () => {
      throw new Error('tesseract exited 1');
    });

    const result = await createLinuxDocumentExtractor(commands).extract({
      ...REQUEST,
      absPath: '/invented/label.png',
    });

    expect(result.degradation).toEqual({
      kind: 'extraction-failed',
      message: 'tesseract could not OCR the image: tesseract exited 1',
    });
    expect(result.provenance).toEqual({ backend: 'linux-native', tool: 'tesseract' });
  });

  it('reports missing OCR dependencies after detecting a scanned PDF', async () => {
    const commands = runner({
      'pdfinfo /invented/warranty.pdf': 'Pages: 2\n',
      'pdftotext -layout /invented/warranty.pdf -': '\f\f',
    });
    commands.available = vi.fn(async (command) => command !== 'tesseract');

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result.degradation).toEqual({
      kind: 'missing-dependency',
      message: 'Scanned PDF OCR requires pdftoppm and tesseract: tesseract',
      tools: ['tesseract'],
    });
    expect(commands.makeTempDir).not.toHaveBeenCalled();
  });

  it.each(['pdftoppm', 'tesseract'])(
    'preserves mixed-PDF text-layer pages when %s is unavailable for sparse-page OCR',
    async (missingTool) => {
      const commands = runner({
        'pdfinfo /invented/warranty.pdf': 'Pages: 2\n',
        'pdftotext -layout /invented/warranty.pdf -': 'Warranty: five years with transferable coverage.\f2\f',
      });
      commands.available = vi.fn(async (command) => command !== missingTool);

      const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

      expect(result).toEqual({
        text: 'Warranty: five years with transferable coverage.',
        pages: {
          count: 2,
          sections: [{ page: 1, text: 'Warranty: five years with transferable coverage.' }],
        },
        ocr: false,
        confidence: null,
        provenance: { backend: 'linux-native', tool: 'pdftotext' },
        text_from: 'text-layer',
        degradation: {
          kind: 'missing-dependency',
          message: `Scanned PDF OCR requires pdftoppm and tesseract: ${missingTool}`,
          tools: [missingTool],
        },
      });
      expect(commands.makeTempDir).not.toHaveBeenCalled();
    },
  );

  it('cleans raster files and returns degradation when scanned PDF OCR fails', async () => {
    const commands = runner({
      'pdfinfo /invented/warranty.pdf': 'Pages: 1\n',
      'pdftotext -layout /invented/warranty.pdf -': '\f',
      'pdftoppm -f 1 -l 1 -singlefile -png -r 300 /invented/warranty.pdf /tmp/akno-invented/page-1': '',
    });
    const run = commands.run;
    commands.run = vi.fn(async (command, args) => {
      if (command === 'tesseract') throw new Error('language data missing');
      return run(command, args);
    });

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result.degradation).toEqual({
      kind: 'extraction-failed',
      message: 'scanned PDF OCR failed: language data missing',
    });
    expect(result.provenance).toEqual({ backend: 'linux-native', tool: 'tesseract' });
    expect(commands.removeTempDir).toHaveBeenCalledWith('/tmp/akno-invented');
  });

  it('keeps earlier OCR text when a later PDF page fails', async () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t90\tWarranty',
      '5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t90\tfive years',
    ].join('\n');
    const commands = runner({
      'pdfinfo /invented/warranty.pdf': 'Pages: 2\n',
      'pdftotext -layout /invented/warranty.pdf -': '\f\f',
      'pdftoppm -f 1 -l 1 -singlefile -png -r 300 /invented/warranty.pdf /tmp/akno-invented/page-1': '',
      'tesseract /tmp/akno-invented/page-1.png stdout tsv': tsv,
      'pdftoppm -f 2 -l 2 -singlefile -png -r 300 /invented/warranty.pdf /tmp/akno-invented/page-2': '',
    });
    const run = commands.run;
    commands.run = vi.fn(async (command, args) => {
      if (command === 'tesseract' && args[0]?.endsWith('page-2.png')) {
        throw new Error('page image rejected');
      }
      return run(command, args);
    });

    const result = await createLinuxDocumentExtractor(commands).extract(REQUEST);

    expect(result).toEqual({
      text: 'Warranty five years',
      pages: { count: 2, sections: [{ page: 1, text: 'Warranty five years' }] },
      ocr: true,
      confidence: 0.9,
      provenance: { backend: 'linux-native', tool: 'tesseract' },
      text_from: 'ocr',
      degradation: {
        kind: 'partial-extraction',
        message: 'scanned: OCR failed on page 2 after reading 1 of 2 pages: page image rejected',
        pages_read: 1,
        pages_total: 2,
      },
    });
    expect(commands.removeTempDir).toHaveBeenCalledWith('/tmp/akno-invented');
  });

  it('rasterizes and OCRs only the configured number of pages in a scanned PDF', async () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t90\tWarranty',
      '5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t80\tfive years',
    ].join('\n');
    const commands = runner({
      'pdfinfo /invented/warranty.pdf': 'Pages: 2\n',
      'pdftotext -layout /invented/warranty.pdf -': '\f\f',
      'pdftoppm -f 1 -l 1 -singlefile -png -r 300 /invented/warranty.pdf /tmp/akno-invented/page-1': '',
      'tesseract /tmp/akno-invented/page-1.png stdout tsv': tsv,
    });

    const result = await createLinuxDocumentExtractor(commands).extract({ ...REQUEST, maxOcrPages: 1 });

    expect(result).toEqual({
      text: 'Warranty five years',
      pages: { count: 2, sections: [{ page: 1, text: 'Warranty five years' }] },
      ocr: true,
      confidence: 0.85,
      provenance: { backend: 'linux-native', tool: 'tesseract' },
      text_from: 'ocr',
      degradation: {
        kind: 'partial-extraction',
        message: 'scanned: OCR read the first 1 of 2 pages',
        pages_read: 1,
        pages_total: 2,
      },
    });
    expect(commands.removeTempDir).toHaveBeenCalledWith('/tmp/akno-invented');
  });
});
