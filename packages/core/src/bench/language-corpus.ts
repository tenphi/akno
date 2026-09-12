import type { MemoryView, RetainSourceItem } from '@tenphi/akno-protocol';

export interface LanguageCase {
  id: string;
  split: 'development' | 'held-out';
  language: 'en' | 'ru' | 'mixed';
  scenario: string;
  items: RetainSourceItem[];
  view: MemoryView;
  commitment?: string;
  disposition?: string;
  basis?: string;
  polarity?: string;
  hold?: boolean;
  ordinary: string;
  ordinaryFactual: boolean;
}

export const LANGUAGE_CORPUS_VERSION = 'language-discourse-v1';
const user = (text: string): RetainSourceItem[] => [
  { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text },
];

/** Invented, frozen expectations. Independent human adjudication is required for quality claims. */
export const LANGUAGE_CORPUS: LanguageCase[] = [
  {
    id: 'dev-assertion-en',
    split: 'development',
    language: 'en',
    scenario: 'assertion',
    items: user('The Zephyr QX-100 warranty lasts five years.'),
    view: 'factual',
    commitment: 'asserted',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty lasts five years.',
    ordinaryFactual: true,
  },
  {
    id: 'dev-assumption-ru',
    split: 'development',
    language: 'ru',
    scenario: 'hypothetical',
    items: user('Предположим, что гарантия Zephyr QX-100 действует пять лет. Это только гипотеза.'),
    view: 'discussion',
    commitment: 'hypothetical',
    ordinary: '## Гипотеза\nГарантия Zephyr QX-100 действует пять лет.',
    ordinaryFactual: false,
  },
  {
    id: 'dev-assistant-mixed',
    split: 'development',
    language: 'mixed',
    scenario: 'assistant-assertion',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Гарантия Zephyr QX-100 lasts five years. This is my unverified answer.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    ordinary: '## Conversation\nAssistant: Гарантия Zephyr QX-100 lasts five years.',
    ordinaryFactual: false,
  },
  {
    id: 'dev-tentative-ru',
    split: 'development',
    language: 'ru',
    scenario: 'tentative',
    items: user('Возможно, гарантия Zephyr QX-100 действует шесть лет, но я не уверена.'),
    view: 'discussion',
    commitment: 'tentative',
    ordinary: 'Возможно, гарантия Zephyr QX-100 действует шесть лет.',
    ordinaryFactual: false,
  },
  {
    id: 'dev-rejected-en',
    split: 'development',
    language: 'en',
    scenario: 'proposal-rejected',
    items: user(
      'I proposed buying a Zephyr QX-100 with a five-year warranty. I rejected that proposal; I have not bought it.',
    ),
    view: 'history',
    disposition: 'rejected',
    ordinary: 'The purchase of a Zephyr QX-100 was proposed.\nThe proposal was rejected.',
    ordinaryFactual: false,
  },
  {
    id: 'dev-negation-mixed',
    split: 'development',
    language: 'mixed',
    scenario: 'negation',
    items: user('My Zephyr QX-100 warranty does not cover frost damage. Повреждение от мороза исключено.'),
    view: 'factual',
    polarity: 'negated',
    ordinary: 'The Zephyr QX-100 warranty does not cover frost damage.',
    ordinaryFactual: true,
  },
  {
    id: 'dev-open-question-en',
    split: 'development',
    language: 'en',
    scenario: 'question',
    items: user(
      'Keep this open question: does the Zephyr QX-100 warranty cover saltwater damage? I have no answer.',
    ),
    view: 'questions',
    commitment: 'none',
    ordinary: '## Open questions\nDoes the Zephyr QX-100 warranty cover saltwater damage?',
    ordinaryFactual: false,
  },
  {
    id: 'dev-scheduled-ru',
    split: 'development',
    language: 'ru',
    scenario: 'explicit-time',
    items: user('Осмотр моего Zephyr QX-100 назначен на 2031-05-11. Это подтверждённая запись.'),
    view: 'planning',
    ordinary: '## Планы\nОсмотр Zephyr QX-100 назначен на 2031-05-11.',
    ordinaryFactual: false,
  },
  {
    id: 'held-counterfactual-ru',
    split: 'held-out',
    language: 'ru',
    scenario: 'counterfactual',
    items: user(
      'Если бы я выбрала гарантию Zephyr QX-100 на десять лет, замена была бы покрыта. Я знаю, что не выбрала её.',
    ),
    view: 'discussion',
    commitment: 'counterfactual',
    ordinary: '## Контрфактический сценарий\nЗамена Zephyr QX-100 была бы покрыта.',
    ordinaryFactual: false,
  },
  {
    id: 'held-nested-quotation-en',
    split: 'held-out',
    language: 'en',
    scenario: 'nested-quotation',
    items: user(
      'Bo Winters told me: “Vulpine Mutual said the Zephyr QX-100 warranty lasts seven years.” I have not checked either report.',
    ),
    view: 'reports',
    basis: 'source_report',
    ordinary: '> Ada Marlow said:\n>> Bo Winters reported a seven-year Zephyr QX-100 warranty.',
    ordinaryFactual: false,
  },
  {
    id: 'held-accepted-mixed',
    split: 'held-out',
    language: 'mixed',
    scenario: 'proposal-accepted',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I propose the seven-year warranty for my Zephyr QX-100.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я принимаю это предложение: выбираю гарантию на семь лет.',
      },
    ],
    view: 'factual',
    disposition: 'accepted',
    ordinary:
      '## Transcript\nAda Marlow: I propose a seven-year Zephyr QX-100 warranty.\n\nAda Marlow: Я принимаю предложение.',
    ordinaryFactual: false,
  },
  {
    id: 'held-correction-en',
    split: 'held-out',
    language: 'en',
    scenario: 'late-correction',
    items: user(
      'I wrote that my Zephyr QX-100 warranty lasts five years. Correction: it lasts seven years; the earlier duration was wrong.',
    ),
    view: 'factual',
    ordinary:
      '## Discussion\nThe Zephyr QX-100 warranty lasts five years.\n\nCorrection: the earlier duration was wrong.',
    ordinaryFactual: false,
  },
  {
    id: 'held-reference-ru',
    split: 'held-out',
    language: 'ru',
    scenario: 'unresolved-reference-time',
    items: user('Завтра он сделает это. Не помню, кто он и что именно нужно сделать.'),
    view: 'planning',
    hold: true,
    ordinary: '## Планы\nЗавтра он сделает это.',
    ordinaryFactual: false,
  },
  {
    id: 'held-competing-mixed',
    split: 'held-out',
    language: 'mixed',
    scenario: 'competing-hypotheses',
    items: user(
      'Two unconfirmed alternatives for Zephyr QX-100: the warranty might last four years, or it might last eight years. Ни одна гипотеза не подтверждена.',
    ),
    view: 'discussion',
    commitment: 'tentative',
    ordinary:
      '## Alternatives\nThe Zephyr QX-100 warranty might last four years.\n\nThe warranty might last eight years.',
    ordinaryFactual: false,
  },
  {
    id: 'held-fenced-en',
    split: 'held-out',
    language: 'en',
    scenario: 'fenced-example',
    items: user(
      'This is an invented example, not a real warranty: the Zephyr QX-100 warranty lasts eleven years.',
    ),
    view: 'discussion',
    ordinary: '```markdown\nThe Zephyr QX-100 warranty lasts eleven years.\n```',
    ordinaryFactual: false,
  },
  {
    id: 'held-oversized-mixed',
    split: 'held-out',
    language: 'mixed',
    scenario: 'oversized-frame',
    items: Array.from({ length: 3 }, (_, index) => ({
      item_id: `turn-${index}`,
      role: 'user',
      text:
        'This entire source is hypothetical. Это гипотеза. ' +
        'The Zephyr QX-100 warranty lasts five years. '.repeat(1000),
    })),
    view: 'discussion',
    hold: true,
    ordinary: '## Hypothesis\n' + 'Гарантия Zephyr QX-100 действует пять лет.\n'.repeat(14),
    ordinaryFactual: false,
  },
];
