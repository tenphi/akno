import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ModelClient } from '../models/client.ts';
import { strictModeViolations, toEndpointSchema, type ChatOptions } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import { runRetain } from './retain.ts';
import { retentionNegativeEvidence } from './retention-negative-evidence.ts';

const deadline = {
  start: null,
  until: '2031-04-08',
  precision: 'day',
  relation: 'due',
  status: 'planned',
  timezone: null,
  mentioned_at: null,
  recurrence: null,
};

const cases = [
  {
    name: 'reported undertaking',
    source: 'Ada Marlow reports that Vulpine Mutual said it would inspect the Zephyr QX-100 by 8 April 2031.',
    text: 'Ada Marlow reports that Vulpine Mutual said it would inspect the Zephyr QX-100 by 8 April 2031.',
    kind: 'plan',
    disposition: 'accepted',
    sourceDisposition: 'accepted',
    time: deadline,
    retained: true,
  },
  {
    name: 'reported undertaking mislabeled as a proposal',
    source: 'Ada Marlow reports that Vulpine Mutual said it would inspect the Zephyr QX-100 by 8 April 2031.',
    text: 'Ada Marlow reports that Vulpine Mutual said it would inspect the Zephyr QX-100 by 8 April 2031.',
    kind: 'plan',
    disposition: 'proposed',
    sourceDisposition: 'accepted',
    time: deadline,
    retained: false,
  },
  {
    name: 'actual conditional offer',
    source:
      'Ada Marlow reports that Vulpine Mutual offered to inspect the Zephyr QX-100 by 8 April 2031 if Ada accepts.',
    text: 'Ada Marlow reports Vulpine Mutual offered to inspect the Zephyr QX-100 by 8 April 2031 if she accepts.',
    kind: 'plan',
    disposition: 'proposed',
    sourceDisposition: 'proposed',
    time: { ...deadline, status: 'tentative' },
    retained: true,
  },
  {
    name: 'completed inspection',
    source: 'Ada Marlow reports that Vulpine Mutual inspected the Zephyr QX-100 on 8 April 2031.',
    text: 'Ada Marlow reports that Vulpine Mutual inspected the Zephyr QX-100 on 8 April 2031.',
    kind: 'event',
    disposition: 'active',
    sourceDisposition: null,
    time: { ...deadline, start: '2031-04-08', until: null, relation: 'occurred', status: 'actual' },
    retained: true,
  },
] as const;

describe('reported future actions versus proposals', () => {
  it.each(cases)('$name', async (fixture) => {
    const candidate = {
      kind: fixture.kind,
      text: fixture.text,
      subject: 'Zephyr QX-100',
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
      discourse: { commitment: 'asserted', disposition: fixture.disposition },
      epistemic: { basis: 'source_report' },
      polarity: 'affirmed',
      support: [{ item_id: 'turn-1111', quote: fixture.source }],
      discourse_frame: [{ item_id: 'turn-1111', quote: fixture.source }],
      relations: [],
      time: fixture.time,
      page: null,
    };
    const chat = vi.fn(async (messages: { content: string }[], options: ChatOptions) => {
      if (chat.mock.calls.length === 1) {
        expect(messages[0]!.content).toContain('A source-reported statement that an actor will act');
        return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
      }
      expect(messages[0]!.content).toContain('independently classify source_selected_plan_disposition');
      const payload = JSON.parse(messages.at(-1)!.content);
      const record = payload.candidates[0];
      const wire: any = toEndpointSchema(options.schema!);
      expect(strictModeViolations(wire)).toEqual([]);
      expect(Boolean(wire.properties.verdicts.items.properties.source_selected_plan_disposition)).toBe(
        fixture.kind === 'plan',
      );
      expect(wire.properties.verdicts.items.required.includes('source_selected_plan_disposition')).toBe(
        fixture.kind === 'plan',
      );
      expect(wire.properties.verdicts.items.required.includes('plan_disposition_evidence')).toBe(
        fixture.kind === 'plan',
      );
      return {
        ok: true,
        latencyMs: 11,
        value: JSON.stringify({
          verdicts: [
            {
              candidate_id: record.candidate_id,
              source_selected_polarity: 'affirmed',
              ...frameAuditFields(record),
              ...retentionAudit(record),
              ...(fixture.sourceDisposition
                ? {
                    source_selected_plan_disposition: fixture.sourceDisposition,
                    plan_disposition_evidence:
                      fixture.sourceDisposition === fixture.disposition
                        ? null
                        : {
                            source: {
                              frame_id: 'F1',
                              exact_excerpt: 'said it would inspect the Zephyr QX-100 by 8 April 2031',
                            },
                            candidate_metadata_id: 'discourse.disposition',
                          },
                  }
                : {}),
              proposition_supported: true,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: null,
            },
          ],
        }),
      };
    });
    const model = {
      available: true,
      modelId: 'invented-plan-disposition',
      chat,
      reportInvalidResponse: vi.fn(),
      degradedReason: () => null,
    } as unknown as ModelClient;
    const result = await runRetain('', model, {
      sourceItems: [{ item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text: fixture.source }],
    });
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.degradedReason).toBeNull();
    expect(result.candidates).toHaveLength(fixture.retained ? 1 : 0);
    if (fixture.retained) {
      expect(result.candidates[0]?.discourse.disposition).toBe(fixture.disposition);
      expect(result.candidates[0]?.time?.status).toBe(fixture.time.status);
      expect(result.candidates[0]?.epistemic.basis).toBe('source_report');
    } else {
      expect(result.held[0]?.hold_stage).toBe('verification');
      expect(result.held[0]?.reason_code).toBe('discourse_uncertain');
    }
  });

  it('requires an exact source witness when plan disposition disagrees with the generated label', () => {
    const source = cases[0].source;
    const candidate = {
      kind: 'plan',
      subject: 'Zephyr QX-100',
      text: source,
      polarity: 'affirmed',
      discourse: { commitment: 'asserted', disposition: 'proposed' },
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
      epistemic: { basis: 'source_report' },
      discourse_frame: [{ quote: source }],
      support: [{ quote: source }],
      relations: [],
      time: deadline,
    } as Parameters<typeof retentionNegativeEvidence>[0];
    const audit = retentionNegativeEvidence(candidate, false);
    const schema = z.strictObject(audit.fields);
    const base = {
      source_selected_polarity: 'affirmed',
      source_selected_plan_disposition: 'accepted',
      mismatches: [],
      polarity_evidence: null,
    };
    const witness = {
      source: { frame_id: 'F1', exact_excerpt: 'said it would inspect the Zephyr QX-100' },
      candidate_metadata_id: 'discourse.disposition',
    };
    for (const evidence of [null, { ...witness, source: { ...witness.source, exact_excerpt: 'invented' } }]) {
      const verdict = { ...base, plan_disposition_evidence: evidence };
      expect(
        schema.safeParse({ mismatches: [], polarity_evidence: null, plan_disposition_evidence: evidence })
          .success,
      ).toBe(true);
      expect(audit.consistent(verdict)).toBe(false);
    }
    expect(audit.consistent({ ...base, plan_disposition_evidence: witness })).toBe(true);
    expect(
      schema.safeParse({
        mismatches: [],
        polarity_evidence: null,
        plan_disposition_evidence: { ...witness, candidate_metadata_id: 'polarity' },
      }).success,
    ).toBe(false);
  });
});
