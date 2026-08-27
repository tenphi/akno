import { describe, expect, it } from 'vitest';
import { compileRules, declaringRule, effectiveRule, matchRules, matchesGlob } from './compile.ts';

describe('globToRegExp', () => {
  it('matches a folder and its descendants under **', () => {
    expect(matchesGlob('documents/car-insurance', 'documents/**')).toBe(true);
    expect(matchesGlob('documents/tax/2026/return', 'documents/**')).toBe(true);
    // A rule on a folder's contents covers the folder's own index page.
    expect(matchesGlob('documents', 'documents/**')).toBe(true);
    expect(matchesGlob('documentsx/thing', 'documents/**')).toBe(false);
  });

  it('keeps a single * inside one segment', () => {
    expect(matchesGlob('people/ada', 'people/*')).toBe(true);
    expect(matchesGlob('people/nested/ada', 'people/*')).toBe(false);
  });

  it('matches everything under a bare **', () => {
    expect(matchesGlob('anything/at/all', '**')).toBe(true);
    expect(matchesGlob('top', '**')).toBe(true);
  });

  it('does not treat a dot as a wildcard', () => {
    expect(matchesGlob('axmd', 'a.md')).toBe(false);
  });
});

describe('compileRules', () => {
  const rules = compileRules([
    {
      source: 'config',
      folders: {
        '**': { rank: 1 },
        'documents/**': { role: 'source' },
        'documents/tax/**': { role: 'knowledge', type: 'tax' },
        'conversations/**': { role: 'source', rank: 0.5 },
      },
    },
  ]);

  it('orders most-specific-first regardless of declaration order', () => {
    expect(rules[0]!.glob).toBe('documents/tax/**');
    expect(rules.at(-1)!.glob).toBe('**');
  });

  it('picks the most specific match', () => {
    expect(matchRules('documents/tax/2026', rules).rule?.glob).toBe('documents/tax/**');
    expect(matchRules('documents/passport', rules).rule?.glob).toBe('documents/**');
  });

  it('composes fields across specificity instead of erasing them', () => {
    // `rank` comes from `**`, `role` and `type` from the specific rule.
    const effective = effectiveRule('documents/tax/2026', rules);
    expect(effective.role).toBe('knowledge');
    expect(effective.type).toBe('tax');
    expect(effective.rank).toBe(1);
    expect(declaringRule('documents/tax/2026', rules, 'rank')?.glob).toBe('**');
    expect(declaringRule('documents/tax/2026', rules, 'type')?.glob).toBe('documents/tax/**');
  });

  it('lets a knowledge-base layer replace a machine-config rule for the same glob', () => {
    const merged = compileRules([
      { source: 'config', folders: { 'notes/**': { role: 'knowledge' } } },
      { source: 'kb', folders: { 'notes/**': { role: 'source' } } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.role).toBe('source');
    expect(merged[0]!.source).toBe('kb');
  });
});
