import { FolderRuleDoc, type FolderRule } from '../config/schema.ts';

/**
 * Rules are glob-scoped and **most-specific-wins**. Specificity is derived
 * from the shape of the glob, not from declaration order — so reordering the
 * config file can never change which rule applies, and two files' rules can be
 * merged without one accidentally shadowing the other by position.
 */
export function compileRules(layers: { folders: Record<string, unknown>; source: string }[]): FolderRule[] {
  const byGlob = new Map<string, FolderRule>();

  for (const layer of layers) {
    for (const [glob, raw] of Object.entries(layer.folders)) {
      const parsed = FolderRuleDoc.safeParse(raw);
      if (!parsed.success) continue;
      // A later layer replaces an earlier one for the same glob rather than
      // merging into it: a rule is a statement about a folder, and half of one
      // inherited from a file you have not read is worse than none.
      byGlob.set(glob, {
        ...parsed.data,
        glob,
        source: layer.source,
        specificity: specificityOf(glob),
      });
    }
  }

  // Sorted most-specific-first so the first match wins and lookup can stop.
  return [...byGlob.values()].sort((a, b) => b.specificity - a.specificity || b.glob.length - a.glob.length);
}

/**
 * A literal path segment is worth more than a `*`, which is worth more than a
 * `**`. `documents/tax/**` beats `documents/**` beats `**`.
 */
function specificityOf(glob: string): number {
  let score = 0;
  for (const segment of glob.split('/')) {
    if (segment === '**') score += 1;
    else if (segment.includes('*')) score += 4;
    else score += 10;
  }
  return score;
}

/** Cached because `matches` is called once per page per index pass. */
const regexCache = new Map<string, RegExp>();

function globToRegExp(glob: string): RegExp {
  const cached = regexCache.get(glob);
  if (cached) return cached;

  let out = '^';
  const segments = glob.split('/');
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const isLast = i === segments.length - 1;
    if (segment === '**') {
      // `a/**` matches `a/b` and `a/b/c`, and also `a` itself — a rule on a
      // folder's contents should cover the folder's own index page.
      out += isLast ? '(?:/.*)?' : '(?:/[^/]*)*';
      continue;
    }
    if (i > 0) out += '/';
    out += segment
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
  }
  out += '$';

  // A leading `**/` produced a stray slash requirement; normalize it away.
  const regex = new RegExp(out.replace('^(?:/', '^(?:'), 'i');
  regexCache.set(glob, regex);
  return regex;
}

export function matchesGlob(slug: string, glob: string): boolean {
  return globToRegExp(glob).test(slug);
}

export interface RuleMatch {
  rule: FolderRule | null;
  /** Every rule that matched, most specific first. `akno rules <path>` prints these. */
  candidates: FolderRule[];
}

export function matchRules(slug: string, rules: FolderRule[]): RuleMatch {
  const candidates = rules.filter((rule) => matchesGlob(slug, rule.glob));
  return { rule: candidates[0] ?? null, candidates };
}

/**
 * The effective rule for a slug: fields are taken from the most specific rule
 * that declares them, so `documents/**: {role}` and `**: {rank}` compose
 * instead of one erasing the other.
 */
export function effectiveRule(slug: string, rules: FolderRule[]): Partial<FolderRule> {
  const { candidates } = matchRules(slug, rules);
  const out: Record<string, unknown> = {};
  // Least specific first, so more specific values overwrite.
  for (const rule of [...candidates].reverse()) {
    for (const [key, value] of Object.entries(rule)) {
      if (key === 'glob' || key === 'source' || key === 'specificity') continue;
      if (value !== undefined) out[key] = value;
    }
  }
  return out as Partial<FolderRule>;
}
