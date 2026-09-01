import { describe, expect, it } from 'vitest';
import {
  markerFromProvidedCandidate,
  managedMemoryPayloadIssue,
  parseManagedMemoryMarker,
  renderManagedMemoryMarker,
  renderManagedMemoryPayload,
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
});
