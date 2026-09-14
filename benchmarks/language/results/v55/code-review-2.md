# V55 code review round 2

## Scope

Independent review of the uncommitted V55 diff against `f92b04b`, including the design notes, implementation, tests, documentation, changeset, and validation plan. I did not edit implementation or tracked files and made no provider calls.

## Disposition

No outstanding release blocker remains in the reviewed diff. I found one deterministic proposer-agency false hold during review; the implementation and tests were corrected while this review was open, and I independently reproduced the corrected behavior. The immutable-reference audit preserves source authority and every prior acceptance gate. Its remaining limitations are model judgment and the configured output ceiling, both documented and scheduled for frozen-runtime validation.

## Finding and resolution

### Resolved — P1: natural possessive proposed-action wording was held before semantic verification

The initial extension of `unassignedDescription` recognized `proposed action was to ...`, but `ownedProposal` recognized possessive `proposal` only. With source `Ada Marlow proposed reviewing the warranty exceptions`, the source-faithful answer `Her proposed action was to review the warranty exceptions` therefore returned `false` from `proposalAgencySupported` and was removed before the mandatory semantic verifier.

The final helper at [action-agency.ts](../../../../packages/core/src/memory/action-agency.ts#L16) now recognizes named and personal-pronoun possessives followed by optional `tentative` and either `proposal` or `proposed/suggested action`. Tests at [action-agency.test.ts](../../../../packages/core/src/memory/action-agency.test.ts#L11) cover `Her`, a named possessive, and `His/My/Our/Their`, while retaining negative outer-attribution controls. My local direct replay now returns:

- `true` for `Ada Marlow's proposed action ...`, `Her proposed action ...`, and `His suggested action ...`;
- `false` for `According to Ada Marlow, the proposed action was ...` against a source-named proposer.

This remains a presence floor. Pronoun/name identity and multiple-proposal pairing still belong to the mandatory citation-scoped verifier.

## Source authority and binding

The server constructs source coordinates only from the already bound `retentionSourceFrames` map and answer coordinates only from the current generated block at [answer.ts](../../../../packages/core/src/ops/answer.ts#L683). `answerAuditAnchors` hashes the complete owner text, includes the owning evidence/block ID and position in every opaque ID, preserves all text bytes in order, and groups rather than drops excess pieces at [answer-source-audit.ts](../../../../packages/core/src/ops/answer-source-audit.ts#L22). The source-frame lifecycle and its live marker, payload, receipt, hash, singleton-support, and aggregate 4,800-character checks remain unchanged.

For framed verification, the wire payload replaces copied `answer_text` and source-frame strings with ordered `answer_segments` and per-evidence `retention_source_frame` segment tables. The model returns IDs only. Local validation requires:

- every framed evidence ID exactly once;
- every source ID to exist in that evidence record's current coordinate set;
- every answer ID to exist in this block's current coordinate set;
- valid relation/null combinations;
- at least one selected category per cited framed record.

The response schema initially allows the union of known source IDs so it can remain one provider-compatible category schema; `answerAlignmentsSupported` then performs the stricter own-record membership check at [answer-source-audit.ts](../../../../packages/core/src/ops/answer-source-audit.ts#L97). Foreign-record, foreign-block, stale, and unknown IDs fail closed. Segment text and the model-authored `source_context` are not returned to the user or reused as evidence.

Mixed framed/unframed blocks remain coherent: source alignments cover exactly the framed citations, while `required_records`, visible excerpts, aggregate semantic comparison, and excerpt selection still cover the complete singleton block and all its citations. The private `verifyDraftBlock` signature preserves one block per call, preventing another block from supplying an answer anchor or qualification.

## Acceptance gates and schema behavior

All three category relations remain mandatory. `generalized`, `changed`, and `omitted` always cause `answerAlignmentsSupported` to return false; `not_selected` requires a null answer anchor and an all-`not_selected` evidence entry is invalid. These checks are conjunctive with:

- `proposition_supported`;
- `action_arguments_preserved`;
- `qualification_scope_preserved`;
- the consistent retained-excerpt selection verdict.

The existing `semanticVerdictConsistent` check still requires one mismatch for each false aggregate dimension and none for a true dimension. A positive anchor relation or a fluent `source_context` cannot override a negative relation or boolean. Strict `JSON.parse` remains on verifier responses, so truncated and trailing content fail; no loose delimiter repair or retry is introduced.

I serialized a representative two-record V55 verifier schema locally through the repository's Zod version. It is a strict ordinary object schema with `additionalProperties: false`, string enums, and nullable `anyOf`; it contains no `oneOf` and no `const`. This addresses the earlier structured-transport incompatibility shape offline. Actual endpoint acceptance remains for the planned compiled protocol control and frozen exposed probe.

## Generation and language policy

The consolidated generation prompt retains the material prior rules in a clearer priority order: original frame controls meaning, retained excerpt controls selection, complete selected propositions carry actors/mechanisms/polarity/qualifications together, and translation preserves exact names and values. It explicitly forbids importing recording or other actions from the question or adjacent frame, splitting coupled qualifications, turning permission into a booking, losing proposal and personal-negative-action actors, broadening a specific mechanism, changing coverage roles, or resolving an undated source clock.

The verifier separately says that immutable segments are coordinates, full frame/block context controls meaning, same-event nonacceptance can be equivalent to rejection, neighboring details may remain unselected, and an outer reporter cannot replace an embedded proposer. This preserves the retained-excerpt boundary while addressing the V54 lexical-selection and copied-quote failures. `source_context` is correctly documented as attention-only fallible output rather than source authority.

The narrow `hasReportUncertainty` continuation at [retain.ts](../../../../packages/core/src/write/retain.ts#L979) consumes only a closed shared-negation predicate followed by `and/so this/it is/remains ... a possible condition/term/requirement/interpretation/assumption`, with an optional bounded “rather than established” contrast and a sentence/clause/end boundary. Positive confirmation, adversative retraction, a new subject, and unrelated continuations remain negative controls. Admission still proceeds to the existing semantic verifier and keeps the single repair limit.

## Budget and lifecycle

Call count is unchanged: one generation call and one first-pass verifier call per surviving block, with no semantic retry. Framed and ordinary generation behavior remains as before; the verifier request calculation remains bounded by the answer role's authoritative configured ceiling. The committed/evaluation ceiling is 2,400 tokens, and explicit lower caller/provider caps still win.

Immutable IDs reduce verifier output by replacing six copied quote fields per evidence entry with short references, while `source_context` adds at most 240 characters per framed record. The source tables add identifiers to input but preserve the existing bounded source frames: 1,200 characters each and 4,800 total, with at most 24 anchors per text. A large multi-record audit can still exceed a lower configured ceiling and fail closed. The docs and plan state this limitation and do not claim 1,024-token service reliability from the 2,400-token diagnostic.

## Tests and validation reviewed

The tests meaningfully cover byte-preserving deterministic segmentation, owner/content binding, foreign and unknown anchors, cross-record borrowing, exact evidence coverage, every relation/null combination, negative relations despite positive aggregate semantics, all-unselected rejection, mixed framed/unframed citations, private metadata, strict truncated/trailing JSON, framed denial polarity, uncertainty continuation positives and retractions, and proposer-floor positives/negatives. Existing integration fixtures are adapted by selecting IDs from the actual request tables rather than inventing coordinates.

At review time:

- `tmp/v55-focused-final.log` records 498 focused tests passing before the possessive fix;
- the parent reports the focused agency recheck passes after that fix;
- `tmp/v55-suite-final2.log` records the final complete suite passing 2,463 tests across 139 files after the possessive fix;
- the final build/typecheck, lint, knip, and formatting reruns passed; the unchanged docs doctor/build, smoke/package checks, repository safety, and compiled dry controls also passed according to the parent receipts.

Live semantic reliability and provider transport remain intentionally unclaimed until the frozen, one-shot controls and exposed diagnostics in [the V55 plan](../../v55-trial-plan.md) are complete.
