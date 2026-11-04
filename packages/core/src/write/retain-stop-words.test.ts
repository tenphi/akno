import { retentionAudit } from '../../test/semantic-audit.ts';
import { describe, expect, it, vi } from 'vitest';
import { runRetain, stopWordMatcher, withoutStopWords, type RetainCandidate } from './retain.ts';
import type { ModelClient } from '../models/client.ts';

const stopped = 'Vulpine Mutual raised the Zephyr QX-100 cover to 1111 EUR.';
const kept = 'Ada Marlow selected a five-year warranty for the Zephyr QX-100.';
const source = `${stopped} ${kept}`;

function candidate(id: string, text: string, extra: Partial<RetainCandidate> = {}): RetainCandidate {
  return {
    candidate_id: id,
    kind: 'claim',
    text,
    subject: 'Zephyr QX-100 warranty',
    attribution: { source_role: 'user' },
    discourse: { commitment: 'asserted', disposition: 'active' },
    epistemic: { basis: 'self_attested' },
    support: [{ quote: text }],
    discourse_frame: [{ quote: text }],
    ...extra,
  } as RetainCandidate;
}

describe('stop word matching', () => {
  it('matches whole words case-insensitively, across spacing and slug separators', () => {
    const matches = stopWordMatcher(['Vulpine Mutual', 'Zephyr QX-100'])!;
    expect(matches('a letter from VULPINE MUTUAL')).toBe(true);
    expect(matches('a letter from Vulpine\n  Mutual')).toBe(true);
    expect(matches('companies/vulpine-mutual')).toBe(true);
    expect(matches('the zephyr qx-100 warranty')).toBe(true);
    expect(matches('the Zephyr QX-1000 warranty')).toBe(false);
    expect(matches('VulpineMutual')).toBe(false);
    expect(matches('Vulpine Mutuality')).toBe(false);
  });

  it('treats a stop word as text, not as a pattern', () => {
    const matches = stopWordMatcher(['Blackwater (Bay)'])!;
    expect(matches('moored at Blackwater (Bay)')).toBe(true);
    expect(matches('moored at Blackwater Bay')).toBe(false);
  });

  it('is off without a stop word', () => {
    expect(stopWordMatcher([])).toBeNull();
    expect(stopWordMatcher(['  '])).toBeNull();
  });
});

describe('stop word candidates', () => {
  it('holds a candidate that names one anywhere it would be kept or attributed', () => {
    const candidates = [
      candidate('in-text', stopped),
      candidate('in-subject', kept, { subject: 'Vulpine Mutual policy' }),
      candidate('in-destination', kept, { destination: { slug: 'companies/vulpine-mutual' } }),
      candidate('from-speaker', kept, {
        attribution: { source_role: 'user', source_speaker: 'Vulpine Mutual' },
      }),
      candidate('clean', kept),
    ];
    const result = withoutStopWords(candidates, ['Vulpine Mutual']);
    expect(result.kept.map((item) => item.candidate_id)).toEqual(['clean']);
    expect(result.held.map((item) => [item.candidate_id, item.reason_code])).toEqual([
      ['in-text', 'stop_word'],
      ['in-subject', 'stop_word'],
      ['in-destination', 'stop_word'],
      ['from-speaker', 'stop_word'],
    ]);
  });

  it('holds what depends on a stopped candidate, transitively', () => {
    const relation = (target: string) => ({
      type: 'corrects' as const,
      target: { candidate_id: target },
      support: [{ quote: kept }],
    });
    const result = withoutStopWords(
      [
        candidate('second', kept, { relations: [relation('first')] }),
        candidate('first', kept, { relations: [relation('root')] }),
        candidate('root', stopped),
        candidate('clean', kept),
      ],
      ['Vulpine Mutual'],
    );
    expect(result.kept.map((item) => item.candidate_id)).toEqual(['clean']);
    expect(result.held.map((item) => item.candidate_id).sort()).toEqual(['first', 'root', 'second']);
  });

  it('ignores a name that appears only in the discourse frame', () => {
    const result = withoutStopWords(
      [candidate('clean', kept, { discourse_frame: [{ quote: source }] })],
      ['Vulpine Mutual'],
    );
    expect(result.held).toEqual([]);
  });

  it('tells the extractor and never sends a stopped candidate to the verifier', async () => {
    const verified: string[] = [];
    const chat = vi.fn(async (messages: { role: string; content: string }[]) => {
      if (chat.mock.calls.length === 1) {
        expect(messages[0]!.content).toContain('["Vulpine Mutual"]');
        return {
          ok: true,
          value: JSON.stringify({
            candidates: [
              { ...candidate('ignored', stopped), candidate_id: undefined },
              { ...candidate('ignored', kept), candidate_id: undefined },
            ],
          }),
          latencyMs: 11,
        };
      }
      const payload = JSON.parse(messages.at(-1)!.content) as {
        candidates: { candidate_id: string; text: string }[];
      };
      verified.push(...payload.candidates.map((item) => item.text));
      return {
        ok: true,
        value: JSON.stringify({
          verdicts: payload.candidates.map((item) => ({
            candidate_id: item.candidate_id,
            source_selected_polarity: 'affirmed',
            ...retentionAudit(item, true, true, true),
            proposition_supported: true,
            action_arguments_preserved: true,
            qualification_scope_preserved: true,
            reason_code: null,
          })),
        }),
        latencyMs: 22,
      };
    });
    const model = {
      available: true,
      chat,
      modelId: 'invented-curator',
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient;

    const result = await runRetain(source, model, { stopWords: ['Vulpine Mutual'] });
    expect(verified).toEqual([kept]);
    expect(result.candidates.map((item) => item.text)).toEqual([kept]);
    expect(result.held).toMatchObject([{ reason_code: 'stop_word', hold_stage: 'validation' }]);
  });
});
