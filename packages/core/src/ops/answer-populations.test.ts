import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import {
  readAnswerPopulations,
  answerPopulationAuditGrounded,
  answerPopulationAuditSupported,
  type AnswerPopulationReading,
  type AnswerPopulationSource,
  selectAnswerPopulations,
  verifyAnswerPopulations,
} from './answer-populations.ts';

const sources: AnswerPopulationSource[] = [
  {
    record_id: 'E1:S1',
    selected_text: 'Both recorded journeys had preparation completed.',
    leaves: [
      { leaf_id: 'J1', text: 'Journey JRN-1111 preparation completed on 2039-02-11.' },
      { leaf_id: 'J2', text: 'Journey JRN-2222 preparation completed on 2039-02-22.' },
    ],
  },
  {
    record_id: 'E2:S1',
    selected_text: 'Both recorded workshops had preparation completed.',
    leaves: [
      { leaf_id: 'W1', text: 'Workshop WRK-1111 preparation completed on 2039-02-11.' },
      { leaf_id: 'W2', text: 'Workshop WRK-2222 preparation completed on 2039-02-22.' },
    ],
  },
];
const reading: AnswerPopulationReading = {
  populations: sources.map((s) => ({
    record_id: s.record_id,
    scope: 'recorded_cases',
    case_count: 2,
    support_quotes: s.leaves.map((l) => ({ leaf_id: l.leaf_id, quote: l.text })),
  })),
  shared_populations: [],
  disjoint_populations: [],
};
const quotes = sources.map((s) => ({ leaf_id: s.leaves[0]!.leaf_id, quote: s.leaves[0]!.text }));

describe('candidate-free case population reading', () => {
  it('removes exact repeated lineage while preserving separate source identities and distinct derived propositions', () => {
    const parent = {
      ...sources[0]!,
      derived: true,
      leaves: sources[0]!.leaves.map((leaf, i) => ({
        ...leaf,
        source_slug: `sources/journey-${i + 1}`,
        source_line: 3,
      })),
    };
    const child = { record_id: 'E3:S1', selected_text: parent.leaves[0]!.text, leaves: [parent.leaves[0]!] };
    const unrelated = {
      ...child,
      record_id: 'E4:S1',
      leaves: [{ ...child.leaves[0]!, source_slug: 'sources/another' }],
    };
    const repeated = { ...parent, record_id: 'E5:S1' };
    const different = {
      ...parent,
      record_id: 'E6:S1',
      selected_text: 'Tickets were checked in both recorded journeys.',
    };
    expect(
      selectAnswerPopulations([child, parent, unrelated, repeated, different]).map((s) => s.record_id),
    ).toEqual(['E1:S1', 'E4:S1', 'E6:S1']);
  });
  it.each([
    'valid',
    'missing',
    'duplicate',
    'unbound-quote',
    'wrong-record-quote',
    'truncated',
    'contradictory',
    'changed-shared-count',
  ])('binds every population to its exact current support: %s', async (mode) => {
    const payload = structuredClone(reading);
    if (mode === 'missing') payload.populations.pop();
    if (mode === 'duplicate') payload.populations[1] = payload.populations[0]!;
    if (mode === 'unbound-quote') payload.populations[0]!.support_quotes[0]!.quote = 'Absent evidence.';
    if (mode === 'wrong-record-quote') payload.populations[0]!.support_quotes = [quotes[1]!];
    if (mode === 'contradictory') {
      payload.shared_populations = [
        { record_ids: ['E1:S1', 'E2:S1'], case_count: 2, identity_evidence: quotes },
      ];
      payload.disjoint_populations = [
        { record_ids: ['E1:S1', 'E2:S1'], case_count: 4, identity_evidence: quotes },
      ];
    }
    if (mode === 'changed-shared-count')
      payload.shared_populations = [
        { record_ids: ['E1:S1', 'E2:S1'], case_count: 4, identity_evidence: quotes },
      ];
    const chat = vi.fn(async (messages) => {
      const input = JSON.parse(messages.at(-1).content);
      expect(input.records).toEqual(sources);
      expect(input).not.toHaveProperty('question');
      expect(input).not.toHaveProperty('answer_text');
      const value = JSON.stringify(payload);
      return { ok: true, latencyMs: 11, value: mode === 'truncated' ? value.slice(0, -1) : value };
    });
    const result = await readAnswerPopulations({ chat } as unknown as ModelClient, sources);
    expect(result.reading !== null).toBe(mode === 'valid');
    expect(chat).toHaveBeenCalledTimes(1);
  });
  it('bounds work and rejects ambiguous leaf identities before model egress', async () => {
    const chat = vi.fn();
    for (const input of [
      [],
      Array.from({ length: 9 }, (_, i) => ({ ...sources[0]!, record_id: `R${i}` })),
      [sources[0]!, { ...sources[1]!, leaves: sources[0]!.leaves }],
    ]) {
      const result = await readAnswerPopulations({ chat } as unknown as ModelClient, input);
      expect(result.reading).toBeNull();
      expect(result.outcome.reason).toBe('bad_response');
    }
    expect(chat).not.toHaveBeenCalled();
  });
});

describe('fixed population constraints on a verdict', () => {
  const text =
    'Both recorded journeys had preparation completed; both recorded workshops had preparation completed.';
  const comparison = (id: string) => ({
    record_ids: [id],
    quote: id === 'E1:S1' ? text.split(';')[0]! : text.split(';')[1]!.trim(),
    scope: 'recorded_cases',
    relation: 'separate_record',
    case_count: 2,
  });
  it('permits useful per-subject comparisons without claiming shared cases or independence', () => {
    const audit = { comparisons: reading.populations.map((p) => comparison(p.record_id)) };
    expect(answerPopulationAuditGrounded(audit, reading, text)).toBe(true);
    expect(answerPopulationAuditSupported(audit, reading, text)).toBe(true);
  });
  it.each(['shared_cases', 'separate_cases'])(
    'does not relabel cases within one record as %s across records',
    (relation) => {
      const audit = {
        comparisons: reading.populations.map((p) => ({ ...comparison(p.record_id), relation })),
      };
      expect(answerPopulationAuditGrounded(audit, reading, text)).toBe(false);
      expect(answerPopulationAuditSupported(audit, reading, text)).toBe(false);
    },
  );
  it('rejects two readings of the same joint counted clause despite separate-record labels', () => {
    const joint = 'Journey and workshop preparation was completed in both sessions.';
    const audit = {
      comparisons: reading.populations.map((p) => ({ ...comparison(p.record_id), quote: joint })),
    };
    expect(answerPopulationAuditGrounded(audit, reading, joint)).toBe(true);
    expect(answerPopulationAuditSupported(audit, reading, joint)).toBe(false);
    const explicitlyShared = {
      ...reading,
      shared_populations: [{ record_ids: ['E1:S1', 'E2:S1'], case_count: 2, identity_evidence: quotes }],
    };
    expect(answerPopulationAuditSupported(audit, explicitlyShared, joint)).toBe(true);
  });
  it.each(['supported', 'changed', 'missing', 'truncated', 'unavailable'])(
    'a small independent comparison preserves typed support and unavailable outcomes: %s',
    async (mode) => {
      const audit = { comparisons: reading.populations.map((p) => comparison(p.record_id)) };
      if (mode === 'changed') audit.comparisons[0]!.case_count = 1;
      if (mode === 'missing') audit.comparisons.pop();
      const claims = reading.populations.map((p) => ({
        quote: comparison(p.record_id).quote,
        scope: 'recorded_cases',
        case_count: 2,
      }));
      const chat = vi.fn(async (messages, options) => {
        if (messages[0].content.startsWith('Read the case-population claims')) {
          expect(JSON.parse(messages.at(-1).content)).toEqual({ answer_text: text });
          return { ok: true, value: JSON.stringify({ claims }), latencyMs: 11 };
        }
        expect(JSON.parse(messages.at(-1).content)).toEqual({
          fixed_case_populations: reading,
          fixed_candidate_claims: claims,
          answer_text: text,
        });
        expect(options.maxTokens).toBeLessThanOrEqual(1024);
        const value = JSON.stringify(audit);
        return {
          ok: mode !== 'unavailable',
          value: mode === 'unavailable' ? null : mode === 'truncated' ? value.slice(0, -1) : value,
          latencyMs: 11,
        };
      });
      const result = await verifyAnswerPopulations({ chat } as unknown as ModelClient, reading, text);
      expect(result.supported).toBe(mode === 'supported' ? true : null);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.outcome.usage?.totalTokens).toBeNull();
    },
  );
  it.each(['missing', 'unbound', 'truncated', 'unavailable'])(
    'holds invalid candidate-only reading without a comparison: %s',
    async (mode) => {
      const candidate = {
        claims: [
          { quote: mode === 'unbound' ? 'Absent sentence.' : text, scope: 'recorded_cases', case_count: 2 },
        ],
      };
      const value = mode === 'missing' ? '{}' : JSON.stringify(candidate);
      const chat = vi.fn(async (messages) => {
        expect(JSON.parse(messages.at(-1).content)).toEqual({ answer_text: text });
        return {
          ok: mode !== 'unavailable',
          value: mode === 'unavailable' ? null : mode === 'truncated' ? value.slice(0, -1) : value,
          latencyMs: 11,
        };
      });
      const result = await verifyAnswerPopulations({ chat } as unknown as ModelClient, reading, text);
      expect(result.supported).toBeNull();
      expect(chat).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['identical', 'conflicting'])('handles repeated candidate quotation readings: %s', async (mode) => {
    const fixed = { ...reading, populations: reading.populations.slice(0, 1) };
    const clause = 'Both recorded journeys had preparation completed.';
    const claim = { quote: clause, scope: 'recorded_cases', case_count: 2 };
    const chat = vi.fn(async (messages) => {
      if (messages[0].content.startsWith('Read the case-population claims'))
        return {
          ok: true,
          value: JSON.stringify({ claims: [claim, { ...claim, case_count: mode === 'identical' ? 2 : 4 }] }),
          latencyMs: 11,
        };
      const data = JSON.parse(messages.at(-1).content);
      expect(data.fixed_candidate_claims).toEqual([claim]);
      return {
        ok: true,
        value: JSON.stringify({
          comparisons: [{ record_ids: ['E1:S1'], ...claim, relation: 'separate_record' }],
        }),
        latencyMs: 11,
      };
    });
    const result = await verifyAnswerPopulations({ chat } as unknown as ModelClient, fixed, clause);
    expect(result.supported).toBe(mode === 'identical' ? true : null);
    expect(chat).toHaveBeenCalledTimes(mode === 'identical' ? 2 : 1);
  });
  it('allows a longer exact audit quote without revising the independent population count', () => {
    const sentence = 'Both copied records concern the one journey JRN-1111 with preparation completed.';
    const fixed = { ...reading, populations: [{ ...reading.populations[0]!, case_count: 1 }] };
    const claims = [
      {
        quote: 'Both copied records concern the one journey JRN-1111',
        scope: 'recorded_cases' as const,
        case_count: 1,
      },
    ];
    const audit = {
      comparisons: [
        {
          record_ids: ['E1:S1'],
          quote: sentence,
          scope: 'recorded_cases',
          case_count: 1,
          relation: 'separate_record',
        },
      ],
    };
    expect(answerPopulationAuditGrounded(audit, fixed, sentence, claims)).toBe(true);
    expect(answerPopulationAuditSupported(audit, fixed, sentence, claims)).toBe(true);
    audit.comparisons[0]!.case_count = 2;
    expect(answerPopulationAuditGrounded(audit, fixed, sentence, claims)).toBe(false);
  });
  it('cannot rewrite the candidate two-session count as four to match disjoint sources', async () => {
    const joint = 'Journey and workshop preparation was completed in both sessions.';
    const fixed = {
      ...reading,
      disjoint_populations: [{ record_ids: ['E1:S1', 'E2:S1'], case_count: 4, identity_evidence: quotes }],
    };
    const claims = [{ quote: joint, scope: 'recorded_cases', case_count: 2 }];
    const chat = vi.fn(async (messages) => {
      const input = JSON.parse(messages.at(-1).content);
      if (messages[0].content.startsWith('Read the case-population claims')) {
        expect(input).toEqual({ answer_text: joint });
        return { ok: true, value: JSON.stringify({ claims }), latencyMs: 11 };
      }
      expect(input.fixed_candidate_claims).toEqual(claims);
      return {
        ok: true,
        value: JSON.stringify({
          comparisons: [
            {
              record_ids: ['E1:S1', 'E2:S1'],
              quote: joint,
              scope: 'recorded_cases',
              relation: 'separate_cases',
              case_count: 4,
            },
          ],
        }),
        latencyMs: 11,
      };
    });
    const result = await verifyAnswerPopulations({ chat } as unknown as ModelClient, fixed, joint);
    expect(result.supported).toBeNull();
    expect(chat).toHaveBeenCalledTimes(2);
  });
  it.each([
    'shared',
    'invented-total',
    'changed-count',
    'habit',
    'missing',
    'unknown-id',
    'unbound-quote',
    'duplicate-id',
  ])('positive semantic booleans cannot bypass population constraints: %s', (mode) => {
    const audit = { comparisons: reading.populations.map((p) => comparison(p.record_id)) };
    if (mode === 'shared' || mode === 'invented-total')
      audit.comparisons = [
        {
          ...comparison('E1:S1'),
          record_ids: ['E1:S1', 'E2:S1'],
          relation: mode === 'shared' ? 'shared_cases' : 'separate_cases',
          case_count: mode === 'shared' ? 2 : 4,
        },
      ];
    if (mode === 'changed-count') audit.comparisons[0]!.case_count = 1;
    if (mode === 'habit') audit.comparisons[0]!.scope = 'general_rule';
    if (mode === 'missing') audit.comparisons.pop();
    if (mode === 'unknown-id') audit.comparisons[0]!.record_ids = ['E9:S1'];
    if (mode === 'unbound-quote') audit.comparisons[0]!.quote = 'Absent candidate.';
    if (mode === 'duplicate-id') audit.comparisons[0]!.record_ids = ['E1:S1', 'E1:S1'];
    expect(
      answerPopulationAuditGrounded(audit, reading, text) &&
        answerPopulationAuditSupported(audit, reading, text),
    ).toBe(false);
  });
  it.each(['shared', 'distinct'])('preserves an explicitly established %s population', (mode) => {
    const fixed = structuredClone(reading);
    const group = {
      record_ids: ['E1:S1', 'E2:S1'],
      case_count: mode === 'shared' ? 2 : 4,
      identity_evidence: quotes,
    };
    if (mode === 'shared') fixed.shared_populations.push(group);
    else fixed.disjoint_populations.push(group);
    const audit = {
      comparisons: [
        {
          record_ids: group.record_ids,
          quote: text,
          scope: 'recorded_cases',
          relation: mode === 'shared' ? 'shared_cases' : 'separate_cases',
          case_count: group.case_count,
        },
      ],
    };
    expect(answerPopulationAuditGrounded(audit, fixed, text)).toBe(true);
    expect(answerPopulationAuditSupported(audit, fixed, text)).toBe(true);
  });
  it('preserves copies and multiple facts as one case and holds an uncertain count', () => {
    const fixed = structuredClone(reading);
    fixed.populations[0]!.case_count = 1;
    const audit = { comparisons: [comparison('E1:S1'), comparison('E2:S1')] };
    expect(answerPopulationAuditSupported(audit, fixed, text)).toBe(false);
    audit.comparisons[0]!.case_count = 1;
    expect(answerPopulationAuditSupported(audit, fixed, text)).toBe(true);
    fixed.populations[0]!.case_count = null;
    expect(answerPopulationAuditSupported(audit, fixed, text)).toBe(false);
  });
});
