import { describe, expect, it } from 'vitest';
import { documentPart, documentRendition } from './parts.ts';

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

/**
 * The category the part rule names in order to exclude it: a second rendition of the same
 * thing rather than its second half. A wrong guess here is quieter and worse than a wrong
 * part — the document's own text would come back twice, once under each name.
 */
describe('documentRendition', () => {
  const folder = (names: string[]) => () => names;

  it('reads `<file>.txt` as a rendering of that file', () => {
    expect(
      documentRendition('household/lease.pdf.txt', { entries: folder(['lease.pdf', 'lease.pdf.txt']) }),
    ).toEqual({ source: 'household/lease.pdf' });
  });

  it('reads a bare `.txt` beside one document as that document’s text', () => {
    // Somebody ran `pdftotext` before Akno existed. Indexing their output as a document of
    // its own is what returned every phrase in the contract twice.
    expect(documentRendition('a/lease.txt', { entries: folder(['lease.pdf', 'lease.txt']) })).toEqual({
      source: 'a/lease.pdf',
    });
  });

  it('is not fooled by dots in a filename', () => {
    // `Rental Agreement … A. N. Marlow … Aug 5 2031` has four dots and no extension. Deciding
    // "does this stem already have an extension" by looking for a dot gets this wrong, and
    // the file it names is exactly the one this was built for.
    const name = 'Rental Agreement Blackwater Bay 12 A. N. Marlow Vulpine Mutual B. Aug 5 2031';
    expect(documentRendition(`d/${name}.txt`, { entries: folder([`${name}.pdf`]) })).toEqual({
      source: `d/${name}.pdf`,
    });
  });

  it('refuses when the stem names more than one document', () => {
    // `lease.txt` beside both a PDF and a DOCX names neither, and attaching the text of one
    // file to another file's name is worse than leaving it alone.
    expect(
      documentRendition('a/lease.txt', { entries: folder(['lease.pdf', 'lease.docx', 'lease.txt']) }),
    ).toBeNull();
  });

  it('needs the file it claims to render to exist', () => {
    // Same guard as `hasPartOne`, for the same reason: the alternative is inventing a
    // document out of a filename.
    expect(documentRendition('a/lease.pdf.txt', { entries: folder(['lease.pdf.txt']) })).toBeNull();
    expect(documentRendition('a/notes.txt', { entries: folder(['notes.txt']) })).toBeNull();
  });

  it('does not fold one text file into another', () => {
    // Two plain-text files are two documents. Neither is an extraction of the other.
    expect(
      documentRendition('a/lease.txt.txt', { entries: folder(['lease.txt', 'lease.txt.txt']) }),
    ).toBeNull();
    expect(documentRendition('a/notes.txt', { entries: folder(['notes.csv', 'notes.txt']) })).toBeNull();
    expect(documentRendition('a/notes.txt', { entries: folder(['notes.md', 'notes.txt']) })).toBeNull();
  });

  it('is only ever about .txt', () => {
    // `passport.jpg` beside `passport.pdf` is two renderings with no way to say which is the
    // document, so neither is folded into the other.
    expect(
      documentRendition('a/lease.pdf.md', { entries: folder(['lease.pdf', 'lease.pdf.md']) }),
    ).toBeNull();
    expect(
      documentRendition('a/passport.jpg', { entries: folder(['passport.pdf', 'passport.jpg']) }),
    ).toBeNull();
  });
});
