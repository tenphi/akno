import { afterEach, describe, expect, it, vi } from 'vitest';
import { languageAudit } from './language-audit.ts';
import { ModelClient, toEndpointSchema, strictModeViolations } from './client.ts';

const prose = 'Деталь axle-cap требует перевода.';
const positive = {
  hint_roles: [{ hint_id: 'h0', classification: 'target_or_neutral' }],
  prose_result: { status: 'compliant', counterexample: null },
};
const negative = {
  hint_roles: [{ hint_id: 'h0', classification: 'foreign_ordinary' }],
  prose_result: { status: 'noncompliant', counterexample: { kind: 'hint', hint_id: 'h0' } },
};
const check = (value: unknown, text = prose) => languageAudit([text], 'ru', []).parse(JSON.stringify(value));

describe('same-call grouped language audit', () => {
  it('keeps semantic classification fallible while enforcing negative/status consistency', () => {
    expect(check(positive)).toBe('compliant');
    expect(check(negative)).toBe('noncompliant');
    expect(check({ ...positive, hint_roles: negative.hint_roles })).toBeNull();
    expect(check({ ...negative, hint_roles: positive.hint_roles })).toBeNull();
    expect(check({ ...positive, hint_roles: [{ hint_id: 'h0', classification: 'contextual_name' }] })).toBe(
      'compliant',
    );
  });
  it.each(['supplied_name', 'supplied_title', 'supplied_identifier', 'quoted', 'code', 'path'])(
    'requires actual occurrence witnesses for %s',
    (classification) => {
      expect(check({ ...positive, hint_roles: [{ hint_id: 'h0', classification }] })).toBeNull();
    },
  );
  it.each(['name', 'title', 'identifier'] as const)(
    'supports exact typed %s references without covering a longer word',
    (kind) => {
      const verdict = JSON.stringify({
        ...positive,
        hint_roles: [{ hint_id: 'h0', classification: `supplied_${kind}` }],
      });
      expect(languageAudit([prose], 'ru', [{ kind, text: 'axle-cap' }]).parse(verdict)).toBe('compliant');
      expect(
        languageAudit([prose, 'axle-capmore'], 'ru', [{ kind, text: 'axle-cap' }]).parse(verdict),
      ).toBeNull();
    },
  );
  it('retains all occurrences of each of the 32 distinct surfaces', () => {
    const terms = Array.from(
      { length: 40 },
      (_, i) => `cedar-${String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26))}`,
    );
    const audit = languageAudit([terms[0]!.repeat(40), terms.join(' '), `«${terms[0]}»`], 'ru', []);
    expect(audit.input.review_hints).toHaveLength(32);
    expect(audit.input.review_hints![0]!.occurrences).toHaveLength(42);
    const hint_roles = audit.input.review_hints!.map(({ hint_id }) => ({
      hint_id,
      classification: 'foreign_ordinary',
    }));
    expect(audit.parse(JSON.stringify({ ...negative, hint_roles }))).toBe('noncompliant');
    expect(audit.parse(JSON.stringify({ ...negative, hint_roles: hint_roles.slice(1) }))).toBeNull();
    expect(
      audit.parse(JSON.stringify({ ...negative, hint_roles: hint_roles.map(() => hint_roles[0]) })),
    ).toBeNull();
  });
  it('does not let a protected occurrence exempt ordinary occurrences of the same spelling', () => {
    const audit = languageAudit(['`axle-cap` и axle-cap.'], 'ru', []);
    expect(audit.input.review_hints![0]!.occurrences.map(({ allowed_roles }) => allowed_roles)).toEqual([
      ['code'],
      [],
    ]);
    expect(
      audit.parse(JSON.stringify({ ...positive, hint_roles: [{ hint_id: 'h0', classification: 'code' }] })),
    ).toBeNull();
    expect(
      audit.parse(
        JSON.stringify({
          ...negative,
          hint_roles: [{ hint_id: 'h0', classification: 'ambiguous_or_mixed' }],
        }),
      ),
    ).toBe('noncompliant');
  });
  it.each([
    { compliant: true },
    { ...positive, extra: true },
    { ...negative, prose_result: { status: 'noncompliant', counterexample: null } },
    { ...positive, hint_roles: [] },
    { ...positive, hint_roles: [{ hint_id: 'h44', classification: 'target_or_neutral' }] },
  ])('rejects missing, foreign or old binary output: %j', (value) => expect(check(value)).toBeNull());
  it('rejects truncated, trailing and fenced responses', () => {
    const audit = languageAudit([prose], 'ru', []);
    const raw = JSON.stringify(positive);
    for (const malformed of [raw.slice(0, -1), raw + ' trailing', '```json\n' + raw + '\n```'])
      expect(audit.parse(malformed)).toBeNull();
  });
  it.each(['en', 'ru'] as const)('validates exact unhinted negative ranges in %s', (language) => {
    const text = 'Ada Marlow рядом foreign.';
    const audit = languageAudit([text, '𝒜 текст'], language, [{ kind: 'name', text: 'Ada Marlow' }]);
    const range = (start: number, end: number, excerpt_id = 'e0') =>
      audit.parse(
        JSON.stringify({
          hint_roles: [],
          prose_result: { status: 'noncompliant', counterexample: { kind: 'range', excerpt_id, start, end } },
        }),
      );
    expect(range(17, 24)).toBe('noncompliant');
    for (const [start, end] of [
      [0, 10],
      [0, 16],
      [3, 18],
      [-1, 4],
      [5, 5],
      [17, 1111],
    ])
      expect(range(start!, end!)).toBeNull();
    expect(range(0, 1, 'e9')).toBeNull();
    expect(range(0, 1, 'e1')).toBeNull();
  });
  it('exposes strict anyOf schemas for empty and maximum hint lists', () => {
    for (const text of [
      'English prose.',
      Array.from(
        { length: 32 },
        (_, i) => `cedar-${String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26))}`,
      ).join(' '),
    ]) {
      const schema = toEndpointSchema(languageAudit([text], 'ru', []).schema);
      expect(strictModeViolations(schema)).toEqual([]);
      expect(JSON.stringify(schema)).not.toMatch(/"(?:oneOf|const)":/u);
      expect(JSON.stringify(schema)).toContain('"anyOf"');
    }
  });
});

afterEach(() => vi.unstubAllGlobals());
describe('maximum grouped language schema transport', () => {
  it.each(
    (['chat_completions', 'responses'] as const).flatMap((api) =>
      [true, false].map((compliant) => [api, compliant] as const),
    ),
  )('preserves one 1024-token check with 32 judgments: %s / %s', async (api, compliant) => {
    const terms = Array.from(
      { length: 32 },
      (_, i) => `cedar-${String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26))}`,
    );
    const text = terms.join(' ');
    const wire: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init.body));
        wire.push(body);
        const value = JSON.stringify(
          wire.length === 1
            ? { text }
            : {
                hint_roles: terms.map((_, index) => ({
                  hint_id: `h${index}`,
                  classification: compliant ? 'target_or_neutral' : 'foreign_ordinary',
                })),
                prose_result: compliant
                  ? { status: 'compliant', counterexample: null }
                  : { status: 'noncompliant', counterexample: { kind: 'hint', hint_id: 'h31' } },
              },
        );
        return new Response(
          JSON.stringify(
            api === 'chat_completions'
              ? { choices: [{ message: { content: value }, finish_reason: 'stop' }] }
              : {
                  status: 'completed',
                  output: [{ type: 'message', content: [{ type: 'output_text', text: value }] }],
                },
          ),
          { headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    const model = new ModelClient({
      role: 'answer',
      id: 'invented-language-transport',
      enabled: true,
      requested: true,
      timeoutMs: 1111,
      maxOutputTokens: 2400,
      unavailableReason: null,
      knowledgeLanguage: 'en',
      provider: {
        name: 'invented',
        baseUrl: 'https://invented.invalid/v1',
        apiKey: null,
        headers: {},
        maxRetries: 0,
        api,
      },
    });
    const result = await model.chat([{ role: 'user', content: 'Describe the invented components.' }], {
      outputLanguage: 'ru',
    });
    expect(wire).toHaveLength(2);
    expect(result.ok).toBe(compliant);
    if (!compliant) expect(result.reason).toBe('language_mismatch');
    const languageCheck = wire[1];
    expect(
      languageCheck.max_output_tokens ?? languageCheck.max_completion_tokens ?? languageCheck.max_tokens,
    ).toBe(1024);
    const schema =
      api === 'responses'
        ? languageCheck.text.format.schema
        : (languageCheck.response_format.schema ?? languageCheck.response_format.json_schema.schema);
    expect(strictModeViolations(schema)).toEqual([]);
    expect(JSON.stringify(schema)).not.toMatch(/"(?:oneOf|const)":/u);
  });
});
