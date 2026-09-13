import { describe, expect, it, vi } from 'vitest';
import { cleanCandidateBatch, runRetain } from './retain.ts';
import type { ModelClient } from '../models/client.ts';
import { frameAuditFields, retentionAudit } from '../../test/semantic-audit.ts';

const source =
  'Bo Winters told Ada Marlow that the Zephyr QX-100 warranty permits a latch inspection. Ada Marlow записывает его сообщение, но лично его не проверяла.';
const initial = {
  kind: 'claim',
  subject: 'Zephyr QX-100',
  text: 'Bo Winters told Ada Marlow that the Zephyr QX-100 warranty permits a latch inspection. Ada Marlow records his message but has not personally verified it.',
  attribution: {
    source_role: 'user',
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' }],
  },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: [{ quote: source }],
  discourse_frame: [{ quote: source }],
  relations: [],
  time: null,
  page: null,
};
const sourceWitness = { frame_id: 'F1', exact_excerpt: 'но лично его не проверяла' };

function modelFor(
  mode: string,
  records: unknown[] = [initial],
  editVerdict?: (candidate: any, verdict: any, index: number) => void,
  repairs: unknown[] = [],
) {
  const requests: any[] = [];
  const invalid = vi.fn();
  const chat = vi.fn(async (messages: { content: string }[]) => {
    const payload = JSON.parse(messages.at(-1)!.content);
    requests.push(payload);
    if (requests.length === 1)
      return { ok: true, value: JSON.stringify({ candidates: records }), latencyMs: 11 };
    if (payload.repair_targets) return { ok: true, value: JSON.stringify({ repairs }), latencyMs: 11 };
    if (mode === 'unavailable')
      return {
        ok: false,
        value: null,
        error: 'Invented verifier outage',
        reason: 'request_failed',
        latencyMs: 11,
      };
    if (mode === 'malformed') return { ok: true, value: '{"verdicts":[', latencyMs: 11 };
    const verdicts = payload.candidates.map((candidate: any, index: number) => {
      const concerned = Boolean(candidate.report_limit_concern);
      const qualification = !(concerned && ['omitted', 'changed', 'qualification-negative'].includes(mode));
      const action = !(concerned && mode === 'action-negative');
      const polarity = concerned && mode === 'polarity-negative' ? 'negated' : candidate.polarity;
      const decision: any = {
        candidate_id: candidate.candidate_id,
        ...frameAuditFields(candidate),
        ...retentionAudit(candidate, true, action, qualification, polarity),
        source_selected_polarity: polarity,
        proposition_supported: true,
        action_arguments_preserved: action,
        qualification_scope_preserved: qualification,
        reason_code: qualification && action ? null : 'discourse_uncertain',
      };
      if (concerned) {
        const candidateWitness = {
          exact_excerpt:
            mode === 'changed'
              ? 'has not personally received confirmation'
              : 'has not personally verified it',
        };
        decision.report_limit_alignment = {
          relation: mode === 'omitted' || mode === 'changed' ? mode : 'preserved',
          source: sourceWitness,
          candidate: mode === 'omitted' ? null : candidateWitness,
        };
        if (mode === 'omitted' || mode === 'changed')
          decision.mismatches = [
            {
              dimension: 'qualification_scope_preserved',
              kind: mode === 'omitted' ? 'omitted_scope' : 'changed_qualification',
              source: sourceWitness,
              candidate: mode === 'omitted' ? null : { kind: 'text', ...candidateWitness },
              detail: 'The personal verification limit is not preserved.',
            },
          ];
        if (mode === 'missing-alignment') delete decision.report_limit_alignment;
        if (mode === 'foreign-source')
          decision.report_limit_alignment.source = {
            frame_id: 'F1',
            exact_excerpt: 'An invented private summary.',
          };
        if (mode === 'foreign-candidate')
          decision.report_limit_alignment.candidate = {
            exact_excerpt: 'A private audit substitutes for the candidate.',
          };
      }
      editVerdict?.(candidate, decision, index);
      return decision;
    });
    if (mode === 'missing-verdict') verdicts.pop();
    if (mode === 'duplicate-verdict') verdicts.push(verdicts[0]);
    return { ok: true, value: JSON.stringify({ verdicts }), latencyMs: 11 };
  });
  return {
    requests,
    chat,
    invalid,
    model: {
      available: true,
      modelId: 'invented-report-verifier',
      chat,
      reportInvalidResponse: invalid,
      degradedReason: () => 'derive_failed',
    } as unknown as ModelClient,
  };
}

describe('report limits are verified without a forced rewrite', () => {
  it('preserves faithful original prose and calls the existing verifier directly', async () => {
    const record = structuredClone(initial);
    const { model, requests, chat } = modelFor('positive', [record]);
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(requests[1].repair_targets).toBeUndefined();
    expect(requests[1].candidates[0].report_limit_concern).toEqual({
      kind: 'readable_report_uncertainty',
      frame_ids: ['F1'],
    });
    expect(requests[1].candidates[0].text).toBe(initial.text);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.text).toBe(initial.text);
    expect(result.modelUsage.repair).toBeUndefined();
    expect(result.modelUsage.verification).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain('report_limit');
    expect(record).toEqual(initial);
  });

  it.each(['omitted', 'changed', 'qualification-negative', 'action-negative', 'polarity-negative'])(
    'keeps semantic rejection final without another repair: %s',
    async (mode) => {
      const record = structuredClone(initial);
      if (mode === 'omitted') record.text = record.text.replace(' but has not personally verified it', '');
      if (mode === 'changed')
        record.text = record.text.replace(
          'has not personally verified it',
          'has not personally received confirmation',
        );
      const { model, chat } = modelFor(mode, [record]);
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.candidates).toEqual([]);
      expect(result.held).toHaveLength(1);
      expect(result.held[0]!.hold_stage).toBe('verification');
      expect(result.error).toBeNull();
    },
  );

  it.each([
    'missing-alignment',
    'foreign-source',
    'foreign-candidate',
    'missing-verdict',
    'duplicate-verdict',
    'malformed',
    'unavailable',
  ])('never publishes from an unavailable or invalid report audit: %s', async (mode) => {
    const { model, chat } = modelFor(mode);
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([]);
    expect(result.degradedReason).toBe('retain_verification_failed');
    expect(result.held[0]!.hold_stage).toBe('verification');
  });

  it.each([false, true])(
    'keeps the public cleaner strict without a mandatory verifier: generated=%s',
    (generated) => {
      const result = cleanCandidateBatch([initial], { sourceText: source, generated });
      expect(result.candidates).toEqual([]);
      expect(result.held[0]!.reason_code).toBe('discourse_uncertain');
    },
  );

  it.each(['oversized', 'stale-frame', 'nonempty-relation', 'missing-speaker'])(
    'does not use the concern to bypass another local requirement: %s',
    async (mode) => {
      const record: any = structuredClone(initial);
      if (mode === 'oversized') record.text += 'x'.repeat(401);
      if (mode === 'stale-frame') record.discourse_frame = [{ quote: 'A stale invented frame.' }];
      if (mode === 'nonempty-relation')
        record.relations = [{ type: 'contradicts', target_candidate: 0, support: [{ quote: source }] }];
      if (mode === 'missing-speaker') record.text = record.text.replaceAll('Ada Marlow', 'the recorder');
      const { model, requests } = modelFor('positive', [record]);
      const result = await runRetain(source, model);
      expect(result.candidates).toEqual([]);
      expect(result.modelUsage.verification).toBeNull();
      expect(requests.every((request) => !request.candidates)).toBe(true);
    },
  );

  it.each([
    {
      source:
        'По словам Bo Winters, Vulpine Mutual разрешает осмотр Zephyr QX-100. Ada Marlow записывает его пересказ, но не видела правила и не проверяла его сообщение.',
      text: 'According to Bo Winters, Vulpine Mutual permits inspecting Zephyr QX-100. Ada Marlow records his report but has not seen the rules or checked his message.',
      sourceLimit: 'не видела правила и не проверяла его сообщение',
      currentLimit: 'has not seen the rules or checked his message',
      assistant: false,
    },
    {
      source:
        'The assistant tentatively suggests that the Zephyr QX-100 agreement permits a latch inspection. The assistant не читал соглашение и не проверял эту догадку.',
      text: 'The assistant tentatively suggests that the Zephyr QX-100 agreement permits a latch inspection. The assistant has not read the agreement or checked this guess.',
      sourceLimit: 'не читал соглашение и не проверял эту догадку',
      currentLimit: 'has not read the agreement or checked this guess',
      assistant: true,
    },
  ])('verifies the original multi-predicate report limit: $currentLimit', async (shape) => {
    const record = {
      ...initial,
      text: shape.text,
      support: [{ quote: shape.source }],
      discourse_frame: [{ quote: shape.source }],
      attribution: shape.assistant
        ? { source_role: 'assistant', source_speaker: 'assistant', chain: [] }
        : initial.attribution,
      discourse: { ...initial.discourse, commitment: shape.assistant ? 'tentative' : 'asserted' },
    };
    const { model, requests, chat } = modelFor('positive', [record], (_, verdict) => {
      verdict.report_limit_alignment = {
        relation: 'preserved',
        source: { frame_id: 'F1', exact_excerpt: shape.sourceLimit },
        candidate: { exact_excerpt: shape.currentLimit },
      };
    });
    const result = await runRetain(shape.source, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.held).toEqual([]);
    expect(requests[1].candidates[0].report_limit_concern).toBeDefined();
    expect(result.candidates[0]!.text).toBe(shape.text);
  });

  it('does not let one positive witness override a second omitted personal limit', async () => {
    const completeSource = source.replace(
      'но лично его не проверяла',
      'но лично его не проверяла и не читала гарантийное соглашение',
    );
    const record = {
      ...initial,
      support: [{ quote: completeSource }],
      discourse_frame: [{ quote: completeSource }],
    };
    const { model, chat } = modelFor('qualification-negative', [record], (_, verdict) => {
      verdict.mismatches = [
        {
          dimension: 'qualification_scope_preserved',
          kind: 'omitted_scope',
          source: { frame_id: 'F1', exact_excerpt: 'не читала гарантийное соглашение' },
          candidate: null,
          detail: 'The verification limit is preserved but the separate reading limit is omitted.',
        },
      ];
    });
    const result = await runRetain(completeSource, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([]);
    expect(result.held[0]!.hold_stage).toBe('verification');
    expect(result.error).toBeNull();
  });

  it('computes a new concern from a genuine structural repair before mandatory verification', async () => {
    const { model, requests, chat } = modelFor('positive', [{ ...initial, text: 'short' }], undefined, [
      { candidate_index: 0, candidate: initial },
    ]);
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(requests[1].repair_targets.map((target: any) => target.candidate_index)).toEqual([0]);
    expect(requests[2].candidates[0].report_limit_concern).toEqual({
      kind: 'readable_report_uncertainty',
      frame_ids: ['F1'],
    });
    expect(requests[2].candidates[0].text).toBe(initial.text);
    expect(result.held).toEqual([]);
    expect(result.candidates[0]!.text).toBe(initial.text);
  });

  it.each(['owned', 'foreign-source', 'foreign-current'])(
    'owns each concern witness within a two-report atomic batch: %s',
    async (mode) => {
      const otherSource =
        'Bo Winters told Ada Marlow that the Zephyr QX-100 agreement permits a hinge inspection. Ada Marlow записывает его сообщение, но не читала соглашение и не проверяла эту версию.';
      const otherText =
        'Bo Winters told Ada Marlow that the Zephyr QX-100 agreement permits a hinge inspection. Ada Marlow records his message but has not read the agreement or checked this version.';
      const records = [
        initial,
        {
          ...initial,
          text: otherText,
          support: [{ quote: otherSource }],
          discourse_frame: [{ quote: otherSource }],
        },
      ];
      const { model, requests, chat } = modelFor('positive', records, (_, verdict, index) => {
        if (index === 1)
          verdict.report_limit_alignment = {
            relation: 'preserved',
            source: {
              frame_id: 'F1',
              exact_excerpt:
                mode === 'foreign-source'
                  ? sourceWitness.exact_excerpt
                  : 'не читала соглашение и не проверяла эту версию',
            },
            candidate: {
              exact_excerpt:
                mode === 'foreign-current'
                  ? 'has not personally verified it'
                  : 'has not read the agreement or checked this version',
            },
          };
      });
      const result = await runRetain(`${source} ${otherSource}`, model);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(requests[1].candidates.map((candidate: any) => candidate.report_limit_concern)).toEqual([
        { kind: 'readable_report_uncertainty', frame_ids: ['F1'] },
        { kind: 'readable_report_uncertainty', frame_ids: ['F1'] },
      ]);
      expect(result.candidates).toHaveLength(mode === 'owned' ? 2 : 0);
      expect(result.degradedReason).toBe(mode === 'owned' ? null : 'retain_verification_failed');
    },
  );

  it('holds a dependent relation when its concerned report receives a semantic rejection', async () => {
    const correction =
      'Ada Marlow confirms that the Zephyr QX-100 warranty prohibits a latch inspection, correcting the earlier report.';
    const omitted = { ...initial, text: initial.text.replace(' but has not personally verified it', '') };
    const dependent = {
      ...initial,
      text: correction,
      attribution: { ...initial.attribution, chain: [] },
      epistemic: { basis: 'self_attested' },
      support: [{ quote: correction }],
      discourse_frame: [{ quote: correction }],
      relations: [{ type: 'corrects', target_candidate: 0, support: [{ quote: correction }] }],
    };
    const { model, requests, chat } = modelFor('omitted', [omitted, dependent]);
    const result = await runRetain(`${source} ${correction}`, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(requests[1].candidates).toHaveLength(2);
    expect(requests[1].candidates[1].report_limit_concern).toBeUndefined();
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(2);
    expect(result.held.every((held) => held.hold_stage === 'verification')).toBe(true);
    expect(result.error).toBeNull();
  });
});
