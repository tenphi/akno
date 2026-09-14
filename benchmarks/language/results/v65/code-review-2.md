# V65 code review — round 2

## Disposition

No actionable blocker found in the current V65 diff against frozen V64
`03ce30b`.

This review covered the runtime prompt changes in
`write/retain.ts`, `ops/answer.ts`, and `ops/answer-source-audit.ts`, their
retention and answer integration tests, prompt-version fixtures, the changeset,
and `benchmarks/language/v65-trial-plan.md`. The change remains within the
declared prompt-only scope: there is no schema, parser, deterministic floor,
model-call, retry, routing, budget, or acceptance-gate change.

## Source-attached record identity

The retention instruction makes a useful distinction that the existing source
and destination flow can represent: a product name may identify an exclusion
record without thereby owning the generic component mentioned in that record's
separate coverage limit. The allowed form, `the Zephyr QX-100 exclusion record
does not settle motor-repair coverage`, is supported only when the source itself
establishes the product/record antecedent. The instruction explicitly denies
authority to subject/page routing metadata, an unrelated neighboring name, or a
competing record, and preserves explicit component ownership when the source
actually states it.

This guidance does not alter admission. The generated candidate still carries
its exact support and complete discourse frame through the existing candidate
checks and unchanged mandatory retention verifier. The new eight-case matrix
confirms that the intended named-record and explicit-ownership forms reach
admission only with a positive full-source verdict. Invented ownership,
competing-record borrowing, unrelated-neighbor borrowing, reversed polarity,
document-silence broadening, and changed object all end at
`hold_stage=verification`; none enters repair or inherits authority from the
proposed page.

The prompt uses the repository's invented Zephyr example directly, which is
appropriate here because the distinction depends on the difference between
record identity and component ownership. It does not add a product/component
dictionary or a general anaphora exemption.

## Group-relative epistemic subjects

The answer-generation instruction preserves the material experiencer of a
selected knowledge limit. It allows meaning-preserving finite paraphrases
(`unknown to us` / `we do not know`, `нам неизвестны` / `мы не знаем`) while
rejecting the distinct claims expressed by bare unknownness, Ada's personal
ignorance, nobody's knowledge, unknowability, or record-level
non-establishment. It also keeps the group predicate separate from adjacent Ada
hypothesis and no-event predicates and prevents a private-frame group clause
from entering an independently selected citation.

The verifier guidance maps those distinctions to the existing immutable
coordinate contract correctly:

- a missing group experiencer uses `actor=omitted`, its original source anchor,
  and a null answer anchor;
- the present bare-unknownness counterpart is independently located by the
  qualification alignment and marked `generalized` or `changed`;
- a substituted explicit experiencer is `changed` at its actual answer anchor;
- action-argument and qualification dimensions receive separate false results
  and mismatches, and the stronger unqualified proposition is also false;
- genuinely impersonal source unknownness and an unselected private-frame
  clause remain outside the group requirement.

These instructions agree with the Zod refinement: `omitted` requires a null
answer anchor, while changed/generalized counterparts require their actual
anchor. `answerAlignmentsSupported` continues to reject any omitted,
generalized, or changed category independently of the three top-level booleans.
The positive cases therefore do not create a semantic bypass, and valid
negative verdicts still produce ordinary `verification_rejected` results.

The principal limitation is the existing representation: each cited evidence
record has one `actor` alignment even when its complete proposition contains a
named hypothetical actor, a group epistemic experiencer, and a named no-event
reporter. The model must select the materially changed group predicate for that
category rather than allowing a preserved neighboring Ada predicate to mask
it. The new wording states that priority explicitly, and the global semantic
comparison still covers the complete block, but local tests cannot establish
model reliability. This is a bounded evaluation risk, not a new code defect or
reason to expand the schema before the declared probes.

## Selection and authority boundaries

The complete-record tests reconstruct and compare the exact supplied source and
answer anchor tables. They also assert that complete-record verification omits
the user question. The private-frame controls demonstrate both sides of the
selection boundary:

- genuinely impersonal selected source text is accepted without an invented
  group;
- a group-relative clause present only in the private frame is left unselected
  and absent from public text.

The source-audit prompt expressly limits the new rule to the selected epistemic
predicate. It does not turn group-relative source language into provenance,
membership, or an identity claim. Existing excerpt selection, complete-record
scope, language checking, all three semantic dimensions, and exact anchor
validation remain mandatory. There is no semantic retry or second verifier.

## Versions, plan, and checks

The version changes are internally consistent:

- retention generation: `retain-extraction-language-v48`;
- retention verifier: unchanged `retain-verifier-language-v31`;
- answer generation: `answer-generation-v60`;
- answer verifier: `answer-verifier-v40`.

The benchmark expectation was updated to the answer versions, and no stale old
version literal remains in current source/benchmark code outside preserved
results. The changeset and V65 plan accurately disclose prompt-only behavior,
unchanged gates and 2,400-token evaluation ceiling, stub limitations, and the
fact that the configured 1,024-token service overlay is not validated by an
isolated 2,400-token result.

I independently reran the three directly affected test files:

```text
packages/core/src/ops/answer.test.ts
packages/core/src/write/retain-subject-frame.test.ts
packages/core/src/bench/answer.test.ts
3 files, 494 tests passed
```

The parent-provided current-tree receipts show 2,761 tests across 143 files
passing, build/typecheck passing, final lint passing after the test-local
`text` shadow was renamed to `candidateText`, and knip, formatting, docs
doctor/build, smoke (8/8), installed-package smoke, and repository safety all
passing. I also inspected the compiled controls:

- `tmp/v65-reference-preflight.log`: eight source-attached record cases,
  complete original source, ownership distinction, competing/unrelated subject
  rejection, and mandatory semantics;
- `tmp/v65-group-preflight.log`: thirteen group-relative cases, English/Russian
  and finite paraphrases, omitted/null and changed/actual anchors, ordinary
  negative-verdict rejection, impersonal scope, private-frame selection, and
  unchanged source bytes.

Those controls establish compiled dataflow and enforcement, not model semantic
competence. The planned one-shot exposed evaluation remains the appropriate
test of whether the new instructions improve generation and comparison without
new false holds.
