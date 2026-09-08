# V49 code review — round 1 final

## Recheck of the two initial findings

Both findings in `language-v49-code-review-1-initial.md` are addressed.

1. `DISCOURSE_WORD` now rejects whole-token English and Russian coordination/subordination markers, and it is used in the noun/predicate gap, qualified-noun modifiers, English tentative-assistant construction, and fictional-content construction. The original reproductions no longer join evidence across `and` / `и`; the added tests also cover modifier-to-noun crossing and `while` / `пока`. The negative lookahead is token-bounded, so words merely beginning with a listed conjunction are not excluded.
2. The direct `assistant tentatively/provisionally suggested/indicated that ...` path now requires a bounded `may|might|could` before any clause boundary. Plain action suggestions with `should`, an intervening conjunction, or no modal remain factual. The intended possible-claim examples remain covered.

The benchmark expectation update to `answer-generation-v46` / `answer-verifier-v30` matches the exported runtime constants changed in this diff.

## Remaining limits

The patterns remain deliberately finite lexical screens rather than parsers. A syntactically unusual conjunction outside the listed English/Russian set can still evade the boundary, and a modal construction may be semantically ambiguous between a report and a tentative action. Those cases still depend on retrieval eligibility and downstream qualification checks. I found no concrete newly introduced bypass within the supported constructions that warrants widening this patch.

## Disposition

No remaining actionable finding in the reviewed V49 boundary. The fixes close the reproduced conjunction and arbitrary-`that` paths without changing memory eligibility, semantic-verifier requirements, retry behavior, model selection, or gate policy.
