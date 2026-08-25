import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applySetupConfigWrite,
  MODEL_FREE_PRESET,
  MODEL_FREE_PRESET_STATUS,
  OPENAI_LUNA_PRESET,
  OPENAI_LUNA_PRESET_STATUS,
  modelFreePreset,
  openAiLunaPreset,
  planSetupConfigWrite,
  preflightOpenAiLuna,
  setupConfigTarget,
  type OpenAiLunaPreflightReport,
  type SetupConfigWritePlan,
  type SetupMaintenanceMode,
} from '@tenphi/akno-core';
import { parse } from '../args.ts';
import { fail, heading, json, line, statusLabel, style } from '../output.ts';
import {
  collectInteractiveInitAnswers,
  confirmInitAction,
  terminalInitPrompt,
  type InitPromptSession,
  type InitSetupChoice,
} from './init-prompts.ts';

const INIT_HELP = `akno init [--preset <name> --akno-path <path>] [options]

  Run without preset/path arguments in a terminal for guided setup, or provide both
  for non-interactive use. Choose the recommended single-endpoint OpenAI setup,
  explicitly disable all model roles, or preserve specialist roles for manual setup.

  --preset <name>       openai-luna or no-model.
  --maintenance <mode>  audit, review, or autonomous. Guided setup recommends one
                        from the use case; non-interactive default is audit.
  --dry-run             Print the exact overlay and path-only diff without writing.
  --force               Apply over an existing config after inspecting the diff.
  --check               Send only invented fixtures to verify embedding access and
                        Luna's ranking transport/schema before writing.
  --json                Machine-readable, content-safe preview or result.`;

interface InitValues {
  preset?: string;
  maintenance?: string;
  'dry-run': boolean;
  force: boolean;
  check: boolean;
}

interface InitCommandOptions {
  prompt?: InitPromptSession;
  interactive?: boolean;
}

export async function initCommand(argv: string[], options: InitCommandOptions = {}): Promise<number> {
  const { values } = parse<InitValues>(argv, {
    preset: { type: 'string' },
    maintenance: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
  });
  if (values.help) {
    line(INIT_HELP);
    return 0;
  }
  if (values.preset && values.preset !== OPENAI_LUNA_PRESET && values.preset !== MODEL_FREE_PRESET) {
    fail(`unknown setup preset: ${values.preset}`);
    return 2;
  }

  const needsGuidance = !values.preset || !values['akno-path'];
  let prompt = options.prompt;
  let ownsPrompt = false;
  try {
    if (needsGuidance) {
      if (values.json) {
        fail('--json setup is non-interactive; provide --preset <openai-luna|no-model> and --akno-path');
        return 2;
      }
      const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
      if (!prompt && !interactive) {
        fail('guided setup requires a terminal; provide --preset <openai-luna|no-model> and --akno-path');
        return 2;
      }
      if (!prompt) {
        prompt = terminalInitPrompt();
        ownsPrompt = true;
      }
    }

    let setup = values.preset as InitSetupChoice | undefined;
    let maintenance = setupMaintenanceMode(values.maintenance);
    if (!maintenance) {
      fail(`invalid maintenance mode: ${values.maintenance}`);
      return 2;
    }
    let aknoPath = values['akno-path'];
    if (needsGuidance) {
      const answers = await collectInteractiveInitAnswers(prompt!, {
        aknoPath,
        setup,
        maintenance: values.maintenance ? maintenance : undefined,
        readablePath: readableKnowledgeBasePath,
      });
      aknoPath = answers.aknoPath;
      setup = answers.setup;
      maintenance = answers.maintenance;
    }
    if (!aknoPath) {
      fail('--akno-path is required; setup never guesses which folder contains your knowledge base');
      return 2;
    }
    if (!setup) {
      fail('--preset is required for non-interactive setup');
      return 2;
    }
    if (values.check && setup !== OPENAI_LUNA_PRESET) {
      fail('--check is available only for the openai-luna preset');
      return 2;
    }

    const preset = setupPreset(setup, aknoPath, maintenance);
    const { loadConfig } = await import('@tenphi/akno-core');
    let resolved: ReturnType<typeof loadConfig>;
    let writePlan: SetupConfigWritePlan;
    try {
      const presetConfig = loadConfig({ isolated: true, aknoPath, overrides: preset });
      if (!readableKnowledgeBasePath(presetConfig.aknoPath)) {
        fail(`knowledge-base folder is not readable: ${presetConfig.aknoPath}`);
        return 2;
      }
      writePlan = planSetupConfigWrite(
        setupConfigTarget({ stateDir: values['state-dir'] }),
        preset,
        setupWriteOptions(setup),
      );
      resolved = loadConfig({ isolated: true, overrides: writePlan.document });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
      return 2;
    }
    if (!readableKnowledgeBasePath(resolved.aknoPath)) {
      fail(`knowledge-base folder is not readable: ${resolved.aknoPath}`);
      return 2;
    }

    let check = values.check;
    if (needsGuidance && setup === OPENAI_LUNA_PRESET) {
      const credentialPresent = Boolean(resolved.providers.openai?.apiKey);
      prompt!.say(
        credentialPresent
          ? 'AKNO_OPENAI_API_KEY is available. Its value will not be printed or stored.'
          : 'AKNO_OPENAI_API_KEY is not available. Setup can write the reference without storing a key.',
      );
      if (!check) {
        check = await confirmInitAction(
          prompt!,
          'Run the content-safe model preflight now?',
          credentialPresent,
        );
      }
    }
    const preflight = check ? await preflightOpenAiLuna(resolved) : null;
    const preview = setupInitPreview(setup, resolved.aknoPath, maintenance, preset, preflight, writePlan);

    if (values['dry-run']) {
      if (values.json) json(preview);
      else renderInitPreview(preview);
      return preflight && !preflight.passed ? 1 : 0;
    }
    if (preflight && !preflight.passed) {
      if (values.json) json(preview);
      else renderInitPreview(preview);
      fail('requested preflight failed; configuration was not written');
      return 1;
    }
    if (needsGuidance && writePlan.changed) {
      renderInitPreview(preview, { interactiveWrite: true });
      const confirmed = await confirmInitAction(
        prompt!,
        writePlan.existed ? 'Apply this configuration update?' : 'Write this configuration?',
        !writePlan.existed,
      );
      if (!confirmed) {
        line(style.grey('Setup cancelled; no configuration or knowledge-base file was changed.'));
        return 0;
      }
    } else if (writePlan.existed && writePlan.changed && !values.force) {
      if (values.json) json(preview);
      else renderInitPreview(preview);
      fail(
        `configuration already exists at ${writePlan.targetPath}; inspect the diff and rerun with --force`,
      );
      return 2;
    }

    try {
      const write = await applySetupConfigWrite(writePlan);
      const result = { ...preview, kind: 'setup_result' as const, applied: write.changed };
      if (values.json) json(result);
      else renderInitResult(result);
      return 0;
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
      return 1;
    }
  } finally {
    if (ownsPrompt) prompt?.close();
  }
}

export function openAiInitPreview(
  aknoPath: string,
  maintenance: SetupMaintenanceMode,
  config: ReturnType<typeof openAiLunaPreset>,
  preflight: OpenAiLunaPreflightReport | null,
  writePlan: SetupConfigWritePlan | null = null,
) {
  return setupInitPreview(OPENAI_LUNA_PRESET, aknoPath, maintenance, config, preflight, writePlan);
}

function setupInitPreview(
  setup: InitSetupChoice,
  aknoPath: string,
  maintenance: SetupMaintenanceMode,
  config: ReturnType<typeof openAiLunaPreset>,
  preflight: OpenAiLunaPreflightReport | null,
  writePlan: SetupConfigWritePlan | null = null,
) {
  return {
    kind: 'setup_preview' as const,
    preset: setup,
    presetStatus:
      setup === OPENAI_LUNA_PRESET
        ? OPENAI_LUNA_PRESET_STATUS
        : setup === MODEL_FREE_PRESET
          ? MODEL_FREE_PRESET_STATUS
          : ('manual' as const),
    writable: true,
    writeBlocker: preflight && !preflight.passed ? 'the requested model preflight did not pass' : null,
    applied: false,
    knowledgeBase: {
      path: aknoPath,
      readable: true,
      willModify: false,
    },
    maintenance,
    maintenanceAuthority: maintenanceAuthorityCopy(setup, maintenance),
    endpointCount: setup === OPENAI_LUNA_PRESET ? 1 : setup === MODEL_FREE_PRESET ? 0 : null,
    modelCount: setup === OPENAI_LUNA_PRESET ? 2 : setup === MODEL_FREE_PRESET ? 0 : null,
    credential:
      setup === OPENAI_LUNA_PRESET
        ? { env: 'AKNO_OPENAI_API_KEY', present: preflight?.credentialPresent ?? null }
        : null,
    preflight,
    write: writePlan
      ? {
          path: writePlan.targetPath,
          exists: writePlan.existed,
          changed: writePlan.changed,
          requiresForce: writePlan.existed && writePlan.changed,
          preservesUnknownKeys: true,
          changes: writePlan.changes,
        }
      : null,
    config,
  };
}

function renderInitPreview(
  preview: ReturnType<typeof setupInitPreview>,
  options: { interactiveWrite?: boolean } = {},
): void {
  const copy = setupCopy(preview.preset);
  heading(copy.title);
  line(`  ${copy.summary}`);
  line(`  knowledge base         ${preview.knowledgeBase.path}`);
  line(`  maintenance            ${preview.maintenance}`);
  line(`  maintenance authority  ${preview.maintenanceAuthority}`);
  if (preview.write) {
    line(`  configuration          ${preview.write.path}`);
    line(
      `  configuration write    ${
        preview.write.changed
          ? preview.write.exists
            ? style.yellow(
                options.interactiveWrite ? 'update; confirmation required' : 'update; --force required',
              )
            : style.green('create')
          : style.green('already matches')
      }`,
    );
  }
  line(`  knowledge-base writes  ${style.green('none')}`);
  if (preview.preflight) {
    heading('Preflight — invented fixtures only');
    line(
      `  embedding              ${statusLabel(preview.preflight.embedding.status)} ` +
        `${preview.preflight.embedding.model}`,
    );
    if (preview.preflight.embedding.error) {
      line(style.grey(`    ${preview.preflight.embedding.error}`));
    }
    line(
      `  generation + ranking   ${statusLabel(preview.preflight.generative.status)} ` +
        `${preview.preflight.generative.model}`,
    );
    if (preview.preflight.generative.error) {
      line(style.grey(`    ${preview.preflight.generative.error}`));
    }
  }
  if (preview.write?.changes.length) {
    heading('Configuration diff — values omitted');
    for (const change of preview.write.changes) {
      line(`  ${change.action === 'add' ? '+' : '~'} ${change.path}`);
    }
  }
  heading('Configuration overlay');
  json(preview.config);
  line(style.grey('\nNo configuration, service, index, schedule, or knowledge-base file was changed.'));
}

function renderInitResult(
  result: Omit<ReturnType<typeof setupInitPreview>, 'kind'> & {
    kind: 'setup_result';
    applied: boolean;
  },
): void {
  const copy = setupCopy(result.preset);
  heading(copy.title);
  line(`  ${copy.summary}`);
  line(`  knowledge base         ${result.knowledgeBase.path}`);
  line(`  maintenance            ${result.maintenance}`);
  line(`  maintenance authority  ${result.maintenanceAuthority}`);
  line(`  configuration          ${result.write?.path ?? '-'}`);
  line(
    `  configuration write    ${result.applied ? style.green('written atomically') : style.green('already matched')}`,
  );
  line(`  knowledge-base writes  ${style.green('none')}`);
  line(style.grey('\nNext: akno index'));
  line(style.grey('Then: akno recall "Zephyr warranty"'));
  line(style.grey('Check: akno doctor'));
  line(style.grey('Safe maintenance trial: akno dream --mode audit'));
  line(style.grey('Optional background service: akno service install'));
}

function setupPreset(
  setup: InitSetupChoice,
  aknoPath: string,
  maintenance: SetupMaintenanceMode,
): ReturnType<typeof openAiLunaPreset> {
  if (setup === OPENAI_LUNA_PRESET) return openAiLunaPreset({ aknoPath, maintenance });
  if (setup === MODEL_FREE_PRESET) return modelFreePreset({ aknoPath, maintenance });
  return { akno_path: aknoPath, maintenance: { profile: maintenance } };
}

function setupWriteOptions(setup: InitSetupChoice): { replacePaths: string[] } {
  if (setup === OPENAI_LUNA_PRESET) {
    return { replacePaths: ['providers', 'models', 'maintenance.model'] };
  }
  if (setup === MODEL_FREE_PRESET) return { replacePaths: ['models', 'maintenance.model'] };
  return { replacePaths: [] };
}

function setupCopy(setup: InitSetupChoice): { title: string; summary: string } {
  if (setup === OPENAI_LUNA_PRESET) {
    return {
      title: 'OpenAI minimum setup — recommended',
      summary: 'one endpoint, two models: dedicated embeddings plus GPT-5.6 Luna',
    };
  }
  if (setup === MODEL_FREE_PRESET) {
    return {
      title: 'Model-free setup',
      summary: 'lexical retrieval; every model role disabled; existing provider definitions retained',
    };
  }
  return {
    title: 'Specialist/manual setup',
    summary: 'knowledge-base and maintenance settings only; existing provider and model roles retained',
  };
}

function maintenanceAuthorityCopy(setup: InitSetupChoice, maintenance: SetupMaintenanceMode): string {
  if (setup === MODEL_FREE_PRESET) {
    if (maintenance === 'audit') return 'reports only; model-dependent phases are unavailable';
    if (maintenance === 'review') {
      return 'deterministic proposals wait for approval; model-dependent phases are unavailable';
    }
    return 'eligible deterministic work may apply; model-dependent phases are unavailable';
  }
  if (maintenance === 'audit') return 'plans and reports only; no maintenance writes';
  if (maintenance === 'review') return 'exact proposed diffs wait for human approval';
  return 'a separate curator may apply policy-eligible guarded diffs when dream runs';
}

function setupMaintenanceMode(value: string | undefined): SetupMaintenanceMode | null {
  if (value === undefined) return 'audit';
  return value === 'audit' || value === 'review' || value === 'autonomous' ? value : null;
}

export function readableKnowledgeBasePath(target: string): boolean {
  try {
    const expanded =
      target === '~'
        ? os.homedir()
        : target.startsWith('~/')
          ? path.join(os.homedir(), target.slice(2))
          : target;
    const resolved = path.resolve(expanded);
    return fs.statSync(resolved).isDirectory() && fs.accessSync(resolved, fs.constants.R_OK) === undefined;
  } catch {
    return false;
  }
}
