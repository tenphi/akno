# V74 compact language-audit pre-review

## Scope

I reviewed only `packages/core/src/models/language-audit.ts`, the changes in `language.ts`, and the `ModelClient.chat` integration, against `tmp/language-v74-plan.md` and the preserved compact V73 design. I did not edit runtime code, call a provider, or review the other V74 workstreams.

## Findings

### Medium — a broad range can relabel a protected foreign reference as the language error

Location: `packages/core/src/models/language-audit.ts`, range-counterexample validation in `parse`.

The stated contract requires an unhinted range to identify foreign explanatory words outside protected reference/quotation/code/path bounds and says a protected reference alone must not be rejected. The implementation accepts a range whenever it contains **any** uncovered letter or number:

```ts
if (/[^]/ /* letter or number */ && !protectedSpans.some(...)) return 'noncompliant';
```

Consequently, a model can return a range spanning a permitted foreign proper name plus one adjacent target-language word. For example, in Russian prose equivalent to `для Ada Marlow`, a range covering the whole phrase contains uncovered Cyrillic letters and therefore validates, even if the model's actual foreign-language concern is only the protected `Ada Marlow`. The returned coordinates do not establish that the uncovered part is foreign. This weakens exact occurrence ownership and contradicts the prompt's “must include foreign explanatory words outside protected ... bounds” requirement.

The smallest deterministic correction is to reject a range that overlaps any protected span at all, or require every letter/number in the range to be outside protected spans. The former is simpler and makes the counterexample an exact unprotected span. The model remains fallible about whether that unprotected span is foreign, but it cannot use a protected name as the substance of its witness. Add controls for:

- exact protected name range: invalid;
- protected name plus adjacent target-language preposition: invalid;
- adjacent unprotected foreign word alone: valid coherent negative;
- punctuation surrounding an unprotected foreign word: valid;
- a range crossing two excerpts or exceeding one excerpt: invalid (the current schema/index checks already cover this).

### Low — worst-shape completion under 1,024 tokens remains unestablished

Locations: `packages/core/src/models/language-audit.ts` schema; `packages/core/src/models/client.ts` language-check call.

The response is much smaller than the rejected per-occurrence design: at most 32 two-field objects and one compact counterexample. The unchanged `maxTokens: 1024` is correctly preserved, and `checkInput.length > 24000` now measures the actual serialized request rather than an underestimate. Still, the longest classification strings, dynamic IDs, JSON syntax, and provider reasoning mean source inspection cannot prove universal completion within 1,024 tokens.

Before freeze, capture strict maximum-shape Chat and Responses controls with all 32 hint IDs, longest enum values, both prose-result branches, and the actual effective role cap. Include truncated JSON and a complete-but-missing hint result to demonstrate `language_check_failed`. Treat successful echoes as observed transport/budget evidence only. No cap increase or fallback is warranted.

## Coherence review

Apart from the range-ownership finding, the implementation follows the compact design:

- It retains the existing 32 **distinct token surfaces**, groups every exact occurrence of a surface, and supplies occurrence coordinates and server-derived allowed roles.
- Supplied name/title/identifier and quoted/code/path classifications validate only when every occurrence has the corresponding exact server-known coverage. One protected occurrence cannot exempt an unprotected occurrence of the same spelling.
- Missing, duplicate, or foreign hint IDs fail parsing. A compliant result with a negative hint also fails parsing. A coherent negative is returned as `language_mismatch`; malformed or incoherent output becomes `language_check_failed`.
- The parser uses strict `JSON.parse`, so trailing content and loose salvage do not pass.
- The complete excerpts remain in the same language-check request. Unhinted prose is still governed by `prose_result`; the structured hints are not treated as exhaustive.
- `contextual_name` remains an intentionally fallible model judgment. The prompt correctly states that capitalization, hyphenation, technical appearance, and source occurrence are insufficient. A generic word can still be misclassified as a contextual name; this schema improves observability and local consistency but cannot prove classifier correctness.
- `ModelClient.chat` still makes one generation call followed by the same one language-check call. Timeout aggregation, usage aggregation, and the 1,024 call cap remain intact. There is no legacy binary fallback or retry added here.
- The serialized 24,000-unit input check includes excerpts, all occurrence coordinates, references, and hints. Oversize input fails closed before the checker call.

## Necessary test boundary

Tests should additionally cover the following before this implementation is considered ready:

1. The two invented Russian `hinge-pin` outputs produce `foreign_ordinary` and a coherent `language_mismatch`; `target_or_neutral`, unsupported supplied roles, and `contextual_name` remain visibly different model claims rather than silently equivalent passes.
2. A repeated surface with one supplied-reference occurrence and one ordinary occurrence cannot use the supplied role; `ambiguous_or_mixed` yields a coherent negative.
3. Empty-hint English checks accept a compliant result with `hint_roles: []`, accept one valid unhinted range as a coherent negative, and reject a hint counterexample that cannot exist in that schema.
4. Every malformed class is typed correctly: loose/trailing JSON, omitted/duplicate/unknown IDs, invalid enum, bad excerpt ID, negative/zero/reversed/out-of-range offsets, protected-only range, compliant plus negative hint, and noncompliant plus unusable witness.
5. Exact UTF-16 offsets around astral characters validate correctly; the implementation iterates code points while advances by `character.length`, which should be preserved by an executable regression.
6. A language-check transport failure remains `language_check_failed`; a valid negative remains `language_mismatch`; neither returns the original generated result.

## Disposition

**Hold for the range-counterexample ownership fix and its negative controls.** The remaining budget concern requires declared maximum-shape transport evidence before freeze, not a runtime cap change.
