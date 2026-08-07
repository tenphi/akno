import { describe, expect, it } from 'vitest';
import { chunkDocument } from './chunk.ts';

const OPTIONS = { targetChars: 1200, maxChars: 4000 };

/**
 * A document is searchable by its own content, and a hit can name the page within the
 * document it came from. Both of those are properties of how the text is cut.
 */
describe('chunkDocument', () => {
  it('keeps a page per chunk so a quote can name its page', () => {
    const chunks = chunkDocument(
      {
        text: 'Page one text.\n\nPage two text.',
        sections: [
          { page: 1, text: 'Page one text.' },
          { page: 2, text: 'Page two text.' },
        ],
      },
      OPTIONS,
    );
    expect(chunks).toEqual([
      { ord: 0, text: 'Page one text.', docPage: 1 },
      { ord: 1, text: 'Page two text.', docPage: 2 },
    ]);
  });

  it('never straddles a page boundary', () => {
    // Two short pages would fit in one chunk by size. They must not share one: a chunk
    // spanning pages 4 and 5 cannot honestly be cited as being on either.
    const chunks = chunkDocument(
      {
        text: 'a b',
        sections: [
          { page: 4, text: 'Clause four.' },
          { page: 5, text: 'Clause five.' },
        ],
      },
      OPTIONS,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks.map((chunk) => chunk.docPage)).toEqual([4, 5]);
  });

  it('reports no page for a format that has none', () => {
    // A .txt file has no pages. `docPage: 1` would be a claim, not a fact.
    const chunks = chunkDocument({ text: 'A plain text file.' }, OPTIONS);
    expect(chunks).toEqual([{ ord: 0, text: 'A plain text file.', docPage: null }]);
  });

  it('splits a long page on paragraphs, staying under the cap', () => {
    const paragraph = `${'word '.repeat(200).trim()}.`;
    const text = Array.from({ length: 6 }, () => paragraph).join('\n\n');
    const chunks = chunkDocument({ text, sections: [{ page: 1, text }] }, OPTIONS);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(OPTIONS.maxChars);
      expect(chunk.docPage).toBe(1);
    }
    // Nothing is dropped: every word of the page is still somewhere.
    expect(chunks.reduce((total, chunk) => total + chunk.text.split(/\s+/).length, 0)).toBe(
      text.split(/\s+/).length,
    );
  });

  it('hard-cuts scanned text that has no punctuation to break on', () => {
    // OCR of a dense page can come back as one unbroken run. A chunk the embedder would
    // silently truncate is worse than a boundary mid-sentence.
    const text = 'x'.repeat(9000);
    const chunks = chunkDocument({ text, sections: [{ page: 1, text }] }, OPTIONS);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(OPTIONS.maxChars);
  });

  it('drops a blank page rather than indexing an empty chunk', () => {
    const chunks = chunkDocument(
      {
        text: 'Only page two has text.',
        sections: [
          { page: 1, text: '   ' },
          { page: 2, text: 'Text.' },
        ],
      },
      OPTIONS,
    );
    expect(chunks).toEqual([{ ord: 0, text: 'Text.', docPage: 2 }]);
  });
});
