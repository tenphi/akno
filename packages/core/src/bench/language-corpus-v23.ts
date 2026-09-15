import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V22 } from './language-corpus-v22.ts';

const user = (...turns: string[]) =>
  turns.map((text, index) => ({
    item_id: `turn-${1111 * (index + 1)}`,
    role: 'user' as const,
    speaker: 'Ada Marlow',
    text,
  }));

/** New invented sources; expectations require independent approval before live execution. */
export const LANGUAGE_CORPUS_V23: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V22.filter((entry) => entry.split === 'held-out').map((entry) => ({
    ...entry,
    split: 'development' as const,
  })),
  {
    id: 'v23-held-relayed-service',
    split: 'held-out',
    language: 'ru',
    scenario: 'nested-report',
    items: user(
      'Я, Ada Marlow, записываю сообщение Bo Winters об обслуживании Zephyr QX-100 компанией Vulpine Mutual. Я не читала условия и не проверяла это сообщение.',
      'Bo Winters сказал, что Vulpine Mutual разрешает отправить Zephyr QX-100 в мастерскую для измерения яркости индикатора.',
      'Уточняю содержание его сообщения: речь шла об измерении яркости, а не о замене индикатора. Отдельно: я ещё не сняла защитную крышку со своего Zephyr QX-100.',
    ),
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Пересказ\nAda Marlow передаёт сообщение Bo Winters: Vulpine Mutual разрешает отправить Zephyr QX-100 в мастерскую для измерения яркости индикатора. Ada не читала условия и не проверяла сообщение.',
    ordinaryFactual: false,
    queries: {
      en: 'What service report did Ada Marlow relay from Bo Winters about the Zephyr QX-100 indicator?',
      ru: 'Какое сообщение Bo Winters об индикаторе Zephyr QX-100 пересказала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada as outer recorder, Bo as the inner reporter, the alleged permission to send the device to a workshop to measure indicator brightness, and Ada’s clarification that the reported action was measurement rather than replacement. This does not prohibit all replacement or establish real permission. Keep her personal unread/unverified limits and separately her asserted fact that she has not removed her device’s protective cover.',
  },
  {
    id: 'v23-held-assumed-interval',
    split: 'held-out',
    language: 'mixed',
    scenario: 'conditional-hypothesis',
    items: user(
      'For a hypothetical Zephyr QX-100 maintenance example, assume the latch is lubricated after every eleven operating cycles.',
      'Только при таком предположении двенадцать циклов без смазки нарушили бы этот условный интервал. Я не знаю реального правила и не утверждаю, что смазку действительно пропустили.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary:
      '## Hypothesis\nAssume the Zephyr QX-100 latch is lubricated after every eleven operating cycles. Only under that assumption would twelve cycles without lubrication breach that interval. Ada Marlow does not know the real rule and reports no actual missed lubrication.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical latch-lubrication scenario did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой гипотетический сценарий смазки защёлки Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retain the assumed eleven-cycle lubrication rule and its twelve-cycle conditional breach as one hypothetical unit, with Ada’s personal ignorance of the actual rule and explicit denial of reporting an actual omission. Do not establish a duty, missed service, calendar date, or duration measured in days.',
  },
  {
    id: 'v23-held-declined-extension',
    split: 'held-out',
    language: 'en',
    scenario: 'counterfactual',
    items: user(
      'I, Ada Marlow, declined the optional Zephyr QX-100 cable-protection extension.',
      'Had I accepted that extension, repair of the connector after twenty-two months of use would have been free. I did not accept it; this is the unrealized benefit, not coverage I currently have.',
    ),
    view: 'discussion',
    commitment: 'counterfactual',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nAda Marlow declined the optional Zephyr QX-100 cable-protection extension. Had she accepted it, connector repair after twenty-two months of use would have been free. This benefit is unrealized, not her current coverage.',
    ordinaryFactual: false,
    queries: {
      en: 'What unrealized connector-repair benefit did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какую нереализованную льготу по ремонту разъёма Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada’s actual rejection and the unrealized free connector repair after twenty-two months of use, dependent on accepting the extension. The counterfactual remains available for discussion; it is neither actual coverage nor a completed repair, replacement promise, calendar event or canceled fact.',
  },
  {
    id: 'v23-held-scoped-exclusion',
    split: 'held-out',
    language: 'ru',
    scenario: 'coverage-exclusion',
    items: user(
      'Я, Ada Marlow, записываю: гарантия Zephyr QX-100 исключает повреждение тканевого уплотнителя, вызванное воском.',
      'Это исключение само по себе не отвечает на вопрос, покрывается ли замена шарнирной петли. Оно также не означает, что договор ничего не говорит об этой шарнирной петле.',
    ),
    view: 'factual',
    polarity: 'negated',
    admission: 'writable',
    ordinary:
      '## Coverage\nThe Zephyr QX-100 warranty excludes wax-caused damage to the fabric seal. This exclusion alone does not settle hinge-replacement coverage or establish that the agreement is silent about the hinge.',
    ordinaryFactual: true,
    queries: {
      en: 'What does Ada Marlow’s Zephyr QX-100 exclusion record establish about the fabric seal and hinge?',
      ru: 'Что запись Ada Marlow об исключении из гарантии Zephyr QX-100 устанавливает о тканевом уплотнителе и петле?',
    },
    reviewExpectation:
      'Retain the specific exclusion of wax-caused fabric-seal damage, with negative polarity, and separately the limit that this exclusion does not settle hinge-replacement coverage or prove contract silence. Do not exclude all seal damage, assert inclusion/exclusion of hinge replacement, or change damage coverage into a replacement benefit.',
  },
  {
    id: 'v23-held-assistant-reading',
    split: 'held-out',
    language: 'mixed',
    scenario: 'assistant-speculation',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'My tentative reading is that Vulpine Mutual may supply a return label for Zephyr QX-100 servicing. Я не читал условия и не проверял это предположение. Наличие такой возможности не означает, что возврат уже оформлен или отправка назначена.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    commitment: 'tentative',
    admission: 'writable',
    ordinary:
      '## Assistant report\nThe assistant tentatively thinks Vulpine Mutual may supply a return label for Zephyr QX-100 servicing. The assistant has not read the conditions or verified this assumption. A possible return label does not establish an arranged return or scheduled shipment.',
    ordinaryFactual: false,
    queries: {
      en: 'What did the assistant speculate about a return label for Zephyr QX-100 servicing?',
      ru: 'Какое предположение о возвратной этикетке для обслуживания Zephyr QX-100 высказал ассистент?',
    },
    reviewExpectation:
      'Preserve tentative assistant attribution, the possibility that Vulpine Mutual supplies a return label for servicing, and the assistant’s personal lack of reading and verification. A possible service provision is not an arranged return, scheduled shipment, completed dispatch, or established contractual duty.',
  },
  {
    id: 'v23-held-fictional-key',
    split: 'held-out',
    language: 'ru',
    scenario: 'fictional-example',
    items: user(
      'Я, Ada Marlow, предлагаю обсудить вымышленный пример о Zephyr QX-100. Это не реальное соглашение.',
      'В этой истории вымышленная Vulpine Mutual одалживает вымышленному Bo Winters запасной металлический ключ для крышки Zephyr QX-100 на первые тридцать три дня после вымышленного осмотра. Это физический ключ, не код доступа. Заём существует только внутри истории.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary:
      '## Fictional example\nIn Ada Marlow’s fictional story, fictional Vulpine Mutual lends fictional Bo Winters a spare metal key for the Zephyr QX-100 cover for the first thirty-three days after a fictional inspection. It is a physical key, not an access code, and the loan exists only in the story.',
    ordinaryFactual: false,
    queries: {
      en: 'What fictional key loan did Ada Marlow propose discussing for Zephyr QX-100?',
      ru: 'Какой вымышленный заём ключа для Zephyr QX-100 Ada Marlow предложила обсудить?',
    },
    reviewExpectation:
      'Retain Ada’s real proposal to discuss an invented example separately from its hypothetical payload. Preserve the fictional lender, borrower, spare physical metal cover key rather than an access code, first thirty-three days after fictional inspection, and absence of a real agreement. Neither discussion, inspection nor loan is established as completed in the real world.',
  },
  {
    id: 'v23-held-undated-review',
    split: 'held-out',
    language: 'ru',
    scenario: 'relative-unknown-date',
    items: user(
      'Дата этой реплики неизвестна. Я, Ada Marlow, предлагаю обсудить условия обслуживания Zephyr QX-100 через одиннадцать дней после этой реплики, а не после обработки записи.',
      'Предложение пока не принято. Встреча не назначена.',
    ),
    view: 'planning',
    admission: 'writable',
    ordinary:
      '## Proposal\nAda Marlow proposes discussing the Zephyr QX-100 service conditions eleven days after an utterance of unknown date, not eleven days after processing. The proposal is unaccepted and no meeting is scheduled.',
    ordinaryFactual: false,
    queries: {
      en: 'What unaccepted proposal did Ada Marlow make for discussing Zephyr QX-100 service conditions, and when?',
      ru: 'Какой план обсуждения условий обслуживания Zephyr QX-100 предложила Ada Marlow и к какому времени он относится?',
    },
    reviewExpectation:
      'Preserve Ada’s asserted proposal, unaccepted disposition, discussion of service conditions, eleven-day offset from the utterance, unknown utterance date, and absence of a scheduled meeting. Use an unknown tentative time envelope without inventing a calendar date, clock, acceptance or scheduled event. Processing time is explicitly not the anchor.',
  },
  {
    id: 'v23-held-competing-clicks',
    split: 'held-out',
    language: 'en',
    scenario: 'competing-hypotheses',
    items: user(
      'I, Ada Marlow, am considering two preliminary explanations for clicking in Zephyr QX-100: a cracked guide rail, or a locking pin seated at an angle.',
      'I have chosen neither explanation. Neither has supporting observations, and this record does not confirm that the clicking itself occurs.',
    ),
    view: 'discussion',
    commitment: 'tentative',
    admission: 'writable',
    ordinary:
      '## Preliminary hypotheses\nAda Marlow considers a cracked guide rail or an angled locking pin as explanations for Zephyr QX-100 clicking. She has chosen neither; neither has supporting observations, and this record does not confirm that clicking occurs.',
    ordinaryFactual: false,
    queries: {
      en: 'What competing hypotheses did Ada Marlow consider for clicking in Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы щелчков в Zephyr QX-100 рассматривала Ada Marlow?',
    },
    reviewExpectation:
      'Retain both tentative causes with their exact mechanisms: cracked guide rail and locking pin seated at an angle. Keep Ada’s personal nonselection, no supporting observations for either, and the record-scoped lack of confirmation of clicking itself. Do not replace the symptom, broaden angled seating to generic damage, claim no one selected a cause, or establish a real fault.',
  },
  {
    id: 'v23-held-open-renewal',
    split: 'held-out',
    language: 'mixed',
    scenario: 'open-question',
    items: user(
      'Для Zephyr QX-100 у меня, Ada Marlow, остаётся открытый вопрос: does renewing the service plan require a new paper inspection certificate?',
      'I do not yet have an answer. My unanswered question does not establish that the agreement is silent, and I have not submitted a renewal request.',
    ),
    view: 'questions',
    admission: 'writable',
    ordinary:
      '## Open question\nAda Marlow has no answer yet to whether renewing the Zephyr QX-100 service plan requires a new paper inspection certificate. Her unanswered question does not establish contract silence, and she has not submitted a renewal request.',
    ordinaryFactual: false,
    queries: {
      en: 'What open question does Ada Marlow have about renewing the Zephyr QX-100 service plan?',
      ru: 'Какой открытый вопрос остаётся у Ada Marlow о продлении плана обслуживания Zephyr QX-100?',
    },
    reviewExpectation:
      'Retain the unanswered question about a new paper inspection certificate being required for service-plan renewal, with question kind and no commitment to either answer. Preserve Ada’s personal lack of an answer, the distinction from contract silence, and separately her assertion that she has not submitted a renewal request. Do not establish a requirement, exemption, renewal or submission.',
  },
  {
    id: 'v23-held-rejected-inspection',
    split: 'held-out',
    language: 'en',
    scenario: 'rejected-plan',
    items: user(
      'I, Ada Marlow, rejected the offer to take my Zephyr QX-100 to the workshop so that its alignment gauge could be checked.',
      'I have no plan to take it there. No inspection appointment has been made, and I have not transported the device.',
    ),
    view: 'history',
    admission: 'writable',
    ordinary:
      '## Rejected offer\nAda Marlow rejected taking her Zephyr QX-100 to the workshop to check its alignment gauge. She has no plan to take it there, no inspection appointment has been made, and she has not transported the device.',
    ordinaryFactual: false,
    queries: {
      en: 'Which inspection offer did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение об осмотре Zephyr QX-100 отвергла Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada as rejecting agent, the rejected offer to take the entire device to the workshop for a check of its alignment gauge, and the separate no-plan, no-appointment and no-transport assertions. Do not turn taking the device into transporting just the gauge, checking the gauge into measuring a specific unmentioned property, or a rejected offer into an active plan or completed inspection.',
  },
  {
    id: 'v23-held-read-only',
    split: 'held-out',
    language: 'en',
    scenario: 'read-only-admission',
    items: user('The Zephyr QX-100 support period lasts eleven years.'),
    view: 'factual',
    admission: 'read-only',
    hold: true,
    ordinary: 'The Zephyr QX-100 support period lasts eleven years.',
    ordinaryFactual: true,
    queries: { en: 'What is the Zephyr QX-100 support period?', ru: 'Каков срок поддержки Zephyr QX-100?' },
    reviewExpectation:
      'The fact is understandable, but the target is read-only. Retention must hold for admission without changing source bytes. The memory-folder query must not invent retained evidence or classify missing write permission as unavailable interpretation or proof that support is absent.',
  },
];
