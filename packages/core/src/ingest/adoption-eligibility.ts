import path from 'node:path';
import type { AknoConfig } from '../config/schema.ts';
import { configuredTransformPolicy } from '../maintenance/profile.ts';
import { effectiveRule } from '../rules/compile.ts';
import { cleanSlug } from './name.ts';

/** Whether a read-only result may offer the scoped document-adoption action. */
export function canSuggestDocumentAdoption(config: AknoConfig, relPath: string): boolean {
  if (configuredTransformPolicy(config, 'adopt') === 'off') return false;
  const portable = relPath.replaceAll('\\', '/');
  const adoptionStem = cleanSlug(path.posix.basename(portable));
  if (!adoptionStem) return false;
  const directory = path.posix.dirname(portable);
  const slug = directory === '.' ? adoptionStem : `${directory}/${adoptionStem}`;
  const rule = effectiveRule(slug, config.rules);
  return rule.ingest !== 'file' && rule.ingest !== 'ignore';
}
