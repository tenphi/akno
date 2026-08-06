import { describe, expect, it } from 'vitest';
import { routingQuery } from './ingest.ts';

/**
 * §11. Routing scores candidate folders against `route_threshold`, and the query it uses
 * decides whether that threshold means anything.
 *
 * Measured on a 223-page knowledge base: appending 400 characters of the document's own
 * text collapsed the spread across candidate folders from 0.49 to 0.014 — everything at
 * 0.98–0.99, so nothing could fail the threshold and the winner was noise. These
 * assertions exist to make that regression loud rather than subtle.
 */
describe('the routing query', () => {
  const named = {
    title: 'Annual statement Meridian Water Services 2026',
    type: 'statement',
    summary: 'Annual water statement, 214.60 EUR due 12 September 2026.',
  };

  it('asks what the document is', () => {
    const query = routingQuery(named);
    expect(query).toContain(named.title);
    expect(query).toContain(named.type);
    expect(query).toContain(named.summary);
  });

  it('stays short enough for a relevance score to discriminate', () => {
    // Not an arbitrary number: it is roughly a title plus a sentence. The failure being
    // guarded against is a query long enough to resemble everything a little.
    expect(routingQuery(named).length).toBeLessThan(400);
  });

  it('drops the parts a model could not supply rather than emitting empty separators', () => {
    expect(routingQuery({ title: 'A thing', type: null, summary: 'What it is.' })).toBe(
      'A thing. What it is.',
    );
  });
});
