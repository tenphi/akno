# V76 provider-control failure review

Independent Sol review, read-only. I inspected the frozen declaration, the complete once-only result receipt, the live log, and the exact expected/returned JSON trees. I made no provider call and do not authorize a semantic launch here.

## Preserved outcome

The suite ran once on frozen runtime `44e6e714f1758948f306ec90cdae9b0d453e3604`, bound to declaration SHA-256 `89352e531e0274e79d60cd0583fa763652eb9bf73455275a977cf7182119ce0c`. All ten logical controls completed. Nine were provider-successful, schema-valid, and deeply exact. The declared suite correctly ended with `passed:false` because `four-branch-retention-repair` was not deeply exact.

The failed logical control made one endpoint request and returned `ok:true`, a locally schema-valid value, and 611 output tokens under the 2,400 effective cap. Its transport entry completed successfully. The result is therefore an exact-copy failure, not an availability, truncation, schema-rejection, or cap-exhaustion failure.

## Exact difference

There is one difference in the complete returned tree:

`$.repairs[2].proposition_and_nontemporal_scope`

- expected length: 220 UTF-16 units;
- returned length: 194 UTF-16 units;
- difference: one 26-letter cycle was removed from the repeated synthetic marker body.

All keys, array lengths, branch selections, candidate indices, other repair fields, and the full-candidate branch are identical. In particular, the new field

`Processing time is not the reference point for «next month».`

was copied exactly at 60 UTF-16 units. The returned value still satisfies the production schema because that field has a maximum-length contract rather than an exact-length contract.

## Diagnosis

The evidence is most consistent with a synthetic repetition-copy limitation. The failed expected string consists of a readable prefix followed by a long cyclic alphabet marker. Removing one complete 26-character cycle preserves its apparent pattern and grammatical shell. That makes the fixture unusually vulnerable to model deduplication or normalization.

This remains a real failure of the declared deep-exact protocol gate and must stay recorded as 9/10. It does not show that the new clock-exclusion field is unsupported, that the endpoint rejected the strict schema, or that runtime repair validation weakened. It also does not prove natural maximum-length repair content will copy exactly; that requires separate evidence.

## Bounded amendment assessment

A separately declared natural-sentence replacement control is justified, analogous to the preserved V75 amendment, provided it is treated as a new control rather than a retry or rewrite of this one.

The replacement should:

1. use the exact same frozen production schema, branch count, candidate indices, field set, caller cap, role cap, API, and strict deep-exact acceptance;
2. preserve every bounded field's exact UTF-16 length: report 200/78/120, clock-with-exclusion 195/90/60/52, and clock-without-exclusion 220/110/68, with the same 400-unit composed totals;
3. retain the exact 60-unit same-clock exclusion unchanged;
4. replace cyclic/repeated marker padding with distinct complete invented sentences, avoiding repeated full sentences and long repeated word or character runs across the fixture;
5. require current captured endpoint-schema equality to the original V76 failed control's schema and local parsing of the new expected value;
6. bind its declaration hash, frozen SHA, clean tracked tree, original V76 declaration hash, and preserved original `9/10` failed receipt before execution;
7. refuse overwrite or rerun, save `started` before the request, preserve endpoint/usage/redacted-error evidence, and require one provider-successful, schema-valid, deeply exact result within the unchanged cap.

If that amendment passes, it supports transport and exact copying for a realistic maximum-field repair instance. The published evidence must still state that the original declared suite failed 9/10 and that the amendment is separate. If it fails, preserve that result and stop; another reformulation would become iterative testing rather than a bounded diagnostic.

## Disposition

**Hold semantic launch.** The original protocol failure is valid and correctly preserved. A single, predeclared natural-sentence maximum repair amendment with the constraints above is a coherent next diagnostic; it does not relax runtime gates or replace the failed result.
