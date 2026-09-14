import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V18 } from './language-corpus-v18.ts';

/** Exposed v18 sources become development; fresh held-out inputs require approval before execution. */
export const LANGUAGE_CORPUS_V19: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V18.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),

  {
    id: 'v19-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, have not read the service terms and have no independent confirmation of the report below. No collection of my device has been booked.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters told me that the Zephyr QX-100 terms permit sending the device to a service bench to measure the tension of its return spring.',
      },
      {
        item_id: 'turn-3333',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Уточняю только смысл пересказа: речь об измерении натяжения возвратной пружины, а не о замене этой пружины. Это слова Bo Winters в моём пересказе, а не проверенное мной условие.',
      },
    ],
    view: 'reports',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified return-spring service report did Ada Marlow relay for Zephyr QX-100?',
      ru: 'Какое неподтверждённое сообщение об обслуживании возвратной пружины Zephyr QX-100 пересказала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve outer Ada and inner Bo, permission to send the device to a service bench for return-spring tension measurement rather than spring replacement, and the unread/unconfirmed status. Keep the separate no-collection-booking assertion. The contrast clarifies the same relayed report; permission is not a booking or completed measurement.',
  },
  {
    id: 'v19-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для мысленного разбора я, Ada Marlow, допускаю правило: поролоновый фильтр Zephyr QX-100 нужно проверять каждые два месяца. Если принять это правило, пропущенная проверка нарушала бы именно это предполагаемое требование.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Настоящие требования нам неизвестны. Правило введено только для гипотезы; о реальном пропуске проверки я не сообщаю.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical foam-filter check rule did Ada Marlow introduce for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило проверки поролонового фильтра Zephyr QX-100 ввела Ada Marlow?',
    },
    reviewExpectation:
      'Retain the hypothetical two-month foam-filter check rule and its explicit conditional missed-check consequence together. Actual requirements remain unknown and no actual missed check is reported. Keep Ada attribution and the frequency as a property rather than a calendar event.',
  },
  {
    id: 'v19-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, rejected the optional service extension for Zephyr QX-100 and did not buy it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'В несостоявшемся варианте, если бы я купила это продление, ремонт поворотной ручки в девятом году был бы покрыт. Это не та услуга, которую я приобрела, и не действующее покрытие.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unrealized rotary-knob repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой несостоявшийся вариант ремонта поворотной ручки Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'The complete retained set preserves actual rejection/nonpurchase and counterfactual ninth-year rotary-knob repair coverage. The imagined purchase is explicitly false; no actual coverage is established. A focused discussion answer may describe the alternative with its unrealized/nonpurchase qualification.',
  },
  {
    id: 'v19-held-question',
    language: 'ru',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У меня, Ada Marlow, остаётся открытый вопрос: входит ли профилактическая доливка охлаждающей жидкости Zephyr QX-100 в договор обслуживания? Ответа у меня нет: ни включение этой услуги, ни её исключение не установлены.',
      },
    ],
    view: 'questions',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unresolved coolant-refill question does Ada Marlow have about Zephyr QX-100?',
      ru: 'Какой нерешённый вопрос о доливке охлаждающей жидкости Zephyr QX-100 остаётся у Ada Marlow?',
    },
    reviewExpectation:
      'Retain an unresolved question attributed to Ada about preventive coolant refill, with neither inclusion nor exclusion established. Do not answer the embedded coverage question or invent an external asking/writing action.',
  },
  {
    id: 'v19-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, утверждаю: повреждённый опорный кронштейн Zephyr QX-100 не покрывается гарантией. Эта запись об исключении не позволяет решить, покрыт ли ремонт двигателя вентилятора; она не утверждает, что договор вообще молчит об этом ремонте.',
      },
    ],
    view: 'factual',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty excludes damage to the support bracket.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'What does Ada Marlow’s exclusion say about the Zephyr QX-100 support bracket and fan-motor repair?',
      ru: 'Что говорится в исключении Ada Marlow об опорном кронштейне Zephyr QX-100 и ремонте двигателя вентилятора?',
    },
    reviewExpectation:
      'Preserve the asserted support-bracket exclusion with negated polarity and the narrow statement that this exclusion does not resolve fan-motor repair coverage. Do not claim that the entire contract omits the answer.',
  },
  {
    id: 'v19-held-assistant',
    language: 'en',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'My preliminary reading is that Zephyr QX-100 servicing may include a functional check of the status display every quarter. I have not examined the contract or confirmed this assumption. This is a possible contract condition, not an established requirement.',
      },
    ],
    view: 'reports',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative status-display check did the assistant suggest may be included for Zephyr QX-100?',
      ru: 'Какую предварительную версию о проверке дисплея состояния Zephyr QX-100 предложил ассистент?',
    },
    reviewExpectation:
      'Preserve generic assistant attribution, tentative modal possibility, quarterly functional status-display checks, and lack of contract examination or confirmation. The condition is a contractual term, not a claim about the device’s physical state. Do not promote the report to an established servicing requirement.',
  },
  {
    id: 'v19-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, предлагаю обсудить вымышленный пример про Zephyr QX-100. Само обсуждение я только предлагаю; реального соглашения здесь нет.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'In that invented example, Vulpine Mutual promises Bo Winters free axle-cap replacements during the first ten weeks of ownership. Bo Winters is a character in the example, and the promise belongs only to the fiction.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional axle-cap promise did Ada Marlow propose discussing for Zephyr QX-100?',
      ru: 'Какое вымышленное обещание о колпачке оси Zephyr QX-100 предложила обсудить Ada Marlow?',
    },
    reviewExpectation:
      'Retain the actual proposal to discuss separately from, or fully scoped together with, the fictional promise of free axle-cap replacements in the first ten weeks. The complete fictional content keeps Vulpine as promising party and Bo as character/recipient. No real agreement, promise or completed discussion is established.',
  },
  {
    id: 'v19-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'An offer concerned sending Zephyr QX-100 to a laboratory for a rotor-balance measurement. I, Ada Marlow, declined that offer; I have no plan to send the device under it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'No pickup of the device has been booked. The offered shipment was rejected rather than accepted.',
      },
    ],
    view: 'history',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which rotor-measurement offer did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение об измерении баланса ротора Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Retain Ada’s rejection of sending the device to a laboratory for rotor-balance measurement, her lack of a plan under that offer, and the separate unbooked pickup. The rejected course of action remains kind plan/disposition rejected; that schema does not assert personal intent. No causation or actual measurement/booking may be invented.',
  },
  {
    id: 'v19-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'My proposal is to review the Zephyr QX-100 warranty exclusions next year. I, Ada Marlow, have not adopted a plan or arranged a meeting; this remains my proposal.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У исходной записи нет даты. Следующий год считается от момента этой записи, а не от сегодняшнего дня или обработки. Какой именно это календарный год, восстановить нельзя.',
      },
    ],
    view: 'planning',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated warranty-exclusion proposal did Ada Marlow make for Zephyr QX-100?',
      ru: 'Какое недатированное предложение об исключениях гарантии Zephyr QX-100 сделала Ada Marlow?',
    },
    reviewExpectation:
      'Retain Ada’s explicit proposal to review warranty exclusions next year relative to the original undated record, with an unknown calendar/reference year and no adopted plan or arranged meeting. Proposed disposition and tentative timing do not themselves make the stated proposal’s commitment tentative. Preserve an unknown temporal envelope and no processing-date substitution.',
  },
  {
    id: 'v19-held-alternatives',
    language: 'mixed',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, обсуждаю две конкурирующие гипотезы о неисправности Zephyr QX-100: проскальзывающий приводной ремень или заклинивший охлаждающий вентилятор. Обе версии предварительные.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Neither hypothesis has supporting evidence. I, Ada Marlow, have not selected a cause.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing malfunction hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о неисправности Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Retain the slipping drive belt and jammed cooling fan as competing tentative hypotheses discussed by Ada. Neither has supporting evidence and Ada has not selected a cause. Preserve the actual discussion activity and personal nonselection; neither alternative becomes an established cause.',
  },
  {
    id: 'v19-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, recorded that the Zephyr QX-100 warranty lasts ninety-nine months.',
      },
    ],
    view: 'factual',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty lasts ninety-nine months.',
    ordinaryFactual: true,
    admission: 'read-only',
    queries: {
      en: 'How long is the Zephyr QX-100 warranty in Ada Marlow’s record?',
      ru: 'Каков срок гарантии Zephyr QX-100 в записи Ada Marlow?',
    },
    reviewExpectation:
      'The source is invented and understandable, but this isolated knowledge base is read-only. No retained write or unsupported answer is allowed; report an admission hold distinctly from unavailable service or absent source material.',
    hold: true,
  },
];
