import { describe, expect, it } from 'vitest';
import { coverageRolesSupported } from './coverage-roles.ts';

const malformed = 'Запись не определяет, покрывается ли ремонтом по гарантии ремонт двигателя.';

describe('bounded covered-repair role preservation', () => {
  it.each([
    'The record does not settle whether motor repair is covered by the warranty.',
    'Запись не определяет, покрывается ли гарантией ремонт двигателя.',
    'Неизвестно, ремонт двигателя покрывается гарантией или нет.',
  ])('holds the same local role inversion against a covered-repair source: %s', (source) => {
    expect(coverageRolesSupported(malformed, source)).toBe(false);
  });

  it.each([
    'Запись не определяет, покрывается ли гарантией ремонт двигателя.',
    'Запись не определяет, покрыт ли ремонт двигателя.',
    'Запись не определяет, покрывает ли гарантия ремонт двигателя.',
    'The record does not settle whether motor repair is covered by the warranty.',
    'Ремонтом занимается мастер; запись не определяет, покрывается ли гарантией ремонт двигателя.',
    'Покрывается ли ремонтом ущерб? Ремонт двигателя обсуждается отдельно.',
    'Покрывается ли ремонтом ущерб, а ремонт двигателя обсуждается отдельно.',
    `В примере приведено: «${malformed}»`,
  ])('defers other grammar and quoted text to the semantic verifier: %s', (text) => {
    expect(coverageRolesSupported(text, 'Whether motor repair is covered remains unknown.')).toBe(true);
  });

  it.each([
    'Запись не определяет, покрывается ли ремонтом двигатель вентилятора.',
    'Запись не устанавливает, покрывается ли ремонтом насос.',
    'Неизвестно, покрывается ли ремонтом устройство.',
  ])('holds a repair-as-instrument inversion in one unresolved coverage clause: %s', (text) => {
    expect(coverageRolesSupported(text, 'Whether motor repair is covered remains unknown.')).toBe(false);
    expect(coverageRolesSupported(text, 'Motor repair is covered. A repair covers the device.')).toBe(true);
  });

  it.each([
    'Запись не определяет результат. Покрывается ли ремонтом ущерб?',
    'Неизвестно; покрывается ли ремонтом ущерб?',
    'Запись не определяет результат, а покрывается ли ремонтом ущерб?',
    'В примере сказано: «Неизвестно, покрывается ли ремонтом устройство».',
    "В примере сказано: 'Неизвестно, покрывается ли ремонтом устройство'.",
    'В примере сказано: ‘Неизвестно, покрывается ли ремонтом устройство’.',
    'Запись не определяет, покрывается ли гарантией ремонт двигателя.',
  ])('does not borrow an uncertainty predicate across clauses: %s', (text) => {
    expect(coverageRolesSupported(text, 'Whether motor repair is covered remains unknown.')).toBe(true);
  });

  it.each([
    'The warranty covers damage to the housing.',
    'The warranty covers the device. A repair is discussed separately.',
    'Motor repair is covered. A second repair covers the first repair.',
    'Ремонт двигателя покрывается гарантией. Ущерб покрывается ремонтом.',
    'В примере сказано: «ремонт покрывается гарантией».',
  ])('does not borrow source activation from a quote or a separate covering repair: %s', (source) => {
    expect(coverageRolesSupported(malformed, source)).toBe(true);
  });
});
