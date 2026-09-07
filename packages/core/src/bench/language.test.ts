import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetainInput } from '@tenphi/akno-protocol';
import { loadConfig } from '../config/load.ts';
import { sha256 } from '../store/ids.ts';
import { LANGUAGE_CORPUS } from './language-corpus.ts';
import { runLanguageBench } from './language.ts';

afterEach(() => vi.unstubAllGlobals());

describe('frozen language/discourse evaluation', () => {
  it('freezes both splits and keeps every invented source within the protocol input envelope', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS))).toBe(
      '69752a7525357e462aea76b251f531a33862279b0a87900eeb182bed6d1db458',
    );
    expect(new Set(LANGUAGE_CORPUS.map((entry) => entry.id)).size).toBe(16);
    for (const entry of LANGUAGE_CORPUS) {
      expect(
        RetainInput.safeParse({
          sources: [
            {
              source_id: entry.id,
              revision: 'rev-1111',
              input: { items: entry.items },
              retention: { mode: 'extract' },
            },
          ],
        }).success,
      ).toBe(true);
    }
  });

  it('does not count unavailable models as correct rejections or successful retention', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-language-test-config-'));
    const fetch = vi.fn(() => {
      throw new Error('No model is configured for this deterministic evaluation.');
    });
    vi.stubGlobal('fetch', fetch);
    try {
      const config = loadConfig({
        aknoPath: root,
        stateDir: root,
        isolated: true,
        env: {},
        overrides: {
          providers: {},
          models: {
            derive: { id: null },
            answer: { id: null },
            embedding: { id: null },
            expansion: { id: null },
            reranker: { id: null, enabled: false },
            vision: { id: null, enabled: false },
          },
        },
      });
      const report = await runLanguageBench(config, { split: 'development' });
      expect(report.metrics.availabilityFailures).toEqual({ numerator: 8, denominator: 8, rate: 1 });
      expect(report.metrics.usefulRetentionCoverage).toEqual({ numerator: 0, denominator: 0, rate: null });
      expect(report.metrics.noncanonicalEligibilityFlags).toEqual({
        numerator: 0,
        denominator: 0,
        rate: null,
      });
      expect(report.metrics.unsafeFactualPromotion.rate).toBeNull();
      expect(report.metrics.ordinaryProseQualification).toEqual({ numerator: 8, denominator: 8, rate: 1 });
      expect(report.metrics.acceptedLanguageViolations.rate).toBeNull();
      expect(report.releaseEligible).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
