import { describe, expect, it } from 'vitest';
import { parsePage } from '../kb/page.js';
import { applyReferenceFence, chunkPage, embeddingText } from './chunk.js';

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
      ['# Car insurance 2026', '', 'intro', '', '## Policy', '', 'Premium: 47', '', '## Claims', '', 'none', ''].join('\n'),
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
    // Above the fence: claims. Below: evidence. Only claims become facts (§5).
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
