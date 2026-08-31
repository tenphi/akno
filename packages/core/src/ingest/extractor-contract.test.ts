import { describe, expect, it } from 'vitest';
import {
  selectDocumentExtractorBackend,
  type DocumentExtractionResult,
  type DocumentExtractorBackend,
} from './extractor-contract.ts';
import { toLegacyExtraction } from './extract.ts';

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

describe('document extractor contract', () => {
  it('keeps text, pages, OCR confidence, provenance, and text origin explicit', async () => {
    const result = await selectDocumentExtractorBackend('darwin', { macos }).extract({
      absPath: '/invented/warranty.png',
      maxBytes: 1024,
      maxOcrPages: 4,
    });

    expect(result).toEqual(MACOS_RESULT);
  });

  it('returns typed degradation when the platform backend is unsupported', async () => {
    const backend = selectDocumentExtractorBackend('linux', { macos });
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
        message: 'document extraction is not supported on linux',
        platform: 'linux',
      },
    });
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
});
