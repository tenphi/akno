import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RetainSourceResult,
  RetainCandidateResult,
  RetainVerificationDiagnostics,
} from '@tenphi/akno-protocol';
import type { ModelClient, ModelFailure } from '../models/client.ts';
import { retentionAudit, frameAuditFields } from '../../test/semantic-audit.ts';
import { runRetain } from './retain.ts';

const sentinel = 'INVENTED_PRIVATE_RESPONSE_1111';
const quote = 'The Zephyr QX-100 warranty lasts five years.';
const candidate = {
  kind: 'claim',
  text: quote,
  subject: 'Zephyr QX-100',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'affirmed',
  support: [{ quote }],
  discourse_frame: [{ quote }],
};
function harness(change: (verdicts: any[]) => unknown, failure?: ModelFailure, empty = false) {
  const chat = vi.fn(async (messages: { content: string }[]) => {
    if (chat.mock.calls.length === 1)
      return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
    if (failure)
      return {
        ok: false,
        value: null,
        reason: failure,
        error: sentinel,
        latencyMs: 22,
        endpointRequests: 2,
        usage: { inputTokens: 111, outputTokens: 22, totalTokens: 133 },
      };
    const selected = JSON.parse(messages.at(-1)!.content).candidates;
    const verdicts = selected.map((c: any) => ({
      candidate_id: c.candidate_id,
      ...retentionAudit(c),
      ...frameAuditFields(c),
      source_selected_polarity: 'affirmed',
      proposition_supported: true,
      action_arguments_preserved: true,
      qualification_scope_preserved: true,
      reason_code: null,
    }));
    const value = change(verdicts);
    return {
      ok: true,
      value: empty ? '' : typeof value === 'string' ? value : JSON.stringify(value),
      latencyMs: 22,
    };
  });
  const invalid = vi.fn();
  return {
    chat,
    invalid,
    model: {
      available: true,
      modelId: 'invented-verifier',
      chat,
      reportInvalidResponse: invalid,
    } as unknown as ModelClient,
  };
}
afterEach(() => vi.restoreAllMocks());

function firstFailure(result: Awaited<ReturnType<typeof runRetain>>) {
  expect(RetainVerificationDiagnostics.safeParse(result.verification).success).toBe(true);
  expect(result.retryable).toBeUndefined();
  expect(result.candidates).toEqual([]);
  expect(JSON.stringify(result)).not.toContain(sentinel);
  return result.verification!.batches[0]!.failure_code;
}

describe('content-safe verifier failure diagnostics', () => {
  it.each([
    'unavailable',
    'timeout',
    'request_failed',
    'bad_response',
    'language_mismatch',
    'language_check_failed',
  ] as const)(
    'preserves typed %s failure and paid usage without exposing provider detail',
    async (failure) => {
      const { model, chat, invalid } = harness(() => ({}), failure);
      const result = await runRetain(quote, model);
      expect(firstFailure(result)).toBe(failure);
      expect(result.held[0]!.verification).toEqual({ outcome: 'failed', failure_code: failure });
      expect(result.modelUsage.verification).toMatchObject({
        latency_ms: 22,
        endpoint_requests: 2,
        total_tokens: 133,
      });
      expect(invalid).not.toHaveBeenCalled();
      expect(chat).toHaveBeenCalledTimes(2);
    },
  );
  it('distinguishes an empty successful response', async () => {
    const { model } = harness(() => ({}), undefined, true);
    expect(firstFailure(await runRetain(quote, model))).toBe('empty_response');
  });
  it.each([
    'invalid_json',
    'schema_mismatch',
    'missing_verdict',
    'duplicate_verdict',
    'foreign_verdict',
    'semantic_inconsistent',
    'time_witness_invalid',
    'context_witness_invalid',
    'hold_reason_inconsistent',
  ] as const)('classifies %s while preserving atomic refusal without repair', async (code) => {
    const { model, chat, invalid } = harness((verdicts) => {
      const v = verdicts[0];
      if (code === 'invalid_json') return '{"verdicts":[' + sentinel;
      if (code === 'schema_mismatch') delete v.comparison;
      if (code === 'missing_verdict') return { verdicts: [] };
      if (code === 'duplicate_verdict') return { verdicts: [v, v] };
      if (code === 'foreign_verdict') v.candidate_id = sentinel;
      if (code === 'semantic_inconsistent') v.proposition_supported = false;
      if (code === 'time_witness_invalid') v.predicate_time_audit.comparisons[0].source.timing = sentinel;
      if (code === 'context_witness_invalid')
        v.knowledge_context.references = [
          {
            source: { frame_id: 'F1' },
            source_name: sentinel,
            name_origin: { frame_id: 'F1' },
            resolution: 'explicit',
            source_role: 'subject',
            candidate_role: 'subject',
            relation: 'preserved',
          },
        ];
      if (code === 'hold_reason_inconsistent') v.reason_code = 'time_unresolved';
      return { verdicts };
    });
    const result = await runRetain(quote, model);
    expect(firstFailure(result)).toBe(code);
    expect(invalid).toHaveBeenCalledOnce();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.modelUsage.repair).toBeUndefined();
  });
  it('keeps a valid semantic refusal distinct from failed verification', async () => {
    const { model } = harness((verdicts) => {
      verdicts[0].knowledge_context.source_use = 'interaction_management';
      return { verdicts };
    });
    const result = await runRetain(quote, model);
    expect(result.held[0]).toMatchObject({
      reason_code: 'not_durable',
      verification: { outcome: 'rejected' },
    });
    expect(result.error).toBeNull();
    expect(result.verification!.batches[0]).toMatchObject({
      outcome: 'verified',
      accepted_count: 0,
      held_count: 1,
    });
    expect(result.verification!.batches[0]!.failure_code).toBeUndefined();
    expect(result.retryable).toBeUndefined();
  });
  it('keeps older receipts readable and diagnostics additive for older consumers', async () => {
    const { model } = harness((verdicts) => ({ verdicts }));
    const result = await runRetain(quote, model);
    expect(result.candidates).toHaveLength(1);
    const receipt = {
      source_id: 'source-1111',
      revision: '1',
      outcome: 'ok',
      candidates: [],
      verification: result.verification,
    };
    expect(RetainSourceResult.parse(receipt).verification).toEqual(result.verification);
    const oldConsumer = RetainSourceResult.omit({ verification: true }).extend({
      candidates: RetainCandidateResult.omit({ verification: true }).array(),
    });
    expect(oldConsumer.parse(receipt)).not.toHaveProperty('verification');
    expect(
      RetainSourceResult.parse({ source_id: 'source-1111', revision: '1', outcome: 'noop', candidates: [] }),
    ).not.toHaveProperty('verification');
  });
  it.each(['source', 'batch'] as const)(
    'accounts for launched parallel calls and unknown usage under %s failure',
    async (scope) => {
      vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValue(144);
      const records = Array.from({ length: 8 }, (_, i) => ({
        ...candidate,
        text: `${quote} Inspection reference ${i + 1}.`,
        support: [{ quote: `${quote} Inspection reference ${i + 1}.` }],
        discourse_frame: [{ quote: `${quote} Inspection reference ${i + 1}.` }],
      }));
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
        const selected = JSON.parse(messages.at(-1)!.content).candidates;
        if (selected[0].text.includes('reference 3.'))
          return {
            ok: false,
            value: null,
            reason: 'timeout',
            error: sentinel,
            latencyMs: 750,
            endpointRequests: 2,
          };
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: selected.map((c: any) => ({
              candidate_id: c.candidate_id,
              ...retentionAudit(c),
              ...frameAuditFields(c),
              source_selected_polarity: 'affirmed',
              proposition_supported: true,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: null,
            })),
          }),
          latencyMs: 750,
          endpointRequests: 1,
          usage: {
            inputTokens: 111,
            outputTokens: 22,
            totalTokens: 133,
            cachedInputTokens: 11,
            reasoningOutputTokens: 2,
          },
        };
      });
      const model = {
        available: true,
        chat,
        modelId: 'invented-verifier',
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(records.map((r) => r.text).join('\n'), model, {
        verificationConcurrency: 2,
        verificationFailureScope: scope,
      });
      expect(result.verification!.wall_time_ms).toBe(44);
      expect(result.verification!.batches).toHaveLength(scope === 'source' ? 2 : 4);
      expect(result.modelUsage.verification).toMatchObject({
        latency_ms: scope === 'source' ? 1500 : 3000,
        endpoint_requests: scope === 'source' ? 3 : 5,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        cached_input_tokens: null,
        reasoning_output_tokens: null,
      });
      expect(result.candidates).toHaveLength(scope === 'source' ? 0 : 6);
      expect(result.held.filter((h) => h.verification?.outcome === 'failed')).toHaveLength(2);
      expect(result.held.filter((h) => h.verification?.outcome === 'source_aborted')).toHaveLength(
        scope === 'source' ? 2 : 0,
      );
      expect(result.held.filter((h) => h.verification?.outcome === 'not_checked')).toHaveLength(
        scope === 'source' ? 4 : 0,
      );
      expect(JSON.stringify(result)).not.toContain(sentinel);
    },
  );
});
