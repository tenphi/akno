import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ConfigDoc } from './schema.ts';
import { parseJsonc, readJsoncFile } from './jsonc.ts';
import { findRepoRoot, resolveUserPath } from './paths.ts';
import { sha256 } from '../store/ids.ts';

export interface SetupConfigTargetOptions {
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  /** Test seam; undefined discovers the checkout, while null models an installed package. */
  repoRoot?: string | null;
}

export interface SetupConfigChange {
  path: string;
  action: 'add' | 'replace';
}

export interface SetupConfigWriteOptions {
  /** Object paths owned as a unit by a preset instead of recursively merged. */
  replacePaths?: string[];
}

/**
 * The write plan deliberately keeps document bytes internal to the config layer. CLI output receives
 * only changed paths, so an existing provider header can never become part of a setup diff.
 */
export interface SetupConfigWritePlan {
  targetPath: string;
  existed: boolean;
  changed: boolean;
  changes: SetupConfigChange[];
  document: ConfigDoc;
  beforeFingerprint: string | null;
  after: string;
}

export interface SetupConfigWriteResult {
  targetPath: string;
  created: boolean;
  changed: boolean;
}

/** Resolve the same writable layer that normal commands will read. */
export function setupConfigTarget(options: SetupConfigTargetOptions = {}): string {
  const env = options.env ?? process.env;
  if (env.AKNO_CONFIG) return resolveUserPath(env.AKNO_CONFIG);

  const repoRoot = options.repoRoot === undefined ? findRepoRoot() : options.repoRoot;
  if (repoRoot) return path.join(repoRoot, 'config', 'local.jsonc');

  const stateDir = resolveUserPath(options.stateDir ?? env.AKNO_STATE_DIR ?? '~/.akno');
  const json = path.join(stateDir, 'config.json');
  const jsonc = path.join(stateDir, 'config.jsonc');
  if (fs.existsSync(json)) return json;
  return fs.existsSync(jsonc) ? jsonc : json;
}

export function planSetupConfigWrite(
  targetPath: string,
  overlay: ConfigDoc,
  options: SetupConfigWriteOptions = {},
): SetupConfigWritePlan {
  const before = readFileIfPresent(targetPath);
  const raw = before === null ? {} : readJsoncFile<unknown>(targetPath);
  if (!isPlainObject(raw)) {
    throw new Error(`${targetPath} must contain one JSON object`);
  }

  const overlayRecord = overlay as Record<string, unknown>;
  const replacePaths = new Set(options.replacePaths ?? []);
  const document = mergeObjects(raw, overlayRecord, replacePaths) as ConfigDoc;
  const changes = collectChanges(raw, overlayRecord, replacePaths);
  const after = renderMergedConfig(before, overlayRecord, replacePaths, document);
  const plan = {
    targetPath,
    existed: before !== null,
    changed: changes.length > 0,
    changes,
  } as SetupConfigWritePlan;
  // These are intentionally non-enumerable. A plan is useful in CLI and plugin code, and an
  // accidental JSON.stringify must expose only the path-only diff, never an existing header.
  Object.defineProperties(plan, {
    document: { value: document, enumerable: false },
    beforeFingerprint: { value: before === null ? null : sha256(before), enumerable: false },
    after: { value: after, enumerable: false },
  });
  return plan;
}

/**
 * Fsync a sibling temporary file and rename it over the target. The fingerprint check turns an
 * editor save between preview and apply into a visible conflict instead of a lost update.
 */
export async function applySetupConfigWrite(plan: SetupConfigWritePlan): Promise<SetupConfigWriteResult> {
  const current = readFileIfPresent(plan.targetPath);
  const currentFingerprint = current === null ? null : sha256(current);
  if (currentFingerprint !== plan.beforeFingerprint) {
    throw new Error(`configuration changed while setup was preparing its write: ${plan.targetPath}`);
  }
  if (!plan.changed) {
    return { targetPath: plan.targetPath, created: false, changed: false };
  }

  await fsp.mkdir(path.dirname(plan.targetPath), { recursive: true });
  const existingMode = await fileMode(plan.targetPath);
  const temporary = `${plan.targetPath}.${process.pid}.${Math.random().toString(16).slice(2)}.akno.tmp`;
  const handle = await fsp.open(temporary, 'wx', existingMode ?? 0o600);
  try {
    await handle.writeFile(plan.after, 'utf8');
    await handle.sync();
  } catch (error) {
    await handle.close();
    await fsp.rm(temporary, { force: true });
    throw error;
  }
  await handle.close();
  try {
    await fsp.rename(temporary, plan.targetPath);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
  return { targetPath: plan.targetPath, created: !plan.existed, changed: true };
}

function readFileIfPresent(targetPath: string): string | null {
  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function fileMode(targetPath: string): Promise<number | null> {
  try {
    return (await fsp.stat(targetPath)).mode & 0o777;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeObjects(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
  replacePaths: Set<string>,
  prefix = '',
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const target = prefix ? `${prefix}.${key}` : key;
    const existing = result[key];
    result[key] =
      !replacePaths.has(target) && isPlainObject(existing) && isPlainObject(value)
        ? mergeObjects(existing, value, replacePaths, target)
        : value;
  }
  return result;
}

function collectChanges(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
  replacePaths: Set<string>,
  prefix = '',
): SetupConfigChange[] {
  const changes: SetupConfigChange[] = [];
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const target = prefix ? `${prefix}.${key}` : key;
    const exists = Object.hasOwn(base, key);
    const existing = base[key];
    if (!replacePaths.has(target) && isPlainObject(existing) && isPlainObject(value)) {
      changes.push(...collectChanges(existing, value, replacePaths, target));
    } else if (!exists || !sameDocument(existing, value)) {
      changes.push({ path: target, action: exists ? 'replace' : 'add' });
    }
  }
  return changes;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

interface JsoncProperty {
  key: string;
  keyStart: number;
  valueStart: number;
  valueEnd: number;
}

interface JsoncObject {
  openBrace: number;
  closeBrace: number;
  properties: JsoncProperty[];
}

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

/** Preserve comments and unrelated formatting while changing only overlay-owned values. */
function renderMergedConfig(
  before: string | null,
  overlay: Record<string, unknown>,
  replacePaths: Set<string>,
  document: ConfigDoc,
): string {
  if (before === null) return `${JSON.stringify(document, null, 2)}\n`;
  const patched = patchJsoncObject(before, overlay, replacePaths);
  const parsed = parseJsonc<unknown>(patched, '<planned setup config>');
  if (!sameDocument(parsed, document)) {
    throw new Error('planned setup config did not preserve the merged document');
  }
  return patched.endsWith('\n') ? patched : `${patched}\n`;
}

function patchJsoncObject(
  input: string,
  overlay: Record<string, unknown>,
  replacePaths: Set<string>,
  prefix = '',
): string {
  const object = scanJsoncObject(input);
  const byKey = new Map(object.properties.map((property) => [property.key, property]));
  const edits: TextEdit[] = [];
  const missing: [string, unknown][] = [];

  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const target = prefix ? `${prefix}.${key}` : key;
    const property = byKey.get(key);
    if (!property) {
      missing.push([key, value]);
      continue;
    }
    const current = parseJsonc<unknown>(input.slice(property.valueStart, property.valueEnd));
    if (sameDocument(current, value)) continue;
    const replacement =
      !replacePaths.has(target) && isPlainObject(current) && isPlainObject(value)
        ? patchJsoncObject(input.slice(property.valueStart, property.valueEnd), value, replacePaths, target)
        : formatJsonValue(value, propertyIndent(input, property.keyStart));
    edits.push({ start: property.valueStart, end: property.valueEnd, text: replacement });
  }

  if (missing.length > 0) {
    const objectIndent = propertyIndent(input, object.openBrace);
    const keyIndent = object.properties[0]
      ? propertyIndent(input, object.properties[0].keyStart)
      : `${objectIndent}  `;
    const additions = missing
      .map(([key, value]) => `${keyIndent}${JSON.stringify(key)}: ${formatJsonValue(value, keyIndent)}`)
      .join(',\n');
    const beforeClose = input.slice(0, object.closeBrace);
    const leadingNewline = beforeClose.endsWith('\n') ? '' : '\n';
    edits.push({
      start: object.closeBrace,
      end: object.closeBrace,
      text: `${leadingNewline}${additions}\n${objectIndent}`,
    });

    const last = object.properties.at(-1);
    if (last && !hasCommaAfter(input, last.valueEnd, object.closeBrace)) {
      edits.push({ start: last.valueEnd, end: last.valueEnd, text: ',' });
    }
  }

  return applyTextEdits(input, edits);
}

function scanJsoncObject(input: string): JsoncObject {
  let cursor = skipTrivia(input, 0);
  if (input[cursor] !== '{') throw new Error('setup can merge only JSON objects');
  const openBrace = cursor++;
  const properties: JsoncProperty[] = [];

  while (cursor < input.length) {
    cursor = skipTrivia(input, cursor);
    if (input[cursor] === '}') return { openBrace, closeBrace: cursor, properties };
    if (input[cursor] !== '"') throw new Error('setup config contains an invalid object key');
    const keyStart = cursor;
    const keyEnd = scanString(input, cursor);
    const key = JSON.parse(input.slice(keyStart, keyEnd)) as string;
    cursor = skipTrivia(input, keyEnd);
    if (input[cursor] !== ':') throw new Error(`setup config key ${key} has no value`);
    cursor = skipTrivia(input, cursor + 1);
    const valueStart = cursor;
    const valueEnd = scanValue(input, cursor);
    properties.push({ key, keyStart, valueStart, valueEnd });
    cursor = skipTrivia(input, valueEnd);
    if (input[cursor] === ',') {
      cursor++;
      continue;
    }
    if (input[cursor] === '}') return { openBrace, closeBrace: cursor, properties };
    throw new Error(`setup config property ${key} is not followed by a comma or closing brace`);
  }
  throw new Error('setup config object is not closed');
}

function scanValue(input: string, start: number): number {
  const first = input[start];
  if (first === '"') return scanString(input, start);
  if (first === '{' || first === '[') return scanContainer(input, start);
  let cursor = start;
  while (cursor < input.length) {
    const char = input[cursor];
    if (char === ',' || char === '}' || char === ']' || /\s/.test(char ?? '')) break;
    if (char === '/' && (input[cursor + 1] === '/' || input[cursor + 1] === '*')) break;
    cursor++;
  }
  if (cursor === start) throw new Error('setup config contains an empty value');
  return cursor;
}

function scanContainer(input: string, start: number): number {
  const stack = [input[start]];
  let cursor = start + 1;
  while (cursor < input.length && stack.length > 0) {
    const char = input[cursor];
    const next = input[cursor + 1];
    if (char === '"') {
      cursor = scanString(input, cursor);
      continue;
    }
    if (char === '/' && next === '/') {
      cursor = skipLineComment(input, cursor + 2);
      continue;
    }
    if (char === '/' && next === '*') {
      cursor = skipBlockComment(input, cursor + 2);
      continue;
    }
    if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (stack.pop() !== expected) throw new Error('setup config contains mismatched brackets');
    }
    cursor++;
  }
  if (stack.length > 0) throw new Error('setup config contains an unclosed value');
  return cursor;
}

function scanString(input: string, start: number): number {
  let cursor = start + 1;
  while (cursor < input.length) {
    if (input[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (input[cursor] === '"') return cursor + 1;
    cursor++;
  }
  throw new Error('setup config contains an unclosed string');
}

function skipTrivia(input: string, start: number): number {
  let cursor = start;
  while (cursor < input.length) {
    if (/\s/.test(input[cursor] ?? '')) {
      cursor++;
      continue;
    }
    if (input[cursor] === '/' && input[cursor + 1] === '/') {
      cursor = skipLineComment(input, cursor + 2);
      continue;
    }
    if (input[cursor] === '/' && input[cursor + 1] === '*') {
      cursor = skipBlockComment(input, cursor + 2);
      continue;
    }
    break;
  }
  return cursor;
}

function skipLineComment(input: string, start: number): number {
  let cursor = start;
  while (cursor < input.length && input[cursor] !== '\n') cursor++;
  return cursor;
}

function skipBlockComment(input: string, start: number): number {
  const end = input.indexOf('*/', start);
  if (end === -1) throw new Error('setup config contains an unclosed block comment');
  return end + 2;
}

function propertyIndent(input: string, position: number): string {
  const lineStart = input.lastIndexOf('\n', position - 1) + 1;
  const prefix = input.slice(lineStart, position);
  return /^\s*$/.test(prefix) ? prefix : '  ';
}

function formatJsonValue(value: unknown, indent: string): string {
  return JSON.stringify(value, null, 2).replace(/\n/g, `\n${indent}`);
}

function hasCommaAfter(input: string, valueEnd: number, closeBrace: number): boolean {
  const cursor = skipTrivia(input, valueEnd);
  return cursor < closeBrace && input[cursor] === ',';
}

function applyTextEdits(input: string, edits: TextEdit[]): string {
  let result = input;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  }
  return result;
}

function sameDocument(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameDocument(value, right[index]))
    );
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return sameValue(leftKeys, rightKeys) && leftKeys.every((key) => sameDocument(left[key], right[key]));
  }
  return Object.is(left, right);
}
