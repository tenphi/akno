import { describe, expect, it } from 'vitest';
import { retentionAttributionAudit } from './retention-attribution.ts';

const candidate = {
  text: 'Bo Winters reports a disputed Zephyr QX-100 warranty of five years.',
  attribution: {
    source_role: 'user' as const,
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' as const }],
  },
  discourse_frame: [
    { item_id: 'note-1111', quote: 'Ada Marlow received the account from Bo Winters.' },
    { item_id: 'note-1111', quote: 'Bo’s separate claim is a five-year warranty; this remains disputed.' },
  ],
};
const verdict = () => [
  {
    reporter_id: 'A1',
    relation: 'reports_selected_proposition',
    source: { frame_id: 'F2' },
    name_origin: { frame_id: 'F1' },
    resolution: 'unambiguous_antecedent',
    candidate_relation: 'preserved',
    explanation:
      'The original account establishes the alias; the readable claim keeps its reporter and dispute.',
  },
];

describe('immutable inner-reporter attribution anchors', () => {
  it('grounds a same-source alias without reconstructing or truncating deciding excerpts', () => {
    const audit = retentionAttributionAudit(candidate)!;
    expect(audit.coordinates).toEqual({
      reporters: [{ reporter_id: 'A1', speaker: 'Bo Winters', role: 'external', name_frames: ['F1'] }],
      source_frames: [
        { frame_id: 'F1', discourse_frame_index: 0 },
        { frame_id: 'F2', discourse_frame_index: 1 },
      ],
      candidate: 'original_readable_text',
    });
    expect(audit.consistent(verdict())).toBe(true);
    expect(audit.preserved(verdict())).toBe(true);
  });

  it('exposes only literal full-name frames for this reporter, not a mentally expanded alias', () => {
    const audit = retentionAttributionAudit(candidate)!;
    const value = verdict();
    value[0]!.name_origin.frame_id = 'F2';
    expect(audit.schema.safeParse(value).success).toBe(false);
    expect(audit.consistent(value)).toBe(false);
  });

  it('audits familiar predicates too, even when they concern a different proposition', () => {
    const audit = retentionAttributionAudit({
      ...candidate,
      discourse_frame: [{ quote: 'Bo Winters reported a warranty. Ada Marlow scheduled an inspection.' }],
    })!;
    expect(audit.coordinates.reporters).toHaveLength(1);
    const value = verdict();
    Object.assign(value[0]!, {
      relation: 'not_a_reporter',
      source: { frame_id: 'F1' },
      name_origin: { frame_id: 'F1' },
      resolution: 'explicit',
    });
    expect(audit.consistent(value)).toBe(true);
    expect(audit.preserved(value)).toBe(false);
  });

  it.each(['unresolved', 'ambiguous', 'unsupported'])(
    'holds a well-formed %s identity despite a positive reporting verdict',
    (resolution) => {
      const audit = retentionAttributionAudit(candidate)!;
      const value = verdict();
      value[0]!.resolution = resolution;
      expect(audit.consistent(value)).toBe(true);
      expect(audit.preserved(value)).toBe(false);
    },
  );

  it.each(['omitted', 'changed', 'uncertain'])('holds an independently %s readable role', (relation) => {
    const audit = retentionAttributionAudit(candidate)!;
    const value = verdict();
    value[0]!.candidate_relation = relation;
    expect(audit.consistent(value)).toBe(true);
    expect(audit.preserved(value)).toBe(false);
  });

  it('cannot use subject metadata or another candidate to supply a missing readable name', () => {
    const audit = retentionAttributionAudit({ ...candidate, text: 'A disputed warranty lasts five years.' })!;
    expect(audit.consistent(verdict())).toBe(false);
    expect(audit.preserved(verdict())).toBe(false);
  });

  it.each(['Bo Wintersley', 'Bo Winters-1111', 'Bo Winters_1111'])('rejects a substring name: %s', (name) => {
    const audit = retentionAttributionAudit({
      ...candidate,
      discourse_frame: [{ quote: name }, candidate.discourse_frame[1]!],
    })!;
    expect(audit.consistent(verdict())).toBe(false);
  });

  it('retains existing case/NFKC-equivalent labels while anchoring original bytes', () => {
    const audit = retentionAttributionAudit({
      ...candidate,
      text: candidate.text.toUpperCase(),
      discourse_frame: [
        { item_id: 'note-1111', quote: 'ＢＯ ＷＩＮＴＥＲＳ supplied the account.' },
        candidate.discourse_frame[1]!,
      ],
    })!;
    expect(audit.preserved(verdict())).toBe(true);
  });

  it('does not borrow an owned name anchor from another original item', () => {
    const audit = retentionAttributionAudit({
      ...candidate,
      discourse_frame: [
        { ...candidate.discourse_frame[0]!, item_id: 'note-2222' },
        candidate.discourse_frame[1]!,
      ],
    })!;
    expect(audit.consistent(verdict())).toBe(false);
  });

  it('rejects a claimed explicit name from a separate frame', () => {
    const value = verdict();
    value[0]!.resolution = 'explicit';
    expect(retentionAttributionAudit(candidate)!.consistent(value)).toBe(false);
  });

  it('permits well-formed uncertainty without a source anchor but never preserves it', () => {
    const value = [
      { ...verdict()[0]!, relation: 'uncertain', source: null, name_origin: null, resolution: 'unresolved' },
    ];
    const audit = retentionAttributionAudit(candidate)!;
    expect(audit.consistent(value)).toBe(true);
    expect(audit.preserved(value)).toBe(false);
  });

  it.each(['missing-origin', 'foreign-frame', 'generated-excerpt', 'missing-entry', 'duplicate-entry'])(
    'rejects an incomplete or ungrounded positive audit: %s',
    (mode) => {
      const value: any[] = verdict();
      if (mode === 'missing-origin') value[0].name_origin = null;
      if (mode === 'foreign-frame') value[0].source.frame_id = 'F3';
      if (mode === 'generated-excerpt') value[0].source.exact_excerpt = candidate.discourse_frame[1]!.quote;
      if (mode === 'missing-entry') value.pop();
      if (mode === 'duplicate-entry') value.push(value[0]);
      const audit = retentionAttributionAudit(candidate)!;
      expect(audit.consistent(value)).toBe(false);
      expect(audit.preserved(value)).toBe(false);
    },
  );

  it('does not add an inner-reporter audit when there is no inner chain', () => {
    expect(
      retentionAttributionAudit({ ...candidate, attribution: { ...candidate.attribution, chain: [] } }),
    ).toBeNull();
  });
});
