import { describe, expect, it } from 'vitest';
import { rankingEndToEndEvidenceNote } from './bench-cmd.ts';

describe('ranking end-to-end evidence note', () => {
  it('distinguishes development guidance from final held-out evidence', () => {
    expect(rankingEndToEndEvidenceNote('development')).toContain('cannot substitute');
    expect(rankingEndToEndEvidenceNote('test')).toContain('preserve this result');
  });
});
