import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V16 } from './language-corpus-v16.ts';

/** Exposed v16 sources become development; new held-out sources freeze before execution. */
export const LANGUAGE_CORPUS_V17: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V16.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),
  {
    id: 'v17-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have arranged no shipment. Bo Winters told me the Zephyr QX-100 terms allow the device to be sent away to measure hinge resistance.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Речь шла об измерении сопротивления шарнира, а не о замене шарнира. Я, Ada Marlow, только пересказываю Bo Winters: условия не читала и подтверждения не получала.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified hinge-resistance service report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое неподтверждённое сообщение об измерении сопротивления шарнира Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve recorder Ada Marlow, inner speaker Bo Winters, no inspected terms or confirmation, permitted shipment of the device for hinge-resistance measurement rather than hinge replacement, and no arranged shipment. No actual shipment or booking follows. Keep the measurement/replacement contrast in the same scoped memory.',
  },
  {
    id: 'v17-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для обсуждения я, Ada Marlow, допускаю, что у Zephyr QX-100 нужно проверять датчик температуры каждый месяц. Если принять эту гипотезу, пропущенная проверка нарушала бы именно предполагаемое правило.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Это гипотеза. Настоящие требования нам неизвестны; о реально пропущенной проверке я не сообщаю.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical temperature-sensor check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило проверки датчика температуры Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the assumed monthly temperature-sensor check and its stated conditional missed-inspection consequence, attributed to Ada Marlow. Actual requirements and any actual missed inspection remain unknown. Frequency is not a dated event.',
  },
  {
    id: 'v17-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The enhanced Zephyr QX-100 warranty was an option I, Ada Marlow, explicitly declined. I did not buy it, and that decision is final.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я выбрала эту гарантию, ремонт кнопки управления в шестом году был бы включён. Это нереализованный вариант, а не реально имеющееся у меня покрытие.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What counterfactual control-button repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант ремонта кнопки управления Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retain the actual rejection/nonpurchase and the unrealized sixth-year control-button repair coverage as separately qualified records or one fully scoped discussion record. The conditional coverage is counterfactual, never actual. A focused discussion answer preserves the alternative and nonacceptance.',
  },
  {
    id: 'v17-held-question',
    language: 'en',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, still have no answer to this question: does the Zephyr QX-100 agreement include returning the device after repairs?',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The question remains open. Neither coverage nor exclusion of the return delivery is established.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which open return-delivery question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос об обратной доставке устройства Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s unanswered question about return delivery of the device after repairs. Do not answer the embedded question or infer a delivery arrangement or exclusion. Describing the recorded open question is useful.',
  },
  {
    id: 'v17-held-exclusion',
    language: 'mixed',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, утверждаю: договор обслуживания Zephyr QX-100 не покрывает замену защитной крышки. This exclusion says nothing about repairing the display cable.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 service agreement cover replacing the protective cover?',
      ru: 'Покрывает ли договор обслуживания Zephyr QX-100 замену защитной крышки?',
    },
    reviewExpectation:
      'Preserve the direct user assertion excluding replacement of the protective cover; it does not settle display-cable repair. Keep the action and component distinct and do not broaden the exclusion. A direct attributed denial is useful without claiming independent verification.',
  },
  {
    id: 'v17-held-assistant',
    language: 'ru',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Это предварительная версия ассистента, а не проверенное условие: обслуживание Zephyr QX-100, возможно, включает проверку индикатора дважды в год. Я не изучал договор и не проверял это предположение.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative indicator-check report did the assistant give for Zephyr QX-100?',
      ru: 'Какое предварительное сообщение о проверке индикатора Zephyr QX-100 дал ассистент?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative interpretation, twice-yearly indicator checks and no contract verification. This is an unverified assistant report, not an established requirement or a fictional stipulation.',
  },
  {
    id: 'v17-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'В вымышленном примере, который я, Ada Marlow, предлагаю обсудить, Vulpine Mutual обещает Bo Winters бесплатную замену ручки для Zephyr QX-100 в первые три месяца владения.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Bo Winters in this example is a character. The promise is part of the fiction; no real agreement is being reported.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional handle-replacement example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример с заменой ручки Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder and the fictional promise from Vulpine Mutual to character Bo Winters of free handle replacement in the first three ownership months. Keep product and duration; do not establish a real promise or dated schedule. Fictional Bo is not an additional reporter.',
  },
  {
    id: 'v17-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The offer was to send Zephyr QX-100 to the workshop to inspect its power switch. I, Ada Marlow, rejected the offer; sending it is not my plan.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Collection of the device has not been booked. This is a record of an offer that was declined.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which power-switch inspection offer did Ada Marlow decline for Zephyr QX-100?',
      ru: 'Какое предложение об осмотре выключателя питания Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the explicitly rejected workshop-shipment and power-switch inspection proposal, no shipment plan and no scheduled pickup. A focused answer may describe the explicit rejection without redundant no-plan wording. Do not create an active plan or completed inspection.',
  },
  {
    id: 'v17-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'My proposal is to review the Zephyr QX-100 service transfer terms next month. I, Ada Marlow, have not accepted a plan or arranged a meeting; I am only proposing this.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Исходная заметка не датирована. Следующий месяц отсчитывается от момента этой заметки, а не от дня обработки; календарный месяц определить невозможно.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated transfer-terms proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о проверке условий передачи обслуживания Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve the unaccepted transfer-terms review proposal, with no meeting. Next month is relative to the original undated note, with unknown calendar month. Retention and any answer mentioning timing must preserve both the source-relative anchor and unknown date. Do not resolve it from processing time.',
  },
  {
    id: 'v17-held-alternatives',
    language: 'ru',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, обсуждаю две конкурирующие гипотезы о сбоях Zephyr QX-100: повреждённый кабель или перегретый контроллер. Обе версии предварительные; свидетельств ни для одной нет, причину я не выбрала.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing malfunction hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о сбоях Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both tentative alternatives, a damaged cable and an overheated controller, with Ada Marlow attribution, no evidence for either and no selected cause. Either tentative or hypothetical commitment may preserve the discussion; neither explanation is an established cause.',
  },
  {
    id: 'v17-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, recorded that the Zephyr QX-100 warranty lasts seventy-seven months.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'read-only',
    queries: {
      en: 'How long does the recorded Zephyr QX-100 warranty last?',
      ru: 'Какой срок гарантии Zephyr QX-100 записан?',
    },
    reviewExpectation:
      'The invented assertion is useful, but the only configured destination is read-only. Retain must hold without changing source bytes; no saved evidence means answer abstention is justified.',
    hold: true,
    commitment: 'asserted',
  },
];
