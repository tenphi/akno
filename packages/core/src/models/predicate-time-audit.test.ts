import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from './client.ts';
import {
  boundPredicateTimeAuditGrounded,
  boundPredicateTimeAuditSupported,
  readPredicateTimes,
} from './predicate-time-audit.ts';

const source = 'Journey JRN-3333 is booked for 2037-04-11. Its single 1111 EUR payment is completed.';
const journey = {
  excerpt: 'Journey JRN-3333 is booked for 2037-04-11.',
  predicate: 'Booked journey',
  timing: '2037-04-11',
  status: 'scheduled',
  time_relation: 'scheduled' as const,
};
const payment = {
  excerpt: 'Its single 1111 EUR payment is completed.',
  predicate: 'Completed payment',
  timing: null,
  status: 'completed',
  time_relation: 'occurred' as const,
};
const bindings = [
  { id: 'E1_P1', source: journey },
  { id: 'E1_P2', source: payment },
];

describe('independent temporal source reading', () => {
  it.each(['complete', 'missing', 'duplicate-source', 'unbound-quote', 'unbound-time', 'incomplete'])(
    'never turns an unavailable or ungrounded source reading into permission: %s',
    async (mode) => {
      const predicates =
        mode === 'unbound-quote'
          ? [{ ...journey, excerpt: 'An absent predicate.' }]
          : mode === 'unbound-time'
            ? [{ ...payment, timing: '2037-04-11' }]
            : [journey, payment];
      const readings = [{ source_id: 'E1', predicates, complete: mode !== 'incomplete' }];
      const chat = vi.fn(async (messages, options) => {
        const payload = JSON.parse(messages.at(-1).content);
        expect(payload).toEqual({ sources: [{ source_id: 'E1', text: source, selected_record: source }] });
        expect(payload).not.toHaveProperty('question');
        expect(payload).not.toHaveProperty('blocks');
        expect(options.schema).toBeDefined();
        expect(options.outputLanguage).toBeNull();
        return {
          ok: true,
          latencyMs: 11,
          value: JSON.stringify({
            readings:
              mode === 'missing' ? [] : mode === 'duplicate-source' ? [...readings, ...readings] : readings,
          }),
        };
      });
      const result = await readPredicateTimes({ chat } as unknown as ModelClient, [
        { id: 'E1', text: source, selection: source },
      ]);
      expect(result.bindings).toEqual(mode === 'complete' ? bindings : null);
      expect(chat).toHaveBeenCalledTimes(1);
    },
  );
});

describe('immutable source predicate bindings', () => {
  it.each([
    'faithful',
    'added-payment-date',
    'wrong-predicate',
    'missing-predicate',
    'unknown-id',
    'unbound-candidate',
    'duplicate-id',
    'incomplete',
  ])('requires the correct operation, date presence and complete selected coverage: %s', (mode) => {
    const comparisons = [
      { source_predicate_id: 'E1_P1', candidate: journey, relation: 'preserved' },
      {
        source_predicate_id: 'E1_P2',
        candidate:
          mode === 'added-payment-date' || mode === 'wrong-predicate'
            ? { ...payment, excerpt: 'Payment completed on 2037-04-11.', timing: '2037-04-11' }
            : payment,
        relation: 'preserved',
      },
    ];
    if (mode === 'wrong-predicate') comparisons.splice(0, 1);
    if (mode === 'wrong-predicate') comparisons[0]!.source_predicate_id = 'E1_P1';
    if (mode === 'missing-predicate') comparisons.splice(0, 1);
    if (mode === 'unknown-id') comparisons[1]!.source_predicate_id = 'E1_P99';
    if (mode === 'duplicate-id') comparisons[1]!.source_predicate_id = 'E1_P1';
    if (mode === 'unbound-candidate')
      comparisons[1]!.candidate = { ...payment, excerpt: 'Absent candidate.' };
    const audit = { comparisons, complete: mode !== 'incomplete' };
    const text = source + ' Payment completed on 2037-04-11.';
    const grounded = boundPredicateTimeAuditGrounded(audit, bindings, text);
    const supported = boundPredicateTimeAuditSupported(audit, bindings, true);
    expect(grounded && supported).toBe(mode === 'faithful');
    if (mode === 'missing-predicate')
      expect(boundPredicateTimeAuditSupported(audit, bindings, false)).toBe(true);
  });
});
