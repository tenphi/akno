import { describe, expect, it } from 'vitest';
import { normalizeTimelineLedger } from './retained-timeline-ledger.ts';

describe('explicit timeline normalization', () => {
  it('places standalone and managed rows in one newest-first chronology without changing their text', () => {
    const standalone = '- **2031-04-03** | Ada Marlow completed a prototype. [[work/prototype]]';
    const future = '- **2031-05-01** | Ada Marlow booked an inspection.';
    const managed =
      '- **2030-12-20, 09:30 UTC+01:00** | *Scheduled* — Bo Winters reviews the prototype. [[work/review]] <!-- akno:timeline-item id=mem_example date=2030-12-20T09:30:00+01:00 hash=aaaaaaaaaaaa -->';
    const input = [
      '---',
      'type: timeline',
      '---',
      '',
      '# Timeline',
      '',
      'Events, newest first.',
      '',
      '## 2031',
      standalone,
      future,
      '',
      '## 2030',
      managed,
      '',
    ].join('\n');
    const output = normalizeTimelineLedger(input);
    expect(output).toContain(`## 2031\n${future}\n${standalone}\n\n## 2030\n${managed}`);
    expect(normalizeTimelineLedger(output)).toBe(output);
  });

  it('leaves a ledger with interspersed prose untouched', () => {
    const input = '# Timeline\n\n## 2031\nA private note.\n- **2031-04-03** | An event.\n';
    expect(normalizeTimelineLedger(input)).toBe(input);
  });

  it('preserves a declared year with no entries', () => {
    const input = '# Timeline\n\n## 2032\n\n## 2031\n- **2031-04-03** | An event.\n';
    expect(normalizeTimelineLedger(input)).toBe(input);
  });

  it('keeps a month-precision reference after known days in that month', () => {
    const month =
      '- **2031-04** | A month-level plan. <!-- akno:timeline-item id=mem_month date=2031-04 hash=aaaaaaaaaaaa -->';
    const day = '- **2031-04-03** | Ada Marlow completed a prototype.';
    const input = `# Timeline\n\n## 2031\n${month}\n${day}\n`;
    expect(normalizeTimelineLedger(input)).toBe(`# Timeline\n\n## 2031\n${day}\n${month}\n`);
  });
});
