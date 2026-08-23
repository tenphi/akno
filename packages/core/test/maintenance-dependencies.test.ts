import { describe, expect, it } from 'vitest';
import {
  findMaintenanceDependencyConflicts,
  type MaintenanceItem,
  type MaintenanceOperation,
  type MaintenancePlan,
} from '../src/maintenance/plans.ts';

describe('maintenance plan dependencies', () => {
  it('classifies later writes to the same path separately from sealed-input conflicts', () => {
    const plan = (
      id: string,
      itemId: string,
      operation: MaintenanceOperation,
      evidence: MaintenanceItem['evidence'] = [],
    ): MaintenancePlan => ({
      id,
      createdAt: '2030-01-01T00:00:00.000Z',
      updatedAt: '2030-01-01T00:00:00.000Z',
      mode: 'auto',
      phase: 'observe',
      status: 'ready',
      fingerprint: id,
      summary: 'Invented dependency fixture',
      error: null,
      counts: {
        proposed: 1,
        approved: 0,
        rejected: 0,
        blocked: 0,
        stale: 0,
        applying: 0,
        applied: 0,
        verification_pending: 0,
        verification_failed: 0,
      },
      items: [
        {
          id: itemId,
          planId: id,
          order: 0,
          revision: 1,
          kind: 'observe',
          policy: 'auto',
          risk: 'medium',
          status: 'proposed',
          subject: 'observations/invented-pattern',
          rationale: 'Invented dependency fixture',
          inputHash: id,
          operations: [operation],
          evidence,
          checks: [],
          decision: null,
          statusCode: null,
          statusReason: null,
          changeId: null,
          verification: null,
          updatedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    });
    const shared = 'observations/invented-pattern.md';
    const conflicts = findMaintenanceDependencyConflicts(
      [
        plan('plan_first', 'item_first', {
          type: 'create',
          relPath: shared,
          afterHash: 'first',
          after: 'Invented first page.',
        }),
        plan('plan_second', 'item_second', {
          type: 'replace',
          relPath: shared,
          beforeHash: 'before',
          afterHash: 'second',
          before: 'Invented earlier page.',
          after: 'Invented second page.',
        }),
        plan(
          'plan_third',
          'item_third',
          {
            type: 'create',
            relPath: 'observations/invented-principle.md',
            afterHash: 'third',
            after: 'Invented principle.',
          },
          [
            {
              type: 'page',
              source: 'observations/invented-pattern',
              fingerprint: 'sealed',
              relationship: null,
              details: [],
            },
          ],
        ),
      ],
      new Map([['observations/invented-pattern', shared]]),
    );

    expect(conflicts).toEqual([
      { planId: 'plan_second', itemId: 'item_second', kind: 'write_write' },
      { planId: 'plan_third', itemId: 'item_third', kind: 'sealed_input' },
    ]);

    const proposed = plan('plan_proposed', 'item_proposed', {
      type: 'create',
      relPath: shared,
      afterHash: 'proposed',
      after: 'Invented proposal.',
    });
    const recovery = plan('plan_recovery', 'item_recovery', {
      type: 'replace',
      relPath: shared,
      beforeHash: 'before',
      afterHash: 'recovery',
      before: 'Invented earlier page.',
      after: 'Invented recovered page.',
    });
    recovery.items[0]!.status = 'verification_pending';
    recovery.status = 'partially_completed';
    expect(findMaintenanceDependencyConflicts([proposed, recovery], new Map())).toEqual([
      { planId: 'plan_proposed', itemId: 'item_proposed', kind: 'write_write' },
    ]);

    const sealedRead = plan('plan_read', 'item_read', {
      type: 'replace',
      relPath: shared,
      beforeHash: 'unchanged',
      afterHash: 'unchanged',
      before: 'Invented unchanged page.',
      after: 'Invented unchanged page.',
    });
    expect(findMaintenanceDependencyConflicts([sealedRead, proposed], new Map())).toEqual([]);
  });
});
