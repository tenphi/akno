import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V21 } from './language-corpus-v21.ts';

/** Independently authored and reviewed held-out inputs replace the quarantined prior split. */
export const LANGUAGE_CORPUS_V22: readonly LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V21.filter((entry) => entry.split === 'development'),

  {
    id: 'v22-held-nested-report',
    split: 'held-out',
    language: 'ru',
    scenario: 'nested-report',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, пересказываю слова Bo Winters о правилах Vulpine Mutual для Zephyr QX-100. Я не видела эти правила и не проверяла его сообщение.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'По словам Bo Winters, Vulpine Mutual разрешает принести устройство в мастерскую для проверки сопротивления заземляющего контакта.',
      },
      {
        item_id: 'turn-3333',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Он говорил именно о проверке сопротивления контакта, а не о замене контакта. Отдельно: я ещё не упаковала своё устройство для такой проверки.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Пересказ\nAda Marlow передаёт непроверенное сообщение Bo Winters: правила Vulpine Mutual разрешают принести Zephyr QX-100 в мастерскую для проверки сопротивления заземляющего контакта, но не для его замены. Ada не видела правила, не проверяла сообщение и ещё не упаковала своё устройство.',
    ordinaryFactual: false,
    queries: {
      en: 'What grounding-contact service report did Ada Marlow relay from Bo Winters about Zephyr QX-100?',
      ru: 'Какое сообщение Bo Winters о заземляющем контакте Zephyr QX-100 пересказала Ada Marlow?',
    },
    reviewExpectation:
      'Retain Ada as the outer relayer and Bo as the inner source; Vulpine Mutual allegedly permits workshop delivery to check grounding-contact resistance, specifically not replacement. Ada did not see the rules, did not verify Bo’s report, and separately has not packed her device. No confirmed permission or completed service is established.',
  },
  {
    id: 'v22-held-conditional-hypothesis',
    split: 'held-out',
    language: 'en',
    scenario: 'conditional-hypothesis',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'For this hypothetical analysis, assume the Zephyr QX-100 drain channel is cleared every six weeks.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Only under that assumption, leaving the channel uncleared for seven weeks would breach the assumed schedule. I do not know the real maintenance rule, and I am not reporting an actual missed clearing.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary:
      '## Hypothesis\nAssume the Zephyr QX-100 drain channel is cleared every six weeks. Under that assumption alone, seven weeks without clearing breaches the schedule. Ada Marlow does not know the real rule and reports no actual missed clearing.',
    ordinaryFactual: false,
    queries: {
      en: 'What conditional drain-channel maintenance scenario did Ada Marlow set out for Zephyr QX-100?',
      ru: 'Какой условный сценарий обслуживания дренажного канала Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Keep the assumed six-week clearing schedule and its conditional seven-week breach together. Ada does not know the real rule and reports no actual omission. The interval is a recurring property, not a dated event or established obligation.',
  },
  {
    id: 'v22-held-counterfactual',
    split: 'held-out',
    language: 'mixed',
    scenario: 'counterfactual',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, did not enroll my Zephyr QX-100 in the optional corrosion plan.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Если бы я оформила этот план, замена внутренней пружины после тридцати трёх месяцев использования была бы бесплатной. План не оформлен, поэтому это только нереализованное следствие.',
      },
    ],
    view: 'discussion',
    commitment: 'counterfactual',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nAda Marlow did not enroll Zephyr QX-100 in the optional corrosion plan. Had she enrolled, replacement of the internal spring after thirty-three months of use would have been free. That benefit is unrealized.',
    ordinaryFactual: false,
    queries: {
      en: 'What unrealized internal-spring benefit did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какую нереализованную льготу для внутренней пружины Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the actual non-enrollment and the counterfactual free internal-spring replacement after thirty-three months. The benefit depends on the false enrollment antecedent and is not current coverage; the usage interval is not a calendar date.',
  },
  {
    id: 'v22-held-coverage-exclusion',
    split: 'held-out',
    language: 'en',
    scenario: 'coverage-exclusion',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, record that the Zephyr QX-100 warranty excludes damage to the ceramic spacer caused by sand.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'This exclusion alone does not answer whether replacement of the intake sleeve is covered. It also does not say that the agreement is silent about that sleeve.',
      },
    ],
    view: 'factual',
    polarity: 'negated',
    admission: 'writable',
    ordinary:
      '## Coverage\nThe Zephyr QX-100 warranty excludes sand damage to the ceramic spacer. This record does not settle coverage for replacing the intake sleeve and does not establish that the agreement is silent about it.',
    ordinaryFactual: true,
    queries: {
      en: 'What does Ada Marlow’s coverage record establish about the ceramic spacer and intake sleeve of Zephyr QX-100?',
      ru: 'Что запись Ada Marlow устанавливает о керамической проставке и впускной втулке Zephyr QX-100?',
    },
    reviewExpectation:
      'Retain the asserted exclusion of sand damage to the ceramic spacer with negative polarity. Separately preserve that this record does not settle intake-sleeve replacement coverage and does not establish agreement silence. Do not infer inclusion or exclusion for the sleeve.',
  },
  {
    id: 'v22-held-assistant-speculation',
    split: 'held-out',
    language: 'mixed',
    scenario: 'assistant-speculation',
    items: [
      {
        item_id: 'turn-1111',
        role: 'assistant',
        text: 'Моя предварительная догадка: обслуживание Zephyr QX-100 may include checking the optical shutter after every eleven operating cycles. Я не читал договор и не проверял эту догадку. Это возможное условие обслуживания, а не установленная обязанность или состояние устройства.',
      },
    ],
    view: 'reports',
    basis: 'source_report',
    commitment: 'tentative',
    admission: 'writable',
    ordinary:
      '## Assistant report\nThe assistant speculates that Zephyr QX-100 servicing may include an optical-shutter check after every eleven operating cycles. The assistant has not read the agreement or verified the guess; it is neither an established duty nor a device state.',
    ordinaryFactual: false,
    queries: {
      en: 'What did the assistant speculate about optical-shutter checks for Zephyr QX-100?',
      ru: 'Какое предположение о проверке оптической шторки Zephyr QX-100 высказал ассистент?',
    },
    reviewExpectation:
      'Keep assistant attribution, tentative possibility of an optical-shutter check after every eleven operating cycles, and the assistant’s personal unread and unverified limits. Do not turn a possible service term into a real duty, performed check, or device condition.',
  },
  {
    id: 'v22-held-fictional-example',
    split: 'held-out',
    language: 'en',
    scenario: 'fictional-example',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I, Ada Marlow, am introducing an invented example for discussion; it describes no real agreement.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'In the story, the fictional Vulpine Mutual lends the fictional Bo Winters a spare Zephyr QX-100 control dial for the first forty-four days after a fictional repair. The loan exists only in the story.',
      },
    ],
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary:
      '## Fictional example\nAda Marlow introduces a story, not a real agreement. In it, fictional Vulpine Mutual lends fictional Bo Winters a spare Zephyr QX-100 control dial for the first forty-four days after a fictional repair.',
    ordinaryFactual: false,
    queries: {
      en: 'What fictional control-dial loan did Ada Marlow introduce for discussion?',
      ru: 'Какой вымышленный заём ручки управления Ada Marlow предложила обсудить?',
    },
    reviewExpectation:
      'Preserve Ada’s actual introduction of an invented example and the story-scoped loan: fictional Vulpine Mutual lends fictional Bo a spare control dial for forty-four days after a fictional repair. No real agreement, repair, loan, or elapsed calendar period is established.',
  },
  {
    id: 'v22-held-relative-unknown-date',
    split: 'held-out',
    language: 'ru',
    scenario: 'relative-unknown-date',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, предлагаю сравнить инструкции по очистке Zephyr QX-100 через две недели после этой записи. Это лишь моё предложение; встреча не согласована.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У исходной записи нет даты. Поэтому календарную дату сравнения определить нельзя; две недели отсчитываются от записи, а не от дня обработки.',
      },
    ],
    view: 'planning',
    disposition: 'proposed',
    admission: 'writable',
    ordinary:
      '## Предложение\nAda Marlow предлагает сравнить инструкции по очистке Zephyr QX-100 через две недели после недатированной исходной записи. Календарная дата неизвестна, отсчёт не ведётся от обработки, встреча не согласована.',
    ordinaryFactual: false,
    queries: {
      en: 'What relative-time cleaning-instructions proposal did Ada Marlow make for Zephyr QX-100?',
      ru: 'Какое предложение со временем относительно записи сделала Ada Marlow об инструкциях Zephyr QX-100?',
    },
    reviewExpectation:
      'Keep Ada’s actual proposal, comparison of cleaning instructions two weeks after the undated source record, unknown calendar date, explicit non-processing anchor, and no agreed meeting. Uncertain date does not make the proposal uncertain.',
  },
  {
    id: 'v22-held-competing-hypotheses',
    split: 'held-out',
    language: 'ru',
    scenario: 'competing-hypotheses',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я, Ada Marlow, рассматриваю две конкурирующие предварительные причины дребезга Zephyr QX-100: деформированная шайба или плохо закреплённая крышка фильтра.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Я не выбрала ни одну причину. Для обеих версий пока нет подтверждающих данных; сам дребезг этой записью также не подтверждается.',
      },
    ],
    view: 'discussion',
    commitment: 'tentative',
    admission: 'writable',
    ordinary:
      '## Предварительные версии\nAda Marlow рассматривает деформированную шайбу и плохо закреплённую крышку фильтра как конкурирующие причины возможного дребезга Zephyr QX-100. Ни одна причина не выбрана и не подтверждена; сам дребезг записью не подтверждён.',
    ordinaryFactual: false,
    queries: {
      en: 'Which competing rattle hypotheses did Ada Marlow consider for Zephyr QX-100?',
      ru: 'Какие конкурирующие версии причины дребезга Zephyr QX-100 рассматривала Ada Marlow?',
    },
    reviewExpectation:
      'Keep both tentative competing causes: a deformed washer and an inadequately secured filter cover. Ada selected neither, evidence supports neither, and the record does not itself confirm the rattle. Do not establish either fault or collapse them into one cause.',
  },
  {
    id: 'v22-held-open-question',
    split: 'held-out',
    language: 'mixed',
    scenario: 'open-question',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'У меня, Ada Marlow, остаётся открытый вопрос о Zephyr QX-100: does the service plan include annual alignment of the folding handle?',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'I do not have the answer. Neither inclusion nor exclusion of that alignment is established by this note.',
      },
    ],
    view: 'questions',
    commitment: 'none',
    admission: 'writable',
    ordinary:
      '## Open question\nAda Marlow asks whether the Zephyr QX-100 service plan includes annual alignment of the folding handle. She has no answer; this note establishes neither inclusion nor exclusion.',
    ordinaryFactual: false,
    queries: {
      en: 'What open service-plan question does Ada Marlow have about the folding handle of Zephyr QX-100?',
      ru: 'Какой открытый вопрос о складной ручке Zephyr QX-100 остаётся у Ada Marlow?',
    },
    reviewExpectation:
      'Retain the unresolved question about annual folding-handle alignment, Ada’s personal lack of an answer, and unestablished inclusion and exclusion. Do not infer contract silence, a performed alignment, or universal ignorance.',
  },
  {
    id: 'v22-held-rejected-plan',
    split: 'held-out',
    language: 'en',
    scenario: 'rejected-plan',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'The proposal was to take Zephyr QX-100 to a calibration room so its rotation-stop angle could be measured. I, Ada Marlow, rejected that proposal and do not intend to take the device there under it.',
      },
      {
        item_id: 'turn-2222',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'No appointment has been reserved and no transport has been arranged. The proposed measurement remains rejected.',
      },
    ],
    view: 'history',
    disposition: 'rejected',
    admission: 'writable',
    ordinary:
      '## Rejected proposal\nAda Marlow rejected taking Zephyr QX-100 to a calibration room to measure its rotation-stop angle and does not intend to act under the proposal. No appointment or transport is arranged.',
    ordinaryFactual: false,
    queries: {
      en: 'Which rotation-stop measurement proposal did Ada Marlow reject for Zephyr QX-100?',
      ru: 'Какое предложение об измерении ограничителя вращения Zephyr QX-100 отклонила Ada Marlow?',
    },
    reviewExpectation:
      'Preserve the rejected proposal’s destination and exact rotation-stop-angle measurement purpose, Ada’s lack of intent under it, and the independent absence of appointment and transport arrangements. No acceptance, trip, measurement, or causal relation is established.',
  },
  {
    id: 'v22-held-read-only-admission',
    split: 'held-out',
    language: 'ru',
    scenario: 'read-only-admission',
    items: [
      {
        item_id: 'turn-1111',
        role: 'user',
        speaker: 'Ada Marlow',
        text: 'Запомни в папке с запретом на запись: Vulpine Mutual меняет защитное кольцо Zephyr QX-100 каждые пятьдесят пять месяцев.',
      },
    ],
    view: 'factual',
    admission: 'read-only',
    hold: true,
    ordinary:
      '## Обслуживание\nVulpine Mutual меняет защитное кольцо Zephyr QX-100 каждые пятьдесят пять месяцев.',
    ordinaryFactual: true,
    queries: {
      en: 'What maintenance interval did Ada Marlow ask to remember in the read-only folder?',
      ru: 'Какой интервал обслуживания Ada Marlow попросила запомнить в папке с запретом на запись?',
    },
    reviewExpectation:
      'The source is understandable, but the explicitly targeted folder denies writes. Preserve all source bytes and return the typed admission hold without a retained answer. Distinguish policy denial from missing source knowledge, an empty result, or service unavailability.',
  },
];
