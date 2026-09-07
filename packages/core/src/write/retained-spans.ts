import type { RetainSourceSpan } from '@tenphi/akno-protocol';

/** Spans must already be uniquely resolved against the original source. A larger exact frame
 * covers a support quotation without duplicating it as another identical array entry. */
export function spanCoveredByFrame(span: RetainSourceSpan, frame: readonly RetainSourceSpan[]): boolean {
  return frame.some((context) => context.item_id === span.item_id && context.quote.includes(span.quote));
}
