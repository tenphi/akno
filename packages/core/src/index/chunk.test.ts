import { describe, expect, it } from 'vitest';
import { parsePage } from '../kb/page.ts';
import { applyReferenceFence, chunkPage, embeddingText } from './chunk.ts';

const options = { targetChars: 300, maxChars: 600, overlapChars: 40 };

describe('chunkPage', () => {
  it('keeps a short page with no headings as one chunk', () => {
    const page = parsePage('a.md', 'Just a couple of sentences. Nothing structural here.\n');
    const chunks = chunkPage(page, options);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.headingPath).toBe('');
  });

  it('splits at ## and carries the enclosing heading path', () => {
    const page = parsePage(
      'car.md',
      [
        '# Car insurance 2026',
        '',
        'intro',
        '',
        '## Policy',
        '',
        'Premium: 47',
        '',
        '## Claims',
        '',
        'none',
        '',
      ].join('\n'),
    );
    const chunks = chunkPage(page, options);
    const paths = chunks.map((chunk) => chunk.headingPath);
    expect(paths).toContain('Car insurance 2026 › Policy');
    expect(paths).toContain('Car insurance 2026 › Claims');
  });

  it('records line ranges that point at the real lines', () => {
    const body = ['# Title', '', 'line three', '', '## Section', '', 'line seven', ''].join('\n');
    const page = parsePage('a.md', body);
    const chunks = chunkPage(page, options);
    const section = chunks.find((chunk) => chunk.headingPath.endsWith('Section'))!;
    // Line addressing is what every citation hangs off, so this must be exact.
    expect(body.split('\n')[section.lineStart - 1]).toBe('## Section');
    expect(section.lineEnd).toBeGreaterThanOrEqual(7);
  });

  it('splits an oversized section at paragraph boundaries with overlap', () => {
    const paragraph = 'Sentence about the lease and the landlord and the rent. '.repeat(6);
    const page = parsePage('big.md', ['## Big', '', paragraph, '', paragraph, '', paragraph, ''].join('\n'));
    const chunks = chunkPage(page, options);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(options.maxChars + 200);
  });

  it('never emits an empty chunk', () => {
    const page = parsePage('a.md', '\n\n\n## Empty\n\n\n## Also empty\n\n\n');
    for (const chunk of chunkPage(page, options)) expect(chunk.text.trim().length).toBeGreaterThan(0);
  });
});

describe('applyReferenceFence', () => {
  it('marks everything at or below the fence as reference', () => {
    const content = [
      '# Car insurance',
      '',
      'Vulpine Mutual, 33/month.',
      '',
      '<!-- reference -->',
      '',
      '## Policy schedule',
      '',
      'Nine pages of wording.',
      '',
    ].join('\n');
    const page = parsePage('car.md', content);
    const chunks = applyReferenceFence(chunkPage(page, options), page.referenceFenceLine);

    const above = chunks.filter((chunk) => chunk.lineStart < page.referenceFenceLine!);
    const below = chunks.filter((chunk) => chunk.lineStart >= page.referenceFenceLine!);

    expect(above.length).toBeGreaterThan(0);
    expect(below.length).toBeGreaterThan(0);
    // Above the fence: claims. Below: evidence. Only claims become facts.
    expect(above.every((chunk) => chunk.kind === 'full')).toBe(true);
    expect(below.every((chunk) => chunk.kind === 'reference')).toBe(true);
  });

  it('leaves a page with no fence entirely full', () => {
    const page = parsePage('a.md', '# A\n\nbody\n');
    const chunks = applyReferenceFence(chunkPage(page, options), null);
    expect(chunks.every((chunk) => chunk.kind === 'full')).toBe(true);
  });
});

describe('embeddingText', () => {
  it('prepends the heading path, so a bare value knows what it belongs to', () => {
    const text = embeddingText({
      ord: 0,
      kind: 'full',
      headingPath: 'Car insurance 2026 › Policy',
      text: 'Premium: 33/month',
      lineStart: 1,
      lineEnd: 1,
    });
    expect(text).toBe('Car insurance 2026 › Policy\n\nPremium: 33/month');
  });
});

/**
 * The second splitting step, which the first implementation skipped entirely — it went straight
 * from `##` sections to paragraph splitting. The cost was not size but
 * *breadcrumbs*: an oversized section became several anonymous slices of the same
 * heading, when the author had already said where the topics start.
 */
describe('chunkPage step 2 — splitting an oversized section at ###', () => {
  const body = (filler: string) =>
    [
      '# Car insurance 2026',
      '',
      '## Policy',
      '',
      'Intro that belongs to Policy itself.',
      '',
      '### Premium',
      '',
      filler,
      '',
      '### Excess',
      '',
      filler,
      '',
      '### Second driver',
      '',
      filler,
      '',
    ].join('\n');

  const capped = { targetChars: 300, maxChars: 500, overlapChars: 40 };
  const filler = 'Something specific about this subsection of the policy. '.repeat(5);
  const chunks = chunkPage(parsePage('car.md', body(filler)), capped);

  it('produces a chunk per subsection with its own breadcrumb', () => {
    const paths = chunks.map((chunk) => chunk.headingPath);
    expect(paths).toContain('Car insurance 2026 › Policy › Premium');
    expect(paths).toContain('Car insurance 2026 › Policy › Excess');
    expect(paths).toContain('Car insurance 2026 › Policy › Second driver');
  });

  it('keeps the section introduction with the parent, not the next subsection', () => {
    const intro = chunks.find((chunk) => chunk.text.includes('Intro that belongs'));
    expect(intro?.headingPath).toBe('Car insurance 2026 › Policy');
  });

  it('addresses every chunk at the line it actually occupies', () => {
    const lines = body(filler).split('\n');
    for (const chunk of chunks) {
      expect(lines[chunk.lineStart - 1]).toBe(chunk.text.split('\n')[0]);
    }
  });

  it('still falls back to paragraphs when a subsection alone busts the cap', () => {
    const huge = 'A very long sentence that keeps going and going and going. '.repeat(30);
    const result = chunkPage(parsePage('car.md', body(huge)), capped);
    expect(result.length).toBeGreaterThan(3);
    for (const chunk of result) expect(chunk.text.length).toBeLessThanOrEqual(capped.maxChars + 200);
  });

  it('leaves a section with no subheadings to paragraph splitting', () => {
    const flat = ['## Long', '', 'Paragraph one. '.repeat(40), '', 'Paragraph two. '.repeat(40), ''].join(
      '\n',
    );
    const result = chunkPage(parsePage('a.md', flat), capped);
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((chunk) => chunk.headingPath === 'Long')).toBe(true);
  });
});

describe('the hard cap is actually hard', () => {
  const hard = { targetChars: 300, maxChars: 500, overlapChars: 40 };

  it('splits a single line longer than the cap at sentence boundaries', () => {
    // No headings and no blank lines, so none of the spec's three steps applies.
    // Left unsplit this reaches the embedding endpoint over its context length and
    // is silently truncated.
    const oneLine = 'This sentence is about the lease and the landlord. '.repeat(30);
    const chunks = chunkPage(parsePage('a.md', oneLine), hard);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(hard.maxChars);
    // Cuts land after a sentence, not mid-word.
    for (const chunk of chunks.slice(0, -1)) expect(chunk.text.trimEnd().endsWith('.')).toBe(true);
  });

  it('falls back to a word boundary when there are no sentences', () => {
    const chunks = chunkPage(parsePage('a.md', 'word '.repeat(400)), hard);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(hard.maxChars);
      expect(chunk.text).not.toMatch(/\bwor$|^ord\b/);
    }
  });

  it('caps even a single unbroken token', () => {
    const chunks = chunkPage(parsePage('a.md', 'x'.repeat(2000)), hard);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(hard.maxChars);
    // Nothing is lost to the cut.
    expect(chunks.map((chunk) => chunk.text).join('').length).toBe(2000);
  });

  it('keeps every piece addressed to the line it came from', () => {
    const chunks = chunkPage(parsePage('a.md', 'Sentence here. '.repeat(60)), hard);
    for (const chunk of chunks) expect(chunk.lineStart).toBe(chunk.lineEnd);
  });
});
