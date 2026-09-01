import { describe, expect, it } from 'vitest';
import { runObserveMission } from './observe.ts';
import { ModelClient } from '../models/client.ts';

/**
 * The guardrails, tested where they live. An observations writer is an inference engine,
 * and in a prose knowledge base a bad write is recalled later *as truth* — so every guard
 * here is enforced in code rather than asked for in the prompt, and these tests are what
 * stops a prompt edit from quietly removing one.
 */

/**
 * A model client whose reply is scripted. The transport is not what these tests are about —
 * the guards run over whatever comes back, and a live model cannot be made to return the
 * hedge or the invented citation each case needs.
 */
function stubChat(reply: unknown): ModelClient {
  const client = new ModelClient({
    role: 'derive',
    provider: { name: 'stub', baseUrl: 'http://127.0.0.1:0/v1', apiKey: null, headers: {}, maxRetries: 0 },
    id: 'stub',
    enabled: true,
    requested: true,
    timeoutMs: 1000,
  });
  return withReply(client, () => ({ ok: true, value: JSON.stringify(reply), error: null }));
}

type ChatReply = { ok: boolean; value: string | null; error: string | null };

function withReply(
  client: ModelClient,
  reply: (messages: { role: string; content: string }[]) => ChatReply,
): ModelClient {
  Object.assign(client, { chat: async (messages: { role: string; content: string }[]) => reply(messages) });
  return client;
}

const FACTS = [
  { claim: 'The dishwasher was repaired in March 2026.', slug: 'home/appliances' },
  { claim: 'The washing machine was serviced in June 2026.', slug: 'home/laundry' },
  { claim: 'The oven was serviced in September 2026.', slug: 'home/kitchen' },
];

const base = { subject: 'appliance servicing', facts: FACTS, minEvidence: 2 };

describe('the observe mission', () => {
  it('keeps an observation that cites two different pages', async () => {
    const result = await runObserveMission({
      ...base,
      model: stubChat({
        observations: [
          {
            pattern: 'Household appliances are serviced roughly every three months.',
            evidence: ['home/appliances', 'home/laundry'],
            confidence: 0.7,
          },
        ],
      }),
    });
    expect(result.error).toBeNull();
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]!.evidence).toEqual(['home/appliances', 'home/laundry']);
  });

  it('refuses a split that would reuse the superseded stable id', async () => {
    const pattern = 'Household appliances are serviced roughly every three months.';
    const result = await runObserveMission({
      ...base,
      existingRecords: [{ id: 'obs_11111111', pattern }],
      model: stubChat({
        observations: [
          {
            pattern,
            split_pattern: 'Laundry appliances follow a separate service cadence.',
            evidence: ['home/appliances', 'home/laundry'],
            outcome: 'split',
            target_id: 'obs_11111111',
          },
        ],
      }),
    });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0]?.reason).toBe('split requires two new distinct pattern identities');
  });

  it('refuses an observation citing a page it was never shown', async () => {
    // An invented citation is worse than no observation: it looks checkable.
    const result = await runObserveMission({
      ...base,
      model: stubChat({
        observations: [
          {
            pattern: 'Household appliances are serviced roughly every three months.',
            evidence: ['home/appliances', 'people/ada-marlow'],
          },
        ],
      }),
    });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/usable source page/);
  });

  it('refuses an observation resting on one page', async () => {
    const result = await runObserveMission({
      ...base,
      model: stubChat({
        observations: [
          { pattern: 'Appliances are serviced in spring.', evidence: ['home/appliances', 'home/appliances'] },
        ],
      }),
    });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/needs 2/);
  });

  it('refuses lineage that cannot fit in one bounded marker', async () => {
    const facts = Array.from({ length: 13 }, (_, index) => ({
      claim: `Invented service record ${index + 1}.`,
      slug: `service/record-${index + 1}`,
    }));
    const result = await runObserveMission({
      subject: 'service cadence',
      facts,
      minEvidence: 2,
      model: stubChat({
        observations: [
          {
            pattern: 'Equipment servicing follows a stable recurring cadence.',
            evidence: facts.map((fact) => fact.slug),
            outcome: null,
            target_id: null,
            split_pattern: null,
            confidence: 0.9,
          },
        ],
      }),
    });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0]?.reason).toBe('cited more than 12 evidence facts');
  });

  it('refuses hedged language', async () => {
    // A hedge written as prose reads as an assertion three months later.
    for (const pattern of [
      'Appliances might be serviced every three months.',
      'It seems appliances are serviced quarterly.',
      'Appliances are possibly serviced on a schedule.',
    ]) {
      const result = await runObserveMission({
        ...base,
        model: stubChat({ observations: [{ pattern, evidence: ['home/appliances', 'home/laundry'] }] }),
      });
      expect(result.observations, pattern).toEqual([]);
      expect(result.rejected[0]?.reason, pattern).toBe('hedged language');
    }
  });

  it('refuses to restate a fact', async () => {
    // Never restate the facts. The tier exists for what is true *across* them.
    const result = await runObserveMission({
      ...base,
      model: stubChat({
        observations: [
          {
            pattern: 'The dishwasher was repaired in March 2026.',
            evidence: ['home/appliances', 'home/laundry'],
          },
        ],
      }),
    });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/restates a fact/);
  });

  it('does not call the model when there is nothing to observe across', async () => {
    // One page agreeing with itself is not a pattern, and the call would only be rejected.
    let called = false;
    const model = withReply(stubChat({}), () => {
      called = true;
      return { ok: true, value: '{}', error: null };
    });

    const result = await runObserveMission({
      subject: 'one page',
      facts: [{ claim: 'A single claim.', slug: 'home/only' }],
      minEvidence: 2,
      model,
    });
    expect(called).toBe(false);
    expect(result.observations).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('reports a mission that could not run rather than returning nothing quietly', async () => {
    const model = withReply(stubChat({}), () => ({ ok: false, value: null, error: 'chat timed out' }));
    const result = await runObserveMission({ ...base, model });
    expect(result.error).toBe('chat timed out');
  });

  it('appends a mission to the fixed prompt instead of replacing it', async () => {
    // A replaceable prompt is how every guard above gets lost.
    let system = '';
    const model = withReply(stubChat({}), (messages) => {
      system = messages.find((message) => message.role === 'system')!.content;
      return { ok: true, value: '{"observations":[]}', error: null };
    });

    await runObserveMission({ ...base, model, mission: 'Focus on maintenance intervals.' });
    expect(system).toContain('Never hedge');
    expect(system).toContain('Focus on maintenance intervals.');
  });
});

describe('the observe mission, on ground that is out of bounds', () => {
  it('refuses an inference about a person’s private life', async () => {
    // The first is the *shape* of what a real run actually wrote with the prompt rule already
    // in place — a relationship inferred from two people's pages — rebuilt from the invented
    // vocabulary in AGENTS.md. The others are the neighbouring forbidden categories.
    for (const pattern of [
      'Bo Winters lives with a wife.',
      'The household is wealthy relative to its neighbours.',
      'One member of the household is religious.',
      'Purchases are impulsive rather than planned.',
    ]) {
      const result = await runObserveMission({
        ...base,
        model: stubChat({ observations: [{ pattern, evidence: ['home/appliances', 'home/laundry'] }] }),
      });
      expect(result.observations, pattern).toEqual([]);
      expect(result.rejected[0]?.reason, pattern).toMatch(/private life/);
    }
  });

  it('refuses a pattern about the records rather than about what they record', async () => {
    for (const pattern of [
      'Each location is described by a unique street address.',
      'Every entry has a date and an amount.',
      'The pages follow a consistent naming convention.',
    ]) {
      const result = await runObserveMission({
        ...base,
        model: stubChat({ observations: [{ pattern, evidence: ['home/appliances', 'home/laundry'] }] }),
      });
      expect(result.observations, pattern).toEqual([]);
      expect(result.rejected[0]?.reason, pattern).toMatch(/describes the records/);
    }
  });

  it('still keeps a pattern about a practice', async () => {
    // The guards must not swallow the tier's actual purpose.
    const result = await runObserveMission({
      ...base,
      model: stubChat({
        observations: [
          {
            pattern: 'Appliances are serviced before winter rather than after a failure.',
            evidence: ['home/appliances', 'home/kitchen'],
          },
        ],
      }),
    });
    expect(result.observations).toHaveLength(1);
  });
});

describe('one fact wearing a pattern’s clothes', () => {
  // Both of these were written to a real knowledge base. Neither is a pattern across facts: each is
  // a single fact with "the records agree" bolted on the front, and the first copies a personal
  // identifier onto a derived page for no benefit at all.
  it.each([
    'Employment documents consistently record the employee’s date of birth as 3 March 1911.',
    'Employment records consistently identify Vulpine Mutual B.V. as the employer.',
    'Bank statements show the account balance as positive.',
  ])('rejects %s', async (pattern) => {
    const result = await runObserveMission({
      subject: 'employer',
      facts: [
        { claim: 'a', slug: 'one/page' },
        { claim: 'b', slug: 'two/page' },
      ],
      model: stubChat({ observations: [{ pattern, evidence: ['one/page', 'two/page'], confidence: 0.9 }] }),
      minEvidence: 2,
    });
    expect(result.observations).toHaveLength(0);
    expect(result.rejected[0]!.reason).toMatch(/restated|describes the records/);
  });

  it('still allows a real pattern that happens to mention what was done', async () => {
    const result = await runObserveMission({
      subject: 'servicing',
      facts: [
        { claim: 'a', slug: 'one/page' },
        { claim: 'b', slug: 'two/page' },
      ],
      model: stubChat({
        observations: [
          {
            pattern: 'Household appliances are serviced roughly every three months.',
            evidence: ['one/page', 'two/page'],
            confidence: 0.9,
          },
        ],
      }),
      minEvidence: 2,
    });
    expect(result.observations).toHaveLength(1);
  });
});

describe('the same observation twice, in two places', () => {
  const facts = [
    { claim: 'The Bunq account netted 412 EUR in June.', slug: 'banking/2026-06' },
    { claim: 'The Bunq account netted 380 EUR in July.', slug: 'banking/2026-07' },
  ];

  it('rejects a pattern already written on another page', async () => {
    // Grouping is by folder and subject, so two groups reach one conclusion from overlapping facts
    // and each writes it to its own page — where neither looks like a duplicate, because neither
    // page contains the other. A real run put "the Bunq account nets positive across the recorded
    // periods" and "recorded periods end with a positive net result" on two pages.
    const result = await runObserveMission({
      subject: 'net',
      facts,
      model: stubChat({
        observations: [
          {
            pattern: 'Recorded periods consistently end with a positive net result overall.',
            evidence: ['banking/2026-06', 'banking/2026-07'],
            confidence: 0.9,
          },
        ],
      }),
      minEvidence: 2,
      otherObservations: ['Recorded periods consistently end with a positive net result overall.'],
    });
    expect(result.observations).toHaveLength(0);
    expect(result.rejected[0]!.reason).toBe('already recorded in another observation block');
  });

  it('rejects a claim the knowledge base already holds as a fact, from any subject', async () => {
    // `facts` is what this group was built from; a claim recorded under a different subject and
    // handed back as an observation is still something the knowledge base already says, and
    // writing it twice makes one source look like two agreeing.
    const result = await runObserveMission({
      subject: 'net',
      facts,
      model: stubChat({
        observations: [
          {
            pattern: 'The annual banking review runs from January through December.',
            evidence: ['banking/2026-06', 'banking/2026-07'],
            confidence: 0.9,
          },
        ],
      }),
      minEvidence: 2,
      knownFacts: ['The annual banking review runs from January through December.'],
    });
    expect(result.observations).toHaveLength(0);
    expect(result.rejected[0]!.reason).toBe('restates a fact rather than observing across them');
  });

  it('lets through a pattern that is neither', async () => {
    const result = await runObserveMission({
      subject: 'net',
      facts,
      model: stubChat({
        observations: [
          {
            pattern: 'Monthly banking results are settled through a single account rather than several.',
            evidence: ['banking/2026-06', 'banking/2026-07'],
            confidence: 0.9,
          },
        ],
      }),
      minEvidence: 2,
      otherObservations: ['Recorded periods consistently end with a positive net result overall.'],
      knownFacts: ['The annual banking review runs from January through December.'],
    });
    expect(result.observations).toHaveLength(1);
  });
});
