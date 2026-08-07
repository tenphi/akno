import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { ModelClient, closeTruncatedJson, parseJsonLoose } from './client.ts';

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
        provider: { name: 'stub', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: null, headers: {} },
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
      await new Promise<void>((resolve) => instance.close(() => resolve()));
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
