import { describe, expect, it } from 'vitest';
import { applyEdit, applyUnifiedDiff } from './edit.ts';

const PAGE = [
  '---',
  'title: Lease',
  "date: '2026-05-26T00:00:00.000Z'",
  '---',
  '',
  '# Lease',
  '',
  '- Rent: 1111 EUR',
  '- Term: 12 months',
  '',
].join('\n');

describe('applyEdit', () => {
  it('never touches the frontmatter', () => {
    // Every key except `id` is preserved byte for byte. A body edit that
    // reflowed a quoted timestamp would break that quietly.
    for (const edit of [
      { kind: 'content', content: 'new body' },
      { kind: 'append', text: '- Extra: 1' },
      { kind: 'replace', find: '1111', with: '2222' },
    ] as const) {
      const result = applyEdit(PAGE, edit);
      expect(result.content.startsWith("---\ntitle: Lease\ndate: '2026-05-26T00:00:00.000Z'\n---\n")).toBe(
        true,
      );
    }
  });

  it('appends with a blank line, so two list items do not merge', () => {
    const result = applyEdit(PAGE, { kind: 'append', text: '- Deposit: 2222 EUR' });
    expect(result.content).toContain('- Term: 12 months\n\n- Deposit: 2222 EUR\n');
  });

  it('reports the first changed line', () => {
    const result = applyEdit(PAGE, { kind: 'replace', find: '1111', with: '2222' });
    expect(result.firstChangedLine).toBe(8);
    expect(PAGE.split('\n')[7]).toBe('- Rent: 1111 EUR');
  });

  it('refuses a replace that matches nothing', () => {
    expect(() => applyEdit(PAGE, { kind: 'replace', find: 'nowhere', with: 'x' })).toThrow(
      /does not contain/,
    );
  });

  it('refuses an ambiguous replace rather than guessing which one', () => {
    // Editing the first of several is a coin flip about which line was meant, and
    // the wrong guess edits a line nobody was looking at.
    const page = `${PAGE}- Rent: 1111 EUR\n`;
    expect(() => applyEdit(page, { kind: 'replace', find: '- Rent: 1111 EUR', with: 'x' })).toThrow(
      /appears 2 times/,
    );
  });

  it('always leaves a trailing newline', () => {
    expect(applyEdit(PAGE, { kind: 'content', content: 'no newline' }).content.endsWith('\n')).toBe(true);
  });
});

/**
 * Strictness is the feature. A fuzzy applier eventually lands a hunk in the wrong
 * place, and in a knowledge base that means a value silently attached to the wrong
 * subject. Refusing costs a re-read; guessing costs correctness.
 */
describe('applyUnifiedDiff', () => {
  const body = ['# Lease', '', '- Rent: 1111 EUR', '- Term: 12 months', ''].join('\n');

  it('applies a hunk whose context matches', () => {
    const patch = ['@@ -3,1 +3,1 @@', '-- Rent: 1111 EUR', '+- Rent: 2222 EUR'].join('\n');
    expect(applyUnifiedDiff(body, patch)).toContain('- Rent: 2222 EUR');
  });

  it('treats the @@ line numbers as a hint, not as truth', () => {
    // Agents get these wrong constantly; the context identifies the location.
    const patch = ['@@ -99,1 +99,1 @@', '-- Rent: 1111 EUR', '+- Rent: 2222 EUR'].join('\n');
    expect(applyUnifiedDiff(body, patch)).toContain('- Rent: 2222 EUR');
  });

  it('applies multiple hunks without the earlier one shifting the later', () => {
    const patch = [
      '@@ -3,1 +3,1 @@',
      '-- Rent: 1111 EUR',
      '+- Rent: 2222 EUR',
      '+- Deposit: 3333 EUR',
      '@@ -4,1 +5,1 @@',
      '-- Term: 12 months',
      '+- Term: 24 months',
    ].join('\n');
    const result = applyUnifiedDiff(body, patch);
    expect(result).toContain('- Rent: 2222 EUR');
    expect(result).toContain('- Deposit: 3333 EUR');
    expect(result).toContain('- Term: 24 months');
  });

  it('refuses when the context does not match', () => {
    const patch = ['@@ -3,1 +3,1 @@', '-- Rent: 9999 EUR', '+- Rent: 2222 EUR'].join('\n');
    expect(() => applyUnifiedDiff(body, patch)).toThrow(/context does not match/);
  });

  it('uses an accurate line hint to disambiguate two identical passages', () => {
    // The context matches twice, but the hint says which — and its content is
    // exactly what the patch expects, so applying there is not a guess.
    const twice = ['- Rent: 1111 EUR', '- Rent: 1111 EUR'].join('\n');
    const patch = ['@@ -2,1 +2,1 @@', '-- Rent: 1111 EUR', '+- Rent: 2222 EUR'].join('\n');
    expect(applyUnifiedDiff(twice, patch)).toBe('- Rent: 1111 EUR\n- Rent: 2222 EUR');
  });

  it('refuses an ambiguous hunk when the hint is no help either', () => {
    const twice = ['- Rent: 1111 EUR', '- Rent: 1111 EUR'].join('\n');
    const patch = ['@@ -99,1 +99,1 @@', '-- Rent: 1111 EUR', '+- Rent: 2222 EUR'].join('\n');
    expect(() => applyUnifiedDiff(twice, patch)).toThrow(/matches 2 places/);
  });

  it('ignores file headers and the no-newline marker', () => {
    const patch = [
      '--- a/lease.md',
      '+++ b/lease.md',
      '@@ -3,1 +3,1 @@',
      '-- Rent: 1111 EUR',
      '+- Rent: 2222 EUR',
      '\\ No newline at end of file',
    ].join('\n');
    expect(applyUnifiedDiff(body, patch)).toContain('- Rent: 2222 EUR');
  });

  it('refuses a patch with no hunks', () => {
    expect(() => applyUnifiedDiff(body, 'just some text')).toThrow(/no @@ hunks/);
  });
});
