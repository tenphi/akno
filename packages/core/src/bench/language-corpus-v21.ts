import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V20 } from './language-corpus-v20.ts';

/** Full V65 exposed v20; these fresh held-out inputs require independent approval before execution. */
export const LANGUAGE_CORPUS_V21: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V20.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),

  {
    id: 'v21-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, am relaying Bo Winters’s description of the Zephyr QX-100 service terms. I have not read those terms or independently checked his description. I have not booked a courier for my device.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters says the terms permit taking the device to a workbench to check the backlash in its gear train.',
      },
      {
        item_id: 'turn-3333',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Уточняю передаваемый смысл: проверяют люфт зубчатой передачи, а не заменяют передачу. Это пересказ слов Bo Winters; я, Ada Marlow, сама это условие договора не проверяла.',
      },
    ],
    view: 'reports',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified gear-train service report did Ada Marlow relay for Zephyr QX-100?',
      ru: 'Какое непроверенное сообщение об обслуживании зубчатой передачи Zephyr QX-100 пересказала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Bo as inner source and Ada as outer relayer, permission to take the device to the workbench to check gear-train backlash rather than replace the gear train, and Ada’s separate unread/unchecked limits. Preserve her independent no-courier-booking assertion in the complete retained set. No performed service, confirmed term, or universal absence of checking is established.',
  },
  {
    id: 'v21-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для условного рассуждения я, Ada Marlow, предлагаю считать, что защитную решётку Zephyr QX-100 осматривают раз в четыре месяца. Только если принять это допущение, пропуск осмотра означал бы нарушение предполагаемого правила.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Действительные требования нам неизвестны. Я не сообщаю о реально пропущенном осмотре: это лишь разбор принятого допущения.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical protective-grille inspection rule did Ada Marlow introduce for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило осмотра защитной решётки Zephyr QX-100 ввела Ada Marlow?',
    },
    reviewExpectation:
      'Keep the assumed four-month inspection rule and stated conditional consequence together. Preserve the group-relative unknown actual requirements separately from Ada’s introducing and nonreporting actions. Do not establish a real obligation, actual missed inspection, group membership, or dated inspection event.',
  },
  {
    id: 'v21-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, turned down the optional protection extension for Zephyr QX-100. I did not buy that extension.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я всё-таки приобрела это продление, ремонт водяного насоса в четвёртом году был бы покрыт. Но я его не приобрела: описываю несостоявшийся вариант, а не своё действующее покрытие.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unrealized water-pump repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой несостоявшийся вариант ремонта водяного насоса Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Complete retention preserves actual refusal/nonpurchase and the unrealized fourth-year water-pump repair coverage. Focused answers must identify the repair alternative and false purchase antecedent, not merely repeat the decision. Do not convert an unrealized benefit into current coverage or an ordinal duration into a calendar date.',
  },
  {
    id: 'v21-held-question',
    language: 'ru',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У меня, Ada Marlow, открыт вопрос о Zephyr QX-100: входит ли периодическая калибровка датчика в договор обслуживания? Ответа у меня нет; ни включение, ни исключение калибровки пока не установлены.',
      },
    ],
    view: 'questions',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unresolved sensor-calibration question does Ada Marlow have about Zephyr QX-100?',
      ru: 'Какой нерешённый вопрос о калибровке датчика Zephyr QX-100 остаётся у Ada Marlow?',
    },
    reviewExpectation:
      'Retain the open question about periodic sensor calibration, Ada’s personal lack of an answer, and unestablished inclusion/exclusion. This is neither contract silence nor universal ignorance and does not establish an external asking or writing event.',
  },
  {
    id: 'v21-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, утверждаю: гарантия Zephyr QX-100 не покрывает расколотую наружную панель. Эта запись об исключении не устанавливает, покрывается ли ремонт циркуляционного насоса. Из неё также нельзя заключать, что весь договор об этом умалчивает.',
      },
    ],
    view: 'factual',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty excludes damage to the outer panel.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'What does Ada Marlow’s exclusion establish about the Zephyr QX-100 outer panel and circulation-pump repair?',
      ru: 'Что устанавливает исключение Ada Marlow о наружной панели Zephyr QX-100 и ремонте циркуляционного насоса?',
    },
    reviewExpectation:
      'Preserve the asserted cracked outer-panel exclusion with negative polarity and the narrow record-level failure to settle circulation-pump repair coverage. Both parts are requested. Do not change the covered repair into a repair that covers the pump, or record nonresolution into contract silence or a global lack of knowledge.',
  },
  {
    id: 'v21-held-assistant',
    language: 'en',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'My preliminary reading is that Zephyr QX-100 servicing may include a safety-interlock check every quarter. I have not examined the agreement or verified that reading. This is a possible contractual condition, not an established duty.',
      },
    ],
    view: 'reports',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative safety-interlock check did the assistant suggest for Zephyr QX-100?',
      ru: 'Какую предварительную версию о проверке защитной блокировки Zephyr QX-100 предложил ассистент?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative possible quarterly safety-interlock check, personal lack of agreement examination and reading verification, and contractual-condition rather than established-duty scope. Do not turn the contractual reading into a device state or the assistant’s limits into global absence of evidence.',
  },
  {
    id: 'v21-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, предлагаю обсудить вымышленный пример с Zephyr QX-100. Мы не заключаем настоящий договор; я пока лишь предлагаю его обсудить.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Within that fictional example, Vulpine Mutual promises the imaginary Bo Winters free cable-guide replacements during the first twenty-two days of ownership. The promise belongs only to the invented example.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional cable-guide promise did Ada Marlow propose discussing for Zephyr QX-100?',
      ru: 'Какое вымышленное обещание о направляющей кабеля Zephyr QX-100 предложила обсудить Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the actual proposal to discuss separately from the fictional promise: Vulpine to fictional Bo, free cable-guide replacements, first twenty-two days of ownership. The proposal is not a completed discussion, actual agreement, or real promise. A promise-only focused citation retains outer attribution without inventing that its record itself contains the proposing act.',
  },
  {
    id: 'v21-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The proposed arrangement was to send Zephyr QX-100 to an inspection room to measure cable tension. I, Ada Marlow, rejected that arrangement and do not intend to send the device under it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'No pickup by a carrier has been booked. The proposed shipment remains rejected, not accepted.',
      },
    ],
    view: 'history',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which cable-tension inspection arrangement did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение о проверке натяжения кабеля Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Keep rejection, Ada’s lack of intent under the arrangement, shipment of the device to the inspection room, and exact cable-tension measurement purpose. Complete retention also preserves the independent no-carrier-pickup assertion. No accepted plan, performed shipment, substituted component shipment, or causal link is established.',
  },
  {
    id: 'v21-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, propose reviewing the Zephyr QX-100 servicing exclusions next week. I have not adopted a plan or arranged a meeting; this is only my proposal.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Первоначальная запись не датирована. Следующая неделя отсчитывается от этой записи, а не от сегодняшнего дня и не от обработки. Какая именно это календарная неделя, определить невозможно.',
      },
    ],
    view: 'planning',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated servicing-exclusion proposal did Ada Marlow make for Zephyr QX-100?',
      ru: 'Какое недатированное предложение об исключениях обслуживания Zephyr QX-100 сделала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada’s actual proposal, next week relative to the undated original record, unknown calendar week and explicit lack of a today/processing anchor, no adopted plan and no meeting. Unknown timing must not make the proposing action itself hypothetical or introduce a processing-based calendar event.',
  },
  {
    id: 'v21-held-alternatives',
    language: 'mixed',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, обсуждаю две конкурирующие предварительные версии сбоя Zephyr QX-100: сломанный стопорный штифт или ослабленный хомут шланга.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have not chosen either explanation, and neither explanation has supporting evidence.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing fault explanations did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие версии сбоя Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Keep both preliminary competing explanations, explicit absence of evidence for each, and Ada’s personal nonselection. No cause is established. Preserve broken pin versus loosened hose clamp without changing looseness into an unspecified installation error; the discussion does not make its payload factual.',
  },
  {
    id: 'v21-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, recorded a twenty-two-month warranty for Zephyr QX-100.',
      },
    ],
    view: 'factual',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty lasts twenty-two months.',
    ordinaryFactual: true,
    admission: 'read-only',
    queries: {
      en: 'How long is the Zephyr QX-100 warranty in Ada Marlow’s record?',
      ru: 'Каков срок гарантии Zephyr QX-100 в записи Ada Marlow?',
    },
    reviewExpectation:
      'The source is understandable but the isolated destination is read-only. Preserve bytes and a typed admission hold with no unsupported answer, distinguishing policy denial from missing source knowledge or service unavailability.',
    hold: true,
  },
];
