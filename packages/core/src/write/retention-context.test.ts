import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import { strictModeViolations, toEndpointSchema } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';
import { runRetain } from './retain.ts';
import { retentionContextWitness, retentionContextSchema } from './retention-context.ts';

const source = 'You were meant to check the weekly summary.';
function record(text = source, quote = source) {
  return {
    kind: 'claim',
    text,
    attribution: { source_role: 'user', source_speaker: 'Ada Marlow', chain: [] },
    discourse: { commitment: 'asserted', disposition: 'active' },
    epistemic: { basis: 'self_attested' },
    polarity: 'affirmed',
    support: [{ quote, item_id: 'turn-1111' }],
    discourse_frame: [{ quote, item_id: 'turn-1111' }],
  };
}
function stub(records = [record()], edit: (verdict: any, index: number) => void = () => {}) {
  const requests: any[] = [];
  const invalid = vi.fn();
  const chat = vi.fn(async (messages: { content: string }[], options: any) => {
    const payload = JSON.parse(messages.at(-1)!.content);
    requests.push(payload);
    expect(strictModeViolations(toEndpointSchema(options.schema))).toEqual([]);
    if (requests.length === 1)
      return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
    const verdicts = payload.candidates.map((candidate: any, index: number) => {
      const verdict = {
        candidate_id: candidate.candidate_id,
        ...frameAuditFields(candidate),
        ...retentionAudit(candidate),
        source_selected_polarity: candidate.polarity,
        proposition_supported: true,
        action_arguments_preserved: true,
        qualification_scope_preserved: true,
        reason_code: null,
      };
      edit(verdict, index);
      return verdict;
    });
    return { ok: true, value: JSON.stringify({ verdicts }), latencyMs: 22 };
  });
  return {
    requests,
    chat,
    invalid,
    model: {
      available: true,
      modelId: 'invented-context-verifier',
      chat,
      reportInvalidResponse: invalid,
    } as unknown as ModelClient,
  };
}
function run(model: ModelClient, text = source) {
  return runRetain(text, model, {
    sourceItems: [{ item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text }],
  });
}

describe('standalone retention context admission', () => {
  const bookingSource = 'Bo Winters told Ada Marlow: you have an inspection booking.';
  const bookingText = "Bo Winters told Ada Marlow about Ada's inspection booking.";
  const bookingReference = () => ({
    source: { frame_id: 'F1' },
    name_origin: { frame_id: 'F1' },
    resolution: 'explicit',
    source_name: 'Ada Marlow',
    source_role: 'possessor',
    candidate_role: 'possessor',
    relation: 'preserved',
  });

  it.each(['preserved', 'changed-role', 'omitted', 'incomplete'])(
    'checks reference role preservation independently of positive semantic booleans: %s',
    async (mode) => {
      const { model } = stub([record(bookingText, bookingSource)], (verdict) => {
        const reference: any = bookingReference();
        if (mode === 'changed-role') reference.candidate_role = 'addressee';
        if (mode === 'omitted') {
          reference.relation = 'omitted';
          reference.candidate_role = null;
        }
        verdict.knowledge_context.references = [reference];
        verdict.knowledge_context.references_complete = mode !== 'incomplete';
      });
      const result = await run(model, bookingSource);
      expect(result.candidates).toHaveLength(mode === 'preserved' ? 1 : 0);
      expect(result.error).toBeNull();
      if (mode !== 'preserved') expect(result.held[0]!.reason_code).toBe('noncanonical_without_context');
    },
  );

  it.each(['foreign-source-name', 'foreign-source-frame', 'legacy-candidate-excerpt', 'name-not-in-record'])(
    'fails closed on an ungrounded participant binding: %s',
    async (mode) => {
      const text =
        mode === 'name-not-in-record' ? 'The inspection booking belongs to an unnamed person.' : bookingText;
      const { model, invalid } = stub([record(text, bookingSource)], (verdict) => {
        const reference: any = bookingReference();
        if (mode === 'foreign-source-name') reference.source_name = 'Vulpine Mutual';
        if (mode === 'foreign-source-frame') reference.source.frame_id = 'F2';
        if (mode === 'legacy-candidate-excerpt')
          reference.candidate_excerpt = 'Ada Marlow owns another booking.';
        verdict.knowledge_context.references = [reference];
      });
      const result = await run(model, bookingSource);
      expect(result.candidates).toEqual([]);
      expect(result.degradedReason).toBe('retain_verification_failed');
      expect(invalid).toHaveBeenCalledOnce();
    },
  );

  it('binds a structured first-person speaker to the owning frame rather than another source item', () => {
    const first = 'I maintain the Zephyr QX-100 register.';
    const text = 'Ada Marlow maintains the Zephyr QX-100 register.';
    const value = {
      source_use: 'lasting_knowledge',
      standalone_context: 'self_contained',
      witness: { frame_id: 'F1' },
      references: [
        {
          source: { frame_id: 'F1' },
          name_origin: { frame_id: 'F1' },
          resolution: 'explicit',
          source_name: 'Ada Marlow',
          source_role: 'actor',
          candidate_role: 'actor',
          relation: 'preserved',
        },
      ],
      references_complete: true,
      explanation: 'The structured author supplies the first-person actor.',
    };
    expect(
      retentionContextWitness([{ quote: first }], text, [{ frame_id: 'F1', speaker: 'Ada Marlow' }]).grounded(
        value,
      ),
    ).toBe(true);
    expect(
      retentionContextWitness([{ quote: first }], text, [{ frame_id: 'F2', speaker: 'Ada Marlow' }]).grounded(
        value,
      ),
    ).toBe(false);
  });

  const purchase = 'Ada Marlow bought a Zephyr QX-100.';
  const warranty = 'Its warranty lasts five years.';
  const warrantyText = 'The Zephyr QX-100 warranty lasts five years.';
  const antecedentReference = () => ({
    source: { frame_id: 'F2' },
    source_name: 'Zephyr QX-100',
    name_origin: { frame_id: 'F1' },
    resolution: 'unambiguous_antecedent',
    source_role: 'subject',
    candidate_role: 'subject',
    relation: 'preserved',
  });

  it('admits a grounded same-item antecedent without reconstructing source or candidate excerpts', async () => {
    const candidate = {
      ...record(warrantyText, warranty),
      discourse_frame: [
        { quote: purchase, item_id: 'turn-1111' },
        { quote: warranty, item_id: 'turn-1111' },
      ],
    };
    const { model, requests, chat } = stub([candidate], (verdict) => {
      verdict.knowledge_context.witness = { frame_id: 'F2' };
      verdict.knowledge_context.references = [antecedentReference()];
    });
    const result = await run(model, `${purchase} ${warranty}`);
    expect(result.candidates[0]!.text).toBe(warrantyText);
    expect(result.error).toBeNull();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(requests[1].candidates[0].context_coordinates).toEqual({
      source_frames: [
        { frame_id: 'F1', discourse_frame_index: 0 },
        { frame_id: 'F2', discourse_frame_index: 1 },
      ],
      candidate: 'original_readable_text',
    });
  });

  it.each(['ambiguous', 'unsupported', 'changed-role', 'omitted', 'incomplete'])(
    'holds a material reference despite positive entailment: %s',
    async (mode) => {
      const candidate = {
        ...record(warrantyText, warranty),
        discourse_frame: [
          { quote: purchase, item_id: 'turn-1111' },
          { quote: warranty, item_id: 'turn-1111' },
        ],
      };
      const { model, invalid } = stub([candidate], (verdict) => {
        const reference: any = antecedentReference();
        if (mode === 'ambiguous' || mode === 'unsupported') reference.resolution = mode;
        if (mode === 'changed-role') reference.candidate_role = 'possessor';
        if (mode === 'omitted') {
          reference.relation = 'omitted';
          reference.candidate_role = null;
        }
        verdict.knowledge_context.references = [reference];
        verdict.knowledge_context.references_complete = mode !== 'incomplete';
      });
      const result = await run(model, `${purchase} ${warranty}`);
      expect(result.candidates).toEqual([]);
      expect(result.held[0]!.reason_code).toBe('noncanonical_without_context');
      expect(result.error).toBeNull();
      expect(invalid).not.toHaveBeenCalled();
    },
  );

  it.each([
    'foreign-item',
    'wrong-origin',
    'foreign-name',
    'explicit-across-frames',
    'missing-name-origin',
    'null-name-positive',
    'named-unresolved',
  ])('rejects an invalid antecedent anchor: %s', (mode) => {
    const frames = [
      { quote: purchase, item_id: 'turn-1111' },
      { quote: warranty, item_id: mode === 'foreign-item' ? 'turn-2222' : 'turn-1111' },
    ];
    const reference: any = antecedentReference();
    if (mode === 'wrong-origin') reference.name_origin.frame_id = 'F2';
    if (mode === 'foreign-name') reference.source_name = 'Vulpine Mutual';
    if (mode === 'explicit-across-frames') reference.resolution = 'explicit';
    if (mode === 'missing-name-origin') reference.name_origin = null;
    if (mode === 'named-unresolved') reference.resolution = 'unresolved';
    if (mode === 'null-name-positive') {
      reference.source_name = null;
      reference.name_origin = null;
    }
    expect(
      retentionContextWitness(frames, warrantyText).grounded({
        source_use: 'lasting_knowledge',
        standalone_context: 'self_contained',
        witness: { frame_id: 'F2' },
        references: [reference],
        references_complete: true,
        explanation: 'Compare the original antecedent and subject.',
      }),
    ).toBe(false);
  });

  it('grounds a short-name reference in original multilingual frames without translating the witness', async () => {
    const first = 'Ada Marlow records a forwarded statement from Bo Winters.';
    const second = 'Ada не подтверждает слова Bo об осмотре Zephyr QX-100.';
    const text = 'Ada Marlow has not confirmed Bo Winters’s statement about the Zephyr QX-100 inspection.';
    const candidate = {
      ...record(text, second),
      discourse_frame: [
        { quote: first, item_id: 'turn-1111' },
        { quote: second, item_id: 'turn-1111' },
      ],
    };
    const { model, requests } = stub([candidate], (verdict) => {
      verdict.knowledge_context.witness = { frame_id: 'F2' };
      verdict.knowledge_context.references = [
        {
          source: { frame_id: 'F2' },
          name_origin: { frame_id: 'F1' },
          source_name: 'Ada Marlow',
          resolution: 'unambiguous_antecedent',
          source_role: 'experiencer',
          candidate_role: 'experiencer',
          relation: 'preserved',
        },
      ];
    });
    const result = await run(model, `${first} ${second}`);
    expect(result.candidates[0]!.text).toBe(text);
    expect(requests[1].candidates[0].discourse_frame[1].quote).toBe(second);
  });

  it('cannot borrow a structured speaker from the neighboring antecedent frame', () => {
    const reference = {
      ...antecedentReference(),
      source_name: 'Ada Marlow',
      source_role: 'actor',
      candidate_role: 'actor',
    };
    const frames = [
      { quote: 'I bought a device.', item_id: 'turn-1111' },
      { quote: 'They maintain it.', item_id: 'turn-1111' },
    ];
    expect(
      retentionContextWitness(frames, 'Ada Marlow maintains the device.', [
        { frame_id: 'F1', speaker: 'Ada Marlow' },
      ]).grounded({
        source_use: 'lasting_knowledge',
        standalone_context: 'self_contained',
        witness: { frame_id: 'F2' },
        references: [reference],
        references_complete: true,
        explanation: 'The author does not identify the third-person actor.',
      }),
    ).toBe(false);
  });

  it('holds a missing property object rather than borrowing the reporting wrapper as its identity', async () => {
    const quote = 'Vulpine Mutual confirms Ada Marlow purchased a Zephyr QX-100.';
    const property = 'Its warranty lasts five years.';
    const text = 'Vulpine Mutual states that its warranty lasts five years.';
    const candidate = {
      ...record(text, property),
      discourse_frame: [
        { quote, item_id: 'turn-1111' },
        { quote: property, item_id: 'turn-1111' },
      ],
    };
    const { model, invalid } = stub([candidate], (verdict) => {
      verdict.knowledge_context.witness = { frame_id: 'F2' };
      verdict.knowledge_context.references = [
        {
          source: { frame_id: 'F2' },
          name_origin: { frame_id: 'F1' },
          source_name: 'Zephyr QX-100',
          resolution: 'unambiguous_antecedent',
          source_role: 'possessor',
          candidate_role: null,
          relation: 'omitted',
        },
      ];
    });
    const result = await run(model, `${quote} ${property}`);
    expect(result.candidates).toEqual([]);
    expect(result.held[0]!.reason_code).toBe('noncanonical_without_context');
    expect(result.error).toBeNull();
    expect(invalid).not.toHaveBeenCalled();
  });

  it('holds a missing explicitly named recipient even when the candidate omits the speaking predicate', async () => {
    const quote = 'Bo Winters tells Ada Marlow that the Zephyr QX-100 inspection is estimated for May.';
    const text = 'Bo Winters estimates the Zephyr QX-100 inspection for May.';
    const { model, chat, invalid } = stub([record(text, quote)], (verdict) => {
      verdict.knowledge_context.references = [
        {
          source: { frame_id: 'F1' },
          name_origin: { frame_id: 'F1' },
          source_name: 'Ada Marlow',
          resolution: 'explicit',
          source_role: 'addressee',
          candidate_role: null,
          relation: 'omitted',
        },
      ];
    });
    const result = await run(model, quote);
    expect(result.candidates).toEqual([]);
    expect(result.held[0]!.reason_code).toBe('noncanonical_without_context');
    expect(result.error).toBeNull();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(invalid).not.toHaveBeenCalled();
  });

  it('preserves an explicitly unidentified recipient without inventing an identity', async () => {
    const quote = 'Bo Winters told an unidentified recipient about an inspection.';
    const { model } = stub([record(quote, quote)], (verdict) => {
      verdict.knowledge_context.references = [
        {
          source: { frame_id: 'F1' },
          source_name: null,
          name_origin: null,
          resolution: 'unresolved',
          source_role: 'addressee',
          candidate_role: 'addressee',
          relation: 'preserved',
        },
      ];
    });
    expect((await run(model, quote)).candidates[0]!.text).toBe(quote);
  });

  it.each(['claim', 'preference', 'plan'])(
    'holds an interaction-only source independently of positive entailment and a proposed %s kind',
    async (kind) => {
      const quote =
        kind === 'plan'
          ? "Ada Marlow accepted the assistant's offer to check the weekly summary now."
          : source;
      const candidate = {
        ...record(quote, quote),
        kind,
        discourse: { commitment: 'asserted', disposition: kind === 'plan' ? 'accepted' : 'active' },
      };
      const { model, chat } = stub([candidate], (verdict) => {
        verdict.knowledge_context.source_use = 'interaction_management';
      });
      const result = await run(model, quote);
      expect(result.candidates).toEqual([]);
      expect(result.held[0]).toMatchObject({ hold_stage: 'verification', reason_code: 'not_durable' });
      expect(result.error).toBeNull();
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.modelUsage.repair).toBeUndefined();
    },
  );

  it.each(['conversation_dependent', 'uncertain'])(
    'holds a faithful record with %s readable context even when metadata names the speaker',
    async (context) => {
      const quote = 'Bo Winters said you have an inspection booked for your Zephyr QX-100.';
      const { model } = stub([record(quote, quote)], (verdict) => {
        verdict.knowledge_context.standalone_context = context;
      });
      const result = await run(model, quote);
      expect(result.candidates).toEqual([]);
      expect(result.held[0]!.reason_code).toBe('noncanonical_without_context');
      expect(result.error).toBeNull();
    },
  );

  it('holds uncertain source purpose without making up an ongoing preference', async () => {
    const { model } = stub(undefined, (verdict) => {
      verdict.knowledge_context.source_use = 'uncertain';
    });
    const result = await run(model);
    expect(result.held[0]!.reason_code).toBe('noncanonical_without_context');
    expect(result.candidates).toEqual([]);
  });

  it.each([
    ['interaction_management', 'self_contained', 'not_durable'],
    ['lasting_knowledge', 'conversation_dependent', 'noncanonical_without_context'],
  ])(
    'accepts a matching admission hold code without inventing a semantic failure: %s',
    async (purpose, context, reason) => {
      const { model, invalid } = stub(undefined, (verdict) => {
        verdict.knowledge_context.source_use = purpose;
        verdict.knowledge_context.standalone_context = context;
        verdict.reason_code = reason;
      });
      const result = await run(model);
      expect(result.held[0]!.reason_code).toBe(reason);
      expect(result.candidates).toEqual([]);
      expect(result.error).toBeNull();
      expect(invalid).not.toHaveBeenCalled();
    },
  );

  it('rejects an unrelated hold reason attached to positive context and semantics', async () => {
    const { model, invalid } = stub(undefined, (verdict) => {
      verdict.reason_code = 'not_durable';
    });
    const result = await run(model);
    expect(result.degradedReason).toBe('retain_verification_failed');
    expect(invalid).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'For every weekly summary I prefer an equipment section.',
      'Ada Marlow prefers an equipment section in every weekly summary.',
    ],
    [
      'I have committed to maintaining the Zephyr QX-100 register.',
      'Ada Marlow has committed to maintaining the Zephyr QX-100 register.',
    ],
    [
      'Bo Winters told Ada Marlow that her Zephyr QX-100 warranty lasts five years.',
      'Bo Winters told Ada Marlow that her Zephyr QX-100 warranty lasts five years.',
    ],
    [
      'Bo Winters addressed an unidentified recipient about an inspection.',
      'Bo Winters addressed an unidentified recipient about an inspection.',
    ],
  ])('preserves independently readable lasting knowledge: %s', async (quote, text) => {
    const { model, chat } = stub([record(text, quote)]);
    const result = await run(model, quote);
    expect(result.candidates[0]!.text).toBe(text);
    expect(result.error).toBeNull();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result.candidates)).not.toContain('knowledge_context');
  });

  it('does not let one interaction-only candidate suppress an independent factual sibling', async () => {
    const independentWarranty = 'Ada Marlow states that the Zephyr QX-100 warranty lasts five years.';
    const { model } = stub([record(), record(independentWarranty, independentWarranty)], (verdict, index) => {
      if (index === 0) verdict.knowledge_context.source_use = 'interaction_management';
    });
    const result = await run(model, `${source}\n${independentWarranty}`);
    expect(result.candidates.map((candidate) => candidate.text)).toEqual([independentWarranty]);
    expect(result.held[0]!.reason_code).toBe('not_durable');
  });

  it.each([
    'missing',
    'foreign-frame',
    'changed-excerpt',
    'empty-excerpt',
    'whitespace',
    'unknown-classification',
  ])('fails an ungrounded or malformed context verdict without retry: %s', async (mode) => {
    const { model, chat, invalid } = stub(undefined, (verdict) => {
      if (mode === 'missing') delete verdict.knowledge_context;
      else if (mode === 'foreign-frame') verdict.knowledge_context.witness.frame_id = 'F2';
      else if (mode === 'changed-excerpt')
        verdict.knowledge_context.witness.exact_excerpt = 'An invented changed proposition.';
      else if (mode === 'empty-excerpt') verdict.knowledge_context.witness.exact_excerpt = '';
      else if (mode === 'whitespace') verdict.knowledge_context.witness.exact_excerpt = ' ';
      else verdict.knowledge_context.source_use = 'accepted';
    });
    const result = await run(model);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
    expect(invalid).toHaveBeenCalledOnce();
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('rejects foreign coordinates and reconstructed excerpts rather than searching adjacent frames', () => {
    const value = {
      source_use: 'lasting_knowledge',
      standalone_context: 'self_contained',
      references: [],
      references_complete: true,
      witness: { frame_id: 'F1' },
      explanation: 'A source-backed warranty fact.',
    };
    const audit = retentionContextWitness([{ quote: source }], source);
    expect(audit.grounded(value)).toBe(true);
    expect(audit.grounded({ ...value, witness: { frame_id: 'F2' } })).toBe(false);
    expect(audit.grounded({ ...value, witness: { frame_id: 'F1', exact_excerpt: source } })).toBe(false);
    expect(retentionContextSchema.safeParse(value).success).toBe(true);
  });

  it('withholds a whole verification batch when one context witness is unbound', async () => {
    const independentWarranty = 'Ada Marlow states that the Zephyr QX-100 warranty lasts five years.';
    const { model, chat, invalid } = stub(
      [record(), record(independentWarranty, independentWarranty)],
      (verdict, index) => {
        if (index === 0) verdict.knowledge_context.witness.frame_id = 'F2';
      },
    );
    const result = await run(model, `${source}\n${independentWarranty}`);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
    expect(invalid).toHaveBeenCalledOnce();
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
