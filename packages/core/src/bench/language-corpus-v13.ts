import type { LanguageCaseV2 } from './language-corpus-v2.ts';

/** Fresh held-out wording retains the broader semantic scope; v12 cases become development. */
export const LANGUAGE_CORPUS_V13: LanguageCaseV2[] = [
  {
    id: 'v12-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters told me the Zephyr QX-100 service agreement includes a workshop visit to clean the cooling duct. Он говорил о чистке канала, а не об установке нового вентилятора.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, записываю услышанное от Bo Winters. У меня нет подтверждения его слов; это пока только сообщение со слов другого человека.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified workshop-visit report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Что Ada Marlow записала со слов Bo Winters о посещении мастерской с Zephyr QX-100?',
    },
    reviewExpectation:
      'Keep Ada Marlow as recorder, Bo Winters as inner speaker, and explicit lack of confirmation. The reported workshop visit is for cooling-duct cleaning, not installation of a new fan; retain that coupled contrast without asserting actual coverage.',
  },
  {
    id: 'v12-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для обсуждения допустим, что у Zephyr QX-100 крепления проверяют раз в пять месяцев. Если пропустить такую проверку, предполагаемое правило было бы нарушено. Это условие нашего рассуждения, а действительный регламент мы не знаем.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical mounting-check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое условное правило проверки креплений Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the assumed five-month mounting-check interval and the consequence of missing a check inside that assumption. Keep Ada Marlow as source. This is a hypothetical rule, not an established obligation or dated schedule.',
  },
  {
    id: 'v12-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I declined the optional Zephyr QX-100 maintenance extension. Отказ — моё состоявшееся решение.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я согласилась, чистка охлаждающего канала на третьем году входила бы в обслуживание. But I did not accept it; this describes the unrealized alternative.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which counterfactual maintenance-extension alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант продлённого обслуживания Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retention preserves the actual declined extension and the unrealized third-year cooling-duct cleaning, together or in separate decision and counterfactual records. Discussion answers can focus on the counterfactual but cannot imply acceptance or actual coverage.',
  },
  {
    id: 'v12-held-question',
    language: 'en',
    scenario: 'open-question',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'One Zephyr QX-100 question remains open for me: does the agreement provide a packing crate when the device is returned for repair?',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have found no answer. Keep the crate question unresolved; I am making no claim either that a crate is provided or that it is excluded.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which unresolved packing-crate question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос об упаковочном ящике для Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Remember Ada Marlow’s unanswered question about a packing crate for a repair return. Do not infer provision or exclusion from the open question.',
  },
  {
    id: 'v12-held-exclusion',
    language: 'ru',
    scenario: 'factual-negation',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Условия обслуживания Zephyr QX-100 исключают замену потёртых наклеек. Это утверждение касается именно потёртых наклеек; о повреждении корпуса здесь ничего не утверждается.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Do the Zephyr QX-100 service terms include replacing worn labels?',
      ru: 'Включают ли условия обслуживания Zephyr QX-100 замену потёртых наклеек?',
    },
    reviewExpectation:
      'Preserve the direct user assertion excluding replacement of worn labels. Do not extend it to casing damage or claim external verification. A faithful denial answers the question.',
  },
  {
    id: 'v12-held-assistant',
    language: 'en',
    scenario: 'tentative-assistant-report',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'My tentative reading is that Zephyr QX-100 service includes four cooling-duct cleanings each year. I have not checked the agreement and cannot confirm this; treat it as my unverified suggestion.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative report did the assistant give about Zephyr QX-100 duct cleaning?',
      ru: 'Что ассистент предварительно сообщил о чистке канала Zephyr QX-100?',
    },
    reviewExpectation:
      'Preserve the assistant as source, tentative commitment, and explicit lack of verification. Four cooling-duct cleanings per year is an unverified model statement, not established service coverage.',
  },
  {
    id: 'v12-held-fiction',
    language: 'en',
    scenario: 'fictional-example',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Here is an invented Zephyr QX-100 example: Vulpine Mutual promises Bo Winters free mounting checks during the first three years of ownership.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'This is fiction for our discussion. Bo Winters is a character in the example, not someone who reported an actual promise. I want the example remembered as fiction.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional mounting-check example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример проверки креплений Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as source and Vulpine Mutual’s fictional promise to Bo Winters of free mounting checks during the first three ownership years. Bo is a fictional participant, not an actual reporter. Do not turn the limited duration into lifetime coverage.',
  },
  {
    id: 'v12-held-rejected',
    language: 'ru',
    scenario: 'rejected-plan',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Мне предложили отвезти Zephyr QX-100 в мастерскую на проверку креплений. Я рассмотрела предложение и отклонила его. Поездку я не планирую; сохранить нужно именно отклонённый вариант.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which mounting-check offer did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение о проверке креплений Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the rejected offer to take the device to a workshop for mounting checks and that no trip is planned. A rejected decision or plan is acceptable; do not create a current proposal, trip plan, or completed check.',
  },
  {
    id: 'v12-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I propose comparing the Zephyr QX-100 maintenance options next month. Это пока предложение, встреча не назначена.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У исходной записи утрачена дата. Next month refers to that undated source; the calendar month is unknown.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated maintenance-options proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о сравнении вариантов обслуживания Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s proposal for next month relative to the undated original record. Readable prose must retain the unknown source/calendar month; no processing-date rebasing or scheduled appointment.',
  },
  {
    id: 'v12-held-alternatives',
    language: 'en',
    scenario: 'competing-hypotheses',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For the Zephyr QX-100 noise I am keeping two competing hypotheses: a loose mounting bracket, or a clogged cooling duct. Neither explanation is confirmed.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'There is no evidence favoring the loose bracket over the clogged duct, or vice versa. Remember both possibilities without treating either as the selected cause.',
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
      'Preserve both unconfirmed causes under consideration, loose mounting bracket and clogged cooling duct, with equal lack of support and no selected cause. Tentative or hypothetical commitment is acceptable; asserted/current factual eligibility for an embedded cause is not.',
  },
  {
    id: 'v12-held-admission',
    language: 'ru',
    scenario: 'read-only-admission',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Гарантия Zephyr QX-100 действует пятьдесят пять месяцев.',
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
      'All destinations are read-only. Hold retention and abstain over the empty memory folder without changing existing source files.',
    hold: true,
    commitment: 'asserted',
  },
  {
    id: 'v13-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters сказал мне, что условия обслуживания Zephyr QX-100 предусматривают выезд для осмотра разъёма питания.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Он описывал осмотр разъёма, а не замену сетевого кабеля. Я, Ada Marlow, сохраняю услышанное от Bo Winters без подтверждения; самих условий у меня пока нет.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified power-connector inspection report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Что Ada Marlow записала со слов Bo Winters об осмотре разъёма питания Zephyr QX-100?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder, Bo Winters as inner speaker and lack of confirmation. The reported terms provide a visit for power-connector inspection, not power-cable replacement. Preserve the coupled contrast; the report does not establish a booked visit, an event date, or independently verified coverage.',
  },
  {
    id: 'v13-held-hypothesis',
    language: 'en',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For this discussion, assume that Zephyr QX-100 needs a rubber-foot check once every six months. On that assumption a missed check would breach the imagined rule. We do not know the actual maintenance requirement.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical rubber-foot check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое условное правило проверки резиновых ножек Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Keep Ada Marlow’s assumed six-month rubber-foot check and the conditional consequence of missing it. This is an assumed discussion rule, not an established requirement or a scheduled calendar event.',
  },
  {
    id: 'v13-held-counterfactual',
    language: 'ru',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я отказалась от дополнительного плана обслуживания Zephyr QX-100. Отказ уже состоялся.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я выбрала этот план, ремонт разъёма питания на пятом году был бы включён. Это нереализованный вариант: дополнительный план я не выбрала.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which counterfactual additional-service alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант дополнительного обслуживания Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retain both the actual declined plan and the unrealized fifth-year power-connector repair coverage, in one qualified record or separate decision/counterfactual records. A focused discussion answer may describe the unrealized alternative but must not suggest acceptance.',
  },
  {
    id: 'v13-held-question',
    language: 'mixed',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Мне нужно сохранить открытый вопрос о Zephyr QX-100: does the service include a replacement carrying handle?',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Пока ответа нет. I am neither confirming nor excluding the replacement handle; leave the question open.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which unanswered carrying-handle question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о ручке для переноски Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s unresolved question about a replacement carrying handle, without inferring that service includes or excludes it.',
  },
  {
    id: 'v13-held-exclusion',
    language: 'en',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Zephyr QX-100 maintenance agreement does not cover removing sticker residue. This exclusion is limited to sticker residue and says nothing about damaged rubber feet.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 maintenance agreement cover removing sticker residue?',
      ru: 'Покрывает ли договор обслуживания Zephyr QX-100 удаление следов наклеек?',
    },
    reviewExpectation:
      'Preserve the direct user assertion excluding sticker-residue removal. Do not broaden it to damaged rubber feet or imply independent verification. A qualified direct denial is useful.',
  },
  {
    id: 'v13-held-assistant',
    language: 'mixed',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Я предварительно предполагаю, что для Zephyr QX-100 service includes two carrying-handle adjustments per year. Я не проверял условия; это моё неподтверждённое предположение.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative report did the assistant give about Zephyr QX-100 carrying-handle adjustments?',
      ru: 'Что ассистент предварительно сообщил о регулировке ручки Zephyr QX-100?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative commitment and explicit lack of verification for two carrying-handle adjustments per year. This is an unverified model statement, not established coverage.',
  },
  {
    id: 'v13-held-fiction',
    language: 'ru',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Вот вымышленный пример о Zephyr QX-100: Vulpine Mutual обещает Bo Winters бесплатную проверку разъёма питания в течение первых двух лет владения.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters здесь персонаж придуманного примера, а не источник реального сообщения. Я сохраняю пример для обсуждения; настоящего обещания он не устанавливает.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional power-connector check example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример проверки разъёма питания Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Keep Ada Marlow as source and the fictional promise by Vulpine Mutual to Bo Winters of free power-connector checks in the first two ownership years. Bo is a character rather than an actual reporter; preserve fictional scope and limited duration.',
  },
  {
    id: 'v13-held-rejected',
    language: 'mixed',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'There was an offer to take Zephyr QX-100 to a workshop for a rubber-foot inspection. Я рассмотрела и отклонила предложение. Поездку не планирую; запомнить стоит отклонённое предложение.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which rubber-foot inspection offer did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение о проверке резиновых ножек Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Retention must preserve the rejected workshop-inspection offer and explicit absence of a trip plan. A focused answer describing the rejected offer preserves its nonactionable disposition without repeating a redundant no-trip clause. Do not call it a current proposal, scheduled trip or completed inspection.',
  },
  {
    id: 'v13-held-undated',
    language: 'ru',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Предлагаю завтра сопоставить варианты ремонта Zephyr QX-100. Это предложение, договорённости о встрече нет.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Дата исходной заметки неизвестна. Завтра относится к моменту той записи; соответствующий календарный день восстановить нельзя.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated repair-options comparison proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о сравнении вариантов ремонта Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s proposal for tomorrow relative to the undated source. Readable prose must preserve both the source-relative timing and unknown source/calendar date. Do not create an arranged meeting or reinterpret tomorrow relative to processing time.',
  },
  {
    id: 'v13-held-alternatives',
    language: 'mixed',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для стука в Zephyr QX-100 рассматриваю две конкурирующие гипотезы: ослабленная резиновая ножка либо треснувшая ручка. Ни одна не подтверждена.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'A loose rubber foot and a cracked carrying handle remain equally unsupported explanations. I am keeping both possibilities and have not chosen either as the cause.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing knocking-noise hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о стуке в Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Keep both unconfirmed possible explanations, a loose rubber foot and a cracked carrying handle, with equal lack of support and no selected cause. Tentative or hypothetical commitment may preserve the meaning; neither embedded cause may become an ordinary asserted/current fact.',
  },
  {
    id: 'v13-held-admission',
    language: 'en',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Zephyr QX-100 warranty duration is sixty-six months.',
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
      'Every destination is read-only. Retention must hold and answers must abstain over the empty memory folder while existing files remain unchanged.',
    hold: true,
    commitment: 'asserted',
  },
];
