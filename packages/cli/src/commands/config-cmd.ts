import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line } from '../output.ts';
import type { AknoConfig, ResolvedModelRole, ResolvedProvider } from '@tenphi/akno-core';

const CONFIG_HELP = `akno config
  The resolved configuration and the files it came from, with secrets redacted.
  Use this to check that config/local.jsonc is actually being read.`;

export async function configCommand(argv: string[]): Promise<number> {
  const { values } = parse(argv);
  if (values.help) {
    line(CONFIG_HELP);
    return 0;
  }

  const { loadConfig } = await import('@tenphi/akno-core');
  const config = loadConfig(openOptionsFrom(values));

  const redacted = configForOutput(config);

  if (values.json) {
    json(redacted);
    return 0;
  }

  heading('Sources, lowest precedence first');
  for (const source of config.sources) {
    line(`  ${source.replace(process.env.HOME ?? '~', '~')}`);
  }
  heading('Resolved');
  json(redacted);
  return 0;
}

/** Redaction is not optional: this output is routinely pasted into bug reports. */
export function configForOutput(config: AknoConfig): unknown {
  const projected = {
    ...config,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([name, provider]) => [name, providerForOutput(provider)]),
    ),
    models: Object.fromEntries(
      Object.entries(config.models).map(([role, model]) => [role, modelForOutput(model)]),
    ),
    maintenance: {
      ...config.maintenance,
      model: config.maintenance.model ? modelForOutput(config.maintenance.model) : null,
    },
  };
  // Keep a final recursive boundary even though known provider/model shapes are projected above.
  // A newly nested credential must fail closed instead of waiting for another hand-written branch.
  return redactSecrets(projected);
}

function providerForOutput(provider: ResolvedProvider): Record<string, unknown> {
  return {
    ...provider,
    apiKey: provider.apiKey === null ? null : '<set>',
    headers: Object.keys(provider.headers),
  };
}

function modelForOutput(model: ResolvedModelRole): Record<string, unknown> {
  return { ...model, provider: model.provider?.name ?? null };
}

const SECRET_FIELDS = new Set([
  'apikey',
  'authorization',
  'password',
  'secret',
  'clientsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'bearertoken',
]);

/** Defensive recursive redaction for future config fields and plugin/provider extensions. */
export function redactSecrets(value: unknown, field = ''): unknown {
  const normalized = field.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (SECRET_FIELDS.has(normalized)) return value === null || value === undefined ? value : '<set>';
  if (Array.isArray(value)) return value.map((entry) => redactSecrets(entry));
  if (value && typeof value === 'object') {
    if (normalized === 'headers') return Object.keys(value as Record<string, unknown>);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactSecrets(entry, key),
      ]),
    );
  }
  return value;
}
