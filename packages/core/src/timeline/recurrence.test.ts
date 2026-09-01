import { describe, expect, it } from 'vitest';
import type { RetainedTime } from '@tenphi/akno-protocol';
import { normalizeTimelineRange } from './clock.ts';
import { expandRetainedRecurrence } from './recurrence.ts';

describe('bounded retained recurrence', () => {
  it('keeps only the anchor when an instant recurrence has no IANA timezone', () => {
    const time: RetainedTime = {
      start: '2031-04-01T08:00:00+02:00',
      precision: 'instant',
      relation: 'scheduled',
      status: 'planned',
      recurrence: { frequency: 'daily' },
    };

    expect(expandRetainedRecurrence(time, normalizeTimelineRange('2031-04-01', '2031-04-03'), 20)).toEqual({
      occurrences: [{ time, index: 0 }],
      limited: true,
    });
  });

  it('expands only inside an explicit range and respects the result bound', () => {
    const time = retained({
      start: '2031-04-01',
      recurrence: { frequency: 'daily' },
    });
    expect(expandRetainedRecurrence(time, normalizeTimelineRange(), 20).occurrences).toHaveLength(1);
    expect(expandRetainedRecurrence(time, normalizeTimelineRange('2031-04-03'), 20)).toEqual({
      occurrences: [],
      limited: true,
    });
    const expanded = expandRetainedRecurrence(time, normalizeTimelineRange('2031-04-03', '2031-04-09'), 3);
    expect(expanded.occurrences.map((entry) => entry.time.start)).toEqual([
      '2031-04-03',
      '2031-04-04',
      '2031-04-05',
    ]);
    expect(expanded.limited).toBe(true);
  });

  it('preserves supported weekdays and explicit series end', () => {
    const time = retained({
      start: '2031-04-07',
      recurrence: { frequency: 'weekly', weekdays: ['mo', 'we'], until: '2031-04-16' },
    });
    const expanded = expandRetainedRecurrence(time, normalizeTimelineRange('2031-04-01', '2031-04-30'), 20);
    expect(expanded.occurrences.map((entry) => entry.time.start)).toEqual([
      '2031-04-07',
      '2031-04-09',
      '2031-04-14',
      '2031-04-16',
    ]);
    expect(expanded.limited).toBe(false);
  });

  it('keeps local wall time across the daylight-saving boundary', () => {
    const time = retained({
      precision: 'instant',
      start: '2031-03-29T09:00:00+01:00',
      timezone: 'Europe/Amsterdam',
      recurrence: { frequency: 'daily', until: '2031-03-31T09:00:00+02:00' },
    });
    const expanded = expandRetainedRecurrence(time, normalizeTimelineRange('2031-03-29', '2031-03-31'), 20);
    expect(expanded.occurrences.map((entry) => entry.time.start)).toEqual([
      '2031-03-29T08:00:00.000Z',
      '2031-03-30T07:00:00.000Z',
      '2031-03-31T07:00:00.000Z',
    ]);
  });

  it('skips absent yearly leap days instead of inventing a replacement date', () => {
    const time = retained({
      start: '2032-02-29',
      recurrence: { frequency: 'yearly' },
    });
    const expanded = expandRetainedRecurrence(time, normalizeTimelineRange('2032-01-01', '2036-12-31'), 20);
    expect(expanded.occurrences.map((entry) => entry.time.start)).toEqual(['2032-02-29', '2036-02-29']);
  });

  it('skips a monthly day that does not exist instead of moving it into another month', () => {
    const time = retained({
      start: '2031-01-31',
      recurrence: { frequency: 'monthly', until: '2031-04-30' },
    });
    const expanded = expandRetainedRecurrence(time, normalizeTimelineRange('2031-01', '2031-04'), 20);
    expect(expanded.occurrences.map((entry) => entry.time.start)).toEqual(['2031-01-31', '2031-03-31']);
  });
});

function retained(overrides: Partial<RetainedTime>): RetainedTime {
  return {
    precision: 'day',
    relation: 'scheduled',
    status: 'planned',
    ...overrides,
  };
}
