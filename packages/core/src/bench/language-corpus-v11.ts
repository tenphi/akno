import type { LanguageCaseV2 } from './language-corpus-v2.ts';

/** Exposed v10 held-out cases form development; fresh sources keep the broader semantic scope. */
export const LANGUAGE_CORPUS_V11: LanguageCaseV2[] = [
  {
    id: 'v10-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    id: 'v11-dev-admission',
    language: 'ru',
    scenario: 'read-only-admission',
    split: 'development',
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
  {
    id: 'v11-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
    split: 'held-out',
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
];
