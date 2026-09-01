import { describe, expect, it } from 'vitest';
import {
  insertObservationBlock,
  observationBlock,
  observationMarkerIssue,
  observationPayloadIssue,
  parseObservationMarker,
  renderObservationMarker,
  type ObservationMarker,
} from './marker.ts';

const marker: ObservationMarker = {
  id: 'obs_11111111',
  subject: 'ent_11111111',
  disposition: 'active',
  evidence: [
    { factId: 'fac_11111111', sourceLineHash: 'a'.repeat(64), proofGroups: ['page:pag_1111'] },
    { factId: 'fac_22222222', sourceLineHash: 'b'.repeat(64), proofGroups: ['page:pag_2222'] },
  ],
  proofCount: 2,
};

describe('level-two observation markers', () => {
  it('round-trips exact fact lineage and an independently recomputable proof count', () => {
    const rendered = renderObservationMarker(marker);
    expect(rendered).toContain('level=2');
    expect(parseObservationMarker(rendered)).toEqual(marker);
  });

  it('fails closed for correlated, duplicate, or mismatched lineage', () => {
    expect(
      observationMarkerIssue({
        ...marker,
        evidence: marker.evidence.map((entry) => ({ ...entry, proofGroups: ['page:pag_1111'] })),
        proofCount: 1,
      }),
    ).toBe('insufficient independent proof');
    expect(observationMarkerIssue({ ...marker, proofCount: 3 })).toBe('proof-count mismatch');
    expect(observationMarkerIssue({ ...marker, evidence: [marker.evidence[0]!, marker.evidence[0]!] })).toBe(
      'duplicate evidence',
    );
    expect(
      observationPayloadIssue(
        '- **Observation:** Invented pattern. Evidence: [[travel/one]] [[travel/two]] [[travel/three]]',
        ['travel/one', 'travel/two'],
      ),
    ).toBe('visible evidence links do not match lineage');
    expect(
      observationPayloadIssue('- **Observation:**  Evidence: [[travel/one]] [[travel/two]]', [
        'travel/one',
        'travel/two',
      ]),
    ).toBe('invalid visible observation payload');
  });

  it('inserts only owned bytes and preserves authored bytes on either side of the section', () => {
    const before =
      '# Ada Marlow\n\nAuthored introduction.\n\n## Observed patterns\n\nAuthored caveat.\n\n## Notes\n\nAuthored ending.\n';
    const block = observationBlock(marker, 'Ada Marlow consistently selects the quiet route.', [
      'travel/one',
      'travel/two',
    ]);
    const after = insertObservationBlock(before, block);
    expect(after).toContain(block);
    expect(after.replace(`\n${block}\n`, '')).toBe(before);
  });

  it('creates the dedicated section without changing an existing byte', () => {
    const before = '# Zephyr QX-100\n\nAuthored description.\n';
    const after = insertObservationBlock(
      before,
      observationBlock(marker, 'Maintenance recurs at a stable interval.', ['service/one', 'service/two']),
    );
    expect(after.startsWith(before)).toBe(true);
    expect(after).toContain('## Observed patterns');
    expect(after).toContain('**Observation:**');
  });

  it('refuses to choose between duplicate observation sections', () => {
    const before = '# Ada Marlow\n\n## Observed patterns\n\nOne.\n\n## Observed patterns\n\nTwo.\n';
    expect(
      insertObservationBlock(
        before,
        observationBlock(marker, 'Maintenance recurs at a stable interval.', ['service/one', 'service/two']),
      ),
    ).toBeNull();
  });

  it('does not treat frontmatter or fenced examples as observation sections', () => {
    const before =
      '---\nsummary: |\n  ## Observed patterns\n---\n\n# Ada Marlow\n\n```md\n## Observed patterns\n```\n';
    const block = observationBlock(marker, 'Maintenance recurs at a stable interval.', [
      'service/one',
      'service/two',
    ]);
    const after = insertObservationBlock(before, block);
    expect(after?.startsWith(before)).toBe(true);
    expect(after?.slice(before.length)).toContain(`## Observed patterns\n\n${block}`);
  });

  it('creates the observation section before quoted source material', () => {
    const before =
      '# Ada Marlow\n\nAuthored profile.\n\n<!-- source -->\n\n## Source heading\n\nQuoted notes.\n';
    const block = observationBlock(marker, 'Maintenance recurs at a stable interval.', [
      'service/one',
      'service/two',
    ]);
    const after = insertObservationBlock(before, block)!;
    expect(after.indexOf(block)).toBeLessThan(after.indexOf('<!-- source -->'));
    expect(after.replace(`## Observed patterns\n\n${block}\n\n`, '')).toBe(before);
  });
});
