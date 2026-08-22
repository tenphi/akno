import type { ConfigDoc, AknoConfig } from '../config/schema.ts';
import { ModelClient } from '../models/client.ts';
import { runLlmRankingProbe, type LlmRankingProbeReport } from '../bench/llm-ranking-probe.ts';

export const OPENAI_LUNA_PRESET = 'openai-luna';
export const OPENAI_LUNA_PRESET_STATUS = 'experimental';
export const OPENAI_LUNA_EMBEDDING_MODEL = 'text-embedding-3-small';
export const OPENAI_LUNA_GENERATIVE_MODEL = 'gpt-5.6-luna';
export const OPENAI_LUNA_EMBEDDING_DIMENSIONS = 1536;

export type SetupMaintenanceMode = 'audit' | 'review' | 'autonomous';

export interface OpenAiLunaPresetOptions {
  aknoPath: string;
  maintenance: SetupMaintenanceMode;
}

export interface SetupRolePreflight {
  status: 'ok' | 'unavailable' | 'failed';
  provider: string;
  model: string;
  error: string | null;
}

export interface OpenAiLunaPreflightReport {
  kind: 'openai_luna_preflight';
  preset: typeof OPENAI_LUNA_PRESET;
  presetStatus: typeof OPENAI_LUNA_PRESET_STATUS;
  passed: boolean;
  credentialPresent: boolean;
  embedding: SetupRolePreflight & { dimensions: number | null };
  generative: SetupRolePreflight & {
    promptVersion: string | null;
    schemaVersion: string | null;
    latencyMs: number;
  };
}

/**
 * The minimum is one endpoint and credential, not one model. The exact ranking window is
 * development evidence and remains explicitly experimental until the release artifact passes.
 */
export function openAiLunaPreset(options: OpenAiLunaPresetOptions): ConfigDoc {
  return {
    akno_path: options.aknoPath,
    providers: {
      openai: {
        base_url: 'https://api.openai.com/v1',
        api_key: { env: 'AKNO_OPENAI_API_KEY' },
      },
    },
    models: {
      embedding: {
        provider: 'openai',
        id: OPENAI_LUNA_EMBEDDING_MODEL,
        dimensions: OPENAI_LUNA_EMBEDDING_DIMENSIONS,
      },
      reranker: {
        provider: 'openai',
        id: OPENAI_LUNA_GENERATIVE_MODEL,
        enabled: true,
        mode: 'llm',
        exclude_irrelevant: true,
        top_k: 10,
        max_chars: 800,
        max_output_tokens: 256,
        reasoning_effort: 'none',
      },
      expansion: {
        provider: 'openai',
        id: OPENAI_LUNA_GENERATIVE_MODEL,
        reasoning_effort: 'none',
      },
      derive: {
        provider: 'openai',
        id: OPENAI_LUNA_GENERATIVE_MODEL,
        reasoning_effort: 'low',
      },
      vision: {
        provider: 'openai',
        id: OPENAI_LUNA_GENERATIVE_MODEL,
        enabled: true,
        reasoning_effort: 'low',
      },
    },
    maintenance: {
      profile: options.maintenance,
      model: {
        provider: 'openai',
        id: OPENAI_LUNA_GENERATIVE_MODEL,
        reasoning_effort: 'medium',
      },
    },
  };
}

/**
 * Sends only invented fixtures. A failed embedding check does not suppress the generative check:
 * setup needs to distinguish a credential outage from a project that permits Luna but denies every
 * embedding model, which otherwise looks like one vague provider failure.
 */
export async function preflightOpenAiLuna(config: AknoConfig): Promise<OpenAiLunaPreflightReport> {
  const provider = config.providers.openai ?? null;
  const credentialPresent = provider?.apiKey !== null && provider?.apiKey !== undefined;
  if (!provider || !credentialPresent) {
    const error = provider
      ? 'AKNO_OPENAI_API_KEY is not set'
      : 'the openai provider has no resolved endpoint';
    return {
      kind: 'openai_luna_preflight',
      preset: OPENAI_LUNA_PRESET,
      presetStatus: OPENAI_LUNA_PRESET_STATUS,
      passed: false,
      credentialPresent: false,
      embedding: {
        status: 'unavailable',
        provider: 'openai',
        model: OPENAI_LUNA_EMBEDDING_MODEL,
        dimensions: null,
        error,
      },
      generative: unavailableGenerative(error),
    };
  }

  const [embeddingResult, ranking] = await Promise.all([
    new ModelClient(config.models.embedding).embed(['The current Zephyr QX-100 warranty lasts five years.']),
    runLlmRankingProbe(config, {
      provider: 'openai',
      model: OPENAI_LUNA_GENERATIVE_MODEL,
      reasoningEffort: 'none',
    }),
  ]);
  const dimensions = embeddingResult.value?.[0]?.length ?? null;
  const embeddingPassed = embeddingResult.ok && dimensions === OPENAI_LUNA_EMBEDDING_DIMENSIONS;
  const embeddingError = embeddingPassed
    ? null
    : embeddingResult.error
      ? setupPreflightError(embeddingResult.error)
      : dimensions === null
        ? 'embedding response contained no vector'
        : `embedding response had ${dimensions} dimensions; expected ${OPENAI_LUNA_EMBEDDING_DIMENSIONS}`;
  const generative = generativePreflight(ranking);

  return {
    kind: 'openai_luna_preflight',
    preset: OPENAI_LUNA_PRESET,
    presetStatus: OPENAI_LUNA_PRESET_STATUS,
    passed: embeddingPassed && ranking.passed,
    credentialPresent: true,
    embedding: {
      status: embeddingPassed ? 'ok' : 'failed',
      provider: 'openai',
      model: OPENAI_LUNA_EMBEDDING_MODEL,
      dimensions,
      error: embeddingError,
    },
    generative,
  };
}

function unavailableGenerative(error: string): OpenAiLunaPreflightReport['generative'] {
  return {
    status: 'unavailable',
    provider: 'openai',
    model: OPENAI_LUNA_GENERATIVE_MODEL,
    promptVersion: null,
    schemaVersion: null,
    latencyMs: 0,
    error,
  };
}

function generativePreflight(ranking: LlmRankingProbeReport): OpenAiLunaPreflightReport['generative'] {
  return {
    status: ranking.passed ? 'ok' : 'failed',
    provider: ranking.provider,
    model: ranking.model,
    promptVersion: ranking.promptVersion,
    schemaVersion: ranking.schemaVersion,
    latencyMs: ranking.latencyMs,
    error: ranking.error ? setupPreflightError(ranking.error) : null,
  };
}

/** A setup receipt needs the actionable provider fact, not a pasted response body. */
export function setupPreflightError(value: string): string {
  const denied = value.match(
    /(\w+) endpoint returned (\d+)[\s\S]*does not have access to model [`"']?([^`"'\s\\]+)/i,
  );
  if (denied) {
    return `${denied[1]} endpoint returned ${denied[2]}: configured project does not have access to model ${denied[3]}`;
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= 300 ? compact : `${compact.slice(0, 299)}…`;
}
