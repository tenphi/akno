import { describe, expect, it } from 'vitest';
import { cleanSlug, nameIsUseless, unslug } from './name.ts';

/**
 * **A good name is left alone.** Renaming is the one destructive thing ingest
 * does — a name someone chose carries intent no model can reconstruct — so the bias
 * is deliberately toward keeping, and every pattern here has to earn its place.
 */
describe('nameIsUseless', () => {
  it('recognises camera and phone names', () => {
    for (const name of [
      'IMG_4821.HEIC',
      'IMG-2031.jpg',
      'DSC00214.JPG',
      'DSCN1234.jpg',
      'P1010457.jpg',
      'PXL_20260806_141500.jpg',
    ]) {
      expect(nameIsUseless(name), name).toBe(true);
    }
  });

  it('recognises scanner and screenshot names', () => {
    for (const name of [
      'Scan 2026-08-06 at 14.22.pdf',
      'Scan.pdf',
      'Scanned_20260806.pdf',
      'Screenshot 2026-08-06 at 14.22.31.png',
      'Screen Shot 2026-08-06 at 14.22.31.png',
    ]) {
      expect(nameIsUseless(name), name).toBe(true);
    }
  });

  it('recognises browser and messenger names', () => {
    for (const name of [
      'document(3).pdf',
      'document.pdf',
      'download.pdf',
      'download (2).pdf',
      'untitled.pdf',
      'file_01.pdf',
      'WhatsApp Image 2026-08-05 at 10.00.jpg',
    ]) {
      expect(nameIsUseless(name), name).toBe(true);
    }
  });

  it('recognises bare hashes, uuids and digits', () => {
    for (const name of [
      '9f8a7b6c5d4e3f21.pdf',
      '3f8c1a2b-91de-77c4-8f2a-0af3e57f1234.pdf',
      '20260806141500.jpg',
      '2026-08-06.pdf',
      '2026_08_06.png',
    ]) {
      expect(nameIsUseless(name), name).toBe(true);
    }
  });

  it('leaves a name that carries information', () => {
    // Each of these says something the content would otherwise have to be read for.
    for (const name of [
      '2024-lease-agreement.pdf',
      'car-insurance-2026.pdf',
      'Northern Water annual bill 2026.pdf',
      'invoice-2026-07.pdf',
      'passport.jpg',
      'Zephyr QX-100 warranty.pdf',
    ]) {
      expect(nameIsUseless(name), name).toBe(false);
    }
  });

  it('treats a name with a date and one real word as informative', () => {
    // "when" alone is useless, but "when" plus "what" is a name someone chose.
    expect(nameIsUseless('2026-08-06-invoice.pdf')).toBe(false);
  });

  it('treats an empty or extension-only name as useless', () => {
    expect(nameIsUseless('.pdf')).toBe(true);
    expect(nameIsUseless('   .jpg')).toBe(true);
  });
});

describe('cleanSlug', () => {
  it('keeps the kind + subject + date shape a model returns', () => {
    expect(cleanSlug('invoice-northern-water-2026-07')).toBe('invoice-northern-water-2026-07');
  });

  it("reduces a path to its basename — the folder is routing's decision", () => {
    expect(cleanSlug('documents/invoices/invoice-2026-07.pdf')).toBe('invoice-2026-07');
  });

  it('refuses to let a slug express a path at all', () => {
    // A slug that can say `../` is one refactor away from being used as one.
    for (const input of ['../../etc/passwd', '/etc/passwd', '..']) {
      const slug = cleanSlug(input);
      if (slug !== null) {
        expect(slug).not.toContain('/');
        expect(slug).not.toContain('.');
      }
    }
  });

  it('normalizes case, spaces and punctuation', () => {
    expect(cleanSlug('Invoice — Northern Water (July 2026)')).toBe('invoice-northern-water-july-2026');
  });

  it('folds diacritics rather than dropping the word', () => {
    expect(cleanSlug('café-münchen-2026')).toBe('cafe-munchen-2026');
  });

  it('rejects something too short to be a filename', () => {
    expect(cleanSlug('a')).toBeNull();
    expect(cleanSlug('--')).toBeNull();
    expect(cleanSlug('')).toBeNull();
  });

  it('rejects a non-string, however confidently the model returned it', () => {
    expect(cleanSlug(null)).toBeNull();
    expect(cleanSlug(42)).toBeNull();
    expect(cleanSlug({ slug: 'x' })).toBeNull();
  });

  it('caps the length, so a model answering in prose cannot make a 300-char filename', () => {
    const slug = cleanSlug('a very long answer that goes on and on '.repeat(10));
    expect(slug!.length).toBeLessThanOrEqual(80);
    expect(slug!.endsWith('-')).toBe(false);
  });
});

describe('unslug', () => {
  it('turns a title a model answered with a slug back into words', () => {
    // Seen on a real ingest of an RFC: the prompt asks for "what a person would call
    // this" and a small model echoed the slug back. The title is what every recall card
    // shows, so it is the field where a machine-shaped answer is most visible.
    expect(unslug('ip-datagrams-on-avian-carriers')).toBe('ip datagrams on avian carriers');
    expect(unslug('annual_water_statement_2026')).toBe('annual water statement 2026');
  });

  it('leaves a hyphenated title someone meant alone', () => {
    // Only fires when there is no space at all, so a real title keeps its hyphens.
    expect(unslug('Zephyr QX-100 warranty')).toBe('Zephyr QX-100 warranty');
    expect(unslug('Warranty')).toBe('Warranty');
    expect(unslug(null)).toBeNull();
  });
});
