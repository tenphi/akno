import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';

/** Exposed development inputs with fresh held-out sources, frozen before execution. */
export const LANGUAGE_CORPUS_V7: LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
  {
    id: 'v7-held-report',
    split: 'held-out',
    language: 'ru',
    scenario: 'nested-report',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Со слов Bo Winters, гарантия Zephyr QX-100 предусматривает ремонт зарядного разъёма. Это пока непроверенное сообщение, которое я записываю со слов другого человека.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Сообщение\nBo Winters сообщил, что гарантия Zephyr QX-100 предусматривает ремонт зарядного разъёма; сообщение пока не проверено.',
    ordinaryFactual: false,
    queries: {
      en: 'What did Ada Marlow report hearing about charging-port repair for Zephyr QX-100?',
      ru: 'Что Ada Marlow сообщила со слов другого человека о ремонте зарядного разъёма Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unverified report from Bo Winters about charging-port repair. Preserve both people and unverified status; do not assert actual coverage.',
  },
  {
    id: 'v7-held-hypothesis',
    split: 'held-out',
    language: 'en',
    scenario: 'hypothetical-maintenance',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Suppose, solely for this discussion, that Zephyr QX-100 warranty maintenance requires quarterly lubrication. No actual maintenance obligation has been established.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Hypothesis\nThe Zephyr QX-100 warranty requires quarterly lubrication.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical lubrication obligation was discussed for the Zephyr QX-100 warranty?',
      ru: 'Какую гипотезу об обязательной смазке обсуждали для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Quarterly lubrication is only Ada Marlow’s unestablished assumption for discussion. Do not turn it into an actual obligation.',
  },
  {
    id: 'v7-held-counterfactual',
    split: 'held-out',
    language: 'mixed',
    scenario: 'counterfactual',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я отклонила расширенный сервисный план Zephyr QX-100. Следующее предложение относится только к нереализованному выбору. Had I selected that plan, motor repair in year six would have been included. The plan was not selected; this describes the counterfactual alternative.',
      },
    ],
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nHad the Zephyr QX-100 service plan been selected, motor repair in year six would have been included.',
    ordinaryFactual: false,
    queries: {
      en: 'Which counterfactual service-plan alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант сервисного плана Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Ada Marlow rejected and did not select the extended service plan. Motor repair in year six is included only within the unrealized alternative. A separate factual record of declining the plan is allowed.',
  },
  {
    id: 'v7-held-question',
    split: 'held-out',
    language: 'en',
    scenario: 'open-question',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have an unanswered question about the Zephyr QX-100 warranty: is courier collection included? Please preserve the question; we have not determined the answer.',
      },
    ],
    view: 'questions',
    admission: 'writable',
    ordinary: '## Open questions\nIs courier collection included in the Zephyr QX-100 warranty?',
    ordinaryFactual: false,
    queries: {
      en: 'What unanswered courier-collection question did Ada Marlow record for the Zephyr QX-100 warranty?',
      ru: 'Какой открытый вопрос о курьерском заборе Ada Marlow записала для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow recorded an unanswered question about courier collection under the warranty. Preserve the unresolved question without deciding whether collection is included.',
  },
  {
    id: 'v7-held-exclusion',
    split: 'held-out',
    language: 'en',
    scenario: 'factual-negation',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Zephyr QX-100 warranty excludes damage from abrasive cleaning.',
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: 'The Zephyr QX-100 warranty excludes damage from abrasive cleaning.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty cover damage from abrasive cleaning?',
      ru: 'Покрывает ли гарантия Zephyr QX-100 повреждения от абразивной очистки?',
    },
    reviewExpectation:
      'The user asserts an exclusion for damage from abrasive cleaning. Preserve negative coverage and negated metadata, without adding other exclusions or independent verification. Ordinary factual wording is allowed with provenance in metadata.',
  },
  {
    id: 'v7-held-admission',
    split: 'held-out',
    language: 'mixed',
    scenario: 'read-only-admission',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Гарантия Zephyr QX-100 действует шесть лет. This assertion belongs in the supplied read-only record.',
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: 'Гарантия Zephyr QX-100 действует шесть лет.',
    ordinaryFactual: true,
    queries: {
      en: 'How long is the Zephyr QX-100 warranty?',
      ru: 'Как долго действует гарантия Zephyr QX-100?',
    },
    reviewExpectation:
      'The assertion belongs in a read-only destination. Retention must hold and answers over the empty memory folder must abstain without modifying existing files.',
  },
];
