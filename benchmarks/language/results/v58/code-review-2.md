# V58 code review, round 2

## Scope

I reviewed the current uncommitted implementation against `b55a5bb`, including the V58 trial plan, retention prompt and version, report-uncertainty continuation, generated subject-identifier floor, negative-booking alias grammar, answer generation/verifier prompt changes, focused tests, benchmark receipt version, and changeset. I made no runtime or tracked-file edits and ran no provider calls.

## Findings

I found no remaining correctness blocker in the reviewed diff.

### Negative booking alias

The implementation at `packages/core/src/write/retain.ts:1526` keeps the exception local to `hasAffirmedBooking`. For each actual booking/schedule auxiliary match it removes at most one alias appositive that:

- is at the exact end of the candidate prefix immediately before that auxiliary;
- has both required commas, either inside or outside the closing quote in the two supported punctuation forms;
- uses the exact `referred to as` construction;
- contains only the closed generic aliases `the device`, `the item`, `the unit`, or `the product`; and
- uses one matched quote family.

The remaining prefix must still satisfy the existing negative-subject grammar. An affirmative booking earlier or later in the candidate therefore still makes `hasAffirmedBooking` true and requires a temporal envelope. Missing commas, unquoted aliases, malformed quotes, and an alias containing a predicate do not receive the exception.

The source text and candidate are not rewritten. Candidate cleaning already folds whitespace at `retain.ts:1112` before this grammar runs, so a model line break inside or after the alias behaves like ordinary spaces. The updated tests document that behavior. The new horizontal-whitespace spelling in the local regex prevents the regex itself from claiming a raw-newline allowance; it is not a raw-byte boundary because normalized candidate prose is the intended input.

The integration in `retain-booking-alias.test.ts:37` establishes the important authority boundary: the exact complete structured source and frame reach the original retention verifier, no repair is called for the admitted shape, and a negative semantic verdict still holds it. Removing the V57 alias obstruction does not supply a time, infer a booking state, or bypass semantics.

### Source-wide identifier activation and deciding-frame proof

The new generated-only check at `retain.ts:1173` is rejection-only. It intersects identifiers claimed in `record.subject` with identifiers present in the complete supplied source, then requires each activated identifier in both readable candidate prose and the exact deciding frame. Complete-source presence alone cannot pass the check and never inserts an antecedent. Page titles, destinations, questions, local configuration, and ownership output are absent from this decision.

The check does not claim that a frame occurrence proves coreference. Exact support/frame validation and the full original-source semantic verifier still decide whether the extra span really links the identifier to the proposition. `retain-subject-frame.test.ts:68` exercises both positive and negative semantic outcomes after a repair adds readable identity and the exact antecedent span. The repair remains at original `candidate_index=0`, creates a repair obligation, and undergoes the unchanged frame accounting and semantic dimensions.

Caller-provided candidates remain unchanged because the floor requires `options.generated`. A generic subject and a different identifier such as `QX-1000` defer to existing semantic checks rather than borrowing `QX-100` from another source item. That limitation matches the bounded design; this patch is not a general unsupported-identifier or coreference parser.

The existing repair transaction remains fail closed: only failed original positions are allowed, admitted candidates are compared by position and deep value, duplicate/lost replacements degrade, and repaired candidates retain their original obligations. The V58 change does not modify that code.

### Report-uncertainty continuation and quotes

The new branch at `retain.ts:1057` admits only the existing closed personal negative list followed by a complete `and [pronoun/generic assistant] clarifies that these are [proper name]'s words ... rather than a condition/term/requirement [pronoun/generic assistant] verified/confirmed` continuation. A clause or sentence boundary must follow. It does not accept an arbitrary `and` clause, positive confirmation, a new named grammatical clarifier, or trailing adversative content.

Before this new branch, the implementation masks guillemets, smart/straight double quotes, backticks, smart single quotes, and bounded straight-single quotes. The straight-single form preserves the possessive apostrophe in `Bo Winters's` while masking the enclosing quoted example. The test matrix covers all relevant quote families except guillemets directly; guillemets use the simplest first alternative in the same regex and were already an established quote form. This is a minor coverage limitation, not an implementation defect.

`hasReportUncertainty` is still a presence floor. It runs only when an original source-report frame has uncertainty and generated prose must preserve it. Admission continues to the same full-source verifier, and the tests exercise semantic rejection both with and without the single repair. Pronoun identity is intentionally left to that verifier; the regex does not establish it.

### Collective selection and complete-record scope

The answer-verifier prompt at `packages/core/src/ops/answer.ts:257` now states the frozen V57 contract explicitly: the visible cited excerpts collectively select the block, every citation must contribute supported content, and content absent from the entire visible union remains unselected even if a private frame contains it. This fixes the V57 per-citation misreading without making frames selection authority.

The focused rejection rule at `answer.ts:273` is also correctly bounded. Ordinary composition may omit an independent no-plan neighbor, while coupled actor/action/purpose, verification limits, conditional consequences, and qualifications remain mandatory. The pre-existing `rendering_scope=complete_retained_record` instruction at lines 247–253 still requires every readable clause of the single rendered record. No schema or deterministic aggregation was weakened: excerpt-selection consistency and the three semantic booleans remain required, and each block still receives one verifier call with immutable answer/frame anchors.

Generation now says that a retained proposal to discuss an example does not answer a question about the example's missing promise and asks for contributing citations. These are fallible model instructions. Local fixtures can verify versioning, wiring, and mandatory rejection behavior; they cannot establish that the model will apply collective selection or focused scope reliably. The frozen exposed V58 evaluation remains the meaningful semantic evidence.

### Prompts, budgets, and release plan

The extraction prompt preserves the exact insertion relation and requires an embedded fictional record to carry its source-supported identifier plus the introducing frame span. These instructions align with the deterministic identifier floor and the unchanged object/mechanism verifier. They do not introduce a component dictionary or infer identity.

Prompt receipt versions are coherently advanced to:

- `retain-extraction-language-v42`;
- `answer-generation-v54`; and
- `answer-verifier-v37`.

The grounded-answer benchmark expectation is updated. The retention verifier prompt remains `v30` because its contract did not change. No structured schema, model, call count, retry, token request, configured cap, routing rule, storage format, public evidence, or source-byte behavior changes. The V58 plan preserves the 2,400-token isolated evaluation ceiling and distinguishes it from the configured service overlay.

## Validation and disposition

I ran the five changed/adjacent suites:

```text
Test Files  5 passed (5)
Tests       681 passed (681)
```

These cover the booking alias integration, subject/frame repair integration, report-uncertainty continuation, broader language-retention boundary matrix, and answer operation. `git diff --check` also passed. The parent reports the pre-final complete suite as 2,610 tests across 143 files, with its final focused and repository gates continuing separately.

The current V58 diff preserves source authority, original repair positions, mandatory full-source semantics, private-frame nonselection, and complete-record all-clause scope. I found no false-approval path, caller-contract regression, source-ID ownership bypass, quote/continuation escape, budget regression, or release blocker. The remaining uncertainty is model reliability for the prompt-only changes, which the planned one-shot frozen probes are designed to measure.

## Frozen execution checkpoint

Root reports runtime dae04e21bfe8b5b3f394b634bd8a8efa4f43ddee frozen and pushed, 2,615 tests across 143 files, complete local gates, build/restart/socket deployment, compiled source/answer controls and actual-provider schema controls passed. CI 34313694237 and documentation CI 34313694236 passed. Both declared exposed probes are in progress; no live quality outcome is claimed by this code review.
