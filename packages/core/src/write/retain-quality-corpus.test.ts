import { describe, expect, it } from 'vitest';
import { cleanCandidateBatch, type CandidateCleaningOptions } from './retain.ts';

type CandidateRecord = Record<string, unknown>;

const candidate = (
  text: string,
  support: string,
  frame: string,
  extra: Record<string, unknown> = {},
): CandidateRecord => ({
  text,
  subject: 'Zephyr QX-100',
  kind: 'claim',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'affirmed',
  support: [{ quote: support, item_id: null }],
  discourse_frame:
    support === frame
      ? [{ quote: support, item_id: null }]
      : [
          { quote: support, item_id: null },
          { quote: frame, item_id: null },
        ],
  relations: [],
  time: null,
  page: null,
  ...extra,
});

const clean = (sourceText: string, candidates: CandidateRecord[], options: CandidateCleaningOptions = {}) =>
  cleanCandidateBatch(candidates, {
    sourceText,
    sourceId: 'fixture:discourse-corpus',
    revision: 'rev-1111',
    ...options,
  });

/**
 * Frozen invented discourse corpus for the deterministic boundary after model extraction.
 * These cases are intentionally about scope and structure, never personal fixture content.
 */
describe('automatic retain discourse quality corpus', () => {
  it('preserves nested reporting as a report with its speaker chain', () => {
    const source = 'Ada Marlow wrote, “Bo Winters said, ‘The Zephyr QX-100 warranty lasts five years.’”';
    const result = clean(source, [
      candidate(
        'Bo Winters reported that the Zephyr QX-100 warranty lasts five years.',
        'The Zephyr QX-100 warranty lasts five years.',
        source,
        {
          attribution: {
            source_role: 'external',
            source_speaker: 'Bo Winters',
            chain: [{ speaker: 'Ada Marlow', role: 'user' }],
          },
          epistemic: { basis: 'source_report' },
        },
      ),
    ]);

    expect(result.held).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      attribution: {
        source_role: 'external',
        source_speaker: 'Bo Winters',
        chain: [{ speaker: 'Ada Marlow', role: 'user' }],
      },
      epistemic: { basis: 'source_report' },
    });
  });

  it.each([
    {
      name: 'hypothesis',
      source: 'Ada Marlow said, “Suppose the Zephyr QX-100 warranty lasts ten years.”',
      text: 'Hypothetically, the Zephyr QX-100 warranty lasts ten years.',
      support: 'the Zephyr QX-100 warranty lasts ten years',
      commitment: 'hypothetical',
    },
    {
      name: 'counterfactual',
      source: 'If Ada Marlow had selected the silver plan, the warranty would last two years.',
      text: 'Counterfactually, the Zephyr QX-100 warranty would last two years.',
      support: 'the warranty would last two years',
      commitment: 'counterfactual',
    },
  ] as const)('keeps a typed $name noncanonical instead of promoting or discarding it', (fixture) => {
    const result = clean(fixture.source, [
      candidate(fixture.text, fixture.support, fixture.source, {
        discourse: { commitment: fixture.commitment, disposition: 'active' },
      }),
    ]);

    expect(result.held).toEqual([]);
    expect(result.candidates[0]?.discourse.commitment).toBe(fixture.commitment);
  });

  it('holds the same hypothetical frame when extraction labels it as a current fact', () => {
    const source = 'Suppose the Zephyr QX-100 warranty lasts ten years.';
    const result = clean(source, [
      candidate(
        'The Zephyr QX-100 warranty lasts ten years.',
        'the Zephyr QX-100 warranty lasts ten years',
        source,
      ),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'discourse_uncertain' })]);
  });

  it.each([
    {
      name: 'proposal',
      source: 'Ada Marlow proposed buying a Zephyr QX-100 with the silver plan.',
      text: 'Ada Marlow proposed buying a Zephyr QX-100 with the silver plan.',
      kind: 'plan',
      disposition: 'proposed',
    },
    {
      name: 'rejection',
      source: 'Ada Marlow rejected the plan to buy a Zephyr QX-100 with the silver plan.',
      text: 'Ada Marlow rejected the plan to buy a Zephyr QX-100 with the silver plan.',
      kind: 'decision',
      disposition: 'rejected',
    },
  ] as const)('preserves an explicit $name with its disposition', (fixture) => {
    const result = clean(fixture.source, [
      candidate(fixture.text, fixture.source, fixture.source, {
        kind: fixture.kind,
        discourse: { commitment: 'asserted', disposition: fixture.disposition },
      }),
    ]);

    expect(result.held).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      kind: fixture.kind,
      discourse: { disposition: fixture.disposition },
    });
  });

  it('resolves a correction relation to the retained candidate id', () => {
    const first = 'Ada Marlow first said the Zephyr QX-100 warranty lasts five years.';
    const correction = 'Ada Marlow corrected herself: the Zephyr QX-100 warranty lasts seven years.';
    const source = `${first} ${correction}`;
    const result = clean(source, [
      candidate('The warranty was previously stated to last five years.', first, first, {
        discourse: { commitment: 'asserted', disposition: 'superseded' },
      }),
      candidate('The Zephyr QX-100 warranty lasts seven years.', correction, correction, {
        relations: [{ type: 'corrects', target_candidate: 0, support: [{ quote: correction }] }],
      }),
    ]);

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[1]?.relations).toEqual([
      expect.objectContaining({
        type: 'corrects',
        target: { candidate_id: result.candidates[0]!.candidate_id },
      }),
    ]);
  });

  it('holds a correction whose relation target did not survive validation', () => {
    const source = 'Ada Marlow corrected the Zephyr QX-100 warranty duration to seven years.';
    const result = clean(source, [
      candidate('The Zephyr QX-100 warranty lasts seven years.', source, source, {
        relations: [{ type: 'corrects', target_candidate: 9, support: [{ quote: source }] }],
      }),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'validation_failed' })]);
  });

  it('keeps explicit tentative wording when its noncanonical semantics agree', () => {
    const source = 'Ada Marlow said, “Maybe the Zephyr QX-100 warranty lasts six years.”';
    const result = clean(source, [
      candidate(
        'Maybe the Zephyr QX-100 warranty lasts six years.',
        'Maybe the Zephyr QX-100 warranty lasts six years.',
        source,
        { discourse: { commitment: 'tentative', disposition: 'active' } },
      ),
    ]);

    expect(result.held).toEqual([]);
    expect(result.candidates[0]?.discourse.commitment).toBe('tentative');
  });

  it('does not let an invalid first duplicate suppress a later supported candidate', () => {
    const source = 'Ada Marlow selected the five-year Zephyr QX-100 warranty.';
    const duplicate = candidate(source, source, source);
    const result = clean(source, [
      { ...duplicate, support: [{ quote: 'a span absent from the source', item_id: null }] },
      duplicate,
    ]);

    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'source_unavailable' })]);
    expect(result.candidates).toHaveLength(1);
  });

  it('takes speaker and role from structured source items rather than the model', () => {
    const items = [
      {
        item_id: 'turn-1',
        text: 'I have a preference for the silver Zephyr QX-100 plan.',
        role: 'user' as const,
        speaker: 'Ada Marlow',
      },
      {
        item_id: 'turn-2',
        text: 'The Zephyr QX-100 warranty lasts five years.',
        role: 'assistant' as const,
        speaker: 'Bo Winters',
      },
    ];
    const withItem = (text: string, itemId: string, extra: Record<string, unknown>) => ({
      ...candidate(text, text, text, extra),
      support: [{ quote: text, item_id: itemId }],
      discourse_frame: [{ quote: text, item_id: itemId }],
    });
    const result = cleanCandidateBatch(
      [
        withItem(items[0].text, 'turn-1', {
          kind: 'preference',
          attribution: { source_role: 'assistant', source_speaker: 'Wrong Speaker', chain: [] },
          epistemic: { basis: 'self_attested' },
        }),
        withItem(items[1].text, 'turn-2', {
          attribution: { source_role: 'user', source_speaker: 'Wrong Speaker', chain: [] },
          epistemic: { basis: 'self_attested' },
        }),
      ],
      { sourceItems: items, sourceId: 'fixture:speakers', revision: 'rev-2222' },
    );

    expect(result.candidates[0]).toMatchObject({
      attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
      epistemic: { basis: 'self_attested' },
    });
    expect(result.candidates[1]).toMatchObject({
      attribution: { source_role: 'assistant', source_speaker: 'Bo Winters' },
      epistemic: { basis: 'source_report' },
    });
  });

  it('holds proposition support that crosses structured speakers', () => {
    const items = [
      {
        item_id: 'turn-1',
        text: 'Ada Marlow selected the silver plan.',
        role: 'user' as const,
        speaker: 'Ada Marlow',
      },
      {
        item_id: 'turn-2',
        text: 'Bo Winters selected the brass plan.',
        role: 'external' as const,
        speaker: 'Bo Winters',
      },
    ];
    const result = cleanCandidateBatch(
      [
        {
          ...candidate('The speakers selected different invented plans.', items[0].text, items[0].text),
          support: items.map((item) => ({ quote: item.text, item_id: item.item_id })),
          discourse_frame: items.map((item) => ({ quote: item.text, item_id: item.item_id })),
        },
      ],
      { sourceItems: items, sourceId: 'fixture:speaker-scope', revision: 'rev-3333' },
    );

    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'discourse_uncertain' })]);
  });

  it('accepts an anchored relative date but holds unresolved calendar language', () => {
    const source = 'Tomorrow, Ada Marlow will visit Blackwater Bay.';
    const anchored = clean(
      source,
      [
        candidate(source, source, source, {
          kind: 'event',
          time: {
            start: '2026-09-02',
            until: null,
            precision: 'day',
            relation: 'scheduled',
            status: 'planned',
            timezone: 'UTC',
            mentioned_at: '2026-09-01T07:00:00Z',
            recurrence: null,
          },
        }),
      ],
      { mentionedAt: '2026-09-01T07:00:00Z', timezone: 'UTC' },
    );
    const unresolved = clean(source, [
      candidate(source, source, source, {
        kind: 'event',
        time: {
          start: 'tomorrow',
          until: null,
          precision: 'day',
          relation: 'scheduled',
          status: 'planned',
          timezone: null,
          mentioned_at: null,
          recurrence: null,
        },
      }),
    ]);

    expect(anchored.candidates[0]?.time).toMatchObject({ start: '2026-09-02', precision: 'day' });
    expect(unresolved.candidates).toEqual([]);
    expect(unresolved.held).toEqual([expect.objectContaining({ reason_code: 'time_unresolved' })]);
  });

  it('holds relative calendar language when the mention time has no timezone', () => {
    const result = cleanCandidateBatch(
      [
        {
          text: 'Ada Marlow will visit Blackwater Bay tomorrow.',
          kind: 'plan',
          support: [{ quote: 'Ada Marlow will visit Blackwater Bay tomorrow.' }],
          frame: [{ quote: 'Ada Marlow will visit Blackwater Bay tomorrow.' }],
          time: {
            start: '2026-09-02',
            precision: 'day',
            relation: 'scheduled',
            status: 'planned',
            mentioned_at: '2026-09-01T07:00:00Z',
          },
        },
      ],
      { mentionedAt: '2026-09-01T07:00:00Z' },
    );

    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([expect.objectContaining({ reason_code: 'time_unresolved' })]);
  });
});
