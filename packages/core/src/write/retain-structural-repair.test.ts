import { describe, expect, it, vi } from 'vitest';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import type { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

const deadline = 'Vulpine Mutual says Ada Marlow’s inspection was due 11 April 2031 and remains incomplete.';
const delivery = 'Vulpine Mutual confirmed delivery of Zephyr QX-100 for **11 April 2031 at 11:00 UTC**.';
const preference = 'Ada Marlow prefers written inspection reports.';
const mentionedAt = '2031-04-12T12:00:00Z';
const sourceItems = [
  {
    item_id: 'report-1111',
    role: 'assistant' as const,
    speaker: 'Luna',
    text: [deadline, delivery, preference].join('\n'),
    mentioned_at: mentionedAt,
  },
];

function candidate(quote: string, time: Record<string, unknown> | null = null) {
  return {
    kind: 'claim',
    text: `Luna reports that ${quote}`,
    subject: 'Ada Marlow',
    page: null,
    attribution: { source_role: 'assistant', source_speaker: 'Luna', chain: [] },
    discourse: { commitment: 'asserted', disposition: 'active' },
    epistemic: { basis: 'source_report' },
    polarity: 'affirmed',
    relations: [],
    support: [{ item_id: 'report-1111', quote }],
    discourse_frame: [{ item_id: 'report-1111', quote }],
    time,
  };
}
const dueTime = {
  start: '2031-04-11',
  until: null,
  precision: 'day',
  relation: 'due',
  status: 'actual',
  mentioned_at: mentionedAt,
  timezone: 'Etc/UTC',
  recurrence: null,
};
const deliveryTime = {
  ...dueTime,
  start: '2031-04-11T11:00:00',
  precision: 'instant',
  relation: 'scheduled',
  status: 'scheduled',
};
const options = { sourceItems, mentionedAt, timezone: 'Etc/UTC' };
type Draft = ReturnType<typeof candidate>;

async function extract(drafts: Draft[], repairs: Draft[], supported = true) {
  const requests: Array<{ system: string; payload: any }> = [];
  const chat = vi.fn(async (messages: { content: string }[]) => {
    const payload = JSON.parse(messages.at(-1)!.content);
    requests.push({ system: messages[0]!.content, payload });
    let value: unknown;
    if (requests.length === 1) value = { candidates: drafts, events: [] };
    else if (payload.repair_targets)
      value = {
        repairs: repairs.map((record, candidate_index) => ({ candidate_index, candidate: record })),
      };
    else
      value = {
        verdicts: payload.candidates.map((record: any) => ({
          candidate_id: record.candidate_id,
          source_selected_polarity: record.polarity,
          ...frameAuditFields(record),
          ...retentionAudit(record, supported),
          proposition_supported: supported,
          action_arguments_preserved: true,
          qualification_scope_preserved: true,
          reason_code: supported ? null : 'time_unresolved',
        })),
      };
    return { ok: true, value: JSON.stringify(value), latencyMs: 11 };
  });
  const model = {
    available: true,
    modelId: 'invented-structural-repair',
    chat,
    reportInvalidResponse: vi.fn(),
    degradedReason: () => 'derive_failed',
  } as unknown as ModelClient;
  return { result: await runRetain('', model, options), requests };
}

describe('retention structural repair diagnostics', () => {
  it('repairs deadline status and an instant hidden behind a malformed frame without changing admitted siblings', async () => {
    const badDelivery = candidate(delivery, deliveryTime);
    badDelivery.discourse_frame[0]!.quote = delivery.replaceAll('**', '');
    const goodDeadline = candidate(deadline, { ...dueTime, status: 'scheduled' });
    const goodDelivery = candidate(delivery, { ...deliveryTime, start: '2031-04-11T11:00:00Z' });
    const sibling = candidate(preference);
    const { result, requests } = await extract(
      [candidate(deadline, dueTime), badDelivery, sibling],
      [goodDeadline, goodDelivery],
    );
    const repair = requests.find(({ payload }) => payload.repair_targets)!.payload;
    expect(repair.repair_targets.map((entry: any) => entry.candidate_index)).toEqual([0, 1]);
    expect(repair.repair_targets[0].temporal_validation_issues).toEqual([
      { path: ['time', 'status'], message: 'actual is not valid for due' },
    ]);
    expect(repair.repair_targets[1].validation_issues[0]).toMatchObject({
      reason_code: 'source_unavailable',
      reason: expect.stringContaining('discourse_frame[0]'),
    });
    expect(repair.repair_targets[1].temporal_validation_issues).toEqual([
      { path: ['time', 'start'], message: 'start does not match instant precision' },
    ]);
    expect(repair.read_only_admitted_context).toEqual([
      expect.objectContaining({ candidate_index: 2, text: sibling.text }),
    ]);
    expect(result.held).toEqual([]);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.find((entry) => entry.text === goodDeadline.text)?.time).toMatchObject({
      relation: 'due',
      status: 'scheduled',
      start: '2031-04-11',
    });
    expect(result.candidates.find((entry) => entry.text === goodDelivery.text)?.time?.start).toBe(
      '2031-04-11T11:00:00Z',
    );
    expect(result.candidates.find((entry) => entry.text === sibling.text)?.support).toEqual(sibling.support);
    expect(requests[0]!.system).toContain('passing its date does not establish completion');
    expect(requests[0]!.system).toContain('including Markdown, punctuation and spacing');
    const verification = requests.find(({ payload }) => payload.candidates)!;
    expect(verification.system).toContain('Time status is separate from past/future clock relation');
    expect(verification.system).toContain('this contract does not establish that an obligation was met');
  });

  it('keeps invalid timing held after the single correction instead of coercing it', async () => {
    const draft = candidate(deadline, dueTime);
    const { result, requests } = await extract([draft], [draft]);
    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'time_unresolved' })]);
    expect(requests).toHaveLength(2);
  });

  it('still requires independent semantic verification after a structurally valid correction', async () => {
    const { result, requests } = await extract(
      [candidate(deadline, dueTime)],
      [candidate(deadline, { ...dueTime, start: '2031-04-22', status: 'scheduled' })],
      false,
    );
    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ hold_stage: 'verification' })]);
    expect(requests).toHaveLength(3);
  });

  it('does not replace an invented source clock with the supplied clock', async () => {
    const draft = candidate(deadline, {
      ...dueTime,
      status: 'scheduled',
      mentioned_at: '2031-04-22T12:00:00Z',
    });
    const { result } = await extract([draft], [draft]);
    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([
      expect.objectContaining({
        reason_code: 'time_unresolved',
        reason: expect.stringContaining('must equal a supplied source timestamp'),
      }),
    ]);
  });

  it.each([
    { quote: delivery.replaceAll('**', ''), item_id: 'report-1111', reason: 'not an exact substring' },
    { quote: delivery, item_id: 'missing-1111', reason: 'item_id must name' },
    { quote: delivery, item_id: '', reason: 'item_id is required' },
    { quote: 'x'.repeat(1201), item_id: 'report-1111', reason: '1 to 1200' },
    { quote: 'Vulpine Mutual', item_id: 'report-1111', reason: 'more than once' },
  ])(
    'identifies an invalid exact span without substituting evidence: $reason',
    ({ quote, item_id, reason }) => {
      const draft = candidate(delivery);
      draft.discourse_frame = [{ quote, item_id }];
      const result = cleanCandidateBatch([draft], { ...options, generated: true });
      expect(result.candidates).toEqual([]);
      expect(result.held).toEqual([
        expect.objectContaining({
          reason_code: 'source_unavailable',
          reason: expect.stringContaining(`discourse_frame[0]:`),
        }),
      ]);
      expect(result.held[0]!.reason).toContain(reason);
    },
  );
});
