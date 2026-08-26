import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePlanStatuses } from './plan-cmd.ts';

afterEach(() => vi.restoreAllMocks());

describe('plan status filters', () => {
  it('accepts exact comma-separated statuses and removes duplicates', () => {
    expect(parsePlanStatuses(undefined)).toEqual([]);
    expect(parsePlanStatuses('awaiting_review, superseded,awaiting_review')).toEqual([
      'awaiting_review',
      'superseded',
    ]);
  });

  it('rejects empty and unknown statuses before opening Akno', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(parsePlanStatuses('')).toBeNull();
    expect(parsePlanStatuses('awaiting_review,invented_status')).toBeNull();
    expect(stderr.mock.calls.flat().join('')).toContain('--status must contain:');
  });
});
