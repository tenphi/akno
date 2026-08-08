import { describe, expect, it } from 'vitest';

import { annotateLines } from './line-facts.ts';

/**
 * The handle `forget` takes. Before this, `forget({fact})` — the op's primary form — could not be
 * called at all: nothing in the read path returned an id, so retracting one wrong sentence meant
 * deleting the page it sat on.
 */
describe('what a line carries about its facts', () => {
  const line = (n: number, text: string) => ({ n, text });

  it('gives back the id of the fact a line produced', () => {
    const [annotated] = annotateLines(
      [line(12, 'The rent is 1450 EUR per month.')],
      [{ id: 'f_rent', line_start: 12, confidence: 0.9, valid_to: null }],
    );
    expect(annotated!.fact).toBe('f_rent');
    expect(annotated!.confidence).toBe(0.9);
  });

  it('offers no handle for a superseded fact', () => {
    // Its sentence has already been replaced. An id here points at something no longer on the line.
    const [annotated] = annotateLines(
      [line(12, 'The rent is 1400 EUR per month.')],
      [{ id: 'f_old', line_start: 12, confidence: 0.9, valid_to: '2026-09-01' }],
    );
    expect(annotated!.fact).toBeUndefined();
    expect(annotated!.confidence).toBeUndefined();
  });

  it('takes the id and the confidence from the same fact', () => {
    // One sentence can state two things. Reporting the best confidence beside a different fact's id
    // would describe a fact that does not exist.
    const [annotated] = annotateLines(
      [line(3, 'Jane is a vet and lives in Utrecht.')],
      [
        { id: 'f_job', line_start: 3, confidence: 0.6, valid_to: null },
        { id: 'f_city', line_start: 3, confidence: 0.95, valid_to: null },
      ],
    );
    expect(annotated!.fact).toBe('f_city');
    expect(annotated!.confidence).toBe(0.95);
  });

  it('leaves lines that produced nothing alone', () => {
    const lines = [line(1, '# Heading'), line(2, '')];
    expect(annotateLines(lines, [{ id: 'f_x', line_start: 99, confidence: 1, valid_to: null }])).toEqual(
      lines,
    );
    expect(annotateLines(lines, [])).toBe(lines);
  });
});
