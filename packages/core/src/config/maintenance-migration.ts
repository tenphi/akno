import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AknoError } from '@tenphi/akno-protocol';
import {
  MAINTENANCE_TRANSFORMS,
  type MaintenancePolicy,
  type MaintenanceProfile,
  type MaintenanceTransform,
} from './schema.ts';
import { parseJsonc } from './jsonc.ts';
import { legacyMaintenanceKeys } from './load.ts';
import { expandTilde, findRepoRoot } from './paths.ts';

type JsonObject = Record<string, unknown>;

export interface MaintenanceMigrationOptions {
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  repoRoot?: string | null;
}

export interface MaintenanceMigrationChange {
  path: string;
  before: string;
  after: string;
}

export interface MaintenanceMigrationPlan {
  required: boolean;
  profile: MaintenanceProfile | null;
  policies: Record<MaintenanceTransform, MaintenancePolicy> | null;
  policyCounts: Record<MaintenancePolicy, number>;
  legacyKeys: string[];
  sourceFiles: number;
  changedFiles: number;
  convertedDirectWrites: MaintenanceTransform[];
  changes: MaintenanceMigrationChange[];
}

interface SourceDocument {
  path: string;
  content: string;
  doc: JsonObject;
}

const LEGACY_DEFAULTS: JsonObject = {
  profile: 'custom',
  policies: {},
  observe: { enabled: false },
  reflect: { enabled: false },
  curate: { enabled: false, mode: null, write: false },
  adopt: { enabled: true, mode: 'auto' },
  conflicts: { resolve: true },
  repair: { links: true },
};

/**
 * Inspect the active writable configuration layers without loading runtime config.
 * This decoder is deliberately isolated from `loadConfig`: it can translate old authority,
 * but no maintenance run can receive or execute it.
 */
export function planMaintenanceConfigMigration(
  options: MaintenanceMigrationOptions = {},
): MaintenanceMigrationPlan {
  return planMaintenanceConfigMigrationFromSources(discoverSources(options));
}

export function planMaintenanceConfigMigrationFromSources(
  sources: Array<{ path: string; content: string }>,
): MaintenanceMigrationPlan {
  const parsed: SourceDocument[] = sources.map((source) => {
    const value = parseJsonc<unknown>(source.content, source.path);
    if (!isObject(value)) throw new AknoError('invalid', 'a configuration root must be an object');
    return { ...source, doc: value };
  });
  const affected = parsed.filter((source) => legacyMaintenanceKeys(source.doc).length > 0);
  if (affected.length === 0) return emptyPlan();

  const merged = parsed.reduce<JsonObject>((maintenance, source) => {
    const layer = isObject(source.doc.maintenance) ? source.doc.maintenance : {};
    return mergeObjects(maintenance, layer);
  }, structuredClone(LEGACY_DEFAULTS));
  const resolved = migrateAuthority(merged);
  const target = parsed.at(-1);
  if (!target) throw new AknoError('invalid', 'no writable configuration layer was found');
  const pathsToChange = new Set([...affected.map((source) => source.path), target.path]);
  const changes: MaintenanceMigrationChange[] = [];

  for (const source of parsed) {
    if (!pathsToChange.has(source.path)) continue;
    const nextMaintenance = isObject(source.doc.maintenance) ? structuredClone(source.doc.maintenance) : {};
    removeLegacyAuthority(nextMaintenance);
    if (source.path === target.path) {
      nextMaintenance.profile = resolved.profile;
      nextMaintenance.policies = resolved.policies;
    }
    const after = replaceMaintenanceObject(source.content, source.doc, nextMaintenance);
    if (after !== source.content) changes.push({ path: source.path, before: source.content, after });
  }

  return {
    required: true,
    profile: resolved.profile,
    policies: resolved.policies,
    policyCounts: countPolicies(resolved.policies),
    legacyKeys: [...new Set(affected.flatMap((source) => legacyMaintenanceKeys(source.doc)))].sort(),
    sourceFiles: affected.length,
    changedFiles: changes.length,
    convertedDirectWrites: resolved.convertedDirectWrites,
    changes,
  };
}

/** Stale-check every source, prepare every sibling temp, then replace the files. */
export async function applyMaintenanceConfigMigration(plan: MaintenanceMigrationPlan): Promise<void> {
  if (!plan.required) return;
  const prepared: Array<MaintenanceMigrationChange & { temporary: string; mode: number }> = [];
  try {
    for (const change of plan.changes) {
      const current = await fsp.readFile(change.path, 'utf8');
      if (current !== change.before) {
        throw new AknoError(
          'conflict',
          'configuration changed after migration inspection; run --check again',
        );
      }
      const stat = await fsp.stat(change.path);
      const temporary = `${change.path}.akno-migrate-${randomUUID()}.tmp`;
      const handle = await fsp.open(temporary, 'wx', stat.mode);
      prepared.push({ ...change, temporary, mode: stat.mode });
      try {
        await handle.writeFile(change.after, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    }

    const replaced: typeof prepared = [];
    try {
      for (const change of prepared) {
        const current = await fsp.readFile(change.path, 'utf8');
        if (current !== change.before) {
          throw new AknoError(
            'conflict',
            'configuration changed while migration was being prepared; run --check again',
          );
        }
        await fsp.rename(change.temporary, change.path);
        replaced.push(change);
      }
    } catch (error) {
      for (const change of replaced.reverse()) {
        await restoreConfiguration(change.path, change.before, change.mode);
      }
      throw error;
    }
  } finally {
    for (const change of prepared) await fsp.rm(change.temporary, { force: true });
  }
}

function discoverSources(options: MaintenanceMigrationOptions): Array<{ path: string; content: string }> {
  const env = options.env ?? process.env;
  const paths: string[] = [];
  if (env.AKNO_CONFIG) {
    paths.push(path.resolve(expandTilde(env.AKNO_CONFIG)));
  } else {
    const stateDir = expandTilde(options.stateDir ?? env.AKNO_STATE_DIR ?? '~/.akno');
    const json = path.join(stateDir, 'config.json');
    const jsonc = path.join(stateDir, 'config.jsonc');
    if (fs.existsSync(json)) paths.push(json);
    else if (fs.existsSync(jsonc)) paths.push(jsonc);
  }
  const root = options.repoRoot === undefined ? findRepoRoot() : options.repoRoot;
  if (root) paths.push(path.join(root, 'config', 'local.jsonc'));

  return [...new Set(paths)]
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({ path: candidate, content: fs.readFileSync(candidate, 'utf8') }));
}

function migrateAuthority(maintenance: JsonObject): {
  profile: MaintenanceProfile;
  policies: Record<MaintenanceTransform, MaintenancePolicy>;
  convertedDirectWrites: MaintenanceTransform[];
} {
  const profile = maintenance.profile;
  const configured = isObject(maintenance.policies) ? maintenance.policies : {};
  const explicitPolicies = Object.keys(configured).length > 0;
  const observeEnabled = nestedBoolean(maintenance, 'observe', 'enabled', false);
  const reflectEnabled = nestedBoolean(maintenance, 'reflect', 'enabled', false);
  const convertedDirectWrites: MaintenanceTransform[] = [];
  let policies: Record<MaintenanceTransform, MaintenancePolicy>;

  if (profile === 'audit' || profile === 'review' || profile === 'autonomous') {
    const ceiling = profile === 'autonomous' ? 'auto' : profile;
    policies = Object.fromEntries(
      MAINTENANCE_TRANSFORMS.map((kind) => [
        kind,
        phaseEnabled(kind, observeEnabled, reflectEnabled)
          ? lowerPolicy(asPolicy(configured[kind]) ?? ceiling, ceiling)
          : 'off',
      ]),
    ) as Record<MaintenanceTransform, MaintenancePolicy>;
  } else if (explicitPolicies) {
    policies = Object.fromEntries(
      MAINTENANCE_TRANSFORMS.map((kind) => [
        kind,
        legacyTransformEnabled(maintenance, kind, observeEnabled, reflectEnabled)
          ? (asPolicy(configured[kind]) ?? 'off')
          : 'off',
      ]),
    ) as Record<MaintenanceTransform, MaintenancePolicy>;
  } else {
    const curateEnabled = nestedBoolean(maintenance, 'curate', 'enabled', false);
    const curateMode = nestedMode(maintenance, 'curate', 'mode');
    const curateWrite = nestedBoolean(maintenance, 'curate', 'write', false);
    const curationPolicy: MaintenancePolicy = !curateEnabled
      ? 'off'
      : (curateMode ?? (curateWrite ? 'auto' : 'audit'));
    if (observeEnabled) convertedDirectWrites.push('observe');
    if (reflectEnabled) convertedDirectWrites.push('reflect');
    if (curateEnabled && !curateMode && curateWrite) {
      convertedDirectWrites.push('hygiene', 'synthesis', 'split', 'extract', 'merge');
    }
    policies = {
      observe: observeEnabled ? 'auto' : 'off',
      reflect: reflectEnabled ? 'auto' : 'off',
      hygiene: curationPolicy,
      synthesis: curationPolicy,
      split: curationPolicy,
      extract: curationPolicy,
      merge: curationPolicy,
      contradiction: nestedBoolean(maintenance, 'conflicts', 'resolve', true) ? curationPolicy : 'off',
      broken_link: nestedBoolean(maintenance, 'repair', 'links', true) ? curationPolicy : 'off',
      adopt: nestedBoolean(maintenance, 'adopt', 'enabled', true)
        ? (nestedMode(maintenance, 'adopt', 'mode', 'auto') ?? 'off')
        : 'off',
    };
  }

  const highest = highestPolicy(policies);
  return {
    profile: highest === 'auto' ? 'autonomous' : highest === 'review' ? 'review' : 'audit',
    policies,
    convertedDirectWrites: [...new Set(convertedDirectWrites)],
  };
}

function legacyTransformEnabled(
  maintenance: JsonObject,
  kind: MaintenanceTransform,
  observeEnabled: boolean,
  reflectEnabled: boolean,
): boolean {
  if (kind === 'observe') return observeEnabled;
  if (kind === 'reflect') return reflectEnabled;
  if (kind === 'adopt') return nestedBoolean(maintenance, 'adopt', 'enabled', true);
  if (!nestedBoolean(maintenance, 'curate', 'enabled', false)) return false;
  if (kind === 'contradiction') return nestedBoolean(maintenance, 'conflicts', 'resolve', true);
  if (kind === 'broken_link') return nestedBoolean(maintenance, 'repair', 'links', true);
  return true;
}

function phaseEnabled(kind: MaintenanceTransform, observe: boolean, reflect: boolean): boolean {
  if (kind === 'observe') return observe;
  if (kind === 'reflect') return reflect;
  return true;
}

function removeLegacyAuthority(maintenance: JsonObject): void {
  if (maintenance.profile === 'custom') delete maintenance.profile;
  if (isObject(maintenance.curate)) {
    delete maintenance.curate.enabled;
    delete maintenance.curate.mode;
    delete maintenance.curate.write;
    if (Object.keys(maintenance.curate).length === 0) delete maintenance.curate;
  }
  if (isObject(maintenance.adopt)) {
    delete maintenance.adopt.enabled;
    delete maintenance.adopt.mode;
    if (Object.keys(maintenance.adopt).length === 0) delete maintenance.adopt;
  }
}

function replaceMaintenanceObject(content: string, doc: JsonObject, maintenance: JsonObject): string {
  const range = topLevelPropertyRange(content, 'maintenance');
  if (!range) {
    const next = { ...doc, maintenance };
    return `${JSON.stringify(next, null, 2)}\n`;
  }
  const lineStart = content.lastIndexOf('\n', range.keyStart - 1) + 1;
  const indent = /^\s*/.exec(content.slice(lineStart, range.keyStart))?.[0] ?? '';
  const rendered = JSON.stringify(maintenance, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join('\n');
  return `${content.slice(0, range.valueStart)}${rendered}${content.slice(range.valueEnd)}`;
}

function topLevelPropertyRange(
  content: string,
  wanted: string,
): { keyStart: number; valueStart: number; valueEnd: number } | null {
  let depth = 0;
  for (let index = 0; index < content.length;) {
    index = skipSpaceAndComments(content, index);
    const char = content[index];
    if (char === '{' || char === '[') {
      depth++;
      index++;
      continue;
    }
    if (char === '}' || char === ']') {
      depth--;
      index++;
      continue;
    }
    if (char === '"') {
      const keyStart = index;
      const keyEnd = stringEnd(content, index);
      if (depth === 1) {
        const key = JSON.parse(content.slice(index, keyEnd)) as string;
        let cursor = skipSpaceAndComments(content, keyEnd);
        if (content[cursor] === ':' && key === wanted) {
          cursor = skipSpaceAndComments(content, cursor + 1);
          return { keyStart, valueStart: cursor, valueEnd: valueEnd(content, cursor) };
        }
      }
      index = keyEnd;
      continue;
    }
    index++;
  }
  return null;
}

function valueEnd(content: string, start: number): number {
  const opening = content[start];
  if (opening !== '{' && opening !== '[') {
    let index = start;
    while (index < content.length && ![',', '}', ']'].includes(content[index]!)) index++;
    return index;
  }
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  for (let index = start; index < content.length;) {
    const char = content[index];
    if (char === '"') {
      index = stringEnd(content, index);
      continue;
    }
    if (char === '/' && (content[index + 1] === '/' || content[index + 1] === '*')) {
      index = skipComment(content, index);
      continue;
    }
    if (char === opening) depth++;
    if (char === closing && --depth === 0) return index + 1;
    index++;
  }
  throw new AknoError('invalid', 'maintenance configuration object is not closed');
}

function stringEnd(content: string, start: number): number {
  for (let index = start + 1; index < content.length; index++) {
    if (content[index] === '\\') index++;
    else if (content[index] === '"') return index + 1;
  }
  throw new AknoError('invalid', 'configuration contains an unterminated string');
}

function skipSpaceAndComments(content: string, start: number): number {
  let index = start;
  while (index < content.length) {
    if (/\s/.test(content[index]!)) {
      index++;
      continue;
    }
    if (content[index] === '/' && (content[index + 1] === '/' || content[index + 1] === '*')) {
      index = skipComment(content, index);
      continue;
    }
    break;
  }
  return index;
}

function skipComment(content: string, start: number): number {
  if (content[start + 1] === '/') {
    const newline = content.indexOf('\n', start + 2);
    return newline === -1 ? content.length : newline + 1;
  }
  const end = content.indexOf('*/', start + 2);
  return end === -1 ? content.length : end + 2;
}

function nestedBoolean(source: JsonObject, section: string, field: string, fallback: boolean): boolean {
  const value = isObject(source[section]) ? source[section][field] : undefined;
  return typeof value === 'boolean' ? value : fallback;
}

function nestedMode(
  source: JsonObject,
  section: string,
  field: string,
  fallback: MaintenancePolicy | null = null,
): Exclude<MaintenancePolicy, 'off'> | null {
  const value = isObject(source[section]) ? source[section][field] : undefined;
  if (value === 'audit' || value === 'review' || value === 'auto') return value;
  return value === undefined ? (fallback === 'off' ? null : fallback) : null;
}

function asPolicy(value: unknown): MaintenancePolicy | null {
  return value === 'off' || value === 'audit' || value === 'review' || value === 'auto' ? value : null;
}

function lowerPolicy(
  policy: MaintenancePolicy,
  ceiling: Exclude<MaintenancePolicy, 'off'>,
): MaintenancePolicy {
  if (policy === 'off') return policy;
  return policyRank(policy) <= policyRank(ceiling) ? policy : ceiling;
}

function highestPolicy(policies: Record<MaintenanceTransform, MaintenancePolicy>): MaintenancePolicy {
  return Object.values(policies).reduce<MaintenancePolicy>(
    (highest, policy) => (policyRank(policy) > policyRank(highest) ? policy : highest),
    'off',
  );
}

function policyRank(policy: MaintenancePolicy): number {
  return policy === 'off' ? -1 : policy === 'audit' ? 0 : policy === 'review' ? 1 : 2;
}

function countPolicies(
  policies: Record<MaintenanceTransform, MaintenancePolicy>,
): Record<MaintenancePolicy, number> {
  const counts: Record<MaintenancePolicy, number> = { off: 0, audit: 0, review: 0, auto: 0 };
  for (const policy of Object.values(policies)) counts[policy]++;
  return counts;
}

function mergeObjects(base: JsonObject, overlay: JsonObject): JsonObject {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    out[key] = isObject(out[key]) && isObject(value) ? mergeObjects(out[key], value) : value;
  }
  return out;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyPlan(): MaintenanceMigrationPlan {
  return {
    required: false,
    profile: null,
    policies: null,
    policyCounts: { off: 0, audit: 0, review: 0, auto: 0 },
    legacyKeys: [],
    sourceFiles: 0,
    changedFiles: 0,
    convertedDirectWrites: [],
    changes: [],
  };
}

async function restoreConfiguration(target: string, content: string, mode: number): Promise<void> {
  const temporary = `${target}.akno-rollback-${randomUUID()}.tmp`;
  await fsp.writeFile(temporary, content, { encoding: 'utf8', mode });
  await fsp.rename(temporary, target);
}
