import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V15 } from './language-corpus-v15.ts';

/** Exposed v15 sources become development; new held-out sources freeze before execution. */
export const LANGUAGE_CORPUS_V16: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V15.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),
  {
    id: 'v16-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters told me that the Zephyr QX-100 service terms permit sending the device away for measurement of fan noise. No shipment has been arranged.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Речь шла об измерении шума вентилятора, а не о замене вентилятора. Я, Ada Marlow, только пересказываю Bo Winters: условия не читала и подтверждения не получала.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified fan-noise service report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое неподтверждённое сообщение об измерении шума вентилятора Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve recorder Ada Marlow, inner speaker Bo Winters, no inspected terms or confirmation, permitted shipment of the device for fan-noise measurement rather than fan replacement, and no arranged shipment. No actual shipment or booking follows. Keep the measurement/replacement contrast in the same scoped memory.',
  },
  {
    id: 'v16-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для обсуждения я, Ada Marlow, допускаю, что у Zephyr QX-100 нужно осматривать крепления раз в полгода. При таком допущении пропуск осмотра нарушал бы предполагаемое правило.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Это гипотеза. Настоящие требования нам неизвестны; о фактически пропущенном осмотре я не сообщаю.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical fastener-check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило осмотра креплений Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the assumed twice-yearly fastener inspection and its stated conditional missed-inspection consequence, attributed to Ada Marlow. Actual requirements and any actual missed inspection remain unknown. Frequency is not a dated event.',
  },
  {
    id: 'v16-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, rejected the enhanced warranty for Zephyr QX-100 and did not purchase it. That choice is settled.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я выбрала эту гарантию, ремонт разъёма в пятом году был бы включён. Это нереализованный вариант, а не реально имеющееся у меня покрытие.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What counterfactual connector-repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант ремонта разъёма Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retain the actual rejection/nonpurchase and the unrealized fifth-year connector-repair coverage as separately qualified records or one fully scoped discussion record. The conditional coverage is counterfactual, never actual. A focused discussion answer preserves the alternative and nonacceptance.',
  },
  {
    id: 'v16-held-question',
    language: 'en',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'My open question about Zephyr QX-100 is whether the service agreement includes a temporary replacement device during repairs. I, Ada Marlow, do not know the answer.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Keep this as an unanswered question; neither inclusion nor exclusion has been established.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which open temporary-device question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о временном устройстве Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s unanswered question about a temporary replacement device during repairs. Do not answer the embedded question or infer a loan offer or exclusion. Describing the recorded open question is useful.',
  },
  {
    id: 'v16-held-exclusion',
    language: 'mixed',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, утверждаю: договор обслуживания Zephyr QX-100 не покрывает замену резиновых опор. This exclusion says nothing about repairing the power connector.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 service agreement cover replacing the rubber supports?',
      ru: 'Покрывает ли договор обслуживания Zephyr QX-100 замену резиновых опор?',
    },
    reviewExpectation:
      'Preserve the direct user assertion excluding replacement of rubber supports; it does not settle power-connector repair. Keep the action and component distinct and do not broaden the exclusion. A direct attributed denial is useful without claiming independent verification.',
  },
  {
    id: 'v16-held-assistant',
    language: 'ru',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Я ассистент. По моему предварительному прочтению, обслуживание Zephyr QX-100 включает осмотр контактов раз в квартал. Сам договор я не проверял; это только моё неподтверждённое предположение.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative contact-inspection report did the assistant give for Zephyr QX-100?',
      ru: 'Какое предварительное сообщение об осмотре контактов Zephyr QX-100 дал ассистент?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative interpretation, quarterly contact inspection and no contract verification. This is an unverified assistant report, not an established requirement or a fictional stipulation.',
  },
  {
    id: 'v16-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'В вымышленном примере, который я, Ada Marlow, предлагаю обсудить, Vulpine Mutual обещает Bo Winters бесплатную замену ремня для Zephyr QX-100 в первые два месяца владения.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters is a fictional participant here. This invented promise does not report an actual agreement.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional strap-replacement example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример с заменой ремня Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder and the fictional promise from Vulpine Mutual to character Bo Winters of free strap replacement in the first two ownership months. Keep product and duration; do not establish a real promise or dated schedule. Fictional Bo is not an additional reporter.',
  },
  {
    id: 'v16-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, declined the proposal to send Zephyr QX-100 to the workshop for a charging-port inspection. I rejected that offer and am not planning the shipment.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'No pickup is scheduled. Please remember the rejected proposal as such.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which charging-port inspection offer did Ada Marlow decline for Zephyr QX-100?',
      ru: 'Какое предложение об осмотре разъёма зарядки Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the explicitly rejected workshop-shipment and charging-port inspection proposal, no shipment plan and no scheduled pickup. A focused answer may describe the explicit rejection without redundant no-plan wording. Do not create an active plan or completed inspection.',
  },
  {
    id: 'v16-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, propose checking the Zephyr QX-100 service cancellation terms next week. This remains an unaccepted proposal, and no meeting is arranged.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Исходная заметка не датирована. Следующая неделя отсчитывается от момента этой заметки, а не от дня обработки; календарную неделю определить невозможно.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated cancellation-terms proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о проверке условий отмены обслуживания Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve the unaccepted cancellation-terms review proposal, with no meeting. Next week is relative to the original undated note, with unknown calendar week. Retention and any answer mentioning timing must preserve both the source-relative anchor and unknown date. Do not resolve it from processing time.',
  },
  {
    id: 'v16-held-alternatives',
    language: 'ru',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, обсуждаю две конкурирующие гипотезы о шуме Zephyr QX-100: ослабленное крепление или изношенный подшипник. Обе версии предварительные; свидетельств ни для одной нет, причину я не выбрала.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing noise hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о шуме Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both tentative alternatives, a loose fastener and a worn bearing, with Ada Marlow attribution, no evidence for either and no selected cause. Either tentative or hypothetical commitment may preserve the discussion; neither explanation is an established cause.',
  },
  {
    id: 'v16-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, recorded that the Zephyr QX-100 warranty lasts sixty-six months.',
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
