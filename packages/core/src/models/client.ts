import type { ResolvedModelRole } from '../config/schema.js';

/**
 * §14. Any OpenAI-compatible endpoint, per role. One local server can host all
 * three. Nothing here knows about a specific provider — a role is a base URL, an
 * optional key, and a model id.
 *
 * Every method resolves rather than throws on a model failure, because §2 says
 * degrade, never fail: the caller needs to know it got nothing *and why*, so it
 * can report `degraded` instead of pretending the knowledge base is empty.
 */

export interface ModelOutcome<T> {
  ok: boolean;
  value: T | null;
  /** Present on failure. Surfaced verbatim in `doctor` and in `degraded`. */
  error?: string;
  latencyMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ModelClient {
  constructor(private readonly role: ResolvedModelRole) {}

  get available(): boolean {
    return this.role.enabled && this.role.provider !== null && this.role.id !== null;
  }

  get unavailableReason(): string | null {
    return this.role.unavailableReason;
  }

  get modelId(): string | null {
    return this.role.id;
  }

  private async post<T>(endpoint: string, body: unknown, timeoutMs?: number): Promise<ModelOutcome<T>> {
    const started = performance.now();
    if (!this.available || !this.role.provider) {
      return { ok: false, value: null, error: this.role.unavailableReason ?? 'model unavailable', latencyMs: 0 };
    }

    const controller = new AbortController();
    // Cleared in `finally`: an uncleared abort timer keeps the event loop alive
    // for the full timeout after the request has already resolved, which turns a
    // 40ms CLI command into a 60-second one.
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.role.timeoutMs);
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...this.role.provider.headers,
      };
      if (this.role.provider.apiKey) headers.authorization = `Bearer ${this.role.provider.apiKey}`;

      const response = await fetch(`${this.role.provider.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        return {
          ok: false,
          value: null,
          error: `${this.role.role} endpoint returned ${response.status}${detail ? `: ${detail}` : ''}`,
          latencyMs: performance.now() - started,
        };
      }
      return { ok: true, value: (await response.json()) as T, latencyMs: performance.now() - started };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        value: null,
        error: aborted
          ? `${this.role.role} timed out after ${timeoutMs ?? this.role.timeoutMs}ms`
          : `${this.role.role} request failed: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: performance.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Batched because embedding 223 pages one request at a time is dominated by
   * round trips, not by the model.
   */
  async embed(inputs: string[]): Promise<ModelOutcome<Float32Array[]>> {
    if (inputs.length === 0) return { ok: true, value: [], latencyMs: 0 };
    const result = await this.post<{ data: { embedding: number[] | string; index: number }[] }>(
      '/embeddings',
      { model: this.role.id, input: inputs, encoding_format: 'float' },
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
      return { ok: false, value: null, error: 'embedding response was missing entries', latencyMs: result.latencyMs };
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
    const result = await this.post<{ results: { index: number; relevance_score?: number; score?: number }[] }>(
      '/rerank',
      { model: this.role.id, query, documents, top_n: topN ?? documents.length },
    );
    if (!result.ok || !result.value) return { ...result, value: null };
    const results = (result.value.results ?? []).map((entry) => ({
      index: entry.index,
      score: entry.relevance_score ?? entry.score ?? 0,
    }));
    return { ok: true, value: results, latencyMs: result.latencyMs };
  }

  async chat(
    messages: ChatMessage[],
    options: { json?: boolean; maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
  ): Promise<ModelOutcome<string>> {
    const body: Record<string, unknown> = {
      model: this.role.id,
      messages,
      max_tokens: options.maxTokens ?? this.role.maxOutputTokens ?? 1024,
      temperature: options.temperature ?? 0,
    };
    // A 3B model free-forms its way out of a JSON contract given the chance.
    if (options.json) body.response_format = { type: 'json_object' };

    const result = await this.post<{ choices: { message?: { content?: string } }[] }>(
      '/chat/completions',
      body,
      options.timeoutMs,
    );
    if (!result.ok || !result.value) return { ...result, value: null };
    const content = result.value.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, value: null, error: 'chat response had no content', latencyMs: result.latencyMs };
    }
    return { ok: true, value: content, latencyMs: result.latencyMs };
  }

  /**
   * §6. Model warmth dominates everything else — a cold embedding server costs
   * seconds, three orders of magnitude more than the entire database path. This
   * is what `serve` pings to keep the endpoint from going cold, and what
   * `doctor` measures so model latency is never confused with index latency.
   */
  async ping(): Promise<ModelOutcome<number>> {
    if (!this.available) {
      return { ok: false, value: null, error: this.role.unavailableReason ?? 'unavailable', latencyMs: 0 };
    }
    if (this.role.role === 'embedding') {
      const result = await this.embed(['ping']);
      return { ok: result.ok, value: result.ok ? result.latencyMs : null, error: result.error, latencyMs: result.latencyMs };
    }
    if (this.role.role === 'reranker') {
      const result = await this.rerank('ping', ['ping'], 1);
      return { ok: result.ok, value: result.ok ? result.latencyMs : null, error: result.error, latencyMs: result.latencyMs };
    }
    const result = await this.chat([{ role: 'user', content: 'ok' }], { maxTokens: 1 });
    return { ok: result.ok, value: result.ok ? result.latencyMs : null, error: result.error, latencyMs: result.latencyMs };
  }
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
