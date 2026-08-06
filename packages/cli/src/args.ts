import { parseArgs, type ParseArgsConfig } from 'node:util';

/**
 * Flags shared by every command. `--akno-path` and `--state-dir` exist so a
 * one-shot invocation can point at a different knowledge base without editing a
 * config file — useful for tests and for a second knowledge base you touch rarely.
 */
const GLOBAL_OPTIONS = {
  'akno-path': { type: 'string' as const },
  'state-dir': { type: 'string' as const },
  json: { type: 'boolean' as const, default: false },
  /** Talk to a running `akno serve` instead of opening the index in-process. */
  connect: { type: 'boolean' as const, default: false },
  help: { type: 'boolean' as const, short: 'h', default: false },
} satisfies NonNullable<ParseArgsConfig['options']>;

export interface Parsed<T = Record<string, unknown>> {
  values: T & {
    'akno-path'?: string;
    'state-dir'?: string;
    json?: boolean;
    connect?: boolean;
    help?: boolean;
  };
  positionals: string[];
}

/**
 * Node's `parseArgs` has no `--no-flag` negation, so every boolean option that
 * defaults to true gets an explicit `--no-<name>` twin registered here and
 * folded back into the positive name. Without this, `--no-watch` parses as an
 * unknown option — which is a worse failure than it looks, because the user
 * asked for *less* behaviour and got an error instead.
 */
function withNegations(
  options: NonNullable<ParseArgsConfig['options']>,
): NonNullable<ParseArgsConfig['options']> {
  const out = { ...options };
  for (const [name, option] of Object.entries(options)) {
    if (option.type !== 'boolean' || option.default !== true) continue;
    out[`no-${name}`] = { type: 'boolean', default: false };
  }
  return out;
}

/**
 * Rewrites `--name value` into `--name=value` for declared string options.
 *
 * Node's `parseArgs` refuses a value that starts with `-`, calling it ambiguous —
 * which makes `--append "- Rent: 1111 EUR"` an error. A Markdown list item is the
 * most ordinary thing anyone appends to a knowledge base, so the parser has to
 * cope with it rather than the user having to know about `=`.
 */
function attachValues(argv: string[], declared: NonNullable<ParseArgsConfig['options']>): string[] {
  const isDeclared = (token: string): boolean => {
    if (!token.startsWith('--')) return false;
    const name = token.slice(2).split('=')[0]!;
    return name in declared || name.startsWith('no-');
  };

  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    const name = token.startsWith('--') ? token.slice(2) : null;
    const option = name && !name.includes('=') ? declared[name] : undefined;

    if (option?.type === 'string' && i + 1 < argv.length) {
      const next = argv[i + 1]!;
      // Only claim the next token if it is not itself a flag. A string option
      // missing its value should still be reported as missing.
      if (!isDeclared(next)) {
        out.push(`${token}=${next}`);
        i++;
        continue;
      }
    }
    out.push(token);
  }
  return out;
}

export function parse<T = Record<string, unknown>>(
  argv: string[],
  options: NonNullable<ParseArgsConfig['options']> = {},
): Parsed<T> {
  const declared: NonNullable<ParseArgsConfig['options']> = { ...GLOBAL_OPTIONS, ...options };
  const result = parseArgs({
    args: attachValues(argv, declared),
    options: withNegations(declared),
    allowPositionals: true,
    // A typo should say so rather than being silently ignored, which with a
    // command like `forget` is the difference between a no-op and a surprise.
    strict: true,
  });

  const values = { ...result.values } as Record<string, unknown>;
  for (const [name, option] of Object.entries(declared)) {
    if (option.type !== 'boolean' || option.default !== true) continue;
    if (values[`no-${name}`]) values[name] = false;
    delete values[`no-${name}`];
  }

  return { values: values as Parsed<T>['values'], positionals: result.positionals };
}

/** `open()` options derived from the global flags. */
export function openOptionsFrom(values: Parsed['values']): { aknoPath?: string; stateDir?: string } {
  return {
    ...(values['akno-path'] ? { aknoPath: values['akno-path'] } : {}),
    ...(values['state-dir'] ? { stateDir: values['state-dir'] } : {}),
  };
}
