import { describe, expect, it } from 'vitest';
import { documentPart } from './parts.ts';

/**
 * A scanner that cut one passport into `passport.pdf` and `passport-2.pdf` has not
 * produced two documents. The rule that recognises this has to be narrow: the cost of a
 * wrong guess is two unrelated documents welded into one, with one summary describing
 * neither.
 */
describe('documentPart', () => {
  it('reads a trailing -<n> as a part of the bare file', () => {
    expect(documentPart('people/passport-2.pdf')).toEqual({
      groupKey: 'people/passport.pdf',
      part: 2,
    });
    expect(documentPart('people/passport.pdf')).toEqual({
      groupKey: 'people/passport.pdf',
      part: 1,
    });
    expect(documentPart('scan-11.jpg')).toEqual({ groupKey: 'scan.jpg', part: 11 });
  });

  it('keeps parts of one document in the same group across a folder', () => {
    const group = ['a/lease.pdf', 'a/lease-2.pdf', 'a/lease-3.pdf'].map(documentPart);
    expect(new Set(group.map((entry) => entry.groupKey)).size).toBe(1);
    expect(group.map((entry) => entry.part)).toEqual([1, 2, 3]);
  });

  it('does not group across extensions', () => {
    // A `.jpg` beside a `.pdf` of the same name is another rendition of the same thing, not
    // its second half. Merging their text would interleave two readings of one page.
    expect(documentPart('people/passport-2.jpg').groupKey).toBe('people/passport.jpg');
    expect(documentPart('people/passport-2.pdf').groupKey).toBe('people/passport.pdf');
  });

  it('does not group across folders', () => {
    // Two people can each have a `residence-permit-2.jpg`, and they are not one document.
    expect(documentPart('ada/residence-permit-2.jpg').groupKey).toBe('ada/residence-permit.jpg');
    expect(documentPart('bo/residence-permit-2.jpg').groupKey).toBe('bo/residence-permit.jpg');
  });

  it('leaves a year or a long number alone', () => {
    for (const name of ['bill-2026.pdf', 'invoice-100.pdf', 'form-1040.pdf']) {
      expect(documentPart(name), name).toEqual({ groupKey: name, part: 1 });
    }
  });

  it('leaves a content-addressed attachment alone', () => {
    // Akno wrote that suffix, and it is a hash rather than a sequence.
    const name = 'home/lease-3f8c1a2b.pdf';
    expect(documentPart(name)).toEqual({ groupKey: name, part: 1 });
  });

  it('leaves a zero-padded scanner label alone', () => {
    // `-02` is a page label printed by the scanner, not a sequence to reorder.
    expect(documentPart('scan-02.jpg')).toEqual({ groupKey: 'scan-02.jpg', part: 1 });
  });
});

describe('documentPart, guarded', () => {
  const exists = (paths: string[]) => (key: string) => paths.includes(key);

  it('does not read a date suffix as a part number', () => {
    // The case that bit on real data: `-28` of `…-2026-07-28.pdf` was read as part 28, and
    // two bills dated -27 and -28 would have become one document with one summary.
    for (const name of ['receipts/waternet-annual-bill-2026-07-28.pdf', 'receipts/bill-2026-07.pdf']) {
      const part = documentPart(name);
      expect(part.part, name).toBe(1);
      expect(part.groupKey, name).toBe(name);
    }
  });

  it('needs part one to exist before calling something a part of it', () => {
    // A lone `-2` file is its own document, whatever its name suggests.
    expect(documentPart('a/lease-2.pdf', { hasPartOne: exists([]) })).toEqual({
      groupKey: 'a/lease-2.pdf',
      part: 1,
    });
    expect(documentPart('a/lease-2.pdf', { hasPartOne: exists(['a/lease.pdf']) })).toEqual({
      groupKey: 'a/lease.pdf',
      part: 2,
    });
  });

  it('groups a numbered run of photos when the first one is there', () => {
    // Twelve photos of one car rental is exactly the pattern this exists for — and the only
    // thing separating it from a coincidence is whether the file it claims to follow exists.
    const name = 'scans/2026-06-20-car-rental-12.jpg';
    expect(documentPart(name, { hasPartOne: exists([]) }).part).toBe(1);
    expect(documentPart(name, { hasPartOne: exists(['scans/2026-06-20-car-rental.jpg']) })).toEqual({
      groupKey: 'scans/2026-06-20-car-rental.jpg',
      part: 12,
    });
  });
});
