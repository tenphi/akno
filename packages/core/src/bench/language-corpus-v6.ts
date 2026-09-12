import type { RetainSourceItem } from '@tenphi/akno-protocol';
import type { LanguageCaseV2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';

const user = (text: string): RetainSourceItem[] => [
  { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text },
];

/** The exposed development cases and a new held-out set, frozen before model execution. */
export const LANGUAGE_CORPUS_V6: LanguageCaseV2[] = [
  ...LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
  {
    id: 'v6-held-report',
    split: 'held-out',
    language: 'ru',
    scenario: 'nested-report',
    items: user(
      'Bo Winters сообщил мне, что гарантия Zephyr QX-100 включает замену панели управления. Я ещё не проверяла это сообщение.',
    ),
    view: 'reports',
    basis: 'source_report',
    admission: 'writable',
    ordinary:
      '## Сообщение\nBo Winters сообщил, что гарантия Zephyr QX-100 включает замену панели управления; это не проверено.',
    ordinaryFactual: false,
    queries: {
      en: 'What did Ada Marlow report hearing about control-panel replacement for Zephyr QX-100?',
      ru: 'Что Ada Marlow сообщила со слов другого человека о замене панели управления Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow records an unverified report from Bo Winters about control-panel replacement. Preserve both people and unverified status; do not assert actual coverage.',
  },
  {
    id: 'v6-held-hypothesis',
    split: 'held-out',
    language: 'en',
    scenario: 'hypothetical-maintenance',
    items: user(
      'For discussion, assume the Zephyr QX-100 warranty requires a seasonal inspection. We have not established this as an actual warranty obligation.',
    ),
    view: 'discussion',
    commitment: 'hypothetical',
    admission: 'writable',
    ordinary: '## Hypothesis\nThe Zephyr QX-100 warranty requires a seasonal inspection.',
    ordinaryFactual: false,
    queries: {
      en: 'What hypothetical inspection obligation was discussed for the Zephyr QX-100 warranty?',
      ru: 'Какую гипотезу об обязательном осмотре обсуждали для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'A seasonal inspection is only Ada Marlow’s unestablished assumption for discussion. Do not turn it into an actual obligation.',
  },
  {
    id: 'v6-held-counterfactual',
    split: 'held-out',
    language: 'mixed',
    scenario: 'counterfactual',
    items: user(
      'Я не выбрала расширенную гарантию Zephyr QX-100. Сейчас сравниваю реализованный выбор с воображаемой альтернативой. Had I chosen the extension, battery replacement in year five would have been covered. This is the unrealized scenario, not the selected coverage.',
    ),
    view: 'discussion',
    admission: 'writable',
    ordinary:
      '## Counterfactual\nHad the Zephyr QX-100 warranty extension been chosen, battery replacement in year five would have been covered.',
    ordinaryFactual: false,
    queries: {
      en: 'What counterfactual warranty scenario did Ada Marlow describe for Zephyr QX-100?',
      ru: 'Какой контрфактический сценарий гарантии Zephyr QX-100 описала Ada Marlow?',
    },
    reviewExpectation:
      'Ada Marlow did not choose the extension. Battery replacement in year five is covered only inside the unrealized alternative. A separate factual denial of choosing the extension is allowed.',
  },
  {
    id: 'v6-held-question',
    split: 'held-out',
    language: 'en',
    scenario: 'open-question',
    items: user(
      'Keep this question open: does the Zephyr QX-100 warranty reimburse repair labor? The answer is still undetermined.',
    ),
    view: 'questions',
    admission: 'writable',
    ordinary: '## Open questions\nDoes the Zephyr QX-100 warranty reimburse repair labor?',
    ordinaryFactual: false,
    queries: {
      en: 'What open repair-cost question is recorded for the Zephyr QX-100 warranty?',
      ru: 'Какой открытый вопрос о расходах на ремонт записан для гарантии Zephyr QX-100?',
    },
    reviewExpectation:
      'Ada Marlow left reimbursement of repair labor as an open question with no established answer. Do not answer the embedded reimbursement question yes or no.',
  },
  {
    id: 'v6-held-exclusion',
    split: 'held-out',
    language: 'en',
    scenario: 'factual-negation',
    items: user('The Zephyr QX-100 warranty excludes corrosion damage.'),
    view: 'factual',
    commitment: 'asserted',
    polarity: 'negated',
    admission: 'writable',
    ordinary: 'The Zephyr QX-100 warranty excludes corrosion damage.',
    ordinaryFactual: true,
    queries: {
      en: 'Does the Zephyr QX-100 warranty cover corrosion damage?',
      ru: 'Покрывает ли гарантия Zephyr QX-100 повреждения от коррозии?',
    },
    reviewExpectation:
      'The user asserts an exclusion for corrosion damage. Preserve that negative coverage and its negated metadata, without adding other exclusions or independent verification. Ordinary factual wording is allowed with provenance in metadata.',
  },
  {
    id: 'v6-held-admission',
    split: 'held-out',
    language: 'mixed',
    scenario: 'read-only-admission',
    items: user('Гарантия Zephyr QX-100 lasts four years.'),
    view: 'factual',
    commitment: 'asserted',
    admission: 'read-only',
    hold: true,
    ordinary: 'Гарантия Zephyr QX-100 lasts four years.',
    ordinaryFactual: true,
    queries: {
      en: 'What warranty duration is recorded for Zephyr QX-100?',
      ru: 'Какой срок гарантии записан для Zephyr QX-100?',
    },
    reviewExpectation:
      'All destinations are read-only. Hold retention and abstain over the empty memory folder without changing existing files.',
  },
];
