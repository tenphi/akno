import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';

/** Fresh held-out source wording, frozen before execution; development remains exposed. */
export const LANGUAGE_CORPUS_V8: LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
  {
    id: 'v8-held-report',
    split: 'held-out',
    language: 'en',
    scenario: 'nested-report',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters told me that door-seal replacement is included under the Zephyr QX-100 warranty. I am recording his report; I have not checked it.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Report\nBo Winters reported that the Zephyr QX-100 warranty includes door-seal replacement; the report is unverified.',
    ordinaryFactual: false,
    queries: {
      en: 'What unverified report did Ada Marlow record about door-seal replacement for Zephyr QX-100?',
      ru: 'Что Ada Marlow сообщила со слов другого человека о замене дверного уплотнителя Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unverified report from Bo Winters about door-seal replacement. Keep both people and unverified status; do not establish actual coverage.',
  },
  {
    id: 'v8-held-hypothesis',
    split: 'held-out',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Допустим для обсуждения, что гарантия Zephyr QX-100 требует проверки фильтра каждые полгода. Это только гипотеза; настоящее обязательство не установлено.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Гипотеза\nГарантия Zephyr QX-100 требует проверки фильтра каждые полгода.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical filter-inspection requirement did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какую гипотезу о проверке фильтра Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Semiannual filter inspection is Ada Marlow’s hypothetical assumption for discussion. Preserve that scope without establishing an actual obligation.',
  },
  {
    id: 'v8-held-counterfactual',
    split: 'held-out',
    language: 'en',
    scenario: 'counterfactual',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I declined the optional service extension for Zephyr QX-100. I want to keep track of the choice I did not make. Had I accepted that extension, pump repair during year four would have been included. That is the unrealized alternative; I declined the extension.',
      },
    ],
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nHad the optional Zephyr QX-100 service extension been accepted, pump repair during year four would have been included.',
    ordinaryFactual: false,
    queries: {
      en: 'Which counterfactual service-extension alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант продления обслуживания Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Ada Marlow declined the optional extension. Pump repair during year four belongs only to the unrealized alternative. Preserve the rejection and counterfactual scope; a separate factual record of declining is allowed.',
  },
  {
    id: 'v8-held-question',
    split: 'held-out',
    language: 'ru',
    scenario: 'open-question',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Вопрос пока открыт: оплачивает ли гарантия Zephyr QX-100 доставку запчастей? Ответ ещё неизвестен; сохраним именно нерешённый вопрос.',
      },
    ],
    view: 'questions',
    admission: 'writable',
    ordinary: '## Открытый вопрос\nОплачивает ли гарантия Zephyr QX-100 доставку запчастей?',
    ordinaryFactual: false,
    queries: {
      en: 'What unresolved delivery-cost question did Ada Marlow record for the Zephyr QX-100 warranty?',
      ru: 'Какой открытый вопрос о доставке запчастей Ada Marlow записала для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unresolved question about payment for spare-part delivery. Do not decide whether delivery is paid for; describe the open question.',
  },
  {
    id: 'v8-held-exclusion',
    split: 'held-out',
    language: 'mixed',
    scenario: 'factual-negation',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: "Гарантия Zephyr QX-100 doesn't cover cosmetic discoloration.",
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: "The Zephyr QX-100 warranty doesn't cover cosmetic discoloration.",
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty cover cosmetic discoloration?',
      ru: 'Покрывает ли гарантия Zephyr QX-100 косметическое изменение цвета?',
    },
    reviewExpectation:
      'The user denies coverage for cosmetic discoloration. Preserve negative coverage and negated typed polarity, without adding other exclusions or claiming independent verification. Ordinary factual prose with metadata provenance is allowed.',
  },
  {
    id: 'v8-held-admission',
    split: 'held-out',
    language: 'en',
    scenario: 'read-only-admission',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Zephyr QX-100 warranty lasts eleven years.',
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: 'The Zephyr QX-100 warranty lasts eleven years.',
    ordinaryFactual: true,
    queries: {
      en: 'What warranty duration is recorded for Zephyr QX-100?',
      ru: 'Какой срок гарантии записан для Zephyr QX-100?',
    },
    reviewExpectation:
      'All destinations are read-only. Hold retention and abstain over the empty memory folder without modifying existing files.',
  },
];
