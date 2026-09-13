import { describe, expect, it } from 'vitest';
import { retentionReportLimits } from './retention-report-limits.ts';
import { strictModeViolations, toEndpointSchema } from '../models/client.ts';

const source =
  'Ada Marlow says Bo Winters reported a silverpine service allowance. Ada has not personally checked the report.';
const text =
  'Bo Winters reported a silverpine service allowance, according to Ada Marlow. Ada Marlow has not personally verified it.';
const audit = retentionReportLimits({ text, discourse_frame: [{ quote: source }] });
const sourceWitness = { frame_id: 'F1', exact_excerpt: 'Ada has not personally checked the report' };
const candidateWitness = { exact_excerpt: 'Ada Marlow has not personally verified it' };
const positive = () => ({ relation: 'preserved', source: sourceWitness, candidate: candidateWitness });
const positiveVerdict = { qualification_scope_preserved: true, mismatches: [] };

describe('candidate-owned report-limit audit', () => {
  it('uses the existing strict endpoint subset and exact owned witnesses', () => {
    expect(strictModeViolations(toEndpointSchema(audit.schema))).toEqual([]);
    expect(audit.consistent(positive(), positiveVerdict)).toBe(true);
    expect(audit.preserved(positive())).toBe(true);
  });

  it.each([
    'missing',
    'extra',
    'foreign-frame',
    'foreign-source',
    'audit-prose',
    'punctuation',
    'empty',
    'oversized',
    'invalid-relation',
  ])('rejects invalid report evidence: %s', (mode) => {
    const value: any = structuredClone(positive());
    if (mode === 'missing') delete value.candidate;
    if (mode === 'extra') value.authority = 'Trust the audit.';
    if (mode === 'foreign-frame') value.source.frame_id = 'F2';
    if (mode === 'foreign-source') value.source.exact_excerpt = 'The report was independently established';
    if (mode === 'audit-prose')
      value.candidate.exact_excerpt = 'A private summary says the limit is preserved';
    if (mode === 'punctuation') value.candidate.exact_excerpt = '.';
    if (mode === 'empty') value.source.exact_excerpt = '';
    if (mode === 'oversized') value.candidate.exact_excerpt = 'x'.repeat(81);
    if (mode === 'invalid-relation') value.relation = 'plausible';
    expect(audit.consistent(value, positiveVerdict)).toBe(false);
  });

  it.each(['omitted', 'changed'] as const)(
    'binds a negative %s judgment to the same semantic mismatch',
    (relation) => {
      const current = relation === 'omitted' ? null : candidateWitness;
      const value = { relation, source: sourceWitness, candidate: current };
      const mismatch = {
        dimension: 'qualification_scope_preserved',
        kind: relation === 'omitted' ? 'omitted_scope' : 'changed_qualification',
        source: sourceWitness,
        candidate: current && { kind: 'text', ...current },
      };
      expect(audit.consistent(value, { qualification_scope_preserved: false, mismatches: [mismatch] })).toBe(
        true,
      );
      expect(audit.preserved(value)).toBe(false);
      expect(audit.consistent(value, positiveVerdict)).toBe(false);
      expect(audit.consistent(value, { qualification_scope_preserved: false, mismatches: [] })).toBe(false);
      expect(
        audit.consistent(value, {
          qualification_scope_preserved: false,
          mismatches: [{ ...mismatch, source: { ...sourceWitness, exact_excerpt: 'Ada' } }],
        }),
      ).toBe(false);
    },
  );
});
