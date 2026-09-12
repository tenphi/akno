# V42 code review, round 1

Reviewed the uncommitted runtime diff from `de5169e` in retention, the shared language contract, answer generation, and the meaningful reference/repair regressions. I did not inspect fresh V19 outputs or modify runtime code.

## Disposition

No actionable correctness finding in the reviewed boundary.

- Retention derives language hints only from immutable structured speaker labels and exact source tokens containing both uppercase letters and digits. It does not use generated subject text, candidate pages, or proposed routes as authority. Generic assistant/user labels remain excluded because they require localization.
- `ModelClient` still filters hints to exact strings occurring in generated excerpts, includes their size in the existing 24k/64-reference bounds, and submits the complete unmasked prose to the checker. A hint cannot override `compliant:false`; the new end-to-end regression explicitly preserves that fail-closed behavior.
- Passing the same source-derived hints to the one structural repair call is consistent with extraction. Repair output receives no broader exemption and still goes through full cleaning, repair-transaction integrity, and semantic verification against the original source.
- The source-wide reference collection can include a name or identifier from an item unrelated to a particular candidate. That is acceptable within this contract because the hint certifies only exact spelling as language-neutral; it supplies no proposition, support span, subject identity, or routing permission. Semantic and span checks remain authoritative.
- The identifier matcher deliberately recognizes compact source tokens such as `QX-100`, rather than treating arbitrary surrounding phrases as references. It preserves original spelling and deduplicates exact reference text. Names remain bounded by the protocol's structured `speaker` field and by the existing character/reference budgets.
- The language-contract clarification correctly separates language identity from sentence completeness and grammar. It applies to subject labels without declaring arbitrary English words acceptable in Russian prose or vice versa; the checker still judges the entire phrase around any references.
- Antecedent-resolution guidance is generation-only and requires an unambiguous complete supplied source plus the exact antecedent span in deciding support/frame. It changes neither the cleaner nor routing authority. Ambiguous antecedents must remain unresolved, and all generated candidates still require semantic verification before the existing ownership decision.
- The answer guidance binds proposer/rejector and inner reporter roles from readable evidence, and keeps tentative qualification on content or timing rather than inventing a preliminary document. It introduces no deterministic bypass, verifier relaxation, retry, or new model call.

The main finite limitation is that source-backed reference extraction is intentionally narrow: it will not identify every legitimate title or mixed-case product name. Such misses can still cause conservative language holds, while the bounded hints cannot themselves make a semantically wrong candidate pass. The focused tests were reported running during review; I inspected the changes but did not independently rerun the suite.
