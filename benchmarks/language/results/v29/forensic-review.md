# V29 forensic review

This is a read-only forensic review of the exposed V29 development and held-out reports and traces. It is not an independent blind-grader receipt. V30 and V31 outputs were not inspected.

## Result

The independent receipt reports 29/40 useful writable retentions and 224/320 useful answers. All 95 writable null answers were judged unjustified because the admitted source supported a useful qualified answer, even when rejecting the particular generated draft was correct.

| Null cause                 | Count | Interpretation                                              |
| -------------------------- | ----: | ----------------------------------------------------------- |
| `no_eligible_evidence`     |    48 | Upstream retention produced no usable record.               |
| Semantic false rejection   |    17 | A faithful draft reached the verifier and was rejected.     |
| Deterministic false hold   |    14 | A faithful draft was blocked before semantic verification.  |
| `empty_draft`              |     8 | Generation returned no blocks despite relevant evidence.    |
| Availability/degradation   |     6 | Generation failed with typed `language_mismatch`.           |
| Correct semantic rejection |     2 | Drafts changed source-relative “next month” to “next week.” |

The raw totals are 48 `no_eligible_evidence`, 19 `verification_rejected`, 14 `draft_rejected`, 8 `empty_draft`, and 6 `generation_failed`. The 19 semantic rejects split into 17 false rejects and 2 correct rejects. Correctly rejecting those two drafts still left usefulness misses because faithful answers were possible.

## Retention failures

No failed writable case had empty extraction or a retention availability failure. Every failed case produced at least one candidate. The 11 unsuccessful case-runs split as follows.

### Structural cleaning or repair changed or lost the proposition — 4

- `v16-held-undated`, runs 1 and 2: the initial and repaired candidates were held at validation with `time_unresolved`. Representative repair prose says “next week, with ‘next week’ measured from the undated source note … and with the reference date therefore unknown.” It contains both the relative anchor and unknown clock, making these representation/recognition false holds.
- `v16-held-rejected`, runs 1 and 2: extraction represented the rejected workshop shipment and “no pickup is scheduled.” Repair replaced the pickup candidate with another rejected-shipment candidate. Run 1 wrote two near-duplicate rejection records; run 2 wrote one. The no-pickup proposition disappeared despite a successful repair receipt.

### Semantic-verifier false rejection — 6

- `v16-held-report`, run 2, `discourse_uncertain`: “Ada Marlow reports that Bo Winters said …; Ada Marlow had not read the terms or received confirmation, so this report is unverified.” The verifier returned `proposition_supported:false` and `qualification_scope_preserved:false`, although the draft preserves the outer relay and its verification limits while leaving Bo's embedded statement reported rather than established.
- `v16-held-alternatives`, run 2, `discourse_uncertain`: “two competing tentative hypotheses … with no evidence for either, and she has not selected a cause.” The verifier returned false for proposition and action arguments although both causes, evidentiary status, and nonselection remain present.
- `v17-held-assistant`, run 1, `discourse_uncertain`: a “preliminary, unverified assistant reading—not a verified contract term,” including that the assistant had not reviewed the contract or verified the assumption, was rejected for proposition and qualification.
- `v17-held-rejected`, run 1, `noncanonical_without_context`: “collection of Zephyr QX-100 has not been booked” is directly supported by “Collection of the device has not been booked,” with the declined-offer context included. The verifier rejected proposition and qualification.
- `v17-held-report`, run 2, two `noncanonical_without_context` holds: both “Ada Marlow has arranged no shipment” and the qualified Ada-to-Bo relay were faithful to their source spans, but neither survived verification.
- `v17-held-exclusion`, run 2, `discourse_uncertain`: “the service contract … does not cover replacement of the protective cover” directly translates the asserted exclusion. The verifier accepted proposition and action arguments but rejected qualification scope.

### Ownership-routing false rejection — 1

- `v17-held-report`, run 1: “Ada Marlow states that she has arranged no shipment” passed semantic verification but placement held it with `routing_uncertain` / `ownership_uncertain`. The separate Bo report was written, so the direct self-attested no-shipment proposition was lost.

No rejected candidate responsible for these 11 usefulness failures required rejection for factual safety.

## Answer nulls

The 48 `no_eligible_evidence` nulls came from `v16-held-undated` in both runs (16), `v16-held-report` run 2 (8), `v16-held-alternatives` run 2 (8), `v17-held-assistant` run 1 (8), and `v17-held-report` run 2 (8). This upstream cause accounts for just over half of all writable nulls.

The 14 deterministic false holds comprise five attribution holds, seven discourse holds, and two protected-value holds. Faithful examples include “tentatively and unverifiedly reported,” the Russian nominal assistant-report construction, “a fictional, hypothetical example,” “контрфактически описала нереализованный вариант,” and open questions about whether an agreement includes return delivery.

Of the 19 semantic-verifier rejects, 17 were false. Examples include:

- `v16-held-question`: “an open, unanswered question … Neither inclusion nor exclusion has been established.”
- `v16-held-fiction`: “a fictional, hypothetical example … not an actual agreement.”
- `v16-held-alternatives`: both tentative hypotheses, no evidence for either, and no selected cause.
- `v17-held-report`: a Russian answer preserving Ada's relay of Bo's report, lack of reading, and lack of confirmation.
- `v17-held-alternatives`: both causes, both tentative, no evidence for either, and no selected cause.

The two correct rejects were `v17-held-undated` run 2 drafts that said “next week” although the source and retained record said “next month.”

All 8 `empty_draft` nulls were `v17-held-exclusion` run 2. The direct protective-cover exclusion had been falsely held; given only the adjacent unsettled display-cable record, generation consistently returned no blocks.

The 6 typed `language_mismatch` failures were `v16-held-counterfactual` run 1, `v16-held-rejected` runs 1 and 2, `v16-held-assistant` run 2, `v17-held-undated` run 1, and `v17-held-fiction` run 2.

## Design review

The evidence supports one coherent change: make deterministic stages validate typed proposition identity and qualification structure, while limiting the model verifier to semantic equivalence that cannot be established structurally.

### Represent unresolved source-relative time structurally

An unknown calendar clock and a known relative expression are compatible facts. Preserve the relative expression and unit, anchor identity, unknown anchor date, and tentative/proposed status as separate fields. Validation should accept their supported combination without depending on generated wording. Answer verification should compare the relative unit and anchor as protected semantic fields. This accepts the faithful retention candidates while rejecting month-to-week changes.

### Make repair position- and obligation-preserving

Give each raw candidate position a private obligation fingerprint derived from exact support and a typed proposition skeleton: subject, predicate/action, object or purpose, polarity, disposition, and temporal identity. A repaired position must satisfy the same fingerprint. Preserving a candidate ID or whole-batch validity is insufficient.

Require a one-to-one mapping from failed positions to original obligations and keep every admitted position byte-for-byte unchanged. Reject the repair transaction if an obligation disappears, two positions collapse onto one proposition, or support moves across positions. Original admitted candidates can continue with a typed repair-degradation receipt. This addresses both `v16-held-rejected` failures without semantic retry or invented content.

### Separate semantic ownership from storage placement

Placement should route by resolved subject/entity while preserving the speaker as attribution. A first-person assertion about shipment in a device discussion can route to the device page without implying that the speaker owns the device. If deterministic resolution cannot choose a destination, keep the verified record in a neutral generated-memory location with unchanged provenance instead of discarding it. `ownership_uncertain` should describe placement confidence rather than erase a verified proposition. Caller-provided paths and authored files remain unchanged.

### Calibrate semantic verification with a structured comparison

Keep the three required booleans and conjunction, but require a compact comparison before them: source and candidate propositions; actor/action/object-or-purpose roles; attribution layers and uncertainty scope; discourse, polarity, and temporal anchor/unit; and a specific mismatch or `none`.

Each false verdict should identify a concrete candidate clause, the conflicting or missing source proposition, and a bounded mismatch type. A generic statement that the source is ambiguous is not a sufficient rejection: a candidate may preserve the same ambiguity or state a narrower proposition that is explicitly supported. Rejection is warranted when the candidate selects an unsupported reading, turns uncertainty into certainty, or omits ambiguity material to its selected proposition. The accumulated verifier instruction “Ambiguity is unsupported” should therefore be replaced with this scoped rule.

Reject missing dimensions, contradictory comparison/booleans, unsupported source spans, or a false verdict without a concrete mismatch. Requiring a mismatch raises the cost of reflexive rejection, but must not turn `mismatch:none` into an acceptance override: all three booleans remain required and code still validates deterministic invariants independently. Do not retry, and never treat the assessment as evidence. Exact protected values, citations, typed qualification floors, and deterministic guards remain authoritative.

Use contrastive calibration pairs rather than accepted phrase lists: month→week, inspection→replacement, outer relay uncertainty applied to the inner speaker, fictional participant→actual reporter, one alternative dropped, and “no evidence for either” weakened to only one alternative.

## Priority

Retention caused 48/95 nulls before generation. The smallest coherent sequence is:

1. structured source-relative clock identity;
2. obligation-preserving repair;
3. non-destructive placement fallback for verified records;
4. structured comparison feeding the unchanged conjunctive verifier verdict.

This preserves one-shot generation, one bounded repair, full semantic verification, and the zero-unsupported-output gate.
