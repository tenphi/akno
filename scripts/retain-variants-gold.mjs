/**
 * Reviewer gold notes for the retention-variant comparison. Every source is an existing invented
 * benchmark fixture; these notes restate its frozen review expectation as units a retained record
 * can cover and traps that make a retained record wrong. Required units measure recall; optional
 * units are credited when covered but never counted as missed.
 */
const unit = (id, meaning, required = true) => ({ id, meaning, required });

const LANGUAGE = {
  'v22-held-nested-report': {
    units: [
      unit(
        'relayed-permission',
        "Ada relays Bo Winters' report that Vulpine Mutual permits bringing the Zephyr QX-100 to a workshop to check grounding-contact resistance (a resistance check, not contact replacement), with Ada not having seen the rules or verified Bo's report.",
      ),
      unit('not-packed', 'Ada has not yet packed her device for such a check.', false),
    ],
    traps: [
      'permission stated as established or as Ada’s own knowledge',
      'check turned into replacement',
      'completed check or service',
    ],
  },
  'v22-held-conditional-hypothesis': {
    units: [
      unit(
        'assumed-schedule',
        'Under a hypothetical assumption that the drain channel is cleared every six weeks, leaving it uncleared for seven weeks would breach that assumed schedule; Ada does not know the real rule and reports no actual missed clearing.',
      ),
    ],
    traps: ['real maintenance duty or schedule', 'actual missed clearing', 'dated event'],
  },
  'v22-held-counterfactual': {
    units: [
      unit('non-enrollment', 'Ada did not enroll her Zephyr QX-100 in the optional corrosion plan.'),
      unit(
        'counterfactual-benefit',
        'Had Ada enrolled, internal-spring replacement after thirty-three months of use would have been free; this is an unrealized consequence because the plan was not taken.',
      ),
    ],
    traps: ['current coverage of spring replacement', 'enrollment', 'calendar date from the usage interval'],
  },
  'v22-held-coverage-exclusion': {
    units: [
      unit(
        'spacer-exclusion',
        'Ada records that the Zephyr QX-100 warranty excludes sand-caused damage to the ceramic spacer (a denied coverage).',
      ),
      unit(
        'sleeve-unsettled',
        'This exclusion does not answer whether intake-sleeve replacement is covered and does not establish that the agreement is silent about the sleeve.',
        false,
      ),
    ],
    traps: [
      'sleeve coverage asserted or denied',
      'agreement silent about the sleeve',
      'all spacer damage excluded',
    ],
  },
  'v22-held-assistant-speculation': {
    units: [
      unit(
        'assistant-guess',
        "The assistant's tentative guess that Zephyr QX-100 servicing may include checking the optical shutter after every eleven operating cycles; the assistant has not read the contract or verified the guess; it is a possible term, not an established duty or device state.",
      ),
    ],
    traps: ['user or Ada as source', 'established duty', 'performed check or device condition'],
  },
  'v22-held-fictional-example': {
    units: [
      unit(
        'introduction',
        'Ada introduced an invented example for discussion that describes no real agreement.',
        false,
      ),
      unit(
        'story-loan',
        'In Ada’s invented story, fictional Vulpine Mutual lends fictional Bo Winters a spare Zephyr QX-100 control dial for the first forty-four days after a fictional repair; the loan exists only in the story.',
      ),
    ],
    traps: ['real loan, agreement or repair', 'elapsed calendar period'],
  },
  'v22-held-relative-unknown-date': {
    units: [
      unit(
        'comparison-proposal',
        'Ada proposes comparing Zephyr QX-100 cleaning instructions two weeks after the undated source record; it is only her proposal, the meeting is not agreed, and the calendar date is unknown (anchored to the record, not processing time).',
      ),
    ],
    traps: [
      'resolved calendar date',
      'agreed meeting',
      'anchored to processing time',
      'proposal made uncertain',
    ],
  },
  'v22-held-competing-hypotheses': {
    units: [
      unit(
        'competing-causes',
        'Ada is considering two competing tentative causes of the Zephyr QX-100 rattle, a deformed washer or a poorly secured filter cover; she selected neither, neither has confirming data, and the record does not confirm the rattle itself.',
      ),
    ],
    traps: [
      'one cause established',
      'causes merged',
      'rattle confirmed',
      'nonselection without Ada as actor',
    ],
  },
  'v22-held-open-question': {
    units: [
      unit(
        'open-question',
        "Ada's open question whether the Zephyr QX-100 service plan includes annual alignment of the folding handle; she has no answer, and the note establishes neither inclusion nor exclusion.",
      ),
    ],
    traps: [
      'contract silence',
      'alignment performed',
      'inclusion or exclusion asserted',
      'universal ignorance',
    ],
  },
  'v22-held-rejected-plan': {
    units: [
      unit(
        'rejected-proposal',
        'Ada rejected the proposal to take the Zephyr QX-100 to a calibration room to measure its rotation-stop angle, and does not intend to take it there under that proposal.',
      ),
      unit('no-arrangements', 'No appointment has been reserved and no transport has been arranged.', false),
    ],
    traps: [
      'accepted or active plan',
      'measurement performed',
      'changed purpose or destination',
      'invented causal link',
    ],
  },
  'v22-held-read-only-admission': {
    units: [
      unit(
        'ring-interval',
        'Per Ada, Vulpine Mutual replaces the Zephyr QX-100 protective ring every fifty-five months.',
      ),
    ],
    traps: ['dated replacement event', 'changed interval'],
  },
  'v23-held-relayed-service': {
    units: [
      unit(
        'relayed-permission',
        "Ada records Bo Winters' message that Vulpine Mutual permits sending the Zephyr QX-100 to a workshop to measure indicator brightness (measurement, not indicator replacement), with Ada not having read the terms or verified the message.",
      ),
      unit('cover-on', 'Ada has not yet removed the protective cover from her Zephyr QX-100.', false),
    ],
    traps: [
      'permission established',
      'replacement prohibited in general',
      'measurement turned into replacement',
    ],
  },
  'v23-held-assumed-interval': {
    units: [
      unit(
        'hypothetical-rule',
        'Under an assumed rule that the latch is lubricated after every eleven operating cycles, twelve cycles without lubrication would breach that interval; Ada does not know the real rule and does not claim lubrication was actually missed.',
      ),
    ],
    traps: ['real duty', 'missed lubrication', 'calendar date or duration in days'],
  },
  'v23-held-declined-extension': {
    units: [
      unit('declined', 'Ada declined the optional Zephyr QX-100 cable-protection extension.'),
      unit(
        'counterfactual-repair',
        'Had Ada accepted the extension, connector repair after twenty-two months of use would have been free; this unrealized benefit is not coverage she has.',
      ),
    ],
    traps: ['actual coverage', 'completed repair', 'calendar event', 'cancelled fact'],
  },
  'v23-held-scoped-exclusion': {
    units: [
      unit(
        'seal-exclusion',
        'The Zephyr QX-100 warranty excludes wax-caused damage to the fabric seal (a denied coverage).',
      ),
      unit(
        'hinge-unsettled',
        'This exclusion does not settle whether hinge replacement is covered and does not mean the contract is silent about the hinge.',
        false,
      ),
    ],
    traps: [
      'all seal damage excluded',
      'hinge inclusion or exclusion asserted',
      'damage coverage turned into replacement benefit',
    ],
  },
  'v23-held-assistant-reading': {
    units: [
      unit(
        'tentative-reading',
        "The assistant's tentative reading that Vulpine Mutual may supply a return label for Zephyr QX-100 servicing; the assistant has not read the terms or verified it; not an arranged return or scheduled shipment.",
      ),
    ],
    traps: ['arranged return or shipment', 'contractual duty', 'user as source'],
  },
  'v23-held-fictional-key': {
    units: [
      unit(
        'discussion-proposal',
        'Ada proposes discussing an invented Zephyr QX-100 example that is not a real agreement.',
        false,
      ),
      unit(
        'story-loan',
        'In the invented story, fictional Vulpine Mutual lends fictional Bo Winters a spare physical metal key for the Zephyr QX-100 cover (not an access code) for the first thirty-three days after a fictional inspection; the loan exists only in the story.',
      ),
    ],
    traps: ['real loan or inspection', 'access code', 'discussion completed'],
  },
  'v23-held-undated-review': {
    units: [
      unit(
        'review-proposal',
        'Ada proposes discussing Zephyr QX-100 service conditions eleven days after her undated utterance (not after processing); the proposal is not accepted and no meeting is scheduled.',
      ),
    ],
    traps: ['calendar date', 'accepted proposal or scheduled meeting', 'processing-time anchor'],
  },
  'v23-held-competing-clicks': {
    units: [
      unit(
        'competing-causes',
        'Ada is considering two preliminary explanations for clicking in the Zephyr QX-100, a cracked guide rail or a locking pin seated at an angle; she has chosen neither, neither has supporting observations, and the record does not confirm the clicking itself.',
      ),
    ],
    traps: [
      'real fault established',
      'angled seating broadened to damage',
      'no one selected a cause',
      'clicking confirmed',
    ],
  },
  'v23-held-open-renewal': {
    units: [
      unit(
        'open-question',
        "Ada's open question whether renewing the Zephyr QX-100 service plan requires a new paper inspection certificate; she has no answer yet, and this does not establish that the agreement is silent.",
      ),
      unit('no-renewal-request', 'Ada has not submitted a renewal request.', false),
    ],
    traps: ['requirement or exemption asserted', 'renewal or submission performed', 'agreement silence'],
  },
  'v23-held-rejected-inspection': {
    units: [
      unit(
        'rejected-offer',
        'Ada rejected the offer to take her Zephyr QX-100 to the workshop so its alignment gauge could be checked.',
      ),
      unit(
        'no-plan',
        'Ada has no plan to take it there, no inspection appointment has been made, and she has not transported the device.',
        false,
      ),
    ],
    traps: [
      'only the gauge transported',
      'unmentioned property measured',
      'active plan or completed inspection',
    ],
  },
  'v23-held-read-only': {
    units: [unit('support-period', 'The Zephyr QX-100 support period lasts eleven years (stated by Ada).')],
    traps: ['changed duration', 'dated event'],
  },
};

function longitudinal(split) {
  const held = split === 'held-out';
  const id = held ? 'INS-3333' : 'INS-1111';
  const ext = held ? 'EXT-3333' : 'EXT-1111';
  const [initial, conflict, updated] = held
    ? ['17 September 2033', '18 September 2033', '20 September 2033']
    : ['8 April 2031', '9 April 2031', '12 April 2031'];
  const noCompletion = 'completion or occurrence of the inspection';
  return {
    notice: {
      units: [
        unit(
          'ada-schedule',
          `Ada reports that inspection ${id} of Zephyr QX-100 is scheduled for ${initial}; it is not confirmed as completed.`,
        ),
      ],
      traps: [noCompletion, 'wrong date'],
    },
    speculation: {
      units: [
        unit(
          'warranty-hypothesis',
          'The assistant speculates, without confirming evidence, that the Zephyr QX-100 warranty might last five years.',
          false,
        ),
      ],
      traps: ['established five-year warranty', 'user or Ada as source'],
    },
    copy: {
      units: [
        unit(
          'copied-schedule',
          `A copied account of Ada's schedule (not independent confirmation): inspection ${id} of Zephyr QX-100 on ${initial}, with no completion confirmed.`,
        ),
      ],
      traps: [noCompletion, 'independent corroboration'],
    },
    alternative: {
      units: [
        unit(
          'bo-schedule',
          `Bo Winters reports inspection ${id} of Zephyr QX-100 on ${conflict}; he does not report that it happened.`,
        ),
      ],
      traps: [noCompletion, 'attributed to Ada', 'date resolved between speakers'],
    },
    correction: {
      units: [
        unit(
          'ada-reschedule',
          `Ada reschedules inspection ${id} of Zephyr QX-100 from ${initial} to ${updated}, replacing her earlier schedule; it is not established that the inspection happened.`,
        ),
      ],
      traps: [noCompletion, 'wrong date direction'],
    },
    recover: {
      units: [
        unit('three-years', 'Ada states the Zephyr QX-100 warranty lasts three years, not five years.'),
      ],
      traps: ['five-year warranty'],
    },
    distinct: {
      units: [
        unit(
          'separate-appointment',
          `Ada schedules a separate Zephyr QX-100 inspection ${ext} on ${initial}, distinct from ${id}; no completion is confirmed for either.`,
        ),
      ],
      traps: [noCompletion, `${ext} merged with ${id}`],
    },
  };
}

function lifecycle(split) {
  const held = split === 'held-out';
  const trip = held ? 'JRN-3333' : 'JRN-1111';
  const year = held ? 2037 : 2035;
  const scopeUnits = [
    unit('discussion', 'Ada Marlow and Bo Winters discussed the Zephyr QX-100.', false),
    unit(
      'unresolved-inspection',
      'An unidentified "he" will inspect the Zephyr QX-100 at a source-relative time (next Friday / tomorrow) whose actor and date are unresolved. Holding it is correct; a retained record must keep both unresolved.',
      false,
    ),
  ];
  const scopeTraps = [
    'cleanup request turned into a lasting editing preference',
    'inspection actor guessed as Bo or Ada',
    'inspection date resolved',
    'inspection completed',
  ];
  return {
    scope: {
      units: [
        unit(
          'silver-proposal',
          'Ada suggested/proposed the silver Zephyr QX-100 service plan and has not selected it.',
        ),
        ...scopeUnits,
      ],
      traps: [...scopeTraps, 'silver plan selected or purchased'],
    },
    decision: {
      units: [
        unit('silver-rejected', 'Ada rejected/declined the silver Zephyr QX-100 service proposal.'),
        ...scopeUnits,
      ],
      traps: [
        ...scopeTraps,
        'silver plan still presented as open or selected',
        'inspection invented as completed',
      ],
    },
    booking: {
      units: [
        unit('booking', `Ada confirms journey ${trip} to Blackwater Bay is booked for ${year}-04-11.`),
        unit('payment', `The single 1111 EUR booking payment for journey ${trip} was made.`),
      ],
      traps: ['actual departure', 'second booking or payment'],
    },
    copy: {
      units: [
        unit(
          'restated-booking',
          `Restated confirmation (not another booking or payment): journey ${trip} to Blackwater Bay on ${year}-04-11 with its single 1111 EUR payment completed.`,
        ),
      ],
      traps: ['independent second booking or payment', 'actual departure'],
    },
    correction: {
      units: [
        unit(
          'departure-corrected',
          `Journey ${trip}'s booked departure is now ${year}-04-22 instead of ${year}-04-11, superseding the previous instruction; departure is not confirmed as having occurred.`,
        ),
        unit('payment-unchanged', `The single payment for journey ${trip} is unchanged.`, false),
      ],
      traps: ['actual departure', 'second payment'],
    },
  };
}

export const GOLD = {
  ...Object.fromEntries(Object.entries(LANGUAGE).map(([id, gold]) => [`language:${id}`, gold])),
  ...Object.fromEntries(
    ['development', 'held-out'].flatMap((split) => [
      ...Object.entries(longitudinal(split)).map(([name, gold]) => [`longitudinal:${split}:${name}`, gold]),
      ...Object.entries(lifecycle(split)).map(([name, gold]) => [`lifecycle:${split}:${name}`, gold]),
    ]),
  ),
};
