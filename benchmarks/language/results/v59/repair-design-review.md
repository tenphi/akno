# V59 bounded repair-request design review

## Conclusion

Proceed with a failed-position-keyed repair request. The smallest coherent change is to replace the misleading `rejected_candidates` array with `repair_targets`, where each entry binds one zero-based original extraction position to that position's exact failed draft and its validation issues. This changes private model input only. It does not justify changing the repair output, accepting a repair locally, adding a call, or retrying a semantic rejection.

The complete original source must remain the only evidence. A target's `original_candidate` is an untrusted draft and a continuity obligation, not evidence. The existing cleaner, immutable-position transaction check, original-position repair obligation, and full semantic verifier must all remain mandatory.

I found no design blocker. The main compatibility risk is relation repair: relations refer to original extraction indices, so removing every view of admitted candidates can leave the model unable to identify a valid relation target. Preserve a compact, explicitly read-only admitted table for that purpose rather than resending complete admitted candidate objects.

## Evidence from V58

The selected exclusion repair request in [`bench-results/language-selected-v58-trace.jsonl`](../../../../bench-results/language-selected-v58-trace.jsonl), row 44, supplied both extraction positions under `rejected_candidates`, even though position 0 was already admitted and `admitted_positions` also named position 0. The only validation issue belonged to position 1: its claimed `Zephyr QX-100` subject identifier was absent from its deciding frame. The repair response nevertheless copied the sibling bracket-exclusion proposition into position 1.

The acceptance path failed safely. Row 45 kept the returned record at original position 1 and sent the exact position-1 draft through `repair_obligations`. The verifier marked `qualification_scope_preserved=false` with `changed_repair_proposition`, so the copied sibling did not survive. This demonstrates two separate facts:

- Existing transaction and semantic gates protect correctness after a bad repair.
- The repair input itself is unnecessarily ambiguous: one field calls an admitted record rejected, while the actual target and its issue are separated elsewhere in the payload.

The proposed request improves repair availability and focus. It is not a new semantic guarantee.

## Recommended private request contract

Use a payload of this shape:

```json
{
  "source": { "kind": "structured", "items": [] },
  "reference_clock": null,
  "index_basis": "zero_based_original_extraction_order",
  "repair_targets": [
    {
      "candidate_index": 1,
      "original_candidate": {},
      "validation_issues": [
        { "reason_code": "validation_failed", "reason": "..." }
      ]
    }
  ],
  "read_only_admitted_context": [
    {
      "candidate_index": 0,
      "kind": "claim",
      "subject": "invented subject",
      "text": "Invented admitted statement."
    }
  ]
}
```

`repair_targets` should be constructed in ascending original extraction order from the unique held positions. Each `original_candidate` should be exactly `parsed.candidates[candidate_index]`; it must not be a cleaned, projected, reindexed, or reconstructed value. Group all issues for the same position inside that target. Do not repeat provisional `candidate_id` as an authority: it identifies a failed cleaning result and can change after repair, while the original index is the transaction key.

Remove `rejected_candidates` and the separate flat `validation_issues` field. Their information is either false for admitted candidates or belongs beside a specific target. State in the system instruction that indices are zero-based positions in the original extraction array, not offsets into `repair_targets` or the response array.

Keep admitted context narrow. `read_only_admitted_context` should contain only original index plus the minimum fields needed to resolve a relation target: `kind`, `subject`, and readable `text`. Do not resend admitted support, discourse frame, attribution chain, qualifications, page, or time. The original source remains available for those meanings. The request should say that these entries may be referenced only to preserve a source-supported relation and can never be returned or substituted for a target. If current evidence shows no relation repair needs even this table, integer-only `admitted_positions` is safer; however, removing all position-to-proposition mapping would make a structurally invalid relation target impossible to repair reliably.

The model may omit any unsafe target. An empty or partial `repairs` array must continue to leave omitted positions held while admitted candidates proceed to verification.

## Gates that must remain unchanged

The current implementation already has the right enforcement sequence in [`packages/core/src/write/retain.ts`](../../../../packages/core/src/write/retain.ts):

- The output schema permits only the exact failed original positions and caps output count to the number of targets (lines 527–535).
- Runtime validation independently applies the same allowed-position set, a strict transaction envelope, and the duplicate-index check (lines 568–589).
- Returned candidates replace only their original vector positions (lines 591–596).
- Deep equality at original positions protects every admitted candidate, while the lost-position check detects dedupe, cap, and dependency loss (lines 597–625).
- A surviving repair is paired with `parsed.candidates[candidate_index]`, not with another draft (lines 618–620), and that exact obligation reaches the semantic verifier (lines 645–652).
- Candidate support, frames, attribution and relations are rebuilt by the ordinary cleaner. Relation targets continue to resolve against original batch indices (`cleanRelations`, lines 1902–1913).

These controls should not be weakened to make repair output more likely to pass. In particular, do not accept a repair because it copies an independently supported proposition, infer correctness from its exact quotes, or retry after the semantic verifier rejects it.

The output contract can remain `{ repairs: [{ candidate_index, candidate }] }`. Duplicate, admitted, fractional, negative and out-of-range indices must continue to fail the whole repair transaction as typed degradation without a second repair call. Candidate entries that remain structurally invalid stay held. Structurally valid entries still require full-source semantic acceptance, including the original-position proposition obligation.

## Attribution, frame and source authority

The target's original support and frame are useful diagnostics but are not authoritative. A repair may change them only to exact spans from the complete supplied source. The existing frame coverage, identifier, attribution-role, nested-reporter and qualification floors must run again over the complete repaired vector.

The semantic verifier must receive:

- the unchanged complete original source;
- the repaired candidate with its newly validated support and frame;
- the exact original draft from the same original index as its repair obligation; and
- related surviving candidates only as relation context, never evidence.

This is sufficient to distinguish a valid structural repair from the V58 sibling substitution. No new attribution heuristic, frame inference, or generated obligation array is needed.

## Compatibility, budget and observability

This payload is private to `runRetain`; it does not require a public protocol, storage, managed-marker, or receipt-schema migration. Legacy non-repair paths are unchanged. Model adapters that only consume messages and the declared output schema see no output-shape change.

The input should generally shrink because admitted support/frame objects are no longer repeated. The repair remains one existing call with the existing 3,200-token requested ceiling and configured ModelClient cap. There is no new retry or verifier pass.

Because the prompt and model-visible request semantics change, increment the retention prompt version and update benchmark prompt fingerprints/version expectations. Trace consumers or tests that inspect `rejected_candidates`, `admitted_positions`, or flat `validation_issues` need migration. Do not call the compact admitted table evidence in prompts or traces; `read_only_admitted_context` accurately states its authority.

`parsed.candidates` can contain malformed entries that the cleaner skips without producing a held candidate. Target construction therefore must be driven by the held-position map, not by compacted cleaned-array offsets. A noncontiguous target set is expected and must remain valid.

## Meaningful tests

Extend [`packages/core/src/write/retain-repair.test.ts`](../../../../packages/core/src/write/retain-repair.test.ts) and the existing frame/attribution integration tests with invented data:

1. **Exact request projection.** With one admitted and one held extraction position, assert that `repair_targets` contains only the held position, exact original draft, and only its grouped issue; assert `rejected_candidates` and the flat issue list are absent. Confirm admitted support/frame bytes do not appear in the read-only table.
2. **Noncontiguous targets.** Use original positions 1 and 3 with admitted positions 0 and 2. Assert zero-based indices and originals remain paired. Return repairs in reverse order and verify vector placement and each resulting `repair_obligation` still bind to positions 1 and 3.
3. **Output index failures.** Preserve the existing duplicate, admitted, fractional and out-of-range cases; add a negative index if it is not already covered. Each must reject the transaction, report typed degradation, retain admitted records unchanged, and make no extra repair call.
4. **Partial and empty repair.** Repair one of two targets, and separately return no repairs. Omitted positions remain validation-held; surviving admitted/repaired positions still undergo the normal verifier.
5. **Sibling-copy and dedupe.** Reproduce the structure of V58 with invented propositions: a returned target containing an admitted sibling must be rejected either by transaction dedupe/lost-position checks or, when phrased differently enough to survive structural dedupe, by the original-position semantic obligation.
6. **Relations across original positions.** Cover a repaired position related to an admitted nonadjacent position and a relation to another repaired position. Confirm indices never become offsets into the target or response arrays. Invalid, self and absent targets remain held.
7. **Frames and attribution.** Confirm a repaired candidate with a wrong item ID, nonexact quote, missing deciding frame, crossed source roles/speakers, or unsupported reporter remains held. Confirm a structurally valid attribution/frame change still reaches mandatory semantics with the same-index original obligation and is rejected when it changes the proposition.
8. **All-held batch.** Assert an empty read-only admitted table and one target per unique failed original position.
9. **Malformed envelope/no retry.** Preserve strict envelope, max-count and duplicate-key behavior for malformed model output, with one repair call only.

Existing tests already cover admitted-record immutability, empty repairs, duplicate output positions, admitted/out-of-range/fractional output positions, duplicate repaired propositions, basic relation-index validity, and the verifier's original repair obligation. The new tests should establish the changed input contract and noncontiguous pairing rather than duplicate those assertions through synthetic semantic claims.

## Residual limitation

The model can still ignore a clear target and return a different source-entailing proposition. The server cannot prove natural-language identity from the repaired prose. The same-index original obligation and mandatory full-source verifier remain the authority for that case. V59 should be evaluated as a repair-selection improvement with unchanged acceptance safety, not as proof that every writable held candidate will be repaired.
