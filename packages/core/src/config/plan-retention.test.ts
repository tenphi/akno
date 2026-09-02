import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './load.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('maintenance plan retention configuration', () => {
  it('resolves the documented two-stage defaults', () => {
    const root = inventedDirectory();
    const config = loadConfig({ isolated: true, overrides: { akno_path: root } });

    expect(config.maintenance.planRetention).toEqual({ payloadDays: 30, receiptDays: 180 });
  });

  it('resolves and validates the retained-source evidence grace', () => {
    const root = inventedDirectory();
    expect(
      loadConfig({ isolated: true, overrides: { akno_path: root } }).maintenance.retain.evidenceGraceDays,
    ).toBe(30);
    expect(
      loadConfig({
        isolated: true,
        overrides: { akno_path: root, maintenance: { retain: { evidence_grace_days: 7 } } },
      }).maintenance.retain.evidenceGraceDays,
    ).toBe(7);
    expect(() =>
      loadConfig({
        isolated: true,
        overrides: { akno_path: root, maintenance: { retain: { evidence_grace_days: -1 } } },
      }),
    ).toThrow(/evidence_grace_days/);
  });

  it('requires compact receipts to outlive exact private payloads', () => {
    const root = inventedDirectory();

    expect(() =>
      loadConfig({
        isolated: true,
        overrides: {
          akno_path: root,
          maintenance: { plan_retention: { payload_days: 40, receipt_days: 20 } },
        },
      }),
    ).toThrow(/receipt_days must be greater than or equal to payload_days/);
  });
});

function inventedDirectory(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-plan-retention-'));
  temporary.push(target);
  return target;
}
