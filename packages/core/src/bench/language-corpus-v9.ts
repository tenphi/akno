import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';

/** Fresh held-out source wording, frozen before execution; development remains exposed. */
export const LANGUAGE_CORPUS_V9: LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),

  {
    id: 'v9-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters сказал мне, что гарантия Zephyr QX-100 включает замену термодатчика. Я записываю его сообщение, но сама это ещё не проверила.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    ordinary:
      '## Сообщение\nПо словам Bo Winters, гарантия Zephyr QX-100 включает замену термодатчика; сообщение не проверено.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified report did Ada Marlow record about thermal-sensor replacement for Zephyr QX-100?',
      ru: 'Что Ada Marlow записала со слов Bo Winters о замене термодатчика Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records Bo Winters’s unverified report about thermal-sensor replacement. Preserve both speakers and uncertainty without establishing actual coverage.',
  },
  {
    id: 'v9-held-hypothesis',
    language: 'en',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For discussion, suppose the Zephyr QX-100 warranty requires a seal inspection every three months. This is a hypothesis only; the actual requirement is unknown.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    ordinary: '## Hypothesis\nThe Zephyr QX-100 warranty requires a seal inspection every three months.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical seal-inspection requirement did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какую гипотезу о проверке уплотнения Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Quarterly seal inspection is only Ada Marlow’s hypothesis for discussion. Keep the interval and hypothetical status without asserting an actual obligation or inventing a scheduled inspection.',
  },
  {
    id: 'v9-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я отказалась от дополнительной гарантии Zephyr QX-100. Had I chosen that extra warranty, cooling-fan repair in the third year would have been covered. Хочу сохранить этот нереализованный вариант: дополнительную гарантию я не выбрала.',
      },
    ],
    view: 'discussion',
    ordinary:
      '## Контрфактический вариант\nЕсли бы дополнительная гарантия Zephyr QX-100 была выбрана, ремонт вентилятора на третьем году был бы покрыт.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which counterfactual extra-warranty alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант дополнительной гарантии Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Ada Marlow declined the extra warranty. Third-year cooling-fan repair belongs only to the unrealized alternative. Preserve the declined choice and counterfactual scope; a separate factual record of the decision is allowed.',
  },
  {
    id: 'v9-held-question',
    language: 'en',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I still have an open question: does the Zephyr QX-100 warranty include on-site repairs? There is no answer yet. Please keep this as an unresolved question.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes the Zephyr QX-100 warranty include on-site repairs?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which unresolved on-site repair question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о ремонте на месте Ada Marlow записала для Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unresolved question about on-site repairs. Describe that question without deciding whether the warranty includes them.',
  },
  {
    id: 'v9-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Гарантия Zephyr QX-100 не покрывает повреждения от случайно пролитой жидкости.',
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    ordinary: 'Гарантия Zephyr QX-100 не покрывает повреждения от случайно пролитой жидкости.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 warranty cover accidental liquid-spill damage?',
      ru: 'Покрывает ли гарантия Zephyr QX-100 повреждения от случайно пролитой жидкости?',
    },
    reviewExpectation:
      'The user directly denies coverage for accidental liquid-spill damage. Preserve negated polarity and the scope of that exclusion without inventing others or claiming independent verification. Ordinary factual prose with provenance metadata is allowed.',
  },
  {
    id: 'v9-held-admission',
    language: 'mixed',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Срок гарантии Zephyr QX-100 — twenty-two months.',
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    hold: true,
    ordinary: 'The Zephyr QX-100 warranty lasts twenty-two months.',
    ordinaryFactual: true,
    admission: 'read-only',
    queries: {
      en: 'What warranty duration is recorded for Zephyr QX-100?',
      ru: 'Какой срок гарантии записан для Zephyr QX-100?',
    },
    reviewExpectation:
      'All destinations are read-only. Hold retention and abstain over the empty memory folder without modifying existing files.',
  },
];
