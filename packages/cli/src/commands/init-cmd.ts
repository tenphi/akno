import fs from 'node:fs';
import {
  OPENAI_LUNA_PRESET,
  OPENAI_LUNA_PRESET_STATUS,
  openAiLunaPreset,
  preflightOpenAiLuna,
  type OpenAiLunaPreflightReport,
  type SetupMaintenanceMode,
} from '@tenphi/akno-core';
import { parse } from '../args.ts';
import { fail, heading, json, line, statusLabel, style } from '../output.ts';

const INIT_HELP = `akno init --preset openai-luna --akno-path <path> [options]

  Preview the experimental single-endpoint OpenAI setup. It uses one endpoint and
  credential, with text-embedding-3-small for embeddings and gpt-5.6-luna for
  generation and prompted reranking.

  This slice is deliberately preview-only: the preset cannot write configuration
  until its checked-in ranking release gate passes.

  --preset <name>       openai-luna.
  --maintenance <mode>  audit, review, or autonomous (default audit).
  --dry-run             Required. Print the exact configuration without writing it.
  --check               Send only invented fixtures to verify embedding access and
                        Luna's ranking transport/schema before setup.
  --json                Machine-readable, content-safe preview and preflight.`;

interface InitValues {
  preset?: string;
  maintenance?: string;
  'dry-run': boolean;
  check: boolean;
}

export async function initCommand(argv: string[]): Promise<number> {
  const { values } = parse<InitValues>(argv, {
    preset: { type: 'string' },
    maintenance: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
  });
  if (values.help) {
    line(INIT_HELP);
    return 0;
  }
  if (values.preset !== OPENAI_LUNA_PRESET) {
    fail(values.preset ? `unknown setup preset: ${values.preset}` : '--preset openai-luna is required');
    return 2;
  }
  const maintenance = setupMaintenanceMode(values.maintenance);
  if (!maintenance) {
    fail(`invalid maintenance mode: ${values.maintenance}`);
    return 2;
  }
  if (!values['akno-path']) {
    fail('--akno-path is required; setup never guesses which folder contains your knowledge base');
    return 2;
  }
  if (!values['dry-run']) {
    fail('openai-luna is experimental and preview-only; use --dry-run');
    line(style.grey('  Configuration and knowledge-base files were not changed.'));
    return 2;
  }

  const preset = openAiLunaPreset({
    aknoPath: values['akno-path'],
    maintenance,
  });
  const { loadConfig } = await import('@tenphi/akno-core');
  let resolved: ReturnType<typeof loadConfig>;
  try {
    resolved = loadConfig({
      isolated: true,
      aknoPath: values['akno-path'],
      overrides: preset,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (!readableKnowledgeBasePath(resolved.aknoPath)) {
    fail(`knowledge-base folder is not readable: ${resolved.aknoPath}`);
    return 2;
  }
  const preflight = values.check ? await preflightOpenAiLuna(resolved) : null;
  const preview = openAiInitPreview(resolved.aknoPath, maintenance, preset, preflight);

  if (values.json) json(preview);
  else renderOpenAiInitPreview(preview);
  return preflight && !preflight.passed ? 1 : 0;
}

export function openAiInitPreview(
  aknoPath: string,
  maintenance: SetupMaintenanceMode,
  config: ReturnType<typeof openAiLunaPreset>,
  preflight: OpenAiLunaPreflightReport | null,
) {
  return {
    kind: 'setup_preview' as const,
    preset: OPENAI_LUNA_PRESET,
    presetStatus: OPENAI_LUNA_PRESET_STATUS,
    writable: false,
    writeBlocker: 'the checked-in ranking release gate has not passed',
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
    config,
  };
}

function renderOpenAiInitPreview(preview: ReturnType<typeof openAiInitPreview>): void {
  heading('OpenAI minimum setup — experimental preview');
  line('  one endpoint, two models: dedicated embeddings plus GPT-5.6 Luna');
  line(`  knowledge base         ${preview.knowledgeBase.path}`);
  line(`  maintenance            ${preview.maintenance}`);
  line(`  configuration write    ${style.grey('blocked until the ranking release gate passes')}`);
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
  heading('Configuration that would be written');
  json(preview.config);
  line(style.grey('\nNo configuration, service, index, schedule, or knowledge-base file was changed.'));
}

function setupMaintenanceMode(value: string | undefined): SetupMaintenanceMode | null {
  if (value === undefined) return 'audit';
  return value === 'audit' || value === 'review' || value === 'autonomous' ? value : null;
}

export function readableKnowledgeBasePath(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory() && fs.accessSync(target, fs.constants.R_OK) === undefined;
  } catch {
    return false;
  }
}
