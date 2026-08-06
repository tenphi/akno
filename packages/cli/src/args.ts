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

export function parse<T = Record<string, unknown>>(
  argv: string[],
  options: NonNullable<ParseArgsConfig['options']> = {},
): Parsed<T> {
  const declared: NonNullable<ParseArgsConfig['options']> = { ...GLOBAL_OPTIONS, ...options };
  const result = parseArgs({
    args: argv,
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
