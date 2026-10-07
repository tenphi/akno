import { describe, expect, it, vi } from 'vitest';
import { retentionAudit, frameAuditFields } from '../../test/semantic-audit.ts';
import type { ModelClient } from '../models/client.ts';
import { retentionTimeWitness } from './retention-time-witness.ts';
import { runRetain } from './retain.ts';

function comparison(frame_id = 'F1', sourceTiming: string | null = null, candidateTiming = sourceTiming) {
  return {
    source: {
      frame_id,
      predicate: 'Delivery estimate',
      timing: sourceTiming,
      status: 'estimated',
      time_relation: 'scheduled',
    },
    candidate: {
      predicate: 'Delivery estimate',
      timing: candidateTiming,
      status: 'estimated',
      time_relation: 'scheduled',
    },
    relation: 'preserved',
  };
}

describe('immutable retention temporal witnesses', () => {
  const frame =
    'Vulpine Mutual estimates delivery for 12–14 May 2034. It has not confirmed an arrival or a fixed delivery date.';
  const text =
    'Vulpine Mutual estimates delivery for 12–14 May 2034; arrival and a fixed date remain unconfirmed.';
  const witness = retentionTimeWitness([{ quote: frame }], text);

  it('selects the original conjunction for multiple predicates without reconstructing excerpts', () => {
    const value = {
      comparisons: [comparison('F1', '12–14 May 2034'), comparison(), comparison()],
      complete: true,
    };
    expect(witness.grounded(value)).toBe(true);
    expect(witness.supported(value)).toBe(true);
    expect(witness.coordinates).toEqual({
      source_frames: [{ frame_id: 'F1', discourse_frame_index: 0 }],
      candidate: 'original_readable_text',
    });
  });

  it.each([
    'foreign-frame',
    'generated-source-excerpt',
    'generated-candidate-excerpt',
    'foreign-source-time',
    'foreign-candidate-time',
  ])('refuses a foreign or reconstructed deciding coordinate: %s', (mode) => {
    const value: any = { comparisons: [comparison('F1', '12–14 May 2034')], complete: true };
    const entry = value.comparisons[0];
    if (mode === 'foreign-frame') entry.source.frame_id = 'F2';
    if (mode === 'generated-source-excerpt')
      entry.source.excerpt = 'It has not confirmed a fixed delivery date.';
    if (mode === 'generated-candidate-excerpt') entry.candidate.excerpt = 'It has arrived.';
    if (mode === 'foreign-source-time') entry.source.timing = '12 May 2034';
    if (mode === 'foreign-candidate-time') entry.candidate.timing = '15 May 2034';
    expect(witness.grounded(value)).toBe(false);
  });

  it('binds each timing to its selected owned frame, not another sibling or candidate', () => {
    const owned = retentionTimeWitness(
      [{ quote: 'Delivery is estimated.' }, { quote: 'Inspection is scheduled for 12 May 2034.' }],
      'Delivery is estimated.',
    );
    expect(owned.grounded({ comparisons: [comparison('F1', '12 May 2034', null)], complete: true })).toBe(
      false,
    );
    expect(
      owned.grounded({ comparisons: [comparison('F2', '12 May 2034', '12 May 2034')], complete: true }),
    ).toBe(false);
    expect(
      retentionTimeWitness([{ quote: 'Delivery is estimated.' }], text).schema.safeParse({
        comparisons: [comparison('F2')],
        complete: true,
      }).success,
    ).toBe(false);
  });

  it('allows original-language timings and equivalent readable calendar rendering without translated evidence', () => {
    const owned = retentionTimeWitness(
      [{ quote: 'Осмотр Zephyr QX-100 назначен на 12 мая 2034 года.' }],
      'The Zephyr QX-100 inspection is scheduled for 12 May 2034.',
    );
    const value = { comparisons: [comparison('F1', '12 мая 2034 года', '12 May 2034')], complete: true };
    expect(owned.grounded(value)).toBe(true);
    expect(owned.supported(value)).toBe(true);
  });

  it.each(['changed', 'unsupported', 'incomplete', 'completed', 'added-date', 'omitted-date'])(
    'keeps an independent negative temporal decision: %s',
    (mode) => {
      const value: any = { comparisons: [comparison('F1', '12–14 May 2034')], complete: true };
      if (mode === 'changed' || mode === 'unsupported') value.comparisons[0].relation = mode;
      if (mode === 'incomplete') value.complete = false;
      if (mode === 'completed') value.comparisons[0].candidate.time_relation = 'occurred';
      if (mode === 'added-date') value.comparisons[0].source.timing = null;
      if (mode === 'omitted-date') value.comparisons[0].candidate.timing = null;
      expect(witness.supported(value)).toBe(false);
    },
  );

  it('does not require copying a long frame or clipping a long readable record to fit an excerpt bound', () => {
    const long = frame + ' The administrative receipt key is invented.'.repeat(20);
    const record = text + ' The estimate remains qualified and does not establish completion.'.repeat(3);
    const owned = retentionTimeWitness([{ quote: long }], record);
    const value = { comparisons: [comparison('F1', '12–14 May 2034')], complete: true };
    expect(long.length).toBeGreaterThan(400);
    expect(record.length).toBeGreaterThan(240);
    expect(owned.grounded(value)).toBe(true);
  });

  it.each(['qualified-estimate', 'settlement', 'incomplete'])(
    'applies immutable temporal selection through automatic retention with no extra model stage: %s',
    async (mode) => {
      const source = 'Vulpine Mutual lists a pending debit dated 11 April 2034. The debit has not settled.';
      const candidate = {
        kind: 'claim',
        subject: 'pending debit',
        text: mode === 'settlement' ? 'Vulpine Mutual confirms the debit settled on 11 April 2034.' : source,
        attribution: { source_role: 'external', source_speaker: 'Vulpine Mutual' },
        discourse: { commitment: 'asserted', disposition: 'active' },
        epistemic: { basis: 'source_report' },
        polarity: 'affirmed',
        support: [{ item_id: 'receipt-1111', quote: source }],
        discourse_frame: [{ item_id: 'receipt-1111', quote: source }],
      };
      const chat = vi.fn(async (messages: { content: string }[], options: any) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const selected = JSON.parse(messages.at(-1)!.content).candidates[0];
        expect(selected.temporal_coordinates.source_frames).toEqual([
          { frame_id: 'F1', discourse_frame_index: 0 },
        ]);
        const verdict: any = {
          candidate_id: selected.candidate_id,
          ...frameAuditFields(selected),
          ...retentionAudit(selected),
          source_selected_polarity: 'affirmed',
          proposition_supported: true,
          action_arguments_preserved: true,
          qualification_scope_preserved: true,
          reason_code: null,
        };
        const entry = comparison('F1', null, mode === 'settlement' ? '11 April 2034' : null);
        entry.source.time_relation = 'unspecified';
        entry.candidate.time_relation = mode === 'settlement' ? 'occurred' : 'unspecified';
        verdict.predicate_time_audit = { comparisons: [entry], complete: mode !== 'incomplete' };
        expect(options.schema.safeParse({ verdicts: [verdict] }).success).toBe(true);
        return { ok: true, value: JSON.stringify({ verdicts: [verdict] }), latencyMs: 22 };
      });
      const result = await runRetain(
        source,
        {
          available: true,
          modelId: 'invented-fixture',
          chat,
          reportInvalidResponse: vi.fn(),
        } as unknown as ModelClient,
        {
          sourceItems: [
            { item_id: 'receipt-1111', role: 'external', speaker: 'Vulpine Mutual', text: source },
          ],
        },
      );
      expect(result.candidates).toHaveLength(mode === 'qualified-estimate' ? 1 : 0);
      if (mode !== 'qualified-estimate')
        expect(result.held[0]?.verification).toEqual({ outcome: 'rejected' });
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
    },
  );
});
