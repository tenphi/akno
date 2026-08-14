import { describe, expect, it } from 'vitest';
import { isReserved, ledgerSlug, reservedSlugs } from './reserved.ts';
import type { AknoConfig } from './config/schema.ts';

/**
 * Reserved paths are Akno's own structures living inside the user's folder, which is
 * exactly why the predicate has to be shared: the write path, the indexer and routing each
 * used to decide "is this the ledger?" for themselves, and the one that was wrong was wrong
 * silently.
 */
const config = {
  paths: { timeline: 'timeline.md', inbox: 'inbox', observations: 'observations', journal: 'journal' },
} as AknoConfig;

describe('the reserved paths', () => {
  it('reads the ledger slug off the configured path, extension and all', () => {
    expect(ledgerSlug(config)).toBe('timeline');
    expect(ledgerSlug({ paths: { ...config.paths, timeline: 'meta/events.markdown' } } as AknoConfig)).toBe(
      'meta/events',
    );
  });

  it('names every structure a claim must not land on', () => {
    expect(reservedSlugs(config)).toEqual(['timeline', 'inbox', 'observations', 'journal']);
  });

  it('covers what lives underneath a reserved folder, not just the folder itself', () => {
    expect(isReserved('observations', config)).toBe(true);
    expect(isReserved('observations/2026-08-cooking', config)).toBe(true);
    expect(isReserved('inbox/scan-001', config)).toBe(true);
  });

  it('leaves a page that merely starts with the same letters alone', () => {
    // `journal-club` is somebody's reading group, not Akno's journal. Prefix matching on
    // the bare string rather than on a path boundary would quietly make it unwritable.
    expect(isReserved('journal-club', config)).toBe(false);
    expect(isReserved('timelines/project-atlas', config)).toBe(false);
  });

  it('follows a remapped reserved path rather than the default name', () => {
    const remapped = { paths: { ...config.paths, timeline: 'household/ledger.md' } } as AknoConfig;
    expect(isReserved('household/ledger', remapped)).toBe(true);
    expect(isReserved('timeline', remapped)).toBe(false);
  });
});
