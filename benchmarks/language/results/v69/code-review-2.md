# V69 code review round 2

Base: `387310f`
Scope: final uncommitted V69 implementation, tests, validation plan, and compiled controls. Read-only; no provider or fresh held-out calls.

## Result

No unresolved production blocker remains in the reviewed diff. I found one bounded immediate-retraction defect during this round. Root fixed it, and direct current-source replay plus the added tests confirm the correction. I also identified one stale prompt reference to the removed mechanism `detail` field; it was corrected without changing behavior.

The final design preserves source authority and every mandatory acceptance condition. It changes internal attention/order and bounded lexical floors; it does not add a model pass, semantic retry, public schema, output-cap increase, citation shortcut, or semantic acceptance route.

## Finding and resolution

### Resolved medium — shared immediate-retraction boundary missed two equivalent correction heads

Location: `packages/core/src/memory/clause-ending.ts`, `hasUnretractedClauseEnd`.

The initial shared boundary admitted these natural immediate corrections:

```text
По словам Ada Marlow, в нереализованном варианте покупка дополнительного продления ремонта для Zephyr QX-100 покрыла бы ремонт ступицы колеса в пятом году. Она не приобрела это продление, поэтому речь не идёт о её действующем покрытии. А это неверно.

Ada Marlow proposes reviewing the silverpine repair terms in the month after the initial recording, not after processing. And that is false.
```

Direct initial replay returned `true` from `hasNominalCounterfactual` for the first and `true` from `hasSourceRelativeAnchor` for the second. The helper recognized optional English `and` only with `this is false`, and optional Russian `и` but not `а` before `это неверно`.

The final helper admits `this|that` in the closed English correction and `и|а` in the closed Russian correction. Direct recheck now returns `false` for both reproductions while these non-retracting continuations remain accepted:

```text
... А обсуждение продолжилось.
... And the discussion continued.
```

The regression matrices cover the exact corrections, case/whitespace variants, and affirmative continuations. Scope remains deliberately local to an immediately following sentence or semicolon correction; the helper does not claim to parse later discourse, and the full semantic verifier remains mandatory.

### Resolved low — prompt named a mechanism field that no longer exists

Location: `packages/core/src/ops/answer-source-audit.ts`.

The mechanism paragraph still said `In detail, state ...` after `object_and_mechanism.detail` had been replaced. It now says `In those fields`, consistently referring to `source_specifics` and `answer_specifics`.

## Answer dataflow and source authority

The internal generation schema retains the same two private reading fields and caps. The revised contract establishes readable-excerpt selection first and applies the original frame only as a constraint. It asks the private plan to preserve supplied material source wording before public translation and to identify frame-only neighboring propositions as excluded. The plan cannot expand citations or source truth.

The call path keeps those readings private:

- they are required once for every framed evidence ID, including an empty draft;
- they are not included in verifier input or public output;
- `generatedProse` does not select either private key, while the final block or materialized exact copy still enters the ordinary language check;
- malformed, missing, duplicate, or foreign readings fail the draft before verification.

The language behavior is appropriately local to current supplied bytes. It does not infer a source language from script, historical receipts, or private configuration. Exact source phrases may remain in the private plan while actual blocks must use `output_language`.

The verifier wire now places `excerpt_selection` immediately after `block_id` and before source-frame alignments and semantic decisions. Its prompt limits `source_context` to each cited record's excerpt-selected contribution. The generator/verifier integration tests cover a promise-only citation, a frame-only proposal incorrectly added under that citation, the properly combined proposal-plus-promise citation, and proposal-only evidence that cannot supply the promise. Focused answers remain free to omit an independent proposal act; a block that asserts the act must cite its contributing record.

The mechanism audit uses four strict branches:

- preserved/generalized/changed require source and answer anchors plus non-null `source_specifics` and `answer_specifics`;
- omitted requires a source anchor/description and null answer anchor/description;
- not-selected permits either a source anchor/description with null answer fields or all four coordinate/description fields null.

Each description is capped at 80 characters, preserving the former 160-character aggregate prose allowance. Exact anchor ownership remains checked again per evidence ID after schema parsing. Only `preserved` and `not_selected` can pass `answerAlignmentsSupported`; every negative relation still withholds independently of the three semantic booleans. Mismatch/boolean consistency, excerpt selection, citation validity, qualification guards, strict framed JSON parsing, and full-source semantic verification are unchanged.

The two-frame compiled capture exercises the actual built verifier schema, confirms excerpt-selection wire order, excludes private readings from verifier input, validates all relation/null shapes, and demonstrates negative selection/qualification enforcement. Its protocol echo is an output-shape/transport check and makes no semantic-competence claim.

## Retention floors and boundaries

The report-uncertainty extension derives one-token aliases only from normalized, validated attribution names available after cleaning: the outer source speaker and explicitly reported chain speakers. Ambiguous shared first tokens are removed. A standalone capitalized token no longer acts as a generic short person name. The same source-bound set is supplied when inspecting original frame and candidate prose; short aliases without that set do not pass.

Tests cover exact short outer/inner names, straight and curly possessives, missing or ambiguous attribution names, unrelated titlecase nouns, pronoun/reflexive changes, quote scope, object changes, actor changes, and retractions. Full multiword-name recognition remains a broader pre-existing presence grammar, so changed identity and attribution still belong to mandatory semantic verification.

The complete Russian nominal counterfactual floor requires one closed unit: an expressly unrealized scenario, conditional coverage morphology, explicit nonpurchase, and absence of active personal coverage. Quoted, conditional, realized, truncated, cross-clause, changed-closure, and immediate-retraction controls remain held. The floor does not establish object identity, repair scope, year, or ownership.

The new English initial-recording clock requires an affirmative proposal/review head, bounded object, matched direction/period, initial-recording anchor, and processing contrast. Unknownness remains independently required by `hasUnknownReferenceClock`. Repair diagnostics now distinguish which of those two dimensions is missing without supplying either fact. Quotation, negation/question, device-recording, period/direction mismatch, conditional and retraction controls are present. Full semantics still owns actor, object, clock attachment, causal wording, and actual temporal meaning.

## Budget, compatibility, and validation

The mechanism keys add bounded JSON overhead even though their combined prose cap stays 160 characters. The answer role ceiling remains 2,400 tokens for the declared evaluation; the service's separate 1,024-token overlay is still outside this evidence. This is an availability risk to measure, not a reason to weaken or retry a negative/invalid verdict. The strengthened two-record provider echo is the relevant transport check because it exercises the largest newly changed audit shape while keeping the declared four actual protocol calls unchanged.

Prompt versions advance to answer generation v64 and verifier v44. The public protocol, retention/answer models, one structural repair, pass counts, retry rules, thresholds, and source-byte invariants are unchanged. The changeset and V69 plan describe the final scope.

I observed these final local receipts after the retraction and prompt fixes:

- build/typecheck passed;
- full suite: 3,261 tests across 145 files passed;
- lint, knip, formatting, repository safety, documentation doctor/build, smoke, and installed-package smoke passed;
- compiled exposed replay recognized the four report/clock candidates and four Russian counterfactual drafts while preserving mandatory semantic verification;
- strengthened bounded/rendering controls passed, including the two-frame schema and negative enforcement.

I did not run any provider call. Actual-provider schema transport and semantic reliability remain freeze/deploy evaluation obligations. Within that limitation, the final diff is clean for freeze.
