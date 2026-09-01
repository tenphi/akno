import { describe, expect, it } from 'vitest';
import type { RetainedTime } from '@tenphi/akno-protocol';
import {
  classifyRetainedTime,
  normalizeTimelineRange,
  resolveTimelineClock,
  temporalActionable,
  temporalCurrentEligible,
  temporalDistanceFromClock,
  temporalOverlapsRange,
} from './clock.ts';

const clock = resolveTimelineClock('2031-04-12T10:00:00+02:00', 'Europe/Amsterdam');

describe('unified temporal clock', () => {
  it('admits an actual occurrence only on the reader clock day', () => {
    expect(
      temporalCurrentEligible(
        retained({ start: '2031-04-12', relation: 'occurred', status: 'actual' }),
        'completed',
        clock,
      ),
    ).toBe(true);
    expect(
      temporalCurrentEligible(
        retained({ start: '2031-04-11', relation: 'occurred', status: 'actual' }),
        'completed',
        clock,
      ),
    ).toBe(false);
  });

  it('does not treat a resolved validity interval as current', () => {
    expect(
      temporalCurrentEligible(
        retained({ start: '2031-04-01', until: '2031-04-30', relation: 'valid' }),
        'resolved',
        clock,
      ),
    ).toBe(false);
  });

  it('classifies one stored day against different read clocks without changing it', () => {
    const time = retained({ start: '2031-04-12', until: '2031-04-12' });
    expect(classifyRetainedTime(time, 'active', clock)).toBe('today');
    expect(
      classifyRetainedTime(
        time,
        'active',
        resolveTimelineClock('2031-04-13T10:00:00+02:00', 'Europe/Amsterdam'),
      ),
    ).toBe('past');
  });

  it('keeps a later instant on the same local date in today', () => {
    expect(
      classifyRetainedTime(
        retained({
          precision: 'instant',
          start: '2031-04-12T18:00:00+02:00',
          timezone: 'Europe/Amsterdam',
        }),
        'active',
        clock,
      ),
    ).toBe('today');
  });

  it('preserves partial month and year precision as a current period', () => {
    expect(classifyRetainedTime(retained({ precision: 'month', start: '2031-04' }), 'active', clock)).toBe(
      'current_period',
    );
    expect(classifyRetainedTime(retained({ precision: 'year', start: '2031' }), 'active', clock)).toBe(
      'current_period',
    );
  });

  it('keeps open validity intervals ongoing and bounded intervals timezone-aware', () => {
    expect(classifyRetainedTime(retained({ relation: 'valid', start: '2031-01-01' }), 'active', clock)).toBe(
      'ongoing',
    );
    expect(
      classifyRetainedTime(
        retained({
          precision: 'instant',
          start: '2031-03-30T01:30:00+01:00',
          until: '2031-10-26T02:30:00+01:00',
          timezone: 'Europe/Amsterdam',
        }),
        'active',
        clock,
      ),
    ).toBe('ongoing');
  });

  it('marks only accepted or active due work overdue', () => {
    const due = retained({ relation: 'due', status: 'planned', start: '2031-04-10' });
    expect(classifyRetainedTime(due, 'accepted', clock)).toBe('overdue');
    expect(classifyRetainedTime(due, 'proposed', clock)).toBe('past');
    for (const disposition of ['completed', 'cancelled', 'rejected', 'superseded'] as const) {
      expect(classifyRetainedTime(due, disposition, clock)).toBe('past');
    }
    expect(temporalActionable(due, 'accepted')).toBe(true);
    expect(temporalActionable(due, 'proposed')).toBe(false);
  });

  it('classifies a real leap day without normalizing it into March', () => {
    const leapClock = resolveTimelineClock('2032-02-29T12:00:00Z', 'UTC');
    expect(classifyRetainedTime(retained({ start: '2032-02-29' }), 'completed', leapClock)).toBe('today');
  });

  it('measures a one-boundary event as a point in its local calendar', () => {
    const queryClock = resolveTimelineClock('2031-04-12T12:00:00Z', 'UTC');
    const yesterday = temporalDistanceFromClock(
      retained({ start: '2031-04-11', timezone: 'Europe/Amsterdam' }),
      queryClock,
    );
    const tomorrow = temporalDistanceFromClock(
      retained({ start: '2031-04-13', timezone: 'Europe/Amsterdam' }),
      queryClock,
    );
    expect(yesterday).toBeGreaterThan(0);
    expect(tomorrow).toBeGreaterThan(0);
  });

  it('uses overlap semantics for partial dates and intervals', () => {
    expect(
      temporalOverlapsRange(
        retained({ precision: 'month', start: '2031-04' }),
        normalizeTimelineRange('2031-04-30', '2031-05-02'),
      ),
    ).toBe(true);
    expect(
      temporalOverlapsRange(
        retained({ precision: 'year', start: '2030' }),
        normalizeTimelineRange('2031', '2031'),
      ),
    ).toBe(false);
    expect(
      temporalOverlapsRange(
        retained({ precision: 'instant', start: '2031-04-12T00:30:00Z' }),
        normalizeTimelineRange('2031-04-11', '2031-04-11'),
        'America/Los_Angeles',
      ),
    ).toBe(true);
  });
});

function retained(overrides: Partial<RetainedTime> = {}): RetainedTime {
  return {
    precision: 'day',
    relation: 'occurred',
    status: 'actual',
    ...overrides,
  };
}
