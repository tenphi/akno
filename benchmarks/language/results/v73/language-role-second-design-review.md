# V73 language-role audit: second design review

## Disposition

The first design correctly identifies the missing boundary: the current `{ compliant }` response can contradict the checker's own treatment of a highlighted token without exposing that contradiction. Its proposed worst-case response is too large for the unchanged 1,024-token call, however. Thirty-two per-occurrence objects with five fields, plus as many as sixteen 96-unit copied spans, schema punctuation, and any provider reasoning budget cannot be claimed to fit. A transport echo with short enum values would establish one observed fit, not a general output-budget guarantee.

I recommend a smaller strict audit in the same call. Keep all complete excerpts in the request and preserve the whole-prose judgment. Group bounded attention hints by exact surface instead of requiring one output object for every occurrence, and require only one exact counterexample for a negative whole-prose result.

## Compact contract

The server should assign at most 32 stable `hint_id` values to the existing bounded distinct `review_tokens`. Each input hint contains its exact surface and every exact occurrence coordinate in the submitted excerpts. This preserves the current 32-distinct-token attention coverage; changing the cap to 32 occurrences would reduce coverage when one early token repeats many times.

The response can be:

```text
{
  hint_roles: [
    { hint_id, classification }
  ],
  prose_result: {
    status,
    counterexample
  }
}
```

Use one compact closed `classification` enum rather than separate role, language-relation, witness-kind, and witness-ID fields:

- `target_or_neutral`
- `foreign_ordinary`
- `supplied_name`
- `supplied_title`
- `supplied_identifier`
- `quoted`
- `code`
- `path`
- `contextual_name`
- `ambiguous_or_mixed`

Every requested `hint_id` must appear exactly once. Unknown, missing, or duplicate IDs invalidate the result. A group may use an exempt supplied/range classification only when the server can establish that **every occurrence** of that surface is covered by a compatible exact supplied reference or exact quoted/code/path range. Because the coordinates and reference membership are already in the private request, the model need not copy witness IDs back. If occurrences play different roles, the only coherent group result is `ambiguous_or_mixed`, which cannot accompany a compliant result. This grouping saves output without allowing one witnessed occurrence to exempt an unwitnessed occurrence of the same spelling.

`prose_result` should have two provider-visible strict variants, encoded with the endpoint-supported `anyOf` pattern already used elsewhere:

- compliant: `{ status: "compliant", counterexample: null }`
- noncompliant: `{ status: "noncompliant", counterexample: { kind, reference } }`

For a hinted failure, `kind` is `hint` and `reference` is a dynamic enum of the exact hint IDs classified `foreign_ordinary` or `ambiguous_or_mixed`. For an unhinted whole-prose failure, `kind` is `range` and the counterexample supplies only `excerpt_id`, UTF-16 start, and UTF-16 end. The server validates that the range is nonempty, within that exact submitted excerpt, and extracts the surface itself. The response must not repeat up to 96 units of prose.

One exact whole-prose counterexample is enough to substantiate a negative whole-prose result. The checker is a rejection boundary, not an exhaustive error reporter: once one unsupported foreign explanatory span exists, further spans cannot change the disposition. Requiring up to sixteen copied findings spends scarce output on redundant evidence and increases truncation risk. It also creates an unnecessary question about whether omission from an allegedly exhaustive list is approval. The full excerpts remain in the input and the model must still judge all of them; the single witness only makes a negative result reviewable.

## Coherence rules

Derive the accepted disposition locally after strict parsing:

- `foreign_ordinary` and `ambiguous_or_mixed` require `prose_result.status = noncompliant` and a counterexample that resolves to such a hint or to a valid unhinted range.
- `compliant` requires every hint classification to be locally coherent and nonnegative.
- A `supplied_*`, `quoted`, `code`, or `path` classification is valid only if all grouped occurrences have the corresponding exact server-known witness coverage.
- `contextual_name` remains a fallible model classification and has no invented witness. It must name the exact grouped surface and cannot cover surrounding prose. The prompt should state that capitalization, hyphenation, technical appearance, and source occurrence do not turn a generic word into a name or identifier.
- A range counterexample must not overlap an allowed exact quotation/code/path range or a supplied reference in a way that merely re-labels that protected surface. It may identify surrounding foreign prose outside those exact bounds.
- A coherent negative is a normal `language_mismatch`. Invalid JSON, wrong IDs, invalid coordinates, incompatible classifications, missing counterexample, or a contradictory status is `language_check_failed`. Neither result authorizes a rewrite or a retry.

This preserves the useful exemptions while preventing `hinge-pin` from passing merely because it is hyphenated or copied from source. An unwitnessed contextual proper name can still be allowed, but receipts must describe that as a model judgment rather than proof. No bounded schema can guarantee that the model will not misclassify a generic word as `contextual_name`; complete source-only review remains authoritative for accepted errors.

## Coverage and caps

Keep the existing `languageReviewTokens` surface limit of 32 and its 96-unit per-token bound. Internally enumerate all exact occurrences of each selected surface; do not replace that with a global 32-occurrence cap. Input growth is bounded by the existing 24,000-unit request check, though a practical implementation may encode occurrence coordinates compactly and reject before the call if the request itself exceeds that existing bound.

The response now contains at most 32 two-field hint judgments and one small counterexample. That is materially smaller than 32 five-field occurrence judgments plus sixteen copied spans. It still is not provably below 1,024 tokens for every tokenizer/provider/schema serialization. Strict maximum-shape Chat and Responses transport controls should therefore exercise 32 hints, the longest dynamic IDs, both result variants, and the role's actual effective cap. A truncated or incomplete maximum response must remain `language_check_failed`; do not raise the cap, retry, or omit hint judgments.

Unlisted contextual names remain governed by the whole-prose result. They need not be exhaustively emitted when the result is compliant. For a noncompliant finding outside the hints, the one exact range is sufficient. This retains full-prose checking without pretending that a bounded list proves exhaustive classification.

## Minimum controls

1. The exact Russian `hinge-pin` prose produces `foreign_ordinary` and a coherent negative; the same surface repeated in several places is grouped and cannot be exempted by one protected occurrence.
2. A surface used once as a supplied identifier and once as ordinary prose yields `ambiguous_or_mixed` and fails.
3. Exact supplied names/titles/identifiers pass only when all occurrences match the corresponding server-known reference bounds; surrounding English words remain uncovered.
4. Quoted/code/path classifications fail coherence when delimiters or path shape do not cover every grouped occurrence.
5. A generic capitalized or hyphenated component term cannot claim a supplied exemption without exact typed reference evidence. A model may still call it `contextual_name`; preserve this as an explicit residual limitation and test ordinary generic controls in both target languages.
6. An unhinted foreign word yields one valid range counterexample and `language_mismatch`; invalid, empty, out-of-range, cross-excerpt, or protected-only ranges yield `language_check_failed`.
7. `compliant` plus any negative hint, `noncompliant` with null/no usable counterexample, missing/duplicate/foreign hint IDs, and malformed/truncated maximum arrays all fail closed.
8. Maximum-shape schema echoes cover Chat and Responses and both anyOf branches under the actual effective 1,024 cap. They prove transport and observed fit only, not classifier competence or universal budget sufficiency.
9. Russian and English targets use the same rules; minor grammar defects without foreign prose remain outside this checker.

## Recommendation

Use grouped per-token-role judgments plus one exact negative witness. Do not require per-occurrence output records or an `additional_foreign_spans` inventory. The server retains exact occurrence ownership and validates every claimed exemption; the model remains responsible for the complete-prose disposition in the same call. This is the smallest contract that exposes the V73 contradiction, preserves current hint coverage and exemptions, and has a credible chance of completing under the unchanged budget without claiming universal reliability.
