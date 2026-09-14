import { describe, expect, it } from 'vitest';
import { hasReportUncertainty } from './report-uncertainty.ts';

const relay =
  'Ada has not read the agreement or independently checked Bo’s account and only passes on that meaning.';
const names = ['Ada Marlow', 'Bo Winters'];

describe('attribution-bound short report references', () => {
  it.each([relay, relay.replace('Bo’s', "Bo's")])('uses validated outer and nested names: %s', (text) => {
    expect(hasReportUncertainty(text, names)).toBe(true);
    expect(hasReportUncertainty(text)).toBe(false);
  });
  it.each(['Record', 'Device', 'Agreement', 'Adaline', 'Ada_2', 'AdaЖ'])(
    'rejects an unsupplied actor: %s',
    (actor) => {
      expect(hasReportUncertainty(relay.replace('Ada has', `${actor} has`), names)).toBe(false);
    },
  );
  it.each(['Ada Marlow', 'Bo Winters'])('requires both short names to be supplied: %s', (name) => {
    expect(hasReportUncertainty(relay, [name])).toBe(false);
  });
  it('does not choose between people with the same first name', () => {
    expect(hasReportUncertainty(relay, [...names, 'Ada Winters'])).toBe(false);
    expect(hasReportUncertainty(relay, [...names, 'Bo Marlow'])).toBe(false);
    expect(hasReportUncertainty(relay, [...names, ' Ada   Marlow '])).toBe(true);
  });
  it('does not use an unrelated supplied short name', () => {
    expect(hasReportUncertainty(relay, ['Bo Winters', 'Vela Marlow'])).toBe(false);
  });
});
