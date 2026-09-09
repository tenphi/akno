import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { retentionNegativeEvidence } from './retention-negative-evidence.ts';
import { cleanCandidateBatch, runRetain, type RetainCandidate } from './retain.ts';
import {
  type ModelClient,
  type ChatOptions,
  toEndpointSchema,
  strictModeViolations,
} from '../models/client.ts';
import { retentionAudit } from '../../test/semantic-audit.ts';

const source = 'Ada Marlow inspected Zephyr QX-100.';
const draft = {
  kind: 'claim',
  text: source,
  subject: 'Zephyr QX-100',
  polarity: 'affirmed',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  support: [{ quote: source }],
  discourse_frame: [{ quote: source }],
  relations: [],
  time: null,
};
const candidate = cleanCandidateBatch([draft], { sourceText: source, generated: true }).candidates[0]!;
const sourceWitness = { frame_id: 'F1', exact_excerpt: 'Ada Marlow' };
const candidateWitness = { kind: 'text', exact_excerpt: 'Ada Marlow' };
const positive = { source_selected_polarity: 'affirmed', polarity_evidence: null, mismatches: [] };
function validate(value: unknown, record = candidate, repaired = false) {
  const audit = retentionNegativeEvidence(record, repaired);
  const parsed = z
    .strictObject({ source_selected_polarity: z.enum(['affirmed', 'negated']), ...audit.fields })
    .safeParse(value);
  return parsed.success && audit.consistent(parsed.data);
}
function mismatch(
  kind = 'changed_value',
  witnessSource: unknown = sourceWitness,
  current: unknown = candidateWitness,
) {
  return {
    ...positive,
    mismatches: [
      {
        dimension: 'proposition_supported',
        kind,
        source: witnessSource,
        candidate: current,
        detail: 'An invented comparison defect.',
      },
    ],
  };
}

describe('candidate-owned negative retention evidence', () => {
  it('keeps the common positive path empty and all exact negative branches valid', () => {
    expect(validate(positive)).toBe(true);
    expect(validate(mismatch('unsupported_content', null))).toBe(true);
    expect(validate(mismatch('omitted_scope', sourceWitness, null))).toBe(true);
    for (const kind of ['changed_value', 'changed_action_or_role', 'changed_qualification'])
      expect(validate(mismatch(kind))).toBe(true);
    expect(validate(mismatch('changed_repair_proposition'))).toBe(false);
    expect(validate(mismatch('changed_repair_proposition'), candidate, true)).toBe(true);
  });
  it('requires present metadata and never treats absent or empty state as added content', () => {
    const bare = { ...candidate, attribution: { source_role: 'user' as const }, time: undefined };
    const audit = retentionNegativeEvidence(bare, false);
    expect(audit.coordinates.metadata.map(({ metadata_id }) => metadata_id)).not.toEqual(
      expect.arrayContaining(['time', 'relations', 'attribution.chain', 'attribution.source_speaker']),
    );
    for (const metadata_id of ['kind', 'polarity', 'discourse.commitment', 'epistemic.basis'])
      expect(validate(mismatch('unsupported_content', null, { kind: 'metadata', metadata_id }), bare)).toBe(
        true,
      );
    for (const metadata_id of [
      'time',
      'relations',
      'attribution.chain',
      'attribution.source_speaker',
      'comparison',
      'page',
      'repair_original',
    ])
      expect(validate(mismatch('unsupported_content', null, { kind: 'metadata', metadata_id }), bare)).toBe(
        false,
      );
  });
  it.each([
    mismatch('unsupported_content'),
    mismatch('omitted_scope'),
    mismatch('changed_value', null),
    mismatch('changed_value', sourceWitness, null),
    mismatch('changed_value', { ...sourceWitness, frame_id: 'F9' }),
    mismatch('changed_value', { ...sourceWitness, exact_excerpt: 'Bo Winters' }),
    mismatch('changed_value', { ...sourceWitness, exact_excerpt: 'Ada\u00a0Marlow' }),
    mismatch('changed_value', sourceWitness, { ...candidateWitness, exact_excerpt: 'Ada  Marlow' }),
    mismatch('unsupported_content', null, { ...candidateWitness, exact_excerpt: '報告' }),
    mismatch('unsupported_content', null, { kind: 'metadata', metadata_id: 'kind', submitted_value: 'plan' }),
    mismatch('changed_value', { ...sourceWitness, exact_excerpt: '' }),
    mismatch('changed_value', { ...sourceWitness, exact_excerpt: ' ' }),
    mismatch('changed_value', { ...sourceWitness, exact_excerpt: '.' }),
    mismatch('changed_value', sourceWitness, { ...candidateWitness, exact_excerpt: '.' }),
    mismatch('changed_value', { ...sourceWitness, exact_excerpt: 'x'.repeat(81) }),
    mismatch('changed_value', sourceWitness, { ...candidateWitness, exact_excerpt: 'x'.repeat(81) }),
    { ...mismatch(), mismatches: [{ ...mismatch().mismatches[0], detail: 'x'.repeat(81) }] },
  ])('rejects invented, foreign, nonexact, wrongly-null and over-cap witnesses: %j', (value) =>
    expect(validate(value)).toBe(false),
  );
  it('does not let repair-original bytes substitute for owned source bytes', () => {
    expect(
      validate(
        mismatch('changed_repair_proposition', { frame_id: 'repair_original', exact_excerpt: source }),
        candidate,
        true,
      ),
    ).toBe(false);
    expect(
      validate(
        mismatch('changed_repair_proposition', sourceWitness, {
          kind: 'repair_original',
          exact_excerpt: source,
        }),
        candidate,
        true,
      ),
    ).toBe(false);
  });
  it('requires an exact governing source witness only for a polarity disagreement', () => {
    const disagreement = {
      ...positive,
      source_selected_polarity: 'negated',
      polarity_evidence: { source: sourceWitness, candidate_metadata_id: 'polarity' },
    };
    expect(validate(disagreement)).toBe(true);
    expect(validate({ ...disagreement, polarity_evidence: null })).toBe(false);
    expect(validate({ ...disagreement, source_selected_polarity: 'affirmed' })).toBe(false);
    expect(
      validate({
        ...disagreement,
        polarity_evidence: {
          source: { ...sourceWitness, exact_excerpt: '.' },
          candidate_metadata_id: 'polarity',
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...disagreement,
        polarity_evidence: {
          source: { ...sourceWitness, exact_excerpt: 'denied' },
          candidate_metadata_id: 'polarity',
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...disagreement,
        polarity_evidence: { source: sourceWitness, candidate_metadata_id: 'kind' },
      }),
    ).toBe(false);
  });
  it('uses strict candidate-specific anyOf branches with fixed budgets', () => {
    const wire = toEndpointSchema(z.strictObject(retentionNegativeEvidence(candidate, true).fields));
    expect(strictModeViolations(wire)).toEqual([]);
    expect(JSON.stringify(wire)).not.toMatch(/"(?:oneOf|const)":/u);
    expect(JSON.stringify(wire)).toContain('"maxItems":3');
    expect(JSON.stringify(wire)).toContain('"maxLength":80');
  });
});

describe('atomic negative witness verification', () => {
  it.each([
    'positive',
    'valid-negative',
    'self-paraphrase',
    'foreign-frame',
    'empty-metadata',
    'unsupported-repair',
    'polarity-without-witness',
    'duplicate-dimension',
    'punctuation-source',
    'punctuation-candidate',
    'punctuation-polarity',
  ])('keeps both candidates tied to immutable source and never retries: %s', async (mode) => {
    const second = {
      ...draft,
      text: source.replace('Ada Marlow', 'Bo Winters'),
      attribution: { source_role: 'user', source_speaker: 'Bo Winters' },
      support: [{ quote: source.replace('Ada Marlow', 'Bo Winters') }],
      discourse_frame: [{ quote: source.replace('Ada Marlow', 'Bo Winters') }],
    };
    const chat = vi.fn(async (messages: { content: string }[], options: ChatOptions) => {
      if (chat.mock.calls.length === 1)
        return { ok: true, value: JSON.stringify({ candidates: [draft, second] }), latencyMs: 11 };
      const payload = JSON.parse(messages.at(-1)!.content);
      expect(options.maxTokens).toBe(3424);
      const verdicts = payload.candidates.map((record: RetainCandidate, index: number) => ({
        candidate_id: record.candidate_id,
        source_selected_polarity: record.polarity,
        ...retentionAudit(record, mode === 'positive' || index === 1 || mode === 'polarity-without-witness'),
        proposition_supported: mode === 'positive' || index === 1 || mode === 'polarity-without-witness',
        action_arguments_preserved: true,
        qualification_scope_preserved: true,
        reason_code: null,
      }));
      const first = verdicts[0];
      if (mode === 'self-paraphrase') {
        first.comparison.candidate_meaning += ' 報告';
        first.mismatches[0].candidate = { kind: 'text', exact_excerpt: '報告' };
      }
      if (mode === 'foreign-frame')
        first.mismatches[0] = mismatch('changed_value', {
          frame_id: 'F1',
          exact_excerpt: 'Bo Winters',
        }).mismatches[0];
      if (mode === 'empty-metadata')
        first.mismatches[0].candidate = { kind: 'metadata', metadata_id: 'relations' };
      if (mode === 'unsupported-repair')
        first.mismatches[0] = mismatch('changed_repair_proposition').mismatches[0];
      if (mode === 'polarity-without-witness') first.source_selected_polarity = 'negated';
      if (mode === 'duplicate-dimension') first.mismatches.push(first.mismatches[0]);
      if (mode === 'punctuation-source')
        first.mismatches[0] = mismatch('changed_value', { frame_id: 'F1', exact_excerpt: '.' }).mismatches[0];
      if (mode === 'punctuation-candidate')
        first.mismatches[0].candidate = { kind: 'text', exact_excerpt: '.' };
      if (mode === 'punctuation-polarity') {
        first.source_selected_polarity = 'negated';
        first.polarity_evidence = {
          source: { frame_id: 'F1', exact_excerpt: '.' },
          candidate_metadata_id: 'polarity',
        };
      }
      return { ok: true, latencyMs: 11, value: JSON.stringify({ verdicts }) };
    });
    const result = await runRetain(source + ' ' + second.text, {
      available: true,
      modelId: 'invented-negative-evidence',
      chat,
      reportInvalidResponse: vi.fn(),
      degradedReason: () => null,
    } as unknown as ModelClient);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.modelUsage.repair).toBeUndefined();
    expect(result.candidates).toHaveLength(mode === 'positive' ? 2 : mode === 'valid-negative' ? 1 : 0);
    expect(result.degradedReason).toBe(
      ['positive', 'valid-negative'].includes(mode) ? null : 'retain_verification_failed',
    );
    if (mode === 'valid-negative') expect(result.held[0]!.hold_stage).toBe('verification');
  });
});
