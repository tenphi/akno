import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DegradedReason } from '@tenphi/akno-protocol';
import type { ReasoningEffort, ResolvedModelRole } from '../config/schema.ts';

/**
 * Any OpenAI-compatible endpoint, per role. One local server can host all
 * three. Nothing here knows about a specific provider — a role is a base URL, an
 * optional key, and a model id.
 *
 * Every method resolves rather than throws on a model failure, because the rule is
 * degrade, never fail: the caller needs to know it got nothing *and why*, so it
 * can report `degraded` instead of pretending the knowledge base is empty.
 */

/**
 * Why a model call failed, as a value. The alternative — reading it back out of
 * the human-readable `error` string with `includes('rerank')` — is a translation
 * layer that silently stops working the moment a message is reworded, on exactly
 * the path whose job is to report degradation honestly.
 */
export type ModelFailure = 'unavailable' | 'timeout' | 'request_failed' | 'bad_response';

export interface ModelOutcome<T> {
  ok: boolean;
  value: T | null;
  reason?: ModelFailure;
  /** Human-readable detail. For `doctor` and logs, never for control flow. */
  error?: string;
  latencyMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** An image handed to a vision model, with the mime type the endpoint needs. */
export interface ImagePart {
  data: Buffer;
  mime: string;
}

/**
 * Newer OpenAI models reject `max_tokens` and require `max_completion_tokens`;
 * older endpoints and every local llama-server accept only the former. Rather than
 * a config key nobody understands, the client tries one, notices the specific
 * complaint, and remembers the answer for the rest of the process.
 */
type TokenParam = 'max_tokens' | 'max_completion_tokens';
const UNSUPPORTED_MAX_TOKENS = /unsupported parameter.*max_tokens|use 'max_completion_tokens'/i;

/**
 * How this endpoint wants to be told the shape it must produce. Three rungs, tried in order
 * and learned once, because there are two incompatible dialects in the wild and this codebase
 * talks to both at the same time.
 *
 * - `schema` — llama.cpp's own `{"type":"json_object","schema":{…}}`, compiled to a GBNF
 *   grammar so the sampler *cannot* emit anything else.
 * - `json_schema` — OpenAI's `{"type":"json_schema","json_schema":{…,"strict":true}}`.
 * - `plain` — `{"type":"json_object"}` and a prompt that asks nicely. What shipped before
 *   this existed, and still the floor everything falls back to.
 *
 * **The order is chosen by which failure is detectable, not by which is more standard.**
 * llama.cpp rejects an unknown `response_format` shape loudly, so starting there and stepping
 * down is self-correcting: OpenAI answers the first probe with
 * `Unknown parameter: 'response_format.schema'` and the client never sends it again. The
 * reverse order is not safe — llama.cpp has a documented history of accepting `json_schema`
 * and then applying no constraint at all, which produces no error to learn from and would
 * leave the local roles silently unconstrained forever.
 *
 * The cost of getting it wrong is one rejected request per role per process. The cost of
 * being unable to detect it is every request, silently.
 */
type SchemaMode = 'schema' | 'json_schema' | 'plain';
/** The rungs in order, so a demotion can be checked for direction rather than assumed. */
const SCHEMA_RUNGS: readonly SchemaMode[] = ['schema', 'json_schema', 'plain'];
const UNSUPPORTED_SCHEMA = /response_format|unsupported.*schema|unknown parameter.*schema|invalid.*schema/i;

/** Statuses worth trying again. Everything else is a configuration error that a
 *  second identical request will reproduce exactly. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export class ModelClient {
  readonly #role: ResolvedModelRole;
  /** Learned on first rejection, then reused. Per client, so per role. */
  #tokenParam: TokenParam = 'max_tokens';
  /** Learned the same way, and for the same reason: one probe, then remembered. */
  #schemaMode: SchemaMode = 'schema';

  constructor(role: ResolvedModelRole) {
    this.#role = role;
  }

  get available(): boolean {
    return this.#role.enabled && this.#role.provider !== null && this.#role.id !== null;
  }

  get unavailableReason(): string | null {
    return this.#role.unavailableReason;
  }

  get modelId(): string | null {
    return this.#role.id;
  }

  get role(): ResolvedModelRole['role'] {
    return this.#role.role;
  }

  /** Native cross-encoder endpoint unless the role explicitly opts into prompted ranking. */
  get rerankerMode(): 'endpoint' | 'llm' {
    return this.#role.rerankerMode ?? 'endpoint';
  }

  get reasoningEffort(): ReasoningEffort | undefined {
    return this.#role.reasoningEffort;
  }

  /** Stable without including credentials; used only to key derived calibration data. */
  get endpointFingerprint(): string | null {
    if (!this.#role.provider || !this.#role.id) return null;
    return createHash('sha256')
      .update(
        [this.#role.role, this.#role.provider.name, this.#role.provider.baseUrl, this.#role.id].join('\0'),
      )
      .digest('hex');
  }

  /** True when the user asked for this role, whether or not it resolved. */
  get requested(): boolean {
    return this.#role.requested;
  }

  /** Maps an outcome onto the vocabulary a caller branches on. */
  degradedReason(outcome: { reason?: ModelFailure }): DegradedReason {
    return degradedReasonFor(this.#role.role, outcome.reason ?? 'unavailable');
  }

  private async post<T>(endpoint: string, body: unknown, timeoutMs?: number): Promise<ModelOutcome<T>> {
    const started = performance.now();
    if (!this.available || !this.#role.provider) {
      return {
        ok: false,
        value: null,
        reason: 'unavailable',
        error: this.#role.unavailableReason ?? 'model unavailable',
        latencyMs: 0,
      };
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...this.#role.provider.headers,
    };
    if (this.#role.provider.apiKey) headers.authorization = `Bearer ${this.#role.provider.apiKey}`;
    const payload = JSON.stringify(body);

    /**
     * **The two deadlines bound different things, so retrying spends them differently.**
     *
     * A `timeoutMs` passed by the caller bounds **felt latency** — something is waiting on this
     * answer. Only `expandQuery` passes one, and it does so precisely because a busy or cold
     * endpoint must cost a weaker search rather than a slow one. So it is the budget for the
     * whole sequence: retries fit inside it or do not happen, and a retrying recall can never
     * outlast one with retrying switched off.
     *
     * The role's `timeout_ms` bounds **an endpoint that has stopped answering** — a backstop,
     * not a target, and nothing is waiting on a background derivation. So it applies per
     * attempt. Making it a total instead quietly rewrote what an operator's 300s meant: a 500
     * arriving late into a long generation would leave the retry a fraction of the budget the
     * number was tuned for, turning "slow error, then retry" into "slow error, then a retry
     * that was set up to fail".
     *
     * What keeps the per-attempt side from running away is that a timeout is never retried, so
     * the common slow path still costs the deadline exactly once. Only HTTP statuses retry, and
     * the ones that occur — a rate limit, a busy llama-server — are refusals returned without
     * doing any work, which makes a real sequence backoff-dominated and measured in seconds.
     */
    const totalBudget = timeoutMs ?? null;
    const attemptDeadline = timeoutMs ?? this.#role.timeoutMs;
    const maxAttempts = 1 + this.#role.provider.maxRetries;
    let last: ModelOutcome<T> | null = null;

    for (let attempt = 1; ; attempt++) {
      // Rounded because `performance.now()` is fractional and `AbortSignal.timeout` rejects a
      // non-integer delay outright — which fails the request before it is sent, on every call.
      const remaining =
        totalBudget === null ? attemptDeadline : Math.ceil(totalBudget - (performance.now() - started));
      // Only reachable when a backoff consumed the budget between attempts; the
      // pre-sleep check below normally stops it getting here.
      if (remaining <= 0) break;

      let status: number | null = null;
      let retryAfter: string | null = null;

      try {
        const response = await fetch(`${this.#role.provider.baseUrl}${endpoint}`, {
          method: 'POST',
          headers,
          body: payload,
          // `AbortSignal.timeout` is self-clearing. A hand-rolled
          // setTimeout+AbortController leaks a pending timer on every request that
          // resolves before its deadline, which holds the event loop open for the
          // full timeout and turns a 40ms CLI command into a 60-second one.
          signal: AbortSignal.timeout(remaining),
        });

        if (response.ok) {
          return { ok: true, value: (await response.json()) as T, latencyMs: performance.now() - started };
        }

        status = response.status;
        retryAfter = response.headers.get('retry-after');
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        last = {
          ok: false,
          value: null,
          reason: 'request_failed',
          error: `${this.#role.role} endpoint returned ${status}${detail ? `: ${detail}` : ''}`,
          latencyMs: performance.now() - started,
        };
      } catch (err) {
        // `AbortSignal.timeout` rejects with TimeoutError, not AbortError.
        const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
        /**
         * **Neither a timeout nor a transport error is retried, and both omissions are
         * deliberate.**
         *
         * A timeout means this attempt spent its whole deadline without an answer, and the
         * callers that care already have a better move than repetition: `derivePage` falls back
         * to asking for the summary alone, which is cheaper *and* likelier to succeed than the
         * identical 2400-token request.
         *
         * A transport error is almost always a refused connection, meaning nothing is
         * listening. Retrying that triples how long `doctor` takes to report the one thing
         * the operator needs to hear.
         */
        return {
          ok: false,
          value: null,
          reason: timedOut ? 'timeout' : 'request_failed',
          error: withEarlier(
            timedOut
              ? `${this.#role.role} timed out after ${remaining}ms`
              : `${this.#role.role} request failed: ${err instanceof Error ? err.message : String(err)}`,
            last,
          ),
          latencyMs: performance.now() - started,
        };
      }

      if (attempt >= maxAttempts || status === null || !RETRYABLE_STATUS.has(status)) break;

      const wait = backoffMs(attempt, retryAfter, Math.random());
      // A backoff that would outlast a total budget is not a backoff, it is a slower failure.
      // With no total budget there is nothing for it to overrun — `backoffMs` caps itself.
      if (totalBudget !== null && performance.now() - started + wait >= totalBudget) break;
      await sleep(wait);
    }

    // Reached with `last` set on an exhausted or unretryable failure, and without it only when
    // a total budget ran out before a single attempt could be made.
    return (
      last ?? {
        ok: false,
        value: null,
        reason: 'timeout',
        error: `${this.#role.role} had no time left to call: ${attemptDeadline}ms was already spent`,
        latencyMs: performance.now() - started,
      }
    );
  }

  /**
   * Batched because embedding 223 pages one request at a time is dominated by
   * round trips, not by the model.
   */
  async embed(inputs: string[]): Promise<ModelOutcome<Float32Array[]>> {
    if (inputs.length === 0) return { ok: true, value: [], latencyMs: 0 };
    const result = await this.post<{ data: { embedding: number[] | string; index: number }[] }>(
      '/embeddings',
      { model: this.#role.id, input: inputs, encoding_format: 'float' },
    );
    if (!result.ok || !result.value) return { ...result, value: null };

    const vectors = new Array<Float32Array>(inputs.length);
    for (const entry of result.value.data) {
      const raw = entry.embedding;
      // A base64 body is legal for `encoding_format: "base64"` and some servers
      // send it regardless of what was asked for.
      const values = typeof raw === 'string' ? decodeBase64Floats(raw) : Float32Array.from(raw);
      vectors[entry.index ?? 0] = values;
    }
    if (vectors.some((v) => !v)) {
      return {
        ok: false,
        value: null,
        reason: 'bad_response',
        error: 'embedding response was missing entries',
        latencyMs: result.latencyMs,
      };
    }
    return { ok: true, value: vectors, latencyMs: result.latencyMs };
  }

  /** llama-server, TEI and vLLM all expose `/rerank` with this shape. */
  async rerank(
    query: string,
    documents: string[],
    topN?: number,
  ): Promise<ModelOutcome<{ index: number; score: number }[]>> {
    if (documents.length === 0) return { ok: true, value: [], latencyMs: 0 };
    const result = await this.post<{
      results: { index: number; relevance_score?: number; score?: number }[];
    }>('/rerank', { model: this.#role.id, query, documents, top_n: topN ?? documents.length });
    if (!result.ok || !result.value) return { ...result, value: null };
    const results = (result.value.results ?? []).map((entry) => ({
      index: entry.index,
      score: entry.relevance_score ?? entry.score ?? 0,
    }));
    return { ok: true, value: results, latencyMs: result.latencyMs };
  }

  async chat(
    messages: ChatMessage[],
    options: {
      json?: boolean;
      /**
       * The shape the prompt asks for, as a zod schema, sent so the endpoint can constrain
       * decoding to it. Implies `json`.
       *
       * It does not replace the caller's own validation and is not meant to: a schema can say
       * `line` is a number, but only `derivePage` knows it must be a line the model was
       * actually shown. Constrained decoding removes the *syntactic* failures — the fenced
       * prose, the trailing commentary, the object that stopped being JSON halfway through.
       */
      schema?: z.ZodType;
      maxTokens?: number;
      temperature?: number;
      timeoutMs?: number;
      /** Per-task override; otherwise the resolved role's setting is sent. */
      reasoningEffort?: ReasoningEffort;
      /** Attached to the last user message as image parts. */
      images?: ImagePart[];
    } = {},
  ): Promise<ModelOutcome<string>> {
    const wantsJson = options.json || options.schema !== undefined;
    // Built once: `z.toJSONSchema` is cheap but this sits on the recall path, and a
    // retry must send the identical schema rather than a second conversion of it.
    const jsonSchema = options.schema ? toEndpointSchema(options.schema) : null;

    const build = (tokenParam: TokenParam, schemaMode: SchemaMode): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        model: this.#role.id,
        messages: options.images?.length ? withImages(messages, options.images) : messages,
        [tokenParam]: tokenCeiling(options.maxTokens, this.#role.maxOutputTokens),
      };
      const reasoningEffort = options.reasoningEffort ?? this.#role.reasoningEffort;
      if (reasoningEffort) body.reasoning_effort = reasoningEffort;
      // Some reasoning models reject a non-default temperature outright, and the
      // value buys nothing here — every prompt in this codebase wants determinism.
      if (tokenParam === 'max_tokens') body.temperature = options.temperature ?? 0;
      // A small model free-forms its way out of a JSON contract given the chance.
      if (wantsJson) body.response_format = responseFormat(jsonSchema, schemaMode);
      return body;
    };

    let result: ModelOutcome<{ choices: { message?: { content?: string } }[] }>;
    // Three fixable mistakes at most — the token parameter, and two rungs down the schema
    // ladder — so four passes is the ceiling, not a budget anything grows into.
    for (let pass = 0; ; pass++) {
      // **What this attempt sent, captured before it goes out.**
      //
      // The retry decisions below used to read the shared fields back after the call, which is
      // only correct when one call is in flight. Concurrent calls all start with the same wrong
      // parameter and all fail; the first to notice corrects the field; and every other one then
      // asks "did I send `max_tokens`?", reads the field the winner just fixed, sees
      // `max_completion_tokens`, concludes the complaint was about something else, and gives up
      // holding a 400 whose fix was already known.
      //
      // Measured on this install at `derive.concurrency: 4`: a service restart cost the facts of
      // the first pages it derived, every time, because a failed derivation is stamped as derived
      // and never retried. The fix is one call's own state, not the endpoint's.
      const sentTokenParam = this.#tokenParam;
      const sentSchemaMode = this.#schemaMode;

      result = await this.post<{ choices: { message?: { content?: string } }[] }>(
        '/chat/completions',
        build(sentTokenParam, sentSchemaMode),
        options.timeoutMs,
      );
      if (result.ok || pass >= 3) break;

      // Each of these has a known, mechanical fix, and each is learned once for the
      // life of the process rather than rediscovered per call. Both assignments are safe to
      // repeat: they name the answer rather than stepping towards it.
      if (sentTokenParam === 'max_tokens' && UNSUPPORTED_MAX_TOKENS.test(result.error ?? '')) {
        this.#tokenParam = 'max_completion_tokens';
        continue;
      }
      if (jsonSchema && sentSchemaMode !== 'plain' && UNSUPPORTED_SCHEMA.test(result.error ?? '')) {
        // Demoted from the rung *this* attempt used. Reading the shared field instead would skip a
        // rung nobody tried — a call that sent `schema` while a concurrent one had already moved
        // the field to `json_schema` would jump straight to `plain`, and the whole process would
        // lose constrained decoding over a race rather than over an endpoint's actual limits.
        // Monotonic, so a demotion another call has already discovered is never undone.
        const next: SchemaMode = sentSchemaMode === 'schema' ? 'json_schema' : 'plain';
        if (SCHEMA_RUNGS.indexOf(next) > SCHEMA_RUNGS.indexOf(this.#schemaMode)) this.#schemaMode = next;
        continue;
      }
      break;
    }

    if (!result.ok || !result.value) return { ...result, value: null };
    const content = result.value.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return {
        ok: false,
        value: null,
        reason: 'bad_response',
        error: 'chat response had no content',
        latencyMs: result.latencyMs,
      };
    }
    return { ok: true, value: content, latencyMs: result.latencyMs };
  }

  /**
   * Model warmth dominates everything else — a cold embedding server costs
   * seconds, three orders of magnitude more than the entire database path. This
   * is what `serve` pings to keep the endpoint from going cold, and what
   * `doctor` measures so model latency is never confused with index latency.
   */
  async ping(): Promise<ModelOutcome<number>> {
    if (!this.available) {
      return {
        ok: false,
        value: null,
        reason: 'unavailable',
        error: this.#role.unavailableReason ?? 'unavailable',
        latencyMs: 0,
      };
    }
    if (this.#role.role === 'embedding') {
      const result = await this.embed(['ping']);
      return {
        ok: result.ok,
        value: result.ok ? result.latencyMs : null,
        ...(result.reason ? { reason: result.reason } : {}),
        ...(result.error ? { error: result.error } : {}),
        latencyMs: result.latencyMs,
      };
    }
    if (this.#role.role === 'reranker') {
      if (this.rerankerMode === 'llm') {
        const result = await this.chat(
          [{ role: 'user', content: 'Return JSON with exactly one field: {"ok":true}' }],
          { schema: z.object({ ok: z.boolean() }), maxTokens: 64 },
        );
        return {
          ok: result.ok,
          value: result.ok ? result.latencyMs : null,
          ...(result.reason ? { reason: result.reason } : {}),
          ...(result.error ? { error: result.error } : {}),
          latencyMs: result.latencyMs,
        };
      }
      const result = await this.rerank('ping', ['ping'], 1);
      return {
        ok: result.ok,
        value: result.ok ? result.latencyMs : null,
        ...(result.reason ? { reason: result.reason } : {}),
        ...(result.error ? { error: result.error } : {}),
        latencyMs: result.latencyMs,
      };
    }
    // Not 1 token. A reasoning model spends its budget on reasoning before emitting
    // anything, so a 1-token probe comes back as "output limit reached" and the role
    // reads as dead when it is perfectly healthy. 64 is still trivially cheap and
    // only ever runs on `doctor`.
    const result = await this.chat([{ role: 'user', content: 'Reply with: ok' }], { maxTokens: 64 });
    return {
      ok: result.ok,
      value: result.ok ? result.latencyMs : null,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
      latencyMs: result.latencyMs,
    };
  }
}

/**
 * The single place a model failure becomes the vocabulary a caller branches on.
 * `unavailable` means the role was never configured or is switched off — the
 * result is weaker but the knowledge base is intact; everything else means a
 * configured model did not answer, which an operator needs to see.
 */
/**
 * The lower of the two ceilings, not one or the other.
 *
 * They mean different things and both are limits. The call's value is what *this task* can possibly
 * need — 64 for a ping, 200 for a conflict verdict, 2400 for a full page derivation. The role's is
 * what *this deployment* is willing to be asked for. Honouring only the call made
 * `max_output_tokens` decorative for the biggest thing that should respect it; honouring only the
 * role would hand a 2400-token budget to a call that needs 200.
 *
 * A role configured below what a task needs truncates that task, which is the honest consequence of
 * configuring it that way — and the reason the committed default is set by what derivation's JSON
 * needs rather than by a round number.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps the failure that *caused* the retry attached to the failure that ended the call.
 *
 * Without it a retried rate limit that then times out is reported as a plain timeout, and the
 * two have opposite fixes: a timeout says raise the deadline or use a faster model, a 429 says
 * raise `max_retries` or slow the caller down. This string is what `doctor` prints and what
 * lands in an index warning, so the distinction has to survive as far as a person.
 */
function withEarlier<T>(message: string, earlier: ModelOutcome<T> | null): string {
  return earlier?.error ? `${message} — a previous attempt was retried after: ${earlier.error}` : message;
}

/** Base delay, doubling per attempt, before jitter. */
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 20_000;

/**
 * How long to wait before trying again.
 *
 * `Retry-After` is obeyed when a server sends one, because a rate limiter knows when its
 * window opens and guessing can only be wrong in both directions. Otherwise exponential with
 * **full** jitter — `random × window` rather than `window ± a bit`. That matters here
 * specifically: `derive.concurrency` runs several workers against one endpoint, and workers
 * that back off in lockstep rediscover the same 429 together. Spreading them across the whole
 * window is what actually clears the queue.
 *
 * `jitter` is a parameter rather than a call to `Math.random` so the behaviour is testable
 * without a clock.
 */
export function backoffMs(attempt: number, retryAfter: string | null, jitter: number): number {
  const stated = parseRetryAfter(retryAfter);
  if (stated !== null) return Math.min(stated, BACKOFF_CAP_MS);
  const window = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CAP_MS);
  return Math.round(window * jitter);
}

/** `Retry-After` is either delta-seconds or an HTTP date. Both are legal and both appear. */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  // A date already in the past means "now", not a negative sleep.
  return Math.max(0, at - Date.now());
}

/**
 * A zod schema as the JSON Schema an endpoint wants.
 *
 * `$schema` is stripped because it describes the *dialect* rather than the value, and a
 * strict endpoint rejects the key outright. draft-7 is asked for because that is what
 * llama.cpp's schema-to-GBNF converter reads.
 */
export function toEndpointSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<
    string,
    unknown
  >;
  return rest;
}

/** The `response_format` for a rung of the ladder. */
function responseFormat(
  jsonSchema: Record<string, unknown> | null,
  mode: SchemaMode,
): Record<string, unknown> {
  if (!jsonSchema || mode === 'plain') return { type: 'json_object' };
  if (mode === 'schema') return { type: 'json_object', schema: jsonSchema };
  return {
    type: 'json_schema',
    // The name is required and is not addressable from anywhere else, so it is a constant
    // rather than a per-call string nobody would ever look up.
    json_schema: { name: 'akno_response', strict: true, schema: jsonSchema },
  };
}

/**
 * Whether a JSON Schema satisfies OpenAI's strict mode: every property of every object listed
 * in that object's `required`, and `additionalProperties: false` throughout.
 *
 * This exists as a *test*, not as a runtime check. Strict mode rejects an optional property
 * outright, so a schema written with `.optional()` would take the `json_schema` rung out of
 * service for that one call site — quietly, because the fallback to plain `json_object` is
 * indistinguishable from success. `.nullable()` is the shape that expresses "may be absent"
 * and stays strict-safe, and every schema here is written that way on purpose.
 */
export function strictModeViolations(node: unknown, path = '$'): string[] {
  if (node === null || typeof node !== 'object') return [];
  const out: string[] = [];
  const record = node as Record<string, unknown>;

  if (record.type === 'object' && record.properties && typeof record.properties === 'object') {
    const properties = Object.keys(record.properties as Record<string, unknown>);
    const required = new Set(Array.isArray(record.required) ? (record.required as string[]) : []);
    const missing = properties.filter((property) => !required.has(property));
    if (missing.length > 0) out.push(`${path}: optional ${missing.join(', ')}`);
    if (record.additionalProperties !== false) out.push(`${path}: additionalProperties not false`);
  }

  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => out.push(...strictModeViolations(entry, `${path}.${key}[${index}]`)));
    } else if (value && typeof value === 'object') {
      out.push(...strictModeViolations(value, `${path}.${key}`));
    }
  }
  return out;
}

function tokenCeiling(perCall: number | undefined, perRole: number | undefined): number {
  const limits = [perCall, perRole].filter(
    (limit): limit is number => typeof limit === 'number' && Number.isFinite(limit) && limit > 0,
  );
  return limits.length > 0 ? Math.min(...limits) : 1024;
}

function degradedReasonFor(role: ResolvedModelRole['role'], failure: ModelFailure): DegradedReason {
  const unconfigured = failure === 'unavailable';
  switch (role) {
    case 'embedding':
      return unconfigured ? 'no_embedding_model' : 'embedding_failed';
    case 'reranker':
      return unconfigured ? 'no_reranker' : 'rerank_failed';
    case 'expansion':
      return unconfigured ? 'no_expansion_model' : 'expansion_failed';
    default:
      return unconfigured ? 'no_derive_model' : 'derive_failed';
  }
}

/**
 * Rewrites the last user message into the multipart form a vision endpoint wants.
 * Images go after the text, because a model reads the instruction first and every
 * prompt here tells it what to do with what follows.
 */
function withImages(messages: ChatMessage[], images: ImagePart[]): unknown[] {
  const out: unknown[] = messages.map((message) => ({ ...message }));
  for (let i = out.length - 1; i >= 0; i--) {
    const message = out[i] as ChatMessage;
    if (message.role !== 'user') continue;
    out[i] = {
      role: 'user',
      content: [
        { type: 'text', text: message.content },
        ...images.map((image) => ({
          type: 'image_url',
          image_url: { url: `data:${image.mime};base64,${image.data.toString('base64')}` },
        })),
      ],
    };
    return out;
  }
  // No user message to attach to: send the images as one.
  out.push({
    role: 'user',
    content: images.map((image) => ({
      type: 'image_url',
      image_url: { url: `data:${image.mime};base64,${image.data.toString('base64')}` },
    })),
  });
  return out;
}

function decodeBase64Floats(input: string): Float32Array {
  const buffer = Buffer.from(input, 'base64');
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

/**
 * A 3B instruct model will wrap JSON in prose, in a fence, or both. Extracting
 * the object rather than failing the parse is the difference between summaries
 * working and summaries being a coin flip.
 */
export function parseJsonLoose<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const candidates = [trimmed];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  // Direct parse *then* repair, per candidate, most-complete candidate first.
  // The order matters: repairing the whole body has to beat parsing a narrower
  // slice of it, or an inner array lifted out of a truncated object wins and the
  // caller silently receives `["lease","rent"]` where it expected the object.
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // The body was cut off mid-value because the model hit its token ceiling.
      // Everything before the cut is still valid, so closing what is open
      // recovers it — the difference between a long page getting most of its
      // facts and getting none.
      const repaired = closeTruncatedJson(candidate);
      if (repaired === null) continue;
      try {
        return JSON.parse(repaired) as T;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Recovers the longest parseable prefix of a truncated JSON body.
 *
 * Rather than guessing where a safe cut is, this records every position where a
 * value just completed — along with the bracket stack owed at that point — then
 * tries them newest-first and returns the first that actually parses. Validating
 * instead of guessing is what makes it correct around the two cases that break a
 * hand-rolled scanner: a bracket inside a string, and a cut immediately after an
 * object *key* (`{"a"` closes to `{"a"}`, which does not parse, so it falls back).
 *
 * Returns null when the input is not truncated JSON — a genuinely malformed body
 * must stay reported as malformed rather than becoming half an object.
 */
export function closeTruncatedJson(input: string): string | null {
  const start = input.search(/[{[]/);
  if (start === -1) return null;

  const stack: string[] = [];
  const candidates: { offset: number; closers: string }[] = [];
  let inString = false;
  let escaped = false;

  const mark = (offset: number): void => {
    if (stack.length > 0) {
      candidates.push({ offset, closers: [...stack].reverse().join('') });
    }
  };

  for (let i = start; i < input.length; i++) {
    const char = input[i]!;

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') {
        inString = false;
        // A string just closed. It may be a key, in which case this candidate
        // will fail to parse and a later attempt will use an earlier one.
        mark(i + 1);
      }
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{' || char === '[') stack.push(char === '{' ? '}' : ']');
    else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return null; // Mismatched: not a truncation.
      mark(i + 1);
    } else if (/[\d}\]eln]/.test(char) && !/[\d.eE+-]/.test(input[i + 1] ?? '')) {
      // End of a number or of `true`/`false`/`null`.
      mark(i + 1);
    }
  }

  // Nothing left open means the body was complete, and this function has no
  // business rewriting it.
  if (stack.length === 0) return null;

  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i]!;
    const repaired = input.slice(start, candidate.offset).replace(/,\s*$/, '') + candidate.closers;
    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      continue;
    }
  }
  return null;
}
