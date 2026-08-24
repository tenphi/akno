import type { DreamModelDegradation, DreamModelUsageReceipt } from '@tenphi/akno-core';
import { ms } from '../output.ts';

export function dreamModelUsageSummary(usage: DreamModelUsageReceipt): string {
  if (usage.calls === 0) return 'no calls';
  const reportedTokens =
    usage.totalTokens ??
    (usage.inputTokens !== null && usage.outputTokens !== null
      ? usage.inputTokens + usage.outputTokens
      : null);
  const tokens = reportedTokens === null ? 'tokens unreported' : `${reportedTokens} reported tokens`;
  return (
    `${usage.calls} call${usage.calls === 1 ? '' : 's'} · ${tokens} · ` +
    `usage on ${usage.usageReportedCalls}/${usage.calls} calls · ${ms(usage.latencyMs)} model latency`
  );
}

export function dreamModelDegradationSummary(degraded: DreamModelDegradation[]): string | null {
  if (degraded.length === 0) return null;
  return degraded
    .map(
      (entry) =>
        `${entry.stage}: ${entry.reason}${entry.failure ? `/${entry.failure}` : ''}` +
        `${entry.occurrences === 1 ? '' : ` (${entry.occurrences}×)`}`,
    )
    .join(', ');
}
