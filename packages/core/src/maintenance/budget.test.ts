import { describe, expect, it } from 'vitest';
import { createMaintenanceBudget, maintenanceBudgetReceipt, reserveMaintenanceBudget } from './budget.ts';

describe('whole-run maintenance budgets', () => {
  it('counts distinct files and exact output bytes across indivisible items', () => {
    const budget = createMaintenanceBudget({
      maxItems: 3,
      maxFilesChanged: 2,
      maxBytesWritten: 12,
      maxHighRiskItems: 2,
    });

    expect(
      reserveMaintenanceBudget(budget, {
        risk: 'low',
        operations: [{ type: 'replace', relPath: 'people/ada-marlow.md', after: '12345' }],
      }),
    ).toEqual({ allowed: true });
    expect(
      reserveMaintenanceBudget(budget, {
        risk: 'medium',
        operations: [
          { type: 'replace', relPath: 'people/ada-marlow.md', after: '12' },
          { type: 'create', relPath: 'people/ada-marlow/history.md', after: '345' },
        ],
      }),
    ).toEqual({ allowed: true });

    expect(maintenanceBudgetReceipt(budget)).toEqual({
      limits: { maxItems: 3, maxFilesChanged: 2, maxBytesWritten: 12, maxHighRiskItems: 2 },
      used: { items: 2, filesChanged: 2, bytesWritten: 10, highRiskItems: 0 },
      deferredItems: 0,
    });
  });

  it('defers a whole over-budget item without consuming capacity needed by later work', () => {
    const budget = createMaintenanceBudget({
      maxItems: 3,
      maxFilesChanged: 2,
      maxBytesWritten: 8,
      maxHighRiskItems: 1,
    });

    expect(
      reserveMaintenanceBudget(budget, {
        risk: 'high',
        operations: [{ type: 'replace', relPath: 'products/zephyr-qx-100.md', after: '1234' }],
      }),
    ).toEqual({ allowed: true });
    expect(
      reserveMaintenanceBudget(budget, {
        risk: 'high',
        operations: [
          { type: 'replace', relPath: 'people/bo-winters.md', after: '12345' },
          { type: 'create', relPath: 'people/bo-winters/notes.md', after: '67890' },
        ],
      }),
    ).toMatchObject({
      allowed: false,
      exceeded: expect.arrayContaining([
        expect.objectContaining({ dimension: 'max_bytes_written', limit: 8 }),
        expect.objectContaining({ dimension: 'max_high_risk_items', limit: 1 }),
      ]),
    });
    expect(
      reserveMaintenanceBudget(budget, {
        risk: 'low',
        operations: [{ type: 'delete', relPath: 'archive/invented-duplicate.md' }],
      }),
    ).toEqual({ allowed: true });

    expect(maintenanceBudgetReceipt(budget)).toEqual({
      limits: { maxItems: 3, maxFilesChanged: 2, maxBytesWritten: 8, maxHighRiskItems: 1 },
      used: { items: 2, filesChanged: 2, bytesWritten: 4, highRiskItems: 1 },
      deferredItems: 1,
    });
  });
});
