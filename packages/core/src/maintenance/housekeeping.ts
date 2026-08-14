import type { AknoContext } from '../context.ts';
import { effectiveRule, matchesGlob } from '../rules/compile.ts';

/**
 * The cycle reports broken links, orphaned documents, and pages that have drifted from their
 * folder's rules.
 *
 * All three are reports, never repairs. A broken link is often a page someone means to write;
 * an orphaned document may be a file they keep deliberately; a page that breaks its folder's
 * naming convention is still their page. This tier has no mandate to change any of them, and
 * a maintenance process that tidies a knowledge base behind its owner's back is how trust in
 * the whole layer goes.
 */

export interface BrokenLink {
  from: string;
  to: string;
  line: number | null;
}

export interface OrphanedDocument {
  relPath: string;
  reason: string;
}

export interface RuleDrift {
  slug: string;
  rule: string;
  /** What the rule expects, and what the page does instead. */
  expected: string;
  found: string;
}

export interface Housekeeping {
  brokenLinks: BrokenLink[];
  orphanedDocuments: OrphanedDocument[];
  drift: RuleDrift[];
  /** Totals, because the lists are capped for a readable report. */
  counts: { brokenLinks: number; orphanedDocuments: number; drift: number };
}

const LIST_CAP = 20;

export function housekeeping(ctx: AknoContext): Housekeeping {
  const brokenRows = ctx.store.db
    .prepare(
      `SELECT p.slug AS from_slug, l.to_slug, l.line FROM links l
         JOIN pages p ON p.id = l.from_page
        WHERE l.broken = 1 AND l.kind != 'embed'
        ORDER BY p.slug, l.line
        LIMIT ?`,
    )
    .all(LIST_CAP) as { from_slug: string; to_slug: string; line: number | null }[];

  const brokenTotal = count(ctx, "SELECT count(*) AS c FROM links WHERE broken = 1 AND kind != 'embed'");

  // A document with no page has nowhere to be returned, since recall returns page cards.
  // Reported here with the fix, rather than left to be noticed by its absence from results.
  const orphanRows = ctx.store.db
    .prepare(
      `SELECT rel_path, text IS NOT NULL AS extracted FROM documents
        WHERE page_id IS NULL ORDER BY rel_path LIMIT ?`,
    )
    .all(LIST_CAP) as { rel_path: string; extracted: number }[];

  const orphanTotal = count(ctx, 'SELECT count(*) AS c FROM documents WHERE page_id IS NULL');

  const drift = findDrift(ctx);
  const adoptEnabled = ctx.config.maintenance.adopt.enabled;

  return {
    brokenLinks: brokenRows.map((row) => ({
      from: row.from_slug,
      to: row.to_slug,
      line: row.line,
    })),
    orphanedDocuments: orphanRows.map((row) => ({
      relPath: row.rel_path,
      reason: row.extracted
        ? adoptEnabled
          ? 'no page owns it — the adopt phase will write one beside it'
          : 'no page owns it, so its text cannot be returned — embed it from a page with `![[filename]]`, or enable maintenance.adopt'
        : 'no page owns it, and nothing could be read from it',
    })),
    drift: drift.slice(0, LIST_CAP),
    counts: { brokenLinks: brokenTotal, orphanedDocuments: orphanTotal, drift: drift.length },
  };
}

/**
 * Pages whose folder rule says one thing and the page does another.
 *
 * Only the checks a rule can be wrong about *in fact* — a declared type that contradicts the
 * folder's, a slug the folder's pattern rejects, nesting past `max_depth`. Class is
 * deliberately absent: a page declaring its own `role` in frontmatter **outranks** the rule
 * so that is the user overriding a default, not drift.
 */
function findDrift(ctx: AknoContext): RuleDrift[] {
  const pages = ctx.store.db
    .prepare("SELECT slug, type FROM pages WHERE role != 'ignored' ORDER BY slug")
    .all() as { slug: string; type: string | null }[];

  const out: RuleDrift[] = [];
  for (const page of pages) {
    // `effectiveRule` merges the *values* of every matching rule and deliberately drops
    // `glob`, so the glob has to be found separately. Rules arrive most-specific-first, which
    // is the one a reader should be pointed at.
    const rule = effectiveRule(page.slug, ctx.config.rules);
    const glob = ctx.config.rules.find((candidate) => matchesGlob(page.slug, candidate.glob))?.glob;
    if (glob === undefined) continue;

    if (rule.type && page.type && page.type !== rule.type) {
      out.push({
        slug: page.slug,
        rule: glob,
        expected: `type: ${rule.type}`,
        found: `type: ${page.type}`,
      });
    }

    if (rule.slug_pattern) {
      const basename = page.slug.slice(page.slug.lastIndexOf('/') + 1);
      if (!safeMatch(rule.slug_pattern, basename)) {
        out.push({
          slug: page.slug,
          rule: glob,
          expected: `slug matching ${rule.slug_pattern}`,
          found: basename,
        });
      }
    }

    if (rule.max_depth !== undefined) {
      // Depth below the folder the rule names, not from the root: `documents/**` with
      // `max_depth: 2` is a statement about how deep `documents/` may nest.
      const ruleDepth = glob
        .replace(/\/\*\*?$/, '')
        .split('/')
        .filter(Boolean).length;
      const depth = page.slug.split('/').length - ruleDepth;
      if (depth > rule.max_depth) {
        out.push({
          slug: page.slug,
          rule: glob,
          expected: `at most ${rule.max_depth} level(s) deep`,
          found: `${depth} levels deep`,
        });
      }
    }
  }
  return out;
}

/**
 * A `slug_pattern` comes from a config file, so a bad one must not take the pass down with
 * it. An unusable pattern reports nothing rather than everything.
 */
function safeMatch(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return matchesGlob(value, pattern);
  }
}

function count(ctx: AknoContext, sql: string): number {
  return (ctx.store.db.prepare(sql).get() as { c: number }).c;
}
