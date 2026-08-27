import { describe, expect, it } from 'vitest';
import { createMaintenanceBudget, maintenanceBudgetReceipt, reserveMaintenanceBudget } from './budget.ts';
import {
  budgetReceiptMatchesTracker,
  countUnattributedFileChanges,
  modelUsageIsConsistent,
} from './run-verification.ts';

describe('dream run accounting verification', () => {
  it('detects a budget receipt that does not match the reservations', () => {
    const tracker = createMaintenanceBudget({
      maxItems: 3,
      maxFilesChanged: 3,
      maxBytesWritten: 1111,
      maxHighRiskItems: 1,
    });
    reserveMaintenanceBudget(tracker, {
      risk: 'high',
      operations: [{ type: 'create', relPath: 'products/zephyr-qx-100.md', after: 'Invented page.' }],
    });
    const receipt = maintenanceBudgetReceipt(tracker);

    expect(budgetReceiptMatchesTracker(tracker, receipt)).toBe(true);
    expect(
      budgetReceiptMatchesTracker(tracker, {
        ...receipt,
        used: { ...receipt.used, bytesWritten: receipt.used.bytesWritten + 1 },
      }),
    ).toBe(false);
  });

  it('requires stage totals to explain every model call and token receipt', () => {
    const usage = {
      modelId: 'zephyr-model',
      calls: 2,
      successfulCalls: 1,
      failedCalls: 1,
      usageReportedCalls: 2,
      inputTokens: 222,
      outputTokens: 44,
      totalTokens: 266,
      latencyMs: 111,
      stages: [
        {
          stage: 'curate' as const,
          calls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          usageReportedCalls: 1,
          inputTokens: 111,
          outputTokens: 22,
          totalTokens: 133,
          latencyMs: 55,
        },
        {
          stage: 'curator' as const,
          calls: 1,
          successfulCalls: 0,
          failedCalls: 1,
          usageReportedCalls: 1,
          inputTokens: 111,
          outputTokens: 22,
          totalTokens: 133,
          latencyMs: 56,
        },
      ],
    };

    expect(modelUsageIsConsistent(usage)).toBe(true);
    expect(modelUsageIsConsistent({ ...usage, calls: 3 })).toBe(false);
    expect(modelUsageIsConsistent({ ...usage, totalTokens: 267 })).toBe(false);
  });

  it('subtracts sealed writes and counts only unrelated tree changes', () => {
    const baseline = new Map([
      ['people/ada-marlow.md', 'ada-before'],
      ['products/zephyr-qx-100.md', 'zephyr-before'],
      ['manuals/vulpine-mutual.md', 'manual-before'],
      ['references/blackwater-bay.md', 'reference-before'],
    ]);
    const applied = [
      {
        status: 'applied' as const,
        changeId: 'chg_applied',
        operations: [
          {
            type: 'replace' as const,
            relPath: 'people/ada-marlow.md',
            beforeHash: 'ada-before',
            afterHash: 'ada-after',
            before: '# Ada Marlow\n',
            after: '# Ada Marlow\n\nInvented preference.\n',
          },
          {
            type: 'move' as const,
            relPath: 'products/zephyr-qx-100.md',
            toRelPath: 'archive/zephyr-qx-100.md',
            beforeHash: 'zephyr-before',
            documentId: 'doc_zephyr',
            rendersBefore: null,
            rendersAfter: null,
            groupKeyBefore: null,
            groupKeyAfter: null,
          },
        ],
      },
    ];

    const expected = new Map([
      ['people/ada-marlow.md', 'ada-after'],
      ['archive/zephyr-qx-100.md', 'zephyr-before'],
      ['manuals/vulpine-mutual.md', 'manual-before'],
      ['references/blackwater-bay.md', 'reference-before'],
    ]);
    expect(countUnattributedFileChanges(baseline, expected, applied)).toBe(0);

    const withExternalChanges = new Map(expected);
    withExternalChanges.set('manuals/vulpine-mutual.md', 'manual-after');
    withExternalChanges.set('people/bo-winters.md', 'bo-created');
    withExternalChanges.delete('references/blackwater-bay.md');
    expect(countUnattributedFileChanges(baseline, withExternalChanges, applied)).toBe(3);

    const itemOwnedMismatch = new Map(expected);
    itemOwnedMismatch.set('people/ada-marlow.md', 'unknown-after');
    expect(countUnattributedFileChanges(baseline, itemOwnedMismatch, applied)).toBe(0);
  });
});
