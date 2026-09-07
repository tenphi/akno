import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetainInput } from '@tenphi/akno-protocol';
import { loadConfig } from '../config/load.ts';
import { sha256 } from '../store/ids.ts';
import { LANGUAGE_CORPUS_V2 } from './language-corpus-v2.ts';
import { LANGUAGE_CORPUS_V3 } from './language-corpus-v3.ts';
import { LANGUAGE_CORPUS_V4 } from './language-corpus-v4.ts';
import { LANGUAGE_CORPUS_V5 } from './language-corpus-v5.ts';
import { LANGUAGE_CORPUS_V6 } from './language-corpus-v6.ts';
import { LANGUAGE_CORPUS_V7 } from './language-corpus-v7.ts';
import { LANGUAGE_CORPUS_V8 } from './language-corpus-v8.ts';
import { LANGUAGE_CORPUS } from './language-corpus.ts';
import { runLanguageBench } from './language.ts';

afterEach(() => vi.unstubAllGlobals());

describe('frozen language/discourse evaluation', () => {
  it('freezes the eighth corpus before execution without changing development inputs', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V8))).toBe(
      'e2345553c93d5962321fb752cc8cc18434b9e0023fdf283d2709868a6f18c68a',
    );
    expect(LANGUAGE_CORPUS_V8.filter((entry) => entry.split === 'development')).toEqual(
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
    );
  });

  it('freezes the seventh corpus before execution without changing development inputs', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V7))).toBe(
      'ddfba23c08be6e65f9e7f8fdc5d4af8ce7664ba99328c3353c95b205adb824a2',
    );
    expect(LANGUAGE_CORPUS_V7.filter((entry) => entry.split === 'development')).toEqual(
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
    );
  });

  it('freezes the sixth corpus before execution without changing exposed development inputs', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V6))).toBe(
      '9525a08284faf6ba9c79305ded7b23e19b7323fdbd305a13752c4bc8e1d32975',
    );
    expect(LANGUAGE_CORPUS_V6.filter((entry) => entry.split === 'development')).toEqual(
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
    );
  });

  it('freezes the independently reviewed third corpus before execution', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V3))).toBe(
      '998c1595ef5ea3a6c9072de5e995218ef8a1d9ba837740d213556d8a401a7dba',
    );
  });

  it('keeps the fourth corpus frozen without changing exposed development inputs', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V4))).toBe(
      '3760e270deae388defdc1c4e530454a21c0ed4d5f0ec262677966ffa7fafb6d4',
    );
    expect(LANGUAGE_CORPUS_V4.filter((entry) => entry.split === 'development')).toEqual(
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
    );
  });

  it('freezes the fifth corpus before its independent review and execution', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V5))).toBe(
      'c90df0f553d1e93852fed016bb40f19368e40454e09a00d4a0c81883ea3543b2',
    );
    expect(LANGUAGE_CORPUS_V5.filter((entry) => entry.split === 'development')).toEqual(
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
    );
  });

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

  it('freezes the fresh expectations separately from the exposed corpus', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V2))).toBe(
      '9be572567928a10c4002d811a4f882424aa9d2a4bbea56067768f6383779f5a7',
    );
    expect(LANGUAGE_CORPUS_V2.filter((entry) => entry.admission === 'read-only')).toHaveLength(1);
    expect(LANGUAGE_CORPUS_V2.every((entry) => entry.reviewExpectation.length > 0)).toBe(true);
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
      const report = await runLanguageBench(config, { split: 'development', corpus: 'v1' });
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
      const repeated = await runLanguageBench(config, {
        split: 'development',
        corpus: 'v2',
        runs: 2,
        caseIds: ['v2-dev-belief'],
      });
      expect(repeated.selectedCaseIds).toEqual(['v2-dev-belief']);
      expect(repeated.cases.map((entry) => entry.run)).toEqual([1, 2]);
      expect(repeated.cases.every((entry) => entry.queries.length === 8)).toBe(true);
      const combinations = repeated.cases[0]!.queries.map(
        (query) => `${query.queryLanguage}/${query.requestedAnswerLanguage}/${query.explicitView}`,
      );
      expect(new Set(combinations).size).toBe(8);
      expect(repeated.metrics.producedAnswersOverRetained).toEqual({
        numerator: 0,
        denominator: 0,
        rate: null,
      });
      expect(repeated.metrics.independentlyJustifiedAbstentions.rate).toBeNull();
      expect(repeated.metrics.falseHolds.rate).toBeNull();
      await expect(runLanguageBench(config, { split: 'development', runs: 0 })).rejects.toThrow('runs');
      await expect(runLanguageBench(config, { split: 'development', caseIds: ['missing'] })).rejects.toThrow(
        'unknown case',
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
