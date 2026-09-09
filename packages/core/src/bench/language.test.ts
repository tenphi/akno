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
import { LANGUAGE_CORPUS_V9 } from './language-corpus-v9.ts';
import { LANGUAGE_CORPUS_V10 } from './language-corpus-v10.ts';
import { LANGUAGE_CORPUS_V11 } from './language-corpus-v11.ts';
import { LANGUAGE_CORPUS_V12 } from './language-corpus-v12.ts';
import { LANGUAGE_CORPUS_V13 } from './language-corpus-v13.ts';
import { LANGUAGE_CORPUS_V14 } from './language-corpus-v14.ts';
import { LANGUAGE_CORPUS_V15 } from './language-corpus-v15.ts';
import { LANGUAGE_CORPUS_V16 } from './language-corpus-v16.ts';
import { LANGUAGE_CORPUS_V17 } from './language-corpus-v17.ts';
import { LANGUAGE_CORPUS_V18 } from './language-corpus-v18.ts';
import { LANGUAGE_CORPUS_V19 } from './language-corpus-v19.ts';
import { LANGUAGE_CORPUS_V20 } from './language-corpus-v20.ts';
import { LANGUAGE_CORPUS } from './language-corpus.ts';
import { runLanguageBench } from './language.ts';

afterEach(() => vi.unstubAllGlobals());

describe('frozen language/discourse evaluation', () => {
  it('freezes twentieth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V20))).toBe(
      '8658f0d00661221cf4e042ffb78f5ed2f3c6b575ab254b81b65ded6e853ea0e9',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V20.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V20.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V19.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V20.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V20.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V19.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes nineteenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V19))).toBe(
      '2b1913d73efee8c14007feb2a4745711e27518a47e20ca5df52bf1cc1f3e8372',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V19.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V19.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V18.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V19.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V19.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V18.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes eighteenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V18))).toBe(
      'bbd6def51d25ea19f7fd273a95174e321b9789914ce288091e56d10e98a64866',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V18.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V18.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V17.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V18.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V18.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V17.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes seventeenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V17))).toBe(
      'd874f8abb19195bc31566e57b8b5e46d2541c2e07440d53833028cad884efb1c',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V17.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V17.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V16.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V17.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V17.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V16.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes sixteenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V16))).toBe(
      '95905fa8b8fb21d2ab5ed48d3261a850fbbad79369bd4c43e155bf3674fd7165',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V16.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V16.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V15.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V16.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V16.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V15.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes fifteenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V15))).toBe(
      '4d03a9fde500f2c415f13add30b5db1d3bc843892bb052b3f207be47f9be1746',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V15.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V15.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V14.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V15.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V15.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V14.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes fourteenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V14))).toBe(
      'ae2faba39cd3a4e6ce869c9d1036c96a19a5cbe7da20f8b098d9a095317e76ac',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V14.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V14.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V13.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V14.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V14.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V13.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes thirteenth-corpus sources and keeps fresh held-out scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V13))).toBe(
      '696d85cd437e434c1f167a812e6ae823d98eaf6cc2d80e8649603d2fafa8f14e',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V13.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V13.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V12.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V13.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V13.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V12.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes twelfth-corpus sources with ten writable cases per split and fresh held-out wording', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V12))).toBe(
      '7923ae2e7e76eb2a5e96580bde58f839edfb4029fc678c4e28f6ad09fa507e72',
    );
    for (const split of ['development', 'held-out']) {
      expect(LANGUAGE_CORPUS_V12.filter((c) => c.split === split && c.admission === 'writable')).toHaveLength(
        10,
      );
      expect(
        LANGUAGE_CORPUS_V12.filter((c) => c.split === split && c.admission === 'read-only'),
      ).toHaveLength(1);
    }
    const exposed = new Set(LANGUAGE_CORPUS_V11.flatMap((c) => c.items.map((i) => i.text)));
    expect(
      LANGUAGE_CORPUS_V12.filter((c) => c.split === 'held-out')
        .flatMap((c) => c.items)
        .some((i) => exposed.has(i.text)),
    ).toBe(false);
    expect(LANGUAGE_CORPUS_V12.filter((c) => c.split === 'held-out').map((c) => c.scenario)).toEqual(
      LANGUAGE_CORPUS_V11.filter((c) => c.split === 'held-out').map((c) => c.scenario),
    );
  });

  it('freezes fresh eleventh-corpus sources with the same broader scenario coverage', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V11))).toBe(
      '0ac6b0f9d4fd50b077f7bd2404c164d5646d00521587c9ac513f6439c7761d2f',
    );
    expect(LANGUAGE_CORPUS_V11.filter((entry) => entry.admission === 'writable')).toHaveLength(20);
    const exposed = new Set(LANGUAGE_CORPUS_V10.flatMap((entry) => entry.items.map((item) => item.text)));
    expect(
      LANGUAGE_CORPUS_V11.filter((entry) => entry.split === 'held-out')
        .flatMap((entry) => entry.items)
        .some((item) => exposed.has(item.text)),
    ).toBe(false);
    expect(
      LANGUAGE_CORPUS_V11.filter((entry) => entry.split === 'held-out').map((entry) => entry.scenario),
    ).toEqual(
      LANGUAGE_CORPUS_V10.filter((entry) => entry.split === 'held-out').map((entry) => entry.scenario),
    );
  });

  it('freezes the broader tenth corpus and separates exposed development from fresh held-out sources', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V10))).toBe(
      '1d88c0fab0bb7c1b5cc474f85c563c874c2d4f7933aa9257aec6e96fd0c1ede9',
    );
    for (const split of ['development', 'held-out']) {
      expect(
        LANGUAGE_CORPUS_V10.filter((entry) => entry.split === split && entry.admission === 'writable'),
      ).toHaveLength(10);
      expect(
        LANGUAGE_CORPUS_V10.filter((entry) => entry.split === split && entry.admission === 'read-only'),
      ).toHaveLength(1);
    }
    expect(
      LANGUAGE_CORPUS_V10.filter((entry) => entry.split === 'held-out' && entry.items.length > 1).length,
    ).toBeGreaterThanOrEqual(5);
    const exposed = new Set(LANGUAGE_CORPUS_V9.flatMap((entry) => entry.items.map((item) => item.text)));
    expect(
      LANGUAGE_CORPUS_V10.filter((entry) => entry.split === 'held-out')
        .flatMap((entry) => entry.items)
        .some((item) => exposed.has(item.text)),
    ).toBe(false);
  });

  it('freezes the ninth corpus before execution without changing development inputs', () => {
    expect(sha256(JSON.stringify(LANGUAGE_CORPUS_V9))).toBe(
      'f33b705195c80a7509f2da683e3d4972f3b754b273f9f27214f1332eca8eb24c',
    );
    expect(LANGUAGE_CORPUS_V9.filter((entry) => entry.split === 'development')).toEqual(
      LANGUAGE_CORPUS_V3.filter((entry) => entry.split === 'development'),
    );
  });

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
            answer: { id: null, max_output_tokens: 777 },
            embedding: { id: null },
            expansion: { id: null },
            reranker: { id: null, enabled: false },
            vision: { id: null, enabled: false },
          },
        },
      });
      const report = await runLanguageBench(config, { split: 'development', corpus: 'v1' });
      expect(report.modelOutputTokenLimits.answer).toBe(777);
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
