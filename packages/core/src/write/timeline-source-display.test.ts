import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import { timelineSourceDisplay } from './timeline-source-display.ts';

describe('timeline source presentation', () => {
  const sender = 'Vulpine Mutual <no_reply@notices.example.invalid>';

  it('uses the supplied name once while preserving the listing action and qualification', () => {
    expect(
      timelineSourceDisplay(
        `${sender} lists Ada Marlow's Zephyr QX-100 plan at €33/month as renewing on 8 April 2031.`,
        sender,
      ),
    ).toEqual({
      reporter: 'Vulpine Mutual',
      body: "Lists Ada Marlow's Zephyr QX-100 plan at €33/month as renewing on 8 April 2031.",
    });
  });

  it('matches a name supplied by a mailbox without inferring a name from its domain', () => {
    expect(timelineSourceDisplay('Vulpine Mutual reports that the inspection is scheduled.', sender)).toEqual(
      {
        reporter: 'Vulpine Mutual',
        body: 'the inspection is scheduled.',
      },
    );
    expect(timelineSourceDisplay('The inspection is scheduled.', 'no_reply@notices.example.invalid')).toEqual(
      {
        reporter: 'no\\_reply@notices.example.invalid',
        body: 'The inspection is scheduled.',
      },
    );
  });

  it('removes mailbox quoting but preserves literal Markdown characters in the display name', () => {
    expect(
      timelineSourceDisplay('A source report.', '"Vulpine_Mutual [billing]" <agent@example.invalid>')
        .reporter,
    ).toBe('Vulpine\\_Mutual \\[billing\\]');
    expect(timelineSourceDisplay('A source report.', '*Vulpine* & Mutual').reporter).toBe(
      '\\*Vulpine\\* &amp; Mutual',
    );
  });

  it('escapes remaining bare addresses without editing related facts or existing Markdown', () => {
    const body =
      'The **tentative** contact is _review_@example.invalid; write to no_reply@example.invalid. ' +
      '`no_reply@example.invalid`, <no_reply@example.invalid>, and [contact](mailto:no_reply@example.invalid) are recorded. _Pending_.';
    expect(timelineSourceDisplay(body, sender).body).toBe(
      'The **tentative** contact is \\_review\\_@example.invalid; write to no\\_reply@example.invalid. ' +
        '`no_reply@example.invalid`, <no_reply@example.invalid>, and [contact](mailto:no_reply@example.invalid) are recorded. _Pending_.',
    );
  });

  it('leaves already escaped addresses stable', () => {
    const body = 'Contact no\\_reply@example.invalid.';
    expect(timelineSourceDisplay(body, sender).body).toBe(body);
    const once = timelineSourceDisplay('Contact no_reply@example.invalid.', sender).body;
    expect(timelineSourceDisplay(once, sender).body).toBe(once);
  });

  it('preserves nested links, reference links, code and HTML without rewriting their addresses', () => {
    const body =
      '[contact](https://example.invalid/a_(no_reply@example.invalid)) and [no_reply@example.invalid][contact].\n\n' +
      '``no_reply@example.invalid `literal` `` and <span data-contact="no_reply@example.invalid">contact</span>.\n\n' +
      '<no_reply@example.invalid>\n\n[contact]: mailto:no_reply@example.invalid';
    const display = timelineSourceDisplay(body, sender);
    expect(display.body).toBe(body);
    expect(fromMarkdown(display.body)).toEqual(fromMarkdown(body));
  });

  it('renders preserved underscores literally inside the qualifier and body', () => {
    const display = timelineSourceDisplay('Contact _review_@example.invalid.', '_review_@example.invalid');
    const paragraph = fromMarkdown(`*Reported by ${display.reporter}* — ${display.body}`).children[0];
    expect(paragraph?.type).toBe('paragraph');
    if (paragraph?.type !== 'paragraph') throw new Error('Expected the rendered paragraph');
    expect(paragraph.children.map(({ type }) => type)).toEqual(['emphasis', 'text']);
    const qualifier = paragraph.children[0];
    if (qualifier?.type !== 'emphasis') throw new Error('Expected the rendered qualifier');
    expect(qualifier.children[0]).toMatchObject({
      type: 'text',
      value: 'Reported by _review_@example.invalid',
    });
    expect(paragraph.children[1]).toMatchObject({
      type: 'text',
      value: ' — Contact _review_@example.invalid.',
    });
  });

  it.each([
    `${sender} did not report an inspection.`,
    `${sender} might report an inspection.`,
    `${sender} says it cannot confirm an inspection.`,
    `${sender} confirms the inspection is only scheduled.`,
    `${sender} has not listed a fixed renewal date.`,
  ])('preserves a meaning-bearing source predicate or limit: %s', (body) => {
    const display = timelineSourceDisplay(body, sender);
    expect(display.body).toBe(
      body === `${sender} says it cannot confirm an inspection.` ? 'it cannot confirm an inspection.' : body,
    );
  });

  it('retains inner reporting, disagreement and the unverified limit after an exact outer relay', () => {
    expect(
      timelineSourceDisplay(
        `${sender} reports that Bo Winters claims the inspection happened. Ada Marlow disputes this and has not verified it.`,
        sender,
        [{ speaker: 'Bo Winters' }],
      ).body,
    ).toBe('Bo Winters claims the inspection happened. Ada Marlow disputes this and has not verified it.');
  });

  it('does not shorten a display name shared by a competing chain identity', () => {
    const body = `${sender} reports that an inspection is scheduled.`;
    expect(
      timelineSourceDisplay(body, sender, [{ speaker: 'Vulpine Mutual <review@example.invalid>' }]).body,
    ).toBe(body);
    expect(
      timelineSourceDisplay('Vulpine Mutual reports that an inspection is scheduled.', sender, [
        { speaker: 'Vulpine Mutual' },
      ]).body,
    ).toBe('Vulpine Mutual reports that an inspection is scheduled.');
  });

  it('does not remove a quoted or interior identity or leave an empty body', () => {
    const quote = `“${sender} reports that the inspection happened” was rejected.`;
    expect(timelineSourceDisplay(quote, sender).body).toBe(quote);
    expect(
      timelineSourceDisplay('Ada Marlow contacted Vulpine Mutual about the inspection.', sender).body,
    ).toBe('Ada Marlow contacted Vulpine Mutual about the inspection.');
    expect(timelineSourceDisplay(`${sender} reports that `, sender).body).toBe(`${sender} reports that `);
  });

  it('preserves the historical outer-digest relay behavior and a past listing verb', () => {
    expect(
      timelineSourceDisplay("Luna's digest reports that Bo Winters scheduled an inspection.", 'Luna').body,
    ).toBe('Bo Winters scheduled an inspection.');
    expect(timelineSourceDisplay(`${sender} listed the renewal as tentative.`, sender).body).toBe(
      'Listed the renewal as tentative.',
    );
  });

  it('does not treat a malformed mailbox or a second address as one sender name', () => {
    expect(timelineSourceDisplay('A source report.', 'Vulpine Mutual <not a mailbox>').reporter).toBe(
      'Vulpine Mutual \\<not a mailbox\\>',
    );
    expect(
      timelineSourceDisplay(
        'A source report.',
        'Vulpine Mutual <first@example.invalid> <second@example.invalid>',
      ).reporter,
    ).toBe('Vulpine Mutual \\<first@example.invalid\\> \\<second@example.invalid\\>');
  });
});
