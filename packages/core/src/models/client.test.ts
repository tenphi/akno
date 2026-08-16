import http from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  ModelClient,
  backoffMs,
  closeTruncatedJson,
  parseJsonLoose,
  parseRetryAfter,
  strictModeViolations,
  toEndpointSchema,
} from './client.ts';
import type { ResolvedModelRole } from '../config/schema.ts';
import { DERIVED_SCHEMA, DOCUMENT_SUMMARY_SCHEMA, SUMMARY_ONLY_SCHEMA } from '../index/derive.ts';
import { QUERIES_SCHEMA, QUESTION_SCHEMA } from '../recall/expand.ts';
import { RETAIN_SCHEMA } from '../write/retain.ts';
import { PLACEMENT_SCHEMA } from '../write/placement.ts';
import { NAME_SCHEMA } from '../ingest/name.ts';
import { VERIFY_SCHEMA as CONFLICT_VERIFY_SCHEMA } from '../maintenance/conflicts.ts';
import { OBSERVE_SCHEMA } from '../maintenance/observe.ts';
import { CHOOSE_SCHEMA, REWRITE_SCHEMA } from '../maintenance/repair.ts';
import {
  HYGIENE_SCHEMA,
  SYNTHESIZE_SCHEMA,
  VERIFY_SCHEMA as CURATE_VERIFY_SCHEMA,
} from '../maintenance/curate.ts';

describe('parseJsonLoose', () => {
  it('parses clean JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON from a fenced block', () => {
    expect(parseJsonLoose('Here you go:\n```json\n{"a":1}\n```\nHope that helps!')).toEqual({ a: 1 });
  });

  it('extracts JSON wrapped in prose', () => {
    expect(parseJsonLoose('Sure. {"summary":"x"} Let me know.')).toEqual({ summary: 'x' });
  });

  it('returns null for something that is not JSON at all', () => {
    expect(parseJsonLoose('I cannot help with that.')).toBeNull();
  });

  /**
   * The failure this recovers: a small model given a long page hits its token
   * ceiling mid-array. Everything before the cut is valid, so a page went from
   * "no summary and no facts" to "summary and most of its facts".
   */
  it('recovers a body truncated mid-array', () => {
    const truncated =
      '{"summary":"A lease page.","keywords":["lease","rent"],"facts":[' +
      '{"line":7,"claim":"The rent is 1111 EUR."},' +
      '{"line":8,"claim":"The lease renews on 2027-06-02."},' +
      '{"line":9,"claim":"The landl';
    const parsed = parseJsonLoose<{ summary: string; facts: { line: number; claim?: string }[] }>(truncated);
    expect(parsed?.summary).toBe('A lease page.');
    // Both complete facts survive with their line numbers intact.
    expect(parsed?.facts[0]).toEqual({ line: 7, claim: 'The rent is 1111 EUR.' });
    expect(parsed?.facts[1]).toEqual({ line: 8, claim: 'The lease renews on 2027-06-02.' });
    // The element the cut landed inside keeps whatever was complete and loses the
    // rest. `cleanFacts` then drops it for having no claim, so a half-read fact
    // never reaches the index — recovery does not have to be lossless to be safe.
    expect(parsed?.facts.at(-1)?.claim).toBeUndefined();
  });

  it('recovers a body truncated mid-string', () => {
    const parsed = parseJsonLoose<{ summary: string; keywords: string[] }>(
      '{"summary":"complete","keywords":["a","b"],"note":"cut off here',
    );
    expect(parsed?.summary).toBe('complete');
    expect(parsed?.keywords).toEqual(['a', 'b']);
  });
});

describe('closeTruncatedJson', () => {
  it('closes an open array and object', () => {
    expect(closeTruncatedJson('{"a":[1,2')).toBe('{"a":[1,2]}');
  });

  it('drops a trailing comma before closing', () => {
    expect(closeTruncatedJson('{"a":[1,2,')).toBe('{"a":[1,2]}');
  });

  it('leaves complete JSON alone — it has no business rewriting it', () => {
    expect(closeTruncatedJson('{"a":1}')).toBeNull();
  });

  it('refuses genuinely mismatched brackets rather than guessing', () => {
    // A malformed body must stay reported as malformed, not become half an object.
    expect(closeTruncatedJson('{"a":[1,2}]')).toBeNull();
  });

  it('returns null when there is no complete element to keep', () => {
    expect(closeTruncatedJson('{"a')).toBeNull();
    expect(closeTruncatedJson('not json')).toBeNull();
  });

  it('is not confused by brackets inside strings', () => {
    const repaired = closeTruncatedJson('{"a":"}]{[","b":[1');
    expect(repaired).toBe('{"a":"}]{[","b":[1]}');
    expect(JSON.parse(repaired!)).toEqual({ a: '}]{[', b: [1] });
  });

  it('is not confused by an escaped quote', () => {
    const repaired = closeTruncatedJson('{"a":"say \\"hi\\"","b":[2');
    expect(JSON.parse(repaired!)).toEqual({ a: 'say "hi"', b: [2] });
  });
});

/**
 * A request's token ceiling comes from two places that mean different things, and the request has
 * to respect both. The call says what the *task* can need; the role config says what the
 * *deployment* is willing to be asked for. Honouring only the call is how
 * `models.derive.max_output_tokens` ended up decorative for page derivation — the one caller it
 * most obviously governs.
 */
describe('the token ceiling', () => {
  const server = { calls: [] as Record<string, unknown>[] };

  async function sentBody(
    roleCap: number | undefined,
    callCap: number | undefined,
  ): Promise<Record<string, unknown>> {
    server.calls = [];
    const instance = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        server.calls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
      });
    });
    await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const { port } = instance.address() as { port: number };
    try {
      const client = new ModelClient({
        role: 'derive',
        provider: {
          name: 'stub',
          baseUrl: `http://127.0.0.1:${port}/v1`,
          apiKey: null,
          headers: {},
          maxRetries: 0,
        },
        id: 'stub',
        enabled: true,
        requested: true,
        timeoutMs: 5_000,
        unavailableReason: null,
        ...(roleCap === undefined ? {} : { maxOutputTokens: roleCap }),
      });
      await client.chat(
        [{ role: 'user', content: 'hi' }],
        callCap === undefined ? {} : { maxTokens: callCap },
      );
      return server.calls[0]!;
    } finally {
      instance.close();
      instance.closeAllConnections();
    }
  }

  it('sends the lower of the two when both are set', async () => {
    // A conflict verdict asks for 200 against a role that allows 2400: 200 is what it needs.
    expect((await sentBody(2400, 200)).max_tokens).toBe(200);
    // A page derivation asks for 2400 against a role capped at 800: the operator's cap wins, and
    // truncation is the stated consequence of setting it there.
    expect((await sentBody(800, 2400)).max_tokens).toBe(800);
  });

  it('uses whichever one is set on its own', async () => {
    expect((await sentBody(1500, undefined)).max_tokens).toBe(1500);
    expect((await sentBody(undefined, 300)).max_tokens).toBe(300);
  });

  it('falls back to 1024 when neither is set', async () => {
    expect((await sentBody(undefined, undefined)).max_tokens).toBe(1024);
  });

  it('ignores a nonsensical cap rather than sending it', async () => {
    // A zero or negative cap in config would otherwise become `max_tokens: 0` and every call would
    // return nothing, with no error to explain why.
    expect((await sentBody(0, 500)).max_tokens).toBe(500);
    expect((await sentBody(-1, undefined)).max_tokens).toBe(1024);
  });
});

describe('parseRetryAfter', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(' 12 ')).toBe(12000);
  });

  it('reads an HTTP date', () => {
    const at = new Date(Date.now() + 5_000).toUTCString();
    // Second precision in the header, so the answer lands near 5s rather than on it.
    expect(parseRetryAfter(at)).toBeGreaterThan(3_500);
    expect(parseRetryAfter(at)).toBeLessThanOrEqual(6_000);
  });

  it('reads a date already past as "now" rather than as a negative sleep', () => {
    expect(parseRetryAfter(new Date(Date.now() - 60_000).toUTCString())).toBe(0);
  });

  it('ignores an absent or unparseable value', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

describe('backoffMs', () => {
  it('doubles the window per attempt', () => {
    // Jitter pinned to 1 so the window itself is what is being measured.
    expect(backoffMs(1, null, 1)).toBe(500);
    expect(backoffMs(2, null, 1)).toBe(1000);
    expect(backoffMs(3, null, 1)).toBe(2000);
  });

  it('spreads across the whole window, not around its edge', () => {
    // Full jitter: workers that back off in lockstep rediscover the same 429 together.
    expect(backoffMs(3, null, 0)).toBe(0);
    expect(backoffMs(3, null, 0.5)).toBe(1000);
  });

  it('caps the window however many attempts have gone by', () => {
    expect(backoffMs(20, null, 1)).toBe(20_000);
  });

  it('obeys Retry-After over its own guess', () => {
    // A rate limiter knows when its window opens; guessing can only be wrong both ways.
    expect(backoffMs(1, '7', 1)).toBe(7000);
    expect(backoffMs(9, '600', 1)).toBe(20_000);
  });
});

/**
 * Every schema is sent to two endpoint dialects, and OpenAI's strict mode rejects an optional
 * property outright. A rejected schema does not fail loudly — it drops that call site to a
 * plain JSON request, which is indistinguishable from success. So this is checked here rather
 * than discovered by noticing derivation got worse.
 */
describe('every schema stays strict-mode safe', () => {
  const schemas = {
    DERIVED_SCHEMA,
    SUMMARY_ONLY_SCHEMA,
    DOCUMENT_SUMMARY_SCHEMA,
    QUERIES_SCHEMA,
    QUESTION_SCHEMA,
    RETAIN_SCHEMA,
    PLACEMENT_SCHEMA,
    NAME_SCHEMA,
    CONFLICT_VERIFY_SCHEMA,
    OBSERVE_SCHEMA,
    CHOOSE_SCHEMA,
    REWRITE_SCHEMA,
    HYGIENE_SCHEMA,
    SYNTHESIZE_SCHEMA,
    CURATE_VERIFY_SCHEMA,
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} lists every property as required`, () => {
      expect(strictModeViolations(toEndpointSchema(schema))).toEqual([]);
    });
  }

  it('strips the dialect marker, which a strict endpoint rejects as an unknown key', () => {
    expect(toEndpointSchema(DOCUMENT_SUMMARY_SCHEMA)).not.toHaveProperty('$schema');
  });

  it('catches an optional property rather than passing everything', () => {
    // The guard has to be able to fail, or it is only asserting that it ran.
    expect(
      strictModeViolations({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' } },
        required: ['a'],
        additionalProperties: false,
      }),
    ).toEqual(['$: optional b']);
  });
});

/**
 * A rate limit is the one model failure that is *expected* to clear on its own. The rest of
 * this file's contract still holds around it: the deadline is the budget for the whole
 * sequence, so nothing here can make a call slower than it was before retrying existed.
 */
describe('retrying a rate limit', () => {
  interface Reply {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
    /** Held open this long before answering, to provoke the deadline. */
    delayMs?: number;
  }

  async function withServer(
    replies: Reply[],
    role: Partial<ResolvedModelRole>,
    run: (client: ModelClient) => Promise<unknown>,
    maxRetries = 2,
  ): Promise<{ requests: Record<string, unknown>[]; result: unknown }> {
    const requests: Record<string, unknown>[] = [];
    const instance = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
        // The last reply repeats, so a test only lists what it cares about.
        const reply = replies[Math.min(requests.length - 1, replies.length - 1)]!;
        const answer = (): void => {
          response.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
          response.end(JSON.stringify(reply.body ?? { choices: [{ message: { content: '{"ok":true}' } }] }));
        };
        if (reply.delayMs) setTimeout(answer, reply.delayMs).unref();
        else answer();
      });
    });
    await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const { port } = instance.address() as { port: number };
    try {
      const client = new ModelClient({
        role: 'derive',
        provider: {
          name: 'stub',
          baseUrl: `http://127.0.0.1:${port}/v1`,
          apiKey: null,
          headers: {},
          maxRetries,
        },
        id: 'stub',
        enabled: true,
        requested: true,
        timeoutMs: 5_000,
        unavailableReason: null,
        ...role,
      } as ResolvedModelRole);
      return { requests, result: await run(client) };
    } finally {
      instance.close();
      instance.closeAllConnections();
    }
  }

  const ask = (client: ModelClient): Promise<unknown> => client.chat([{ role: 'user', content: 'hi' }]);

  it('tries again after a 429 and returns the answer', async () => {
    const { requests, result } = await withServer(
      [{ status: 429, headers: { 'retry-after': '0' } }, { status: 200 }],
      {},
      ask,
    );
    expect(requests).toHaveLength(2);
    expect(result).toMatchObject({ ok: true, value: '{"ok":true}' });
  });

  it('tries again after a transient 503', async () => {
    const { requests, result } = await withServer(
      [{ status: 503, headers: { 'retry-after': '0' } }, { status: 200 }],
      {},
      ask,
    );
    expect(requests).toHaveLength(2);
    expect(result).toMatchObject({ ok: true });
  });

  it('gives up after max_retries and reports the last failure', async () => {
    const { requests, result } = await withServer(
      [{ status: 429, headers: { 'retry-after': '0' } }],
      {},
      ask,
    );
    // 1 + max_retries, and not one more.
    expect(requests).toHaveLength(3);
    expect(result).toMatchObject({ ok: false, reason: 'request_failed' });
    expect((result as { error: string }).error).toContain('429');
  });

  it('never retries a 4xx that a second identical request would reproduce', async () => {
    const { requests, result } = await withServer([{ status: 401 }], {}, ask);
    expect(requests).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, reason: 'request_failed' });
  });

  it('does not retry when a caller-supplied budget has no room for the backoff', async () => {
    // A caller-supplied deadline bounds felt latency, so a retrying call can never outlast the
    // same call with retrying off. `expandQuery` depends on exactly this.
    const { requests } = await withServer([{ status: 429, headers: { 'retry-after': '30' } }], {}, (client) =>
      client.chat([{ role: 'user', content: 'hi' }], { timeoutMs: 400 }),
    );
    expect(requests).toHaveLength(1);
  });

  it('leaves retrying off when the provider says zero', async () => {
    const { requests } = await withServer([{ status: 429, headers: { 'retry-after': '0' } }], {}, ask, 0);
    expect(requests).toHaveLength(1);
  });

  /**
   * The two deadlines bound different things, and the difference only shows when a *slow*
   * retryable failure eats into the budget — a 500 arriving late into a long generation, which
   * is the shape `derive.timeout_ms` was tuned against.
   */
  it("gives a retry the role's full deadline rather than what the first attempt left", async () => {
    const { requests, result } = await withServer(
      [
        { status: 503, headers: { 'retry-after': '0' }, delayMs: 200 },
        { status: 200, delayMs: 200 },
      ],
      // Enough for either attempt alone, not enough for both back to back.
      { timeoutMs: 350 },
      ask,
    );
    expect(requests).toHaveLength(2);
    // A total budget would have left the retry 150ms for work that needs 200.
    expect(result).toMatchObject({ ok: true });
  });

  it('holds a caller-supplied budget across the whole sequence', async () => {
    const { result } = await withServer(
      [
        { status: 503, headers: { 'retry-after': '0' }, delayMs: 200 },
        { status: 200, delayMs: 200 },
      ],
      // The same replies and the same number, supplied by the caller instead of the role.
      { timeoutMs: 5_000 },
      (client) => client.chat([{ role: 'user', content: 'hi' }], { timeoutMs: 350 }),
    );
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('keeps the failure that caused the retry attached to the one that ended the call', async () => {
    // A retried rate limit that then times out has two fixes with opposite directions, and
    // reporting only the timeout points at the wrong one.
    const { result } = await withServer(
      [{ status: 429, headers: { 'retry-after': '0' } }, { status: 200, delayMs: 400 }],
      { timeoutMs: 150 },
      ask,
    );
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
    expect((result as { error: string }).error).toContain('timed out');
    expect((result as { error: string }).error).toContain('429');
  });

  it('reports a timeout without retrying it', async () => {
    // A timeout has already spent the budget by definition, and the callers that care have a
    // better answer than repetition — `derivePage` asks for the summary alone instead.
    const { requests, result } = await withServer([{ status: 200, delayMs: 300 }], { timeoutMs: 120 }, ask);
    expect(requests).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });
});

/**
 * Two endpoint dialects, one ladder. The order is chosen by which rejection is *detectable*:
 * llama.cpp answers an unknown `response_format` shape with an error, where it has a
 * documented history of accepting `json_schema` and silently applying no constraint at all.
 */
describe('the schema ladder', () => {
  async function sent(
    replies: { status: number; body?: unknown }[],
    calls: number,
  ): Promise<Record<string, unknown>[]> {
    const requests: Record<string, unknown>[] = [];
    const instance = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
        const reply = replies[Math.min(requests.length - 1, replies.length - 1)]!;
        response.writeHead(reply.status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(reply.body ?? { choices: [{ message: { content: '{}' } }] }));
      });
    });
    await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const { port } = instance.address() as { port: number };
    try {
      const client = new ModelClient({
        role: 'derive',
        provider: {
          name: 'stub',
          baseUrl: `http://127.0.0.1:${port}/v1`,
          apiKey: null,
          headers: {},
          maxRetries: 0,
        },
        id: 'stub',
        enabled: true,
        requested: true,
        timeoutMs: 5_000,
        unavailableReason: null,
      });
      for (let i = 0; i < calls; i++) {
        await client.chat([{ role: 'user', content: 'hi' }], { schema: DOCUMENT_SUMMARY_SCHEMA });
      }
      return requests;
    } finally {
      instance.close();
      instance.closeAllConnections();
    }
  }

  it('starts on the form llama.cpp compiles to a grammar', async () => {
    const [first] = await sent([{ status: 200 }], 1);
    expect(first!.response_format).toEqual({
      type: 'json_object',
      schema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
        additionalProperties: false,
      },
    });
  });

  it("steps down to OpenAI's dialect on the rejection OpenAI actually sends", async () => {
    const requests = await sent(
      [
        {
          status: 400,
          body: { error: { message: "Unknown parameter: 'response_format.schema'." } },
        },
        { status: 200 },
      ],
      1,
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]!.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'akno_response', strict: true },
    });
  });

  it('falls all the way back to a plain JSON request rather than failing', async () => {
    const requests = await sent(
      [
        { status: 400, body: { error: { message: 'invalid response_format' } } },
        { status: 400, body: { error: { message: 'invalid response_format' } } },
        { status: 200 },
      ],
      1,
    );
    expect(requests).toHaveLength(3);
    // Which is exactly what shipped before constrained decoding existed.
    expect(requests[2]!.response_format).toEqual({ type: 'json_object' });
  });

  it('learns the rung once rather than rediscovering it per call', async () => {
    const requests = await sent(
      [
        { status: 400, body: { error: { message: "Unknown parameter: 'response_format.schema'." } } },
        { status: 200 },
      ],
      3,
    );
    // One probe, then two calls that go straight to the rung that works.
    expect(requests).toHaveLength(4);
    expect(requests.filter((body) => 'schema' in (body.response_format as object))).toHaveLength(1);
  });

  it('sends no schema at all when a caller only asked for JSON', async () => {
    const requests: Record<string, unknown>[] = [];
    const instance = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ message: { content: '{}' } }] }));
      });
    });
    await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const { port } = instance.address() as { port: number };
    try {
      const client = new ModelClient({
        role: 'derive',
        provider: {
          name: 'stub',
          baseUrl: `http://127.0.0.1:${port}/v1`,
          apiKey: null,
          headers: {},
          maxRetries: 0,
        },
        id: 'stub',
        enabled: true,
        requested: true,
        timeoutMs: 5_000,
        unavailableReason: null,
      });
      await client.chat([{ role: 'user', content: 'hi' }], { json: true });
      expect(requests[0]!.response_format).toEqual({ type: 'json_object' });
    } finally {
      instance.close();
      instance.closeAllConnections();
    }
  });
});
