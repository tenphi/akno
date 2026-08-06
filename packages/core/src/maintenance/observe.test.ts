import { describe, expect, it } from 'vitest';
import { runObserveMission } from './observe.ts';
import { ModelClient } from '../models/client.ts';

/**
 * §13's guardrails, tested where they live. An observations writer is an inference engine,
 * and in a prose knowledge base a bad write is recalled later *as truth* — so every guard
 * here is enforced in code rather than asked for in the prompt, and these tests are what
 * stops a prompt edit from quietly removing one.
 */

/**
 * A chat client whose reply is scripted. The transport is not what these tests are about —
 * the guards run over whatever comes back, and a live model cannot be made to return the
 * hedge or the invented citation each case needs.
 */
function stubChat(reply: unknown): ModelClient {
  const client = new ModelClient({
    role: 'chat',
    provider: { name: 'stub', baseUrl: 'http://127.0.0.1:0/v1', apiKey: null, headers: {} },
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
      chat: stubChat({
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

  it('refuses an observation citing a page it was never shown', async () => {
    // An invented citation is worse than no observation: it looks checkable.
    const result = await runObserveMission({
      ...base,
      chat: stubChat({
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
      chat: stubChat({
        observations: [
          { pattern: 'Appliances are serviced in spring.', evidence: ['home/appliances', 'home/appliances'] },
        ],
      }),
    });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/needs 2/);
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
        chat: stubChat({ observations: [{ pattern, evidence: ['home/appliances', 'home/laundry'] }] }),
      });
      expect(result.observations, pattern).toEqual([]);
      expect(result.rejected[0]?.reason, pattern).toBe('hedged language');
    }
  });

  it('refuses to restate a fact', async () => {
    // §13: never restate the facts. The tier exists for what is true *across* them.
    const result = await runObserveMission({
      ...base,
      chat: stubChat({
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
    const chat = withReply(stubChat({}), () => {
      called = true;
      return { ok: true, value: '{}', error: null };
    });

    const result = await runObserveMission({
      subject: 'one page',
      facts: [{ claim: 'A single claim.', slug: 'home/only' }],
      minEvidence: 2,
      chat,
    });
    expect(called).toBe(false);
    expect(result.observations).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('reports a mission that could not run rather than returning nothing quietly', async () => {
    const chat = withReply(stubChat({}), () => ({ ok: false, value: null, error: 'chat timed out' }));
    const result = await runObserveMission({ ...base, chat });
    expect(result.error).toBe('chat timed out');
  });

  it('appends a mission to the fixed prompt instead of replacing it', async () => {
    // §13: a replaceable prompt is how every guard above gets lost.
    let system = '';
    const chat = withReply(stubChat({}), (messages) => {
      system = messages.find((message) => message.role === 'system')!.content;
      return { ok: true, value: '{"observations":[]}', error: null };
    });

    await runObserveMission({ ...base, chat, mission: 'Focus on maintenance intervals.' });
    expect(system).toContain('Never hedge');
    expect(system).toContain('Focus on maintenance intervals.');
  });
});

describe('the observe mission, on ground §13 puts out of bounds', () => {
  it('refuses an inference about a person’s private life', async () => {
    // The first is the *shape* of what a real run actually wrote with the prompt rule already
    // in place — a relationship inferred from two people's pages — rebuilt from the invented
    // vocabulary in AGENTS.md. The others are the neighbouring categories §13 names.
    for (const pattern of [
      'Bo Winters lives with a wife.',
      'The household is wealthy relative to its neighbours.',
      'One member of the household is religious.',
      'Purchases are impulsive rather than planned.',
    ]) {
      const result = await runObserveMission({
        ...base,
        chat: stubChat({ observations: [{ pattern, evidence: ['home/appliances', 'home/laundry'] }] }),
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
        chat: stubChat({ observations: [{ pattern, evidence: ['home/appliances', 'home/laundry'] }] }),
      });
      expect(result.observations, pattern).toEqual([]);
      expect(result.rejected[0]?.reason, pattern).toMatch(/describes the records/);
    }
  });

  it('still keeps a pattern about a practice', async () => {
    // The guards must not swallow the tier's actual purpose.
    const result = await runObserveMission({
      ...base,
      chat: stubChat({
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
