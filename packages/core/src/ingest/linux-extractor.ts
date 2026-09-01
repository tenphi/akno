import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type {
  DocumentExtractionResult,
  DocumentExtractorBackend,
  ExtractionProvenance,
} from './extractor-contract.ts';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.gif', '.bmp']);
const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.odt', '.rtf']);
const MIN_USABLE_PDF_PAGE_CHARACTERS = 40;
const runFile = promisify(execFile);

type LinuxExecuteFile = (
  command: string,
  args: string[],
  options: { maxBuffer: number; timeout: number; killSignal: NodeJS.Signals },
) => Promise<{ stdout: string; stderr: string }>;

const executeFile: LinuxExecuteFile = async (command, args, options) => {
  const result = await runFile(command, args, options);
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
};

export interface LinuxCommandRunner {
  available(command: string): Promise<boolean>;
  makeTempDir(): Promise<string>;
  readText(file: string): Promise<string>;
  removeTempDir(directory: string): Promise<void>;
  run(command: string, args: string[]): Promise<{ stdout: string }>;
}

export function createNodeLinuxCommandRunner(execute: LinuxExecuteFile = executeFile): LinuxCommandRunner {
  return {
    available: commandAvailable,
    makeTempDir: async () => fsp.mkdtemp(path.join(os.tmpdir(), 'akno-extract-')),
    readText: async (file) => fsp.readFile(file, 'utf8'),
    removeTempDir: async (directory) => fsp.rm(directory, { force: true, recursive: true }),
    run: async (command, args) => {
      const { stdout } = await execute(command, args, {
        maxBuffer: 10 * 1_048_576,
        timeout: 300_000,
        killSignal: 'SIGKILL',
      });
      return { stdout };
    },
  };
}

async function commandAvailable(command: string): Promise<boolean> {
  if (path.isAbsolute(command)) return executable(command);
  const directories = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const matches = await Promise.all(
    directories.map((directory) => executable(path.join(directory, command))),
  );
  return matches.some(Boolean);
}

async function executable(candidate: string): Promise<boolean> {
  return fsp
    .access(candidate, fs.constants.X_OK)
    .then(() => true)
    .catch(() => false);
}

export interface LinuxExtractionCapabilities {
  backend: 'linux-native';
  libreoffice: boolean;
  pdfinfo: boolean;
  pdftotext: boolean;
  pdftoppm: boolean;
  tesseract: boolean;
  note: string | null;
}

export async function linuxExtractionCapabilities(
  commands: LinuxCommandRunner,
): Promise<LinuxExtractionCapabilities> {
  const names = ['libreoffice', 'pdfinfo', 'pdftotext', 'pdftoppm', 'tesseract'] as const;
  const available = await Promise.all(names.map((name) => commands.available(name)));
  const tools = Object.fromEntries(names.map((name, index) => [name, available[index]])) as Record<
    (typeof names)[number],
    boolean
  >;
  const popplerNames = ['pdfinfo', 'pdftotext', 'pdftoppm'] as const;
  const missingPoppler = popplerNames.filter((name) => !tools[name]);
  let note: string | null = null;
  if (missingPoppler.length > 0) {
    note = `PDF extraction is unavailable: install Poppler (${missingPoppler.join(', ')} missing).`;
  } else if (!tools.tesseract) {
    note = 'OCR is unavailable: install tesseract. PDF text-layer extraction remains available.';
  }
  return { backend: 'linux-native', ...tools, note };
}

export function createLinuxDocumentExtractor(commands: LinuxCommandRunner): DocumentExtractorBackend {
  return {
    name: 'linux-native',
    extract: async (request) => {
      const extension = path.extname(request.absPath).toLowerCase();
      if (extension === '.pdf') return extractPdf(request.absPath, request.maxOcrPages, commands);
      if (IMAGE_EXTENSIONS.has(extension)) return ocrImage(request.absPath, commands);
      if (OFFICE_EXTENSIONS.has(extension)) return extractOffice(request.absPath, commands);
      return failed(`no Linux extractor for ${extension || 'a file with no extension'}`, {
        backend: 'linux-native',
        tool: null,
      });
    },
  };
}

async function extractOffice(
  absPath: string,
  commands: LinuxCommandRunner,
): Promise<DocumentExtractionResult> {
  const missing = await missingCommands(['libreoffice'], commands);
  if (missing.length > 0) return missingDependency('Office extraction requires libreoffice', missing);

  const directory = await commands.makeTempDir();
  try {
    await commands.run('libreoffice', [
      `-env:UserInstallation=${pathToFileURL(path.join(directory, 'profile')).href}`,
      '--headless',
      '--convert-to',
      'txt:Text',
      '--outdir',
      directory,
      absPath,
    ]);
    const output = path.join(directory, `${path.parse(absPath).name}.txt`);
    const text = (await commands.readText(output)).trim();
    return text
      ? {
          text,
          pages: null,
          ocr: false,
          confidence: null,
          provenance: { backend: 'linux-native', tool: 'libreoffice' },
          text_from: 'libreoffice',
          degradation: null,
        }
      : failed('libreoffice found no text', { backend: 'linux-native', tool: 'libreoffice' });
  } catch (error) {
    return failed(`libreoffice could not read the file: ${errorMessage(error)}`, {
      backend: 'linux-native',
      tool: 'libreoffice',
    });
  } finally {
    await commands.removeTempDir(directory);
  }
}

async function extractPdf(
  absPath: string,
  maxOcrPages: number,
  commands: LinuxCommandRunner,
): Promise<DocumentExtractionResult> {
  const missing = await missingCommands(['pdfinfo', 'pdftotext'], commands);
  if (missing.length > 0) return missingDependency('PDF extraction requires Poppler tools', missing);

  let info: string;
  try {
    ({ stdout: info } = await commands.run('pdfinfo', [absPath]));
  } catch (error) {
    return failed(`pdfinfo could not inspect the PDF: ${errorMessage(error)}`, {
      backend: 'linux-native',
      tool: 'pdfinfo',
    });
  }

  const count = Number(/^Pages:\s+(\d+)\s*$/m.exec(info)?.[1] ?? 0);
  if (count < 1) {
    return failed('pdfinfo did not report a positive page count', {
      backend: 'linux-native',
      tool: 'pdfinfo',
    });
  }

  let stdout: string;
  try {
    ({ stdout } = await commands.run('pdftotext', ['-layout', absPath, '-']));
  } catch (error) {
    return failed(`pdftotext could not read the PDF: ${errorMessage(error)}`, {
      backend: 'linux-native',
      tool: 'pdftotext',
    });
  }
  const pageText = stdout.split('\f');
  // Match the macOS extractor's 40-character scan guard per page. A page number or
  // typed cover sheet must not hide scanned pages elsewhere in the same document.
  const allSections = Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    text: (pageText[index] ?? '').trim(),
  }));
  const sections = allSections.filter((section) => section.text.length >= MIN_USABLE_PDF_PAGE_CHARACTERS);
  const pagesNeedingOcr = allSections
    .filter((section) => section.text.length < MIN_USABLE_PDF_PAGE_CHARACTERS)
    .map((section) => section.page);

  if (pagesNeedingOcr.length > 0) {
    return ocrPdf(absPath, count, pagesNeedingOcr, sections, maxOcrPages, commands);
  }

  const text = sections.map((section) => section.text).join('\n\n');

  return {
    text,
    pages: { count, sections },
    ocr: false,
    confidence: null,
    provenance: { backend: 'linux-native', tool: 'pdftotext' },
    text_from: 'text-layer',
    degradation: null,
  };
}

async function ocrImage(absPath: string, commands: LinuxCommandRunner): Promise<DocumentExtractionResult> {
  const missing = await missingCommands(['tesseract'], commands);
  if (missing.length > 0) return missingDependency('Image OCR requires tesseract', missing);

  try {
    const { stdout } = await commands.run('tesseract', [absPath, 'stdout', 'tsv']);
    const recognized = parseTesseractTsv(stdout);
    return {
      text: recognized.text,
      pages: {
        count: 1,
        sections: recognized.text ? [{ page: 1, text: recognized.text }] : [],
      },
      ocr: true,
      confidence: meanConfidence(recognized.confidences),
      provenance: { backend: 'linux-native', tool: 'tesseract' },
      text_from: 'ocr',
      degradation: null,
    };
  } catch (error) {
    return failed(`tesseract could not OCR the image: ${errorMessage(error)}`, {
      backend: 'linux-native',
      tool: 'tesseract',
    });
  }
}

async function ocrPdf(
  absPath: string,
  pageCount: number,
  pagesNeedingOcr: number[],
  textLayerSections: { page: number; text: string }[],
  maxOcrPages: number,
  commands: LinuxCommandRunner,
): Promise<DocumentExtractionResult> {
  const missing = await missingCommands(['pdftoppm', 'tesseract'], commands);
  if (missing.length > 0) {
    const result = missingDependency('Scanned PDF OCR requires pdftoppm and tesseract', missing);
    if (textLayerSections.length === 0) return result;
    return {
      ...result,
      text: textLayerSections.map((section) => section.text).join('\n\n'),
      pages: { count: pageCount, sections: textLayerSections },
      provenance: { backend: 'linux-native', tool: 'pdftotext' },
      text_from: 'text-layer',
    };
  }

  const directory = await commands.makeTempDir();
  const pagesToRead = pagesNeedingOcr.slice(0, Math.max(0, maxOcrPages));
  const sections = [...textLayerSections];
  const confidences: number[] = [];
  let ocrPagesRead = 0;
  let tool: 'pdftoppm' | 'tesseract' = 'pdftoppm';
  try {
    for (const page of pagesToRead) {
      const prefix = path.join(directory, `page-${page}`);
      tool = 'pdftoppm';
      await commands.run('pdftoppm', [
        '-f',
        String(page),
        '-l',
        String(page),
        '-singlefile',
        '-png',
        '-r',
        '300',
        absPath,
        prefix,
      ]);
      tool = 'tesseract';
      const { stdout } = await commands.run('tesseract', [`${prefix}.png`, 'stdout', 'tsv']);
      const recognized = parseTesseractTsv(stdout);
      if (recognized.text) sections.push({ page, text: recognized.text });
      confidences.push(...recognized.confidences);
      ocrPagesRead += 1;
    }
  } catch (error) {
    if (sections.length > 0) {
      const ordered = sections.sort((left, right) => left.page - right.page);
      return {
        text: ordered.map((section) => section.text).join('\n\n'),
        pages: { count: pageCount, sections: ordered },
        ocr: ocrPagesRead > 0,
        confidence: meanConfidence(confidences),
        provenance: { backend: 'linux-native', tool },
        text_from: ocrPagesRead > 0 ? 'ocr' : 'text-layer',
        degradation: {
          kind: 'partial-extraction',
          message: `scanned: OCR failed on page ${pagesToRead[ocrPagesRead]} after reading ${sections.length} of ${pageCount} pages: ${errorMessage(error)}`,
          pages_read: sections.length,
          pages_total: pageCount,
        },
      };
    }
    return failed(`scanned PDF OCR failed: ${errorMessage(error)}`, {
      backend: 'linux-native',
      tool,
    });
  } finally {
    await commands.removeTempDir(directory);
  }

  const ordered = sections.sort((left, right) => left.page - right.page);
  const text = ordered.map((section) => section.text).join('\n\n');
  return {
    text,
    pages: { count: pageCount, sections: ordered },
    ocr: true,
    confidence: meanConfidence(confidences),
    provenance: { backend: 'linux-native', tool: 'tesseract' },
    text_from: 'ocr',
    degradation:
      pagesToRead.length < pagesNeedingOcr.length
        ? {
            kind: 'partial-extraction',
            message: `scanned: OCR read the first ${sections.length} of ${pageCount} pages`,
            pages_read: sections.length,
            pages_total: pageCount,
          }
        : null,
  };
}

function parseTesseractTsv(tsv: string): { text: string; confidences: number[] } {
  const lines = new Map<string, string[]>();
  const confidences: number[] = [];
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const fields = row.split('\t');
    if (fields[0] !== '5') continue;
    const text = fields.slice(11).join('\t').trim();
    if (!text) continue;
    const line = fields.slice(1, 5).join(':');
    const words = lines.get(line) ?? [];
    words.push(text);
    lines.set(line, words);
    const confidence = Number(fields[10]);
    if (Number.isFinite(confidence) && confidence >= 0) confidences.push(confidence);
  }
  return { text: [...lines.values()].map((words) => words.join(' ')).join('\n'), confidences };
}

function meanConfidence(confidences: number[]): number | null {
  return confidences.length > 0
    ? confidences.reduce((total, confidence) => total + confidence, 0) / confidences.length / 100
    : null;
}

async function missingCommands(commandsToCheck: string[], commands: LinuxCommandRunner): Promise<string[]> {
  const available = await Promise.all(commandsToCheck.map((command) => commands.available(command)));
  return commandsToCheck.filter((_, index) => !available[index]);
}

function missingDependency(message: string, tools: string[]): DocumentExtractionResult {
  return {
    text: '',
    pages: null,
    ocr: false,
    confidence: null,
    provenance: { backend: 'linux-native', tool: null },
    text_from: 'none',
    degradation: { kind: 'missing-dependency', message: `${message}: ${tools.join(', ')}`, tools },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failed(message: string, provenance: ExtractionProvenance): DocumentExtractionResult {
  return {
    text: '',
    pages: null,
    ocr: false,
    confidence: null,
    provenance,
    text_from: 'none',
    degradation: { kind: 'extraction-failed', message },
  };
}
