# V71 independent code review, round 2

## Scope and result

I reviewed the current uncommitted diff from `8264afe`, including
[`benchmarks/language/v71-trial-plan.md`](../../../../benchmarks/language/v71-trial-plan.md), the retention-verifier
polarity change, the complete-record source-clock translation branch, their integration and transport
tests, and the inherited fixture migrations. I made no runtime or test edits and made no provider calls or
fresh-held-out inspection.

**No blocking or actionable production finding remains in this diff.** The implementation matches the
bounded design: it adds one required source-side enum to candidates that already receive semantic retention
verification, and it adds a conditional schema inside the existing answer-generation call. It does not add a
model pass, retry, semantic repair, public result field, output-ceiling increase, or local grammar expansion.

## Retention polarity enforcement

The verifier prompt at
[`packages/core/src/write/retain.ts`](../../../../packages/core/src/write/retain.ts) lines 321–365 asks for the
governing source proposition's polarity before the three existing semantic dimensions. It separates a real
denial from incidental negative qualifications in a positive report, rejected positive actions,
fiction/counterfactual nonoccurrence, and unresolved question answers. The complete original source, exact
candidate frame, candidate prose, and candidate metadata remain in the same existing request. The prompt
explicitly treats the submitted candidate polarity as a comparison value rather than source evidence.

Each one- or two-candidate strict verdict branch requires `source_selected_polarity: affirmed|negated`
beside its singleton candidate ID at lines 844–881. Strict JSON parsing, semantic-verdict consistency, and
the exact ID set are validated before acceptance. Lines 963–981 then require all three original semantic
booleans **and** equality between the returned source polarity and the immutable candidate polarity. A
mismatch is an ordinary verification hold with the existing typed fallback reason; it does not relabel the
candidate, become an availability error, or trigger repair/retry. A matching enum cannot override a false
semantic dimension.

Candidate binding remains sound. The enum is inside each candidate-specific branch, the existing singleton
ID enum distinguishes the two `anyOf` branches, and exact cardinality/ID-set validation occurs before the
candidate lookup. Missing/invalid fields, foreign or duplicate IDs, incomplete JSON, and trailing content
remain atomic verifier failures. Opposite-polarity batch controls exercise mismatch and swapped-result cases.

The provided exact and provided automatic contracts remain outside this path. No production change touches
their dispatch in `ops/retain.ts`; focused operation tests confirm exact placement remains model-free and
automatic placement still invokes routing/placement without extraction or semantic verification. This is
the intended trust boundary, rather than coverage by the new model judgment.

The output addition is one short enum per verdict. Request sizing and the configured derive ceiling are
unchanged. This is small compared with each existing comparison and span audit, though an already
ceiling-bound provider response can still truncate; the unchanged strict atomic failure path handles that as
unavailable rather than accepting a partial judgment. Only frozen provider controls and exposed evaluation
can establish model classification reliability.

## Structured source-clock rendering

Activation at
[`packages/core/src/ops/answer-record-rendering.ts`](../../../../packages/core/src/ops/answer-record-rendering.ts)
lines 18–55 remains narrow and source-bound:

- exactly one evidence record and one matching live frame;
- one qualified current readable line within the established 600-unit rendering bound;
- resolved Russian output;
- typed temporal precision `unknown`; and
- the **current readable retained text**, rather than private frame or metadata alone, already satisfies the
  existing deictic-time, source-relative-anchor, and unknown-clock helpers.

Reference-bearing records and all ordinary/multiple/unframed cases retain the legacy composition path. A
same-language current record can still use the existing checked exact-copy branch. A declared language
mismatch keeps `copy_allowed:false`, so the active clock shape is the direct strict translation object rather
than an avoidable union.

The translation branch at lines 58–84 requires all three model-owned segments and the one selected evidence
ID. Their limits are 1,200, 400, and 398 units; with two inserted spaces the materialized answer remains at
the prior 2,000-unit ceiling. Missing, empty, extra, over-limit, legacy-text, copy, and foreign-ID shapes fail
schema validation. `answerRecordText` only joins parsed strings in the declared order and supplies no source
fact itself.

The integration in
[`packages/core/src/ops/answer.ts`](../../../../packages/core/src/ops/answer.ts) lines 580–660 materializes that exact
joined text for both publication and downstream checks. `additionalLanguageProse` submits the complete joined
text to the existing ModelClient language check. The same materialized string then passes the unchanged
identifier, actor, clock, discourse, excerpt-selection, anchor, and semantic-verifier paths. The private
segment object does not reach the public answer. Complete-record verification retains its existing source
frame and current retained-record authority.

The segment labels are presentation responsibilities, not evidence. Schema shape alone cannot establish
that the model put the correct proposition or clock meaning in a named field. That is an intentional and
safe limitation: missing recognized clock wording is still held locally, while a wrong period, direction,
actor, object, or omitted qualification must still be held by the full source verifier. The new integration
controls cover wrong period/direction, omitted nonacceptance/no-event/proposal-only/processing/calendar
scope, name and language failures, and a semantic-negative response without weakening any gate.

The existing generation request for one framed record remains `1_024 + 512 = 1_536` requested tokens before
the caller/provider ceiling. The maximum public prose is unchanged at 2,000 characters; the three JSON keys
add modest response overhead. This is bounded but still a live availability variable, so the declared
frozen transport and exposed probes are necessary. Local fixtures establish decoding and enforcement, not
Luna's ability to follow the segmentation consistently.

## Tests run

I ran:

```text
pnpm vitest run \
  packages/core/src/write/retain-polarity.test.ts \
  packages/core/src/write/retention-schema-transport.test.ts \
  packages/core/src/ops/answer-record-rendering.test.ts \
  packages/core/src/ops/answer.test.ts
```

Result: **623 tests passed in 4 files**.

I separately ran the exact/automatic provided-path controls in
`packages/core/test/retain.test.ts`; **2 tests passed** with the other 29 tests in that file skipped by the
name filter. `git diff --check 8264afe --` also passed.

These checks meaningfully cover the new strict branches, candidate-local equality, malformed atomic failure,
current-text activation, joined language input, and unchanged semantic rejection. The planned compiled and
actual-provider controls remain necessary for endpoint transport, and the later exposed semantic evaluation
remains necessary for usefulness and false-hold measurement.

After my focused review, root reported the final current-tree local gate green: **3,349 tests in 146 files**
and all 17 compiled controls passed, including the new polarity and structured-clock controls. The four
frozen protocol calls are still the appropriate endpoint evidence: copy generation, the two-record answer
verifier, the actual structured-clock translation branch, and retention verification carrying both polarity
enum values.

## Disposition

The V71 diff is ready to freeze from this review's scope. Its residual risks are model judgment and
availability under the unchanged ceilings, both deliberately left to the declared frozen controls and
source-first evaluation. I found no source-authority bypass, selected-ID mix-up, provided-attestation
regression, malformed-response acceptance, clock-text injection, or downstream-gate relaxation.
