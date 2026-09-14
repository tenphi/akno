# Integration repeat limit: legacy run 2

## Scope and accounting

This audit explains the largest run-to-run loss in the completed Integration legacy block. It reads only legacy
runs 1 and 2, with detailed trace inspection limited to `v3-dev-alternatives` and the two final-grade coordinates
needed to reconcile the totals. It does not inspect recent run 2, alter a grade, or recommend another change.

Integration falls from **76/80 useful answers in run 1 to 66/80 in run 2**, with no accepted answer errors in
either run. The complete ten-coordinate loss is:

- `v3-dev-alternatives`: 8/8 to 0/8;
- `v3-dev-report`: 8/8 to 7/8; and
- `v3-dev-example`: 8/8 to 7/8.

Every other legacy case has the same useful-answer count in both runs.

## Alternatives: a coupled candidate is generated, then protectively held

The source asks the reader to consider two incompatible Zephyr QX-100 hypotheses—annual or biennial warranty
service—states that neither is established, and says to keep both for discussion. Source usefulness therefore
requires preserving both alternatives and their shared non-establishment/discussion scope.

### Extraction and local processing

The run-2 extraction request at trace row 3804 contains the integration retrieval-unit rules, including the explicit
instruction that competing hypotheses retain all alternatives, their common evidence limits, named nonselection,
and any unconfirmed underlying state in one independently retrievable semantic unit.

Rows 3806 and 3809 return one candidate with:

- both annual and biennial hypotheses in one record;
- `commitment: tentative`;
- the statement that neither hypothesis is established; and
- the statement that both remain for discussion.

This is direct evidence that the new unit boundary is present in the call and reflected in the candidate's grouping
and metadata. It is not proof that the prompt alone caused that output. The generated main act is also materially
different: `Ada Marlow retains two incompatible hypotheses ...`, which turns the source's inclusive proposal to
consider and keep alternatives for discussion into a current action attributed solely to Ada.

The language check succeeds at rows 3807–3809. No structural repair call occurs. The candidate proceeds directly to
the existing mandatory semantic verifier at rows 3810–3813.

### Semantic verification and placement

The verifier compares immutable source and candidate text and rejects the candidate on all three required semantic
dimensions at rows 3812–3813:

- `proposition_supported: false` because the candidate asserts that Ada retains the hypotheses;
- `action_arguments_preserved: false` because an inclusive consideration/keep-for-discussion act becomes Ada's
  individual retaining act; and
- `qualification_scope_preserved: false` because a discussion proposal becomes current retention.

The owned witnesses point to the source's `Рассмотрим две несовместимые гипотезы` and the candidate's `Ada Marlow
retains two incompatible hypotheses`. The public retention result at row 3814 is consequently held at
`verification` with `reason_code: discourse_uncertain`.

Placement is never attempted: `model_usage.placement` is empty and there is no placement result for this candidate.
With no stored record, both retrievals are empty and all eight query coordinates return null. The final source grade
therefore marks retention incomplete and all 8/8 answers not useful.

This is a **protective hold of a defective generated candidate**, not a correct representation of the source as
having no useful knowledge. The source-supported alternatives remain useful, but the only candidate changes the
governing activity and the fail-closed verifier prevents that changed assertion from being published. There is no
availability failure, malformed response, local lexical floor, repair-position issue, or placement decision behind
the collapse.

### Run-1 contrast and repeatability limit

Run 1 receives the same retrieval-unit instruction but generates `Ada Marlow keeps two incompatible hypotheses ...
for discussion` with hypothetical commitment (rows 345–350). Its verifier treats `keeps ... for discussion` as the
source's same discussion act and accepts all semantic dimensions at rows 353–354; placement then succeeds at rows
355–363. All eight run-1 answers are useful.

The comparison therefore demonstrates that the integration can form a source-complete coupled unit, but does not do
so repeatably. In run 2, the unit and qualification metadata survive while the governing activity changes. The
retrieval-unit instruction is exercised at the representation boundary; it does not guarantee neutral, source-faithful
activity wording or a writable result.

## Remaining two-coordinate loss

The final packets and the two targeted downstream paths account for the remaining difference without another broad
trace search:

- **`v3-dev-report`, one coordinate.** Retention is written and seven answers are useful. For the Russian report
  query, generation produces a substantively faithful Russian assistant-report block at rows 3794–3797, but the
  local discourse guard rejects it before semantic verification. Row 3798 returns `draft_rejected`, with one
  generated block, zero passed guards, and `rejection_counts.discourse: 1`. This is a downstream local false hold,
  not retention loss or verifier unavailability.
- **`v3-dev-example`, one coordinate.** Retention is written and seven answers are useful. The final Russian query
  produces a faithful fictional-example block at rows 4043–4046 and passes local guards. The answer verifier then
  returns `bad_response` at rows 4047–4050 after reaching the 1024-token ceiling. Row 4051 reports
  `verification_unavailable` and `answer_verification_failed`. This is a typed downstream availability loss, not a
  semantic negative.

Those two single-coordinate losses plus the eight alternatives coordinates exactly reconcile 76/80 to 66/80. The
repeat exposes a retention-generation/verification variance concentrated in the alternatives case, while preserving
the safety result: the block has no accepted source, qualification, language, or promotion errors in either run.
