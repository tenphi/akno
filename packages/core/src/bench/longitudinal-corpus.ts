import { LONGITUDINAL_CORPUS_V1, type LongitudinalEpisode } from './longitudinal-corpus-v1.ts';
export { LONGITUDINAL_GATES } from './longitudinal-corpus-v1.ts';
export const LONGITUDINAL_VERSION = 'longitudinal-v2';

// The socket-accounting repair changes the measurement contract. Keep the exposed v1
// inputs frozen and review fresh held-out sources before the corrected run.
export const LONGITUDINAL_CORPUS: LongitudinalEpisode[] = LONGITUDINAL_CORPUS_V1.map((original) => {
  const entry = {
    ...structuredClone(original),
    sources: {
      ...structuredClone(original.sources),
      distinct:
        'Ada Marlow separately schedules inspection appointment EXT-1111 for Zephyr QX-100 on 8 April 2031. EXT-1111 is a different appointment from INS-1111; no completion is confirmed for either.',
    },
  };
  if (entry.track === 'folder')
    for (const step of entry.steps.slice(1))
      step.expected.push({
        id: 'distinct-appointment',
        required: true,
        meaning:
          'The separately identified EXT-1111 inspection is scheduled on the same day as INS-1111, but remains a distinct appointment with no completion established. Do not attach same_event or supersedes links across those identities.',
      });
  if (entry.split === 'development') return entry;
  const replacements = [
    ['INS-2222', 'INS-3333'],
    ['EXT-1111', 'EXT-3333'],
    ['2032-06-11', '2033-09-17'],
    ['2032-06-12', '2033-09-18'],
    ['2032-06-14', '2033-09-20'],
    ['2032-06-01', '2033-09-01'],
    ['2032-07-01', '2033-10-01'],
    ['11 June 2032', '17 September 2033'],
    ['12 June 2032', '18 September 2033'],
    ['14 June 2032', '20 September 2033'],
  ];
  let serialized = JSON.stringify(entry);
  for (const [before, after] of replacements) serialized = serialized.replaceAll(before!, after!);
  const updated: typeof entry = JSON.parse(serialized);
  updated.sources.distinct =
    'Ada Marlow also schedules a different Zephyr QX-100 inspection, EXT-3333, for 17 September 2033. EXT-3333 and INS-3333 are separate appointments even though their initially reported day matches. No completion is confirmed for either.';
  for (const step of updated.steps)
    for (const proposition of step.expected)
      if (proposition.id === 'distinct-appointment')
        proposition.meaning = proposition.meaning.replaceAll('INS-1111', 'INS-3333');
  updated.sources.initial =
    'Ada Marlow records the schedule for a single appointment: inspection INS-3333 of Zephyr QX-100 on 17 September 2033. Ada does not confirm that the inspection took place.';
  updated.sources.copy =
    "This is a copied account of Ada Marlow's schedule, not independent confirmation: inspection INS-3333 of Zephyr QX-100 is scheduled for 17 September 2033. Ada does not confirm completion.";
  updated.sources.conflict =
    'Bo Winters gives a different schedule for the same single appointment INS-3333: Zephyr QX-100 inspection on 18 September 2033. This notice does not confirm that it took place.';
  updated.sources.correct =
    'Ada Marlow replaces her earlier schedule for the single Zephyr QX-100 inspection INS-3333: it is now scheduled for 20 September 2033 instead of 17 September 2033. This rescheduling is not confirmation that the inspection happened.';
  updated.sources.speculation =
    'I am only guessing that the Zephyr QX-100 warranty could be five years; I have nothing confirming that guess.';
  updated.sources.seed = 'According to Ada Marlow, the warranty for Zephyr QX-100 is three years.';
  updated.sources.recover =
    'Ada Marlow corrects the warranty record for Zephyr QX-100: three years is the duration, not five years.';
  return updated;
});
