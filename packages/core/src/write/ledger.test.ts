import { describe, expect, it } from 'vitest';
import { formatEventLine, insertEvent, newLedger } from './ledger.ts';

/**
 * The ledger is a **source file, not a rendered view**: generating it would
 * always be tidy and would silently discard hand edits. So every one of these
 * asserts the same thing from a different angle — nothing already in the file moves.
 */
describe('insertEvent', () => {
  const ledger = [
    '# Timeline',
    '',
    '## 2026',
    '- **2026-06-02** | Renewed the lease. [[home/lease]]',
    '- **2026-03-20** | Replaced the dishwasher.',
    '',
    '## 2025',
    '- **2025-11-01** | Moved in.',
    '',
  ].join('\n');

  it('puts a newer event above the existing ones in its year', () => {
    const result = insertEvent(ledger, { date: '2026-08-06', summary: 'Booked a trip.' });
    const lines = result.content.split('\n');
    expect(lines[3]).toBe('- **2026-08-06** | Booked a trip.');
    expect(lines[result.line - 1]).toBe('- **2026-08-06** | Booked a trip.');
  });

  it('puts a backdated event in date order, not at the top', () => {
    // Recording last week's appointment today is ordinary, and putting it at the top
    // makes a newest-first ledger wrong in a way nobody notices until they read it.
    const result = insertEvent(ledger, { date: '2026-04-15', summary: 'Dentist.' });
    const lines = result.content.split('\n');
    expect(lines.indexOf('- **2026-04-15** | Dentist.')).toBe(4);
    expect(lines[3]).toBe('- **2026-06-02** | Renewed the lease. [[home/lease]]');
  });

  it('puts the oldest event of a year at the end of that year, above the blank line', () => {
    // Landing after the separator blank reads as belonging to the *next* year.
    const result = insertEvent(ledger, { date: '2026-01-02', summary: 'New year.' });
    const lines = result.content.split('\n');
    expect(lines[5]).toBe('- **2026-01-02** | New year.');
    expect(lines[6]).toBe('');
    expect(lines[7]).toBe('## 2025');
  });

  it('never reorders or rewrites what is already there', () => {
    const before = ledger.split('\n').filter((l) => l.startsWith('- **'));
    const result = insertEvent(ledger, { date: '2026-05-01', summary: 'Something.' });
    const after = result.content.split('\n').filter((l) => l.startsWith('- **'));
    // Every original line survives, in its original relative order.
    expect(after.filter((l) => before.includes(l))).toEqual(before);
  });

  it('creates a new year heading above older years', () => {
    const result = insertEvent(ledger, { date: '2027-01-05', summary: 'Next year.' });
    const lines = result.content.split('\n');
    expect(lines.indexOf('## 2027')).toBeLessThan(lines.indexOf('## 2026'));
    expect(lines[lines.indexOf('## 2027') + 1]).toBe('- **2027-01-05** | Next year.');
  });

  it('creates a new year heading below newer years', () => {
    const result = insertEvent(ledger, { date: '2024-06-01', summary: 'Earlier.' });
    const lines = result.content.split('\n');
    expect(lines.indexOf('## 2024')).toBeGreaterThan(lines.indexOf('## 2025'));
  });

  it('does not add the same line twice', () => {
    const once = insertEvent(ledger, { date: '2026-08-06', summary: 'Booked a trip.' });
    const twice = insertEvent(once.content, { date: '2026-08-06', summary: 'Booked a trip.' });
    expect(twice.content).toBe(once.content);
  });

  it('steps over a line it cannot parse rather than moving it', () => {
    const withProse = [
      '## 2026',
      'A note somebody typed here by hand.',
      '- **2026-06-02** | Renewed the lease.',
      '',
    ].join('\n');
    const result = insertEvent(withProse, { date: '2026-08-06', summary: 'Booked.' });
    const lines = result.content.split('\n');
    expect(lines).toContain('A note somebody typed here by hand.');
    // The new event goes above the event line, and the prose stays where it was.
    expect(lines.indexOf('A note somebody typed here by hand.')).toBe(1);
  });

  it('bootstraps an empty ledger', () => {
    const result = insertEvent(newLedger('2026'), { date: '2026-08-06', summary: 'First.' });
    expect(result.content).toContain('## 2026\n- **2026-08-06** | First.');
  });

  it('addresses the inserted line so it can be cited', () => {
    const result = insertEvent(ledger, { date: '2026-08-06', summary: 'Booked.' });
    expect(result.content.split('\n')[result.line - 1]).toContain('2026-08-06');
  });
});

describe('formatEventLine', () => {
  it('produces the exact shape the indexer matches', () => {
    expect(formatEventLine({ date: '2026-08-06', summary: 'Booked a trip.', slug: 'travel/2026/x' })).toBe(
      '- **2026-08-06** | Booked a trip. [[travel/2026/x]]',
    );
  });

  it('omits the link when there is no page behind the event', () => {
    expect(formatEventLine({ date: '2026-08-06', summary: 'Back from a trip.' })).toBe(
      '- **2026-08-06** | Back from a trip.',
    );
  });

  it('collapses whitespace, so a multi-line summary stays one line', () => {
    expect(formatEventLine({ date: '2026-08-06', summary: 'One\n  two   three' })).toBe(
      '- **2026-08-06** | One two three',
    );
  });
});

describe('one day, one event, however it is worded', () => {
  const ledger = [
    '# Timeline',
    '',
    '## 2026',
    '',
    '- **2026-08-08** | They watched "Wicked: For Good" in the evening.',
    '',
  ].join('\n');

  it('does not add the same event again in different words', () => {
    // Exactly what happened: two `remember` calls over one message, a minute apart, each phrasing
    // the day's event its own way. Byte comparison saw two strings; the ledger gained two lines for
    // one evening.
    const result = insertEvent(ledger, {
      date: '2026-08-08',
      summary: 'The user watched "Wicked: For Good" in the evening.',
    });
    expect(result.content).toBe(ledger);
    expect(result.line).toBe(5);
  });

  it('still adds a genuinely different event on the same day', () => {
    const result = insertEvent(ledger, { date: '2026-08-08', summary: 'The boiler was serviced.' });
    expect(result.content).toContain('The boiler was serviced.');
    expect(result.content).toContain('Wicked: For Good');
  });

  it('does not collapse a completed event into its earlier calendar entry', () => {
    const scheduled = insertEvent(ledger, {
      date: '2026-08-08',
      summary:
        'The Zephyr QX-100 launch was added to the shared calendar for a workshop at Blackwater Bay.',
    });
    const attended = insertEvent(scheduled.content, {
      date: '2026-08-08',
      summary: 'Ada Marlow attended the Zephyr QX-100 launch workshop at Blackwater Bay.',
    });

    expect(attended.content).toContain('was added to the shared calendar');
    expect(attended.content).toContain('Ada Marlow attended');
  });

  it('does not collapse the same event on two different days', () => {
    // A ledger is full of things that recur — a weekly delivery, a monthly payment. Those are
    // separate events, and only the date tells them apart.
    const result = insertEvent(ledger, {
      date: '2026-08-09',
      summary: 'They watched "Wicked: For Good" in the evening.',
    });
    expect(result.content).toContain('2026-08-09');
    expect(result.content.match(/Wicked/g)).toHaveLength(2);
  });

  it('ignores the citation when comparing', () => {
    const cited = insertEvent(ledger, {
      date: '2026-08-08',
      summary: 'They watched "Wicked: For Good" in the evening.',
      slug: 'media/wicked',
    });
    expect(cited.content).toBe(ledger);
  });
});
