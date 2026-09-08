import type { LanguageCaseV2 } from './language-corpus-v2.ts';

/** Exposed v11 cases form development; fresh held-out sources preserve the broader scenario scope. */
export const LANGUAGE_CORPUS_V12: LanguageCaseV2[] = [
  {
    id: 'v11-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters рассказал мне, что для Zephyr QX-100 предусмотрен забор курьером на регулировку линзы. Речь шла о регулировке, не о новой линзе.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Это его слова. Я их записываю без подтверждения: условия я ещё не проверяла.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified report did Ada Marlow record about courier collection for Zephyr QX-100?',
      ru: 'Что Ada Marlow записала со слов Bo Winters о заборе Zephyr QX-100 курьером?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as recorder and Bo Winters as speaker. The unverified report concerns courier collection for lens adjustment, not replacement. Explicit lack of confirmation must survive; do not assert actual coverage.',
  },
  {
    id: 'v11-held-hypothesis',
    language: 'mixed',
    scenario: 'hypothetical-maintenance',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Предположим только для обсуждения, что Zephyr QX-100 needs a grille check every two weeks. В рамках этой гипотезы пропуск проверки нарушал бы предполагаемое правило. Реальное правило нам неизвестно.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical grille-check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какую гипотезу о проверке решётки Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the assumed two-week grille-check rule and its conditional missed-check consequence. This is an assumed scenario, not an actual maintenance obligation or a scheduled event.',
  },
  {
    id: 'v11-held-counterfactual',
    language: 'en',
    scenario: 'counterfactual',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I turned down the optional Zephyr QX-100 repair package. That was my actual choice.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'With that package, a lens repair in year four would have been included. I am describing what would have happened if I had accepted it; I did not accept the package.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which counterfactual repair-package alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический вариант ремонтного пакета Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both the actual rejected package and unrealized fourth-year lens repair coverage. One qualified record or separate decision and counterfactual records are allowed. Discussion answers may focus on the counterfactual but must not imply acceptance.',
  },
  {
    id: 'v11-held-question',
    language: 'ru',
    scenario: 'open-question',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У меня остался вопрос о Zephyr QX-100: дают ли подменное устройство на время ремонта?',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Ответ пока не найден. Сохраним именно открытый вопрос; выдачу подменного устройства я не подтверждаю и не отрицаю.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which open loan-device question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой открытый вопрос о подменном устройстве Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Remember Ada Marlow’s unanswered question about a loan device during repair, without deciding provision or exclusion.',
  },
  {
    id: 'v11-held-exclusion',
    language: 'en',
    scenario: 'factual-negation',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Zephyr QX-100 service package excludes polishing out surface scratches. This statement concerns surface scratches only; it says nothing about cracks.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 service package include polishing out surface scratches?',
      ru: 'Включает ли пакет обслуживания Zephyr QX-100 полировку поверхностных царапин?',
    },
    reviewExpectation:
      'Preserve the user-asserted exclusion for polishing surface scratches. Do not extend it to cracks or claim independent verification. A qualified direct denial is useful.',
  },
  {
    id: 'v11-held-assistant',
    language: 'ru',
    scenario: 'tentative-assistant-report',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'По моему предварительному предположению, пакет обслуживания Zephyr QX-100 включает три регулировки линзы в год. Это не проверено; текст условий я не видел.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative report did the assistant give about Zephyr QX-100 lens adjustments?',
      ru: 'Что ассистент сообщил о регулировках линзы Zephyr QX-100?',
    },
    reviewExpectation:
      'Preserve assistant attribution, lack of verification and the tentative three-adjustments-per-year claim. It is an unverified model response, not established service coverage.',
  },
  {
    id: 'v11-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Придумаем пример с Zephyr QX-100. In this fictional example, Vulpine Mutual promises Bo Winters free grille cleaning for as long as he owns the device.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Это вымышленный пример. Bo Winters — его персонаж, а не рассказчик реального случая. Я сохраняю пример только для обсуждения.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional grille-cleaning example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример чистки решётки Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow as source and the fictional promise by Vulpine Mutual to Bo Winters, covering grille cleaning for the ownership period. Bo is a fictional participant, not an actual reporter; do not broaden the duration.',
  },
  {
    id: 'v11-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'We had an offer to ship Zephyr QX-100 away for a lens inspection. I rejected the offer after considering it. The shipment is not planned; please remember the rejected offer.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which lens-inspection offer did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение о проверке линзы Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s rejected lens-inspection offer and absence of a shipping plan. A decision or rejected plan is allowed; do not turn it into a proposed/current shipment or completed inspection.',
  },
  {
    id: 'v11-held-undated',
    language: 'en',
    scenario: 'undated-proposal',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I suggest reviewing the Zephyr QX-100 service terms next week. I have not arranged an appointment; this is a proposal.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The original note has no date. Next week is relative to that note, and its calendar dates cannot be recovered.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated service-terms review proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о проверке условий обслуживания Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s proposal for next week relative to an undated original note. Readable prose must preserve the unknown source/calendar date. Do not create a scheduled appointment or rebase to today.',
  },
  {
    id: 'v11-held-alternatives',
    language: 'mixed',
    scenario: 'competing-hypotheses',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для сбоя Zephyr QX-100 у меня две конкурирующие гипотезы: загрязнённая решётка либо смещённая линза. Ни одна не подтверждена.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'A dirty grille and a misaligned lens remain equally unsupported possibilities. Keep both explanations; I am not selecting a cause.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing fault hypotheses did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие гипотезы о сбое Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both unconfirmed possible explanations, dirty grille and misaligned lens, with neither selected or more supported. Tentative or hypothetical qualification is acceptable when the complete competing-hypothesis semantics remain explicit; neither is an established cause.',
  },
  {
    id: 'v11-held-admission',
    language: 'mixed',
    scenario: 'read-only-admission',
    split: 'development',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для Zephyr QX-100 warranty duration is forty-four months.',
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
  {
    id: 'v12-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
];
