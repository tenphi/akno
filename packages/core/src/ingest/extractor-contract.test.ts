import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import {
  selectDocumentExtractorBackend,
  type DocumentExtractionResult,
  type DocumentExtractorBackend,
} from './extractor-contract.ts';
import { extract, toLegacyExtraction } from './extract.ts';

const MACOS_RESULT: DocumentExtractionResult = {
  text: 'Warranty: five years',
  pages: { count: 1, sections: [{ page: 1, text: 'Warranty: five years' }] },
  ocr: true,
  confidence: 0.91,
  provenance: { backend: 'macos-native', tool: 'vision' },
  text_from: 'ocr',
  degradation: null,
};

const macos: DocumentExtractorBackend = {
  name: 'macos-native',
  extract: async () => MACOS_RESULT,
};

const linux: DocumentExtractorBackend = {
  name: 'linux-native',
  extract: async () => ({
    ...MACOS_RESULT,
    provenance: { backend: 'linux-native', tool: 'tesseract' },
  }),
};

const LIBREOFFICE_RESULT: DocumentExtractionResult = {
  text: 'Warranty: five years',
  pages: null,
  ocr: false,
  confidence: null,
  provenance: { backend: 'linux-native', tool: 'libreoffice' },
  text_from: 'libreoffice',
  degradation: null,
};

describe('document extractor contract', () => {
  it('keeps text, pages, OCR confidence, provenance, and text origin explicit', async () => {
    const result = await selectDocumentExtractorBackend('darwin', { linux, macos }).extract({
      absPath: '/invented/warranty.png',
      maxBytes: 1024,
      maxOcrPages: 4,
    });

    expect(result).toEqual(MACOS_RESULT);
  });

  it('returns typed degradation when the platform backend is unsupported', async () => {
    const backend = selectDocumentExtractorBackend('win32', { linux, macos });
    const result = await backend.extract({
      absPath: '/invented/warranty.pdf',
      maxBytes: 1024,
      maxOcrPages: 4,
    });

    expect(backend.name).toBe('unsupported');
    expect(result).toEqual({
      text: '',
      pages: null,
      ocr: false,
      confidence: null,
      provenance: { backend: 'unsupported', tool: null },
      text_from: 'none',
      degradation: {
        kind: 'unsupported-platform',
        message: 'document extraction is not supported on win32',
        platform: 'win32',
      },
    });
  });

  it('selects the Linux backend on Linux', () => {
    expect(selectDocumentExtractorBackend('linux', { linux, macos })).toBe(linux);
  });

  it('projects the contract onto the existing extraction shape without changing its fields', () => {
    expect(toLegacyExtraction(MACOS_RESULT)).toEqual({
      text: 'Warranty: five years',
      pageCount: 1,
      ocr: true,
      confidence: 0.91,
      via: 'ocr',
      note: null,
      sections: [{ page: 1, text: 'Warranty: five years' }],
    });
  });

  it('preserves truthful LibreOffice provenance through the legacy extraction shape', () => {
    expect(toLegacyExtraction(LIBREOFFICE_RESULT)).toEqual({
      text: 'Warranty: five years',
      pageCount: null,
      ocr: false,
      confidence: null,
      via: 'libreoffice',
      note: null,
    });
  });

  it('does not retry a failed vision fallback after native image OCR finds no text', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-extractor-contract-'));
    const image = path.join(directory, 'blank.png');
    fs.writeFileSync(
      image,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    const chat = vi.fn(async () => ({
      ok: false,
      value: null,
      reason: 'request_failed' as const,
      error: 'invented endpoint failure',
      latencyMs: 1,
    }));

    try {
      const result = await extract({
        absPath: image,
        maxBytes: 1024,
        maxOcrPages: 1,
        vision: { available: true, chat } as unknown as ModelClient,
      });

      expect(result.text).toBe('');
      expect(chat).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
