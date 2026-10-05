import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelClient } from '../models/client.ts';
import { openStore, type Store } from '../store/db.ts';
import {
  assessObservationScope,
  observationScopeCandidateHash,
  type ObservationScopeEvidence,
} from './observation-scope.ts';

type ChatReply = { ok: boolean; value: string | null; error: string | null };

function stubModel(reply: (messages: { role: string; content: string }[]) => ChatReply): ModelClient {
  const model = new ModelClient({
    role: 'derive',
    provider: { name: 'stub', baseUrl: 'http://127.0.0.1:0/v1', apiKey: null, headers: {}, maxRetries: 0 },
    id: 'invented-scope-model',
    enabled: true,
    requested: true,
    timeoutMs: 1_000,
  });
  Object.assign(model, { chat: async (messages: { role: string; content: string }[]) => reply(messages) });
  return model;
}

function verdict(
  outcome: 'supported' | 'narrow' | 'hold',
  overrides: Record<string, unknown> = {},
): ChatReply {
  return {
    ok: true,
    error: null,
    value: JSON.stringify({
      outcome,
      reason_code: outcome === 'supported' ? 'other' : 'unsupported_generalization',
      support_scope: 'recorded_cases',
      candidate_scope: 'recorded_cases',
      supported_case_count: null,
      candidate_case_count: null,
      subject_preserved: true,
      time_scope_preserved: true,
      circumstances_preserved: outcome === 'supported',
      attribution_preserved: true,
      quantifier_supported: outcome === 'supported',
      exceptions_preserved: outcome === 'supported',
      inference_supported: outcome === 'supported',
      narrowed_pattern: null,
      ...overrides,
    }),
  };
}

const evidence: ObservationScopeEvidence[] = [
  {
    id: 'fact_1111',
    slug: 'service/first',
    claim:
      'Ada Marlow selected the lowest-priced option when it was the only available option in March 2026.',
    status: 'selected_support',
  },
  {
    id: 'fact_2222',
    slug: 'service/second',
    claim: 'Ada Marlow selected the lowest-priced option when it was the only available option in June 2026.',
    status: 'selected_support',
  },
  {
    id: 'fact_3333',
    slug: 'service/exception',
    claim: 'Ada Marlow selected the higher-priced option when both options were available in September 2026.',
    status: 'counterevidence',
    statusReason: 'conflict_unresolved',
  },
];

const candidate = {
  pattern: 'Ada Marlow prioritizes price over service quality.',
  evidence: ['fact_1111', 'fact_2222'],
  confidence: 0.9,
};

let directory = '';
let store: Store;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-observation-scope-'));
  store = openStore({ dbPath: path.join(directory, 'index.db'), embeddingDimensions: 8 });
});

afterEach(() => {
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('observation evidence-scope assessment', () => {
  it('does not replace an explicit sample size during narrowing even with stable classifier counts', async () => {
    let calls = 0;
    const result = await assessObservationScope({
      store,
      model: stubModel(() =>
        ++calls === 1
          ? verdict('narrow', {
              supported_case_count: 2,
              candidate_case_count: 6,
              narrowed_pattern: 'In two recorded sessions, preparation preceded its respective activity.',
            })
          : verdict('supported', { supported_case_count: 2, candidate_case_count: 2 }),
      ),
      level: 'reflection',
      subject: 'Preparation',
      candidate,
      evidence,
      contextComplete: true,
    });
    expect(result.candidate).toBeNull();
    expect(result.receipt).toBeNull();
    expect(result.hold?.code).toBe('narrowed_candidate_not_supported');
    expect(calls).toBe(2);
  });
  it('holds when narrowing silently changes the case count of unchanged evidence', async () => {
    let calls = 0;
    const result = await assessObservationScope({
      store,
      model: stubModel(() =>
        ++calls === 1
          ? verdict('narrow', {
              supported_case_count: 6,
              candidate_case_count: null,
              narrowed_pattern: 'In two recorded sessions, preparation preceded its respective activity.',
            })
          : verdict('supported', { supported_case_count: 2, candidate_case_count: 2 }),
      ),
      level: 'reflection',
      subject: 'Preparation',
      candidate,
      evidence,
      contextComplete: true,
    });
    expect(result.candidate).toBeNull();
    expect(result.receipt).toBeNull();
    expect(result.hold?.code).toBe('narrowed_candidate_not_supported');
    expect(calls).toBe(2);
  });
  it.each([6, null])(
    'rejects merging %s supported cases into two sessions despite positive checks',
    async (count) => {
      const result = await assessObservationScope({
        store,
        model: stubModel(() =>
          verdict('supported', {
            supported_case_count: count,
            candidate_case_count: 2,
          }),
        ),
        level: 'reflection',
        subject: 'Preparation',
        candidate,
        evidence,
        contextComplete: true,
      });
      expect(result.candidate).toBeNull();
      expect(result.receipt).toBeNull();
      expect(result.hold?.code).toBe('scope_assessment_invalid');
    },
  );

  it('reassesses an added six-case qualification with the same established evidence count', async () => {
    const narrowed = 'Across six recorded cases, preparation preceded its respective activity.';
    let calls = 0;
    const result = await assessObservationScope({
      store,
      model: stubModel(() =>
        ++calls === 1
          ? verdict('narrow', {
              supported_case_count: 6,
              candidate_case_count: null,
              narrowed_pattern: narrowed,
            })
          : verdict('supported', { supported_case_count: 6, candidate_case_count: 6 }),
      ),
      level: 'reflection',
      subject: 'Preparation',
      candidate,
      evidence,
      contextComplete: true,
    });
    expect(result.candidate?.pattern).toBe(narrowed);
    expect(result.receipt?.narrowed).toBe(true);
    expect(calls).toBe(2);
  });

  it.each(['observation', 'reflection'] as const)(
    'does not accept an ongoing practice from finite cases at %s level despite all-true checks',
    async (level) => {
      const result = await assessObservationScope({
        store,
        model: stubModel(() =>
          verdict('supported', { support_scope: 'recorded_cases', candidate_scope: 'general_rule' }),
        ),
        level,
        subject: 'Preparation',
        candidate: {
          ...candidate,
          pattern: 'Preparation is a recurring pre-operation practice.',
        },
        evidence,
        contextComplete: true,
      });
      expect(result.candidate).toBeNull();
      expect(result.receipt).toBeNull();
      expect(result.hold?.code).toBe('scope_assessment_invalid');
    },
  );

  it('rejects a legacy checklist without the separate sample-scope classifications', async () => {
    const result = await assessObservationScope({
      store,
      model: stubModel(() => verdict('supported', { support_scope: undefined, candidate_scope: undefined })),
      level: 'observation',
      subject: 'Preparation',
      candidate,
      evidence,
      contextComplete: true,
    });
    expect(result.hold?.code).toBe('scope_assessment_invalid');
  });

  it('admits an explicit general rule only with matching explicit-rule support', async () => {
    const pattern = 'Preparation is performed before operation as a standing rule.';
    const result = await assessObservationScope({
      store,
      model: stubModel(() =>
        verdict('supported', {
          support_scope: 'explicit_general_rule',
          candidate_scope: 'general_rule',
          supported_case_count: null,
          candidate_case_count: null,
        }),
      ),
      level: 'observation',
      subject: 'Preparation',
      candidate: { ...candidate, pattern },
      evidence: evidence.slice(0, 2).map((entry) => ({ ...entry, claim: pattern })),
      contextComplete: true,
    });
    expect(result.candidate?.pattern).toBe(pattern);
    expect(result.receipt?.promptVersion).toBe('evidence-scope-v4-consistent-sample');
  });

  it('rechecks the exact sample-bounded narrowing when only sample scope failed', async () => {
    const pattern = 'In the two recorded sessions, preparation preceded operation.';
    const seen: string[] = [];
    const result = await assessObservationScope({
      store,
      model: stubModel((messages) => {
        seen.push(JSON.parse(messages.at(-1)!.content).candidate.pattern);
        return seen.length === 1
          ? verdict('narrow', {
              candidate_scope: 'general_rule',
              supported_case_count: null,
              candidate_case_count: null,
              circumstances_preserved: true,
              quantifier_supported: true,
              exceptions_preserved: true,
              inference_supported: true,
              narrowed_pattern: pattern,
            })
          : verdict('supported');
      }),
      level: 'observation',
      subject: 'Preparation',
      candidate: { ...candidate, pattern: 'Preparation is a recurring pre-operation practice.' },
      evidence,
      contextComplete: true,
    });
    expect(seen).toEqual(['Preparation is a recurring pre-operation practice.', pattern]);
    expect(result.candidate?.pattern).toBe(pattern);
    expect(result.receipt?.narrowed).toBe(true);
  });

  it.each(['support_scope', 'candidate_scope'] as const)(
    'holds an unclear %s without creating a successful receipt',
    async (field) => {
      const result = await assessObservationScope({
        store,
        model: stubModel(() => verdict('supported', { [field]: 'unclear' })),
        level: 'observation',
        subject: 'Preparation',
        candidate,
        evidence,
        contextComplete: true,
      });
      expect(result.hold?.code).toBe('scope_assessment_invalid');
      expect(result.receipt).toBeNull();
    },
  );

  it('seals exact candidate wording independently from the assessment receipt', () => {
    expect(observationScopeCandidateHash(candidate)).not.toBe(
      observationScopeCandidateHash({ ...candidate, pattern: `${candidate.pattern} Always.` }),
    );
  });

  it('holds an unsupported preference even with two independent selected facts', async () => {
    let supplied: { complete_current_evidence?: unknown } = {};
    const result = await assessObservationScope({
      store,
      model: stubModel((messages) => {
        supplied = JSON.parse(messages.at(-1)!.content);
        return verdict('hold', { reason_code: 'unsupported_preference' });
      }),
      level: 'observation',
      subject: 'Ada Marlow',
      candidate,
      evidence,
      contextComplete: true,
    });

    expect(result.candidate).toBeNull();
    expect(result.hold?.code).toBe('unsupported_preference');
    expect(supplied.complete_current_evidence).toEqual(evidence);
  });

  it.each([
    ['unsupported_motive', 'Ada Marlow chose the option because she wanted to impress the service team.'],
    ['unsupported_causation', 'The March selection caused the June service choice.'],
    ['quantifier_scope', 'Ada Marlow always selects the lowest-priced service.'],
  ] as const)('keeps unsupported semantic jumps typed as %s', async (reasonCode, pattern) => {
    const result = await assessObservationScope({
      store,
      model: stubModel(() => verdict('hold', { reason_code: reasonCode })),
      level: 'observation',
      subject: 'Ada Marlow',
      candidate: { ...candidate, pattern },
      evidence,
      contextComplete: true,
    });

    expect(result.candidate).toBeNull();
    expect(result.hold?.code).toBe(reasonCode);
  });

  it('rechecks a narrower exact proposal before admitting it', async () => {
    const proposed =
      'In the two recorded cases with only one available option, Ada Marlow selected the lowest-priced service.';
    const seen: string[] = [];
    const model = stubModel((messages) => {
      const payload = JSON.parse(messages.at(-1)!.content);
      seen.push(payload.candidate.pattern);
      return seen.length === 1 ? verdict('narrow', { narrowed_pattern: proposed }) : verdict('supported');
    });

    const result = await assessObservationScope({
      store,
      model,
      level: 'observation',
      subject: 'Ada Marlow',
      candidate,
      evidence,
      contextComplete: true,
    });

    expect(seen).toEqual([candidate.pattern, proposed]);
    expect(result.candidate?.pattern).toBe(proposed);
    expect(result.receipt).toMatchObject({ narrowed: true, modelId: 'invented-scope-model' });
    expect(result.receipt?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not accept a narrower sentence solely by removing uncertainty wording', async () => {
    let calls = 0;
    const result = await assessObservationScope({
      store,
      model: stubModel(() => {
        calls++;
        return verdict('narrow', {
          narrowed_pattern: 'Ada Marlow likely prioritizes price over service quality.',
        });
      }),
      level: 'observation',
      subject: 'Ada Marlow',
      candidate,
      evidence,
      contextComplete: true,
    });

    expect(calls).toBe(1);
    expect(result.hold?.code).toBe('narrowed_candidate_invalid');
  });

  it('reuses a content-addressed verdict on an unchanged repeated cycle', async () => {
    let calls = 0;
    const model = stubModel(() => {
      calls++;
      return verdict('supported');
    });
    const input = {
      store,
      model,
      level: 'observation' as const,
      subject: 'Ada Marlow',
      candidate: {
        ...candidate,
        pattern:
          'In the two recorded cases with only one available option, Ada Marlow selected the lowest-priced service.',
      },
      evidence,
      contextComplete: true,
    };

    const first = await assessObservationScope(input);
    const repeated = await assessObservationScope(input);

    expect(first.receipt?.fingerprint).toBe(repeated.receipt?.fingerprint);
    expect(calls).toBe(1);
  });

  it('reassesses when current evidence changes', async () => {
    let calls = 0;
    const model = stubModel(() => {
      calls++;
      return verdict('supported');
    });
    const input = {
      store,
      model,
      level: 'observation' as const,
      subject: 'Ada Marlow',
      candidate: {
        ...candidate,
        pattern:
          'In the two recorded cases with only one available option, Ada Marlow selected the lowest-priced service.',
      },
      evidence,
      contextComplete: true,
    };

    await assessObservationScope(input);
    await assessObservationScope({
      ...input,
      evidence: evidence.map((entry) =>
        entry.id === 'fact_3333'
          ? {
              ...entry,
              claim: 'Ada Marlow selected a higher-priced option when both options were available.',
            }
          : entry,
      ),
    });

    expect(calls).toBe(2);
  });

  it('holds without a model call when complete current evidence could not be supplied', async () => {
    let calls = 0;
    const result = await assessObservationScope({
      store,
      model: stubModel(() => {
        calls++;
        return verdict('supported');
      }),
      level: 'observation',
      subject: 'Ada Marlow',
      candidate,
      evidence,
      contextComplete: false,
    });

    expect(calls).toBe(0);
    expect(result.hold?.code).toBe('scope_context_incomplete');
  });

  it('holds an inconsistent assessment instead of treating agreement as support', async () => {
    const result = await assessObservationScope({
      store,
      model: stubModel(() => verdict('supported', { quantifier_supported: false })),
      level: 'observation',
      subject: 'Ada Marlow',
      candidate,
      evidence,
      contextComplete: true,
    });

    expect(result.hold?.code).toBe('scope_assessment_invalid');
  });
});
