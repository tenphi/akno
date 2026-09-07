import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { LanguageCaseV2 } from './language-corpus-v2.ts';

const user = (text: string): RetainSourceItem[] => [
  { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text },
];

/** Fresh invented inputs; the separate review packet freezes expectations before live execution. */
export const LANGUAGE_CORPUS_V3: LanguageCaseV2[] = [
  {
    id: 'v3-dev-denial',
    split: 'development',
    language: 'ru',
    scenario: 'factual-negation',
    items: user('Гарантия Zephyr QX-100 не включает замену корпуса.'),
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: 'Гарантия Zephyr QX-100 не включает замену корпуса.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty include housing replacement?',
      ru: 'Включает ли гарантия Zephyr QX-100 замену корпуса?',
    },
    reviewExpectation:
      'The recorded user assertion excludes housing replacement. Preserve the negation; do not infer other coverage or external verification.',
  },
  {
    id: 'v3-dev-report',
    split: 'development',
    language: 'en',
    scenario: 'tentative-assistant-report',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'I suspect that the Zephyr QX-100 warranty includes sensor cleaning, but I have no confirmation.',
      },
    ],
    view: 'reports',
    commitment: 'tentative',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      'Assistant: I suspect that the Zephyr QX-100 warranty includes sensor cleaning, but I have no confirmation.',
    ordinaryFactual: false,
    queries: {
      en: 'What did the assistant report about sensor cleaning under the Zephyr QX-100 warranty?',
      ru: 'Что ассистент сообщил о чистке датчика по гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Sensor cleaning coverage is an unconfirmed assistant suspicion. Both attribution and tentative status must survive.',
  },
  {
    id: 'v3-dev-alternatives',
    split: 'development',
    language: 'mixed',
    scenario: 'incompatible-hypotheses',
    items: user(
      'Рассмотрим две несовместимые гипотезы о Zephyr QX-100: warranty service is annual, or warranty service is biennial. Neither hypothesis is established. Keep both alternatives for discussion.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary:
      '## Hypotheses\nZephyr QX-100 warranty service is annual or biennial; neither alternative is established.',
    ordinaryFactual: false,
    queries: {
      en: 'Which competing hypotheses were discussed about the Zephyr QX-100 warranty service interval?',
      ru: 'Какие конкурирующие гипотезы обсуждались об интервале гарантийного обслуживания Zephyr QX-100?',
    },
    reviewExpectation:
      'Keep both incompatible alternatives as hypotheses without choosing one or asserting an actual service interval. A useful answer identifies both alternatives.',
  },
  {
    id: 'v3-dev-example',
    split: 'development',
    language: 'ru',
    scenario: 'fictional-example',
    items: user(
      'Для обсуждения сохраним вымышленный пример: Bo Winters представляет гарантию Zephyr QX-100 на двадцать лет. Это не реальная гарантия.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Вымышленный пример\nBo Winters представляет гарантию Zephyr QX-100 на двадцать лет.',
    ordinaryFactual: false,
    queries: {
      en: 'What fictional warranty example was discussed for Zephyr QX-100?',
      ru: 'Какой вымышленный пример гарантии обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'Twenty years is only a fictional warranty imagined by Bo Winters and recorded by Ada Marlow. Preserve fictional scope and nested attribution.',
  },
  {
    id: 'v3-dev-undated',
    split: 'development',
    language: 'en',
    scenario: 'unanchored-proposal',
    items: user(
      'I propose reviewing the Zephyr QX-100 warranty tomorrow. This proposal has not been accepted; there is no scheduled review.',
    ),
    view: 'planning',
    disposition: 'proposed',
    admission: 'writable',
    ordinary: '## Proposed review\nReview the Zephyr QX-100 warranty tomorrow; this is not scheduled.',
    ordinaryFactual: false,
    queries: {
      en: 'What warranty review was proposed for Zephyr QX-100, and is its calendar date known?',
      ru: 'Какую проверку гарантии предложили для Zephyr QX-100 и известна ли её календарная дата?',
    },
    reviewExpectation:
      'An unaccepted, unscheduled proposal refers to the day after an undated source. No calendar date is known; do not resolve tomorrow from processing time.',
  },
  {
    id: 'v3-held-assertion',
    split: 'held-out',
    language: 'mixed',
    scenario: 'factual-assertion',
    items: user('Гарантия Zephyr QX-100 includes handle replacement.'),
    view: 'factual',
    commitment: 'asserted',
    admission: 'writable',
    ordinary: 'Zephyr QX-100 warranty coverage includes handle replacement.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty include handle replacement?',
      ru: 'Включает ли гарантия Zephyr QX-100 замену ручки?',
    },
    reviewExpectation:
      'The user asserts handle replacement coverage. No extra component coverage or independent verification is established.',
  },
  {
    id: 'v3-held-counterfactual',
    split: 'held-out',
    language: 'en',
    scenario: 'counterfactual',
    items: user(
      'The Zephyr QX-100 warranty was not extended. Had it been extended to fifteen years, a repair in year fourteen would have been covered. This is counterfactual.',
    ),
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nHad the Zephyr QX-100 warranty been extended to fifteen years, a repair in year fourteen would have been covered.',
    ordinaryFactual: false,
    queries: {
      en: 'What counterfactual warranty scenario was discussed for Zephyr QX-100?',
      ru: 'Какой контрфактический сценарий гарантии обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'The extension did not happen. Fifteen years and year-fourteen repair coverage belong only to the counterfactual; a separate factual denial of extension is allowed.',
  },
  {
    id: 'v3-held-question',
    split: 'held-out',
    language: 'ru',
    scenario: 'open-question',
    items: user(
      'Сохраним открытый вопрос о Zephyr QX-100: покрывает ли гарантия замену шнура? Ответ пока неизвестен.',
    ),
    view: 'questions',
    admission: 'writable',
    ordinary: '## Открытые вопросы\nПокрывает ли гарантия Zephyr QX-100 замену шнура?',
    ordinaryFactual: false,
    queries: {
      en: 'What open warranty question remains for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о гарантии Zephyr QX-100 остался?',
    },
    reviewExpectation:
      'Cord replacement coverage remains an unanswered question; neither coverage nor exclusion may be inferred.',
  },
  {
    id: 'v3-held-belief',
    split: 'held-out',
    language: 'mixed',
    scenario: 'tentative-belief',
    items: user(
      'Мне кажется, Zephyr QX-100 warranty inspections are free, but this is only a tentative belief.',
    ),
    view: 'discussion',
    commitment: 'tentative',
    admission: 'writable',
    ordinary: '## Предположение\nВозможно, гарантийные проверки Zephyr QX-100 бесплатны.',
    ordinaryFactual: false,
    queries: {
      en: 'What tentative belief was discussed about Zephyr QX-100 warranty inspections?',
      ru: 'Какое предположение обсуждалось о гарантийных проверках Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow tentatively believes warranty inspections are free. Do not establish a price or actual entitlement.',
  },
  {
    id: 'v3-held-admission',
    split: 'held-out',
    language: 'ru',
    scenario: 'read-only-admission',
    items: user('Гарантия Zephyr QX-100 включает замену кнопки.'),
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: 'Гарантия Zephyr QX-100 включает замену кнопки.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty include button replacement?',
      ru: 'Включает ли гарантия Zephyr QX-100 замену кнопки?',
    },
    reviewExpectation:
      'No writes are admitted. A safe hold and abstention over the empty memory folder are required; all existing source bytes must remain unchanged.',
  },
];
