import type { RetainSourceSpan } from '@tenphi/akno-protocol';

/** Spans must already be uniquely resolved against the original source. A larger exact frame
 * covers a support quotation without duplicating it as another identical array entry. */
export function spanCoveredByFrame(
  span: RetainSourceSpan,
  frame: readonly RetainSourceSpan[],
  source?: string,
): boolean {
  const sameItem = frame.filter((context) => context.item_id === span.item_id);
  if (sameItem.some((context) => context.quote.includes(span.quote))) return true;
  if (source === undefined) return false;
  const start = source.indexOf(span.quote);
  if (start < 0) return false;
  const end = start + span.quote.length;
  const intervals = sameItem
    .map((context) => {
      const offset = source.indexOf(context.quote);
      return { start: Math.max(start, offset), end: Math.min(end, offset + context.quote.length), offset };
    })
    .filter((interval) => interval.offset >= 0 && interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  let covered = start;
  for (const interval of intervals) {
    // Sentence boundaries may be split into exact quotations. Only original whitespace may
    // bridge them: stitching over a word could erase the very negation or modality we need.
    if (interval.start > covered && /\S/u.test(source.slice(covered, interval.start))) return false;
    covered = Math.max(covered, interval.end);
  }
  return !/\S/u.test(source.slice(covered, end));
}
