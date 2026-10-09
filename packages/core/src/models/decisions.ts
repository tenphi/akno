import { z } from 'zod';

export interface ScoreQuestion {
  name: string;
  instructions: string;
  levels: { label: string; description?: string }[];
}
export interface ScoreDecision {
  name: string;
  score: number;
  probabilities: { value: number; probability: number }[];
}
const probability = z.number().finite().min(0).max(1);
const answerSchema = z.array(
  z.object({
    type: z.literal('score'),
    name: z.string(),
    score: z.number().finite().nonnegative(),
    confidence: probability,
    probabilities: z.array(z.object({ value: z.number().int().nonnegative(), probability })),
  }),
);

/** Validate the complete named batch before any evidence may be discarded. */
export function parseScoreDecisions(value: unknown, questions: ScoreQuestion[]): ScoreDecision[] | null {
  const parsed = answerSchema.safeParse(value);
  if (!parsed.success || parsed.data.length !== questions.length) return null;
  const answers = new Map(parsed.data.map((answer) => [answer.name, answer]));
  if (answers.size !== questions.length || new Set(questions.map((q) => q.name)).size !== questions.length)
    return null;
  const ordered: ScoreDecision[] = [];
  for (const question of questions) {
    const answer = answers.get(question.name);
    if (!answer || answer.probabilities.length !== question.levels.length) return null;
    const values = new Set(answer.probabilities.map((p) => p.value));
    if (
      values.size !== question.levels.length ||
      answer.probabilities.some((p) => p.value >= question.levels.length)
    )
      return null;
    const sum = answer.probabilities.reduce((s, p) => s + p.probability, 0);
    const mean = answer.probabilities.reduce((s, p) => s + p.value * p.probability, 0);
    // The service rounds distributions. Reject material inconsistencies, allow rounding.
    if (
      Math.abs(sum - 1) > 0.025 ||
      answer.score > question.levels.length - 1 ||
      Math.abs(mean - answer.score) > 0.06
    )
      return null;
    ordered.push(answer);
  }
  return ordered;
}
