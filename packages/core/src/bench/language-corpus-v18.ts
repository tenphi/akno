import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V17 } from './language-corpus-v17.ts';

/** Exposed v17 sources become development; fresh held-out inputs require approval before execution. */
export const LANGUAGE_CORPUS_V18: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V17.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),
  {
    id: 'v18-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters says that the Zephyr QX-100 service terms permit sending the device to a technician for dial calibration. I, Ada Marlow, have given no instruction to collect it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я передаю только слова Bo Winters: разрешена калибровка регулятора, а не замена регулятора. Самих условий я не видела и подтверждения этому сообщению не получила.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified dial-calibration service report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое неподтверждённое сообщение о калибровке регулятора Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder, Bo Winters as inner reporter, the permitted sending of the device to a technician for dial calibration rather than dial replacement, and Ada’s lack of inspected terms or confirmation. Retain the separate assertion that Ada gave no instruction to collect the device. Permission is not an arranged shipment. Keep the calibration/replacement contrast with the reported permission.',
  },
  {
    id: 'v18-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, предлагаю для рассуждения такое допущение: клапан давления Zephyr QX-100 требуется проверять каждую неделю. При этом допущении пропуск проверки означал бы нарушение предполагаемого требования.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Мы не знаем настоящих требований. Это только условие гипотетического рассуждения; о случившемся пропуске проверки здесь не говорится.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical pressure-valve check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило проверки клапана давления Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s hypothetical weekly pressure-valve check rule and the expressly conditional consequence that a missed check would violate that assumed rule. Actual requirements are unknown and no actual missed check is reported. Keep the premise and consequence together; weekly frequency is not a resolved calendar event.',
  },
  {
    id: 'v18-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, turned down the optional extended warranty for Zephyr QX-100. I did not purchase that extension.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я всё же купила продление, ремонт разъёма зарядки в седьмом году входил бы в покрытие. Я описываю несостоявшийся вариант, а не действующую гарантию.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What counterfactual charging-port repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант ремонта разъёма зарядки Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve actual rejection/nonpurchase of the extension and the unrealized seventh-year charging-port repair coverage. The latter is an active counterfactual, never actual coverage. The complete retained set must preserve both sides; a focused discussion answer preserves the alternative and nonacceptance.',
  },
  {
    id: 'v18-held-question',
    language: 'en',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'My unresolved question, recorded by me, Ada Marlow, is whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I still have no answer. This note establishes neither inclusion nor exclusion of that cleaning.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which open preventive-cleaning question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о профилактической чистке фильтра Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s unanswered question about preventive filter cleaning under the service agreement. The question remains open; do not infer cleaning coverage, an exclusion, or a booked cleaning. A faithful description of the recorded question is useful.',
  },
  {
    id: 'v18-held-exclusion',
    language: 'mixed',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, прямо утверждаю, что договор обслуживания Zephyr QX-100 не покрывает замену треснувших опорных ножек. This particular exclusion does not settle whether repairing the motor housing is covered.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 service agreement cover replacement of cracked support feet?',
      ru: 'Покрывает ли договор обслуживания Zephyr QX-100 замену треснувших опорных ножек?',
    },
    reviewExpectation:
      'Preserve the directly asserted exclusion of replacing cracked support feet. This exclusion alone does not settle motor-housing repair; do not turn that limited scope into whole-contract silence or broaden the exclusion to the motor housing. A source-attributed denial answers the factual question without claiming independent verification.',
  },
  {
    id: 'v18-held-assistant',
    language: 'ru',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Моё предварительное предположение как ассистента: обслуживание Zephyr QX-100, возможно, предусматривает ежемесячную смазку шарнира. Это непроверенная версия; договор я не открывал и оснований считать её подтверждённой у меня нет.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative hinge-lubrication report did the assistant give for Zephyr QX-100?',
      ru: 'Какое предварительное сообщение о смазке шарнира Zephyr QX-100 дал ассистент?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative monthly hinge-lubrication interpretation, no contract inspection and no confirmation. Remember this as an unverified tentative assistant report, not as a factual service requirement or a fictional stipulation.',
  },
  {
    id: 'v18-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'В истории, которую я, Ada Marlow, целиком выдумала для обсуждения, Vulpine Mutual обещает персонажу Bo Winters бесплатно заменить кабель Zephyr QX-100 в первые шесть недель владения.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'This promise belongs entirely to the invented story. Its Bo Winters is fictional, and I am not reporting a real agreement.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional cable-replacement example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример с заменой кабеля Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as the author/recorder of fiction, Vulpine Mutual’s fictional promise to fictional character Bo Winters of free cable replacement during the first six ownership weeks, and the absence of a reported real agreement. The embedded promise is hypothetical, not an asserted promise. Fictional Bo is not another reporter; duration does not establish a dated event.',
  },
  {
    id: 'v18-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, declined an offer to send Zephyr QX-100 to the service centre for a thermostat measurement. I have no plan to send it under that offer.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'No handover of the device has been booked. The offered shipment was rejected, not accepted.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which thermostat-measurement offer did Ada Marlow decline for Zephyr QX-100?',
      ru: 'Какое предложение об измерении параметров термостата Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the rejected offer to send the device to the service centre for thermostat measurement, the absence of a plan to send it under that offer and the separate absence of a booked handover. Do not infer an accepted plan, completed measurement or arranged collection. A focused answer may state rejection without redundantly restating no plan.',
  },
  {
    id: 'v18-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, put forward a proposal to review the Zephyr QX-100 warranty exceptions next week. It remains an unaccepted proposal; no meeting has been arranged.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Дата исходной записи неизвестна. Следующая неделя означает неделю после этой исходной записи; от даты обработки отсчитывать её нельзя, и календарную неделю установить невозможно.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated warranty-exceptions proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о проверке исключений из гарантии Zephyr QX-100 записала Ada Marlow без известной исходной даты?',
    },
    reviewExpectation:
      'Preserve the unaccepted proposal to review warranty exceptions with no arranged meeting. Next week is relative to the original source record, whose date is unknown, so the calendar week is unresolved. Retention and any timing-bearing answer must preserve both source-relative anchor and unknown calendar date. No processing-time resolution is allowed.',
  },
  {
    id: 'v18-held-alternatives',
    language: 'ru',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, рассматриваю две конкурирующие версии сбоев Zephyr QX-100: неплотно вставленный внутренний разъём либо неисправный температурный зонд. Обе версии остаются предположениями; доказательств нет ни для первой, ни для второй, и ни одну причину я не выбрала.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing fault hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о неполадках Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the competing hypotheses of a loosely inserted internal connector and a faulty temperature probe, Ada Marlow attribution, lack of evidence for either and no selected cause. Tentative or hypothetical commitment can preserve this discussion; neither cause is established. Keep both alternatives and their common lack of evidence.',
  },
  {
    id: 'v18-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, record that the Zephyr QX-100 warranty duration is eighty-eight months.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'read-only',
    queries: {
      en: 'What warranty duration is recorded for Zephyr QX-100?',
      ru: 'Какой срок гарантии записан для Zephyr QX-100?',
    },
    reviewExpectation:
      'The invented assertion is useful, but the only configured destination is read-only. Retain must hold without changing source bytes. With no saved evidence, answer abstention is justified.',
    hold: true,
    commitment: 'asserted',
  },
];
