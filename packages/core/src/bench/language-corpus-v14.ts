import type { LanguageCaseV2 } from './language-corpus-v2.ts';

/** Frozen before execution; development reuses exposed v13 cases and held-out sources are fresh. */
export const LANGUAGE_CORPUS_V14: readonly LanguageCaseV2[] = [
  {
    id: 'v13-held-report',
    language: 'ru',
    scenario: 'nested-report',
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
    split: 'development',
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
  {
    id: 'v14-held-report',
    language: 'mixed',
    scenario: 'nested-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Bo Winters told me the Zephyr QX-100 terms allow collection for control-panel diagnostics. Это была информация об условиях, а не запись на выезд.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Он говорил о диагностике панели, не о замене всей панели. Я, Ada Marlow, пересказываю слова Bo Winters: договор я не видела, подтверждения у меня нет.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What unverified control-panel service report did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое неподтверждённое сообщение об обслуживании панели управления Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Retain Ada Marlow as recorder, Bo Winters as speaker, no confirmation and no contract inspection. The reported terms allow collection for control-panel diagnostics, not whole-panel replacement; no collection is booked. Preserve the coupled scope contrast and do not turn provision into a booking.',
  },
  {
    id: 'v14-held-hypothesis',
    language: 'ru',
    scenario: 'hypothetical-maintenance',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Для обсуждения временно примем правило: вентиляционную решётку Zephyr QX-100 проверяют раз в квартал. Тогда пропущенная проверка нарушила бы именно это допущенное правило.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Настоящее требование нам неизвестно. Ни само правило, ни вывод о его нарушении не описывают установленное положение дел.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What hypothetical vent-check rule did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какое гипотетическое правило проверки вентиляционной решётки Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the assumed quarterly vent-check rule and the stated conditional consequence of missing a check. Neither the actual maintenance requirement nor an actual breach is established. Keep Ada Marlow attribution and conditional scope; no calendar booking follows.',
  },
  {
    id: 'v14-held-counterfactual',
    language: 'mixed',
    scenario: 'counterfactual',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I declined the extra Zephyr QX-100 service plan. That decision is final; I did not enroll.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я тогда согласилась, замена кнопки управления на третьем году была бы включена. Это контрфактическое рассуждение о невыбранном варианте, не о моём действующем обслуживании.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which unrealized control-button service alternative did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой нереализованный вариант обслуживания кнопки Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Retain the actual rejected plan and counterfactual third-year control-button replacement coverage, together or in separate qualified records. A focused answer must preserve the unrealized alternative and actual nonacceptance, without asserting current coverage or enrollment.',
  },
  {
    id: 'v14-held-question',
    language: 'ru',
    scenario: 'open-question',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Запиши мой открытый вопрос о Zephyr QX-100: дают ли подменное устройство на время ремонта? Я, Ada Marlow, пока не нашла ответа.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Это не утверждение о наличии подмены и не утверждение, что её исключают. Вопрос остаётся нерешённым.',
      },
    ],
    view: 'questions',
    ordinary: '## Open question\nDoes Zephyr QX-100 require a seal check?',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which unanswered loan-unit question did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какой нерешённый вопрос о подменном устройстве Zephyr QX-100 записала Ada Marlow?',
    },
    reviewExpectation:
      'Remember Ada Marlow’s unresolved question about a loan unit during repairs. Do not assert provision or exclusion; a qualified description of the question is a useful answer about the record.',
  },
  {
    id: 'v14-held-exclusion',
    language: 'mixed',
    scenario: 'factual-negation',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The Zephyr QX-100 agreement excludes polishing cosmetic scuffs on the housing. Я говорю только о такой полировке; это ничего не устанавливает о ремонте кнопок.',
      },
    ],
    view: 'factual',
    ordinary: 'The Zephyr QX-100 service agreement excludes paint fading.',
    ordinaryFactual: true,
    admission: 'writable',
    queries: {
      en: 'Does the Zephyr QX-100 agreement cover polishing cosmetic housing scuffs?',
      ru: 'Покрывает ли соглашение по Zephyr QX-100 полировку косметических потёртостей корпуса?',
    },
    reviewExpectation:
      'Preserve the direct user assertion excluding cosmetic-scuff polishing. Do not broaden it to button repair or imply independent verification. A direct qualified denial is useful and source-entailed.',
  },
  {
    id: 'v14-held-assistant',
    language: 'en',
    scenario: 'tentative-assistant-report',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'My tentative reading is that Zephyr QX-100 service includes one vent cleaning per year. I am the assistant, and I have not inspected the terms. Please treat this as my unverified interpretation, not established coverage.',
      },
    ],
    view: 'reports',
    ordinary:
      '## Report\nAccording to Bo Winters, Zephyr QX-100 inspection is included; this report is unverified.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What tentative vent-cleaning report did the assistant give for Zephyr QX-100?',
      ru: 'Какое предварительное сообщение о чистке вентиляции Zephyr QX-100 дал ассистент?',
    },
    reviewExpectation:
      'Preserve assistant attribution, tentative interpretation and lack of verification for one vent cleaning per year. This assistant statement is a tentative source report, not established coverage or an assumption introduced only inside a hypothetical scenario.',
  },
  {
    id: 'v14-held-fiction',
    language: 'mixed',
    scenario: 'fictional-example',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'In an invented example, Vulpine Mutual promises Bo Winters a free control-button inspection during the first three ownership years of Zephyr QX-100.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Это полностью вымышленный пример, который я, Ada Marlow, предлагаю обсудить. Bo Winters — персонаж примера. Никакого настоящего обещания я не сообщаю.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What fictional control-button inspection example did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какой вымышленный пример проверки кнопки Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Retain Ada Marlow as recorder and the fictional promise by Vulpine Mutual to Bo Winters of free control-button inspection during the first three ownership years. Bo is a fictional character, not a real reporter. Preserve fictional scope, duration and product identity.',
  },
  {
    id: 'v14-held-rejected',
    language: 'en',
    scenario: 'rejected-plan',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I considered an offer to mail Zephyr QX-100 to a workshop for a control-button inspection, and I declined it. I am not planning to send the device. Keep the declined offer in memory.',
      },
    ],
    view: 'history',
    ordinary: '## Rejected\nAda Marlow rejected a Zephyr QX-100 inspection proposal.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which control-button inspection offer did Ada Marlow decline for Zephyr QX-100?',
      ru: 'Какое предложение о проверке кнопки Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Retention preserves the declined mailing/inspection offer and absence of a shipment plan. A focused answer can describe which offer was declined without repeating a redundant no-plan clause. Do not turn rejection into an active proposal, scheduled shipment or completed inspection.',
  },
  {
    id: 'v14-held-undated',
    language: 'mixed',
    scenario: 'undated-proposal',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I propose checking the Zephyr QX-100 repair estimate next month. It is only a proposal; no appointment has been made.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Дата этой исходной записи утрачена. Следующий месяц отсчитывается от неё, а не от сегодняшнего дня; определить календарный месяц нельзя.',
      },
    ],
    view: 'planning',
    ordinary: '## Proposal\nAda Marlow proposed a Zephyr QX-100 inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'What undated repair-estimate proposal did Ada Marlow record for Zephyr QX-100?',
      ru: 'Какое предложение о проверке сметы ремонта Zephyr QX-100 записала Ada Marlow без исходной даты?',
    },
    reviewExpectation:
      'Preserve Ada Marlow’s tentative proposal to check the estimate next month relative to the original undated record. Readable retention and answers that mention next month must retain the original-source relation and unknown calendar date. No appointment is booked; never reinterpret the phrase relative to processing time.',
  },
  {
    id: 'v14-held-alternatives',
    language: 'en',
    scenario: 'competing-hypotheses',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I have two competing, unconfirmed explanations for the Zephyr QX-100 rattle: a loose control button or a bent vent grille. Neither explanation has evidence behind it, and I have not chosen one. Remember both possibilities as unresolved.',
      },
    ],
    view: 'discussion',
    ordinary: '## Hypothetical\nSuppose Zephyr QX-100 requires an annual inspection.',
    ordinaryFactual: false,
    admission: 'writable',
    queries: {
      en: 'Which competing rattle explanations did Ada Marlow discuss for Zephyr QX-100?',
      ru: 'Какие конкурирующие объяснения дребезжания Zephyr QX-100 обсуждала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve both unconfirmed alternatives, a loose control button and a bent vent grille, and the equal lack of evidence with no selected cause. Tentative or hypothetical commitment may preserve the meaning. Neither embedded cause is an established fact.',
  },
  {
    id: 'v14-held-admission',
    language: 'ru',
    scenario: 'read-only-admission',
    split: 'held-out',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Срок гарантии Zephyr QX-100 составляет семьдесят семь месяцев.',
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
