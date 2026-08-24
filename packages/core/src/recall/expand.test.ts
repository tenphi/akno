import { describe, expect, it } from 'vitest';
import { extractConcepts, inferMode, splitMultiPart } from './expand.ts';

/**
 * Mode inference is a default, and getting it wrong costs relevance, never
 * correctness — but it should still be right on the shapes real queries take.
 */
describe('inferMode', () => {
  it('reads a keyword-ish query as lookup', () => {
    expect(inferMode('car insurance renewal')).toBe('lookup');
    expect(inferMode('ada marlow')).toBe('lookup');
    expect(inferMode('lease')).toBe('lookup');
  });

  it('reads a natural-language question as question', () => {
    expect(inferMode('when does the car insurance renew?')).toBe('question');
    expect(inferMode('who is the second driver')).toBe('question');
    expect(inferMode('how much is the rent?')).toBe('question');
  });

  it('reads a yes/no question with no question mark as question', () => {
    expect(inferMode('do we have a copy of the lease')).toBe('question');
    expect(inferMode('is the passport still valid')).toBe('question');
  });

  it('reads an explicit ask for breadth as explore', () => {
    expect(inferMode('anything about the car?')).toBe('explore');
    expect(inferMode('tell me about the apartment')).toBe('explore');
    expect(inferMode('what do we know about Ada')).toBe('explore');
  });

  it('does not mistake a two-word question word for a question', () => {
    // "how much" alone is not enough to justify hypothetical-answer expansion.
    expect(inferMode('how much')).toBe('lookup');
  });
});

describe('extractConcepts', () => {
  it('drops stopwords and keeps content words paired', () => {
    const concepts = extractConcepts('when does the car insurance renew?');
    expect(concepts.join(' ')).toContain('car');
    expect(concepts.join(' ')).toContain('insurance');
    expect(concepts.join(' ')).not.toContain('the');
  });

  it('returns one concept for a short query', () => {
    expect(extractConcepts('car insurance')).toEqual(['car insurance']);
  });

  it('does not require an answer to repeat the dimension word from how-long questions', () => {
    const concepts = extractConcepts('How long is the Zephyr QX-100 warranty?');

    expect(concepts.join(' ')).toContain('zephyr');
    expect(concepts.join(' ')).toContain('warranty');
    expect(concepts.join(' ')).not.toContain('long');
  });

  it('returns nothing for a query with no content words', () => {
    expect(extractConcepts('is it the?')).toEqual([]);
  });
});

describe('splitMultiPart', () => {
  it('splits a two-part question', () => {
    const parts = splitMultiPart('when does it renew and who is the second driver?');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('second driver');
  });

  it('leaves a single question alone', () => {
    expect(splitMultiPart('when does the car insurance renew?')).toHaveLength(1);
  });

  it('does not split when one side has no content word', () => {
    // "the lease and it" is one question with a conjunction, not two questions.
    expect(splitMultiPart('the lease and it')).toHaveLength(1);
  });
});
