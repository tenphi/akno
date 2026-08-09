/**
 * Comparing two sentences by what they are about rather than how they are worded.
 *
 * Used where the same claim can arrive twice in different words and only one copy should survive:
 * a nightly observation re-derived from unchanged facts, and a timeline event added twice for one
 * day. Both were caught only by exact string equality before, which is to say not caught at all —
 * `They watched "Wicked: For Good"` and `The user watched "Wicked: For Good"` are one event and two
 * strings.
 *
 * Deliberately not a model call. This runs on every write, and a comparison that costs a model is
 * one that gets skipped when the model is missing — which is exactly when a knowledge base is
 * accumulating duplicates fastest.
 */

/**
 * Words that carry no subject matter, plus the ones a rephrasing swaps freely.
 *
 * `they`/`user`/`we` are here because who is being talked about is not what distinguishes two
 * events on the same day: an assistant writing "they watched X" and "the user watched X" has
 * written the same line twice.
 */
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'has',
  'have',
  'had',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'as',
  'by',
  'from',
  'usually',
  'often',
  'always',
  'each',
  'every',
  'they',
  'them',
  'their',
  'we',
  'our',
  'us',
  'he',
  'she',
  'his',
  'her',
  'you',
  'your',
  'user',
  'users',
]);

/** The words of a sentence that say what it is about. */
export function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      // Wikilinks are addresses, not content: two lines that differ only by a citation are one line.
      .replace(/\[\[[^\]]*\]\]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/**
 * Whether two sentences say the same thing, by shared subject matter.
 *
 * Symmetric overlap, so neither being longer wins. The threshold is high on purpose: callers use
 * this to suppress a write, and suppressing a genuinely new line is worse than keeping a near
 * duplicate — one loses something the user said, the other is untidy.
 */
export function saysTheSame(a: string, b: string, threshold = 0.7): boolean {
  const left = contentWords(a);
  const right = contentWords(b);
  if (left.size === 0 || right.size === 0) return false;

  let shared = 0;
  for (const word of right) if (left.has(word)) shared += 1;
  return shared / new Set([...left, ...right]).size >= threshold;
}
