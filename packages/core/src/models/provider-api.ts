import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AknoConfig,
  ProviderApi,
  ProviderTransport,
  ResolvedModelRole,
  ResolvedProvider,
} from '../config/schema.ts';
import { redactProviderError } from './client.ts';
import { ProviderRequestError, requestConfiguredProvider } from './provider-request.ts';

export const PROVIDER_API_CACHE_FILE = 'provider-capabilities.json';
const PROVIDER_API_CACHE_VERSION = 1;
// Keep first service startup comfortably inside `redeploy`'s 30-second socket deadline.
const DEFAULT_PROBE_TIMEOUT_MS = 15_000;
const FAILED_PROBE_COOLDOWN_MS = 5 * 60_000;

interface ProviderApiCacheEntry {
  api: ProviderTransport | null;
  checked_at: string;
  retry_after?: string;
}

interface ProviderApiCache {
  version: typeof PROVIDER_API_CACHE_VERSION;
  entries: Record<string, ProviderApiCacheEntry>;
}

export interface ProviderApiResolution {
  provider: string;
  configured: ProviderApi;
  resolved: ProviderTransport | null;
  source: ResolvedProvider['apiResolution'];
  modelIds: string[];
  error: string | null;
}

interface TransportProbe {
  ok: boolean;
  status: number | null;
  error: string | null;
}

/**
 * Apply a previously learned transport without making a network request. The fingerprint binds
 * the result to the endpoint, authentication material, headers, and complete configured model set,
 * so changing any of them earns a fresh content-safe probe instead of inheriting a stale answer.
 */
export function applyCachedProviderApiResolutions(config: AknoConfig): void {
  const cache = readProviderApiCache(config.stateDir);
  for (const provider of Object.values(config.providers)) {
    if (provider.configuredApi !== 'auto' || provider.api !== 'auto') continue;
    const modelIds = generativeModelIds(config, provider);
    if (modelIds.length === 0) {
      provider.apiResolution = 'not_needed';
      provider.apiResolutionError = null;
      continue;
    }
    const entry = cache.entries[providerApiFingerprint(provider, modelIds)];
    if (!entry) continue;
    if (entry.api === null) {
      if (entry.retry_after && Date.parse(entry.retry_after) > Date.now()) {
        provider.apiResolution = 'deferred';
        provider.apiResolutionError =
          `the previous api:auto probe failed; retry after ${entry.retry_after} or run ` +
          '`akno doctor --refresh-api`';
      }
      continue;
    }
    provider.api = entry.api;
    provider.apiResolution = 'cached';
    provider.apiResolutionError = null;
  }
}

/**
 * Resolve every still-unresolved `api: auto` provider once. Only the invented probe is ever sent
 * across both transports; a real model call uses the selected adapter and never falls through.
 */
export async function resolveAutoProviderApis(
  config: AknoConfig,
  options: { timeoutMs?: number; refresh?: boolean } = {},
): Promise<ProviderApiResolution[]> {
  if (options.refresh) {
    for (const provider of Object.values(config.providers)) {
      if (provider.configuredApi !== 'auto') continue;
      provider.api = 'auto';
      provider.apiResolution = 'unresolved';
      provider.apiResolutionError = null;
    }
  } else {
    // Another process may have populated the cache after this config was loaded.
    applyCachedProviderApiResolutions(config);
  }
  const reports: ProviderApiResolution[] = [];

  for (const provider of Object.values(config.providers)) {
    const modelIds = generativeModelIds(config, provider);
    if (provider.configuredApi === 'auto' && modelIds.length === 0) {
      provider.apiResolution = 'not_needed';
      provider.apiResolutionError = null;
      reports.push(providerApiReport(provider, modelIds));
      continue;
    }
    if (provider.apiResolution === 'deferred' && !options.refresh) {
      reports.push(providerApiReport(provider, modelIds));
      continue;
    }
    if (provider.configuredApi !== 'auto' || provider.api !== 'auto') {
      reports.push(providerApiReport(provider, modelIds));
      continue;
    }

    const deadline = performance.now() + (options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
    const responses = await probeModels(provider, modelIds, 'responses', deadline);
    let selected: ProviderTransport | null = responses.ok ? 'responses' : null;
    let failure = responses;

    // Only an absent route licenses a second transport probe. Authentication, rate limits,
    // timeouts, server errors, and malformed successful responses are not evidence that Chat
    // Completions is the right API.
    if (!selected && unsupportedTransportRoute(responses)) {
      const chat = await probeModels(provider, modelIds, 'chat_completions', deadline);
      if (chat.ok) selected = 'chat_completions';
      else failure = chat;
    }

    if (!selected) {
      provider.apiResolutionError = compactProbeError(failure.error ?? 'transport probe failed');
      provider.apiResolution = 'unresolved';
      try {
        persistProviderApiFailure(config.stateDir, provider, modelIds);
        provider.apiResolution = 'deferred';
      } catch (error) {
        provider.apiResolutionError = compactProbeError(
          `${provider.apiResolutionError}; capability cooldown could not be persisted: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      reports.push(providerApiReport(provider, modelIds));
      continue;
    }

    provider.api = selected;
    provider.apiResolution = 'probed';
    provider.apiResolutionError = null;
    try {
      persistProviderApiResolution(config.stateDir, provider, modelIds, selected);
    } catch (error) {
      provider.apiResolutionError = compactProbeError(
        `resolved ${selected}, but could not persist the capability cache: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    reports.push(providerApiReport(provider, modelIds));
  }

  return reports;
}

/** Model IDs whose calls actually use a provider's generative transport. */
export function generativeModelIds(config: AknoConfig, provider: ResolvedProvider): string[] {
  const roles: (ResolvedModelRole | null)[] = [
    config.models.derive,
    config.models.expansion,
    config.models.answer,
    config.models.vision,
    config.maintenance.model,
    config.models.reranker.rerankerMode === 'llm' ? config.models.reranker : null,
  ];
  return [
    ...new Set(
      roles
        .filter(
          (role): role is ResolvedModelRole =>
            role !== null && role.enabled && role.provider === provider && role.id !== null,
        )
        .map((role) => role.id as string),
    ),
  ].sort();
}

export function providerApiReport(provider: ResolvedProvider, modelIds: string[]): ProviderApiResolution {
  return {
    provider: provider.name,
    configured: provider.configuredApi,
    resolved: provider.api === 'auto' ? null : provider.api,
    source: provider.apiResolution,
    modelIds,
    error: provider.apiResolutionError,
  };
}

function providerApiFingerprint(provider: ResolvedProvider, modelIds: string[]): string {
  const headers = Object.fromEntries(
    Object.entries(provider.headers).sort(([left], [right]) => left.localeCompare(right)),
  );
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: PROVIDER_API_CACHE_VERSION,
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        headers,
        modelIds,
      }),
    )
    .digest('hex');
}

async function probeModels(
  provider: ResolvedProvider,
  modelIds: string[],
  api: ProviderTransport,
  deadline: number,
): Promise<TransportProbe> {
  for (const modelId of modelIds) {
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) {
      return {
        ok: false,
        status: null,
        error: `${provider.name} api:auto probe exhausted its startup deadline`,
      };
    }
    const result = await probeTransport(provider, modelId, api, remaining);
    if (!result.ok) return result;
  }
  return { ok: true, status: 200, error: null };
}

async function probeTransport(
  provider: ResolvedProvider,
  modelId: string,
  api: ProviderTransport,
  timeoutMs: number,
): Promise<TransportProbe> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...provider.headers,
  };
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
  const body =
    api === 'responses'
      ? {
          model: modelId,
          input: 'Reply with the single word OK.',
          // Capability resolution must never create provider-side conversation state.
          store: false,
        }
      : {
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
        };
  const endpoint = api === 'responses' ? '/responses' : '/chat/completions';

  try {
    const { response } = await requestConfiguredProvider(provider.baseUrl, `${provider.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) {
      // Validate only the transport envelope. Higher-level `doctor` probes strict schemas and task
      // semantics; this boundary merely refuses a proxy's HTML 200 or the wrong API's JSON shape.
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      const validEnvelope =
        payload !== null &&
        (api === 'responses' ? Array.isArray(payload.output) : Array.isArray(payload.choices));
      if (!validEnvelope) {
        return {
          ok: false,
          status: response.status,
          error: `${provider.name} ${api} probe returned ${response.status} without a valid transport envelope`,
        };
      }
      return { ok: true, status: response.status, error: null };
    }
    const detail = redactProviderError(await response.text().catch(() => ''), [
      provider.apiKey ?? '',
      ...Object.values(provider.headers),
    ])
      .replace(/\s+/g, ' ')
      .trim();
    return {
      ok: false,
      status: response.status,
      error: `${provider.name} ${api} probe returned ${response.status}${
        detail ? `: ${detail.slice(0, 300)}` : ''
      }`,
    };
  } catch (error) {
    const timedOut =
      (error instanceof ProviderRequestError && error.timedOut) ||
      (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'));
    return {
      ok: false,
      status: null,
      error: timedOut
        ? `${provider.name} ${api} probe timed out after ${timeoutMs}ms`
        : `${provider.name} ${api} probe failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function unsupportedTransportRoute(probe: TransportProbe): boolean {
  return probe.status === 404 || probe.status === 405 || probe.status === 501;
}

function compactProbeError(value: string): string {
  const compact = redactProviderError(value).replace(/\s+/g, ' ').trim();
  return compact.length <= 400 ? compact : `${compact.slice(0, 399)}…`;
}

function readProviderApiCache(stateDir: string): ProviderApiCache {
  const empty = (): ProviderApiCache => ({ version: PROVIDER_API_CACHE_VERSION, entries: {} });
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(stateDir, PROVIDER_API_CACHE_FILE), 'utf8'));
  } catch {
    return empty();
  }
  if (!parsed || typeof parsed !== 'object') return empty();
  const record = parsed as { version?: unknown; entries?: unknown };
  if (
    record.version !== PROVIDER_API_CACHE_VERSION ||
    !record.entries ||
    typeof record.entries !== 'object'
  ) {
    return empty();
  }
  const entries: Record<string, ProviderApiCacheEntry> = {};
  for (const [key, value] of Object.entries(record.entries as Record<string, unknown>)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !value || typeof value !== 'object') continue;
    const entry = value as { api?: unknown; checked_at?: unknown; retry_after?: unknown };
    if (typeof entry.checked_at !== 'string') {
      continue;
    }
    if (entry.api === 'responses' || entry.api === 'chat_completions') {
      entries[key] = { api: entry.api, checked_at: entry.checked_at };
      continue;
    }
    if (entry.api === null && typeof entry.retry_after === 'string') {
      entries[key] = { api: null, checked_at: entry.checked_at, retry_after: entry.retry_after };
    }
  }
  return { version: PROVIDER_API_CACHE_VERSION, entries };
}

function persistProviderApiResolution(
  stateDir: string,
  provider: ResolvedProvider,
  modelIds: string[],
  api: ProviderTransport,
): void {
  persistProviderApiCacheEntry(stateDir, provider, modelIds, {
    api,
    checked_at: new Date().toISOString(),
  });
}

function persistProviderApiFailure(stateDir: string, provider: ResolvedProvider, modelIds: string[]): void {
  const now = Date.now();
  persistProviderApiCacheEntry(stateDir, provider, modelIds, {
    api: null,
    checked_at: new Date(now).toISOString(),
    retry_after: new Date(now + FAILED_PROBE_COOLDOWN_MS).toISOString(),
  });
}

function persistProviderApiCacheEntry(
  stateDir: string,
  provider: ResolvedProvider,
  modelIds: string[],
  entry: ProviderApiCacheEntry,
): void {
  fs.mkdirSync(stateDir, { recursive: true });
  const cache = readProviderApiCache(stateDir);
  cache.entries[providerApiFingerprint(provider, modelIds)] = entry;
  const target = path.join(stateDir, PROVIDER_API_CACHE_FILE);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(cache, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    const file = fs.openSync(temporary, 'r');
    try {
      fs.fsyncSync(file);
    } finally {
      fs.closeSync(file);
    }
    fs.renameSync(temporary, target);
    fs.chmodSync(target, 0o600);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // A successful rename removes the temporary name; a failed write is best-effort cleanup.
    }
  }
}
