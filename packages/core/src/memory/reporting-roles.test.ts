import { describe, expect, it } from 'vitest';
import { reportingRolesSupported } from './reporting-roles.ts';

const source =
  '**Reported by Ada Marlow:** According to Bo Winters, as relayed by Ada Marlow, the inspection is permitted.';

describe('source-bound nested reporting roles', () => {
  it.each([
    'According to Bo Winters, Ada Marlow relayed that the inspection is permitted.',
    'По словам Bo Winters, Ada Marlow передала, что проверка разрешена.',
    'Со слов Bo Winters, Ada Marlow сообщила, что проверка разрешена.',
  ])('holds a novel explicit reversed relay: %s', (answer) => {
    expect(reportingRolesSupported(answer, source, 'Ada Marlow')).toBe(false);
  });

  it.each([
    'According to Ada Marlow, Bo Winters said that the inspection is permitted.',
    'По словам Ada Marlow, Bo Winters сообщил, что проверка разрешена.',
    'According to Bo Winters, as relayed by Ada Marlow, the inspection is permitted.',
    'По словам Bo Winters, которые пересказала Ada Marlow, проверка разрешена.',
    'По словам Bo Winters, Ada Marlow’s colleague сообщила, что проверка разрешена.',
    'По словам Bo Winters. Ada Marlow передала устройство.',
    'A quoted construction: «По словам Bo Winters, Ada Marlow передала, что проверка разрешена».',
    "A quoted construction: 'По словам Bo Winters, Ada Marlow передала, что проверка разрешена'.",
    'A quoted construction: ‘По словам Bo Winters, Ada Marlow передала, что проверка разрешена’.',
  ])('leaves preserved chains and other constructions to mandatory semantics: %s', (answer) => {
    expect(reportingRolesSupported(answer, source, 'Ada Marlow')).toBe(true);
  });

  it.each([
    'Ada Marlow relayed Bo Winters’s unverified report about inspection.',
    'According to Ada Marlow, Bo Winters reportedly said that inspection is permitted.',
    '**Reported by Ada Marlow:** Bo Winters reportedly said that inspection is permitted.',
  ])('binds the inner speaker from explicit cited prose: %s', (support) => {
    expect(
      reportingRolesSupported(
        'According to Bo Winters, Ada Marlow said inspection is permitted.',
        support,
        'Ada Marlow',
      ),
    ).toBe(false);
  });

  it.each([
    'An inspection report mentions Ada Marlow and Bo Winters.',
    'According to Ada Marlow, Bo Winters said inspection is permitted. According to Ada Marlow, Cy Reed said inspection is conditional.',
    'Ada Marlow relayed the technician’s unverified report about inspection.',
    'According to Ada Marlow’s colleague, Bo Winters said inspection is permitted.',
    '«According to Ada Marlow, Bo Winters said inspection is permitted.»',
    "Example: 'According to Ada Marlow, Bo Winters said inspection is permitted.'",
    'Example: ‘According to Ada Marlow, Bo Winters said inspection is permitted.’',
    `${source} According to Bo Winters, Ada Marlow said inspection is permitted.`,
  ])('does not invent a chain or suppress an explicitly supported recursive report: %s', (support) => {
    expect(
      reportingRolesSupported(
        'According to Bo Winters, Ada Marlow said inspection is permitted.',
        support,
        'Ada Marlow',
      ),
    ).toBe(true);
  });
});
