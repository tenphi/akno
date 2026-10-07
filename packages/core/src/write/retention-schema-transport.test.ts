import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RetainSourceItem } from '@tenphi/akno-protocol';
import { ModelClient } from '../models/client.ts';
import { retentionAudit, frameAuditFields } from '../../test/semantic-audit.ts';
import { runRetain } from './retain.ts';

afterEach(() => vi.unstubAllGlobals());

// The endpoint accepts a subset of JSON Schema. A permissive transport stub would miss a
// serialization failure even when the same local Zod schema correctly validates every verdict.
function checkEndpointObjects(value: any): void {
  if (!value || typeof value !== 'object') return;
  expect(value).not.toHaveProperty('oneOf');
  if (value.type === 'object') {
    expect(value.additionalProperties).toBe(false);
    expect([...(value.required ?? [])].sort()).toEqual(Object.keys(value.properties).sort());
  }
  for (const child of Object.values(value)) checkEndpointObjects(child);
}

const cases = [
  ...[[1], [2], [1, 1], [1, 2], [2, 3]].map((sizes) => ({ sizes, malformed: null })),
  { sizes: [2], malformed: null, inner: true },
  { sizes: [2], malformed: null, inner: true, nested: true },
  { sizes: [2], malformed: 'foreign-reporter-anchor', inner: true },
  { sizes: [2, 3], malformed: 'swapped-audits' },
  { sizes: [1, 2], malformed: 'unexpected-single-audit' },
  { sizes: [2, 3], malformed: 'foreign-candidate' },
  { sizes: [1, 2], malformed: 'missing-polarity' },
  { sizes: [1, 2], malformed: 'invalid-polarity' },
];
describe.each(['chat', 'responses'] as const)('retention wire-schema compatibility: %s', (api) => {
  it.each(cases)(
    'keeps candidate-specific audits representable: $sizes / $malformed',
    async ({ sizes, malformed, inner = false, nested = false }) => {
      const sourceItems: RetainSourceItem[] = [];
      const records = sizes.map((size, group) => {
        const frame = Array.from({ length: size }, (_, index) => {
          const item_id = `invented-${group}-${index}`;
          const text = `${inner ? `Bo Winters reports that ${nested ? 'the inspection notice lists ' : ''}` : ''}The Zephyr QX-100 inspection label is ${group % 2 ? 'not ' : ''}marker-${group}-${index}.`;
          sourceItems.push({ item_id, text, role: 'user', speaker: 'Ada Marlow' });
          return { item_id, quote: text };
        });
        return {
          subject: 'Zephyr QX-100',
          kind: 'claim',
          text: inner ? `Ada Marlow records: ${frame[0]!.quote}` : frame[0]!.quote,
          attribution: {
            source_role: 'user',
            source_speaker: 'Ada Marlow',
            ...(inner
              ? {
                  chain: [
                    { speaker: 'Bo Winters', role: 'external' },
                    ...(nested ? [{ speaker: 'the inspection notice', role: 'external' }] : []),
                  ],
                }
              : {}),
          },
          discourse: { commitment: 'asserted', disposition: 'active' },
          epistemic: { basis: 'self_attested' },
          polarity: group % 2 ? 'negated' : 'affirmed',
          support: [frame[0]],
          discourse_frame: frame,
        };
      });
      let logicalCalls = 0;
      let endpointCalls = 0;
      let verifierSchema: unknown;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: unknown, init: RequestInit) => {
          endpointCalls++;
          const body = JSON.parse(String(init.body));
          // Exercise the actual second compatibility rung, not only the initial llama-style envelope.
          if (api === 'chat' && endpointCalls === 1)
            return new Response(
              JSON.stringify({ error: { message: "Unknown parameter: 'response_format.schema'." } }),
              { status: 400, headers: { 'content-type': 'application/json' } },
            );
          logicalCalls++;
          const format = api === 'responses' ? body.text.format : body.response_format.json_schema;
          expect(format.strict).toBe(true);
          if (api === 'chat') expect(body.response_format.type).toBe('json_schema');
          const schema = format.schema;
          expect(schema.type).toBe('object');
          const payload = JSON.parse((body.messages ?? body.input).at(-1).content);
          let output: unknown = { candidates: records };
          if (logicalCalls === 2) {
            verifierSchema = schema;
            checkEndpointObjects(schema);
            expect(schema.required).toEqual(['verdicts']);
            const items = schema.properties.verdicts.items;
            const branches = sizes.length === 1 ? [items] : items.anyOf;
            expect(branches).toHaveLength(sizes.length);
            if (sizes.length === 1) expect(items.type).toBe('object');
            for (const [index, branch] of branches.entries()) {
              expect(branch.properties.candidate_id.enum).toEqual([payload.candidates[index].candidate_id]);
              expect(branch.required[0]).toBe('candidate_id');
              const comparisonIndex = branch.required.indexOf('comparison');
              expect(comparisonIndex).toBe((sizes[index]! > 1 ? 2 : 1) + (inner ? 1 : 0));
              if (inner) {
                const reporterItems = branch.properties.attribution_audit.items;
                const entries = nested ? reporterItems.anyOf : [reporterItems];
                expect(entries).toHaveLength(nested ? 2 : 1);
                for (const [reporterIndex, entry] of entries.entries()) {
                  const attribution = entry.properties;
                  expect(attribution.reporter_id.enum).toEqual([`A${reporterIndex + 1}`]);
                  for (const field of ['source', 'name_origin']) {
                    const anchor = attribution[field].anyOf.find((shape: any) => shape.type === 'object');
                    expect(anchor.properties.frame_id.enum).toEqual(['F1', 'F2']);
                    expect(Object.keys(anchor.properties)).toEqual(['frame_id']);
                  }
                }
                expect(payload.candidates[index].attribution_concern.candidate).toBe(
                  'original_readable_text',
                );
              }
              expect(branch.required[comparisonIndex + 1]).toBe('source_selected_polarity');
              expect(branch.required).toContain('predicate_time_audit');
              const time = branch.properties.predicate_time_audit.properties.comparisons.items;
              expect(time.properties.source.properties.frame_id.enum).toEqual(
                Array.from({ length: sizes[index]! }, (_, i) => `F${i + 1}`),
              );
              expect(time.properties.source.properties).not.toHaveProperty('excerpt');
              expect(time.properties.candidate.properties).not.toHaveProperty('excerpt');
              expect(payload.typed_label_contracts[index].candidate_id).toBe(
                payload.candidates[index].candidate_id,
              );
              expect(payload.candidates[index]).not.toHaveProperty('record_scope');
              expect(branch.properties.source_selected_polarity.enum).toEqual(['affirmed', 'negated']);
              if (sizes[index]! > 1) {
                expect(branch.required).toContain('span_audit');
                expect(branch.properties.span_audit.minItems).toBe(sizes[index]);
                expect(branch.properties.span_audit.maxItems).toBe(sizes[index]);
                expect(branch.properties.span_audit.items.properties.frame_id.enum).toEqual(
                  Array.from({ length: sizes[index]! }, (_, i) => `F${i + 1}`),
                );
              } else expect(branch.properties).not.toHaveProperty('span_audit');
            }
            output = {
              verdicts: payload.candidates.map(
                (candidate: {
                  polarity: 'affirmed' | 'negated';
                  candidate_id: string;
                  frame_spans?: { frame_id: string }[];
                }) => ({
                  candidate_id: candidate.candidate_id,
                  source_selected_polarity: candidate.polarity,
                  ...frameAuditFields(candidate),
                  ...retentionAudit(candidate),
                  proposition_supported: true,
                  action_arguments_preserved: true,
                  qualification_scope_preserved: true,
                  reason_code: null,
                }),
              ),
            };
          }
          if (logicalCalls === 2 && malformed) {
            const verdicts = (output as { verdicts: any[] }).verdicts;
            if (malformed === 'swapped-audits')
              [verdicts[0].span_audit, verdicts[1].span_audit] = [
                verdicts[1].span_audit,
                verdicts[0].span_audit,
              ];
            if (malformed === 'unexpected-single-audit') verdicts[0].span_audit = verdicts[1].span_audit;
            if (malformed === 'foreign-candidate') verdicts[0].candidate_id = 'invented-foreign-candidate';
            if (malformed === 'missing-polarity') delete verdicts[1].source_selected_polarity;
            if (malformed === 'invalid-polarity') verdicts[1].source_selected_polarity = 'unknown';
            if (malformed === 'foreign-reporter-anchor')
              verdicts[0].attribution_audit[0].name_origin.frame_id = 'F3';
          }
          const content = JSON.stringify(output);
          return new Response(
            JSON.stringify(
              api === 'responses'
                ? {
                    status: 'completed',
                    output: [{ type: 'message', content: [{ type: 'output_text', text: content }] }],
                  }
                : { choices: [{ message: { content }, finish_reason: 'stop' }] },
            ),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      );
      const model = new ModelClient({
        role: 'derive',
        id: 'invented-wire-verifier',
        provider: {
          name: 'invented',
          baseUrl: 'https://invented.invalid/v1',
          apiKey: null,
          headers: {},
          maxRetries: 0,
          ...(api === 'responses' ? { api: 'responses' as const } : {}),
        },
        enabled: true,
        requested: true,
        timeoutMs: 1111,
        unavailableReason: null,
      });
      const result = await runRetain('', model, { sourceItems });
      expect(verifierSchema).toBeDefined();
      checkEndpointObjects(verifierSchema);
      expect(result.candidates).toHaveLength(malformed ? 0 : sizes.length);
      expect(result.degradedReason).toBe(malformed ? 'retain_verification_failed' : null);
      expect(logicalCalls).toBe(2);
      expect(endpointCalls).toBe(api === 'responses' ? 2 : 3);
    },
  );
});
