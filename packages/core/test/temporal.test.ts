import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../src/kb/frontmatter.ts';
import {
  cleanTemporalProposal,
  inferTemporalMetadata,
  readTemporalDeclaration,
  temporalBoundaryCandidates,
  temporalClock,
  temporalState,
  withTemporalMetadata,
} from '../src/maintenance/temporal.ts';

describe('temporal event metadata', () => {
  it('infers same-month and cross-month ranges from structured event slugs', () => {
    expect(infer('events/2031-04-10-12-blackwater-bay')).toMatchObject({
      start: '2031-04-10',
      until: '2031-04-12',
    });
    expect(infer('events/2031-04-29-02-blackwater-bay')).toMatchObject({
      start: '2031-04-29',
      until: '2031-05-02',
    });
  });

  it('uses an explicit dates field before prose and keeps its timezone', () => {
    expect(
      inferTemporalMetadata({
        slug: 'events/harbor-gathering',
        title: 'Harbor gathering',
        frontmatter: {
          dates: '2031-06-03 to 2031-06-05',
          timezone: 'Europe/Amsterdam',
        },
        body: 'A gathering at Blackwater Bay.',
      }),
    ).toEqual({
      kind: 'event',
      start: '2031-06-03',
      until: '2031-06-05',
      timezone: 'Europe/Amsterdam',
    });
  });

  it('accepts a prose range only when nearby language identifies a bounded event', () => {
    expect(
      inferTemporalMetadata({
        slug: 'events/harbor-supper',
        title: 'Harbor supper',
        frontmatter: {},
        body: 'Restaurants useful for the July 17–19 2031 trip.',
      }),
    ).toMatchObject({ start: '2031-07-17', until: '2031-07-19' });
    expect(
      inferTemporalMetadata({
        slug: 'knowledge/harbor-history',
        title: 'Harbor history',
        frontmatter: {},
        body: 'The harbor wall was reconstructed during July 17–19 2031.',
      }),
    ).toBeNull();
  });

  it('respects an explicit evergreen override', () => {
    const frontmatter = { akno: { temporal: false } };
    expect(readTemporalDeclaration(frontmatter)).toEqual({
      metadata: null,
      disabled: true,
      invalid: false,
    });
    expect(
      inferTemporalMetadata({
        slug: 'events/2031-04-10-12-blackwater-bay',
        title: 'Blackwater Bay',
        frontmatter,
        body: 'A trip.',
      }),
    ).toBeNull();
  });

  it('treats date-only boundaries as inclusive in the event timezone', () => {
    const metadata = {
      kind: 'event' as const,
      until: '2031-04-12',
      timezone: 'Europe/Amsterdam',
    };
    expect(temporalState(metadata, temporalClock(new Date('2031-04-12T21:59:00Z'), 'UTC'))).toBe('active');
    expect(temporalState(metadata, temporalClock(new Date('2031-04-12T22:01:00Z'), 'UTC'))).toBe('past');
  });

  it('adds the Akno-owned block without reformatting existing YAML', () => {
    const before = `---
title: "Harbor gathering"
akno:
  management:
    dream: synthesize
---

# Harbor gathering
`;
    const after = withTemporalMetadata(before, {
      kind: 'event',
      start: '2031-04-10',
      until: '2031-04-12',
    });
    expect(after).toContain(`akno:
  temporal:
    kind: event
    start: "2031-04-10"
    until: "2031-04-12"
  management:`);
    expect(parseFrontmatter(after!).data.title).toBe('Harbor gathering');
  });

  it('allows a model to select only dates already present in the page', () => {
    const input = {
      slug: 'events/harbor-gathering',
      title: 'Harbor gathering',
      frontmatter: {},
      body: 'The event runs from 2031-04-10 through 2031-04-12.',
    };
    const candidates = temporalBoundaryCandidates(input);
    expect(candidates).toEqual(['2031-04-10', '2031-04-12']);
    expect(
      cleanTemporalProposal({ kind: 'event', start: '2031-04-10', until: '2031-04-12' }, candidates).metadata,
    ).not.toBeNull();
    expect(cleanTemporalProposal({ kind: 'event', until: '2031-04-13' }, candidates).issue).toMatch(
      /not supplied/,
    );
  });
});

function infer(slug: string) {
  return inferTemporalMetadata({ slug, title: 'Blackwater Bay event', frontmatter: {}, body: '' });
}
