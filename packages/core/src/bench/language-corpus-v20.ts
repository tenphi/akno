import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V19 } from './language-corpus-v19.ts';

/** Full V48 exposed v19; these fresh held-out inputs require independent approval before execution. */
export const LANGUAGE_CORPUS_V20: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V19.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),

  {
    id: 'v20-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, am passing on Bo Winters’s account, without having read the agreement or independently checked the account. I have not arranged delivery of my Zephyr QX-100.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters says the agreement permits sending Zephyr QX-100 to the workshop to measure the gap at the latch.',
      },
      {
        item_id: 'turn-3333',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Уточнение к пересказу: измеряется зазор у защёлки, а не меняется защёлка. Я, Ada Marlow, лишь передаю этот смысл слов Bo Winters; сама я его не проверяла.',
      },
    ],
    view: 'reports',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified latch-service report did Ada Marlow pass on about Zephyr QX-100?',
      ru: 'Какое непроверенное сообщение об обслуживании защёлки Zephyr QX-100 передала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada as outer reporter and Bo as inner reporter, permission to send the device to the workshop to measure latch gap, and the explicit not-latch-replacement clarification. Ada personally has not read or verified the agreement/account and has not arranged delivery. Keep the independent personal delivery denial; no completed work or universal nonverification is established.',
  },
  {
    id: 'v20-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для гипотетического рассуждения я, Ada Marlow, ввожу допущение: сетчатый экран Zephyr QX-100 проверяют каждые три месяца. Только при этом допущении пропуск такой проверки был бы нарушением предполагаемого правила.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я не знаю действительных требований. Это условный разбор, а не сообщение о настоящем пропуске проверки.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical mesh-screen inspection rule did Ada Marlow introduce for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило осмотра сетчатого экрана Zephyr QX-100 ввела Ada Marlow?',
    },
    reviewExpectation:
      'Keep the hypothetical three-month mesh-screen inspection premise together with its stated conditional missed-inspection consequence. Ada lacks knowledge of real requirements; no actual missed inspection is asserted. Preserve her introducing act and treat frequency as a property, not a calendar event.',
  },
  {
    id: 'v20-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, declined the optional repair extension for Zephyr QX-100; I did not purchase it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я тогда приобрела это продление, ремонт ступицы колеса в пятом году был бы покрыт. Но покупки не было: это описание нереализованного варианта, а не моего действующего покрытия.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unrealized wheel-hub repair alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой нереализованный вариант ремонта ступицы колеса Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'The complete retained set includes Ada’s actual refusal/nonpurchase and the unrealized fifth-year wheel-hub repair coverage. A focused counterfactual answer preserves the false purchase antecedent and no-actual-coverage scope; do not turn ordinal duration into an event date.',
  },
  {
    id: 'v20-held-question',
    language: 'ru',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У меня, Ada Marlow, остаётся нерешённый вопрос о Zephyr QX-100: включена ли регулярная смазка уплотнения в сервисный договор? Я не располагаю ответом: ни включение, ни исключение этой услуги не установлены.',
      },
    ],
    view: 'questions',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unresolved seal-lubrication question does Ada Marlow have about Zephyr QX-100?',
      ru: 'Какой открытый вопрос о смазке уплотнения Zephyr QX-100 остаётся у Ada Marlow?',
    },
    reviewExpectation:
      'Remember Ada’s unresolved question about regular seal lubrication under the servicing contract. Neither inclusion nor exclusion is established; the source does not claim the whole contract is silent or that an external asking/writing action took place.',
  },
  {
    id: 'v20-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, утверждаю, что гарантия Zephyr QX-100 не покрывает треснувшую опорную пластину. Из этой записи об исключении не следует ответ на вопрос о покрытии ремонта приводного вала. Это не утверждение о молчании всего договора.',
      },
    ],
    view: 'factual',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty excludes damage to the base plate.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'What does Ada Marlow’s exclusion establish about the Zephyr QX-100 base plate and drive-shaft repair?',
      ru: 'Что утверждается в исключении Ada Marlow об опорной пластине Zephyr QX-100 и ремонте приводного вала?',
    },
    reviewExpectation:
      'Keep the asserted cracked-base-plate exclusion with negated polarity, and distinguish this record’s inability to settle drive-shaft-repair coverage from a claim about the whole contract’s silence. Warranty covers a repair, not repair covering the warranty or shaft.',
  },
  {
    id: 'v20-held-assistant',
    language: 'en',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'I tentatively think Zephyr QX-100 servicing might include a connector continuity test each month. I have neither read the service agreement nor verified that interpretation. I am describing a possible contractual term, not an established obligation.',
      },
    ],
    view: 'reports',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative connector test did the assistant suggest might be included for Zephyr QX-100?',
      ru: 'Какую предварительную версию о тесте разъёма Zephyr QX-100 предложил ассистент?',
    },
    reviewExpectation:
      'Keep assistant attribution, tentative possibility of monthly connector-continuity testing, and both personal lack-of-reading and lack-of-verification limits. A contractual term must not become a device state or established requirement. Do not broaden the assistant’s personal limits into global absence of examination or evidence.',
  },
  {
    id: 'v20-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, предлагаю обсудить вымышленный случай про Zephyr QX-100. Это пока предложение обсудить; реального договора мы здесь не заключаем.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'In the invented case, Vulpine Mutual promises the fictional Bo Winters free hinge-pin replacements during the first eleven days of ownership. That promise exists only inside this made-up case.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional hinge-pin promise did Ada Marlow propose discussing for Zephyr QX-100?',
      ru: 'Какое вымышленное обещание о штифте петли Zephyr QX-100 предложила обсудить Ada Marlow?',
    },
    reviewExpectation:
      'Keep the actual proposal to discuss and the complete scoped fictional promise: Vulpine promising fictional Bo free hinge-pin replacements for the first eleven days of ownership. No actual agreement, performed discussion or real promise follows. The duration is not a dated event; fictional content is present, not unspecified.',
  },
  {
    id: 'v20-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The offer was to send Zephyr QX-100 to a service room for a visual inspection of the pressure valve. I, Ada Marlow, rejected that offer and do not intend to send the device under it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'No carrier collection has been arranged. The offered shipment remains rejected, not accepted.',
      },
    ],
    view: 'history',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which pressure-valve inspection offer did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение об осмотре клапана давления Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada’s rejection and lack of intent to send the device under the offer, the exact visual inspection purpose and destination, and the independent unarranged collection. Rejected plan metadata does not assert personal intent, actual shipment, or a causal relation.',
  },
  {
    id: 'v20-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, propose reviewing the Zephyr QX-100 repair terms next month. I have not accepted a plan or organized a meeting; this is my proposal only.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Дата первоначальной записи неизвестна. «Следующий месяц» означает месяц после этой записи, а не после обработки. Какой это календарный месяц, установить невозможно.',
      },
    ],
    view: 'planning',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated repair-terms proposal did Ada Marlow make for Zephyr QX-100?',
      ru: 'Какое недатированное предложение об условиях ремонта Zephyr QX-100 сделала Ada Marlow?',
    },
    reviewExpectation:
      'Keep Ada as actual proposer, a review of repair terms next month relative to the undated original record, unknown calendar month, no accepted plan and no arranged meeting. Preserve the unknown temporal envelope and distinguish tentative time from an uncertain claim that a proposal occurred.',
  },
  {
    id: 'v20-held-alternatives',
    language: 'mixed',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, рассматриваю две конкурирующие гипотезы о сбое Zephyr QX-100: погнутая направляющая или ослабленное крепление ремня. Это только предварительные версии.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, have not selected either cause. Neither hypothesis has supporting evidence.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing fault hypotheses did Ada Marlow consider for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о сбое Zephyr QX-100 рассматривала Ada Marlow?',
    },
    reviewExpectation:
      'Keep Ada’s consideration of a bent guide rail versus a loose belt fastener as tentative competing hypotheses, the explicit absence of evidence for both, and her personal nonselection. Do not turn consideration into actual discussion, looseness into unspecified installation error, or either option into an established cause.',
  },
  {
    id: 'v20-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, recorded a thirty-three-month warranty for Zephyr QX-100.',
      },
    ],
    view: 'factual',
    ordinary: '## Warranty\nThe Zephyr QX-100 warranty lasts thirty-three months.',
    ordinaryFactual: true,
    admission: 'read-only',
    queries: {
      en: 'How long is the Zephyr QX-100 warranty in Ada Marlow’s record?',
      ru: 'Каков срок гарантии Zephyr QX-100 в записи Ada Marlow?',
    },
    reviewExpectation:
      'This invented source is understandable but its isolated destination is read-only. Preserve the source bytes and return a distinct admission hold with no unsupported answer, rather than claiming source absence or service unavailability.',
    hold: true,
  },
];
