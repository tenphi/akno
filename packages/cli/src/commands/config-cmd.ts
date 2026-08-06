import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line } from '../output.ts';

const CONFIG_HELP = `akno config

  The resolved configuration and the files it came from, with secrets redacted.
  Use this to check that config/local.jsonc is actually being read.`;

export async function configCommand(argv: string[]): Promise<number> {
  const { values } = parse(argv);
  if (values.help) {
    line(CONFIG_HELP);
    return 0;
  }

  const { loadConfig } = await import('@akno/core');
  const config = loadConfig(openOptionsFrom(values));

  // Redaction is not optional: this output goes into bug reports.
  const redacted = {
    ...config,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([name, provider]) => [
        name,
        { ...provider, apiKey: provider.apiKey ? '<set>' : null, headers: Object.keys(provider.headers) },
      ]),
    ),
    models: Object.fromEntries(
      Object.entries(config.models).map(([role, model]) => [
        role,
        { ...model, provider: model.provider ? model.provider.name : null },
      ]),
    ),
  };

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
