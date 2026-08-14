import { describe, expect, it } from 'vitest';
import { looksLikeRendition, renditionBody, renditionWanted, type RenditionSource } from './rendition.ts';

/**
 * The gate decides what gets written into somebody's folder, so its reasons are the
 * specification. Two of them — a photograph a model described, and a file that is already
 * text — are awkward to reach end to end and are exactly the ones worth pinning.
 */
const SOURCE: RenditionSource = {
  relPath: 'household/lease.pdf',
  text: 'x'.repeat(4000),
  pageCount: 9,
  ocr: false,
  via: 'text-layer',
  confidence: null,
};

const OPEN = { minChars: 1000, ingestRule: undefined };

describe('renditionWanted', () => {
  it('writes the text of a document that was actually read', () => {
    expect(renditionWanted(SOURCE, OPEN).write).toBe(true);
    expect(renditionWanted({ ...SOURCE, via: 'ocr', ocr: true }, OPEN).write).toBe(true);
    expect(renditionWanted({ ...SOURCE, via: 'textutil' }, OPEN).write).toBe(true);
  });

  it('does not copy a file that is already text', () => {
    const result = renditionWanted({ ...SOURCE, relPath: 'a/notes.txt', via: 'plain' }, OPEN);
    expect(result.write).toBe(false);
    expect(result.reason).toMatch(/already text/);
  });

  it("does not write a model's description of a photo as the file's text", () => {
    // The distinction `provenanceLines` exists for. A model saying what it sees in a
    // photograph is not the file's words, and a `.txt` under the file's name claims it is.
    const result = renditionWanted({ ...SOURCE, relPath: 'a/garden.jpg', via: 'vision' }, OPEN);
    expect(result.write).toBe(false);
    expect(result.reason).toMatch(/description of an image/);
  });

  it('leaves a short document to the page beside it', () => {
    const result = renditionWanted({ ...SOURCE, text: 'Paid 4.20 EUR.' }, OPEN);
    expect(result.write).toBe(false);
    expect(result.reason).toMatch(/under ingest\.text_rendition_min_chars/);
  });

  it('honours a folder that asked for no files written into it', () => {
    for (const ingestRule of ['file', 'ignore'] as const) {
      const result = renditionWanted(SOURCE, { ...OPEN, ingestRule });
      expect(result.write).toBe(false);
      expect(result.reason).toContain(ingestRule);
    }
  });

  it('has nothing to write when nothing was read', () => {
    expect(renditionWanted({ ...SOURCE, text: '', via: 'none' }, OPEN).write).toBe(false);
  });
});

describe('renditionBody', () => {
  it('ends with the stored text, unmodified', () => {
    // The one property that matters: what `read({document})` returns and what a person opens
    // are the same characters. Two texts for one document is the failure being avoided.
    const body = renditionBody({ ...SOURCE, text: 'Clause seven.\n  Indented, and trailing spaces.  ' });
    expect(body.endsWith('Clause seven.\n  Indented, and trailing spaces.  \n')).toBe(true);
  });

  it('says where the words came from', () => {
    expect(renditionBody(SOURCE)).toContain("9 pages, read from the file's own text layer");
    expect(renditionBody({ ...SOURCE, via: 'ocr', ocr: true, confidence: 0.87 })).toContain(
      'recognised by OCR at 0.87 mean confidence, not typed',
    );
  });

  it('is recognisable as Akno’s afterwards', () => {
    // How a hand-edited rendition is told apart from one that may be overwritten.
    expect(looksLikeRendition(renditionBody(SOURCE))).toBe(true);
    expect(looksLikeRendition('Corrected by hand.\n')).toBe(false);
  });
});
