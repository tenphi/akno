import { describe, expect, it } from 'vitest';
import { extractDocumentDates } from './documents.ts';

describe('document timeline dates', () => {
  it('recognizes conservative ISO and English calendar dates', () => {
    const dates = extractDocumentDates(
      'Checked 2031-04-05, renewed 5 April 2032, and closed April 6th, 2033.',
    );
    expect(dates.map((entry) => entry.date)).toEqual(['2031-04-05', '2032-04-05', '2033-04-06']);
  });

  it('rejects impossible dates instead of normalizing them into another month', () => {
    const dates = extractDocumentDates('Not 2031-02-30, 31 April 2031, or February 29, 2031.');
    expect(dates).toEqual([]);
  });
});
