import { describe, expect, it } from 'vitest';
import { normalizeLinkTarget, parsePage, resolveClass } from './page.js';
import { parseFrontmatter, withId } from './frontmatter.js';

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
    // Every original byte is still there, in order — that is the guarantee §4
    // makes about frontmatter keys Akno does not own.
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
    '<!-- reference -->',
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

  it('finds the reference fence at its absolute line number', () => {
    // Body starts at line 6; the fence is the 9th body line.
    expect(page.referenceFenceLine).toBe(14);
    expect(content.split('\n')[page.referenceFenceLine! - 1]).toBe('<!-- reference -->');
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
    expect(page.links.map((link) => link.toSlug)).toEqual([
      'people/ada-marlow',
      'finance/accounts',
    ]);
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

describe('resolveClass', () => {
  it('lets page frontmatter win over a rule', () => {
    const resolved = resolveClass(
      { declaredClass: 'full', slug: 'reference/law' },
      { class: 'reference', glob: 'reference/**' },
      'observations',
    );
    expect(resolved).toEqual({ class: 'full', source: 'frontmatter' });
  });

  it('uses the rule when frontmatter is silent, and says which glob won', () => {
    const resolved = resolveClass(
      { declaredClass: null, slug: 'reference/law' },
      { class: 'reference', glob: 'reference/**' },
      'observations',
    );
    expect(resolved).toEqual({ class: 'reference', source: 'rule', via: 'reference/**' });
  });

  it('defaults to full', () => {
    expect(resolveClass({ declaredClass: null, slug: 'home/lease' }, null, 'observations')).toEqual({
      class: 'full',
      source: 'default',
    });
  });
});
