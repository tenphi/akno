import { describe, expect, it } from 'vitest';
import { proseQualifications, qualifyProseLines, hasNonfactualProse, proseEligibleForView } from './prose.ts';
import { sha256 } from '../store/ids.ts';

describe('ordinary Markdown discourse', () => {
  it.each([
    ['- ```md', '  ## Details', '  The case is blue.'],
    ['- <!-- invented comment', '  ## Details', '  The case is blue. -->'],
  ])('does not apply headings inside a list-contained code or comment block', (...block) => {
    const q = proseQualifications(['## Hypothesis', '', ...block, '', 'The case is silver.']);
    expect(q.get(5)?.answer_eligible).toBe(false);
    expect(q.get(7)).toMatchObject({ view: 'discussion', answer_eligible: false });
  });

  it('preserves unchecked task semantics when normalizing a list with a heading', () => {
    const q = proseQualifications([
      '- [ ] Inspect the Zephyr QX-100.',
      '',
      '  ## Details',
      '',
      '  The case is silver.',
    ]);
    expect(q.get(1)).toMatchObject({ view: 'planning', answer_eligible: false });
  });

  it('keeps an enclosing hypothetical heading ahead of a list task cue', () => {
    const q = proseQualifications([
      '## Hypothesis',
      '',
      '- [ ] Inspect the Zephyr QX-100.',
      '',
      '  ## Details',
      '',
      '  The case is silver.',
    ]);
    expect(q.get(3)).toMatchObject({ view: 'discussion', answer_eligible: false });
  });

  it('does not manufacture a managed marker by removing a list bullet', () => {
    const lines = [
      '## Hypothesis',
      '',
      '- <!-- akno:item mem_invented v=2 -->',
      '  The case is silver.',
      '',
      '  ## Details',
      '',
      '  The handle is blue.',
    ];
    const q = proseQualifications(lines);
    expect(q.get(4)).toMatchObject({ view: 'discussion', answer_eligible: false });
    expect(qualifyProseLines([{ n: 4, text: lines[3]! }], lines)[0]?.prose?.answer_eligible).toBe(false);
  });

  it('applies a following qualification to the trailing paragraph inside a list', () => {
    const lines = [
      '- Notes',
      '',
      '  ## Details',
      '',
      '  The case is silver.',
      '',
      'This is only hypothetical.',
    ];
    const q = proseQualifications(lines);
    expect(q.get(5)).toMatchObject({ view: 'discussion', answer_eligible: false });
    expect(q.get(5)?.frame).toContainEqual({ n: 7, text: lines[6] });
  });

  it.each(['  ---', '  ***', '      code sample', '  <!-- invented comment -->'])(
    'does not extend a list with lazy continuation after a nonparagraph block: %s',
    (block) => {
      const q = proseQualifications(['- Notes', '', '  ## Hypothesis', '', block, 'The case is silver.']);
      expect(q.get(6)).toMatchObject({ view: 'factual', answer_eligible: true });
    },
  );

  it('keeps nested list headings local and preserves the outer qualifier', () => {
    const lines = [
      '## Hypothesis',
      '',
      '- Notes',
      '',
      '  - Details',
      '',
      '    ## Recorded',
      '',
      '    The case is blue.',
      '',
      'The lid is silver.',
    ];
    const q = proseQualifications(lines);
    expect(q.get(9)).toMatchObject({ view: 'discussion', answer_eligible: false });
    expect(q.get(11)).toMatchObject({ view: 'discussion', answer_eligible: false });
    expect(q.get(9)?.frame).toContainEqual({ n: 1, text: lines[0] });
  });

  it.each(['- Notes', '1. Notes'])(
    'keeps a list-contained heading from closing an outer hypothesis: %s',
    (item) => {
      const indent = item.startsWith('1.') ? '   ' : '  ';
      const lines = [
        '## Hypothesis',
        '',
        item,
        '',
        `${indent}## Details`,
        '',
        `${indent}The case is silver.`,
        '',
        'The case is blue.',
      ];
      const q = proseQualifications(lines);
      for (const n of [7, 9]) {
        expect(q.get(n)).toMatchObject({ view: 'discussion', answer_eligible: false });
        expect(q.get(n)?.frame).toContainEqual({ n: 1, text: lines[0] });
      }
    },
  );

  it('treats an indented heading after an empty list and blank as a document sibling', () => {
    const q = proseQualifications(['## Hypothesis', '', '-', '', '  ## Details', '', 'The case is silver.']);
    expect(q.get(7)).toMatchObject({ view: 'factual', answer_eligible: true });
  });

  it('keeps a heading directly following an empty list marker inside that item', () => {
    const q = proseQualifications([
      '## Hypothesis',
      '',
      '-',
      '  ## Details',
      '',
      '  The case is silver.',
      '',
      'The lid is blue.',
    ]);
    expect(q.get(6)?.answer_eligible).toBe(false);
    expect(q.get(8)?.answer_eligible).toBe(false);
  });

  it('ends list-local heading scope before an independent paragraph and preserves exact frame bytes', () => {
    const lines = ['- Notes', '', '  ## Hypothesis', '', '  The case is blue.', '', 'The case is silver.'];
    const q = proseQualifications(lines);
    expect(q.get(5)).toMatchObject({ view: 'discussion', answer_eligible: false });
    expect(q.get(5)?.frame).toContainEqual({ n: 3, text: '  ## Hypothesis' });
    expect(q.get(7)).toMatchObject({ view: 'factual', answer_eligible: true, frame: [] });
  });

  it('keeps a lazy paragraph continuation within a list-local hypothesis', () => {
    const q = proseQualifications([
      '- Notes',
      '',
      '  ## Hypothesis',
      '',
      '  The case is blue.',
      'The handle is silver.',
      '',
      'The case is green.',
    ]);
    expect(q.get(6)).toMatchObject({ view: 'discussion', answer_eligible: false });
    expect(q.get(8)?.answer_eligible).toBe(true);
  });

  it('recognizes a list interrupting an ordinary paragraph before its indented heading', () => {
    const q = proseQualifications([
      '## Hypothesis',
      'The case is silver.',
      '- Notes',
      '',
      '  ## Details',
      '',
      '  The handle is blue.',
      '',
      'The lid is green.',
    ]);
    expect(q.get(7)?.answer_eligible).toBe(false);
    expect(q.get(9)?.answer_eligible).toBe(false);
  });

  it.each([
    [' ## Hypothesis', 'discussion'],
    ['  ## Гипотеза', 'discussion'],
    ['   ## Assistant report', 'reports'],
    ['  ## Assistant ###', 'reports'],
    ['##\tAssistant\t###', 'reports'],
    ['  ## Гипотеза\r', 'discussion'],
  ])('keeps qualifying scope for Markdown heading whitespace: %s', (heading, view) => {
    const lines = ['# Equipment', '', heading, '', 'The case is silver.'];
    const q = proseQualifications(lines).get(5)!;
    expect(q).toMatchObject({ view, answer_eligible: false });
    expect(q.frame).toContainEqual({ n: 3, text: heading });
  });

  it.each(['##', '  ##   ', '   ## Recorded details ###'])(
    'ends a preceding scope at an empty or indented sibling heading: %s',
    (heading) => {
      const q = proseQualifications(['## Hypothesis', 'The case is silver.', heading, 'The case is blue.']);
      expect(q.get(2)?.answer_eligible).toBe(false);
      expect(q.get(3)).toMatchObject({ reason: 'heading', answer_eligible: false });
      expect(q.get(4)?.answer_eligible).toBe(true);
    },
  );

  it.each(['##Recorded details', '####### Recorded details'])(
    'does not close a qualifying scope for invalid heading syntax: %s',
    (text) => {
      const q = proseQualifications(['## Hypothesis', 'The case is silver.', text, '', 'The case is blue.']);
      expect(q.get(5)).toMatchObject({ view: 'discussion', answer_eligible: false });
    },
  );

  it('keeps headings inside a fenced example from opening scope outside it', () => {
    const q = proseQualifications(['```md', '  ## Hypothesis', '```', '', 'The case is silver.']);
    expect(q.get(2)).toMatchObject({ reason: 'example', answer_eligible: false });
    expect(q.get(5)?.answer_eligible).toBe(true);
  });

  it.each([
    ['## Hypothetical warranty scenario', 'The replacement would be covered.', 'discussion'],
    ['## Предположения о гарантии', 'Замена покрывается гарантией.', 'discussion'],
    ['## Questions', 'Which warranty applies?', 'questions'],
    ['## Plans', 'Ada Marlow will inspect the Zephyr QX-100.', 'planning'],
    ['## Conversation', 'Bo Winters: The warranty lasts five years.', 'reports'],
    ['## Assistant report', 'The case is silver.', 'reports'],
    ['## **Nested report:**', 'The case is silver.', 'reports'],
    ['## Пересказ', 'Корпус серебристый.', 'reports'],
    ['## Сообщение ассистента', 'Корпус серебристый.', 'reports'],
    ['## Preliminary versions', 'A bent guide rail causes the noise.', 'discussion'],
    ['## Possible causes ###', 'A bent guide rail causes the noise.', 'discussion'],
    ['## Предварительные версии', 'Причина шума — изогнутая направляющая.', 'discussion'],
    ['## Возможные причины', 'Причина шума — изогнутая направляющая.', 'discussion'],
  ])('keeps enclosing scope when only a later line is selected: %s', (heading, claim, view) => {
    const lines = ['# Equipment', '', heading, '', '### Details', '', claim];
    const [selected] = qualifyProseLines([{ n: 7, text: claim }], lines);
    expect(selected?.prose).toMatchObject({
      view,
      answer_eligible: false,
      source_hash: sha256(lines.join('\n')),
    });
    expect(selected?.prose?.frame).toContainEqual({ n: 3, text: heading });
  });

  it.each(['Assistant report', 'Пересказ', 'Preliminary versions', 'Предварительные версии'])(
    'closes category scope at a sibling heading: %s',
    (title) => {
      const q = proseQualifications([
        `## ${title}`,
        'The case is silver.',
        '### Details',
        'The case has a handle.',
        '## Recorded details',
        'The case is blue.',
      ]);
      expect(q.get(2)?.answer_eligible).toBe(false);
      expect(q.get(4)?.answer_eligible).toBe(false);
      expect(q.get(6)?.answer_eligible).toBe(true);
    },
  );

  it.each([
    ['Report serial number', 'The report number is 1111.'],
    ['Preliminary coating specification', 'The case is silver.'],
    ['Version 3 dimensions', 'The width is 1111 mm.'],
    ['Предварительные размеры', 'Ширина: 1111 мм.'],
    ['Пересказ: номер документа', 'Номер документа: 1111.'],
    ['`Report`', 'The case is silver.'],
    ['Rep*ort', 'The case is silver.'],
  ])('keeps descriptive factual headings eligible: %s', (title, text) => {
    expect(proseQualifications([`## ${title}`, text]).get(2)).toMatchObject({
      view: 'factual',
      answer_eligible: true,
      frame: [],
    });
  });

  it('does not treat bare category words inside ordinary data as structural scope', () => {
    const q = proseQualifications([
      '## Recorded details',
      'Document category: assistant report.',
      '',
      'The case is silver.',
    ]);
    expect(q.get(2)?.answer_eligible).toBe(true);
    expect(q.get(4)?.answer_eligible).toBe(true);
  });

  it('a sibling heading ends a scenario but nested headings do not', () => {
    const lines = [
      '## Scenario',
      'Suppose the warranty lasts five years.',
      '### Cost',
      'Replacement is covered.',
      '## Recorded details',
      'The case is silver.',
    ];
    const q = proseQualifications(lines);
    expect(q.get(4)?.answer_eligible).toBe(false);
    expect(q.get(6)?.answer_eligible).toBe(true);
  });

  it.each([
    'This was rejected; no decision was accepted.',
    'Это только гипотеза.',
    'Perhaps this is possible.',
  ])('a later paragraph qualifier governs the preceding claim: %s', (qualifier) => {
    const lines = ['The warranty lasts five years.', qualifier];
    const q = proseQualifications(lines).get(1)!;
    expect(q.answer_eligible).toBe(false);
    expect(q.frame).toContainEqual({ n: 2, text: qualifier });
  });

  it('preserves nested quotes and source fences without changing their text', () => {
    const lines = [
      '> Ada Marlow said:',
      '>> Bo Winters: the warranty lasts five years.',
      '',
      '<!-- source -->',
      'The warranty lasts ten years.',
    ];
    const qualified = qualifyProseLines(
      lines.map((text, i) => ({ n: i + 1, text })),
      lines,
    );
    expect(qualified.map((line) => line.text)).toEqual(lines);
    expect(qualified[1]?.prose?.view).toBe('reports');
    expect(qualified[4]?.prose?.answer_eligible).toBe(false);
  });

  it('keeps a speaker turn across blank lines until the next heading', () => {
    const q = proseQualifications([
      'Assistant: Suppose a warranty lasts ten years.',
      '',
      'Replacement is covered.',
      '## Recorded',
      'The case is silver.',
    ]);
    expect(q.get(3)?.answer_eligible).toBe(false);
    expect(q.get(5)?.answer_eligible).toBe(true);
  });

  it('keeps oversized frames inspectable but unresolved, never truncating them into facts', () => {
    const lines = [
      '## Hypothesis',
      ...Array.from({ length: 13 }, () => 'The warranty might last five years.'),
    ];
    expect(proseQualifications(lines).get(14)).toMatchObject({
      status: 'unresolved',
      answer_eligible: false,
      reason: 'context_limit',
      frame: [],
    });
  });

  it('rechecks the frame limit after inheriting context around a list item', () => {
    const q = proseQualifications([
      '## Hypothesis ' + 'x'.repeat(2380),
      '',
      '- Notes',
      '',
      '  ## Details',
      '',
      '  The case is silver.',
    ]).get(7)!;
    expect(q).toMatchObject({
      status: 'unresolved',
      reason: 'context_limit',
      frame: [],
      answer_eligible: false,
    });
    expect(proseEligibleForView(q, 'discussion')).toBe(false);
    expect(proseEligibleForView(q, 'all')).toBe(true);
  });

  it('binds the result to heading and neighbor bytes, not just the selected line', () => {
    const first = proseQualifications(['## Hypothesis', 'The warranty lasts five years.']).get(2)!;
    const second = proseQualifications(['## Details', 'The warranty lasts five years.']).get(2)!;
    expect(first.source_hash).not.toBe(second.source_hash);
    expect(first.answer_eligible).toBe(false);
    expect(second.answer_eligible).toBe(true);
  });

  it('keeps ordinary facts, negation, Unicode names and recurring schedules useful without a model', () => {
    const lines = [
      '# Inspection schedule',
      '',
      '- Review interval: every eleven months',
      '- Warranty: five years',
      '- Coverage excludes frost damage.',
      '- Цвет корпуса: серебристый.',
    ];
    const q = proseQualifications(lines);
    for (const n of [3, 4, 5, 6]) expect(q.get(n)?.answer_eligible).toBe(true);
    expect(hasNonfactualProse(lines.join('\n'))).toBe(false);
  });

  it('ignores headings and provenance comments when qualifying a factual summary', () => {
    const content = 'Equipment\n=========\n\n<!-- akno:curated invented -->\nThe case is silver.\n';
    expect(hasNonfactualProse(content)).toBe(false);
    expect(proseQualifications(content.split('\n')).get(5)?.answer_eligible).toBe(true);
  });

  it('does not interpret managed-looking comments inside a fenced example', () => {
    const lines = ['```md', '<!-- akno:item mem_invented v=2 -->', '- The warranty lasts five years.', '```'];
    expect(proseQualifications(lines).get(3)).toMatchObject({
      view: 'discussion',
      answer_eligible: false,
      reason: 'example',
    });
  });

  it('recognizes setext scopes and speaker headings', () => {
    expect(
      proseQualifications(['Hypothesis', '----------', 'The warranty lasts five years.']).get(3)
        ?.answer_eligible,
    ).toBe(false);
    expect(proseQualifications(['### Assistant', 'The warranty lasts five years.']).get(2)?.view).toBe(
      'reports',
    );
  });

  it.each(['This is only hypothetical.', 'Это только гипотеза.'])(
    'keeps a backward qualification across a paragraph break: %s',
    (qualifier) => {
      const q = proseQualifications(['The warranty lasts five years.', '', qualifier]).get(1)!;
      expect(q.answer_eligible).toBe(false);
      expect(q.frame).toContainEqual({ n: 3, text: qualifier });
    },
  );
});
