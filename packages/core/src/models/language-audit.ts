import { z } from 'zod';
import { languageReviewTokens, type LanguageReference, type OutputLanguage } from './language.ts';

type Range = { excerpt_id: string; start: number; end: number };
type ProtectedRange = Range & { role: string };
const classifications = [
  'target_or_neutral',
  'foreign_ordinary',
  'supplied_name',
  'supplied_title',
  'supplied_identifier',
  'quoted',
  'code',
  'path',
  'contextual_name',
  'ambiguous_or_mixed',
] as const;
const negative = new Set(['foreign_ordinary', 'ambiguous_or_mixed']);
const exempt = new Set(['supplied_name', 'supplied_title', 'supplied_identifier', 'quoted', 'code', 'path']);

function occurrences(text: string, surface: string): { start: number; end: number }[] {
  if (!surface) return [];
  const ranges: { start: number; end: number }[] = [];
  for (let start = text.indexOf(surface); start !== -1; start = text.indexOf(surface, start + 1))
    ranges.push({ start, end: start + surface.length });
  return ranges;
}

function protectedRanges(
  excerpts: readonly string[],
  references: readonly LanguageReference[],
): ProtectedRange[] {
  return excerpts.flatMap((text, index) => {
    const excerpt_id = `e${index}`;
    const ranges: ProtectedRange[] = [];
    for (const [role, pattern] of [
      ['code', /```[\s\S]*?```|`[^`\n]*`/gu],
      ['quoted', /«[^»]*»|“[^”]*”|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu],
      ['path', /(?<![\p{L}\p{N}_])(?:\.{0,2}\/|~\/|[\p{L}\p{N}_-]+\/)[\p{L}\p{N}._~/-]+/gu],
    ] as const)
      for (const match of text.matchAll(pattern))
        ranges.push({ excerpt_id, start: match.index, end: match.index + match[0].length, role });
    for (const reference of references)
      for (const range of occurrences(text, reference.text)) {
        // A supplied name inside a longer word cannot certify that word as an exact reference.
        if (/^[\p{L}\p{N}_]/u.test(reference.text) && /[\p{L}\p{N}_]$/u.test(text.slice(0, range.start)))
          continue;
        if (/[\p{L}\p{N}_]$/u.test(reference.text) && /^[\p{L}\p{N}_]/u.test(text.slice(range.end))) continue;
        ranges.push({ excerpt_id, ...range, role: `supplied_${reference.kind}` });
      }
    return ranges;
  });
}

/** Exact occurrence ownership is server-supplied; the model judges language in the same bounded call. */
export function languageAudit(
  excerpts: readonly string[],
  language: OutputLanguage,
  references: readonly LanguageReference[],
) {
  const protectedSpans = protectedRanges(excerpts, references);
  const contains = (outer: Range, inner: Range) =>
    outer.excerpt_id === inner.excerpt_id && outer.start <= inner.start && outer.end >= inner.end;
  const hints = languageReviewTokens(excerpts, language).map((surface, index) => ({
    hint_id: `h${index}`,
    surface,
    occurrences: excerpts.flatMap((text, excerptIndex) =>
      occurrences(text, surface).map((range) => {
        const coordinate = { excerpt_id: `e${excerptIndex}`, ...range };
        return {
          ...coordinate,
          allowed_roles: [
            ...new Set(protectedSpans.filter((span) => contains(span, coordinate)).map(({ role }) => role)),
          ],
        };
      }),
    ),
  }));
  const ids = hints.map(({ hint_id }) => hint_id);
  const range = z.strictObject({
    kind: z.enum(['range']),
    excerpt_id: z.enum(excerpts.map((_, index) => `e${index}`) as [string, ...string[]]),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  });
  const hint = z.strictObject({ kind: z.enum(['hint']), hint_id: z.enum(ids as [string, ...string[]]) });
  const schema = z.strictObject({
    hint_roles: z
      .array(
        z.strictObject({
          hint_id: ids.length ? z.enum(ids as [string, ...string[]]) : z.string(),
          classification: z.enum(classifications),
        }),
      )
      .length(hints.length),
    prose_result: z.union([
      z.strictObject({ status: z.enum(['compliant']), counterexample: z.null() }),
      z.strictObject({
        status: z.enum(['noncompliant']),
        counterexample: ids.length ? z.union([hint, range]) : range,
      }),
    ]),
  });
  return {
    schema,
    input: {
      language,
      excerpts,
      ...(hints.length ? { review_tokens: hints.map(({ surface }) => surface), review_hints: hints } : {}),
      ...(references.length ? { supplied_references: references } : {}),
    },
    parse(raw: string): 'compliant' | 'noncompliant' | null {
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        return null;
      }
      const result = schema.safeParse(value);
      if (!result.success) return null;
      const { hint_roles, prose_result } = result.data;
      if (new Set(hint_roles.map(({ hint_id }) => hint_id)).size !== hints.length) return null;
      for (const role of hint_roles) {
        const entry = hints.find(({ hint_id }) => hint_id === role.hint_id)!;
        if (
          exempt.has(role.classification) &&
          !entry.occurrences.every(({ allowed_roles }) => allowed_roles.includes(role.classification))
        )
          return null;
      }
      const negativeIds = new Set(
        hint_roles.filter(({ classification }) => negative.has(classification)).map(({ hint_id }) => hint_id),
      );
      if (prose_result.status === 'compliant') return negativeIds.size ? null : 'compliant';
      const witness = prose_result.counterexample;
      if (witness.kind === 'hint') return negativeIds.has(witness.hint_id) ? 'noncompliant' : null;
      const text = excerpts[Number(witness.excerpt_id.slice(1))]!;
      if (witness.end > text.length || witness.start >= witness.end) return null;
      // The model must isolate the foreign words. A broad range containing a protected name
      // and adjacent target-language prose cannot use that name as its negative witness.
      if (
        protectedSpans.some(
          (span) =>
            span.excerpt_id === witness.excerpt_id && span.start < witness.end && span.end > witness.start,
        )
      )
        return null;
      const splitsPair = (offset: number) =>
        offset > 0 &&
        offset < text.length &&
        /[\uD800-\uDBFF]/u.test(text[offset - 1]!) &&
        /[\uDC00-\uDFFF]/u.test(text[offset]!);
      if (splitsPair(witness.start) || splitsPair(witness.end)) return null;
      return /[\p{L}\p{N}]/u.test(text.slice(witness.start, witness.end)) ? 'noncompliant' : null;
    },
  };
}
