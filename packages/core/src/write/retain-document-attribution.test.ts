import { describe, expect, it, vi } from 'vitest';
import { cleanCandidateBatch, runRetain, verifyRetainTextRevision } from './retain.ts';
import type { ModelClient } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';

const source = 'The inspection notice specifies a Zephyr QX-100 inspection on 8 February 2027.';
function record(quote = source) {
  return {
    kind: 'event',
    subject: 'Zephyr QX-100',
    text: 'Ada Marlow records that the inspection notice specifies a Zephyr QX-100 inspection on 8 February 2027.',
    attribution: {
      source_role: 'user',
      source_speaker: 'Ada Marlow',
      chain: [{ speaker: 'the inspection notice', role: 'external' }],
    },
    discourse: { commitment: 'asserted', disposition: 'active' },
    epistemic: { basis: 'source_report' },
    polarity: 'affirmed',
    support: [{ quote, item_id: 'note-1111' }],
    discourse_frame: [{ quote, item_id: 'note-1111' }],
    relations: [],
    time: { start: '2027-02-08', precision: 'day', relation: 'scheduled', status: 'scheduled' },
    page: null,
  };
}

function stub(records = [record()], edit?: (verdict: any, candidate: any) => void) {
  const requests: any[] = [];
  const invalid = vi.fn();
  const chat = vi.fn(async (messages: { content: string }[]) => {
    const payload = JSON.parse(messages.at(-1)!.content);
    requests.push(payload);
    if (requests.length === 1)
      return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
    if (payload.repair_targets) return { ok: true, value: '{"repairs":[]}', latencyMs: 11 };
    const verdicts = payload.candidates.map((candidate: any) => {
      const verdict: any = {
        candidate_id: candidate.candidate_id,
        ...frameAuditFields(candidate),
        ...retentionAudit(candidate),
        source_selected_polarity: candidate.polarity,
        proposition_supported: true,
        action_arguments_preserved: true,
        qualification_scope_preserved: true,
        reason_code: null,
      };
      if (candidate.attribution_concern)
        verdict.attribution_audit = candidate.attribution_concern.reporters.map((reporter: any) => ({
          reporter_id: reporter.reporter_id,
          relation: 'reports_selected_proposition',
          source: { frame_id: 'F1', exact_excerpt: candidate.discourse_frame[0].quote },
          explanation: 'The notice supplies the inspection schedule in the recorded reporting chain.',
        }));
      edit?.(verdict, candidate);
      return verdict;
    });
    return { ok: true, value: JSON.stringify({ verdicts }), latencyMs: 11 };
  });
  return {
    requests,
    chat,
    invalid,
    model: {
      available: true,
      modelId: 'invented-attribution-verifier',
      chat,
      reportInvalidResponse: invalid,
    } as unknown as ModelClient,
  };
}

function run(model: ModelClient, quote = source) {
  return runRetain(quote, model, {
    sourceItems: [{ item_id: 'note-1111', role: 'user', speaker: 'Ada Marlow', text: quote }],
  });
}

describe('documentary reporting is verified from source context', () => {
  it('retains a documentary schedule without a lexical reporting match or rewrite', async () => {
    const { model, requests, chat } = stub();
    const result = await run(model);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.attribution).toEqual(record().attribution);
    expect(result.candidates[0]!.text).toBe(record().text);
    expect(result.candidates[0]!.time?.start).toBe('2027-02-08');
    expect(chat).toHaveBeenCalledTimes(2);
    expect(requests[1].candidates[0].attribution_concern.reporters).toEqual([
      { reporter_id: 'A1', speaker: 'the inspection notice', role: 'external' },
    ]);
    expect(result.modelUsage.repair).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('attribution_audit');
  });

  it('keeps the public cleaner conservative without a mandatory verifier', () => {
    const result = cleanCandidateBatch([record()], {
      sourceItems: [{ item_id: 'note-1111', role: 'user', speaker: 'Ada Marlow', text: source }],
      generated: true,
    });
    expect(result.candidates).toEqual([]);
    expect(result.held[0]!.reason_code).toBe('discourse_uncertain');
  });

  it.each([
    'The inspection notice lists a Zephyr QX-100 inspection on 8 February 2027.',
    'The inspection notice fixe une inspection du Zephyr QX-100 au 8 février 2027.',
    'The inspection notice предусматривает осмотр Zephyr QX-100 8 февраля 2027 года.',
  ])('uses exact contextual evidence across documentary predicates: %s', async (quote) => {
    const { model, chat } = stub([record(quote)]);
    const result = await run(model, quote);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.discourse_frame[0]!.quote).toBe(quote);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('preserves the structured outer recorder when the model supplied the document as outer speaker', async () => {
    const candidate = record();
    candidate.attribution = { source_role: 'external', source_speaker: 'the inspection notice', chain: [] };
    const { model, requests } = stub([candidate]);
    const result = await run(model);
    expect(result.candidates[0]!.attribution).toEqual(record().attribution);
    expect(requests[1].candidates[0].attribution_concern.reporters).toHaveLength(1);
  });

  it.each(['not_a_reporter', 'uncertain'])(
    'holds an independently rejected attribution even with positive generic booleans: %s',
    async (relation) => {
      const quote = 'The inspection notice is attached to Ada Marlow’s Zephyr QX-100 inspection request.';
      const { model, chat } = stub([record(quote)], (verdict) => {
        verdict.attribution_audit[0].relation = relation;
        verdict.attribution_audit[0].source = null;
      });
      const result = await run(model, quote);
      expect(result.candidates).toEqual([]);
      expect(result.error).toBeNull();
      expect(result.held[0]).toMatchObject({
        hold_stage: 'verification',
        reason_code: 'discourse_uncertain',
      });
      expect(chat).toHaveBeenCalledTimes(2);
    },
  );

  it('requires an audit for a colon that introduces a participant when correcting the outer speaker', async () => {
    const quote = 'The inspection notice: a prop in the fictional Zephyr QX-100 inspection example.';
    const candidate = record(quote);
    candidate.attribution = { source_role: 'external', source_speaker: 'the inspection notice', chain: [] };
    const { model, requests } = stub([candidate], (verdict) => {
      verdict.attribution_audit[0].relation = 'not_a_reporter';
      verdict.attribution_audit[0].source = null;
    });
    const result = await run(model, quote);
    expect(result.candidates).toEqual([]);
    expect(result.error).toBeNull();
    expect(requests[1].candidates[0].attribution_concern.reporters[0].speaker).toBe('the inspection notice');
  });

  it.each([
    'missing-audit',
    'missing-witness',
    'foreign-frame',
    'nonexact-witness',
    'missing-name',
    'foreign-reporter',
    'duplicate-reporter',
    'empty-audit',
  ])('rejects an incomplete or unbound attribution decision: %s', async (mode) => {
    const { model, invalid, chat } = stub([record()], (verdict) => {
      if (mode === 'missing-audit') delete verdict.attribution_audit;
      else if (mode === 'missing-witness') verdict.attribution_audit[0].source = null;
      else if (mode === 'foreign-frame') verdict.attribution_audit[0].source.frame_id = 'F2';
      else if (mode === 'nonexact-witness')
        verdict.attribution_audit[0].source.exact_excerpt = 'The inspection notice requires a changed date.';
      else if (mode === 'missing-name')
        verdict.attribution_audit[0].source.exact_excerpt = 'a Zephyr QX-100 inspection on 8 February 2027';
      else if (mode === 'foreign-reporter') verdict.attribution_audit[0].reporter_id = 'A2';
      else if (mode === 'duplicate-reporter') verdict.attribution_audit.push(verdict.attribution_audit[0]);
      else verdict.attribution_audit = [];
    });
    const result = await run(model);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
    expect(invalid).toHaveBeenCalledOnce();
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('does not override another independent semantic rejection', async () => {
    const { model } = stub([record()], (verdict, candidate) => {
      Object.assign(verdict, retentionAudit(candidate, false), {
        proposition_supported: false,
        reason_code: 'discourse_uncertain',
      });
    });
    const result = await run(model);
    expect(result.candidates).toEqual([]);
    expect(result.error).toBeNull();
    expect(result.held[0]!.hold_stage).toBe('verification');
  });

  it('rejects a malformed audit atomically with its batch sibling', async () => {
    const second = record();
    second.text = second.text.replace('specifies', 'lists');
    const { model } = stub([record(), second], (verdict, candidate) => {
      if (candidate.text.includes('lists')) delete verdict.attribution_audit;
    });
    const result = await run(model);
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(2);
    expect(result.degradedReason).toBe('retain_verification_failed');
  });

  it('does not infer a missing speaker from a similarly spelled name', async () => {
    const quote = source.replace('inspection notice', 'inspection notices');
    const { model, requests } = stub([record(quote)]);
    const result = await run(model, quote);
    expect(result.candidates).toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[1].repair_targets).toBeDefined();
  });

  it('still holds conflicting roles before asking for a semantic audit', async () => {
    const candidate = record();
    candidate.attribution.chain.push({ speaker: 'THE INSPECTION NOTICE', role: 'assistant' });
    const { model, requests } = stub([candidate]);
    const result = await run(model);
    expect(result.candidates).toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[1].repair_targets).toBeDefined();
  });

  it('requires one independent decision per unrecognized nested reporter', async () => {
    const quote =
      'Ada Marlow records Bo Winters’s account: the inspection notice specifies a Zephyr QX-100 inspection on 8 February 2027.';
    const candidate = record(quote);
    candidate.text = quote;
    candidate.attribution.chain.unshift({ speaker: 'Bo Winters', role: 'external' });
    const { model, requests } = stub([candidate]);
    const result = await run(model, quote);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.attribution.chain).toEqual(candidate.attribution.chain);
    expect(
      requests[1].candidates[0].attribution_concern.reporters.map((entry: any) => entry.reporter_id),
    ).toEqual(['A1', 'A2']);
    const refused = stub([candidate], (verdict) => {
      verdict.attribution_audit.pop();
    });
    expect((await run(refused.model, quote)).degradedReason).toBe('retain_verification_failed');
  });

  it('binds a reporting witness to its own frame rather than a sibling frame ID', async () => {
    const other = 'Ada Marlow filed the Zephyr QX-100 inspection request.';
    const candidate = record();
    candidate.discourse_frame.push({ quote: other, item_id: 'note-1111' });
    const { model } = stub([candidate], (verdict) => {
      verdict.attribution_audit[0].source.frame_id = 'F2';
    });
    const result = await run(model, source + '\n' + other);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
  });

  it('holds attribution when the independent verifier is unavailable', async () => {
    const { model, chat } = stub();
    chat.mockImplementationOnce(async () => ({
      ok: true,
      value: JSON.stringify({ candidates: [record()] }),
      latencyMs: 11,
    }));
    chat.mockImplementationOnce(
      async () => ({ ok: false, value: null, error: 'Invented verifier outage', latencyMs: 11 }) as any,
    );
    const result = await run(model);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])(
    'reverifies documentary attribution during a prose revision: accepted=%s',
    async (accepted) => {
      let revising = false;
      const { model, requests } = stub(
        [
          {
            ...record(),
            support: [{ quote: source }],
            discourse_frame: [{ quote: source }],
          } as any,
        ],
        (verdict) => {
          if (revising && !accepted) {
            verdict.attribution_audit[0].relation = 'uncertain';
            verdict.attribution_audit[0].source = null;
          }
        },
      );
      const original = await runRetain(source, model);
      expect(original.candidates).toHaveLength(1);
      revising = true;
      const candidate = original.candidates[0]!;
      const revised = candidate.text.replace('records that', 'notes that');
      const result = verifyRetainTextRevision(source, model, original.candidates, [
        { candidate_id: candidate.candidate_id, text: revised },
      ]);
      if (accepted) expect((await result).candidates[0]!.text).toBe(revised);
      else await expect(result).rejects.toThrow('independent verification refused');
      expect(requests[2].candidates[0].attribution_concern.reporters).toHaveLength(1);
    },
  );
});
