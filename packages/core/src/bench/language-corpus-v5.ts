import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';

const user = (text: string): RetainSourceItem[] => [
  { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text },
];

/** The same exposed development cases and a fresh held-out set, frozen before execution. */
export const LANGUAGE_CORPUS_V5: LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
  {
    id: 'v5-held-report',
    split: 'held-out',
    language: 'mixed',
    scenario: 'nested-report',
    items: user(
      'Bo Winters сказал мне: “The Zephyr QX-100 warranty covers seal replacement.” Я пока не проверяла его слова.',
    ),
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Report\nBo Winters said the Zephyr QX-100 warranty covers seal replacement. This remains unverified.',
    ordinaryFactual: false,
    queries: {
      en: 'What did Ada Marlow report hearing about seal replacement for Zephyr QX-100?',
      ru: 'Что Ada Marlow сообщила со слов другого человека о замене уплотнения для Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unverified statement from Bo Winters about seal replacement. Preserve both people and the unverified status; do not assert actual coverage.',
  },
  {
    id: 'v5-held-hypothesis',
    split: 'held-out',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    items: user(
      'Представим для обсуждения, что гарантия Zephyr QX-100 требует ежегодной калибровки. Это выдвинутая гипотеза; реальное условие гарантии мы не установили.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Гипотеза\nГарантия Zephyr QX-100 требует ежегодной калибровки.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical calibration condition was discussed for the Zephyr QX-100 warranty?',
      ru: 'Какую гипотезу об условиях калибровки обсуждали для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Annual calibration is Ada Marlow’s unestablished hypothetical warranty condition. It must not become an actual maintenance obligation.',
  },
  {
    id: 'v5-held-counterfactual',
    split: 'held-out',
    language: 'en',
    scenario: 'counterfactual',
    items: user(
      'I declined the extended Zephyr QX-100 warranty. If I had selected that extension, a display replacement in year four would have been covered. I am describing an unrealized alternative.',
    ),
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nIf the extended Zephyr QX-100 warranty had been selected, a display replacement in year four would have been covered.',
    ordinaryFactual: false,
    queries: {
      en: 'What counterfactual warranty alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант гарантии Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Ada Marlow declined the extension. Coverage of display replacement in year four belongs only to the unrealized alternative. A separately qualified record of the declined decision is allowed.',
  },
  {
    id: 'v5-held-question',
    split: 'held-out',
    language: 'mixed',
    scenario: 'open-question',
    items: user(
      'Пока оставим открытым вопрос: does the Zephyr QX-100 warranty pay for return shipping? Ответ ещё предстоит выяснить.',
    ),
    view: 'questions',
    admission: 'writable',
    ordinary: '## Open questions\nDoes the Zephyr QX-100 warranty pay for return shipping?',
    ordinaryFactual: false,
    queries: {
      en: 'What open shipping question was recorded for the Zephyr QX-100 warranty?',
      ru: 'Какой открытый вопрос о пересылке записан для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow left return-shipping payment as an open question. Preserve the absence of an established answer and do not resolve the embedded coverage question.',
  },
  {
    id: 'v5-held-exclusion',
    split: 'held-out',
    language: 'en',
    scenario: 'factual-negation',
    items: user('The Zephyr QX-100 warranty excludes damage from spilled liquid.'),
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: 'The Zephyr QX-100 warranty excludes damage from spilled liquid.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty cover damage from spilled liquid?',
      ru: 'Покрывает ли гарантия Zephyr QX-100 повреждение из-за пролитой жидкости?',
    },
    reviewExpectation:
      'The user asserts an exclusion for spilled-liquid damage. Preserve the exclusion without adding other exclusions or independent verification.',
  },
  {
    id: 'v5-held-admission',
    split: 'held-out',
    language: 'ru',
    scenario: 'read-only-admission',
    items: user('Гарантия Zephyr QX-100 действует семь лет.'),
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: 'Гарантия Zephyr QX-100 действует семь лет.',
    ordinaryFactual: true,
    queries: {
      en: 'What warranty duration is recorded for Zephyr QX-100?',
      ru: 'Какой срок гарантии записан для Zephyr QX-100?',
    },
    reviewExpectation:
      'All destinations are read-only. Hold retention and abstain over the empty memory folder, leaving existing files unchanged.',
  },
];
