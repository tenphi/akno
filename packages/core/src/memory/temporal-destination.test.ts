import { describe, expect, it } from 'vitest';
import {
  pageAcceptsTemporalBoundary,
  pageTemporalBoundary,
  retainedTemporalBoundary,
} from './temporal-destination.ts';

describe('retained destination time', () => {
  it('prefers typed time over dates merely mentioned in prose', () => {
    expect(
      retainedTemporalBoundary(
        { start: '2031-05-03' },
        'The May 3, 2031 record compares a statement from April 2031.',
      ),
    ).toEqual({ start: '2031-05-03' });
  });

  it('extracts one explicit year-bearing English or ISO period and abstains across periods', () => {
    expect(
      retainedTemporalBoundary(undefined, 'On August 31, 2031, Vulpine Mutual recorded a payment.'),
    ).toEqual({ start: '2031-08-31' });
    expect(retainedTemporalBoundary(undefined, 'The 2031-08 record was finalized.')).toEqual({
      start: '2031-08',
    });
    expect(retainedTemporalBoundary(undefined, 'Compare August 2031 with July 2031.')).toBeUndefined();
  });

  it('admits only matching month and exact-day scoped pages', () => {
    const august = { start: '2031-08-31' };
    expect(pageAcceptsTemporalBoundary('records/2031-08', august)).toBe(true);
    expect(pageAcceptsTemporalBoundary('records/2031-07', august)).toBe(false);
    expect(pageAcceptsTemporalBoundary('records/2031-08-31-review', august)).toBe(true);
    expect(pageAcceptsTemporalBoundary('records/2031-08-30-review', august)).toBe(false);
    expect(pageAcceptsTemporalBoundary('records/archive', august)).toBe(true);
    expect(pageTemporalBoundary('records/2031-08')).toBe('2031-08');
    expect(pageTemporalBoundary('records/2031-08-31-review')).toBe('2031-08-31');
    expect(pageTemporalBoundary('records/archive')).toBeUndefined();
  });

  it('rejects a period page when a typed interval extends beyond it', () => {
    const interval = retainedTemporalBoundary(
      { start: '2031-08-31', until: '2031-09-02' },
      'Ada Marlow reserved the Zephyr QX-100.',
    );
    expect(interval).toEqual({ start: '2031-08-31', until: '2031-09-02' });
    expect(pageAcceptsTemporalBoundary('records/2031-08', interval)).toBe(false);
    expect(pageAcceptsTemporalBoundary('records/2031-09', interval)).toBe(false);
    expect(pageAcceptsTemporalBoundary('equipment/zephyr-qx-100', interval)).toBe(true);
  });

  it('does not mistake a date-prefixed named event for a calendar bucket', () => {
    expect(pageTemporalBoundary('travel/2031/2031-08-31-blackwater-bay')).toBeUndefined();
    expect(pageTemporalBoundary('travel/2031/2031-08-31-03-blackwater-bay')).toBeUndefined();
    expect(
      pageAcceptsTemporalBoundary('travel/2031/2031-08-31-blackwater-bay', { start: '2031-08-28' }),
    ).toBe(true);
  });
});
