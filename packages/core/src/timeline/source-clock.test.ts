import { describe, expect, it } from 'vitest';
import { hasDeicticTime, hasSourceRelativeAnchor, hasUnknownReferenceClock } from './source-clock.ts';

describe('source-relative time qualification', () => {
  it.each([
    ['В следующем месяце после исходной записи без известной календарной даты.', true, true, true],
    ['Завтра относительно заметки без известной даты.', true, true, true],
    [
      'В следующем месяце после исходной записи; устройство без известной календарной даты.',
      true,
      true,
      false,
    ],
    ['Завтра относительно заметки без известного датчика.', true, true, false],
    ['Завтра относительно заметки с известной календарной датой.', true, true, false],
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
    [
      'В следующем месяце, считая от недатированной заметки; месяц календарно определить нельзя.',
      true,
      true,
      true,
    ],
    [
      'В следующем месяце, отсчитывая его от недатированной записи; календарный месяц неизвестен.',
      true,
      true,
      true,
    ],
    ['В следующем месяце, считая от проверки устройства; календарный месяц неизвестен.', true, false, true],
    ['В следующем месяце, отсчитывая его от осмотра; дата неизвестна.', true, false, true],
    [
      'Следующая неделя после недатированной исходной записи; календарная неделя неизвестна.',
      true,
      true,
      true,
    ],
    ['На следующей неделе после недатированной заметки; календарная дата неизвестна.', true, true, true],
    ['В следующем месяце после исходной записи; дата записи отсутствует.', true, true, true],
    ['На следующей неделе после осмотра устройства; исходная запись не датирована.', true, false, true],
    ['На следующей неделе после передачи устройства; календарная дата неизвестна.', true, false, true],
    ['Завтра — относительно момента недатированной исходной заметки.', true, true, true],
    ['Завтра — это относительное время из недатированной записи.', true, true, true],
    ['Завтра было записано в источнике без даты; календарная дата неизвестна.', true, true, true],
    ['Next week is measured from the undated source note, whose date is unknown.', true, true, true],
    ['Tomorrow is counted from the original recording, with an unknown date.', true, true, true],
    ['Next month is reckoned from the moment of the source note, whose date is unknown.', true, true, true],
    ['Next week is measured from device pickup; the note is undated.', true, false, true],
    ['Next week is measured from the inspection, with an unknown date.', true, false, true],
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
    [
      'Tomorrow relative to the moment of the original record; its date cannot be recovered.',
      true,
      true,
      true,
    ],
    ['Tomorrow relative to the time of that undated note.', true, true, true],
    ['Tomorrow relative to the date of the original source; the calendar date is unknown.', true, true, true],
    ['Tomorrow relative to the moment of inspection; the calendar date is unknown.', true, false, true],
    ['Tomorrow relative to the time of device pickup; the note is undated.', true, false, true],
    ['Tomorrow relative to the moment of the source; the device cannot be recovered.', true, true, false],
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
