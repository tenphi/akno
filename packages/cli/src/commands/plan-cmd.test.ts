import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePlanStatuses, parseRevision, planCommand, printPruneResult } from './plan-cmd.ts';

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

describe('plan retention output', () => {
  it('shows exact private bytes and keeps mutation explicit', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    printPruneResult({
      applied: false,
      retention: { payloadDays: 30, receiptDays: 180 },
      cutoffs: {
        payloadBefore: '2031-01-01T00:00:00.000Z',
        receiptBefore: '2030-08-04T00:00:00.000Z',
      },
      payloads: { plans: 2, items: 3, privateBytes: 1111 },
      receipts: { plans: 1, items: 1 },
    });

    const output = stdout.mock.calls.flat().join('');
    expect(output).toContain('Plan retention preview');
    expect(output).toContain('1111');
    expect(output).toContain('akno plan prune --apply');
  });
});

describe('plan revision selection', () => {
  it('accepts only a positive integer revision', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(parseRevision(undefined)).toBeUndefined();
    expect(parseRevision('2')).toBe(2);
    expect(parseRevision('0')).toBeNull();
    expect(parseRevision('1.5')).toBeNull();
    expect(stderr.mock.calls.flat().join('')).toContain('--revision must be a positive integer');
  });
});

describe('plan retry keys', () => {
  it('rejects a retry key on a read-only action before opening Akno', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(planCommand(['status', '--idempotency-key', 'status:vulpine'])).resolves.toBe(2);
    expect(stderr.mock.calls.flat().join('')).toContain(
      '--idempotency-key is available only for plan decide and plan apply',
    );
  });
});
