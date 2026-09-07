import { describe, expect, it } from 'vitest';
import { proseQualifications, qualifyProseLines, hasNonfactualProse } from './prose.ts';
import { sha256 } from '../store/ids.ts';

describe('ordinary Markdown discourse', () => {
  it.each([
    ['## Hypothetical warranty scenario', 'The replacement would be covered.', 'discussion'],
    ['## Предположения о гарантии', 'Замена покрывается гарантией.', 'discussion'],
    ['## Questions', 'Which warranty applies?', 'questions'],
    ['## Plans', 'Ada Marlow will inspect the Zephyr QX-100.', 'planning'],
    ['## Conversation', 'Bo Winters: The warranty lasts five years.', 'reports'],
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
