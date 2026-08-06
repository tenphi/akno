import fs from 'node:fs';

/**
 * Minimal JSONC reader: strips `//` and block comments, then JSON.parse.
 * Comments matter here — the committed default config is documentation as much
 * as configuration, and a format that cannot hold a comment forces that
 * explanation somewhere the reader will not be looking.
 */
export function stripJsonComments(input: string): string {
  let out = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === '"') {
      out += ch;
      i++;
      while (i < len) {
        const c = input[i]!;
        out += c;
        if (c === '\\' && i + 1 < len) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        if (c === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < len && input[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len - 1 && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/** Trailing commas are legal in JSONC and a constant nuisance in a hand-edited file. */
function stripTrailingCommas(input: string): string {
  return input.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonc<T = unknown>(content: string, label = '<string>'): T {
  try {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content))) as T;
  } catch (err) {
    throw new Error(`${label} is not valid JSON/JSONC: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Returns null when the file is absent, and throws when it exists but is
 * malformed. A config file that silently reverts to defaults because of a
 * missing brace is a very expensive kind of quiet.
 */
export function readJsoncFile<T = unknown>(filePath: string): T | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return parseJsonc<T>(content, filePath);
}
