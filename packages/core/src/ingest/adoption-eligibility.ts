import path from 'node:path';
import type { AknoConfig } from '../config/schema.ts';
import { resolveRole } from '../kb/page.ts';
import { configuredTransformPolicy } from '../maintenance/profile.ts';
import { effectiveRule } from '../rules/compile.ts';
import { cleanSlug } from './name.ts';

/** Whether a read-only result may offer the scoped document-adoption action. */
export function canSuggestDocumentAdoption(config: AknoConfig, relPath: string): boolean {
  if (configuredTransformPolicy(config, 'adopt') === 'off') return false;
  const slug = documentAdoptionSlug(relPath);
  return slug !== null && adoptionDestinationIssue(config, slug) === null;
}

export function documentAdoptionSlug(relPath: string): string | null {
  const portable = relPath.replaceAll('\\', '/');
  const adoptionStem = cleanSlug(path.posix.basename(portable));
  if (!adoptionStem) return null;
  const directory = path.posix.dirname(portable);
  return directory === '.' ? adoptionStem : `${directory}/${adoptionStem}`;
}

/** Adoption creates a knowledge filing page; it must not promote a source-only destination. */
export function adoptionDestinationIssue(config: AknoConfig, slug: string): string | null {
  const rule = effectiveRule(slug, config.rules);
  if (rule.ingest === 'file' || rule.ingest === 'ignore') {
    return `the rule for this folder says ingest: ${rule.ingest}`;
  }
  // Filing pages have no role declaration. Use the indexer's precedence, including provenance,
  // instead of forcing knowledge in frontmatter to bypass the user's destination policy.
  const { role } = resolveRole({ slug, declaredRole: null }, rule, config.paths.observations);
  return role === 'knowledge' ? null : `the filing page would resolve to role: ${role}, not knowledge`;
}
