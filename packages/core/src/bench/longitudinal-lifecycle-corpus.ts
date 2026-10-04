/** Frozen English extension to v2; source expectations are authored before live outputs. */
export const LIFECYCLE_CORPUS_VERSION = 'longitudinal-lifecycle-v1';

export const LIFECYCLE_GATES = {
  semanticErrors: 0,
  sourceMutations: 0,
  usefulCoverage: 0.8,
  replayDuplicateGrowth: 0,
} as const;

export interface LifecycleEpisode {
  id: string;
  split: 'development' | 'held-out';
  track: 'inference' | 'discourse' | 'overview';
  clock: string;
  lateClock: string;
  query: string;
  question: string;
  files: Record<string, string>;
  facts: { slug: string; subject: string; text: string; pattern: string }[];
  sources: {
    id: string;
    group: string;
    items: { item_id: string; role: 'user'; speaker: string; text: string }[];
  }[];
  steps: { id: string; expected: { id: string; meaning: string }[]; answer: boolean; seeded: boolean }[];
}

const page = (title: string, body: string, policy = '') =>
  `---\ntitle: ${title}\n${policy}---\n\n# ${title}\n\n${body}\n`;

function episode(split: LifecycleEpisode['split'], track: LifecycleEpisode['track']): LifecycleEpisode {
  const held = split === 'held-out';
  const year = held ? 2037 : 2035;
  const clock = `${year}-02-01T12:00:00Z`;
  const lateClock = `${year}-05-01T12:00:00Z`;
  const id = `${split}-${track}`;
  const expectations = (...entries: [string, string][]) =>
    entries.map(([propositionId, meaning]) => ({ id: propositionId, meaning }));
  const step = (
    stepId: string,
    expected: ReturnType<typeof expectations>,
    answer = true,
    seeded = false,
  ) => ({
    id: stepId,
    expected,
    answer,
    seeded,
  });
  const base = {
    id,
    split,
    track,
    clock,
    lateClock,
    files: {},
    facts: [],
    sources: [],
    query: '',
    question: '',
    steps: [],
  };
  if (track === 'inference') {
    const subjects = ['Equipment preparation', 'Journey preparation', 'Workshop preparation'];
    const actions = held
      ? [
          'the Zephyr QX-100 safety checklist was completed before operation',
          'the luggage checklist was completed before departure',
          'the tool checklist was completed before assembly',
        ]
      : [
          'the Zephyr QX-100 safety checklist was checked before operation',
          'the luggage checklist was checked before departure',
          'the tool checklist was checked before assembly',
        ];
    const patterns = [
      'The two recorded equipment sessions used a checklist before operating the Zephyr QX-100.',
      'The two recorded journeys used a checklist before departure.',
      'The two recorded workshop sessions used a checklist before assembly.',
    ];
    const files: Record<string, string> = {};
    const facts: LifecycleEpisode['facts'] = [];
    for (let group = 0; group < 3; group++) {
      files[`topics/preparation-${group + 1}.md`] = page(
        subjects[group]!,
        'Preparation reference.',
        'akno:\n  management:\n    observe: integrate\n',
      );
      for (let occurrence = 0; occurrence < 2; occurrence++) {
        const slug = `records/preparation-${group + 1}-${occurrence + 1}`;
        const text = `${subjects[group]}: on ${year}-01-${occurrence ? '22' : '11'}, ${actions[group]}.`;
        files[`${slug}.md`] = page(
          `Preparation record ${group + 1}-${occurrence + 1}`,
          text,
          `akno:\n  about: [topics/preparation-${group + 1}]\n`,
        );
        facts.push({ slug, subject: subjects[group]!, text, pattern: patterns[group]! });
      }
    }
    const natural = expectations([
      'bounded-patterns',
      'Useful observations may combine the two recorded sessions per subject, preserving their recorded sample and before-action scope. No universal habit, preference, motive or cause is established.',
    ]);
    const control = expectations([
      'dependent-principle',
      'A useful reflected principle may combine the three valid L2 patterns and their leaf facts, limited to the six recorded sessions. A checklist preceded the activity in each recorded case, not all future activities.',
    ]);
    const corrected = expectations([
      'correction-excluded',
      'The first equipment record is corrected to a checklist AFTER operation. Its prior leaf and any L2 or L3 depending on it are ineligible; remaining supported patterns may survive. No stale before-operation equipment conclusion may be used.',
    ]);
    return {
      ...base,
      files,
      facts,
      query: 'preparation checklist',
      question:
        'What bounded preparation patterns are supported by the recorded sessions? What does the equipment evidence say about checklist timing?',
      steps: [
        step('natural-observe-reflect', natural),
        step('unchanged', natural, false),
        step('seeded-valid-dependency-control', control, true, true),
        step('leaf-correction', corrected),
        step(
          'last-leaves-retracted',
          expectations([
            'retraction-excluded',
            'All original preparation leaf assertions have been removed. No dependent observation or principle remains eligible or supplies factual graph traversal or an answer. Correct abstention is useful.',
          ]),
        ),
        step(
          'restart-rebuild',
          expectations([
            'retraction-excluded',
            'Rebuilding and restarting must not resurrect the removed leaves or their dependent conclusions.',
          ]),
          true,
        ),
      ],
    };
  }
  if (track === 'discourse') {
    const trip = held ? 'JRN-3333' : 'JRN-1111';
    const text = held
      ? `For the current ${trip} packing document only, remove obsolete draft paragraphs. This is a one-document cleanup request, not my general editing preference. Ada Marlow and Bo Winters discussed the Zephyr QX-100. He will inspect it next Friday; the note does not identify which person or when it was written. I suggested the silver Zephyr QX-100 service plan but have not selected it.`
      : `Clean up old draft paragraphs only in this ${trip} packing document. Do not treat this request as a lasting editing preference. Ada Marlow and Bo Winters talked about the Zephyr QX-100. He will inspect it tomorrow, but I have not identified who he is or supplied a date for that note. I proposed the silver Zephyr QX-100 service plan; no choice has been made.`;
    const decision = held
      ? 'I declined that silver service proposal. The suggested inspection remains unresolved; I am not saying either person has inspected the equipment.'
      : 'I rejected the silver service proposal. Neither the inspection actor nor its date is resolved, and completion is not confirmed.';
    const confirmation = `I confirm that journey ${trip} to Blackwater Bay is booked for ${year}-04-11. The 1111 EUR booking payment was made. This is one journey and one payment, not a second booking or payment.`;
    const copy = `Restating the same confirmation, not another booking or payment: journey ${trip} to Blackwater Bay on ${year}-04-11 has its single 1111 EUR payment completed.`;
    const corrected = `Correction for journey ${trip}: its booked departure is now ${year}-04-22 instead of ${year}-04-11. This supersedes the previous departure instruction; the single payment is unchanged. Departure is not confirmed as having occurred.`;
    const sources: LifecycleEpisode['sources'] = [
      {
        id: 'scope',
        group: 'scope',
        items: [{ item_id: 'scope-1111', role: 'user', speaker: 'Ada Marlow', text }],
      },
      {
        id: 'decision',
        group: 'scope',
        items: [
          { item_id: 'scope-1111', role: 'user', speaker: 'Ada Marlow', text },
          { item_id: 'decision-2222', role: 'user', speaker: 'Ada Marlow', text: decision },
        ],
      },
      {
        id: 'booking',
        group: 'booking',
        items: [{ item_id: 'booking-1111', role: 'user', speaker: 'Ada Marlow', text: confirmation }],
      },
      {
        id: 'copy',
        group: 'booking',
        items: [{ item_id: 'copy-1111', role: 'user', speaker: 'Ada Marlow', text: copy }],
      },
      {
        id: 'correction',
        group: 'booking',
        items: [{ item_id: 'correction-2222', role: 'user', speaker: 'Ada Marlow', text: corrected }],
      },
    ];
    const a = expectations(
      [
        'scoped-cleanup',
        `Any retained cleanup instruction is limited to the ${trip} document; it is never an enduring preference.`,
      ],
      [
        'unresolved-reference',
        'Any inspection record preserves unresolved actor AND relative date; neither Ada nor Bo nor a calendar date can be guessed. Holding that ambiguous proposition is correct.',
      ],
      [
        'unselected-proposal',
        'The silver service plan remains an unselected proposal, not an active selected service or completed purchase.',
      ],
    );
    const b = expectations(
      ...a.filter((e) => e.id !== 'unselected-proposal').map((e) => [e.id, e.meaning] as [string, string]),
      [
        'rejected-proposal',
        'The later deciding turn rejects the silver service proposal, without inventing an inspection completion.',
      ],
    );
    const c = expectations([
      'single-booking-payment',
      `One booked journey ${trip} on ${year}-04-11 and one completed 1111 EUR payment; a correlated paraphrase must not manufacture independent corroboration or a second transaction.`,
    ]);
    return {
      ...base,
      sources,
      files: {
        'memory/equipment.md': page('Zephyr QX-100', ''),
        [`journeys/${year}/overview.md`]: page(`Journey year ${year}`, 'Generic year reference.'),
        [`journeys/${year}/${trip.toLowerCase()}.md`]: page(
          `Journey ${trip}`,
          `Specific journey ${trip} to Blackwater Bay.`,
        ),
      },
      query: `Zephyr QX-100 ${trip}`,
      question: `What is selected or rejected for Zephyr QX-100? What is established about inspection identity and time, and journey ${trip}'s current departure and single payment?`,
      steps: [
        step('scope-and-unresolved-reference', a),
        step('later-deciding-turn', b),
        step('correlated-confirmation', [...b, ...c]),
        step('unchanged-reordered', [...b, ...c], false),
        step('departure-correction', [
          ...b,
          ...expectations([
            'updated-departure',
            `Journey ${trip}'s current departure instruction is ${year}-04-22, superseding ${year}-04-11. Historical assertions may remain qualified; no actual departure is established. The payment remains single.`,
          ]),
        ]),
        step(
          'retraction-restart',
          expectations([
            'retracted-booking',
            'The booking and copy and correction supports are explicitly retracted. Their old departure instructions may not survive as active factual support. Remaining rejected proposal and ambiguity may still be stated.',
          ]),
        ),
      ],
    };
  }
  const trip = (slug: string, date: string) =>
    page(
      slug,
      `Departure scheduled for ${date}; actual departure is not established.`,
      `type: trip\nakno:\n  temporal:\n    kind: event\n    start: '${date}'\n    until: '${date}'\n    timezone: UTC\n`,
    );
  const files = {
    'journeys/overview.md': page(
      'Journey overview',
      `> Details remain subject to the member records.\n\n## Upcoming\n\n- [[journeys/${year}/blackwater-bay]] — ${year}-04-11.\n\n## Quick Reference Table\n\n| Journey | Status |\n| --- | --- |\n| [[journeys/${year}/blackwater-bay]] | planning |\n`,
      `type: overview\nakno:\n  overview:\n    folder: journeys/${year}\n    type: trip\n  management:\n    dream: synthesize\n`,
    ),
    [`journeys/${year}/blackwater-bay.md`]: trip('Blackwater Bay', `${year}-04-11`),
  };
  const a = expectations([
    'known-member',
    'The declared overview includes the Blackwater Bay scheduled journey, preserving unknown occurrence and the informational quote.',
  ]);
  const b = [
    ...a,
    ...expectations([
      'new-member',
      'A new unlinked member is included without dropping its optional/attributed qualifier; member evidence remains byte-for-byte intact.',
    ]),
  ];
  return {
    ...base,
    files,
    query: 'Journey overview',
    question: 'What journeys are scheduled, and has actual departure been established?',
    steps: [
      step('initial-overview', a),
      step('unchanged-overview', a, false),
      step('new-unlinked-qualified-member', b),
      step('clock-crosses-departures', [
        ...b,
        ...expectations([
          'past-schedules',
          'Both member dates are in the past. The upcoming heading and planning table must become past schedules with occurrence unknown, never completed journeys.',
        ]),
      ]),
      step('restart-rebuild', [
        ...b,
        ...expectations([
          'past-schedules',
          'The current membership and past-schedule classification persist after restart/rebuild; passing time never confirms occurrence.',
        ]),
      ]),
    ],
  };
}

export const LIFECYCLE_CORPUS: LifecycleEpisode[] = (['development', 'held-out'] as const).flatMap((split) =>
  (['inference', 'discourse', 'overview'] as const).map((track) => episode(split, track)),
);
