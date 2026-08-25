import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applySetupConfigWrite,
  OPENAI_LUNA_PRESET,
  OPENAI_LUNA_PRESET_STATUS,
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
} from './init-prompts.ts';

const INIT_HELP = `akno init [--preset openai-luna --akno-path <path>] [options]

  Run without preset/path arguments in a terminal for guided setup, or provide both
  for non-interactive use. The recommended single-endpoint OpenAI setup uses one
  credential, with text-embedding-3-small for embeddings and gpt-5.6-luna for
  generation and prompted reranking.

  --preset <name>       openai-luna.
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
  if (values.preset && values.preset !== OPENAI_LUNA_PRESET) {
    fail(`unknown setup preset: ${values.preset}`);
    return 2;
  }

  const needsGuidance = !values.preset || !values['akno-path'];
  let prompt = options.prompt;
  let ownsPrompt = false;
  try {
    if (needsGuidance) {
      if (values.json) {
        fail('--json setup is non-interactive; provide --preset openai-luna and --akno-path');
        return 2;
      }
      const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
      if (!prompt && !interactive) {
        fail('guided setup requires a terminal; provide --preset openai-luna and --akno-path');
        return 2;
      }
      if (!prompt) {
        prompt = terminalInitPrompt();
        ownsPrompt = true;
      }
    }

    let maintenance = setupMaintenanceMode(values.maintenance);
    if (!maintenance) {
      fail(`invalid maintenance mode: ${values.maintenance}`);
      return 2;
    }
    let aknoPath = values['akno-path'];
    if (needsGuidance) {
      const answers = await collectInteractiveInitAnswers(prompt!, {
        aknoPath,
        maintenance: values.maintenance ? maintenance : undefined,
        readablePath: readableKnowledgeBasePath,
      });
      aknoPath = answers.aknoPath;
      maintenance = answers.maintenance;
    }
    if (!aknoPath) {
      fail('--akno-path is required; setup never guesses which folder contains your knowledge base');
      return 2;
    }

    const preset = openAiLunaPreset({ aknoPath, maintenance });
    const { loadConfig } = await import('@tenphi/akno-core');
    let resolved: ReturnType<typeof loadConfig>;
    let writePlan: SetupConfigWritePlan;
    try {
      const presetConfig = loadConfig({ isolated: true, aknoPath, overrides: preset });
      if (!readableKnowledgeBasePath(presetConfig.aknoPath)) {
        fail(`knowledge-base folder is not readable: ${presetConfig.aknoPath}`);
        return 2;
      }
      writePlan = planSetupConfigWrite(setupConfigTarget({ stateDir: values['state-dir'] }), preset, {
        replacePaths: ['providers', 'models', 'maintenance.model'],
      });
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
    if (needsGuidance) {
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
    const preview = openAiInitPreview(resolved.aknoPath, maintenance, preset, preflight, writePlan);

    if (values['dry-run']) {
      if (values.json) json(preview);
      else renderOpenAiInitPreview(preview);
      return preflight && !preflight.passed ? 1 : 0;
    }
    if (preflight && !preflight.passed) {
      if (values.json) json(preview);
      else renderOpenAiInitPreview(preview);
      fail('requested preflight failed; configuration was not written');
      return 1;
    }
    if (needsGuidance && writePlan.changed) {
      renderOpenAiInitPreview(preview, { interactiveWrite: true });
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
      else renderOpenAiInitPreview(preview);
      fail(
        `configuration already exists at ${writePlan.targetPath}; inspect the diff and rerun with --force`,
      );
      return 2;
    }

    try {
      const write = await applySetupConfigWrite(writePlan);
      const result = { ...preview, kind: 'setup_result' as const, applied: write.changed };
      if (values.json) json(result);
      else renderOpenAiInitResult(result);
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
  return {
    kind: 'setup_preview' as const,
    preset: OPENAI_LUNA_PRESET,
    presetStatus: OPENAI_LUNA_PRESET_STATUS,
    writable: true,
    writeBlocker: preflight && !preflight.passed ? 'the requested model preflight did not pass' : null,
    applied: false,
    knowledgeBase: {
      path: aknoPath,
      readable: true,
      willModify: false,
    },
    maintenance,
    endpointCount: 1,
    modelCount: 2,
    credential: { env: 'AKNO_OPENAI_API_KEY', present: preflight?.credentialPresent ?? null },
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

function renderOpenAiInitPreview(
  preview: ReturnType<typeof openAiInitPreview>,
  options: { interactiveWrite?: boolean } = {},
): void {
  heading('OpenAI minimum setup — recommended');
  line('  one endpoint, two models: dedicated embeddings plus GPT-5.6 Luna');
  line(`  knowledge base         ${preview.knowledgeBase.path}`);
  line(`  maintenance            ${preview.maintenance}`);
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
  heading('Preset overlay');
  json(preview.config);
  line(style.grey('\nNo configuration, service, index, schedule, or knowledge-base file was changed.'));
}

function renderOpenAiInitResult(
  result: Omit<ReturnType<typeof openAiInitPreview>, 'kind'> & {
    kind: 'setup_result';
    applied: boolean;
  },
): void {
  heading('OpenAI minimum setup — recommended');
  line('  one endpoint, two models: dedicated embeddings plus GPT-5.6 Luna');
  line(`  knowledge base         ${result.knowledgeBase.path}`);
  line(`  maintenance            ${result.maintenance}`);
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
