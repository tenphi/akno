import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line } from '../output.ts';
import type {
  AknoConfig,
  MaintenanceMigrationPlan,
  ResolvedModelRole,
  ResolvedProvider,
} from '@tenphi/akno-core';

const CONFIG_HELP = `akno config
akno config migrate --remove-custom [--check]

  The resolved configuration and the files it came from, with secrets redacted.
  Use this to check that config/local.jsonc is actually being read.

  migrate --remove-custom
        Convert removed phase authority into an explicit profile and complete policy
        matrix. The preview is content-safe and never changes knowledge-base files.
  --check
        Inspect and print the migration without writing configuration.`;

export async function configCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ 'remove-custom': boolean; check: boolean }>(argv, {
    'remove-custom': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
  });
  if (values.help) {
    line(CONFIG_HELP);
    return 0;
  }

  if (positionals[0] === 'migrate') {
    if (positionals.length !== 1 || !values['remove-custom']) {
      line(CONFIG_HELP);
      return 1;
    }
    const { applyMaintenanceConfigMigration, planMaintenanceConfigMigration } =
      await import('@tenphi/akno-core');
    const plan = planMaintenanceConfigMigration({ stateDir: values['state-dir'] });
    if (!values.check && plan.required) await applyMaintenanceConfigMigration(plan);
    const output = migrationForOutput(plan, values.check);
    if (values.json) json(output);
    else printMigration(output);
    return 0;
  }
  if (positionals.length > 0 || values['remove-custom'] || values.check) {
    line(CONFIG_HELP);
    return 1;
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

interface MaintenanceMigrationOutput {
  outcome: 'not_required' | 'migration_required' | 'migrated';
  resulting_profile: MaintenanceMigrationPlan['profile'];
  policies: MaintenanceMigrationPlan['policies'];
  policy_counts: MaintenanceMigrationPlan['policyCounts'];
  legacy_keys: string[];
  source_files: number;
  changed_files: number;
  converted_direct_writes: string[];
  knowledge_base_files_changed: 0;
}

export function migrationForOutput(
  plan: MaintenanceMigrationPlan,
  check: boolean,
): MaintenanceMigrationOutput {
  return {
    outcome: !plan.required ? 'not_required' : check ? 'migration_required' : 'migrated',
    resulting_profile: plan.profile,
    policies: plan.policies,
    policy_counts: plan.policyCounts,
    legacy_keys: plan.legacyKeys,
    source_files: plan.sourceFiles,
    changed_files: plan.changedFiles,
    converted_direct_writes: plan.convertedDirectWrites,
    knowledge_base_files_changed: 0,
  };
}

function printMigration(output: MaintenanceMigrationOutput): void {
  heading('Maintenance configuration migration');
  if (output.outcome === 'not_required') {
    line('  No removed maintenance authority was found.');
    return;
  }
  kv([
    ['outcome', output.outcome],
    ['resulting profile', output.resulting_profile],
    ['configuration files', output.changed_files],
    ['knowledge-base files', 0],
  ]);
  line(
    `  policies  ${output.policy_counts.auto} auto · ${output.policy_counts.review} review · ` +
      `${output.policy_counts.audit} audit · ${output.policy_counts.off} off`,
  );
  if (output.converted_direct_writes.length > 0) {
    line(`  direct writes moved behind plans  ${output.converted_direct_writes.join(', ')}`);
  }
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
