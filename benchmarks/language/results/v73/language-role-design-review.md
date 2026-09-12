# V73 language token-role design review

## Observed boundary

The frozen V73 selected trace contains two materially equivalent Russian fiction drafts with the ordinary English compound `hinge-pin` embedded in Russian explanatory prose. Rows 184 and 190 both pass the same `review_tokens: ["hinge-pin"]` hint and neither supplies `hinge-pin` as a name, title, or identifier. Row 184 returns `compliant: true`; row 190 returns `compliant: false`. The latter is the source-correct language decision. The hint already makes the token visible, so adding another detector or prompt sentence would not make the decision reviewable or internally coherent.

The current `{ compliant: boolean }` schema conceals whether the checker treated the compound as ordinary prose, an identifier, a quotation, or something else. `review_tokens` is intentionally capped attention data and `supplied_references` is filtered source-backed exemption context. Neither appears in the output, and no local consistency rule connects a claimed exemption to evidence.

## Recommended bounded change

Keep the existing single language-check call, its complete `excerpts`, 1,024 output-token limit, timeout accounting, and failure behavior. Replace the binary response with a strict structured audit containing:

```text
{
  compliant: boolean,
  reviewed_tokens: [
    {
      review_id,
      role,
      language_relation,
      witness_kind,
      witness_id
    }
  ],
  additional_foreign_spans: [
    {
      excerpt_index,
      surface,
      role,
      witness_kind,
      witness_id
    }
  ]
}
```

The server should turn each bounded `review_token` occurrence into an input item with a stable `review_id`, `excerpt_index`, exact `surface`, and short surrounding context. The response must contain exactly one `reviewed_tokens` entry for every ID, without duplicates or foreign IDs. This removes token matching ambiguity when the same surface occurs more than once or in different roles.

Use closed enums:

- `role`: `ordinary_prose | proper_name | title | identifier | path | code | exact_quotation | target_language | ambiguous`;
- `language_relation`: `target | foreign | neutral_or_shared`;
- `witness_kind`: `supplied_reference | quoted_range | code_range | path_shape | contextual_name | none`;
- `witness_id`: a nullable dynamic enum of supplied reference/range IDs.

The input should assign IDs to filtered supplied references and to deterministically recognized exact quoted/code ranges. An exemption claim for `supplied_reference`, `quoted_range`, or `code_range` is locally valid only when its witness ID exists and the reviewed occurrence is actually covered by that exact input witness. `path_shape` may use the existing narrow path syntax. A mere occurrence in source text, technical appearance, or hyphenation is never a witness.

The server should derive coherence after parsing rather than trusting the returned boolean alone:

- any reviewed or additional span classified `foreign + ordinary_prose` or `ambiguous` requires `compliant: false`;
- `foreign` content may coexist with `compliant: true` only when every reported occurrence has an allowed exempt role and a role-compatible witness;
- a missing/duplicate review ID, incompatible role/witness pair, unknown witness, malformed span, contradictory boolean, or over-limit response becomes `language_check_failed`, not a pass;
- `hinge-pin` in the V73 Russian prose must be `foreign + ordinary_prose + none`, forcing false in both calls;
- exact `Ada Marlow`, `Zephyr QX-100`, quoted source text, code, and paths remain exempt only under their corresponding role/witness rules.

`contextual_name` is needed because the current policy allows recognizable proper names that are absent from `supplied_references`. It should require the exact surface, excerpt index, and a short bounded context, but it remains a model classification rather than locally proven identity. Keep that limitation explicit in receipts. Generic `assistant`/`user` labels and ordinary component/service terms cannot use `contextual_name` merely because they are capitalized or copied from source.

## Full-prose coverage

The check must continue to inspect every complete excerpt. `reviewed_tokens` covers the server-provided bounded attention set; it is not declared exhaustive. `additional_foreign_spans` requires the same model call to disclose any other non-target explanatory span it finds anywhere in the excerpts, including ordinary nonhyphenated words, generic roles, or a longer phrase omitted from the hints.

This cannot mathematically prove that the model found every foreign span. The final `compliant` judgment remains a fallible whole-excerpt classification. The structured result improves observability and prevents a checker from explicitly calling a hinted token ordinary foreign prose while returning true, but it cannot turn a capped token detector into a complete language parser. Preserve the existing instruction to inspect all prose and retain source-only output review as authority for accepted errors.

Do not make `additional_foreign_spans` accept arbitrary long explanations. Bound it to at most 16 entries, with `surface` at most 96 UTF-16 units and no free-form reason. Keep `reviewed_tokens` at the existing maximum of 32. These maxima and compact enums fit the unchanged 1,024-token checker ceiling in the worst normal case only if transport controls confirm it; when the bounded schema cannot be completed, fail `language_check_failed` rather than truncate, omit required reviews, increase tokens, or silently fall back to a boolean.

## Schema and data-flow controls

Use one strict object with all fields required and `additionalProperties: false`; each item is strict, arrays have explicit maxima, and nullable witness IDs use the endpoint-supported nullable form. Dynamic `review_id` and supplied witness IDs should be enums derived from the exact request. Avoid response `oneOf`/free-form maps and keep Chat/Responses schema conversion controls.

The checker call remains the only language-verification call. Generation, truth/entailment, usefulness, and semantic verification remain separate. Token roles are not translation authority: the checker may reject output but never rewrite it, infer the intended translation, add a term to references, or authorize source content. The original result is returned only when the structured language result is valid and coherent.

## Minimum negative controls

1. The two exact V73 Russian `hinge-pin` drafts produce identical `foreign/ordinary_prose/no-witness` assessments and are rejected.
2. Hyphenated ordinary component, service, and content words copied exactly from source remain nonexempt.
3. `Ada Marlow` and `Zephyr QX-100` with matching supplied-reference witnesses are allowed inside Russian prose; surrounding English words are not covered by those witnesses.
4. Generic `assistant` and `user` cannot claim proper-name exemption; their Russian prose forms pass.
5. Exact quotation/code/path occurrences pass only when their exact ranges/shapes cover the occurrence. Removing delimiters or moving the same token into prose removes the exemption.
6. A title/reference exemption covers only its exact surface, not a longer foreign phrase containing it.
7. A foreign ordinary word not present in `review_tokens` must appear in `additional_foreign_spans` and force false, proving the output path is not limited to hints.
8. Conflicting boolean, omitted/duplicate review ID, invented witness, wrong occurrence, `ambiguous` marked compliant, excessive findings, malformed JSON, and truncated arrays fail closed as `language_check_failed`.
9. Minor Russian inflection/agreement errors with no foreign prose remain eligible; grammatical polish is still outside this check.
10. English-target controls apply the same role/witness rules symmetrically, including Russian generic prose embedded around protected names.

## Limits

The role taxonomy cannot determine whether a novel token is a real proper name, a domain identifier, or ordinary terminology from spelling alone. `contextual_name` remains reviewable model judgment, and source-provided references remain untrusted data filtered to exact occurrences rather than proof of semantic attachment. The design prevents explicit internal contradiction and exposes the basis for exemptions; it does not guarantee complete detection, correct translation, source entailment, or model competence.

This is the smallest general boundary I recommend. A blacklist for `hinge-pin`, blanket Latin-script rejection, dictionary lookup, guessed translation, second checker pass, larger output budget, or relaxing a language error would solve a narrower symptom or weaken existing exemptions without addressing the opaque disagreement.
