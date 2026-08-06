import { describe, expect, it } from 'vitest';
import { closeTruncatedJson, parseJsonLoose } from './client.js';

describe('parseJsonLoose', () => {
  it('parses clean JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON from a fenced block', () => {
    expect(parseJsonLoose('Here you go:\n```json\n{"a":1}\n```\nHope that helps!')).toEqual({ a: 1 });
  });

  it('extracts JSON wrapped in prose', () => {
    expect(parseJsonLoose('Sure. {"summary":"x"} Let me know.')).toEqual({ summary: 'x' });
  });

  it('returns null for something that is not JSON at all', () => {
    expect(parseJsonLoose('I cannot help with that.')).toBeNull();
  });

  /**
   * The failure this recovers: a small model given a long page hits its token
   * ceiling mid-array. Everything before the cut is valid, so a page went from
   * "no summary and no facts" to "summary and most of its facts".
   */
  it('recovers a body truncated mid-array', () => {
    const truncated =
      '{"summary":"A lease page.","keywords":["lease","rent"],"facts":[' +
      '{"line":7,"claim":"The rent is 1111 EUR."},' +
      '{"line":8,"claim":"The lease renews on 2027-06-02."},' +
      '{"line":9,"claim":"The landl';
    const parsed = parseJsonLoose<{ summary: string; facts: { line: number; claim?: string }[] }>(
      truncated,
    );
    expect(parsed?.summary).toBe('A lease page.');
    // Both complete facts survive with their line numbers intact.
    expect(parsed?.facts[0]).toEqual({ line: 7, claim: 'The rent is 1111 EUR.' });
    expect(parsed?.facts[1]).toEqual({ line: 8, claim: 'The lease renews on 2027-06-02.' });
    // The element the cut landed inside keeps whatever was complete and loses the
    // rest. `cleanFacts` then drops it for having no claim, so a half-read fact
    // never reaches the index — recovery does not have to be lossless to be safe.
    expect(parsed?.facts.at(-1)?.claim).toBeUndefined();
  });

  it('recovers a body truncated mid-string', () => {
    const parsed = parseJsonLoose<{ summary: string; keywords: string[] }>(
      '{"summary":"complete","keywords":["a","b"],"note":"cut off here',
    );
    expect(parsed?.summary).toBe('complete');
    expect(parsed?.keywords).toEqual(['a', 'b']);
  });
});

describe('closeTruncatedJson', () => {
  it('closes an open array and object', () => {
    expect(closeTruncatedJson('{"a":[1,2')).toBe('{"a":[1,2]}');
  });

  it('drops a trailing comma before closing', () => {
    expect(closeTruncatedJson('{"a":[1,2,')).toBe('{"a":[1,2]}');
  });

  it('leaves complete JSON alone — it has no business rewriting it', () => {
    expect(closeTruncatedJson('{"a":1}')).toBeNull();
  });

  it('refuses genuinely mismatched brackets rather than guessing', () => {
    // A malformed body must stay reported as malformed, not become half an object.
    expect(closeTruncatedJson('{"a":[1,2}]')).toBeNull();
  });

  it('returns null when there is no complete element to keep', () => {
    expect(closeTruncatedJson('{"a')).toBeNull();
    expect(closeTruncatedJson('not json')).toBeNull();
  });

  it('is not confused by brackets inside strings', () => {
    const repaired = closeTruncatedJson('{"a":"}]{[","b":[1');
    expect(repaired).toBe('{"a":"}]{[","b":[1]}');
    expect(JSON.parse(repaired!)).toEqual({ a: '}]{[', b: [1] });
  });

  it('is not confused by an escaped quote', () => {
    const repaired = closeTruncatedJson('{"a":"say \\"hi\\"","b":[2');
    expect(JSON.parse(repaired!)).toEqual({ a: 'say "hi"', b: [2] });
  });
});
