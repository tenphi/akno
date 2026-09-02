import { describe, expect, it } from 'vitest';
import { hasInlineMergeConflict, matchesConflictPath, normalizeConflictPath } from './page-quarantine.ts';

describe('Markdown conflict classification', () => {
  it('requires one complete structural merge block', () => {
    expect(hasInlineMergeConflict('A line with <<<<<<< as prose.\n=======\nNo closing marker.')).toBe(false);
    expect(
      hasInlineMergeConflict(
        '# Ada Marlow\n<<<<<<< local\nPrefers tea.\n=======\nPrefers coffee.\n>>>>>>> remote\n',
      ),
    ).toBe(true);
  });

  it('detects a conflict before frontmatter can be parsed', () => {
    expect(
      hasInlineMergeConflict(
        '---\ntitle: Ada Marlow\n<<<<<<< local\ntags: [tea]\n=======\ntags: [coffee]\n>>>>>>> remote\n---\n',
      ),
    ).toBe(true);
  });

  it('keeps literal examples in closed fences and quarantines malformed fences conservatively', () => {
    const example = '```text\n<<<<<<< local\nleft\n=======\nright\n>>>>>>> remote\n```\n';
    expect(hasInlineMergeConflict(example)).toBe(false);
    expect(hasInlineMergeConflict(example.slice(0, -4))).toBe(true);
  });

  it('normalizes case, separators, repeated slashes, and Unicode before matching', () => {
    expect(normalizeConflictPath('./Archive//Cafe\u0301/CONFLICT-1111.MD')).toBe(
      'archive/café/conflict-1111.md',
    );
    expect(matchesConflictPath('Archive/Café/Conflict-1111.md', ['archive\\**\\conflict-*.md'])).toBe(true);
  });
});
