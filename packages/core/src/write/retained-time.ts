import type { RetainedTime } from '@tenphi/akno-protocol';

/** An unresolved source-relative proposal is a usable record, but never a resolved schedule. */
export function explicitlyUnknownTime(time: RetainedTime | undefined): boolean {
  return Boolean(
    time &&
    time.precision === 'unknown' &&
    !time.start &&
    !time.until &&
    !time.recurrence &&
    time.status === 'tentative',
  );
}
