import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import { ModelClient } from '../models/client.ts';
import { loadConfig } from '../config/load.ts';
import { runRetain } from './retain.ts';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-budget-test-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

function reportModel(maxOutputTokens?: number) {
  const config = loadConfig({
    isolated: true,
    env: {},
    overrides: {
      akno_path: root,
      state_dir: path.join(root, 'state'),
      providers: {
        invented: { base_url: 'https://invented.invalid/v1', api: 'responses', max_retries: 0 },
      },
      models: {
        derive: {
          provider: 'invented',
          id: 'invented-report-model',
          timeout_ms: 1111,
          ...(maxOutputTokens === undefined ? {} : { max_output_tokens: maxOutputTokens }),
        },
      },
    },
  });
  // The uncapped case mirrors a maintenance role, independent of the derive default.
  if (maxOutputTokens === undefined) delete config.models.derive.maxOutputTokens;
  return new ModelClient(config.models.derive);
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
  it('enforces an extraction-only deadline without changing the output ceiling', async () => {
    const budgets: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      budgets.push(JSON.parse(init!.body as string).max_output_tokens);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        init!.signal!.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(init!.signal!.reason);
          },
          { once: true },
        );
      });
      throw new Error('deadline was not enforced');
    });
    const result = await runRetain(report, reportModel(), { sourceItems, extractionTimeoutMs: 20 });
    expect(budgets).toEqual([16384]);
    expect(result.retryable).toBe(true);
    expect(result.error).toContain('20ms');
    expect(result.candidates).toEqual([]);
  });

  it.each([undefined, 3200])(
    'permits a larger extraction allowance while honoring the role ceiling (%s)',
    async (cap) => {
      const budgets: number[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        budgets.push(JSON.parse(init!.body as string).max_output_tokens);
        return Response.json({
          status: 'completed',
          output: [
            { type: 'message', content: [{ type: 'output_text', text: '{"candidates":[],"events":[]}' }] },
          ],
        });
      });
      const result = await runRetain(report, reportModel(cap), {
        sourceItems,
        generationMaxOutputTokens: 32768,
      });
      expect(budgets).toEqual([cap ?? 32768]);
      expect(result.error).toBeNull();
    },
  );

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

describe('complete repair output allowance', () => {
  it.each(
    [3, 12].flatMap((count) =>
      [undefined, 3200].flatMap((cap) =>
        [undefined, 32768].map((allowance) => [count, cap, allowance] as const),
      ),
    ),
  )(
    'repairs a multi-record report or explicitly holds at the role cap (%i records; cap %s)',
    async (count, cap, allowance) => {
      const selected = candidates.slice(0, count);
      const requests: Array<{ budget: number; phase: string }> = [];
      const drafts = selected.map((candidate) => ({
        ...candidate,
        discourse_frame: [{ item_id: 'report-a', quote: candidate.text }],
      }));
      const completed = (value: unknown) =>
        Response.json({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
        });
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        const payload = JSON.parse(body.input.at(-1).content);
        const phase = payload.repair_targets ? 'repair' : payload.candidates ? 'verification' : 'extraction';
        requests.push({ budget: body.max_output_tokens, phase });
        if (phase === 'extraction') return completed({ candidates: drafts, events: [] });
        if (phase === 'repair') {
          expect(payload.repair_targets.map((target: any) => target.candidate_index)).toEqual(
            selected.map((_candidate, index) => index),
          );
          const repairs = selected.map((candidate, candidate_index) => ({ candidate_index, candidate }));
          if (body.max_output_tokens < 8192)
            return Response.json({
              status: 'incomplete',
              incomplete_details: { reason: 'max_output_tokens' },
              output: [
                { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ repairs }) }] },
              ],
            });
          return completed({ repairs });
        }
        return completed({
          verdicts: payload.candidates.map((candidate: any) => ({
            candidate_id: candidate.candidate_id,
            source_selected_polarity: candidate.polarity,
            ...retentionAudit(candidate),
            ...frameAuditFields(candidate),
            proposition_supported: true,
            action_arguments_preserved: true,
            qualification_scope_preserved: true,
            reason_code: null,
          })),
        });
      });
      const result = await runRetain(report, reportModel(cap), {
        sourceItems,
        generationMaxOutputTokens: allowance,
      });
      expect(requests.filter((request) => request.phase === 'repair')).toHaveLength(1);
      if (cap) {
        expect(result.error).toContain('output token budget');
        expect(result.candidates).toEqual([]);
        expect(result.held).toHaveLength(selected.length);
        expect(result.degradedReason).toBe('derive_failed');
        expect(result.modelUsage.verification).toBeNull();
        expect(requests.at(-1)).toEqual({ budget: cap, phase: 'repair' });
      } else {
        expect(requests.find((request) => request.phase === 'repair')?.budget).toBe(
          allowance ?? (count === 3 ? 9600 : 16384),
        );
        expect(result.error).toBeNull();
        expect(result.held).toEqual([]);
        expect(result.candidates).toHaveLength(selected.length);
        expect(result.candidates.map((candidate) => candidate.text)).toEqual(
          selected.map((candidate) => candidate.text),
        );
        expect(requests.filter((request) => request.phase === 'verification')).not.toHaveLength(0);
      }
    },
  );

  it.each(['truncated', 'trailing', 'unsupported'])(
    'does not admit an unfinished transaction or an unverified full repair (%s)',
    async (mode) => {
      const original = candidates[0]!;
      const sibling = candidates[1]!;
      const draft = { ...original, discourse_frame: [{ item_id: 'report-a', quote: original.text }] };
      const transaction = JSON.stringify({ repairs: [{ candidate_index: 0, candidate: original }] });
      const verificationInputs: any[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        const payload = JSON.parse(body.input.at(-1).content);
        let text: string;
        if (payload.repair_targets)
          text =
            mode === 'truncated'
              ? transaction.slice(0, -1)
              : mode === 'trailing'
                ? transaction + ' trailing'
                : transaction;
        else if (payload.candidates) {
          verificationInputs.push(...payload.candidates);
          text = JSON.stringify({
            verdicts: payload.candidates.map((candidate: any) => {
              const supported = candidate.text === sibling.text;
              return {
                candidate_id: candidate.candidate_id,
                source_selected_polarity: candidate.polarity,
                ...retentionAudit(candidate, supported, supported, supported),
                ...frameAuditFields(candidate),
                proposition_supported: supported,
                action_arguments_preserved: supported,
                qualification_scope_preserved: supported,
                reason_code: supported ? null : 'discourse_uncertain',
              };
            }),
          });
        } else text = JSON.stringify({ candidates: [draft, sibling], events: [] });
        return Response.json({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
        });
      });
      const result = await runRetain(report, reportModel(), { sourceItems });
      expect(result.candidates.map((candidate) => candidate.text)).toEqual([sibling.text]);
      expect(result.held).toHaveLength(1);
      if (mode === 'unsupported') {
        expect(result.error).toBeNull();
        expect(result.held[0]?.hold_stage).toBe('verification');
        expect(verificationInputs.map((candidate) => candidate.text)).toContain(original.text);
      } else {
        expect(result.error).toBeNull();
        expect(result.degradedReason).toBe('derive_failed');
        expect(result.held[0]?.hold_stage).toBe('validation');
        expect(verificationInputs.map((candidate) => candidate.text)).toEqual([sibling.text]);
      }
    },
  );
});

describe('retention verification output allowance', () => {
  it.each([undefined, 3200])(
    'allows complete verification while honoring the role ceiling (%s)',
    async (cap) => {
      const budgets: number[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        const payload = JSON.parse(body.input.at(-1).content);
        budgets.push(body.max_output_tokens);
        const value = payload.candidates
          ? {
              verdicts: payload.candidates.map((candidate: any) => ({
                candidate_id: candidate.candidate_id,
                source_selected_polarity: candidate.polarity,
                ...retentionAudit(candidate),
                ...frameAuditFields(candidate),
                proposition_supported: true,
                action_arguments_preserved: true,
                qualification_scope_preserved: true,
                reason_code: null,
              })),
            }
          : { candidates: candidates.slice(0, 2), events: [] };
        return Response.json({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
        });
      });
      const result = await runRetain(report, reportModel(cap), {
        sourceItems,
        generationMaxOutputTokens: 32768,
      });
      expect(budgets).toEqual([cap ?? 32768, cap ?? 32768]);
      expect(result.error).toBeNull();
      expect(result.candidates).toHaveLength(2);
    },
  );
});

describe('independent verifier concurrency', () => {
  it.each(
    [false, true].flatMap((failure) =>
      (['source', 'batch'] as const).map((scope) => [failure, scope] as const),
    ),
  )(
    'preserves prompts, ordering and fail-closed accounting (failure %s; scope %s)',
    async (failure, scope) => {
      async function exercise(concurrency: number) {
        let active = 0;
        let maxActive = 0;
        let completed = 0;
        const prompts: string[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
          const body = JSON.parse(init!.body as string);
          const payload = JSON.parse(body.input.at(-1).content);
          const verification = Array.isArray(payload.candidates);
          if (verification) {
            const index = prompts.length;
            prompts.push(init!.body as string);
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((resolve) => setTimeout(resolve, (4 - (index % 4)) * 5));
            active -= 1;
            completed += 1;
            if (failure && index === 1)
              return Response.json({
                status: 'completed',
                output: [
                  { type: 'message', content: [{ type: 'output_text', text: 'invalid verification' }] },
                ],
                usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
              });
          }
          const value = verification
            ? {
                verdicts: payload.candidates.map((candidate: any) => ({
                  candidate_id: candidate.candidate_id,
                  source_selected_polarity: candidate.polarity,
                  ...retentionAudit(candidate),
                  ...frameAuditFields(candidate),
                  proposition_supported: true,
                  action_arguments_preserved: true,
                  qualification_scope_preserved: true,
                  reason_code: null,
                })),
              }
            : { candidates, events: [] };
          return Response.json({
            status: 'completed',
            output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
          });
        });
        const result = await runRetain(report, reportModel(), {
          sourceItems,
          verificationConcurrency: concurrency,
          verificationFailureScope: scope,
        });
        vi.restoreAllMocks();
        return { result, prompts, maxActive, completed };
      }
      const serial = await exercise(1);
      const parallel = await exercise(4);
      expect(serial.maxActive).toBe(1);
      expect(parallel.maxActive).toBe(4);
      expect(parallel.prompts.slice(0, serial.prompts.length)).toEqual(serial.prompts);
      expect(parallel.result.candidates).toEqual(serial.result.candidates);
      expect(parallel.result.held.map(({ verification: _verification, ...hold }) => hold)).toEqual(
        serial.result.held.map(({ verification: _verification, ...hold }) => hold),
      );
      expect(parallel.result.error).toEqual(serial.result.error);
      expect(parallel.completed).toBe(parallel.prompts.length);
      expect(parallel.result.modelUsage.verification?.input_tokens).toBe(parallel.completed * 10);
      if (failure && scope === 'source') {
        expect(serial.completed).toBe(2);
        expect(parallel.completed).toBe(4);
        expect(
          serial.result.held.filter((hold) => hold.verification?.outcome === 'not_checked'),
        ).toHaveLength(8);
        expect(
          parallel.result.held.filter((hold) => hold.verification?.outcome === 'not_checked'),
        ).toHaveLength(4);
        expect(parallel.result.candidates).toEqual([]);
        expect(parallel.result.held).toHaveLength(candidates.length);
      } else {
        expect(parallel.completed).toBe(6);
        expect(parallel.result.candidates).toHaveLength(candidates.length - (failure ? 2 : 0));
        if (failure) {
          expect(parallel.result.held).toHaveLength(2);
          expect(parallel.result.error).toBeNull();
          expect(parallel.result.degradedReason).toBe('retain_verification_failed');
        }
      }
    },
  );
});
