import { LIFECYCLE_CORPUS, type LifecycleEpisode } from './longitudinal-lifecycle-corpus.ts';

export const INFERENCE_CORPUS_VERSION = 'longitudinal-inference-v1';

/** Explicit canonical subjects; fresh sources after the lifecycle-v1 identity admission gap. */
export const INFERENCE_CORPUS: LifecycleEpisode[] = (['development', 'held-out'] as const).map((split) => {
  const held = split === 'held-out',
    year = held ? 2041 : 2039;
  const original = structuredClone(
    LIFECYCLE_CORPUS.find((episode) => episode.split === split && episode.track === 'inference')!,
  );
  const subjects = held
    ? ['Equipment setup', 'Journey checks', 'Workshop setup']
    : ['Equipment preparation', 'Journey preparation', 'Workshop preparation'];
  const after = ['operation', 'departure', 'assembly'];
  const files: Record<string, string> = {},
    facts: LifecycleEpisode['facts'] = [];
  for (let group = 0; group < 3; group++) {
    const subject = subjects[group]!;
    files[`topics/preparation-${group + 1}.md`] =
      `---\ntitle: ${subject}\nakno:\n  management:\n    observe: integrate\n---\n\n# ${subject}\n`;
    for (let occurrence = 0; occurrence < 2; occurrence++) {
      const slug = `records/preparation-${group + 1}-${occurrence + 1}`;
      const text = held
        ? `${subject} finished before ${after[group]} on ${year}-02-${occurrence ? '22' : '11'}.`
        : `${subject} was completed before ${after[group]} on ${year}-02-${occurrence ? '22' : '11'}.`;
      const pattern = `In both recorded sessions, ${subject.toLowerCase()} preceded ${after[group]}.`;
      files[`${slug}.md`] =
        `---\ntitle: ${subject} session ${occurrence + 1}\nakno:\n  about: [topics/preparation-${group + 1}]\n---\n\n# ${subject} session ${occurrence + 1}\n\n${text}\n`;
      facts.push({ slug, subject, text, pattern });
    }
  }
  files['unrelated/reference.md'] =
    '# Unrelated preparation\n\nAn unsupported assistant guess suggests that preparation always guarantees successful operation. This is speculation, not evidence about the recorded sessions.\n';
  return {
    ...original,
    id: `${split}-explicit-inference`,
    clock: `${year}-03-01T12:00:00Z`,
    lateClock: `${year}-06-01T12:00:00Z`,
    files,
    facts,
    question:
      'What limited preparation patterns follow from the recorded sessions? What is established about equipment preparation before or after operation? Does preparation guarantee a successful outcome?',
    steps: original.steps.map((step) => ({
      ...step,
      expected: step.expected.map((expected) => ({
        ...expected,
        meaning: expected.meaning.replace('checklist', 'preparation').replace('January', 'February'),
      })),
    })),
  };
});
