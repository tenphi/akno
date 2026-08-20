import { describe, expect, it } from 'vitest';

import { actionable, candidatesFor, missingNumericValues, preservesValues } from './repair.ts';
import type { CrossPageConflict } from './conflicts.ts';

/**
 * The tier that changes files rather than reporting on them. Its guards are the design: every one
 * of these is a way a nightly repair turns into nightly damage.
 */
describe('finding the page a broken link meant', () => {
  const slugs = [
    'travel/2031/2031-04-10-12-blackwater-bay',
    'ada-marlow/residence-permit',
    'ada-marlow/passport',
    'ada-marlow/employment/annual-statement-2025-vulpine-mutual',
    'people/jane-doe',
  ];

  it('follows a page that was reorganised rather than renamed', () => {
    // Every word survives the move; only its position changed. Compare last segments alone and the
    // two look unrelated — which is how a first version declined this and called it unfixable.
    expect(candidatesFor('personal/residence-permit-ada-marlow', slugs)).toEqual([
      'ada-marlow/residence-permit',
    ]);
  });

  it('follows a page that gained a folder', () => {
    expect(candidatesFor('ada-marlow/annual-statement-2025-vulpine-mutual', slugs)).toEqual([
      'ada-marlow/employment/annual-statement-2025-vulpine-mutual',
    ]);
  });

  it('matches a link that kept the name a page was renamed around', () => {
    expect(candidatesFor('Blackwater-Bay', slugs)).toEqual(['travel/2031/2031-04-10-12-blackwater-bay']);
  });

  it('will not hand one person’s document to another', () => {
    // From a dry run on a real base: this matched `ada-marlow/passport` and would have been
    // repointed with full confidence, because `passport` was a substring of it. One word in five.
    expect(candidatesFor('bo-winters/spare-travel-passport', slugs)).toEqual([]);
  });

  it('offers nothing for a target with no page behind it', () => {
    // 14 of this knowledge base's broken targets are pages the owner may yet write. Inventing a
    // destination for those would point a reader at something unrelated.
    expect(candidatesFor('employment/some-agreement-2024', slugs)).toEqual([]);
  });

  it('takes a one-word link only where a page is exactly that word', () => {
    // `[[Boiler]]` → `home/boiler` is the ordinary wikilink shape and worth following. Coverage
    // would let one word match anything containing it, which is how a document finds a stranger.
    expect(candidatesFor('Passport', slugs)).toEqual(['ada-marlow/passport']);
    expect(candidatesFor('Permit', slugs)).toEqual([]);
  });
});

describe('rewriting a claim that was replaced', () => {
  it('refuses a rewrite that changed a number', () => {
    // The guard that matters most. Changing tense is tidying; changing the value is a model
    // deciding what someone's rent is, and no verdict is worth that.
    expect(
      preservesValues('Rent is 1450 EUR per month.', 'Rent was 1450 EUR per month until July 2026.'),
    ).toBe(true);
    expect(
      preservesValues('Rent is 1450 EUR per month.', 'Rent was 1495 EUR per month until July 2026.'),
    ).toBe(false);
  });

  it('keeps every number, not just the first', () => {
    expect(preservesValues('Policy 88-4120 renews 4 Nov 2026.', 'Policy 88-4120 renewed 4 Nov 2026.')).toBe(
      true,
    );
    expect(preservesValues('Policy 88-4120 renews 4 Nov 2026.', 'Policy 88-4120 renewed in 2025.')).toBe(
      false,
    );
  });

  it('reports the exact missing tokens for a guardrail log', () => {
    expect(missingNumericValues('Built in 1640; restored in 2025.', 'Built in 1640.')).toEqual(['2025']);
  });

  it('ignores punctuation and harmless numeric formatting changes', () => {
    expect(preservesValues('Purchased in 1902, for 1,900 EUR.', 'Purchased in 1902 for 1900 EUR.')).toBe(
      true,
    );
    expect(preservesValues('Open 9:00; ages 18–25.', 'Open 09:00; ages 18-25.')).toBe(true);
  });
});

describe('which conflicts are safe to act on', () => {
  const claim = (slug: string, value: string) => ({
    slug,
    line: 3,
    value,
    claim: `Rent is ${value}`,
    confidence: 0.9,
    seen: '2026-01-01',
  });

  const conflict = (over: Partial<CrossPageConflict>): CrossPageConflict => ({
    subject: 'rent',
    attribute: 'amount',
    claims: [claim('household/lease', '1450'), claim('household/budget', '1495')],
    verdict: 'real',
    ...over,
  });

  it('acts only on a conflict a model judged real and could date', () => {
    expect(actionable([conflict({ likelyCurrent: 'household/budget' })])).toHaveLength(1);
  });

  it('leaves an unverified conflict alone', () => {
    // No model ran, so nothing knows which claim is current — and a coin toss here rewrites a fact.
    expect(actionable([conflict({ verdict: 'unverified', likelyCurrent: 'household/budget' })])).toHaveLength(
      0,
    );
  });

  it('leaves a conflict nobody could call', () => {
    expect(actionable([conflict({})])).toHaveLength(0);
    expect(
      actionable([conflict({ verdict: 'not_a_conflict', likelyCurrent: 'household/budget' })]),
    ).toHaveLength(0);
  });
});
