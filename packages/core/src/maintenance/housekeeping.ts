import type { AknoContext } from '../context.ts';
import type { MaintenancePolicy } from '../config/schema.ts';
import { configuredTransformPolicy } from './profile.ts';
import { declaringRule, effectiveRule, matchesGlob } from '../rules/compile.ts';
import { discoverGraphMaintenanceCandidates, type GraphMaintenanceCandidate } from './graph-candidates.ts';
import { getMaintenancePlan, type MaintenanceItemStatus, type MaintenanceItemStatusCode } from './plans.ts';
import { prepareRuleRepair, type RuleDriftCandidate, type RuleRepairAssessment } from './rule-drift.ts';

/**
 * The cycle reports broken links, orphaned documents, and pages that have drifted from their
 * folder's rules.
 *
 * This function reports; it never grants repair authority. Exact planners may attach their
 * nonterminal items, but an unplanned broken link is often a page someone means to write, an
 * orphaned document may be deliberate, and a naming violation does not identify a destination.
 */

export interface BrokenLink {
  from: string;
  to: string;
  line: number | null;
  /** An exact nonterminal repair already exists; this finding is not unplanned work. */
  plan: HousekeepingPlanRef | null;
}

export interface OrphanedDocument {
  relPath: string;
  reason: string;
  /** An exact nonterminal adoption already exists; this finding is not unplanned work. */
  plan: HousekeepingPlanRef | null;
}

/** Content-safe identity for exact work already represented by the durable plan lifecycle. */
export interface HousekeepingPlanRef {
  planId: string;
  itemId: string;
  kind: 'broken_link' | 'rule_drift' | 'adopt';
  policy: Exclude<MaintenancePolicy, 'off'>;
  status: MaintenanceItemStatus;
  statusCode: MaintenanceItemStatusCode | null;
}

export interface RuleDrift {
  slug: string;
  field: 'type' | 'slug_pattern' | 'max_depth';
  rule: string;
  /** What the rule expects, and what the page does instead. */
  expected: string;
  found: string;
  /** An exact nonterminal correction exists for type drift or an explicitly routed depth repair. */
  plan: HousekeepingPlanRef | null;
  /** Why exact repair is available, intentionally report-only, held, or already planned. */
  repair: RuleRepairDisposition;
}

export type RuleRepairDisposition =
  | RuleRepairAssessment
  | {
      status: 'plan_backed';
      code: 'sealed_plan';
      reason: string;
    };

export interface Housekeeping {
  brokenLinks: BrokenLink[];
  orphanedDocuments: OrphanedDocument[];
  drift: RuleDrift[];
  /** Read-only graph findings. They carry no operation and grant no transformation authority. */
  graphCandidates: GraphMaintenanceCandidate[];
  /** Totals, because the lists are capped for a readable report. */
  counts: { brokenLinks: number; orphanedDocuments: number; drift: number; graphCandidates: number };
  /** Current findings for which Akno has already sealed an exact nonterminal operation. */
  planBacked: { brokenLinks: number; orphanedDocuments: number; drift: number };
  /** Content-safe explanation totals for current rule findings. */
  ruleRepairs: { planBacked: number; ready: number; held: number; reportOnly: number };
}

const LIST_CAP = 20;
const PLAN_BACKED_ITEM_STATUSES = new Set<MaintenanceItemStatus>([
  'proposed',
  'approved',
  'applying',
  'verification_pending',
]);

export async function housekeeping(ctx: AknoContext): Promise<Housekeeping> {
  const coverage = pendingPlanCoverage(ctx);
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

  // An orphan is searchable, but still lacks page policy, links, and a place for authored context.
  // Housekeeping reports the organizational opportunity without calling it data loss.
  const orphanRows = ctx.store.db
    .prepare(
      `SELECT rel_path, text IS NOT NULL AS extracted, availability FROM documents
        WHERE page_id IS NULL ORDER BY rel_path LIMIT ?`,
    )
    .all(LIST_CAP) as { rel_path: string; extracted: number; availability: 'available' | 'missing' }[];

  const orphanTotal = count(ctx, 'SELECT count(*) AS c FROM documents WHERE page_id IS NULL');

  const drift: RuleDrift[] = [];
  // Deliberately sequential: a malformed rule set can produce many findings, and housekeeping
  // should not turn that into an unbounded burst of file opens against the owner's notes.
  for (const { candidate, ...entry } of findDrift(ctx)) {
    const plan = coverage.drift.get(ruleDriftKey(entry.slug, entry.expected, entry.found)) ?? null;
    drift.push({
      ...entry,
      plan,
      repair: plan
        ? {
            status: 'plan_backed',
            code: 'sealed_plan',
            reason: 'an exact nonterminal maintenance item already owns this finding',
          }
        : (await prepareRuleRepair(ctx, candidate)).assessment,
    });
  }
  const graphCandidates = discoverGraphMaintenanceCandidates(ctx.store);
  const adoptEnabled = configuredTransformPolicy(ctx.config, 'adopt') !== 'off';

  return {
    brokenLinks: brokenRows.map((row) => ({
      from: row.from_slug,
      to: row.to_slug,
      line: row.line,
      plan: coverage.brokenLinks.get(brokenLinkKey(row.from_slug, row.to_slug)) ?? null,
    })),
    orphanedDocuments: orphanRows.map((row) => ({
      relPath: row.rel_path,
      plan: coverage.orphanedDocuments.get(row.rel_path) ?? null,
      reason:
        row.availability === 'missing'
          ? row.extracted
            ? 'original missing; retained indexed text remains searchable, but adoption is paused'
            : 'original missing and no readable indexed copy or rendition remains'
          : row.extracted
            ? adoptEnabled
              ? 'unfiled but searchable — the adopt phase will write a page beside it'
              : 'unfiled but searchable as a document — embed it from a page with `![[filename]]`, or enable maintenance.adopt'
            : 'unfiled and visible by filename, but nothing could be read from it',
    })),
    drift: drift.slice(0, LIST_CAP),
    graphCandidates: graphCandidates.slice(0, LIST_CAP),
    counts: {
      brokenLinks: brokenTotal,
      orphanedDocuments: orphanTotal,
      drift: drift.length,
      graphCandidates: graphCandidates.length,
    },
    planBacked: {
      brokenLinks: countPlanBackedBrokenLinks(ctx, coverage.brokenLinks),
      orphanedDocuments: countPlanBackedOrphans(ctx, coverage.orphanedDocuments),
      drift: drift.filter((entry) => entry.plan !== null).length,
    },
    ruleRepairs: {
      planBacked: drift.filter((entry) => entry.repair.status === 'plan_backed').length,
      ready: drift.filter((entry) => entry.repair.status === 'ready').length,
      held: drift.filter((entry) => entry.repair.status === 'held').length,
      reportOnly: drift.filter((entry) => entry.repair.status === 'report_only').length,
    },
  };
}

/**
 * The exact plan is the authority here, not resemblance between a diagnostic and an operation.
 * Link evidence seals both endpoints; adoption evidence seals the document path and bytes; rule
 * evidence seals the exact type or depth-relocation declaration. Newest plans win when an older audit plan and a later
 * review plan describe the same still-current work.
 */
function pendingPlanCoverage(ctx: AknoContext): {
  brokenLinks: Map<string, HousekeepingPlanRef>;
  orphanedDocuments: Map<string, HousekeepingPlanRef>;
  drift: Map<string, HousekeepingPlanRef>;
} {
  const brokenLinks = new Map<string, HousekeepingPlanRef>();
  const orphanedDocuments = new Map<string, HousekeepingPlanRef>();
  const drift = new Map<string, HousekeepingPlanRef>();

  const plans = ctx.store.db
    .prepare(
      `SELECT id FROM maintenance_plans
        WHERE status NOT IN ('completed', 'failed', 'superseded')
        ORDER BY rowid DESC`,
    )
    .all() as { id: string }[];
  for (const summary of plans) {
    const plan = getMaintenancePlan(ctx, summary.id);
    for (const item of plan.items) {
      if (item.kind !== 'broken_link' && item.kind !== 'rule_drift' && item.kind !== 'adopt') continue;
      if (!PLAN_BACKED_ITEM_STATUSES.has(item.status)) continue;
      const ref: HousekeepingPlanRef = {
        planId: plan.id,
        itemId: item.id,
        kind: item.kind,
        policy: item.policy,
        status: item.status,
        statusCode: item.statusCode,
      };
      if (item.kind === 'broken_link') {
        for (const evidence of item.evidence) {
          if (evidence.type !== 'link' || !evidence.brokenTarget) continue;
          const key = brokenLinkKey(evidence.source, evidence.brokenTarget);
          if (!brokenLinks.has(key)) brokenLinks.set(key, ref);
        }
      } else if (item.kind === 'adopt') {
        for (const evidence of item.evidence) {
          if (evidence.type !== 'document' || !evidence.documentRelPath) continue;
          if (!orphanedDocuments.has(evidence.documentRelPath)) {
            orphanedDocuments.set(evidence.documentRelPath, ref);
          }
        }
      } else {
        for (const evidence of item.evidence) {
          if (evidence.type !== 'rule') continue;
          const key =
            evidence.ruleField === 'max_depth' && evidence.maxDepth && evidence.foundDepth
              ? ruleDriftKey(
                  item.subject,
                  `at most ${evidence.maxDepth} level(s) deep`,
                  `${evidence.foundDepth} levels deep`,
                )
              : evidence.expectedType && evidence.foundType
                ? ruleDriftKey(item.subject, `type: ${evidence.expectedType}`, `type: ${evidence.foundType}`)
                : null;
          if (!key) continue;
          if (!drift.has(key)) drift.set(key, ref);
        }
      }
    }
  }

  return { brokenLinks, orphanedDocuments, drift };
}

function countPlanBackedBrokenLinks(ctx: AknoContext, coverage: Map<string, HousekeepingPlanRef>): number {
  let total = 0;
  const countRows = ctx.store.db.prepare(
    `SELECT count(*) AS c FROM links l JOIN pages p ON p.id = l.from_page
      WHERE l.broken = 1 AND l.kind != 'embed' AND p.slug = ? AND l.to_slug = ?`,
  );
  for (const key of coverage.keys()) {
    const [from, to] = key.split('\0');
    if (from === undefined || to === undefined) continue;
    total += (countRows.get(from, to) as { c: number }).c;
  }
  return total;
}

function countPlanBackedOrphans(ctx: AknoContext, coverage: Map<string, HousekeepingPlanRef>): number {
  let total = 0;
  const exists = ctx.store.db.prepare(
    'SELECT 1 FROM documents WHERE page_id IS NULL AND rel_path = ? LIMIT 1',
  );
  for (const relPath of coverage.keys()) {
    if (exists.get(relPath)) total++;
  }
  return total;
}

function brokenLinkKey(from: string, to: string): string {
  return `${from}\0${to}`;
}

function ruleDriftKey(slug: string, expected: string, found: string): string {
  return `${slug}\0${expected}\0${found}`;
}

/**
 * Pages whose folder rule says one thing and the page does another.
 *
 * Only the checks a rule can be wrong about *in fact* — a declared type that contradicts the
 * folder's, a slug the folder's pattern rejects, nesting past `max_depth`. Class is
 * deliberately absent: a page declaring its own `role` in frontmatter **outranks** the rule
 * so that is the user overriding a default, not drift.
 */
type RuleDriftFinding = Omit<RuleDrift, 'plan' | 'repair'> & { candidate: RuleDriftCandidate };

function findDrift(ctx: AknoContext): RuleDriftFinding[] {
  const pages = ctx.store.db
    .prepare("SELECT id, slug, rel_path, role, type FROM pages WHERE role != 'ignored' ORDER BY slug")
    .all() as { id: string; slug: string; rel_path: string; role: string; type: string | null }[];

  const out: RuleDriftFinding[] = [];
  for (const page of pages) {
    // `effectiveRule` merges values across matching rules. Each diagnostic points to the most
    // specific matching rule that declared that particular field, not merely the first match.
    const rule = effectiveRule(page.slug, ctx.config.rules);
    const typeRule = declaringRule(page.slug, ctx.config.rules, 'type');
    if (rule.type && typeRule && page.type && page.type !== rule.type) {
      out.push({
        slug: page.slug,
        field: 'type',
        rule: typeRule.glob,
        expected: `type: ${rule.type}`,
        found: `type: ${page.type}`,
        candidate: {
          pageId: page.id,
          slug: page.slug,
          relPath: page.rel_path,
          role: page.role,
          field: 'type',
          ruleGlob: typeRule.glob,
          expectedType: rule.type,
          foundType: page.type,
        },
      });
    }

    const slugRule = declaringRule(page.slug, ctx.config.rules, 'slug_pattern');
    if (rule.slug_pattern && slugRule) {
      const basename = page.slug.slice(page.slug.lastIndexOf('/') + 1);
      if (!safeMatch(rule.slug_pattern, basename)) {
        out.push({
          slug: page.slug,
          field: 'slug_pattern',
          rule: slugRule.glob,
          expected: `slug matching ${rule.slug_pattern}`,
          found: basename,
          candidate: {
            pageId: page.id,
            slug: page.slug,
            relPath: page.rel_path,
            role: page.role,
            field: 'slug_pattern',
            ruleGlob: slugRule.glob,
          },
        });
      }
    }

    const depthRule = declaringRule(page.slug, ctx.config.rules, 'max_depth');
    if (rule.max_depth !== undefined && depthRule) {
      // Depth below the folder the rule names, not from the root: `documents/**` with
      // `max_depth: 2` is a statement about how deep `documents/` may nest.
      const ruleDepth = depthRule.glob
        .replace(/\/\*\*?$/, '')
        .split('/')
        .filter(Boolean).length;
      const depth = page.slug.split('/').length - ruleDepth;
      if (depth > rule.max_depth) {
        out.push({
          slug: page.slug,
          field: 'max_depth',
          rule: depthRule.glob,
          expected: `at most ${rule.max_depth} level(s) deep`,
          found: `${depth} levels deep`,
          candidate: {
            pageId: page.id,
            slug: page.slug,
            relPath: page.rel_path,
            role: page.role,
            field: 'max_depth',
            ruleGlob: depthRule.glob,
            maxDepth: rule.max_depth,
            foundDepth: depth,
          },
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
