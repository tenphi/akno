import { describe, expect, it } from 'vitest';
import { ProvidedRetainCandidate } from '@tenphi/akno-protocol';
import { memoryEligibleForView } from '../memory/intent.ts';
import {
  markerFromProvidedCandidate,
  managedMemoryPayloadIssue,
  parseManagedMemoryMarker,
  renderManagedMemoryMarker,
  renderManagedMemoryPayload,
  sameManagedMemorySemantics,
} from './managed-memory.ts';

const candidate = {
  candidate_id: 'candidate-1111',
  kind: 'plan' as const,
  text: 'Ada Marlow plans to service the Zephyr QX-100.',
  subject: 'Zephyr QX-100',
  attribution: { source_role: 'user' as const, source_speaker: 'Ada Marlow' },
  discourse: { commitment: 'none' as const, disposition: 'accepted' as const },
  epistemic: { basis: 'self_attested' as const },
  support: [{ quote: 'I plan to service the Zephyr QX-100.' }],
  discourse_frame: [{ quote: 'I plan to service the Zephyr QX-100.' }],
  destination: { slug: 'equipment/zephyr-qx-100' },
  time: {
    start: '2031-04',
    precision: 'month' as const,
    relation: 'scheduled' as const,
    status: 'planned' as const,
  },
};

describe('managed memory v2 marker', () => {
  it('round-trips rejected plans through protocol and stored markers while excluding planning', () => {
    const rejected = {
      ...candidate,
      time: undefined,
      discourse: { commitment: 'asserted' as const, disposition: 'rejected' as const },
    };
    expect(ProvidedRetainCandidate.safeParse(rejected).success).toBe(true);
    const marker = markerFromProvidedCandidate('mem_1111', rejected, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    expect(parseManagedMemoryMarker(renderManagedMemoryMarker(marker))?.disposition).toBe('rejected');
    const semantics = {
      kind: rejected.kind,
      ...rejected.discourse,
      basis: 'self_attested' as const,
      answerEligible: false,
    };
    expect(memoryEligibleForView(semantics, 'history')).toBe(true);
    expect(memoryEligibleForView(semantics, 'planning')).toBe(false);
    expect(memoryEligibleForView(semantics, 'factual')).toBe(false);
  });

  it('round-trips the one canonical ordered grammar', () => {
    const marker = markerFromProvidedCandidate('mem_1111', candidate, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    const rendered = renderManagedMemoryMarker(marker);
    expect(rendered).toContain('v=2 supports=');
    expect(rendered.indexOf('kind=')).toBeLessThan(rendered.indexOf('commitment='));
    expect(parseManagedMemoryMarker(rendered)).toEqual(marker);
    expect(sameManagedMemorySemantics(marker, parseManagedMemoryMarker(rendered)!)).toBe(true);
    const parsed = parseManagedMemoryMarker(rendered)!;
    expect(
      sameManagedMemorySemantics(
        { ...marker, time: { ...marker.time!, mentioned_at: '2031-04-01T08:00:00Z' } },
        { ...parsed, time: { ...parsed.time!, mentioned_at: '2031-04-02T08:00:00Z' } },
      ),
    ).toBe(true);
    const unknown = {
      precision: 'unknown' as const,
      relation: 'scheduled' as const,
      status: 'tentative' as const,
    };
    expect(
      sameManagedMemorySemantics(
        { ...marker, time: { ...unknown, mentioned_at: '2031-04-01T08:00:00Z' } },
        { ...parsed, time: { ...unknown, mentioned_at: '2031-04-02T08:00:00Z' } },
      ),
    ).toBe(false);
    expect(
      sameManagedMemorySemantics(marker, { ...parsed, time: { ...parsed.time!, start: '2031-05' } }),
    ).toBe(false);
    expect(
      sameManagedMemorySemantics(marker, { ...parsed, time: { ...parsed.time!, status: 'tentative' } }),
    ).toBe(false);
  });

  it('does not parse the legacy grammar', () => {
    expect(
      parseManagedMemoryMarker('<!-- akno:item itm_1111 source=fixture%3Aconversation origin=user -->'),
    ).toBeNull();
  });

  it('rejects a marker whose temporal boundary does not match its precision', () => {
    const marker = markerFromProvidedCandidate('mem_1111', candidate, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    const malformed = renderManagedMemoryMarker(marker).replace('start=2031-04', 'start=2031-99');
    expect(parseManagedMemoryMarker(malformed)).toBeNull();
  });

  it('rejects recurrence that ends before its anchor or lacks instant calendar rules', () => {
    const marker = markerFromProvidedCandidate('mem_1111', candidate, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    expect(() =>
      renderManagedMemoryMarker({
        ...marker,
        time: {
          start: '2031-04-20',
          precision: 'day',
          relation: 'scheduled',
          status: 'planned',
          recurrence: { frequency: 'daily', until: '2031-04-19' },
        },
      }),
    ).toThrow('invalid temporal envelope');
    expect(() =>
      renderManagedMemoryMarker({
        ...marker,
        time: {
          start: '2031-04-20T09:00:00+02:00',
          precision: 'instant',
          relation: 'scheduled',
          status: 'planned',
          recurrence: { frequency: 'daily' },
        },
      }),
    ).toThrow('invalid temporal envelope');
  });

  it('rejects an assistant claim disguised as self-attested memory', () => {
    const marker = markerFromProvidedCandidate('mem_1111', candidate, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    const malformed = renderManagedMemoryMarker(marker).replace('source-role=user', 'source-role=assistant');
    expect(parseManagedMemoryMarker(malformed)).toBeNull();
  });

  it('makes noncanonical status readable without the marker', () => {
    const reported = markerFromProvidedCandidate(
      'mem_2222',
      {
        ...candidate,
        kind: 'claim',
        discourse: { commitment: 'tentative', disposition: 'active' },
        attribution: { source_role: 'external', source_speaker: 'Bo Winters' },
        epistemic: { basis: 'source_report' },
      },
      {
        receipt: 'dddddddddddd',
        candidate: 'eeeeeeeeeeee',
        proofGroup: 'ffffffffffff',
        selection: 'provided',
      },
    );
    expect(renderManagedMemoryPayload('The warranty may last five years.', reported)).toBe(
      '- **Reported by Bo Winters · Tentative · Planned:** The warranty may last five years.',
    );
    expect(managedMemoryPayloadIssue(reported, '- The warranty may last five years.')).toBe(
      'missing visible semantic status',
    );
  });

  it('lets a resolved subject strengthen legacy unresolved memory without merging distinct subjects', () => {
    const unresolved = markerFromProvidedCandidate('mem_1111', candidate, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    const resolved = { ...unresolved, subject: 'ent_aaaa' };

    expect(sameManagedMemorySemantics(unresolved, resolved)).toBe(true);
    expect(sameManagedMemorySemantics(resolved, { ...resolved, subject: 'ent_bbbb' })).toBe(false);
  });
  it('round-trips derived identity annotations without making them a new source assertion', () => {
    const original = markerFromProvidedCandidate('mem_1111', candidate, {
      receipt: 'aaaaaaaaaaaa',
      candidate: 'bbbbbbbbbbbb',
      proofGroup: 'cccccccccccc',
      selection: 'provided',
    });
    const linked = {
      ...original,
      links: [
        {
          type: 'supersedes' as const,
          target: 'memory:mem_2222',
          support: 'dddddddddddd',
          assessment: 'eeeeeeeeeeee',
        },
      ],
    };
    expect(parseManagedMemoryMarker(renderManagedMemoryMarker(linked))).toEqual(linked);
    expect(sameManagedMemorySemantics(original, linked)).toBe(true);
    const authoredRelation = {
      ...linked,
      links: linked.links.map(({ assessment: _assessment, ...link }) => link),
    };
    expect(sameManagedMemorySemantics(original, authoredRelation)).toBe(false);
  });
});
