import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { runRetain, cleanCandidateBatch } from './retain.ts';
import {
  reportRepairLanguageProse,
  reportRepairText,
  reportTextRepairFields,
} from './retain-report-repair.ts';
import { toEndpointSchema, strictModeViolations, ModelClient, type ChatOptions } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
afterEach(() => vi.unstubAllGlobals());

const proposition =
  'According to Bo Winters, the agreement permits sending Zephyr QX-100 to a workshop to measure the gap at the latch, not to change the latch.';
const relay = "Ada Marlow only relays Bo Winters's account.";
const limit =
  'Ada Marlow has not read the agreement, independently checked the account, or personally verified this meaning.';
const sourceReport = `${proposition} ${relay} ${limit}`;
const denial = 'Ada Marlow has not arranged delivery of Zephyr QX-100.';
const source = `${sourceReport} ${denial}`;
const original = {
  kind: 'claim',
  subject: 'Zephyr QX-100',
  text: `${proposition} Ada Marlow is only passing on this account: she has not read the agreement or independently checked the account, and she did not herself verify this meaning.`,
  attribution: {
    source_role: 'user',
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' }],
  },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: [{ quote: sourceReport }],
  discourse_frame: [{ quote: proposition }],
  relations: [],
  time: null,
  page: null,
};
const admitted = {
  ...original,
  text: denial,
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  epistemic: { basis: 'self_attested' },
  polarity: 'negated',
  support: [{ quote: denial }],
  discourse_frame: [{ quote: denial }],
};
const delta = () => ({
  candidate_index: 0,
  reported_proposition: proposition,
  relay_attribution: relay,
  personal_limits: limit,
});
const completedOriginal = { ...original, discourse_frame: [{ quote: proposition }, { quote: sourceReport }] };

function modelFor(
  repair: unknown,
  options: {
    records?: unknown[];
    negative?: 'proposition' | 'action' | 'qualification' | 'polarity';
    raw?: boolean;
    languageFailure?: boolean;
  } = {},
) {
  const requests: { payload: any; options: ChatOptions }[] = [];
  const invalid = vi.fn();
  const chat = vi.fn(async (messages: { content: string }[], callOptions: ChatOptions) => {
    const payload = JSON.parse(messages.at(-1)!.content);
    requests.push({ payload, options: callOptions });
    if (chat.mock.calls.length === 1)
      return {
        ok: true,
        value: JSON.stringify({ candidates: options.records ?? [original, admitted] }),
        latencyMs: 11,
      };
    if (payload.repair_targets) {
      if (options.languageFailure) {
        expect(callOptions.additionalLanguageProse?.(repair)).toEqual([reportRepairText(delta())]);
        return {
          ok: false,
          value: null,
          error: 'invented language rejection',
          reason: 'language_mismatch',
          latencyMs: 11,
        };
      }
      return { ok: true, value: options.raw ? repair : JSON.stringify(repair), latencyMs: 11 };
    }
    return {
      ok: true,
      latencyMs: 11,
      value: JSON.stringify({
        verdicts: payload.candidates.map((c: any) => {
          const report = c.epistemic.basis === 'source_report';
          const propositionSupported = !report || options.negative !== 'proposition';
          const actionSupported = !report || options.negative !== 'action';
          const qualificationSupported = !report || options.negative !== 'qualification';
          return {
            candidate_id: c.candidate_id,
            ...frameAuditFields(c),
            ...retentionAudit(
              c,
              propositionSupported,
              actionSupported,
              qualificationSupported,
              report && options.negative === 'polarity' ? 'negated' : c.polarity,
            ),
            source_selected_polarity: report && options.negative === 'polarity' ? 'negated' : c.polarity,
            proposition_supported: propositionSupported,
            action_arguments_preserved: actionSupported,
            qualification_scope_preserved: qualificationSupported,
            reason_code: null,
          };
        }),
      }),
    };
  });
  const model = {
    available: true,
    modelId: 'invented-text-repair',
    chat,
    reportInvalidResponse: invalid,
    degradedReason: () => 'language_mismatch',
  } as unknown as ModelClient;
  return { model, chat, requests, invalid };
}

describe('report-only text repair', () => {
  it.each([undefined, 'proposition', 'action', 'qualification', 'polarity'] as const)(
    'clones completed proof fields and immutable siblings before mandatory verification: %s',
    async (negative) => {
      const { model, chat, requests } = modelFor({ repairs: [delta()] }, { negative });
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(3);
      const repair = requests[1]!;
      expect(repair.payload.repair_targets).toHaveLength(1);
      expect(repair.payload.repair_targets[0]).toMatchObject({
        candidate_index: 0,
        repair_contract: { mode: 'report_text_only', issue: 'report_uncertainty_unreadable' },
        original_candidate: completedOriginal,
      });
      expect(repair.options.additionalLanguageProse?.({ repairs: [delta()] })).toEqual([
        reportRepairText(delta()),
      ]);
      const verify = requests[2]!.payload;
      expect(verify.source.text).toBe(source);
      expect(verify.repair_obligations[0].original).toEqual(completedOriginal);
      const generated = verify.candidates.find((c: any) => c.epistemic.basis === 'source_report');
      expect(generated.text).toBe(reportRepairText(delta()));
      for (const key of [
        'support',
        'discourse_frame',
        'attribution',
        'discourse',
        'epistemic',
        'polarity',
        'subject',
        'relations',
      ] as const)
        expect(generated[key]).toEqual(completedOriginal[key]);
      const standalone = cleanCandidateBatch([original, admitted], { sourceText: source, generated: true })
        .candidates[0]!;
      const survivor = result.candidates.find((c) => c.text === denial)!;
      expect(survivor).toEqual(standalone);
      expect(result.candidates).toHaveLength(negative ? 1 : 2);
      if (negative) expect(result.held.some((h) => h.hold_stage === 'verification')).toBe(true);
      expect(JSON.stringify(result.candidates)).not.toContain('personal_limits');
      expect(original.discourse_frame).toEqual([{ quote: proposition }]);
    },
  );

  it.each([
    undefined,
    null,
    {},
    [{ type: 'contradicts', target_candidate: 1, support: [{ quote: denial }] }],
  ])('requires an actual empty raw relation array for text-only eligibility: %j', async (relations) => {
    const { model, requests } = modelFor(
      { repairs: [] },
      { records: [{ ...original, relations }, admitted] },
    );
    await runRetain(source, model);
    expect(requests[1]!.payload.repair_targets[0]).not.toHaveProperty('repair_contract');
    expect(requests[1]!.options.schema!.safeParse({ repairs: [delta()] }).success).toBe(false);
    expect(requests[1]!.options.additionalLanguageProse).toBeUndefined();
  });

  it.each([
    { text: original.text.replace('Ada Marlow', 'She') },
    { time: { mentioned_at: '2222-01-01' } },
    { discourse: { commitment: 'asserted', disposition: 'completed' } },
  ])('uses full repair when another local issue exists: %j', async (change) => {
    const { model, requests } = modelFor(
      { repairs: [] },
      { records: [{ ...original, ...change }, admitted] },
    );
    await runRetain(source, model);
    expect(requests[1]!.payload.repair_targets[0]).not.toHaveProperty('repair_contract');
    expect(requests[1]!.options.schema!.safeParse({ repairs: [delta()] }).success).toBe(false);
  });

  it.each([
    { repairs: [{ ...delta(), candidate: original }] },
    { repairs: [{ ...delta(), text: reportRepairText(delta()) }] },
    { repairs: [{ ...delta(), polarity: 'negated' }] },
    { repairs: [{ ...delta(), candidate_index: 1 }] },
    { repairs: [{ ...delta(), candidate_index: -1 }] },
    { repairs: [delta(), delta()] },
    { repairs: [{ ...delta(), personal_limits: '' }] },
    { repairs: [{ ...delta(), reported_proposition: 'x'.repeat(200) + '.' }] },
    { repairs: [{ ...delta(), relay_attribution: 'x'.repeat(78) + '.' }] },
    { repairs: [{ ...delta(), personal_limits: 'x'.repeat(120) + '.' }] },
    { repairs: [{ ...delta(), personal_limits: limit.slice(0, -1) }] },
    { repairs: [{ ...delta(), personal_limits: limit.replace('has not', 'has\nnot') }] },
    { repairs: [{ ...delta(), personal_limits: limit.replace('has not', 'has\u0000not') }] },
    { repairs: [{ candidate_index: 0, candidate: { ...original, text: reportRepairText(delta()) } }] },
  ])('rejects malformed or unauthorized deltas while retaining the sibling: %j', async (repair) => {
    const { model, chat, invalid, requests } = modelFor(repair);
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(invalid).toHaveBeenCalledOnce();
    expect(requests[2]!.payload.candidates.map((c: any) => c.text)).toEqual([denial]);
    expect(result.candidates.map((c) => c.text)).toEqual([denial]);
  });

  it.each([
    JSON.stringify({ repairs: [delta()] }).slice(0, -1),
    JSON.stringify({ repairs: [delta()] }) + ' trailing',
  ])('never salvages incomplete or trailing text transactions', async (raw) => {
    const { model, invalid } = modelFor(raw, { raw: true });
    const result = await runRetain(source, model);
    expect(invalid).toHaveBeenCalledOnce();
    expect(result.candidates.map((c) => c.text)).toEqual([denial]);
  });

  it('keeps language rejection final and verifies only the admitted sibling', async () => {
    const { model, chat, requests } = modelFor({ repairs: [delta()] }, { languageFailure: true });
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(requests[2]!.payload.candidates.map((c: any) => c.text)).toEqual([denial]);
    expect(result.candidates.map((c) => c.text)).toEqual([denial]);
  });

  it('normalizes spaces inside the same bounded language and validation text', async () => {
    const changed = { ...delta(), personal_limits: '  ' + limit.replace('has not', 'has   not') + '\t' };
    const { model, requests } = modelFor({ repairs: [changed] });
    const result = await runRetain(source, model);
    expect(reportRepairLanguageProse({ repairs: [changed] })).toEqual([reportRepairText(delta())]);
    expect(requests[2]!.payload.candidates[0].text).toBe(reportRepairText(delta()));
    expect(result.candidates).toHaveLength(2);
  });

  it('exposes disjoint strict full/text-only branches with unchanged aggregate bounds', async () => {
    const brokenSibling = { ...admitted, text: 'too short' };
    const { model, requests } = modelFor({ repairs: [] }, { records: [original, brokenSibling] });
    await runRetain(source, model);
    const schema = requests[1]!.options.schema!;
    const wire: any = toEndpointSchema(schema);
    expect(strictModeViolations(wire)).toEqual([]);
    expect(JSON.stringify(wire)).not.toMatch(/"(?:oneOf|const)":/u);
    const [text, full] = wire.properties.repairs.items.anyOf;
    expect(text.additionalProperties).toBe(false);
    expect(full.additionalProperties).toBe(false);
    expect(text.properties.candidate_index.enum).toEqual([0]);
    expect(full.properties.candidate_index.enum).toEqual([1]);
    expect(
      text.properties.reported_proposition.maxLength +
        text.properties.relay_attribution.maxLength +
        text.properties.personal_limits.maxLength +
        2,
    ).toBe(400);
    expect(
      schema.safeParse({
        repairs: [
          delta(),
          {
            candidate_index: 1,
            candidate: {
              ...admitted,
              support: admitted.support.map((span) => ({ ...span, item_id: null })),
              discourse_frame: admitted.discourse_frame.map((span) => ({ ...span, item_id: null })),
            },
          },
        ],
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ repairs: [{ ...delta(), candidate_index: 1 }] }).success).toBe(false);
    expect(
      schema.safeParse({
        repairs: [
          {
            candidate_index: 0,
            candidate: {
              ...admitted,
              support: admitted.support.map((span) => ({ ...span, item_id: null })),
              discourse_frame: admitted.discourse_frame.map((span) => ({ ...span, item_id: null })),
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('fits complete invented English and Russian three-sentence controls without borrowing capacity', () => {
    const schema = z.strictObject(reportTextRepairFields);
    const ru = {
      reported_proposition:
        'По словам Bo Winters, договор разрешает отправить Zephyr QX-100 в мастерскую для измерения зазора защёлки, а не её замены.',
      relay_attribution: 'Ada Marlow лишь пересказывает слова Bo Winters.',
      personal_limits:
        'Ada Marlow не читала договор, не проверяла этот рассказ независимо и сама не проверяла этот смысл.',
    };
    for (const value of [delta(), ru]) {
      const { reported_proposition, relay_attribution, personal_limits } = value;
      expect(schema.safeParse({ reported_proposition, relay_attribution, personal_limits }).success).toBe(
        true,
      );
      expect(reportRepairText(value).length).toBeLessThanOrEqual(400);
    }
  });
});

describe('private repair provider transport and language boundary', () => {
  it.each(
    (['chat_completions', 'responses'] as const).flatMap((api) =>
      [true, false].map((compliant) => [api, compliant] as const),
    ),
  )(
    'uses the strict mixed repair schema and one final language judgment: %s / %s',
    async (api, compliant) => {
      const { model: schemaModel, requests } = modelFor(
        { repairs: [] },
        { records: [original, { ...admitted, text: 'too short' }] },
      );
      await runRetain(source, schemaModel);
      const options = requests[1]!.options;
      let calls = 0;
      let wire: any;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: unknown, init: RequestInit) => {
          calls++;
          const body = JSON.parse(String(init.body));
          if (calls === 1)
            wire =
              api === 'chat_completions'
                ? (body.response_format.schema ?? body.response_format.json_schema.schema)
                : body.text.format.schema;
          else expect(JSON.stringify(body)).toContain(reportRepairText(delta()));
          const value = JSON.stringify(
            calls === 1
              ? { repairs: [delta()] }
              : {
                  hint_roles: [],
                  prose_result: compliant
                    ? { status: 'compliant', counterexample: null }
                    : {
                        status: 'noncompliant',
                        counterexample: { kind: 'range', excerpt_id: 'e0', start: 0, end: 9 },
                      },
                },
          );
          return new Response(
            JSON.stringify(
              api === 'chat_completions'
                ? { choices: [{ message: { content: value }, finish_reason: 'stop' }] }
                : {
                    status: 'completed',
                    output: [{ type: 'message', content: [{ type: 'output_text', text: value }] }],
                  },
            ),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      );
      const model = new ModelClient({
        role: 'derive',
        id: 'invented-repair-transport',
        enabled: true,
        requested: true,
        timeoutMs: 1111,
        maxOutputTokens: 2222,
        unavailableReason: null,
        knowledgeLanguage: 'en',
        provider: {
          name: 'invented',
          baseUrl: 'https://invented.invalid/v1',
          apiKey: null,
          headers: {},
          maxRetries: 0,
          api,
        },
      });
      const result = await model.chat([{ role: 'user', content: 'Return the invented repair.' }], options);
      expect(calls).toBe(2);
      expect(result.ok).toBe(compliant);
      if (!compliant) expect(result.reason).toBe('language_mismatch');
      expect(strictModeViolations(wire)).toEqual([]);
      expect(JSON.stringify(wire)).not.toMatch(/"(?:oneOf|const)":/u);
      const [segmented, full] = wire.properties.repairs.items.anyOf;
      expect(segmented.properties.candidate_index.enum).toEqual([0]);
      expect(full.properties.candidate_index.enum).toEqual([1]);
      for (const branch of [segmented, full]) {
        expect(branch.additionalProperties).toBe(false);
        expect(new Set(branch.required)).toEqual(new Set(Object.keys(branch.properties)));
      }
    },
  );

  it.each([
    { ...delta(), reported_proposition: proposition.replace('Bo Winters', 'Bo Marlow') },
    { ...delta(), reported_proposition: proposition.replace('permits', 'requires') },
    { ...delta(), reported_proposition: proposition.replace('gap at the latch', 'tension of the latch') },
    { ...delta(), reported_proposition: proposition.replace('not to change', 'and to change') },
    { ...delta(), relay_attribution: relay.replace('Ada Marlow', 'Bo Winters') },
    { ...delta(), personal_limits: limit.replace('Ada Marlow', 'Bo Winters') },
    {
      ...delta(),
      personal_limits:
        'Ada Marlow has not read the agreement and has no independent confirmation of the report.',
    },
  ])('keeps changed meaning subject to the existing final semantic rejection: %j', async (changed) => {
    const { model, chat, requests } = modelFor({ repairs: [changed] }, { negative: 'proposition' });
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(requests[2]!.payload.candidates.some((c: any) => c.text === reportRepairText(changed))).toBe(true);
    expect(result.candidates.map((c) => c.text)).toEqual([denial]);
    expect(result.held.some((h) => h.hold_stage === 'verification')).toBe(true);
  });
});

describe('text-only repair vector collisions', () => {
  it('cannot replace an admitted report by repairing an earlier position into its text', async () => {
    const stable = { ...original, text: reportRepairText(delta()) };
    const { model, requests, invalid, chat } = modelFor(
      { repairs: [delta()] },
      { records: [original, stable] },
    );
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(requests[1]!.payload.read_only_admitted_context[0].candidate_index).toBe(1);
    expect(requests[2]!.payload.repair_obligations).toEqual([]);
    expect(result.candidates.map((c) => c.text)).toEqual([stable.text]);
    expect(result.error).toBeNull();
    expect(result.degradedReason).toBe('derive_failed');
    expect(result.held[0]?.hold_stage).toBe('validation');
    expect(invalid).toHaveBeenCalledOnce();
  });
});
