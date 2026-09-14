import type { LanguageCaseV2 } from './language-corpus-v2.ts';

/** Exposed v9 cases form development; ten fresh writable scenarios include multi-turn context. */
export const LANGUAGE_CORPUS_V10: LanguageCaseV2[] = [
  {
    id: 'v3-dev-denial',
    split: 'development',
    language: 'ru',
    scenario: 'factual-negation',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Гарантия Zephyr QX-100 не включает замену корпуса.',
      },
    ],
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: 'Гарантия Zephyr QX-100 не включает замену корпуса.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty include housing replacement?',
      ru: 'Включает ли гарантия Zephyr QX-100 замену корпуса?',
    },
    reviewExpectation:
      'The recorded user assertion excludes housing replacement. Preserve the negation; do not infer other coverage or external verification.',
  },
  {
    id: 'v3-dev-report',
    split: 'development',
    language: 'en',
    scenario: 'tentative-assistant-report',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'I suspect that the Zephyr QX-100 warranty includes sensor cleaning, but I have no confirmation.',
      },
    ],
    view: 'reports',
    commitment: 'tentative',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      'Assistant: I suspect that the Zephyr QX-100 warranty includes sensor cleaning, but I have no confirmation.',
    ordinaryFactual: false,
    queries: {
      en: 'What did the assistant report about sensor cleaning under the Zephyr QX-100 warranty?',
      ru: 'Что ассистент сообщил о чистке датчика по гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Sensor cleaning coverage is an unconfirmed assistant suspicion. Both attribution and tentative status must survive.',
  },
  {
    id: 'v3-dev-alternatives',
    split: 'development',
    language: 'mixed',
    scenario: 'incompatible-hypotheses',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Рассмотрим две несовместимые гипотезы о Zephyr QX-100: warranty service is annual, or warranty service is biennial. Neither hypothesis is established. Keep both alternatives for discussion.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary:
      '## Hypotheses\nZephyr QX-100 warranty service is annual or biennial; neither alternative is established.',
    ordinaryFactual: false,
    queries: {
      en: 'Which competing hypotheses were discussed about the Zephyr QX-100 warranty service interval?',
      ru: 'Какие конкурирующие гипотезы обсуждались об интервале гарантийного обслуживания Zephyr QX-100?',
    },
    reviewExpectation:
      'Keep both incompatible alternatives as hypotheses without choosing one or asserting an actual service interval. A useful answer identifies both alternatives.',
  },
  {
    id: 'v3-dev-example',
    split: 'development',
    language: 'ru',
    scenario: 'fictional-example',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для обсуждения сохраним вымышленный пример: Bo Winters представляет гарантию Zephyr QX-100 на двадцать лет. Это не реальная гарантия.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Вымышленный пример\nBo Winters представляет гарантию Zephyr QX-100 на двадцать лет.',
    ordinaryFactual: false,
    queries: {
      en: 'What fictional warranty example was discussed for Zephyr QX-100?',
      ru: 'Какой вымышленный пример гарантии обсуждался для Zephyr QX-100?',
    },
    reviewExpectation:
      'Twenty years is only a fictional warranty imagined by Bo Winters and recorded by Ada Marlow. Preserve fictional scope and nested attribution.',
  },
  {
    id: 'v3-dev-undated',
    split: 'development',
    language: 'en',
    scenario: 'unanchored-proposal',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I propose reviewing the Zephyr QX-100 warranty tomorrow. This proposal has not been accepted; there is no scheduled review.',
      },
    ],
    view: 'planning',
    disposition: 'proposed',
    admission: 'writable',
    ordinary: '## Proposed review\nReview the Zephyr QX-100 warranty tomorrow; this is not scheduled.',
    ordinaryFactual: false,
    queries: {
      en: 'What warranty review was proposed for Zephyr QX-100, and is its calendar date known?',
      ru: 'Какую проверку гарантии предложили для Zephyr QX-100 и известна ли её календарная дата?',
    },
    reviewExpectation:
      'An unaccepted, unscheduled proposal refers to the day after an undated source. No calendar date is known; do not resolve tomorrow from processing time.',
  },
  {
    id: 'v9-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    id: 'v10-dev-admission',
    language: 'mixed',
    scenario: 'read-only-admission',
    split: 'development',
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
  {
    id: 'v10-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters сказал мне, что договор обслуживания Zephyr QX-100 включает выезд мастера для проверки клапана. Он говорил именно о проверке, а не о замене клапана.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я записываю это со слов Bo Winters. Подтверждения у меня нет; само сообщение стоит сохранить с этой оговоркой.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified report did Ada Marlow record about a technician visit for Zephyr QX-100?',
      ru: 'Что Ada Marlow записала со слов Bo Winters о выезде мастера для Zephyr QX-100?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder and Bo Winters as inner speaker. His unverified report concerns a technician visit for valve inspection, not valve replacement; do not assert actual service coverage.',
    basis: 'source_report',
  },
  {
    id: 'v10-held-hypothesis',
    language: 'en',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For discussion, suppose Zephyr QX-100 requires a filter check every four months. Under that assumption, skipping a check would violate the assumed maintenance rule. We have no evidence that the actual rule says this.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical filter-check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какую гипотезу о проверке фильтра Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Ada Marlow assumes a four-month filter-check interval solely for discussion. Preserve that interval and conditional consequence without claiming a real obligation or inventing scheduled dates.',
    commitment: 'hypothetical',
  },
  {
    id: 'v10-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я отклонила предложение расширенного обслуживания Zephyr QX-100. Это решение уже принято.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Had I accepted that offer, valve repair in the second year would have been included. Это контрфактический вариант: предложение я всё-таки отклонила, а не приняла.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What counterfactual service alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант обслуживания Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the actual rejected service offer and the unrealized alternative of second-year valve repair. Retention must preserve both propositions, in one qualified record or separate decision and counterfactual records. Discussion answers may focus on the unrealized alternative but must not suggest it was accepted.',
  },
  {
    id: 'v10-held-question',
    language: 'en',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I want to remember a question about Zephyr QX-100: is a replacement cable included in the service agreement?',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have neither an inclusion nor an exclusion to record. Please leave the cable question open until I find the agreement.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which unanswered replacement-cable question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о сменном кабеле Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s unresolved question about a replacement cable. Do not answer the embedded question or infer coverage from absence of a recorded exclusion.',
  },
  {
    id: 'v10-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Договор обслуживания Zephyr QX-100 не включает восстановление выцветшей краски. Это относится именно к выцветанию; о других повреждениях здесь ничего не сказано.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 service agreement include restoration of faded paint?',
      ru: 'Включает ли договор обслуживания Zephyr QX-100 восстановление выцветшей краски?',
    },
    reviewExpectation:
      'The user directly states the exclusion for restoring faded paint. Preserve its negative polarity and narrow scope; a faithful attributed denial is useful without claiming independent verification.',
    commitment: 'asserted',
    polarity: 'negated',
  },
  {
    id: 'v10-held-assistant',
    language: 'mixed',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'My tentative understanding is that the Zephyr QX-100 service agreement permits two valve inspections per year. Я не проверял договор; это неподтверждённый ответ.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What did the assistant tentatively report about valve inspections for Zephyr QX-100?',
      ru: 'Что ассистент сообщил о количестве проверок клапана Zephyr QX-100?',
    },
    reviewExpectation:
      'Preserve assistant attribution, the unverified tentative status and two inspections per year. Do not turn model-generated content into independently established coverage.',
    commitment: 'tentative',
    basis: 'source_report',
  },
  {
    id: 'v10-held-fiction',
    language: 'en',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Let us invent an example involving Zephyr QX-100. In this fictional example, Bo Winters receives a lifetime filter-replacement promise from Vulpine Mutual.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters is a character inside that example, not the source of a real report. I want to keep the example for discussion only.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional filter-replacement example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример замены фильтра Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as the actual speaker and the fictional example involving Bo Winters and Vulpine Mutual. Lifetime filter replacement is fictional; Bo is a participant rather than a real reporter.',
    commitment: 'hypothetical',
  },
  {
    id: 'v10-held-rejected',
    language: 'ru',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Мы рассматривали предложение отправить Zephyr QX-100 на профилактическую проверку. Я это предложение отклонила. Отправку не планируем; хочу помнить само отклонённое предложение.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which Zephyr QX-100 inspection proposal did Ada Marlow reject?',
      ru: 'Какое предложение о проверке Zephyr QX-100 отклонено Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s rejected inspection proposal and absence of a current sending plan. Retaining the decision separately is allowed, but do not imply the inspection happened.',
    disposition: 'rejected',
  },
  {
    id: 'v10-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I propose checking the Zephyr QX-100 service agreement the day after tomorrow. This is only a proposal, not an appointment.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Дата исходной записи отсутствует. Послезавтра относится к моменту той записи; календарный день пока неизвестен.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated agreement-review proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о проверке договора Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Retain Ada Marlow’s proposal to review the agreement the day after tomorrow relative to the undated source, with an explicitly unknown calendar/reference date. Do not rebase to processing time or invent an appointment.',
    commitment: 'tentative',
  },
  {
    id: 'v10-held-alternatives',
    language: 'en',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For the Zephyr QX-100 fault, I am keeping two competing hypotheses: a loose cable or a worn valve. Both are unconfirmed.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For now, neither explanation has stronger support. Please preserve both hypotheses without selecting a cause.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing fault hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие альтернативные гипотезы о неисправности Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both unconfirmed hypotheses, loose cable and worn valve, as competing explanations. A complete answer should list both without selecting a cause.',
    commitment: 'hypothetical',
  },
  {
    id: 'v10-held-admission',
    language: 'ru',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Гарантия Zephyr QX-100 действует тридцать три месяца.',
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
      'All destinations are read-only. Hold retention and abstain over the empty memory folder without modifying existing files.',
    hold: true,
    commitment: 'asserted',
  },
];
