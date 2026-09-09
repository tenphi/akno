import { describe, expect, it } from 'vitest';
import { hasNominalCounterfactual } from './counterfactual-wording.ts';

const alternative =
  'Нереализованной альтернативой было дополнительное продление для Zephyr QX-100, которое в случае покупки покрывало бы ремонт двигателя.';
const variant =
  'Ada Marlow описала нереализованный вариант, при котором дополнительное продление для Zephyr QX-100 покрывало бы ремонт двигателя.';

describe('bounded nominal counterfactual wording', () => {
  it.each([alternative, variant, variant.replace('покрывало бы', 'было бы')])(
    'recognizes the same nominal conditional: %s',
    (text) => {
      expect(hasNominalCounterfactual(text)).toBe(true);
    },
  );
  it.each([
    variant.replace('нереализованный', 'реализованный'),
    variant.replace('покрывало бы', 'покрывает'),
    variant.replace(', при котором', '. При котором'),
    variant.replace(', при котором', '; при котором'),
    variant.replace(', при котором', '\nпри котором'),
    variant.replace(', при котором', ', но при котором'),
    variant.replace('дополнительное продление для', 'она назвала'),
    variant.replace('дополнительное продление для', 'Bo Winters сказал'),
    variant.replace('покрывало бы', 'покрывало. Бы'),
    ...['«»', '“”', '‘’', '""', "''", '``'].map(([open, close]) => `Пример: ${open}${variant}${close}`),
    variant.replace('нереализованный вариант', '«нереализованный вариант»'),
  ])('does not splice another clause or example into the conditional: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(false);
  });
});

describe('English and longer Russian nominal relatives', () => {
  const english =
    'Ada Marlow described an unrealized option in which purchasing the optional repair extension would have covered wheel-hub repair in the fifth year. She did not purchase the extension.';
  const russian =
    'Ada Marlow описала нереализованный вариант, при котором после покупки дополнительного продления ремонта ремонт ступицы колеса в пятом году был бы покрыт. Она это продление не приобрела.';
  it.each([english, english.replace('unrealized option', 'counterfactual alternative'), russian])(
    'admits a bounded nominal counterfactual: %s',
    (text) => expect(hasNominalCounterfactual(text)).toBe(true),
  );
  it.each([
    'This was not an unrealized option in which purchasing the extension would have covered repair.',
    'Ada Marlow denied an unrealized option in which purchasing the extension would have covered repair.',
    'It was allegedly an unrealized option in which purchasing the extension would have covered repair.',
    'The note asks whether this was an unrealized option in which purchasing the extension would have covered repair.',
    'Example: an unrealized option in which purchasing the extension would have covered repair.',
    'The note rejects this: an unrealized option in which purchasing the extension would have covered repair.',
    'Ada Marlow falsely described an unrealized option in which purchasing the extension would have covered repair.',
    'This was an unrealized option in which purchasing the extension would have covered repair, but this was false.',
    'Ada Marlow described an unrealized option in which purchasing the extension would have covered repair, allegedly.',
    'Ada Marlow described an unrealized option in which purchasing the extension would have covered repair?',
    english.replace('unrealized', 'realized'),
    english.replace('would have covered', 'covered'),
    english.replace('would have covered', 'would cover'),
    english.replace('in which', '; in which'),
    english.replace('in which', '\nin which'),
    english.replace('purchasing the optional repair extension', 'she reported the extension'),
    english.replace('purchasing the optional repair extension', 'purchasing the extension, but it'),
    english.replace('purchasing the optional repair extension', 'ordinary '.repeat(15)),
    russian.replace('был бы', 'был'),
    russian.replace('после покупки', 'она подтвердила покупку'),
    russian.replace('в пятом году', 'в пятом году, но'),
    russian.replace('после покупки', 'обычного '.repeat(15)),
    russian.replace('после покупки', 'длинного'.repeat(30) + ' '),
    ...['«»', '“”', '‘’', '""', "''", '``'].flatMap(([open, close]) => [
      `Example: ${open}${english}${close}`,
      `Пример: ${open}${russian}${close}`,
    ]),
  ])('does not borrow conditional morphology across a boundary: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(false);
  });
});

describe('complete Russian nominal counterfactual units', () => {
  const units = [
    'По словам Ada Marlow, нереализованный вариант заключался в том, что при покупке дополнительного продления ремонта ремонт двигателя в седьмом году был бы покрыт. Она это продление не приобрела, поэтому речь не идёт о её действующем покрытии.',
    'По словам Ada Marlow, нереализованный вариант заключался в том, что при покупке дополнительного продления ремонта ремонт двигателя в седьмом году был бы покрыт. Она не приобрела это продление, поэтому оно не являлось её действующим покрытием.',
    'По словам Ada Marlow, в нереализованном варианте покупка дополнительного продления ремонта для Zephyr QX-100 покрыла бы ремонт ступицы колеса в пятом году. Она не приобрела это продление, поэтому речь не идёт о её действующем покрытии.',
    'По словам Ada Marlow, нереализованный вариант состоял в том, что при покупке дополнительного продления ремонта Zephyr QX-100 ремонт ступицы колеса был бы покрыт в пятом году. Покупки не произошло, поэтому это не было её действующим покрытием.',
    'По словам Ada Marlow, в нереализованном варианте приобретение дополнительного продления для Zephyr QX-100 покрыло бы ремонт ступицы колеса в пятом году. Продление не было приобретено, поэтому это не её действующее покрытие.',
    'По словам Ada Marlow, в нереализованном варианте приобретённое дополнительное продление ремонта Zephyr QX-100 покрывало бы ремонт ступицы колеса в пятом году. Продление не было приобретено, поэтому это не её действующее покрытие.',
  ];
  it.each(
    units.flatMap((text) => [
      text,
      text + ' Этот вариант обсуждался отдельно.',
      text + ' А обсуждение продолжилось.',
    ]),
  )('keeps nominal acquisition inside the unrealized scope: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(true);
  });
  it.each(
    units.flatMap((text) => [
      text.replace('нереализованном', 'реализованном').replace('нереализованный', 'реализованный'),
      text.replace(' бы ', ' '),
      text.split('. ')[0] + '.',
      text
        .replace(' не приобрела ', ' приобрела ')
        .replace(' не приобрела,', ' приобрела,')
        .replace('не произошло', 'произошло')
        .replace('не было приобретено', 'было приобретено'),
      text.split(', поэтому')[0] + '.',
      text
        .replace('действующее покрытие', 'покрытие вообще')
        .replace('действующим покрытием', 'покрытием вообще')
        .replace('действующем покрытии', 'покрытии вообще'),
      'Если ' + text,
      'Пример: ' + text,
      'Неверно, что ' + text,
      text.replace('. ', '; '),
      text.replace('. ', '.\n'),
      text.slice(0, -1) + ', но это неверно.',
      ...[
        '. Но это неверно.',
        '. А это неверно.',
        '; ОДНАКО это неверно.',
        '!\n На самом деле это неверно.',
        '.\n\tЭто неверно.',
      ].map((tail) => text.slice(0, -1) + tail),
      text
        .replace('покрыла бы', 'покрыла, и Bo Winters сказал бы')
        .replace('покрыло бы', 'покрыло, и Bo Winters сказал бы')
        .replace('покрывало бы', 'покрывало, и Bo Winters сказал бы')
        .replace('был бы покрыт', 'был, и Bo Winters был бы покрыт'),
      ...['«»', '“”', '‘’', '""', "''", '``'].map(([open, close]) => `${open}${text}${close}`),
    ]),
  )('requires the complete bound unit and actual-world closure: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(false);
  });
});

describe('named acquisition counterfactual closure', () => {
  const direct =
    'По словам Ada Marlow, нереализованный вариант заключался в том, что приобретение продления silverpine покрыло бы ремонт двигателя в седьмом году. Ada Marlow его не приобрела, поэтому это не было её действующим покрытием.';
  const infinitive =
    'По словам Ada Marlow, нереализованный вариант состоял в том, чтобы приобрести продление silverpine: в таком случае ремонт двигателя был бы покрыт в седьмом году. Ada Marlow не приобрела это продление, поэтому оно не являлось её действующим покрытием.';
  const units = [direct, infinitive];
  it.each(
    units.flatMap((text) => [
      text,
      text.replace('заключался', 'состоял').replace('состоял в том, чтобы', 'заключался в том, чтобы'),
      text.replace('По словам Ada Marlow, ', ''),
      text.replaceAll('Ada Marlow', 'Bo Winters'),
      text + ' Обсуждение продолжилось.',
    ]),
  )('recognizes a complete named unit: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(true);
  });
  it.each(
    units.flatMap((text) => [
      text.replace('нереализованный', 'реализованный'),
      text.replace(' бы ', ' '),
      text.replace('. Ada Marlow', '. Bo Winters'),
      text.replace('. Ada Marlow', '. Она'),
      text.replace('не приобрела', 'приобрела'),
      text.replace('не приобрела', 'не сообщила о покупке'),
      text.split('. Ada')[0] + '.',
      text.split(', поэтому')[0] + '.',
      text.replace('действующим покрытием', 'покрытием вообще'),
      text.replace('не было', 'было').replace('не являлось', 'являлось'),
      text
        .replace('приобретение', 'сообщил приобретение')
        .replace('продление silverpine:', 'продление silverpine, но Bo Winters сообщил:'),
      text
        .replace('продления silverpine', 'продления ' + 'длинного '.repeat(16) + 'silverpine')
        .replace('продление silverpine', 'продление ' + 'длинного '.repeat(16) + 'silverpine'),
      text.replace('. Ada Marlow', '; Ada Marlow'),
      text.replace('. Ada Marlow', '.\nAda Marlow'),
      'Если ' + text,
      'Пример: ' + text,
      'Не\n' + text,
      'Неверно, что ' + text,
      ...['«»', '“”', '‘’', '""', "''", '``'].map(([open, close]) => `${open}${text}${close}`),
      text.slice(0, -1) + ', но это неверно.',
      text + ' Но это неверно.',
      text + ' На самом деле покупка произошла.',
    ]),
  )('does not borrow a label, actor or retracted closure: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(false);
  });
  it.each([
    infinitive.replace(': в таком случае', '. В таком случае'),
    infinitive.replace(': в таком случае', '; в таком случае'),
    infinitive.replace(': в таком случае', ': другой пример'),
    infinitive.replace(': в таком случае', ':\nв таком случае'),
    infinitive.replace('чтобы приобрести', 'что имеется'),
  ])('requires the literal acquisition-to-consequence bridge: %s', (text) => {
    expect(hasNominalCounterfactual(text)).toBe(false);
  });
});
