import { describe, expect, it } from 'vitest';
import { hasDeicticTime, hasSourceRelativeAnchor, hasUnknownReferenceClock } from './source-clock.ts';

describe('source-relative time qualification', () => {
  it.each(['Не', 'Не\n', 'Неверно, что', 'Нельзя сказать, что', 'Якобы', 'Пример:'])(
    'does not strip a preposed qualifier from a record-time anchor: %s',
    (prefix) => {
      expect(
        hasSourceRelativeAnchor(
          `${prefix} следующий год отсчитывается от времени записи; календарный год неизвестен.`,
        ),
      ).toBe(false);
      expect(
        hasSourceRelativeAnchor(
          `${prefix} «следующий год» отсчитывается от времени записи; календарный год неизвестен.`,
        ),
      ).toBe(false);
    },
  );
  it.each([
    ['«', '»'],
    ['“', '”'],
    ['‘', '’'],
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
  ])('allows only a bare quoted clock label in a record-time anchor: %s%s', (open, close) => {
    expect(hasSourceRelativeAnchor(`${open}Следующий год${close} отсчитывается от времени записи.`)).toBe(
      true,
    );
    expect(
      hasSourceRelativeAnchor(`Пример: ${open}Следующий год отсчитывается от времени записи.${close}`),
    ).toBe(false);
    expect(hasSourceRelativeAnchor(`Следующий год ${open}не${close} отсчитывается от времени записи.`)).toBe(
      false,
    );
  });
  it.each([
    [
      '«Следующий год» отсчитывается от времени записи; календарный год восстановить нельзя.',
      true,
      true,
      true,
    ],
    ['Следующий месяц считается от времени исходной записи; дата записи неизвестна.', true, true, true],
    [
      'Следующая неделя отсчитывается от времени исходного разговора; дата разговора неизвестна.',
      true,
      true,
      true,
    ],
    ['“next year” отсчитывается от времени заметки; календарный год восстановить нельзя.', true, true, true],
    ['Следующий год отсчитывается от времени обработки; запись не датирована.', true, false, true],
    ['Следующий год отсчитывается от времени встречи; запись не датирована.', true, false, true],
    ['Следующий год отсчитывается от времени осмотра устройства; запись не датирована.', true, false, true],
    [
      'Следующий год отсчитывается от времени записи устройства; календарный год неизвестен.',
      true,
      false,
      true,
    ],
    ['Следующий год отсчитывается от времени записи', true, true, false],
    ['Следующий год не отсчитывается от времени записи; календарный год неизвестен.', true, false, true],
    [
      'Следующий год отсчитывается от времени записи, если Ada Marlow подтвердит предложение; календарный год неизвестен.',
      true,
      false,
      true,
    ],
    ['Следующий год отсчитывается от времени записи? Календарный год неизвестен.', true, false, true],
    [
      'Следующий год отсчитывается от времени записи, но на самом деле — от времени обработки; календарный год неизвестен.',
      true,
      false,
      true,
    ],
    [
      'Следующий год отсчитывается от времени записи, а не от сегодняшнего дня или момента обработки, и точный календарный год восстановить нельзя.',
      true,
      true,
      true,
    ],
    [
      'Следующий год отсчитывается от времени записи, а не от сегодняшнего дня или момента обработки, если Ada Marlow согласится; календарный год неизвестен.',
      true,
      false,
      true,
    ],
    [
      'Следующий год отсчитывается от времени записи, а не от сегодняшнего дня или момента обработки?',
      true,
      false,
      false,
    ],
    ['Следующий год «не» отсчитывается от времени записи; календарный год неизвестен.', true, false, true],
    [
      'Следующий год отсчитывается от времени «не этой» записи; календарный год неизвестен.',
      true,
      false,
      true,
    ],
    ['Время осмотра неизвестно; следующий год отсчитывается от времени обработки.', true, false, false],
    [
      '**Предложение · Предварительное:** Ada Marlow предложила в следующем году пересмотреть исключения из гарантии Zephyr QX-100, но она не приняла это как план и не назначила встречу, поэтому это остаётся её предложением; «следующий год» отсчитывается от времени записи, а не от сегодняшнего дня или времени обработки, и точный календарный год восстановить нельзя.',
      true,
      true,
      true,
    ],
    ['В следующем году относительно исходной записи; календарный год установить нельзя.', true, true, true],
    ['Календарную дату установить нельзя; следующий месяц относится к исходной записи.', true, true, true],
    ['В следующем году относительно исходной записи; компонент установить нельзя.', true, true, false],
    ['Календарный год указан, но устройство установить нельзя.', false, false, false],
    ['Календарный год установить нельзя.', false, false, true],
    ['Следующий год относится к моменту обработки; календарный год установить нельзя.', true, false, true],
    [
      'Следующий год относится к исходной записи. Пример: «календарный год установить нельзя».',
      true,
      true,
      false,
    ],
    [
      'Следующий год относится к исходной записи. Пример: "календарный год установить нельзя".',
      true,
      true,
      false,
    ],
    [
      "Следующий год относится к исходной записи. Пример: 'календарный год установить нельзя'.",
      true,
      true,
      false,
    ],
    [
      'Следующий год относится к исходной записи. Пример: `календарный год установить нельзя`.',
      true,
      true,
      false,
    ],
    [
      'Следующий год относится к исходной записи. Пример: “календарный год установить нельзя”.',
      true,
      true,
      false,
    ],
    [
      'Следующий год относится к исходной записи. Пример: ‘календарный год установить нельзя’.',
      true,
      true,
      false,
    ],
    ['Календарный год установить нельзя без разрешения пользователя.', false, false, false],
    ['Календарную дату установить нельзя, если пользователь не разрешит изменение.', false, false, false],
    [
      'Календарную дату установить нельзя, потому что пользователь запретил её задавать.',
      false,
      false,
      false,
    ],
    ['Календарную дату установить нельзя, но завтра администратор её задаст.', true, false, false],
    [
      'Календарный год установить нельзя, а “next year” относится не к сегодняшнему дню и не к моменту обработки.',
      true,
      false,
      true,
    ],
    ['Календарный год установить нельзя, а “next year” относится не к сегодняшнему дню.', true, false, false],
    [
      'Календарный год установить нельзя, а “next year” относится не к сегодняшнему дню и не к моменту обработки, если пользователь согласится.',
      true,
      false,
      false,
    ],
    [
      '**Предложение · Предварительный срок:** Ada Marlow предложила в следующем году относительно исходной записи пересмотреть исключения гарантии Zephyr QX-100, хотя календарный год установить нельзя, а “next year” относится не к сегодняшнему дню и не к моменту обработки; она заявила, что не приняла план и не организовала встречу, поэтому это осталось её предложением.',
      true,
      true,
      true,
    ],
    ['Календарный год установить нельзя; “next year” относится к исходной записи.', true, true, true],
    ['Следующий год отсчитывается от самой недатированной исходной записи.', true, true, true],
    ['Следующий месяц, считая от самой недатированной заметки.', true, true, true],
    ['Следующий месяц отсчитывается от самой проверки; запись не датирована.', true, false, true],
    ['Следующий месяц отсчитывается от самой недатированной детали.', true, false, false],
    ['Следующий месяц отсчитывается от самой. Недатированная запись рядом.', true, false, true],
    ['В следующем месяце после исходной записи без известной календарной даты.', true, true, true],
    ['Завтра относительно заметки без известной даты.', true, true, true],
    ['Завтра относительно исходной записи с неизвестной календарной датой.', true, true, true],
    ['Завтра относительно заметки с неизвестной календарной датой', true, true, true],
    ['Завтра относительно записи с неизвестной календарной датой ремонта.', true, true, false],
    ['Завтра относительно записи с неизвестной датой ремонта.', true, true, false],
    ['Завтра относительно записи; встреча с неизвестной календарной датой.', true, true, false],
    ['Завтра относительно записи; устройство с неизвестной календарной датой.', true, true, false],
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
    [
      'Next week is understood from the moment of the source record; the record has no date.',
      true,
      true,
      true,
    ],
    ['Next month is understood from this undated note.', true, true, true],
    ['“Next month” is understood from this undated note.', true, true, true],
    ['`Next month` is understood from this undated note.', true, true, true],
    ["'Next month' is understood from this undated note.", true, true, true],
    ['‘Next month’ is understood from this undated note.', true, true, true],
    [
      "Example: 'Next month is understood from the source record.' The record has no date.",
      true,
      false,
      true,
    ],
    [
      'Example: ‘Next month is understood from the source record.’ The record has no date.',
      true,
      false,
      true,
    ],
    [
      'Example: `Next month is understood from the source record.` The record has no date.',
      true,
      false,
      true,
    ],
    ['Next month is not understood from the source record; the record has no date.', true, false, true],
    ['Next month is unknown. The cause was understood from the source record.', true, false, false],
    ['Next month is understood from the source record repair; the record has no date.', true, false, true],
    [
      'Example: “Next month is understood from the source record.” The record has no date.',
      true,
      false,
      true,
    ],
    ['Next month is understood from device pickup; the note has no date.', true, false, true],
    ['Next week is understood. From the source record, the device is described.', true, false, false],
    ['Next week is understood from the moment of processing; the note is undated.', true, false, true],
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

describe('undated original-record synonym', () => {
  it.each(['первоначальной записи без даты', 'недатированной первоначальной записи'])(
    'keeps source anchoring and unknown calendar scope together: %s',
    (source) => {
      for (const text of [
        `Ada Marlow предложила пересмотр в следующем месяце относительно ${source}; календарный месяц определить невозможно.`,
        `В следующем месяце относительно ${source}, но не приняла план и не организовала встречу; календарный месяц определить невозможно.`,
        `Следующий месяц отсчитывается от времени ${source}.`,
        `«Следующая неделя» считается от ${source}.`,
      ]) {
        expect(hasSourceRelativeAnchor(text), text).toBe(true);
        expect(hasUnknownReferenceClock(text), text).toBe(true);
      }
    },
  );
  it.each([
    'В следующем месяце относительно первоначальной записи с датой.',
    'В следующем месяце относительно первоначальной обработки без даты.',
    'В следующем месяце относительно первоначальной записи. Без даты остаётся осмотр.',
    'В следующем месяце относительно первоначальной записи без даты?',
    'Не в следующем месяце относительно первоначальной записи без даты.',
    'Якобы в следующем месяце относительно первоначальной записи без даты.',
    'Если в следующем месяце относительно первоначальной записи без даты.',
    'В следующем месяце относительно первоначальной записи без даты, но на самом деле от обработки.',
    'В следующем месяце относительно первоначальной записи без даты, если Ada Marlow согласится.',
    'В следующем месяце относительно первоначальной записи без даты, но не приняла план и не организовала встречу, если это нужно.',
    'В следующем месяце относительно\nпервоначальной записи без даты.',
    ...['«»', '“”', '‘’', '""', "''", '``'].map(
      ([open, close]) =>
        `${open}В следующем месяце относительно недатированной первоначальной записи.${close}`,
    ),
  ])('does not borrow the new source clock from another scope: %s', (text) => {
    expect(hasSourceRelativeAnchor(text)).toBe(false);
  });
});

describe('English explained source-entry clock', () => {
  it.each([
    'Ada Marlow denied that next month means the month after her undated source entry.',
    'The note does not say next month means the month after her undated source entry.',
    'It is false that next month means the month after her undated source entry.',
    'Ada Marlow asked: next month means the month after her undated source entry;',
    'Ada Marlow falsely proposes reviewing terms next month, meaning the month after her undated source entry.',
    'Next month means the after her undated source entry.',
  ])('requires an affirmative clock relation: %s', (text) => {
    expect(hasSourceRelativeAnchor(text)).toBe(false);
  });
  it.each([
    'Next month means the month after her undated source entry.',
    'A proposal is recorded; next month means the month after her undated source entry.',
    'Last week means the week before his undated source entry.',
  ])('admits a standalone affirmative explanation: %s', (text) => {
    expect(hasSourceRelativeAnchor(text)).toBe(true);
    expect(hasUnknownReferenceClock(text)).toBe(true);
  });

  const original =
    'Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month, meaning the month after her undated source entry; the calendar month is impossible to determine, and she has not accepted a plan or organized a meeting.';
  const repaired =
    'Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month, meaning the month after her original source entry rather than after processing; the entry’s calendar date is unknown.';
  it.each([original, repaired])('recognizes both independent clock requirements: %s', (text) => {
    expect(hasSourceRelativeAnchor(text)).toBe(true);
    expect(hasUnknownReferenceClock(text)).toBe(true);
  });
  it('does not infer an absent source date from an original-record anchor alone', () => {
    const text = 'Next month means the month after her original source entry.';
    expect(hasSourceRelativeAnchor(text)).toBe(true);
    expect(hasUnknownReferenceClock(text)).toBe(false);
  });
  it.each([
    original.replace('her undated source entry', 'processing'),
    original.replace('her undated source entry', 'her undated entry'),
    original.replace('month after her', 'week after her'),
    original.replace('meaning the month', 'meaning she said the month'),
    original.replace('month after her', 'month after\nher'),
    original.replace('next month, meaning', 'next month does not mean'),
    original.replace('source entry;', 'source entry?'),
    original.replace('source entry;', 'source entry, but actually after processing;'),
    original.replace('Ada Marlow proposes', 'If Ada Marlow proposes'),
    ...['«»', '“”', '‘’', '""', "''", '``'].map(([open, close]) => `${open}${original}${close}`),
  ])('does not borrow a source noun across an invalid clock relation: %s', (text) => {
    expect(hasSourceRelativeAnchor(text)).toBe(false);
  });
});

describe('proposal-bound Russian source-entry explanations', () => {
  const anchor =
    'Ada Marlow предложила в следующем месяце рассмотреть условия ремонта Zephyr QX-100 — то есть в месяце после недатированной первоначальной записи, а не после обработки';
  const unknown = 'календарный месяц определить невозможно';
  const exact = `**Предложение · Предварительный срок:** ${anchor}; она не приняла план и не организовала встречу, и ${unknown}.`;

  it('admits both independent clock floors in the complete exposed draft', () => {
    expect(hasSourceRelativeAnchor(exact)).toBe(true);
    expect(hasUnknownReferenceClock(exact)).toBe(true);
    expect(hasSourceRelativeAnchor(anchor + '.')).toBe(true);
    expect(hasUnknownReferenceClock(anchor + '.')).toBe(false);
    expect(hasUnknownReferenceClock(unknown + '.')).toBe(true);
    expect(hasSourceRelativeAnchor(unknown + '.')).toBe(false);
  });

  it.each([
    anchor,
    anchor.replace(' — то есть', ', то есть'),
    anchor.replaceAll('месяце', 'году'),
    anchor.replaceAll('следующем', 'прошлом').replaceAll('после', 'до'),
    anchor.replace('Ada Marlow', 'Она'),
  ])('preserves a matching proposal period and source direction: %s', (text) => {
    expect(hasSourceRelativeAnchor(text + '.')).toBe(true);
  });

  it.each([
    `Если ${anchor}`,
    `Якобы ${anchor}`,
    `Неверно, что ${anchor}`,
    `Пример: ${anchor}`,
    `The ${anchor}`,
    `Allegedly ${anchor}`,
    anchor.replace('предложила', 'не предложила'),
    anchor.replace('предложила', 'спросила, означает ли'),
    anchor.replace('предложила', 'якобы предложила'),
    anchor.replace('то есть в месяце', 'то есть в году'),
    anchor.replace('в месяце после', 'в месяце до'),
    anchor.replace('следующем', 'прошлом'),
    anchor.replace('недатированной первоначальной записи', 'первоначальной записи'),
    anchor.replace('недатированной первоначальной записи', 'недатированной первоначальной записи устройства'),
    anchor.replace('недатированной первоначальной записи', 'обработки'),
    anchor.replace('недатированной первоначальной записи', 'недатированной\nпервоначальной записи'),
    anchor.replace('Zephyr QX-100 —', 'Zephyr QX-100 и Bo Winters подтвердил —'),
    anchor + ', но на самом деле после обработки',
    anchor + ', однако это неверно',
    anchor + ', если предложение примут',
    anchor + '; однако это неверно',
    anchor + '; Однако это неверно',
    anchor + '; и это неверно',
    anchor + '; И это неверно',
    anchor + ';\nно на самом деле после обработки',
    anchor + '?',
  ])('does not borrow or retract an explained proposal clock: %s', (text) => {
    expect(hasSourceRelativeAnchor(text + (text.endsWith('?') ? '' : '.'))).toBe(false);
  });

  it.each([
    ['«', '»'],
    ['“', '”'],
    ['‘', '’'],
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
  ])('does not extract an assertion from quoted clock prose: %s%s', (open, close) => {
    expect(hasSourceRelativeAnchor(`${open}${anchor}.${close}`)).toBe(false);
    expect(hasUnknownReferenceClock(`${open}${unknown}.${close}`)).toBe(false);
    expect(hasSourceRelativeAnchor(anchor.replace('предложила', `предложила ${open}не${close}`) + '.')).toBe(
      false,
    );
  });

  it.each([
    `Неверно, что ${unknown}.`,
    `Если ${unknown}.`,
    `Пример: ${unknown}.`,
    `Якобы ${unknown}.`,
    `${unknown}?`,
    `${unknown}; однако затем его определили.`,
    `${unknown}; Однако затем его определили.`,
    `${unknown}; и это неверно.`,
    `${unknown}; И это неверно.`,
    `${unknown};\nно затем его определили.`,
    `Если запись потеряна, и ${unknown}.`,
    `Если она не приняла план и не организовала встречу, и ${unknown}.`,
    `Неверно, что она не приняла план и не организовала встречу, и ${unknown}.`,
    `Пример: она не приняла план и не организовала встречу, и ${unknown}.`,
    `Она спросила, не приняла ли план и не организовала ли встречу, и ${unknown}.`,
    `«Если» она не приняла план и не организовала встречу, и ${unknown}.`,
    `${unknown}, но затем его установили.`,
    `${unknown}, если запись не найдут.`,
    'календарный месяц определить возможно.',
    'календарный месяц определить состояние устройства невозможно.',
    'невозможно определить состояние устройства; календарный месяц указан.',
  ])('requires a direct independently asserted unknown calendar predicate: %s', (text) => {
    expect(hasUnknownReferenceClock(text)).toBe(false);
  });
});

describe('proposal-bound initial recording clocks', () => {
  const direct =
    'Ada Marlow proposes reviewing the silverpine repair terms in the month after the initial recording, not after processing';
  const relative =
    'Ada Marlow proposes reviewing the silverpine repair terms next month relative to the initial recording, not processing';
  const date = ', but the calendar month is undetermined because the recording date is unknown';
  it.each([direct + date + '.', relative + '; the recording date and calendar month are unknown.'])(
    'keeps the two clock dimensions separate: %s',
    (text) => {
      expect(hasSourceRelativeAnchor(text)).toBe(true);
      expect(hasUnknownReferenceClock(text)).toBe(true);
    },
  );
  it('does not make an initial source anchor establish unknownness', () => {
    expect(hasSourceRelativeAnchor(direct + '.')).toBe(true);
    expect(hasUnknownReferenceClock(direct + '.')).toBe(false);
  });
  it.each([
    direct.replaceAll('after', 'before'),
    direct.replaceAll('month', 'year'),
    relative.replace('next month', 'last week'),
    relative.replace('Ada Marlow', 'She'),
    direct + '. She discussed the proposal separately',
    direct + '. And the discussion continued',
    relative + '; the proposal remained tentative',
  ])('admits a closed proposal relation with its processing contrast: %s', (text) => {
    expect(hasSourceRelativeAnchor(text + '.')).toBe(true);
  });
  it.each([
    'If ' + direct,
    'Allegedly ' + direct,
    'It is false that ' + direct,
    'Example: ' + direct,
    direct.replace('proposes', 'does not propose'),
    direct.replace('proposes', 'asked whether she proposes'),
    direct.replace('the initial recording', 'the initial device recording'),
    direct.replace('the initial recording', 'the initial recording of processing'),
    direct.replace('initial recording', 'initial\nrecording'),
    direct.replace(', not after processing', ''),
    direct.replace(', not after processing', '. Not after processing'),
    direct.replace(', not after processing', ', not before processing'),
    relative.replace('next month relative to', 'next month before'),
    relative.replace(', not processing', ', if processing is delayed'),
    direct + date.replace('calendar month', 'calendar year'),
    direct + '; but this is false',
    direct + '; and this is false',
    ...[
      '. But this is false',
      '. And that is false',
      '; HOWEVER this is false',
      '!\n Actually this is false',
      '.\n\tThis is false',
    ].flatMap((tail) => [direct + tail, relative + tail]),
    direct + ', but the source clock was processing',
    direct + '?',
    ...['«»', '“”', '‘’', '""', "''", '``'].map(([open, close]) => `${open}${direct}${close}`),
  ])('rejects a borrowed, ambiguous or retracted initial-recording relation: %s', (text) => {
    expect(hasSourceRelativeAnchor(text + '.')).toBe(false);
  });
});

describe('explicit unestablished original-record clock', () => {
  const explicit = "The original record's date and calendar month cannot be established.";
  const relation = '“Next month” means the month after the original record rather than after processing.';

  it.each(['day', 'week', 'month', 'year'])(
    'recognizes only the independently explicit unknown %s',
    (period) => {
      for (const apostrophe of ["'", '’'])
        for (const cannot of ['cannot', "can't", 'can’t']) {
          const text = explicit.replace('month', period).replace("'", apostrophe).replace('cannot', cannot);
          expect(hasUnknownReferenceClock(text)).toBe(true);
          expect(hasSourceRelativeAnchor(text)).toBe(false);
        }
      expect(hasUnknownReferenceClock(relation)).toBe(false);
      expect(hasSourceRelativeAnchor(relation)).toBe(true);
      expect(hasUnknownReferenceClock(`${relation} ${explicit}`)).toBe(true);
    },
  );

  it.each([
    explicit.replace('cannot', 'can'),
    explicit.replace('cannot', 'may not'),
    explicit.replace('original', 'device'),
    explicit.replace('original', 'processing'),
    explicit.replace('date and calendar month', 'status and calendar month'),
    explicit.replace('date and calendar month', 'date and latch gap'),
    explicit.replace("record's", "record's device's"),
    explicit.replace('date and calendar month', 'calendar month and date'),
    explicit.replace('date and', 'date; and'),
    explicit.replace('cannot be', 'cannot\nbe'),
    explicit.replace('.', '?'),
    ...['If ', 'Example: ', 'Allegedly ', 'Ada Marlow said that ', 'It is false that '].map(
      (prefix) => prefix + explicit,
    ),
    ...['«»', '“”', '‘’', '""', "''", '``'].map(([a, b]) => a + explicit + b),
    ...[
      ', but it was established.',
      '; HOWEVER it was established.',
      '.\nBut it was established.',
      '; this is false.',
    ].map((tail) => explicit.slice(0, -1) + tail),
    'The original record. Its date and calendar month cannot be established.',
    'The original record, whose calendar month cannot be established, supplies the interval.',
  ])('does not borrow a source date from a qualified or unrelated clause: %s', (text) => {
    expect(hasUnknownReferenceClock(text)).toBe(false);
  });
});
