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
 * The one case where a body edit *does* change the frontmatter, and the reason it has to.
 *
 * `read` returns the file with its frontmatter, so a caller that read a page, revised it and
 * wrote the result back arrives holding a block. Splicing that under the existing head is what
 * gave `travel/2027/japan-trip` two of them, the second invisible to everything that reads
 * frontmatter — including the indexer, which went on reporting a trip page titled after the
 * one Shinkansen fact that happened to create it.
 */
describe('applyEdit adopting a frontmatter block the caller sent', () => {
  const SENT = ['---', 'title: Lease 2027', 'akno:', '  role: knowledge', '---', '', '# Lease 2027', ''].join(
    '\n',
  );

  it('replaces the page block rather than nesting a second one under it', () => {
    const result = applyEdit(PAGE, { kind: 'content', content: SENT });
    expect(result.content.match(/^---$/gm)).toHaveLength(2);
    expect(result.content).toBe(SENT);
    expect(result.frontmatter?.adopted).toBe(true);
  });

  it('names the keys the rewrite dropped, so a rewrite from memory is not silent', () => {
    // `date` was on the page and is not in what came back. Nothing is refused — the caller
    // may well have meant it — but a `temporal` or `management` key lost this way changes how
    // a page behaves for months without changing a word anybody reads.
    const result = applyEdit(PAGE, { kind: 'content', content: SENT });
    expect(result.frontmatter?.dropped).toEqual(['date']);
  });

  it('carries `id` forward, because the caller has no reason to be holding it', () => {
    const identified = `---\nid: 01JQZ4T7K2E9ABCD\ntitle: Lease\n---\n\n# Lease\n`;
    const result = applyEdit(identified, { kind: 'content', content: SENT });
    expect(result.content).toContain('id: "01JQZ4T7K2E9ABCD"');
    expect(result.frontmatter?.dropped).toEqual([]);
  });

  it('separates the block from the body even when the caller did not', () => {
    const flush = '---\ntitle: Lease\n---\n# Lease\n';
    expect(applyEdit(PAGE, { kind: 'content', content: flush }).content).toBe(
      '---\ntitle: Lease\n---\n\n# Lease\n',
    );
  });

  it('reads a horizontal rule as body, not as a declaration', () => {
    // A body that opens with `---` and contains another one is indistinguishable from a
    // frontmatter block until you parse it. Prose is not a mapping, so it stays body.
    const ruled = '---\n\nSome prose about the lease.\n\n---\n\nMore prose.\n';
    const result = applyEdit(PAGE, { kind: 'content', content: ruled });
    expect(result.frontmatter).toBeUndefined();
    expect(result.content.startsWith("---\ntitle: Lease\ndate: '2026-05-26T00:00:00.000Z'\n---\n")).toBe(
      true,
    );
  });

  it('leaves the frontmatter alone for append, patch and replace', () => {
    // Only a whole-page write can mean "and this is the declaration". A block arriving in an
    // append is text somebody pasted, and moving it to the head would be a guess.
    const result = applyEdit(PAGE, { kind: 'append', text: SENT });
    expect(result.content.startsWith("---\ntitle: Lease\ndate: '2026-05-26T00:00:00.000Z'\n---\n")).toBe(
      true,
    );
    expect(result.frontmatter).toBeUndefined();
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

/**
 * Appending under a heading, which the host's tool has advertised all along while the schema
 * silently dropped the field — so every heading-scoped append landed at the bottom of the page,
 * under whatever heading happened to be last.
 */
describe('appending under a section', () => {
  const page = [
    '# Apartment',
    '',
    '## Rent',
    '',
    '- Rent: 1450 EUR',
    '',
    '### History',
    '',
    '- 2025: 1380 EUR',
    '',
    '## Utilities',
    '',
    '- Water: Waternet',
    '',
  ].join('\n');

  it('lands at the end of the named section, not the end of the page', () => {
    const result = applyEdit(page, { kind: 'append', text: '- Deposit: 2900 EUR', section: 'Utilities' });
    const lines = result.content.split('\n');
    // Directly after, with no gap: two bullets with a blank line between them are a loose list.
    expect(lines[lines.indexOf('- Water: Waternet') + 1]).toBe('- Deposit: 2900 EUR');
  });

  it('keeps a subsection inside its parent rather than inserting above it', () => {
    // `### History` belongs to `## Rent`. Stopping at the first heading of any level would put
    // the new line above content that is part of the section being appended to.
    const result = applyEdit(page, { kind: 'append', text: '- Indexed annually', section: 'Rent' });
    const lines = result.content.split('\n');
    expect(lines.indexOf('- Indexed annually')).toBeGreaterThan(lines.indexOf('- 2025: 1380 EUR'));
    expect(lines.indexOf('- Indexed annually')).toBeLessThan(lines.indexOf('## Utilities'));
  });

  it('matches a heading by its text, at any level and whatever the case', () => {
    expect(applyEdit(page, { kind: 'append', text: '- x', section: 'rent' }).content).toContain('- x');
    expect(applyEdit(page, { kind: 'append', text: '- y', section: '## Rent' }).content).toContain('- y');
    expect(applyEdit(page, { kind: 'append', text: '- z', section: 'History' }).content).toContain('- z');
  });

  it('does not touch the frontmatter', () => {
    const withFront = `---\ntitle: Apartment\n---\n\n${page}`;
    const result = applyEdit(withFront, { kind: 'append', text: '- q', section: 'Rent' });
    expect(result.content.startsWith('---\ntitle: Apartment\n---\n')).toBe(true);
  });

  it('refuses a heading the page does not have, rather than falling back to the bottom', () => {
    // The silent fallback is the bug being fixed. A caller that named a section had one in mind,
    // and putting the text somewhere else is worse than not writing it.
    expect(() => applyEdit(page, { kind: 'append', text: '- x', section: 'Parking' })).toThrow(/no heading/);
  });

  it('refuses an ambiguous heading, the way replace does', () => {
    const twice = '## Notes\n\n- a\n\n## Notes\n\n- b\n';
    expect(() => applyEdit(twice, { kind: 'append', text: '- c', section: 'Notes' })).toThrow(/2 times/);
  });

  it('still appends to the end of the body when no section is named', () => {
    const result = applyEdit(page, { kind: 'append', text: '- Bins: Tuesday' });
    expect(result.content.trimEnd().endsWith('- Bins: Tuesday')).toBe(true);
  });
});

describe('the separator a section append uses', () => {
  it('keeps a list tight, because a gap makes it a loose list', () => {
    const page = '## Rent\n\n- Rent: 1450 EUR\n';
    const result = applyEdit(page, { kind: 'append', text: '- Indexed annually', section: 'Rent' });
    expect(result.content).toContain('- Rent: 1450 EUR\n- Indexed annually');
  });

  it('still separates two paragraphs', () => {
    const page = '## Rent\n\nThe rent is reviewed each July.\n';
    const result = applyEdit(page, {
      kind: 'append',
      text: 'The index is published in May.',
      section: 'Rent',
    });
    expect(result.content).toContain('each July.\n\nThe index is published');
  });

  it('does not add a gap to an empty section', () => {
    const page = '## Rent\n\n## Utilities\n\n- Water\n';
    const result = applyEdit(page, { kind: 'append', text: '- Rent: 1450 EUR', section: 'Rent' });
    expect(result.content).toContain('## Rent\n\n- Rent: 1450 EUR\n\n## Utilities');
  });
});
