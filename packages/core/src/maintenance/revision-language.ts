import type { MaintenanceOperation } from './plans.ts';

/** Keep exact authored bytes exempt, including transfers within the sealed operation set. */
export function revisionLanguageProse(value: unknown, original: readonly MaintenanceOperation[]): string[] {
  if (!value || typeof value !== 'object' || !('operations' in value) || !Array.isArray(value.operations))
    throw new Error('invalid revision language input');
  const allowed = new Map(
    original.filter((op) => op.type === 'create' || op.type === 'replace').map((op) => [op.relPath, op]),
  );
  const returned = new Map<string, string>();
  for (const op of value.operations) {
    if (
      !op ||
      typeof op !== 'object' ||
      typeof op.rel_path !== 'string' ||
      typeof op.after !== 'string' ||
      !allowed.has(op.rel_path) ||
      returned.has(op.rel_path)
    )
      throw new Error('invalid revision language operation');
    returned.set(op.rel_path, op.after);
  }
  if (!returned.size) throw new Error('empty revision language operations');

  const preserved = new Map<string, number>();
  for (const op of original) {
    if (op.type !== 'replace' && op.type !== 'delete') continue;
    for (const line of exactLines(op.before)) preserved.set(line, (preserved.get(line) ?? 0) + 1);
  }
  const consume = (line: string): boolean => {
    const count = preserved.get(line) ?? 0;
    if (!count) return false;
    preserved.set(line, count - 1);
    return true;
  };
  // Unrevised destinations still use their sealed after-state. Reserve their original copies
  // first, so a revision cannot exempt an extra copy merely by returning only one destination.
  for (const op of allowed.values()) {
    if (!returned.has(op.relPath)) exactLines(op.after).forEach(consume);
  }
  return [...returned.values()].flatMap((after) => {
    const added = exactLines(after)
      .filter((line) => !consume(line) && line.trim())
      .join('');
    return added.trim() ? [added] : [];
  });
}

function exactLines(text: string): string[] {
  // Keep line endings: normalizing whitespace here would excuse a rewrite as copied source.
  return text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}
