import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V14 } from './language-corpus-v14.ts';

/** Exposed v14 held-out sources become development; new held-out sources freeze before execution. */
export const LANGUAGE_CORPUS_V15: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V14.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),
  {
    id: 'v15-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters сказал мне, что по условиям обслуживания Zephyr QX-100 можно отправить устройство для проверки уплотнения. Я не договаривалась об отправке.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Речь шла о проверке уплотнения, а не о его замене. Я, Ada Marlow, только передаю слова Bo Winters: сам договор не читала и подтверждения не получила.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified seal-testing report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое неподтверждённое сообщение о проверке уплотнения Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder, Bo Winters as inner speaker, and lack of contract inspection and confirmation. The report permits sending the device for seal testing, not seal replacement. Retain the coupled contrast and no arranged shipment; never infer actual shipping or verified coverage.',
  },
  {
    id: 'v15-held-hypothesis',
    language: 'mixed',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For our discussion, assume Zephyr QX-100 requires a battery-contact check every year. Under that assumption, skipping a check would break the assumed rule.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, ввела это как допущение. Настоящее правило обслуживания нам неизвестно; я не сообщаю о реально пропущенной проверке.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical battery-contact rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило проверки контактов батареи Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the assumed annual battery-contact check and stated conditional missed-check consequence, with Ada Marlow attribution. Actual requirements and an actual missed check remain unestablished. Do not turn the frequency into a dated schedule.',
  },
  {
    id: 'v15-held-counterfactual',
    language: 'en',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, turned down the premium service plan for Zephyr QX-100. My refusal is final, and I did not join that plan.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Had I accepted it, display repair in the fourth year would have been included. I am describing an unrealized alternative, not the service I actually have.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which counterfactual display-repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой нереализованный вариант ремонта дисплея Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retain both the actual final refusal/nonenrollment and the unrealized fourth-year display-repair coverage, together or in separately qualified records. A focused discussion answer must keep the counterfactual conditional and nonacceptance without establishing actual coverage.',
  },
  {
    id: 'v15-held-question',
    language: 'mixed',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Мой открытый вопрос о Zephyr QX-100: does the agreement include return shipping after repair? Я, Ada Marlow, не знаю ответа.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Please keep it unanswered. I have established neither free return shipping nor its exclusion.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which open return-shipping question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос об обратной отправке Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Retain the unresolved return-shipping inclusion question attributed to Ada Marlow. Do not answer the embedded question, assume shipping is free, or infer exclusion. Describing this open question is useful.',
  },
  {
    id: 'v15-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Договор обслуживания Zephyr QX-100 не включает шлифовку царапин на корпусе. Я, Ada Marlow, утверждаю именно это исключение; об устранении электрических неисправностей оно ничего не говорит.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 service agreement cover sanding housing scratches?',
      ru: 'Включает ли договор обслуживания Zephyr QX-100 шлифовку царапин на корпусе?',
    },
    reviewExpectation:
      'Preserve the direct user assertion excluding sanding housing scratches. It does not settle electrical-fault repair. A direct attributed denial is useful; do not broaden the exclusion or claim independent verification.',
  },
  {
    id: 'v15-held-assistant',
    language: 'mixed',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'As the assistant, my preliminary interpretation is that Zephyr QX-100 service includes two firmware checks per year. Условия я не изучал и это не проверял; это лишь моё неподтверждённое прочтение.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative firmware-check report did the assistant give for Zephyr QX-100?',
      ru: 'Какое предварительное сообщение о проверке прошивки Zephyr QX-100 дал ассистент?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative interpretation, two firmware checks per year, and no terms inspection or verification. It is a qualified assistant report, not established coverage or a stipulated fictional scenario.',
  },
  {
    id: 'v15-held-fiction',
    language: 'en',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Here is a fictional example I, Ada Marlow, want to discuss: Vulpine Mutual promises Bo Winters a free carrying case during the first four months of owning Zephyr QX-100.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters is a character in the example. This invented promise is not a report of any real offer.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional carrying-case example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример с чехлом Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder, the fictional promise by Vulpine Mutual to character Bo Winters of a free carrying case during the first four ownership months, and product identity. Fictional Bo is not an additional real-world reporter. Do not establish a real offer or date.',
  },
  {
    id: 'v15-held-rejected',
    language: 'mixed',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Мне, Ada Marlow, предлагали отправить Zephyr QX-100 в мастерскую для проверки охлаждающего вентилятора. Я отказалась от этого предложения.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have no plan to send it, and no pickup has been arranged. Remember the rejected offer.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which cooling-fan inspection offer did Ada Marlow decline for Zephyr QX-100?',
      ru: 'Какое предложение о проверке охлаждающего вентилятора Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Retain the rejected workshop-shipment/fan-inspection offer, no shipment plan and no arranged pickup. A focused answer may describe the explicitly rejected offer without redundant no-plan details. Do not turn it into an active plan, booking or completed inspection.',
  },
  {
    id: 'v15-held-undated',
    language: 'ru',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, предлагаю завтра сравнить цены расширенной гарантии Zephyr QX-100. Это пока только предложение, никакой встречи не назначено.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У исходной записи нет даты. Завтра относится к моменту той записи, не к сегодняшнему дню; восстановить календарную дату невозможно.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated warranty-price comparison proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о сравнении цен гарантии Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve the tentative warranty-price comparison proposal with no appointment. Tomorrow belongs to the original undated note; both source-relative anchor and unknown calendar date must remain in readable retention and any answer mentioning timing. Never anchor it to processing time.',
  },
  {
    id: 'v15-held-alternatives',
    language: 'en',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, have two competing explanations for the Zephyr QX-100 connection failure: a frayed cable or an obstructed socket. Both are tentative. I have evidence for neither and have not selected a cause; remember both possibilities.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing connection-failure explanations did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие объяснения сбоя подключения Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both tentative alternatives, a frayed cable and an obstructed socket, with Ada Marlow attribution, equal lack of evidence and no selected cause. Tentative or hypothetical commitment can preserve the discussion, but neither cause is an established fact.',
  },
  {
    id: 'v15-held-admission',
    language: 'mixed',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, записала: the Zephyr QX-100 warranty lasts eighty-eight months.',
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
      'All destinations are read-only. Retention holds and answers abstain over the empty memory folder; existing source bytes remain unchanged.',
    hold: true,
    commitment: 'asserted',
  },
];
