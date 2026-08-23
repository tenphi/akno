import { describe, expect, it } from 'vitest';
import {
  findMaintenanceDependencyConflicts,
  maintenanceItemApplySchedule,
  maintenancePlanStatusAfterApply,
  type MaintenanceItem,
  type MaintenanceOperation,
  type MaintenancePlan,
} from '../src/maintenance/plans.ts';

describe('maintenance plan dependencies', () => {
  it('classifies conflicts, prioritizes recovery, and terminates retryable mixed plans', () => {
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

    const mixed = plan('plan_mixed', 'item_applied', {
      type: 'create',
      relPath: 'observations/applied.md',
      afterHash: 'applied',
      after: 'Invented applied page.',
    });
    mixed.items[0]!.status = 'applied';
    mixed.items.push({
      ...mixed.items[0]!,
      id: 'item_deferred',
      order: 1,
      status: 'blocked',
      statusCode: 'dependency_conflict',
      changeId: null,
      verification: null,
    });
    expect(maintenancePlanStatusAfterApply(mixed)).toBe('failed');
    mixed.items[1]!.statusCode = 'dependency_unmet';
    expect(maintenancePlanStatusAfterApply(mixed)).toBe('failed');
  });

  it('orders a canonical creator before an earlier item that references it', () => {
    const plan = (id: string, itemId: string, relPath: string, after: string): MaintenancePlan => ({
      id,
      createdAt: '2030-01-01T00:00:00.000Z',
      updatedAt: '2030-01-01T00:00:00.000Z',
      mode: 'auto',
      phase: 'curate',
      status: 'ready',
      fingerprint: id,
      summary: 'Invented semantic dependency fixture',
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
          kind: 'synthesis',
          policy: 'auto',
          risk: 'high',
          status: 'proposed',
          subject: relPath.replace(/\.md$/i, ''),
          rationale: 'Invented semantic dependency fixture',
          inputHash: id,
          operations: [{ type: 'create', relPath, afterHash: id, after }],
          evidence: [],
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
    const reference = plan(
      'plan_reference',
      'item_reference',
      'notes/invented-reference.md',
      '---\ntitle: Invented reference\n---\n\nSee [[topics/invented-target]].\n',
    );
    const creator = plan(
      'plan_creator',
      'item_creator',
      'topics/invented-target.md',
      '---\ntitle: Invented target\n---\n\nInvented target body.\n',
    );
    const aboutReference = plan(
      'plan_about',
      'item_about',
      'notes/invented-about.md',
      '---\ntitle: Invented about\nakno:\n  about:\n    - topics/invented-target\n---\n\nInvented related note.\n',
    );

    expect(findMaintenanceDependencyConflicts([reference, aboutReference, creator], new Map())).toEqual([]);
    expect(maintenanceItemApplySchedule([reference, aboutReference, creator], new Map())).toEqual([
      { planId: 'plan_creator', itemId: 'item_creator', dependsOn: [] },
      {
        planId: 'plan_reference',
        itemId: 'item_reference',
        dependsOn: [{ planId: 'plan_creator', itemId: 'item_creator' }],
      },
      {
        planId: 'plan_about',
        itemId: 'item_about',
        dependsOn: [{ planId: 'plan_creator', itemId: 'item_creator' }],
      },
    ]);

    const cycleA = plan(
      'plan_cycle_a',
      'item_cycle_a',
      'topics/invented-a.md',
      '---\ntitle: Invented A\n---\n\nSee [[topics/invented-b]].\n',
    );
    const cycleB = plan(
      'plan_cycle_b',
      'item_cycle_b',
      'topics/invented-b.md',
      '---\ntitle: Invented B\n---\n\nSee [[topics/invented-a]].\n',
    );
    const cycleDependant = plan(
      'plan_cycle_dependant',
      'item_cycle_dependant',
      'topics/invented-cycle-note.md',
      '---\ntitle: Invented cycle note\n---\n\nSee [[topics/invented-a]].\n',
    );
    expect(findMaintenanceDependencyConflicts([cycleA, cycleB, cycleDependant], new Map())).toEqual([
      { planId: 'plan_cycle_a', itemId: 'item_cycle_a', kind: 'semantic_cycle' },
      { planId: 'plan_cycle_b', itemId: 'item_cycle_b', kind: 'semantic_cycle' },
    ]);

    const duplicateIdentity = plan(
      'plan_duplicate',
      'item_duplicate',
      'topics/invented-target.markdown',
      '---\ntitle: Duplicate identity\n---\n\nInvented duplicate body.\n',
    );
    expect(findMaintenanceDependencyConflicts([creator, duplicateIdentity], new Map())).toEqual([
      { planId: 'plan_duplicate', itemId: 'item_duplicate', kind: 'write_write' },
    ]);
  });
});
