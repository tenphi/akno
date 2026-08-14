import { describe, expect, it } from 'vitest';
import { isInsideSuggestedFolderForTesting } from './remember.ts';

describe('remember route taxonomy boundary', () => {
  it('accepts a semantic match inside the selected folder', () => {
    expect(
      isInsideSuggestedFolderForTesting('knowledge/games/ember-archive', 'knowledge/games/new-game'),
    ).toBe(true);
  });

  it('refuses a topical match in another branch', () => {
    expect(
      isInsideSuggestedFolderForTesting('people/ada-marlow/music', 'knowledge/games/ember-archive'),
    ).toBe(false);
  });

  it('does not route automatically when the curator chose no folder', () => {
    expect(isInsideSuggestedFolderForTesting('home/lease', undefined)).toBe(false);
  });
});
