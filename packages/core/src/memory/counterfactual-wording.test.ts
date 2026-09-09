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
