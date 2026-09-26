import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import { ModelClient } from '../models/client.ts';
import { runRetain } from './retain.ts';

afterEach(() => vi.restoreAllMocks());

function reportModel(maxOutputTokens?: number) {
  return new ModelClient({
    role: 'derive',
    id: 'invented-report-model',
    provider: {
      name: 'invented',
      baseUrl: 'https://invented.invalid/v1',
      api: 'responses',
      configuredApi: 'responses',
      apiResolution: 'explicit',
      apiResolutionError: null,
      apiKey: null,
      headers: {},
      maxRetries: 0,
    },
    enabled: true,
    requested: true,
    timeoutMs: 1111,
    unavailableReason: null,
    maxOutputTokens,
  });
}

const statements = Array.from(
  { length: 12 },
  (_, i) => `According to Vulpine Mutual, inspection ${i + 1} for Ada Marlow is scheduled for 11 April 2031.`,
);
const report = statements.join('\n');
const sourceItems = [{ item_id: 'report-a', role: 'assistant' as const, speaker: 'Luna', text: report }];
const candidates = statements.map((quote, i) => ({
  kind: 'event',
  attribution: {
    source_role: 'assistant',
    source_speaker: 'Luna',
    chain: [{ speaker: 'Vulpine Mutual', role: 'external' }],
  },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: [{ item_id: 'report-a', quote }],
  discourse_frame: [{ item_id: 'report-a', quote }],
  relations: [],
  time: {
    start: '2031-04-11',
    until: null,
    precision: 'day',
    relation: 'scheduled',
    status: 'scheduled',
    timezone: null,
    mentioned_at: null,
    recurrence: null,
  },
  text: `Luna reports that ${quote}`,
  subject: `inspection ${i + 1}`,
  page: null,
}));

describe('structured retention output allowance', () => {
  it.each([undefined, 3200])(
    'keeps a complete report or explicitly degrades at the role cap (%s)',
    async (cap) => {
      const requests: Array<{ budget: number; verification: boolean }> = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        const payload = JSON.parse(body.input.at(-1).content);
        const verification = Array.isArray(payload.candidates);
        requests.push({ budget: body.max_output_tokens, verification });
        if (!verification && body.max_output_tokens < 8192) {
          // Even parseable partial JSON is not evidence that a whole report was processed.
          return Response.json({
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({ candidates: candidates.slice(0, 1), events: [] }),
                  },
                ],
              },
            ],
          });
        }
        const value = verification
          ? {
              verdicts: payload.candidates.map(
                (
                  candidate: Parameters<typeof retentionAudit>[0] &
                    Parameters<typeof frameAuditFields>[0] & { candidate_id: string },
                ) => ({
                  candidate_id: candidate.candidate_id,
                  source_selected_polarity: candidate.polarity,
                  ...retentionAudit(candidate),
                  ...frameAuditFields(candidate),
                  proposition_supported: true,
                  action_arguments_preserved: true,
                  qualification_scope_preserved: true,
                  reason_code: null,
                }),
              ),
            }
          : { candidates, events: [] };
        return Response.json({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
        });
      });
      const result = await runRetain(report, reportModel(cap), { sourceItems });
      if (cap) {
        expect(requests).toEqual([{ budget: cap, verification: false }]);
        expect(result.candidates).toEqual([]);
        expect(result.error).toContain('output token budget');
        expect(result.degradedReason).toBe('derive_failed');
        expect(result.modelUsage.verification).toBeNull();
      } else {
        expect(result.error).toBeNull();
        expect(result.held).toEqual([]);
        expect(result.candidates).toHaveLength(12);
        expect(requests.filter((request) => !request.verification)).toHaveLength(1);
        expect(requests[0]!.budget).toBeGreaterThanOrEqual(8192);
        expect(requests[0]!.budget).toBeLessThanOrEqual(16384);
        expect(requests.slice(1).every((request) => request.verification)).toBe(true);
        expect(result.candidates.every((candidate) => candidate.time?.status === 'scheduled')).toBe(true);
      }
    },
  );
});
