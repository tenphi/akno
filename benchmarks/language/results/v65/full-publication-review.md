# V65 full publication review

## Result

One wording correction is needed; the numerical tables, failure classifications, decision, evidence links and corpus boundary otherwise match the preserved V65 artifacts.

## Finding

All three publication surfaces say there are eight accepted source/qualification errors and then say “ordinary-prose qualification failures” or “ordinary-prose failures” are zero. The gate does contain a separate metric named `ordinaryProseFailures: 0`, while the same held-out groups contain `translationQualificationErrors: 4` per run and the independent receipt marks `qualificationPreserved: false` on all eight Russian exclusion answers. Calling the zero metric “ordinary-prose qualification failures” makes it sound as though no produced prose lost qualification, contradicting the immediately preceding source/qualification-error statement and the receipt.

Use the gate’s exact category or clarify its distinct scope, for example: “The separate ordinary-prose baseline failure metric is zero.” Keep the eight translation-qualification/source-entailment errors explicit. This applies to:

- `benchmarks/language/results/v65/README.md`: “ordinary-prose qualification failures”
- `benchmarks/language/v65-trial-amendment.md`: “ordinary-prose failures”
- `tmp/pr70-v65-full-complete-body.md`: “ordinary-prose failures”

## Verified

- Final totals match the grade and gate: 243/320 useful writable answers, 33/40 complete retained sets, 140/160 distinct query/view retrievals (280/320 answer-language observations), 255 produced answers, 65 writable nulls, and 32 justified read-only nulls.
- The group table matches the gate exactly: development 71/80 and 56/80 answers with 10/10 and 7/10 retention and 40/40 and 32/40 retrieval; held-out 62/80 and 54/80 with 8/10 retention and 36/40 and 32/40 retrieval. Availability is 0, 1, 0, 1 cases respectively.
- The eight Russian exclusion outputs are correctly separated from the four source-faithful but unresponsive counterfactual answers and from invalid verifier shapes. The two availability failures are described as invalid verifier outputs, not source absence or justified case exceptions.
- The full gate is false for the stated answer, retention, availability, unsupported-output and translation-qualification failures. Models, token ceilings and thresholds are reported unchanged.
- The initial/final grade and gate, temporal disagreement, report-scope dissent and adopted source-only adjudications are preserved without claiming unanimity.
- V20 held-out is correctly declared exposed after this trial, and the documents require a new approved held-out corpus for later full validation.
- All relative README and amendment links currently resolve. The pending held-out forensic note is not linked or used as authority for a publication claim.

## Resolution

Resolved. All three publication surfaces now state the zero dimensions as language violations, unsafe factual promotion and source-byte changes, then separately report that authored-Markdown classification checks pass. This no longer conflicts with the eight disclosed translation-qualification/source errors.

The finalized held-out forensic review is copied as `held-out-forensic-review.md`, linked from the V65 README, and its relative report/reproduction links resolve. A second relative-link scan of the README and trial amendment found no broken links. The publication review is now clean.
