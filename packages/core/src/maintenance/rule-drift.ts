import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { replaceTopLevelString } from '../kb/frontmatter.ts';
import { isReserved } from '../reserved.ts';
import { declaringRule, effectiveRule } from '../rules/compile.ts';
import { sha256 } from '../store/ids.ts';

export interface RuleDriftDraft {
  kind: 'rule_drift';
  slug: string;
  relPath: string;
  inputHash: string;
  before: string;
  after: string;
  ruleGlob: string;
  expectedType: string;
  foundType: string;
  ruleFingerprint: string;
}

/**
 * Plan only the rule drift that has one exact correction. A folder's explicit `type` value is
 * authoritative for knowledge pages in that folder; slug and depth findings are not included
 * because neither constraint determines a unique new path. Source pages are intentionally
 * excluded even when they sit under the same rule: reference material is searchable evidence,
 * not autonomous rewrite scope.
 */
export async function planRuleDrifts(
  ctx: AknoContext,
  options: { limit: number },
): Promise<RuleDriftDraft[]> {
  if (options.limit <= 0) return [];
  const pages = ctx.store.db
    .prepare(
      `SELECT slug, rel_path, type FROM pages
        WHERE role = 'knowledge' AND type IS NOT NULL
        ORDER BY slug`,
    )
    .all() as { slug: string; rel_path: string; type: string }[];
  const drafts: RuleDriftDraft[] = [];
  const terminal = ctx.store.db.prepare(
    `SELECT 1 FROM maintenance_items
      WHERE kind = 'rule_drift' AND input_hash = ? AND subject = ?
        AND status IN ('applied', 'rejected') LIMIT 1`,
  );

  for (const page of pages) {
    if (drafts.length >= options.limit) break;
    if (isReserved(page.slug, ctx.config)) continue;
    const rule = effectiveRule(page.slug, ctx.config.rules);
    if (!rule.type || page.type === rule.type) continue;
    const declaration = declaringRule(page.slug, ctx.config.rules, 'type');
    if (!declaration || declaration.type !== rule.type) continue;

    const before = await fsp
      .readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8')
      .catch(() => null);
    if (before === null) continue;
    const inputHash = sha256(before);
    if (terminal.get(inputHash, page.slug)) continue;
    const after = replaceTopLevelString(before, 'type', rule.type);
    if (after === null || after === before) continue;
    drafts.push({
      kind: 'rule_drift',
      slug: page.slug,
      relPath: page.rel_path,
      inputHash,
      before,
      after,
      ruleGlob: declaration.glob,
      expectedType: rule.type,
      foundType: page.type,
      ruleFingerprint: sha256(JSON.stringify({ glob: declaration.glob, type: rule.type })),
    });
  }

  return drafts;
}
