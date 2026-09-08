import { describe, expect, it } from 'vitest';
import { hasDeicticTime, hasSourceRelativeAnchor, hasUnknownReferenceClock } from './source-clock.ts';

describe('source-relative time qualification', () => {
  it.each([
    ['Next month refers to an undated source with an unknown calendar month.', true, true, true],
    [
      'Tomorrow refers to the moment of the undated source note; the corresponding calendar date cannot be recovered.',
      true,
      true,
      true,
    ],
    ['Next week; the calendar date is unknown because the source was undated.', true, true, true],
    ['Next week; the calendar date is unknown because the source had no date.', true, true, true],
    [
      'На следующей неделе; календарная дата неизвестна, поскольку исходная запись не датирована.',
      true,
      true,
      true,
    ],
    ['Завтра — относительно момента недатированной исходной заметки.', true, true, true],
    ['Завтра — это относительное время из недатированной записи.', true, true, true],
    ['Завтра было записано в источнике без даты; календарная дата неизвестна.', true, true, true],
    ['Next week relative to the undated original note.', true, true, true],
    ['The original note’s “next week,” with its reference date unknown.', true, true, true],
    ['Next week; the calendar date is unknown.', true, false, true],
    ['На следующей неделе; календарная дата неизвестна.', true, false, true],
    ['На следующей неделе относительно исходной недатированной записи.', true, true, true],
    ['Завтра относится к моменту той записи; дата неизвестна.', true, true, true],
    ['Next month relative to the original note; the device cannot be recovered.', true, true, false],
    ['An undated note discusses inspection.', false, false, true],
    ['Next week relative to the original note; the original note is undated.', true, true, true],
    ['Next week relative to the original note; the original note has no date.', true, true, true],
    ['Завтра относительно исходной записи; у исходной записи нет даты.', true, true, true],
    ['Завтра относительно исходной записи; дата исходной записи отсутствует.', true, true, true],
    ['Ada proposed the review; the date is unknown.', false, false, true],
    ['Ada proposed the review at a source-relative time whose date is unknown.', false, true, true],
    ['The device is undated.', false, false, false],
    ['The device has no date.', false, false, false],
  ] as const)(
    'keeps relative time, anchor and unknown clock separate: %s',
    (text, relative, anchor, unknown) => {
      expect(hasDeicticTime(text)).toBe(relative);
      expect(hasSourceRelativeAnchor(text)).toBe(anchor);
      expect(hasUnknownReferenceClock(text)).toBe(unknown);
    },
  );
});
