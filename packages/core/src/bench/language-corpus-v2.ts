import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { LanguageCase } from './language-corpus.ts';

export interface LanguageCaseV2 extends LanguageCase {
  admission: 'writable' | 'read-only';
  queries: { en: string; ru: string };
  reviewExpectation: string;
}

const user = (text: string): RetainSourceItem[] => [
  { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text },
];

/** Authored expectations, frozen before the first run. Independent adjudication remains pending. */
export const LANGUAGE_CORPUS_V2: LanguageCaseV2[] = [
  {
    id: 'v2-dev-report',
    split: 'development',
    language: 'mixed',
    scenario: 'tentative-assistant-report',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Я предполагаю, что Zephyr QX-100 has an eight-year warranty. This answer is unverified.',
      },
    ],
    view: 'reports',
    commitment: 'tentative',
    basis: 'source_report',
    admission: 'writable',
    ordinary: 'Assistant: The Zephyr QX-100 warranty may last eight years; this answer is unverified.',
    ordinaryFactual: false,
    queries: {
      en: 'What did the assistant report about the Zephyr QX-100 warranty?',
      ru: 'Что ассистент сообщил о гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'The assistant tentatively reported an eight-year warranty; attribution and lack of verification must both remain explicit.',
  },
  {
    id: 'v2-dev-belief',
    split: 'development',
    language: 'ru',
    scenario: 'tentative-belief',
    items: user('Я предполагаю, что срок гарантии Zephyr QX-100 составляет девять лет, но я не уверена.'),
    view: 'discussion',
    commitment: 'tentative',
    admission: 'writable',
    ordinary: '## Предположение\nГарантия Zephyr QX-100 действует девять лет.',
    ordinaryFactual: false,
    queries: {
      en: 'What tentative beliefs were discussed about the Zephyr QX-100 warranty?',
      ru: 'Какие предположения обсуждались о гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow tentatively believes the warranty lasts nine years; this is not an established duration.',
  },
  {
    id: 'v2-dev-hypothesis',
    split: 'development',
    language: 'en',
    scenario: 'conditional-hypothesis',
    items: user(
      'Suppose the Zephyr QX-100 warranty lasted seven years. In that hypothetical scenario, a repair during year six would still be covered. This is only an assumption.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Hypothetical warranty\nThe Zephyr QX-100 warranty lasts seven years.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical warranty scenario was discussed for Zephyr QX-100?',
      ru: 'Какой гипотетический сценарий гарантии обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'Seven years and the repair consequence belong to an assumed scenario, with no assertion of actual coverage.',
  },
  {
    id: 'v2-dev-question',
    split: 'development',
    language: 'en',
    scenario: 'open-question',
    items: user(
      'Keep this open question for Zephyr QX-100: Does its warranty include battery replacement? I do not have an answer yet.',
    ),
    view: 'questions',
    admission: 'writable',
    ordinary: '## Open questions\nDoes the Zephyr QX-100 warranty include battery replacement?',
    ordinaryFactual: false,
    queries: {
      en: 'What open question remains about the Zephyr QX-100 warranty?',
      ru: 'Какой открытый вопрос остался о гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Battery replacement coverage is an unanswered question; neither inclusion nor exclusion is established.',
  },
  {
    id: 'v2-held-example',
    split: 'held-out',
    language: 'en',
    scenario: 'fictional-example',
    items: user(
      'Here is a fictional example, not a real warranty record: Bo Winters imagines that the Zephyr QX-100 warranty lasts twelve years.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Fictional example\nThe Zephyr QX-100 warranty lasts twelve years.',
    ordinaryFactual: false,
    queries: {
      en: 'What fictional warranty example was discussed for Zephyr QX-100?',
      ru: 'Какой вымышленный пример гарантии обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'The twelve-year warranty belongs to an explicitly fictional example attributed to its recorded speakers.',
  },
  {
    id: 'v2-held-counterfactual',
    split: 'held-out',
    language: 'ru',
    scenario: 'counterfactual',
    items: user(
      'Гарантия Zephyr QX-100 не была продлена. Если бы её продлили до десяти лет, ремонт на девятом году был бы покрыт. Это контрфактический сценарий.',
    ),
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Контрфактический сценарий\nЕсли бы гарантию Zephyr QX-100 продлили до десяти лет, ремонт был бы покрыт.',
    ordinaryFactual: false,
    queries: {
      en: 'What counterfactual warranty scenario was discussed for Zephyr QX-100?',
      ru: 'Какой контрфактический сценарий гарантии обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'The extension did not occur. Ten years and repair coverage belong only to the counterfactual; separating the factual denial is allowed.',
  },
  {
    id: 'v2-held-plan',
    split: 'held-out',
    language: 'mixed',
    scenario: 'proposed-inspection',
    items: user(
      'Предлагаю проверить условия гарантии Zephyr QX-100 next month. This is a proposal; no inspection has been scheduled or accepted.',
    ),
    view: 'planning',
    disposition: 'proposed',
    admission: 'writable',
    ordinary: '## Proposed plan\nInspect the Zephyr QX-100 warranty terms next month.',
    ordinaryFactual: false,
    queries: {
      en: 'What warranty inspection plan was proposed for Zephyr QX-100?',
      ru: 'Какой план проверки гарантии предложен для Zephyr QX-100?',
    },
    reviewExpectation:
      'A proposed inspection remains unaccepted and unscheduled; relative time must not become an invented date.',
  },
  {
    id: 'v2-held-admission',
    split: 'held-out',
    language: 'en',
    scenario: 'read-only-admission',
    items: user('The Zephyr QX-100 warranty lasts four years.'),
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty lasts four years.',
    ordinaryFactual: true,
    queries: { en: 'How long is the Zephyr QX-100 warranty?', ru: 'Сколько длится гарантия Zephyr QX-100?' },
    reviewExpectation:
      'No destination admits writes. Holding is correct, no retained warranty answer is expected, and all existing bytes must remain unchanged.',
  },
];
