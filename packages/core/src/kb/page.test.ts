import { describe, expect, it } from 'vitest';
import { normalizeLinkTarget, parsePage, resolvePagePolicy, resolveRole } from './page.ts';
import { parseFrontmatter, withId } from './frontmatter.ts';

describe('parseFrontmatter', () => {
  it('parses a block and reports where the body starts', () => {
    const content = '---\ntitle: Ada\ntype: person\n---\n\n# Ada\n\nHello.\n';
    const fm = parseFrontmatter(content);
    expect(fm.present).toBe(true);
    expect(fm.data).toEqual({ title: 'Ada', type: 'person' });
    // Line 5 is the blank line after the closing fence.
    expect(fm.bodyLine).toBe(5);
    expect(content.slice(fm.bodyOffset)).toBe('\n# Ada\n\nHello.\n');
  });

  it('treats an unterminated fence as body rather than swallowing the file', () => {
    const content = '---\ntitle: broken\n\n# Heading\n';
    const fm = parseFrontmatter(content);
    expect(fm.present).toBe(false);
    expect(fm.bodyOffset).toBe(0);
  });

  it('survives malformed YAML without losing the page', () => {
    // Malformed frontmatter in someone's notes is their business, not a reason to
    // skip the page: the body must still index and the offsets must still be right.
    const fm = parseFrontmatter('---\n\tbad: [\n  - x\n ]]\nalso: : :\n---\n\nbody\n');
    expect(fm.present).toBe(true);
    expect(typeof fm.data).toBe('object');
    expect(fm.bodyLine).toBe(7);
  });

  it('handles a page with no frontmatter at all', () => {
    const fm = parseFrontmatter('# Just a heading\n');
    expect(fm.present).toBe(false);
    expect(fm.bodyLine).toBe(1);
  });
});

describe('withId', () => {
  it('splices id in without disturbing any other key', () => {
    const content = "---\ntitle: Ada\ndate: '2026-05-26T00:00:00.000Z'\ntags:\n  - family\n---\n\nbody\n";
    const updated = withId(content, '01JQZ4T7K2E9ABCD');
    // Every original byte is still there, in order — that is the guarantee about
    // frontmatter keys Akno does not own.
    expect(updated).toContain("date: '2026-05-26T00:00:00.000Z'");
    expect(updated).toContain('tags:\n  - family');
    expect(updated).toContain('id: 01JQZ4T7K2E9ABCD\ntitle: Ada');
    expect(updated.replace('id: 01JQZ4T7K2E9ABCD\n', '')).toBe(content);
  });

  it('creates a block when the page has none', () => {
    expect(withId('# Heading\n', 'ABC')).toBe('---\nid: ABC\n---\n\n# Heading\n');
  });

  it('leaves an existing id alone', () => {
    const content = '---\nid: EXISTING\n---\n\nbody\n';
    expect(withId(content, 'NEW')).toBe(content);
  });
});

describe('parsePage', () => {
  const content = [
    '---',
    'title: Car insurance 2026',
    'type: document',
    'tags: [finance, car]',
    '---',
    '',
    '# Car insurance 2026',
    '',
    'Vulpine Mutual, €33/month, renews 4 Nov 2026.',
    'Related: [[people/ada-marlow]]',
    '',
    '- **2026-06-14** | Premium went up at renewal. [[finance/accounts]]',
    '',
    '<!-- source -->',
    '',
    'POLICY SCHEDULE ...',
    '',
  ].join('\n');

  const page = parsePage('documents/car-insurance-2026.md', content);

  it('derives the slug from the path', () => {
    expect(page.slug).toBe('documents/car-insurance-2026');
  });

  it('reads title, type and tags', () => {
    expect(page.title).toBe('Car insurance 2026');
    expect(page.type).toBe('document');
    expect(page.tags).toEqual(['finance', 'car']);
  });

  it('finds the source fence at its absolute line number', () => {
    // Body starts at line 6; the fence is the 9th body line.
    expect(page.sourceFenceLine).toBe(14);
    expect(content.split('\n')[page.sourceFenceLine! - 1]).toBe('<!-- source -->');
  });

  it('extracts the event with its date, link and line', () => {
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({
      date: '2026-06-14',
      summary: 'Premium went up at renewal.',
      targetSlug: 'finance/accounts',
      line: 12,
    });
  });

  it('extracts links from anywhere in the body', () => {
    expect(page.links.map((link) => link.toSlug)).toEqual(['people/ada-marlow', 'finance/accounts']);
  });

  it('falls back to the first heading when there is no title', () => {
    const untitled = parsePage('notes/thing.md', '## The Actual Heading\n\nbody\n');
    expect(untitled.title).toBe('The Actual Heading');
  });

  it('falls back to the filename when there is no heading either', () => {
    expect(parsePage('notes/wifi-and-devices.md', 'just prose\n').title).toBe('Wifi And Devices');
  });
});

describe('normalizeLinkTarget', () => {
  it('strips extensions and normalizes case-insensitively at match time', () => {
    expect(normalizeLinkTarget('home/lease.md')).toBe('home/lease');
    expect(normalizeLinkTarget('[[home/lease]]'.slice(2, -2))).toBe('home/lease');
  });

  it('resolves a relative markdown link against the linking page', () => {
    expect(normalizeLinkTarget('../people/ada.md', 'home/lease')).toBe('people/ada');
    expect(normalizeLinkTarget('./appliances.md', 'home/lease')).toBe('home/appliances');
  });

  it('resolves a bare filename against the linking page folder', () => {
    expect(normalizeLinkTarget('appliances.md', 'home/lease')).toBe('home/appliances');
  });

  it('clamps a target that resolves above the knowledge base root', () => {
    expect(normalizeLinkTarget('../../../etc/passwd', 'a/b')).toBe('etc/passwd');
    expect(normalizeLinkTarget('../../../etc/passwd', 'a/b')).not.toContain('..');
  });
});

describe('resolveRole', () => {
  it('lets page frontmatter win over a rule', () => {
    const resolved = resolveRole(
      { declaredRole: 'knowledge', slug: 'sources/law' },
      { role: 'source', glob: 'sources/**' },
      'observations',
    );
    expect(resolved).toEqual({ role: 'knowledge', source: 'frontmatter' });
  });

  it('uses the rule when frontmatter is silent, and says which glob won', () => {
    const resolved = resolveRole(
      { declaredRole: null, slug: 'sources/law' },
      { role: 'source', glob: 'sources/**' },
      'observations',
    );
    expect(resolved).toEqual({ role: 'source', source: 'rule', via: 'sources/**' });
  });

  it('defaults to knowledge', () => {
    expect(resolveRole({ declaredRole: null, slug: 'home/lease' }, null, 'observations')).toEqual({
      role: 'knowledge',
      source: 'default',
    });
  });
});

describe('page management metadata', () => {
  it('keeps role and automatic authority independent and removes self metadata', () => {
    const page = parsePage(
      'people/ada-marlow.md',
      `---
title: Ada Marlow
akno:
  role: knowledge
  management:
    remember: deny
    dream: synthesize
  about: [people/ada-marlow]
  aliases: [Ada Marlow, ada-marlow, A. Marlow]
---

# Ada Marlow
`,
    );
    const policy = resolvePagePolicy(page, null, 'observations');
    expect(policy).toMatchObject({ role: 'knowledge', remember: 'deny', dream: 'synthesize', about: [] });
    expect(policy.aliases).toEqual(['A. Marlow']);
  });

  it('filters redundant Unicode aliases without collapsing distinct ones', () => {
    const parsed = parsePage(
      'concepts/blue-comet.md',
      '---\ntitle: Синяя Комета\nakno:\n  aliases: [Синяя Комета, Комета]\n---\n\n# Синяя Комета\n',
    );
    expect(parsed.aliases).toEqual(['Комета']);
  });

  it('inherits about from a folder without making a canonical page about itself', () => {
    const page = parsePage('ada-marlow/projects/zephyr.md', '# Zephyr\n');
    const policy = resolvePagePolicy(
      page,
      { about: ['people/ada-marlow'], glob: 'ada-marlow/**' },
      'observations',
    );
    expect(policy.about).toEqual(['people/ada-marlow']);
  });
});

describe('embeds of files', () => {
  it('are not page links, and never broken ones', () => {
    // `doctor` counted every embedded attachment as a wikilink pointing at a page that does
    // not exist — noise that buries the real broken links.
    const page = parsePage(
      'home/passport.md',
      '# Passport\n\n![[passport-2.pdf]]\n![[scan.JPG]]\n\nSee [[people/ada-marlow]] and [[home/lease]].\n',
    );
    const byKind = (kind: string): string[] =>
      page.links.filter((link) => link.kind === kind).map((link) => link.toSlug);

    expect(byKind('embed')).toEqual(['passport-2.pdf', 'scan.JPG']);
    expect(byKind('wikilink')).toEqual(['people/ada-marlow', 'home/lease']);
  });

  it('still treats a wikilink written with a .md extension as a page', () => {
    // Obsidian writes both forms; `normalizeLinkTarget` strips the extension, so what is
    // left with an extension is a file and what is not is a page.
    const page = parsePage('index.md', '# Index\n\n[[home/lease.md]] and [[people/ada-marlow]].\n');
    expect(page.links.every((link) => link.kind === 'wikilink')).toBe(true);
    expect(page.links.map((link) => link.toSlug)).toEqual(['home/lease', 'people/ada-marlow']);
  });
});
