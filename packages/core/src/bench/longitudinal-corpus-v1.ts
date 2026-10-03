/** Frozen invented source expectations. Change the version, never tune an exposed held-out split. */

export const LONGITUDINAL_GATES = {
  acceptedSemanticErrors: 0,
  sourceMutations: 0,
  duplicateGrowthOnReplay: 0,
  usefulMemoryCoverage: 0.9,
  usefulRecallCoverage: 0.9,
  usefulContextCoverage: 0.8,
  usefulAnswerCoverage: 0.8,
} as const;

interface ExpectedProposition {
  id: string;
  meaning: string;
  required: boolean;
}
interface EpisodeStep {
  id: string;
  action:
    | 'initial'
    | 'replay'
    | 'copies'
    | 'conflict'
    | 'correct'
    | 'retract'
    | 'seed'
    | 'recover'
    | 'folder-update'
    | 'restart';
  expected: ExpectedProposition[];
  answer: boolean;
  asOf: string;
}
export interface LongitudinalEpisode {
  id: string;
  split: 'development' | 'held-out';
  track: 'retention' | 'folder';
  eventId: string;
  initialDate: string;
  conflictDate: string;
  updatedDate: string;
  sourceClock: string;
  endClock: string;
  sources: Record<'initial' | 'speculation' | 'copy' | 'conflict' | 'correct' | 'seed' | 'recover', string>;
  question: string;
  steps: EpisodeStep[];
}

function episode(
  split: LongitudinalEpisode['split'],
  track: LongitudinalEpisode['track'],
): LongitudinalEpisode {
  const held = split === 'held-out';
  const eventId = held ? 'INS-2222' : 'INS-1111';
  const initialDate = held ? '2032-06-11' : '2031-04-08';
  const conflictDate = held ? '2032-06-12' : '2031-04-09';
  const updatedDate = held ? '2032-06-14' : '2031-04-12';
  const sourceClock = held ? '2032-06-01T12:00:00Z' : '2031-04-01T12:00:00Z';
  const endClock = held ? '2032-07-01T12:00:00Z' : '2031-05-01T12:00:00Z';
  const initial = held
    ? `Ada Marlow's notice: the single inspection appointment ${eventId} for Zephyr QX-100 is scheduled for 11 June 2032. This is a schedule, not a completion report.`
    : `Ada Marlow states that the single inspection appointment ${eventId} for Zephyr QX-100 is scheduled for 8 April 2031. The appointment has not been confirmed as completed.`;
  const conflict = held
    ? `Bo Winters' notice lists the single inspection appointment ${eventId} for Zephyr QX-100 on 12 June 2032. Bo gives no report of completion.`
    : `Bo Winters states that the single inspection appointment ${eventId} for Zephyr QX-100 is scheduled for 9 April 2031. Bo does not report that it happened.`;
  const correct = held
    ? `Ada Marlow corrects her notice: the single inspection appointment ${eventId} for Zephyr QX-100 has been rescheduled from 11 June 2032 to 14 June 2032. The previous schedule is superseded; this does not establish completion.`
    : `Ada Marlow states that the single inspection appointment ${eventId} for Zephyr QX-100 has been rescheduled from 8 April 2031 to 12 April 2031. This replaces Ada's earlier schedule and does not establish that the appointment happened.`;
  const expectation = (id: string, meaning: string, required = true) => ({ id, meaning, required });
  const a = expectation(
    'ada-initial',
    `Ada reports a schedule for ${eventId} on ${initialDate}; no occurrence is established.`,
  );
  const b = expectation(
    'bo-alternative',
    `Bo reports a schedule for the same specifically identified appointment on ${conflictDate}. Preserve Ada and Bo's distinct attributions; do not choose a date without deciding evidence.`,
  );
  const updated = expectation(
    'ada-updated',
    `Ada explicitly reschedules ${eventId} to ${updatedDate}, superseding her original schedule; still no occurrence is established.`,
  );
  const speculation = expectation(
    'hypothesis',
    'An assistant speculates that the warranty may be five years, with no confirming evidence. Repetition never makes it an established warranty.',
    false,
  );
  const wrong = expectation(
    'seed-detected',
    'The provided-candidate caller deliberately injects a five-year warranty against a source saying three years. This is seeded contamination, not an extraction failure. Detection is useful; accepting the wrong duration is an error.',
    false,
  );
  const recovered = expectation(
    'warranty-corrected',
    'Ada states that the warranty is three years. No active eligible five-year warranty may survive the explicit source correction.',
  );
  const step = (
    id: string,
    action: EpisodeStep['action'],
    expected: ExpectedProposition[],
    answer = false,
    late = false,
  ): EpisodeStep => ({ id, action, expected, answer, asOf: late ? endClock : sourceClock });
  return {
    id: `${split}-${track}`,
    split,
    track,
    eventId,
    initialDate,
    conflictDate,
    updatedDate,
    sourceClock,
    endClock,
    sources: {
      initial,
      speculation:
        'It is only my unsupported hypothesis that the Zephyr QX-100 warranty might last five years. I have no confirming evidence.',
      copy: `A copied summary of Ada Marlow's notice, not an independent witness: ${initial}`,
      conflict,
      correct,
      seed: 'Ada Marlow states that the Zephyr QX-100 warranty lasts three years.',
      recover:
        'Ada Marlow confirms the correction: the Zephyr QX-100 warranty lasts three years, not five years.',
    },
    question:
      track === 'folder'
        ? `Which inspection dates does each speaker report for Zephyr QX-100 appointment ${eventId}, and is completion established?`
        : `What schedule does each speaker report for Zephyr QX-100 appointment ${eventId}? What warranty duration is established, and is appointment completion established?`,
    steps:
      track === 'folder'
        ? [
            step('empty-declaration', 'initial', [a], true),
            step('copies-and-alternative', 'copies', [a, b]),
            step('explicit-rescheduling', 'folder-update', [a, b, updated], true),
            step('unchanged', 'replay', [a, b, updated]),
            step('restart-clock', 'restart', [a, b, updated], true, true),
          ]
        : [
            step('initial', 'initial', [a, speculation], true),
            step('unchanged-reordered', 'replay', [a, speculation]),
            step('correlated-copy', 'copies', [a, speculation]),
            step('alternative', 'conflict', [a, b, speculation], true),
            step('source-correction', 'correct', [updated, b, speculation], true),
            step('last-support-retracted', 'retract', [updated, speculation]),
            step('seeded-contamination', 'seed', [updated, wrong], true),
            step('recovery-restart-clock', 'recover', [updated, recovered], true, true),
          ],
  };
}

export const LONGITUDINAL_CORPUS_V1: LongitudinalEpisode[] = [
  episode('development', 'retention'),
  episode('development', 'folder'),
  episode('held-out', 'retention'),
  episode('held-out', 'folder'),
];
