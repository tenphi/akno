import { describe, expect, it } from 'vitest';
import { normalizeSlug, refusesLedgerProse } from './write.ts';

/**
 * **The ledger takes events, not prose**, and this is the guard that makes that true rather
 * than merely documented.
 *
 * From a real failure: `remember` routed a claim about an ongoing complaint to `timeline`,
 * because the ledger already recorded events about it and was therefore the best match for
 * its subject. `append` put the sentence at the end of the body — below the last year
 * heading, in no `- **YYYY-MM-DD** |` shape — where the event parser can never read it back.
 * Routing no longer offers reserved paths; this is the layer under that, because a guard the
 * caller holds is a guard the next caller does not.
 */
describe('writing to the ledger', () => {
  const ledger = 'timeline';

  it('refuses an append, which is how prose reaches the bottom of the file', () => {
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'agent', edit: 'append' })).toBe(true);
  });

  it('refuses a whole-body replacement, which discards every event at once', () => {
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'agent', edit: 'content' })).toBe(true);
  });

  it('allows the line-targeted edits, so a wrong line stays correctable', () => {
    // The ledger is append-only for *entries*, which is not the same as immutable: a line
    // that went in wrong is corrected. Neither of these can append at the bottom.
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'agent', edit: 'patch' })).toBe(false);
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'agent', edit: 'replace' })).toBe(false);
  });

  it('allows a write that carries only an event', () => {
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'agent', edit: null })).toBe(false);
  });

  it('refuses the user too — this is a shape rule, not a permission', () => {
    // Nothing about a human caller makes a paragraph below the year headings findable. Someone
    // who genuinely wants prose in that file has an editor.
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'user', edit: 'append' })).toBe(true);
  });

  it('exempts akno, so a planned link fix can still update a ledger line', () => {
    expect(refusesLedgerProse({ slug: ledger, ledger, actor: 'akno', edit: 'append' })).toBe(false);
  });

  it('leaves every other page alone', () => {
    expect(
      refusesLedgerProse({ slug: 'household/tvr-complaint', ledger, actor: 'agent', edit: 'append' }),
    ).toBe(false);
  });

  it('follows a remapped ledger rather than the name `timeline`', () => {
    expect(
      refusesLedgerProse({
        slug: 'household/ledger',
        ledger: 'household/ledger',
        actor: 'agent',
        edit: 'append',
      }),
    ).toBe(true);
    expect(
      refusesLedgerProse({ slug: 'timeline', ledger: 'household/ledger', actor: 'agent', edit: 'append' }),
    ).toBe(false);
  });
});

describe('normalizeSlug', () => {
  it('drops the extension a caller sent by habit', () => {
    expect(normalizeSlug('people/jane-doe.md')).toBe('people/jane-doe');
  });

  it('rejects a path that would escape the knowledge base rather than stripping it', () => {
    // Rejected, not sanitized: reading `/etc/passwd` as `etc/passwd` writes somewhere the
    // caller did not ask for and then cannot find.
    expect(() => normalizeSlug('/etc/passwd')).toThrow();
    expect(() => normalizeSlug('../outside')).toThrow();
    expect(() => normalizeSlug('~/notes')).toThrow();
  });

  it('rejects a dot segment, because a page there would be written and then invisible', () => {
    // Every walk Akno does — scanTree, the watcher, the folder catalog, both ingest
    // passes — skips a name starting with a dot. `indexer.run({only})` filters the scan
    // output rather than bypassing it, so a page written to a dot path is journalled and
    // then indexed by nothing: recall, read and list all report it missing while the file
    // sits on disk. `.git/config` was accepted and would have written a stray `config.md`
    // inside the git directory.
    for (const slug of ['.secret/note', 'travel/.hidden/page', '.git/config', '.DS_Store']) {
      expect(() => normalizeSlug(slug), slug).toThrow(/does not index dot paths/);
    }
  });

  it('still allows a dot inside a segment, which is only a filename', () => {
    // The rule is about a *leading* dot. `v1.2` and `notes.old` are ordinary names.
    expect(normalizeSlug('releases/v1.2')).toBe('releases/v1.2');
    expect(normalizeSlug('people/jane.doe')).toBe('people/jane.doe');
  });
});
