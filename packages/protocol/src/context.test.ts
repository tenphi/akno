import { describe, expect, it } from 'vitest';
import { AutoRecallActivation } from './ops/context.ts';

describe('auto-recall activation receipt', () => {
  it('defaults older receipts to a content-free not-needed reference state', () => {
    expect(
      AutoRecallActivation.parse({
        activated: false,
        basis: 'none',
        candidates: 0,
        selected: 0,
        qualification_run: false,
      }).reference_resolution,
    ).toBe('not_needed');
  });

  it('preserves an explicit unresolved reference state', () => {
    expect(
      AutoRecallActivation.parse({
        activated: false,
        basis: 'none',
        candidates: 2,
        selected: 0,
        qualification_run: true,
        reference_resolution: 'unresolved',
      }).reference_resolution,
    ).toBe('unresolved');
  });
});
