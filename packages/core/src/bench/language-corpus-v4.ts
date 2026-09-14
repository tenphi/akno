import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';

const user = (text: string): RetainSourceItem[] => [
  { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text },
];

/** Development remains exposed; these held-out inputs are frozen before their first runtime evaluation. */
export const LANGUAGE_CORPUS_V4: LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
  {
    id: 'v4-held-report',
    split: 'held-out',
    language: 'en',
    scenario: 'nested-report',
    items: user(
      'Bo Winters told me that the Zephyr QX-100 warranty includes dial repair. I have not verified that claim.',
    ),
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Report\nBo Winters said that the Zephyr QX-100 warranty includes dial repair; this is unverified.',
    ordinaryFactual: false,
    queries: {
      en: 'What was reported about dial repair under the Zephyr QX-100 warranty?',
      ru: 'Что сообщили по словам Ada Marlow о ремонте регулятора по гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unverified claim from Bo Winters about dial repair. Keep the outer reporter, inner speaker, and lack of verification; do not establish coverage as fact.',
  },
  {
    id: 'v4-held-hypothesis',
    split: 'held-out',
    language: 'ru',
    scenario: 'hypothetical-inspection',
    items: user(
      'Допустим, что гарантия Zephyr QX-100 требует ежеквартального осмотра. Это только гипотеза для обсуждения, а не установленное условие гарантии.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Гипотеза\nГарантия Zephyr QX-100 требует ежеквартального осмотра.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical inspection requirement was discussed for the Zephyr QX-100 warranty?',
      ru: 'Какое гипотетическое условие осмотра обсуждалось для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Quarterly inspection is only Ada Marlow’s hypothetical warranty condition. Preserve that it is unestablished and do not create an actual inspection obligation.',
  },
  {
    id: 'v4-held-counterfactual',
    split: 'held-out',
    language: 'en',
    scenario: 'counterfactual',
    items: user(
      'I did not choose the extended Zephyr QX-100 warranty. Had I chosen it, sensor replacement in year three would have been covered. That coverage is only part of the counterfactual.',
    ),
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nHad the extended Zephyr QX-100 warranty been chosen, sensor replacement in year three would have been covered.',
    ordinaryFactual: false,
    queries: {
      en: 'What counterfactual coverage scenario was discussed for Zephyr QX-100?',
      ru: 'Какой контрфактический сценарий покрытия обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow did not choose the extension. Year-three sensor replacement is covered only inside the explicitly counterfactual scenario; a separate factual denial of selection is allowed.',
  },
  {
    id: 'v4-held-question',
    split: 'held-out',
    language: 'mixed',
    scenario: 'open-question',
    items: user(
      'Оставим открытым вопрос о Zephyr QX-100: does the warranty cover plug replacement? No answer has been established.',
    ),
    view: 'questions',
    admission: 'writable',
    ordinary: '## Open questions\nDoes the Zephyr QX-100 warranty cover plug replacement?',
    ordinaryFactual: false,
    queries: {
      en: 'What open coverage question remains for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о покрытии гарантии Zephyr QX-100 остался?',
    },
    reviewExpectation:
      'Plug replacement remains an open question recorded by Ada Marlow. Do not answer the embedded coverage question yes or no.',
  },
  {
    id: 'v4-held-exclusion',
    split: 'held-out',
    language: 'en',
    scenario: 'factual-negation',
    items: user('The Zephyr QX-100 warranty does not cover hinge replacement.'),
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: 'The Zephyr QX-100 warranty does not cover hinge replacement.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty cover hinge replacement?',
      ru: 'Покрывает ли гарантия Zephyr QX-100 замену петли?',
    },
    reviewExpectation:
      'The user asserts that hinge replacement is excluded. Keep that negation without inventing other exclusions or claiming independent verification.',
  },
  {
    id: 'v4-held-admission',
    split: 'held-out',
    language: 'ru',
    scenario: 'read-only-admission',
    items: user('Гарантия Zephyr QX-100 действует три года.'),
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: 'Гарантия Zephyr QX-100 действует три года.',
    ordinaryFactual: true,
    queries: {
      en: 'What warranty duration is recorded for Zephyr QX-100?',
      ru: 'Какой срок гарантии записан для Zephyr QX-100?',
    },
    reviewExpectation:
      'All destinations are read-only. Hold retention and abstain over the empty memory folder, preserving every existing source byte.',
  },
];
