import type { Line } from '@tenphi/akno-protocol';

/**
 * What a line's facts add to it: a confidence, and a handle to retract by.
 *
 * Both `read` and `recall` return lines, and both had their own copy of this —
 * which is how they came to disagree. Neither returned the fact's id, so
 * `forget({fact})` could not be called by anything: the op's own error hint says
 * "recall the page again" to obtain one, and recalling the page returned lines
 * with no ids on them. A retraction therefore meant deleting the whole page.
 */
export interface LineFact {
  id: string;
  line_start: number;
  confidence: number;
  valid_to: string | null;
}

/** The columns {@link annotateLines} needs, for callers writing the query. */
export const LINE_FACT_COLUMNS = 'id, claim, line_start, confidence, valid_to';

/**
 * Attach each line's live fact.
 *
 * Superseded facts are skipped: their sentence has already been replaced, so
 * offering an id to retract would point at something no longer on the line. When
 * a line carries several live facts — one sentence can state two things — the
 * most confident one wins, so the id and the confidence describe the same fact
 * rather than being taken from two different ones.
 */
export function annotateLines<T extends Line>(lines: T[], facts: LineFact[]): T[] {
  if (facts.length === 0) return lines;
  return lines.map((line) => {
    const live = facts.filter((fact) => fact.line_start === line.n && fact.valid_to === null);
    if (live.length === 0) return line;
    const best = live.reduce((a, b) => (b.confidence > a.confidence ? b : a));
    return { ...line, confidence: best.confidence, fact: best.id };
  });
}
