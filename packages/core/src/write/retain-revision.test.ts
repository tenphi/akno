import { retentionAudit } from '../../test/semantic-audit.ts';
import { describe, expect, it, vi } from 'vitest';
import { runRetain } from './retain.ts';
import type { ModelClient, ModelOutcome } from '../models/client.ts';

const source = 'Условия silverpine разрешают перевозку для осмотра клапана; замена клапана не предусмотрена.';
const draft = {
  kind: 'claim',
  text: 'Silverpine terms allow transport of the valve.',
  attribution: { source_role: 'user' },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  support: [{ quote: source }],
  discourse_frame: [{ quote: source }],
};
const revisedText = 'Silverpine terms allow transport for valve inspection, not valve replacement.';

type Candidate = {
  candidate_id: string;
  text: string;
  polarity: string;
  discourse_frame: { quote: string }[];
};
type Reply = ModelOutcome<string> | Record<string, unknown>;

function verdict(candidate: Candidate, supported: boolean, overrides: Record<string, unknown> = {}) {
  return {
    candidate_id: candidate.candidate_id,
    source_selected_polarity: 'affirmed',
    ...retentionAudit(candidate, supported),
    proposition_supported: supported,
    action_arguments_preserved: true,
    qualification_scope_preserved: true,
    reason_code: null,
    ...overrides,
  };
}

const ok = (value: unknown, latencyMs = 10): ModelOutcome<string> => ({
  ok: true,
  value: JSON.stringify(value),
  latencyMs,
});

/** Routes each request by its task prompt; verifier replies are scripted in call order. */
function scripted(options: {
  extraction?: unknown;
  verifier: ((candidate: Candidate, payload: Record<string, unknown>) => Reply)[];
  revision?: (payload: { revision_targets: { candidate_id: string }[] }) => Reply;
}) {
  const kinds: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  let verifications = 0;
  const chat = vi.fn(async (messages: { role: string; content: string }[]) => {
    const system = messages[0]!.content;
    const payload = JSON.parse(messages.at(-1)!.content) as Record<string, unknown>;
    payloads.push(payload);
    const reply = (value: Reply): ModelOutcome<string> =>
      'ok' in value && 'latencyMs' in value ? (value as ModelOutcome<string>) : ok(value);
    if (system.includes('Revision task.')) {
      kinds.push('revision');
      return reply(options.revision!(payload as never));
    }
    if (system.includes('You independently verify proposed retained memories')) {
      kinds.push('verification');
      const respond = options.verifier[verifications++]!;
      const candidates = payload.candidates as Candidate[];
      const answer = respond(candidates[0]!, payload);
      return 'ok' in answer ? (answer as ModelOutcome<string>) : ok({ verdicts: [answer] });
    }
    kinds.push('extraction');
    return ok(options.extraction ?? { candidates: [draft], events: [] });
  });
  const model = {
    available: true,
    chat,
    modelId: 'invented-curator',
    reportInvalidResponse: vi.fn(),
    degradedReason: vi.fn(() => 'derive_failed'),
  } as unknown as ModelClient;
  return { model, kinds, payloads };
}

const reject = (candidate: Candidate) => verdict(candidate, false);
const accept = (candidate: Candidate) => verdict(candidate, true);
// A named reference absent from its own frame cannot be grounded, so the whole verdict is invalid.
const ungrounded = (candidate: Candidate) =>
  verdict(candidate, true, {
    knowledge_context: {
      ...retentionAudit(candidate, true).knowledge_context,
      references: [
        {
          source: { frame_id: 'F1' },
          source_name: 'Bo Winters',
          name_origin: { frame_id: 'F1' },
          resolution: 'explicit',
          source_role: 'actor',
          candidate_role: 'actor',
          relation: 'preserved',
        },
      ],
    },
  });

describe('verification-feedback revision', () => {
  it('rewrites a wording hold once from the same frame and admits it only after re-verification', async () => {
    const { model, kinds, payloads } = scripted({
      verifier: [reject, accept],
      revision: ({ revision_targets }) => ({
        revisions: [
          {
            candidate_id: revision_targets[0]!.candidate_id,
            correction: 'Restore the inspection purpose and the excluded replacement.',
            text: revisedText,
          },
        ],
      }),
    });
    const result = await runRetain(source, model, { verificationRevision: true });
    expect(kinds).toEqual(['extraction', 'verification', 'revision', 'verification']);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.text).toBe(revisedText);
    expect(result.held).toEqual([]);
    const revisionPayload = payloads[2] as {
      revision_targets: { candidate: Record<string, unknown>; verifier_audit: Record<string, unknown> }[];
    };
    // The rewrite sees the verifier's diagnosis and the frame, not a widened evidence set.
    expect(revisionPayload.revision_targets[0]!.verifier_audit.mismatches).toHaveLength(1);
    expect(revisionPayload.revision_targets[0]!.candidate.frame_spans).toEqual([
      { frame_id: 'F1', quote: source },
    ]);
    // Re-verification binds the revision to the original position's proposition.
    const recheck = payloads[3] as {
      repair_obligations: { candidate_id: string; original: { text: string } }[];
    };
    expect(recheck.repair_obligations).toEqual([
      expect.objectContaining({
        candidate_id: result.candidates[0]!.candidate_id,
        original: expect.objectContaining({ text: draft.text }),
      }),
    ]);
    expect(result.feedbackRevision).toEqual({
      attempted: 1,
      candidates: [
        {
          candidate_id: result.candidates[0]!.candidate_id,
          held_as: 'discourse_uncertain',
          outcome: 'accepted',
        },
      ],
    });
    expect(result.modelUsage.revision?.model).toBe('invented-curator');
    expect(result.modelUsage.reverification?.model).toBe('invented-curator');
  });

  it('keeps the first-pass hold when the revised text is still refused', async () => {
    const { model, kinds } = scripted({
      verifier: [reject, reject],
      revision: ({ revision_targets }) => ({
        revisions: [
          { candidate_id: revision_targets[0]!.candidate_id, correction: 'Reword.', text: revisedText },
        ],
      }),
    });
    const result = await runRetain(source, model, { verificationRevision: true });
    expect(kinds).toEqual(['extraction', 'verification', 'revision', 'verification']);
    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([
      expect.objectContaining({ reason_code: 'discourse_uncertain', hold_stage: 'verification' }),
    ]);
    expect(result.feedbackRevision?.candidates[0]).toMatchObject({
      outcome: 'rejected',
      reason_code: 'discourse_uncertain',
    });
  });

  it('keeps the first-pass hold and reports why an invalid re-verification decided nothing', async () => {
    const { model, kinds } = scripted({
      verifier: [reject, ungrounded],
      revision: ({ revision_targets }) => ({
        revisions: [
          { candidate_id: revision_targets[0]!.candidate_id, correction: 'Reword.', text: revisedText },
        ],
      }),
    });
    const result = await runRetain(source, model, { verificationRevision: true });
    expect(kinds).toEqual(['extraction', 'verification', 'revision', 'verification']);
    expect(result.candidates).toEqual([]);
    expect(result.held).toEqual([
      expect.objectContaining({
        reason_code: 'discourse_uncertain',
        verification: { outcome: 'rejected' },
      }),
    ]);
    expect(result.feedbackRevision?.candidates[0]).toMatchObject({
      outcome: 'failed',
      failure_code: 'context_witness_invalid',
    });
  });

  it.each([
    ['declined', { revisions: [] }],
    ['invalid', { revisions: [{ correction: 'Shorten.', text: 'Valve transport allowed.' }] }],
    ['invalid', { revisions: [{ correction: 'Split.', text: `${revisedText}\nSecond line.` }] }],
    ['unchanged', { revisions: [{ correction: 'None.', text: draft.text }] }],
    ['failed', { revisions: [{ candidate_id: 'cand_invented', correction: 'Other.', text: revisedText }] }],
  ])('never re-verifies a %s revision', async (outcome, response) => {
    const { model, kinds } = scripted({
      verifier: [reject],
      revision: ({ revision_targets }) => ({
        revisions: response.revisions.map((entry) => ({
          candidate_id: revision_targets[0]!.candidate_id,
          ...entry,
        })),
      }),
    });
    const result = await runRetain(source, model, { verificationRevision: true });
    expect(kinds).toEqual(['extraction', 'verification', 'revision']);
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(1);
    expect(result.feedbackRevision?.candidates[0]?.outcome).toBe(outcome);
  });

  it.each([
    [
      'a disagreeing source polarity',
      (c: Candidate) =>
        verdict(c, true, {
          ...retentionAudit(c, true, true, true, 'negated'),
          source_selected_polarity: 'negated',
        }),
    ],
    [
      'a task-only admission',
      (c: Candidate) =>
        verdict(c, false, {
          retention: { durability: 'task_only', source_scope: 'task', candidate_scope: 'task' },
        }),
    ],
    ['an accepted record', accept],
    ['an invalid verifier response, which is not a decision about the wording', ungrounded],
  ])('does not rewrite %s', async (_label, first) => {
    const { model, kinds } = scripted({ verifier: [first], revision: () => ({ revisions: [] }) });
    const result = await runRetain(source, model, { verificationRevision: true });
    expect(kinds).toEqual(['extraction', 'verification']);
    expect(result.feedbackRevision).toBeUndefined();
  });

  it('is off unless requested', async () => {
    const { model, kinds } = scripted({ verifier: [reject] });
    const result = await runRetain(source, model);
    expect(kinds).toEqual(['extraction', 'verification']);
    expect(result.held).toHaveLength(1);
  });
});
